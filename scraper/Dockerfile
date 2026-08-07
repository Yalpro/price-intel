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

# Create writable directories for session storage and logs
RUN mkdir -p /app/sessions /app/logs

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=4000
ENV DISPLAY=:99

EXPOSE 4000

# Health check against live Express server endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start Express server via Xvfb virtual display for headed Chromium browser execution
CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1280x1024x24", "node", "server.js"]
