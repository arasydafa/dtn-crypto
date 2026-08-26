# RSA-AES Hybrid Encryption

## Overview

The hybrid RSA-AES encryption scheme combines the security of RSA with the efficiency of AES for bulk data encryption.

## How It Works

1. **Key Generation** — Generate an RSA-2048 key pair for the destination node
2. **Ephemeral AES Key** — Generate a random 256-bit AES key
3. **AES Encryption** — Encrypt the plaintext with AES-256-GCM using the ephemeral key
4. **RSA Wrapping** — Encrypt the ephemeral AES key with the destination's RSA public key (OAEP padding)
5. **Result** — `HybridCiphertext` containing wrapped key, nonce, and ciphertext

## Usage

```python
from dtn_crypto import hybrid_encrypt, hybrid_decrypt, generate_rsa_keypair

# Generate RSA key pair
private_key, public_key = generate_rsa_keypair()

# Encrypt
ciphertext = hybrid_encrypt(b"secret message", public_key)

# Decrypt
plaintext = hybrid_decrypt(ciphertext, private_key)
assert plaintext == b"secret message"
```

## API Reference

### `generate_rsa_keypair(key_size=2048, public_exponent=65537)`

Generate an RSA key pair.

- **Parameters**: `key_size` (int) — RSA key size in bits (minimum 2048)
- **Returns**: `tuple[RSAPrivateKey, RSAPublicKey]`

### `hybrid_encrypt(plaintext, public_key, aad=None)`

Encrypt plaintext using RSA-OAEP + AES-256-GCM hybrid encryption.

- **Parameters**:
  - `plaintext` (bytes) — Data to encrypt
  - `public_key` — RSA public key for key wrapping
  - `aad` (bytes, optional) — Additional authenticated data
- **Returns**: `HybridCiphertext`

### `hybrid_decrypt(hybrid_ct, private_key)`

Decrypt hybrid ciphertext using the RSA private key.

- **Parameters**:
  - `hybrid_ct` (HybridCiphertext) — Ciphertext to decrypt
  - `private_key` — RSA private key for key unwrapping
- **Returns**: `bytes` — Decrypted plaintext

## Security Properties

- **Confidentiality** — Only the holder of the RSA private key can decrypt
- **Integrity** — AES-GCM provides authenticated encryption (tamper detection)
- **Forward Secrecy** — Each encryption uses a fresh ephemeral AES key
- **Key Size** — RSA-2048 minimum, AES-256 for bulk encryption
