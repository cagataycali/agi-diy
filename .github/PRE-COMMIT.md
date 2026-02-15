# Pre-commit Hooks Setup

This repository uses [pre-commit](https://pre-commit.com/) to prevent committing sensitive information.

## Installation

```bash
# Install pre-commit
pip install pre-commit

# Install the git hooks
pre-commit install
```

## What Gets Checked

### Standard Hooks (pre-commit/pre-commit-hooks)
- **trailing-whitespace**: Remove trailing whitespace
- **end-of-file-fixer**: Ensure files end with newline
- **check-yaml**: Validate YAML syntax
- **check-json**: Validate JSON syntax
- **check-added-large-files**: Prevent large files (>1MB)
- **detect-private-key**: Detect private keys
- **detect-aws-credentials**: Detect AWS credentials
- **check-merge-conflict**: Detect merge conflict markers
- **check-case-conflict**: Detect case conflicts in filenames
- **check-symlinks**: Detect broken symlinks
- **check-executables-have-shebangs**: Ensure executables have shebangs
- **check-shebang-scripts-are-executable**: Ensure scripts with shebangs are executable
- **mixed-line-ending**: Detect mixed line endings
- **no-commit-to-branch**: Prevent direct commits to main

### Secrets Detection (Yelp/detect-secrets)
- Scans for secrets using entropy and pattern matching
- Baseline file: `.secrets.baseline`

### CloudFormation Linting (aws-cloudformation/cfn-lint)
- Validates CloudFormation templates
- Checks for best practices and common mistakes
- Ensures parameters are used instead of hardcoded values

### GitHub Actions Linting (rhysd/actionlint)
- Validates GitHub Actions workflow syntax
- Checks for common mistakes in workflows
- Validates job dependencies and matrix configurations

### JSON Schema Validation (python-jsonschema/check-jsonschema)
- **check-github-workflows**: Validate GitHub workflow files against schema
- **check-github-actions**: Validate GitHub action metadata

### JavaScript Linting (standard/standard)
- Enforces JavaScript Standard Style
- No configuration needed
- Automatically fixes many issues

### Dependency Sync (pre-commit/sync-pre-commit-deps)
- Keeps pre-commit hook versions in sync with package.json

## Running Manually

```bash
# Run on all files
pre-commit run --all-files

# Run on staged files only
pre-commit run

# Run specific hook
pre-commit run detect-secrets --all-files
```

## Bypassing Hooks

**Not recommended**, but if needed:

```bash
git commit --no-verify
```

## Updating Hooks

```bash
pre-commit autoupdate
```

## Secrets Baseline

If you need to add a known false positive to the baseline:

```bash
detect-secrets scan > .secrets.baseline
```
