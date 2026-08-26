# Testing

## Test Suite Overview

The project has **129 tests** across 5 test modules:

| Module | Tests | Coverage |
|---|---|---|
| `dtn_crypto` (Phase 1) | 55 | ~96% (RSA-AES, CP-ABE, bundles) |
| `dtn_crypto` (Phase 4) | 5 | SHA-256 integrity verification |
| `simulator/pcap_logger` (Phase 3) | 19 | PCAP + BPv7 encoding |
| `api/` (Phase 3) | 19 | REST + WebSocket endpoints |
| `api/` (Phase 4) | 4 | Integrity, timing, custom payload |

## Running Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_rsa_aes.py -v

# Run with coverage report
pytest --cov=dtn_crypto --cov-report=term-missing

# Run specific test class
pytest tests/test_cpabe.py::TestCPABE -v

# Run specific test method
pytest tests/test_bundle.py::TestSecureBundle::test_create_and_decrypt -v
```

## Test Structure

### `test_rsa_aes.py`

Tests for RSA-AES hybrid encryption:

- Key generation (correct sizes, uniqueness)
- Encryption/decryption roundtrip
- Wrong key rejection
- AAD (Additional Authenticated Data) support
- Serialization/deserialization

### `test_cpabe.py`

Tests for CP-ABE attribute-based encryption:

- Setup and key generation
- Policy parsing (AND, OR, nested)
- Encryption/decryption with matching attributes
- Decryption failure with non-matching attributes
- PolicyAttributeMatcher evaluation

### `test_bundle.py`

Tests for secure bundle format:

- Bundle creation with dual-layer encryption
- Decryption at destination
- SHA-256 integrity verification
- Integrity failure detection
- Custom TTL and priority
- Metadata serialization

### `test_pcap.py`

Tests for PCAP/BPv7 capture:

- PCAP file generation
- BPv7 CBOR encoding
- Frame structure (Ethernet → IPv4 → UDP → BPv7)
- Node IP/MAC mapping
- Endpoint ID format

### `test_api.py`

Tests for FastAPI endpoints:

- POST /simulate (REST mode)
- GET /scenarios
- GET /health
- WebSocket /ws/live
- Custom payload support
- Integrity verification endpoint

## Writing Tests

### Python Tests

```python
import pytest
from dtn_crypto import generate_rsa_keypair, hybrid_encrypt, hybrid_decrypt

class TestHybridEncryption:
    """Tests for RSA-AES hybrid encryption."""

    def test_roundtrip(self):
        """Encrypt and decrypt should produce original plaintext."""
        private_key, public_key = generate_rsa_keypair()
        plaintext = b"test message"
        ciphertext = hybrid_encrypt(plaintext, public_key)
        result = hybrid_decrypt(ciphertext, private_key)
        assert result == plaintext

    def test_wrong_key_fails(self):
        """Decryption with wrong key should raise error."""
        _, public_key = generate_rsa_keypair()
        private_key2, _ = generate_rsa_keypair()
        ciphertext = hybrid_encrypt(b"secret", public_key)
        with pytest.raises(Exception):
            hybrid_decrypt(ciphertext, private_key2)
```

### Fixtures

```python
@pytest.fixture
def crypto_setup():
    """Provide a pre-configured crypto environment."""
    cpabe = CPABEService()
    mk, pp = cpabe.setup()
    priv_key, pub_key = generate_rsa_keypair()
    user_key = cpabe.keygen(mk, pp, ["role:receiver"])
    return cpabe, mk, pp, priv_key, pub_key, user_key
```

## Code Coverage

```bash
# Generate coverage report
pytest --cov=dtn_crypto --cov=simulator --cov=api --cov-report=html

# Open in browser
open htmlcov/index.html
```

The project targets **80% minimum coverage** (configured in `pyproject.toml`).
