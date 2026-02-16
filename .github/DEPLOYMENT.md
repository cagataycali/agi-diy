# GitHub Actions Deployment Setup

## Quick Start

```bash
# Run the setup script
./scripts/setup-oidc.sh <github-org> <github-repo> <aws-account-id> <s3-bucket>

# Example
./scripts/setup-oidc.sh jsamuel1 agi-diy 123456789012 agidiy.sauhsoj.people.aws.dev
```

This script will:
1. ✅ Create/verify GitHub OIDC provider in AWS
2. ✅ Create IAM role with deployment permissions
3. ✅ Configure GitHub repository secrets (if `gh` CLI installed)
4. ✅ Detect CloudFront distribution ID automatically

## What Gets Created

### AWS Resources

**OIDC Provider:**
- URL: `https://token.actions.githubusercontent.com`
- Thumbprint: `6938fd4d98bab03faadb97b34396831e3780aea1`

**IAM Role:**
- Name: `GitHubActions-<repo>-Deploy`
- Trust policy: Only allows your GitHub repo
- Permissions:
  - S3: Read/Write/Delete on specified bucket
  - CloudFront: Create/Get invalidations

### GitHub Secrets/Variables

**Secret:**
- `AWS_ROLE_ARN` - IAM role ARN for OIDC authentication

**Variables:**
- `S3_BUCKET` - Target S3 bucket name
- `CLOUDFRONT_DISTRIBUTION_ID` - (Optional) For cache invalidation

## Manual Setup (if gh CLI not available)

1. Run the script - it will output the values
2. Go to: `https://github.com/<org>/<repo>/settings/secrets/actions`
3. Add the secret and variables manually

## GitHub Actions Workflow

The workflow (`.github/workflows/deploy.yml`) triggers on:
- Push to `main` branch
- Manual workflow dispatch

**What it does:**
1. Authenticates with AWS using OIDC (no access keys!)
2. Syncs `docs/` folder to S3
3. Sets cache headers (1 hour for HTML, 1 year for assets)
4. Invalidates CloudFront cache (if configured)

## Testing

```bash
# Trigger manual deployment
gh workflow run deploy.yml --repo <org>/<repo>

# Watch the run
gh run watch --repo <org>/<repo>
```

## Security Benefits

✅ **No long-lived credentials** - OIDC tokens are generated fresh for each workflow run and expire after 1 hour
✅ **Scoped to repository** - Only your repo can assume the role
✅ **Least privilege** - Role only has S3 and CloudFront permissions
✅ **Auditable** - CloudTrail logs all actions

### How OIDC Works

Each time the workflow runs:
1. GitHub generates a new OIDC token (valid 1 hour)
2. Workflow exchanges token for temporary AWS credentials
3. Credentials are used for deployment
4. Credentials expire when workflow ends

**No manual rotation needed** - Fresh tokens are generated automatically for every deployment.

## Troubleshooting

**"User is not authorized to perform: sts:AssumeRoleWithWebIdentity"**
- Check trust policy allows your repo: `repo:<org>/<repo>:*`
- Verify OIDC provider exists in AWS

**"Access Denied" on S3**
- Check role policy includes your bucket ARN
- Verify bucket name matches `S3_BUCKET` variable

**CloudFront invalidation fails**
- Check `CLOUDFRONT_DISTRIBUTION_ID` variable is set
- Verify role has `cloudfront:CreateInvalidation` permission

## Cleanup

```bash
# Delete IAM role
aws iam delete-role-policy \
  --role-name GitHubActions-<repo>-Deploy \
  --policy-name DeploymentPolicy

aws iam delete-role \
  --role-name GitHubActions-<repo>-Deploy

# Delete OIDC provider (if no other repos use it)
aws iam delete-open-id-connect-provider \
  --open-id-connect-provider-arn arn:aws:iam::<account>:oidc-provider/token.actions.githubusercontent.com
```
