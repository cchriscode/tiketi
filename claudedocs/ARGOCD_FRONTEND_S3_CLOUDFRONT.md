# Frontend S3 + CloudFront Deployment Plan

## Overview
Transition frontend from Kubernetes deployment to static hosting on S3 with CloudFront CDN.

## Architecture Decision
**Selected: Option B - S3 + CloudFront**
- Frontend served as static files from S3 bucket
- CloudFront CDN for global distribution and HTTPS
- Completely decoupled from Kubernetes cluster
- Separate deployment pipeline from backend services

## Infrastructure Components

### 1. S3 Bucket Configuration
```yaml
Bucket Name: tiketi-frontend-<env>  # e.g., tiketi-frontend-prod
Region: ap-northeast-2
Versioning: Enabled (for rollback capability)
Static Website Hosting: Enabled
Index Document: index.html
Error Document: index.html  # For React Router SPA support

Public Access Settings:
  - Block all public ACLs: Off (CloudFront needs access)
  - Block public bucket policies: Off
  - Bucket Policy: Allow CloudFront OAI only

Lifecycle Rules:
  - Delete old versions after 30 days
  - Abort incomplete multipart uploads after 7 days
```

**Bucket Policy** (CloudFront OAI access only):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity <OAI-ID>"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::tiketi-frontend-prod/*"
    }
  ]
}
```

### 2. CloudFront Distribution
```yaml
Origin:
  - DomainName: tiketi-frontend-prod.s3.ap-northeast-2.amazonaws.com
  - OriginAccessIdentity: Enabled (OAI for secure S3 access)
  - OriginProtocolPolicy: https-only

Default Cache Behavior:
  - ViewerProtocolPolicy: redirect-to-https
  - AllowedMethods: GET, HEAD, OPTIONS
  - CachedMethods: GET, HEAD
  - Compress: true (gzip/brotli)
  - MinTTL: 0
  - DefaultTTL: 86400 (1 day)
  - MaxTTL: 31536000 (1 year)
  - ForwardedValues:
      QueryString: false
      Cookies: none

Custom Error Responses:
  - 403 -> /index.html (200) # SPA routing support
  - 404 -> /index.html (200) # SPA routing support

Price Class: PriceClass_200 (US, Europe, Asia, Middle East, Africa)
Alternate Domain Names (CNAMEs):
  - www.tiketi.com
  - tiketi.com
SSL Certificate: ACM certificate for *.tiketi.com
HTTP Version: HTTP/2 and HTTP/3 enabled
```

### 3. Route53 DNS Configuration
```yaml
Hosted Zone: tiketi.com

Records:
  - Name: tiketi.com
    Type: A (Alias)
    Target: CloudFront distribution

  - Name: www.tiketi.com
    Type: A (Alias)
    Target: CloudFront distribution

  - Name: api.tiketi.com
    Type: A (Alias)
    Target: ALB (backend services)
```

## Build & Deployment Process

### 1. Frontend Build Configuration
**Environment-Specific Builds:**

**`.env.production` (prod environment):**
```bash
REACT_APP_API_URL=https://api.tiketi.com
REACT_APP_ENVIRONMENT=production
PUBLIC_URL=https://tiketi.com
```

**`.env.staging` (staging environment):**
```bash
REACT_APP_API_URL=https://api-staging.tiketi.com
REACT_APP_ENVIRONMENT=staging
PUBLIC_URL=https://staging.tiketi.com
```

**`.env.development` (dev environment):**
```bash
REACT_APP_API_URL=https://api-dev.tiketi.com
REACT_APP_ENVIRONMENT=development
PUBLIC_URL=https://dev.tiketi.com
```

**Build command:**
```bash
cd frontend
npm ci
npm run build  # Creates optimized build in frontend/build/
```

### 2. Deployment Script
**`frontend/scripts/deploy-s3.sh`:**
```bash
#!/bin/bash
set -e

ENVIRONMENT=$1  # dev, staging, prod
BUCKET_NAME="tiketi-frontend-${ENVIRONMENT}"
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='${BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com']].Id" --output text)

echo "🚀 Deploying to S3: ${BUCKET_NAME}"

# Sync build to S3 with cache headers
aws s3 sync build/ s3://${BUCKET_NAME}/ \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "*.html" \
  --exclude "asset-manifest.json" \
  --exclude "manifest.json"

# Upload HTML files with no-cache (for SPA updates)
aws s3 sync build/ s3://${BUCKET_NAME}/ \
  --cache-control "public,max-age=0,must-revalidate" \
  --exclude "*" \
  --include "*.html" \
  --include "asset-manifest.json" \
  --include "manifest.json"

echo "📦 S3 upload complete"

# Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache"
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*"

echo "✅ Deployment complete!"
```

### 3. GitHub Actions Workflow
**`.github/workflows/frontend-deploy.yml`:**
```yaml
name: Frontend Deploy to S3

on:
  push:
    branches:
      - main        # Auto-deploy to prod
      - staging     # Auto-deploy to staging
      - develop     # Auto-deploy to dev
    paths:
      - 'frontend/**'
      - '.github/workflows/frontend-deploy.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Determine environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "environment=prod" >> $GITHUB_OUTPUT
            echo "env_file=.env.production" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/staging" ]]; then
            echo "environment=staging" >> $GITHUB_OUTPUT
            echo "env_file=.env.staging" >> $GITHUB_OUTPUT
          else
            echo "environment=dev" >> $GITHUB_OUTPUT
            echo "env_file=.env.development" >> $GITHUB_OUTPUT
          fi

      - name: Create environment file
        working-directory: frontend
        run: |
          cat > ${{ steps.env.outputs.env_file }} << EOF
          REACT_APP_API_URL=${{ secrets[format('API_URL_{0}', steps.env.outputs.environment)] }}
          REACT_APP_ENVIRONMENT=${{ steps.env.outputs.environment }}
          PUBLIC_URL=https://${{ secrets[format('FRONTEND_DOMAIN_{0}', steps.env.outputs.environment)] }}
          EOF

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Build frontend
        working-directory: frontend
        run: npm run build
        env:
          CI: false  # Treat warnings as warnings, not errors

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-2

      - name: Deploy to S3
        working-directory: frontend
        run: chmod +x scripts/deploy-s3.sh && ./scripts/deploy-s3.sh ${{ steps.env.outputs.environment }}

      - name: Deployment summary
        run: |
          echo "### 🚀 Frontend Deployment Complete" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Environment:** ${{ steps.env.outputs.environment }}" >> $GITHUB_STEP_SUMMARY
          echo "- **S3 Bucket:** tiketi-frontend-${{ steps.env.outputs.environment }}" >> $GITHUB_STEP_SUMMARY
          echo "- **URL:** https://${{ secrets[format('FRONTEND_DOMAIN_{0}', steps.env.outputs.environment)] }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Commit:** ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
```

## Required GitHub Secrets

```yaml
# AWS Credentials
AWS_ACCESS_KEY_ID: <IAM user access key>
AWS_SECRET_ACCESS_KEY: <IAM user secret key>

# Environment-specific domains
FRONTEND_DOMAIN_dev: dev.tiketi.com
FRONTEND_DOMAIN_staging: staging.tiketi.com
FRONTEND_DOMAIN_prod: tiketi.com

# Environment-specific API URLs
API_URL_dev: https://api-dev.tiketi.com
API_URL_staging: https://api-staging.tiketi.com
API_URL_prod: https://api.tiketi.com
```

## IAM Permissions Required

**S3 Access:**
```json
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
        "arn:aws:s3:::tiketi-frontend-*",
        "arn:aws:s3:::tiketi-frontend-*/*"
      ]
    }
  ]
}
```

**CloudFront Access:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations",
        "cloudfront:ListDistributions"
      ],
      "Resource": "*"
    }
  ]
}
```

## Migration Steps from Kubernetes

### Phase 1: Infrastructure Setup
1. Create S3 buckets for each environment (dev, staging, prod)
2. Create CloudFront distributions with OAI
3. Configure Route53 DNS records
4. Request ACM SSL certificates for domains
5. Create IAM user with S3 + CloudFront permissions

### Phase 2: GitHub Actions Setup
1. Add GitHub secrets for AWS credentials and domains
2. Create frontend deployment workflow
3. Create deployment script (`frontend/scripts/deploy-s3.sh`)
4. Test deployment to dev environment

### Phase 3: Kubernetes Cleanup
1. Remove `frontend` deployment from k8s manifests
2. Remove `frontend` service from k8s manifests
3. Remove frontend from ArgoCD application (when we create it)
4. Update documentation to reflect S3 deployment

### Phase 4: Verification
1. Test frontend loads from CloudFront
2. Verify API calls work to backend (CORS configured)
3. Test SPA routing (refresh on nested routes)
4. Check CloudFront cache behavior
5. Verify SSL certificate and HTTPS redirect

## CORS Configuration Required

**Backend services must allow CloudFront origin:**
```javascript
// backend/src/server.js
const allowedOrigins = [
  'http://localhost:3000',  // Local dev
  'https://dev.tiketi.com',
  'https://staging.tiketi.com',
  'https://tiketi.com',
  'https://www.tiketi.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

## Rollback Strategy

**Quick rollback using S3 versioning:**
```bash
# List object versions
aws s3api list-object-versions --bucket tiketi-frontend-prod --prefix index.html

# Restore previous version
aws s3api copy-object \
  --copy-source "tiketi-frontend-prod/index.html?versionId=<VERSION_ID>" \
  --bucket tiketi-frontend-prod \
  --key index.html

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

## Cost Estimation

**Monthly costs (approximate):**
- S3 storage (1GB): ~$0.02
- S3 requests (1M GET): ~$0.40
- CloudFront data transfer (100GB): ~$8.50
- CloudFront requests (1M): ~$0.75
- Route53 hosted zone: $0.50
- **Total: ~$10/month per environment**

**Comparison to EKS:**
- Running nginx in EKS: Uses node resources (~$0.05/hour per pod)
- S3+CloudFront is more cost-effective and scalable

## Performance Benefits

1. **Global CDN**: CloudFront edge locations for low latency worldwide
2. **No K8s overhead**: Direct S3 serving, no container/pod startup time
3. **Automatic scaling**: CloudFront handles traffic spikes automatically
4. **HTTP/2 and HTTP/3**: Modern protocol support built-in
5. **Compression**: Automatic gzip/brotli compression
6. **Static asset caching**: Long cache times for immutable assets (JS, CSS)

## Security Benefits

1. **OAI access**: S3 bucket not publicly accessible, only via CloudFront
2. **WAF integration**: Web Application Firewall at edge
3. **DDoS protection**: AWS Shield Standard included with CloudFront
4. **HTTPS-only**: Automatic redirect to HTTPS
5. **ACM certificates**: Free SSL/TLS certificates, auto-renewal

## Monitoring & Logging

**CloudWatch Metrics:**
- CloudFront request count, bytes downloaded, error rates
- S3 bucket size, request count

**CloudFront Access Logs:**
```yaml
Logging:
  Bucket: tiketi-logs-cloudfront
  Prefix: frontend-prod/
  IncludeCookies: false
```

**S3 Server Access Logs:**
```yaml
Logging:
  TargetBucket: tiketi-logs-s3
  TargetPrefix: frontend-prod/
```

## Next Steps

1. ✅ Complete this design document
2. ⏳ Create Terraform/CloudFormation IaC for S3+CloudFront
3. ⏳ Implement GitHub Actions workflow
4. ⏳ Test deployment to dev environment
5. ⏳ Update backend CORS configuration
6. ⏳ Remove frontend from k8s manifests
7. ⏳ Document deployment process for team
