# rsa_aes.py — Hybrid RSA-AES encryption and decryption for dtn-crypto.
# Purpose: Implements hybrid encryption where AES-GCM encrypts the payload and
#          RSA-OAEP wraps the AES session key. This provides both performance
#          (symmetric bulk encryption) and secure key exchange (asymmetric).
# Dependencies: cryptography
# Usage:
#   from dtn_crypto.rsa_aes import hybrid_encrypt, hybrid_decrypt
#   ct = hybrid_encrypt(plaintext, public_key)
#   pt = hybrid_decrypt(ct, private_key)

"""Hybrid RSA-AES encryption combining RSA-OAEP key wrapping with AES-GCM."""

from __future__ import annotations

import os
from dataclasses import dataclass

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .utils import base64_to_bytes, bytes_to_base64

# AES-GCM nonce size in bytes (96-bit nonce is recommended for GCM)
_AES_NONCE_SIZE = 12
# Default AES key size in bytes
_AES_KEY_SIZE = 32  # 256-bit


@dataclass(frozen=True)
class HybridCiphertext:
    """Container for hybrid RSA-AES ciphertext components.

    Attributes:
        encrypted_key: The AES session key encrypted with RSA-OAEP.
        nonce: The AES-GCM nonce used for encryption.
        ciphertext: The AES-GCM encrypted payload (includes auth tag).
        aad: Optional additional authenticated data that was included.
    """
    encrypted_key: bytes
    nonce: bytes
    ciphertext: bytes
    aad: bytes | None = None

    def to_dict(self) -> dict[str, str]:
        """Serialize to a dictionary with base64-encoded values.

        Returns:
            Dictionary with base64-encoded string values.
        """
        result: dict[str, str] = {
            "encrypted_key": bytes_to_base64(self.encrypted_key),
            "nonce": bytes_to_base64(self.nonce),
            "ciphertext": bytes_to_base64(self.ciphertext),
        }
        if self.aad is not None:
            result["aad"] = bytes_to_base64(self.aad)
        return result

    @classmethod
    def from_dict(cls, data: dict[str, str]) -> HybridCiphertext:
        """Deserialize from a dictionary with base64-encoded values.

        Args:
            data: Dictionary with base64-encoded string values.

        Returns:
            A HybridCiphertext instance.
        """
        aad = base64_to_bytes(data["aad"]) if "aad" in data else None
        return cls(
            encrypted_key=base64_to_bytes(data["encrypted_key"]),
            nonce=base64_to_bytes(data["nonce"]),
            ciphertext=base64_to_bytes(data["ciphertext"]),
            aad=aad,
        )


def _get_oaep_padding() -> padding.OAEP:
    """Return the standard OAEP padding configuration.

    Returns:
        An OAEP padding instance with SHA-256 and MGF1.
    """
    return padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None,
    )


def hybrid_encrypt(
    plaintext: bytes,
    public_key: rsa.RSAPublicKey,
    aad: bytes | None = None,
    aes_key_size: int = _AES_KEY_SIZE,
) -> HybridCiphertext:
    """Encrypt data using hybrid RSA-AES encryption.

    Generates a random AES-256 session key, encrypts the plaintext with
    AES-GCM, then wraps the session key with RSA-OAEP using the recipient's
    public key.

    Args:
        plaintext: The data to encrypt.
        public_key: The recipient's RSA public key for key wrapping.
        aad: Optional additional authenticated data for AES-GCM.
        aes_key_size: AES key size in bytes (default 32 = 256-bit).

    Returns:
        A HybridCiphertext containing the encrypted key, nonce, and ciphertext.

    Raises:
        ValueError: If plaintext is empty.
    """
    if not plaintext:
        raise ValueError("Plaintext must not be empty.")

    # Generate ephemeral AES session key
    aes_key = os.urandom(aes_key_size)
    nonce = os.urandom(_AES_NONCE_SIZE)

    # Encrypt payload with AES-GCM
    aesgcm = AESGCM(aes_key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, aad)

    # Wrap the AES key with RSA-OAEP
    encrypted_key = public_key.encrypt(aes_key, _get_oaep_padding())

    return HybridCiphertext(
        encrypted_key=encrypted_key,
        nonce=nonce,
        ciphertext=ciphertext,
        aad=aad,
    )


def hybrid_decrypt(
    hybrid_ct: HybridCiphertext,
    private_key: rsa.RSAPrivateKey,
) -> bytes:
    """Decrypt data encrypted with hybrid RSA-AES encryption.

    Unwraps the AES session key using RSA-OAEP, then decrypts the payload
    with AES-GCM.

    Args:
        hybrid_ct: The hybrid ciphertext to decrypt.
        private_key: The recipient's RSA private key for key unwrapping.

    Returns:
        The decrypted plaintext bytes.

    Raises:
        cryptography.exceptions.InvalidTag: If ciphertext is tampered with.
        ValueError: If the RSA key unwrap fails.
    """
    # Unwrap the AES key with RSA-OAEP
    aes_key = private_key.decrypt(hybrid_ct.encrypted_key, _get_oaep_padding())

    # Decrypt payload with AES-GCM
    aesgcm = AESGCM(aes_key)
    plaintext = aesgcm.decrypt(
        hybrid_ct.nonce, hybrid_ct.ciphertext, hybrid_ct.aad)

    return plaintext
