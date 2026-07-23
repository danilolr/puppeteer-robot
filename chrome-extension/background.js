import { io } from './vendor/socket.io.esm.min.js';

const DEFAULT_SERVER_URL = 'http://localhost:3000';
const SERVER_URL_STORAGE_KEY = 'serverUrl';
const POOL_STORAGE_KEY = 'pool';
const EXTENSION_VERSION = '0.1.0';
const DEFAULT_TIMEOUT_MS = 10000;

let socket;
let instanceId;
let serverUrl = DEFAULT_SERVER_URL;
let pool = null;

start();

async function start() {
  instanceId = await getOrCreateInstanceId();
  serverUrl = await getServerUrl();
  pool = await getPool();
  connectSocket();
}

function connectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io(serverUrl, {
    transports: ['websocket'],
    upgrade: false,
    reconnection: true,
    auth: {
      instanceId,
      instanceName: `chrome-${instanceId.slice(0, 8)}`,
      extensionId: chrome.runtime.id,
      version: EXTENSION_VERSION,
      pool,
    },
  });

  socket.on('connect', () => {
    registerExtension();
    publishActiveTab();
    publishTabs();
  });

  socket.on('execute:command', (payload, ack) => {
    handleExecuteCommand(payload)
      .then((result) => ack?.(result))
      .catch((error) =>
        ack?.({
          commandId: payload?.commandId,
          status: 'error',
          error: errorMessage(error),
        }),
      );
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'MCP_GET_STATUS') {
    return false;
  }

  sendResponse({
    instanceId,
    serverUrl,
    pool,
    connected: Boolean(socket?.connected),
    socketId: socket?.id ?? null,
  });
  return false;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || (!changes[SERVER_URL_STORAGE_KEY] && !changes[POOL_STORAGE_KEY])) {
    return;
  }

  const nextServerUrl = changes[SERVER_URL_STORAGE_KEY]
    ? cleanServerUrl(changes[SERVER_URL_STORAGE_KEY].newValue)
    : serverUrl;
  const nextPool = changes[POOL_STORAGE_KEY]
    ? cleanPool(changes[POOL_STORAGE_KEY].newValue)
    : pool;
  const serverChanged = Boolean(nextServerUrl && nextServerUrl !== serverUrl);
  const poolChanged = nextPool !== pool;

  if (!serverChanged && !poolChanged) {
    return;
  }

  if (serverChanged) {
    serverUrl = nextServerUrl;
  }
  if (poolChanged) {
    pool = nextPool;
  }
  connectSocket();
});

chrome.tabs.onActivated.addListener(() => {
  publishActiveTab();
  publishTabs();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    publishActiveTab();
    publishTabs();
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  publishActiveTab();
  publishTabs();
});

setInterval(() => {
  if (socket?.connected) {
    socket.emit('extension:heartbeat');
  }
}, 20000);

async function handleExecuteCommand(payload) {
  const commandId = payload?.commandId;
  const code = payload?.code;

  if (typeof code !== 'string' || code.trim().length === 0) {
    return {
      commandId,
      status: 'error',
      error: 'code must be a non-empty string',
    };
  }

  const tab = await resolveTargetTab(payload?.target);
  if (!tab?.id) {
    return {
      commandId,
      status: 'error',
      error: 'No target tab found',
    };
  }

  const timeoutMs = normalizeTimeout(payload?.timeoutMs);
  const executionWorld = payload?.executionWorld === 'main' ? 'main' : 'isolated';

  try {
    const result =
      executionWorld === 'main'
        ? await executeInMainWorld(tab.id, code, timeoutMs)
        : await executeInContentScript(tab.id, code, commandId, timeoutMs);

    return {
      commandId,
      ...result,
      tab: serializeTab(tab),
    };
  } catch (error) {
    return {
      commandId,
      status: 'error',
      error: errorMessage(error),
      tab: serializeTab(tab),
    };
  }
}

async function executeInContentScript(tabId, code, commandId, timeoutMs) {
  const message = {
    type: 'MCP_EXECUTE_COMMAND',
    commandId,
    code,
    timeoutMs,
  };

  try {
    return await withTimeout(chrome.tabs.sendMessage(tabId, message), timeoutMs);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });

    return withTimeout(chrome.tabs.sendMessage(tabId, message), timeoutMs);
  }
}

async function executeInMainWorld(tabId, code, timeoutMs) {
  const results = await withTimeout(
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: runCodeInPage,
      args: [code],
    }),
    timeoutMs,
  );

  return (
    results?.[0]?.result ?? {
      status: 'error',
      error: 'No execution result returned from page',
    }
  );
}

function runCodeInPage(code) {
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

  try {
    const fn = new Function(`return (async () => {\n${code}\n})();`);
    return Promise.resolve(fn())
      .then((result) => ({
        status: 'success',
        ...serialize(result),
      }))
      .catch((error) => ({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      }));
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function resolveTargetTab(target) {
  if (target?.type === 'tabId' && Number.isInteger(target.tabId)) {
    return chrome.tabs.get(target.tabId);
  }

  const activeCurrentWindow = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (activeCurrentWindow[0]) {
    return activeCurrentWindow[0];
  }

  const activeFocusedWindow = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  return activeFocusedWindow[0];
}

async function getOrCreateInstanceId() {
  const stored = await chrome.storage.local.get('instanceId');
  if (typeof stored.instanceId === 'string' && stored.instanceId.length > 0) {
    return stored.instanceId;
  }

  const nextInstanceId = `ext_${crypto.randomUUID()}`;
  await chrome.storage.local.set({ instanceId: nextInstanceId });
  return nextInstanceId;
}

async function getServerUrl() {
  const stored = await chrome.storage.local.get(SERVER_URL_STORAGE_KEY);
  const configuredUrl = cleanServerUrl(stored[SERVER_URL_STORAGE_KEY]);

  if (configuredUrl) {
    return configuredUrl;
  }

  await chrome.storage.local.set({ [SERVER_URL_STORAGE_KEY]: DEFAULT_SERVER_URL });
  return DEFAULT_SERVER_URL;
}

async function getPool() {
  const stored = await chrome.storage.local.get(POOL_STORAGE_KEY);
  return cleanPool(stored[POOL_STORAGE_KEY]);
}

function cleanServerUrl(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value.trim().replace(/\/+$/, '');
  if (!cleaned) {
    return null;
  }

  try {
    const url = new URL(cleaned);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function cleanPool(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 && cleaned !== 'none' ? cleaned : null;
}

function registerExtension() {
  socket.emit('extension:register', {
    instanceId,
    instanceName: `chrome-${instanceId.slice(0, 8)}`,
    extensionId: chrome.runtime.id,
    version: EXTENSION_VERSION,
    pool,
  });
}

async function publishActiveTab() {
  if (!socket?.connected) {
    return;
  }

  try {
    const tab = await resolveTargetTab({ type: 'activeTab' });
    if (tab) {
      socket.emit('extension:tab:update', serializeTab(tab));
    }
  } catch (error) {
    console.warn('Could not publish active tab', error);
  }
}

async function publishTabs() {
  if (!socket?.connected) {
    return;
  }

  try {
    const tabs = await chrome.tabs.query({});
    socket.emit('extension:tabs:update', tabs.map(serializeTab));
  } catch (error) {
    console.warn('Could not publish tabs', error);
  }
}

function serializeTab(tab) {
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    active: tab.active,
    windowId: tab.windowId,
  };
}

function normalizeTimeout(value) {
  const timeout = Number(value);
  if (!Number.isFinite(timeout)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(Math.max(Math.trunc(timeout), 1000), 60000);
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function isMissingReceiverError(error) {
  return errorMessage(error).includes('Receiving end does not exist');
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
