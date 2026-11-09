/* ============================================================
 * engine.js —— 财务计算引擎
 * 只做计算：纯函数、不修改入参、不碰 DOM
 * 通过 window.Engine 暴露给其他脚本使用（无 ES Module）
 * ============================================================ */

(function () {
  'use strict';

  /** 计算被动收入：所有资产的月现金流之和 */
  function passiveIncome(state) {
    return (state.assets || []).reduce(function (sum, a) {
      return sum + (Number(a.cashflow) || 0);
    }, 0);
  }

  /** 计算总支出：支出列表之和 + 每个孩子 300/月 */
  function totalExpenses(state) {
    var base = (state.expenses || []).reduce(function (sum, e) {
      return sum + (Number(e.amount) || 0);
    }, 0);
    return base + (Number(state.children) || 0) * 300;
  }

  /** 计算总收入：工资 + 被动收入 + 额外收入之和 */
  function totalIncome(state) {
    var extra = (state.extraIncomes || []).reduce(function (sum, e) {
      return sum + (Number(e.amount) || 0);
    }, 0);
    return (Number(state.salary) || 0) + passiveIncome(state) + extra;
  }

  /** 计算净现金流：总收入 - 总支出 */
  function netCashflow(state) {
    return totalIncome(state) - totalExpenses(state);
  }

  /** 计算净资产：现金 + 资产成本之和 - 负债之和 */
  function netWorth(state) {
    var assetSum = (state.assets || []).reduce(function (sum, a) {
      return sum + (Number(a.cost) || 0);
    }, 0);
    var liabilitySum = (state.liabilities || []).reduce(function (sum, l) {
      return sum + (Number(l.amount) || 0);
    }, 0);
    return (Number(state.cash) || 0) + assetSum - liabilitySum;
  }

  /** 判断是否财务自由：被动收入 >= 总支出 */
  function isFree(state) {
    return passiveIncome(state) >= totalExpenses(state);
  }

  /** 判断某个梦想是否达成：已投入 >= 目标金额 */
  function dreamAchieved(dream) {
    return (Number(dream.invested) || 0) >= (Number(dream.target) || 0);
  }

  /** 汇总所有核心指标，返回一个只读快照对象 */
  function summary(state) {
    var passive = passiveIncome(state);
    var expense = totalExpenses(state);
    return {
      passiveIncome: passive,
      totalExpenses: expense,
      totalIncome: totalIncome(state),
      netCashflow: netCashflow(state),
      netWorth: netWorth(state),
      isFree: isFree(state),
      // 财务自由百分比（总支出为 0 时视为 0%，避免除零）
      freedomRatio: expense > 0 ? Math.min(passive / expense, 1) : 0
    };
  }

  // 挂载到全局，供 storage / ui / app 使用
  window.Engine = {
    passiveIncome: passiveIncome,
    totalExpenses: totalExpenses,
    totalIncome: totalIncome,
    netCashflow: netCashflow,
    netWorth: netWorth,
    isFree: isFree,
    dreamAchieved: dreamAchieved,
    summary: summary
  };
})();
