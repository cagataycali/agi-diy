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

### Standard Hooks
- **trailing-whitespace**: Remove trailing whitespace
- **end-of-file-fixer**: Ensure files end with newline
- **check-yaml**: Validate YAML syntax
- **check-json**: Validate JSON syntax
- **check-added-large-files**: Prevent large files (>1MB)
- **detect-private-key**: Detect private keys
- **detect-aws-credentials**: Detect AWS credentials

### Secrets Detection
- **detect-secrets**: Scans for secrets using entropy and pattern matching
- Baseline file: `.secrets.baseline`

### CloudFormation Linting
- **cfn-lint**: Validates CloudFormation templates
- Checks for best practices and common mistakes
- Ensures parameters are used instead of hardcoded values

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
