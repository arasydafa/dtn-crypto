# bundle.py — DTN Bundle wrapping with layered hybrid cryptography.
# Purpose: Implements DTN Bundle Protocol-like containers that wrap payloads
#          with layered RSA-AES + CP-ABE encryption for delay-tolerant networks.
# Dependencies: cryptography, dtn_crypto.rsa_aes, dtn_crypto.cpabe
# Usage:
#   from dtn_crypto.bundle import BundleBuilder, SecureBundle
#   builder = BundleBuilder(cpabe_service, public_params)
#   bundle = builder.create_secure_bundle(payload, src, dst, rsa_pub, policy)
#   plaintext = bundle.decrypt_payload(rsa_priv, user_key, public_params, cpabe_service)

"""DTN Bundle wrapping with layered hybrid RSA-AES + CP-ABE encryption.

Implements a secure bundle format for Delay-Tolerant Networks (DTN) where
each bundle payload is protected by two cryptographic layers:

Layer 1 (Inner): CP-ABE encryption — policy-based access control ensuring
    only nodes with matching attributes can access the content.
Layer 2 (Outer): RSA-AES hybrid encryption — public-key encryption ensuring
    only the intended destination node can unwrap the inner layer.

This dual-layer approach provides both confidentiality (RSA-AES) and
fine-grained access control (CP-ABE) suitable for disconnected, multi-hop
network environments.
"""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from enum import IntEnum

from cryptography.hazmat.primitives.asymmetric import rsa

from .cpabe import (
    CPABECiphertext,
    CPABEDecryptionError,
    CPABEPublicParams,
    CPABEService,
    CPABEUserKey,
    Policy,
)
from .rsa_aes import HybridCiphertext, hybrid_decrypt, hybrid_encrypt
from .utils import current_timestamp


class BundlePriority(IntEnum):
    """Bundle priority levels per DTN Bundle Protocol.

    Attributes:
        BULK: Lowest priority, delay-tolerant bulk data.
        NORMAL: Standard priority.
        EXPEDITED: High priority, time-sensitive.
        CRITICAL: Highest priority, mission-critical data.
    """
    BULK = 0
    NORMAL = 1
    EXPEDITED = 2
    CRITICAL = 3


@dataclass
class BundleMetadata:
    """Metadata header for a DTN bundle.

    Attributes:
        bundle_id: Unique identifier for this bundle.
        source: Source node identifier.
        destination: Destination node identifier.
        creation_time: Unix timestamp of bundle creation.
        ttl: Time-to-live in seconds.
        priority: Bundle priority level.
        hop_count: Number of hops this bundle has traversed.
        max_hop_count: Maximum allowed hops before the bundle is dropped.
        is_encrypted: Whether the payload is encrypted.
        crypto_layers: List of cryptographic layers applied (e.g., ["rsa_aes", "cpabe"]).
    """
    bundle_id: str
    source: str
    destination: str
    creation_time: float
    ttl: int = 3600
    priority: BundlePriority = BundlePriority.NORMAL
    hop_count: int = 0
    max_hop_count: int = 32
    is_encrypted: bool = False
    crypto_layers: list[str] = field(default_factory=list)
    payload_hash: str = ""

    def is_expired(self, current_time: float | None = None) -> bool:
        """Check if this bundle has expired based on TTL.

        Args:
            current_time: The current time to check against. Uses wall clock if None.

        Returns:
            True if the bundle has expired.
        """
        if current_time is None:
            current_time = time.time()
        return (current_time - self.creation_time) > self.ttl

    def increment_hop(self) -> bool:
        """Increment the hop count and check if max hops exceeded.

        Returns:
            True if the bundle is still valid (under max hops), False if it
            should be dropped.
        """
        self.hop_count += 1
        return self.hop_count <= self.max_hop_count

    def to_dict(self) -> dict[str, object]:
        """Serialize metadata to a dictionary.

        Returns:
            Dictionary representation of the metadata.
        """
        return {
            "bundle_id": self.bundle_id,
            "source": self.source,
            "destination": self.destination,
            "creation_time": self.creation_time,
            "ttl": self.ttl,
            "priority": int(self.priority),
            "hop_count": self.hop_count,
            "max_hop_count": self.max_hop_count,
            "is_encrypted": self.is_encrypted,
            "crypto_layers": self.crypto_layers,
            "payload_hash": self.payload_hash,
        }

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> BundleMetadata:
        """Deserialize metadata from a dictionary.

        Args:
            data: Dictionary representation of the metadata.

        Returns:
            A BundleMetadata instance.
        """
        return cls(
            bundle_id=str(data["bundle_id"]),
            source=str(data["source"]),
            destination=str(data["destination"]),
            # type: ignore[arg-type]
            creation_time=float(data["creation_time"]),
            ttl=int(data["ttl"]),  # type: ignore[arg-type]
            # type: ignore[arg-type]
            priority=BundlePriority(int(data["priority"])),
            hop_count=int(data["hop_count"]),  # type: ignore[arg-type]
            max_hop_count=int(data["max_hop_count"]),  # type: ignore[arg-type]
            is_encrypted=bool(data["is_encrypted"]),
            # type: ignore[arg-type]
            crypto_layers=list(data["crypto_layers"]),
            payload_hash=str(data.get("payload_hash", "")),
        )


@dataclass
class SecureBundle:
    """A DTN bundle with layered cryptographic protection.

    The payload is encrypted with two layers:
    1. Inner layer: CP-ABE (policy-based access control)
    2. Outer layer: RSA-AES hybrid (destination-specific encryption)

    To decrypt, the receiver must first unwrap RSA-AES (using their private key),
    then decrypt CP-ABE (using their attribute-based key).

    Attributes:
        metadata: Bundle metadata header.
        encrypted_payload: The outer-layer RSA-AES ciphertext as a serialized dict,
            or the raw payload bytes if unencrypted.
        cpabe_policy: The CP-ABE policy string applied to this bundle, if any.
    """
    metadata: BundleMetadata
    encrypted_payload: dict[str, str]
    cpabe_policy: str | None = None

    def decrypt_payload(
        self,
        rsa_private_key: rsa.RSAPrivateKey,
        cpabe_user_key: CPABEUserKey,
        cpabe_public_params: CPABEPublicParams,
        cpabe_service: CPABEService,
    ) -> bytes:
        """Decrypt the bundle payload through both cryptographic layers.

        Decryption order:
        1. RSA-AES hybrid decryption (outer layer) to recover CP-ABE ciphertext
        2. CP-ABE decryption (inner layer) to recover plaintext

        Args:
            rsa_private_key: The destination node's RSA private key.
            cpabe_user_key: The user's CP-ABE attribute-based key.
            cpabe_public_params: CP-ABE public parameters.
            cpabe_service: The CP-ABE service instance for decryption.

        Returns:
            The decrypted plaintext bytes.

        Raises:
            BundleDecryptionError: If either decryption layer fails.
        """
        try:
            # Layer 2 (Outer): RSA-AES hybrid decryption
            hybrid_ct = HybridCiphertext.from_dict(self.encrypted_payload)
            cpabe_ct_bytes = hybrid_decrypt(hybrid_ct, rsa_private_key)
        except Exception as e:
            raise BundleDecryptionError(
                f"RSA-AES decryption failed for bundle {self.metadata.bundle_id}: {e}"
            ) from e

        try:
            # Deserialize the CP-ABE ciphertext
            cpabe_ct_dict = json.loads(cpabe_ct_bytes.decode("utf-8"))
            cpabe_ct = CPABECiphertext.from_dict(cpabe_ct_dict)
        except Exception as e:
            raise BundleDecryptionError(
                f"CP-ABE ciphertext deserialization failed for bundle "
                f"{self.metadata.bundle_id}: {e}"
            ) from e

        try:
            # Layer 1 (Inner): CP-ABE decryption
            plaintext = cpabe_service.decrypt(
                cpabe_ct, cpabe_user_key, cpabe_public_params)
        except CPABEDecryptionError as e:
            raise BundleDecryptionError(
                f"CP-ABE decryption failed for bundle {self.metadata.bundle_id}: {e}"
            ) from e

        # Verify SHA-256 integrity if hash is present
        if self.metadata.payload_hash:
            computed_hash = hashlib.sha256(plaintext).hexdigest()
            if computed_hash != self.metadata.payload_hash:
                raise BundleIntegrityError(
                    f"SHA-256 integrity check failed for bundle "
                    f"{self.metadata.bundle_id}: expected "
                    f"{self.metadata.payload_hash[:16]}..., got {computed_hash[:16]}..."
                )

        return plaintext

    def to_dict(self) -> dict[str, object]:
        """Serialize the secure bundle to a dictionary.

        Returns:
            Dictionary representation of the bundle.
        """
        return {
            "metadata": self.metadata.to_dict(),
            "encrypted_payload": self.encrypted_payload,
            "cpabe_policy": self.cpabe_policy,
        }

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> SecureBundle:
        """Deserialize a secure bundle from a dictionary.

        Args:
            data: Dictionary representation of the bundle.

        Returns:
            A SecureBundle instance.
        """
        return cls(
            metadata=BundleMetadata.from_dict(
                data["metadata"]),  # type: ignore[arg-type]
            # type: ignore[assignment]
            encrypted_payload=data["encrypted_payload"],
            cpabe_policy=data.get("cpabe_policy"),  # type: ignore[arg-type]
        )


class BundleDecryptionError(Exception):
    """Raised when bundle decryption fails at any layer."""


class BundleIntegrityError(BundleDecryptionError):
    """Raised when SHA-256 integrity verification fails after decryption."""


class BundleBuilder:
    """Factory for creating secure DTN bundles with layered encryption.

    Handles the full encryption pipeline: CP-ABE inner layer, then RSA-AES
    outer layer, producing a SecureBundle ready for DTN transmission.

    Args:
        cpabe_service: The CP-ABE service for inner-layer encryption.
        cpabe_public_params: CP-ABE public parameters.

    Example:
        >>> builder = BundleBuilder(cpabe_service, public_params)
        >>> bundle = builder.create_secure_bundle(
        ...     payload=b"Hello, DTN!",
        ...     source="node-A",
        ...     destination="node-B",
        ...     dest_public_key=node_b_rsa_pub,
        ...     policy=Policy("role:receiver AND clearance:high"),
        ... )
    """

    def __init__(
        self,
        cpabe_service: CPABEService,
        cpabe_public_params: CPABEPublicParams,
    ) -> None:
        """Initialize the BundleBuilder.

        Args:
            cpabe_service: The CP-ABE service for inner-layer encryption.
            cpabe_public_params: CP-ABE public parameters for encryption.
        """
        self._cpabe_service = cpabe_service
        self._cpabe_public_params = cpabe_public_params

    def create_secure_bundle(
        self,
        payload: bytes,
        source: str,
        destination: str,
        dest_public_key: rsa.RSAPublicKey,
        policy: Policy,
        ttl: int = 3600,
        priority: BundlePriority = BundlePriority.NORMAL,
        max_hop_count: int = 32,
        bundle_id: str | None = None,
        creation_time: float | None = None,
    ) -> SecureBundle:
        """Create a fully encrypted secure DTN bundle.

        Encryption pipeline:
        1. Encrypt payload with CP-ABE under the given policy (inner layer)
        2. Serialize CP-ABE ciphertext to JSON bytes
        3. Encrypt serialized CP-ABE ciphertext with RSA-AES hybrid (outer layer)
        4. Package into a SecureBundle with metadata

        Args:
            payload: The plaintext data to protect.
            source: Source node identifier.
            destination: Destination node identifier.
            dest_public_key: RSA public key of the destination node.
            policy: CP-ABE access policy for this bundle.
            ttl: Time-to-live in seconds (default 3600).
            priority: Bundle priority level.
            max_hop_count: Maximum hops before bundle is dropped.
            bundle_id: Optional bundle ID. Auto-generated UUID if None.
            creation_time: Optional creation timestamp. Uses current time if None.

        Returns:
            A SecureBundle with layered encryption applied.

        Raises:
            ValueError: If payload is empty.
        """
        if not payload:
            raise ValueError("Payload must not be empty.")

        if bundle_id is None:
            bundle_id = str(uuid.uuid4())
        if creation_time is None:
            creation_time = current_timestamp()

        # Compute SHA-256 integrity hash of plaintext before encryption
        payload_hash = hashlib.sha256(payload).hexdigest()

        # Layer 1 (Inner): CP-ABE encryption under policy
        cpabe_ct = self._cpabe_service.encrypt(
            payload, self._cpabe_public_params, policy
        )
        cpabe_ct_bytes = json.dumps(cpabe_ct.to_dict()).encode("utf-8")

        # Layer 2 (Outer): RSA-AES hybrid encryption
        hybrid_ct = hybrid_encrypt(cpabe_ct_bytes, dest_public_key)

        # Create metadata
        metadata = BundleMetadata(
            bundle_id=bundle_id,
            source=source,
            destination=destination,
            creation_time=creation_time,
            ttl=ttl,
            priority=priority,
            hop_count=0,
            max_hop_count=max_hop_count,
            is_encrypted=True,
            crypto_layers=["cpabe", "rsa_aes"],
            payload_hash=payload_hash,
        )

        return SecureBundle(
            metadata=metadata,
            encrypted_payload=hybrid_ct.to_dict(),
            cpabe_policy=policy.policy_string,
        )
