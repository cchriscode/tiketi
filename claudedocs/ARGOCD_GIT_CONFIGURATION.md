# Git Configuration Requirements for ArgoCD GitOps

## Overview
This document outlines all Git repository configurations required for ArgoCD GitOps workflow.

## Repository Structure Decision

### Option 1: Monorepo (Recommended for Tiketi)
**Single repository containing:**
- Application source code (`backend/`, `services/`, `frontend/`)
- Kubernetes manifests (`k8s/base/`, `k8s/overlays/`)
- ArgoCD applications (`argocd/applications/`)
- CI/CD workflows (`.github/workflows/`)

**Advantages:**
- Simpler management - one repo to maintain
- Atomic commits - code + manifests updated together
- Easier for small teams
- No cross-repo synchronization issues

**Current structure:**
```
project-ticketing/  (existing repo)
├── backend/
├── services/
├── frontend/
├── packages/
├── k8s/                    # ← NEW: Kustomize manifests
│   ├── base/
│   └── overlays/
├── argocd/                 # ← NEW: ArgoCD applications
│   ├── app-of-apps.yaml
│   ├── projects/
│   └── applications/
└── .github/workflows/      # ← UPDATED: CI/CD pipelines
```

### Option 2: Separate GitOps Repo
**Two repositories:**
1. `project-ticketing` - Application code only
2. `project-ticketing-gitops` - K8s manifests and ArgoCD apps

**Advantages:**
- Clear separation of concerns
- Different access control (restrict prod manifest changes)
- Independent versioning

**Not recommended** for Tiketi because:
- Small team doesn't need separation
- Adds complexity of cross-repo updates
- Requires more sophisticated CI/CD

## Branch Strategy

### Three-Branch Model (Recommended)
```
main (production)
├── staging (pre-production)
│   └── develop (development)
```

**Branch-to-Environment Mapping:**
| Branch  | Environment | K8s Namespace  | ArgoCD Sync | Deploy Trigger |
|---------|-------------|----------------|-------------|----------------|
| develop | dev         | tiketi         | Auto        | Direct push    |
| staging | staging     | tiketi-staging | Auto        | PR from develop|
| main    | prod        | tiketi         | Manual      | PR from staging|

**Workflow:**
1. Developers work on `feature/*` branches
2. Merge to `develop` via PR → Auto-deploy to dev
3. Promote `develop` → `staging` via PR → Auto-deploy to staging
4. Promote `staging` → `main` via PR → Manual sync to prod

### Alternative: Trunk-Based Development
```
main (only branch)
└── feature/* (short-lived)
```

**With environment folders:**
- `k8s/overlays/dev/` - Always latest
- `k8s/overlays/staging/` - Updated when ready
- `k8s/overlays/prod/` - Updated after staging validation

**Not recommended** for Tiketi because:
- Harder to track what's in each environment
- More complex promotion process

## Branch Protection Rules

### Main Branch (Production)
```yaml
Settings → Branches → Add rule

Branch name pattern: main

Protect matching branches:
  ✅ Require a pull request before merging
      - Require approvals: 2
      - Dismiss stale pull request approvals when new commits are pushed
      - Require review from Code Owners

  ✅ Require status checks to pass before merging
      - Require branches to be up to date before merging
      Required status checks:
        - test (GitHub Actions job)
        - build-and-push (GitHub Actions job)
        - security-scan (optional)

  ✅ Require conversation resolution before merging

  ✅ Require linear history (no merge commits)

  ✅ Include administrators

  ❌ Allow force pushes (NEVER for prod)
  ❌ Allow deletions
```

### Staging Branch
```yaml
Branch name pattern: staging

Protect matching branches:
  ✅ Require a pull request before merging
      - Require approvals: 1
      - Dismiss stale pull request approvals when new commits are pushed

  ✅ Require status checks to pass before merging
      Required status checks:
        - test
        - build-and-push

  ✅ Require conversation resolution before merging

  ❌ Include administrators
  ❌ Allow force pushes (except for admins)
```

### Develop Branch
```yaml
Branch name pattern: develop

Protect matching branches:
  ✅ Require status checks to pass before merging
      Required status checks:
        - test

  ❌ Require pull request (allow direct push)
  ❌ Allow force pushes (except for admins)
```

## CODEOWNERS File

Create `.github/CODEOWNERS` to enforce reviews from specific teams:

```
# CODEOWNERS for Tiketi Project

# Default owners for everything
* @tiketi-team/developers

# Production manifests require ops team approval
k8s/overlays/prod/ @tiketi-team/ops-team @tiketi-team/tech-lead

# ArgoCD applications require platform team
argocd/ @tiketi-team/platform-team

# Infrastructure and CI/CD
.github/workflows/ @tiketi-team/devops-team
*.Dockerfile @tiketi-team/devops-team
docker-compose.yml @tiketi-team/devops-team

# Backend services
backend/ @tiketi-team/backend-team
services/ @tiketi-team/backend-team

# Frontend
frontend/ @tiketi-team/frontend-team

# Database migrations (requires DBA review)
database/migrations/ @tiketi-team/dba-team @tiketi-team/backend-team

# Security-sensitive files
packages/common/src/middleware/auth.js @tiketi-team/security-team
services/auth-service/ @tiketi-team/security-team
```

## GitHub Secrets Configuration

### Repository Secrets
Navigate to: `Settings → Secrets and variables → Actions → New repository secret`

```yaml
# AWS Credentials for ECR and S3
AWS_ACCOUNT_ID: "123456789012"
AWS_ACCESS_KEY_ID: "AKIA..."
AWS_SECRET_ACCESS_KEY: "..."
AWS_REGION: "ap-northeast-2"

# Frontend S3 Deployment
FRONTEND_DOMAIN_dev: "dev.tiketi.com"
FRONTEND_DOMAIN_staging: "staging.tiketi.com"
FRONTEND_DOMAIN_prod: "tiketi.com"

API_URL_dev: "https://api-dev.tiketi.com"
API_URL_staging: "https://api-staging.tiketi.com"
API_URL_prod: "https://api.tiketi.com"

# Notifications
SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/..."

# Optional: GitHub PAT for protected branch writes
GITHUB_PAT: "ghp_..."  # Personal Access Token with repo scope
```

### Environment Secrets (Optional)
For stricter control, use GitHub Environments:

**Settings → Environments → New environment**

Create environments: `dev`, `staging`, `prod`

**Production environment settings:**
```yaml
Environment name: prod

Deployment branches: Selected branches
  - main

Environment secrets:
  - DB_PASSWORD_PROD
  - JWT_SECRET_PROD
  - INTERNAL_API_TOKEN_PROD

Required reviewers: @tiketi-team/ops-team (2 required)
Wait timer: 0 minutes
```

## GitHub Actions Permissions

**Settings → Actions → General**

```yaml
Actions permissions:
  ✅ Allow all actions and reusable workflows

Workflow permissions:
  ✅ Read and write permissions
      (Required for GitHub Actions to commit kustomization changes)
  ✅ Allow GitHub Actions to create and approve pull requests

Fork pull request workflows:
  ✅ Require approval for all outside collaborators
```

## Git Tags for Releases

### Semantic Versioning
```bash
# Production releases
git tag -a v1.0.0 -m "Release v1.0.0 - Initial production launch"
git push origin v1.0.0

# Release candidates
git tag -a v1.1.0-rc.1 -m "Release candidate 1.1.0-rc.1"
git push origin v1.1.0-rc.1
```

### Tag Protection Rules
**Settings → Tags → Add rule**

```yaml
Tag name pattern: v*

Protect matching tags:
  ✅ Require a pull request before creating or updating matching tags
      - Require approvals: 2
  ✅ Include administrators
```

## Commit Message Convention

### Format (Conventional Commits)
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Build/tool changes
- `ci`: CI/CD changes
- `rollback`: Rollback deployment

**Examples:**
```bash
# Feature commit
git commit -m "feat(ticket-service): add seat reservation locking mechanism"

# Bug fix
git commit -m "fix(auth): resolve JWT expiration validation issue"

# CI update
git commit -m "ci: update backend image to abc1234 in staging"

# Rollback
git commit -m "rollback: revert payment-service to v1.2.3 in prod"
```

### Commit Message Linting (Optional)
**`.github/workflows/commitlint.yml`:**
```yaml
name: Commit Lint

on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Lint commits
        uses: wagoid/commitlint-github-action@v5
```

**`commitlint.config.js`:**
```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'ci', 'rollback']
    ]
  }
};
```

## .gitignore Updates

**Add to `.gitignore`:**
```bash
# Environment-specific secrets (dev only)
k8s/overlays/dev/secrets.yaml

# Never commit unencrypted secrets
**/secrets.yaml
!**/secrets.enc.yaml  # Allow encrypted secrets

# ArgoCD local configs
argocd/local/

# Kustomize build output
k8s/**/kustomization-generated.yaml

# Temporary GitOps files
*.tmp.yaml
```

## Pre-commit Hooks (Optional)

**`.pre-commit-config.yaml`:**
```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
        args: ['--unsafe']  # Allow custom YAML tags
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: detect-private-key

  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.83.5
    hooks:
      - id: terraform_fmt
      - id: terraform_validate

  - repo: local
    hooks:
      - id: prevent-prod-secrets
        name: Prevent unencrypted prod secrets
        entry: bash -c 'if [ -f k8s/overlays/prod/secrets.yaml ]; then echo "ERROR: Unencrypted secrets in prod!"; exit 1; fi'
        language: system
        pass_filenames: false
```

**Installation:**
```bash
pip install pre-commit
pre-commit install
```

## GitHub Repository Settings

### General Settings
```yaml
Settings → General:

Default branch: main

Features:
  ✅ Issues
  ✅ Projects
  ✅ Wiki
  ❌ Sponsorships
  ❌ Discussions (unless needed)

Pull Requests:
  ✅ Allow squash merging (default)
  ✅ Allow merge commits
  ❌ Allow rebase merging
  ✅ Always suggest updating pull request branches
  ✅ Automatically delete head branches
```

### Webhooks (for ArgoCD)
**Settings → Webhooks → Add webhook**

```yaml
Payload URL: https://argocd.tiketi.com/api/webhook
Content type: application/json
Secret: <generate random secret>

Which events:
  ✅ Just the push event

Active: ✅
```

## ArgoCD Repository Access

### SSH Key for Private Repo
```bash
# Generate SSH key for ArgoCD
ssh-keygen -t ed25519 -C "argocd@tiketi" -f argocd_deploy_key

# Add public key to GitHub
# Settings → Deploy keys → Add deploy key
# Title: ArgoCD Deploy Key
# Key: <paste argocd_deploy_key.pub>
# ✅ Allow write access (if using Image Updater)

# Add private key to ArgoCD
kubectl create secret generic argocd-repo-secret \
  -n argocd \
  --from-literal=type=git \
  --from-literal=url=git@github.com:<ORG>/project-ticketing.git \
  --from-file=sshPrivateKey=argocd_deploy_key

# Or use ArgoCD CLI
argocd repo add git@github.com:<ORG>/project-ticketing.git \
  --ssh-private-key-path argocd_deploy_key
```

### HTTPS with Personal Access Token (Alternative)
```bash
# Create GitHub PAT
# Settings → Developer settings → Personal access tokens → Fine-grained tokens
# Repository access: project-ticketing
# Permissions: Contents (read), Metadata (read)

# Add to ArgoCD
argocd repo add https://github.com/<ORG>/project-ticketing.git \
  --username <github-username> \
  --password <github-pat>
```

## Repository Security

### GitHub Advanced Security (Optional)
**Settings → Security → Code security and analysis**

```yaml
Dependency graph: ✅ Enabled
Dependabot alerts: ✅ Enabled
Dependabot security updates: ✅ Enabled

Code scanning:
  ✅ CodeQL analysis
  ✅ Third-party code scanning (Trivy)

Secret scanning: ✅ Enabled
  ✅ Push protection (prevents committing secrets)
```

### Dependabot Configuration
**`.github/dependabot.yml`:**
```yaml
version: 2
updates:
  # Node.js dependencies
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"

  # Docker base images
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

## Git LFS for Large Files (Optional)

If storing large binary files (images, videos for docs):

```bash
# Install Git LFS
git lfs install

# Track file types
git lfs track "*.png"
git lfs track "*.jpg"
git lfs track "*.mp4"

# Commit .gitattributes
git add .gitattributes
git commit -m "chore: add Git LFS for binary files"
```

## Checklist for Initial Setup

### One-time Setup
- [ ] Create three branches: `main`, `staging`, `develop`
- [ ] Set default branch to `main`
- [ ] Configure branch protection rules
- [ ] Add `.github/CODEOWNERS` file
- [ ] Add GitHub secrets (AWS, Slack, etc.)
- [ ] Enable GitHub Actions workflows
- [ ] Create SSH deploy key for ArgoCD
- [ ] Add deploy key to GitHub
- [ ] Configure ArgoCD repository access
- [ ] Enable Dependabot and security scanning
- [ ] Add `.gitignore` for secrets
- [ ] Install pre-commit hooks (optional)
- [ ] Set up webhooks for ArgoCD

### Per Developer Setup
- [ ] Clone repository
- [ ] Install pre-commit hooks: `pre-commit install`
- [ ] Configure Git user: `git config user.name` and `git config user.email`
- [ ] Set up GPG signing (optional): `git config commit.gpgsign true`

## Troubleshooting

### Issue: GitHub Actions can't push to protected branch
**Solution:**
- Use a Personal Access Token with `repo` scope
- Store as `GITHUB_PAT` secret
- Update workflow to use: `token: ${{ secrets.GITHUB_PAT }}`

### Issue: ArgoCD can't access private repository
**Solution:**
```bash
# Check ArgoCD repo connection
argocd repo list

# Test connection
argocd repo get https://github.com/<ORG>/project-ticketing.git

# Re-add with correct credentials
argocd repo add git@github.com:<ORG>/project-ticketing.git \
  --ssh-private-key-path argocd_deploy_key
```

### Issue: Merge conflicts in kustomization.yaml
**Solution:**
```bash
# Always pull before updating kustomize
git pull origin develop

# Use separate kustomization per service (advanced)
k8s/overlays/dev/
  ├── backend/kustomization.yaml
  ├── ticket-service/kustomization.yaml
  └── kustomization.yaml  # References sub-kustomizations
```

## Best Practices

1. **Never commit secrets** - Use Sealed Secrets or External Secrets Operator
2. **Protect production** - Require 2 approvals for `main` branch
3. **Automate dev/staging** - Full GitOps for rapid iteration
4. **Manual prod sync** - Human approval for production deployments
5. **Use conventional commits** - Clear commit history
6. **Tag releases** - Semantic versioning for production
7. **Enable security scanning** - Dependabot, CodeQL, Trivy
8. **Monorepo for small teams** - Simpler than separate repos
9. **Git as source of truth** - Never kubectl apply directly
10. **Rollback via Git** - Revert commits to rollback deployments

## Next Steps

1. ✅ Complete this design document
2. ⏳ Create three branches (main, staging, develop)
3. ⏳ Configure branch protection rules
4. ⏳ Add GitHub secrets
5. ⏳ Create CODEOWNERS file
6. ⏳ Generate ArgoCD SSH deploy key
7. ⏳ Add deploy key to GitHub
8. ⏳ Test webhook connection
9. ⏳ Document for team
