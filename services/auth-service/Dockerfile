FROM node:20-alpine

WORKDIR /app

# Copy monorepo packages
COPY packages ./packages

# Install dependencies for each package
RUN cd packages/common && npm install --omit=dev --no-package-lock || true
RUN cd packages/database && npm install --omit=dev --no-package-lock || true
RUN cd packages/metrics && npm install --omit=dev --no-package-lock || true

# Copy auth service package.json (Source of Truth)
COPY services/auth-service/package.json ./package.json

# Install external dependencies only (exclude local @tiketi/* packages)
# The --legacy-peer-deps flag handles file: dependencies gracefully
RUN npm install --omit=dev --no-package-lock --legacy-peer-deps || \
    npm install bcrypt@^5.1.1 cors@^2.8.5 dotenv@^16.3.1 express@^4.18.2 google-auth-library@^9.0.0 jsonwebtoken@^9.0.2 --omit=dev --no-package-lock

# Copy auth service source
COPY services/auth-service/src ./src

# Copy monorepo packages into node_modules
RUN mkdir -p node_modules/@tiketi && \
    rm -rf node_modules/@tiketi/common node_modules/@tiketi/database node_modules/@tiketi/metrics && \
    cp -r packages/common node_modules/@tiketi/common && \
    cp -r packages/database node_modules/@tiketi/database && \
    cp -r packages/metrics node_modules/@tiketi/metrics

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3005/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the service
CMD ["node", "src/server.js"]
