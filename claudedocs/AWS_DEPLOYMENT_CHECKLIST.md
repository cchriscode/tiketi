# AWS EKS 배포 체크리스트

현재 프로젝트는 **이미 AWS 프로덕션 환경을 고려해서** 개발되었습니다.
아래 체크리스트만 완료하면 바로 배포 가능합니다.

---

## ✅ 이미 완료된 부분 (코드 수정 불필요)

- [x] WebSocket Redis Adapter 구현 (멀티 Pod 지원)
- [x] Queue Processor 자동 실행
- [x] Redis AUTH 비밀번호 지원
- [x] Graceful Shutdown 구현
- [x] Health Check 엔드포인트
- [x] 모든 서비스 Dockerfile 작성
- [x] Kubernetes 매니페스트 (base)
- [x] 에러 핸들링 및 로깅

---

## 📋 배포 전 준비 사항

### 1. AWS 계정 및 도구 설치

- [ ] AWS 계정 생성
- [ ] AWS CLI 설치 및 설정
- [ ] kubectl 설치
- [ ] eksctl 설치
- [ ] Docker 설치 (이미지 빌드용)

**참고:** `AWS_EKS_DEPLOYMENT_GUIDE.md` 섹션 1-2

---

### 2. AWS 인프라 생성 (가이드 순서대로)

- [ ] VPC 및 서브넷 생성
- [ ] 보안 그룹 생성
- [ ] RDS PostgreSQL 생성
- [ ] ElastiCache Redis 생성
- [ ] ECR 리포지토리 생성 (5개)
- [ ] EKS 클러스터 생성
- [ ] EKS Node Group 생성

**예상 소요 시간:** 1-2시간
**참고:** `AWS_EKS_DEPLOYMENT_GUIDE.md` 섹션 3-8

---

### 3. 환경 설정

#### 3.1 Production ConfigMap 업데이트

파일: `k8s/overlays/production/config.env`

필수 변경 사항:
```env
# RDS 엔드포인트 (AWS 콘솔에서 복사)
DB_HOST=tiketi-db.xxxxxx.ap-northeast-2.rds.amazonaws.com

# ElastiCache 엔드포인트 (AWS 콘솔에서 복사)
REDIS_HOST=tiketi-redis.xxxxxx.clustercfg.apne2.cache.amazonaws.com

# 도메인 설정 (Route53에서 설정한 도메인)
SOCKET_IO_CORS_ORIGIN=https://tiketi.com
REACT_APP_API_URL=https://api.tiketi.com
REACT_APP_SOCKET_URL=https://api.tiketi.com

# S3 버킷
AWS_S3_BUCKET=tiketi-uploads-prod

# Google OAuth
GOOGLE_CLIENT_ID=<실제-클라이언트-ID>
REACT_APP_GOOGLE_CLIENT_ID=<실제-클라이언트-ID>
```

#### 3.2 Kubernetes Secrets 생성

```bash
# JWT Secret (64자 이상)
kubectl create secret generic tiketi-jwt-secret \
  --from-literal=JWT_SECRET='$(openssl rand -base64 64)' \
  -n tiketi

# DB Password (RDS 생성 시 설정한 비밀번호)
kubectl create secret generic tiketi-db-secret \
  --from-literal=POSTGRES_PASSWORD='<RDS-마스터-암호>' \
  --from-literal=DB_PASSWORD='<RDS-마스터-암호>' \
  -n tiketi

# Redis Password (ElastiCache AUTH 토큰)
kubectl create secret generic tiketi-redis-secret \
  --from-literal=REDIS_PASSWORD='<Redis-AUTH-토큰>' \
  -n tiketi

# Internal API Token (서비스 간 통신)
kubectl create secret generic tiketi-internal-secret \
  --from-literal=INTERNAL_API_TOKEN='$(openssl rand -base64 32)' \
  -n tiketi

# AWS S3 자격 증명
kubectl create secret generic tiketi-aws-secret \
  --from-literal=AWS_ACCESS_KEY_ID='<IAM-액세스-키>' \
  --from-literal=AWS_SECRET_ACCESS_KEY='<IAM-시크릿-키>' \
  -n tiketi
```

**체크리스트:**
- [ ] JWT_SECRET 생성
- [ ] DB_PASSWORD 설정
- [ ] REDIS_PASSWORD 설정
- [ ] INTERNAL_API_TOKEN 생성
- [ ] AWS 자격 증명 설정

#### 3.3 Kustomization 이미지 업데이트

파일: `k8s/overlays/production/kustomization.yaml`

`<AWS-ACCOUNT-ID>`를 실제 계정 ID로 변경:

```bash
# 계정 ID 확인
aws sts get-caller-identity --query Account --output text
```

예시: `123456789012`

---

### 4. Docker 이미지 빌드 및 푸시

#### 4.1 ECR 로그인

```bash
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  <AWS-ACCOUNT-ID>.dkr.ecr.ap-northeast-2.amazonaws.com
```

#### 4.2 이미지 빌드 및 푸시

```bash
# 프로젝트 루트에서 실행
# Windows
.\build-and-push-ecr.ps1

# macOS/Linux
./build-and-push-ecr.sh
```

**체크리스트:**
- [ ] backend 이미지 푸시
- [ ] auth-service 이미지 푸시
- [ ] ticket-service 이미지 푸시
- [ ] payment-service 이미지 푸시
- [ ] stats-service 이미지 푸시

---

### 5. 데이터베이스 초기화

```bash
# PostgreSQL 클라이언트 Pod 실행
kubectl run psql-client --rm -i --tty --image postgres:15 -n tiketi -- bash

# Pod 안에서:
psql -h <RDS-엔드포인트> -U tiketi_admin -d tiketi

# 스키마 생성
\i database/init.sql
\i database/migrations/*.sql
```

**체크리스트:**
- [ ] auth_schema 생성
- [ ] ticket_schema 생성
- [ ] payment_schema 생성
- [ ] stats_schema 생성
- [ ] 초기 데이터 삽입

---

### 6. Kubernetes 리소스 배포

```bash
# ConfigMap 생성
kubectl create configmap tiketi-config \
  --from-env-file=k8s/overlays/production/config.env \
  -n tiketi

# Kustomize로 전체 배포
kubectl apply -k k8s/overlays/production

# 배포 확인
kubectl get pods -n tiketi
kubectl get svc -n tiketi
```

**체크리스트:**
- [ ] ConfigMap 생성
- [ ] 모든 Deployment 실행 중
- [ ] 모든 Service 생성됨
- [ ] Pod 상태 모두 Running

---

### 7. Load Balancer 및 Ingress 설정

#### 7.1 AWS Load Balancer Controller 설치

```bash
# IAM 정책 생성
curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.6.2/docs/install/iam_policy.json

aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam-policy.json

# Service Account 생성
eksctl create iamserviceaccount \
  --cluster=tiketi-production \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::<AWS-ACCOUNT-ID>:policy/AWSLoadBalancerControllerIAMPolicy \
  --override-existing-serviceaccounts \
  --approve

# Helm으로 Controller 설치
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=tiketi-production \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

#### 7.2 Ingress 배포

```bash
kubectl apply -f k8s/overlays/production/ingress.yaml

# ALB 생성 확인 (3-5분 소요)
kubectl get ingress -n tiketi -w
```

**체크리스트:**
- [ ] Load Balancer Controller 설치
- [ ] Ingress 배포
- [ ] ALB 생성 확인
- [ ] ALB DNS 이름 확인

---

### 8. 프론트엔드 배포 (S3 + CloudFront)

#### 8.1 S3 버킷 생성

```bash
aws s3 mb s3://tiketi-frontend-prod --region ap-northeast-2
```

#### 8.2 프론트엔드 빌드

```bash
cd frontend

# .env.production 파일 생성
cat > .env.production <<EOF
REACT_APP_API_URL=https://api.tiketi.com
REACT_APP_SOCKET_URL=https://api.tiketi.com
REACT_APP_GOOGLE_CLIENT_ID=<your-google-client-id>
EOF

# 빌드
npm install
npm run build

# S3에 업로드
aws s3 sync build/ s3://tiketi-frontend-prod/ --delete
```

#### 8.3 CloudFront 배포 생성

AWS 콘솔에서 CloudFront 배포 생성 (가이드 섹션 12 참조)

**체크리스트:**
- [ ] S3 버킷 생성
- [ ] 프론트엔드 빌드
- [ ] S3에 업로드
- [ ] CloudFront 배포 생성
- [ ] CloudFront 도메인 확인

---

### 9. 도메인 및 SSL 설정

#### 9.1 Certificate Manager (ACM)

```bash
# us-east-1에서 인증서 생성 (CloudFront용)
aws acm request-certificate \
  --domain-name tiketi.com \
  --subject-alternative-names *.tiketi.com \
  --validation-method DNS \
  --region us-east-1

# ap-northeast-2에서 인증서 생성 (ALB용)
aws acm request-certificate \
  --domain-name api.tiketi.com \
  --validation-method DNS \
  --region ap-northeast-2
```

#### 9.2 Route53 레코드 생성

- A 레코드: `tiketi.com` → CloudFront
- A 레코드: `www.tiketi.com` → CloudFront
- A 레코드: `api.tiketi.com` → ALB

**체크리스트:**
- [ ] SSL 인증서 생성 (CloudFront)
- [ ] SSL 인증서 생성 (ALB)
- [ ] DNS 검증 완료
- [ ] Route53 레코드 생성
- [ ] DNS 전파 확인

---

### 10. 모니터링 설정

```bash
# Container Insights 활성화
aws eks update-cluster-config \
    --region ap-northeast-2 \
    --name tiketi-production \
    --logging '{"clusterLogging":[{"types":["api","audit","authenticator","controllerManager","scheduler"],"enabled":true}]}'

# CloudWatch 대시보드 생성 (AWS 콘솔)
```

**체크리스트:**
- [ ] Container Insights 활성화
- [ ] CloudWatch 대시보드 생성
- [ ] RDS 모니터링 활성화
- [ ] ElastiCache 모니터링 활성화
- [ ] CloudWatch 알람 설정

---

## 🧪 배포 후 테스트

### 기능 테스트

```bash
# 1. Health Check
curl https://api.tiketi.com/health
curl https://api.tiketi.com/api/auth/health

# 2. 프론트엔드 접속
# https://tiketi.com

# 3. 로그인 테스트
# - 일반 로그인
# - Google OAuth 로그인

# 4. 대기열 테스트
# - QUEUE_THRESHOLD=1000이므로 실제 사용자로는 테스트 어려움
# - 부하 테스트 스크립트로 확인:
node scripts/queue-load-test.js --apiUrl https://api.tiketi.com --users 50

# 5. WebSocket 테스트
# - 브라우저 개발자 도구 → 네트워크 → WS
# - 연결 상태 확인
```

**체크리스트:**
- [ ] API Health Check 통과
- [ ] 프론트엔드 로딩
- [ ] 로그인 작동
- [ ] Google OAuth 작동
- [ ] 이벤트 목록 표시
- [ ] 티켓 예매 가능
- [ ] WebSocket 연결 안정
- [ ] 대기열 시스템 작동

---

## 🚨 트러블슈팅

### Pod 시작 실패

```bash
# 로그 확인
kubectl logs <pod-name> -n tiketi

# 이벤트 확인
kubectl describe pod <pod-name> -n tiketi

# 일반 원인:
# - Secret/ConfigMap 없음 → 위 섹션 3.2 확인
# - 이미지 Pull 실패 → ECR 권한 확인
# - 리소스 부족 → kubectl top nodes
```

### RDS 연결 실패

```bash
# 보안 그룹 확인
# - RDS SG가 EKS 노드 서브넷(10.0.11.0/24, 10.0.12.0/24) 허용하는지 확인

# 연결 테스트
kubectl run test-db --rm -i --tty --image postgres:15 -n tiketi -- bash
psql -h <RDS-endpoint> -U tiketi_admin -d tiketi
```

### WebSocket 연결 실패

```bash
# 1. ALB Listener 확인 (80, 443 열려있는지)
# 2. Ingress 확인
kubectl describe ingress tiketi-ingress -n tiketi

# 3. Backend 로그 확인
kubectl logs deployment/backend -n tiketi | grep Socket
```

---

## 📊 예상 비용

**월 $350-400** (프로덕션 환경)

- EKS 클러스터: $72
- EKS 노드 (t3.medium x2): $60
- RDS (db.t3.medium, Multi-AZ): $130
- ElastiCache (cache.t3.micro): $25
- ALB: $22
- CloudFront: $1-5
- Route53: $0.5
- S3: $1-5
- 데이터 전송: $50

**비용 절감 팁:**
- Reserved Instances 구매 (최대 75% 할인)
- Savings Plans
- Auto Scaling 활용
- 개발 환경은 업무 외 시간 정지

---

## 📚 참고 문서

- `AWS_EKS_DEPLOYMENT_GUIDE.md` - 상세 배포 가이드
- `QUEUE_LOAD_TEST_GUIDE.md` - 대기열 테스트 방법
- `MSA_SYSTEM_SPEC.md` - 시스템 아키텍처

---

**작성일:** 2026-01-06
**최종 업데이트:** 2026-01-06
