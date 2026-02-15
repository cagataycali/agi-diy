# S3 Deployment Instructions

## Step-by-Step Deployment

### 1. Get Route53 Hosted Zone ID

```bash
aws route53 list-hosted-zones-by-name \
  --dns-name sauhsoj.people.aws.dev \
  --query 'HostedZones[0].Id' \
  --output text
```

Save this ID for the next step.

### 2. Deploy CloudFormation Stack

```bash
aws cloudformation create-stack \
  --stack-name agidiy-website \
  --template-body file://infra/s3-website.yaml \
  --parameters ParameterKey=HostedZoneId,ParameterValue=<YOUR_HOSTED_ZONE_ID> \
  --region us-east-1
```

**Note:** Certificate must be in us-east-1 for CloudFront.

Wait for stack creation:

```bash
aws cloudformation wait stack-create-complete \
  --stack-name agidiy-website \
  --region us-east-1
```

### 3. Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name agidiy-website \
  --region us-east-1 \
  --query 'Stacks[0].Outputs'
```

Note the:
- `BucketName` - for deployment
- `DistributionId` - for cache invalidation

### 4. Deploy Site Content

```bash
# Sync docs folder to S3
aws s3 sync docs/ s3://agidiy.sauhsoj.people.aws.dev/ \
  --delete \
  --cache-control "public, max-age=3600" \
  --exclude "*.md"

# Set longer cache for static assets
aws s3 cp s3://agidiy.sauhsoj.people.aws.dev/ \
  s3://agidiy.sauhsoj.people.aws.dev/ \
  --recursive \
  --exclude "*" \
  --include "*.js" \
  --include "*.css" \
  --include "*.png" \
  --include "*.jpg" \
  --include "*.svg" \
  --cache-control "public, max-age=31536000, immutable" \
  --metadata-directive REPLACE
```

### 5. Invalidate CloudFront Cache

```bash
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name agidiy-website \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

### 6. Verify Deployment

```bash
# Check S3 website endpoint
curl -I https://agidiy.sauhsoj.people.aws.dev

# Should return 200 OK with CloudFront headers
```

## GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to S3

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsDeployRole
          aws-region: us-east-1
      
      - name: Sync to S3
        run: |
          aws s3 sync docs/ s3://agidiy.sauhsoj.people.aws.dev/ \
            --delete \
            --cache-control "public, max-age=3600" \
            --exclude "*.md"
      
      - name: Set immutable cache for assets
        run: |
          aws s3 cp s3://agidiy.sauhsoj.people.aws.dev/ \
            s3://agidiy.sauhsoj.people.aws.dev/ \
            --recursive \
            --exclude "*" \
            --include "*.js" \
            --include "*.css" \
            --include "*.png" \
            --include "*.jpg" \
            --include "*.svg" \
            --cache-control "public, max-age=31536000, immutable" \
            --metadata-directive REPLACE
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

### Setup GitHub Secrets

1. Create IAM role for GitHub Actions (see below)
2. Add secrets to GitHub repo:
   - `AWS_ACCOUNT_ID` - Your playground1 account ID
   - `CLOUDFRONT_DISTRIBUTION_ID` - From stack outputs

### IAM Role for GitHub Actions

Create `infra/github-actions-role.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'IAM role for GitHub Actions to deploy to S3'

Parameters:
  GitHubOrg:
    Type: String
    Default: jsamuel1
  GitHubRepo:
    Type: String
    Default: agi-diy

Resources:
  GitHubActionsRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: GitHubActionsDeployRole
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Federated: !Sub 'arn:aws:iam::${AWS::AccountId}:oidc-provider/token.actions.githubusercontent.com'
            Action: 'sts:AssumeRoleWithWebIdentity'
            Condition:
              StringEquals:
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com'
              StringLike:
                'token.actions.githubusercontent.com:sub': !Sub 'repo:${GitHubOrg}/${GitHubRepo}:*'
      ManagedPolicyArns:
        - !Ref DeploymentPolicy

  DeploymentPolicy:
    Type: AWS::IAM::ManagedPolicy
    Properties:
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Action:
              - s3:PutObject
              - s3:GetObject
              - s3:DeleteObject
              - s3:ListBucket
            Resource:
              - !Sub 'arn:aws:s3:::agidiy.sauhsoj.people.aws.dev'
              - !Sub 'arn:aws:s3:::agidiy.sauhsoj.people.aws.dev/*'
          - Effect: Allow
            Action:
              - cloudfront:CreateInvalidation
              - cloudfront:GetInvalidation
            Resource: '*'

Outputs:
  RoleArn:
    Value: !GetAtt GitHubActionsRole.Arn
```

Deploy this first:

```bash
aws cloudformation create-stack \
  --stack-name github-actions-role \
  --template-body file://infra/github-actions-role.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

## DNS Cutover

Once verified working:

1. Current: GitHub Pages → `agidiy.sauhsoj.people.aws.dev`
2. New: CloudFront → `agidiy.sauhsoj.people.aws.dev`

The CloudFormation stack automatically creates the Route53 A record pointing to CloudFront. To switch:

```bash
# The stack already updated DNS, just verify
dig agidiy.sauhsoj.people.aws.dev

# Should show CloudFront distribution domain
```

## Rollback

If issues occur:

```bash
# Delete the stack (keeps S3 bucket by default)
aws cloudformation delete-stack \
  --stack-name agidiy-website \
  --region us-east-1

# Manually point DNS back to GitHub Pages if needed
```

## Cost Estimate

- S3: ~$0.023/GB storage + $0.09/GB transfer
- CloudFront: First 1TB free, then $0.085/GB
- Route53: $0.50/month per hosted zone
- Certificate: Free

**Estimated monthly cost for low traffic:** < $1

## Differences from Current Setup

| Feature | GitHub Pages | S3 + CloudFront |
|---------|--------------|-----------------|
| Cost | Free | ~$1/month |
| Custom domain | Yes | Yes |
| HTTPS | Yes (auto) | Yes (ACM cert) |
| CDN | GitHub CDN | CloudFront |
| Deploy method | Git push | S3 sync |
| Cache control | Limited | Full control |
| SPA routing | Limited | Full control |

## Next Steps

1. Deploy CloudFormation stack
2. Test at CloudFront URL
3. Verify DNS propagation
4. Set up GitHub Actions
5. Monitor for 24 hours
6. Remove GitHub Pages deployment
