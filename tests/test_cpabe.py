# test_cpabe.py — Unit tests for CP-ABE encryption module.
# Purpose: Tests CP-ABE setup, key generation, policy evaluation, encrypt/decrypt
#          roundtrip, policy enforcement, and error handling.
# Dependencies: pytest, dtn_crypto
# Usage: pytest tests/test_cpabe.py -v

"""Tests for the CP-ABE encryption module."""

from __future__ import annotations

import pytest

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


@pytest.fixture
def cpabe_system() -> tuple[CPABEService, CPABEMasterKey, CPABEPublicParams]:
    """Set up a fresh CP-ABE system for testing."""
    service = CPABEService()
    mk, pp = service.setup(key_id="test-key-001")
    return service, mk, pp


class TestPolicy:
    """Tests for Policy creation and validation."""

    def test_valid_policy(self) -> None:
        """Valid policy string is accepted."""
        p = Policy("role:doctor AND dept:er")
        assert str(p) == "role:doctor AND dept:er"

    def test_empty_policy_raises(self) -> None:
        """Empty policy string raises PolicyParseError."""
        with pytest.raises(PolicyParseError, match="must not be empty"):
            Policy("")

    def test_whitespace_only_policy_raises(self) -> None:
        """Whitespace-only policy string raises PolicyParseError."""
        with pytest.raises(PolicyParseError, match="must not be empty"):
            Policy("   ")


class TestPolicyAttributeMatcher:
    """Tests for policy evaluation logic."""

    def test_single_attribute_match(self) -> None:
        """Single attribute policy matches when attribute is present."""
        policy = Policy("role:doctor")
        assert PolicyAttributeMatcher.evaluate(policy, ["role:doctor"])

    def test_single_attribute_no_match(self) -> None:
        """Single attribute policy fails when attribute is missing."""
        policy = Policy("role:doctor")
        assert not PolicyAttributeMatcher.evaluate(policy, ["role:nurse"])

    def test_and_policy_both_present(self) -> None:
        """AND policy succeeds when both attributes are present."""
        policy = Policy("role:doctor AND dept:er")
        assert PolicyAttributeMatcher.evaluate(
            policy, ["role:doctor", "dept:er"]
        )

    def test_and_policy_one_missing(self) -> None:
        """AND policy fails when one attribute is missing."""
        policy = Policy("role:doctor AND dept:er")
        assert not PolicyAttributeMatcher.evaluate(
            policy, ["role:doctor", "dept:icu"]
        )

    def test_or_policy_first_present(self) -> None:
        """OR policy succeeds when first attribute is present."""
        policy = Policy("role:doctor OR role:nurse")
        assert PolicyAttributeMatcher.evaluate(policy, ["role:doctor"])

    def test_or_policy_second_present(self) -> None:
        """OR policy succeeds when second attribute is present."""
        policy = Policy("role:doctor OR role:nurse")
        assert PolicyAttributeMatcher.evaluate(policy, ["role:nurse"])

    def test_or_policy_neither_present(self) -> None:
        """OR policy fails when neither attribute is present."""
        policy = Policy("role:doctor OR role:nurse")
        assert not PolicyAttributeMatcher.evaluate(policy, ["role:admin"])

    def test_nested_policy_with_parens(self) -> None:
        """Nested parenthesized policy evaluates correctly."""
        policy = Policy("(role:admin OR role:doctor) AND clearance:high")
        assert PolicyAttributeMatcher.evaluate(
            policy, ["role:doctor", "clearance:high"]
        )
        assert PolicyAttributeMatcher.evaluate(
            policy, ["role:admin", "clearance:high"]
        )
        assert not PolicyAttributeMatcher.evaluate(
            policy, ["role:doctor", "clearance:low"]
        )

    def test_complex_nested_policy(self) -> None:
        """Complex nested policy with multiple levels."""
        policy = Policy(
            "(role:doctor AND dept:icu) OR (role:admin AND clearance:top)"
        )
        assert PolicyAttributeMatcher.evaluate(
            policy, ["role:doctor", "dept:icu"]
        )
        assert PolicyAttributeMatcher.evaluate(
            policy, ["role:admin", "clearance:top"]
        )
        assert not PolicyAttributeMatcher.evaluate(
            policy, ["role:doctor", "clearance:top"]
        )

    def test_case_insensitive_attributes(self) -> None:
        """Attribute matching is case-insensitive."""
        policy = Policy("Role:Doctor")
        assert PolicyAttributeMatcher.evaluate(policy, ["role:doctor"])

    def test_case_insensitive_operators(self) -> None:
        """Boolean operators are case-insensitive."""
        policy = Policy("role:doctor and dept:er")
        assert PolicyAttributeMatcher.evaluate(
            policy, ["role:doctor", "dept:er"]
        )

    def test_extra_attributes_still_match(self) -> None:
        """Having extra attributes beyond the policy still satisfies it."""
        policy = Policy("role:doctor")
        assert PolicyAttributeMatcher.evaluate(
            policy, ["role:doctor", "dept:er", "clearance:high"]
        )

    def test_invalid_attribute_format_raises(self) -> None:
        """Invalid attribute format in policy raises PolicyParseError."""
        policy = Policy("invalid_attribute")
        with pytest.raises(PolicyParseError, match="Invalid attribute format"):
            PolicyAttributeMatcher.evaluate(policy, ["role:doctor"])


class TestCPABESystem:
    """Tests for the full CP-ABE system lifecycle."""

    def test_setup_produces_keys(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """System setup produces master key and public params."""
        _, mk, pp = cpabe_system
        assert mk.master_secret is not None
        assert len(mk.master_secret) == 32
        assert pp.public_seed is not None
        assert mk.key_id == pp.key_id

    def test_keygen_produces_user_key(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """Key generation produces a user key with the given attributes."""
        service, mk, pp = cpabe_system
        user_key = service.keygen(mk, pp, ["role:doctor", "dept:er"])
        assert user_key.attributes == ["dept:er", "role:doctor"]  # sorted
        assert len(user_key.key_material) == 32

    def test_keygen_empty_attributes_raises(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """Key generation with empty attributes raises ValueError."""
        service, mk, pp = cpabe_system
        with pytest.raises(ValueError, match="must not be empty"):
            service.keygen(mk, pp, [])

    def test_encrypt_decrypt_roundtrip(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """Encrypt-then-decrypt roundtrip returns original plaintext."""
        service, mk, pp = cpabe_system
        user_key = service.keygen(mk, pp, ["role:doctor", "dept:er"])
        policy = Policy("role:doctor AND dept:er")
        plaintext = b"Patient record: confidential"
        ct = service.encrypt(plaintext, pp, policy)
        result = service.decrypt(ct, user_key, pp)
        assert result == plaintext

    def test_decrypt_with_insufficient_attributes_fails(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """Decryption fails when user attributes don't satisfy policy."""
        service, mk, pp = cpabe_system
        user_key = service.keygen(mk, pp, ["role:nurse"])
        policy = Policy("role:doctor AND dept:er")
        ct = service.encrypt(b"Secret data", pp, policy)
        with pytest.raises(CPABEDecryptionError, match="Policy not satisfied"):
            service.decrypt(ct, user_key, pp)

    def test_decrypt_with_superset_attributes_succeeds(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """Decryption succeeds when user has superset of required attributes."""
        service, mk, pp = cpabe_system
        user_key = service.keygen(
            mk, pp, ["role:doctor", "dept:er", "clearance:top"]
        )
        policy = Policy("role:doctor AND dept:er")
        ct = service.encrypt(b"Medical data", pp, policy)
        result = service.decrypt(ct, user_key, pp)
        assert result == b"Medical data"

    def test_decrypt_or_policy_partial_match(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """OR policy allows decryption with just one matching attribute."""
        service, mk, pp = cpabe_system
        user_key = service.keygen(mk, pp, ["role:nurse"])
        policy = Policy("role:doctor OR role:nurse")
        ct = service.encrypt(b"Shared data", pp, policy)
        result = service.decrypt(ct, user_key, pp)
        assert result == b"Shared data"

    def test_decrypt_wrong_key_id_fails(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """Decryption fails with key from a different CP-ABE system."""
        service, _mk, pp = cpabe_system
        # Set up a second system
        mk2, pp2 = service.setup(key_id="other-system")
        user_key2 = service.keygen(mk2, pp2, ["role:doctor"])
        # Encrypt with first system
        policy = Policy("role:doctor")
        ct = service.encrypt(b"System 1 data", pp, policy)
        # Try decrypting with key from second system
        with pytest.raises(CPABEDecryptionError, match="Key ID mismatch"):
            service.decrypt(ct, user_key2, pp)

    def test_encrypt_empty_plaintext_raises(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """Encrypting empty plaintext raises ValueError."""
        service, _, pp = cpabe_system
        with pytest.raises(ValueError, match="must not be empty"):
            service.encrypt(b"", pp, Policy("role:any"))

    def test_large_payload(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """CP-ABE handles large payloads."""
        service, mk, pp = cpabe_system
        user_key = service.keygen(mk, pp, ["role:admin"])
        policy = Policy("role:admin")
        plaintext = b"A" * (512 * 1024)  # 512 KB
        ct = service.encrypt(plaintext, pp, policy)
        result = service.decrypt(ct, user_key, pp)
        assert result == plaintext


class TestCPABESerialization:
    """Tests for CP-ABE data serialization."""

    def test_master_key_roundtrip(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """MasterKey survives dict serialization roundtrip."""
        _, mk, _ = cpabe_system
        d = mk.to_dict()
        restored = CPABEMasterKey.from_dict(d)
        assert restored.master_secret == mk.master_secret
        assert restored.key_id == mk.key_id

    def test_public_params_roundtrip(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """PublicParams survives dict serialization roundtrip."""
        _, _, pp = cpabe_system
        d = pp.to_dict()
        restored = CPABEPublicParams.from_dict(d)
        assert restored.public_seed == pp.public_seed
        assert restored.key_id == pp.key_id

    def test_user_key_roundtrip(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """UserKey survives dict serialization roundtrip."""
        service, mk, pp = cpabe_system
        uk = service.keygen(mk, pp, ["role:doctor"], user_id="test-user")
        d = uk.to_dict()
        restored = CPABEUserKey.from_dict(d)
        assert restored.user_id == uk.user_id
        assert restored.attributes == uk.attributes
        assert restored.key_material == uk.key_material

    def test_ciphertext_roundtrip(
        self,
        cpabe_system: tuple[CPABEService, CPABEMasterKey, CPABEPublicParams],
    ) -> None:
        """Ciphertext survives dict serialization and is still decryptable."""
        service, mk, pp = cpabe_system
        user_key = service.keygen(mk, pp, ["role:admin"])
        policy = Policy("role:admin")
        ct = service.encrypt(b"Serialize me", pp, policy)
        d = ct.to_dict()
        restored = CPABECiphertext.from_dict(d)
        result = service.decrypt(restored, user_key, pp)
        assert result == b"Serialize me"
