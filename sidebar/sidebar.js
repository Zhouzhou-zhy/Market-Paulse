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

  const tarotDeck = [
    { id: 0, name: '愚者', emoji: '🌟', upright: '新的开始，大胆尝试，财运在冒险中诞生', reversed: '冲动冒进，需三思而行，避免盲目投资' },
    { id: 1, name: '魔术师', emoji: '🎩', upright: '资源齐备，技能到位，适合主动出击', reversed: '能力被误用，信息不透明，小心陷阱' },
    { id: 2, name: '女祭司', emoji: '🌙', upright: '直觉敏锐，静观其变，暗中积蓄力量', reversed: '信息不足，判断失误，需更多调研' },
    { id: 3, name: '皇后', emoji: '👑', upright: '丰收在望，资产增值，稳健持有获利', reversed: '铺张浪费，过度消费，理财需节制' },
    { id: 4, name: '皇帝', emoji: '🏰', upright: '掌控全局，纪律严明，适合长期布局', reversed: '刚愎自用，缺乏弹性，不可固执己见' },
    { id: 5, name: '教皇', emoji: '📜', upright: '贵人相助，遵循规则，传统投资获回报', reversed: '被误导，盲从权威，独立思考为上' },
    { id: 6, name: '恋人', emoji: '💞', upright: '正确选择，合作共赢，互利机会出现', reversed: '分裂犹豫，合作破裂，需谨慎签约' },
    { id: 7, name: '战车', emoji: '⚔️', upright: '势如破竹，行情强劲，顺势追涨有利', reversed: '失控暴冲，行情逆转，及时止损为上' },
    { id: 8, name: '力量', emoji: '💪', upright: '以柔克刚，耐心持有，终将克服波动', reversed: '信心不足，被恐慌支配，勿低位割肉' },
    { id: 9, name: '隐者', emoji: '🏮', upright: '深度思考，价值发现，适合长线布局', reversed: '闭门造车，错失良机，需多交流学习' },
    { id: 10, name: '命运之轮', emoji: '🎡', upright: '时来运转，趋势有利，抓住转折机遇', reversed: '运势下行，无常变化，做好风险对冲' },
    { id: 11, name: '正义', emoji: '⚖️', upright: '公平回报，盈亏合理，按规则行事有收获', reversed: '不公待遇，合约纠纷，仔细审查条款' },
    { id: 12, name: '倒吊人', emoji: '🙃', upright: '以退为进，换个角度看市场，等待黎明', reversed: '挣扎无果，越努力越亏损，需彻底转变' },
    { id: 13, name: '死神', emoji: '💀', upright: '旧模式终结，清仓重生，迎接新周期', reversed: '抗拒改变，死守亏损仓，该放手就放手' },
    { id: 14, name: '节制', emoji: '🌊', upright: '平衡配置，分散风险，中庸之道最佳', reversed: '极端操作，仓位失衡，重仓单一品种' },
    { id: 15, name: '恶魔', emoji: '😈', upright: '贪欲驱动，短线暴利诱惑，警惕杠杆陷阱', reversed: '摆脱束缚，认清骗局，远离非法项目' },
    { id: 16, name: '高塔', emoji: '⚡', upright: '突发事件，市场暴跌，黑天鹅降临需避险', reversed: '危机延迟，但风险仍在累积，提前减仓' },
    { id: 17, name: '星星', emoji: '⭐', upright: '希望之光，反弹可期，底部信号初现', reversed: '希望落空，反弹乏力，暂勿抄底' },
    { id: 18, name: '月亮', emoji: '🌑', upright: '迷雾重重，消息面混乱，多看少动', reversed: '疑心过重，错过真实机会，适当信任直觉' },
    { id: 19, name: '太阳', emoji: '☀️', upright: '阳光普照，行情大好，丰收时刻已到', reversed: '乐极生悲，过热回调，适时兑现利润' },
    { id: 20, name: '审判', emoji: '📯', upright: '复盘总结，经验变现，过往积累爆发', reversed: '悔不当初，逃避责任，正视错误才能进步' },
    { id: 21, name: '世界', emoji: '🌍', upright: '圆满收官，周期顶点，完美止盈离场', reversed: '功亏一篑，最后一跌吞噬利润，及时了结' }
  ];

  fortuneBtn.addEventListener('click', () => {
    if (fortuneBtn.disabled) return;
    fortuneBtn.disabled = true;

    const slots = ['card-past', 'card-present', 'card-future'];
    const resultEl = document.getElementById('fortune-result');
    resultEl.classList.remove('show');

    slots.forEach(id => {
      document.getElementById(id).classList.remove('flipped');
    });

    const shuffled = [...tarotDeck].sort(() => Math.random() - 0.5);
    const drawn = shuffled.slice(0, 3);

    const readings = drawn.map(card => ({
      ...card,
      isReversed: Math.random() < 0.5
    }));

    slots.forEach((slotId, index) => {
      setTimeout(() => {
        document.getElementById(slotId).classList.add('flipped');
        const cardBack = document.getElementById(slotId + '-back');
        const card = readings[index];
        cardBack.innerHTML = `<span style="font-size:24px;">${card.emoji}</span><span style="font-size:9px;color:#888;margin-top:2px;">${card.isReversed ? '逆' : '正'}</span>`;

        if (index === 2) {
          setTimeout(() => {
            const positions = ['过去', '现在', '未来'];
            let html = '';
            readings.forEach((card, i) => {
              html += `
              <div class="fortune-card-result">
                <div class="card-header">
                  <span class="card-position">${positions[i]}</span>
                  <span class="card-name">${card.emoji} ${card.name}${card.isReversed ? ' (逆位)' : ' (正位)'}</span>
                </div>
                <div class="card-mean">${card.isReversed ? card.reversed : card.upright}</div>
              </div>`;
            });
            resultEl.innerHTML = html;
            resultEl.classList.add('show');
            fortuneBtn.disabled = false;
          }, 400);
        }
      }, index * 500);
    });
  });

  requestData('GET_FLASH');

  window.addEventListener('beforeunload', () => {});
})();
