# Jalsampada UI: Jenkins & Docker Deployment Guide

This project is configured for **Automatic Deployment** using a combination of **Jenkins**, **GitHub Webhooks**, and **Docker Compose**.

---

## 🏗️ 1. Deployment Architecture

1.  **Developer Pushes Code**: A developer pushes to the `develop` branch on GitHub.
2.  **GitHub Webhook**: GitHub sends a notification (ping) to our Jenkins server at `http://103.219.1.138:8081/github-webhook/`.
3.  **Jenkins Build Trigger**: Jenkins receives the ping, detects new commits, and starts a build of the **`jalsampada-ui-deploy`** job.
4.  **Automatic Deployment**: Jenkins runs the `Jenkinsfile` instructions (Build -> Deploy -> Cleanup) directly on this server.

---

## 📜 2. Key Files & Their Roles

### `Jenkinsfile` (The Automator)
This file tells Jenkins exactly what to do step-by-step:
*   **Checkout**: Pulls the newest code from the server's local folder.
*   **Build**: Uses Docker Compose to build the production-ready image.
*   **Deploy**: Recreates the container with the newest code using `--force-recreate`.
*   **Cleanup**: Automatically prunes old Docker images to save disk space.

### `Dockerfile` (The Blueprint)
*   Uses **Bun 1.1** for extremely fast installations and builds.
*   Creates a "Standalone" Next.js build, which is very lightweight and efficient for production.

### `docker-compose.yml` (The Manager)
*   Defines the service name (`jalsampada-ui`).
*   Maps internal port **4000** to the public world.
*   Ensures the app **starts automatically** even if the server reboots (`restart: always`).

---

## 🛠️ 3. Troubleshooting & Permissions

If the build fails with an **Access Denied** or **Permission Error**, ensure the `jenkins` user is correctly added to the system groups:

```bash
# Add jenkins to erpadmin and docker groups
sudo usermod -aG erpadmin,docker jenkins

# Ensure git trusts the directory (Security fix)
sudo -u jenkins git config --global --add safe.directory /home/erpadmin/bench-Jalsampada/apps/Jalsampada_ui

# Restart for changes to take effect
sudo systemctl restart jenkins
```

---

## 🔄 4. How to Update the App
Simply push your changes to GitHub:
```bash
git push origin develop
```
Jenkins will take care of the rest!
