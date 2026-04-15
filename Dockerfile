# Use Node.js base image and install bun
FROM node:20-slim AS base
WORKDIR /app

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Copy package files first (for better caching)
COPY package.json bun.lockb* ./

# Install dependencies with bun install
RUN bun install --frozen-lockfile

# Copy source code (only when files change)
COPY . .

# Build application (cached if source unchanged)
RUN bun run build

# Production stage - use the standalone output
FROM node:20-slim AS production
WORKDIR /app

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

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
