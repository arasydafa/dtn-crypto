# test_bundle.py — Unit tests for DTN bundle wrapping module.
# Purpose: Tests bundle creation, layered encryption/decryption, metadata
#          handling, TTL/hop mechanics, and error conditions.
# Dependencies: pytest, cryptography, dtn_crypto
# Usage: pytest tests/test_bundle.py -v

"""Tests for the DTN bundle wrapping module."""

from __future__ import annotations

import json

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from .bundle import (
    BundleBuilder,
    BundleDecryptionError,
    BundleMetadata,
    BundlePriority,
    SecureBundle,
)
from .cpabe import (
    CPABEMasterKey,
    CPABEPublicParams,
    CPABEService,
    Policy,
)
from .utils import generate_rsa_keypair


@pytest.fixture
def cpabe_system() -> tuple[CPABEService, CPABEMasterKey, CPABEPublicParams]:
    """Set up a fresh CP-ABE system."""
    service = CPABEService()
    mk, pp = service.setup(key_id="bundle-test")
    return service, mk, pp


@pytest.fixture
def node_keys() -> tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]:
    """Generate RSA keys for a destination node."""
    return generate_rsa_keypair(key_size=2048)


class TestBundleMetadata:
    """Tests for BundleMetadata."""

    def test_create_metadata(self) -> None:
        """Metadata is created with correct fields."""
        meta = BundleMetadata(
            bundle_id="test-001",
            source="node-A",
            destination="node-B",
            creation_time=1000.0,
            ttl=3600,
            priority=BundlePriority.NORMAL,
        )
        assert meta.bundle_id == "test-001"
        assert meta.source == "node-A"
        assert meta.destination == "node-B"
        assert meta.ttl == 3600
        assert meta.priority == BundlePriority.NORMAL
        assert meta.hop_count == 0

    def test_is_expired_false(self) -> None:
        """Bundle is not expired within TTL."""
        meta = BundleMetadata(
            bundle_id="test-002",
            source="A",
            destination="B",
            creation_time=1000.0,
            ttl=3600,
        )
        assert not meta.is_expired(current_time=2000.0)

    def test_is_expired_true(self) -> None:
        """Bundle is expired after TTL."""
        meta = BundleMetadata(
            bundle_id="test-003",
            source="A",
            destination="B",
            creation_time=1000.0,
            ttl=3600,
        )
        assert meta.is_expired(current_time=5000.0)

    def test_is_expired_exact_boundary(self) -> None:
        """Bundle is expired at exactly TTL + 1."""
        meta = BundleMetadata(
            bundle_id="test-004",
            source="A",
            destination="B",
            creation_time=1000.0,
            ttl=100,
        )
        assert not meta.is_expired(current_time=1100.0)
        assert meta.is_expired(current_time=1100.1)

    def test_increment_hop_within_limit(self) -> None:
        """Hop increment returns True within max limit."""
        meta = BundleMetadata(
            bundle_id="test-005",
            source="A",
            destination="B",
            creation_time=1000.0,
            max_hop_count=3,
        )
        assert meta.increment_hop()  # hop_count = 1
        assert meta.increment_hop()  # hop_count = 2
        assert meta.increment_hop()  # hop_count = 3

    def test_increment_hop_exceeds_limit(self) -> None:
        """Hop increment returns False when max hops exceeded."""
        meta = BundleMetadata(
            bundle_id="test-006",
            source="A",
            destination="B",
            creation_time=1000.0,
            max_hop_count=2,
        )
        meta.increment_hop()  # 1
        meta.increment_hop()  # 2
        assert not meta.increment_hop()  # 3 > 2

    def test_metadata_dict_roundtrip(self) -> None:
        """Metadata survives dict serialization roundtrip."""
        meta = BundleMetadata(
            bundle_id="test-007",
            source="node-A",
            destination="node-B",
            creation_time=1234.5,
            ttl=7200,
            priority=BundlePriority.EXPEDITED,
            hop_count=3,
            max_hop_count=10,
            is_encrypted=True,
            crypto_layers=["cpabe", "rsa_aes"],
        )
        d = meta.to_dict()
        restored = BundleMetadata.from_dict(d)
        assert restored.bundle_id == meta.bundle_id
        assert restored.source == meta.source
        assert restored.destination == meta.destination
        assert restored.ttl == meta.ttl
        assert restored.priority == BundlePriority.EXPEDITED
        assert restored.hop_count == 3
        assert restored.crypto_layers == ["cpabe", "rsa_aes"]

    def test_priority_levels(self) -> None:
        """All priority levels have correct integer values."""
        assert BundlePriority.BULK == 0
        assert BundlePriority.NORMAL == 1
        assert BundlePriority.EXPEDITED == 2
        assert BundlePriority.CRITICAL == 3


class TestBundleBuilder:
    """Tests for creating secure bundles with layered encryption."""

    def test_create_secure_bundle(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
        node_keys: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey],
    ) -> None:
        """Secure bundle is created with correct structure."""
        service, _mk, pp = cpabe_system
        _, pub = node_keys
        builder = BundleBuilder(service, pp)
        policy = Policy("role:receiver")
        bundle = builder.create_secure_bundle(
            payload=b"Hello DTN!",
            source="node-A",
            destination="node-B",
            dest_public_key=pub,
            policy=policy,
        )
        assert bundle.metadata.source == "node-A"
        assert bundle.metadata.destination == "node-B"
        assert bundle.metadata.is_encrypted is True
        assert bundle.metadata.crypto_layers == ["cpabe", "rsa_aes"]
        assert bundle.cpabe_policy == "role:receiver"
        assert "encrypted_key" in bundle.encrypted_payload

    def test_full_encrypt_decrypt_roundtrip(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
        node_keys: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey],
    ) -> None:
        """Full encrypt-decrypt roundtrip through both crypto layers."""
        service, mk, pp = cpabe_system
        priv, pub = node_keys
        user_key = service.keygen(mk, pp, ["role:receiver"])
        builder = BundleBuilder(service, pp)
        policy = Policy("role:receiver")
        plaintext = b"Top secret DTN message"
        bundle = builder.create_secure_bundle(
            payload=plaintext,
            source="node-A",
            destination="node-B",
            dest_public_key=pub,
            policy=policy,
        )
        result = bundle.decrypt_payload(priv, user_key, pp, service)
        assert result == plaintext

    def test_decrypt_with_wrong_rsa_key_fails(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
        node_keys: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey],
    ) -> None:
        """Decryption fails with wrong RSA private key."""
        service, mk, pp = cpabe_system
        _, pub = node_keys
        wrong_priv, _ = generate_rsa_keypair()
        user_key = service.keygen(mk, pp, ["role:receiver"])
        builder = BundleBuilder(service, pp)
        bundle = builder.create_secure_bundle(
            payload=b"Secret",
            source="A",
            destination="B",
            dest_public_key=pub,
            policy=Policy("role:receiver"),
        )
        with pytest.raises(BundleDecryptionError, match="RSA-AES decryption failed"):
            bundle.decrypt_payload(wrong_priv, user_key, pp, service)

    def test_decrypt_with_wrong_cpabe_attributes_fails(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
        node_keys: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey],
    ) -> None:
        """Decryption fails when CP-ABE attributes don't match policy."""
        service, mk, pp = cpabe_system
        priv, pub = node_keys
        # User with wrong attributes
        user_key = service.keygen(mk, pp, ["role:intruder"])
        builder = BundleBuilder(service, pp)
        bundle = builder.create_secure_bundle(
            payload=b"Restricted data",
            source="A",
            destination="B",
            dest_public_key=pub,
            policy=Policy("role:receiver AND clearance:high"),
        )
        with pytest.raises(BundleDecryptionError, match="CP-ABE decryption failed"):
            bundle.decrypt_payload(priv, user_key, pp, service)

    def test_custom_bundle_id_and_time(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
        node_keys: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey],
    ) -> None:
        """Bundle accepts custom ID and creation time."""
        service, _, pp = cpabe_system
        _, pub = node_keys
        builder = BundleBuilder(service, pp)
        bundle = builder.create_secure_bundle(
            payload=b"Data",
            source="A",
            destination="B",
            dest_public_key=pub,
            policy=Policy("role:any"),
            bundle_id="custom-id-123",
            creation_time=9999.0,
        )
        assert bundle.metadata.bundle_id == "custom-id-123"
        assert bundle.metadata.creation_time == 9999.0

    def test_custom_ttl_and_priority(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
        node_keys: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey],
    ) -> None:
        """Bundle accepts custom TTL and priority."""
        service, _, pp = cpabe_system
        _, pub = node_keys
        builder = BundleBuilder(service, pp)
        bundle = builder.create_secure_bundle(
            payload=b"Urgent",
            source="A",
            destination="B",
            dest_public_key=pub,
            policy=Policy("role:any"),
            ttl=60,
            priority=BundlePriority.CRITICAL,
        )
        assert bundle.metadata.ttl == 60
        assert bundle.metadata.priority == BundlePriority.CRITICAL

    def test_empty_payload_raises(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
        node_keys: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey],
    ) -> None:
        """Creating bundle with empty payload raises ValueError."""
        service, _, pp = cpabe_system
        _, pub = node_keys
        builder = BundleBuilder(service, pp)
        with pytest.raises(ValueError, match="must not be empty"):
            builder.create_secure_bundle(
                payload=b"",
                source="A",
                destination="B",
                dest_public_key=pub,
                policy=Policy("role:any"),
            )

    def test_large_payload_roundtrip(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
        node_keys: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey],
    ) -> None:
        """Large payload survives full encrypt-decrypt roundtrip."""
        service, mk, pp = cpabe_system
        priv, pub = node_keys
        user_key = service.keygen(mk, pp, ["role:receiver"])
        builder = BundleBuilder(service, pp)
        plaintext = b"Z" * (256 * 1024)  # 256 KB
        bundle = builder.create_secure_bundle(
            payload=plaintext,
            source="A",
            destination="B",
            dest_public_key=pub,
            policy=Policy("role:receiver"),
        )
        result = bundle.decrypt_payload(priv, user_key, pp, service)
        assert result == plaintext


class TestSecureBundleSerialization:
    """Tests for SecureBundle serialization."""

    def test_bundle_dict_roundtrip(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
        node_keys: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey],
    ) -> None:
        """SecureBundle survives dict serialization and remains decryptable."""
        service, mk, pp = cpabe_system
        priv, pub = node_keys
        user_key = service.keygen(mk, pp, ["role:receiver"])
        builder = BundleBuilder(service, pp)
        plaintext = b"Roundtrip through serialization"
        bundle = builder.create_secure_bundle(
            payload=plaintext,
            source="A",
            destination="B",
            dest_public_key=pub,
            policy=Policy("role:receiver"),
        )
        # Serialize and deserialize
        d = bundle.to_dict()
        json_str = json.dumps(d)
        restored_dict = json.loads(json_str)
        restored = SecureBundle.from_dict(restored_dict)
        # Verify decryptable
        result = restored.decrypt_payload(priv, user_key, pp, service)
        assert result == plaintext

    def test_bundle_json_serializable(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
        node_keys: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey],
    ) -> None:
        """SecureBundle can be fully serialized to JSON."""
        service, _, pp = cpabe_system
        _, pub = node_keys
        builder = BundleBuilder(service, pp)
        bundle = builder.create_secure_bundle(
            payload=b"JSON test",
            source="A",
            destination="B",
            dest_public_key=pub,
            policy=Policy("role:any"),
        )
        # This should not raise
        json_str = json.dumps(bundle.to_dict())
        assert len(json_str) > 0
