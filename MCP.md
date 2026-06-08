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

## Exposed Tools

### `puppeteer_robot_version`

Returns the backend API version.

Calls:

```ts
robotService.version()
```

### `puppeteer_robot_create`

Creates a Puppeteer robot instance.

Input:

```json
{
  "pool": "optional-pool-name"
}
```

Calls:

```ts
robotService.create(pool ?? null)
```

### `puppeteer_robot_list`

Lists active Puppeteer robot instances.

Calls:

```ts
robotService.list()
```

### `puppeteer_robot_delete`

Deletes or releases a Puppeteer robot instance.

Input:

```json
{
  "robotId": "robot-id"
}
```

Calls:

```ts
robotService.delete(robotId)
```

### `puppeteer_robot_run_command`

Runs JavaScript against an active Puppeteer robot page.

Input:

```json
{
  "robotId": "robot-id",
  "command": "await page.goto('https://example.com')"
}
```

Calls:

```ts
robotService.run({ robotId, command })
```

This tool can execute arbitrary JavaScript in the Puppeteer context. Expose it only to trusted MCP clients.

### `puppeteer_robot_screenshot`

Takes a screenshot from an active Puppeteer robot page.

Input:

```json
{
  "robotId": "robot-id"
}
```

Calls:

```ts
robotService.screenshot(robotId)
```

On success, the tool returns MCP image content:

```json
{
  "type": "image",
  "data": "base64-png-data",
  "mimeType": "image/png"
}
```

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
      "name": "puppeteer_robot_version",
      "arguments": {}
    }
  }'
```

For local development without `API_TOKEN`, remove the `Authorization` header from the commands above.

## Implementation Files

- `puppeteer-robot-api/src/mcp/mcp.controller.ts`
- `puppeteer-robot-api/src/mcp/mcp.service.ts`
- `puppeteer-robot-api/src/app.module.ts`

