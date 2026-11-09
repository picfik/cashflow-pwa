# 现金流沙盘（手动版）PWA

一个纯前端、零依赖、全离线的手动记账式现金流沙盘。
没有骰子、没有随机事件——系统只做三件事：**计算、记账、判断财务自由**。

## 功能一览

| 功能 | 说明 |
| ---- | ---- |
| 初始化账本 | 输入职业名、初始现金、月工资创建新账本 |
| 财务报表 | 现金 / 被动收入 / 总支出 / 净现金流 / 净资产实时显示 |
| 财务自由进度条 | 被动收入 ÷ 总支出，达 100% 变绿并显示"✅ 已财务自由" |
| 买入资产 | 名称 / 类型 / 成本 / 月现金流，现金相应减少 |
| 卖出资产 | 从列表选择 + 输入卖出价，现金相应增加 |
| 额外收入 / 月支出 / 负债 | 手动添加，支持编辑与删除 |
| 偿还负债 | 从列表选择 + 输入金额，还清自动移除 |
| 现金调整 | 输入正负数字 + 原因 |
| 添加孩子 | 每个孩子固定月支出 +300 |
| 慈善捐赠 | 输入金额，现金减少 |
| 梦想系统 | 新增梦想（名称/目标）、梦想投入，达成显示"🏆 梦想达成" |
| 列表编辑/删除 | 支出 / 负债 / 资产 / 梦想 / 额外收入均可编辑与删除 |
| 操作日志 | 时间 + 内容，最近 50 条，倒序显示 |
| 自动保存 | 每次操作后写入 localStorage（key = `cashflow-state`） |
| 导出/导入 JSON | 手动备份与恢复，导入前二次确认 |
| 重置 | 二次确认后清空数据重新开始 |
| PWA | manifest + service worker，可"添加到主屏幕"，全离线可用 |

## 本地测试

Service Worker 出于安全限制**必须通过 HTTP 服务器访问**（`file://` 协议无法注册 SW），推荐任选其一：

```bash
# 方式一：Python（macOS 自带）
cd cashflow-pwa
python3 -m http.server 8000

# 方式二：Node
npx serve .
```

然后浏览器打开 <http://localhost:8000>。
直接双击 `index.html` 打开时页面功能可用，但 PWA 离线缓存不会生效。

## 部署到 GitHub Pages

1. 在 GitHub 创建一个新仓库（例如 `cashflow-pwa`，Public）。
2. 把本项目所有文件上传到仓库根目录：

   ```bash
   git init
   git add .
   git commit -m "init: 现金流沙盘 PWA"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/cashflow-pwa.git
   git push -u origin main
   ```

3. 打开仓库 **Settings → Pages**。
4. **Source** 选择 `Deploy from a branch`，Branch 选 `main`，目录选 `/ (root)`，保存。
5. 等待 1-2 分钟，访问：
   `https://<你的用户名>.github.io/cashflow-pwa/`
6. 手机/桌面浏览器打开该地址后，通过浏览器菜单"添加到主屏幕 / 安装"即可作为 PWA 使用。

> 提示：GitHub Pages 是 https 站点，Service Worker 会正常注册；
> 所有资源路径均为 `./` 相对路径，子目录部署无需任何修改。

## 图标替换

`icons/icon-192.png` 与 `icons/icon-512.png` 是占位图标。
替换为正式图标时注意：

- 保持文件名与尺寸不变（192×192 与 512×512 的 PNG）；
- 若修改了文件名，需同步更新 `manifest.json` 的 `icons` 字段和 `service-worker.js` 的 `PRECACHE_ASSETS` 列表，并把 `CACHE_NAME` 版本号 +1（如 `cashflow-pwa-v2`）以触发缓存更新；
- 建议使用带安全边距的方形图标（manifest 中已声明 `purpose: "any maskable"`）。

## GitHub 数据同步（可选）

除了 localStorage + 手动导出，应用还支持把账本自动保存为仓库中的 `data/state.json`：

- **打开页面时**：自动从 GitHub 拉取远端数据，与本地比较 `updatedAt`，谁新用谁；
- **数据变化时**：每次记账 2.5 秒后自动提交一次更新（切到后台会立即提交）；
- 每次同步都会在仓库产生一条 commit，可在 GitHub 上看到完整历史，天然具备版本回溯能力。

### 配置步骤

1. 打开 GitHub → 右上角头像 → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**；
2. **Repository access** 选 "Only select repositories"，只勾选 `cashflow-pwa`；
3. **Permissions → Repository permissions → Contents** 设为 **Read and write**，其余保持默认；
4. 生成后复制 token（`github_pat_` 开头）；
5. 在应用中点击顶部"同步设置"，填入用户名（`picfik`）、仓库名（`cashflow-pwa`）、分支（`main`）、文件路径（`data/state.json`）和 token，点击"保存并启用同步"。

### 安全须知

- Token 保存在本机浏览器的 localStorage 中，不会上传到任何第三方；
- 请使用 **fine-grained token 并只授权这一个仓库**，泄露影响最小；怀疑泄露时立即到 GitHub 撤销；
- 每次同步会产生 commit，频繁操作会让提交历史变长，介意的话可以定期在 GitHub 上整理或改用手动"导出 JSON"备份。

## 数据备份说明

- **自动**：每次操作后数据自动写入浏览器 `localStorage`（key = `cashflow-state`）。
  清除浏览器数据、使用无痕模式或换设备都会丢失数据，请定期导出。
- **手动备份**：点击顶部"导出 JSON"，下载 `.json` 文件妥善保存。
- **恢复**：点击"导入 JSON"选择备份文件，二次确认后覆盖当前账本。
  导入时系统会校验数据结构，非法文件会被拒绝。
- 建议：每次重要节点（大额买入、财务自由达成等）后导出一份带日期的备份。

## 可扩展方向

- 多账本管理：在 localStorage 中按 key 保存多份 state 并提供切换界面。
- 月度快照：手动"结转月份"按钮，把当月净现金流累加进现金并归档历史。
- 资产估值记录：为资产增加手动估值字段，纳入净资产计算。
- 数据图表：用 `<canvas>` 手绘净资产与被动收入的趋势折线图（仍保持零依赖）。
- 目标倒计时：给梦想增加截止日期字段，显示剩余天数。
- 备份提醒：结合 Notification API 提醒玩家定期导出 JSON（注意 iOS 支持度）。
