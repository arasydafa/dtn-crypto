# simulator/crypto_layer.py — Crypto integration layer for the DTN simulator.
# Purpose: Wraps dtn_crypto library to provide encryption/decryption for
#          simulation bundles, including key management for simulated nodes.
# Dependencies: dtn_crypto
# Usage: crypto = CryptoLayer(num_nodes=10); crypto.encrypt_bundle(bundle, src, dst)

"""Cryptographic integration layer for the DTN simulator.

Manages RSA key pairs and CP-ABE credentials for all simulated nodes,
and provides encrypt/decrypt operations that wrap the dtn_crypto library.
Measures and records encryption/decryption overhead timing.
"""

from __future__ import annotations

import logging
import time

from dtn_crypto.bundle import BundleBuilder, BundleIntegrityError
from dtn_crypto.cpabe import (
    CPABEDecryptionError,
    CPABEMasterKey,
    CPABEPublicParams,
    CPABEService,
    Policy,
)
from dtn_crypto.utils import generate_rsa_keypair
from simulator.models import Node, SimBundle

logger = logging.getLogger(__name__)

# Default CP-ABE attributes for different node roles
DEFAULT_ATTRIBUTES: dict[str, list[str]] = {
    "default": ["role:node"],
    "relay": ["role:relay", "type:standard"],
    "ground_station": ["role:receiver", "clearance:high", "type:ground"],
    "satellite": ["role:relay", "type:satellite", "clearance:medium"],
    "commander": ["role:admin", "role:receiver", "clearance:top"],
    "medic": ["role:medic", "role:receiver", "dept:medical"],
    "responder": ["role:responder", "role:receiver", "type:field"],
}


class CryptoLayer:
    """Manages cryptographic operations for the DTN simulation.

    Sets up RSA key pairs and CP-ABE credentials for all nodes, and
    provides methods to encrypt bundles on creation and decrypt on delivery.

    Args:
        attribute_assignments: Optional dict mapping node_id to attribute list.
            If not provided, attributes are auto-assigned based on node role.
    """

    def __init__(
        self,
        attribute_assignments: dict[str, list[str]] | None = None,
    ) -> None:
        """Initialize the crypto layer.

        Args:
            attribute_assignments: Optional per-node attribute overrides.
        """
        self._cpabe_service = CPABEService()
        self._master_key: CPABEMasterKey
        self._public_params: CPABEPublicParams
        self._master_key, self._public_params = self._cpabe_service.setup(
            key_id="dtn-sim"
        )
        self._attribute_assignments = attribute_assignments or {}
        self._bundle_builder = BundleBuilder(
            self._cpabe_service, self._public_params
        )

    def setup_node_keys(self, node: Node) -> None:
        """Generate and assign RSA and CP-ABE keys to a node.

        Args:
            node: The node to set up keys for.
        """
        # Generate RSA key pair
        priv, pub = generate_rsa_keypair(key_size=2048)
        node.rsa_private_key = priv
        node.rsa_public_key = pub

        # Determine attributes for this node
        if node.node_id in self._attribute_assignments:
            attrs = self._attribute_assignments[node.node_id]
        elif node.attributes:
            attrs = node.attributes
        else:
            attrs = ["role:node", "role:receiver"]

        # Ensure attributes are set on the node
        node.attributes = attrs

        # Generate CP-ABE user key
        node.cpabe_user_key = self._cpabe_service.keygen(
            self._master_key,
            self._public_params,
            attrs,
            user_id=node.node_id,
        )

    def encrypt_bundle(
        self,
        bundle: SimBundle,
        dest_node: Node,
    ) -> None:
        """Encrypt a bundle's payload for the destination node.

        Applies dual-layer encryption (CP-ABE inner + RSA-AES outer)
        and records the encryption time.

        Args:
            bundle: The simulation bundle to encrypt.
            dest_node: The destination node (need its public key).
        """
        if not bundle.payload:
            return
        if dest_node.rsa_public_key is None:
            logger.warning(
                "Cannot encrypt bundle %s: dest node %s has no RSA key",
                bundle.bundle_id,
                dest_node.node_id,
            )
            return

        # Build CP-ABE policy from destination attributes
        policy_str = bundle.cpabe_policy
        if not policy_str:
            # Default: require role:receiver OR role:node
            policy_str = "role:receiver OR role:node"

        start = time.perf_counter()

        try:
            policy = Policy(policy_str)
            secure_bundle = self._bundle_builder.create_secure_bundle(
                payload=bundle.payload,
                source=bundle.source,
                destination=bundle.destination,
                dest_public_key=dest_node.rsa_public_key,
                policy=policy,
                ttl=bundle.ttl,
                bundle_id=bundle.bundle_id,
                creation_time=bundle.creation_time,
            )
            bundle.encrypted_payload = secure_bundle.encrypted_payload
            bundle.payload_hash = secure_bundle.metadata.payload_hash
        except Exception:
            logger.exception(
                "Encryption failed for bundle %s", bundle.bundle_id)
            return

        elapsed_ms = (time.perf_counter() - start) * 1000
        bundle.encrypt_time_ms = elapsed_ms

    def decrypt_bundle(
        self,
        bundle: SimBundle,
        dest_node: Node,
    ) -> bytes | None:
        """Decrypt a bundle's payload at the destination node.

        Removes both RSA-AES and CP-ABE encryption layers and records
        decryption time.

        Args:
            bundle: The simulation bundle to decrypt.
            dest_node: The destination node performing decryption.

        Returns:
            Decrypted plaintext bytes, or None if decryption fails.
        """
        if bundle.encrypted_payload is None:
            return bundle.payload if bundle.payload else None

        if dest_node.rsa_private_key is None or dest_node.cpabe_user_key is None:
            logger.warning(
                "Cannot decrypt bundle %s: node %s missing keys",
                bundle.bundle_id,
                dest_node.node_id,
            )
            return None

        start = time.perf_counter()

        try:
            # Reconstruct SecureBundle for decryption
            from dtn_crypto.bundle import BundleMetadata, SecureBundle

            metadata = BundleMetadata(
                bundle_id=bundle.bundle_id,
                source=bundle.source,
                destination=bundle.destination,
                creation_time=bundle.creation_time,
                ttl=bundle.ttl,
                is_encrypted=True,
                crypto_layers=["cpabe", "rsa_aes"],
                payload_hash=bundle.payload_hash,
            )
            secure_bundle = SecureBundle(
                metadata=metadata,
                encrypted_payload=bundle.encrypted_payload,
                cpabe_policy=bundle.cpabe_policy,
            )
            plaintext = secure_bundle.decrypt_payload(
                dest_node.rsa_private_key,
                dest_node.cpabe_user_key,
                self._public_params,
                self._cpabe_service,
            )
        except BundleIntegrityError:
            logger.warning(
                "SHA-256 integrity check failed for bundle %s at node %s",
                bundle.bundle_id,
                dest_node.node_id,
            )
            bundle.integrity_verified = False
            return None
        except CPABEDecryptionError:
            logger.debug(
                "CP-ABE policy mismatch for bundle %s at node %s",
                bundle.bundle_id,
                dest_node.node_id,
            )
            return None
        except Exception:
            logger.debug(
                "Decryption failed for bundle %s at node %s",
                bundle.bundle_id,
                dest_node.node_id,
            )
            return None

        elapsed_ms = (time.perf_counter() - start) * 1000
        bundle.decrypt_time_ms = elapsed_ms
        bundle.integrity_verified = True

        return plaintext

    @property
    def cpabe_service(self) -> CPABEService:
        """Access the CP-ABE service."""
        return self._cpabe_service

    @property
    def public_params(self) -> CPABEPublicParams:
        """Access the CP-ABE public parameters."""
        return self._public_params
