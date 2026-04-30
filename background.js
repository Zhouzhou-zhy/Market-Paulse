const SIDEBAR_STATE_KEY = 'sidebarState';
const TOKEN_KEY = 'jin10_api_token';

const defaultSidebarState = {
  visible: true,
  width: 380
};

const connectedPorts = new Set();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(SIDEBAR_STATE_KEY, (result) => {
    if (!result[SIDEBAR_STATE_KEY]) {
      chrome.storage.local.set({ [SIDEBAR_STATE_KEY]: defaultSidebarState });
    }
  });
  flashPoller.start();
});

chrome.runtime.onStartup.addListener(() => {
  flashPoller.start();
});

class Jin10FlashPoller {
  constructor() {
    this.seenIds = new Set();
    this.cachedFlash = [];
    this.interval = null;
    this.apiUrl = 'https://flash-api.jin10.com/get_flash_list?channel=-8200&vip=1';
  }

  async fetchFlash() {
    try {
      const response = await fetch(this.apiUrl, {
        headers: {
          'x-app-id': 'bVBF4FyRTn5NJF5n',
          'x-version': '1.0.0'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      const items = (json && json.data) || [];

      const newItems = items.filter((item) => {
        if (!item || !item.id) return false;
        if (this.seenIds.has(item.id)) return false;
        if (item.extras && item.extras.ad) return false;
        if (!item.data || !item.data.content || String(item.data.content).trim() === '') return false;
        return true;
      });

      for (const item of newItems) {
        this.seenIds.add(item.id);
      }

      if (this.seenIds.size > 2000) {
        const arr = Array.from(this.seenIds);
        this.seenIds = new Set(arr.slice(arr.length - 1000));
      }

      if (newItems.length > 0) {
        this.cachedFlash = [...newItems, ...this.cachedFlash].slice(0, 500);
        this.broadcastFlashUpdate(newItems);
        console.log(`[Jin10FlashPoller] 获取到 ${newItems.length} 条新快讯`);
      }
    } catch (err) {
      console.error('[Jin10FlashPoller] fetch error:', err.message || err);
    }
  }

  start(intervalMs = 15000) {
    this.stop();
    console.log('[Jin10FlashPoller] 开始轮询快讯数据');
    this.fetchFlash();
    this.interval = setInterval(() => this.fetchFlash(), intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  broadcastFlashUpdate(newItems) {
    const msg = { type: 'FLASH_UPDATE', payload: newItems };
    for (const port of connectedPorts) {
      try {
        port.postMessage(msg);
      } catch (e) {}
    }
  }
}

const flashPoller = new Jin10FlashPoller();

flashPoller.start();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'jin10-sidebar') {
    connectedPorts.add(port);
    console.log(`[Background] Port 已连接，当前连接数: ${connectedPorts.size}`);

    port.onDisconnect.addListener(() => {
      connectedPorts.delete(port);
      console.log(`[Background] Port 已断开，当前连接数: ${connectedPorts.size}`);
    });

    port.onMessage.addListener((message, portRef) => {
      handlePortMessage(message, portRef);
    });
  }
});

function handlePortMessage(message, port) {
  const { type, requestId } = message;
  switch (type) {
    case 'GET_FLASH':
      try {
        port.postMessage({
          type: 'FLASH_DATA',
          payload: flashPoller.cachedFlash,
          requestId
        });
      } catch (e) {}
      break;

    case 'GET_INDICES': {
      chrome.storage.local.get(TOKEN_KEY, (result) => {
        try {
          port.postMessage({
            type: 'INDICES_DATA',
            payload: null,
            hasToken: !!result[TOKEN_KEY],
            requestId
          });
        } catch (e) {}
      });
      break;
    }

    case 'GET_COMMODITIES': {
      chrome.storage.local.get(TOKEN_KEY, (result) => {
        try {
          port.postMessage({
            type: 'COMMODITIES_DATA',
            payload: null,
            hasToken: !!result[TOKEN_KEY],
            requestId
          });
        } catch (e) {}
      });
      break;
    }

    default:
      break;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SIDEBAR_STATE':
      chrome.storage.local.get(SIDEBAR_STATE_KEY, (result) => {
        sendResponse(result[SIDEBAR_STATE_KEY] || defaultSidebarState);
      });
      return true;

    case 'SET_SIDEBAR_STATE':
      chrome.storage.local.set({ [SIDEBAR_STATE_KEY]: message.payload });
      propagateStateToTabs(message.payload);
      sendResponse({ success: true });
      return true;

    case 'TOGGLE_SIDEBAR': {
      chrome.storage.local.get(SIDEBAR_STATE_KEY, (result) => {
        const current = result[SIDEBAR_STATE_KEY] || defaultSidebarState;
        const newState = { ...current, visible: !current.visible };
        chrome.storage.local.set({ [SIDEBAR_STATE_KEY]: newState });
        propagateStateToTabs(newState);
        sendResponse(newState);
      });
      return true;
    }

    default:
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
});

function propagateStateToTabs(state) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id && tab.url && tab.url.startsWith('http')) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'STATE_UPDATED',
          payload: state
        }).catch(() => {});
      }
    });
  });
}

function toggleSidebar() {
  chrome.storage.local.get(SIDEBAR_STATE_KEY, (result) => {
    const current = result[SIDEBAR_STATE_KEY] || defaultSidebarState;
    const newState = { ...current, visible: !current.visible };
    chrome.storage.local.set({ [SIDEBAR_STATE_KEY]: newState });
    propagateStateToTabs(newState);
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-sidebar') {
    toggleSidebar();
  }
});

chrome.action.onClicked.addListener(() => {
  toggleSidebar();
});
