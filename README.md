# Edge 金十数据侧边栏插件 — README

## 一、项目概述

基于 Microsoft Edge（Chromium）Manifest V3 开发的浏览器扩展，在网页右侧注入一个持久化侧边栏面板，展示金十（Jin10）金融实时数据，并提供掷骰子测运势的趣味功能。UI 采用清新白底风格，浅蓝色为主色调。

## 二、文件结构

```
edge-jin10-plugin/
├── manifest.json              # Manifest V3 声明文件（权限、快捷键、入口）
├── background.js              # Service Worker，后台快讯轮询与状态管理
├── content_script.js          # 内容脚本，注入侧边栏 iframe 到每个页面
├── sidebar/
│   ├── sidebar.html           # 侧边栏 UI 主页面（顶部栏 + 标签页 + 内容区）
│   ├── sidebar.js             # 侧边栏前端逻辑（标签切换、数据渲染、运势、拖拽）
│   └── sidebar.css            # 侧边栏样式（清新白底主题）
├── icons/                     # 扩展图标（icon16/48/128.png）
├── debug/                     # 调试指南文档
└── README.md                  # 本文档
```

## 三、核心架构

### 3.1 侧边栏注入机制

- `content_script.js` 在 `manifest.json` 中声明 `matches: ["<all_urls>"]`，会在所有页面自动执行
- 内容脚本创建一个 `<iframe>`，指向 `chrome.runtime.getURL('sidebar/sidebar.html')`
- iframe 定位为 `position: fixed; right: 0; top: 0; height: 100vh; z-index: 2147483646`
- 页面内容通过 `document.documentElement.style.marginRight = width` 向左推移

### 3.2 跨标签页状态持久化

- 使用 `chrome.storage.local` 保存 `sidebarState`（`visible` 可见状态 + `width` 宽度）
- 切换标签页时，新页面的 content_script 从 storage 读取最新状态
- 通过浏览器工具栏图标点击或快捷键触发 toggle，广播 `STATE_UPDATED` 到所有标签页

### 3.3 通信链路

```
sidebar.js (iframe 内部)
    │ postMessage({ type, requestId })
    ▼
content_script.js
    │ chrome.runtime.connect({ name: 'jin10-sidebar' })
    ▼
background.js (Service Worker)
    │ fetch() → 金十 Flash API
    │ port.postMessage() → 返回缓存数据
    ▼
金十 API (flash-api.jin10.com)
```

### 3.4 侧边栏布局结构

```
┌──────────────────────────────────┐
│ ↻ 刷新    数据更新时间 HH:MM:SS  × │  ← 顶部栏 (sidebar-topbar)
├──────────────────────────────────┤
│  快讯  │  指数  │  商品  │  运势  │  ← 标签页导航 (sidebar-tabs)
├──────────────────────────────────┤
│                                  │
│         面板内容区                │  ← 随标签切换显示对应内容
│                                  │
├──────────────────────────────────┤
│  ← 拖拽手柄（左边缘可拖动调整宽度）│  ← resize-handle
└──────────────────────────────────┘
```

### 3.5 功能模块（四个标签页）

| 标签页 | 功能                                 | 数据来源              | 状态   |
| ------ | ------------------------------------ | --------------------- | ------ |
| 快讯   | 实时财经快讯列表，重要消息蓝色左边框 | flash-api.jin10.com   | 已接入 |
| 指数   | 市场指数行情（需配置 Token）         | mcp.jin10.com MCP API | 待接入 |
| 商品   | 大宗商品价格（需配置 Token）         | mcp.jin10.com MCP API | 待接入 |
| 运势   | 塔罗牌测运势                         | 随机                  | 已完成 |

#### 运势功能说明

- 点击"掷骰子测运势"按钮，骰子旋转 600ms 后显示随机点数
- 点数对应运势：1=大吉大利，2=小吉，3=中平，4=小凶，5=凶，6=大凶之兆
- 旋转期间按钮禁用，防止连续点击

### 3.6 快捷键

| 快捷键         | 功能                |
| -------------- | ------------------- |
| `Ctrl+Shift+K` | 切换侧边栏显示/隐藏 |

可在 `edge://extensions/shortcuts` 自定义。

## 四、金十数据接口

### 4.1 数据源

| 接口           | URL                                                              | 方式 | 是否需要鉴权           | 数据类型  |
| -------------- | ---------------------------------------------------------------- | ---- | ---------------------- | --------- |
| 快讯 Flash API | `https://flash-api.jin10.com/get_flash_list?channel=-8200&vip=1` | GET  | 需要 `x-app-id` 请求头 | 实时快讯  |
| MCP 行情接口   | `https://mcp.jin10.com/mcp`                                      | POST | 需要 Bearer Token      | 行情/商品 |

### 4.2 Background Service Worker 数据服务

```
background.js
├── Jin10FlashPoller    # 快讯轮询器（15s 间隔，ID 去重，广告过滤）
├── MessageRouter       # 端口消息路由（GET_FLASH / GET_INDICES / GET_COMMODITIES）
├── StateManager        # 管理 chrome.storage.local 状态读写
└── CommandHandler      # 快捷键 toggle-sidebar 处理
```

### 4.3 快讯数据格式 (Flash API)

```json
{
  "id": "20260429154939123456",
  "time": "2026-04-29 15:49:39",
  "important": 1,
  "channel": [1, 5],
  "data": { "content": "现货黄金短线走高近5美元..." }
}
```

- `important`: 0=普通, 1=重要星标（蓝色左边框 + 红色加粗文字）
- `channel`: [1]=速报, [2]=A股, [3]=商品, [4]=债券, [5]=国际
- 过滤规则：去重（seenId Set）、过滤广告（`extras.ad`）、过滤空内容

### 4.4 行情数据格式 (MCP API — 待接入)

```json
{
  "data": {
    "code": "XAUUSD",
    "name": "现货黄金",
    "close": "3278.30",
    "open": "3250.50",
    "high": "3280.10",
    "low": "3248.20",
    "ups_price": "27.80",
    "ups_percent": "0.86"
  }
}
```

## 五、UI 主题

采用清新白底风格，与 Edge 浏览器默认主题协调。

| 元素         | 颜色值        | 说明          |
| ------------ | ------------- | ------------- |
| 主背景       | `#ffffff`     | 纯白底        |
| 次级背景     | `#f0f4f8`     | 标签栏/顶部栏 |
| 边框         | `#d0d7de`     | 浅灰          |
| 主色调/强调  | `#4a90d9`     | Edge 蓝       |
| 上涨绿       | `#28a745`     | 涨幅数值      |
| 下跌红       | `#dc3545`     | 跌幅数值      |
| 重要快讯文字 | `#d32f2f`     | 深红加粗      |
| 正文文字     | `#1a1a2e`     | 深色          |
| 辅助文字     | `#666`/`#888` | 灰色层级      |

## 六、加载扩展

1. 打开 `edge://extensions/`
2. 开启"开发人员模式"
3. 点击"加载解压缩的扩展"
4. 选择 `C:\Users\27464\Desktop\edge-jin10-plugin` 目录
5. 重载后按 `Ctrl+Shift+K` 或点击工具栏图标即可开关侧边栏

## 七、host_permissions 说明

```json
"host_permissions": [
  "<all_urls>",
  "https://flash-api.jin10.com/*",
  "https://cdn-rili.jin10.com/*",
  "https://mcp.jin10.com/*"
]
```

- `<all_urls>`：允许 content_script 注入到任何网页
- 其余三条：允许 background.js 跨域请求金十各 API 域名
- 如果更换 API 域名，需在此处添加新域名，否则请求会被浏览器拦截
