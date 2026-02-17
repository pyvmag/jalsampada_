# Use the official Bun image
FROM oven/bun:1-slim AS builder
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1-slim AS runner
WORKDIR /app

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Environment variables
ENV NODE_ENV production
ENV PORT 2225
ENV HOSTNAME 0.0.0.0

EXPOSE 2225

# Run the standalone server with Bun
CMD ["bun", "server.js"]
