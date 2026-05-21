# test_rsa_aes.py — Unit tests for hybrid RSA-AES encryption module.
# Purpose: Tests key generation, encrypt/decrypt roundtrip, serialization,
#          edge cases, and error handling for the RSA-AES hybrid scheme.
# Dependencies: pytest, cryptography, dtn_crypto
# Usage: pytest tests/test_rsa_aes.py -v

"""Tests for the hybrid RSA-AES encryption module."""

from __future__ import annotations

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from dtn_crypto.rsa_aes import HybridCiphertext, hybrid_decrypt, hybrid_encrypt
from dtn_crypto.utils import (
    deserialize_private_key,
    deserialize_public_key,
    generate_aes_key,
    generate_rsa_keypair,
    serialize_private_key,
    serialize_public_key,
)


@pytest.fixture
def rsa_keypair() -> tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]:
    """Generate a fresh RSA key pair for testing."""
    return generate_rsa_keypair(key_size=2048)


class TestKeyGeneration:
    """Tests for RSA and AES key generation."""

    def test_generate_rsa_keypair_default(self) -> None:
        """RSA key pair is generated with default 2048-bit size."""
        priv, pub = generate_rsa_keypair()
        assert priv.key_size == 2048
        assert pub.key_size == 2048

    def test_generate_rsa_keypair_4096(self) -> None:
        """RSA key pair can be generated with 4096-bit size."""
        priv, _pub = generate_rsa_keypair(key_size=4096)
        assert priv.key_size == 4096

    def test_generate_rsa_keypair_rejects_small_key(self) -> None:
        """RSA key generation rejects keys smaller than 2048 bits."""
        with pytest.raises(ValueError, match="at least 2048"):
            generate_rsa_keypair(key_size=1024)

    def test_generate_aes_key_256(self) -> None:
        """AES-256 key is 32 bytes."""
        key = generate_aes_key(256)
        assert len(key) == 32

    def test_generate_aes_key_128(self) -> None:
        """AES-128 key is 16 bytes."""
        key = generate_aes_key(128)
        assert len(key) == 16

    def test_generate_aes_key_192(self) -> None:
        """AES-192 key is 24 bytes."""
        key = generate_aes_key(192)
        assert len(key) == 24

    def test_generate_aes_key_rejects_invalid_size(self) -> None:
        """AES key generation rejects invalid sizes."""
        with pytest.raises(ValueError, match="Invalid AES key size"):
            generate_aes_key(512)

    def test_generated_aes_keys_are_unique(self) -> None:
        """Each generated AES key should be unique (random)."""
        keys = {generate_aes_key(256) for _ in range(10)}
        assert len(keys) == 10


class TestKeySerialization:
    """Tests for RSA key serialization and deserialization."""

    def test_private_key_roundtrip(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        """Private key survives PEM serialization roundtrip."""
        priv, _ = rsa_keypair
        pem = serialize_private_key(priv)
        restored = deserialize_private_key(pem)
        # Verify by comparing key numbers
        assert priv.private_numbers() == restored.private_numbers()

    def test_private_key_roundtrip_with_password(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        """Private key survives encrypted PEM serialization roundtrip."""
        priv, _ = rsa_keypair
        password = b"test-password-123"
        pem = serialize_private_key(priv, password=password)
        restored = deserialize_private_key(pem, password=password)
        assert priv.private_numbers() == restored.private_numbers()

    def test_public_key_roundtrip(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        """Public key survives PEM serialization roundtrip."""
        _, pub = rsa_keypair
        pem = serialize_public_key(pub)
        restored = deserialize_public_key(pem)
        assert pub.public_numbers() == restored.public_numbers()


class TestHybridEncryption:
    """Tests for hybrid RSA-AES encrypt/decrypt."""

    def test_roundtrip_basic(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        """Basic encrypt-then-decrypt returns original plaintext."""
        priv, pub = rsa_keypair
        plaintext = b"Hello, DTN World!"
        ct = hybrid_encrypt(plaintext, pub)
        result = hybrid_decrypt(ct, priv)
        assert result == plaintext

    def test_roundtrip_large_payload(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        """Hybrid encryption handles large payloads (1 MB)."""
        priv, pub = rsa_keypair
        plaintext = b"X" * (1024 * 1024)  # 1 MB
        ct = hybrid_encrypt(plaintext, pub)
        result = hybrid_decrypt(ct, priv)
        assert result == plaintext

    def test_roundtrip_with_aad(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        """Hybrid encryption works with additional authenticated data."""
        priv, pub = rsa_keypair
        plaintext = b"Authenticated payload"
        aad = b"bundle-id:12345"
        ct = hybrid_encrypt(plaintext, pub, aad=aad)
        result = hybrid_decrypt(ct, priv)
        assert result == plaintext

    def test_wrong_key_fails(self) -> None:
        """Decryption with wrong private key raises an error."""
        _, pub_a = generate_rsa_keypair()
        priv_b, _ = generate_rsa_keypair()
        plaintext = b"Secret message"
        ct = hybrid_encrypt(plaintext, pub_a)
        with pytest.raises(ValueError):
            hybrid_decrypt(ct, priv_b)

    def test_empty_plaintext_raises(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        """Encrypting empty plaintext raises ValueError."""
        _, pub = rsa_keypair
        with pytest.raises(ValueError, match="must not be empty"):
            hybrid_encrypt(b"", pub)

    def test_ciphertext_is_different_from_plaintext(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        """Ciphertext should not equal the plaintext."""
        _, pub = rsa_keypair
        plaintext = b"This is a test"
        ct = hybrid_encrypt(plaintext, pub)
        assert ct.ciphertext != plaintext

    def test_different_encryptions_produce_different_ciphertexts(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        """Two encryptions of the same plaintext produce different ciphertexts."""
        _, pub = rsa_keypair
        plaintext = b"Same payload"
        ct1 = hybrid_encrypt(plaintext, pub)
        ct2 = hybrid_encrypt(plaintext, pub)
        assert ct1.nonce != ct2.nonce or ct1.encrypted_key != ct2.encrypted_key


class TestHybridCiphertextSerialization:
    """Tests for HybridCiphertext serialization."""

    def test_dict_roundtrip(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        """HybridCiphertext survives dict serialization roundtrip."""
        priv, pub = rsa_keypair
        plaintext = b"Serialization test"
        ct = hybrid_encrypt(plaintext, pub)
        d = ct.to_dict()
        restored = HybridCiphertext.from_dict(d)
        result = hybrid_decrypt(restored, priv)
        assert result == plaintext

    def test_dict_roundtrip_with_aad(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        """HybridCiphertext with AAD survives dict serialization."""
        priv, pub = rsa_keypair
        plaintext = b"AAD serialization test"
        aad = b"extra-data"
        ct = hybrid_encrypt(plaintext, pub, aad=aad)
        d = ct.to_dict()
        assert "aad" in d
        restored = HybridCiphertext.from_dict(d)
        result = hybrid_decrypt(restored, priv)
        assert result == plaintext
