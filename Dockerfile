# Use the official Bun image
FROM oven/bun:1-slim AS base
WORKDIR /app

# Install npm (needed for dependency installation)
RUN apt-get update && apt-get install -y npm && rm -rf /var/lib/apt/lists/*

# Copy package files first (for better caching)
COPY package.json bun.lockb* ./

# Install dependencies using npm (more stable in Docker than bun install)
RUN npm install

# Copy source code (only when files change)
COPY . .

# Build application (cached if source unchanged)
RUN bun run build

# Production stage - use the standalone output
FROM oven/bun:1-slim AS production
WORKDIR /app

# Copy the standalone build
COPY --from=base /app/.next/standalone ./

# Copy static files to the correct location expected by standalone server
COPY --from=base /app/.next/static ./.next/static/
COPY --from=base /app/public ./public/

# Environment variables
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0

EXPOSE 4000

# Run the standalone server
CMD ["bun", "server.js"]
