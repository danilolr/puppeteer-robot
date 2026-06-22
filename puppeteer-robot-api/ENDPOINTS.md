# Puppeteer Robot API Endpoints

This document describes the HTTP endpoints exposed by `puppeteer-robot-api`.

The API is implemented with NestJS and exposes:

- REST endpoints under `/puppeteer-robot`.
- Swagger documentation under `/puppeteer-robot/api/v1/swagger`.
- MCP Streamable HTTP endpoint under `/puppeteer-robot/mcp`.
- Socket.IO events for real-time updates.

## Base URL

Local development default:

```text
http://localhost:3000
```

Docker Compose default:

```text
http://localhost:3000
```

## Authentication

All REST endpoints in `RobotController` use `AuthGuard`.

If `API_TOKEN` is configured and `DEV_MODE` is not `true`, requests must include:

```text
Authorization: Bearer <API_TOKEN>
```

If `DEV_MODE=true` or `API_TOKEN` is not configured, requests are allowed without authentication.

Example:

```bash
curl -sS http://localhost:3000/puppeteer-robot/version \
  -H 'Authorization: Bearer your-api-token'
```

## Common Response Types

### `RobotCommandResp`

Used by command execution and screenshot endpoints.

```json
{
  "status": "OK",
  "message": "optional message",
  "data": {}
}
```

Possible `status` values:

```text
OK
INTERNAL_ERROR
ROBOT_NOT_FOUND
JAVASCRIPT_EXCEPTION_ERROR
FUNCTION_RETURN_ERROR
```

### `RobotCreateResp`

Used when creating or acquiring a robot instance.

```json
{
  "ok": true,
  "robotId": "uuid",
  "isFromPool": false,
  "message": "optional message",
  "errorCode": "optional error code"
}
```

### `RobotInfo`

Used when listing active robots.

```json
{
  "robotId": "uuid",
  "pool": "pool-name",
  "createdAt": "2026-06-07T10:00:00.000Z",
  "status": "BUSY",
  "errorInfo": {}
}
```

Possible `status` values:

```text
IDLE
BUSY
ERROR
```

## REST Endpoints

### `GET /puppeteer-robot/version`

Returns the API version from `package.json`.

#### Response

```text
1.7.0
```

#### Example

```bash
curl -sS http://localhost:3000/puppeteer-robot/version \
  -H 'Authorization: Bearer your-api-token'
```

---

### `POST /puppeteer-robot/create/:pool`

Creates a new Puppeteer robot instance or reuses an idle instance from the requested pool.

If `pool` is `none` or an empty string, the robot is created without a pool.

#### Path Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `pool` | string | yes | Pool name, or `none` for no pool. |

#### Behavior

- If `pool` is provided and an idle robot exists in that pool, that robot is marked as `BUSY` and returned.
- If no idle robot exists in that pool, a new Puppeteer instance is created.
- If no pool is used, a new Puppeteer instance is created.
- The API emits the WebSocket event `updateList` after successful creation.

#### Response

```json
{
  "ok": true,
  "robotId": "b6e8e947-ae84-4e8f-9c40-7794ef35f56f",
  "isFromPool": false
}
```

#### Example

Create without pool:

```bash
curl -sS -X POST http://localhost:3000/puppeteer-robot/create/none \
  -H 'Authorization: Bearer your-api-token'
```

Create or acquire from pool:

```bash
curl -sS -X POST http://localhost:3000/puppeteer-robot/create/default \
  -H 'Authorization: Bearer your-api-token'
```

---

### `PUT /puppeteer-robot/run`

Runs JavaScript against the latest page of an active Puppeteer robot instance.

The command body is inserted into an async function and executed with access to:

- `page`: the current Puppeteer page.
- `browser`: the Puppeteer browser.
- `filePath(hash)`: helper that resolves uploaded file paths by upload hash.

This endpoint executes arbitrary JavaScript. Use it only in trusted environments.

#### Request Body

```json
{
  "robotId": "b6e8e947-ae84-4e8f-9c40-7794ef35f56f",
  "command": "await page.goto('https://example.com'); return await page.title();"
}
```

#### Response

Successful command:

```json
{
  "status": "OK",
  "data": "Example Domain"
}
```

Robot not found:

```json
{
  "status": "ROBOT_NOT_FOUND",
  "message": "Instance not found b6e8e947-ae84-4e8f-9c40-7794ef35f56f",
  "data": null
}
```

JavaScript exception:

```json
{
  "status": "JAVASCRIPT_EXCEPTION_ERROR",
  "message": "error message",
  "data": null
}
```

If the command returns an object with `ok: false`, the API maps it to `FUNCTION_RETURN_ERROR`.

#### Example

```bash
curl -sS -X PUT http://localhost:3000/puppeteer-robot/run \
  -H 'Authorization: Bearer your-api-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "robotId": "b6e8e947-ae84-4e8f-9c40-7794ef35f56f",
    "command": "await page.goto('\''https://example.com'\''); return await page.title();"
  }'
```

---

### `PUT /puppeteer-robot/error`

Reports an error for a robot instance and marks it as `ERROR`.

This endpoint expects `payload.description` to contain a JSON string with a `robotId` field. The service uses that nested `robotId` to find the instance.

#### Request Body

```json
{
  "robotId": "request-robot-id",
  "payload": {
    "errorCode": "AUTOMATION_FAILED",
    "message": "Automation failed",
    "description": "{\"robotId\":\"b6e8e947-ae84-4e8f-9c40-7794ef35f56f\",\"errorCode\":\"AUTOMATION_FAILED\",\"message\":\"Automation failed\",\"details\":\"Could not complete the automation.\"}"
  }
}
```

#### Response

```json
{
  "status": "OK"
}
```

#### Example

```bash
curl -sS -X PUT http://localhost:3000/puppeteer-robot/error \
  -H 'Authorization: Bearer your-api-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "robotId": "request-robot-id",
    "payload": {
      "errorCode": "AUTOMATION_FAILED",
      "message": "Automation failed",
      "description": "{\"robotId\":\"b6e8e947-ae84-4e8f-9c40-7794ef35f56f\",\"errorCode\":\"AUTOMATION_FAILED\",\"message\":\"Automation failed\",\"details\":\"Could not complete the automation.\"}"
    }
  }'
```

---

### `GET /puppeteer-robot/screenshot/:id`

Takes a full-page screenshot from an active robot.

The response `data` field is a base64-encoded PNG image.

#### Path Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Robot ID. |

#### Response

```json
{
  "status": "OK",
  "data": "iVBORw0KGgoAAAANSUhEUg..."
}
```

#### Example

```bash
curl -sS http://localhost:3000/puppeteer-robot/screenshot/b6e8e947-ae84-4e8f-9c40-7794ef35f56f \
  -H 'Authorization: Bearer your-api-token'
```

To save the screenshot manually from the JSON response, decode the `data` field as base64.

---

### `GET /puppeteer-robot/list`

Lists all active robot instances currently held in memory.

Robot instances are not persisted. Restarting the API clears the list.

#### Response

```json
[
  {
    "robotId": "b6e8e947-ae84-4e8f-9c40-7794ef35f56f",
    "pool": "default",
    "createdAt": "2026-06-07T10:00:00.000Z",
    "status": "BUSY",
    "errorInfo": null
  }
]
```

#### Example

```bash
curl -sS http://localhost:3000/puppeteer-robot/list \
  -H 'Authorization: Bearer your-api-token'
```

---

### `DELETE /puppeteer-robot/delete/:id`

Deletes or releases a robot instance.

#### Path Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `id` | string | yes | Robot ID. |

#### Behavior

- If the robot has no pool, the browser is closed and the instance is removed.
- If the robot belongs to a pool and is `BUSY`, it is marked as `IDLE` instead of being closed.
- If the robot belongs to a pool and is `IDLE` or `ERROR`, it is closed and removed.
- The API emits the WebSocket event `updateList` after deletion/release.

#### Response

```json
true
```

If the robot is not found:

```json
false
```

#### Example

```bash
curl -sS -X DELETE http://localhost:3000/puppeteer-robot/delete/b6e8e947-ae84-4e8f-9c40-7794ef35f56f \
  -H 'Authorization: Bearer your-api-token'
```

---

### `POST /puppeteer-robot/file/upload`

Uploads a file for later use by robot commands.

The uploaded file is stored under:

```text
${TEMP_FILE_PATH}/upload/<sha1-hash>/<original-file-name>
```

A `metadata.json` file is also written in the same upload directory.

Commands can resolve the uploaded file path with:

```js
const path = filePath('<upload-hash>')
```

#### Content Type

```text
multipart/form-data
```

#### Form Fields

| Name | Type | Required | Description |
|---|---|---:|---|
| `file` | file | yes | File to upload. Maximum size: 10 MB. |

#### Response

```json
{
  "ok": true,
  "hash": "3467be4be524b5151d060be3b6db03273ee77f2b"
}
```

#### Example

```bash
curl -sS -X POST http://localhost:3000/puppeteer-robot/file/upload \
  -H 'Authorization: Bearer your-api-token' \
  -F 'file=@/path/to/file.pdf'
```

---

### `DELETE /puppeteer-robot/file/delete/:hash`

Deletes an uploaded file by hash.

Current implementation returns `true`, but does not remove files from disk.

#### Path Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `hash` | string | yes | Upload hash returned by `file/upload`. |

#### Response

```json
true
```

#### Example

```bash
curl -sS -X DELETE http://localhost:3000/puppeteer-robot/file/delete/3467be4be524b5151d060be3b6db03273ee77f2b \
  -H 'Authorization: Bearer your-api-token'
```

---

### `GET /puppeteer-robot/file/download/:fileId`

Downloads a file previously saved by the command helper `downloadUrl(url, options)`.

Downloaded files are stored under:

```text
${TEMP_FILE_PATH}/download/<fileId>/
```

The directory contains:

```text
metadata.json
<downloaded-file>
```

#### Path Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `fileId` | string | yes | Downloaded file ID returned by `downloadUrl`. |

#### Response

Returns the binary file with:

```text
Content-Type: <metadata mimeType>
Content-Disposition: attachment; filename="<metadata fileName>"
```

If the file does not exist:

```json
{
  "ok": false,
  "message": "Downloaded file not found"
}
```

#### Example

```bash
curl -sS http://localhost:3000/puppeteer-robot/file/download/f7c2b29d-8a76-4c6e-9df1-8fef233f15b3 \
  -H 'Authorization: Bearer your-api-token' \
  -o document.pdf
```

---

## MCP Endpoint

### `/puppeteer-robot/mcp`

The MCP endpoint exposes selected API capabilities as MCP tools through Streamable HTTP.

Supported HTTP methods:

| Method | Description |
|---|---|
| `POST` | Handles JSON-RPC MCP requests. |
| `GET` | Handles MCP stream connections for an existing MCP session. |
| `DELETE` | Handles MCP session termination. |

See the root `MCP.md` file for detailed MCP usage and client configuration.

Exposed MCP tools:

```text
get_version
create_robot
list_robots
delete_robot
navigate
type
set_value
click
wait_for_navigation
get_html
get_text
page_info
inspect_interactive_elements
upload_file_to_input
download_url
get_file
run_command
run_javascript_on_page
take_screenshot
```

## Swagger

Swagger UI is available at:

```text
http://localhost:3000/puppeteer-robot/api/v1/swagger
```

It documents the REST controller routes and DTO schemas.

## WebSocket Events

The API exposes a Socket.IO gateway.

Default Socket.IO URL:

```text
http://localhost:3000
```

### Server Events

#### `updateList`

Emitted when the robot list should be refreshed.

Currently emitted after:

- creating a robot;
- deleting or releasing a robot;
- reporting robot errors.

Payload:

```json
{}
```

### Client Events

#### `message`

General-purpose message event.

Client sends:

```json
"hello"
```

Server broadcasts:

```json
{
  "clientId": "socket-id",
  "message": "hello",
  "timestamp": "2026-06-07T10:00:00.000Z"
}
```

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | HTTP port. Defaults to `3000`. |
| `TEMP_FILE_PATH` | Base directory for temporary upload files. |
| `DEV_MODE` | If `true`, disables auth and launches local Chrome in non-headless mode. |
| `API_TOKEN` | Bearer token required when not in development mode. |
