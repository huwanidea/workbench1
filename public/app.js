import { DEFAULT_STATE, PLAN_TYPES, TASK_CATEGORIES, calculateDay, calculateMonth, dateToISO, monthKey, monthLabel, normalizeState, validateState } from './calc.js';

const STORAGE_KEY = 'performance-review-state-v1';
let state = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
let activeTab = 'daily';
let currentMonth = new Date().getMonth() + 1;
let selectedDate = '';
let selectedDailyDate = dateToISO(new Date());
let selectedDailyTaskId = localStorage.getItem('performance-selected-daily-task') || '';
let editingTaskId = null;
let editingSubtasks = [];
let taskFilters = { search: '', planType: '', status: '' };
let summaryFilters = { search: '', source: '', status: '' };
let selectedWorkspaceView = 'performance';
let editingSummaryItem = null;
let draggedSortableBlock = null;
let pointerDailyPanelDrag = null;
let resizingDailyPanel = null;
let dailyTodayViewMode = localStorage.getItem('performance-daily-view-mode') === 'board' ? 'board' : 'list';
const DAILY_PANEL_KEYS = ['today', 'handoff', 'tomorrow', 'weekly', 'monthly'];
const DAILY_GRID_UNITS = 1000;
const DAILY_PANEL_HARD_MIN_PX = 120;
const DAILY_PANEL_WRAP_PX = 230;
const DAILY_PANEL_DEFAULTS = { today: { order: 0, span: 500, frozen: false }, handoff: { order: 1, span: 500, frozen: false }, tomorrow: { order: 2, span: 500, frozen: false }, weekly: { order: 3, span: 500, frozen: false }, monthly: { order: 4, span: 500, frozen: false } };
const DAILY_LAYOUT_PRESETS = { split: { label: '上 2 下 3', rows: [2, 3] }, stacked: { label: '上 1 中 1 下 3', rows: [1, 1, 3] } };
const DAILY_VISIBLE_PANEL_KEYS = ['today', 'handoff', 'tomorrow', 'weekly', 'monthly'];
let dailyLayoutPreset = DAILY_LAYOUT_PRESETS[localStorage.getItem('performance-daily-layout-preset')] ? localStorage.getItem('performance-daily-layout-preset') : 'stacked';
let dailyTaskFileOpen = localStorage.getItem('performance-daily-task-file-open') === null ? dailyLayoutPreset === 'stacked' : localStorage.getItem('performance-daily-task-file-open') === '1';
let dailyRowHeights = (() => { try { return JSON.parse(localStorage.getItem('performance-daily-row-heights') || '{}'); } catch { return {}; } })();
let dailyLayoutRowSizes = (() => { try { return JSON.parse(localStorage.getItem('performance-daily-row-sizes') || '{}'); } catch { return {}; } })();
let resizingDailyRow = null;
function normalizedStoredSpan(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  const migrated = numeric <= 12 ? Math.round(numeric / 12 * DAILY_GRID_UNITS) : Math.round(numeric);
  return Math.min(DAILY_GRID_UNITS, Math.max(1, migrated));
}
function loadDailyPanelLayout() {
  try {
    const stored = JSON.parse(localStorage.getItem('performance-daily-panel-layout') || '{}');
    return Object.fromEntries(DAILY_PANEL_KEYS.map((key) => [key, { order: Number.isFinite(Number(stored[key]?.order)) ? Number(stored[key].order) : DAILY_PANEL_DEFAULTS[key].order, span: normalizedStoredSpan(stored[key]?.span, DAILY_PANEL_DEFAULTS[key].span), frozen: Boolean(stored[key]?.frozen) }]));
  } catch { return structuredClone(DAILY_PANEL_DEFAULTS); }
}
let dailyPanelLayout = loadDailyPanelLayout();
if (localStorage.getItem('performance-tomorrow-panel-visible-v1') !== '1') {
  const ordered = DAILY_VISIBLE_PANEL_KEYS.filter((key) => key !== 'tomorrow').sort((a, b) => dailyPanelLayout[a].order - dailyPanelLayout[b].order);
  const handoffIndex = ordered.indexOf('handoff');
  ordered.splice(handoffIndex >= 0 ? handoffIndex + 1 : Math.min(2, ordered.length), 0, 'tomorrow');
  ordered.forEach((key, index) => { dailyPanelLayout[key].order = index; });
  localStorage.setItem('performance-tomorrow-panel-visible-v1', '1');
}
const saveDailyPanelLayout = () => localStorage.setItem('performance-daily-panel-layout', JSON.stringify(dailyPanelLayout));
const saveDailyRowHeights = () => localStorage.setItem('performance-daily-row-heights', JSON.stringify(dailyRowHeights));
const saveDailyLayoutRowSizes = () => localStorage.setItem('performance-daily-row-sizes', JSON.stringify(dailyLayoutRowSizes));
function currentDailyRowSizes() {
  const stored = dailyLayoutRowSizes[dailyLayoutPreset];
  const valid = Array.isArray(stored) && stored.length && stored.every((size) => Number.isInteger(Number(size)) && Number(size) > 0) && stored.reduce((sum, size) => sum + Number(size), 0) === DAILY_VISIBLE_PANEL_KEYS.length;
  return valid ? stored.map(Number) : [...DAILY_LAYOUT_PRESETS[dailyLayoutPreset].rows];
}
function restoreDailyPanelToRow(fromKey, toKey, clientX) {
  const rows = dailyPanelRows().map((row) => [...row]);
  const sourceRow = rows.find((row) => row.includes(fromKey));
  const targetRow = rows.find((row) => row.includes(toKey));
  if (!sourceRow || !targetRow || sourceRow === targetRow || sourceRow.length !== 1) return false;

  const presetSizes = DAILY_LAYOUT_PRESETS[dailyLayoutPreset].rows;
  const currentSizes = rows.map((row) => row.length);
  const wasAutoWrapped = currentSizes.length > presetSizes.length || currentSizes.some((size, index) => size !== presetSizes[index]);
  if (!wasAutoWrapped || Math.abs(rows.indexOf(sourceRow) - rows.indexOf(targetRow)) !== 1) return false;

  const boardWidth = document.querySelector('.daily-board-layout')?.getBoundingClientRect().width || 0;
  const mergedPanelWidth = boardWidth / (targetRow.length + 1);
  if (boardWidth && mergedPanelWidth < DAILY_PANEL_WRAP_PX) return false;

  sourceRow.splice(sourceRow.indexOf(fromKey), 1);
  const targetIndex = targetRow.indexOf(toKey);
  const targetRect = document.querySelector(`[data-daily-panel="${toKey}"]`)?.getBoundingClientRect();
  const insertAfter = targetRect && Number.isFinite(clientX) ? clientX > targetRect.left + targetRect.width / 2 : rows.indexOf(sourceRow) > rows.indexOf(targetRow);
  targetRow.splice(targetIndex + (insertAfter ? 1 : 0), 0, fromKey);

  const mergedRows = rows.filter((row) => row.length);
  dailyLayoutRowSizes[dailyLayoutPreset] = mergedRows.map((row) => row.length);
  mergedRows.flat().forEach((key, index) => { dailyPanelLayout[key].order = index; });
  const base = Math.floor(DAILY_GRID_UNITS / targetRow.length);
  let remainder = DAILY_GRID_UNITS - base * targetRow.length;
  targetRow.forEach((key) => {
    dailyPanelLayout[key].span = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
  });
  delete dailyRowHeights[dailyLayoutPreset];
  saveDailyLayoutRowSizes();
  saveDailyPanelLayout();
  saveDailyRowHeights();
  return true;
}
function reorderDailyPanels(fromKey, toKey, clientX) {
  if (!fromKey || !toKey || fromKey === toKey) return;
  if (dailyPanelLayout[fromKey]?.frozen || dailyPanelLayout[toKey]?.frozen) return;
  if (restoreDailyPanelToRow(fromKey, toKey, clientX)) {
    render();
    toast('板块已放回同一行，并自动均分宽度');
    return;
  }
  const ordered = DAILY_VISIBLE_PANEL_KEYS.slice().sort((a, b) => dailyPanelLayout[a].order - dailyPanelLayout[b].order);
  const from = ordered.indexOf(fromKey);
  const to = ordered.indexOf(toKey);
  if (from < 0 || to < 0) return;
  [dailyPanelLayout[fromKey].span, dailyPanelLayout[toKey].span] = [dailyPanelLayout[toKey].span, dailyPanelLayout[fromKey].span];
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  ordered.forEach((key, index) => { dailyPanelLayout[key].order = index; });
  saveDailyPanelLayout();
  render();
}
function dailyPanelRows() {
  const ordered = DAILY_VISIBLE_PANEL_KEYS.slice().sort((a, b) => dailyPanelLayout[a].order - dailyPanelLayout[b].order);
  const rows = [];
  let index = 0;
  for (const size of currentDailyRowSizes()) rows.push(ordered.slice(index, index += size));
  return rows;
}
function dailyPanelGeometry(key) {
  const rows = dailyPanelRows();
  const rowIndex = rows.findIndex((row) => row.includes(key));
  const row = rows[rowIndex] || [key];
  const colIndex = row.indexOf(key);
  const span = Math.min(DAILY_GRID_UNITS, Math.max(1, Number(dailyPanelLayout[key].span) || Math.floor(DAILY_GRID_UNITS / row.length)));
  let start = 1;
  for (let i = 0; i < colIndex; i += 1) start += Math.min(DAILY_GRID_UNITS, Math.max(1, Number(dailyPanelLayout[row[i]].span) || Math.floor(DAILY_GRID_UNITS / row.length)));
  return { row: rowIndex + 1, col: Math.min(DAILY_GRID_UNITS, start), span, rowKeys: row };
}
function syncDailyRowGeometry(rowKeys) {
  let col = 1;
  rowKeys.forEach((key) => {
    const panel = document.querySelector(`[data-daily-panel="${key}"]`);
    const span = Math.min(DAILY_GRID_UNITS, Math.max(1, Number(dailyPanelLayout[key].span) || 1));
    panel?.style.setProperty('--panel-col', Math.min(DAILY_GRID_UNITS, col));
    panel?.style.setProperty('--panel-span', span);
    col += span;
  });
}
function applyDailyLayoutPreset(preset) {
  if (!DAILY_LAYOUT_PRESETS[preset]) return;
  dailyLayoutPreset = preset;
  dailyTaskFileOpen = preset === 'stacked';
  localStorage.setItem('performance-daily-task-file-open', dailyTaskFileOpen ? '1' : '0');
  localStorage.setItem('performance-daily-layout-preset', preset);
  dailyLayoutRowSizes[preset] = [...DAILY_LAYOUT_PRESETS[preset].rows];
  saveDailyLayoutRowSizes();
  for (const row of dailyPanelRows()) {
    const base = Math.floor(DAILY_GRID_UNITS / row.length);
    let remainder = DAILY_GRID_UNITS - base * row.length;
    row.forEach((key) => { dailyPanelLayout[key].span = base + (remainder > 0 ? 1 : 0); remainder -= 1; });
  }
  saveDailyPanelLayout();
  render();
}
function normalizeDailyRowSpans() {
  for (const row of dailyPanelRows()) {
    if (row.length === 1) { dailyPanelLayout[row[0]].span = DAILY_GRID_UNITS; continue; }
    const sum = row.reduce((total, key) => total + (Number(dailyPanelLayout[key].span) || 0), 0);
    if (sum === DAILY_GRID_UNITS) continue;
    const base = Math.floor(DAILY_GRID_UNITS / row.length);
    let remainder = DAILY_GRID_UNITS - base * row.length;
    row.forEach((key) => { dailyPanelLayout[key].span = base + (remainder > 0 ? 1 : 0); remainder -= 1; });
  }
  saveDailyPanelLayout();
}
normalizeDailyRowSpans();
function splitDailyResizeRow(resize, smallerKey) {
  const rows = dailyPanelRows();
  const rowIndex = rows.findIndex((row) => row.includes(resize.key));
  const row = rows[rowIndex];
  if (!row || row.length !== 2) return false;
  if (smallerKey === resize.key) {
    const neighborKey = resize.neighborKey;
    [dailyPanelLayout[resize.key].order, dailyPanelLayout[neighborKey].order] = [dailyPanelLayout[neighborKey].order, dailyPanelLayout[resize.key].order];
  }
  const sizes = currentDailyRowSizes();
  sizes.splice(rowIndex, 1, 1, 1);
  dailyLayoutRowSizes[dailyLayoutPreset] = sizes;
  row.forEach((key) => { dailyPanelLayout[key].span = DAILY_GRID_UNITS; });
  delete dailyRowHeights[dailyLayoutPreset];
  saveDailyLayoutRowSizes();
  saveDailyPanelLayout();
  saveDailyRowHeights();
  return true;
}
function dailyBoardRowsStyle() {
  const rows = dailyPanelRows();
  const heights = Array.isArray(dailyRowHeights[dailyLayoutPreset]) ? dailyRowHeights[dailyLayoutPreset] : [];
  return heights.length === rows.length ? `grid-template-rows:${heights.map((height) => `minmax(${Math.max(180, Number(height) || 180)}px,max-content)`).join(' ')}` : '';
}
function toggleDailyPanelFreeze(action) {
  const panel = action.closest('[data-daily-panel]');
  const key = panel?.dataset.dailyPanel;
  if (!key || !dailyPanelLayout[key]) return;
  dailyPanelLayout[key].frozen = !dailyPanelLayout[key].frozen;
  saveDailyPanelLayout();
  render();
  toast(dailyPanelLayout[key].frozen ? '板块已冻结，仅保留勾选操作' : '板块已解冻');
}
let sidebarCollapsed = localStorage.getItem('performance-sidebar-collapsed') === '1';
const expandedTaskIds = new Set();
const expandedPoolIds = new Set();
let selectedPlanDate = dateToISO(new Date());
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const num = (value, digits = 1) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits);
const pct = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`;
const PERCENT_FIELDS = ['completionPct', 'collaborationPct', 'innovation', 'selfScore', 'reviewerScore'];
const formNumber = (key, value) => value === '' ? '' : PERCENT_FIELDS.includes(key) ? Math.min(100, Math.max(0, Number(value) || 0)) : Math.max(0, Number(value) || 0);
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const toast = (message) => { const node = $('#toast'); node.textContent = message; node.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('show'), 2600); };
const currentYear = () => Number(state.profile.year) || new Date().getFullYear();
const selectedMonthKey = () => monthKey(currentYear(), currentMonth);
const taskForId = (id) => state.tasks.find((task) => task.id === id);
const inputValue = (value) => esc(value ?? '');

function setActiveTab(tab) {
  if (tab === 'tasks') { tab = 'summary'; selectedWorkspaceView = 'performance'; }
  activeTab = tab;
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${tab}`));
  render();
}

function render() {
  $('#view-daily').innerHTML = renderDailyWorkspace();
  syncDailyPanelLockState();
  $('#view-overview').innerHTML = renderOverview();
  $('#view-summary').innerHTML = renderPerformancePanorama();
  $('#view-acceptance').innerHTML = renderAcceptance();
  $('#view-monthly').innerHTML = renderMonthly();
  $('#view-settings').innerHTML = renderSettings();
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.tab === activeTab));
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${activeTab}`));
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.toggle('collapsed', sidebarCollapsed);
  const toggle = document.querySelector('.sidebar-toggle');
  toggle.textContent = sidebarCollapsed ? '›' : '‹';
  toggle.setAttribute('aria-label', sidebarCollapsed ? '展开侧边栏' : '收起侧边栏');
  const databaseViewSource = { pool: 'pool', weekly: 'weekly', monthly: 'monthly' }[selectedWorkspaceView];
  const summaryCreateType = $('#summary-create-type');
  const summarySourceFilter = $('[data-summary-filter="source"]');
  const databaseTableTitle = $('.summary-smart-table-card .sheet-view-title strong');
  if (databaseTableTitle) databaseTableTitle.textContent = `${{ performance: '全部事项', pool: '任务池', weekly: '周计划', monthly: '月计划' }[selectedWorkspaceView] || '全部事项'} · 数据表`;
  const todayTypeOption = summaryCreateType?.querySelector('option[value="daily-today"]');
  if (todayTypeOption) todayTypeOption.textContent = '今日工作动态';
  if (databaseViewSource && summaryCreateType) { summaryCreateType.value = databaseViewSource; summaryCreateType.disabled = true; }
  if (databaseViewSource && summarySourceFilter) summarySourceFilter.disabled = true;
}

function syncDailyPanelLockState() {
  document.querySelectorAll('[data-daily-panel]').forEach((panel) => {
    const frozen = Boolean(dailyPanelLayout[panel.dataset.dailyPanel]?.frozen);
    panel.classList.toggle('is-frozen', frozen);
    panel.querySelectorAll('input, select, button').forEach((control) => {
      if (control.dataset.action === 'toggle-daily-panel-freeze' || control.type === 'checkbox') return;
      control.disabled = frozen;
    });
    const resize = panel.querySelector('[data-panel-resize]');
    if (resize) resize.setAttribute('aria-hidden', frozen ? 'true' : 'false');
  });
  syncDailyRowResizeHandles();
}

function syncDailyRowResizeHandles() {
  const board = document.querySelector('.daily-board-layout');
  if (!board) return;
  const boardRect = board.getBoundingClientRect();
  dailyPanelRows().slice(0, -1).forEach((row, index) => {
    const handle = board.querySelector(`[data-row-resize="${index}"]`);
    if (!handle) return;
    const bottom = Math.max(...row.map((key) => document.querySelector(`[data-daily-panel="${key}"]`)?.getBoundingClientRect().bottom || boardRect.top));
    handle.style.top = `${Math.max(0, bottom - boardRect.top - 5)}px`;
    handle.classList.toggle('disabled', row.some((key) => dailyPanelLayout[key]?.frozen) || dailyPanelRows()[index + 1].some((key) => dailyPanelLayout[key]?.frozen));
  });
}

function renderProfileStrip() {
  const fields = [['name', '姓名'], ['department', '部门'], ['position', '岗位'], ['manager', '直属负责人']];
  return `<div class="profile-strip card">${fields.map(([key, label]) => `<div class="profile-cell"><small>${label}</small><div class="profile-edit"><input class="input" data-profile="${key}" value="${inputValue(state.profile[key])}" placeholder="未填写"></div></div>`).join('')}<div class="profile-cell"><small>考核年度</small><input class="input" data-profile="year" type="number" min="2000" max="2100" value="${currentYear()}"></div></div>`;
}

function renderOverview() {
  const month = calculateMonth(currentYear(), currentMonth, state);
  const current = selectedDate ? month.days.find((day) => day.date === selectedDate) : month.days.find((day) => day.date === dateToISO(new Date())) || month.days[0];
  const validation = validateState(state);
  const kpis = [['月度最终绩效', month.finalPerformance === null ? '待完善' : num(month.finalPerformance), month.grade || '完成四项素养评分后生成'], ['绩效兑现比例', month.payoutRatio === null ? '待完善' : pct(month.payoutRatio * 100), '线性兑现，最高 100%'], ['月度奖励总分', num(month.monthlyReward), month.payoutRatio === 1 ? '已满足奖励门槛' : '绩效满 100% 后兑现'], ['平均每日绩效', pct(month.averageDailyPerformance), `${month.scoredDays} 天已完成计算`], ['任务总数', String(state.tasks.filter((task) => task.date?.startsWith(`${currentYear()}-${String(currentMonth).padStart(2, '0')}`)).length), `${validation.length ? validation.length + ' 项数据需要修正' : '当前月份数据正常'}`]];
  return `${renderProfileStrip()}<div class="page-head"><div><span class="eyebrow">Overview</span><h1>绩效总览</h1><p>把每天的工作投入，变成清晰可追踪的绩效结果。</p></div><div class="head-controls"><label class="label" for="overview-month">查看月份</label><select id="overview-month" class="select" data-month-select>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === currentMonth ? 'selected' : ''}>${currentYear()} 年 ${i + 1} 月</option>`).join('')}</select><button class="button primary" data-action="add-task">新增任务</button></div></div><div class="kpi-grid">${kpis.map(([label, value, sub], index) => `<div class="kpi card ${index === 0 ? 'accent' : ''}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></div>`).join('')}</div><div class="two-col"><div class="section-card card"><div class="section-title"><div><h2>${currentYear()} 年 ${currentMonth} 月每日进度</h2><p>点击某一天查看工时水位和奖励构成</p></div><span class="tag green">${month.scoredDays}/${month.days.filter((day) => day.standardHours > 0 && day.date <= dateToISO(new Date())).length || 0} 天已计算</span></div>${renderCalendar(month)}</div><div class="section-card card">${renderDayDetail(current || month.days[0])}</div></div>`;
}

function weekStart(dateString) {
  const date = new Date(`${dateString || dateToISO(new Date())}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return dateToISO(date);
}
function weekKey(dateString) { return weekStart(dateString); }
function planFor(kind, key) { const bucket = state.plans[kind] || (state.plans[kind] = {}); return bucket[key] || (bucket[key] = { title: '', notes: '', items: [] }); }

function shiftDate(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dateToISO(date);
}

function dailyPlanFor(dateString) {
  return state.dailyPlans[dateString] || (state.dailyPlans[dateString] = { today: [], tomorrow: [] });
}

function makeTaskRecord(content, date, extra = {}) {
  return { id: crypto.randomUUID(), date, content, body: '', category: state.settings.taskCategories[0] || '其他', planType: '单人工作', collaborator: '', estimatedHours: '', actualHours: '', completionPct: 0, collaborationPct: 0, innovation: '', selfScore: '', reviewerScore: '', nextPlan: '', blocker: '', breakthrough: '', subtasks: [], ...extra };
}

function migrateDailyPlansToTasks() {
  let changed = false;
  for (const [date, plan] of Object.entries(state.dailyPlans || {})) {
    for (const item of plan.today || []) {
      if (!state.tasks.some((task) => task.sourceDailyItemId === item.id || task.id === `daily-task-${item.id}`)) state.tasks.push(makeTaskRecord(item.text, date, { id: `daily-task-${item.id}`, completionPct: item.done ? 100 : 0, order: item.order, sourceDailyItemId: item.id }));
      changed = true;
    }
    if ((plan.today || []).length) plan.today = [];
  }
  if (changed) save();
}

function seedDemoData() {
  const demoKey = 'performance-demo-seeded-v2';
  if (localStorage.getItem(demoKey) === '1') return;
  const today = dateToISO(new Date());
  const tomorrow = shiftDate(today, 1);
  const taskSamples = [
    { id: 'demo-task-review', date: today, content: '完成客户反馈汇总与优先级梳理', category: '需求开发', planType: '单人工作', collaborator: '', estimatedHours: 2, actualHours: 1.8, completionPct: 100, collaborationPct: 0, innovation: 8, selfScore: 94, reviewerScore: 92, nextPlan: '根据反馈拆分下周迭代任务', blocker: '', breakthrough: '建立统一的反馈分类模板', order: 30 },
    { id: 'demo-task-mobile', date: today, content: '修复移动端任务表格适配问题', category: 'Bug 修复', planType: '协同工作', collaborator: '产品同事', estimatedHours: 3, actualHours: 2.5, completionPct: 70, collaborationPct: 30, innovation: '', selfScore: 88, reviewerScore: '', nextPlan: '完成真机回归测试', blocker: '等待测试设备', breakthrough: '', order: 40 },
    { id: 'demo-task-report', date: tomorrow, content: '搭建周度绩效数据复盘模板', category: '文档撰写', planType: '拓展工作', collaborator: '', estimatedHours: 2, actualHours: '', completionPct: 0, collaborationPct: 0, innovation: 15, selfScore: '', reviewerScore: '', nextPlan: '', blocker: '', breakthrough: '', order: 20 },
  ];
  for (const sample of taskSamples) if (!state.tasks.some((task) => task.id === sample.id)) state.tasks.push(sample);
  const todayPlan = dailyPlanFor(today);
  if (!todayPlan.tomorrow.some((item) => item.id === 'demo-daily-tomorrow')) todayPlan.tomorrow.push({ id: 'demo-daily-tomorrow', text: '准备明天的项目进度同步', done: false, order: 10 });
  const yesterdayPlan = dailyPlanFor(shiftDate(today, -1));
  if (!yesterdayPlan.tomorrow.some((item) => item.id === 'demo-yesterday-today')) yesterdayPlan.tomorrow.push({ id: 'demo-yesterday-today', text: '跟进客户反馈并输出处理结论', done: false, order: 10 });
  const poolSamples = [
    { id: 'demo-pool-api', title: '梳理接口异常监控清单', description: '列出核心接口、告警阈值和负责人', category: '项目管理', planType: '协同工作', priority: '高', dueDate: tomorrow, status: 'doing', reviewer: '项目负责人', acceptanceStatus: '', performanceTaskId: '', createdAt: new Date().toISOString(), completedAt: '' },
    { id: 'demo-pool-guide', title: '补充新成员上手指南', description: '整理环境配置和常见问题', category: '文档撰写', planType: '单人工作', priority: '普通', dueDate: shiftDate(today, 3), status: 'todo', reviewer: '', acceptanceStatus: '', performanceTaskId: '', createdAt: new Date().toISOString(), completedAt: '' },
  ];
  for (const sample of poolSamples) if (!state.workItems.some((item) => item.id === sample.id)) state.workItems.push(sample);
  const weekly = planFor('weekly', weekKey(today));
  if (!weekly.title) weekly.title = '本周交付与质量提升';
  if (!weekly.items.some((item) => item.id === 'demo-weekly-release')) weekly.items.push({ id: 'demo-weekly-release', text: '完成本周版本发布与复盘', done: false, order: 10 });
  if (!weekly.items.some((item) => item.id === 'demo-weekly-debt')) weekly.items.push({ id: 'demo-weekly-debt', text: '关闭两项高优先级技术债', done: false, order: 20 });
  const monthly = planFor('monthly', today.slice(0, 7));
  if (!monthly.title) monthly.title = '交付稳定性与效率';
  if (!monthly.items.some((item) => item.id === 'demo-monthly-quality')) monthly.items.push({ id: 'demo-monthly-quality', text: '将核心流程缺陷率降低 20%', done: false, order: 10 });
  if (!monthly.items.some((item) => item.id === 'demo-monthly-template')) monthly.items.push({ id: 'demo-monthly-template', text: '沉淀一套可复用的复盘模板', done: false, order: 20 });
  save();
  localStorage.setItem(demoKey, '1');
}

function sortWorkBlocks(entries) {
  return entries.map((entry, index) => ({ ...entry, fallbackOrder: index * 10 })).sort((a, b) => {
    const aOrder = a.item[a.orderKey || 'order'];
    const bOrder = b.item[b.orderKey || 'order'];
    return (Number.isFinite(Number(aOrder)) ? Number(aOrder) : a.fallbackOrder) - (Number.isFinite(Number(bOrder)) ? Number(bOrder) : b.fallbackOrder);
  });
}

function sortableBlockEntries(group) {
  const [scope, first, second] = group.split('|');
  if (scope === 'daily') {
    const planEntries = (dailyPlanFor(first)[second] || []).map((item) => ({ kind: 'daily', item }));
    const taskEntries = second === 'today'
      ? state.tasks.filter((task) => task.date === first).map((item) => ({ kind: 'task', item }))
      : state.tasks.filter((task) => task.date === first && task.nextPlan?.trim()).map((item) => ({ kind: 'task-next', item, orderKey: 'nextPlanOrder' }));
    return sortWorkBlocks([...planEntries, ...taskEntries]);
  }
  if (scope === 'handoff') {
    const sourceDate = shiftDate(first, -1);
    const sourcePlan = state.dailyPlans[sourceDate] || { tomorrow: [] };
    const planEntries = (sourcePlan.tomorrow || []).filter((item) => item.text?.trim()).map((item) => ({ kind: 'handoff-daily', item, sourceDate }));
    const taskEntries = state.tasks.filter((task) => task.date === sourceDate && task.nextPlan?.trim()).map((item) => ({ kind: 'handoff-task', item, sourceDate, orderKey: 'nextPlanOrder' }));
    return sortWorkBlocks([...planEntries, ...taskEntries]);
  }
  if (scope === 'plan') return sortWorkBlocks(planFor(first, second).items.map((item) => ({ kind: first, item })));
  return [];
}

function reorderSortableBlocks(group, draggedKey, targetKey, placeAfter) {
  const entries = sortableBlockEntries(group);
  const from = entries.findIndex((entry) => `${entry.kind}:${entry.item.id}` === draggedKey);
  let to = entries.findIndex((entry) => `${entry.kind}:${entry.item.id}` === targetKey);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = entries.splice(from, 1);
  if (from < to) to -= 1;
  entries.splice(to + (placeAfter ? 1 : 0), 0, moved);
  entries.forEach((entry, index) => { entry.item[entry.orderKey || 'order'] = (index + 1) * 10; });
  save(); render();
}

function copySortableBlock(sourceGroup, sourceKey, targetGroup) {
  const source = sortableBlockEntries(sourceGroup).find((entry) => `${entry.kind}:${entry.item.id}` === sourceKey);
  if (!source) return false;
  const text = ['task-next', 'handoff-task'].includes(source.kind) ? source.item.nextPlan : ['task', 'task-next'].includes(source.kind) ? source.item.content : source.item.text;
  if (!text?.trim()) return false;
  const [scope, first, second] = targetGroup.split('|');
  const targetEntries = sortableBlockEntries(targetGroup);
  const nextOrder = targetEntries.reduce((max, entry) => Math.max(max, Number(entry.item[entry.orderKey || 'order']) || 0), 0) + 10;
  if (scope === 'daily' && second === 'today') {
    if (state.tasks.some((task) => task.date === first && task.content.trim() === text.trim())) return toast('今日工作动态中已存在这条记录'), false;
    state.tasks.push(makeTaskRecord(text.trim(), first, { order: nextOrder }));
  } else if (scope === 'daily') {
    const target = dailyPlanFor(first)[second];
    if (target.some((item) => item.text.trim() === text.trim())) return toast('目标计划中已存在'), false;
    target.push({ id: crypto.randomUUID(), text: text.trim(), done: false, order: nextOrder });
  } else if (scope === 'plan') {
    const target = planFor(first, second).items;
    if (target.some((item) => item.text.trim() === text.trim())) return toast('目标计划中已存在'), false;
    target.push({ id: crypto.randomUUID(), text: text.trim(), done: false, order: nextOrder });
  } else if (scope === 'handoff') {
    const target = dailyPlanFor(shiftDate(first, -1)).tomorrow;
    if (target.some((item) => item.text.trim() === text.trim())) return toast('昨日计划中已存在'), false;
    target.push({ id: crypto.randomUUID(), text: text.trim(), done: false, order: nextOrder });
  } else return false;
  save(); render(); toast('已复制到目标板块'); return true;
}

function toggleBlockFreeze(action) {
  const block = action.closest('[data-sortable-block]');
  if (!block) return;
  const entry = sortableBlockEntries(block.dataset.sortGroup).find((item) => `${item.kind}:${item.item.id}` === block.dataset.blockKey);
  if (!entry) return;
  const key = entry.kind === 'task-next' ? 'nextPlanFrozen' : 'frozen';
  entry.item[key] = !entry.item[key];
  save(); render(); toast(entry.item[key] ? '块已冻结，仍可勾选完成' : '块已解除冻结');
}

function setBlockProgressFromDrop(group, blockKey, status) {
  const entry = sortableBlockEntries(group).find((item) => `${item.kind}:${item.item.id}` === blockKey);
  if (!entry) return;
  if (entry.kind === 'task') entry.item.completionPct = { todo: 0, doing: 50, done: 100 }[status];
  else if (entry.kind === 'daily') entry.item.done = status === 'done';
}

migrateDailyPlansToTasks();
seedDemoData();

function renderDailyWorkspace() {
  const date = selectedDailyDate;
  const yesterday = shiftDate(date, -1);
  const tomorrow = shiftDate(date, 1);
  const plan = state.dailyPlans[date] || { today: [], tomorrow: [] };
  const yesterdayPlan = state.dailyPlans[yesterday] || { today: [], tomorrow: [] };
  const todayTasks = state.tasks.filter((task) => task.date === date);
  const yesterdayTasks = state.tasks.filter((task) => task.date === yesterday && task.nextPlan?.trim());
  const inherited = [
    ...(yesterdayPlan.tomorrow || []).filter((item) => item.text?.trim()).map((item) => ({ ...item, source: 'daily', sourceDate: yesterday })),
    ...yesterdayTasks.map((task) => ({ id: task.id, text: task.nextPlan, done: false, source: 'task', sourceDate: yesterday })),
  ];
  const weeklyKey = weekKey(date);
  const monthlyKey = date.slice(0, 7);
  const weeklyPlan = state.plans.weekly?.[weeklyKey] || { title: '', notes: '', items: [] };
  const monthlyPlan = state.plans.monthly?.[monthlyKey] || { title: '', notes: '', items: [] };
  const finishedToday = (plan.today || []).filter((item) => item.done).length + todayTasks.filter((task) => Number(task.completionPct) >= 100).length;
  const todayTotal = (plan.today || []).length + todayTasks.length;
  const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${date}T12:00:00`));

  const blockAttrs = (group, key) => `data-sortable-block data-sort-group="${group}" data-block-key="${key}"`;
  const dailyItem = (item, bucket) => {
    const group = `daily|${date}|${bucket}`;
    const frozen = false;
    return `<div class="daily-block ${item.done ? 'done' : ''} ${frozen ? 'frozen' : ''}" ${blockAttrs(group, `daily:${item.id}`)}><span class="daily-block-handle ${frozen ? 'disabled' : ''}" draggable="${!frozen}" title="${frozen ? '已冻结' : '拖拽排序'}" aria-hidden="true">⋮⋮</span><input type="checkbox" data-action="toggle-daily-item" data-daily-date="${date}" data-daily-bucket="${bucket}" data-item-id="${item.id}" ${item.done ? 'checked' : ''}><div class="daily-block-main"><input class="daily-block-title" data-daily-item-field="text" data-daily-date="${date}" data-daily-bucket="${bucket}" data-item-id="${item.id}" value="${inputValue(item.text)}" ${frozen ? 'readonly' : ''}><small>${bucket === 'today' ? '今日工作动态' : '明日计划'} · 计划块</small></div><select class="daily-status-select ${item.done ? 'tone-green' : 'tone-gold'}" data-daily-plan-status data-date="${date}" data-bucket="${bucket}" data-item-id="${item.id}" ${frozen ? 'disabled' : ''}><option value="pending" ${!item.done ? 'selected' : ''}>待推进</option><option value="done" ${item.done ? 'selected' : ''}>已完成</option></select><div class="daily-block-actions"><button class="link-button" data-action="toggle-block-freeze">${frozen ? '解冻' : '冻结'}</button><button class="link-button" data-action="focus-block-edit" ${frozen ? 'disabled' : ''}>编辑</button><button class="daily-delete" data-action="delete-daily-item" data-daily-date="${date}" data-daily-bucket="${bucket}" data-item-id="${item.id}" aria-label="删除计划" ${frozen ? 'disabled' : ''}>×</button></div></div>`;
  };
  const taskSubtasks = (task) => {
    const items = Array.isArray(task.subtasks) ? task.subtasks : [];
    return `<div class="task-subtasks" data-task-subtasks="${task.id}">${items.map((item) => `<div class="task-subtask ${item.done ? 'done' : ''}"><input type="checkbox" data-action="toggle-task-subtask" data-task-id="${task.id}" data-subtask-id="${item.id}" ${item.done ? 'checked' : ''} aria-label="完成子任务"><input class="task-subtask-input" data-task-subtask-field="text" data-task-id="${task.id}" data-subtask-id="${item.id}" value="${inputValue(item.text)}" placeholder="子任务名称"><button type="button" class="task-subtask-delete" data-action="delete-task-subtask" data-task-id="${task.id}" data-subtask-id="${item.id}" aria-label="删除子任务">×</button></div>`).join('')}<button type="button" class="task-subtask-add" data-action="add-task-subtask" data-task-id="${task.id}">+ 子任务</button></div>`;
  };
  const addRow = (bucket, placeholder) => `<div class="daily-add-row"><input class="input" data-daily-new="${bucket}" data-date="${date}" placeholder="${placeholder}"><button class="button primary" data-action="add-daily-item" data-daily-date="${date}" data-daily-bucket="${bucket}">添加</button></div>`;
  const taskBlock = (task) => {
    const calculated = calculateDay(task.date, [task], state).tasks[0];
    const progressStatus = Number(task.completionPct) >= 100 ? 'done' : Number(task.completionPct) > 0 ? 'doing' : 'todo';
    const group = `daily|${date}|today`;
    const frozen = false;
    return `<div class="daily-block task-file ${progressStatus === 'done' ? 'done' : ''} ${frozen ? 'frozen' : ''}" ${blockAttrs(group, `task:${task.id}`)}><span class="daily-block-handle ${frozen ? 'disabled' : ''}" draggable="${!frozen}" title="${frozen ? '已冻结' : '拖拽排序'}" aria-hidden="true">⋮⋮</span><input class="daily-task-check" type="checkbox" data-action="toggle-daily-task" data-id="${task.id}" aria-label="标记 ${esc(task.content || '未命名任务')} 完成" ${progressStatus === 'done' ? 'checked' : ''}><div class="daily-block-main"><div class="task-file-title"><span class="task-file-icon">□</span><input class="daily-block-title" data-daily-task-field="content" data-id="${task.id}" value="${inputValue(task.content)}" placeholder="填写任务内容" ${frozen ? 'readonly' : ''}></div><small>${esc(task.category)} · ${esc(task.planType)} <span class="daily-info-status ${calculated.validationErrors.length ? 'incomplete' : 'complete'}">${calculated.validationErrors.length ? '信息待完善' : '信息完整'}</span></small>${taskSubtasks(task)}</div><select class="daily-status-select ${progressStatus === 'done' ? 'tone-green' : progressStatus === 'doing' ? 'tone-gold' : ''}" data-daily-task-status data-id="${task.id}" ${frozen ? 'disabled' : ''}><option value="todo" ${progressStatus === 'todo' ? 'selected' : ''}>待开始</option><option value="doing" ${progressStatus === 'doing' ? 'selected' : ''}>进行中</option><option value="done" ${progressStatus === 'done' ? 'selected' : ''}>已完成</option></select><div class="daily-block-actions"><button class="link-button" data-action="edit-task" data-id="${task.id}" ${frozen ? 'disabled' : ''}>打开文件</button><button class="daily-delete" data-action="delete-task" data-id="${task.id}" aria-label="删除任务" ${frozen ? 'disabled' : ''}>×</button></div></div>`;
  };
  const todayEntries = sortWorkBlocks([...(plan.today || []).map((item) => ({ kind: 'daily', item })), ...todayTasks.map((item) => ({ kind: 'task', item }))]);
  const renderTodayEntry = (entry) => entry.kind === 'task' ? taskBlock(entry.item) : dailyItem(entry.item, 'today');
  const todayBlocks = todayEntries.map(renderTodayEntry).join('');
  const todayTaskEntries = sortWorkBlocks(todayTasks.map((item) => ({ kind: 'task', item })));
  if (!todayTaskEntries.some((entry) => entry.item.id === selectedDailyTaskId)) {
    selectedDailyTaskId = todayTaskEntries[0]?.item.id || '';
    localStorage.setItem('performance-selected-daily-task', selectedDailyTaskId);
  }
  const selectedTask = todayTaskEntries.find((entry) => entry.item.id === selectedDailyTaskId)?.item || null;
  const dailyTaskListRow = (task) => {
    const calculated = calculateDay(task.date, [task], state).tasks[0];
    const progressStatus = Number(task.completionPct) >= 100 ? 'done' : Number(task.completionPct) > 0 ? 'doing' : 'todo';
    const group = `daily|${date}|today`;
    return `<div class="today-task-row ${task.id === selectedDailyTaskId ? 'selected' : ''}" ${blockAttrs(group, `task:${task.id}`)}><span class="daily-block-handle" draggable="true" title="拖拽排序" aria-hidden="true">⋮⋮</span><input class="daily-task-check" type="checkbox" data-action="toggle-daily-task" data-id="${task.id}" aria-label="标记 ${esc(task.content || '未命名任务')} 完成" ${progressStatus === 'done' ? 'checked' : ''}><button type="button" class="today-task-select" data-action="select-daily-task" data-id="${task.id}"><span class="task-file-icon">□</span><span class="today-task-copy"><strong>${esc(task.content || '未命名任务')}</strong><small>${esc(task.category || '其他')} · <span class="daily-info-status ${calculated.validationErrors.length ? 'incomplete' : 'complete'}">${calculated.validationErrors.length ? '信息待完善' : '信息完整'}</span></small></span></button><select class="daily-status-select ${progressStatus === 'done' ? 'tone-green' : progressStatus === 'doing' ? 'tone-gold' : ''}" data-daily-task-status data-id="${task.id}"><option value="todo" ${progressStatus === 'todo' ? 'selected' : ''}>待开始</option><option value="doing" ${progressStatus === 'doing' ? 'selected' : ''}>进行中</option><option value="done" ${progressStatus === 'done' ? 'selected' : ''}>已完成</option></select></div>`;
  };
  const dailyTaskField = (task, field, label, type = 'text', extra = '') => `<label class="today-doc-field"><span>${label}</span><input class="input" data-daily-task-file-field="${field}" data-id="${task.id}" type="${type}" value="${inputValue(task[field])}" ${extra}></label>`;
  const dailyTaskSelect = (task, field, label, options) => `<label class="today-doc-field"><span>${label}</span><select class="select" data-daily-task-file-field="${field}" data-id="${task.id}">${options.map((option) => `<option value="${inputValue(option)}" ${String(task[field] || '') === String(option) ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`;
  const renderDailyTaskDocument = (task) => {
    if (!task) return '<div class="today-task-document-empty"><span class="task-file-icon">□</span><strong>选择一个任务文件</strong><p>从左侧任务列表打开今天的工作记录。</p></div>';
    const calculated = calculateDay(task.date, [task], state).tasks[0];
    const progressStatus = Number(task.completionPct) >= 100 ? 'done' : Number(task.completionPct) > 0 ? 'doing' : 'todo';
    const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    return `<article class="today-task-document"><div class="today-doc-header"><div class="today-doc-breadcrumb"><span class="task-file-icon">□</span><span>今日工作动态</span><span>/</span><span>${esc(task.date)}</span><span>/</span><span>${esc(task.content || '未命名任务')}.md</span></div><span class="daily-info-status ${calculated.validationErrors.length ? 'incomplete' : 'complete'}">${calculated.validationErrors.length ? '信息待完善' : '信息完整'}</span></div><div class="today-doc-properties"><label class="today-doc-field today-doc-title-field"><span>文件名</span><input class="today-doc-title" data-daily-task-file-field="content" data-id="${task.id}" value="${inputValue(task.content)}" placeholder="未命名任务"></label>${dailyTaskField(task, 'date', '日期', 'date', 'required')}${dailyTaskSelect(task, 'category', '分类', state.settings.taskCategories || TASK_CATEGORIES)}${dailyTaskSelect(task, 'planType', '计划类型', PLAN_TYPES)}${dailyTaskField(task, 'collaborator', '协作人')}${dailyTaskField(task, 'estimatedHours', '预计工时 (h)', 'number', 'step="0.1" min="0"')}${dailyTaskField(task, 'actualHours', '实际工时 (h)', 'number', 'step="0.1" min="0"')}${dailyTaskField(task, 'completionPct', '交付完成 (%)', 'number', 'min="0" max="100"')}${dailyTaskField(task, 'collaborationPct', '协作完成 (%)', 'number', 'min="0" max="100"')}${dailyTaskField(task, 'innovation', '创新分', 'number', 'min="0" max="100"')}${dailyTaskField(task, 'selfScore', '自评分', 'number', 'min="0" max="100"')}${dailyTaskField(task, 'reviewerScore', '负责人评分', 'number', 'min="0" max="100"')}<label class="today-doc-field"><span>状态</span><select class="select" data-daily-task-file-field="completionPct" data-id="${task.id}"><option value="0" ${progressStatus === 'todo' ? 'selected' : ''}>待开始</option><option value="50" ${progressStatus === 'doing' ? 'selected' : ''}>进行中</option><option value="100" ${progressStatus === 'done' ? 'selected' : ''}>已完成</option></select></label></div><div class="today-doc-editor"><div class="today-doc-editor-head"><span>正文 · Markdown</span><span class="task-file-path">${esc(task.date || '未设置')}.md</span></div><textarea class="today-doc-markdown" data-daily-task-file-field="body" data-id="${task.id}" placeholder="记录任务背景、执行过程、结论和链接……">${inputValue(task.body)}</textarea></div><section class="today-doc-section"><div class="today-doc-section-head"><strong>子任务</strong><span>${subtasks.length} 项</span></div><div class="today-doc-subtasks">${subtasks.map((item) => `<div class="task-subtask ${item.done ? 'done' : ''}"><input type="checkbox" data-action="toggle-task-subtask" data-task-id="${task.id}" data-subtask-id="${item.id}" ${item.done ? 'checked' : ''} aria-label="完成子任务"><input class="task-subtask-input" data-task-subtask-field="text" data-task-id="${task.id}" data-subtask-id="${item.id}" value="${inputValue(item.text)}" placeholder="子任务名称"><button type="button" class="task-subtask-delete" data-action="delete-task-subtask" data-task-id="${task.id}" data-subtask-id="${item.id}" aria-label="删除子任务">×</button></div>`).join('')}<button type="button" class="task-subtask-add" data-action="add-task-subtask" data-task-id="${task.id}">+ 子任务</button></div></section><div class="today-doc-notes"><label class="form-field"><span class="label">阻塞问题 / 备注</span><textarea class="textarea" data-daily-task-file-field="blocker" data-id="${task.id}">${inputValue(task.blocker)}</textarea></label><label class="form-field"><span class="label">重大突破创新内容</span><textarea class="textarea" data-daily-task-file-field="breakthrough" data-id="${task.id}">${inputValue(task.breakthrough)}</textarea></label><label class="form-field"><span class="label">明日安排</span><textarea class="textarea" data-daily-task-file-field="nextPlan" data-id="${task.id}">${inputValue(task.nextPlan)}</textarea></label></div></article>`;
  };
  const entryStatus = (entry) => entry.kind === 'task' ? (Number(entry.item.completionPct) >= 100 ? 'done' : Number(entry.item.completionPct) > 0 ? 'doing' : 'todo') : (entry.item.done ? 'done' : 'todo');
  const todayBoard = `<div class="daily-kanban">${[['todo', '待办'], ['doing', '进行中'], ['done', '已完成']].map(([statusKey, label]) => { const entries = todayEntries.filter((entry) => entryStatus(entry) === statusKey); return `<section class="daily-kanban-column"><div class="daily-kanban-head"><strong>${label}</strong><span>${entries.length}</span></div><div class="daily-kanban-list" data-sort-container data-sort-group="daily|${date}|today" data-daily-status="${statusKey}">${entries.map(renderTodayEntry).join('') || '<div class="daily-empty compact">暂无记录</div>'}</div></section>`; }).join('')}</div>`;
  const handoffGroup = `handoff|${date}`;
  const handoffEntries = sortableBlockEntries(handoffGroup);
  const inheritedRows = handoffEntries.map((entry) => { const item = entry.item; const text = entry.kind === 'handoff-task' ? item.nextPlan : item.text; const source = entry.kind === 'handoff-task' ? 'task' : 'daily'; return `<div class="handoff-row" ${blockAttrs(handoffGroup, `${entry.kind}:${item.id}`)}><span class="daily-block-handle" draggable="true" title="拖拽排序" aria-hidden="true">⋮⋮</span><div><strong>${esc(text)}</strong><p>${source === 'task' ? '来自昨日任务安排' : '来自昨日写下的计划'}</p></div></div>`; }).join('');
  const tomorrowTaskBlock = (task) => {
    const group = `daily|${date}|tomorrow`;
    const frozen = false;
    return `<div class="daily-block ${task.nextPlanDone ? 'done' : ''} ${frozen ? 'frozen' : ''}" ${blockAttrs(group, `task-next:${task.id}`)}><span class="daily-block-handle ${frozen ? 'disabled' : ''}" draggable="${!frozen}" title="${frozen ? '已冻结' : '拖拽排序'}" aria-hidden="true">⋮⋮</span><input type="checkbox" data-action="toggle-daily-task-next" data-id="${task.id}" ${task.nextPlanDone ? 'checked' : ''}><div class="daily-block-main"><input class="daily-block-title" data-daily-task-field="nextPlan" data-id="${task.id}" value="${inputValue(task.nextPlan)}" ${frozen ? 'readonly' : ''}><small>来自任务 · ${esc(task.content || '未命名任务')}</small></div><select class="daily-status-select ${task.nextPlanDone ? 'tone-green' : 'tone-gold'}" data-daily-task-next-status data-id="${task.id}" ${frozen ? 'disabled' : ''}><option value="pending" ${!task.nextPlanDone ? 'selected' : ''}>待推进</option><option value="done" ${task.nextPlanDone ? 'selected' : ''}>已完成</option></select><div class="daily-block-actions"><button class="link-button" data-action="toggle-block-freeze">${frozen ? '解冻' : '冻结'}</button><button class="link-button" data-action="edit-task" data-id="${task.id}" ${frozen ? 'disabled' : ''}>编辑</button></div></div>`;
  };
  const tomorrowBlocks = sortWorkBlocks([...(plan.tomorrow || []).map((item) => ({ kind: 'daily', item })), ...todayTasks.filter((task) => task.nextPlan?.trim()).map((item) => ({ kind: 'task-next', item, orderKey: 'nextPlanOrder' }))]).map((entry) => entry.kind === 'task-next' ? tomorrowTaskBlock(entry.item) : dailyItem(entry.item, 'tomorrow')).join('');
  const planPreview = (kind, key, sourcePlan) => {
    const items = sourcePlan.items || [];
    const group = `plan|${kind}|${key}`;
    const blocks = sortWorkBlocks(items.map((item) => ({ kind, item }))).map(({ item }) => {
      const frozen = false;
      return `<div class="daily-block compact ${item.done ? 'done' : ''} ${frozen ? 'frozen' : ''}" ${blockAttrs(group, `${kind}:${item.id}`)}><span class="daily-block-handle ${frozen ? 'disabled' : ''}" draggable="${!frozen}" title="${frozen ? '已冻结' : '拖拽排序'}" aria-hidden="true">⋮⋮</span><input type="checkbox" data-action="toggle-plan-item" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}" ${item.done ? 'checked' : ''}><div class="daily-block-main"><input class="daily-block-title" data-plan-item-field="text" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}" value="${inputValue(item.text)}" ${frozen ? 'readonly' : ''}><small>${kind === 'weekly' ? '周计划' : '月计划'}</small></div><select class="daily-status-select ${item.done ? 'tone-green' : 'tone-gold'}" data-plan-block-status data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}" ${frozen ? 'disabled' : ''}><option value="pending" ${!item.done ? 'selected' : ''}>待推进</option><option value="done" ${item.done ? 'selected' : ''}>已完成</option></select><div class="daily-block-actions"><button class="link-button" data-action="toggle-block-freeze">${frozen ? '解冻' : '冻结'}</button><button class="link-button" data-action="focus-block-edit" ${frozen ? 'disabled' : ''}>编辑</button><button class="daily-delete" data-action="delete-plan-item" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}" aria-label="删除计划" ${frozen ? 'disabled' : ''}>×</button></div></div>`;
    }).join('');
    return `<div class="period-plan-list" data-sort-container data-sort-group="${group}">${blocks || '<div class="daily-empty">还没有计划事项</div>'}</div>`;
  };

  const panelContent = {
    today: `<div class="daily-panel-head"><div><span class="daily-kicker">LIVE</span><h2>今日工作动态</h2><p>任务文件 · 点击左侧任务查看右侧文档</p></div><div class="daily-panel-tools"><div class="daily-view-switch"><button class="${dailyTodayViewMode === 'list' ? 'active' : ''}" data-action="daily-view-mode" data-view-mode="list">文档</button><button class="${dailyTodayViewMode === 'board' ? 'active' : ''}" data-action="daily-view-mode" data-view-mode="board">看板</button></div><button class="link-button" data-action="toggle-daily-task-file">${dailyTaskFileOpen ? '收起文件' : '展开文件'}</button><span class="tag green">${todayTotal} 项</span></div></div>${dailyTodayViewMode === 'board' ? todayBoard : `<div class="today-task-file-layout ${dailyTaskFileOpen ? '' : 'file-collapsed'}" data-sort-container data-sort-group="daily|${date}|today"><aside class="today-task-list-pane"><div class="today-task-list-head"><span>今日任务</span><span>${todayTaskEntries.length}</span></div><div class="today-task-list" data-sort-container data-sort-group="daily|${date}|today">${todayTaskEntries.map((entry) => dailyTaskListRow(entry.item)).join('') || '<div class="daily-empty">今天还没有任务，先添加一项工作。</div>'}</div></aside><div class="today-task-document-pane">${renderDailyTaskDocument(selectedTask)}</div></div>`}${addRow('today', '记录或安排今天的工作')}`,
    handoff: `<div class="daily-panel-head"><div><span class="daily-kicker muted-kicker">FROM YESTERDAY</span><h2>昨日写下的今日计划</h2></div><span class="tag">${handoffEntries.length} 项</span></div><div class="handoff-list" data-sort-container data-sort-group="${handoffGroup}">${inheritedRows || '<div class="daily-empty">昨日没有写下今天的计划。</div>'}</div>`,
    tomorrow: `<div class="daily-panel-head"><div><span class="daily-kicker tomorrow-kicker">NEXT</span><h2>明日工作计划</h2></div><span class="tag gold">${tomorrow.slice(5)}</span></div><div class="daily-items" data-sort-container data-sort-group="daily|${date}|tomorrow">${tomorrowBlocks || '<div class="daily-empty compact">先记下明天最重要的一件事。</div>'}</div>${addRow('tomorrow', '添加明天要推进的工作')}`,
    weekly: `<div class="daily-panel-head"><div><span class="daily-kicker week-kicker">WEEK</span><h2>本周计划</h2><p>${weeklyPlan.title || `${weeklyKey} 起`}</p></div><button class="link-button" data-action="open-plan" data-plan-kind="weekly">管理</button></div>${planPreview('weekly', weeklyKey, weeklyPlan)}`,
    monthly: `<div class="daily-panel-head"><div><span class="daily-kicker month-kicker">MONTH</span><h2>本月计划</h2><p>${monthlyPlan.title || monthlyKey}</p></div><button class="link-button" data-action="open-plan" data-plan-kind="monthly">管理</button></div>${planPreview('monthly', monthlyKey, monthlyPlan)}`,
  };
  const panelClasses = { today: 'daily-today-panel', handoff: 'handoff-panel', tomorrow: 'tomorrow-panel', weekly: 'period-panel', monthly: 'period-panel' };
  const panelSortGroups = { today: `daily|${date}|today`, handoff: handoffGroup, tomorrow: `daily|${date}|tomorrow`, weekly: `plan|weekly|${weeklyKey}`, monthly: `plan|monthly|${monthlyKey}` };
  const panels = DAILY_VISIBLE_PANEL_KEYS.slice().sort((a, b) => dailyPanelLayout[a].order - dailyPanelLayout[b].order).map((key) => {
    const frozen = Boolean(dailyPanelLayout[key].frozen);
    const geometry = dailyPanelGeometry(key);
    const panelName = key === 'today' ? '今日工作动态' : key === 'handoff' ? '昨日写下的今日计划' : key === 'tomorrow' ? '明日工作计划' : key === 'weekly' ? '本周计划' : '本月计划';
    const canResize = geometry.rowKeys.indexOf(key) < geometry.rowKeys.length - 1;
    return `<section class="card daily-panel resizable-daily-panel ${panelClasses[key]} ${frozen ? 'is-frozen' : ''}" data-daily-panel="${key}" data-sort-container data-sort-group="${panelSortGroups[key]}" style="--panel-span:${geometry.span};--panel-row:${geometry.row};--panel-col:${geometry.col}"><div class="daily-panel-topbar" data-daily-panel-move="${key}" role="button" tabindex="0" aria-label="拖动${panelName}板块" title="拖动板块"></div><button type="button" class="daily-panel-freeze" data-action="toggle-daily-panel-freeze" title="${frozen ? '解冻板块' : '冻结板块'}">${frozen ? '解冻板块' : '冻结板块'}</button>${panelContent[key]}${canResize ? `<span class="daily-panel-resize" data-panel-resize="${key}" title="拖动调整当前行占比"></span>` : ''}</section>`;
  }).join('');
  const rowResizeHandles = dailyPanelRows().slice(0, -1).map((_, index) => `<span class="daily-row-resize" data-row-resize="${index}" role="separator" tabindex="0" aria-label="调整第 ${index + 1} 行高度" title="拖动调整上下行高度"></span>`).join('');

  return `<div class="page-head daily-page-head"><div><h1>每日工作台</h1><p>${dateLabel} · 昨日承接、今日执行，任务文件实时更新。</p></div><div class="head-controls"><div class="daily-layout-picker"><span>布局</span><button class="${dailyLayoutPreset === 'split' ? 'active' : ''}" data-action="daily-layout-preset" data-layout-preset="split">上 2 下 3</button><button class="${dailyLayoutPreset === 'stacked' ? 'active' : ''}" data-action="daily-layout-preset" data-layout-preset="stacked">上 1 中 1 下 3</button></div><input class="input daily-date-picker" type="date" data-daily-date-select value="${date}"><button class="button ghost" data-action="daily-today">回到今天</button></div></div>
    <div class="daily-status-strip"><div><span>今日进度</span><strong>${finishedToday}/${todayTotal}</strong></div><div><span>昨日带入</span><strong>${inherited.length}</strong></div><div><span>本周计划</span><strong>${(weeklyPlan.items || []).length}</strong></div><div class="daily-date-flow"><span>${yesterday.slice(5)} 昨日</span><b>→</b><strong>${date.slice(5)} 今日</strong></div></div>
    <div class="daily-board-layout" style="${dailyBoardRowsStyle()}">${panels}${rowResizeHandles}</div>`;
}

function performancePanoramaRows() {
  const rows = [];
  for (const task of state.tasks) {
    const calculated = calculateDay(task.date, [task], state).tasks[0];
    const hasErrors = calculated.validationErrors.length > 0;
    rows.push({ id: task.id, sourceKey: 'task', source: '绩效任务', period: task.date || '未设置', title: task.content || '未命名任务', category: task.category, planType: task.planType, statusKey: hasErrors ? 'error' : Number(task.completionPct) >= 100 ? 'done' : 'pending', status: hasErrors ? '需修正' : Number(task.completionPct) >= 100 ? '已完成' : '进行中', score: calculated.taskScore, tab: 'tasks' });
  }
  for (const item of state.workItems) {
    const status = item.status === 'done' ? '已完成' : item.status === 'doing' ? '进行中' : '待开始';
    rows.push({ id: item.id, sourceKey: 'pool', source: '任务池', period: item.dueDate || (item.createdAt || '').slice(0, 10) || '未设置', title: item.title || '未命名事项', category: item.category, planType: item.planType, statusKey: item.status === 'done' ? 'done' : 'pending', status, score: null, tab: 'pool' });
  }
  for (const [date, plan] of Object.entries(state.dailyPlans || {})) for (const [bucket, label] of [['today', '今日计划'], ['tomorrow', '明日计划']]) for (const item of plan[bucket] || []) {
    rows.push({ id: item.id, sourceKey: 'daily', bucket, source: label, period: date, title: item.text || '未命名计划', category: '日计划', planType: bucket === 'today' ? '今日执行' : '次日安排', statusKey: item.done ? 'done' : 'pending', status: item.done ? '已完成' : '待推进', score: null, tab: 'daily' });
  }
  for (const [kind, label, tab] of [['weekly', '周计划', 'weekly'], ['monthly', '月计划', 'monthlyPlan']]) for (const [period, plan] of Object.entries(state.plans[kind] || {})) for (const item of plan.items || []) {
    rows.push({ id: item.id, sourceKey: kind, source: label, period, title: item.text || '未命名计划', category: label, planType: plan.title || label, statusKey: item.done ? 'done' : 'pending', status: item.done ? '已完成' : '待推进', score: null, tab });
  }
  return rows.sort((a, b) => b.period.localeCompare(a.period));
}

function renderPerformanceSummary() {
  const allRows = performancePanoramaRows();
  const viewSource = { pool: 'pool', weekly: 'weekly', monthly: 'monthly' }[selectedWorkspaceView] || '';
  const databaseRows = viewSource ? allRows.filter((row) => row.sourceKey === viewSource) : allRows;
  const rows = databaseRows.filter((row) => !summaryFilters.search || `${row.title} ${row.category} ${row.planType}`.toLowerCase().includes(summaryFilters.search.toLowerCase())).filter((row) => !summaryFilters.source || row.sourceKey === summaryFilters.source).filter((row) => !summaryFilters.status || row.statusKey === summaryFilters.status);
  const completed = databaseRows.filter((row) => row.statusKey === 'done').length;
  const scores = databaseRows.filter((row) => row.score !== null && row.score !== undefined && row.score !== '').map((row) => Number(row.score)).filter(Number.isFinite);
  const averageScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
  const cards = [
    ['全部事项', databaseRows.length, '当前数据库视图'],
    ['已完成', completed, databaseRows.length ? `${Math.round(completed / databaseRows.length * 100)}% 完成率` : '暂无数据'],
    ['任务', databaseRows.filter((row) => ['task', 'pool'].includes(row.sourceKey)).length, '绩效任务 + 任务池'],
    ['计划', databaseRows.filter((row) => ['daily', 'weekly', 'monthly'].includes(row.sourceKey)).length, '日 / 周 / 月计划'],
    ['平均任务得分', averageScore === null ? '—' : num(averageScore, 1), `${scores.length} 项已计算`],
  ];
  const sourceTone = { task: 'green', pool: 'blue', daily: 'gold', weekly: 'violet', monthly: 'orange' };
  const meta = (row) => `data-source-key="${row.sourceKey}" data-id="${row.id}" data-period="${row.period}" data-bucket="${row.bucket || ''}"`;
  const input = (row, field, value, type = 'text', extra = '') => `<input class="grid-input" data-summary-field="${field}" ${meta(row)} type="${type}" value="${inputValue(value)}" ${extra}>`;
  const select = (row, field, value, options, className = '') => `<select class="grid-input chip-select ${className}" data-summary-field="${field}" ${meta(row)}>${options.map(([optionValue, label]) => `<option value="${inputValue(optionValue)}" ${String(value) === String(optionValue) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
  const categoryOptions = (state.settings.taskCategories || TASK_CATEGORIES).map((category) => [category, category]);
  const planTypeOptions = PLAN_TYPES.map((planType) => [planType, planType]);
  const rowHtml = (row, index) => {
    const item = row.sourceKey === 'task' ? taskForId(row.id) : row.sourceKey === 'pool' ? state.workItems.find((entry) => entry.id === row.id) : summaryItemFor(row);
    const isTask = row.sourceKey === 'task';
    const isPool = row.sourceKey === 'pool';
    const isDaily = row.sourceKey === 'daily';
    const dateField = isTask ? input(row, 'date', item?.date, 'date') : isPool ? input(row, 'dueDate', item?.dueDate, 'date') : input(row, 'period', row.period, row.sourceKey === 'monthly' ? 'month' : 'date');
    const titleField = input(row, isTask ? 'content' : isPool ? 'title' : 'text', isTask ? item?.content : isPool ? item?.title : item?.text, 'text', 'placeholder="填写内容"');
    const categoryField = isTask || isPool ? select(row, 'category', item?.category, categoryOptions, 'tone-green') : `<span class="summary-readonly">${esc(row.category)}</span>`;
    const planField = isTask || isPool ? select(row, 'planType', item?.planType, planTypeOptions, 'tone-blue') : isDaily ? select(row, 'bucket', row.bucket, [['today', '今日计划'], ['tomorrow', '明日计划']], 'tone-orange') : input(row, 'planTitle', row.planType === row.source ? '' : row.planType, 'text', 'placeholder="计划主题"');
    const statusField = isTask ? `<div class="summary-progress">${input(row, 'completionPct', item?.completionPct, 'number', 'min="0" max="100" placeholder="0"')}<span>%</span></div>` : isPool ? select(row, 'status', item?.status || 'todo', [['todo', '待办'], ['doing', '进行中'], ['done', '已完成']], 'tone-violet') : select(row, 'done', item?.done ? 'true' : 'false', [['false', '待推进'], ['true', '已完成']], item?.done ? 'tone-green' : 'tone-orange');
    const taskNumber = (field, placeholder) => isTask ? input(row, field, item?.[field], 'number', `min="0" ${field.includes('Score') ? 'max="100"' : 'step="0.1"'} placeholder="${placeholder}"`) : '<span class="summary-na">—</span>';
    return `<tr class="sheet-row"><td class="index-cell"><span class="row-number">${index + 1}</span></td><td><span class="source-chip ${sourceTone[row.sourceKey] || 'blue'}">${esc(row.source)}</span></td><td>${dateField}</td><td class="wide-cell">${titleField}</td><td>${categoryField}</td><td>${planField}</td><td>${statusField}</td><td>${taskNumber('estimatedHours', '预计')}</td><td>${taskNumber('actualHours', '实际')}</td><td>${taskNumber('selfScore', '自评')}</td><td>${taskNumber('reviewerScore', '负责人')}</td><td class="calc-cell"><strong>${row.score === null || row.score === undefined ? '—' : num(row.score, 1)}</strong></td><td class="panorama-actions"><button class="link-button" data-action="edit-summary-item" ${meta(row)}>详情</button><button class="link-button danger-link" data-action="delete-summary-item" ${meta(row)}>删除</button></td></tr>`;
  };
  const tableRows = rows.map(rowHtml).join('');
  const viewMeta = { performance: ['绩效汇总', '全部任务与计划的数据库总视图。'], pool: ['任务池', '工作数据库中的任务池视图。'], weekly: ['周计划', '工作数据库中的周计划视图。'], monthly: ['月计划', '工作数据库中的月计划视图。'] }[selectedWorkspaceView] || ['绩效汇总', '全部任务与计划的数据库总视图。'];
  return `<div class="page-head panorama-page-head hub-section-head"><div><h1>${viewMeta[0]}</h1><p>${viewMeta[1]}</p></div><div class="task-save-state"><span class="status-dot"></span>共 ${databaseRows.length} 项数据</div></div>
    <div class="panorama-kpis">${cards.map(([label, value, note], index) => `<div class="card panorama-kpi tone-${index + 1}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('')}</div>
    <div class="card smart-table-card summary-smart-table-card"><div class="sheet-viewbar"><div class="sheet-view-title"><span class="sheet-view-icon">表</span><strong>绩效与计划明细</strong></div><div class="sheet-view-tab active">全部记录 <span>${rows.length}</span></div></div><div class="smart-toolbar sheet-actionbar"><div class="toolbar-left"><div class="summary-create-group"><select id="summary-create-type" class="select" aria-label="新增事项类型"><option value="task">绩效任务</option><option value="pool">任务池事项</option><option value="daily-today">今日计划</option><option value="daily-tomorrow">明日计划</option><option value="weekly">周计划</option><option value="monthly">月计划</option></select><button class="sheet-add-button" data-action="add-summary-row"><span>+</span> 新增一行</button></div><span class="toolbar-divider"></span><label class="sheet-search"><span>⌕</span><input class="input" placeholder="搜索任务或计划" aria-label="搜索任务或计划" data-summary-filter="search" value="${esc(summaryFilters.search)}"></label><label class="sheet-filter"><span>来源类型</span><select class="select" data-summary-filter="source"><option value="">全部</option><option value="task" ${summaryFilters.source === 'task' ? 'selected' : ''}>绩效任务</option><option value="pool" ${summaryFilters.source === 'pool' ? 'selected' : ''}>任务池</option><option value="daily" ${summaryFilters.source === 'daily' ? 'selected' : ''}>日计划</option><option value="weekly" ${summaryFilters.source === 'weekly' ? 'selected' : ''}>周计划</option><option value="monthly" ${summaryFilters.source === 'monthly' ? 'selected' : ''}>月计划</option></select></label><label class="sheet-filter"><span>状态</span><select class="select" data-summary-filter="status"><option value="">全部</option><option value="done" ${summaryFilters.status === 'done' ? 'selected' : ''}>已完成</option><option value="pending" ${summaryFilters.status === 'pending' ? 'selected' : ''}>待推进</option><option value="error" ${summaryFilters.status === 'error' ? 'selected' : ''}>需修正</option></select></label></div><div class="table-count">当前视图 <strong>${rows.length}</strong> 条</div></div><div class="task-table-wrap smart-scroll"><table class="task-table sheet-table smart-table summary-sheet-table"><thead><tr><th class="index-header">#</th><th>来源</th><th>日期 / 周期</th><th class="wide-header">工作内容</th><th>工作分类</th><th>计划类型 / 主题</th><th>进度状态</th><th class="computed-header">预计工时</th><th class="computed-header">实际工时</th><th class="computed-header">自评分</th><th class="computed-header">负责人评分</th><th class="computed-header">任务得分</th><th>操作</th></tr></thead><tbody>${tableRows || '<tr><td colspan="13"><div class="empty">没有符合筛选条件的数据</div></td></tr>'}</tbody><tfoot><tr><td colspan="13"><button class="add-record" data-action="add-summary-row"><span>+</span> 新增记录</button><span class="footer-hint">单元格可直接编辑 · 修改后自动保存</span></td></tr></tfoot></table></div></div>`;
}

function renderPerformancePanorama() {
  const views = [
    ['performance', '绩效汇总', performancePanoramaRows().length],
    ['pool', '任务池', state.workItems.length],
    ['weekly', '周计划', Object.values(state.plans.weekly || {}).reduce((sum, plan) => sum + (plan.items?.length || 0), 0)],
    ['monthly', '月计划', Object.values(state.plans.monthly || {}).reduce((sum, plan) => sum + (plan.items?.length || 0), 0)],
  ];
  const body = renderPerformanceSummary();
  return `<div class="workspace-hub-bar"><div class="workspace-hub-name"><span class="workspace-hub-mark">数</span><div><strong>工作数据库</strong><small>任务与计划的统一数据源</small></div></div><div class="workspace-view-tabs">${views.map(([key, label, count]) => `<button class="workspace-view-tab ${selectedWorkspaceView === key ? 'active' : ''}" data-action="workspace-view" data-workspace-view="${key}">${label}<span>${count}</span></button>`).join('')}</div></div><div class="workspace-view-content">${body}</div>`;
}
function poolColumn(item) {
  if (item.status === 'done' && item.reviewer && item.acceptanceStatus !== 'accepted') return 'pending';
  if (item.status === 'done') return 'done';
  return item.status === 'doing' ? 'doing' : 'todo';
}
function poolLabel(column) { return { todo: '待办', doing: '进行中', pending: '待验收', done: '已完成' }[column]; }
function poolTag(item) { return item.priority === '高' ? '<span class="tag red">高</span>' : item.priority === '低' ? '<span class="tag">低</span>' : '<span class="tag gold">普通</span>'; }

function renderTaskPool() {
  const columns = ['todo', 'doing', 'pending', 'done'];
  const active = state.workItems.filter((item) => item.title || item.description);
  const today = dateToISO(new Date());
  const quick = `<div class="card quick-add"><div class="quick-add-title"><span class="eyebrow">Quick Capture</span><strong>随手记一条</strong><span class="muted">完成一件记一件，先放进任务池，稍后再补绩效字段。</span></div><div class="quick-grid"><input class="input" id="quick-title" placeholder="我接下来要做什么？"><input class="input" id="quick-due" type="date" value="${today}"><select class="select" id="quick-priority"><option>普通</option><option>高</option><option>低</option></select><input class="input" id="quick-reviewer" placeholder="验收人（可选）"><button class="button primary" data-action="quick-add">加入任务池</button></div></div>`;
  const categoryOptions = (selected) => state.settings.taskCategories.map((category) => `<option value="${inputValue(category)}" ${category === selected ? 'selected' : ''}>${esc(category)}</option>`).join('');
  const card = (item) => `<article class="pool-card ${item.dueDate && item.dueDate < today && poolColumn(item) !== 'done' ? 'overdue' : ''}"><div class="pool-card-head"><span class="pool-drag">⋮⋮</span><input class="pool-title" data-pool-field="title" data-pool-id="${item.id}" value="${inputValue(item.title)}" placeholder="待办事项"><span>${poolTag(item)}</span></div><div class="pool-meta"><select class="pool-select" data-pool-field="status" data-pool-id="${item.id}"><option value="todo" ${item.status === 'todo' ? 'selected' : ''}>待办</option><option value="doing" ${item.status === 'doing' ? 'selected' : ''}>进行中</option><option value="done" ${item.status === 'done' ? 'selected' : ''}>已完成</option></select><input class="pool-date" data-pool-field="dueDate" data-pool-id="${item.id}" type="date" value="${inputValue(item.dueDate)}"></div><div class="pool-meta pool-meta-secondary"><select class="pool-select" data-pool-field="category" data-pool-id="${item.id}">${categoryOptions(item.category)}</select><select class="pool-select" data-pool-field="planType" data-pool-id="${item.id}">${PLAN_TYPES.map((planType) => `<option value="${inputValue(planType)}" ${planType === item.planType ? 'selected' : ''}>${esc(planType)}</option>`).join('')}</select></div><div class="pool-reviewer-line"><span>验收人</span><input class="pool-reviewer" data-pool-field="reviewer" data-pool-id="${item.id}" value="${inputValue(item.reviewer)}" placeholder="指定验收人"></div>${expandedPoolIds.has(item.id) ? `<textarea class="pool-description" data-pool-field="description" data-pool-id="${item.id}" placeholder="补充背景、交付标准或阻塞问题">${inputValue(item.description)}</textarea>` : ''}<div class="pool-bottom">${item.acceptanceStatus === 'accepted' ? '<span class="tag green">已验收</span>' : item.status === 'done' && item.reviewer ? '<span class="tag gold">待验收</span>' : item.status === 'done' && !item.performanceTaskId ? `<button class="link-button" data-action="record-performance" data-id="${item.id}">记入绩效</button>` : '<span class="muted">未指定验收人</span>'}<button class="link-button" data-action="toggle-pool-details" data-id="${item.id}">${expandedPoolIds.has(item.id) ? '收起' : '说明'}</button><button class="link-button danger-link" data-action="delete-pool" data-id="${item.id}">删除</button></div></article>`;
  return `<div class="page-head"><div><span class="eyebrow">My Task Pool</span><h1>我的任务池</h1><p>把脑中的事情放下来，按待办、进行中、待验收、已完成持续推进。</p></div><div class="head-controls"><button class="button primary" data-action="quick-focus">快速记录</button></div></div>${quick}<div class="pool-grid">${columns.map((column) => `<section class="pool-column"><div class="pool-column-head"><h2>${poolLabel(column)}</h2><span>${active.filter((item) => poolColumn(item) === column).length}</span></div><div class="pool-list">${active.filter((item) => poolColumn(item) === column).map(card).join('') || '<div class="pool-empty">暂无事项</div>'}</div></section>`).join('')}</div>`;
}

function renderPlanView(kind) {
  const isWeekly = kind === 'weekly';
  const key = isWeekly ? weekKey(selectedPlanDate) : selectedPlanDate.slice(0, 7);
  const plan = planFor(kind, key);
  const items = plan.items || [];
  const label = isWeekly ? `周计划 · ${key} 起` : `月计划 · ${key}`;
  return `<div class="page-head"><div><span class="eyebrow">${isWeekly ? 'Weekly Plan' : 'Monthly Plan'}</span><h1>${isWeekly ? '周计划' : '月计划'}</h1><p>${isWeekly ? '把本周最重要的事排清楚，再从任务池逐项推进。' : '用一个月的视角安排目标，避免只盯着眼前的零碎任务。'}</p></div><div class="head-controls"><label class="label">${isWeekly ? '选择日期' : '选择月份'}</label><input class="input" data-plan-date type="${isWeekly ? 'date' : 'month'}" value="${isWeekly ? selectedPlanDate : key}"></div></div><div class="plan-layout"><div class="card plan-main"><div class="plan-heading"><div><span class="eyebrow">${label}</span><input class="plan-title" data-plan-field="title" data-plan-kind="${kind}" data-plan-key="${key}" value="${inputValue(plan.title)}" placeholder="给这段时间一个清晰主题"></div><span class="tag">${items.filter((item) => item.done).length}/${items.length} 已完成</span></div><div class="plan-add"><input class="input" id="new-plan-item-${kind}" placeholder="添加一项计划"><button class="button primary" data-action="add-plan-item" data-plan-kind="${kind}" data-plan-key="${key}">添加</button></div><div class="plan-items">${items.map((item) => `<div class="plan-item ${item.done ? 'done' : ''}"><input type="checkbox" data-action="toggle-plan-item" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}" ${item.done ? 'checked' : ''}><input class="plan-item-text" data-plan-item-field="text" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}" value="${inputValue(item.text)}"><button class="link-button danger-link" data-action="delete-plan-item" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}">删除</button></div>`).join('') || '<div class="pool-empty">还没有计划项，先添加一项最重要的事。</div>'}</div></div><div class="card plan-side"><h2>计划说明</h2><textarea class="textarea" data-plan-field="notes" data-plan-kind="${kind}" data-plan-key="${key}" placeholder="记录背景、风险、不要忘记的事情">${inputValue(plan.notes)}</textarea><div class="notice" style="margin-top:14px">任务池是执行层，${isWeekly ? '周计划' : '月计划'}是安排层。计划项可以先写目标，不必马上拆成完整绩效任务。</div></div></div>`;
}

function renderAcceptance() {
  const waiting = state.workItems.filter((item) => item.reviewer && item.status === 'done' && item.acceptanceStatus !== 'accepted');
  return `<div class="page-head"><div><span class="eyebrow">Acceptance Queue</span><h1>验收工作</h1><p>指定你为验收人的任务完成后，会自动出现在这里。</p></div><div class="head-controls"><span class="tag gold">${waiting.length} 项待处理</span></div></div><div class="card section-card acceptance-list">${waiting.length ? waiting.map((item) => `<div class="acceptance-item"><div><strong>${esc(item.title)}</strong><div class="task-sub">${esc(item.category)} · 截止 ${item.dueDate || '未设置'} · ${poolTag(item)}</div></div><div class="acceptance-actions"><button class="button primary" data-action="accept-pool" data-id="${item.id}">通过验收</button><button class="button ghost" data-action="rework-pool" data-id="${item.id}">退回修改</button></div></div>`).join('') : '<div class="empty">暂时没有待验收任务</div>'}</div>`;
}

function addQuickPoolItem() {
  const title = document.querySelector('#quick-title')?.value.trim();
  if (!title) return toast('先写下要做的事情');
  state.workItems.unshift({ id: crypto.randomUUID(), title, description: '', category: state.settings.taskCategories[0] || '其他', planType: '单人工作', priority: document.querySelector('#quick-priority')?.value || '普通', dueDate: document.querySelector('#quick-due')?.value || '', status: 'todo', reviewer: document.querySelector('#quick-reviewer')?.value.trim() || '', acceptanceStatus: '', performanceTaskId: '', createdAt: new Date().toISOString(), completedAt: '' });
  save(); render(); toast('已加入任务池');
}
function updatePoolField(target) {
  const item = state.workItems.find((entry) => entry.id === target.dataset.poolId); if (!item) return;
  const key = target.dataset.poolField; item[key] = target.value;
  if (key === 'status' && target.value === 'done' && !item.completedAt) item.completedAt = new Date().toISOString();
  if (key === 'status' && target.value !== 'done') { item.completedAt = ''; item.acceptanceStatus = ''; }
  save(); render();
}
function addPlanItem(kind, key) {
  const input = document.querySelector(`#new-plan-item-${kind}`); const text = input?.value.trim(); if (!text) return toast('请输入计划内容');
  const plan = planFor(kind, key); plan.items.push({ id: crypto.randomUUID(), text, done: false }); save(); render();
}
function updatePlanField(target) { const plan = planFor(target.dataset.planKind, target.dataset.planKey); plan[target.dataset.planField] = target.value; save(); }
function updatePlanItem(target) { const plan = planFor(target.dataset.planKind, target.dataset.planKey); const item = plan.items.find((entry) => entry.id === target.dataset.itemId); if (item) { item.text = target.value; save(); } }

function addDailyItem(action) {
  const date = action.dataset.dailyDate;
  const bucket = action.dataset.dailyBucket;
  const input = document.querySelector(`[data-daily-new="${bucket}"][data-date="${date}"]`);
  const text = input?.value.trim();
  if (!text) return toast('请输入计划内容');
  if (bucket === 'today') state.tasks.push(makeTaskRecord(text, date));
  else dailyPlanFor(date)[bucket].push({ id: crypto.randomUUID(), text, done: false });
  save(); render();
  setTimeout(() => document.querySelector(`[data-daily-new="${bucket}"][data-date="${date}"]`)?.focus(), 0);
}

function dailyItemFrom(action) {
  return dailyPlanFor(action.dataset.dailyDate)[action.dataset.dailyBucket].find((item) => item.id === action.dataset.itemId);
}

function renderCalendar(month) {
  const firstDay = new Date(month.year, month.month - 1, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const names = ['一', '二', '三', '四', '五', '六', '日'];
  let html = `<div class="calendar">${names.map((name) => `<div class="calendar-head">周${name}</div>`).join('')}`;
  for (let i = 0; i < offset; i += 1) html += '<div></div>';
  for (const day of month.days) {
    const score = day.performance;
    const cls = score === null ? (day.status === '需修正' ? 'bad' : '') : score >= 100 ? 'good' : score >= 80 ? 'warn' : 'bad';
    html += `<button class="day-cell ${cls} ${day.date === selectedDate ? 'selected' : ''}" data-day="${day.date}"><div class="day-num">${Number(day.date.slice(-2))}</div><div class="day-score">${score === null ? (day.status === '不考核' ? '休' : '—') : num(score, 0)}</div><div class="bar"><span style="width:${score === null ? 0 : Math.min(score, 100)}%"></span></div><div class="day-meta">${day.dailyReward ? `奖 ${num(day.dailyReward)}` : day.status}</div></button>`;
  }
  return `${html}</div><div class="calendar-note">绿色表示标准工时水位已完成；黄色表示已计算但未满 100；红色表示待修正或绩效较低。</div>`;
}

function renderDayDetail(day) {
  if (!day) return '<div class="empty">选择一个日期查看详情</div>';
  const tasks = day.tasks || [];
  return `<div class="section-title"><div><h2>${day.date} 每日详情</h2><p>${day.status}</p></div><button class="link-button" data-action="day-tasks" data-date="${day.date}">查看当天任务</button></div><div class="day-detail">${[['标准工时', `${num(day.standardHours, 2)} h`], ['总有效工时', `${num(day.totalHours, 2)} h`], ['当日绩效', day.performance === null ? '—' : pct(day.performance)], ['当日奖励', num(day.dailyReward)]].map(([label, value]) => `<div class="detail-box"><small>${label}</small><strong>${value}</strong></div>`).join('')}</div><div class="split-note"><span>计划内 ${num(day.plannedHours, 2)} h · 拓展 ${num(day.expansionHours, 2)} h · 加班 ${num(day.overtimeHours, 2)} h</span><span>${day.rewardEligible ? '奖励资格：是' : '奖励资格：否'}</span></div>${day.validationErrors.length ? `<div class="notice warn" style="margin-top:14px">${day.validationErrors.slice(0, 3).map(esc).join('<br>')}</div>` : tasks.length ? `<div class="mini-list" style="margin-top:16px">${tasks.slice(0, 4).map((task) => `<div class="mini-row"><div><strong>${esc(task.content)}</strong><div class="task-sub">${esc(task.planType)} · ${num(task.weightedEffectiveHours, 2)} h 有效工时</div></div><span>${task.taskScore === null ? '待完善' : num(task.taskScore, 0) + ' 分'}</span></div>`).join('')}</div>` : '<div class="empty" style="margin-top:16px">当天还没有任务记录</div>'}`;
}

function taskRowsForMonth() {
  const prefix = `${currentYear()}-${String(currentMonth).padStart(2, '0')}`;
  return state.tasks.filter((task) => task.date?.startsWith(prefix)).map((task) => ({ task, calc: calculateDay(task.date, [task], state).tasks[0], day: calculateDay(task.date, state.tasks, state) })).filter(({ task, calc }) => !taskFilters.search || `${task.content} ${task.category} ${task.collaborator}`.toLowerCase().includes(taskFilters.search.toLowerCase())).filter(({ task }) => !taskFilters.planType || task.planType === taskFilters.planType).filter(({ calc }) => !taskFilters.status || (taskFilters.status === 'normal' ? calc.validationErrors.length === 0 : calc.validationErrors.length > 0));
}

function renderTasks() {
  const rows = taskRowsForMonth();
  const field = (task, key, type = 'text', extra = '', placeholder = '') => `<input class="grid-input field-${key}" data-task-field="${key}" data-task-id="${task.id}" type="${type}" value="${inputValue(task[key])}" placeholder="${placeholder}" ${extra}>`;
  const select = (task, key, options) => {
    const planTones = { '单人工作': 'blue', '协同工作': 'violet', '拓展工作': 'green', '加班工作': 'orange' };
    const categoryTones = ['green', 'blue', 'violet', 'orange'];
    const tone = key === 'planType' ? (planTones[task[key]] || 'blue') : categoryTones[Math.max(0, options.indexOf(task[key])) % categoryTones.length];
    return `<select class="grid-input chip-select tone-${tone}" data-task-field="${key}" data-task-id="${task.id}">${options.map((option) => `<option ${task[key] === option ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>`;
  };
  const header = (icon, label, cls = '') => `<th class="${cls}"><span class="field-icon">${icon}</span>${label}</th>`;
  const rowHtml = ({ task, calc, day }, index) => `<tr class="sheet-row ${calc.validationErrors.length ? 'row-invalid' : ''}">
    <td class="index-cell"><span class="row-number">${index + 1}</span><span class="row-check"></span></td>
    <td>${field(task, 'date', 'date')}</td>
    <td class="wide-cell">${field(task, 'content', 'text', '', '填写任务名称')}</td>
    <td>${select(task, 'category', state.settings.taskCategories)}</td>
    <td>${select(task, 'planType', PLAN_TYPES)}</td>
    <td>${field(task, 'collaborator', 'text', '', '协作人')}</td>
    <td>${field(task, 'estimatedHours', 'number', 'step="0.1" min="0"', '预计')}</td>
    <td>${field(task, 'actualHours', 'number', 'step="0.1" min="0"', '实际')}</td>
    <td>${field(task, 'completionPct', 'number', 'min="0" max="100"', '%')}</td>
    <td>${field(task, 'collaborationPct', 'number', 'min="0" max="100"', '%')}</td>
    <td>${field(task, 'selfScore', 'number', 'min="0" max="100"', '自评')}</td>
    <td>${field(task, 'reviewerScore', 'number', 'min="0" max="100"', '负责人')}</td>
    <td class="calc-cell">${num(calc.weightedEffectiveHours, 2)} h</td>
    <td class="calc-cell"><strong>${calc.taskScore === null ? '—' : num(calc.taskScore, 1)}</strong></td>
    <td class="calc-cell">${day.performance === null ? '—' : num(day.performance, 1)}</td>
    <td class="calc-cell">${num(day.dailyReward, 1)}</td>
    <td><span class="tag ${calc.validationErrors.length ? 'red' : 'green'}">${calc.validationErrors.length ? '需修正' : '已校验'}</span></td>
    <td class="row-actions"><button class="link-button" data-action="edit-task" data-id="${task.id}">打开文件</button><button class="link-button" data-action="toggle-task-details" data-id="${task.id}">${expandedTaskIds.has(task.id) ? '收起' : '详情'}</button><button class="link-button" data-action="copy-task" data-id="${task.id}">复制</button><button class="link-button danger-link" data-action="delete-task" data-id="${task.id}">删除</button></td>
  </tr>${expandedTaskIds.has(task.id) ? `<tr class="detail-row"><td colspan="18"><div class="detail-grid"><label><span class="label">阻塞问题 / 备注</span>${field(task, 'blocker')}</label><label><span class="label">重大突破创新内容</span>${field(task, 'breakthrough')}</label><label><span class="label">任务创新分</span>${field(task, 'innovation', 'number', 'min="0" max="100"')}</label></div></td></tr>` : ''}`;
  const monthOptions = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === currentMonth ? 'selected' : ''}>${currentYear()} 年 ${i + 1} 月</option>`).join('');
  return `<div class="page-head task-page-head"><div><h1>任务录入</h1><p>按 Tab 连续填写，工时与绩效结果会自动计算。</p></div><div class="task-save-state"><span class="status-dot"></span>本地实时保存</div></div>
    <div class="card smart-table-card">
      <div class="sheet-viewbar">
        <div class="sheet-view-title"><span class="sheet-view-icon">表</span><strong>任务明细</strong></div>
        <div class="sheet-view-tab active">全部记录 <span>${rows.length}</span></div>
        <div class="sheet-view-spacer"></div>
        <label class="sheet-month"><span>查看月份</span><select class="select" data-month-select>${monthOptions}</select></label>
      </div>
      <div class="smart-toolbar sheet-actionbar">
        <div class="toolbar-left">
          <button class="sheet-add-button" data-action="add-task"><span>+</span> 新增一行</button>
          <span class="toolbar-divider"></span>
          <label class="sheet-search"><span>⌕</span><input class="input" placeholder="搜索记录" aria-label="搜索记录" data-filter="search" value="${esc(taskFilters.search)}"></label>
          <label class="sheet-filter"><span>计划类型</span><select class="select" data-filter="planType"><option value="">全部</option>${PLAN_TYPES.map((type) => `<option ${taskFilters.planType === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label>
          <label class="sheet-filter"><span>校验状态</span><select class="select" data-filter="status"><option value="">全部</option><option value="normal" ${taskFilters.status === 'normal' ? 'selected' : ''}>已校验</option><option value="error" ${taskFilters.status === 'error' ? 'selected' : ''}>需修正</option></select></label>
        </div>
        <div class="table-count">当前视图 <strong>${rows.length}</strong> 条</div>
      </div>
      ${rows.length ? `<div class="task-table-wrap smart-scroll"><table class="task-table sheet-table smart-table"><thead><tr><th class="index-header"><span class="header-check"></span></th>${header('◷', '日期')}${header('A', '工作内容', 'wide-header')}${header('≡', '工作分类')}${header('≡', '计划类型')}${header('人', '协作人')}${header('↔', '预计工时')}${header('↔', '实际工时')}${header('%', '交付完成')}${header('%', '协作完成')}${header('自', '自评分')}${header('审', '负责人评分')}${header('Σ', '有效工时', 'computed-header')}${header('分', '任务得分', 'computed-header')}${header('日', '当日绩效', 'computed-header')}${header('奖', '当日奖励', 'computed-header')}${header('!', '状态')}${header('⋯', '')}</tr></thead><tbody>${rows.map(rowHtml).join('')}</tbody><tfoot><tr><td colspan="18"><button class="add-record" data-action="add-task"><span>+</span> 新增记录</button><span class="footer-hint">输入框支持 Tab 连续移动 · 计算列自动更新</span></td></tr></tfoot></table></div>` : '<div class="empty sheet-empty">当前视图还没有记录。点击“新增一行”开始填写。</div>'}
    </div>`;
}

function renderMonthly() {
  const months = Array.from({ length: 12 }, (_, index) => calculateMonth(currentYear(), index + 1, state));
  return `<div class="page-head"><div><span class="eyebrow">Monthly Review</span><h1>月度绩效</h1><p>日常表现占 80%，综合素养占 20%，积极创新加分单独计入。</p></div><div class="head-controls"><button class="button primary" data-action="export-json">备份当前数据</button></div></div><div class="card section-card"><div class="task-table-wrap"><table class="monthly-table"><thead><tr><th>月份</th><th>已填写天数</th><th>平均每日绩效</th><th>月度奖励</th><th>协同能力</th><th>忠诚度</th><th>纪律性</th><th>学习力</th><th>综合素养</th><th>最终绩效</th><th>兑现比例</th><th>等级</th><th>备注</th></tr></thead><tbody>${months.map((month) => { const review = state.monthlyReviews[month.key] || {}; return `<tr><td><button class="link-button" data-action="jump-month" data-month="${month.month}">${monthLabel(month.key)}</button></td><td>${month.scoredDays}</td><td>${pct(month.averageDailyPerformance)}</td><td>${num(month.monthlyReward)}</td>${['collaboration', 'loyalty', 'discipline', 'learning'].map((field) => `<td><input class="input" type="number" min="0" max="100" data-review="${field}" data-review-month="${month.key}" value="${inputValue(review[field])}" placeholder="—"></td>`).join('')}<td>${num(month.competencyScore)}</td><td><strong>${num(month.finalPerformance)}</strong></td><td>${month.payoutRatio === null ? '—' : pct(month.payoutRatio * 100)}</td><td>${month.grade || '—'}</td><td><input class="input" data-review="note" data-review-month="${month.key}" value="${inputValue(review.note)}" placeholder="备注"></td></tr>`; }).join('')}</tbody></table></div></div><div class="notice" style="margin-top:16px">月度奖励总分只有在最终绩效达到 100 分时兑现；积极创新加分由负责人结合任务创新分和实际价值核定，最高 ${state.settings.monthlyInnovationMax} 分。</div>`;
}

function renderSettings() {
  const s = state.settings;
  const categories = s.taskCategories || TASK_CATEGORIES;
  return `<div class="page-head"><div><span class="eyebrow">Rules & Settings</span><h1>规则与参数</h1><p>默认值沿用原 Excel，可按公司口径调整。</p></div><div class="head-controls"><button class="button danger" data-action="reset">恢复默认</button></div></div><div class="settings-grid"><div class="card form-section"><h2>评分参数</h2><div class="settings-form">${[['standardDayHours', '标准日工时 (h)', '用于填充每日绩效水位'], ['baseRewardPerHour', '基础奖励分 / 小时', '默认为 100 ÷ 标准日工时'], ['plannedOverageFactor', '计划内超额奖励系数', '单人 + 协同'], ['expansionFactor', '拓展工作奖励系数', '正常工作时间的额外工作'], ['overtimeFactor', '加班工作奖励系数', '加班额外工作'], ['efficiencyMin', '效率系数下限', '避免预计工时偏差导致过度扣分'], ['efficiencyMax', '效率系数上限', '避免效率系数无限放大'], ['monthlyInnovationMax', '月度创新加分上限', '默认 10 分']].map(([key,label,help]) => `<label class="field"><span class="label">${label}</span><input class="input" type="number" step="0.01" data-setting="${key}" value="${inputValue(s[key])}"><span class="helper">${help}</span></label>`).join('')}</div></div><div class="card form-section"><h2>权重与等级</h2><div class="settings-form">${[['dailyPerformanceWeight', '日常表现权重', '默认 0.8'], ['competencyWeight', '综合素养权重', '默认 0.2'], ['gradeThresholds.S', 'S 等级起点', ''], ['gradeThresholds.A', 'A 等级起点', ''], ['gradeThresholds.B', 'B 等级起点', ''], ['gradeThresholds.C', 'C 等级起点', '']].map(([key,label,help]) => `<label class="field"><span class="label">${label}</span><input class="input" type="number" step="0.01" data-setting="${key}" value="${inputValue(key.startsWith('grade') ? s.gradeThresholds[key.split('.')[1]] : s[key])}"><span class="helper">${help}</span></label>`).join('')}</div><div class="notice" style="margin-top:16px">月度最终绩效 = 平均每日绩效 × 日常表现权重 + 综合素养评分 × 综合素养权重 + 积极创新加分。</div></div><div class="card form-section"><h2>日历与工作日</h2><div class="settings-form"><label class="field"><span class="label">日期</span><input id="override-date" class="input" type="date"></label><label class="field"><span class="label">日历类型</span><select id="override-kind" class="select"><option value="workday">工作日</option><option value="holiday">节假日</option></select></label><label class="field"><span class="label">标准工时 (可选)</span><input id="override-hours" class="input" type="number" step="0.01" placeholder="留空使用默认值"></label><label class="field" style="align-self:end"><button class="button primary" data-action="add-override">添加日期覆盖</button></label></div><div class="mini-list" style="margin-top:16px">${Object.entries(state.calendarOverrides).length ? Object.entries(state.calendarOverrides).map(([date, override]) => `<div class="mini-row"><strong>${date}</strong><span>${override.kind === 'holiday' ? '节假日' : `工作日 · ${override.hours ?? '默认'} h`} <button class="link-button" data-action="remove-override" data-date="${date}">移除</button></span></div>`).join('') : '<div class="empty">尚未配置特殊日期</div>'}</div></div><div class="card form-section category-card"><h2>工作分类</h2><p class="helper">这些选项会出现在任务录入的“工作分类”下拉框中。</p><div class="category-add"><input id="new-category" class="input" placeholder="新增工作分类"><button class="button primary" data-action="add-category">添加</button></div><div class="category-list">${categories.map((category) => `<span class="category-chip">${esc(category)}<button class="category-remove" data-action="remove-category" data-category="${esc(category)}" aria-label="删除 ${esc(category)}">×</button></span>`).join('')}</div></div><div class="card form-section"><h2>当前计算口径</h2><div class="rule-list"><div class="rule-item"><strong>工时水位</strong><p>计划内（单人 + 协同）→ 拓展 → 加班，依次填充当天标准工时。</p></div><div class="rule-item"><strong>奖励门槛</strong><p>只有当日绩效和月度最终绩效均达到 100% 时，奖励才兑现。</p></div><div class="rule-item"><strong>数据安全</strong><p>数据仅保存在当前浏览器。建议定期导出 JSON 备份，换设备时导入恢复。</p></div></div></div></div>`;
}

function renderTaskSubtaskEditor() {
  return `<div class="task-dialog-subtask-list">${editingSubtasks.map((item) => `<div class="task-dialog-subtask-row"><input type="checkbox" data-action="toggle-dialog-subtask" data-subtask-id="${item.id}" ${item.done ? 'checked' : ''}><input class="input" data-dialog-subtask-field="text" data-subtask-id="${item.id}" value="${inputValue(item.text)}" placeholder="子任务名称"><button type="button" class="task-subtask-delete" data-action="delete-dialog-subtask" data-subtask-id="${item.id}" aria-label="删除子任务">×</button></div>`).join('')}</div><button type="button" class="button ghost task-dialog-add-subtask" data-action="add-dialog-subtask">+ 添加子任务</button>`;
}
function renderTaskFileEditor(task, value) {
  const field = (name, label, type = 'text', extra = '') => `<label class="task-file-property"><span>${label}</span><input class="input" name="${name}" type="${type}" value="${inputValue(value(name))}" ${extra}></label>`;
  const select = (name, label, options, fallback) => `<label class="task-file-property"><span>${label}</span><select class="select" name="${name}">${options.map((option) => `<option ${value(name, fallback) === option ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`;
  return `<div class="task-file-properties"><div class="task-file-property-wide"><span class="task-file-property-label">文件名</span><input class="task-file-title-input" name="content" required value="${inputValue(value('content'))}" placeholder="未命名任务"></div>${field('date', '日期', 'date', 'required')}${select('category', '分类', state.settings.taskCategories || TASK_CATEGORIES, '其他')}${select('planType', '计划类型', PLAN_TYPES, '单人工作')}${field('collaborator', '协作人', 'text')}${field('estimatedHours', '预计工时 (h)', 'number', 'step="0.1" min="0" required')}${field('actualHours', '实际工时 (h)', 'number', 'step="0.1" min="0" required')}${field('completionPct', '交付完成 (%)', 'number', 'min="0" max="100" required')}${field('collaborationPct', '协作完成 (%)', 'number', 'min="0" max="100"')}${field('innovation', '创新分', 'number', 'min="0" max="100"')}${field('selfScore', '自评分', 'number', 'min="0" max="100" required')}${field('reviewerScore', '负责人评分', 'number', 'min="0" max="100" required')}</div><div class="task-file-editor"><div class="task-file-editor-head"><span>正文 · Markdown</span><span class="task-file-path">${inputValue(value('date', '未设置'))}.md</span></div><textarea class="task-markdown-editor" name="body" placeholder="在这里记录任务背景、执行过程、结论和链接……">${inputValue(value('body'))}</textarea></div><div class="task-file-section"><div class="task-file-section-head"><span>子任务</span><span>${editingSubtasks.length} 项</span></div><div id="task-subtasks-editor">${renderTaskSubtaskEditor()}</div></div><div class="task-file-notes"><label class="form-field"><span class="label">阻塞问题 / 备注</span><textarea class="textarea" name="blocker">${inputValue(value('blocker'))}</textarea></label><label class="form-field"><span class="label">重大突破创新内容</span><textarea class="textarea" name="breakthrough">${inputValue(value('breakthrough'))}</textarea></label></div>`;
}

function openTaskDialog(task = null) {
  editingTaskId = task?.id || null;
  editingSubtasks = structuredClone(Array.isArray(task?.subtasks) ? task.subtasks : []);
  $('#task-dialog-title').textContent = task ? '任务文件' : '新建任务文件';
  $('#task-dialog .eyebrow').textContent = 'OBSIDIAN STYLE FILE';
  const value = (key, fallback = '') => task?.[key] ?? fallback;
  $('#task-form-fields').innerHTML = `<label class="form-field"><span class="label">日期 *</span><input class="input" name="date" type="date" required value="${inputValue(value('date', `${currentYear()}-${String(currentMonth).padStart(2, '0')}-01`))}"></label><label class="form-field"><span class="label">任务分类</span><select class="select" name="category">${(state.settings.taskCategories || TASK_CATEGORIES).map((category) => `<option ${value('category', '其他') === category ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select></label><label class="form-field full"><span class="label">今日工作内容 *</span><input class="input" name="content" required value="${inputValue(value('content'))}" placeholder="例如：完成季度报表自动化"></label><label class="form-field"><span class="label">计划类型 *</span><select class="select" name="planType">${PLAN_TYPES.map((type) => `<option ${value('planType', '单人工作') === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label><label class="form-field"><span class="label">协作人</span><input class="input" name="collaborator" value="${inputValue(value('collaborator'))}"></label><label class="form-field"><span class="label">预计工时 (h) *</span><input class="input" name="estimatedHours" type="number" step="0.1" min="0" required value="${inputValue(value('estimatedHours'))}"></label><label class="form-field"><span class="label">本人实际工时 (h) *</span><input class="input" name="actualHours" type="number" step="0.1" min="0" required value="${inputValue(value('actualHours'))}"></label><label class="form-field"><span class="label">交付完成占比 (%) *</span><input class="input" name="completionPct" type="number" min="0" max="100" required value="${inputValue(value('completionPct'))}"></label><label class="form-field"><span class="label">协作完成占比 (%)</span><input class="input" name="collaborationPct" type="number" min="0" max="100" value="${inputValue(value('collaborationPct'))}"></label><label class="form-field"><span class="label">任务创新分 (0–100)</span><input class="input" name="innovation" type="number" min="0" max="100" value="${inputValue(value('innovation'))}"></label><label class="form-field"><span class="label">自评分 (0–100) *</span><input class="input" name="selfScore" type="number" min="0" max="100" required value="${inputValue(value('selfScore'))}"></label><label class="form-field"><span class="label">负责人评分 (0–100) *</span><input class="input" name="reviewerScore" type="number" min="0" max="100" required value="${inputValue(value('reviewerScore'))}"></label><div class="form-field full task-dialog-subtasks"><span class="label">子任务</span><div id="task-subtasks-editor">${renderTaskSubtaskEditor()}</div></div><label class="form-field full"><span class="label">明日工作计划</span><textarea class="textarea" name="nextPlan">${inputValue(value('nextPlan'))}</textarea></label><label class="form-field full"><span class="label">阻塞问题 / 备注</span><textarea class="textarea" name="blocker">${inputValue(value('blocker'))}</textarea></label><label class="form-field full"><span class="label">重大突破创新内容</span><textarea class="textarea" name="breakthrough">${inputValue(value('breakthrough'))}</textarea></label>`;
  $('#task-form-fields').innerHTML = renderTaskFileEditor(task, value);
  $('#task-dialog').classList.add('task-file-modal');
  $('#task-dialog').showModal();
}

function closeTaskDialog() { $('#task-dialog').close(); editingTaskId = null; editingSubtasks = []; }

function summaryItemFor(metadata) {
  if (!metadata) return null;
  if (metadata.sourceKey === 'pool') return state.workItems.find((item) => item.id === metadata.id) || null;
  if (metadata.sourceKey === 'daily') return state.dailyPlans?.[metadata.period]?.[metadata.bucket]?.find((item) => item.id === metadata.id) || null;
  if (['weekly', 'monthly'].includes(metadata.sourceKey)) return state.plans?.[metadata.sourceKey]?.[metadata.period]?.items?.find((item) => item.id === metadata.id) || null;
  return null;
}

function openSummaryItemDialog(type, metadata = null) {
  if (type === 'task') return openTaskDialog(metadata ? taskForId(metadata.id) : null);

  const sourceKey = type.startsWith('daily-') ? 'daily' : type;
  const bucket = type.startsWith('daily-') ? type.slice(6) : metadata?.bucket || '';
  editingSummaryItem = metadata ? { ...metadata, sourceKey } : { sourceKey, bucket, id: null, period: '' };
  const item = summaryItemFor(editingSummaryItem);
  const isEditing = Boolean(item);
  const today = dateToISO(new Date());
  const categoryOptions = (state.settings.taskCategories || TASK_CATEGORIES).map((category) => `<option value="${inputValue(category)}" ${item?.category === category ? 'selected' : ''}>${esc(category)}</option>`).join('');
  const planTypeOptions = PLAN_TYPES.map((planType) => `<option value="${inputValue(planType)}" ${item?.planType === planType ? 'selected' : ''}>${esc(planType)}</option>`).join('');
  let fields = '';

  if (sourceKey === 'pool') {
    fields = `<label class="form-field full"><span class="label">事项名称 *</span><input class="input" name="title" required value="${inputValue(item?.title)}" placeholder="填写要推进的事项"></label><label class="form-field"><span class="label">截止日期</span><input class="input" name="dueDate" type="date" value="${inputValue(item?.dueDate || today)}"></label><label class="form-field"><span class="label">状态</span><select class="select" name="status"><option value="todo" ${item?.status === 'todo' || !item ? 'selected' : ''}>待办</option><option value="doing" ${item?.status === 'doing' ? 'selected' : ''}>进行中</option><option value="done" ${item?.status === 'done' ? 'selected' : ''}>已完成</option></select></label><label class="form-field"><span class="label">工作分类</span><select class="select" name="category">${categoryOptions}</select></label><label class="form-field"><span class="label">计划类型</span><select class="select" name="planType">${planTypeOptions}</select></label><label class="form-field"><span class="label">优先级</span><select class="select" name="priority">${['高', '普通', '低'].map((priority) => `<option ${item?.priority === priority || (!item && priority === '普通') ? 'selected' : ''}>${priority}</option>`).join('')}</select></label><label class="form-field"><span class="label">验收人</span><input class="input" name="reviewer" value="${inputValue(item?.reviewer)}" placeholder="可选"></label><label class="form-field full"><span class="label">事项说明</span><textarea class="textarea" name="description" placeholder="补充背景、交付标准或阻塞问题">${inputValue(item?.description)}</textarea></label>`;
  } else if (sourceKey === 'daily') {
    fields = `<label class="form-field full"><span class="label">计划内容 *</span><input class="input" name="text" required value="${inputValue(item?.text)}" placeholder="填写当天要推进的工作"></label><label class="form-field"><span class="label">计划日期 *</span><input class="input" name="period" type="date" required value="${inputValue(editingSummaryItem.period || selectedDailyDate || today)}"></label><label class="form-field"><span class="label">计划归属</span><select class="select" name="bucket"><option value="today" ${editingSummaryItem.bucket === 'today' ? 'selected' : ''}>今日计划</option><option value="tomorrow" ${editingSummaryItem.bucket === 'tomorrow' ? 'selected' : ''}>明日计划</option></select></label><label class="form-field"><span class="label">状态</span><select class="select" name="done"><option value="false" ${!item?.done ? 'selected' : ''}>待推进</option><option value="true" ${item?.done ? 'selected' : ''}>已完成</option></select></label>`;
  } else if (sourceKey === 'weekly') {
    fields = `<label class="form-field full"><span class="label">计划内容 *</span><input class="input" name="text" required value="${inputValue(item?.text)}" placeholder="填写本周要完成的目标"></label><label class="form-field"><span class="label">所属周日期 *</span><input class="input" name="period" type="date" required value="${inputValue(editingSummaryItem.period || selectedPlanDate || today)}"><span class="helper">可选择该周任意一天</span></label><label class="form-field"><span class="label">状态</span><select class="select" name="done"><option value="false" ${!item?.done ? 'selected' : ''}>待推进</option><option value="true" ${item?.done ? 'selected' : ''}>已完成</option></select></label>`;
  } else {
    fields = `<label class="form-field full"><span class="label">计划内容 *</span><input class="input" name="text" required value="${inputValue(item?.text)}" placeholder="填写本月要完成的目标"></label><label class="form-field"><span class="label">所属月份 *</span><input class="input" name="period" type="month" required value="${inputValue(editingSummaryItem.period || (selectedPlanDate || today).slice(0, 7))}"></label><label class="form-field"><span class="label">状态</span><select class="select" name="done"><option value="false" ${!item?.done ? 'selected' : ''}>待推进</option><option value="true" ${item?.done ? 'selected' : ''}>已完成</option></select></label>`;
  }

  const labels = { pool: '任务池事项', daily: '日计划', weekly: '周计划', monthly: '月计划' };
  $('#summary-item-dialog-title').textContent = `${isEditing ? '编辑' : '新增'}${labels[sourceKey]}`;
  $('#summary-item-fields').innerHTML = fields;
  $('#summary-item-dialog').showModal();
  setTimeout(() => $('#summary-item-fields input')?.focus(), 0);
}

function closeSummaryItemDialog() {
  $('#summary-item-dialog').close();
  editingSummaryItem = null;
}

function removeSummaryItem(metadata) {
  if (metadata.sourceKey === 'pool') {
    state.workItems = state.workItems.filter((item) => item.id !== metadata.id);
    return;
  }
  if (metadata.sourceKey === 'daily') {
    const plan = state.dailyPlans?.[metadata.period];
    if (!plan?.[metadata.bucket]) return;
    plan[metadata.bucket] = plan[metadata.bucket].filter((item) => item.id !== metadata.id);
    if (!(plan.today?.length || plan.tomorrow?.length)) delete state.dailyPlans[metadata.period];
    return;
  }
  const plan = state.plans?.[metadata.sourceKey]?.[metadata.period];
  if (plan?.items) plan.items = plan.items.filter((item) => item.id !== metadata.id);
}

function saveSummaryItem() {
  const form = $('#summary-item-form');
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const metadata = editingSummaryItem;
  if (!metadata) return;
  const existing = summaryItemFor(metadata);
  const id = existing?.id || crypto.randomUUID();

  if (metadata.sourceKey === 'pool') {
    const now = new Date().toISOString();
    const item = {
      ...(existing || {}), id, title: data.title.trim(), description: data.description.trim(), category: data.category,
      planType: data.planType, priority: data.priority, dueDate: data.dueDate, status: data.status, reviewer: data.reviewer.trim(),
      acceptanceStatus: existing?.acceptanceStatus || '', performanceTaskId: existing?.performanceTaskId || '', createdAt: existing?.createdAt || now,
      completedAt: data.status === 'done' ? (existing?.completedAt || now) : '',
    };
    if (data.status !== 'done') item.acceptanceStatus = '';
    const index = state.workItems.findIndex((entry) => entry.id === id);
    if (index >= 0) state.workItems[index] = item; else state.workItems.unshift(item);
  } else {
    const item = { id, text: data.text.trim(), done: data.done === 'true' };
    if (existing) removeSummaryItem(metadata);
    if (metadata.sourceKey === 'daily') {
      dailyPlanFor(data.period)[data.bucket].push(item);
    } else {
      const period = metadata.sourceKey === 'weekly' ? weekKey(data.period) : data.period;
      planFor(metadata.sourceKey, period).items.push(item);
    }
  }

  save(); closeSummaryItemDialog(); render(); toast(existing ? '事项已更新' : '事项已添加');
}

function deleteSummaryItem(action) {
  const metadata = { sourceKey: action.dataset.sourceKey, id: action.dataset.id, period: action.dataset.period, bucket: action.dataset.bucket };
  if (!confirm('确认删除这条事项？')) return;
  if (metadata.sourceKey === 'task') state.tasks = state.tasks.filter((task) => task.id !== metadata.id);
  else removeSummaryItem(metadata);
  save(); render(); toast('事项已删除');
}

function createSummaryInlineItem(type) {
  const today = dateToISO(new Date());
  const id = crypto.randomUUID();
  let sourceKey = type;
  let focusField = 'text';
  if (type === 'task' || type === 'daily-today') {
    sourceKey = 'task';
    state.tasks.unshift({ id, date: today, content: '', body: '', category: state.settings.taskCategories[0] || '其他', planType: '单人工作', collaborator: '', estimatedHours: '', actualHours: '', completionPct: '', collaborationPct: '', innovation: '', selfScore: '', reviewerScore: '', nextPlan: '', blocker: '', breakthrough: '', subtasks: [] });
    focusField = 'content';
  } else if (type === 'pool') {
    state.workItems.unshift({ id, title: '', description: '', category: state.settings.taskCategories[0] || '其他', planType: '单人工作', priority: '普通', dueDate: today, status: 'todo', reviewer: '', acceptanceStatus: '', performanceTaskId: '', createdAt: new Date().toISOString(), completedAt: '' });
    focusField = 'title';
  } else if (type.startsWith('daily-')) {
    sourceKey = 'daily';
    dailyPlanFor(today)[type.slice(6)].unshift({ id, text: '', done: false });
  } else if (type === 'weekly') {
    planFor('weekly', weekKey(today)).items.unshift({ id, text: '', done: false });
  } else {
    planFor('monthly', today.slice(0, 7)).items.unshift({ id, text: '', done: false });
  }
  summaryFilters = { search: '', source: sourceKey, status: '' };
  activeTab = 'summary';
  save(); render();
  setTimeout(() => document.querySelector(`[data-summary-field="${focusField}"][data-id="${id}"]`)?.focus(), 0);
}

function updateSummaryRowField(target) {
  const metadata = { sourceKey: target.dataset.sourceKey, id: target.dataset.id, period: target.dataset.period, bucket: target.dataset.bucket };
  const field = target.dataset.summaryField;
  const item = metadata.sourceKey === 'task' ? taskForId(metadata.id) : summaryItemFor(metadata);
  if (!item) return;
  if (field === 'period' && !target.value) { toast('日期或周期不能为空'); render(); return; }
  if (metadata.sourceKey === 'task' && field === 'date' && !target.value) { toast('任务日期不能为空'); render(); return; }

  if (metadata.sourceKey === 'task') {
    const numeric = ['estimatedHours', 'actualHours', 'completionPct', 'selfScore', 'reviewerScore'].includes(field);
    item[field] = numeric ? formNumber(field, target.value) : target.value;
  } else if (metadata.sourceKey === 'pool') {
    item[field] = target.value;
    if (field === 'status' && target.value === 'done' && !item.completedAt) item.completedAt = new Date().toISOString();
    if (field === 'status' && target.value !== 'done') { item.completedAt = ''; item.acceptanceStatus = ''; }
  } else if (metadata.sourceKey === 'daily') {
    if (field === 'text') item.text = target.value;
    else if (field === 'done') item.done = target.value === 'true';
    else if (field === 'period' || field === 'bucket') {
      const targetPeriod = field === 'period' ? target.value : metadata.period;
      const targetBucket = field === 'bucket' ? target.value : metadata.bucket;
      removeSummaryItem(metadata);
      dailyPlanFor(targetPeriod)[targetBucket].push(item);
    }
  } else if (['weekly', 'monthly'].includes(metadata.sourceKey)) {
    if (field === 'text') item.text = target.value;
    else if (field === 'done') item.done = target.value === 'true';
    else if (field === 'planTitle') planFor(metadata.sourceKey, metadata.period).title = target.value;
    else if (field === 'period') {
      const targetPeriod = metadata.sourceKey === 'weekly' ? weekKey(target.value) : target.value;
      removeSummaryItem(metadata);
      planFor(metadata.sourceKey, targetPeriod).items.push(item);
    }
  }
  save(); render();
}

function readTaskForm() {
  const data = Object.fromEntries(new FormData($('#task-form')).entries());
  const subtasks = Array.from(document.querySelectorAll('[data-dialog-subtask-field="text"]')).map((input) => ({ id: input.dataset.subtaskId, text: input.value, done: Boolean(editingSubtasks.find((item) => item.id === input.dataset.subtaskId)?.done) }));
  return { ...(editingTaskId ? taskForId(editingTaskId) : {}), ...data, id: editingTaskId || crypto.randomUUID(), subtasks, estimatedHours: formNumber('estimatedHours', data.estimatedHours), actualHours: formNumber('actualHours', data.actualHours), completionPct: formNumber('completionPct', data.completionPct), collaborationPct: formNumber('collaborationPct', data.collaborationPct), innovation: formNumber('innovation', data.innovation), selfScore: formNumber('selfScore', data.selfScore), reviewerScore: formNumber('reviewerScore', data.reviewerScore) };
}
function saveTaskFromDialog() {
  const task = readTaskForm();
  const index = state.tasks.findIndex((item) => item.id === task.id);
  if (index >= 0) state.tasks[index] = task; else state.tasks.push(task);
  save(); closeTaskDialog(); currentMonth = Number(task.date.slice(5, 7)); render(); toast(index >= 0 ? '任务已更新' : '任务已添加');
}
function addInlineTask() {
  selectedWorkspaceView = 'performance';
  createSummaryInlineItem('task');
}

async function importExcel(file) {
  const response = await fetch('/api/import', { method: 'POST', body: await file.arrayBuffer() });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '导入失败');
  state = normalizeState(result.state); migrateDailyPlansToTasks(); save(); render(); toast(`已导入 ${state.tasks.length} 条任务${result.warnings?.length ? `，有 ${result.warnings.length} 项提示` : ''}`);
}

function download(name, blob) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
function exportJson() { download('绩效考核备份.json', new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); toast('JSON 备份已生成'); }
async function exportExcel() { const response = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }); if (!response.ok) { toast('Excel 导出失败'); return; } download('绩效考核归档.xlsx', await response.blob()); toast('Excel 归档已生成'); }

document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-tab]'); if (nav) return setActiveTab(nav.dataset.tab);
  const monthSelect = event.target.closest('[data-month-select]'); if (monthSelect) return;
  const day = event.target.closest('[data-day]'); if (day) { selectedDate = day.dataset.day; render(); return; }
  const action = event.target.closest('[data-action]'); if (!action) return;
  const type = action.dataset.action;
  const panel = action.closest('[data-daily-panel]');
  if (panel?.classList.contains('is-frozen') && !['toggle-daily-panel-freeze', 'toggle-daily-item', 'toggle-daily-task', 'toggle-daily-task-next', 'toggle-plan-item', 'toggle-task-subtask', 'daily-view-mode'].includes(type)) return;
  if (type === 'toggle-sidebar') { sidebarCollapsed = !sidebarCollapsed; localStorage.setItem('performance-sidebar-collapsed', sidebarCollapsed ? '1' : '0'); render(); return; }
  if (type === 'add-task') return addInlineTask();
  if (type === 'add-daily-item') return addDailyItem(action);
  if (type === 'toggle-daily-item') { const item = dailyItemFrom(action); if (item) { item.done = action.checked; save(); render(); } return; }
  if (type === 'toggle-daily-task') { const task = taskForId(action.dataset.id); if (task) { task.completionPct = action.checked ? 100 : 0; save(); render(); toast(action.checked ? '任务已标记完成' : '任务已恢复为未完成'); } return; }
  if (type === 'toggle-task-subtask') { const task = taskForId(action.dataset.taskId); const item = task?.subtasks?.find((entry) => entry.id === action.dataset.subtaskId); if (item) { item.done = action.checked; save(); render(); } return; }
  if (type === 'toggle-dialog-subtask') { const item = editingSubtasks.find((entry) => entry.id === action.dataset.subtaskId); if (item) item.done = action.checked; return; }
  if (type === 'add-dialog-subtask') { editingSubtasks.push({ id: crypto.randomUUID(), text: '', done: false }); $('#task-subtasks-editor').innerHTML = renderTaskSubtaskEditor(); $('#task-subtasks-editor input[data-dialog-subtask-field="text"]:last-of-type')?.focus(); return; }
  if (type === 'delete-dialog-subtask') { editingSubtasks = editingSubtasks.filter((entry) => entry.id !== action.dataset.subtaskId); $('#task-subtasks-editor').innerHTML = renderTaskSubtaskEditor(); return; }
  if (type === 'add-task-subtask') { const task = taskForId(action.dataset.taskId); if (task) { task.subtasks = Array.isArray(task.subtasks) ? task.subtasks : []; task.subtasks.push({ id: crypto.randomUUID(), text: '', done: false }); save(); render(); document.querySelector(`[data-task-subtask-field="text"][data-task-id="${action.dataset.taskId}"]:last-of-type`)?.focus(); } return; }
  if (type === 'delete-task-subtask') { const task = taskForId(action.dataset.taskId); if (task) { task.subtasks = (task.subtasks || []).filter((entry) => entry.id !== action.dataset.subtaskId); save(); render(); } return; }
  if (type === 'toggle-daily-task-next') { const task = taskForId(action.dataset.id); if (task) { task.nextPlanDone = action.checked; save(); render(); } return; }
  if (type === 'toggle-block-freeze') return toggleBlockFreeze(action);
  if (type === 'toggle-daily-panel-freeze') return toggleDailyPanelFreeze(action);
  if (type === 'daily-layout-preset') return applyDailyLayoutPreset(action.dataset.layoutPreset);
  if (type === 'daily-view-mode') { dailyTodayViewMode = action.dataset.viewMode === 'board' ? 'board' : 'list'; localStorage.setItem('performance-daily-view-mode', dailyTodayViewMode); render(); return; }
  if (type === 'select-daily-task') {
    const nextId = action.dataset.id || '';
    dailyTaskFileOpen = selectedDailyTaskId === nextId ? !dailyTaskFileOpen : true;
    selectedDailyTaskId = nextId;
    localStorage.setItem('performance-selected-daily-task', selectedDailyTaskId);
    localStorage.setItem('performance-daily-task-file-open', dailyTaskFileOpen ? '1' : '0');
    render();
    return;
  }
  if (type === 'toggle-daily-task-file') {
    dailyTaskFileOpen = !dailyTaskFileOpen;
    localStorage.setItem('performance-daily-task-file-open', dailyTaskFileOpen ? '1' : '0');
    render();
    return;
  }
  if (type === 'delete-daily-item') { const plan = dailyPlanFor(action.dataset.dailyDate); plan[action.dataset.dailyBucket] = plan[action.dataset.dailyBucket].filter((item) => item.id !== action.dataset.itemId); save(); render(); return; }
  if (type === 'focus-block-edit') { const input = action.closest('.daily-block')?.querySelector('.daily-block-title'); input?.focus(); input?.select(); return; }
  if (type === 'daily-today') { selectedDailyDate = dateToISO(new Date()); render(); return; }
  if (type === 'workspace-view') { selectedWorkspaceView = action.dataset.workspaceView; summaryFilters = { search: '', source: { pool: 'pool', weekly: 'weekly', monthly: 'monthly' }[selectedWorkspaceView] || '', status: '' }; activeTab = 'summary'; render(); return; }
  if (type === 'add-summary-row') return createSummaryInlineItem($('#summary-create-type')?.value || 'task');
  if (type === 'create-summary-item') return openSummaryItemDialog($('#summary-create-type')?.value || 'task');
  if (type === 'edit-summary-item') return openSummaryItemDialog(action.dataset.sourceKey, { sourceKey: action.dataset.sourceKey, id: action.dataset.id, period: action.dataset.period, bucket: action.dataset.bucket });
  if (type === 'delete-summary-item') return deleteSummaryItem(action);
  if (type === 'cancel-summary-item') return closeSummaryItemDialog();
  if (type === 'save-summary-item') return saveSummaryItem();
  if (type === 'open-plan') { selectedPlanDate = selectedDailyDate; selectedWorkspaceView = action.dataset.planKind === 'weekly' ? 'weekly' : 'monthly'; summaryFilters = { search: '', source: selectedWorkspaceView, status: '' }; activeTab = 'summary'; render(); return; }
  if (type === 'open-summary-source') {
    const target = action.dataset.tabTarget;
    if (target === 'tasks') { selectedWorkspaceView = 'performance'; activeTab = 'summary'; }
    else if (target === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(action.dataset.period)) { selectedDailyDate = action.dataset.period; activeTab = 'daily'; }
    else if (target === 'weekly') { selectedPlanDate = action.dataset.period; selectedWorkspaceView = 'weekly'; summaryFilters = { search: '', source: 'weekly', status: '' }; activeTab = 'summary'; }
    else if (target === 'monthlyPlan' && /^\d{4}-\d{2}$/.test(action.dataset.period)) { selectedPlanDate = `${action.dataset.period}-01`; selectedWorkspaceView = 'monthly'; summaryFilters = { search: '', source: 'monthly', status: '' }; activeTab = 'summary'; }
    else if (target === 'pool') { selectedWorkspaceView = 'pool'; summaryFilters = { search: '', source: 'pool', status: '' }; activeTab = 'summary'; }
    else activeTab = target;
    render(); return;
  }
  if (type === 'cancel-task') return closeTaskDialog();
  if (type === 'save-task') return saveTaskFromDialog();
  if (type === 'toggle-task-details') { if (expandedTaskIds.has(action.dataset.id)) expandedTaskIds.delete(action.dataset.id); else expandedTaskIds.add(action.dataset.id); render(); return; }
  if (type === 'quick-add') return addQuickPoolItem();
  if (type === 'quick-focus') { document.querySelector('#quick-title')?.focus(); return; }
  if (type === 'toggle-pool-details') { if (expandedPoolIds.has(action.dataset.id)) expandedPoolIds.delete(action.dataset.id); else expandedPoolIds.add(action.dataset.id); render(); return; }
  if (type === 'delete-pool') { state.workItems = state.workItems.filter((item) => item.id !== action.dataset.id); save(); render(); toast('任务池事项已删除'); return; }
  if (type === 'accept-pool') { const item = state.workItems.find((entry) => entry.id === action.dataset.id); if (item) { item.acceptanceStatus = 'accepted'; save(); render(); toast('已通过验收'); } return; }
  if (type === 'rework-pool') { const item = state.workItems.find((entry) => entry.id === action.dataset.id); if (item) { item.status = 'doing'; item.acceptanceStatus = 'rework'; save(); render(); toast('已退回修改'); } return; }
  if (type === 'record-performance') { const item = state.workItems.find((entry) => entry.id === action.dataset.id); if (item) { const taskId = crypto.randomUUID(); state.tasks.unshift({ id: taskId, date: item.completedAt ? dateToISO(item.completedAt) : dateToISO(new Date()), content: item.title, body: '', category: item.category || state.settings.taskCategories[0] || '其他', planType: item.planType || '单人工作', collaborator: '', estimatedHours: '', actualHours: '', completionPct: 100, collaborationPct: 0, innovation: '', selfScore: '', reviewerScore: '', nextPlan: '', blocker: item.description || '', breakthrough: '', subtasks: [] }); item.performanceTaskId = taskId; save(); selectedWorkspaceView = 'performance'; activeTab = 'summary'; summaryFilters = { search: '', source: 'task', status: '' }; render(); toast('已建立绩效记录，请补充工时和评分'); } return; }
  if (type === 'add-plan-item') return addPlanItem(action.dataset.planKind, action.dataset.planKey);
  if (type === 'toggle-plan-item') { const plan = planFor(action.dataset.planKind, action.dataset.planKey); const item = plan.items.find((entry) => entry.id === action.dataset.itemId); if (item) item.done = action.checked; save(); render(); return; }
  if (type === 'delete-plan-item') { const plan = planFor(action.dataset.planKind, action.dataset.planKey); plan.items = plan.items.filter((item) => item.id !== action.dataset.itemId); save(); render(); return; }
  if (type === 'add-category') { const input = document.querySelector('#new-category'); const category = input?.value.trim(); if (!category) return toast('请输入工作分类名称'); if (state.settings.taskCategories.includes(category)) return toast('该分类已存在'); state.settings.taskCategories.push(category); save(); render(); toast('工作分类已添加'); return; }
  if (type === 'remove-category') { if (state.settings.taskCategories.length <= 1) return toast('至少保留一个工作分类'); state.settings.taskCategories = state.settings.taskCategories.filter((category) => category !== action.dataset.category); save(); render(); toast('工作分类已移除'); return; }
  if (type === 'edit-task') return openTaskDialog(taskForId(action.dataset.id));
  if (type === 'copy-task') { const copy = structuredClone(taskForId(action.dataset.id)); copy.id = crypto.randomUUID(); state.tasks.push(copy); save(); render(); return toast('任务已复制'); }
  if (type === 'delete-task') { if (confirm('确认删除这条任务？')) { state.tasks = state.tasks.filter((task) => task.id !== action.dataset.id); save(); render(); toast('任务已删除'); } return; }
  if (type === 'day-tasks') { selectedWorkspaceView = 'performance'; activeTab = 'summary'; summaryFilters = { search: '', source: 'task', status: '' }; selectedDate = action.dataset.date; render(); return; }
  if (type === 'jump-month') { currentMonth = Number(action.dataset.month); activeTab = 'overview'; render(); return; }
  if (type === 'import-trigger') return $('#excel-input').click();
  if (type === 'export-json') return exportJson();
  if (type === 'export-excel') return exportExcel();
  if (type === 'reset') { if (confirm('恢复默认会清除当前所有本地数据，确认继续？')) { state = normalizeState(DEFAULT_STATE); save(); render(); toast('已恢复默认'); } return; }
  if (type === 'add-override') { const date = $('#override-date').value; if (!date) return toast('请选择日期'); const kind = $('#override-kind').value; const hours = $('#override-hours').value; state.calendarOverrides[date] = { kind, ...(hours === '' ? {} : { hours: Number(hours) }) }; save(); render(); return toast('日期规则已添加'); }
  if (type === 'remove-override') { delete state.calendarOverrides[action.dataset.date]; save(); render(); return toast('日期规则已移除'); }
});

document.addEventListener('change', async (event) => {
  const target = event.target;
  if (target.matches('[data-month-select]')) { currentMonth = Number(target.value); selectedDate = ''; render(); return; }
  if (target.matches('[data-daily-date-select]')) { selectedDailyDate = target.value || dateToISO(new Date()); render(); return; }
  if (target.matches('[data-daily-task-status]')) { const task = taskForId(target.dataset.id); if (task) { task.completionPct = { todo: 0, doing: 50, done: 100 }[target.value]; save(); render(); } return; }
  if (target.matches('[data-daily-plan-status]')) { const item = dailyPlanFor(target.dataset.date)[target.dataset.bucket].find((entry) => entry.id === target.dataset.itemId); if (item) { item.done = target.value === 'done'; save(); render(); } return; }
  if (target.matches('[data-daily-task-next-status]')) { const task = taskForId(target.dataset.id); if (task) { task.nextPlanDone = target.value === 'done'; save(); render(); } return; }
  if (target.matches('[data-plan-block-status]')) { const item = planFor(target.dataset.planKind, target.dataset.planKey).items.find((entry) => entry.id === target.dataset.itemId); if (item) { item.done = target.value === 'done'; save(); render(); } return; }
  if (target.matches('[data-daily-item-field]')) { const item = dailyItemFrom(target); if (item) { item[target.dataset.dailyItemField] = target.value; save(); } return; }
  if (target.matches('[data-daily-task-field]')) { const task = taskForId(target.dataset.id); if (task) { task[target.dataset.dailyTaskField] = target.value; save(); render(); } return; }
  if (target.matches('[data-daily-task-file-field]')) {
    const task = taskForId(target.dataset.id);
    if (task) {
      const field = target.dataset.dailyTaskFileField;
      const numericFields = ['estimatedHours', 'actualHours', 'completionPct', 'collaborationPct', 'innovation', 'selfScore', 'reviewerScore'];
      task[field] = numericFields.includes(field) ? formNumber(field, target.value) : target.value;
      if (field === 'date' && task.date) selectedDailyDate = task.date;
      save(); render();
    }
    return;
  }
  if (target.matches('[data-task-subtask-field]')) { const task = taskForId(target.dataset.taskId); const item = task?.subtasks?.find((entry) => entry.id === target.dataset.subtaskId); if (item) { item.text = target.value; save(); } return; }
  if (target.matches('[data-dialog-subtask-field]')) { const item = editingSubtasks.find((entry) => entry.id === target.dataset.subtaskId); if (item) item.text = target.value; return; }
  if (target.matches('[data-summary-filter]')) { summaryFilters[target.dataset.summaryFilter] = target.value; render(); return; }
  if (target.matches('[data-summary-field]')) { updateSummaryRowField(target); return; }
  if (target.id === 'excel-input' && target.files[0]) { try { await importExcel(target.files[0]); } catch (error) { toast(error.message); } target.value = ''; return; }
  if (target.matches('[data-filter]')) { taskFilters[target.dataset.filter] = target.value; render(); return; }
  if (target.matches('[data-task-field]')) { updateTaskField(target); return; }
  if (target.matches('[data-pool-field]')) { updatePoolField(target); return; }
  if (target.matches('[data-plan-date]')) { selectedPlanDate = target.type === 'month' ? `${target.value}-01` : target.value; render(); return; }
  if (target.matches('[data-plan-field]')) { updatePlanField(target); return; }
  if (target.matches('[data-plan-item-field]')) { updatePlanItem(target); return; }
  if (target.matches('[data-profile]')) { state.profile[target.dataset.profile] = target.dataset.profile === 'year' ? Number(target.value) : target.value; save(); render(); return; }
  if (target.matches('[data-setting]')) { const key = target.dataset.setting; const value = Number(target.value); if (key.startsWith('gradeThresholds.')) state.settings.gradeThresholds[key.split('.')[1]] = value; else state.settings[key] = value; if (key === 'standardDayHours' && Number.isFinite(value) && value > 0) state.settings.baseRewardPerHour = 100 / value; save(); render(); return; }
  if (target.matches('[data-review]')) { const key = target.dataset.reviewMonth; state.monthlyReviews[key] = { ...(state.monthlyReviews[key] || {}), [target.dataset.review]: target.dataset.review === 'note' ? target.value : formNumber('selfScore', target.value) }; save(); render(); }
});

document.addEventListener('blur', (event) => { if (event.target.matches('[data-task-field]')) updateTaskField(event.target); }, true);
document.addEventListener('keydown', (event) => { if (event.key === 'Enter' && event.target.matches('[data-daily-new]')) { event.preventDefault(); document.querySelector(`[data-action="add-daily-item"][data-daily-date="${event.target.dataset.date}"][data-daily-bucket="${event.target.dataset.dailyNew}"]`)?.click(); } });
document.addEventListener('dragstart', (event) => {
  const block = event.target.closest('[data-sortable-block]');
  if (!block) return;
  if (block.closest('[data-daily-panel].is-frozen')) { event.preventDefault(); return; }
  if (!event.target.closest('.daily-block-handle')) { event.preventDefault(); return; }
  draggedSortableBlock = block;
  block.classList.add('dragging');
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'copyMove'; event.dataTransfer.setData('text/plain', block.dataset.blockKey); }
});
document.addEventListener('dragover', (event) => {
  if (!draggedSortableBlock) return;
  const target = event.target.closest('[data-sortable-block]');
  const container = event.target.closest('[data-sort-container]');
  if (container?.closest('[data-daily-panel].is-frozen')) return;
  const targetGroup = target?.dataset.sortGroup || container?.dataset.sortGroup;
  if (!targetGroup) return;
  event.preventDefault();
  document.querySelectorAll('[data-sortable-block].drop-before, [data-sortable-block].drop-after').forEach((block) => block.classList.remove('drop-before', 'drop-after'));
  document.querySelectorAll('[data-sort-container].copy-target').forEach((node) => node.classList.remove('copy-target'));
  if (targetGroup !== draggedSortableBlock.dataset.sortGroup) { container?.classList.add('copy-target'); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; return; }
  if (!target || target === draggedSortableBlock) return;
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  const placeAfter = event.clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
  target.classList.add(placeAfter ? 'drop-after' : 'drop-before');
});
document.addEventListener('drop', (event) => {
  if (!draggedSortableBlock) return;
  const target = event.target.closest('[data-sortable-block]');
  const container = event.target.closest('[data-sort-container]');
  const targetGroup = target?.dataset.sortGroup || container?.dataset.sortGroup;
  if (!targetGroup) return;
  if (container?.closest('[data-daily-panel].is-frozen') || target?.closest('[data-daily-panel].is-frozen')) return;
  event.preventDefault();
  if (targetGroup !== draggedSortableBlock.dataset.sortGroup) {
    const sourceGroup = draggedSortableBlock.dataset.sortGroup;
    const sourceKey = draggedSortableBlock.dataset.blockKey;
    draggedSortableBlock = null;
    document.querySelectorAll('[data-sort-container].copy-target').forEach((node) => node.classList.remove('copy-target'));
    copySortableBlock(sourceGroup, sourceKey, targetGroup);
    return;
  }
  if (container?.dataset.dailyStatus) setBlockProgressFromDrop(targetGroup, draggedSortableBlock.dataset.blockKey, container.dataset.dailyStatus);
  if (!target || target === draggedSortableBlock) { save(); render(); return; }
  const placeAfter = event.clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
  reorderSortableBlocks(target.dataset.sortGroup, draggedSortableBlock.dataset.blockKey, target.dataset.blockKey, placeAfter);
});
document.addEventListener('dragend', () => {
  document.querySelectorAll('[data-sortable-block].dragging, [data-sortable-block].drop-before, [data-sortable-block].drop-after').forEach((block) => block.classList.remove('dragging', 'drop-before', 'drop-after'));
  document.querySelectorAll('[data-sort-container].copy-target').forEach((node) => node.classList.remove('copy-target'));
  draggedSortableBlock = null;
});
document.addEventListener('pointerdown', (event) => {
  const rowHandle = event.target.closest('[data-row-resize]');
  if (rowHandle) {
    if (rowHandle.classList.contains('disabled')) return;
    const board = rowHandle.closest('.daily-board-layout');
    const index = Number(rowHandle.dataset.rowResize);
    const rows = dailyPanelRows();
    if (!board || !rows[index] || !rows[index + 1]) return;
    const measured = rows.map((row) => Math.max(...row.map((key) => document.querySelector(`[data-daily-panel="${key}"]`)?.getBoundingClientRect().height || 180)));
    const heights = Array.isArray(dailyRowHeights[dailyLayoutPreset]) && dailyRowHeights[dailyLayoutPreset].length === rows.length ? [...dailyRowHeights[dailyLayoutPreset]] : measured;
    dailyRowHeights[dailyLayoutPreset] = heights;
    event.preventDefault();
    rowHandle.setPointerCapture?.(event.pointerId);
    resizingDailyRow = { board, rowHandle, index, pointerId: event.pointerId, startY: event.clientY, startHeights: heights };
    document.body.classList.add('resizing-daily-row');
    return;
  }
  const moveHandle = event.target.closest('.daily-panel-topbar');
  if (moveHandle) {
    const panel = moveHandle.closest('[data-daily-panel]');
    if (!panel || panel.classList.contains('is-frozen')) return;
    event.preventDefault();
    moveHandle.setPointerCapture?.(event.pointerId);
    pointerDailyPanelDrag = { panel, handle: moveHandle, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, targetKey: null, moved: false };
    return;
  }
  const handle = event.target.closest('[data-panel-resize]');
  if (!handle) return;
  const panel = handle.closest('[data-daily-panel]');
  const board = panel?.closest('.daily-board-layout');
  if (!panel || !board || panel.classList.contains('is-frozen')) return;
  event.preventDefault();
  const key = handle.dataset.panelResize;
  const geometry = dailyPanelGeometry(key);
  if (geometry.rowKeys.length < 2) return;
  const neighborKey = geometry.rowKeys[geometry.rowKeys.indexOf(key) + 1];
  if (!neighborKey) return;
  const boardWidth = board.getBoundingClientRect().width;
  handle.setPointerCapture?.(event.pointerId);
  resizingDailyPanel = { key, panel, handle, pointerId: event.pointerId, startX: event.clientX, startSpan: dailyPanelLayout[key].span, rowKeys: geometry.rowKeys, neighborKey, startSpans: Object.fromEntries(geometry.rowKeys.map((rowKey) => [rowKey, dailyPanelLayout[rowKey].span])), boardWidth, columnWidth: boardWidth / DAILY_GRID_UNITS };
  document.body.classList.add('resizing-panels');
});
document.addEventListener('pointermove', (event) => {
  if (resizingDailyRow) {
    const resize = resizingDailyRow;
    const topIndex = resize.index;
    const bottomIndex = topIndex + 1;
    const delta = event.clientY - resize.startY;
    const minTop = 160;
    const minBottom = 160;
    const total = resize.startHeights[topIndex] + resize.startHeights[bottomIndex];
    const top = Math.min(total - minBottom, Math.max(minTop, resize.startHeights[topIndex] + delta));
    const bottom = total - top;
    const next = [...resize.startHeights];
    next[topIndex] = top;
    next[bottomIndex] = bottom;
    dailyRowHeights[dailyLayoutPreset] = next;
    resize.board.style.gridTemplateRows = next.map((height) => `minmax(${Math.max(160, Number(height) || 160)}px,max-content)`).join(' ');
    syncDailyRowResizeHandles();
    return;
  }
  if (pointerDailyPanelDrag) {
    const drag = pointerDailyPanelDrag;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    drag.moved = true;
    drag.panel.classList.add('panel-dragging');
    document.querySelectorAll('.panel-drop-target').forEach((panel) => panel.classList.remove('panel-drop-target'));
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-daily-panel]');
    drag.targetKey = target && target !== drag.panel ? target.dataset.dailyPanel : null;
    target?.classList.toggle('panel-drop-target', Boolean(drag.targetKey));
    return;
  }
  if (!resizingDailyPanel) return;
  const delta = Math.round((event.clientX - resizingDailyPanel.startX) / resizingDailyPanel.columnWidth);
  const rawSpan = resizingDailyPanel.startSpan + delta;
  const neighborKey = resizingDailyPanel.neighborKey;
  const neighborStart = resizingDailyPanel.startSpans[neighborKey];
  const rawNeighborSpan = neighborStart - (rawSpan - resizingDailyPanel.startSpan);
  const keyWidth = rawSpan / DAILY_GRID_UNITS * resizingDailyPanel.boardWidth;
  const neighborWidth = rawNeighborSpan / DAILY_GRID_UNITS * resizingDailyPanel.boardWidth;
  const smallerKey = keyWidth < DAILY_PANEL_WRAP_PX ? resizingDailyPanel.key : neighborWidth < DAILY_PANEL_WRAP_PX ? neighborKey : '';
  if (smallerKey && splitDailyResizeRow(resizingDailyPanel, smallerKey)) {
    resizingDailyPanel.handle.releasePointerCapture?.(resizingDailyPanel.pointerId);
    resizingDailyPanel = null;
    document.body.classList.remove('resizing-panels');
    render();
    return;
  }
  const hardMinSpan = Math.max(1, Math.ceil(DAILY_PANEL_HARD_MIN_PX / resizingDailyPanel.boardWidth * DAILY_GRID_UNITS));
  const maxSpan = DAILY_GRID_UNITS - (resizingDailyPanel.rowKeys.length - 1) * hardMinSpan;
  let span = Math.min(maxSpan, Math.max(hardMinSpan, rawSpan));
  if (neighborKey) {
    let neighborSpan = neighborStart - (span - resizingDailyPanel.startSpan);
    if (neighborSpan < hardMinSpan) { span -= hardMinSpan - neighborSpan; neighborSpan = hardMinSpan; }
    if (neighborSpan > DAILY_GRID_UNITS) { span += neighborSpan - DAILY_GRID_UNITS; neighborSpan = DAILY_GRID_UNITS; }
    dailyPanelLayout[neighborKey].span = neighborSpan;
  }
  dailyPanelLayout[resizingDailyPanel.key].span = span;
  syncDailyRowGeometry(resizingDailyPanel.rowKeys);
});
document.addEventListener('pointerup', (event) => {
  if (resizingDailyRow) {
    const resize = resizingDailyRow;
    resize.rowHandle.releasePointerCapture?.(resize.pointerId);
    saveDailyRowHeights();
    resizingDailyRow = null;
    document.body.classList.remove('resizing-daily-row');
    syncDailyRowResizeHandles();
    return;
  }
  if (pointerDailyPanelDrag) {
    const drag = pointerDailyPanelDrag;
    const dropTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-daily-panel]');
    const targetKey = dropTarget && dropTarget !== drag.panel ? dropTarget.dataset.dailyPanel : drag.targetKey;
    drag.handle.releasePointerCapture?.(drag.pointerId);
    document.querySelectorAll('.panel-dragging, .panel-drop-target').forEach((panel) => panel.classList.remove('panel-dragging', 'panel-drop-target'));
    pointerDailyPanelDrag = null;
    if (drag.moved && targetKey) reorderDailyPanels(drag.panel.dataset.dailyPanel, targetKey, event.clientX);
    return;
  }
  if (!resizingDailyPanel) return;
  resizingDailyPanel.handle.releasePointerCapture?.(resizingDailyPanel.pointerId);
  saveDailyPanelLayout();
  resizingDailyPanel = null;
  document.body.classList.remove('resizing-panels');
});
document.addEventListener('pointercancel', () => {
  document.querySelectorAll('.panel-dragging, .panel-drop-target').forEach((panel) => panel.classList.remove('panel-dragging', 'panel-drop-target'));
  pointerDailyPanelDrag = null;
  resizingDailyPanel = null;
  resizingDailyRow = null;
  document.body.classList.remove('resizing-panels');
  document.body.classList.remove('resizing-daily-row');
});
$('#summary-item-form').addEventListener('submit', (event) => { event.preventDefault(); saveSummaryItem(); });

function updateTaskField(target) {
  const task = taskForId(target.dataset.taskId); if (!task) return;
  const key = target.dataset.taskField;
  const numeric = ['estimatedHours', 'actualHours', 'completionPct', 'collaborationPct', 'innovation', 'selfScore', 'reviewerScore'].includes(key);
  task[key] = numeric ? formNumber(key, target.value) : target.value;
  save();
  const row = target.closest('tr');
  if (row && (target.type === 'number' || target.tagName === 'SELECT' || target.type === 'date')) { render(); }
}

render();
