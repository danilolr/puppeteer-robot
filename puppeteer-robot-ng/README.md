# Puppeteer Robot NG

This project is an Angular-based frontend application for managing and controlling Puppeteer robots. It communicates with a backend service (Puppeteer Robot API) to execute automation tasks, manage robot instances, and handle file uploads.

## Features

- **Robot Management**: Create and delete Puppeteer robot instances.
- **Task Execution**: Send commands to robots to run specific automation tasks.
- **Monitoring**: View robot status and information.
- **File Management**: Upload and delete files required for automation.
- **Screenshots**: Capture screenshots from the robot instances.
- **Real-time Updates**: Uses WebSockets (Socket.io) for real-time communication.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd puppeteer-robot-ng
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

The application configuration is located in `src/assets/config.json`. You can adjust the API URL and other settings here:

```json
{
    "production": false,
    "envName": "dev",
    "apiUrl": "http://localhost:3000",
    "wsPath": "http://localhost:3000",
    "version": "1.0.0",
    "apiToken": "your-api-token"
}
```

- **apiUrl**: The URL of the Puppeteer Robot API.
- **wsPath**: The URL for the WebSocket connection.
- **apiToken**: Token for API authentication.

## Running the Application

Run the following command to start the development server:

```bash
npm start
```

Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Building via Docker

The project includes Docker configuration files in the `docker/` directory.

To build the Docker image, you can use the provided script or standard docker commands:

```bash
cd docker
./build.sh
```

## Tech Stack

- **Framework**: [Angular](https://angular.io/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Real-time Communication**: [Socket.io Client](https://socket.io/)
- **API Client**: Generated via OpenAPI Generator

## Project Structure

- `src/app/api`: Contains the generated API client code.
- `src/app/page`: Angular components representing different pages (Start, About, Send Command).
- `src/app/service`: Services for API communication, configuration, and WebSockets.
- `src/app/template`: Layout templates.
