FROM node:18-alpine

# Install PostgreSQL client for wait-for-db script
RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

# Create a simple startup script inline
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'echo "Waiting for PostgreSQL to be ready..."' >> /start.sh && \
    echo 'until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "\\q" 2>/dev/null; do' >> /start.sh && \
    echo '  echo "PostgreSQL is unavailable - waiting..."' >> /start.sh && \
    echo '  sleep 2' >> /start.sh && \
    echo 'done' >> /start.sh && \
    echo 'echo "PostgreSQL is ready!"' >> /start.sh && \
    echo 'echo "Installing/updating dependencies..."' >> /start.sh && \
    echo 'npm install' >> /start.sh && \
    echo 'echo "Starting application..."' >> /start.sh && \
    echo 'npm start' >> /start.sh && \
    chmod +x /start.sh

CMD ["/start.sh"]

