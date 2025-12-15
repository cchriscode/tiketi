# kind 로컬 배포 가이드 (backend + DB + Redis + observability)

## 0. 사전 준비
- `/etc/hosts`에 `127.0.0.1 tiketi.local` 추가.
- Docker, kind, kubectl, Helm 설치.

## 1. 로컬 레지스트리 + kind 클러스터
```bash
docker run -d --restart=always -p 5001:5000 --name kind-registry registry:2
kind create cluster --name tiketi --config=k8s/kind-cluster.yaml
docker network connect kind kind-registry || true

# Ingress-NGINX
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# 네임스페이스
kubectl apply -f k8s/app/namespace.yaml
```

## 2. 이미지 빌드/적재
```bash
docker build -t localhost:5001/backend:dev ./backend
docker push localhost:5001/backend:dev
kind load docker-image localhost:5001/backend:dev --name tiketi
```

## 3. 애플리케이션 리소스
```bash
kubectl apply -f k8s/app/postgres.yaml
kubectl apply -f k8s/app/redis.yaml
kubectl apply -f k8s/app/backend.yaml
```
- `backend.yaml`/`postgres.yaml`의 시크릿 값(`change-me`)을 원하는 값으로 변경.

## 4. 관측(Helm)
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm upgrade --install kps prometheus-community/kube-prometheus-stack \
  -n observability --create-namespace \
  -f k8s/observability/values-kube-prometheus-stack.yaml

helm upgrade --install loki grafana/loki-stack \
  -n observability \
  -f k8s/observability/values-loki-stack.yaml

# 백엔드 메트릭 스크랩
kubectl apply -f k8s/observability/backend-servicemonitor.yaml
```
- Grafana 포트포워딩: `kubectl -n observability port-forward svc/kps-grafana 3000:80`.
- Prometheus 포트포워딩: `kubectl -n observability port-forward svc/kps-kube-prometheus 9090`.
- Loki 쿼리: Grafana에서 Loki 데이터소스 추가 (`http://loki-gateway.observability.svc:80`).

## 5. 확인
```bash
kubectl -n app get pods,svc,ingress
curl -H "Host: tiketi.local" http://127.0.0.1/health
curl -H "Host: tiketi.local" http://127.0.0.1/metrics
```

## 6. 롤링 업데이트
```bash
docker build -t localhost:5001/backend:dev ./backend
docker push localhost:5001/backend:dev
kind load docker-image localhost:5001/backend:dev --name tiketi
kubectl -n app rollout restart deploy/backend
```








