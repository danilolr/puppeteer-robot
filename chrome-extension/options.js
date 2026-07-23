const DEFAULT_SERVER_URL = 'http://localhost:3000';
const SERVER_URL_STORAGE_KEY = 'serverUrl';
const POOL_STORAGE_KEY = 'pool';

const form = document.querySelector('#settingsForm');
const serverUrlInput = document.querySelector('#serverUrl');
const poolInput = document.querySelector('#pool');
const connectionStatus = document.querySelector('#connectionStatus');
const instanceId = document.querySelector('#instanceId');
const poolStatus = document.querySelector('#poolStatus');
const refreshStatus = document.querySelector('#refreshStatus');
const restoreDefault = document.querySelector('#restoreDefault');
const message = document.querySelector('#message');

await loadSettings();
await updateStatus();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const serverUrl = cleanServerUrl(serverUrlInput.value);
  if (!serverUrl) {
    showMessage('Informe uma URL http ou https valida.', true);
    return;
  }

  await chrome.storage.local.set({ [SERVER_URL_STORAGE_KEY]: serverUrl });
  await chrome.storage.local.set({ [POOL_STORAGE_KEY]: cleanPool(poolInput.value) ?? '' });
  serverUrlInput.value = serverUrl;
  poolInput.value = cleanPool(poolInput.value) ?? '';
  showMessage('Servidor salvo. A extensao vai reconectar automaticamente.');
  await updateStatus();
});

refreshStatus.addEventListener('click', () => {
  void updateStatus();
});

restoreDefault.addEventListener('click', async () => {
  await chrome.storage.local.set({ [SERVER_URL_STORAGE_KEY]: DEFAULT_SERVER_URL });
  await chrome.storage.local.set({ [POOL_STORAGE_KEY]: '' });
  serverUrlInput.value = DEFAULT_SERVER_URL;
  poolInput.value = '';
  showMessage('Servidor padrao restaurado.');
  await updateStatus();
});

async function loadSettings() {
  const stored = await chrome.storage.local.get([SERVER_URL_STORAGE_KEY, POOL_STORAGE_KEY]);
  serverUrlInput.value = cleanServerUrl(stored[SERVER_URL_STORAGE_KEY]) ?? DEFAULT_SERVER_URL;
  poolInput.value = cleanPool(stored[POOL_STORAGE_KEY]) ?? '';
}

async function updateStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'MCP_GET_STATUS' });
    connectionStatus.textContent = status?.connected
      ? `Conectado (${status.socketId})`
      : 'Desconectado';
    instanceId.textContent = status?.instanceId ?? '-';
    poolStatus.textContent = status?.pool || 'none';

    if (status?.serverUrl) {
      serverUrlInput.value = status.serverUrl;
    }
    poolInput.value = status?.pool || '';
  } catch (error) {
    connectionStatus.textContent = 'Indisponivel';
    instanceId.textContent = '-';
    poolStatus.textContent = '-';
    showMessage(errorMessage(error), true);
  }
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

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
