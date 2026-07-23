(() => {
  if (globalThis.__mcpChromeRemoteExecutorLoaded) {
    return;
  }

  globalThis.__mcpChromeRemoteExecutorLoaded = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'MCP_EXECUTE_COMMAND') {
      return false;
    }

    executeCommand(message)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          commandId: message.commandId,
          status: 'error',
          error: errorMessage(error),
        }),
      );

    return true;
  });

  async function executeCommand(message) {
    const code = message.code;

    if (typeof code !== 'string' || code.trim().length === 0) {
      return {
        commandId: message.commandId,
        status: 'error',
        error: 'code must be a non-empty string',
      };
    }

    try {
      const fn = new Function(`return (async () => {\n${code}\n})();`);
      const result = await fn();

      return {
        commandId: message.commandId,
        status: 'success',
        ...serialize(result),
      };
    } catch (error) {
      return {
        commandId: message.commandId,
        status: 'error',
        error: errorMessage(error),
      };
    }
  }

  function serialize(value) {
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;

    if (value === undefined) {
      return { result: null, resultType: 'undefined' };
    }

    if (
      value === null ||
      type === 'string' ||
      type === 'number' ||
      type === 'boolean'
    ) {
      return { result: value, resultType: type };
    }

    if (value instanceof Element) {
      return {
        result: {
          tagName: value.tagName,
          id: value.id,
          className: value.className,
          textContent: value.textContent?.slice(0, 500) ?? '',
        },
        resultType: 'element',
      };
    }

    try {
      return { result: JSON.parse(JSON.stringify(value)), resultType: type };
    } catch {
      return { result: String(value), resultType: type };
    }
  }

  function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
  }
})();
