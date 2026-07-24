# Puppeteer Robot API

A NestJS-based REST and MCP API service designed to manage and control browser automation sessions remotely. The API supports Puppeteer-managed Chromium instances and connected Chrome extension sessions.

## Features

- **Browser Management**: Create, list, and destroy Puppeteer browser instances on demand.
- **Chrome Extension Backend**: Register connected Chrome extension sessions and reserve them as automation robots.
- **Remote Execution**: Send commands to control browser behavior via a RESTful interface.
- **File Handling**: Upload and manage files required for automation tasks.
- **Screenshots**: Capture screenshots of active Puppeteer browser sessions.
- **Real-time Updates**: WebSocket support (Socket.IO) for real-time status updates and communication.
- **Swagger Documentation**: Integrated Swagger UI for easy API exploration and testing.
- **Docker Ready**: Includes Docker support for easy containerized deployment.

## Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- [npm](https://www.npmjs.com/)
- [Docker](https://www.docker.com/) (Optional, for containerized execution)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd puppeteer-robot-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Create a `.env` file in the root directory (if not already present).
   - Ensure the `TEMP_FILE_PATH` variable is set if you are not using the default setup.
   - Optionally set `LOGS_PATH` to write JSON logs for Puppeteer command calls grouped by `<robotId>/<sessionId>`.

When `LOGS_PATH` is set, logs for `run_command`, `run_javascript_on_page`, `navigate`, `type`, `set_value`, `click`, and `capture_file_from_action` are written as:

```text
LOGS_PATH/<robotId>/<sessionId>/<operation>-<timestamp>-<uuid>.json
```

## Running the Application

### Local Development

To start the application in development mode with hot-reload:

```bash
npm run start:dev
```

To run in standard mode:

```bash
npm run start
```

### Production

To build and run the application in production mode:

```bash
npm run build
npm run start:prod
```

### Docker

You can build and run the application using the provided scripts in the `docker/` directory.

Build the image:
```bash
./docker/build.sh
```

Run the container:
```bash
./docker/run.sh
```

## API Documentation

Once the application is running, you can access the interactive Swagger API documentation at:

```
http://localhost:3000/puppeteer-robot/api/v1/swagger
```

### Key Endpoints

- **GET** `/puppeteer-robot/version`: Check the API version.
- **POST** `/puppeteer-robot/create/:pool`: Create a Puppeteer browser instance or reserve a Chrome extension session with `backend=chrome-extension`.
- **POST** `/puppeteer-robot/create`: Structured create/reserve endpoint accepting `backend`, `pool`, and `instanceId`.
- **PUT** `/puppeteer-robot/run`: Execute a command on a specific instance.
- **MCP** `capture_file_from_action`: Capture a file produced by a Puppeteer click/action.
- **GET** `/puppeteer-robot/screenshot/:id`: Take a screenshot of an active Puppeteer session.
- **GET** `/puppeteer-robot/list`: List active Puppeteer instances and connected Chrome extension sessions. Each item includes `backend`.
- **DELETE** `/puppeteer-robot/delete/:id`: Terminate a Puppeteer browser instance or release a Chrome extension session.
- **POST** `/puppeteer-robot/file/upload`: Upload files for automation use.

## WebSocket Events

The application exposes a WebSocket gateway for real-time events.
- **Event**: `updateList` - Triggered when the list of robot instances changes, including extension registration/disconnection and tab metadata updates.
- **Event**: `message` - General purpose message handling.

## License

This project is UNLICENSED.
