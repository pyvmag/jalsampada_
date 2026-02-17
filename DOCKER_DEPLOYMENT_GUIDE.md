# Jalsampada UI Deployment Migration: Node/PM2 to Bun/Docker

This document explains the migration of the Jalsampada UI application deployment from a local Node.js/PM2 setup to a modern containerized environment using **Bun** and **Docker**.

---

## 1. Files Created & Modified

### 📜 `Dockerfile`
This is the "blueprint" for your container. It tells Docker how to build your application environment.

*   **`FROM oven/bun:1.1`**: Uses the official Bun image, which is much faster than Node.js.
*   **`WORKDIR /app`**: Sets the working directory inside the container.
*   **`COPY . .`**: Copies all your source code from the current directory into the container.
*   **`RUN bun install`**: Installs your project dependencies using Bun's lightning-fast package manager.
*   **`RUN bun run build`**: Compiles your Next.js application. Since you use `output: 'standalone'` in `next.config.js`, this creates a minimal server.
*   **`RUN cp -r .next/static ...`**: Next.js standalone mode requires these manual copies to serve CSS, JS, and images correctly.
*   **`CMD ["bun", "server.js"]`**: The command that runs when the container starts. It uses Bun to execute the production server.

### 📜 `.dockerignore`
This file tells Docker which files to **NOT** copy into the image.

*   **Purpose**: It prevents local `node_modules` or `.next` folders from being copied. This ensures the container builds its own fresh dependencies and build artifacts, preventing "it works on my machine" bugs.

### 📜 `docker-compose.yml`
This file simplifies managing the container.

*   **`build`**: Tells Docker to build the image using the `Dockerfile` in the current directory.
*   **`ports: ["2225:2225"]`**: Maps port 2225 of your server to port 2225 inside the container.
*   **`restart: always`**: Ensures the application starts automatically if the server reboots or if the app crashes.

---

## 2. Commands Executed & Their Purpose

### Phase 1: Preparation
1.  **`which bun && bun --version`**: Checked if Bun was installed on the host and located its path for the PM2 migration.
2.  **`pm2 status`**: Checked the current state of the application running under PM2.

### Phase 2: Building the Docker Image
3.  **`docker compose build --no-cache`**: 
    *   **Purpose**: Builds the Docker image from scratch. 
    *   **Why `--no-cache`?**: To ensure every step (like `bun install`) is fresh and uses the latest changes.

### Phase 3: Transitioning from PM2 to Docker
4.  **`pm2 stop jalsampada`**: 
    *   **Purpose**: Stopped the existing PM2 process to free up port **2225**. Two applications cannot use the same port at the same time.
5.  **`docker compose up -d`**:
    *   **Purpose**: Starts the container in "detached" mode (background). 
    *   **Result**: The application is now running inside Docker.

### Phase 4: Verification
6.  **`docker compose ps`**: Verified that the container status is "Up".
7.  **`curl -I http://localhost:2225/login`**: Verified that the application is actually serving the login page with a `200 OK` response.

---

## 3. How to manage your new deployment

| Action | Command |
| :--- | :--- |
| **View Logs** | `docker compose logs -f` |
| **Stop App** | `docker compose down` |
| **Start App** | `docker compose up -d` |
| **Update App** | `git pull` followed by `docker compose build && docker compose up -d` |

---

## 4. Why this change?
1.  **Speed**: Bun is significantly faster than Node.js for both installing packages and running the server.
2.  **Consistency**: Docker ensures that the app runs exactly the same way in development, testing, and production.
3.  **Isolation**: The app no longer depends on the specific Node/Bun version installed on your host server.
