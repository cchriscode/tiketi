# GitHub Actions CI/CD Pipeline for ArgoCD GitOps

## Overview
Automated CI/CD pipeline that builds Docker images, pushes to ECR, updates Kustomize manifests with new image tags, and commits to Git for ArgoCD to sync.

## Pipeline Architecture

```
Git Push (main/staging/develop)
    ↓
GitHub Actions Workflow
    ↓
    ├─→ Build & Test
    ├─→ Build Docker Images
    ├─→ Push to ECR
    ├─→ Update Kustomize Image Tags
    ├─→ Commit & Push to Git
    ↓
ArgoCD Detects Change
    ↓
Auto-Sync to Cluster (dev/staging)
Manual Sync (prod)
```

## Workflow Files Structure

```
.github/
└── workflows/
    ├── backend-ci-cd.yml           # Backend API Gateway
    ├── auth-service-ci-cd.yml      # Auth microservice
    ├── ticket-service-ci-cd.yml    # Ticket microservice
    ├── payment-service-ci-cd.yml   # Payment microservice
    ├── stats-service-ci-cd.yml     # Stats microservice
    ├── frontend-deploy.yml         # Frontend S3 deployment (see ARGOCD_FRONTEND_S3_CLOUDFRONT.md)
    └── manual-rollback.yml         # Manual rollback workflow
```

## Generic Backend Service Workflow Template

### `.github/workflows/backend-ci-cd.yml`
```yaml
name: Backend CI/CD

on:
  push:
    branches:
      - main       # Production
      - staging    # Staging
      - develop    # Development
    paths:
      - 'backend/**'
      - 'packages/**'
      - '.github/workflows/backend-ci-cd.yml'
  pull_request:
    branches:
      - main
      - staging
      - develop
    paths:
      - 'backend/**'
      - 'packages/**'

env:
  AWS_REGION: ap-northeast-2
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-northeast-2.amazonaws.com
  IMAGE_NAME: tiketi-backend

jobs:
  # Job 1: Build and Test
  test:
    name: Test Backend
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            packages/*/package-lock.json

      - name: Install dependencies
        run: |
          cd packages/common && npm ci
          cd ../database && npm ci
          cd ../metrics && npm ci
          cd ../../backend && npm ci

      - name: Run linter
        run: cd backend && npm run lint || echo "No lint script"

      - name: Run tests
        run: cd backend && npm test || echo "No tests yet"

  # Job 2: Build and Push Docker Image
  build-and-push:
    name: Build and Push to ECR
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push'  # Only on push, not PR

    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      short-sha: ${{ steps.vars.outputs.short-sha }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Extract metadata
        id: vars
        run: |
          echo "short-sha=${GITHUB_SHA::7}" >> $GITHUB_OUTPUT
          echo "date=$(date +%Y%m%d-%H%M%S)" >> $GITHUB_OUTPUT

          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "environment=prod" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/staging" ]]; then
            echo "environment=staging" >> $GITHUB_OUTPUT
          else
            echo "environment=dev" >> $GITHUB_OUTPUT
          fi

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: backend/Dockerfile
          push: true
          tags: |
            ${{ env.ECR_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.vars.outputs.short-sha }}
            ${{ env.ECR_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.vars.outputs.environment }}-latest
            ${{ env.ECR_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.vars.outputs.environment }}-${{ steps.vars.outputs.date }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64

      - name: Image scan (Trivy)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.ECR_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.vars.outputs.short-sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

  # Job 3: Update Kustomize Manifests
  update-manifests:
    name: Update Kustomize Manifests
    runs-on: ubuntu-latest
    needs: build-and-push

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}  # Or use PAT for better permissions

      - name: Determine environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "environment=prod" >> $GITHUB_OUTPUT
            echo "overlay_path=k8s/overlays/prod" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/staging" ]]; then
            echo "environment=staging" >> $GITHUB_OUTPUT
            echo "overlay_path=k8s/overlays/staging" >> $GITHUB_OUTPUT
          else
            echo "environment=dev" >> $GITHUB_OUTPUT
            echo "overlay_path=k8s/overlays/dev" >> $GITHUB_OUTPUT
          fi

      - name: Install Kustomize
        run: |
          curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
          sudo mv kustomize /usr/local/bin/

      - name: Update image tag in Kustomize
        run: |
          cd ${{ steps.env.outputs.overlay_path }}
          kustomize edit set image \
            ${{ env.IMAGE_NAME }}=${{ env.ECR_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ needs.build-and-push.outputs.short-sha }}

      - name: Commit and push changes
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"

          git add ${{ steps.env.outputs.overlay_path }}/kustomization.yaml

          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "ci: update ${{ env.IMAGE_NAME }} image to ${{ needs.build-and-push.outputs.short-sha }} in ${{ steps.env.outputs.environment }}"
            git push
          fi

      - name: Deployment summary
        run: |
          echo "### 🚀 Deployment to ${{ steps.env.outputs.environment }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Service:** ${{ env.IMAGE_NAME }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Image Tag:** ${{ needs.build-and-push.outputs.short-sha }}" >> $GITHUB_STEP_SUMMARY
          echo "- **ECR:** \`${{ env.ECR_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ needs.build-and-push.outputs.short-sha }}\`" >> $GITHUB_STEP_SUMMARY
          echo "- **Kustomize Path:** ${{ steps.env.outputs.overlay_path }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Commit:** ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "ArgoCD will auto-sync this change to the cluster." >> $GITHUB_STEP_SUMMARY
```

## Service-Specific Workflows

### Auth Service
**`.github/workflows/auth-service-ci-cd.yml`**

Same template as above, with:
- `IMAGE_NAME: tiketi-auth-service`
- `paths: ['services/auth-service/**', 'packages/**']`
- Dockerfile: `services/auth-service/Dockerfile`

### Ticket Service
**`.github/workflows/ticket-service-ci-cd.yml`**

Same template, with:
- `IMAGE_NAME: tiketi-ticket-service`
- `paths: ['services/ticket-service/**', 'packages/**']`
- Dockerfile: `services/ticket-service/Dockerfile`

### Payment Service
**`.github/workflows/payment-service-ci-cd.yml`**

Same template, with:
- `IMAGE_NAME: tiketi-payment-service`
- `paths: ['services/payment-service/**', 'packages/**']`
- Dockerfile: `services/payment-service/Dockerfile`

### Stats Service
**`.github/workflows/stats-service-ci-cd.yml`**

Same template, with:
- `IMAGE_NAME: tiketi-stats-service`
- `paths: ['services/stats-service/**', 'packages/**']`
- Dockerfile: `services/stats-service/Dockerfile`

## Manual Rollback Workflow

### `.github/workflows/manual-rollback.yml`
```yaml
name: Manual Rollback

on:
  workflow_dispatch:
    inputs:
      service:
        description: 'Service to rollback'
        required: true
        type: choice
        options:
          - backend
          - auth-service
          - ticket-service
          - payment-service
          - stats-service
      environment:
        description: 'Environment'
        required: true
        type: choice
        options:
          - dev
          - staging
          - prod
      image-tag:
        description: 'Image tag to rollback to (e.g., abc1234)'
        required: true
        type: string

jobs:
  rollback:
    name: Rollback ${{ inputs.service }} in ${{ inputs.environment }}
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Install Kustomize
        run: |
          curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
          sudo mv kustomize /usr/local/bin/

      - name: Update image tag
        run: |
          cd k8s/overlays/${{ inputs.environment }}
          kustomize edit set image \
            tiketi-${{ inputs.service }}=${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-${{ inputs.service }}:${{ inputs.image-tag }}

      - name: Commit and push rollback
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"

          git add k8s/overlays/${{ inputs.environment }}/kustomization.yaml
          git commit -m "rollback: revert tiketi-${{ inputs.service }} to ${{ inputs.image-tag }} in ${{ inputs.environment }}"
          git push

      - name: Rollback summary
        run: |
          echo "### ⏮️ Rollback Complete" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Service:** tiketi-${{ inputs.service }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Environment:** ${{ inputs.environment }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Rolled back to:** ${{ inputs.image-tag }}" >> $GITHUB_STEP_SUMMARY
```

## Required GitHub Secrets

```yaml
# AWS Credentials
AWS_ACCOUNT_ID: <12-digit AWS account ID>
AWS_ACCESS_KEY_ID: <IAM user access key>
AWS_SECRET_ACCESS_KEY: <IAM user secret key>

# Optional: GitHub PAT for writing to protected branches
GITHUB_TOKEN: <Personal Access Token with repo permissions>
```

## IAM Permissions for GitHub Actions

### ECR Push Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    }
  ]
}
```

## Branch Protection Rules

### Main Branch (Production)
```yaml
Protection Rules:
  - Require pull request reviews (2 approvers)
  - Require status checks to pass (test job)
  - Require branches to be up to date
  - Include administrators: No
  - Allow force pushes: No
  - Allow deletions: No
```

### Staging Branch
```yaml
Protection Rules:
  - Require pull request reviews (1 approver)
  - Require status checks to pass (test job)
  - Include administrators: No
```

### Develop Branch
```yaml
Protection Rules:
  - Require status checks to pass (test job)
  - No PR required (direct push allowed)
```

## Git Workflow

```
┌─────────┐
│ Feature │
│ Branch  │
└────┬────┘
     │
     ├──PR──→ develop ──auto-deploy──→ Dev Cluster
     │
     ├──PR──→ staging ──auto-deploy──→ Staging Cluster
     │
     └──PR──→ main ────manual-sync──→ Prod Cluster
```

## Environment-to-Branch Mapping

| Environment | Git Branch | Auto-Deploy | ArgoCD Sync |
|-------------|------------|-------------|-------------|
| dev         | develop    | ✅ Yes       | ✅ Auto      |
| staging     | staging    | ✅ Yes       | ✅ Auto      |
| prod        | main       | ✅ Yes*      | ❌ Manual    |

*Auto-deploy updates Git, but ArgoCD requires manual sync for production

## Image Tagging Strategy

### Tag Format
```
<environment>-<timestamp>-<short-sha>

Examples:
- dev-20250105-143052-abc1234
- staging-20250105-143052-abc1234
- prod-20250105-143052-abc1234
```

### Additional Tags
```
- <short-sha>                    # Unique commit tag
- <environment>-latest           # Latest for environment
- <environment>-<timestamp>      # Timestamped release
```

## Deployment Flow Example

### Example: Ticket Service Update
```bash
# 1. Developer pushes to develop branch
git push origin develop

# 2. GitHub Actions triggers
- Runs tests ✅
- Builds Docker image
- Tags: abc1234, dev-latest, dev-20250105-143052
- Pushes to ECR

# 3. Updates k8s/overlays/dev/kustomization.yaml
images:
  - name: tiketi-ticket-service
    newTag: abc1234

# 4. Commits change to Git
git commit -m "ci: update tiketi-ticket-service to abc1234 in dev"
git push

# 5. ArgoCD detects change
- Syncs tiketi-dev application
- Rolls out new pods with abc1234 image

# 6. Promotion to staging
git checkout staging
git merge develop
git push origin staging

# 7. GitHub Actions triggers (same flow for staging)
# 8. ArgoCD auto-syncs to staging cluster

# 9. Promotion to production
git checkout main
git merge staging
git push origin main

# 10. GitHub Actions triggers (updates prod kustomize)
# 11. Ops team manually syncs in ArgoCD UI
```

## Monitoring & Notifications

### Slack Notifications
```yaml
- name: Notify Slack on success
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "✅ Deployment Success: ${{ env.IMAGE_NAME }} → ${{ steps.env.outputs.environment }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Service:* ${{ env.IMAGE_NAME }}\n*Environment:* ${{ steps.env.outputs.environment }}\n*Image:* `${{ needs.build-and-push.outputs.short-sha }}`\n*Commit:* <${{ github.event.head_commit.url }}|${{ github.sha }}>"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "❌ Deployment Failed: ${{ env.IMAGE_NAME }} → ${{ steps.env.outputs.environment }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Cost Optimization

### ECR Lifecycle Policy
```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 images per environment",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["dev-", "staging-", "prod-"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 2,
      "description": "Delete untagged images after 7 days",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 7
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

## Troubleshooting

### Image Push Fails
```bash
# Check ECR login
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com

# Verify IAM permissions
aws sts get-caller-identity
```

### Kustomize Update Fails
```bash
# Manually test kustomize command
cd k8s/overlays/dev
kustomize edit set image tiketi-backend=<ECR_REGISTRY>/tiketi-backend:abc1234
git diff kustomization.yaml
```

### ArgoCD Not Syncing
```bash
# Check ArgoCD application status
argocd app get tiketi-dev

# Force sync
argocd app sync tiketi-dev --force

# Check for differences
argocd app diff tiketi-dev
```

## Best Practices

1. **Immutable Tags**: Use commit SHA for immutable image tags
2. **Multi-Stage Builds**: Optimize Docker images for size
3. **Security Scanning**: Run Trivy on all images
4. **Cache Layers**: Use GitHub Actions cache for faster builds
5. **Separate Workflows**: One workflow per service for isolation
6. **Branch Protection**: Require PR reviews for main/staging
7. **Rollback Plan**: Test rollback workflow regularly
8. **Monitor Deployments**: Integrate with Slack/PagerDuty
9. **Cost Control**: Implement ECR lifecycle policies
10. **GitOps**: Never bypass Git - all changes via commits

## Next Steps

1. ✅ Complete this design document
2. ⏳ Create workflow files for each service
3. ⏳ Set up GitHub secrets
4. ⏳ Configure AWS IAM permissions
5. ⏳ Test workflows in dev environment
6. ⏳ Set up branch protection rules
7. ⏳ Configure Slack notifications
8. ⏳ Implement ECR lifecycle policies
9. ⏳ Document runbook for team
