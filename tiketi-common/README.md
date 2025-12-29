# @tiketi/common

Tiketi MSA 공통 라이브러리

## 설치 방법
```bash
npm install file:../tiketi-common
```

## 사용 예시
```javascript
const { logger, CustomError, authenticateToken } = require('@tiketi/common');

logger.info('서비스 시작');
```

## 포함된 모듈

- **Utils**: logger, CustomError, constants
- **Middleware**: auth, error-handler
- **Config**: database

## 업데이트 방법

1. `tiketi-common/` 수정
2. 버전 업데이트: `npm version patch`
3. 각 서비스에서 재설치: `npm install file:../tiketi-common`
