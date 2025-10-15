# 환경 변수 설정 가이드

## 필수 환경 변수

### Database Configuration
```bash
DB_HOST=postgres              # PostgreSQL 호스트
DB_PORT=5432                  # PostgreSQL 포트
DB_NAME=tiketi                # 데이터베이스 이름
DB_USER=tiketi_user           # 데이터베이스 사용자
DB_PASSWORD=tiketi_pass       # 데이터베이스 비밀번호
```

### Redis Configuration
```bash
REDIS_HOST=dragonfly          # Redis/DragonflyDB 호스트
REDIS_PORT=6379               # Redis 포트
```

### JWT Configuration
```bash
JWT_SECRET=your-secret-key-change-in-production
# ⚠️ 프로덕션 환경에서는 반드시 강력한 시크릿 키로 변경하세요!
```

### Admin Account (Development/Demo Only)
```bash
ADMIN_EMAIL=admin@tiketi.gg   # 기본 관리자 이메일
ADMIN_PASSWORD=admin123       # 기본 관리자 비밀번호
# ⚠️ 프로덕션 환경에서는 반드시 변경하세요!
```

### Server Configuration
```bash
NODE_ENV=development          # development | production
PORT=3001                     # 백엔드 서버 포트
```

## 프로덕션 환경 설정

프로덕션 환경에서는 반드시 다음 값들을 변경하세요:

1. **JWT_SECRET**: 강력한 랜덤 문자열로 변경
2. **ADMIN_PASSWORD**: 복잡한 비밀번호로 변경
3. **DB_PASSWORD**: 강력한 데이터베이스 비밀번호 사용
4. **NODE_ENV**: `production`으로 설정

## .env 파일 생성 (로컬 개발용)

프로젝트 루트에 `.env` 파일을 생성하고 위 변수들을 설정할 수 있습니다.

```bash
# .env 파일 예시
DB_HOST=localhost
DB_PORT=5432
# ... (위 변수들 참고)
```

⚠️ **주의**: `.env` 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.

