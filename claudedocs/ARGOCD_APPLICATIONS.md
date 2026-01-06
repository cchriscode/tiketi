# ArgoCD Applications Design

## Overview
ArgoCD Application manifests for managing Tiketi microservices deployment across dev, staging, and production environments.

## ArgoCD Architecture

```
ArgoCD (installed in argocd namespace)
│
├── App of Apps Pattern (tiketi-apps)
│   ├── tiketi-dev
│   ├── tiketi-staging
│   └── tiketi-prod
```

## Installation

### ArgoCD Installation
```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Install ArgoCD CLI (optional, for local management)
brew install argocd

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port-forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Login
argocd login localhost:8080
```

### AWS Load Balancer for ArgoCD (Production)
```yaml
# argocd/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server
  namespace: argocd
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/backend-protocol: HTTPS
    alb.ingress.kubernetes.io/healthcheck-path: /healthz
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS": 443}]'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:<ACCOUNT_ID>:certificate/<CERT_ID>
spec:
  rules:
  - host: argocd.tiketi.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: argocd-server
            port:
              number: 443
```

## Directory Structure

```
argocd/
├── install.yaml                    # ArgoCD installation manifest (optional, can use helm)
├── ingress.yaml                    # ALB ingress for ArgoCD UI
├── app-of-apps.yaml                # Root application managing all env apps
├── projects/
│   └── tiketi-project.yaml         # ArgoCD AppProject definition
└── applications/
    ├── tiketi-dev.yaml             # Dev environment application
    ├── tiketi-staging.yaml         # Staging environment application
    └── tiketi-prod.yaml            # Production environment application
```

## AppProject Definition

### `argocd/projects/tiketi-project.yaml`
```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: tiketi
  namespace: argocd
spec:
  description: Tiketi Microservices Platform

  # Source repositories
  sourceRepos:
    - 'https://github.com/<ORG>/project-ticketing.git'
    - 'https://github.com/<ORG>/project-ticketing-gitops.git'  # Separate GitOps repo (optional)

  # Destination clusters and namespaces
  destinations:
    - namespace: 'tiketi'
      server: 'https://kubernetes.default.svc'  # In-cluster
    - namespace: 'tiketi-staging'
      server: 'https://kubernetes.default.svc'
    - namespace: 'tiketi-dev'
      server: 'https://kubernetes.default.svc'

  # Cluster resource whitelist
  clusterResourceWhitelist:
    - group: ''
      kind: Namespace

  # Namespace resource whitelist (empty = allow all)
  namespaceResourceWhitelist:
    - group: '*'
      kind: '*'

  # Orphaned resources handling
  orphanedResources:
    warn: true
```

## Application Definitions

### `argocd/app-of-apps.yaml` (Root Application)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tiketi-apps
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: tiketi

  source:
    repoURL: 'https://github.com/<ORG>/project-ticketing.git'
    targetRevision: main
    path: argocd/applications

  destination:
    server: 'https://kubernetes.default.svc'
    namespace: argocd

  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
```

### `argocd/applications/tiketi-dev.yaml`
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tiketi-dev
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: tiketi

  source:
    repoURL: 'https://github.com/<ORG>/project-ticketing.git'
    targetRevision: develop  # Dev branch
    path: k8s/overlays/dev

  destination:
    server: 'https://kubernetes.default.svc'
    namespace: tiketi

  syncPolicy:
    automated:
      prune: true          # Auto-delete resources not in Git
      selfHeal: true       # Auto-sync on drift detection
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true

  # Retry strategy
  retry:
    limit: 5
    backoff:
      duration: 5s
      factor: 2
      maxDuration: 3m

  # Health checks
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas  # Ignore HPA-managed replicas
```

### `argocd/applications/tiketi-staging.yaml`
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tiketi-staging
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: tiketi

  source:
    repoURL: 'https://github.com/<ORG>/project-ticketing.git'
    targetRevision: staging  # Staging branch
    path: k8s/overlays/staging

  destination:
    server: 'https://kubernetes.default.svc'
    namespace: tiketi-staging

  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground

  retry:
    limit: 5
    backoff:
      duration: 5s
      factor: 2
      maxDuration: 3m

  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
```

### `argocd/applications/tiketi-prod.yaml`
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tiketi-prod
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: tiketi

  source:
    repoURL: 'https://github.com/<ORG>/project-ticketing.git'
    targetRevision: main  # Production branch
    path: k8s/overlays/prod

  destination:
    server: 'https://kubernetes.default.svc'
    namespace: tiketi

  syncPolicy:
    automated:
      prune: false         # Manual prune for production safety
      selfHeal: false      # Manual sync for production safety
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground

    # Sync windows (optional: only allow sync during maintenance windows)
    syncWindows:
      - kind: allow
        schedule: '0 2 * * *'  # Allow auto-sync at 2 AM daily
        duration: 2h
        applications:
          - tiketi-prod
        manualSync: true

  retry:
    limit: 3
    backoff:
      duration: 10s
      factor: 2
      maxDuration: 5m

  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
```

## Sync Policies by Environment

| Environment | Auto-Prune | Auto-Heal | Manual Approval |
|-------------|------------|-----------|-----------------|
| dev         | ✅ Yes      | ✅ Yes     | ❌ No            |
| staging     | ✅ Yes      | ✅ Yes     | ❌ No            |
| prod        | ❌ No       | ❌ No      | ✅ Yes           |

### Rationale:
- **Dev**: Fully automated for rapid iteration
- **Staging**: Fully automated to mirror production deployment
- **Prod**: Manual sync for safety, requires approval via ArgoCD UI

## RBAC Configuration

### Admin Access
```yaml
# argocd-rbac-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:readonly
  policy.csv: |
    # Admin group (full access)
    g, admin-team, role:admin

    # Developer group (read-only on prod, full access on dev/staging)
    p, role:developer, applications, get, tiketi-dev, allow
    p, role:developer, applications, sync, tiketi-dev, allow
    p, role:developer, applications, get, tiketi-staging, allow
    p, role:developer, applications, sync, tiketi-staging, allow
    p, role:developer, applications, get, tiketi-prod, allow
    g, dev-team, role:developer

    # Ops group (full access to all environments)
    p, role:ops, applications, *, */*, allow
    g, ops-team, role:ops
```

### SSO Integration (Optional)
```yaml
# argocd-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
  namespace: argocd
data:
  url: https://argocd.tiketi.com

  # GitHub OAuth
  dex.config: |
    connectors:
      - type: github
        id: github
        name: GitHub
        config:
          clientID: $GITHUB_CLIENT_ID
          clientSecret: $GITHUB_CLIENT_SECRET
          orgs:
            - name: your-org
```

## Notification Configuration

### Slack Notifications
```yaml
# argocd-notifications-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  service.slack: |
    token: $slack-token

  template.app-deployed: |
    message: |
      {{if eq .serviceType "slack"}}:white_check_mark:{{end}} Application {{.app.metadata.name}} is now running new version.
    slack:
      attachments: |
        [{
          "title": "{{ .app.metadata.name}}",
          "title_link":"{{.context.argocdUrl}}/applications/{{.app.metadata.name}}",
          "color": "#18be52",
          "fields": [
          {
            "title": "Sync Status",
            "value": "{{.app.status.sync.status}}",
            "short": true
          },
          {
            "title": "Repository",
            "value": "{{.app.spec.source.repoURL}}",
            "short": true
          }
          ]
        }]

  trigger.on-deployed: |
    - when: app.status.operationState.phase in ['Succeeded']
      send: [app-deployed]

  subscriptions: |
    - recipients:
        - slack:deployments
      triggers:
        - on-deployed
```

## Health Checks

### Custom Health Checks
```yaml
# argocd-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
  namespace: argocd
data:
  resource.customizations.health.Deployment: |
    hs = {}
    if obj.status ~= nil then
      if obj.status.replicas ~= nil and obj.status.updatedReplicas ~= nil and obj.status.availableReplicas ~= nil then
        if obj.status.replicas == obj.status.updatedReplicas and obj.status.replicas == obj.status.availableReplicas then
          hs.status = "Healthy"
          hs.message = "Deployment is healthy"
          return hs
        end
      end
    end
    hs.status = "Progressing"
    hs.message = "Waiting for deployment to be ready"
    return hs
```

## CLI Commands

### Application Management
```bash
# List all applications
argocd app list

# Get application details
argocd app get tiketi-prod

# Sync application
argocd app sync tiketi-dev

# Rollback to previous version
argocd app rollback tiketi-prod

# Delete application
argocd app delete tiketi-dev

# Set auto-sync
argocd app set tiketi-dev --sync-policy automated

# Disable auto-sync
argocd app set tiketi-prod --sync-policy none
```

### Deployment History
```bash
# View deployment history
argocd app history tiketi-prod

# Rollback to specific revision
argocd app rollback tiketi-prod 5
```

## Image Updater Integration

### ArgoCD Image Updater (Optional)
Automatically update image tags in Git when new images are pushed to ECR.

```yaml
# argocd-image-updater ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-image-updater-config
  namespace: argocd
data:
  registries.conf: |
    registries:
      - name: ECR
        prefix: <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com
        api_url: https://<AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com
        credentials: ext:/scripts/ecr-login.sh
        default: true
```

**Application annotation for auto-update:**
```yaml
metadata:
  annotations:
    argocd-image-updater.argoproj.io/image-list: tiketi-backend=<AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi-backend
    argocd-image-updater.argoproj.io/tiketi-backend.update-strategy: latest
    argocd-image-updater.argoproj.io/write-back-method: git
```

## Monitoring & Observability

### Prometheus Metrics
ArgoCD exposes Prometheus metrics at `/metrics`:
- `argocd_app_sync_total` - Total number of syncs per application
- `argocd_app_health_status` - Current health status
- `argocd_app_sync_status` - Current sync status

### Grafana Dashboard
Import ArgoCD community dashboard: https://grafana.com/grafana/dashboards/14584

## Disaster Recovery

### Backup ArgoCD Configuration
```bash
# Backup all applications
argocd app list -o yaml > argocd-apps-backup.yaml

# Backup all projects
kubectl get appprojects -n argocd -o yaml > argocd-projects-backup.yaml

# Backup ArgoCD configuration
kubectl get configmaps -n argocd -o yaml > argocd-config-backup.yaml
```

### Restore
```bash
kubectl apply -f argocd-projects-backup.yaml
kubectl apply -f argocd-apps-backup.yaml
```

## Best Practices

1. **Use App of Apps Pattern**: Manage all environments from a single root application
2. **Separate Sync Policies**: Auto-sync for dev/staging, manual for prod
3. **Enable Notifications**: Slack/email alerts for deployment events
4. **Health Checks**: Configure custom health checks for applications
5. **RBAC**: Implement least-privilege access control
6. **Prune with Care**: Enable auto-prune only after thorough testing
7. **Sync Windows**: Use sync windows for production deployments
8. **Monitoring**: Integrate with Prometheus and Grafana
9. **Secrets Management**: Use Sealed Secrets or External Secrets Operator
10. **Git as Single Source of Truth**: All changes via Git commits

## Next Steps

1. ✅ Complete this design document
2. ⏳ Install ArgoCD in cluster
3. ⏳ Create AppProject and Applications
4. ⏳ Configure RBAC and SSO
5. ⏳ Set up notifications
6. ⏳ Test sync with dev environment
7. ⏳ Implement Image Updater (optional)
8. ⏳ Document runbooks for operators
