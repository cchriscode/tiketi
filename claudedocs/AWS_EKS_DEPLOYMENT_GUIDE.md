# Tiketi AWS EKS 배포 완벽 가이드

**대상:** AWS 초보자도 따라할 수 있는 단계별 가이드
**목표:** Tiketi MSA 시스템을 AWS EKS에 프로비저닝
**예상 소요 시간:** 2-3시간
**예상 비용:** 월 $200-300 (프리티어 제외 시)

---

## 📋 목차

1. [사전 준비](#1-사전-준비)
2. [AWS 계정 및 IAM 설정](#2-aws-계정-및-iam-설정)
3. [VPC 및 네트워크 구성](#3-vpc-및-네트워크-구성)
4. [RDS PostgreSQL 생성](#4-rds-postgresql-생성)
5. [ElastiCache Redis 생성](#5-elasticache-redis-생성)
6. [ECR 레지스트리 생성](#6-ecr-레지스트리-생성)
7. [EKS 클러스터 생성](#7-eks-클러스터-생성)
8. [EKS Node Group 생성](#8-eks-node-group-생성)
9. [Docker 이미지 빌드 및 ECR 푸시](#9-docker-이미지-빌드-및-ecr-푸시)
10. [Kubernetes 리소스 배포](#10-kubernetes-리소스-배포)
11. [Application Load Balancer 설정](#11-application-load-balancer-설정)
12. [S3 + CloudFront 프론트엔드 배포](#12-s3--cloudfront-프론트엔드-배포)
13. [Route53 도메인 설정](#13-route53-도메인-설정)
14. [모니터링 설정 (CloudWatch)](#14-모니터링-설정-cloudwatch)
15. [보안 설정 (WAF, Certificate Manager)](#15-보안-설정-waf-certificate-manager)

---

## 1. 사전 준비

### 1.1 필요한 도구 설치

#### Windows (PowerShell)

```powershell
# AWS CLI 설치
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi

# kubectl 설치
curl.exe -LO "https://dl.k8s.io/release/v1.28.0/bin/windows/amd64/kubectl.exe"
Move-Item .\kubectl.exe C:\Windows\System32\

# eksctl 설치
choco install eksctl
# 또는 수동 다운로드: https://github.com/weaveworks/eksctl/releases

# Docker Desktop 설치 (이미 설치되어 있으면 생략)
# https://www.docker.com/products/docker-desktop/
```

#### macOS

```bash
# Homebrew 사용
brew install awscli kubectl eksctl
```

### 1.2 설치 확인

```bash
aws --version        # AWS CLI 2.x
kubectl version --client
eksctl version
docker --version
```

### 1.3 프로젝트 정보

**리전:** ap-northeast-2 (서울)
**클러스터 이름:** tiketi-production
**VPC CIDR:** 10.0.0.0/16

---

## 2. AWS 계정 및 IAM 설정

### 2.1 AWS 계정 생성

1. https://aws.amazon.com/ko/ 접속
2. 우측 상단 **"AWS 계정 생성"** 클릭
3. 이메일, 비밀번호, 계정 이름 입력
4. 연락처 정보 입력
5. 결제 정보 입력 (신용카드/체크카드)
6. 신원 확인 (전화 또는 SMS)
7. 지원 플랜 선택 (기본: 무료 플랜)

### 2.2 루트 사용자 MFA 설정 (보안 필수)

1. AWS 콘솔 로그인: https://console.aws.amazon.com/
2. 우측 상단 계정명 클릭 → **"보안 자격 증명"**
3. **"멀티 팩터 인증(MFA)"** 섹션
4. **"MFA 활성화"** 클릭
5. "가상 MFA 디바이스" 선택
6. Google Authenticator 또는 Authy 앱으로 QR 코드 스캔
7. 연속된 2개의 MFA 코드 입력

### 2.3 IAM 사용자 생성 (운영용)

1. AWS 콘솔 → **"IAM"** 검색 → IAM 대시보드
2. 좌측 메뉴 **"사용자"** → **"사용자 추가"**
3. 사용자 이름: `tiketi-admin`
4. **"AWS 자격 증명 유형 선택"**
   - ✅ 액세스 키 - 프로그래밍 방식 액세스
   - ✅ 암호 - AWS Management Console 액세스
5. **"다음: 권한"** 클릭
6. **"기존 정책 직접 연결"** 선택
7. 다음 정책 검색 후 체크:
   - `AdministratorAccess` (전체 권한, 개발용)
   - 또는 최소 권한:
     - `AmazonEKSClusterPolicy`
     - `AmazonEKSWorkerNodePolicy`
     - `AmazonEC2ContainerRegistryFullAccess`
     - `AmazonVPCFullAccess`
     - `AmazonRDSFullAccess`
     - `AmazonElastiCacheFullAccess`
     - `CloudWatchFullAccess`
8. **"다음: 태그"** (생략 가능)
9. **"다음: 검토"** → **"사용자 만들기"**
10. **중요:** 액세스 키 ID와 비밀 액세스 키를 **안전하게 저장**

### 2.4 AWS CLI 설정

```bash
aws configure

# 입력 정보:
AWS Access Key ID [None]: <액세스 키 ID>
AWS Secret Access Key [None]: <비밀 액세스 키>
Default region name [None]: ap-northeast-2
Default output format [None]: json
```

### 2.5 설정 확인

```bash
aws sts get-caller-identity

# 출력 예시:
# {
#     "UserId": "AIDAXXXXXXXXX",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/tiketi-admin"
# }
```

---

## 3. VPC 및 네트워크 구성

### 3.1 VPC 생성 (AWS 콘솔)

1. AWS 콘솔 → **"VPC"** 검색
2. 좌측 메뉴 **"VPC"** → **"VPC 생성"**
3. **"VPC 등 생성"** 선택 (VPC, 서브넷, 라우팅 테이블 자동 생성)

**설정값:**
```
VPC 설정:
  - 생성할 리소스: VPC 등
  - 이름 태그: tiketi-vpc
  - IPv4 CIDR 블록: 10.0.0.0/16
  - IPv6 CIDR 블록: IPv6 CIDR 블록 없음
  - 테넌시: 기본값

가용 영역(AZ) 수: 2
  - ap-northeast-2a
  - ap-northeast-2c

퍼블릭 서브넷 수: 2
  - 퍼블릭 서브넷 A CIDR: 10.0.1.0/24
  - 퍼블릭 서브넷 B CIDR: 10.0.2.0/24

프라이빗 서브넷 수: 4
  - 프라이빗 서브넷 A1 CIDR: 10.0.11.0/24 (EKS 노드용)
  - 프라이빗 서브넷 A2 CIDR: 10.0.21.0/24 (DB용)
  - 프라이빗 서브넷 B1 CIDR: 10.0.12.0/24 (EKS 노드용)
  - 프라이빗 서브넷 B2 CIDR: 10.0.22.0/24 (DB용)

NAT 게이트웨이: 1개 AZ당 1개 (고가용성)
VPC 엔드포인트: S3 Gateway (비용 절감)

DNS 옵션:
  - ✅ DNS 호스트 이름 활성화
  - ✅ DNS 확인 활성화
```

4. **"VPC 생성"** 클릭 (생성 시간: 약 5분)

### 3.2 서브넷 태그 설정 (EKS 필수)

EKS가 서브넷을 인식하려면 태그가 필요합니다.

#### 퍼블릭 서브넷 태그

1. VPC → **"서브넷"**
2. 퍼블릭 서브넷 A (10.0.1.0/24) 선택
3. **"태그"** 탭 → **"태그 관리"**
4. **"태그 추가"** 클릭
5. 다음 태그 추가:

```
키: kubernetes.io/role/elb
값: 1

키: kubernetes.io/cluster/tiketi-production
값: shared
```

6. 퍼블릭 서브넷 B (10.0.2.0/24)에도 동일하게 적용

#### 프라이빗 서브넷 태그 (EKS 노드용)

1. 프라이빗 서브넷 A1 (10.0.11.0/24) 선택
2. 다음 태그 추가:

```
키: kubernetes.io/role/internal-elb
값: 1

키: kubernetes.io/cluster/tiketi-production
값: shared

키: Name
값: tiketi-private-subnet-a1-eks
```

3. 프라이빗 서브넷 B1 (10.0.12.0/24)에도 동일하게 적용

#### DB 서브넷 태그

1. 프라이빗 서브넷 A2 (10.0.21.0/24) 선택
2. 태그:

```
키: Name
값: tiketi-db-subnet-a
```

3. 프라이빗 서브넷 B2 (10.0.22.0/24)에도 적용 (이름: tiketi-db-subnet-b)

### 3.3 보안 그룹 생성

#### EKS 클러스터 보안 그룹

1. VPC → **"보안 그룹"** → **"보안 그룹 생성"**

```
보안 그룹 이름: tiketi-eks-cluster-sg
설명: EKS cluster security group
VPC: tiketi-vpc

인바운드 규칙:
  - 유형: HTTPS, 포트: 443, 소스: 10.0.0.0/16 (VPC 내부)

아웃바운드 규칙:
  - 유형: 모든 트래픽, 대상: 0.0.0.0/0
```

#### RDS 보안 그룹

```
보안 그룹 이름: tiketi-rds-sg
설명: RDS PostgreSQL security group
VPC: tiketi-vpc

인바운드 규칙:
  - 유형: PostgreSQL, 포트: 5432, 소스: tiketi-eks-cluster-sg
  - 유형: PostgreSQL, 포트: 5432, 소스: 10.0.11.0/24 (EKS 노드 서브넷 A)
  - 유형: PostgreSQL, 포트: 5432, 소스: 10.0.12.0/24 (EKS 노드 서브넷 B)

아웃바운드 규칙:
  - 유형: 모든 트래픽, 대상: 0.0.0.0/0
```

#### ElastiCache 보안 그룹

```
보안 그룹 이름: tiketi-redis-sg
설명: ElastiCache Redis security group
VPC: tiketi-vpc

인바운드 규칙:
  - 유형: 사용자 지정 TCP, 포트: 6379, 소스: tiketi-eks-cluster-sg
  - 유형: 사용자 지정 TCP, 포트: 6379, 소스: 10.0.11.0/24
  - 유형: 사용자 지정 TCP, 포트: 6379, 소스: 10.0.12.0/24

아웃바운드 규칙:
  - 유형: 모든 트래픽, 대상: 0.0.0.0/0
```

---

## 4. RDS PostgreSQL 생성

### 4.1 DB 서브넷 그룹 생성

1. AWS 콘솔 → **"RDS"** 검색
2. 좌측 메뉴 **"서브넷 그룹"** → **"DB 서브넷 그룹 생성"**

```
이름: tiketi-db-subnet-group
설명: Tiketi DB subnet group
VPC: tiketi-vpc

가용 영역: ap-northeast-2a, ap-northeast-2c

서브넷:
  - 10.0.21.0/24 (tiketi-db-subnet-a)
  - 10.0.22.0/24 (tiketi-db-subnet-b)
```

3. **"생성"** 클릭

### 4.2 RDS PostgreSQL 인스턴스 생성

1. RDS → **"데이터베이스"** → **"데이터베이스 생성"**

```
데이터베이스 생성 방식: 표준 생성

엔진 옵션:
  - 엔진 유형: PostgreSQL
  - 에디션: PostgreSQL
  - 버전: PostgreSQL 15.4-R2 (최신 안정 버전)

템플릿: 프로덕션

가용성 및 내구성:
  - ✅ 다중 AZ DB 인스턴스 (고가용성)

설정:
  - DB 인스턴스 식별자: tiketi-db
  - 마스터 사용자 이름: tiketi_admin
  - 마스터 암호: <강력한 암호 생성> (최소 16자, 특수문자 포함)
  - 암호 확인: <동일하게 입력>

인스턴스 구성:
  - DB 인스턴스 클래스: 버스트 가능 클래스 (t 클래스 포함)
  - db.t3.medium (2 vCPU, 4 GiB RAM) - 개발/테스트용
  - 또는 db.r6g.large (2 vCPU, 16 GiB RAM) - 프로덕션 권장

스토리지:
  - 스토리지 유형: 범용 SSD (gp3)
  - 할당된 스토리지: 100 GiB
  - 스토리지 자동 조정: ✅ 활성화
  - 최대 스토리지 임계값: 1000 GiB

연결:
  - 컴퓨팅 리소스: EC2 컴퓨팅 리소스에 연결 안 함
  - VPC: tiketi-vpc
  - DB 서브넷 그룹: tiketi-db-subnet-group
  - 퍼블릭 액세스: 아니요 (보안상 중요!)
  - VPC 보안 그룹: tiketi-rds-sg
  - 가용 영역: 기본 설정 없음 (자동)
  - 포트: 5432

데이터베이스 인증:
  - 암호 인증

모니터링:
  - ✅ 향상된 모니터링 활성화
  - 세분성: 60초

추가 구성:
  - 초기 데이터베이스 이름: tiketi
  - DB 파라미터 그룹: default.postgres15
  - 옵션 그룹: default:postgres-15
  - 백업:
    - ✅ 자동 백업 활성화
    - 백업 보존 기간: 7일
    - 백업 기간: 03:00-04:00 (KST 기준 새벽)
  - 암호화:
    - ✅ 저장 시 암호화 활성화
  - 로그 내보내기:
    - ✅ PostgreSQL 로그
  - 유지 관리:
    - 자동 마이너 버전 업그레이드: ✅ 활성화
  - 삭제 방지:
    - ✅ 삭제 방지 활성화 (프로덕션 필수)
```

2. **"데이터베이스 생성"** 클릭 (생성 시간: 약 10-15분)

### 4.3 RDS 엔드포인트 확인

1. RDS → **"데이터베이스"** → `tiketi-db` 클릭
2. **"연결 & 보안"** 탭
3. **엔드포인트** 복사 (예: `tiketi-db.xxxxxx.ap-northeast-2.rds.amazonaws.com`)
4. 나중에 사용하기 위해 저장

---

## 5. ElastiCache Redis 생성

### 5.1 서브넷 그룹 생성

1. AWS 콘솔 → **"ElastiCache"** 검색
2. 좌측 메뉴 **"서브넷 그룹"** → **"서브넷 그룹 생성"**

```
이름: tiketi-redis-subnet-group
설명: Tiketi Redis subnet group
VPC: tiketi-vpc

가용 영역 및 서브넷:
  - ap-northeast-2a: 10.0.21.0/24
  - ap-northeast-2c: 10.0.22.0/24
```

3. **"생성"** 클릭

### 5.2 Redis 클러스터 생성

1. ElastiCache → **"Redis 클러스터"** → **"Redis 클러스터 생성"**

```
클러스터 생성 방법: 클러스터 설정 및 생성

클러스터 모드: ❌ 비활성화됨 (단순 구성)

클러스터 정보:
  - 이름: tiketi-redis
  - 설명: Tiketi Redis cache

위치:
  - AWS 클라우드

다중 AZ: ✅ 활성화 (고가용성)

엔진 버전: 7.0 (최신 안정 버전)

포트: 6379

파라미터 그룹: default.redis7

노드 유형:
  - cache.t3.micro (0.5 GiB) - 개발/테스트용
  - 또는 cache.r6g.large (13.07 GiB) - 프로덕션 권장

복제본 수: 1 (고가용성을 위한 Standby)

서브넷 그룹: tiketi-redis-subnet-group

가용 영역 배치: 기본 설정 없음

보안:
  - 전송 중 암호화: ✅ 활성화
  - 저장 시 암호화: ✅ 활성화
  - AUTH 토큰: 활성화
    - AUTH 토큰: <강력한 토큰 생성, 최소 16자>

보안 그룹: tiketi-redis-sg

백업:
  - ✅ 자동 백업 활성화
  - 백업 보존 기간: 1일
  - 백업 기간: 03:00-04:00

유지 관리:
  - 유지 관리 기간: 일요일 04:00-05:00

로그:
  - ✅ 느린 로그
  - ✅ 엔진 로그
  - 로그 형식: JSON
  - 로그 대상: CloudWatch Logs
```

2. **"생성"** 클릭 (생성 시간: 약 10분)

### 5.3 Redis 엔드포인트 확인

1. ElastiCache → **"Redis 클러스터"** → `tiketi-redis` 클릭
2. **"기본 엔드포인트"** 복사 (예: `tiketi-redis.xxxxxx.clustercfg.apne2.cache.amazonaws.com:6379`)
3. AUTH 토큰도 안전하게 저장

---

## 6. ECR 레지스트리 생성

### 6.1 ECR 리포지토리 생성

각 마이크로서비스마다 개별 리포지토리를 생성합니다.

1. AWS 콘솔 → **"ECR"** 검색
2. **"프라이빗 리포지토리 생성"** 클릭

**생성할 리포지토리 목록:**

```
1. tiketi/backend
2. tiketi/auth-service
3. tiketi/ticket-service
4. tiketi/payment-service
5. tiketi/stats-service
```

**각 리포지토리 설정:**

```
일반 설정:
  - 표시 여부: 프라이빗
  - 리포지토리 이름: tiketi/backend (각각 변경)
  - 태그 변경 불가능성: ❌ 비활성화됨

이미지 스캔 설정:
  - ✅ 푸시 시 스캔

암호화 설정:
  - 암호화 유형: AES-256
```

3. 총 5개 리포지토리 생성

### 6.2 리포지토리 URI 확인

1. ECR → **"리포지토리"**
2. 각 리포지토리의 **URI** 복사

예시:
```
123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/backend
123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/auth-service
123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/ticket-service
123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/payment-service
123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/stats-service
```

---

## 7. EKS 클러스터 생성

### 7.1 EKS 클러스터 IAM 역할 생성

1. AWS 콘솔 → **"IAM"** → **"역할"** → **"역할 만들기"**

```
신뢰할 수 있는 엔터티 유형: AWS 서비스
사용 사례: EKS - Cluster

권한 정책 (자동 선택됨):
  - AmazonEKSClusterPolicy

역할 이름: tiketi-eks-cluster-role
```

2. **"역할 만들기"** 클릭

### 7.2 EKS 클러스터 생성 (eksctl 사용 - 권장)

#### 클러스터 설정 파일 생성

프로젝트 루트에 `eks-cluster-config.yaml` 파일 생성:

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: tiketi-production
  region: ap-northeast-2
  version: "1.28"

vpc:
  id: vpc-xxxxxxxxx  # VPC ID 입력 (VPC 콘솔에서 확인)
  subnets:
    private:
      ap-northeast-2a:
        id: subnet-xxxxxxxxx  # 10.0.11.0/24 서브넷 ID
      ap-northeast-2c:
        id: subnet-yyyyyyyyy  # 10.0.12.0/24 서브넷 ID
    public:
      ap-northeast-2a:
        id: subnet-aaaaaaaaa  # 10.0.1.0/24 서브넷 ID
      ap-northeast-2c:
        id: subnet-bbbbbbbbb  # 10.0.2.0/24 서브넷 ID

# IAM OIDC Provider (필수 - ALB Ingress Controller용)
iam:
  withOIDC: true

# CloudWatch 로깅 활성화
cloudWatch:
  clusterLogging:
    enableTypes:
      - api
      - audit
      - authenticator
      - controllerManager
      - scheduler

# 추가 기능
addons:
  - name: vpc-cni
  - name: coredns
  - name: kube-proxy

# 태그
tags:
  Environment: production
  Project: tiketi
```

#### VPC/서브넷 ID 확인 및 설정 파일 업데이트

```bash
# VPC ID 확인
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=tiketi-vpc" --query "Vpcs[0].VpcId" --output text

# 서브넷 ID 확인
aws ec2 describe-subnets --filters "Name=vpc-id,Values=<VPC-ID>" --query "Subnets[*].[SubnetId,CidrBlock,AvailabilityZone,Tags[?Key=='Name'].Value|[0]]" --output table
```

위에서 확인한 ID들을 `eks-cluster-config.yaml`에 입력합니다.

#### 클러스터 생성

```bash
# 클러스터 생성 (약 15-20분 소요)
eksctl create cluster -f eks-cluster-config.yaml

# 진행 상황 확인
# 완료되면 kubeconfig 자동 업데이트됨
```

### 7.3 클러스터 확인

```bash
# 클러스터 정보 확인
kubectl cluster-info

# 노드 확인 (아직 없음)
kubectl get nodes

# 네임스페이스 생성
kubectl create namespace tiketi
```

---

## 8. EKS Node Group 생성

### 8.1 Node IAM 역할 생성

1. IAM → **"역할"** → **"역할 만들기"**

```
신뢰할 수 있는 엔터티 유형: AWS 서비스
사용 사례: EC2

권한 정책:
  - AmazonEKSWorkerNodePolicy
  - AmazonEC2ContainerRegistryReadOnly
  - AmazonEKS_CNI_Policy

역할 이름: tiketi-eks-node-role
```

### 8.2 Node Group 생성 (eksctl)

```bash
# Node Group 설정 파일 (nodegroup-config.yaml)
cat > nodegroup-config.yaml <<EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: tiketi-production
  region: ap-northeast-2

managedNodeGroups:
  - name: tiketi-nodes
    instanceType: t3.medium
    desiredCapacity: 2
    minSize: 2
    maxSize: 4
    volumeSize: 30
    volumeType: gp3
    privateNetworking: true
    subnets:
      - subnet-xxxxxxxxx  # 10.0.11.0/24
      - subnet-yyyyyyyyy  # 10.0.12.0/24
    labels:
      role: worker
      environment: production
    tags:
      Environment: production
      Project: tiketi
    iam:
      withAddonPolicies:
        imageBuilder: true
        autoScaler: true
        externalDNS: true
        certManager: true
        appMesh: false
        ebs: true
        fsx: false
        efs: false
        albIngress: true
        cloudWatch: true
EOF

# Node Group 생성 (약 5-10분)
eksctl create nodegroup -f nodegroup-config.yaml
```

### 8.3 Node 확인

```bash
# 노드 확인
kubectl get nodes -o wide

# 출력 예시:
# NAME                                               STATUS   ROLES    AGE     VERSION
# ip-10-0-11-123.ap-northeast-2.compute.internal   Ready    <none>   5m      v1.28.x
# ip-10-0-12-234.ap-northeast-2.compute.internal   Ready    <none>   5m      v1.28.x
```

---

## 9. Docker 이미지 빌드 및 ECR 푸시

### 9.1 ECR 로그인

```bash
# ECR 로그인 (AWS CLI v2)
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin <계정ID>.dkr.ecr.ap-northeast-2.amazonaws.com

# 예시:
# aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com
```

### 9.2 환경변수 설정

```bash
# Windows PowerShell
$AWS_ACCOUNT_ID = "123456789012"  # 실제 계정 ID
$AWS_REGION = "ap-northeast-2"
$ECR_REGISTRY = "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# macOS/Linux
export AWS_ACCOUNT_ID="123456789012"
export AWS_REGION="ap-northeast-2"
export ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
```

### 9.3 이미지 빌드 스크립트

프로젝트 루트에 `build-and-push-ecr.sh` (또는 `.ps1`) 생성:

#### Windows (PowerShell)

```powershell
# build-and-push-ecr.ps1

$AWS_ACCOUNT_ID = "123456789012"  # 실제 계정 ID로 변경
$AWS_REGION = "ap-northeast-2"
$ECR_REGISTRY = "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# ECR 로그인
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

$services = @(
    @{name="backend"; path="./backend"},
    @{name="auth-service"; path="./services/auth-service"},
    @{name="ticket-service"; path="./services/ticket-service"},
    @{name="payment-service"; path="./services/payment-service"},
    @{name="stats-service"; path="./services/stats-service"}
)

foreach ($service in $services) {
    $name = $service.name
    $path = $service.path
    $image_name = "tiketi/$name"
    $image_tag = "v1.0.0"
    $full_image = "${ECR_REGISTRY}/${image_name}:${image_tag}"
    $latest_image = "${ECR_REGISTRY}/${image_name}:latest"

    Write-Host "Building $name..."
    docker build -t $image_name $path

    Write-Host "Tagging $name..."
    docker tag "${image_name}:latest" $full_image
    docker tag "${image_name}:latest" $latest_image

    Write-Host "Pushing $name to ECR..."
    docker push $full_image
    docker push $latest_image

    Write-Host "$name pushed successfully!"
}

Write-Host "All images pushed to ECR!"
```

#### macOS/Linux (Bash)

```bash
#!/bin/bash
# build-and-push-ecr.sh

AWS_ACCOUNT_ID="123456789012"  # 실제 계정 ID로 변경
AWS_REGION="ap-northeast-2"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# ECR 로그인
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

services=(
    "backend:./backend"
    "auth-service:./services/auth-service"
    "ticket-service:./services/ticket-service"
    "payment-service:./services/payment-service"
    "stats-service:./services/stats-service"
)

for service in "${services[@]}"; do
    IFS=':' read -r name path <<< "$service"
    image_name="tiketi/$name"
    image_tag="v1.0.0"
    full_image="${ECR_REGISTRY}/${image_name}:${image_tag}"
    latest_image="${ECR_REGISTRY}/${image_name}:latest"

    echo "Building $name..."
    docker build -t $image_name $path

    echo "Tagging $name..."
    docker tag "${image_name}:latest" $full_image
    docker tag "${image_name}:latest" $latest_image

    echo "Pushing $name to ECR..."
    docker push $full_image
    docker push $latest_image

    echo "$name pushed successfully!"
done

echo "All images pushed to ECR!"
```

### 9.4 스크립트 실행

```bash
# macOS/Linux
chmod +x build-and-push-ecr.sh
./build-and-push-ecr.sh

# Windows
.\build-and-push-ecr.ps1
```

### 9.5 ECR 이미지 확인

```bash
# CLI로 확인
aws ecr describe-images --repository-name tiketi/backend --region ap-northeast-2

# 또는 AWS 콘솔 → ECR → 각 리포지토리 확인
```

---

## 10. Kubernetes 리소스 배포

### 10.1 Kubernetes 설정 파일 준비

프로젝트에 `k8s/overlays/production/` 디렉토리 생성:

```bash
mkdir -p k8s/overlays/production
```

### 10.2 ConfigMap 생성 (production용)

`k8s/overlays/production/config.env`:

```env
NODE_ENV=production
DB_HOST=<RDS-엔드포인트>  # 예: tiketi-db.xxxxxx.ap-northeast-2.rds.amazonaws.com
DB_PORT=5432
DB_NAME=tiketi
DB_USER=tiketi_admin
POSTGRES_DB=tiketi
POSTGRES_USER=tiketi_admin
REDIS_HOST=<Redis-엔드포인트>  # 예: tiketi-redis.xxxxxx.clustercfg.apne2.cache.amazonaws.com
REDIS_PORT=6379
PORT=3001
SOCKET_IO_CORS_ORIGIN=https://<your-domain>.com
TZ=Asia/Seoul
REACT_APP_API_URL=https://api.<your-domain>.com
REACT_APP_SOCKET_URL=https://api.<your-domain>.com
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=tiketi-uploads-prod
LOKI_URL=http://loki-service:3100
QUEUE_THRESHOLD=1000
QUEUE_PROCESSOR_INTERVAL=10000
GOOGLE_CLIENT_ID=<your-google-client-id>
REACT_APP_GOOGLE_CLIENT_ID=<your-google-client-id>
```

### 10.3 Secrets 생성

**중요:** 민감한 정보는 Kubernetes Secret으로 관리

```bash
# DB 비밀번호 Secret 생성
kubectl create secret generic tiketi-db-secret \
  --from-literal=POSTGRES_PASSWORD='<RDS-마스터-암호>' \
  --from-literal=DB_PASSWORD='<RDS-마스터-암호>' \
  -n tiketi

# Redis AUTH 토큰 Secret 생성
kubectl create secret generic tiketi-redis-secret \
  --from-literal=REDIS_PASSWORD='<Redis-AUTH-토큰>' \
  -n tiketi

# JWT Secret 생성
kubectl create secret generic tiketi-jwt-secret \
  --from-literal=JWT_SECRET='<강력한-랜덤-문자열-64자-이상>' \
  -n tiketi

# AWS S3 자격 증명 (나중에 S3 설정 시)
kubectl create secret generic tiketi-aws-secret \
  --from-literal=AWS_ACCESS_KEY_ID='<IAM-사용자-액세스-키>' \
  --from-literal=AWS_SECRET_ACCESS_KEY='<IAM-사용자-시크릿-키>' \
  -n tiketi
```

### 10.4 Deployment 파일 생성

`k8s/overlays/production/backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: tiketi
  labels:
    app: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: <AWS-ACCOUNT-ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tiketi/backend:v1.0.0
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: tiketi-config
        - secretRef:
            name: tiketi-db-secret
        - secretRef:
            name: tiketi-redis-secret
        - secretRef:
            name: tiketi-jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: tiketi
spec:
  selector:
    app: backend
  ports:
  - protocol: TCP
    port: 3001
    targetPort: 3001
  type: ClusterIP
```

유사하게 다른 서비스들도 작성:
- `auth-service-deployment.yaml`
- `ticket-service-deployment.yaml`
- `payment-service-deployment.yaml`
- `stats-service-deployment.yaml`

### 10.5 리소스 배포

```bash
# ConfigMap 생성
kubectl create configmap tiketi-config --from-env-file=k8s/overlays/production/config.env -n tiketi

# Deployment 배포
kubectl apply -f k8s/overlays/production/backend-deployment.yaml
kubectl apply -f k8s/overlays/production/auth-service-deployment.yaml
kubectl apply -f k8s/overlays/production/ticket-service-deployment.yaml
kubectl apply -f k8s/overlays/production/payment-service-deployment.yaml
kubectl apply -f k8s/overlays/production/stats-service-deployment.yaml

# 배포 확인
kubectl get pods -n tiketi
kubectl get svc -n tiketi
```

### 10.6 데이터베이스 초기화

```bash
# PostgreSQL에 스키마 생성
kubectl run psql-client --rm -i --tty --image postgres:15 -n tiketi -- bash

# Pod 안에서:
psql -h <RDS-엔드포인트> -U tiketi_admin -d tiketi

# SQL 실행:
# database/init.sql 내용 실행
# database/migrations/*.sql 실행
```

---

## 11. Application Load Balancer 설정

### 11.1 AWS Load Balancer Controller 설치

#### IAM 정책 생성

```bash
# IAM 정책 다운로드
curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.6.2/docs/install/iam_policy.json

# IAM 정책 생성
aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam-policy.json
```

#### IAM 역할 및 서비스 계정 생성

```bash
# OIDC provider와 연결된 IAM 역할 생성
eksctl create iamserviceaccount \
  --cluster=tiketi-production \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::<AWS-ACCOUNT-ID>:policy/AWSLoadBalancerControllerIAMPolicy \
  --override-existing-serviceaccounts \
  --approve
```

#### Helm으로 Controller 설치

```bash
# Helm 설치 (없는 경우)
# Windows: choco install kubernetes-helm
# macOS: brew install helm

# EKS 차트 리포지토리 추가
helm repo add eks https://aws.github.io/eks-charts
helm repo update

# Load Balancer Controller 설치
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=tiketi-production \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=ap-northeast-2 \
  --set vpcId=<VPC-ID>

# 설치 확인
kubectl get deployment -n kube-system aws-load-balancer-controller
```

### 11.2 Ingress 리소스 생성

`k8s/overlays/production/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tiketi-ingress
  namespace: tiketi
  annotations:
    # ALB 설정
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'

    # Certificate Manager ARN (나중에 업데이트)
    # alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:<ACCOUNT>:certificate/<CERT-ID>

    # 헬스 체크
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '15'
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '2'

    # 그룹 설정
    alb.ingress.kubernetes.io/group.name: tiketi-alb

    # Subnets (Public Subnet IDs)
    alb.ingress.kubernetes.io/subnets: subnet-aaaaaaaaa,subnet-bbbbbbbbb

    # Security Groups
    alb.ingress.kubernetes.io/security-groups: <ALB-Security-Group-ID>

spec:
  ingressClassName: alb
  rules:
  - host: api.your-domain.com  # 실제 도메인으로 변경
    http:
      paths:
      - path: /api/auth
        pathType: Prefix
        backend:
          service:
            name: auth-service
            port:
              number: 3002
      - path: /api/tickets
        pathType: Prefix
        backend:
          service:
            name: ticket-service
            port:
              number: 3001
      - path: /api/payments
        pathType: Prefix
        backend:
          service:
            name: payment-service
            port:
              number: 3003
      - path: /api/stats
        pathType: Prefix
        backend:
          service:
            name: stats-service
            port:
              number: 3004
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 3001
```

### 11.3 ALB Security Group 생성

```bash
# VPC 콘솔 → 보안 그룹 → 보안 그룹 생성

이름: tiketi-alb-sg
VPC: tiketi-vpc

인바운드 규칙:
  - 유형: HTTP, 포트: 80, 소스: 0.0.0.0/0
  - 유형: HTTPS, 포트: 443, 소스: 0.0.0.0/0

아웃바운드 규칙:
  - 유형: 모든 트래픽, 대상: 0.0.0.0/0
```

Security Group ID를 복사하여 Ingress YAML의 `alb.ingress.kubernetes.io/security-groups`에 입력

### 11.4 Ingress 배포

```bash
kubectl apply -f k8s/overlays/production/ingress.yaml

# ALB 생성 확인 (약 3-5분 소요)
kubectl get ingress -n tiketi -w

# ALB DNS 확인
kubectl get ingress tiketi-ingress -n tiketi -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

---

## 12. S3 + CloudFront 프론트엔드 배포

### 12.1 S3 버킷 생성

1. AWS 콘솔 → **"S3"** 검색 → **"버킷 만들기"**

```
버킷 이름: tiketi-frontend-prod (전 세계 고유해야 함)
AWS 리전: ap-northeast-2

객체 소유권: ACL 비활성화됨 (권장)

퍼블릭 액세스 차단 설정:
  - ✅ 모든 퍼블릭 액세스 차단 (CloudFront를 통해서만 접근)

버킷 버전 관리: ❌ 비활성화

암호화:
  - ✅ Amazon S3 관리형 키를 사용한 서버 측 암호화(SSE-S3)

객체 잠금: ❌ 비활성화
```

2. **"버킷 만들기"** 클릭

### 12.2 프론트엔드 빌드

```bash
cd frontend

# 환경변수 설정 (.env.production)
cat > .env.production <<EOF
REACT_APP_API_URL=https://api.your-domain.com
REACT_APP_SOCKET_URL=https://api.your-domain.com
REACT_APP_GOOGLE_CLIENT_ID=<your-google-client-id>
EOF

# 빌드
npm install
npm run build

# build/ 디렉토리 생성 확인
```

### 12.3 S3에 업로드

```bash
# S3에 빌드 파일 업로드
aws s3 sync build/ s3://tiketi-frontend-prod/ --delete

# 업로드 확인
aws s3 ls s3://tiketi-frontend-prod/
```

### 12.4 CloudFront 배포 생성

1. AWS 콘솔 → **"CloudFront"** 검색 → **"배포 생성"**

```
원본 도메인: tiketi-frontend-prod.s3.ap-northeast-2.amazonaws.com (S3 버킷)

원본 액세스:
  - 원본 액세스 제어 설정 (권장)
  - 제어 설정 생성:
    - 이름: tiketi-frontend-oac
    - 서명 동작: 요청에 서명
    - 서명 버전: 서명 버전 4

기본 캐시 동작:
  - 뷰어 프로토콜 정책: Redirect HTTP to HTTPS
  - 허용된 HTTP 메서드: GET, HEAD
  - 캐시 키 및 원본 요청:
    - 캐시 정책: CachingOptimized
    - 원본 요청 정책: CORS-S3Origin

웹 애플리케이션 방화벽(WAF):
  - ❌ 보안 보호를 활성화하지 않음 (또는 나중에 설정)

설정:
  - 가격 분류: 모든 엣지 로케이션 사용 (최상의 성능)
  - 대체 도메인 이름(CNAME): www.your-domain.com, your-domain.com
  - 사용자 정의 SSL 인증서: <Certificate Manager에서 생성한 인증서 선택>
  - 지원되는 HTTP 버전: HTTP/2
  - 기본 루트 객체: index.html
  - 로깅: ✅ 활성화 (선택 사항)
```

2. **"배포 생성"** 클릭 (배포 시간: 약 10-15분)

### 12.5 S3 버킷 정책 업데이트

CloudFront 생성 후, S3 버킷 정책을 업데이트해야 합니다.

1. S3 → `tiketi-frontend-prod` → **"권한"** 탭 → **"버킷 정책"** → **"편집"**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipal",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::tiketi-frontend-prod/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::<AWS-ACCOUNT-ID>:distribution/<DISTRIBUTION-ID>"
                }
            }
        }
    ]
}
```

`<DISTRIBUTION-ID>`는 CloudFront 배포 ID로 교체

### 12.6 CloudFront 오류 페이지 설정 (SPA 라우팅)

React Router를 위한 설정:

1. CloudFront → 배포 선택 → **"오류 페이지"** 탭
2. **"사용자 지정 오류 응답 생성"** 클릭

```
HTTP 오류 코드: 403 Forbidden
오류 캐싱 최소 TTL: 10
사용자 지정 오류 응답: 예
응답 페이지 경로: /index.html
HTTP 응답 코드: 200 OK
```

3. 동일하게 404 오류도 설정

---

## 13. Route53 도메인 설정

### 13.1 도메인 구매 (또는 기존 도메인 사용)

**Option 1: Route53에서 도메인 구매**

1. Route53 → **"등록된 도메인"** → **"도메인 등록"**
2. 원하는 도메인 검색 (예: `tiketi.com`)
3. 구매 절차 진행 (연간 $12-50)

**Option 2: 외부 도메인 사용 (가비아, 후이즈 등)**

외부에서 구매한 도메인의 네임서버를 Route53으로 변경

### 13.2 Hosted Zone 생성

1. Route53 → **"호스팅 영역"** → **"호스팅 영역 생성"**

```
도메인 이름: your-domain.com
설명: Tiketi production domain
유형: 퍼블릭 호스팅 영역
```

2. **"호스팅 영역 생성"** 클릭
3. NS 레코드 값 확인 (외부 도메인 사용 시 네임서버 업데이트 필요)

### 13.3 SSL/TLS 인증서 생성 (Certificate Manager)

1. AWS 콘솔 → **"Certificate Manager"** 검색
2. **리전: us-east-1 (버지니아)** 선택 (CloudFront용 필수)
3. **"인증서 요청"** 클릭

```
인증서 유형: 퍼블릭 인증서

도메인 이름:
  - your-domain.com
  - *.your-domain.com (와일드카드)

검증 방법: DNS 검증 (권장)

키 알고리즘: RSA 2048
```

4. **"요청"** 클릭
5. **"Route 53에서 레코드 생성"** 클릭 (자동 DNS 검증)
6. 인증서 상태가 **"발급됨"**이 될 때까지 대기 (약 5-10분)

**백엔드 ALB용 인증서 (별도):**

동일한 과정으로 **리전: ap-northeast-2 (서울)**에서 인증서 생성

### 13.4 Route53 레코드 생성

#### 프론트엔드 (CloudFront)

1. Route53 → 호스팅 영역 → `your-domain.com` 선택
2. **"레코드 생성"** 클릭

**루트 도메인:**
```
레코드 이름: (비워둠) → your-domain.com
레코드 유형: A
별칭: 예
트래픽 라우팅 대상:
  - CloudFront 배포에 대한 별칭
  - 리전: 미국 동부(버지니아 북부)
  - CloudFront 배포: <배포-도메인-이름>
라우팅 정책: 단순 라우팅
```

**www 서브도메인:**
```
레코드 이름: www
레코드 유형: A
별칭: 예
트래픽 라우팅 대상:
  - CloudFront 배포에 대한 별칭
  - CloudFront 배포: <배포-도메인-이름>
```

#### 백엔드 API (ALB)

```
레코드 이름: api
레코드 유형: A
별칭: 예
트래픽 라우팅 대상:
  - Application/Classic Load Balancer에 대한 별칭
  - 리전: ap-northeast-2
  - Load Balancer: <ALB-DNS-이름>
```

### 13.5 도메인 확인

```bash
# DNS 전파 확인 (최대 48시간 소요, 보통 10분 내)
nslookup your-domain.com
nslookup www.your-domain.com
nslookup api.your-domain.com

# 브라우저 테스트
https://your-domain.com
https://api.your-domain.com/health
```

---

## 14. 모니터링 설정 (CloudWatch)

### 14.1 CloudWatch Container Insights 활성화

```bash
# Container Insights 활성화
aws eks update-cluster-config \
    --region ap-northeast-2 \
    --name tiketi-production \
    --logging '{"clusterLogging":[{"types":["api","audit","authenticator","controllerManager","scheduler"],"enabled":true}]}'

# Fluent Bit DaemonSet 배포
kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluent-bit-quickstart.yaml
```

### 14.2 CloudWatch 대시보드 생성

1. CloudWatch → **"대시보드"** → **"대시보드 생성"**
2. 대시보드 이름: `Tiketi-Production-Dashboard`
3. 위젯 추가:
   - EKS 클러스터 CPU/메모리
   - RDS CPU/연결 수
   - ElastiCache CPU/메모리
   - ALB 요청 수/응답 시간

### 14.3 CloudWatch 알람 설정

#### RDS CPU 알람

1. CloudWatch → **"경보"** → **"경보 생성"**

```
지표 선택:
  - RDS → 데이터베이스별 → tiketi-db → CPUUtilization

통계: 평균
기간: 5분

조건:
  - 임계값 유형: 정적
  - CPUUtilization이 다음보다 큼: 80

알림:
  - SNS 주제: tiketi-alerts (신규 생성)
  - 이메일 엔드포인트: your-email@example.com

경보 이름: Tiketi-RDS-High-CPU
```

#### 추가 알람 예시

- RDS 연결 수 > 80%
- ElastiCache 메모리 > 80%
- ALB 5xx 오류율 > 5%
- EKS 노드 CPU > 85%

---

## 15. 보안 설정 (WAF, Certificate Manager)

### 15.1 AWS WAF 설정

1. AWS 콘솔 → **"WAF & Shield"** 검색
2. **"Web ACL 생성"** 클릭

```
이름: tiketi-waf
리소스 유형: CloudFront distributions
리전: Global (CloudFront)

연결할 AWS 리소스: <CloudFront-배포-선택>

규칙 추가:
  1. AWS 관리형 규칙 → Core rule set (CRS)
  2. AWS 관리형 규칙 → Known bad inputs
  3. 속도 기반 규칙:
     - 이름: Rate-Limit-Rule
     - 속도 제한: 2000 (5분당 IP당 요청 수)
     - 작업: 차단

기본 작업: 허용
```

### 15.2 보안 그룹 검토

#### EKS 노드 보안 그룹

```
인바운드:
  - 소스: ALB 보안 그룹, 포트: 30000-32767 (NodePort 범위)
  - 소스: 자기 자신, 포트: 모든 트래픽 (노드 간 통신)

아웃바운드:
  - 대상: 0.0.0.0/0, 포트: 모든 트래픽
```

### 15.3 IAM 최소 권한 원칙

각 서비스에 필요한 최소 권한만 부여:

```bash
# S3 업로드 전용 IAM 사용자 생성
aws iam create-user --user-name tiketi-s3-uploader

# S3 업로드 정책 연결
cat > s3-upload-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::tiketi-uploads-prod/*"
        }
    ]
}
EOF

aws iam put-user-policy \
    --user-name tiketi-s3-uploader \
    --policy-name S3UploadPolicy \
    --policy-document file://s3-upload-policy.json
```

---

## 16. 최종 확인 및 테스트

### 16.1 전체 시스템 헬스 체크

```bash
# EKS 클러스터
kubectl get nodes
kubectl get pods -n tiketi
kubectl get svc -n tiketi
kubectl get ingress -n tiketi

# RDS
aws rds describe-db-instances --db-instance-identifier tiketi-db --query "DBInstances[0].DBInstanceStatus"

# ElastiCache
aws elasticache describe-cache-clusters --cache-cluster-id tiketi-redis --query "CacheClusters[0].CacheClusterStatus"

# ALB
aws elbv2 describe-load-balancers --query "LoadBalancers[?contains(LoadBalancerName, 'tiketi')].State.Code"

# CloudFront
aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='Tiketi Frontend'].Status"
```

### 16.2 엔드투엔드 테스트

1. **프론트엔드 접속**
   ```
   https://your-domain.com
   ```
   - 로그인 페이지 확인
   - Google OAuth 작동 확인

2. **API 테스트**
   ```bash
   curl https://api.your-domain.com/health
   curl https://api.your-domain.com/api/auth/health
   ```

3. **데이터베이스 연결 확인**
   ```bash
   kubectl exec -it deployment/backend -n tiketi -- node -e "require('./src/config/database').query('SELECT NOW()')"
   ```

4. **Redis 연결 확인**
   ```bash
   kubectl exec -it deployment/ticket-service -n tiketi -- node -e "require('./src/config/redis').client.ping().then(console.log)"
   ```

### 16.3 부하 테스트 (선택 사항)

```bash
# Apache Bench 사용
ab -n 1000 -c 10 https://api.your-domain.com/health

# 또는 기존 부하 테스트 스크립트
node scripts/queue-load-test.js --apiUrl https://api.your-domain.com --users 50
```

---

## 17. 비용 최적화

### 17.1 예상 월 비용 (프로덕션 환경)

```
EKS 클러스터: $72 (클러스터 관리)
EKS 노드 (t3.medium x2): $60
RDS (db.t3.medium, Multi-AZ): $130
ElastiCache (cache.t3.micro): $25
ALB: $22 + 데이터 전송
CloudFront: $1 + 데이터 전송
Route53: $0.5
S3: $1-5
데이터 전송 (예상): $50

총 예상: $350-400/월
```

### 17.2 비용 절감 방법

1. **Reserved Instances 구매** (1-3년 약정 시 최대 75% 할인)
   ```bash
   # RDS Reserved Instance
   aws rds purchase-reserved-db-instances-offering \
       --reserved-db-instances-offering-id <offering-id>
   ```

2. **Savings Plans** (컴퓨팅 비용 최대 72% 절감)

3. **Auto Scaling 활용**
   ```yaml
   # HPA (Horizontal Pod Autoscaler)
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   metadata:
     name: backend-hpa
     namespace: tiketi
   spec:
     scaleTargetRef:
       apiVersion: apps/v1
       kind: Deployment
       name: backend
     minReplicas: 2
     maxReplicas: 10
     metrics:
     - type: Resource
       resource:
         name: cpu
         target:
           type: Utilization
           averageUtilization: 70
   ```

4. **개발 환경 자동 종료**
   ```bash
   # 개발 환경 EKS 클러스터는 업무 외 시간 정지
   # Lambda + EventBridge로 자동화
   ```

5. **S3 Lifecycle 정책**
   ```json
   {
     "Rules": [
       {
         "Id": "archive-old-logs",
         "Status": "Enabled",
         "Transitions": [
           {
             "Days": 30,
             "StorageClass": "INTELLIGENT_TIERING"
           }
         ]
       }
     ]
   }
   ```

---

## 18. 트러블슈팅

### 18.1 Pod 시작 실패

```bash
# 로그 확인
kubectl logs <pod-name> -n tiketi

# 이벤트 확인
kubectl describe pod <pod-name> -n tiketi

# 일반적인 원인:
# - 이미지 pull 실패 → ECR 권한 확인
# - ConfigMap/Secret 없음 → kubectl get configmap/secret -n tiketi
# - 리소스 부족 → kubectl top nodes
```

### 18.2 RDS 연결 실패

```bash
# 보안 그룹 확인
aws ec2 describe-security-groups --group-ids <sg-id>

# EKS 노드에서 RDS 접근 테스트
kubectl run test-db --rm -i --tty --image postgres:15 -n tiketi -- bash
psql -h <RDS-endpoint> -U tiketi_admin -d tiketi
```

### 18.3 ALB 502/503 오류

```bash
# Target Group 헬스 체크
aws elbv2 describe-target-health --target-group-arn <tg-arn>

# 일반적인 원인:
# - 헬스 체크 경로 오류 (/health 엔드포인트 구현 확인)
# - 보안 그룹 규칙 누락
# - Pod readinessProbe 실패
```

### 18.4 CloudFront 캐시 무효화

```bash
# 배포 후 즉시 반영이 필요한 경우
aws cloudfront create-invalidation \
    --distribution-id <distribution-id> \
    --paths "/*"
```

---

## 19. 운영 체크리스트

### 배포 전

- [ ] 모든 Secret 값이 안전하게 저장되어 있는가?
- [ ] RDS 마스터 암호가 강력한가? (16자 이상, 특수문자 포함)
- [ ] Redis AUTH 토큰이 설정되어 있는가?
- [ ] SSL 인증서가 발급되었는가?
- [ ] 도메인 DNS 전파가 완료되었는가?
- [ ] 백업 정책이 설정되어 있는가? (RDS, ElastiCache)
- [ ] CloudWatch 알람이 설정되어 있는가?
- [ ] WAF 규칙이 적용되어 있는가?

### 배포 후

- [ ] 모든 Pod가 Running 상태인가?
- [ ] ALB Health Check가 통과하는가?
- [ ] 프론트엔드가 정상적으로 로드되는가?
- [ ] API 엔드포인트가 응답하는가?
- [ ] 데이터베이스 마이그레이션이 완료되었는가?
- [ ] WebSocket 연결이 작동하는가?
- [ ] S3 이미지 업로드가 작동하는가?
- [ ] Google OAuth 로그인이 작동하는가?

### 정기 점검 (주간)

- [ ] CloudWatch 메트릭 확인
- [ ] RDS 백업 확인
- [ ] 비용 사용량 확인
- [ ] 보안 취약점 스캔 (ECR 이미지)
- [ ] 로그 검토 (오류, 경고)

---

## 20. 다음 단계

### 20.1 CI/CD 파이프라인 구축

- GitHub Actions 또는 AWS CodePipeline으로 자동 배포
- ArgoCD로 GitOps 구현

### 20.2 고급 모니터링

- Prometheus + Grafana 설치
- Distributed Tracing (AWS X-Ray)
- 애플리케이션 성능 모니터링 (APM)

### 20.3 재해 복구 계획

- 백업 자동화
- 교차 리전 복제
- DR(Disaster Recovery) 시나리오 테스트

### 20.4 성능 최적화

- CDN 캐싱 전략 최적화
- 데이터베이스 쿼리 최적화
- Redis 캐싱 전략 개선

---

## 부록

### A. 유용한 kubectl 명령어

```bash
# 전체 리소스 확인
kubectl get all -n tiketi

# 로그 스트리밍
kubectl logs -f deployment/backend -n tiketi

# Pod 재시작
kubectl rollout restart deployment/backend -n tiketi

# Secret 확인 (base64 디코딩)
kubectl get secret tiketi-db-secret -n tiketi -o jsonpath='{.data.DB_PASSWORD}' | base64 -d

# ConfigMap 수정
kubectl edit configmap tiketi-config -n tiketi

# 리소스 사용량
kubectl top pods -n tiketi
kubectl top nodes
```

### B. AWS CLI 명령어 모음

```bash
# EKS 클러스터 상태
aws eks describe-cluster --name tiketi-production --region ap-northeast-2

# RDS 인스턴스 정보
aws rds describe-db-instances --db-instance-identifier tiketi-db

# ECR 이미지 목록
aws ecr list-images --repository-name tiketi/backend --region ap-northeast-2

# ALB 상태
aws elbv2 describe-load-balancers --region ap-northeast-2

# CloudWatch 로그 확인
aws logs tail /aws/eks/tiketi-production/cluster --follow
```

### C. 환경변수 체크리스트

**ConfigMap (tiketi-config):**
- NODE_ENV
- DB_HOST
- DB_PORT
- DB_NAME
- REDIS_HOST
- REDIS_PORT
- SOCKET_IO_CORS_ORIGIN
- AWS_REGION
- AWS_S3_BUCKET
- QUEUE_THRESHOLD
- GOOGLE_CLIENT_ID

**Secrets:**
- DB_PASSWORD
- REDIS_PASSWORD
- JWT_SECRET
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY

### D. 참고 문서

- [AWS EKS 사용 설명서](https://docs.aws.amazon.com/ko_kr/eks/)
- [Kubernetes 공식 문서](https://kubernetes.io/ko/docs/)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [eksctl 문서](https://eksctl.io/)

---

**작성일:** 2026-01-06
**버전:** 1.0
**작성자:** Claude Code

이 가이드는 Tiketi MSA 시스템을 AWS EKS에 배포하기 위한 완벽한 단계별 매뉴얼입니다. 각 단계를 순서대로 따라가면 프로덕션 환경을 구축할 수 있습니다.
