(function () {
  'use strict';

  const btnRefresh = document.getElementById('btn-refresh');
  const btnToggle = document.getElementById('btn-toggle');
  const updateTime = document.getElementById('update-time');
  const flashList = document.getElementById('flash-list');
  const indicesList = document.getElementById('indices-list');
  const commoditiesList = document.getElementById('commodities-list');
  const fortuneBtn = document.getElementById('fortune-btn');
  const resizeHandle = document.getElementById('resize-handle');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  let currentTab = 'flash';
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  function genRequestId() {
    return 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function requestData(type) {
    const requestId = genRequestId();
    window.parent.postMessage({ type, requestId }, '*');
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
      if (tab === 'indices') {
        requestData('GET_INDICES');
      } else if (tab === 'commodities') {
        requestData('GET_COMMODITIES');
      }
    });
  });

  function switchTab(tab) {
    currentTab = tab;
    tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    tabPanels.forEach((p) => p.classList.toggle('active', p.id === 'panel-' + tab));
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stripHtml(str) {
    if (!str) return '';
    return String(str).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }

  function formatFlashTime(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.split(' ');
    return parts.length >= 2 ? parts[1] : timeStr;
  }

  function renderFlash(items) {
    if (!items || !items.length) {
      flashList.innerHTML = '<div class="empty-state">暂无快讯数据</div>';
      return;
    }
    flashList.innerHTML = items
      .map((item) => {
        const timeFormatted = formatFlashTime(item.time);
        const content = stripHtml(item.data ? item.data.content : '');
        const isImportant = item.important >= 1;
        return `
          <div class="flash-item ${isImportant ? 'flash-important' : ''}">
            <span class="flash-time">${escapeHtml(timeFormatted)}</span>
            <span class="flash-text">${escapeHtml(content)}</span>
          </div>`;
      })
      .join('');
  }

  function renderIndices(data) {
    if (!data || !data.payload || !data.payload.length) {
      if (data && data.hasToken === false) {
        indicesList.innerHTML = `
          <div class="empty-state" style="color:#4a90d9;line-height:1.8;padding:30px 20px;">
            <p style="font-size:15px;margin-bottom:10px;">&#x26a0; 请配置 API Token 以获取实时行情</p>
            <p style="font-size:12px;color:#666;">
              请前往 <a href="https://mcp.jin10.com/app/" target="_blank" style="color:#4a90d9;">mcp.jin10.com/app</a>
              获取 Bearer Token<br>然后在浏览器 Console 中执行：<br>
              <code style="background:#e8f0fe;padding:2px 6px;border-radius:3px;font-size:11px;color:#1a1a2e;">
                chrome.storage.local.set({jin10_api_token:'YOUR_TOKEN'})
              </code>
            </p>
          </div>`;
      } else {
        indicesList.innerHTML = '<div class="empty-state">暂无指数数据</div>';
      }
      return;
    }
    indicesList.innerHTML = data.payload
      .map((item) => {
        const up = parseFloat(item.change || item.ups_percent) >= 0;
        return `
          <div class="index-row">
            <span class="index-name" title="${escapeHtml(item.code || '')}">${escapeHtml(item.name)}</span>
            <span class="index-price">${escapeHtml(item.close || item.price || '--')}</span>
            <span class="index-change ${up ? 'up' : 'down'}">${escapeHtml(item.ups_percent || item.change || '--')}</span>
          </div>`;
      })
      .join('');
  }

  function renderCommodities(data) {
    if (!data || !data.payload || !data.payload.length) {
      if (data && data.hasToken === false) {
        commoditiesList.innerHTML = `
          <div class="empty-state" style="color:#4a90d9;line-height:1.8;padding:30px 20px;">
            <p style="font-size:15px;margin-bottom:10px;">&#x26a0; 请配置 API Token 以获取实时行情</p>
            <p style="font-size:12px;color:#666;">
              请前往 <a href="https://mcp.jin10.com/app/" target="_blank" style="color:#4a90d9;">mcp.jin10.com/app</a>
              获取 Bearer Token<br>然后在浏览器 Console 中执行：<br>
              <code style="background:#e8f0fe;padding:2px 6px;border-radius:3px;font-size:11px;color:#1a1a2e;">
                chrome.storage.local.set({jin10_api_token:'YOUR_TOKEN'})
              </code>
            </p>
          </div>`;
      } else {
        commoditiesList.innerHTML = '<div class="empty-state">暂无商品数据</div>';
      }
      return;
    }
    commoditiesList.innerHTML = data.payload
      .map((item) => {
        const changeVal = item.change || item.ups_price || '0';
        const isUp = parseFloat(changeVal) >= 0;
        return `
          <div class="commodity-row">
            <span class="commodity-name">${escapeHtml(item.name)}</span>
            <span class="commodity-price">${escapeHtml(item.close || item.price || '--')}</span>
            <span class="commodity-change ${isUp ? 'up' : 'down'}">${escapeHtml(changeVal)}</span>
          </div>`;
      })
      .join('');
  }

  function handleDataMessage(msg) {
    updateTime.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });

    switch (msg.type) {
      case 'FLASH_UPDATE':
        requestData('GET_FLASH');
        break;

      case 'FLASH_DATA':
        renderFlash(msg.payload);
        break;

      case 'INDICES_DATA':
        renderIndices(msg);
        break;

      case 'COMMODITIES_DATA':
        renderCommodities(msg);
        break;

      default:
        break;
    }
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;
    handleDataMessage(msg);
  });

  btnRefresh.addEventListener('click', () => {
    flashList.innerHTML = '<div class="loading">正在刷新...</div>';
    requestData('GET_FLASH');
    if (currentTab === 'indices') requestData('GET_INDICES');
    if (currentTab === 'commodities') requestData('GET_COMMODITIES');
  });

  btnToggle.addEventListener('click', () => {
    window.parent.postMessage({ type: 'TOGGLE' }, '*');
  });

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = window.innerWidth;
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.userSelect = 'none';
  });

  function onResize(e) {
    if (!isResizing) return;
    const deltaX = startX - e.clientX;
    const newWidth = Math.max(280, Math.min(600, startWidth + deltaX));
    window.parent.postMessage({ type: 'RESIZE', payload: { width: newWidth } }, '*');
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.userSelect = '';
  }

  fortuneBtn.addEventListener('click', () => {
    if (fortuneBtn.disabled) return;
    fortuneBtn.disabled = true;
    const dice = document.getElementById('fortune-dice');
    const result = document.getElementById('fortune-result');
    dice.classList.add('spinning');

    setTimeout(() => {
      const roll = Math.floor(Math.random() * 6) + 1;
      dice.innerHTML = '&#x' + (2679 + roll) + ';';
      dice.classList.remove('spinning');

      const fortunes = {
        1: { title: '大吉大利', desc: '今日财运亨通，投资顺利，适合大胆操作！' },
        2: { title: '小吉', desc: '运势平稳向好，可以适当参与，但不宜冒进。' },
        3: { title: '中平', desc: '市场波动较大，建议持币观望，等待时机。' },
        4: { title: '小凶', desc: '今日不宜重仓，注意风险控制，多看少动。' },
        5: { title: '凶', desc: '市场有变数，建议减仓避险，保守操作。' },
        6: { title: '大凶之兆', desc: '黑天鹅预警！建议清仓观望，切勿追涨杀跌！' }
      };
      const f = fortunes[roll];
      result.innerHTML = `<div class="fortune-result-title">${f.title}</div><div class="fortune-result-desc">${f.desc}</div>`;

      fortuneBtn.disabled = false;
    }, 600);
  });

  requestData('GET_FLASH');

  window.addEventListener('beforeunload', () => {});
})();
