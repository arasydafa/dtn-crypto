# Bundle Format & Integrity

## Overview

Every DTN bundle in the simulator is encrypted in two layers and includes a SHA-256 integrity hash for end-to-end verification.

## Bundle Structure

```
+-----------------------------------------------------+
|  Layer 2 (Outer): RSA-AES Hybrid Encryption         |
|  - RSA-OAEP wraps ephemeral AES-256 session key     |
|  - AES-256-GCM encrypts inner layer ciphertext      |
|  +-------------------------------------------------+ |
|  |  Layer 1 (Inner): CP-ABE Encryption            | |
|  |  - Policy-based symmetric key encryption       | |
|  |  - AES-256-GCM encrypts plaintext payload      | |
|  |  +------------------------------------------+  | |
|  |  |  Plaintext Payload (application data)    |  | |
|  |  +------------------------------------------+  | |
|  +-------------------------------------------------+ |
+-----------------------------------------------------+
```

## Metadata

| Field | Type | Description |
|---|---|---|
| `bundle_id` | UUID | Unique identifier |
| `source` | string | Source node ID |
| `destination` | string | Destination node ID |
| `creation_time` | float | Simulation timestamp |
| `ttl` | int | Time-to-live in seconds |
| `priority` | int | Priority level (0-3) |
| `hop_count` | int | Current hop count |
| `max_hop_count` | int | Maximum allowed hops |
| `payload_hash` | string | SHA-256 hash of plaintext |

## SHA-256 Integrity

Every bundle payload is hashed with SHA-256 before encryption. The hash travels with the bundle through untrusted relay nodes. At the destination, after decryption, the hash is recomputed and verified.

```python
from dtn_crypto import BundleBuilder, BundleIntegrityError

bundle = builder.create_secure_bundle(
    payload=b"critical telemetry data",
    source="sensor-1", destination="ground-station",
    dest_public_key=pub_key, policy=Policy("role:operator"),
)

# Hash is stored in metadata
print(bundle.metadata.payload_hash)  # e.g. "a3f2..."

# Decryption verifies integrity automatically
try:
    plaintext = bundle.decrypt_payload(priv_key, user_key, pp, cpabe)
except BundleIntegrityError:
    print("Payload was tampered with during transit!")
```

## Priority Levels

| Level | Name | Description |
|---|---|---|
| 0 | Bulk | Lowest priority, delay-tolerant data |
| 1 | Normal | Standard priority (default) |
| 2 | Expedited | High priority, time-sensitive |
| 3 | Critical | Highest priority, mission-critical |

When a node's buffer is full, the lowest-priority bundle is evicted if the new bundle has higher priority.

## API Reference

### `BundleBuilder(cpabe_service, cpabe_public_params)`

Factory for creating secure bundles.

### `BundleBuilder.create_secure_bundle(payload, source, destination, dest_public_key, policy, ttl=3600, priority=BundlePriority.NORMAL)`

Create a dual-layer encrypted bundle with SHA-256 hash.

### `SecureBundle.decrypt_payload(rsa_private_key, cpabe_user_key, cpabe_public_params, cpabe_service)`

Decrypt both crypto layers and verify integrity.
