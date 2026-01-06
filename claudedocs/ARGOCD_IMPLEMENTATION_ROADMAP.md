# ArgoCD Implementation Roadmap

## Executive Summary

This document provides a complete implementation plan for migrating the Tiketi ticketing system to a production-ready AWS infrastructure with ArgoCD GitOps automation.

## Architecture Overview

### Current State (Local Development)
- **Infrastructure**: Kind (local Kubernetes cluster)
- **Frontend**: Kubernetes deployment with nginx
- **Backend**: Monolithic API Gateway + 4 microservices
- **Database**: PostgreSQL StatefulSet in Kind
- **Cache**: Redis StatefulSet in Kind
- **Deployment**: Manual `docker build` + `kind load` + `kubectl apply`

### Target State (AWS Production)
- **Infrastructure**: AWS EKS (multi-AZ, high availability)
- **Frontend**: S3 + CloudFront (static hosting with CDN)
- **Backend**: Microservices in EKS private subnets
- **Database**: Amazon RDS PostgreSQL (managed, multi-AZ)
- **Cache**: Amazon ElastiCache Redis (managed, multi-AZ)
- **Deployment**: GitHub Actions → ECR → ArgoCD GitOps → EKS

## Design Documents

The complete implementation consists of 5 design documents:

1. **[ARGOCD_FRONTEND_S3_CLOUDFRONT.md](./ARGOCD_FRONTEND_S3_CLOUDFRONT.md)**
   - Frontend deployment to S3 + CloudFront
   - Build process, caching strategy, CORS configuration
   - GitHub Actions workflow for S3 deployment

2. **[ARGOCD_K8S_GITOPS_STRUCTURE.md](./ARGOCD_K8S_GITOPS_STRUCTURE.md)**
   - Kustomize base + overlays directory structure
   - Environment-specific configurations (dev/staging/prod)
   - ConfigMaps, Secrets, resource limits

3. **[ARGOCD_APPLICATIONS.md](./ARGOCD_APPLICATIONS.md)**
   - ArgoCD installation and configuration
   - Application definitions for each environment
   - Sync policies, RBAC, notifications

4. **[ARGOCD_GITHUB_ACTIONS.md](./ARGOCD_GITHUB_ACTIONS.md)**
   - CI/CD workflows for backend services
   - ECR image build and push
   - Kustomize image tag updates
   - Rollback workflows

5. **[ARGOCD_GIT_CONFIGURATION.md](./ARGOCD_GIT_CONFIGURATION.md)**
   - Branch strategy (main/staging/develop)
   - Branch protection rules
   - GitHub secrets and webhooks
   - Repository security settings

## AWS Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Cloud (ap-northeast-2)                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                      Edge Services                         │ │
│  │  Route53 → CloudFront (CDN) → WAF                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                VPC (10.0.0.0/16)                          │ │
│  │                                                            │ │
│  │  ┌─────────────────────┐  ┌─────────────────────┐        │ │
│  │  │  Availability Zone A │  │  Availability Zone B │        │ │
│  │  │                      │  │                      │        │ │
│  │  │  Public Subnet       │  │  Public Subnet       │        │ │
│  │  │  (10.0.1.0/24)      │  │  (10.0.2.0/24)      │        │ │
│  │  │  ┌────────────┐     │  │  ┌────────────┐     │        │ │
│  │  │  │    ALB     │     │  │  │    ALB     │     │        │ │
│  │  │  └────────────┘     │  │  └────────────┘     │        │ │
│  │  │                      │  │                      │        │ │
│  │  │  Private Subnet      │  │  Private Subnet      │        │ │
│  │  │  (10.0.11.0/24)     │  │  (10.0.12.0/24)     │        │ │
│  │  │  ┌────────────┐     │  │  ┌────────────┐     │        │ │
│  │  │  │ EKS Nodes  │     │  │  │ EKS Nodes  │     │        │ │
│  │  │  │ (Services) │     │  │  │ (Services) │     │        │ │
│  │  │  └────────────┘     │  │  └────────────┘     │        │ │
│  │  │                      │  │                      │        │ │
│  │  │  DB Subnet           │  │  DB Subnet           │        │ │
│  │  │  (10.0.21.0/24)     │  │  (10.0.22.0/24)     │        │ │
│  │  │  ┌──────┐ ┌──────┐ │  │  ┌──────┐ ┌──────┐ │        │ │
│  │  │  │  RDS │ │Redis │ │  │  │  RDS │ │Redis │ │        │ │
│  │  │  └──────┘ └──────┘ │  │  └──────┘ └──────┘ │        │ │
│  │  └─────────────────────┘  └─────────────────────┘        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Supporting Services:                                           │
│  - S3 (frontend static hosting)                                │
│  - ECR (Docker image registry)                                 │
│  - EKS Control Plane                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Preparation (Estimated: 1-2 days)

#### 1.1 AWS Infrastructure Setup
- [ ] Create AWS account / Ensure billing alerts configured
- [ ] Set up IAM users for CI/CD
- [ ] Create ECR repositories for all services:
  - `tiketi-backend`
  - `tiketi-auth-service`
  - `tiketi-ticket-service`
  - `tiketi-payment-service`
  - `tiketi-stats-service`
- [ ] Configure ECR lifecycle policies (keep last 10 images)
- [ ] Create S3 buckets for frontend: `tiketi-frontend-dev`, `tiketi-frontend-staging`, `tiketi-frontend-prod`
- [ ] Request ACM SSL certificates for domains

#### 1.2 Git Repository Configuration
- [ ] Create three branches: `main`, `staging`, `develop`
- [ ] Set `main` as default branch
- [ ] Configure branch protection rules (see ARGOCD_GIT_CONFIGURATION.md)
- [ ] Add `.github/CODEOWNERS` file
- [ ] Create GitHub secrets (AWS credentials, Slack webhook)
- [ ] Generate SSH deploy key for ArgoCD
- [ ] Add deploy key to GitHub repository settings

#### 1.3 Local Testing Environment
- [ ] Ensure Kind cluster is running
- [ ] Install Kustomize CLI: `brew install kustomize`
- [ ] Install ArgoCD CLI: `brew install argocd`
- [ ] Install AWS CLI: `brew install awscli`

### Phase 2: Kustomize Migration (Estimated: 2-3 days)

#### 2.1 Create Base Manifests
```bash
# Create directory structure
mkdir -p k8s/base/{backend,auth-service,ticket-service,payment-service,stats-service,postgres,redis}

# Move current manifests to base
# (This requires analyzing current k8s/*.yaml files)
```

**Tasks:**
- [ ] Create `k8s/base/namespace.yaml`
- [ ] Split deployments into individual service directories
- [ ] Create service manifests for each component
- [ ] Create base kustomization.yaml files
- [ ] Test: `kustomize build k8s/base`

#### 2.2 Create Dev Overlay
```bash
mkdir -p k8s/overlays/dev
```

**Tasks:**
- [ ] Create `k8s/overlays/dev/kustomization.yaml`
- [ ] Add ConfigMap with dev database endpoints (postgres.tiketi.svc.cluster.local)
- [ ] Add Secrets with dev credentials (plain text OK for dev)
- [ ] Include postgres and redis resources
- [ ] Set local Kind image tags
- [ ] Test: `kustomize build k8s/overlays/dev`
- [ ] Apply to Kind: `kubectl apply -k k8s/overlays/dev`
- [ ] Verify all pods are running: `kubectl get pods -n tiketi`

#### 2.3 Create Staging Overlay
```bash
mkdir -p k8s/overlays/staging
```

**Tasks:**
- [ ] Create `k8s/overlays/staging/kustomization.yaml`
- [ ] Add ConfigMap with staging RDS/ElastiCache endpoints (placeholders for now)
- [ ] Add sealed secrets (empty for now, will populate after EKS setup)
- [ ] Create ALB ingress manifest
- [ ] Create HPA (Horizontal Pod Autoscaler) manifests
- [ ] Set ECR image references
- [ ] Set replica counts (2-3 per service)
- [ ] Test: `kustomize build k8s/overlays/staging`

#### 2.4 Create Prod Overlay
```bash
mkdir -p k8s/overlays/prod
```

**Tasks:**
- [ ] Create `k8s/overlays/prod/kustomization.yaml`
- [ ] Add ConfigMap with prod RDS/ElastiCache endpoints (placeholders)
- [ ] Add sealed secrets (empty for now)
- [ ] Create ALB ingress with WAF annotations
- [ ] Create HPA manifests (higher limits)
- [ ] Create PDB (Pod Disruption Budget) manifests
- [ ] Set ECR image references
- [ ] Set replica counts (3-5 per service)
- [ ] Test: `kustomize build k8s/overlays/prod`

#### 2.5 Commit Kustomize Structure
```bash
git checkout develop
git add k8s/
git commit -m "feat(k8s): migrate to kustomize base + overlays structure"
git push origin develop
```

### Phase 3: Frontend S3 Deployment (Estimated: 1 day)

#### 3.1 S3 and CloudFront Setup
**Tasks:**
- [ ] Create S3 buckets (already done in Phase 1.1)
- [ ] Enable S3 versioning and static website hosting
- [ ] Create CloudFront distributions for each environment
- [ ] Configure CloudFront OAI (Origin Access Identity)
- [ ] Add S3 bucket policies for CloudFront access
- [ ] Request and attach ACM SSL certificates to CloudFront
- [ ] Configure Route53 DNS records (CNAME to CloudFront)

#### 3.2 Frontend Build Configuration
**Tasks:**
- [ ] Create `.env.production`, `.env.staging`, `.env.development` in `frontend/`
- [ ] Update API URLs to point to ALB endpoints (placeholders for now)
- [ ] Create `frontend/scripts/deploy-s3.sh` deployment script
- [ ] Test build locally: `cd frontend && npm run build`

#### 3.3 GitHub Actions for Frontend
**Tasks:**
- [ ] Create `.github/workflows/frontend-deploy.yml`
- [ ] Add GitHub secrets for frontend domains and API URLs
- [ ] Test workflow by pushing to `develop` branch
- [ ] Verify frontend deploys to `tiketi-frontend-dev` bucket
- [ ] Access `https://dev.tiketi.com` and verify frontend loads
- [ ] Update backend CORS to allow CloudFront origins

#### 3.4 Remove Frontend from Kubernetes
**Tasks:**
- [ ] Remove frontend deployment from `k8s/base/` (if exists)
- [ ] Remove frontend service from `k8s/base/` (if exists)
- [ ] Update documentation to reflect S3 deployment
- [ ] Commit changes: `git commit -m "chore(k8s): remove frontend, now deployed to S3"`

### Phase 4: GitHub Actions CI/CD (Estimated: 2 days)

#### 4.1 Create Workflow Files
**Tasks:**
- [ ] Create `.github/workflows/backend-ci-cd.yml`
- [ ] Create `.github/workflows/auth-service-ci-cd.yml`
- [ ] Create `.github/workflows/ticket-service-ci-cd.yml`
- [ ] Create `.github/workflows/payment-service-ci-cd.yml`
- [ ] Create `.github/workflows/stats-service-ci-cd.yml`
- [ ] Create `.github/workflows/manual-rollback.yml`

#### 4.2 Test CI/CD in Dev
**Tasks:**
- [ ] Push a change to `backend/` on `develop` branch
- [ ] Verify GitHub Actions builds Docker image
- [ ] Verify image pushes to ECR with correct tags
- [ ] Verify workflow updates `k8s/overlays/dev/kustomization.yaml`
- [ ] Verify commit is pushed back to Git
- [ ] Check ECR for new image: `aws ecr list-images --repository-name tiketi-backend`

#### 4.3 Configure Slack Notifications (Optional)
**Tasks:**
- [ ] Create Slack webhook URL
- [ ] Add `SLACK_WEBHOOK_URL` to GitHub secrets
- [ ] Update workflows to send deployment notifications
- [ ] Test by triggering a deployment

### Phase 5: EKS Cluster Setup (Estimated: 2-3 days)

**Note:** This phase requires Terraform or CloudFormation IaC. Not included in current scope but outlined here:

#### 5.1 EKS Infrastructure (requires IaC)
- [ ] Create VPC with public/private/DB subnets in 2 AZs
- [ ] Create EKS cluster (v1.28+)
- [ ] Create EKS node groups (t3.medium or larger)
- [ ] Configure IAM roles for nodes (ECR access, logs, metrics)
- [ ] Install AWS Load Balancer Controller
- [ ] Install EBS CSI driver for persistent volumes

#### 5.2 RDS and ElastiCache
- [ ] Create RDS PostgreSQL instance (multi-AZ)
- [ ] Create ElastiCache Redis cluster (multi-AZ)
- [ ] Configure security groups (allow EKS → RDS/Redis)
- [ ] Create database schema and user
- [ ] Run database migrations
- [ ] Update staging/prod ConfigMaps with endpoints

#### 5.3 Networking
- [ ] Create Application Load Balancer
- [ ] Configure target groups for backend services
- [ ] Set up Route53 DNS for `api.tiketi.com`, `api-staging.tiketi.com`
- [ ] Configure WAF rules (optional)
- [ ] Test ALB → EKS connectivity

### Phase 6: ArgoCD Installation (Estimated: 1 day)

#### 6.1 Install ArgoCD
```bash
# Connect to EKS cluster
aws eks update-kubeconfig --region ap-northeast-2 --name tiketi-cluster

# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s
```

#### 6.2 Access ArgoCD UI
```bash
# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port-forward (temporary)
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Access https://localhost:8080
# Username: admin
# Password: <from above command>
```

#### 6.3 Configure Repository Access
```bash
# Add repository with SSH key
argocd repo add git@github.com:<ORG>/project-ticketing.git \
  --ssh-private-key-path argocd_deploy_key

# Verify connection
argocd repo list
```

#### 6.4 Create ALB Ingress for ArgoCD (Production)
**Tasks:**
- [ ] Create `argocd/ingress.yaml` with ALB annotations
- [ ] Apply ingress: `kubectl apply -f argocd/ingress.yaml`
- [ ] Configure Route53 DNS for `argocd.tiketi.com`
- [ ] Access ArgoCD at `https://argocd.tiketi.com`

### Phase 7: ArgoCD Applications (Estimated: 1 day)

#### 7.1 Create ArgoCD Project
```bash
# Create project directory
mkdir -p argocd/{projects,applications}

# Create tiketi-project.yaml
kubectl apply -f argocd/projects/tiketi-project.yaml
```

#### 7.2 Create Applications
**Tasks:**
- [ ] Create `argocd/applications/tiketi-dev.yaml`
- [ ] Create `argocd/applications/tiketi-staging.yaml`
- [ ] Create `argocd/applications/tiketi-prod.yaml`
- [ ] Apply: `kubectl apply -f argocd/applications/`
- [ ] Verify in ArgoCD UI: Applications should appear

#### 7.3 Create App-of-Apps
**Tasks:**
- [ ] Create `argocd/app-of-apps.yaml`
- [ ] Apply: `kubectl apply -f argocd/app-of-apps.yaml`
- [ ] Verify all applications are managed by root app

#### 7.4 Test ArgoCD Sync
```bash
# Sync dev application
argocd app sync tiketi-dev

# Watch sync progress
argocd app get tiketi-dev --refresh

# Verify pods are running in EKS
kubectl get pods -n tiketi
```

### Phase 8: Secrets Management (Estimated: 1 day)

#### 8.1 Install Sealed Secrets Controller
```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Install kubeseal CLI
brew install kubeseal
```

#### 8.2 Create Production Secrets
```bash
# Generate strong secrets
export DB_PASSWORD=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 32)
export INTERNAL_API_TOKEN=$(openssl rand -base64 32)

# Create secret YAML
kubectl create secret generic tiketi-secrets \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=INTERNAL_API_TOKEN="$INTERNAL_API_TOKEN" \
  --dry-run=client -o yaml > secrets.yaml

# Encrypt with kubeseal
kubeseal --format=yaml < secrets.yaml > k8s/overlays/prod/secrets.enc.yaml

# Commit encrypted secrets
git add k8s/overlays/prod/secrets.enc.yaml
git commit -m "feat(k8s): add encrypted production secrets"
git push origin main
```

#### 8.3 Update Staging Secrets
```bash
# Repeat for staging environment
kubectl create secret generic tiketi-secrets \
  --from-literal=DB_PASSWORD="<staging-db-password>" \
  --from-literal=JWT_SECRET="<staging-jwt-secret>" \
  --from-literal=INTERNAL_API_TOKEN="<staging-token>" \
  --dry-run=client -o yaml > secrets.yaml

kubeseal --format=yaml < secrets.yaml > k8s/overlays/staging/secrets.enc.yaml

git add k8s/overlays/staging/secrets.enc.yaml
git commit -m "feat(k8s): add encrypted staging secrets"
git push origin staging
```

### Phase 9: End-to-End Testing (Estimated: 2-3 days)

#### 9.1 Dev Environment
- [ ] Deploy a change to `develop` branch
- [ ] Verify GitHub Actions builds and pushes to ECR
- [ ] Verify Kustomize image tag is updated in Git
- [ ] Verify ArgoCD detects change and auto-syncs
- [ ] Verify new pods are deployed in EKS
- [ ] Test application functionality

#### 9.2 Staging Environment
- [ ] Merge `develop` → `staging`
- [ ] Verify GitHub Actions pipeline runs
- [ ] Verify ArgoCD auto-syncs to staging namespace
- [ ] Run smoke tests against `api-staging.tiketi.com`
- [ ] Verify frontend at `https://staging.tiketi.com`

#### 9.3 Production Environment
- [ ] Merge `staging` → `main`
- [ ] Verify GitHub Actions updates prod kustomize
- [ ] **Manually sync** in ArgoCD UI (prod has auto-sync disabled)
- [ ] Monitor rollout in ArgoCD
- [ ] Run full regression tests
- [ ] Verify frontend at `https://tiketi.com`
- [ ] Monitor logs and metrics

#### 9.4 Rollback Testing
- [ ] Use manual rollback workflow
- [ ] Specify previous image tag
- [ ] Verify rollback completes successfully
- [ ] Test application functionality after rollback

### Phase 10: Monitoring & Operations (Estimated: 2 days)

#### 10.1 Monitoring Setup (Optional, requires additional tools)
- [ ] Install Prometheus (via Helm)
- [ ] Install Grafana (via Helm)
- [ ] Configure ServiceMonitors for services
- [ ] Import ArgoCD Grafana dashboard
- [ ] Set up CloudWatch logs integration

#### 10.2 Alerting (Optional)
- [ ] Configure ArgoCD notifications (Slack)
- [ ] Set up PagerDuty integration for prod alerts
- [ ] Create runbooks for common issues

#### 10.3 Documentation
- [ ] Document deployment process for team
- [ ] Create runbook for rollbacks
- [ ] Document troubleshooting steps
- [ ] Create architecture diagram

## Rollback Strategy

### Immediate Rollback (within 1 hour)
1. Use ArgoCD UI: History → Select previous revision → Rollback
2. Or use manual rollback workflow in GitHub Actions
3. Or use ArgoCD CLI: `argocd app rollback tiketi-prod <revision>`

### Git Revert Rollback
```bash
# Find the commit that introduced the issue
git log --oneline

# Revert the commit
git revert <commit-sha>
git push origin main

# ArgoCD will auto-detect and sync
```

### Database Rollback (if migrations fail)
1. Connect to RDS instance
2. Run rollback migration scripts
3. Revert application code to previous version

## Cost Estimation

### Monthly AWS Costs (Approximate)

**Development Environment:**
- EKS cluster: $73/month (control plane)
- 2x t3.medium nodes: ~$60/month
- RDS db.t3.small: ~$50/month
- ElastiCache t3.micro: ~$20/month
- ALB: ~$20/month
- S3 + CloudFront: ~$10/month
- **Total Dev: ~$233/month**

**Staging Environment:**
- EKS cluster: $73/month
- 3x t3.medium nodes: ~$90/month
- RDS db.t3.medium: ~$100/month
- ElastiCache t3.small: ~$40/month
- ALB: ~$20/month
- S3 + CloudFront: ~$10/month
- **Total Staging: ~$333/month**

**Production Environment:**
- EKS cluster: $73/month
- 5x t3.large nodes: ~$375/month
- RDS db.t3.large Multi-AZ: ~$400/month
- ElastiCache r6g.large: ~$200/month
- ALB: ~$20/month
- S3 + CloudFront: ~$50/month
- **Total Prod: ~$1,118/month**

**Grand Total: ~$1,684/month** (scales with traffic)

## Success Criteria

### Technical Metrics
- [ ] Zero-downtime deployments in production
- [ ] Rollback time < 5 minutes
- [ ] Deployment pipeline < 10 minutes end-to-end
- [ ] >99.5% uptime for production services

### Operational Metrics
- [ ] Developers can deploy to dev without ops team
- [ ] All deployments tracked in Git history
- [ ] Automated rollback capability
- [ ] Full audit trail of production changes

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Database migration failure | High | Medium | Test migrations in staging first, have rollback scripts ready |
| EKS cluster misconfiguration | High | Low | Use IaC, test in dev first, peer review |
| Secrets leak | Critical | Low | Use Sealed Secrets, enable GitHub secret scanning |
| Cost overrun | Medium | Medium | Set billing alerts, monitor usage, right-size resources |
| Deployment pipeline failure | Medium | Low | Test workflows in dev, have manual deployment process documented |

## Support & Escalation

### During Migration
- **Project Lead**: Responsible for overall success
- **Platform Team**: EKS, ArgoCD, infrastructure
- **Backend Team**: Service deployments, database migrations
- **Frontend Team**: S3/CloudFront deployment

### Post-Migration
- **On-call Rotation**: 24/7 coverage for production issues
- **Runbooks**: Documented in `docs/runbooks/`
- **Escalation Path**: Developer → Team Lead → Engineering Manager

## Next Steps

**Immediate actions (this week):**
1. Review all design documents with team
2. Set up AWS account and IAM users
3. Create GitHub secrets
4. Start Phase 2: Kustomize migration

**Short term (next 2 weeks):**
1. Complete frontend S3 deployment
2. Set up GitHub Actions workflows
3. Test CI/CD pipeline in dev

**Medium term (next 4 weeks):**
1. Provision EKS cluster
2. Install ArgoCD
3. Deploy to staging and test

**Long term (next 8 weeks):**
1. Production deployment
2. Monitoring and alerting setup
3. Team training and documentation

## References

- [Kustomize Documentation](https://kustomize.io/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-05
**Author**: Claude Code
**Review Status**: Ready for team review
