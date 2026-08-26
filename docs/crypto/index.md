# Cryptography Library

The `dtn_crypto` library provides layered cryptographic protection for DTN bundle payloads. It combines RSA-AES hybrid encryption for confidentiality with CP-ABE for fine-grained access control.

## Overview

Every bundle is encrypted in two layers:

| Layer | Technology | Purpose |
|---|---|---|
| **Outer** | RSA-OAEP + AES-256-GCM | Confidentiality — only destination can decrypt |
| **Inner** | CP-ABE (Attribute-Based) | Access control — policy-based decryption |

Additionally, SHA-256 hashing provides end-to-end integrity verification.

## Quick Start

```python
from dtn_crypto import (
    CPABEService, Policy, BundleBuilder, generate_rsa_keypair,
)

# Setup crypto systems
cpabe = CPABEService()
master_key, public_params = cpabe.setup()
priv_key, pub_key = generate_rsa_keypair()
user_key = cpabe.keygen(master_key, public_params, ["role:receiver"])

# Create and encrypt a secure DTN bundle
builder = BundleBuilder(cpabe, public_params)
bundle = builder.create_secure_bundle(
    payload=b"Hello from deep space!",
    source="mars-rover", destination="earth-station",
    dest_public_key=pub_key, policy=Policy("role:receiver"),
)

# Decrypt at destination
plaintext = bundle.decrypt_payload(priv_key, user_key, public_params, cpabe)
assert plaintext == b"Hello from deep space!"
```

## Modules

| Module | Description |
|---|---|
| [RSA-AES Hybrid Encryption](rsa-aes.md) | RSA-OAEP key wrapping + AES-256-GCM bulk encryption |
| [CP-ABE Access Control](cp-abe.md) | Policy-based attribute encryption |
| [Bundle Format & Integrity](bundles.md) | Dual-layer encrypted bundle with SHA-256 verification |
