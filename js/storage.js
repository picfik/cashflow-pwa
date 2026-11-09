/* ============================================================
 * storage.js —— 数据持久化
 * 只做存储读写：localStorage + JSON 导入导出
 * 不碰 DOM、不做业务计算
 * ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'cashflow-state'; // localStorage 的固定 key
  var LOG_LIMIT = 50;                 // 日志最多保留条数

  // 保存原生 localStorage 引用，避免与本模块命名冲突
  var ls = window.localStorage;

  /**
   * 校验并修复账本数据：保证所有字段存在且类型正确
   * @param {*} raw 任意输入（如导入的 JSON）
   * @returns {object|null} 合法的 state 对象；完全非法时返回 null
   */
  function validateState(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    // 数字归一化：非法数字回退为默认值
    var num = function (v, dflt) {
      var n = Number(v);
      return isFinite(n) ? n : dflt;
    };

    // 数组归一化：必须是数组，且每项为对象
    var arr = function (v) {
      if (!Array.isArray(v)) return [];
      return v.filter(function (it) { return it && typeof it === 'object'; });
    };

    return {
      version: 1,
      profession: typeof raw.profession === 'string' ? raw.profession : '玩家',
      cash: num(raw.cash, 0),
      salary: num(raw.salary, 0),
      children: Math.max(0, Math.floor(num(raw.children, 0))),
      expenses: arr(raw.expenses),
      liabilities: arr(raw.liabilities),
      assets: arr(raw.assets),
      extraIncomes: arr(raw.extraIncomes),
      dreams: arr(raw.dreams),
      log: arr(raw.log),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : ''
    };
  }

  /** 自动保存：把 state 写入 localStorage */
  function saveState(state) {
    try {
      ls.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('保存失败：', e);
      return false;
    }
  }

  /** 自动恢复：从 localStorage 读取 state；不存在或非法时返回 null */
  function loadState() {
    try {
      var text = ls.getItem(STORAGE_KEY);
      if (!text) return null;
      return validateState(JSON.parse(text));
    } catch (e) {
      console.warn('读取存档失败：', e);
      return null;
    }
  }

  /** 清空：删除 localStorage 中的存档 */
  function clearState() {
    ls.removeItem(STORAGE_KEY);
  }

  /** 导出：把 state 序列化为 JSON 字符串（供下载用） */
  function exportJSON(state) {
    return JSON.stringify(state, null, 2);
  }

  /**
   * 导入：解析 JSON 文本并校验
   * @returns {object|null} 合法 state；解析失败或校验不过返回 null
   */
  function importJSON(text) {
    try {
      return validateState(JSON.parse(text));
    } catch (e) {
      return null;
    }
  }

  /** 追加一条操作日志（保留最近 LOG_LIMIT 条），返回新的日志数组 */
  function pushLog(state, text) {
    var entry = { time: new Date().toISOString(), text: text };
    var log = [entry].concat(state.log || []);
    return log.slice(0, LOG_LIMIT);
  }

  /** 触发浏览器下载 JSON 文件 */
  function downloadJSON(state) {
    var blob = new Blob([exportJSON(state)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    // 文件名带职业名与日期，方便玩家管理多个存档
    var date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'cashflow-' + (state.profession || '账本') + '-' + date + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 挂载到全局（命名为 AppStorage，避免与浏览器原生 Storage 冲突）
  window.AppStorage = {
    STORAGE_KEY: STORAGE_KEY,
    LOG_LIMIT: LOG_LIMIT,
    validateState: validateState,
    saveState: saveState,
    loadState: loadState,
    clearState: clearState,
    exportJSON: exportJSON,
    importJSON: importJSON,
    pushLog: pushLog,
    downloadJSON: downloadJSON
  };
})();
