# 📤 Git에 프로젝트 업로드하기

## 🎯 목표
이 프로젝트를 GitHub에 올려서 팀원들과 공유

---

## 1️⃣ GitHub에 저장소 만들기

### GitHub 웹사이트에서:
1. https://github.com 접속 후 로그인
2. 우측 상단 **"+"** 클릭 → **"New repository"** 선택
3. 저장소 설정:
   ```
   Repository name: tiketi
   Description: 🎫 티켓 예매 시스템
   Public 또는 Private 선택
   ❌ Add a README file (체크 해제!)
   ❌ Add .gitignore (체크 해제!)
   ❌ Choose a license (체크 해제!)
   ```
4. **"Create repository"** 클릭

---

## 2️⃣ 로컬에서 Git 초기화

### Windows PowerShell 또는 Git Bash에서:

```bash
# 프로젝트 폴더로 이동
cd "C:\Users\USER\새 폴더 (2)"

# Git 초기화
git init

# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "🎫 Initial commit: TIKETI 티켓팅 시스템"
```

---

## 3️⃣ GitHub 저장소와 연결

### GitHub에서 복사한 저장소 URL 사용:

```bash
# 원격 저장소 추가 (본인의 URL로 변경!)
git remote add origin https://github.com/본인계정/tiketi.git

# 기본 브랜치를 main으로 설정
git branch -M main

# 푸시!
git push -u origin main
```

---

## 4️⃣ 팀원들에게 공유

### 저장소 URL 공유:
```
https://github.com/본인계정/tiketi
```

### Private 저장소인 경우:
1. GitHub 저장소 페이지 → **Settings** 탭
2. 왼쪽 메뉴 → **Collaborators**
3. **Add people** 클릭
4. 팀원 GitHub 아이디 입력 후 초대

---

## 📋 전체 명령어 요약 (복사해서 사용)

```bash
# 1. 프로젝트 폴더로 이동
cd "C:\Users\USER\새 폴더 (2)"

# 2. Git 초기화 및 커밋
git init
git add .
git commit -m "🎫 Initial commit: TIKETI 티켓팅 시스템"

# 3. GitHub 저장소와 연결 (⚠️ URL을 본인 것으로 변경!)
git remote add origin https://github.com/본인계정/tiketi.git
git branch -M main
git push -u origin main
```

---

## 👥 팀원이 다운받는 방법

### 팀원들은 이렇게 시작:

```bash
# 1. 클론
git clone https://github.com/본인계정/tiketi.git
cd tiketi

# 2. 실행
start.bat

# 끝! http://localhost:3000 접속
```

---

## 🔄 나중에 수정사항 푸시하기

```bash
# 1. 변경사항 확인
git status

# 2. 변경된 파일 추가
git add .

# 3. 커밋
git commit -m "기능 추가: 이벤트 검색 기능"

# 4. 푸시
git push
```

---

## 🌿 브랜치 전략 (선택사항)

### 팀 작업 시 권장:

```bash
# 새 기능 개발할 때
git checkout -b feature/이벤트검색
# 작업...
git add .
git commit -m "이벤트 검색 기능 추가"
git push -u origin feature/이벤트검색

# GitHub에서 Pull Request 생성
# 팀원 리뷰 후 main에 머지
```

---

## ⚠️ 주의사항

### ❌ 절대 올리지 말 것:
- ✅ 이미 `.gitignore`에 설정되어 있음:
  ```
  node_modules/     ← npm 패키지들
  .env              ← 비밀키, 비밀번호
  build/            ← 빌드 결과물
  ```

### 🔍 확인하기:
```bash
# .gitignore가 잘 작동하는지 확인
git status

# node_modules 폴더가 안 보이면 성공!
```

---

## 🚨 문제 해결

### "remote origin already exists" 에러
```bash
git remote remove origin
git remote add origin https://github.com/본인계정/tiketi.git
```

### "Permission denied" 에러
```bash
# GitHub 인증 필요
# Windows에서는 자동으로 로그인 창 뜸
# 또는 Personal Access Token 사용
```

### 파일이 너무 많아서 느림
```bash
# 특정 파일만 커밋
git add backend/
git add frontend/
git add docker-compose.yml
git add README.md
git commit -m "주요 파일만 업로드"
```

---

## 📖 README에 저장소 URL 추가

업로드 후 README.md 수정:

```markdown
## 🚀 빠른 시작

### 1. 클론
\`\`\`bash
git clone https://github.com/본인계정/tiketi.git
cd tiketi
\`\`\`

### 2. 실행
\`\`\`bash
start.bat  # Windows
\`\`\`
```

---

## ✅ 체크리스트

업로드 전 확인:
- [ ] `.gitignore` 파일 존재
- [ ] `node_modules/` 폴더가 git에 안 올라가는지 확인
- [ ] 비밀번호나 API 키가 코드에 없는지 확인
- [ ] `README.md`에 사용법 명확히 작성

업로드 후 확인:
- [ ] GitHub 페이지에서 파일 보임
- [ ] 팀원이 클론 가능
- [ ] `start.bat` 실행해서 정상 작동

---

## 🎉 완료!

이제 팀원들에게 이렇게 공유하세요:

```
📢 프로젝트 준비 완료!

저장소: https://github.com/본인계정/tiketi

시작 방법:
1. git clone https://github.com/본인계정/tiketi.git
2. cd tiketi
3. start.bat 실행
4. http://localhost:3000 접속

관리자 계정:
- 이메일: admin@tiketi.gg
- 비밀번호: admin123

문서: 팀원용_시작가이드.md 참고
```

