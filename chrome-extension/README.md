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
