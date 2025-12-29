# Stage 1: Build React app
FROM node:18-alpine AS builder

WORKDIR /app

# Build arguments
ARG REACT_APP_API_URL=http://localhost:8080
ARG REACT_APP_SOCKET_URL=http://localhost:8080

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Set environment variables for build
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL

# Build
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
