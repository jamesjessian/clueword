#!/bin/bash
# Deploy Clueword to AWS using SAM
set -euo pipefail

STACK_NAME="${1:-clueword}"
REGION="${AWS_REGION:-eu-west-2}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploying Clueword → $STACK_NAME"
echo "  Region: $REGION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check pre-computed data exists
if [ ! -f "api/puzzles.json" ]; then
  echo ""
  echo "⚠ api/puzzles.json not found!"
  echo "  Run: npm run precompute"
  echo "  (requires GloVe data — see README)"
  exit 1
fi

# Build
echo ""
echo "📦 Building..."
sam build --region "$REGION"

# Deploy
echo ""
echo "🚀 Deploying SAM stack..."
sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

# Get stack outputs
echo ""
echo "📡 Fetching stack outputs..."
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

CF_DIST=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

CF_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text)

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Sync frontend to S3
echo ""
echo "📁 Syncing frontend to S3 ($BUCKET)..."
aws s3 sync public/ "s3://$BUCKET/" --delete --region "$REGION"

# Invalidate CloudFront cache
echo ""
echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$CF_DIST" \
  --paths "/*" > /dev/null 2>&1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deployed!"
echo ""
echo "  🎮 Game:  $CF_URL"
echo "  📡 API:   $API_URL"
echo "  📦 Stack: $STACK_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
