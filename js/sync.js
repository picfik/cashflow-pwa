/* ============================================================
 * sync.js —— GitHub 数据同步（可选功能）
 * 通过 GitHub Contents API 把账本存为仓库中的 JSON 文件：
 *   - 打开页面时拉取远端数据（pullState）
 *   - 数据变化时提交更新（pushState）
 * 不碰 DOM；认证使用玩家自己填写的 fine-grained PAT
 * ============================================================ */

(function () {
  'use strict';

  var CONFIG_KEY = 'cashflow-sync-config'; // 同步配置在 localStorage 的 key
  var API_BASE = 'https://api.github.com';

  /** 读取配置：{ owner, repo, branch, path, token }（公开仓库拉取时 token 可选） */
  function getConfig() {
    try {
      var raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return null;
      var cfg = JSON.parse(raw);
      if (!cfg.owner || !cfg.repo) return null;
      cfg.branch = cfg.branch || 'main';
      cfg.path = cfg.path || 'data/state.json';
      cfg.token = cfg.token || '';
      return cfg;
    } catch (e) {
      return null;
    }
  }

  /** 保存同步配置 */
  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      owner: cfg.owner.trim(),
      repo: cfg.repo.trim(),
      branch: (cfg.branch || 'main').trim() || 'main',
      path: (cfg.path || 'data/state.json').trim() || 'data/state.json',
      token: cfg.token.trim()
    }));
  }

  /** 清空同步配置（token 一并移除） */
  function clearConfig() {
    localStorage.removeItem(CONFIG_KEY);
  }

  /** 是否已配置同步 */
  function isConfigured() {
    return getConfig() !== null;
  }

  /** 是否填写了 Token（推送写操作必须认证） */
  function hasToken() {
    var cfg = getConfig();
    return !!(cfg && cfg.token);
  }

  /** 构造请求头：有 token 时附带认证（公开仓库的读取无需认证） */
  function headers() {
    var h = {
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
    var cfg = getConfig();
    if (cfg && cfg.token) {
      h['Authorization'] = 'Bearer ' + cfg.token;
    }
    return h;
  }

  /** 内容文件的 API 地址 */
  function apiUrl() {
    var cfg = getConfig();
    return API_BASE + '/repos/' + cfg.owner + '/' + cfg.repo +
      '/contents/' + cfg.path + '?ref=' + cfg.branch;
  }

  /** UTF-8 字符串 → base64（分块转换，避免栈溢出，支持中文） */
  function encodeBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  /** base64 → UTF-8 字符串 */
  function decodeBase64(b64) {
    var bin = atob(b64.replace(/\n/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /** 获取远端文件当前的 sha（不存在时返回 null） */
  function getSha() {
    return fetch(apiUrl(), { headers: headers() }).then(function (res) {
      if (res.status === 404) return null;   // 文件尚未创建
      if (res.status === 401) throw new Error('Token 无效或已过期（401）');
      if (!res.ok) throw new Error('GitHub API ' + res.status);
      return res.json().then(function (data) { return data.sha; });
    });
  }

  
  /**
   * 拉取远端账本数据
   * @returns {Promise<{state: object, sha: string}|null>} 无文件时返回 null
   */
  function pullState() {
    return fetch(apiUrl(), { headers: headers() }).then(function (res) {
      if (res.status === 404) return null;
      if (res.status === 401) throw new Error('Token 无效或已过期（401）');
      if (!res.ok) throw new Error('GitHub API ' + res.status);
      return res.json().then(function (data) {
        var text = decodeBase64(data.content);
        var state = window.AppStorage.validateState(JSON.parse(text));
        if (!state) throw new Error('远端数据格式不合法');
        return { state: state, sha: data.sha };
      });
    });
  }

  /**
   * 把账本推送到 GitHub（自动创建或更新文件，各产生一次 commit）
   * @returns {Promise<object>} GitHub API 的提交结果
   */
  function pushState(state) {
    // 写操作必须认证：未填 token 时给出明确提示
    if (!hasToken()) {
      return Promise.reject(new Error('推送需要 Token（公开仓库读取可免，写入必须认证）'));
    }
    // 提交前更新时间戳，保证"谁新用谁"的比较可靠
    var payload = JSON.parse(JSON.stringify(state));
    payload.updatedAt = new Date().toISOString();
    var content = encodeBase64(JSON.stringify(payload, null, 2));

    return getSha().then(function (sha) {
      var cfg = getConfig();
      var body = {
        message: '更新账本数据 ' + payload.updatedAt,
        content: content,
        branch: cfg.branch
      };
      if (sha) body.sha = sha; // 已存在则更新，否则创建
      return fetch(apiUrl(), {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(body)
      }).then(function (res) {
        if (!res.ok) throw new Error('推送失败：GitHub API ' + res.status);
        return res.json();
      });
    });
  }

  // 挂载到全局，供 app.js 使用
  window.GitHubSync = {
    getConfig: getConfig,
    saveConfig: saveConfig,
    clearConfig: clearConfig,
    isConfigured: isConfigured,
    pullState: pullState,
    pushState: pushState
  };
})();

