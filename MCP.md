# Puppeteer Robot MCP

This project exposes the NestJS backend as a Model Context Protocol (MCP) server.

The MCP implementation runs inside the same NestJS process as the REST API and calls the same `RobotService` used by `RobotController`. Because of that, MCP tools and REST endpoints share the same in-memory Puppeteer robot instances.

## Endpoint

The MCP server is available through Streamable HTTP at:

```text
http://localhost:3000/puppeteer-robot/mcp
```

The endpoint supports:

- `POST /puppeteer-robot/mcp` for JSON-RPC MCP requests.
- `GET /puppeteer-robot/mcp` for MCP server-to-client streams when a client opens one.
- `DELETE /puppeteer-robot/mcp` for session termination.

## Authentication

The MCP endpoint is handled by the same NestJS application and global `AuthGuard` used by the REST API.

If `API_TOKEN` is configured and `DEV_MODE` is not `true`, MCP clients must send:

```text
Authorization: Bearer <API_TOKEN>
```

If `DEV_MODE=true` or `API_TOKEN` is not configured, requests are allowed without authentication.

## Command Logs

When `LOGS_PATH` is configured, selected MCP command tools write one JSON log file per call.

Logged MCP tools:

- `run_command`
- `run_javascript_on_page`
- `navigate`
- `type`
- `set_value`
- `click`

Files are grouped by robot and browser session:

```text
LOGS_PATH/<robotId>/<sessionId>/<tool-name>-<timestamp>-<uuid>.json
```

The session ID is derived from the Puppeteer instance creation timestamp. Path separators and other unsafe characters are replaced with `_`.

Each log file includes the operation name, robot ID, session ID, request payload, response payload, duration, and error details when the operation throws.

## Exposed Tools

### Robot Lifecycle

#### `get_version`

Returns the backend API version.

Input: none.

#### `create_robot`

Creates a Puppeteer robot instance.

Input:

```json
{
  "pool": "optional-pool-name"
}
```

#### `list_robots`

Lists active Puppeteer robot instances.

Input: none.

#### `delete_robot`

Deletes or releases a Puppeteer robot instance.

Input:

```json
{
  "robotId": "robot-id"
}
```

### Page Navigation and Interaction

#### `navigate`

Navigates the robot page to a URL and returns the resulting URL and title.

Input:

```json
{
  "robotId": "robot-id",
  "url": "https://example.com",
  "waitUntil": "networkidle2",
  "timeoutMs": 30000
}
```

`waitUntil` is optional and accepts `load`, `domcontentloaded`, `networkidle0`, or `networkidle2`.

#### `type`

Types text into an editable element.

The tool validates that the element exists and is visible. If the selector matches an element that is hidden, the tool returns a controlled error instead of trying to type into it.

Input:

```json
{
  "robotId": "robot-id",
  "selector": "input[name=\"email\"]",
  "text": "user@example.com",
  "clearBefore": true,
  "timeoutMs": 30000
}
```

#### `set_value`

Sets a form field value directly in the page DOM and dispatches events.

Input:

```json
{
  "robotId": "robot-id",
  "selector": "input[name=\"email\"]",
  "value": "user@example.com",
  "dispatchEvents": ["input", "change"],
  "timeoutMs": 30000
}
```

#### `click`

Clicks an element selected by CSS selector. It can optionally wait for navigation caused by the click.

Input:

```json
{
  "robotId": "robot-id",
  "selector": "button[type=\"submit\"]",
  "waitForNavigation": true,
  "waitUntil": "networkidle2",
  "timeoutMs": 30000
}
```

#### `wait_for_navigation`

Waits for the current robot page to finish navigation.

Input:

```json
{
  "robotId": "robot-id",
  "waitUntil": "networkidle2",
  "timeoutMs": 30000
}
```

### Page Inspection

#### `get_html`

Returns the current page HTML, URL, and title.

Input:

```json
{
  "robotId": "robot-id"
}
```

#### `get_text`

Returns visible text from the page or from a selected element.

Input:

```json
{
  "robotId": "robot-id",
  "selector": "main"
}
```

If `selector` is omitted, the tool returns `document.body.innerText`.

#### `page_info`

Returns lightweight information about the current page.

Input:

```json
{
  "robotId": "robot-id"
}
```

Response data includes the current URL, title, and number of open pages.

#### `inspect_interactive_elements`

Returns a compact structured inventory of interactive elements from the current page, without returning the full HTML.

Input:

```json
{
  "robotId": "robot-id",
  "onlyVisible": true,
  "includeIframes": true,
  "maxIframeDepth": 2,
  "maxItems": 50,
  "maxTextLength": 120
}
```

The result includes:

- current page URL and title;
- `frames` with `framePath`, URL, name, and `frameSelectorHint`;
- forms, inputs, textareas, selects, buttons, links, labels, and duplicate IDs;
- `selectorHint` for each element;
- visibility/interactivity flags;
- bounding boxes;
- truncation metadata.

For elements inside iframes, `selectorHint` is relative to that iframe. Use `framePath`, `frameUrl`, `frameName`, and `frameSelectorHint` to identify the frame context. A main-page element has `framePath: []`; an element in the first iframe has `framePath: [0]`; nested iframe paths look like `[0, 2]`.

This tool is the preferred way for MCP agents to discover fields, buttons, links, and selectors before choosing tools such as `type`, `set_value`, `click`, or `run_javascript_on_page`.

#### `take_screenshot`

Takes a PNG screenshot from the active robot page.

Input:

```json
{
  "robotId": "robot-id"
}
```

On success, the tool returns MCP image content:

```json
{
  "type": "image",
  "data": "base64-png-data",
  "mimeType": "image/png"
}
```

### Files and Downloads

#### `upload_file_to_input`

Uploads a previously uploaded server file to a page `input[type=file]`.

Input:

```json
{
  "robotId": "robot-id",
  "selector": "input[type=\"file\"]",
  "hash": "upload-hash",
  "timeoutMs": 30000
}
```

#### `download_url`

Downloads a URL through the API server using the current page cookies, user agent, and referer.

Input:

```json
{
  "robotId": "robot-id",
  "url": "https://example.com/report.pdf",
  "fileName": "report.pdf"
}
```

The `fileName` field is optional. The response contains a `fileId` that can be used with `get_file`.

#### `get_file`

Returns a previously downloaded file as MCP embedded resource content with base64 data.

Input:

```json
{
  "fileId": "downloaded-file-id"
}
```

The result includes:

- MCP `resource` content with `blob` base64 data and the file MIME type.
- JSON text/structured output with `fileId`, `fileName`, `mimeType`, and `size`.

### Escape Hatch

#### `run_command`

Runs arbitrary JavaScript against an active Puppeteer robot page.

Input:

```json
{
  "robotId": "robot-id",
  "command": "await page.goto('https://example.com')"
}
```

This tool can execute arbitrary JavaScript in the Puppeteer context. Prefer the specific tools above for common actions, and expose this tool only to trusted MCP clients.

Important: do not wrap the command in an async IIFE like `(async () => { ... })()`. The API already runs the command inside an async function, so commands should use `await` directly:

```js
await page.goto('https://example.com')
return await page.title()
```

If an IIFE is sent without `return await`, the outer command can finish before the inner promise settles, causing uncaught asynchronous errors.

#### `run_javascript_on_page`

Runs JavaScript inside the browser page context. Use this when the script needs direct access to `window`, `document`, DOM APIs, `localStorage`, or `fetch` from the page.

Input:

```json
{
  "robotId": "robot-id",
  "script": "document.getElementsByName('q')[0].value = 'Puppeteer'; return { ok: true };",
  "args": {
    "selector": "input[name=\"q\"]",
    "value": "Puppeteer"
  },
  "timeoutMs": 30000
}
```

The script is executed as an async function body inside `page.evaluate`. Use `await` directly and return serializable values.

Correct:

```js
const input = document.querySelector(args.selector)
input.value = args.value
input.dispatchEvent(new Event('input', { bubbles: true }))
input.dispatchEvent(new Event('change', { bubbles: true }))
return { ok: true }
```

Do not wrap the script in `(async () => { ... })()`. The wrapper is already created by the backend.

This tool does not expose Puppeteer objects such as `page`, `browser`, `downloadUrl`, or `filePath`. Use `run_command` only when those backend-side Puppeteer objects are required.

## Example MCP Client Configuration

For clients that support remote MCP servers over Streamable HTTP, configure the server URL as:

```json
{
  "mcpServers": {
    "puppeteer-robot": {
      "type": "http",
      "url": "http://localhost:3000/puppeteer-robot/mcp",
      "headers": {
        "Authorization": "Bearer your-api-token"
      }
    }
  }
}
```

If the API is running in development mode without `API_TOKEN`, omit the `headers` block:

```json
{
  "mcpServers": {
    "puppeteer-robot": {
      "type": "http",
      "url": "http://localhost:3000/puppeteer-robot/mcp"
    }
  }
}
```

The exact client configuration file location depends on the MCP client. Use this server entry in the client's MCP configuration section.

## Manual Smoke Test

Initialize a session:

```bash
curl -i -sS -X POST http://localhost:3000/puppeteer-robot/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer your-api-token' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": {
        "name": "curl-test",
        "version": "1.0.0"
      }
    }
  }'
```

Copy the `mcp-session-id` response header and use it to list tools:

```bash
curl -i -sS -X POST http://localhost:3000/puppeteer-robot/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer your-api-token' \
  -H 'Mcp-Session-Id: <mcp-session-id>' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

Call the version tool:

```bash
curl -i -sS -X POST http://localhost:3000/puppeteer-robot/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer your-api-token' \
  -H 'Mcp-Session-Id: <mcp-session-id>' \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_version",
      "arguments": {}
    }
  }'
```

For local development without `API_TOKEN`, remove the `Authorization` header from the commands above.

## Implementation Files

- `puppeteer-robot-api/src/mcp/mcp.controller.ts`
- `puppeteer-robot-api/src/mcp/mcp.service.ts`
- `puppeteer-robot-api/src/app.module.ts`
