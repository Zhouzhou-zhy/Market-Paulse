(function () {
  'use strict';

  if (document.getElementById('jin10-sidebar-root')) return;

  let sidebarState = { visible: true, width: 380 };
  let port = null;
  let iframeEl = null;
  const pendingRequests = new Map();

  const sidebarUrl = chrome.runtime.getURL('sidebar/sidebar.html');

  function connectToBackground() {
    port = chrome.runtime.connect({ name: 'jin10-sidebar' });
    console.log('[ContentScript] 已连接到 Background Service Worker');

    port.onMessage.addListener((message) => {
      handleBackgroundMessage(message);
    });

    port.onDisconnect.addListener(() => {
      console.log('[ContentScript] Port 断开，尝试重连...');
      port = null;
      setTimeout(connectToBackground, 3000);
    });
  }

  function handleBackgroundMessage(message) {
    if (!message) return;

    if (message.type === 'FLASH_UPDATE') {
      console.log(`[ContentScript] 转发 FLASH_UPDATE 到 sidebar，${message.payload ? message.payload.length : 0} 条新快讯`);
      postToSidebar(message);
      return;
    }

    if (message.requestId && pendingRequests.has(message.requestId)) {
      const { resolve } = pendingRequests.get(message.requestId);
      pendingRequests.delete(message.requestId);
      resolve(message);
      return;
    }

    postToSidebar(message);
  }

  function postToSidebar(data) {
    if (iframeEl && iframeEl.contentWindow) {
      try {
        iframeEl.contentWindow.postMessage(data, '*');
      } catch (e) {
        console.warn('[ContentScript] postMessage 到 sidebar 失败:', e.message);
      }
    }
  }

  function sendToBackground(message) {
    if (port) {
      try {
        port.postMessage(message);
      } catch (e) {
        console.warn('[ContentScript] port.postMessage 失败:', e.message);
      }
    }
  }

  function sendToBackgroundWithResponse(message) {
    return new Promise((resolve) => {
      if (!port) {
        resolve({ type: 'ERROR', payload: 'No port connection', requestId: message.requestId });
        return;
      }
      pendingRequests.set(message.requestId, { resolve, ts: Date.now() });
      try {
        port.postMessage(message);
      } catch (e) {
        pendingRequests.delete(message.requestId);
        resolve({ type: 'ERROR', payload: e.message, requestId: message.requestId });
      }
      setTimeout(() => {
        if (pendingRequests.has(message.requestId)) {
          pendingRequests.delete(message.requestId);
          resolve({ type: 'ERROR', payload: 'Timeout', requestId: message.requestId });
        }
      }, 10000);
    });
  }

  function injectSidebar() {
    const container = document.createElement('jin10-sidebar-host');
    container.id = 'jin10-sidebar-root';
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: ${sidebarState.width}px;
      height: 100vh;
      z-index: 2147483646;
      border: none;
      background: transparent;
      pointer-events: auto;
      transition: transform 0.3s ease;
      transform: ${sidebarState.visible ? 'translateX(0)' : `translateX(${sidebarState.width}px)`};
    `;

    iframeEl = document.createElement('iframe');
    iframeEl.id = 'jin10-sidebar-iframe';
    iframeEl.src = sidebarUrl;
    iframeEl.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      outline: none;
      background: #ffffff;
    `;

    container.appendChild(iframeEl);
    document.body.appendChild(container);

    if (sidebarState.visible) {
      document.documentElement.style.marginRight = sidebarState.width + 'px';
      document.documentElement.style.transition = 'margin-right 0.3s ease';
    }
  }

  function toggleSidebar(visible) {
    sidebarState.visible = visible;
    const host = document.getElementById('jin10-sidebar-root');
    if (host) {
      if (visible) {
        host.style.transform = 'translateX(0)';
        document.documentElement.style.marginRight = sidebarState.width + 'px';
      } else {
        host.style.transform = `translateX(${sidebarState.width}px)`;
        document.documentElement.style.marginRight = '0px';
      }
    }
  }

  function updateWidth(width) {
    sidebarState.width = width;
    const host = document.getElementById('jin10-sidebar-root');
    if (host) {
      host.style.width = width + 'px';
      if (sidebarState.visible) {
        document.documentElement.style.marginRight = width + 'px';
      } else {
        host.style.transform = `translateX(${width}px)`;
      }
    }
  }

  connectToBackground();

  chrome.runtime.sendMessage({ type: 'GET_SIDEBAR_STATE' }, (state) => {
    if (state) {
      sidebarState = state;
    }
    injectSidebar();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STATE_UPDATED') {
      sidebarState = message.payload;
      toggleSidebar(sidebarState.visible);
    }
  });

  window.addEventListener('message', async (event) => {
    if (event.source !== iframeEl?.contentWindow) return;

    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'TOGGLE') {
      const newVisible = !sidebarState.visible;
      toggleSidebar(newVisible);
      chrome.runtime.sendMessage({ type: 'SET_SIDEBAR_STATE', payload: { visible: newVisible, width: sidebarState.width } });
      return;
    }

    if (msg.type === 'RESIZE') {
      updateWidth(msg.payload.width);
      chrome.runtime.sendMessage({ type: 'SET_SIDEBAR_STATE', payload: { visible: sidebarState.visible, width: msg.payload.width } });
      return;
    }

    if (msg.type === 'GET_FLASH' || msg.type === 'GET_INDICES' || msg.type === 'GET_COMMODITIES') {
      const response = await sendToBackgroundWithResponse({
        type: msg.type,
        requestId: msg.requestId
      });
      postToSidebar(response);
      return;
    }

    if (msg.type === 'GET_FLASH_INITIAL') {
      const response = await sendToBackgroundWithResponse({
        type: 'GET_FLASH',
        requestId: msg.requestId
      });
      postToSidebar(response);
      return;
    }
  });

  setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of pendingRequests) {
      if (now - entry.ts > 15000) {
        pendingRequests.delete(id);
      }
    }
  }, 30000);
})();
