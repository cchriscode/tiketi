FROM node:18-alpine

WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Expose port
EXPOSE 3010

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3010/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the service
CMD ["node", "src/index.js"]
