#!/usr/bin/env bash
# Install git hooks for the repository

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

echo "📦 Installing git hooks..."

# Copy pre-commit hook
cp "$SCRIPT_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"

echo "✅ Pre-commit hook installed"
echo ""
echo "The hook will check for:"
echo "  - AWS Account IDs"
echo "  - AWS Access/Secret Keys"
echo "  - Route53 Hosted Zone IDs"
echo "  - Specific S3 bucket names"
echo "  - Email addresses"
echo "  - Private keys"
echo ""
echo "To bypass (not recommended): git commit --no-verify"
