FROM node:18-alpine

WORKDIR /app

# 공통 라이브러리 먼저 준비
COPY tiketi-common/package.json /tiketi-common/package.json
WORKDIR /tiketi-common
RUN npm install --omit=dev --no-package-lock

# 공통 라이브러리 소스 복사
COPY tiketi-common/src /tiketi-common/src

# 서비스 빌드
WORKDIR /app
COPY services/payment-service/package.json ./
RUN npm install --omit=dev --no-package-lock

# 공통 라이브러리 링크
RUN ln -s /tiketi-common ./node_modules/@tiketi/common

COPY services/payment-service/src ./src

EXPOSE 3003

CMD ["node", "src/server.js"]
