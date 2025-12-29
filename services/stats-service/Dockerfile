FROM node:20-alpine

WORKDIR /app

# Copy monorepo packages
COPY packages ./packages

# Install dependencies for each package
RUN cd packages/common && npm install --omit=dev --no-package-lock || true
RUN cd packages/database && npm install --omit=dev --no-package-lock || true
RUN cd packages/metrics && npm install --omit=dev --no-package-lock || true

# Copy stats service source
COPY services/stats-service/src ./src

# Create package.json
RUN printf '{"name":"@tiketi/stats-service","version":"1.0.0","main":"src/server.js","scripts":{"start":"node src/server.js"},"dependencies":{"cors":"^2.8.5","dotenv":"^16.0.3","express":"^4.18.2","jsonwebtoken":"^9.0.2"}}' > package.json

# Install external dependencies
RUN npm install --omit=dev --no-package-lock

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
