# Stage 1: Build React app
FROM node:18-alpine AS builder

WORKDIR /app

# Build arguments for environment variables
ARG REACT_APP_API_URL=http://localhost:3001
ARG REACT_APP_GOOGLE_CLIENT_ID=721028631258-dhjgd4gquphib49fsoitiubusbo3t9e9.apps.googleusercontent.com

# Set environment variables from build args
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built files to Nginx
COPY --from=builder /app/build /usr/share/nginx/html

# Nginx config for React Router
RUN echo 'server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

