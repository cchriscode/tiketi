FROM node:18-alpine

ARG REACT_APP_API_URL=http://tiketi.local
ARG REACT_APP_SOCKET_URL=http://tiketi.local
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_SOCKET_URL=${REACT_APP_SOCKET_URL}

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

# 프로덕션 빌드 후 정적 서빙
RUN npm run build && npm install -g serve

CMD ["serve", "-s", "build", "-l", "tcp://0.0.0.0:3000"]

