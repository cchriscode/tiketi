FROM node:20-alpine

WORKDIR /app

# Copy monorepo packages
COPY packages ./packages

# Install dependencies for each package
RUN cd packages/common && npm install --omit=dev --no-package-lock || true
RUN cd packages/database && npm install --omit=dev --no-package-lock || true
RUN cd packages/metrics && npm install --omit=dev --no-package-lock || true

# Copy ticket service source
COPY services/ticket-service/src ./src

# Create package.json
RUN printf '{"name":"@tiketi/ticket-service","version":"1.0.0","main":"src/server.js","scripts":{"start":"node src/server.js"},"dependencies":{"dotenv":"^16.0.3","express":"^4.18.2","ioredis":"^5.3.0","jsonwebtoken":"^9.0.3","redis":"^4.6.5","socket.io":"^4.6.0","socket.io-redis":"^6.1.1","uuid":"^9.0.0"}}' > package.json

# Install external dependencies
RUN npm install --omit=dev --no-package-lock

# Copy monorepo packages into node_modules
RUN mkdir -p node_modules/@tiketi && \
    rm -rf node_modules/@tiketi/common node_modules/@tiketi/database node_modules/@tiketi/metrics && \
    cp -r packages/common node_modules/@tiketi/common && \
    cp -r packages/database node_modules/@tiketi/database && \
    cp -r packages/metrics node_modules/@tiketi/metrics

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3004/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the service
CMD ["node", "src/server.js"]
