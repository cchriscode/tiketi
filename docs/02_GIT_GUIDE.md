# 📦 Git 사용 가이드

> GitHub 업로드부터 협업 전략까지

---

## 📤 Part 1: GitHub에 프로젝트 업로드

### 1. GitHub 저장소 생성

**GitHub 웹사이트 (https://github.com)**:
1. 로그인 후 우측 상단 **"+"** 클릭
2. **"New repository"** 선택
3. 저장소 설정:
   ```
   Repository name: project-ticketing
   Description: 🎫 실시간 티켓팅 플랫폼
   Public 또는 Private 선택

   ❌ Add a README file (체크 해제)
   ❌ Add .gitignore (체크 해제)
   ❌ Choose a license (체크 해제)
   ```
4. **"Create repository"** 클릭

---

### 2. 로컬에서 Git 초기화

```bash
# 프로젝트 폴더로 이동
cd C:\Users\USER\project-ticketing

# Git 초기화
git init

# 모든 파일 스테이징
git add .

# 첫 커밋
git commit -m "🎫 Initial commit: TIKETI 티켓팅 시스템"
```

---

### 3. 원격 저장소 연결 및 푸시

```bash
# 원격 저장소 추가 (본인의 URL로 변경!)
git remote add origin https://github.com/본인계정/project-ticketing.git

# 기본 브랜치를 main으로 설정
git branch -M main

# 푸시
git push -u origin main
```

---

### 4. 팀원 초대 (Private 저장소)

**GitHub 저장소 페이지**:
1. **Settings** 탭 클릭
2. 왼쪽 메뉴에서 **Collaborators** 선택
3. **Add people** 클릭
4. 팀원 GitHub 아이디 입력 후 초대

---

## 🔄 Part 2: 일상적인 Git 작업

### 기본 작업 흐름

```bash
# 1. 변경사항 확인
git status

# 2. 변경된 파일 스테이징
git add .                    # 모든 파일
git add backend/             # 특정 폴더만
git add src/routes/seats.js  # 특정 파일만

# 3. 커밋
git commit -m "feat: 이벤트 검색 기능 추가"

# 4. 푸시
git push
```

---

### 커밋 메시지 규칙

**형식**: `타입: 간단한 설명`

**타입**:
- `feat`: 새 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅 (기능 변경 없음)
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드/설정 변경

**예시**:
```bash
git commit -m "feat: 좌석 선택 기능 추가"
git commit -m "fix: 예매 취소 시 재고 복구 버그 수정"
git commit -m "docs: README에 실행 방법 추가"
git commit -m "refactor: 상수를 constants.js로 통합"
```

**여러 줄 커밋 메시지**:
```bash
git commit -m "feat: 좌석 선택 시스템 구현

- 좌석 레이아웃 시스템 추가
- 실시간 좌석 동기화
- 분산 락 동시성 제어
- 5분 임시 예약 기능
- 자동 정리 시스템
"
```

---

## 🌿 Part 3: 브랜치 전략

### Feature Branch 전략 (권장)

```bash
# 1. 새 기능 브랜치 생성
git checkout -b feature/event-search

# 2. 작업 진행
# ... 코드 작성 ...

# 3. 커밋
git add .
git commit -m "feat: 이벤트 검색 기능 구현"

# 4. 원격에 푸시
git push -u origin feature/event-search

# 5. GitHub에서 Pull Request 생성
# 6. 팀원 리뷰 후 main에 머지
```

### 브랜치 이름 규칙

```
feature/기능명      # 새 기능
fix/버그명         # 버그 수정
refactor/대상      # 리팩토링
docs/문서명        # 문서 작업

예시:
feature/seat-selection
fix/payment-error
refactor/constants
docs/api-guide
```

---

## 📋 Part 4: 커밋 전 체크리스트

### 1. 로컬 테스트 ✅

```bash
# 완전 초기화 후 테스트
docker-compose down -v
docker-compose up --build -d

# 로그 확인
docker-compose logs backend --tail 30
docker-compose logs frontend --tail 30
```

**확인사항**:
- [ ] 백엔드 정상 시작 (`Server running on port 3001`)
- [ ] 관리자 계정 생성 (`Admin account created`)
- [ ] 좌석 자동 생성 (`Generated X seats`)
- [ ] 프론트엔드 접속 (http://localhost:3000)
- [ ] 로그인 테스트
- [ ] 주요 기능 테스트

---

### 2. Git 상태 확인 ✅

```bash
git status
```

**제외되어야 할 것들** (`.gitignore`에 포함):
- [ ] `node_modules/` 폴더
- [ ] `.env` 파일
- [ ] `build/`, `dist/` 폴더
- [ ] `.vscode/`, `.idea/` 폴더
- [ ] Docker 볼륨 데이터

---

### 3. 필수 파일 확인 ✅

**포함되어야 하는 파일**:
- [ ] `docker-compose.yml`
- [ ] `backend/Dockerfile`, `backend/package.json`
- [ ] `frontend/Dockerfile`, `frontend/package.json`
- [ ] `database/init.sql`, `database/migrations/*.sql`
- [ ] `README.md`, `docs/*.md`
- [ ] `.gitignore`, `.env.example`

---

### 4. 코드 품질 체크 ✅

**One Source of Truth**:
- [ ] 상수는 `shared/constants.js`에 정의
- [ ] 중복 정의 없음
- [ ] 환경변수 사용 (`process.env`)

**에러 처리**:
- [ ] 모든 라우트에 try-catch
- [ ] DB 연결 에러 처리
- [ ] Redis 연결 에러 처리

**하드코딩 없음**:
- [ ] 포트 번호: 환경변수
- [ ] 비밀번호: 환경변수
- [ ] API 키: 환경변수

---

### 5. 문서 업데이트 ✅

- [ ] `README.md` 최신화
- [ ] `CHANGELOG.md` 변경사항 기록
- [ ] API 문서 업데이트 (필요 시)

---

## 👥 Part 5: 팀 협업 가이드

### 팀원이 처음 시작할 때

```bash
# 1. 저장소 클론
git clone https://github.com/본인계정/project-ticketing.git
cd project-ticketing

# 2. 환경변수 설정
cp .env.example .env

# 3. 실행
docker-compose up -d

# 4. 접속
# http://localhost:3000
```

---

### 최신 코드 가져오기

```bash
# main 브랜치 업데이트
git checkout main
git pull origin main

# 작업 중이던 브랜치에 반영
git checkout feature/my-feature
git merge main
```

---

### 충돌 해결

```bash
# 1. 충돌 발생 시
git pull origin main
# CONFLICT 메시지 표시

# 2. 충돌 파일 수정
# <<<<<<< HEAD
# 내 코드
# =======
# 팀원 코드
# >>>>>>> main

# 3. 충돌 해결 후
git add .
git commit -m "merge: main 브랜치와 충돌 해결"
git push
```

---

## 🚨 Part 6: 문제 해결

### "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/본인계정/project-ticketing.git
```

### "Permission denied"
```bash
# GitHub 인증 필요
# Windows: 자동으로 로그인 창 표시
# 또는 Personal Access Token 사용
```

### ".gitignore가 작동하지 않음"
```bash
# 캐시 제거 후 다시 추가
git rm -r --cached .
git add .
git commit -m "fix: .gitignore 적용"
```

### "Changes not staged for commit"
```bash
# 변경사항 확인
git diff

# 스테이징
git add .
```

### 실수로 커밋한 파일 되돌리기
```bash
# 마지막 커밋 취소 (변경사항 유지)
git reset --soft HEAD~1

# 마지막 커밋 취소 (변경사항 삭제)
git reset --hard HEAD~1
```

---

## 🎯 Best Practices

### 1. 자주 커밋하기
```bash
# ❌ 나쁜 예: 하루 작업을 한 번에
git commit -m "기능 추가"

# ✅ 좋은 예: 작은 단위로 여러 번
git commit -m "feat: 좌석 레이아웃 API 추가"
git commit -m "feat: 좌석 선택 UI 구현"
git commit -m "test: 좌석 선택 테스트 추가"
```

### 2. main 브랜치 보호
```bash
# ❌ 나쁜 예: main에 직접 작업
git checkout main
# ... 작업 ...

# ✅ 좋은 예: feature 브랜치 사용
git checkout -b feature/new-feature
# ... 작업 ...
# Pull Request 생성
```

### 3. .gitignore 활용
```gitignore
# Node.js
node_modules/
npm-debug.log
yarn-error.log

# 환경변수
.env
.env.local

# 빌드 결과물
build/
dist/
*.min.js

# IDE 설정
.vscode/
.idea/
*.swp

# OS 파일
.DS_Store
Thumbs.db

# Docker
docker-compose.override.yml

# 로그
logs/
*.log
```

### 4. 커밋 전 항상 테스트
```bash
# 로컬 테스트 후 커밋
npm test
docker-compose up -d
# 테스트 완료 확인

git add .
git commit -m "feat: 새 기능 추가"
```

---

## ✅ 최종 체크리스트

**커밋 전 확인**:
- [ ] 로컬 테스트 완료
- [ ] Git 상태 정상 (`git status`)
- [ ] 필수 파일 포함
- [ ] 민감 정보 제외 (`.env`, 비밀번호)
- [ ] 문서 업데이트
- [ ] 커밋 메시지 명확히 작성
- [ ] 코드 리뷰 완료 (팀 작업 시)

**푸시 후 확인**:
- [ ] GitHub에서 파일 확인
- [ ] CI/CD 성공 (설정된 경우)
- [ ] 팀원에게 공지

---

## 📢 팀원 공지 템플릿

```markdown
@팀원들
최신 코드 푸시했습니다! 🎉

**변경사항:**
- 좌석 선택 시스템 추가
- 실시간 동기화 기능
- 관리자 대시보드 개선

**업데이트 방법:**
1. git pull origin main
2. docker-compose down -v
3. docker-compose up -d

**테스트:**
- http://localhost:3000 접속
- admin@tiketi.gg / admin123 로그인
- 좌석 선택 기능 테스트

문제 발생 시 알려주세요!
```

---

## 🎓 더 배우기

- [Git 공식 문서](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Git으로 효율적인 협업을 시작하세요!** 🚀
