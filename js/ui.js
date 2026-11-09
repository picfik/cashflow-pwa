/* ============================================================
 * ui.js —— 渲染与表单
 * 只碰 DOM、只做渲染和表单收集，不做财务计算
 * 通过 window.UI 暴露；业务回调由 app.js 注入：
 *   UI.onFormSubmit(type, data, pickAction) —— 表单提交
 *   UI.onItemAction(kind, action, index)    —— 列表项编辑/删除
 * ============================================================ */

(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };

  /** 数字格式化：千分位 + 元符号，负数带 - 号 */
  function fmt(n) {
    var v = Number(n) || 0;
    var sign = v < 0 ? '-' : '';
    var abs = Math.abs(Math.round(v * 100) / 100);
    var parts = String(abs).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + '¥' + parts.join('.');
  }

  /** 时间格式化：ISO 时间转本地可读格式 */
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var pad = function (x) { return x < 10 ? '0' + x : '' + x; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** HTML 转义，防止玩家输入的内容破坏页面结构 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------- 主渲染入口 ---------------- */

  /** 渲染整个游戏面板：指标条 / 进度条 / 五个列表 / 日志 */
  function render(state, sum) {
    // 标题区显示职业信息
    var head = $('#freedom-bar').querySelector('.freedom-head span');
    head.textContent = (state.profession || '玩家') + ' · 财务自由进度（被动收入 ÷ 总支出）';

    // 指标条
    setMetric('#m-cash', state.cash);
    setMetric('#m-passive', sum.passiveIncome);
    setMetric('#m-expense', sum.totalExpenses);
    setMetric('#m-netflow', sum.netCashflow);
    setMetric('#m-networth', sum.netWorth);

    // 财务自由进度条：达 100% 变绿并显示"已财务自由"
    var pct = Math.round(sum.freedomRatio * 100);
    $('#freedom-text').textContent = pct + '%';
    var fill = $('#bar-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('free', sum.isFree);
    $('#freedom-status').classList.toggle('hidden', !sum.isFree);

    // 五个列表
    renderIncome(state, sum);
    renderSimpleList('#expense-list', state.expenses, 'expense');
    renderSimpleList('#liability-list', state.liabilities, 'liability');
    renderAssets(state.assets);
    renderDreams(state.dreams);

    // 操作日志
    renderLog(state.log);
  }

  /** 设置单个指标值与红绿颜色 */
  function setMetric(sel, value) {
    var el = $(sel);
    el.textContent = fmt(value);
    el.classList.toggle('pos', value > 0);
    el.classList.toggle('neg', value < 0);
  }

  /* ---------------- 各列表渲染 ---------------- */

  /** 渲染收入区：工资 + 额外收入 + 被动收入合计 */
  function renderIncome(state, sum) {
    var html = '';
    html += itemHTML(null, '工资（月薪）', '', state.salary, 'amount-pos', false, '');
    (state.extraIncomes || []).forEach(function (e, i) {
      html += itemHTML('extraIncome', e.name, '额外收入', e.amount, 'amount-pos', true, '', i);
    });
    html += itemHTML(null, '被动收入合计', '', sum.passiveIncome, 'amount-pos', false, '');
    $('#income-list').innerHTML = html;
  }

  /** 渲染简单列表（支出 / 负债），支持编辑与删除 */
  function renderSimpleList(sel, list, kind) {
    var el = $(sel);
    if (!list || list.length === 0) {
      el.innerHTML = '<div class="empty-tip">暂无记录，点击右侧按钮添加</div>';
      return;
    }
    el.innerHTML = list.map(function (it, i) {
      return itemHTML(kind, it.name, '', it.amount, 'amount-neg', true, '', i);
    }).join('');
  }

  /** 渲染资产列表：显示类型、成本与月现金流 */
  function renderAssets(list) {
    var el = $('#asset-list');
    if (!list || list.length === 0) {
      el.innerHTML = '<div class="empty-tip">暂无资产，点击"买入资产"开始积累</div>';
      return;
    }
    var typeNames = { house: '房产', business: '生意', stock: '股票', other: '其他' };
    el.innerHTML = list.map(function (a, i) {
      var sub = '类型：' + (typeNames[a.type] || a.type || '其他') + ' · 成本 ' + fmt(a.cost);
      return itemHTML('asset', a.name, sub, a.cashflow, 'amount-pos', true, '/月', i);
    }).join('');
  }

  /** 渲染梦想列表：显示目标、已投入、进度条与达成状态 */
  function renderDreams(list) {
    var el = $('#dream-list');
    if (!list || list.length === 0) {
      el.innerHTML = '<div class="empty-tip">暂无梦想，点击"新增梦想"立一个目标</div>';
      return;
    }
    el.innerHTML = list.map(function (d, i) {
      var done = window.Engine.dreamAchieved(d);
      var ratio = d.target > 0 ? Math.min(d.invested / d.target, 1) : 0;
      var pct = Math.round(ratio * 100);
      var status = done
        ? '<div class="dream-done">🏆 梦想达成</div>'
        : '<div class="item-sub">已投入 ' + fmt(d.invested) + ' / ' + fmt(d.target) + '（' + pct + '%）</div>';
      var bar = '<div class="dream-bar"><div class="dream-bar-fill' + (done ? ' done' : '') +
        '" style="width:' + pct + '%"></div></div>';
      return itemHTML('dream', d.name, '', d.target, 'amount-neutral', true, '目标', i, bar + status);
    }).join('');
  }

  /** 渲染操作日志（log 数组本身倒序：最新的在前） */
  function renderLog(log) {
    var el = $('#log-list');
    if (!log || log.length === 0) {
      el.innerHTML = '<div class="empty-tip">暂无操作记录</div>';
      return;
    }
    el.innerHTML = log.map(function (it) {
      return '<div class="log-item"><span class="log-time">' +
        esc(fmtTime(it.time)) + '</span><span class="log-text">' +
        esc(it.text) + '</span></div>';
    }).join('');
  }

  /**
   * 生成一个列表项的 HTML
   * @param {string} kind 数据类别（extraIncome/expense/liability/asset/dream）
   * @param {string} name 显示名称
   * @param {string} sub  次要说明
   * @param {number} amount 金额
   * @param {string} amountCls 金额颜色类名
   * @param {boolean} editable 是否显示编辑/删除按钮
   * @param {string} suffix 金额后缀（如 "/月"、"目标"）
   * @param {number} [index] 数组下标（可编辑项必填）
   * @param {string} [extra] 附加 HTML（梦想进度条）
   */
  function itemHTML(kind, name, sub, amount, amountCls, editable, suffix, index, extra) {
    var btns = '';
    if (editable) {
      btns = '<span class="item-btns">' +
        '<button class="icon-btn" data-kind="' + kind + '" data-action="edit" data-index="' + index + '">编辑</button>' +
        '<button class="icon-btn del" data-kind="' + kind + '" data-action="del" data-index="' + index + '">删除</button>' +
        '</span>';
    }
    var subHTML = sub ? '<div class="item-row"><span class="item-sub">' + esc(sub) + '</span></div>' : '';
    var extraHTML = extra || '';
    return '<div class="item">' +
      '<span class="item-main">' +
      '<span class="item-row"><span class="item-name">' + esc(name) + '</span>' +
      '<span class="item-amount ' + amountCls + '">' + fmt(amount) + (suffix ? esc(suffix) : '') + '</span></span>' +
      subHTML + extraHTML +
      '</span>' + btns + '</div>';
  }

  /* ---------------- 表单系统 ---------------- */

  // 各表单类型的标题
  var FORM_TITLES = {
    'buy-asset': '买入资产',
    'sell-asset': '卖出资产',
    'add-extra-income': '增加额外收入',
    'add-expense': '增加月支出',
    'add-liability': '增加负债',
    'pay-liability': '偿还负债',
    'adjust-cash': '现金调整',
    'add-child': '添加孩子',
    'charity': '慈善捐赠',
    'add-dream': '新增梦想',
    'invest-dream': '梦想投入'
  };

  // 各表单类型的字段定义：key / label / type / placeholder / 默认值
  var FORM_DEFS = {
    'buy-asset': [
      { key: 'name', label: '资产名称', type: 'text', ph: '例如：出租房' },
      { key: 'type', label: '资产类型', type: 'select', options: [
        ['house', '房产'], ['business', '生意'], ['stock', '股票'], ['other', '其他']] },
      { key: 'cost', label: '投入成本（元）', type: 'number' },
      { key: 'cashflow', label: '每月现金流（元，可为负）', type: 'number' }
    ],
    'add-extra-income': [
      { key: 'name', label: '收入名称', type: 'text', ph: '例如：副业' },
      { key: 'amount', label: '每月金额（元）', type: 'number' }
    ],
    'add-expense': [
      { key: 'name', label: '支出名称', type: 'text', ph: '例如：房租' },
      { key: 'amount', label: '每月金额（元）', type: 'number' }
    ],
    'add-liability': [
      { key: 'name', label: '负债名称', type: 'text', ph: '例如：车贷' },
      { key: 'amount', label: '负债总额（元）', type: 'number' }
    ],
    'adjust-cash': [
      { key: 'amount', label: '调整金额（元，正为增加，负为减少）', type: 'number' },
      { key: 'reason', label: '原因', type: 'text', ph: '例如：发年终奖' }
    ],
    'charity': [
      { key: 'amount', label: '捐赠金额（元）', type: 'number' }
    ],
    'add-dream': [
      { key: 'name', label: '梦想名称', type: 'text', ph: '例如：环游世界' },
      { key: 'target', label: '目标金额（元）', type: 'number' }
    ],
    'add-child': [] // 添加孩子无需字段，直接确认
  };

  /** 打开指定类型的事件表单 */
  function openForm(type, state) {
    var box = $('#form-container');
    box.classList.remove('hidden');

    // 需要从列表选择的类型：单独构造
    if (type === 'sell-asset') {
      return openPickForm(box, 'sell-asset', '选择要卖出的资产', state.assets, '卖出价（元）');
    }
    if (type === 'pay-liability') {
      return openPickForm(box, 'pay-liability', '选择要偿还的负债', state.liabilities, '偿还金额（元）');
    }
    if (type === 'invest-dream') {
      return openPickForm(box, 'invest-dream', '选择要投入的梦想', state.dreams, '投入金额（元）');
    }

    // 普通字段表单
    var defs = FORM_DEFS[type];
    if (!defs) return;
    var html = '<h3>' + FORM_TITLES[type] + '</h3><form id="event-form" autocomplete="off">';
    defs.forEach(function (f) { html += buildField(f); });
    html += '<div class="form-row">' +
      '<button class="btn btn-primary" type="submit">确认</button>' +
      '<button class="btn btn-ghost" type="button" id="form-cancel">取消</button>' +
      '</div></form>';
    box.innerHTML = html;
    if (type === 'add-child') {
      box.querySelector('form').insertAdjacentHTML('afterbegin',
        '<p class="hint">添加一个孩子：每月固定支出 +300 元。</p>');
    }
    bindForm(box, type);
  }

  /** 构建"从列表选择 + 输入金额"的表单（卖出资产/偿还负债/梦想投入） */
  function openPickForm(box, type, label, list, amountLabel) {
    var html = '<h3>' + FORM_TITLES[type] + '</h3>';
    if (!list || list.length === 0) {
      html += '<p class="hint">暂无可选项，请先添加。</p>' +
        '<div class="form-row"><button class="btn btn-ghost" type="button" id="form-cancel">关闭</button></div>';
      box.innerHTML = html;
      $('#form-cancel').addEventListener('click', closeForm);
      return;
    }
    html += '<form id="event-form" autocomplete="off">' +
      '<label class="field"><span>' + label + '</span><select name="pick">' +
      list.map(function (it, i) {
        return '<option value="' + i + '">' + esc(it.name) + '</option>';
      }).join('') +
      '</select></label>' +
      '<label class="field"><span>' + amountLabel + '</span>' +
      '<input name="amount" type="number" step="1" required /></label>' +
      '<div class="form-row">' +
      '<button class="btn btn-primary" type="submit">确认</button>' +
      '<button class="btn btn-ghost" type="button" id="form-cancel">取消</button>' +
      '</div></form>';
    box.innerHTML = html;
    bindForm(box, type);
  }

  /** 根据字段定义生成一个输入控件 */
  function buildField(f) {
    if (f.type === 'select') {
      return '<label class="field"><span>' + f.label + '</span><select name="' + f.key + '">' +
        f.options.map(function (op) {
          return '<option value="' + op[0] + '">' + op[1] + '</option>';
        }).join('') + '</select></label>';
    }
    return '<label class="field"><span>' + f.label + '</span>' +
      '<input name="' + f.key + '" type="' + f.type + '" step="1"' +
      (f.ph ? ' placeholder="' + f.ph + '"' : '') +
      (f.type === 'text' ? '' : ' required') + ' /></label>';
  }

  /** 绑定表单的提交与取消事件 */
  function bindForm(box, type) {
    var form = box.querySelector('#event-form');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var data = {};
        // 收集所有具名字段
        Array.prototype.forEach.call(form.elements, function (el) {
          if (el.name) data[el.name] = el.value;
        });
        if (typeof UI.onFormSubmit === 'function') {
          UI.onFormSubmit(type, data);
        }
      });
    }
    var cancel = box.querySelector('#form-cancel');
    if (cancel) cancel.addEventListener('click', closeForm);
  }

  /** 关闭并清空表单容器 */
  function closeForm() {
    var box = $('#form-container');
    box.innerHTML = '';
    box.classList.add('hidden');
  }

  /** 编辑已有条目：复用对应表单并预填当前值 */
  function openEditForm(kind, index, state) {
    var box = $('#form-container');
    box.classList.remove('hidden');
    var it, defs, title;
    if (kind === 'extraIncome') {
      it = state.extraIncomes[index]; defs = FORM_DEFS['add-extra-income']; title = '编辑额外收入';
    } else if (kind === 'expense') {
      it = state.expenses[index]; defs = FORM_DEFS['add-expense']; title = '编辑支出';
    } else if (kind === 'liability') {
      it = state.liabilities[index]; defs = FORM_DEFS['add-liability']; title = '编辑负债';
    } else if (kind === 'asset') {
      it = state.assets[index]; defs = FORM_DEFS['buy-asset']; title = '编辑资产';
    } else if (kind === 'dream') {
      it = state.dreams[index];
      defs = [
        { key: 'name', label: '梦想名称', type: 'text' },
        { key: 'target', label: '目标金额（元）', type: 'number' },
        { key: 'invested', label: '已投入金额（元）', type: 'number' }
      ];
      title = '编辑梦想';
    } else {
      return;
    }
    var html = '<h3>' + title + '</h3><form id="event-form" autocomplete="off">';
    defs.forEach(function (f) {
      // 预填当前值
      var field = buildField(f)
        .replace('name="' + f.key + '" type="text"',
          'name="' + f.key + '" type="text" value="' + esc(it[f.key] != null && f.type === 'text' ? it[f.key] : '') + '"');
      html += field;
    });
    html += '<div class="form-row">' +
      '<button class="btn btn-primary" type="submit">保存</button>' +
      '<button class="btn btn-ghost" type="button" id="form-cancel">取消</button>' +
      '</div></form>';
    box.innerHTML = html;

    // 数字字段直接赋值（避免 value 属性转义问题）
    defs.forEach(function (f) {
      if (f.type === 'number') {
        box.querySelector('[name="' + f.key + '"]').value = it[f.key];
      } else if (f.type === 'select') {
        box.querySelector('[name="' + f.key + '"]').value = it[f.key] || 'other';
      }
    });

    // 提交时带上类别与下标，交给 app.js 更新数据
    box.querySelector('#event-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var data = {};
      Array.prototype.forEach.call(ev.target.elements, function (el) {
        if (el.name) data[el.name] = el.value;
      });
      if (typeof UI.onFormSubmit === 'function') {
        UI.onFormSubmit('edit-item', { kind: kind, index: index, data: data });
      }
    });
    box.querySelector('#form-cancel').addEventListener('click', closeForm);
  }

  /* ---------------- 全局导出 ---------------- */

  window.UI = {
    fmt: fmt,
    fmtTime: fmtTime,
    render: render,
    openForm: openForm,
    openEditForm: openEditForm,
    closeForm: closeForm,
    FORM_TITLES: FORM_TITLES,
    // 由 app.js 注入的业务回调
    onFormSubmit: null,
    onItemAction: null
  };
})();
