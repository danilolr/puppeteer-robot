# Puppeteer Robot Chrome Extension Backend

Unpacked Chrome extension used by `puppeteer-robot-api` as the `chrome-extension` automation backend.

The extension connects to the API through Socket.IO, registers itself as an available browser session, publishes active tab metadata, and executes commands sent by the backend.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked".
4. Select this `chrome-extension` directory.

The extension connects to `http://localhost:3000` by default.

Open the extension options to configure:

- server URL;
- optional pool name.

## Session Visibility

When the extension connects successfully, the API registers a session keyed by the extension `instanceId`.

Connected sessions are returned by:

```text
GET /puppeteer-robot/list
```

They also appear in the Angular UI with backend `Chrome Extension`. A connected extension can appear as `IDLE` before it is reserved by `create`.

## Reserving a Session

After the extension is connected, reserve it from the API:

```bash
curl -X POST http://localhost:3000/puppeteer-robot/create \
  -H 'Content-Type: application/json' \
  -d '{"backend":"chrome-extension","pool":"my-pool"}'
```

The response returns a `robotId`, which is the extension `instanceId`.

Use the same automation operations as a Puppeteer robot:

```bash
curl -X PUT http://localhost:3000/puppeteer-robot/run \
  -H 'Content-Type: application/json' \
  -d '{
    "robotId": "ext_replace_with_reserved_instance",
    "command": "return { url: window.location.href, title: document.title }"
  }'
```

Release the extension back to the pool:

```bash
curl -X DELETE http://localhost:3000/puppeteer-robot/delete/ext_replace_with_reserved_instance
```

`delete` does not close Chrome or unload the extension. It only marks the session as idle.

## Execution Context

Commands sent to a Chrome extension robot run in the selected Chrome tab page context. They can use browser page globals such as `window`, `document`, `localStorage`, and page-side `fetch`.

Puppeteer-only objects and helpers are not available in this backend:

- `page`
- `browser`
- `filePath(hash)`
- `downloadUrl(url, options)`

Screenshots are not supported by the extension backend yet.

## Socket.IO Events

The extension sends these events to the API:

- `extension:register`: registers or refreshes the extension session.
- `extension:tab:update`: publishes active tab metadata.
- `extension:tabs:update`: publishes the known tab list.
- `extension:heartbeat`: refreshes the session `lastSeenAt`.

The API emits `updateList` to UI clients when extension sessions register, update tab metadata, or disconnect.
