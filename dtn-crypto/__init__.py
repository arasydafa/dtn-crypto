# __init__.py — dtn-crypto package entry point.
# Purpose: Exposes the public API surface of the dtn-crypto library for
#          hybrid RSA-AES + CP-ABE encryption in Delay-Tolerant Networks.
# Dependencies: cryptography
# Usage: from dtn_crypto import hybrid_encrypt, hybrid_decrypt, CPABEService

"""dtn-crypto: Hybrid RSA-AES + CP-ABE Encryption for Delay-Tolerant Networks.

This library provides layered cryptographic protection for DTN bundle payloads:

- **RSA-AES Hybrid Encryption**: RSA-OAEP key wrapping + AES-256-GCM bulk
  encryption for confidentiality.
- **CP-ABE (Ciphertext-Policy Attribute-Based Encryption)**: Fine-grained
  access control based on receiver attributes and boolean policies.
- **DTN Bundle Wrapping**: Combines both layers into a secure bundle format
  suitable for multi-hop, delay-tolerant networks.

Example:
    >>> from dtn_crypto import (
    ...     CPABEService, Policy, BundleBuilder,
    ...     generate_rsa_keypair,
    ... )
    >>> cpabe = CPABEService()
    >>> mk, pp = cpabe.setup()
    >>> priv, pub = generate_rsa_keypair()
    >>> builder = BundleBuilder(cpabe, pp)
    >>> bundle = builder.create_secure_bundle(
    ...     b"Hello DTN!", "src", "dst", pub, Policy("role:receiver")
    ... )
"""

__version__ = "0.1.0"

from .bundle import (
    BundleBuilder,
    BundleDecryptionError,
    BundleMetadata,
    BundlePriority,
    SecureBundle,
)
from .cpabe import (
    CPABECiphertext,
    CPABEDecryptionError,
    CPABEMasterKey,
    CPABEPublicParams,
    CPABEService,
    CPABEUserKey,
    Policy,
    PolicyAttributeMatcher,
    PolicyParseError,
)
from .rsa_aes import (
    HybridCiphertext,
    hybrid_decrypt,
    hybrid_encrypt,
)
from .utils import (
    base64_to_bytes,
    bytes_to_base64,
    current_timestamp,
    deserialize_private_key,
    deserialize_public_key,
    generate_aes_key,
    generate_rsa_keypair,
    serialize_private_key,
    serialize_public_key,
)

__all__ = [
    "BundleBuilder",
    "BundleDecryptionError",
    "BundleMetadata",
    "BundlePriority",
    "CPABECiphertext",
    "CPABEDecryptionError",
    "CPABEMasterKey",
    "CPABEPublicParams",
    "CPABEService",
    "CPABEUserKey",
    "HybridCiphertext",
    "Policy",
    "PolicyAttributeMatcher",
    "PolicyParseError",
    "SecureBundle",
    "__version__",
    "base64_to_bytes",
    "bytes_to_base64",
    "current_timestamp",
    "deserialize_private_key",
    "deserialize_public_key",
    "generate_aes_key",
    "generate_rsa_keypair",
    "hybrid_decrypt",
    "hybrid_encrypt",
    "serialize_private_key",
    "serialize_public_key",
]
