# 📋 Git 커밋 전 체크리스트

## ✅ 커밋하기 전에 확인하세요!

### 1. **로컬에서 테스트** 🧪
```bash
# 완전히 초기화하고 테스트
docker-compose down --volumes
docker-compose up --build -d

# 로그 확인
docker logs tiketi-backend --tail 30
docker logs tiketi-frontend --tail 30
```

**확인사항:**
- [ ] 백엔드 정상 시작 (`🚀 Server running on port 3001`)
- [ ] 관리자 계정 생성 (`✅ Admin account created`)
- [ ] 좌석 자동 생성 (`✅ Generated X seats`)
- [ ] 프론트엔드 접속 (http://localhost:3000)
- [ ] 로그인 테스트 (admin@tiketi.gg / admin123)
- [ ] 이벤트 조회 테스트
- [ ] 좌석 선택 테스트
- [ ] 결제 플로우 테스트

---

### 2. **Git 상태 확인** 📊
```bash
git status
```

**제외되어야 할 파일들:** (`.gitignore`에 포함됨)
- [ ] `node_modules/` 폴더
- [ ] `.env` 파일
- [ ] `build/`, `dist/` 폴더
- [ ] `.vscode/`, `.idea/` 폴더

---

### 3. **필수 파일 확인** 📁

#### ✅ **포함되어야 하는 파일:**
- [ ] `docker-compose.yml`
- [ ] `backend/Dockerfile`
- [ ] `backend/entrypoint.sh`
- [ ] `backend/package.json`
- [ ] `backend/src/**/*.js`
- [ ] `frontend/Dockerfile`
- [ ] `frontend/package.json`
- [ ] `frontend/src/**/*.js`
- [ ] `database/init.sql`
- [ ] `README.md`
- [ ] `팀원용_시작가이드.md`
- [ ] `ENV_VARIABLES.md`
- [ ] `.gitignore`

#### ❌ **제외되어야 하는 파일:**
- [ ] `.env` (환경변수는 각자 설정)
- [ ] `node_modules/` (자동 설치됨)
- [ ] Docker 볼륨 데이터

---

### 4. **문서 확인** 📚

#### ✅ **README.md**
- [ ] 프로젝트 설명 최신화
- [ ] 기술 스택 정보
- [ ] 실행 방법

#### ✅ **팀원용_시작가이드.md**
- [ ] 실행 방법 (`docker-compose up -d`)
- [ ] 관리자 계정 정보
- [ ] 포트 정보 (3000, 3001)

#### ✅ **ENV_VARIABLES.md**
- [ ] 환경변수 설명
- [ ] 기본값 정보

---

### 5. **코드 품질 체크** 🎯

#### ✅ **One Source of Truth**
- [ ] 상수는 `shared/constants.js`에 정의
- [ ] 중복 정의 없음
- [ ] 환경변수 사용 (`process.env`)

#### ✅ **에러 처리**
- [ ] 모든 라우트에 try-catch
- [ ] DB 연결 에러 처리
- [ ] Redis 연결 에러 처리

#### ✅ **하드코딩 없음**
- [ ] 포트 번호: 환경변수
- [ ] 비밀번호: 환경변수 (기본값만 제공)
- [ ] API 키: 환경변수

---

### 6. **Git 커밋** 💾

```bash
# 모든 변경사항 추가
git add .

# 커밋 메시지 작성
git commit -m "feat: 좌석 선택 시스템 구현 및 자동화 설정 완료

- 좌석 선택 기능 추가
- 자동 마이그레이션 및 초기화
- 환경변수 통합 관리 (constants.js)
- 관리자 계정 자동 생성
- 예약 만료 자동 처리
- 에러 처리 강화
- 문서화 완료
"

# 원격 저장소에 푸시
git push origin main
```

---

### 7. **팀원 확인 요청** 👥

```markdown
@팀원들
최신 코드 푸시했습니다! 🎉

**테스트 방법:**
1. `git pull`
2. `docker-compose up -d`
3. http://localhost:3000 접속
4. admin@tiketi.gg / admin123 로 로그인

모든 것이 자동으로 설정됩니다!
```

---

## 🚨 문제 해결

### 팀원이 에러 발생 시

#### 1. **Docker가 실행 중인가?**
```bash
docker --version
docker-compose --version
```

#### 2. **이전 컨테이너 삭제**
```bash
docker-compose down --volumes
docker-compose up --build -d
```

#### 3. **로그 확인**
```bash
docker logs tiketi-backend
docker logs tiketi-postgres
```

#### 4. **포트 충돌 확인**
- 3000번 포트 사용 중? → 다른 앱 종료
- 3001번 포트 사용 중? → 다른 앱 종료
- 5432번 포트 사용 중? → PostgreSQL 종료

---

## ✅ 최종 체크리스트

커밋 전 모두 체크하세요:

- [ ] 로컬 테스트 완료
- [ ] Git 상태 정상
- [ ] 필수 파일 포함
- [ ] 제외 파일 확인
- [ ] 문서 업데이트
- [ ] 코드 품질 확인
- [ ] 커밋 메시지 작성
- [ ] 푸시 완료
- [ ] 팀원 공지

**모두 완료하면 Git에 푸시하세요!** 🚀

