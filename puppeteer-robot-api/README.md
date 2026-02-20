# Puppeteer Robot API

A robust NestJS-based REST API service designed to manage and control Puppeteer browser instances remotely. This service allows you to spawn ephemeral browser sessions, execute automation commands, handle file uploads, and retrieve screenshots via simple HTTP requests.

## Features

- **Browser Management**: Create, list, and destroy Puppeteer browser instances on demand.
- **Remote Execution**: Send commands to control browser behavior via a RESTful interface.
- **File Handling**: Upload and manage files required for automation tasks.
- **Screenshots**: Capture instant screenshots of active browser sessions.
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
- **POST** `/puppeteer-robot/create/:pool`: Create a new browser instance.
- **PUT** `/puppeteer-robot/run`: Execute a command on a specific instance.
- **GET** `/puppeteer-robot/screenshot/:id`: Take a screenshot of an active session.
- **GET** `/puppeteer-robot/list`: List all active robot instances.
- **DELETE** `/puppeteer-robot/delete/:id`: Terminate a specific browser instance.
- **POST** `/puppeteer-robot/file/upload`: Upload files for automation use.

## WebSocket Events

The application exposes a WebSocket gateway for real-time events.
- **Event**: `updateList` - Triggered when the list of robot instances changes.
- **Event**: `message` - General purpose message handling.

## License

This project is UNLICENSED.
