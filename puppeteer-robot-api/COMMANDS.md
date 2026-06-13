# Puppeteer Robot Commands

This document describes command examples that can be sent to a robot through:

- REST: `PUT /puppeteer-robot/run`
- MCP: `run_command`
- Angular UI: `Send Command to Robot`

The examples below come from the Angular modal `Send Command to Robot`.

For MCP agents, prefer the dedicated MCP tools such as `navigate`, `type`, `click`, `get_html`, `run_javascript_on_page`, and `upload_file_to_input`. Use `run_command` only as an escape hatch when a specific tool does not cover the workflow.

## Execution Context

Commands are executed inside an async function created by the API. The command has access to:

- `browser`: the active Puppeteer `Browser`.
- `page`: the latest opened Puppeteer `Page`.
- `filePath(hash)`: helper that resolves an uploaded file path from its upload hash.
- `downloadUrl(url, options)`: helper that downloads a URL through the API server and returns file metadata.

Because the command body is already inside an async function, you can use `await` directly.

Do not wrap commands in an async IIFE such as `(async () => { ... })()`. The API already creates the async wrapper. If an agent sends an IIFE without `return await`, the outer command may finish with `undefined` while the inner promise keeps running in the background, which can produce uncaught asynchronous errors.

Wrong:

```js
(async () => {
  await page.goto('https://google.com')
  return await page.title()
})()
```

Correct:

```js
await page.goto('https://google.com')
return await page.title()
```

If an IIFE is unavoidable, it must be returned and awaited:

```js
return await (async () => {
  await page.goto('https://google.com')
  return await page.title()
})()
```

Example request:

```json
{
  "robotId": "robot-id",
  "command": "await page.goto('https://google.com')"
}
```

If the command returns a value, it is returned in the API response `data` field.

```json
{
  "status": "OK",
  "data": "returned value"
}
```

If the command throws a JavaScript exception, the API returns:

```json
{
  "status": "JAVASCRIPT_EXCEPTION_ERROR",
  "message": "error message",
  "data": null
}
```

If the command returns an object with `ok: false`, the API returns `FUNCTION_RETURN_ERROR`.

The enum value in the API is named `FUNCTION_RETURN_ERROR`. If you see references to `FUNCTION_RESULT_ERROR`, they are referring to this same controlled-result error behavior, but the implemented status name is `FUNCTION_RETURN_ERROR`.

### Controlled Function Error

Use a controlled function error when the JavaScript command executes successfully, but the automation logic wants to report a failed result.

Example command:

```js
return await page.evaluate(() => {
  return {ok: false, message: "My Error Message"};
})
```

This command does not throw a JavaScript exception. `page.evaluate` runs successfully and returns an object. However, because the returned object has `ok: false`, the API maps the result to `FUNCTION_RETURN_ERROR`.

API response:

```json
{
  "status": "FUNCTION_RETURN_ERROR",
  "message": "My Error Message",
  "data": {
    "ok": false,
    "message": "My Error Message"
  }
}
```

Use this pattern when the command itself can validate the page state and return a structured failure.

For comparison, this command throws an exception:

```js
throw new Error("My Error Message")
```

That returns:

```json
{
  "status": "JAVASCRIPT_EXCEPTION_ERROR",
  "message": "My Error Message",
  "data": null
}
```

In short:

- `FUNCTION_RETURN_ERROR`: the command returned `{ ok: false, message: "..." }`.
- `JAVASCRIPT_EXCEPTION_ERROR`: the command threw an exception.

## Command Examples

### Navigate to a Website

Opens a URL in the robot browser page.

```js
await page.goto('https://google.com')
```

Use this as the first command after creating a robot when the current page is still blank.

Example with returned title:

```js
await page.goto('https://google.com')
return await page.title()
```

---

### Set Field Value

Types text into an input element selected by CSS selector.

```js
await page.type('input[name="password"]', '123456')
```

This uses Puppeteer's `page.type`, which sends keyboard events. The element must exist and be editable.

In MCP, the `type` tool validates that the selected element is visible. If the element exists but is hidden, it returns a controlled error. Use `set_value` or `run_javascript_on_page` when the field exists in the DOM but is not directly visible/interactable.

Common variations:

```js
await page.type('input[name="email"]', 'user@example.com')
```

```js
await page.type('#password', '123456')
```

If the element may take time to appear, wait for it first:

```js
await page.waitForSelector('input[name="password"]')
await page.type('input[name="password"]', '123456')
```

---

### Button Click

Clicks a button selected by CSS selector.

```js
await page.click('button[type="submit"]')
```

Use this for submitting forms or activating page controls.

If the click triggers navigation, combine it with `page.waitForNavigation`:

```js
await Promise.all([
  page.waitForNavigation(),
  page.click('button[type="submit"]')
])
```

---

### Wait for Navigation

Waits until the current page finishes a navigation event.

```js
await page.waitForNavigation()
```

This is useful after clicks, form submissions, or JavaScript actions that navigate to another page.

With timeout:

```js
await page.waitForNavigation({ timeout: 30000 })
```

With a click:

```js
await Promise.all([
  page.waitForNavigation(),
  page.click('button[type="submit"]')
])
```

---

### Get HTML

Returns the current page HTML.

```js
const data = await page.evaluate(() => document.querySelector('*').outerHTML);
return data;
```

The returned HTML is sent in the API response `data` field.

Equivalent shorter command:

```js
return await page.content()
```

Use this when you need to inspect the page structure before choosing selectors.

---

### Use Uploaded File in a File Input

Resolves a previously uploaded file hash internally and uses it with a page file input.

The hash comes from:

```text
POST /puppeteer-robot/file/upload
```

Example upload response:

```json
{
  "ok": true,
  "hash": "3467be4be524b5151d060be3b6db03273ee77f2b"
}
```

Use `filePath(hash)` only as an internal helper inside `run_command`; do not return or expose the resolved server path.

```js
const fp = filePath('3467be4be524b5151d060be3b6db03273ee77f2b')
const input = await page.$('input[type="file"]')
await input.uploadFile(fp)
return { ok: true }
```

For MCP agents, prefer `upload_file_to_input` instead of resolving or exposing server filesystem details.

If the hash does not exist, `filePath(hash)` returns an empty string.

---

### Set Field on Page Context

Runs JavaScript inside the browser page context and sets a field value directly through the DOM.

When using MCP, prefer the dedicated `run_javascript_on_page` tool for this pattern. With that tool, send only the JavaScript body that should run inside the page:

```js
document.getElementsByName('q')[0].value = 'Puppeteer'
return { ok: true }
```

The lower-level `run_command` form still works, but it must explicitly call `page.evaluate`:

```js
return await page.evaluate(() => {
  document.getElementsByName('q')[0].value = 'Puppeteer';
  return {ok: true};
})
```

This differs from `page.type`:

- `page.type` simulates keyboard input.
- `page.evaluate` changes the DOM directly inside the browser.

Some pages listen for `input` or `change` events. If setting `.value` alone is not enough, dispatch events manually:

```js
return await page.evaluate(() => {
  const input = document.getElementsByName('q')[0]
  input.value = 'Puppeteer'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return { ok: true }
})
```

---

### Download the First PDF Link

Finds the first PDF link in the current page, downloads it through the API server, and returns metadata plus a download URL.

```js
const firstPdfUrl = await page.evaluate(() => {
  const link = document.querySelector('a.orders[href$=".pdf"], a[href$=".pdf"]')
  return link ? link.href : null
})

if (!firstPdfUrl) {
  return { ok: false, message: 'No PDF link found on page' }
}

const file = await downloadUrl(firstPdfUrl)

return {
  ok: true,
  file
}
```

Example response data:

```json
{
  "ok": true,
  "file": {
    "ok": true,
    "fileId": "f7c2b29d-8a76-4c6e-9df1-8fef233f15b3",
    "fileName": "YHeLSxW26NB5l8G3.pdf",
    "mimeType": "application/pdf",
    "size": 123456,
    "sourceUrl": "http://site.com/orders/6h25op4f/07wly13g/YHeLSxW26NB5l8G3.pdf",
    "downloadUrl": "/puppeteer-robot/file/download/f7c2b29d-8a76-4c6e-9df1-8fef233f15b3"
  }
}
```

When `fileName` is not provided, the helper resolves the file name from `Content-Disposition` or from the URL path. The helper sends the current page cookies, user agent, and referer when downloading the URL. This helps with files protected by the current browser session.

## Sending Commands with REST

```bash
curl -sS -X PUT http://localhost:3000/puppeteer-robot/run \
  -H 'Authorization: Bearer your-api-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "robotId": "robot-id",
    "command": "await page.goto('\''https://google.com'\'')"
  }'
```

For local development without `API_TOKEN`, remove the `Authorization` header.

## Sending Commands with MCP

Use the MCP tool:

```text
run_command
```

Tool arguments:

```json
{
  "robotId": "robot-id",
  "command": "await page.goto('https://google.com')"
}
```

## Practical Workflow

1. Create a robot.
2. Navigate to the target page.
3. Take a screenshot or get HTML.
4. Identify selectors.
5. Send commands such as `page.type`, `page.click`, or `page.evaluate`.
6. Wait for navigation or page changes when needed.
7. Return values from commands when the caller needs structured data.

Example:

```js
await page.goto('https://google.com')
await page.waitForSelector('textarea[name="q"], input[name="q"]')
return await page.evaluate(() => document.title)
```

## Safety Notes

Commands execute arbitrary JavaScript with access to the current Puppeteer browser and page. Treat command execution as privileged access.

Recommended precautions:

- Use `API_TOKEN` outside local development.
- Expose the API only to trusted clients.
- Avoid running unknown commands.
- Prefer explicit selectors and bounded waits.
- Return small structured objects instead of large page dumps when possible.
