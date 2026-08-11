FROM mcr.microsoft.com/playwright:v1.61.1-noble

# Set working directory inside container
WORKDIR /app

# Install Xvfb and Linux display utilities
RUN apt-get update && apt-get install -y \
    xvfb \
    x11-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for efficient caching
COPY package*.json ./

# Install production node dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Ensure entrypoint script has executable permissions
RUN chmod +x /app/docker-entrypoint.sh

# Create writable directories for session storage and logs
RUN mkdir -p /app/sessions /app/logs

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV DISPLAY=:99

EXPOSE 4000

# Set entrypoint to run background Xvfb and exec main command
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Health check against live Express server endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start Express server directly in foreground
CMD ["node", "server.js"]
