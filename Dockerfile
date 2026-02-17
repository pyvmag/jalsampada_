# Use the official Bun image
FROM oven/bun:1-slim
WORKDIR /app

# Copy all files from the current directory
COPY . .

# Install dependencies and build the application
RUN bun install
RUN bun run build

# Prepare standalone server assets (copy static and public as per deploy script)
RUN cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

# Environment variables
ENV NODE_ENV production
ENV PORT 2225
ENV HOSTNAME 0.0.0.0

EXPOSE 2225

# Run the standalone server
WORKDIR /app/.next/standalone
CMD ["bun", "server.js"]
