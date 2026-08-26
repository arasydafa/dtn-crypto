# CP-ABE Access Control

## Overview

Ciphertext-Policy Attribute-Based Encryption (CP-ABE) enables fine-grained access control over encrypted data. Access policies are embedded in the ciphertext, and users can only decrypt if their attributes satisfy the policy.

## How It Works

1. **Setup** — Initialize the CP-ABE system with a master key and public parameters
2. **Key Generation** — Generate user keys based on their attributes (e.g., `["role:doctor", "dept:emergency"]`)
3. **Encryption** — Encrypt data under an access policy (e.g., `"role:doctor AND dept:emergency"`)
4. **Decryption** — Users with matching attributes can decrypt; others cannot

## Usage

```python
from dtn_crypto import CPABEService, Policy, PolicyAttributeMatcher

cpabe = CPABEService()
mk, pp = cpabe.setup()

# Complex policy with nested boolean expressions
policy = Policy("(role:doctor AND dept:emergency) OR clearance:admin")

# Generate keys for matching attributes
user_key = cpabe.keygen(mk, pp, ["role:doctor", "dept:emergency"])
ct = cpabe.encrypt(b"patient data", pp, policy)
plaintext = cpabe.decrypt(ct, user_key, pp)

# Check if attributes satisfy policy without decryption
matcher = PolicyAttributeMatcher()
assert matcher.evaluate(policy, ["role:doctor", "dept:emergency"]) is True
assert matcher.evaluate(policy, ["role:nurse"]) is False
```

## Policy Syntax

Policies support boolean expressions with AND, OR, and nested parentheses:

| Operator | Example | Meaning |
|---|---|---|
| AND | `role:doctor AND dept:emergency` | Both attributes required |
| OR | `role:admin OR clearance:top` | Either attribute sufficient |
| Nested | `(A AND B) OR (C AND D)` | Complex access rules |

## API Reference

### `CPABEService.setup(key_id=None)`

Initialize the CP-ABE system.

- **Returns**: `tuple[CPABEMasterKey, CPABEPublicParams]`

### `CPABEService.keygen(master_key, public_params, attributes)`

Generate a user key for the given attributes.

- **Parameters**:
  - `attributes` (list[str]) — Attribute strings (e.g., `["role:doctor"]`)
- **Returns**: `CPABEUserKey`

### `CPABEService.encrypt(plaintext, public_params, policy)`

Encrypt data under an access policy.

- **Returns**: `CPABECiphertext`

### `CPABEService.decrypt(cpabe_ct, user_key, public_params)`

Decrypt ciphertext with an attribute-based key.

- **Returns**: `bytes` — Decrypted plaintext

### `PolicyAttributeMatcher.evaluate(policy, attributes)`

Check if attributes satisfy a policy without decrypting.

- **Returns**: `bool`
