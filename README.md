**Live demo Site**: http://103.219.3.169:2225
**User** : test_user@gmail.com
**Password** : Test@123
**For testing purpose only**


# Jalsampada - Water Resource Department ERP Frontend

A specialized Next.js 15 application designed for the Water Resource Department (Jalsampada) to manage assets, tenders, operations, and maintenance. This project serves as a modern frontend interface for a **Frappe/ERPNext** custom backend.

## 🚀 Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites
* **Node.js**: Version 18 or higher.
* **npm** or **yarn**: Package manager.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd jalsampada-ui
    ```

2.  **Install dependencies:**
    ```bash
    npm install --legacy-peer-deps
    ```
    *Note: The `--legacy-peer-deps` flag is recommended due to potential dependency conflicts with some React 19/Next.js 15 packages.*

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

4.  **Open the application:**
    Visit `http://localhost:3000` in your browser.

### Build for Production
```bash
npm run build
npm start
```

� React ↔ Frappe Integration Guide
Since this is a custom ERP, the React components are designed to "mimic" native Frappe behaviors (like DocTypes, Link Fields, and Child Tables). Here is how the key components communicate with the backend:

1. DynamicFormComponent.tsx (The "DocType" Handler)
This component is the React equivalent of a DocType Form in Frappe.

Connection: It handles the main form logic.

Fetch From Logic: It mimics Frappe's "Fetch From" behavior. For example, if you select a User, it watches that field change and immediately calls the API to auto-populate related fields (like Email) without user intervention.

Submission: It gathers all data and sends it in the exact JSON structure Frappe expects.

2. LinkField.tsx (The "Foreign Key" Searcher)
In Frappe, a "Link" field lets you select a record from another table (e.g., a "Customer").

The Problem: You cannot load thousands of records into a dropdown at once.

The Solution: This is a "Smart Dropdown". As the user types, it waits 300ms (debouncing) and then fires a specific search request to the backend filters (e.g., ["name", "like", "%John%"]).

Result: It allows users to search through massive databases efficiently.

3. TableField.tsx (The "Child Table" Manager)
Frappe uses "Child Tables" for lists of items (like "Items" in an Invoice).

How it works: React doesn't natively know what a "Child Table" is. This component manages these lists as an Array of Objects in the local state.

Data Flow: When you click "Add Row", it updates the local React state only. The data is only sent to the backend when the Main Form is saved, matching Frappe's transactional behavior.

4. FrappeErrorDisplay.tsx (The Translator)
Frappe often returns error messages containing raw HTML (e.g., Value missing for <a href="...">Field</a>).

The Fix: This component parses that raw HTML string and converts the anchor tags into safe, clickable Next.js links. This ensures error messages are readable and the links actually work within your custom app.

5. Workspace.tsx (The Desk/Module View)
This mimics the "Desk" view in Frappe.

Function: It serves as the standard layout for every module (like Assets, Tender, HR).

Organization: It groups DocTypes into "Masters" (Configuration Data) and "Transactions" (Daily Operations), using color-coding (Green/Blue) to help users navigate quickly.

🏗️ Project Structure
This project is built using the Next.js App Router.

app/: Contains the routes/pages of the application.

components/: Reusable UI elements (Workspace, ui/ folder for shadcn/ui components).

lib/: Utility functions and sample data (sample-data.ts).

types/: TypeScript interfaces for strict typing.

Key Page Components
Dashboard (app/page.tsx): The main entry point displaying high-level metrics (Active Pumps, Flow Rate, etc.) calculated from live data.

Module Pages: Specific landing pages for modules like app/lis-management/ and app/tender/, configured via the Workspace component.

🛠️ Technologies Used
Framework: Next.js 15 (App Router)

Language: TypeScript

Styling: Tailwind CSS

UI Library: Radix UI

Icons: Lucide React & FontAwesome

Forms: React Hook Form + Zod Validation

## 🚀 Production Deployment

The application is currently hosted live at **http://103.219.3.169:2225** using PM2 as the process manager for continuous operation.

### PM2 Configuration (ecosystem.config.js)
The application runs under PM2 with the following configuration:
- **App Name**: `jalsampada`
- **Script**: `npm start`
- **Working Directory**: `/home/erpadmin/bench-Jalsampada/apps/Jalsampada_ui`
- **Instances**: 1 (fork mode)
- **Memory Limit**: 2GB (auto-restart on limit)
- **Environment**: Production mode
- **Port**: 4000
- **Host**: 103.219.1.138
- **Logging**: Separate error, output, and combined logs in `/logs/` directory

### Nginx Configuration (nginx.conf)
Nginx acts as a reverse proxy with the following setup:
- **Server**: 103.219.1.138:80
- **Proxy Target**: localhost:4000
- **WebSocket Support**: Enabled for real-time features
- **Headers**: Proper forwarding of IP and protocol information
- **Cache Bypass**: Configured for dynamic content

### Deployment Commands
```bash
# Start/restart the application with PM2
pm2 start ecosystem.config.js
pm2 restart jalsampada

# Monitor the application
pm2 monit

# View logs
pm2 logs jalsampada

# Reload Nginx configuration
sudo nginx -t
sudo systemctl reload nginx
```

### Live URL
**🌐 http://103.219.3.169:2225**
