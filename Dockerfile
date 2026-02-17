# Use the official Bun image
FROM oven/bun:1-slim AS builder
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production=false

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1-slim AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 bun
RUN adduser --system --uid 1001 bun

# Copy built application
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static
COPY --from=builder --chown=bun:bun /app/public ./public

# Environment variables
ENV NODE_ENV production
ENV PORT 2225
ENV HOSTNAME 0.0.0.0

EXPOSE 2225

USER bun

# Run the standalone server with Bun
CMD ["bun", "server.js"]
