# Tiketi MSA System Specification (Codebase + GitOps)

Last updated: 2026-01-05
Branch focus: mono-kind2
Audience: internal presentation

## 1. Scope and goals
- Provide a detailed, code based specification of the current MSA architecture, backend design, API surface, and GitOps pipeline.
- Capture migration work, CI/CD setup, and troubleshooting outcomes in a single reference document.

## 2. Repository structure (top level)
- `backend/` Legacy monolith split into gateway and admin only features.
- `frontend/` React SPA.
- `services/` Microservices: auth, ticket, payment, stats.
- `packages/` Shared libraries for common code, DB, and metrics.
- `database/` SQL migrations and schema definitions.
- `k8s/` Kustomize base and overlays plus legacy manifests.
- `argocd/` ArgoCD applications and project definitions.
- `.github/workflows/` CI/CD workflows (service specific + legacy deploy).
- `scripts/` Local dev and Kind deployment helpers.
- `monitoring/` Loki, Promtail, Grafana assets.
- `claudedocs/` Analysis, migration, and roadmap docs.

## 3. Runtime architecture (current)
- Client traffic terminates at the backend gateway (Express).
- Gateway proxies API calls to microservices and owns admin/news/image endpoints.
- Ticket service owns real time Socket.IO, queueing, and background jobs.
- PostgreSQL is the primary datastore; schemas isolate service data.
- Redis compatible cache and queue via Dragonfly (dev) or ElastiCache (staging/prod).
- Observability via Prometheus metrics endpoints and Loki logs, visualized in Grafana.

## 4. Service catalog
| Service | Port | Role | Storage | External deps |
| --- | --- | --- | --- | --- |
| backend | 3001 | API gateway, admin, news, image upload, metrics | PostgreSQL, Redis | S3 (optional) |
| auth-service | 3005 | JWT login, registration, Google OAuth | PostgreSQL (auth_schema) | Google OAuth |
| ticket-service | 3002 | Events, seats, reservations, queue, WebSocket | PostgreSQL (ticket_schema), Redis | Socket.IO |
| payment-service | 3003 | Payment prepare, confirm, cancel | PostgreSQL (payment_schema) | Toss Payments |
| stats-service | 3004 | Admin analytics and reports | PostgreSQL (stats_schema) | none |
| frontend | 3000 | React SPA | none | API gateway |

## 5. Shared libraries
- `packages/common/` provides constants, error classes, validators, and shared error middleware.
- `packages/database/` provides PG pool with schema `search_path`, Redis client, transaction helper, cache manager.
- `packages/metrics/` provides Prometheus registry, middleware, and business counters.

## 6. Data stores and schemas
PostgreSQL schemas (from `database/migrations/*.sql`):
- auth_schema
  - users
- ticket_schema
  - seat_layouts
  - events
  - ticket_types
  - seats
  - reservations
  - reservation_items
  - keyword_mappings
  - news
- payment_schema
  - payments
  - payment_logs
- stats_schema
  - daily_stats
  - event_stats

Design notes:
- UUID primary keys (distributed friendly).
- `search_path` configured in both gateway and shared DB package to include all schemas.
- Reservation items link seats or ticket types depending on event type.

## 7. Backend (gateway) architecture
Entry point: `backend/src/server.js`
- Express app with JSON middleware, request logging, metrics middleware, and centralized error handler.
- Swagger UI at `/api-docs` backed by `backend/src/config/swagger.js`.
- Proxy routes:
  - `/api/auth` -> auth-service
  - `/api/payments` -> payment-service
  - `/api/stats` -> stats-service
  - `/api/events`, `/api/tickets`, `/api/seats`, `/api/reservations`, `/api/queue` -> ticket-service
- Backend only routes:
  - `/api/admin` (admin console operations)
  - `/api/news` (news CRUD)
  - `/api/image` (S3 upload, only if `AWS_S3_BUCKET` set)
  - `/health*` (health endpoints)
- Prometheus metrics exposed at `/metrics`.
- Uses `INTERNAL_API_TOKEN` to call ticket-service internal endpoints.

## 8. Microservices architecture
### 8.1 Auth service
Entry: `services/auth-service/src/server.js`
- `/api/auth` routes provide registration, login, token verification, and Google OAuth.
- JWT issuance with configurable secret and expiry.

### 8.2 Ticket service
Entry: `services/ticket-service/src/server.js`
- Owns Socket.IO server and rooms: `event:{id}`, `queue:{id}`, `seats:{id}`.
- Uses Redis adapter for multi pod WebSocket broadcasts.
- Background jobs:
  - Queue processor (default 10s): admits users from Redis sorted set.
  - Reservation cleaner (30s): expires pending reservations, restores inventory.
  - Event status updater: auto transitions events to on_sale/ended and notifies clients.

### 8.3 Payment service
Entry: `services/payment-service/src/server.js`
- Toss Payments integration with DB backed state machine.
- Uses row locks to avoid payment and cleanup race.

### 8.4 Stats service
Entry: `services/stats-service/src/server.js`
- Admin only analytics endpoints reading across schemas.

## 9. API specification
Client base URL is the backend gateway `http://<host>:3001/api`. All endpoints below are relative to `/api` unless noted.

### 9.1 Gateway proxy groups
- `/auth/*` -> auth-service
- `/payments/*` -> payment-service
- `/stats/*` -> stats-service
- `/events/*`, `/tickets/*`, `/seats/*`, `/reservations/*`, `/queue/*` -> ticket-service

### 9.2 Backend only endpoints
- `GET /admin/dashboard/stats` Admin dashboard summary
- `GET /admin/seat-layouts` Seat layout list
- `POST /admin/events` Create event
- `PUT /admin/events/:id` Update event
- `POST /admin/events/:id/cancel` Cancel event
- `DELETE /admin/events/:id` Delete event
- `POST /admin/events/:id/generate-seats` Generate seats from layout
- `DELETE /admin/events/:id/seats` Delete seats for event
- `POST /admin/events/:eventId/tickets` Create ticket type
- `PUT /admin/tickets/:id` Update ticket type
- `GET /admin/reservations` Admin reservation list
- `PATCH /admin/reservations/:id/status` Update reservation status

- `GET /news` List news
- `GET /news/:id` News detail
- `POST /news` Create news (auth)
- `PUT /news/:id` Update news (auth)
- `DELETE /news/:id` Delete news (auth)

- `POST /image/upload` S3 image upload (only if S3 configured)

Health and metrics:
- `GET /health`, `GET /health/db`, `GET /health/redis`, `GET /health/all`
- `GET /metrics`

### 9.3 Auth service endpoints
Base: `/auth`
- `POST /register` Create account
- `POST /login` Login and receive JWT
- `GET /me` Get user info (Bearer token)
- `POST /verify-token` Validate JWT (internal use)
- `POST /google` Google OAuth login

### 9.4 Ticket service endpoints
Base: `/events`
- `GET /` List events with filters and search
- `GET /:id` Event details + ticket types

Base: `/tickets`
- `GET /event/:eventId` Ticket types for event
- `GET /availability/:ticketTypeId` Availability for ticket type

Base: `/seats`
- `GET /layouts` Seat layout list
- `GET /events/:eventId` Seat map for event
- `POST /reserve` Lock seats and create reservation (auth)
- `GET /reservation/:reservationId` Reservation seat detail (auth)

Base: `/reservations`
- `POST /` Create reservation for non seat tickets (auth)
- `GET /my` List my reservations (auth)
- `GET /:id` Reservation detail (auth)
- `POST /:id/cancel` Cancel reservation (auth)

Base: `/queue`
- `POST /check/:eventId` Check or join queue (auth)
- `GET /status/:eventId` Queue status (auth)
- `POST /leave/:eventId` Leave queue (auth)
- `GET /admin/:eventId` Admin queue view (admin)
- `POST /admin/clear/:eventId` Admin queue clear (admin)

Internal (service only):
- `POST /internal/reschedule-event-status` (header `x-internal-token`)

### 9.5 Payment service endpoints
Base: `/payments`
- `POST /prepare` Create payment order (auth)
- `POST /confirm` Confirm payment with Toss (auth)
- `GET /order/:orderId` Payment detail (auth)
- `POST /:paymentKey/cancel` Cancel and refund (auth)
- `GET /user/me` Payment history (auth)
- `POST /process` Non Toss payment simulation (auth)

### 9.6 Stats service endpoints
Base: `/stats` (all require admin)
- `GET /overview` Global stats
- `GET /daily` Daily trend
- `GET /events` Event ranking
- `GET /events/:eventId` Event detail trend
- `GET /payments` Payment method stats
- `GET /revenue` Revenue trend
- `GET /users` User stats
- `GET /hourly-traffic` Hourly traffic
- `GET /conversion` Funnel metrics
- `GET /cancellations` Cancel and refund metrics
- `GET /realtime` Near real time stats
- `GET /seat-preferences` Seat preference analysis
- `GET /user-behavior` User behavior
- `GET /performance` System level stats

## 10. WebSocket and real time
Socket.IO lives in ticket-service on path `/socket.io`.
Rooms and events:
- Client emits: `join-event`, `join-queue`, `join-seat-selection`.
- Server emits:
  - `room-info` (room size)
  - `queue-entry-allowed`
  - `queue-updated`
  - `queue-cleared`
  - `seat-selected`
  - `seats-released`
  - `event-status-changed`

## 11. Background jobs
- Queue processor: reads `queue:{eventId}` sorted set and admits users to `active:{eventId}`; default threshold 1000.
- Reservation cleaner: every 30s, expires pending reservations with `FOR UPDATE SKIP LOCKED`, restores inventory.
- Event status updater: smart timer for `sale_start_date` and `sale_end_date`, updates DB and emits status changes.

## 12. Observability
- Prometheus metrics via `/metrics` in each service.
- Application logs aggregated by Loki with Promtail.
- Grafana dashboards for system and API performance.

## 13. Configuration and secrets
Production guardrails enforced in each service startup:
- backend: `JWT_SECRET`, `ADMIN_PASSWORD`, `INTERNAL_API_TOKEN`
- auth-service: `JWT_SECRET`, `GOOGLE_CLIENT_ID`
- ticket-service: `JWT_SECRET`, `INTERNAL_API_TOKEN`
- payment-service: `JWT_SECRET`, `TOSS_SECRET_KEY`
- stats-service: `JWT_SECRET`

K8s env in `k8s/overlays/*`:
- dev uses `config.env` and `secrets.env` files.
- staging and prod use Kustomize configMapGenerator literals plus SealedSecrets.

## 14. Kubernetes and Kustomize structure
- Base workloads in `k8s/base/` for microservices.
- Dev overlay in `k8s/overlays/dev/` includes Postgres and Dragonfly, NodePort patches, and initContainers.
- Dev infra overlay in `k8s/overlays/dev-infra/` deploys only DB and cache.
- Staging/prod overlays in `k8s/overlays/staging/` and `k8s/overlays/prod/` add ingress, HPA, PDB, and SealedSecrets.
- Images in staging/prod are set to ECR and tagged by CI.

## 15. GitOps (ArgoCD)
- App of Apps at `argocd/applications/app-of-apps.yaml`.
- Environment apps:
  - `argocd/applications/tiketi-dev.yaml` (auto sync)
  - `argocd/applications/tiketi-staging.yaml` (auto sync)
  - `argocd/applications/tiketi-prod.yaml` (manual sync)
- Project policy at `argocd/projects/tiketi-project.yaml` defines repo and destination access.

## 16. CI/CD (GitHub Actions)
Service pipelines:
- `backend-ci-cd.yml`, `auth-service-ci-cd.yml`, `ticket-service-ci-cd.yml`, `payment-service-ci-cd.yml`, `stats-service-ci-cd.yml`
- Trigger on `main` and `develop` by path.
- Build and push images to ECR using OIDC.
- Update Kustomize overlay image tags, commit, and push.
- Optional Discord notification.

Legacy pipeline:
- `deploy.yml` still deploys frontend to S3 and backend to EC2 via docker compose. This is the pre GitOps path.

## 17. Troubleshooting and resolved issues
- Duplicate event status updater: backend admin now calls ticket-service internal reschedule instead of starting backend updater. See `backend/src/routes/admin.js` and `services/ticket-service/src/routes/internal.js`.
- Redis readiness check: ioredis uses `.status === 'ready'` in ticket-service; backend uses node-redis `.isOpen` on shutdown. See `services/ticket-service/src/services/event-status-updater.js` and `backend/src/server.js`.
- Payment confirm race: payment confirm uses `FOR UPDATE` and reservation cleaner uses `FOR UPDATE SKIP LOCKED` with status guard. See `services/payment-service/src/routes/payments.js` and `services/ticket-service/src/services/reservation-cleaner.js`.
- Port forward conflict: `start_port_forwards.ps1` prompts to stop local Postgres or use port 15432.
- Docker build reliability: service Dockerfiles now fail fast if shared package installs fail.
- Internal token hardening: `INTERNAL_API_TOKEN` added to secrets and used for inter service calls.
- UI data mismatches: seat based and ticket type based reservation detail now return consistent fields used by frontend.

## 18. Known gaps and follow ups
- Admin API still runs in gateway and reads cross schema tables via `search_path`; consider moving admin data queries into ticket-service for stricter service boundaries.
- Some legacy docs reference old `k8s/0x-*.yaml` manifests; update for Kustomize overlays to avoid confusion.

## 19. File index
Key config and code entry points:
- `backend/src/server.js`
- `services/auth-service/src/server.js`
- `services/ticket-service/src/server.js`
- `services/payment-service/src/server.js`
- `services/stats-service/src/server.js`
- `k8s/overlays/dev/kustomization.yaml`
- `k8s/overlays/staging/kustomization.yaml`
- `k8s/overlays/prod/kustomization.yaml`
- `argocd/applications/`
- `.github/workflows/`