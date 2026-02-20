# Puppeteer Robot

A web-based automation platform powered by [Puppeteer](https://pptr.dev/), built with a **NestJS** backend API and an **Angular** frontend.

## Overview

This monorepo contains two projects:

| Project | Directory | Description | Tech Stack |
|---|---|---|---|
| **API** | `puppeteer-robot-api/` | Backend REST API with WebSocket support | NestJS 11, Puppeteer Core, Socket.IO |
| **Frontend** | `puppeteer-robot-ng/` | Web interface for managing automation tasks | Angular 20, Tailwind CSS, Socket.IO Client |

### Key Features

- Browser automation via Puppeteer (headless Chromium)
- Real-time communication through WebSockets
- AI integration with Groq, Ollama and Gemini APIs
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
   - **API** at [http://localhost:3000](http://localhost:3000/puppeteer-robot/api/v1/swagger)
   - **Frontend** at [http://localhost:8080](http://localhost:8080)

3. **Stop the services:**

   ```bash
   docker compose down
   ```

### Exposed Ports

| Service | Container Port | Host Port | URL |
|---|---|---|---|
| API (NestJS) | 3000 | 3000 | `http://localhost:3000/puppeteer-robot/api/v1/swagger` |
| Frontend (Angular/Nginx) | 80 | 8080 | `http://localhost:8080` |

### Environment Variables (API)

The following environment variables are configured in `docker-compose.yml`:

| Variable | Description |
|---|---|
| `TEMP_FILE_PATH` | Temporary file storage path inside the container |
| `GROQ_API_KEY` | API key for Groq AI integration |
| `GEMINI_API_KEY` | API key for Google Gemini AI integration |
| `OLLAMA_API_URL` | Ollama URL for Ollama integration |
| `API_TOKEN` | Authentication token for the API |


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

The Angular dev server will start on port `4200` by default.

---

## Project Structure

```
puppeteer-robot/
├── docker-compose.yml              # Docker Compose orchestration
├── README.md
├── puppeteer-robot-api/             # NestJS backend
│   ├── docker/
│   │   ├── Dockerfile.amd64
│   │   └── Dockerfile.arm64
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
