# Puppeteer Robot

A web-based browser automation platform with two automation backends: [Puppeteer](https://pptr.dev/) managed Chromium instances and connected Chrome extension sessions. It is built with a **NestJS** backend API and an **Angular** frontend.

## Overview

This monorepo contains two projects:

| Project | Directory | Description | Tech Stack |
|---|---|---|---|
| **API** | `puppeteer-robot-api/` | Backend REST/MCP API with Puppeteer and Chrome extension backends | NestJS 11, Puppeteer Core, Socket.IO |
| **Frontend** | `puppeteer-robot-ng/` | Web interface for managing automation tasks | Angular 20, Tailwind CSS, Socket.IO Client |

### Key Features

- Browser automation via Puppeteer-managed Chromium
- Browser automation via connected Chrome extension sessions
- UI listing with the backend used by each robot/session
- Real-time communication through WebSockets
- MCP tools for browser automation agents
- Swagger API documentation

---

## Getting Started with Docker Compose

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on your machine.

### Running the Application

1. **Clone the repository** and navigate to the project root:

   ```bash
   git clone <repository-url>
   cd puppeteer-robot
   ```

2. **Start both services** with Docker Compose:

   ```bash
   docker compose up --build
   ```

   This will build and start:
   - **API** at [http://localhost:3080/puppeteer-robot/api/v1/swagger](http://localhost:3080/puppeteer-robot/api/v1/swagger)
   - **Frontend** at [http://localhost:4221](http://localhost:4221)

3. **Test** :

   - Open **UI** at [http://localhost:4221](http://localhost:4221)
   - Click on "New Robot", set a optional pool name and "Create Robot"
   - Click on "Send Command" and choose the "Navigate to a website" example. Click "Send Command".
   - Click on "Screenshot" to see the loaded page
   - Click on "Send Command" and choose the "Set field on page context" example. Click "Send Command".
   - Click on "Screenshot" to see the value on the search field
   - Click on "Send Command" and type "page.keyboard.type("\n");" on the command. Click "Send Command".
   - Click on "Screenshot" to see the search result

4. **Stop the services:**

   ```bash
   docker compose down
   ```

### Exposed Ports

| Service | Container Port | Host Port | URL |
|---|---|---|---|
| API (NestJS) | 3000 | 3080 | `http://localhost:3080/puppeteer-robot/api/v1/swagger` |
| Frontend (Angular/Nginx) | 80 | 4221 | `http://localhost:4221` |

### Environment Variables (API)

The API accepts the following environment variables:

| Variable | Description |
|---|---|
| `TEMP_FILE_PATH` | Temporary file storage path inside the container |
| `LOGS_PATH` | Optional base directory for logged Puppeteer command calls, grouped by `<robotId>/<sessionId>` |
| `API_TOKEN` | Authentication token for the API |

When `LOGS_PATH` is set, command logs are written as:

```text
LOGS_PATH/<robotId>/<sessionId>/<operation>-<timestamp>-<uuid>.json
```

Logged operations include `run_command`, `run_javascript_on_page`, `navigate`, `type`, `set_value`, `click`, and `capture_file_from_action`.

### Automation Backends

The default backend is `puppeteer`. The legacy endpoint still creates or acquires a Puppeteer robot:

```bash
curl -X POST http://localhost:3000/puppeteer-robot/create/none
```

To reserve a connected Chrome extension session, load `chrome-extension` as an unpacked Chrome extension and configure its server URL and optional pool. Then create a robot with:

```bash
curl -X POST http://localhost:3000/puppeteer-robot/create \
  -H 'Content-Type: application/json' \
  -d '{"backend":"chrome-extension","pool":"my-pool"}'
```

For `ChromeExtensionBackend`, `create` reserves an idle connected extension session and `delete` releases it back to the pool. It does not open or close the user's Chrome browser.

Connected extension sessions are also returned by `/puppeteer-robot/list` and appear in the Angular UI with backend `Chrome Extension`. The list can include idle extension sessions that have connected but have not yet been reserved by `create`.

The Chrome extension backend executes JavaScript in the active Chrome tab context. It does not expose Puppeteer objects such as `page` or `browser`, and screenshots are not supported by this backend yet.

For Puppeteer robots, file downloads can use `downloadUrl(url)` when the URL is known, or `captureFileFromAction(...)` / MCP `capture_file_from_action` when a click or browser action produces the file.

### Angular Configuration

The frontend configuration is managed via `puppeteer-robot-ng/docker/config.json`, which is mounted into the Nginx container at `/usr/share/nginx/html/assets/config.json`. Update this file to change the API URL or other frontend settings.

---

## Local Development (without Docker)

### API

```bash
cd puppeteer-robot-api
npm install
npm run start:dev
```

The API will start on port `3000` by default.

### Frontend

```bash
cd puppeteer-robot-ng
npm install
npm start
```

The Angular dev server will start on port `4221` by default.

---

## Project Structure

```
puppeteer-robot/
├── docker-compose.yml              # Docker Compose orchestration
├── README.md
├── chrome-extension/                # Unpacked Chrome extension backend
├── puppeteer-robot-api/             # NestJS backend
│   ├── docker/
│   │   └── Dockerfile
│   ├── src/
│   └── package.json
└── puppeteer-robot-ng/              # Angular frontend
    ├── docker/
    │   ├── Dockerfile
    │   └── config.json             # Angular config for Docker
    ├── src/
    └── package.json
```

## License

[MIT](LICENSE)
