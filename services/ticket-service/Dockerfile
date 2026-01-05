FROM node:20-alpine

WORKDIR /app

# Copy monorepo packages
COPY packages ./packages

# Install dependencies for each package (these are needed for @tiketi/* packages)
# CRITICAL: These packages have dependencies (uuid, winston, pg, ioredis, prom-client)
# Build MUST fail if these installations fail to prevent runtime MODULE_NOT_FOUND errors
RUN cd packages/common && npm install --omit=dev --no-package-lock
RUN cd packages/database && npm install --omit=dev --no-package-lock
RUN cd packages/metrics && npm install --omit=dev --no-package-lock

# Copy ticket service package.json (Source of Truth)
COPY services/ticket-service/package.json ./package.json

# Install external dependencies only (exclude local @tiketi/* packages)
# The --legacy-peer-deps flag handles file: dependencies gracefully
RUN npm install --omit=dev --no-package-lock --legacy-peer-deps || \
    npm install @socket.io/redis-adapter@^8.2.1 dotenv@^16.0.3 express@^4.18.2 ioredis@^5.3.0 jsonwebtoken@^9.0.3 redis@^4.6.5 socket.io@^4.6.0 uuid@^9.0.0 --omit=dev --no-package-lock

# Copy ticket service source
COPY services/ticket-service/src ./src

# Copy monorepo packages into node_modules
RUN mkdir -p node_modules/@tiketi && \
    rm -rf node_modules/@tiketi/common node_modules/@tiketi/database node_modules/@tiketi/metrics && \
    cp -r packages/common node_modules/@tiketi/common && \
    cp -r packages/database node_modules/@tiketi/database && \
    cp -r packages/metrics node_modules/@tiketi/metrics

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the service
CMD ["node", "src/server.js"]
