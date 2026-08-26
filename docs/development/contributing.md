# Contributing

Thank you for your interest in contributing to DTN Crypto! This guide will help you get started.

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Git

### Clone and Install

```bash
git clone https://github.com/dtn-crypto/dtn-crypto.git
cd dtn-crypto

# Install Python dependencies
pip install -e ".[simulator,dev]"

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Verify Setup

```bash
# Run all tests
pytest

# Check linting
ruff check dtn_crypto/ simulator/ api/ tests/

# TypeScript check
cd frontend && npx tsc --noEmit
```

## Code Style

### Python

- **Formatter/Linter**: ruff (line length 100)
- **Docstrings**: Google-style
- **Type hints**: Required on all public functions
- **Imports**: Sorted by isort (via ruff)

```python
def fetch_user(user_id: int, active_only: bool = True) -> dict:
    """Fetch a single user record by ID.

    Args:
        user_id: Unique identifier for the user.
        active_only: When True, raise an error for inactive users.

    Returns:
        A dict containing user fields.

    Raises:
        ValueError: If user_id is not a positive integer.
    """
```

### TypeScript/React

- **Linting**: ESLint (via Vite)
- **Formatting**: Prettier (if configured)
- **Documentation**: JSDoc with `@param`, `@returns`, `@example` tags
- **Types**: Prefer interfaces over type aliases for object shapes

```typescript
/**
 * Fetch a paginated list of products.
 *
 * @param categoryId - The category to filter by.
 * @param page - Page number (1-indexed).
 * @returns Resolves to a page of product records.
 *
 * @example
 * const page = await fetchProducts("electronics", 2);
 */
async function fetchProducts(categoryId: string, page = 1): Promise<ProductPage> { ... }
```

## Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=dtn_crypto --cov-report=term-missing

# Run specific test module
pytest tests/test_rsa_aes.py -v

# Run frontend build
cd frontend && npm run build
```

## Project Architecture

See [Project Structure](project-structure.md) for a detailed directory layout.

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `main` for your feature/fix
3. **Write tests** for new functionality
4. **Ensure all checks pass**:
   - `ruff check` (Python lint)
   - `pytest` (Python tests)
   - `tsc --noEmit` (TypeScript types)
   - `npm run build` (Frontend build)
5. **Submit a PR** with a clear description

### Commit Messages

Use conventional commit format:

```
feat: add CP-ABE key generation endpoint
fix: resolve buffer overflow in epidemic router
docs: update API reference for new fields
test: add integration tests for WebSocket streaming
```

### PR Description

Include:
- Summary of changes
- Motivation/context
- Testing performed
- Any breaking changes

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include reproduction steps for bugs
- Specify Python version, OS, and browser
- Include error messages and stack traces

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
