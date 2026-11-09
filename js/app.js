/* ============================================================
 * app.js —— 串联初始化与事件绑定
 * 不含核心计算/渲染逻辑，只负责把 UI、Engine、Storage 接起来
 * ============================================================ */

(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };

  // 当前账本数据（全局唯一状态）
  var state = null;

  /** 刷新：更新时间戳 → 追加日志 → 自动保存 → 重新渲染 */
  function commit(logText) {
    state.updatedAt = new Date().toISOString();
    if (logText) state.log = window.AppStorage.pushLog(state, logText);
    window.AppStorage.saveState(state);
    window.UI.render(state, window.Engine.summary(state));
  }

  /** 切换面板：显示主面板并隐藏初始化面板（或反之） */
  function showGame(show) {
    $('#game-panel').classList.toggle('hidden', !show);
    $('#init-panel').classList.toggle('hidden', show);
  }

  /** 注册 Service Worker（仅在 https 或 localhost 下生效） */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(function (e) {
        console.warn('Service Worker 注册失败：', e);
      });
    }
  }

  /** 页面加载：优先从 localStorage 恢复，否则显示初始化面板 */
  function init() {
    state = window.AppStorage.loadState();
    if (state) {
      showGame(true);
      window.UI.render(state, window.Engine.summary(state));
    } else {
      showGame(false);
    }
    bindEvents();
    registerServiceWorker();
  }

  /** 绑定所有静态按钮事件 */
  function bindEvents() {
    // 初始化表单：创建新账本
    $('#init-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var profession = $('#init-profession').value.trim() || '玩家';
      var cash = Number($('#init-cash').value) || 0;
      var salary = Number($('#init-salary').value) || 0;
      state = window.AppStorage.validateState({
        profession: profession,
        cash: cash,
        salary: salary
      });
      commit('创建账本：' + profession + '，初始现金 ' + window.UI.fmt(cash));
      showGame(true);
    });

    // 十一个手动事件按钮：点击打开对应表单
    $$('#actions [data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!state) return;
        window.UI.openForm(btn.getAttribute('data-action'), state);
      });
    });

    // 导出 JSON
    $('#btn-export').addEventListener('click', function () {
      if (!state) return;
      window.AppStorage.downloadJSON(state);
    });

    // 导入 JSON：打开文件选择框
    $('#btn-import').addEventListener('click', function () {
      $('#import-file').click();
    });

    // 选择文件后：读取 → 校验 → 二次确认 → 覆盖
    $('#import-file').addEventListener('change', function (ev) {
      var file = ev.target.files[0];
      ev.target.value = ''; // 允许重复选择同一文件
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var next = window.AppStorage.importJSON(String(reader.result));
        if (!next) {
          alert('导入失败：文件不是合法的账本 JSON。');
          return;
        }
        if (!confirm('导入将覆盖当前账本，确定继续吗？')) return;
        state = next;
        commit('导入 JSON 账本');
        showGame(true);
        window.UI.closeForm();
      };
      reader.readAsText(file);
    });

    // 重置：二次确认后清空存档并回到初始化面板
    $('#btn-reset').addEventListener('click', function () {
      if (!confirm('确定要清空当前账本吗？此操作不可撤销（建议先导出 JSON 备份）。')) return;
      if (!confirm('再次确认：真的要删除所有数据并重新开始吗？')) return;
      window.AppStorage.clearState();
      state = null;
      window.UI.closeForm();
      showGame(false);
      $('#init-form').reset();
    });

    // 注入 UI 的业务回调
    window.UI.onFormSubmit = handleFormSubmit;
    window.UI.onItemAction = handleItemAction;

    // 列表项的编辑/删除按钮（事件委托，绑定在各列表容器上）
    ['#income-list', '#expense-list', '#liability-list', '#asset-list', '#dream-list']
      .forEach(function (sel) {
        $(sel).addEventListener('click', function (ev) {
          var btn = ev.target.closest('.icon-btn');
          if (!btn) return;
          if (typeof window.UI.onItemAction === 'function') {
            window.UI.onItemAction(
              btn.getAttribute('data-kind'),
              btn.getAttribute('data-action'),
              Number(btn.getAttribute('data-index'))
            );
          }
        });
      });
  }

  /* ---------------- 事件处理 ---------------- */

  /** 表单提交统一入口：根据类型修改数据，然后 commit */
  function handleFormSubmit(type, data) {
    // 金额字段统一转数字（非法输入按 0 处理）
    var n = function (v) { return Number(v) || 0; };

    switch (type) {
      // 买入资产：现金减少成本
      case 'buy-asset': {
        var cost = n(data.cost);
        if (cost > state.cash &&
            !confirm('现金不足（现有 ' + window.UI.fmt(state.cash) + '），现金将变为负数，确定买入吗？')) {
          return;
        }
        state.assets.push({
          name: (data.name || '').trim() || '未命名资产',
          type: data.type || 'other',
          cost: cost,
          cashflow: n(data.cashflow)
        });
        state.cash -= cost;
        commit('买入资产「' + data.name + '」，成本 ' + window.UI.fmt(cost) +
          '，月现金流 ' + window.UI.fmt(n(data.cashflow)));
        break;
      }

      // 卖出资产：现金增加卖出价
      case 'sell-asset': {
        var idx = n(data.pick);
        var asset = state.assets[idx];
        if (!asset) return;
        var price = n(data.amount);
        state.assets.splice(idx, 1);
        state.cash += price;
        commit('卖出资产「' + asset.name + '」，售价 ' + window.UI.fmt(price));
        break;
      }

      // 额外收入
      case 'add-extra-income':
        state.extraIncomes.push({ name: (data.name || '').trim() || '额外收入', amount: n(data.amount) });
        commit('增加额外收入「' + data.name + '」' + window.UI.fmt(n(data.amount)) + '/月');
        break;

      // 月支出
      case 'add-expense':
        state.expenses.push({ name: (data.name || '').trim() || '支出', amount: n(data.amount) });
        commit('增加月支出「' + data.name + '」' + window.UI.fmt(n(data.amount)) + '/月');
        break;

      // 负债
      case 'add-liability':
        state.liabilities.push({ name: (data.name || '').trim() || '负债', amount: n(data.amount) });
        commit('增加负债「' + data.name + '」' + window.UI.fmt(n(data.amount)));
        break;

      // 偿还负债：现金减少，负债相应减少（还清则移除）
      case 'pay-liability': {
        var lidx = n(data.pick);
        var liab = state.liabilities[lidx];
        if (!liab) return;
        var pay = n(data.amount);
        if (pay > state.cash &&
            !confirm('现金不足（现有 ' + window.UI.fmt(state.cash) + '），现金将变为负数，确定偿还吗？')) {
          return;
        }
        var lname = liab.name;
        liab.amount -= pay;
        state.cash -= pay;
        if (liab.amount <= 0) {
          state.liabilities.splice(lidx, 1);
          commit('还清负债「' + lname + '」，偿还 ' + window.UI.fmt(pay));
        } else {
          commit('偿还负债「' + lname + '」' + window.UI.fmt(pay) + '，剩余 ' + window.UI.fmt(liab.amount));
        }
        break;
      }

      // 现金调整
      case 'adjust-cash': {
        var delta = n(data.amount);
        state.cash += delta;
        commit('现金调整 ' + (delta >= 0 ? '+' : '') + window.UI.fmt(delta) +
          (data.reason ? '（' + data.reason + '）' : ''));
        break;
      }

      // 添加孩子：每月支出 +300
      case 'add-child':
        state.children += 1;
        commit('添加一个孩子，月支出 +300');
        break;

      // 慈善捐赠：现金减少
      case 'charity': {
        var donate = n(data.amount);
        state.cash -= donate;
        commit('慈善捐赠 ' + window.UI.fmt(donate));
        break;
      }

      // 新增梦想
      case 'add-dream':
        state.dreams.push({
          name: (data.name || '').trim() || '梦想',
          target: n(data.target),
          invested: 0
        });
        commit('新增梦想「' + data.name + '」，目标 ' + window.UI.fmt(n(data.target)));
        break;

      // 梦想投入
      case 'invest-dream': {
        var didx = n(data.pick);
        var dream = state.dreams[didx];
        if (!dream) return;
        var invest = n(data.amount);
        dream.invested += invest;
        state.cash -= invest;
        var done = window.Engine.dreamAchieved(dream);
        commit('为梦想「' + dream.name + '」投入 ' + window.UI.fmt(invest) +
          (done ? ' 🏆 梦想达成！' : '，累计 ' + window.UI.fmt(dream.invested)));
        if (done) alert('🏆 恭喜！梦想「' + dream.name + '」已达成！');
        break;
      }

      // 编辑已有条目
      case 'edit-item': {
        var list = editList(data.kind);
        var i = data.index;
        if (!list || !list[i]) return;
        var d = data.data;
        var item = list[i];
        item.name = String(d.name || item.name).trim() || item.name;
        if (data.kind === 'asset') {
          item.type = d.type || item.type;
          item.cost = n(d.cost);
          item.cashflow = n(d.cashflow);
        } else if (data.kind === 'dream') {
          item.target = n(d.target);
          item.invested = n(d.invested);
        } else {
          item.amount = n(d.amount);
        }
        commit('编辑「' + item.name + '」');
        break;
      }

      default:
        return;
    }

    window.UI.closeForm();
  }

  /** 列表项编辑/删除统一入口 */
  function handleItemAction(kind, action, index) {
    if (action === 'edit') {
      window.UI.openEditForm(kind, index, state);
      return;
    }
    if (action !== 'del') return;

    // 删除前确认
    var list = editList(kind);
    if (!list || !list[index]) return;
    var name = list[index].name;
    if (!confirm('确定删除「' + name + '」吗？')) return;
    list.splice(index, 1);
    commit('删除「' + name + '」');
  }

  /** 获取当前状态下指定类别的可编辑列表 */
  function editList(kind) {
    var map = {
      extraIncome: state.extraIncomes,
      expense: state.expenses,
      liability: state.liabilities,
      asset: state.assets,
      dream: state.dreams
    };
    return map[kind];
  }

  // DOM 就绪后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
