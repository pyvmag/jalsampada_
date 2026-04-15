# Use the official Bun image (full version, not slim)
FROM oven/bun:1 AS base
WORKDIR /app

# Copy package files first (for better caching)
COPY package.json bun.lockb* ./

# Install dependencies with bun install (faster than npm)
# Use --backend=copy to avoid hanging issues
RUN bun install --frozen-lockfile --backend=copy

# Copy source code (only when files change)
COPY . .

# Build application (cached if source unchanged)
RUN bun run build

# Production stage - use the standalone output
FROM oven/bun:1 AS production
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
