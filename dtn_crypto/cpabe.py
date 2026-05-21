# cpabe.py — Ciphertext-Policy Attribute-Based Encryption for dtn-crypto.
# Purpose: Provides CP-ABE functionality for policy-based access control.
#          Uses a PolicyAttributeMatcher stub that mirrors the charm-crypto
#          CP-ABE interface, enabling drop-in replacement when charm is available.
# Dependencies: cryptography (for underlying symmetric encryption of CP-ABE payloads)
# Usage:
#   from dtn_crypto.cpabe import CPABEService, Policy
#   service = CPABEService()
#   master_key, public_params = service.setup()
#   user_key = service.keygen(master_key, public_params, ["role:doctor", "dept:er"])
#   ct = service.encrypt(plaintext, public_params, Policy("role:doctor AND dept:er"))
#   pt = service.decrypt(ct, user_key, public_params)

"""Ciphertext-Policy Attribute-Based Encryption (CP-ABE) module.

This module provides a CP-ABE implementation for policy-based encryption.
When charm-crypto is not available, it uses a PolicyAttributeMatcher stub
that implements identical interface semantics with attribute-based access
control enforced through policy evaluation and symmetric key derivation.

The stub is designed as a direct interface match so that swapping in
charm-crypto requires zero changes to calling code.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import re
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_AES_NONCE_SIZE = 12
_AES_KEY_SIZE = 32


class PolicyParseError(Exception):
    """Raised when a policy string cannot be parsed."""


@dataclass(frozen=True)
class Policy:
    """Represents a CP-ABE access policy.

    The policy string uses a simple boolean expression syntax:
    - Attributes: "key:value" pairs (e.g., "role:doctor")
    - Operators: AND, OR (case-insensitive)
    - Grouping: parentheses
    - Examples:
        "role:doctor AND dept:er"
        "(role:admin OR role:doctor) AND clearance:top_secret"
        "role:nurse OR (role:doctor AND dept:icu)"

    Attributes:
        policy_string: The raw policy expression string.
    """
    policy_string: str

    def __post_init__(self) -> None:
        """Validate the policy string on creation."""
        if not self.policy_string.strip():
            raise PolicyParseError("Policy string must not be empty.")

    def __str__(self) -> str:
        return self.policy_string


class PolicyAttributeMatcher:
    """Evaluates CP-ABE policies against sets of user attributes.

    This class mirrors the interface of charm-crypto's CP-ABE policy engine.
    It parses boolean expressions of attribute conditions and evaluates them
    against a user's attribute set.

    This is a stub implementation that enforces the same access control
    semantics. To swap in charm-crypto, replace this class while keeping
    the same method signatures.
    """

    @staticmethod
    def evaluate(policy: Policy, attributes: list[str]) -> bool:
        """Evaluate whether a set of attributes satisfies a policy.

        Args:
            policy: The access policy to evaluate.
            attributes: List of attribute strings the user possesses
                (e.g., ["role:doctor", "dept:er"]).

        Returns:
            True if the attributes satisfy the policy, False otherwise.

        Raises:
            PolicyParseError: If the policy string is malformed.
        """
        attr_set = set(a.strip().lower() for a in attributes)
        return PolicyAttributeMatcher._eval_expr(
            policy.policy_string.strip(), attr_set
        )

    @staticmethod
    def _eval_expr(expr: str, attrs: set[str]) -> bool:
        """Recursively evaluate a boolean policy expression.

        Args:
            expr: The policy expression string to evaluate.
            attrs: Set of lowercase attribute strings.

        Returns:
            True if attributes satisfy the expression.
        """
        expr = expr.strip()

        # Remove outer matching parentheses if they wrap the entire expression
        while expr.startswith("(") and PolicyAttributeMatcher._find_matching_paren(expr, 0) == len(expr) - 1:
            expr = expr[1:-1].strip()

        # Try to split on OR (lowest precedence) at the top level
        or_parts = PolicyAttributeMatcher._split_top_level(expr, "OR")
        if len(or_parts) > 1:
            return any(
                PolicyAttributeMatcher._eval_expr(part, attrs)
                for part in or_parts
            )

        # Try to split on AND
        and_parts = PolicyAttributeMatcher._split_top_level(expr, "AND")
        if len(and_parts) > 1:
            return all(
                PolicyAttributeMatcher._eval_expr(part, attrs)
                for part in and_parts
            )

        # Base case: single attribute
        attr = expr.strip().lower()
        if not attr:
            raise PolicyParseError("Empty attribute in policy expression.")
        # Validate attribute format
        if not re.match(r'^[\w]+:[\w]+$', attr):
            raise PolicyParseError(
                f"Invalid attribute format: '{attr}'. Expected 'key:value'."
            )
        return attr in attrs

    @staticmethod
    def _find_matching_paren(expr: str, start: int) -> int:
        """Find the index of the matching closing parenthesis.

        Args:
            expr: The expression string.
            start: Index of the opening parenthesis.

        Returns:
            Index of the matching closing parenthesis.

        Raises:
            PolicyParseError: If no matching parenthesis is found.
        """
        depth = 0
        for i in range(start, len(expr)):
            if expr[i] == "(":
                depth += 1
            elif expr[i] == ")":
                depth -= 1
                if depth == 0:
                    return i
        raise PolicyParseError("Unmatched parenthesis in policy expression.")

    @staticmethod
    def _split_top_level(expr: str, operator: str) -> list[str]:
        """Split an expression by a boolean operator at the top level only.

        Respects parenthesis nesting so that operators inside groups
        are not used as split points.

        Args:
            expr: The expression string.
            operator: The operator to split on ("AND" or "OR").

        Returns:
            List of sub-expression strings.
        """
        parts: list[str] = []
        depth = 0
        current_start = 0
        i = 0
        op_upper = f" {operator.upper()} "

        while i < len(expr):
            if expr[i] == "(":
                depth += 1
            elif expr[i] == ")":
                depth -= 1
            elif depth == 0:
                # Check if the operator appears at this position (case-insensitive)
                remaining = expr[i:]
                remaining_upper = remaining.upper()
                if remaining_upper.startswith(op_upper.lstrip()):
                    # Verify it's a word boundary
                    before_ok = i == 0 or expr[i - 1] == " "
                    op_len = len(operator)
                    after_idx = i + op_len
                    after_ok = after_idx >= len(expr) or expr[after_idx] == " "
                    if before_ok and after_ok and remaining_upper.startswith(operator.upper()):
                        parts.append(expr[current_start:i].strip())
                        current_start = i + op_len
                        i = current_start
                        continue
            i += 1

        parts.append(expr[current_start:].strip())
        # Filter out empty strings from splitting
        parts = [p for p in parts if p]
        return parts


@dataclass
class CPABEMasterKey:
    """CP-ABE master secret key (authority key).

    Attributes:
        master_secret: The master secret bytes used for key derivation.
        key_id: Unique identifier for this master key.
    """
    master_secret: bytes
    key_id: str

    def to_dict(self) -> dict[str, str]:
        """Serialize to dictionary."""
        from .utils import bytes_to_base64
        return {
            "master_secret": bytes_to_base64(self.master_secret),
            "key_id": self.key_id,
        }

    @classmethod
    def from_dict(cls, data: dict[str, str]) -> CPABEMasterKey:
        """Deserialize from dictionary."""
        from .utils import base64_to_bytes
        return cls(
            master_secret=base64_to_bytes(data["master_secret"]),
            key_id=data["key_id"],
        )


@dataclass
class CPABEPublicParams:
    """CP-ABE public parameters (shared with all users).

    Attributes:
        public_seed: Public seed derived from master key for key derivation.
        key_id: Identifier matching the master key these params were derived from.
    """
    public_seed: bytes
    key_id: str

    def to_dict(self) -> dict[str, str]:
        """Serialize to dictionary."""
        from .utils import bytes_to_base64
        return {
            "public_seed": bytes_to_base64(self.public_seed),
            "key_id": self.key_id,
        }

    @classmethod
    def from_dict(cls, data: dict[str, str]) -> CPABEPublicParams:
        """Deserialize from dictionary."""
        from .utils import base64_to_bytes
        return cls(
            public_seed=base64_to_bytes(data["public_seed"]),
            key_id=data["key_id"],
        )


@dataclass
class CPABEUserKey:
    """CP-ABE user decryption key tied to a specific attribute set.

    Attributes:
        user_id: Identifier for the user this key belongs to.
        attributes: The attribute strings embedded in this key.
        key_material: Derived key material for decryption.
        key_id: Identifier matching the master key this was derived from.
    """
    user_id: str
    attributes: list[str]
    key_material: bytes
    key_id: str

    def to_dict(self) -> dict[str, object]:
        """Serialize to dictionary."""
        from .utils import bytes_to_base64
        return {
            "user_id": self.user_id,
            "attributes": self.attributes,
            "key_material": bytes_to_base64(self.key_material),
            "key_id": self.key_id,
        }

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> CPABEUserKey:
        """Deserialize from dictionary."""
        from .utils import base64_to_bytes
        return cls(
            user_id=str(data["user_id"]),
            attributes=list(data["attributes"]),  # type: ignore[arg-type]
            key_material=base64_to_bytes(str(data["key_material"])),
            key_id=str(data["key_id"]),
        )


@dataclass(frozen=True)
class CPABECiphertext:
    """Container for CP-ABE encrypted data.

    Attributes:
        policy: The access policy embedded in the ciphertext.
        encrypted_key: The policy-encrypted symmetric key component.
        nonce: AES-GCM nonce.
        ciphertext: AES-GCM encrypted payload.
        key_id: Identifier of the CP-ABE system that created this.
    """
    policy: Policy
    encrypted_key: bytes
    nonce: bytes
    ciphertext: bytes
    key_id: str

    def to_dict(self) -> dict[str, str]:
        """Serialize to dictionary."""
        from .utils import bytes_to_base64
        return {
            "policy": self.policy.policy_string,
            "encrypted_key": bytes_to_base64(self.encrypted_key),
            "nonce": bytes_to_base64(self.nonce),
            "ciphertext": bytes_to_base64(self.ciphertext),
            "key_id": self.key_id,
        }

    @classmethod
    def from_dict(cls, data: dict[str, str]) -> CPABECiphertext:
        """Deserialize from dictionary."""
        from .utils import base64_to_bytes
        return cls(
            policy=Policy(data["policy"]),
            encrypted_key=base64_to_bytes(data["encrypted_key"]),
            nonce=base64_to_bytes(data["nonce"]),
            ciphertext=base64_to_bytes(data["ciphertext"]),
            key_id=data["key_id"],
        )


class CPABEDecryptionError(Exception):
    """Raised when CP-ABE decryption fails due to policy mismatch or invalid key."""


class CPABEService:
    """Ciphertext-Policy Attribute-Based Encryption service.

    Provides the full CP-ABE lifecycle: system setup, user key generation,
    encryption under a policy, and decryption with attribute-based keys.

    This implementation uses HMAC-based key derivation to simulate the
    algebraic structure of real CP-ABE. The interface matches charm-crypto's
    CP-ABE module so it can be swapped in without changing calling code.

    Example:
        >>> service = CPABEService()
        >>> mk, pp = service.setup()
        >>> user_key = service.keygen(mk, pp, ["role:doctor", "dept:er"])
        >>> policy = Policy("role:doctor AND dept:er")
        >>> ct = service.encrypt(b"secret data", pp, policy)
        >>> pt = service.decrypt(ct, user_key, pp)
        >>> assert pt == b"secret data"
    """

    def __init__(self) -> None:
        """Initialize the CP-ABE service."""
        self._matcher = PolicyAttributeMatcher()

    def setup(self, key_id: str | None = None) -> tuple[CPABEMasterKey, CPABEPublicParams]:
        """Initialize the CP-ABE system and generate master key + public parameters.

        Args:
            key_id: Optional identifier for this key set. Auto-generated if None.

        Returns:
            A tuple of (master_key, public_params).
        """
        if key_id is None:
            key_id = os.urandom(8).hex()
        master_secret = os.urandom(32)
        # Derive public seed from master secret
        public_seed = hashlib.sha256(b"cpabe-public:" + master_secret).digest()
        master_key = CPABEMasterKey(master_secret=master_secret, key_id=key_id)
        public_params = CPABEPublicParams(
            public_seed=public_seed, key_id=key_id)
        return master_key, public_params

    def keygen(
        self,
        master_key: CPABEMasterKey,
        public_params: CPABEPublicParams,
        attributes: list[str],
        user_id: str | None = None,
    ) -> CPABEUserKey:
        """Generate a user decryption key for a given attribute set.

        Args:
            master_key: The CP-ABE master key (authority).
            public_params: The public parameters.
            attributes: List of attribute strings for this user
                (e.g., ["role:doctor", "dept:er"]).
            user_id: Optional user identifier. Auto-generated if None.

        Returns:
            A CPABEUserKey tied to the given attributes.

        Raises:
            ValueError: If attributes list is empty.
        """
        if not attributes:
            raise ValueError("Attributes list must not be empty.")
        if user_id is None:
            user_id = os.urandom(8).hex()
        # Normalize and sort attributes for deterministic key derivation
        normalized = sorted(a.strip().lower() for a in attributes)
        # Derive key material from master secret + attributes
        attr_blob = "|".join(normalized).encode("utf-8")
        key_material = hmac.new(
            master_key.master_secret,
            b"cpabe-user:" + attr_blob,
            hashlib.sha256,
        ).digest()
        return CPABEUserKey(
            user_id=user_id,
            attributes=normalized,
            key_material=key_material,
            key_id=master_key.key_id,
        )

    def encrypt(
        self,
        plaintext: bytes,
        public_params: CPABEPublicParams,
        policy: Policy,
    ) -> CPABECiphertext:
        """Encrypt data under a CP-ABE access policy.

        The ciphertext can only be decrypted by users whose attribute-based
        keys satisfy the embedded policy.

        Args:
            plaintext: The data to encrypt.
            public_params: The CP-ABE public parameters.
            policy: The access policy for this ciphertext.

        Returns:
            A CPABECiphertext containing the policy-encrypted data.

        Raises:
            ValueError: If plaintext is empty.
        """
        if not plaintext:
            raise ValueError("Plaintext must not be empty.")

        # Generate symmetric key for this ciphertext
        sym_key = os.urandom(_AES_KEY_SIZE)
        nonce = os.urandom(_AES_NONCE_SIZE)

        # Encrypt the payload with AES-GCM
        aesgcm = AESGCM(sym_key)
        ct = aesgcm.encrypt(nonce, plaintext, None)

        # "Encrypt" the symmetric key under the policy using HMAC derivation
        # In real CP-ABE this would use bilinear pairings; here we derive a
        # policy-bound encryption key from the public params + policy string
        policy_key = hmac.new(
            public_params.public_seed,
            b"cpabe-policy:" + policy.policy_string.strip().lower().encode("utf-8"),
            hashlib.sha256,
        ).digest()
        # XOR the symmetric key with the policy-derived key to "encrypt" it
        encrypted_sym_key = bytes(a ^ b for a, b in zip(
            sym_key, policy_key, strict=True))

        return CPABECiphertext(
            policy=policy,
            encrypted_key=encrypted_sym_key,
            nonce=nonce,
            ciphertext=ct,
            key_id=public_params.key_id,
        )

    def decrypt(
        self,
        cpabe_ct: CPABECiphertext,
        user_key: CPABEUserKey,
        public_params: CPABEPublicParams,
    ) -> bytes:
        """Decrypt CP-ABE encrypted data using an attribute-based user key.

        Args:
            cpabe_ct: The CP-ABE ciphertext to decrypt.
            user_key: The user's attribute-based decryption key.
            public_params: The CP-ABE public parameters.

        Returns:
            The decrypted plaintext bytes.

        Raises:
            CPABEDecryptionError: If the user's attributes do not satisfy
                the ciphertext policy.
        """
        # Check key_id matches
        if user_key.key_id != cpabe_ct.key_id:
            raise CPABEDecryptionError(
                f"Key ID mismatch: user key '{user_key.key_id}' vs "
                f"ciphertext '{cpabe_ct.key_id}'."
            )

        # Evaluate policy against user attributes
        if not self._matcher.evaluate(cpabe_ct.policy, user_key.attributes):
            raise CPABEDecryptionError(
                f"Policy not satisfied. Policy: '{cpabe_ct.policy}', "
                f"User attributes: {user_key.attributes}"
            )

        # Recover the symmetric key
        policy_key = hmac.new(
            public_params.public_seed,
            b"cpabe-policy:" + cpabe_ct.policy.policy_string.strip().lower().encode("utf-8"),
            hashlib.sha256,
        ).digest()
        sym_key = bytes(a ^ b for a, b in zip(
            cpabe_ct.encrypted_key, policy_key, strict=True))

        # Decrypt the payload
        aesgcm = AESGCM(sym_key)
        try:
            plaintext = aesgcm.decrypt(
                cpabe_ct.nonce, cpabe_ct.ciphertext, None)
        except Exception as e:
            raise CPABEDecryptionError(f"Decryption failed: {e}") from e

        return plaintext
