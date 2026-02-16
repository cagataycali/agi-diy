#!/usr/bin/env bash
set -euo pipefail

# Setup OIDC for GitHub Actions deployment
# Usage: ./scripts/setup-oidc.sh <github-org> <github-repo> <aws-account-id> <s3-bucket> [aws-profile]

GITHUB_ORG=${1:-}
GITHUB_REPO=${2:-}
AWS_ACCOUNT_ID=${3:-}
S3_BUCKET=${4:-}
AWS_PROFILE=${5:-${AWS_PROFILE:-}}

if [[ -z "$GITHUB_ORG" || -z "$GITHUB_REPO" || -z "$AWS_ACCOUNT_ID" || -z "$S3_BUCKET" ]]; then
  echo "Usage: $0 <github-org> <github-repo> <aws-account-id> <s3-bucket> [aws-profile]"
  echo "Example: $0 jsamuel1 agi-diy 123456789012 agidiy.sauhsoj.people.aws.dev my-profile"
  exit 1
fi

# Build AWS CLI args
AWS_ARGS=()
if [[ -n "$AWS_PROFILE" ]]; then
  AWS_ARGS+=(--profile "$AWS_PROFILE")
  echo "Using AWS profile: $AWS_PROFILE"
fi

echo "🔧 Setting up OIDC for GitHub Actions deployment"
echo "  GitHub: $GITHUB_ORG/$GITHUB_REPO"
echo "  AWS Account: $AWS_ACCOUNT_ID"
echo "  S3 Bucket: $S3_BUCKET"
echo ""

# Check if OIDC provider exists
echo "📋 Checking for GitHub OIDC provider..."
OIDC_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" "${AWS_ARGS[@]}" &>/dev/null; then
  echo "✅ OIDC provider already exists"
else
  echo "🔨 Creating GitHub OIDC provider..."
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
    "${AWS_ARGS[@]}"
  echo "✅ OIDC provider created"
fi

# Create IAM role
ROLE_NAME="GitHubActions-${GITHUB_REPO}-Deploy"
echo ""
echo "🔨 Creating IAM role: $ROLE_NAME"

cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "$OIDC_ARN"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:$GITHUB_ORG/$GITHUB_REPO:*"
        }
      }
    }
  ]
}
EOF

if aws iam get-role --role-name "$ROLE_NAME" "${AWS_ARGS[@]}" &>/dev/null; then
  echo "⚠️  Role already exists, updating trust policy..."
  aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document file:///tmp/trust-policy.json \
    "${AWS_ARGS[@]}"
else
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document file:///tmp/trust-policy.json \
    --description "GitHub Actions deployment role for $GITHUB_REPO" \
    "${AWS_ARGS[@]}"
  echo "✅ Role created"
fi

ROLE_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:role/$ROLE_NAME"

# Create inline policy
echo "🔨 Attaching deployment policy..."

cat > /tmp/deploy-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::$S3_BUCKET",
        "arn:aws:s3:::$S3_BUCKET/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name DeploymentPolicy \
  --policy-document file:///tmp/deploy-policy.json \
  "${AWS_ARGS[@]}"

echo "✅ Policy attached"

# Get CloudFront distribution ID if exists
echo ""
echo "🔍 Looking for CloudFront distribution..."
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name agidiy-website \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text \
  "${AWS_ARGS[@]}" 2>/dev/null || echo "")

if [[ -n "$DIST_ID" ]]; then
  echo "✅ Found distribution: $DIST_ID"
else
  echo "⚠️  No CloudFront distribution found (stack may not be deployed yet)"
fi

# Configure GitHub secrets using gh CLI
echo ""
echo "🔐 Configuring GitHub repository secrets..."

if ! command -v gh &>/dev/null; then
  echo "⚠️  GitHub CLI (gh) not found. Please install it to configure secrets automatically."
  echo ""
  echo "Manual setup required:"
  echo "  1. Go to: https://github.com/$GITHUB_ORG/$GITHUB_REPO/settings/secrets/actions"
  echo "  2. Add secret AWS_ROLE_ARN: $ROLE_ARN"
  echo "  3. Add variable S3_BUCKET: $S3_BUCKET"
  if [[ -n "$DIST_ID" ]]; then
    echo "  4. Add variable CLOUDFRONT_DISTRIBUTION_ID: $DIST_ID"
  fi
else
  echo "Setting secrets with gh CLI..."
  
  gh secret set AWS_ROLE_ARN \
    --repo "$GITHUB_ORG/$GITHUB_REPO" \
    --body "$ROLE_ARN"
  
  gh variable set S3_BUCKET \
    --repo "$GITHUB_ORG/$GITHUB_REPO" \
    --body "$S3_BUCKET"
  
  if [[ -n "$DIST_ID" ]]; then
    gh variable set CLOUDFRONT_DISTRIBUTION_ID \
      --repo "$GITHUB_ORG/$GITHUB_REPO" \
      --body "$DIST_ID"
  fi
  
  echo "✅ Secrets configured"
fi

# Cleanup
rm -f /tmp/trust-policy.json /tmp/deploy-policy.json

echo ""
echo "✅ OIDC setup complete!"
echo ""
echo "📝 Summary:"
echo "  Role ARN: $ROLE_ARN"
echo "  S3 Bucket: $S3_BUCKET"
if [[ -n "$DIST_ID" ]]; then
  echo "  CloudFront: $DIST_ID"
fi
echo ""
echo "🚀 Next steps:"
echo "  1. Commit and push .github/workflows/deploy.yml"
echo "  2. Push to main branch to trigger deployment"
echo "  3. Check Actions tab: https://github.com/$GITHUB_ORG/$GITHUB_REPO/actions"
