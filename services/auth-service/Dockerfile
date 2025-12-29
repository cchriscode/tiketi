FROM node:18-alpine

WORKDIR /app

# Dependencies 먼저 설치
COPY services/auth-service/package*.json ./
RUN npm install --production

# 공통 라이브러리를 npm install 이후에 복사!
COPY tiketi-common ./node_modules/@tiketi/common

# 소스 복사
COPY services/auth-service/src ./src

EXPOSE 3010

CMD ["node", "src/index.js"]
