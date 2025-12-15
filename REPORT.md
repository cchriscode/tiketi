# kind 배포 아키텍처 및 실행 보고서

## 1. 개요
- 로컬 kind 클러스터에 백엔드/프론트엔드/DB/캐시/관측 스택을 배포하고 동작 확인 완료.
- 도메인: `tiketi.local`(백엔드), `frontend.tiketi.local`(프론트). `/etc/hosts`에 `127.0.0.1 tiketi.local frontend.tiketi.local` 필요.

## 2. 아키텍처 (Mermaid)
```mermaid
flowchart LR
    user[User Browser\nhosts: frontend.tiketi.local / tiketi.local]
    ingress[ingress-nginx\n(kind)]

    subgraph app_ns[Namespace: app]
      fe[Service frontend:80\nDeployment 1\nReact (serve build)]
      be[Service backend:80\nDeployment 2\nExpress + Socket.IO]
      redis[Redis Deploy 1\nsvc:6379]
      pg[(Postgres STS 1\nheadless svc:5432)]
    end

    subgraph obs_ns[Namespace: observability]
      prom[Prometheus\nkube-prometheus-stack]
      graf[Grafana]
      loki[Loki]
      promtail[Promtail]
      sm[ServiceMonitor backend]
    end

    user --> ingress
    ingress -->|host: frontend.tiketi.local| fe
    ingress -->|host: tiketi.local| be
    be --> redis
    be --> pg
    be -->|/metrics| sm --> prom --> graf
    promtail --> loki --> graf
```

## 3. 배포 리소스
- 클러스터: kind `tiketi`, 로컬 레지스트리 mirror(5001) 연결 (`k8s/kind-cluster.yaml`)
- 네임스페이스: `app`, `observability`
- Ingress: ingress-nginx (kind용 매니페스트 적용)
- 앱 네임스페이스(`k8s/app/`):
  - `backend.yaml`: Deployment 2, Service, Ingress(`tiketi.local`), ConfigMap/Secret
  - `frontend.yaml`: Deployment 1, Service, Ingress(`frontend.tiketi.local`), ConfigMap
  - `postgres.yaml`: StatefulSet 1, headless Service, PVC 5Gi, Secret
  - `redis.yaml`: Deployment 1, Service
- 관측(`k8s/observability/`):
  - kube-prometheus-stack values, loki-stack values
  - `backend-servicemonitor.yaml`로 /metrics 스크랩

## 4. 이미지 및 환경
- Backend 이미지: `localhost:5001/backend:dev` (npm start, PORT 3001)
- Frontend 이미지: `localhost:5001/frontend:dev`  
  - 빌드 ARG/ENV로 `REACT_APP_API_URL=http://tiketi.local`, `REACT_APP_SOCKET_URL=http://tiketi.local` 주입
- DB/Redis: Postgres 16-alpine, Redis 7.2

## 5. 동작 검증
- API 확인:  
  - `curl -H "Host: tiketi.local" http://127.0.0.1/api/events` → 200, 이벤트 목록 반환
  - `curl -H "Host: tiketi.local" -H "Content-Type: application/json" -d '{"email":"admin@tiketi.gg","password":"admin123"}' http://127.0.0.1/api/auth/login` → 로그인 성공, JWT 발급
- 프론트: http://frontend.tiketi.local (강력 새로고침/시크릿 창 권장)
- 헬스: http://tiketi.local/health
- Swagger: http://tiketi.local/api-docs

## 6. 관측
- Grafana: 포트포워드 `kubectl -n observability port-forward svc/kps-grafana 3000:80` → http://localhost:3000 (admin/admin)
- Prometheus: `kubectl -n observability port-forward svc/kps-kube-prometheus-stack-prometheus 9090:9090` → http://localhost:9090
- Loki/Promtail: stdout 수집, Grafana에서 Loki 데이터소스 사용 가능

## 7. 현재 파드/서비스 상태(예시)
- Pods: backend 2 Running, frontend 1 Running, postgres 1 Running, redis 1 Running
- Services: backend(ClusterIP:80), frontend(ClusterIP:80), postgres(headless 5432), redis(6379)
- Ingress: `tiketi.local` → backend svc, `frontend.tiketi.local` → frontend svc

## 8. 남은 체크포인트
- 브라우저가 최신 번들을 사용하도록 캐시 무효화(DevTools Disable cache + 강력 새로고침).
- 도메인 해상도 유지(/etc/hosts).
- 필요 시 `kubectl -n app rollout restart deploy/frontend`로 최신 이미지 재적용.

