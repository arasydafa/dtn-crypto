# utils.py — Key generation, serialization, and helper utilities for dtn-crypto.
# Purpose: Provides RSA key pair generation, key serialization/deserialization,
#          AES key generation, and common encoding helpers.
# Dependencies: cryptography
# Usage: from dtn_crypto.utils import generate_rsa_keypair, generate_aes_key

"""Utility functions for key generation, serialization, and encoding."""

from __future__ import annotations

import base64
import os
import time

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


def generate_rsa_keypair(
    key_size: int = 2048,
    public_exponent: int = 65537,
) -> tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]:
    """Generate an RSA key pair.

    Args:
        key_size: The size of the RSA key in bits. Must be at least 2048.
        public_exponent: The public exponent. Typically 65537.

    Returns:
        A tuple of (private_key, public_key).

    Raises:
        ValueError: If key_size is less than 2048.
    """
    if key_size < 2048:
        raise ValueError(
            "RSA key size must be at least 2048 bits for security.")
    private_key = rsa.generate_private_key(
        public_exponent=public_exponent,
        key_size=key_size,
    )
    public_key = private_key.public_key()
    return private_key, public_key


def generate_aes_key(key_size: int = 256) -> bytes:
    """Generate a random AES symmetric key.

    Args:
        key_size: The AES key size in bits. Must be 128, 192, or 256.

    Returns:
        A random byte string of the appropriate length.

    Raises:
        ValueError: If key_size is not 128, 192, or 256.
    """
    if key_size not in (128, 192, 256):
        raise ValueError(
            f"Invalid AES key size: {key_size}. Must be 128, 192, or 256.")
    return os.urandom(key_size // 8)


def serialize_private_key(
    private_key: rsa.RSAPrivateKey,
    password: bytes | None = None,
) -> bytes:
    """Serialize an RSA private key to PEM format.

    Args:
        private_key: The RSA private key to serialize.
        password: Optional password to encrypt the key. If None, key is unencrypted.

    Returns:
        PEM-encoded private key bytes.
    """
    encryption: serialization.KeySerializationEncryption
    if password is not None:
        encryption = serialization.BestAvailableEncryption(password)
    else:
        encryption = serialization.NoEncryption()
    return private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=encryption,
    )


def deserialize_private_key(
    pem_data: bytes,
    password: bytes | None = None,
) -> rsa.RSAPrivateKey:
    """Deserialize an RSA private key from PEM format.

    Args:
        pem_data: PEM-encoded private key bytes.
        password: Password if the key is encrypted. None for unencrypted keys.

    Returns:
        The deserialized RSA private key.
    """
    key = serialization.load_pem_private_key(pem_data, password=password)
    if not isinstance(key, rsa.RSAPrivateKey):
        raise TypeError("Loaded key is not an RSA private key.")
    return key


def serialize_public_key(public_key: rsa.RSAPublicKey) -> bytes:
    """Serialize an RSA public key to PEM format.

    Args:
        public_key: The RSA public key to serialize.

    Returns:
        PEM-encoded public key bytes.
    """
    return public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )


def deserialize_public_key(pem_data: bytes) -> rsa.RSAPublicKey:
    """Deserialize an RSA public key from PEM format.

    Args:
        pem_data: PEM-encoded public key bytes.

    Returns:
        The deserialized RSA public key.
    """
    key = serialization.load_pem_public_key(pem_data)
    if not isinstance(key, rsa.RSAPublicKey):
        raise TypeError("Loaded key is not an RSA public key.")
    return key


def bytes_to_base64(data: bytes) -> str:
    """Encode bytes to a URL-safe base64 string.

    Args:
        data: The byte string to encode.

    Returns:
        A URL-safe base64-encoded string.
    """
    return base64.urlsafe_b64encode(data).decode("ascii")


def base64_to_bytes(data: str) -> bytes:
    """Decode a URL-safe base64 string to bytes.

    Args:
        data: The URL-safe base64-encoded string.

    Returns:
        The decoded byte string.
    """
    return base64.urlsafe_b64decode(data.encode("ascii"))


def current_timestamp() -> float:
    """Return the current UTC timestamp as a float.

    Returns:
        Current time as seconds since epoch.
    """
    return time.time()
