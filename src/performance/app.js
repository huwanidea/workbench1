/* eslint-disable */
import { DEFAULT_STATE, PLAN_TYPES, TASK_CATEGORIES, calculateDay, calculateMonth, calendarHours, dateToISO, monthKey, monthLabel, normalizeState, validateState } from './calc.js';
import { getFieldConfigs, renderFieldConfigPanel } from './field-config.js';
import {
  renderNotificationItems, renderChatUserList,
  renderChatConversation, renderChatInputArea, renderMentionMenu, parseMentions,
  createNotification, createMessage, setSelectedChatUserId, getSelectedChatUserId,
} from './notifications.js';
import {
  documentNodes, renderDocTree, createDocumentNode, createFolderNode,
  collectDescendantIds, TASKS_GROUP_ID,
} from './documents.js';
import { projectForId, createProjectNode, createMilestone, createProjectTask, renderProjects, findProjectTask, sopTemplateForId, createSopNode, collectProjectAcceptance } from './projects.js';
import { renderProjectTaskDrawer } from './project-task-detail.js';
import { renderSopTemplateLibrary, renderSopNodeEditor } from './sop-templates.js';

const LEGACY_STORAGE_KEY = 'performance-review-state-v1';
const USER_DIRECTORY_KEY = 'performance-review-users-v1';
const ACTIVE_USER_KEY = 'performance-review-active-user-v1';
const USER_STATE_PREFIX = 'performance-review-state-v2';
const MESSAGES_KEY = 'performance-review-messages-v1';
const ASSESSMENT_TEMPLATE_KEY = 'performance-review-assessment-templates-v1';
const ASSESSMENT_TEMPLATE_DELETED_KEY = 'performance-review-assessment-templates-deleted-v1';
const DEFAULT_TEMPLATE_ID = 'general-task-performance';
const OPERATIONS_DIRECTOR_TEMPLATE_ID = 'operations-director-monthly';
const parseStoredJson = (key, fallback = null) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const BUILTIN_ASSESSMENT_TEMPLATES = [
  {
    id: DEFAULT_TEMPLATE_ID,
    name: '通用任务绩效',
    role: '通用岗位',
    description: '按每日任务、工时、交付质量与综合素养汇总月度绩效。',
    builtIn: true,
    penaltyMax: 100,
    bonusMax: 10,
    dimensions: [
      { name: '日常表现', weight: 80, indicators: [
        { id: 'general-daily-performance', name: '每日任务绩效与工时水位', weight: 80, standard: '按当月每日任务绩效平均值折算，本项最高 80 分', autoSource: 'dailyPerformance' },
      ] },
      { name: '综合素养', weight: 20, indicators: [
        { id: 'general-collaboration', name: '协同能力', weight: 5, standard: '按 0-100 分评价，折算为本项最高 5 分', autoSource: 'collaboration' },
        { id: 'general-loyalty', name: '忠诚度', weight: 5, standard: '按 0-100 分评价，折算为本项最高 5 分', autoSource: 'loyalty' },
        { id: 'general-discipline', name: '纪律性', weight: 5, standard: '按 0-100 分评价，折算为本项最高 5 分', autoSource: 'discipline' },
        { id: 'general-learning', name: '学习力', weight: 5, standard: '按 0-100 分评价，折算为本项最高 5 分', autoSource: 'learning' },
      ] },
    ],
  },
  {
    id: OPERATIONS_DIRECTOR_TEMPLATE_ID,
    name: '运营总监月度绩效',
    role: '运营总监',
    description: '覆盖销售、重点工作、生态业务、风险合规、供应链与综合素养。',
    builtIn: true,
    penaltyMax: 100,
    bonusMax: 10,
    dimensions: [
      { name: '销售业绩管理', weight: 30, indicators: [
        { id: 'sales-target', name: '销售部门整体业绩达标率', weight: 20, standard: '95%-100% 得满分，每低 10% 扣 5 分，低于 50% 不得分' },
        { id: 'certified-products', name: '认证产品达标情况及新品送样', weight: 5, standard: '目标完成 100/90/80/70/60%，得分 5/4/3/2/1，60% 以下 0 分' },
        { id: 'regional-expansion', name: '区域拓展达标情况跟进', weight: 5, standard: '目标完成 100/90/80/70/60%，得分 5/4/3/2/1，60% 以下 0 分' },
      ] },
      { name: '重点工作执行', weight: 15, indicators: [
        { id: 'executive-office', name: '总经办交办事项完成率', weight: 10, standard: '100% 得满分，每出现 1 项未完成扣 1 分' },
        { id: 'cross-team', name: '跨部门协作效率', weight: 5, standard: '双指标达标得满分，单项达标得 50%，双项不达标不得分' },
      ] },
      { name: '生态服务业务推进', weight: 15, indicators: [
        { id: 'ecosystem-events', name: '美食节、品鉴会、餐饮培训及厨师交流四项指标', weight: 10, standard: '四项指标按完成比例得分，均达标得满分' },
        { id: 'weiju-project', name: '协助味聚平台项目落地情况', weight: 5, standard: '85% 以上满分，每低 5% 扣 15%，低于 70% 不得分' },
      ] },
      { name: '风险合规把控', weight: 20, indicators: [
        { id: 'contract-compliance', name: '合同审核合规率', weight: 4, standard: '100% 得满分，每出现 1 份不合规合同扣 20%' },
        { id: 'purchase-compliance', name: '采购环节合规率', weight: 4, standard: '100% 得满分，每出现 1 次违规扣 20%' },
        { id: 'customs-compliance', name: '报关清关合规率', weight: 4, standard: '100% 得满分，每出现 1 次失职扣 30%' },
        { id: 'finance-compliance', name: '财税规范达标率', weight: 4, standard: '100% 得满分，出现任何违规不得分' },
        { id: 'operation-safety', name: '公司总体运营安全把控', weight: 4, standard: '100% 得满分，出现任何违规不得分' },
      ] },
      { name: '供应链运营监督', weight: 10, indicators: [
        { id: 'purchase-delivery', name: '采购达成率', weight: 4, standard: '98% 以上满分，每低 1% 扣 5%，低于 90% 不得分' },
        { id: 'warehouse-operation', name: '仓库运营达标率', weight: 4, standard: '99% 以上满分，每低 0.5% 扣 10%，低于 95% 不得分' },
        { id: 'warehouse-service', name: '仓库第三方服务推进完成率', weight: 2, standard: '85% 以上满分，每低 5% 扣 15%，低于 70% 不得分' },
      ] },
      { name: '综合素养表现', weight: 10, indicators: [
        { id: 'mission-view', name: '企业使命感与大局观', weight: 6, standard: '8-10 分得满分，6-7 分得 50%，低于 6 分不得分' },
        { id: 'learning-communication', name: '行业学习与创新、情商与沟通交流', weight: 4, standard: '8-10 分得满分，6-7 分得 50%，低于 6 分不得分' },
      ] },
    ],
  },
];
function normalizeAssessmentTemplate(template) {
  if (!template || !String(template.name || '').trim() || !Array.isArray(template.dimensions)) return null;
  const dimensions = template.dimensions.map((dimension) => {
    const indicators = Array.isArray(dimension.indicators) ? dimension.indicators.map((indicator) => ({
      id: String(indicator.id || crypto.randomUUID()),
      name: String(indicator.name || '').trim(),
      weight: Math.min(100, Math.max(0, Number(indicator.weight) || 0)),
      standard: String(indicator.standard || '').trim(),
      ...(indicator.autoSource ? { autoSource: indicator.autoSource } : {}),
    })).filter((indicator) => indicator.name && indicator.weight > 0) : [];
    return { name: String(dimension.name || '').trim(), weight: indicators.reduce((sum, indicator) => sum + indicator.weight, 0), indicators };
  }).filter((dimension) => dimension.name && dimension.indicators.length);
  if (!dimensions.length) return null;
  const penaltyMax = Number(template.penaltyMax);
  const bonusMax = Number(template.bonusMax);
  return {
    id: String(template.id || `custom-${crypto.randomUUID()}`),
    name: String(template.name).trim(),
    role: String(template.role || '自定义岗位').trim() || '自定义岗位',
    description: String(template.description || '').trim(),
    builtIn: false,
    penaltyMax: Number.isFinite(penaltyMax) ? Math.min(100, Math.max(0, penaltyMax)) : 100,
    bonusMax: Number.isFinite(bonusMax) ? Math.min(100, Math.max(0, bonusMax)) : 10,
    dimensions,
  };
}
let customAssessmentTemplates = (parseStoredJson(ASSESSMENT_TEMPLATE_KEY, []) || []).map(normalizeAssessmentTemplate).filter(Boolean);
let deletedBuiltinTemplateIds = (parseStoredJson(ASSESSMENT_TEMPLATE_DELETED_KEY, []) || []).filter((id) => BUILTIN_ASSESSMENT_TEMPLATES.some((template) => template.id === id));
function buildAssessmentTemplates() {
  const customIds = new Set(customAssessmentTemplates.map((template) => template.id));
  const deletedIds = new Set(deletedBuiltinTemplateIds);
  return [...BUILTIN_ASSESSMENT_TEMPLATES.filter((template) => !customIds.has(template.id) && !deletedIds.has(template.id)), ...customAssessmentTemplates];
}
let ASSESSMENT_TEMPLATES = buildAssessmentTemplates();
function saveAssessmentTemplateLibrary() {
  localStorage.setItem(ASSESSMENT_TEMPLATE_KEY, JSON.stringify(customAssessmentTemplates));
  localStorage.setItem(ASSESSMENT_TEMPLATE_DELETED_KEY, JSON.stringify(deletedBuiltinTemplateIds));
  ASSESSMENT_TEMPLATES = buildAssessmentTemplates();
}
const assessmentTemplate = (id) => ASSESSMENT_TEMPLATES.find((template) => template.id === id) || ASSESSMENT_TEMPLATES[0];
const assessmentTemplateOptions = (selectedId) => ASSESSMENT_TEMPLATES.map((template) => `<option value="${template.id}" ${template.id === selectedId ? 'selected' : ''}>${esc(template.name)} · ${esc(template.role)}</option>`).join('');
const USER_PREFERENCE_KEYS = ['performance-selected-daily-task', 'performance-daily-view-mode', 'performance-daily-layout-preset', 'performance-daily-task-file-open', 'performance-daily-row-heights', 'performance-daily-row-sizes', 'performance-daily-panel-layout', 'performance-tomorrow-panel-visible-v1', 'performance-demo-seeded-v2', 'performance-daily-workspace-mode'];
const makeUserRecord = (profile = {}) => ({
  id: crypto.randomUUID(),
  name: String(profile.name || '').trim() || '默认用户',
  department: String(profile.department || '').trim(),
  position: String(profile.position || '').trim(),
  manager: String(profile.manager || '').trim(),
  assessmentTemplateId: assessmentTemplate(profile.assessmentTemplateId).id,
  createdAt: new Date().toISOString(),
});
function loadUserDirectory() {
  const stored = parseStoredJson(USER_DIRECTORY_KEY, []);
  const validUsers = Array.isArray(stored) ? stored.filter((user) => user?.id && user?.name).map((user) => ({ ...user, id: String(user.id), name: String(user.name), assessmentTemplateId: assessmentTemplate(user.assessmentTemplateId).id })) : [];
  if (validUsers.length) {
    const storedActiveId = localStorage.getItem(ACTIVE_USER_KEY);
    return { users: validUsers, activeUserId: validUsers.some((user) => user.id === storedActiveId) ? storedActiveId : validUsers[0].id };
  }
  const legacyState = normalizeState(parseStoredJson(LEGACY_STORAGE_KEY));
  const user = makeUserRecord(legacyState.profile);
  localStorage.setItem(USER_DIRECTORY_KEY, JSON.stringify([user]));
  localStorage.setItem(ACTIVE_USER_KEY, user.id);
  localStorage.setItem(`${USER_STATE_PREFIX}:${user.id}`, JSON.stringify(legacyState));
  USER_PREFERENCE_KEYS.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) localStorage.setItem(`${key}:${user.id}`, value);
  });
  return { users: [user], activeUserId: user.id };
}
const initialUserDirectory = loadUserDirectory();
let users = initialUserDirectory.users;
let activeUserId = initialUserDirectory.activeUserId;
const userStateKey = (userId = activeUserId) => `${USER_STATE_PREFIX}:${userId}`;
const userPreferenceKey = (key, userId = activeUserId) => `${key}:${userId}`;
const saveUserDirectory = () => {
  localStorage.setItem(USER_DIRECTORY_KEY, JSON.stringify(users));
  localStorage.setItem(ACTIVE_USER_KEY, activeUserId);
};
saveUserDirectory();
const activeUser = () => users.find((user) => user.id === activeUserId) || users[0];
let state = normalizeState(parseStoredJson(userStateKey()));
let activeTab = 'daily';
let currentMonth = new Date().getMonth() + 1;
let selectedDate = '';
let selectedDailyDate = dateToISO(new Date());
let selectedDailyTaskId = localStorage.getItem(userPreferenceKey('performance-selected-daily-task')) || '';
let editingTaskId = null;
let editingSubtasks = [];
let editingUserId = null;
let editingAssessmentTemplateId = null;
let editingTemplateDimensions = [];
let userMenuOpen = false;
let taskFilters = { search: '', planType: '', status: '' };
let summaryFilters = { search: '', source: '', status: '' };
let selectedWorkspaceView = 'performance';
let editingSummaryItem = null;
let draggedSortableBlock = null;
let pointerDailyPanelDrag = null;
let resizingDailyPanel = null;
let resizingKanbanCol = null;
let dailyTodayViewMode = localStorage.getItem(userPreferenceKey('performance-daily-view-mode')) === 'board' ? 'board' : 'list';
let dailyWorkspaceMode = localStorage.getItem(userPreferenceKey('performance-daily-workspace-mode')) === 'work' ? 'work' : 'plan';
function readTaskSplitRatio() {
  const value = parseFloat(localStorage.getItem(userPreferenceKey('performance-daily-task-split')));
  return Number.isFinite(value) && value >= 0.15 && value <= 0.7 ? value : 0.36;
}
let dailyTaskSplitRatio = readTaskSplitRatio();
const saveTaskSplitRatio = () => localStorage.setItem(userPreferenceKey('performance-daily-task-split'), String(dailyTaskSplitRatio));
function getKanbanWidths() {
  const stored = parseStoredJson(userPreferenceKey('performance-kanban-widths'), null);
  if (Array.isArray(stored) && stored.length === 3 && stored.every((w) => Number.isFinite(w) && w > 0)) {
    const sum = stored.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) < 0.1) return stored;
  }
  return [20, 20, 60];
}
function saveKanbanWidths(widths) {
  localStorage.setItem(userPreferenceKey('performance-kanban-widths'), JSON.stringify(widths));
}
let resizingTaskSplit = null;
const DAILY_PANEL_KEYS = ['today', 'handoff', 'tomorrow', 'weekly', 'monthly'];
const DAILY_GRID_UNITS = 1000;
const DAILY_PANEL_HARD_MIN_PX = 240;
const DAILY_PANEL_WRAP_PX = 230;
const DAILY_PANEL_DEFAULTS = { today: { order: 0, span: 500, frozen: false }, handoff: { order: 1, span: 500, frozen: false }, tomorrow: { order: 2, span: 500, frozen: false }, weekly: { order: 3, span: 500, frozen: false }, monthly: { order: 4, span: 500, frozen: false } };
const DAILY_LAYOUT_PRESETS = { split: { label: '上 2 下 3', rows: [2, 3] }, stacked: { label: '上 1 中 1 下 3', rows: [1, 1, 3] } };
const DAILY_VISIBLE_PANEL_KEYS = ['today', 'handoff', 'tomorrow', 'weekly', 'monthly'];
const activeDailyPanelKeys = () => (dailyWorkspaceMode === 'work' ? ['today'] : DAILY_VISIBLE_PANEL_KEYS);
let dailyLayoutPreset = DAILY_LAYOUT_PRESETS[localStorage.getItem(userPreferenceKey('performance-daily-layout-preset'))] ? localStorage.getItem(userPreferenceKey('performance-daily-layout-preset')) : 'stacked';
let dailyTaskFileOpen = localStorage.getItem(userPreferenceKey('performance-daily-task-file-open')) === null ? false : localStorage.getItem(userPreferenceKey('performance-daily-task-file-open')) === '1';
let dailyLayoutPresetBeforeFileExpand = null;
let dailyRowHeights = parseStoredJson(userPreferenceKey('performance-daily-row-heights'), {});
let dailyLayoutRowSizes = parseStoredJson(userPreferenceKey('performance-daily-row-sizes'), {});
let resizingDailyRow = null;
function normalizedStoredSpan(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  const migrated = numeric <= 12 ? Math.round(numeric / 12 * DAILY_GRID_UNITS) : Math.round(numeric);
  return Math.min(DAILY_GRID_UNITS, Math.max(1, migrated));
}
function loadDailyPanelLayout() {
  try {
    const stored = JSON.parse(localStorage.getItem(userPreferenceKey('performance-daily-panel-layout')) || '{}');
    return Object.fromEntries(DAILY_PANEL_KEYS.map((key) => [key, { order: Number.isFinite(Number(stored[key]?.order)) ? Number(stored[key].order) : DAILY_PANEL_DEFAULTS[key].order, span: normalizedStoredSpan(stored[key]?.span, DAILY_PANEL_DEFAULTS[key].span), frozen: Boolean(stored[key]?.frozen) }]));
  } catch { return structuredClone(DAILY_PANEL_DEFAULTS); }
}
let dailyPanelLayout = loadDailyPanelLayout();
function migrateTomorrowPanelVisibility() {
  if (localStorage.getItem(userPreferenceKey('performance-tomorrow-panel-visible-v1')) !== '1') {
    const ordered = DAILY_VISIBLE_PANEL_KEYS.filter((key) => key !== 'tomorrow').sort((a, b) => dailyPanelLayout[a].order - dailyPanelLayout[b].order);
    const handoffIndex = ordered.indexOf('handoff');
    ordered.splice(handoffIndex >= 0 ? handoffIndex + 1 : Math.min(2, ordered.length), 0, 'tomorrow');
    ordered.forEach((key, index) => { dailyPanelLayout[key].order = index; });
    localStorage.setItem(userPreferenceKey('performance-tomorrow-panel-visible-v1'), '1');
  }
}
migrateTomorrowPanelVisibility();
const saveDailyPanelLayout = () => localStorage.setItem(userPreferenceKey('performance-daily-panel-layout'), JSON.stringify(dailyPanelLayout));
const saveDailyRowHeights = () => localStorage.setItem(userPreferenceKey('performance-daily-row-heights'), JSON.stringify(dailyRowHeights));
const saveDailyLayoutRowSizes = () => localStorage.setItem(userPreferenceKey('performance-daily-row-sizes'), JSON.stringify(dailyLayoutRowSizes));
function currentDailyRowSizes() {
  if (dailyWorkspaceMode === 'plan') return dailyTaskFileOpen ? [1, 1, 3] : [2, 3];
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
  const ordered = activeDailyPanelKeys().slice().sort((a, b) => dailyPanelLayout[a].order - dailyPanelLayout[b].order);
  if (dailyWorkspaceMode === 'work') return [ordered];
  const rows = [];
  let index = 0;
  for (const size of currentDailyRowSizes()) rows.push(ordered.slice(index, index += size));
  return rows;
}
function dailyPanelGeometry(key) {
  if (dailyWorkspaceMode === 'work') return { row: 1, col: 1, span: DAILY_GRID_UNITS, rowKeys: [key] };
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
function switchDailyLayoutPreset(preset) {
  if (!DAILY_LAYOUT_PRESETS[preset]) return;
  dailyLayoutPreset = preset;
  localStorage.setItem(userPreferenceKey('performance-daily-layout-preset'), preset);
  dailyLayoutRowSizes[preset] = [...DAILY_LAYOUT_PRESETS[preset].rows];
  saveDailyLayoutRowSizes();
  for (const row of dailyPanelRows()) {
    const base = Math.floor(DAILY_GRID_UNITS / row.length);
    let remainder = DAILY_GRID_UNITS - base * row.length;
    row.forEach((key) => { dailyPanelLayout[key].span = base + (remainder > 0 ? 1 : 0); remainder -= 1; });
  }
  saveDailyPanelLayout();
}

function setDailyTaskFileOpen(open) {
  dailyTaskFileOpen = open;
  localStorage.setItem(userPreferenceKey('performance-daily-task-file-open'), open ? '1' : '0');
  if (dailyWorkspaceMode === 'plan') { normalizeDailyRowSpans(); return; }
  if (open) {
    if (dailyLayoutPreset !== 'stacked') {
      dailyLayoutPresetBeforeFileExpand = dailyLayoutPreset;
      switchDailyLayoutPreset('stacked');
    }
  } else if (dailyLayoutPresetBeforeFileExpand && DAILY_LAYOUT_PRESETS[dailyLayoutPresetBeforeFileExpand]) {
    const restorePreset = dailyLayoutPresetBeforeFileExpand;
    dailyLayoutPresetBeforeFileExpand = null;
    switchDailyLayoutPreset(restorePreset);
  }
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
// ===== 侧边栏导航按钮拖动排序 =====
const NAV_ORDER_KEY = 'performance-nav-order';
let draggedNavItem = null;
function navTabsFromDom() {
  return Array.from(document.querySelectorAll('.nav-list .nav-item[data-tab]')).map((button) => button.dataset.tab);
}
function loadNavOrder() {
  const stored = parseStoredJson(NAV_ORDER_KEY, null);
  const current = navTabsFromDom();
  if (Array.isArray(stored) && stored.length) {
    const valid = stored.filter((tab) => current.includes(tab));
    const missing = current.filter((tab) => !valid.includes(tab));
    return [...valid, ...missing];
  }
  return current;
}
function applyNavOrder() {
  const list = document.querySelector('.nav-list');
  if (!list) return;
  const order = loadNavOrder();
  const byTab = {};
  list.querySelectorAll('.nav-item[data-tab]').forEach((button) => { byTab[button.dataset.tab] = button; });
  order.forEach((tab) => { const button = byTab[tab]; if (button) list.appendChild(button); });
}
function saveNavOrder() {
  localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(navTabsFromDom()));
}
const expandedTaskIds = new Set();
const expandedPoolIds = new Set();
let chatTab = 'messages';
let mentionState = { open: false, editor: null, query: '', startOffset: 0 };
let promptResolve = null;
let confirmResolve = null;
let selectedPlanDate = dateToISO(new Date());
let docSelection = { kind: 'doc', id: '' };
const docExpanded = new Set([TASKS_GROUP_ID]);
let selectedProjectId = '';
let projectCenterFilter = 'all';
let projectViewMode = localStorage.getItem('performance-projects-view-mode') === 'board' ? 'board' : 'list';
let projectSearch = '';
let selectedProjectTaskId = '';
let activeProjectTab = '概览';
let projectTaskStatusFilter = '';
let projectTaskView = 'tree';
const collapsedMilestones = new Set();
const collapsedTasks = new Set();
let sopViewOpen = false;
let editingSopTemplateId = null;
let editingSopNodes = [];
let editingProjectId = null;
let editingMilestoneProjectId = '';
let editingMilestoneId = null;
let editingProjectTaskProjectId = '';
let editingProjectTaskMilestoneId = '';
let editingProjectTaskId = null;
let syncPoolSelected = new Set(['today']);
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const num = (value, digits = 1) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits);
const pct = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`;
const PERCENT_FIELDS = ['completionPct', 'collaborationPct', 'innovation', 'selfScore', 'reviewerScore'];
const formNumber = (key, value) => value === '' ? '' : PERCENT_FIELDS.includes(key) ? Math.min(100, Math.max(0, Number(value) || 0)) : Math.max(0, Number(value) || 0);
const save = () => {
  localStorage.setItem(userStateKey(), JSON.stringify(state));
  const user = activeUser();
  if (!user) return;
  const profileName = String(state.profile.name || '').trim();
  if (profileName) user.name = profileName;
  user.department = String(state.profile.department || '').trim();
  user.position = String(state.profile.position || '').trim();
  user.manager = String(state.profile.manager || '').trim();
  saveUserDirectory();
};
const toast = (message) => { const node = $('#toast'); node.textContent = message; node.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('show'), 2600); };
const currentYear = () => Number(state.profile.year) || new Date().getFullYear();
const selectedMonthKey = () => monthKey(currentYear(), currentMonth);
const taskForId = (id) => state.tasks.find((task) => task.id === id);
const inputValue = (value) => esc(value ?? '');

function renderUserSwitcher() {
  const root = $('#user-switcher');
  if (!root) return;
  const current = activeUser();
  const name = current?.name || '默认用户';
  root.innerHTML = `<div class="user-switcher"><button type="button" class="user-switcher-button" data-action="toggle-user-menu" aria-haspopup="menu" aria-expanded="${userMenuOpen}"><span class="user-avatar">${esc(name.slice(0, 1).toUpperCase())}</span><span class="user-switcher-copy"><small>当前用户</small><strong>${esc(name)}</strong></span><span class="user-switcher-chevron">⌄</span></button>${userMenuOpen ? `<div class="user-menu" role="menu"><div class="user-menu-title">切换工作空间</div><div class="user-menu-list">${users.map((user) => `<div class="user-menu-row ${user.id === activeUserId ? 'active' : ''}"><button type="button" class="user-menu-select" data-action="switch-user" data-user-id="${esc(user.id)}"><span class="user-avatar small">${esc(user.name.slice(0, 1).toUpperCase())}</span><span><strong>${esc(user.name)}</strong><small>${esc(assessmentTemplate(user.assessmentTemplateId).name)} · ${esc([user.department, user.position].filter(Boolean).join(' · ') || '独立工作空间')}</small></span>${user.id === activeUserId ? '<span class="user-current-mark">✓</span>' : ''}</button><button type="button" class="user-menu-edit" data-action="edit-user" data-user-id="${esc(user.id)}">编辑</button></div>`).join('')}</div><button type="button" class="user-menu-add" data-action="add-user"><span>＋</span> 新建用户</button></div>` : ''}</div>`;
}

function openUserDialog(userId = '') {
  editingUserId = userId || null;
  const user = users.find((entry) => entry.id === userId);
  const userState = user ? normalizeState(parseStoredJson(userStateKey(user.id))) : normalizeState(DEFAULT_STATE);
  const profile = userState.profile;
  $('#user-dialog-title').textContent = user ? '编辑用户' : '新建用户';
  const templateId = assessmentTemplate(user?.assessmentTemplateId).id;
  $('#user-form-fields').innerHTML = `<label class="form-field full"><span class="label">姓名 *</span><input class="input" name="name" required maxlength="30" value="${inputValue(user?.name || profile.name)}" placeholder="输入姓名"></label><label class="form-field"><span class="label">部门</span><input class="input" name="department" maxlength="40" value="${inputValue(user?.department || profile.department)}" placeholder="例如：产品研发部"></label><label class="form-field"><span class="label">岗位</span><input class="input" name="position" maxlength="40" value="${inputValue(user?.position || profile.position)}" placeholder="例如：前端工程师"></label><label class="form-field"><span class="label">直属负责人</span><input class="input" name="manager" maxlength="30" value="${inputValue(user?.manager || profile.manager)}" placeholder="负责人姓名"></label><label class="form-field full"><span class="label">绩效考核模板</span><select class="select" name="assessmentTemplateId">${assessmentTemplateOptions(templateId)}</select><span class="helper">分配后，该用户的月度绩效页会自动使用对应考核制度。</span></label>${user && users.length > 1 ? `<div class="form-field full user-delete-zone"><span><strong>删除用户</strong><small>该用户的任务、计划和布局数据会从本机删除。</small></span><button type="button" class="button danger" data-action="delete-user" data-user-id="${esc(user.id)}">删除</button></div>` : ''}`;
  userMenuOpen = false;
  renderUserSwitcher();
  $('#user-dialog').showModal();
  $('#user-form [name="name"]')?.focus();
}

function closeUserDialog() {
  editingUserId = null;
  $('#user-dialog').close();
}

function loadActiveUserWorkspace(userId) {
  if (!users.some((user) => user.id === userId)) return false;
  activeUserId = userId;
  saveUserDirectory();
  state = normalizeState(parseStoredJson(userStateKey()));
  selectedDailyTaskId = localStorage.getItem(userPreferenceKey('performance-selected-daily-task')) || '';
  dailyTodayViewMode = localStorage.getItem(userPreferenceKey('performance-daily-view-mode')) === 'board' ? 'board' : 'list';
  dailyWorkspaceMode = localStorage.getItem(userPreferenceKey('performance-daily-workspace-mode')) === 'work' ? 'work' : 'plan';
  dailyTaskSplitRatio = readTaskSplitRatio();
  const storedPreset = localStorage.getItem(userPreferenceKey('performance-daily-layout-preset'));
  dailyLayoutPreset = DAILY_LAYOUT_PRESETS[storedPreset] ? storedPreset : 'stacked';
  const storedFileOpen = localStorage.getItem(userPreferenceKey('performance-daily-task-file-open'));
  dailyTaskFileOpen = storedFileOpen === null ? false : storedFileOpen === '1';
  dailyRowHeights = parseStoredJson(userPreferenceKey('performance-daily-row-heights'), {});
  dailyLayoutRowSizes = parseStoredJson(userPreferenceKey('performance-daily-row-sizes'), {});
  dailyPanelLayout = loadDailyPanelLayout();
  migrateTomorrowPanelVisibility();
  normalizeDailyRowSpans();
  selectedDate = '';
  selectedDailyDate = dateToISO(new Date());
  selectedDailyTaskId = state.tasks.some((task) => task.id === selectedDailyTaskId) ? selectedDailyTaskId : '';
  selectedWorkspaceView = 'performance';
  summaryFilters = { search: '', source: '', status: '' };
  expandedTaskIds.clear();
  expandedPoolIds.clear();
  userMenuOpen = false;
  dailyLayoutPresetBeforeFileExpand = null;
  migrateDailyPlansToTasks();
  render();
  return true;
}

function switchUser(userId) {
  if (userId === activeUserId) { userMenuOpen = false; renderUserSwitcher(); return; }
  save();
  if (loadActiveUserWorkspace(userId)) toast(`已切换到 ${activeUser()?.name || '用户'} 的工作空间`);
}

function saveUserFromDialog() {
  const data = Object.fromEntries(new FormData($('#user-form')).entries());
  const name = String(data.name || '').trim();
  if (!name) return toast('请输入用户姓名');
  if (users.some((user) => user.id !== editingUserId && user.name.trim().toLowerCase() === name.toLowerCase())) return toast('已存在同名用户');
  const profile = { name, department: String(data.department || '').trim(), position: String(data.position || '').trim(), manager: String(data.manager || '').trim() };
  const assessmentTemplateId = assessmentTemplate(data.assessmentTemplateId).id;
  if (editingUserId) {
    const user = users.find((entry) => entry.id === editingUserId);
    if (!user) return;
    Object.assign(user, profile, { assessmentTemplateId });
    const targetState = editingUserId === activeUserId ? state : normalizeState(parseStoredJson(userStateKey(editingUserId)));
    Object.assign(targetState.profile, profile);
    localStorage.setItem(userStateKey(editingUserId), JSON.stringify(targetState));
    if (editingUserId === activeUserId) state = targetState;
    saveUserDirectory();
    closeUserDialog();
    render();
    toast('用户信息已更新');
    return;
  }
  const user = makeUserRecord({ ...profile, assessmentTemplateId });
  Object.assign(user, profile);
  users.push(user);
  const newState = normalizeState({ profile: { ...profile, year: currentYear() } });
  localStorage.setItem(userStateKey(user.id), JSON.stringify(newState));
  localStorage.setItem(userPreferenceKey('performance-demo-seeded-v2', user.id), '1');
  saveUserDirectory();
  closeUserDialog();
  loadActiveUserWorkspace(user.id);
  toast(`已创建 ${name} 的独立工作空间`);
}

function deleteUser(userId) {
  if (users.length <= 1) return toast('至少保留一个用户');
  const user = users.find((entry) => entry.id === userId);
  if (!user) return;
  openConfirmDialog('删除用户', `确认删除“${user.name}”及其全部本地工作数据？`, () => {
    users = users.filter((entry) => entry.id !== userId);
    localStorage.removeItem(userStateKey(userId));
    USER_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(userPreferenceKey(key, userId)));
    const wasActive = userId === activeUserId;
    if (wasActive) activeUserId = users[0].id;
    saveUserDirectory();
    closeUserDialog();
    if (wasActive) loadActiveUserWorkspace(activeUserId); else render();
    toast('用户及其本地数据已删除');
  });
}

function setActiveTab(tab) {
  if (tab === 'tasks') { tab = 'summary'; selectedWorkspaceView = 'performance'; }
  activeTab = tab;
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${tab}`));
  render();
}

function renderDailyModeSwitch() {
  return `<div class="daily-mode-switch" role="tablist" aria-label="工作台模式"><button type="button" class="daily-mode-btn ${dailyWorkspaceMode === 'plan' ? 'active' : ''}" data-action="daily-workspace-mode" data-mode="plan" role="tab" aria-selected="${dailyWorkspaceMode === 'plan'}"><i class="ri-layout-grid-line"></i> 计划模式</button><button type="button" class="daily-mode-btn ${dailyWorkspaceMode === 'work' ? 'active' : ''}" data-action="daily-workspace-mode" data-mode="work" role="tab" aria-selected="${dailyWorkspaceMode === 'work'}"><i class="ri-focus-2-line"></i> 工作模式</button></div>`;
}

function renderDailyStats() {
  const date = selectedDailyDate;
  const yesterday = shiftDate(date, -1);
  const plan = state.dailyPlans[date] || { today: [], tomorrow: [] };
  const todayTasks = state.tasks.filter((task) => task.date === date);
  const finishedToday = (plan.today || []).filter((item) => linkDoneState(item)).length + todayTasks.filter((task) => Number(task.completionPct) >= 100).length;
  const todayTotal = (plan.today || []).length + todayTasks.length;
  const yesterdayPlan = state.dailyPlans[yesterday] || { today: [], tomorrow: [] };
  const inherited = [
    ...(yesterdayPlan.tomorrow || []).filter((item) => item.text?.trim()).map((item) => ({ ...item, source: 'daily', sourceDate: yesterday })),
    ...state.tasks.filter((task) => task.date === yesterday && task.nextPlan?.trim()).map((task) => ({ id: task.id, text: task.nextPlan, done: false, source: 'task', sourceDate: yesterday })),
  ];
  const weeklyKey = weekKey(date);
  const weeklyPlan = state.plans.weekly?.[weeklyKey] || { title: '', notes: '', items: [] };

  return `<div class="daily-stat-card">
    <div class="daily-stat-icon daily-stat-icon--progress"><i class="ri-checkbox-circle-line"></i></div>
    <div class="daily-stat-body"><span>今日进度</span><strong>${finishedToday} / ${todayTotal}</strong></div>
  </div>
  <div class="daily-stat-card">
    <div class="daily-stat-icon daily-stat-icon--carry"><i class="ri-arrow-down-circle-line"></i></div>
    <div class="daily-stat-body"><span>昨日带入</span><strong>${inherited.length}</strong></div>
  </div>
  <div class="daily-stat-card">
    <div class="daily-stat-icon daily-stat-icon--weekly"><i class="ri-calendar-check-line"></i></div>
    <div class="daily-stat-body"><span>本周计划</span><strong>${(weeklyPlan.items || []).length}</strong></div>
  </div>
  <div class="daily-stat-date-block">
    <div class="daily-date-prev">${shiftDate(date, -3).slice(5)} — ${yesterday.slice(5)} <span class="daily-date-label">昨日</span></div>
    <div class="daily-date-today">${date.slice(5)} <span class="daily-date-today-label">今日</span></div>
  </div>`;
}

function updateChatNavBadge() {
  const nav = document.querySelector('.nav-item[data-tab="chat"]');
  if (!nav) return;
  const current = activeUser();
  const allMessages = loadAllMessages();
  const unreadNotif = (state.notifications || []).filter((n) => !n.read).length;
  const unreadMsgs = allMessages.filter((m) => m.toUserId === current?.id && !m.read).length;
  const total = unreadNotif + unreadMsgs;
  const badge = nav.querySelector('.nav-badge');
  if (total > 0) {
    const text = total > 99 ? '99+' : String(total);
    if (badge) badge.textContent = text;
    else nav.insertAdjacentHTML('beforeend', `<span class="nav-badge">${text}</span>`);
  } else if (badge) badge.remove();
}

function render() {
  renderUserSwitcher();
  updateChatNavBadge();
  const modeSwitch = document.getElementById('topbar-mode-switch');
  if (modeSwitch) modeSwitch.innerHTML = renderDailyModeSwitch();
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    if ((activeTab === 'daily' && dailyWorkspaceMode === 'work') || activeTab === 'documents' || activeTab === 'projects') {
      mainContent.style.padding = '0';
      mainContent.style.background = '#ffffff';
    } else {
      mainContent.style.padding = '';
      mainContent.style.background = '';
    }
  }
  const dailyStatsEl = document.getElementById('topbar-daily-stats');
  if (dailyStatsEl) {
    if (activeTab === 'daily') {
      dailyStatsEl.innerHTML = renderDailyStats();
      dailyStatsEl.style.display = '';
    } else {
      dailyStatsEl.innerHTML = '';
      dailyStatsEl.style.display = 'none';
    }
  }
  const topbarDate = document.getElementById('topbar-date-input');
  if (topbarDate) topbarDate.value = selectedDailyDate;
  $('#view-daily').innerHTML = renderDailyWorkspace();
  syncDailyPanelLockState();
  $('#view-overview').innerHTML = renderOverview();
  $('#view-summary').innerHTML = renderPerformancePanorama();
  $('#view-acceptance').innerHTML = renderAcceptance();
  $('#view-monthly').innerHTML = renderMonthly();
  $('#view-params').innerHTML = renderParams();
  $('#view-params .page-head')?.insertAdjacentHTML('afterend', renderTemplateLibrary());
  $('#view-settings').innerHTML = renderSystemSettings();
  $('#view-documents').innerHTML = renderDocuments();
  $('#view-projects').innerHTML = sopViewOpen
    ? renderSopTemplateLibrary(state, { currentUser: activeUser()?.name })
    : renderProjects(state, { selectedId: selectedProjectId, filter: projectCenterFilter, viewMode: projectViewMode, search: projectSearch, currentUser: activeUser()?.name, collapsedMilestones, collapsedTasks, selectedProjectTaskId, activeProjectTab, taskStatusFilter: projectTaskStatusFilter, taskView: projectTaskView });
  if (selectedProjectId && selectedProjectTaskId) {
    const project = projectForId(state, selectedProjectId);
    if (project) $('#view-projects').insertAdjacentHTML('beforeend', renderProjectTaskDrawer(state, project, selectedProjectTaskId, activeUser()?.name));
  }
  $('#view-chat').innerHTML = renderChatView();
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
  return `<div class="profile-strip card">${fields.map(([key, label]) => `<div class="profile-cell"><small>${label}</small><div class="profile-edit"><input class="input" data-profile="${key}" value="${inputValue(state.profile[key])}" placeholder="未填写"></div></div>`).join('')}<div class="profile-cell"><small>考核模板</small><select class="select" data-user-template>${assessmentTemplateOptions(activeUser()?.assessmentTemplateId)}</select></div><div class="profile-cell"><small>考核年度</small><input class="input" data-profile="year" type="number" min="2000" max="2100" value="${currentYear()}"></div></div>`;
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

const BUILTIN_TASK_PROPERTIES = [
  { key: 'content', label: '标题', icon: '≡', type: 'text', wide: true },
  { key: 'date', label: '日期', icon: '◷', type: 'date' },
  { key: 'category', label: '分类', icon: '≡', type: 'select', options: () => state.settings.taskCategories || TASK_CATEGORIES },
  { key: 'planType', label: '计划类型', icon: '≡', type: 'select', options: () => PLAN_TYPES },
  { key: 'collaborator', label: '协作人', icon: '人', type: 'text' },
  { key: 'estimatedHours', label: '预计工时', icon: '↔', type: 'number', step: '0.1', min: '0' },
  { key: 'actualHours', label: '实际工时', icon: '↔', type: 'number', step: '0.1', min: '0' },
  { key: 'completionPct', label: '交付完成', icon: '%', type: 'number', min: '0', max: '100' },
  { key: 'collaborationPct', label: '协作完成', icon: '%', type: 'number', min: '0', max: '100' },
  { key: 'innovation', label: '创新分', icon: '自', type: 'number', min: '0', max: '100' },
  { key: 'selfScore', label: '自评分', icon: '自', type: 'number', min: '0', max: '100' },
  { key: 'reviewerScore', label: '负责人评分', icon: '审', type: 'number', min: '0', max: '100' },
  { key: 'blocker', label: '阻塞问题 / 备注', icon: '注', type: 'textarea', wide: true },
  { key: 'breakthrough', label: '重大突破创新', icon: '创', type: 'textarea', wide: true },
];

function getDefaultPropertyVisibility() {
  const base = { content: true, date: true, category: true, planType: true, collaborator: false, estimatedHours: true, actualHours: true, completionPct: true, collaborationPct: false, innovation: false, selfScore: true, reviewerScore: true, blocker: true, breakthrough: true };
  const configs = state.settings.fieldConfigs;
  if (!Array.isArray(configs)) return base;
  for (const cfg of configs) {
    if (cfg.scope !== 'pool' && Object.prototype.hasOwnProperty.call(base, cfg.key)) {
      base[cfg.key] = cfg.visible !== false;
    }
  }
  return base;
}

function getTaskPropertyVisibility(task) {
  if (!task || typeof task !== 'object') return getDefaultPropertyVisibility();
  if (!task.propertyVisibility) task.propertyVisibility = getDefaultPropertyVisibility();
  return task.propertyVisibility;
}

function getTaskCustomProperties(task) {
  if (!task || typeof task !== 'object') return [];
  if (!Array.isArray(task.customProperties)) task.customProperties = [];
  return task.customProperties;
}

function makeTaskRecord(content, date, extra = {}) {
  const fc = (key, fallback) => { const configs = state.settings.fieldConfigs; const cfg = Array.isArray(configs) ? configs.find((c) => c.key === key) : null; return cfg && cfg.defaultValue !== '' && cfg.defaultValue !== undefined ? cfg.defaultValue : fallback; };
  return { id: crypto.randomUUID(), date, content, body: '', category: fc('category', state.settings.taskCategories[0] || '其他'), planType: fc('planType', '单人工作'), collaborator: fc('collaborator', ''), estimatedHours: '', actualHours: '', completionPct: 0, collaborationPct: 0, innovation: '', selfScore: '', reviewerScore: '', nextPlan: '', blocker: '', breakthrough: '', subtasks: [], propertiesExpanded: true, propertyVisibility: getDefaultPropertyVisibility(), customProperties: [], ...extra };
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
  const demoKey = userPreferenceKey('performance-demo-seeded-v2');
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
  if (!Array.isArray(state.projects)) state.projects = [];
  const projectSamples = [
    { id: 'demo-project-rebuild', name: '季度销售系统重构', description: '重构销售系统的核心流程，提升数据准确性与响应速度。', category: '需求开发', priority: '高', status: 'doing', owner: '', startDate: shiftDate(today, -7), dueDate: shiftDate(today, 21), taskIds: ['demo-task-review', 'demo-task-mobile'], order: 10 },
    { id: 'demo-project-guide', name: '新成员上手指南', description: '整理环境配置、常见问题与最佳实践，帮助新成员快速上手。', category: '文档撰写', priority: '普通', status: 'todo', owner: '', startDate: today, dueDate: shiftDate(today, 14), taskIds: ['demo-task-report'], order: 20 },
  ];
  for (const sample of projectSamples) if (!state.projects.some((project) => project.id === sample.id)) state.projects.push(sample);
  save();
  localStorage.setItem(demoKey, '1');
}

function seedSopDemoTemplates() {
  const key = userPreferenceKey('performance-sop-seeded-v1');
  if (localStorage.getItem(key) === '1') return;
  if (!Array.isArray(state.sopTemplates)) state.sopTemplates = [];
  const samples = [
    {
      id: 'demo-sop-version-release',
      name: '版本发布标准流程',
      scene: '软件版本迭代与发布',
      defaultOwnerRole: '研发负责人',
      defaultReviewerRole: '质量负责人',
      standardDuration: '7',
      order: 10,
      nodes: [
        { id: 'demo-sop-ver-n1', input: '产品需求文档 + 迭代范围', action: '需求评审与拆分', output: '评审结论与任务拆分表', acceptance: '需求范围明确、无遗漏', next: '编码开发', order: 10 },
        { id: 'demo-sop-ver-n2', input: '任务拆分表', action: '编码与单元测试', output: '可运行代码', acceptance: '单元测试通过率 100%', next: '集成测试', order: 20 },
        { id: 'demo-sop-ver-n3', input: '可运行代码', action: '集成测试与回归', output: '测试报告', acceptance: '核心用例全通过', next: '发布上线', order: 30 },
        { id: 'demo-sop-ver-n4', input: '测试报告', action: '发布上线与监控', output: '线上发布记录', acceptance: '线上无重大故障', next: '复盘', order: 40 },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-sop-content-launch',
      name: '内容营销上线流程',
      scene: '新媒体内容策划与发布',
      defaultOwnerRole: '内容运营',
      defaultReviewerRole: '运营负责人',
      standardDuration: '5',
      order: 20,
      nodes: [
        { id: 'demo-sop-content-n1', input: '选题池与热点', action: '选题策划', output: '选题单', acceptance: '选题贴合品牌调性', next: '内容创作', order: 10 },
        { id: 'demo-sop-content-n2', input: '选题单', action: '内容创作与排版', output: '成稿', acceptance: '图文质量达标', next: '审核发布', order: 20 },
        { id: 'demo-sop-content-n3', input: '成稿', action: '审核与发布', output: '发布记录', acceptance: '无敏感内容、按时发布', next: '数据复盘', order: 30 },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
  for (const sample of samples) if (!state.sopTemplates.some((template) => template.id === sample.id)) state.sopTemplates.push(sample);
  save();
  localStorage.setItem(key, '1');
}

function seedDemoProjects() {
  const key = userPreferenceKey('performance-demo-projects-v1');
  if (localStorage.getItem(key) === '1') return;
  if (!Array.isArray(state.projects)) state.projects = [];
  const today = dateToISO(new Date());
  const d = (n) => shiftDate(today, n);
  const samples = [
    {
      id: 'demo-project-app-v3',
      name: '移动端 App 3.0 版本发布',
      description: '围绕体验重构与性能优化发布 3.0 大版本，覆盖需求、设计、开发、测试与灰度发布全流程。',
      category: '需求开发',
      stage: '开发执行',
      priority: '高',
      status: 'doing',
      riskOverride: '',
      owner: '张伟',
      startDate: d(-10),
      dueDate: d(20),
      taskIds: [],
      order: 10,
      milestones: [
        {
          id: 'demo-appv3-m1', name: '需求与设计', description: '完成需求评审、交互与视觉设计定稿，作为开发输入。', dueDate: d(-5), status: 'done', owner: '张伟', reviewer: '李娜', order: 10,
          tasks: [
            { id: 'demo-appv3-m1-t1', title: '产品需求评审', assignee: '张伟', reviewer: '李娜', dueDate: d(-9), status: 'done', priority: '高', workItemId: '', performanceTaskId: '', predecessors: [], requirement: '整理 3.0 需求池，组织跨职能评审并锁定范围。', acceptance: '需求范围与优先级评审通过，输出结论文档。', deliverables: [{ id: 'demo-appv3-m1-t1-d1', text: '需求评审结论文档', done: true }], comments: [{ id: 'demo-appv3-m1-t1-c1', text: '已完成评审，范围与优先级已锁定。', author: '张伟', createdAt: d(-9) }], blocked: false, blockedReason: '', acceptanceStatus: 'accepted', subtasks: [], order: 10 },
            { id: 'demo-appv3-m1-t2', title: '交互设计定稿', assignee: '李娜', reviewer: '张伟', dueDate: d(-7), status: 'done', priority: '高', workItemId: '', performanceTaskId: '', predecessors: ['demo-appv3-m1-t1'], requirement: '输出核心流程的交互原型并组织走查。', acceptance: '关键路径交互走查通过。', deliverables: [{ id: 'demo-appv3-m1-t2-d1', text: '交互原型稿', done: true }], comments: [], blocked: false, blockedReason: '', acceptanceStatus: 'accepted', subtasks: [], order: 20 },
            { id: 'demo-appv3-m1-t3', title: '视觉设计稿输出', assignee: '王强', reviewer: '李娜', dueDate: d(-5), status: 'done', priority: '普通', workItemId: '', performanceTaskId: '', predecessors: ['demo-appv3-m1-t2'], requirement: '基于交互稿输出高保真视觉稿与标注。', acceptance: '视觉稿通过评审并交付标注。', deliverables: [{ id: 'demo-appv3-m1-t3-d1', text: '高保真视觉稿', done: true }], comments: [], blocked: false, blockedReason: '', acceptanceStatus: 'accepted', subtasks: [], order: 30 },
          ],
        },
        {
          id: 'demo-appv3-m2', name: '开发实现', description: '核心功能开发、接口联调与性能优化。', dueDate: d(10), status: 'doing', owner: '王强', reviewer: '张伟', order: 20,
          tasks: [
            {
              id: 'demo-appv3-m2-t1', title: '核心功能开发', assignee: '王强', reviewer: '张伟', dueDate: d(8), status: 'doing', priority: '高', workItemId: '', performanceTaskId: '', predecessors: ['demo-appv3-m1-t3'], requirement: '按视觉稿实现首页、消息与个人中心三大模块。', acceptance: '三大模块功能可用且通过代码评审。', deliverables: [], comments: [{ id: 'demo-appv3-m2-t1-c1', text: '首页重构已完成，消息模块进行中。', author: '王强', createdAt: d(-2) }], blocked: false, blockedReason: '', acceptanceStatus: '', order: 10,
              subtasks: [
                { id: 'demo-appv3-m2-t1-s1', title: '首页信息流重构', assignee: '王强', reviewer: '张伟', dueDate: d(2), status: 'done', priority: '高', predecessors: [], deliverables: [], comments: [], blocked: false, subtasks: [], order: 10 },
                { id: 'demo-appv3-m2-t1-s2', title: '消息模块重构', assignee: '王强', reviewer: '张伟', dueDate: d(6), status: 'doing', priority: '高', predecessors: [], deliverables: [], comments: [], blocked: false, subtasks: [], order: 20 },
                { id: 'demo-appv3-m2-t1-s3', title: '个人中心改版', assignee: '王强', reviewer: '张伟', dueDate: d(8), status: 'todo', priority: '普通', predecessors: [], deliverables: [], comments: [], blocked: false, subtasks: [], order: 30 },
              ],
            },
            { id: 'demo-appv3-m2-t2', title: '接口联调', assignee: '赵敏', reviewer: '张伟', dueDate: d(3), status: 'doing', priority: '高', workItemId: '', performanceTaskId: '', predecessors: ['demo-appv3-m2-t1'], requirement: '与后端完成 3.0 新接口联调。', acceptance: '新接口全量联调通过。', deliverables: [], comments: [], blocked: true, blockedReason: '等待后端网关升级，预计后天恢复。', acceptanceStatus: '', subtasks: [], order: 20 },
            { id: 'demo-appv3-m2-t3', title: '性能优化', assignee: '王强', reviewer: '张伟', dueDate: d(10), status: 'todo', priority: '普通', workItemId: '', performanceTaskId: '', predecessors: [], requirement: '针对启动耗时与首屏渲染做专项优化。', acceptance: '启动耗时降低 30% 以上。', deliverables: [], comments: [], blocked: false, blockedReason: '', acceptanceStatus: '', subtasks: [], order: 30 },
          ],
        },
        {
          id: 'demo-appv3-m3', name: '测试与发布', description: '全量回归、灰度发布与线上监控。', dueDate: d(20), status: 'todo', owner: '赵敏', reviewer: '李娜', order: 30,
          tasks: [
            { id: 'demo-appv3-m3-t1', title: '全量回归测试', assignee: '赵敏', reviewer: '李娜', dueDate: d(16), status: 'todo', priority: '高', workItemId: '', performanceTaskId: '', predecessors: ['demo-appv3-m2-t2'], requirement: '覆盖全部核心用例执行回归。', acceptance: '核心用例全通过，无 P0/P1 缺陷。', deliverables: [], comments: [], blocked: false, blockedReason: '', acceptanceStatus: '', subtasks: [], order: 10 },
            { id: 'demo-appv3-m3-t2', title: '灰度发布与监控', assignee: '张伟', reviewer: '李娜', dueDate: d(20), status: 'todo', priority: '高', workItemId: '', performanceTaskId: '', predecessors: ['demo-appv3-m3-t1'], requirement: '按 5% 分批灰度并监控崩溃率。', acceptance: '灰度期间无重大故障，正式全量。', deliverables: [], comments: [], blocked: false, blockedReason: '', acceptanceStatus: '', subtasks: [], order: 20 },
          ],
        },
      ],
    },
    {
      id: 'demo-project-website',
      name: '企业官网改版',
      description: '重构企业官网的视觉风格与内容结构，提升品牌形象与线索转化。',
      category: '产品设计',
      stage: '视觉设计',
      priority: '普通',
      status: 'doing',
      riskOverride: '',
      owner: '李娜',
      startDate: d(-6),
      dueDate: d(14),
      taskIds: [],
      order: 20,
      milestones: [
        {
          id: 'demo-web-m1', name: '内容规划', description: '梳理站点结构与文案。', dueDate: d(-3), status: 'done', owner: '李娜', reviewer: '张伟', order: 10,
          tasks: [
            { id: 'demo-web-m1-t1', title: '站点信息架构梳理', assignee: '李娜', reviewer: '张伟', dueDate: d(-5), status: 'done', priority: '普通', predecessors: [], deliverables: [{ id: 'demo-web-m1-t1-d1', text: '站点结构图', done: true }], comments: [], blocked: false, acceptanceStatus: 'accepted', subtasks: [], order: 10 },
            { id: 'demo-web-m1-t2', title: '核心页面文案撰写', assignee: '赵敏', reviewer: '李娜', dueDate: d(-3), status: 'done', priority: '普通', predecessors: ['demo-web-m1-t1'], deliverables: [{ id: 'demo-web-m1-t2-d1', text: '文案初稿', done: true }], comments: [], blocked: false, acceptanceStatus: 'accepted', subtasks: [], order: 20 },
          ],
        },
        {
          id: 'demo-web-m2', name: '视觉设计', description: '输出官网视觉稿。', dueDate: d(4), status: 'doing', owner: '李娜', reviewer: '张伟', order: 20,
          tasks: [
            { id: 'demo-web-m2-t1', title: '首页视觉稿设计', assignee: '王强', reviewer: '李娜', dueDate: d(4), status: 'doing', priority: '高', predecessors: ['demo-web-m1-t2'], deliverables: [], comments: [], blocked: false, acceptanceStatus: '', subtasks: [], order: 10 },
            { id: 'demo-web-m2-t2', title: '内页视觉稿设计', assignee: '王强', reviewer: '李娜', dueDate: d(8), status: 'todo', priority: '普通', predecessors: ['demo-web-m2-t1'], deliverables: [], comments: [], blocked: false, acceptanceStatus: '', subtasks: [], order: 20 },
          ],
        },
        {
          id: 'demo-web-m3', name: '开发上线', description: '页面开发与部署。', dueDate: d(14), status: 'todo', owner: '张伟', reviewer: '李娜', order: 30,
          tasks: [
            { id: 'demo-web-m3-t1', title: '前端页面开发', assignee: '张伟', reviewer: '李娜', dueDate: d(12), status: 'todo', priority: '高', predecessors: ['demo-web-m2-t2'], deliverables: [], comments: [], blocked: false, acceptanceStatus: '', subtasks: [], order: 10 },
          ],
        },
      ],
    },
    {
      id: 'demo-project-data',
      name: '数据中台搭建',
      description: '统一数据接入与指标口径，支撑业务分析报表自动化。',
      category: '项目管理',
      stage: '规划立项',
      priority: '普通',
      status: 'todo',
      riskOverride: '低',
      owner: '王强',
      startDate: d(1),
      dueDate: d(35),
      taskIds: [],
      order: 30,
      milestones: [
        {
          id: 'demo-data-m1', name: '需求调研', description: '盘点数据源与指标口径。', dueDate: d(10), status: 'todo', owner: '王强', reviewer: '张伟', order: 10,
          tasks: [
            { id: 'demo-data-m1-t1', title: '数据源盘点', assignee: '王强', reviewer: '张伟', dueDate: d(5), status: 'todo', priority: '高', predecessors: [], deliverables: [], comments: [], blocked: false, acceptanceStatus: '', subtasks: [], order: 10 },
            { id: 'demo-data-m1-t2', title: '指标口径对齐', assignee: '赵敏', reviewer: '王强', dueDate: d(10), status: 'todo', priority: '普通', predecessors: ['demo-data-m1-t1'], deliverables: [], comments: [], blocked: false, acceptanceStatus: '', subtasks: [], order: 20 },
          ],
        },
        {
          id: 'demo-data-m2', name: '平台搭建', description: '接入与建模。', dueDate: d(28), status: 'todo', owner: '张伟', reviewer: '王强', order: 20,
          tasks: [
            { id: 'demo-data-m2-t1', title: '数据接入管道搭建', assignee: '张伟', reviewer: '王强', dueDate: d(22), status: 'todo', priority: '高', predecessors: ['demo-data-m1-t2'], deliverables: [], comments: [], blocked: false, acceptanceStatus: '', subtasks: [], order: 10 },
            { id: 'demo-data-m2-t2', title: '指标模型构建', assignee: '张伟', reviewer: '王强', dueDate: d(28), status: 'todo', priority: '普通', predecessors: ['demo-data-m2-t1'], deliverables: [], comments: [], blocked: false, acceptanceStatus: '', subtasks: [], order: 20 },
          ],
        },
      ],
    },
    {
      id: 'demo-project-event',
      name: '年度客户答谢活动',
      description: '策划并落地年度客户答谢活动，强化客户关系与品牌口碑。',
      category: '会议沟通',
      stage: '已交付',
      priority: '普通',
      status: 'done',
      riskOverride: '',
      owner: '赵敏',
      startDate: d(-30),
      dueDate: d(-2),
      taskIds: [],
      order: 40,
      milestones: [
        {
          id: 'demo-event-m1', name: '方案策划', description: '确定活动主题与方案。', dueDate: d(-20), status: 'done', owner: '赵敏', reviewer: '李娜', order: 10,
          tasks: [
            { id: 'demo-event-m1-t1', title: '活动方案策划', assignee: '赵敏', reviewer: '李娜', dueDate: d(-24), status: 'done', priority: '高', predecessors: [], deliverables: [{ id: 'demo-event-m1-t1-d1', text: '活动策划方案', done: true }], comments: [], blocked: false, acceptanceStatus: 'accepted', subtasks: [], order: 10 },
          ],
        },
        {
          id: 'demo-event-m2', name: '执行落地', description: '场地、物料与现场执行。', dueDate: d(-4), status: 'done', owner: '赵敏', reviewer: '李娜', order: 20,
          tasks: [
            { id: 'demo-event-m2-t1', title: '场地与物料准备', assignee: '赵敏', reviewer: '李娜', dueDate: d(-8), status: 'done', priority: '高', predecessors: ['demo-event-m1-t1'], deliverables: [{ id: 'demo-event-m2-t1-d1', text: '物料清单', done: true }], comments: [], blocked: false, acceptanceStatus: 'accepted', subtasks: [], order: 10 },
            { id: 'demo-event-m2-t2', title: '现场执行与统筹', assignee: '赵敏', reviewer: '李娜', dueDate: d(-4), status: 'done', priority: '高', predecessors: ['demo-event-m2-t1'], deliverables: [], comments: [], blocked: false, acceptanceStatus: 'accepted', subtasks: [], order: 20 },
          ],
        },
        {
          id: 'demo-event-m3', name: '复盘总结', description: '活动效果复盘。', dueDate: d(-2), status: 'done', owner: '赵敏', reviewer: '李娜', order: 30,
          tasks: [
            { id: 'demo-event-m3-t1', title: '活动效果复盘报告', assignee: '赵敏', reviewer: '李娜', dueDate: d(-2), status: 'done', priority: '普通', predecessors: ['demo-event-m2-t2'], deliverables: [{ id: 'demo-event-m3-t1-d1', text: '复盘报告', done: true }], comments: [], blocked: false, acceptanceStatus: 'accepted', subtasks: [], order: 10 },
          ],
        },
      ],
    },
  ];
  for (const sample of samples) if (!state.projects.some((project) => project.id === sample.id)) state.projects.push(sample);
  save();
  localStorage.setItem(key, '1');
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
    const planEntries = (sourcePlan.tomorrow || []).filter((item) => item.text?.trim() || item.linkRef).map((item) => ({ kind: 'handoff-daily', item, sourceDate }));
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

function resolveLinkTarget(ref) {
  if (!ref || typeof ref !== 'object') return null;
  if (ref.kind === 'task') return taskForId(ref.id);
  if (ref.kind === 'daily') return dailyPlanFor(ref.date)?.[ref.bucket]?.find((item) => item.id === ref.id) || null;
  if (ref.kind === 'weekly' || ref.kind === 'monthly') return planFor(ref.kind, ref.key).items.find((item) => item.id === ref.id) || null;
  return null;
}
function isTaskLink(item) { return Boolean(item?.linkRef && item.linkRef.kind === 'task'); }
function linkText(item) {
  if (isTaskLink(item)) return resolveLinkTarget(item.linkRef)?.content || '';
  return (resolveLinkTarget(item.linkRef) || item)?.text || '';
}
function linkDoneState(item) {
  if (isTaskLink(item)) { const task = resolveLinkTarget(item.linkRef); return task ? Number(task.completionPct) >= 100 : false; }
  return Boolean((resolveLinkTarget(item.linkRef) || item)?.done);
}
function setLinkDone(item, done) {
  if (isTaskLink(item)) { const task = resolveLinkTarget(item.linkRef); if (task) task.completionPct = done ? 100 : 0; return; }
  const target = resolveLinkTarget(item.linkRef) || item;
  if (target) target.done = done;
}
function linkRefFor(group, entry) {
  if (entry.item?.linkRef) return entry.item.linkRef;
  const [scope, first, second] = group.split('|');
  if (scope === 'daily') {
    if (entry.kind === 'task' || entry.kind === 'task-next') return { kind: 'task', id: entry.item.id };
    if (entry.kind === 'daily') return { kind: 'daily', id: entry.item.id, date: first, bucket: second };
  }
  if (scope === 'handoff') {
    if (entry.kind === 'handoff-task') return { kind: 'task', id: entry.item.id };
    if (entry.kind === 'handoff-daily') return { kind: 'daily', id: entry.item.id, date: entry.sourceDate, bucket: 'tomorrow' };
  }
  if (scope === 'plan') return { kind: first, id: entry.item.id, key: second };
  return null;
}
function copySortableBlock(sourceGroup, sourceKey, targetGroup) {
  const source = sortableBlockEntries(sourceGroup).find((entry) => `${entry.kind}:${entry.item.id}` === sourceKey);
  if (!source) return false;
  const ref = linkRefFor(sourceGroup, source);
  if (!ref) return false;
  const canonical = resolveLinkTarget(ref);
  const text = canonical ? (ref.kind === 'task' ? canonical.content : canonical.text) : '';
  if (!text?.trim()) return false;
  const [scope, first, second] = targetGroup.split('|');
  const targetEntries = sortableBlockEntries(targetGroup);
  const nextOrder = targetEntries.reduce((max, entry) => Math.max(max, Number(entry.item[entry.orderKey || 'order']) || 0), 0) + 10;
  if (targetEntries.some((entry) => entry.item.linkRef && entry.item.linkRef.kind === ref.kind && entry.item.linkRef.id === ref.id)) return toast('目标板块已关联此任务'), false;
  if (scope === 'daily' && second === 'today' && ref.kind === 'task') {
    const task = taskForId(ref.id);
    if (task && task.date === first) return toast('该任务已在今日工作动态中'), false;
  }
  const link = { id: crypto.randomUUID(), linkRef: ref, text: '', done: false, order: nextOrder };
  if (scope === 'daily') dailyPlanFor(first)[second].push(link);
  else if (scope === 'plan') planFor(first, second).items.push(link);
  else if (scope === 'handoff') dailyPlanFor(shiftDate(first, -1)).tomorrow.push(link);
  else return false;
  save(); render(); toast('已关联到目标板块，状态将同步更新'); return true;
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
  else if (entry.kind === 'daily') setLinkDone(entry.item, status === 'done');
}

migrateDailyPlansToTasks();
seedDemoData();
seedSopDemoTemplates();
seedDemoProjects();

// ===== Novel 风格 Notion 式块编辑器 =====
const NOVEL_BLOCK_ITEMS = [
  { type: 'p', label: '正文', icon: '¶', hint: '普通文本段落' },
  { type: 'h1', label: '标题 1', icon: 'H1', hint: '大号标题' },
  { type: 'h2', label: '标题 2', icon: 'H2', hint: '中号标题' },
  { type: 'h3', label: '标题 3', icon: 'H3', hint: '小号标题' },
  { type: 'ul', label: '无序列表', icon: '•', hint: '项目符号列表' },
  { type: 'ol', label: '有序列表', icon: '1.', hint: '编号列表' },
  { type: 'todo', label: '待办事项', icon: '☑', hint: '复选框' },
  { type: 'quote', label: '引用', icon: '❝', hint: '引用一段文字' },
  { type: 'divider', label: '分割线', icon: '—', hint: '水平分隔线' },
  { type: 'code', label: '代码块', icon: '<>', hint: '等宽字体代码' },
];
const NOVEL_MARKDOWN_SHORTCUTS = [
  { prefix: '###', type: 'h3' },
  { prefix: '##', type: 'h2' },
  { prefix: '#', type: 'h1' },
  { prefix: '>', type: 'quote' },
  { prefix: '[ ]', type: 'todo' },
  { prefix: '[]', type: 'todo' },
  { prefix: '1.', type: 'ol' },
  { prefix: '-', type: 'ul' },
  { prefix: '*', type: 'ul' },
  { prefix: '```', type: 'code' },
];
let novelSlash = { open: false, editor: null, block: null, query: '' };
let novelBubble = { open: false, editor: null, savedRange: null };

function novelBodyHtml(body) {
  const text = String(body || '').trim();
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    return `<p>${trimmed.split(/\n/).map(esc).join('<br>')}</p>`;
  }).join('');
}

function renderNovelEditor(target, kind = 'task') {
  const html = novelBodyHtml(target.body);
  return `<div class="novel-editor" data-novel-editor data-id="${target.id}">
    <div class="novel-content" contenteditable="true" data-novel-content data-novel-kind="${kind}" data-id="${target.id}" data-placeholder="输入文字，或按 / 快速插入模块……" spellcheck="false">${html}</div>
    <div class="novel-slash-menu" data-slash-menu hidden></div>
    <div class="novel-bubble-menu" data-bubble-menu hidden>
      <button type="button" data-novel-format="bold" title="加粗"><b>B</b></button>
      <button type="button" data-novel-format="italic" title="斜体"><i>I</i></button>
      <button type="button" data-novel-format="underline" title="下划线"><u>U</u></button>
      <button type="button" data-novel-format="strikeThrough" title="删除线"><s>S</s></button>
      <button type="button" data-novel-format="insertUnorderedList" title="无序列表">•</button>
      <button type="button" data-novel-format="insertOrderedList" title="有序列表">1.</button>
      <button type="button" data-novel-format="formatBlock" data-value="blockquote" title="引用">❝</button>
      <button type="button" data-novel-format="formatBlock" data-value="h2" title="标题">H</button>
    </div>
  </div>`;
}

function findNovelBlock(node, editor) {
  while (node && node !== editor && node !== document.body) {
    if (node.nodeType === 1 && node.parentNode === editor) return node;
    node = node.parentNode;
  }
  return null;
}

function novelCaretBlock(editor) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return null;
  let node = sel.anchorNode;
  if (node.nodeType === 3) node = node.parentNode;
  return findNovelBlock(node, editor);
}

function saveNovelBody(editor) {
  const id = editor.dataset.id;
  if (editor.dataset.novelKind === 'doc') {
    const node = documentNodes(state).find((n) => n.id === id);
    if (node) { node.body = editor.innerHTML; node.updatedAt = new Date().toISOString(); save(); }
  } else {
    const task = taskForId(id);
    if (task) { task.body = editor.innerHTML; save(); }
  }
}

function novelTargetTitle(editor) {
  if (editor.dataset.novelKind === 'doc') return documentNodes(state).find((n) => n.id === editor.dataset.id)?.title || '未命名文档';
  return taskForId(editor.dataset.id)?.content || '未命名任务';
}

function placeCaretAtEnd(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function createNovelBlock(type, text = '') {
  switch (type) {
    case 'h1': case 'h2': case 'h3': {
      const el = document.createElement(type);
      el.textContent = text;
      return el;
    }
    case 'ul': case 'ol': {
      const list = document.createElement(type);
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
      return list;
    }
    case 'quote': {
      const el = document.createElement('blockquote');
      el.textContent = text;
      return el;
    }
    case 'code': {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = text;
      pre.appendChild(code);
      return pre;
    }
    case 'todo': {
      const el = document.createElement('div');
      el.className = 'novel-todo';
      el.innerHTML = '<span class="novel-todo-checkbox" contenteditable="false">☐</span>';
      const span = document.createElement('span');
      span.className = 'novel-todo-text';
      span.textContent = text;
      el.appendChild(span);
      return el;
    }
    case 'divider': {
      const hr = document.createElement('hr');
      hr.className = 'novel-divider';
      return hr;
    }
    default: {
      const el = document.createElement('p');
      if (text) el.textContent = text; else el.innerHTML = '<br>';
      return el;
    }
  }
}

function applyNovelBlockType(editor, block, type) {
  if (type === 'divider') {
    const hr = createNovelBlock('divider');
    const p = createNovelBlock('p', '');
    block.replaceWith(hr);
    hr.after(p);
    placeCaretAtEnd(p);
    saveNovelBody(editor);
    return p;
  }
  const newBlock = createNovelBlock(type, '');
  block.replaceWith(newBlock);
  placeCaretAtEnd(newBlock);
  saveNovelBody(editor);
  return newBlock;
}

function tryNovelMarkdownShortcut(editor) {
  const block = novelCaretBlock(editor);
  if (!block) return false;
  const tag = block.tagName;
  const isPlain = tag === 'P' || (tag === 'DIV' && !block.classList.contains('novel-todo'));
  if (!isPlain) return false;
  const text = block.textContent || '';
  const shortcut = NOVEL_MARKDOWN_SHORTCUTS.find((s) => text === s.prefix);
  if (!shortcut) return false;
  applyNovelBlockType(editor, block, shortcut.type);
  return true;
}

function openNovelSlash(editor, block, query) {
  const wrapper = editor.parentElement;
  const menu = wrapper ? wrapper.querySelector('[data-slash-menu]') : null;
  if (!menu) return;
  const normalized = query.toLowerCase();
  const items = NOVEL_BLOCK_ITEMS.filter((item) => !normalized || item.label.toLowerCase().includes(normalized) || item.type.toLowerCase().includes(normalized));
  menu.innerHTML = `<div class="novel-menu-group">${items.map((item) => `<button type="button" class="novel-menu-item" data-novel-insert="${item.type}"><span class="novel-menu-icon">${item.icon}</span><span class="novel-menu-label">${item.label}</span><span class="novel-menu-hint">${item.hint}</span></button>`).join('') || '<div class="novel-menu-empty">没有匹配的模块</div>'}</div>`;
  menu.hidden = false;
  novelSlash = { open: true, editor, block, query };
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const containerRect = wrapper.getBoundingClientRect();
    menu.style.left = `${Math.max(0, rect.left - containerRect.left)}px`;
    menu.style.top = `${Math.min(containerRect.height - 44, rect.top - containerRect.top + 22)}px`;
  }
}

function closeNovelSlash() {
  if (novelSlash.open) {
    const menu = novelSlash.editor?.parentElement?.querySelector('[data-slash-menu]');
    if (menu) menu.hidden = true;
    novelSlash = { open: false, editor: null, block: null, query: '' };
  }
}

function detectNovelSlash(editor) {
  const block = novelCaretBlock(editor);
  const text = block ? (block.textContent || '') : (editor.textContent || '');
  if (text.startsWith('/')) openNovelSlash(editor, block, text.slice(1));
  else closeNovelSlash();
}

function insertNovelBlockFromSlash(editor, type) {
  const block = novelSlash.block || novelCaretBlock(editor);
  if (block) applyNovelBlockType(editor, block, type);
  else {
    editor.innerHTML = '';
    editor.appendChild(createNovelBlock(type, ''));
    placeCaretAtEnd(editor.lastChild);
    saveNovelBody(editor);
  }
  closeNovelSlash();
  editor.focus();
}

function updateNovelBubble() {
  const sel = window.getSelection();
  let activeEditor = null;
  document.querySelectorAll('[data-novel-content]').forEach((ed) => {
    if (sel && sel.rangeCount && sel.anchorNode && ed.contains(sel.anchorNode)) activeEditor = ed;
  });
  if (!activeEditor || !sel || !sel.rangeCount || sel.isCollapsed) { closeNovelBubble(); return; }
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const wrapper = activeEditor.parentElement;
  const menu = wrapper ? wrapper.querySelector('[data-bubble-menu]') : null;
  if (!menu) return;
  menu.hidden = false;
  novelBubble = { open: true, editor: activeEditor, savedRange: range.cloneRange() };
  const containerRect = wrapper.getBoundingClientRect();
  menu.style.left = `${Math.max(4, Math.min(containerRect.width - menu.offsetWidth - 4, rect.left - containerRect.left + rect.width / 2 - menu.offsetWidth / 2))}px`;
  menu.style.top = `${Math.max(4, rect.top - containerRect.top - menu.offsetHeight - 8)}px`;
}

function closeNovelBubble() {
  if (novelBubble.open) {
    const menu = novelBubble.editor?.parentElement?.querySelector('[data-bubble-menu]');
    if (menu) menu.hidden = true;
    novelBubble = { open: false, editor: null, savedRange: null };
  }
}

function applyNovelFormat(command, value) {
  const { editor, savedRange } = novelBubble;
  if (!editor || !savedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
  document.execCommand(command, false, value || null);
  editor.focus();
  saveNovelBody(editor);
  updateNovelBubble();
}

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
  const todayTotal = (plan.today || []).length + todayTasks.length;
  const weeklyKey = weekKey(date);
  const monthlyKey = date.slice(0, 7);
  const weeklyPlan = state.plans.weekly?.[weeklyKey] || { title: '', notes: '', items: [] };
  const monthlyPlan = state.plans.monthly?.[monthlyKey] || { title: '', notes: '', items: [] };
  const finishedToday = (plan.today || []).filter((item) => linkDoneState(item)).length + todayTasks.filter((task) => Number(task.completionPct) >= 100).length;
  const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${date}T12:00:00`));

  const blockAttrs = (group, key) => `data-sortable-block data-sort-group="${group}" data-block-key="${key}"`;
  const dailyItem = (item, bucket) => {
    const group = `daily|${date}|${bucket}`;
    const frozen = false;
    const done = linkDoneState(item);
    const text = linkText(item);
    const taskLink = isTaskLink(item);
    const sourceTag = taskLink ? '关联任务' : (item.linkRef ? '关联计划' : '计划块');
    const editBtn = taskLink ? `<button class="link-button" data-action="edit-task" data-id="${esc(resolveLinkTarget(item.linkRef)?.id || '')}">打开文件</button>` : `<button class="link-button" data-action="focus-block-edit" ${frozen ? 'disabled' : ''}>编辑</button>`;
    return `<div class="daily-block ${done ? 'done' : ''} ${frozen ? 'frozen' : ''}" ${blockAttrs(group, `daily:${item.id}`)}><span class="daily-block-handle ${frozen ? 'disabled' : ''}" draggable="${!frozen}" title="${frozen ? '已冻结' : '拖拽排序'}" aria-hidden="true">⋮⋮</span><input type="checkbox" data-action="toggle-daily-item" data-daily-date="${date}" data-daily-bucket="${bucket}" data-item-id="${item.id}" ${done ? 'checked' : ''}><div class="daily-block-main"><input class="daily-block-title" data-daily-item-field="text" data-daily-date="${date}" data-daily-bucket="${bucket}" data-item-id="${item.id}" value="${inputValue(text)}" ${frozen ? 'readonly' : ''}><small>${bucket === 'today' ? '今日工作动态' : '明日计划'} · ${sourceTag}</small></div><select class="daily-status-select ${done ? 'tone-green' : 'tone-gold'}" data-daily-plan-status data-date="${date}" data-bucket="${bucket}" data-item-id="${item.id}" ${frozen ? 'disabled' : ''}><option value="pending" ${!done ? 'selected' : ''}>待推进</option><option value="done" ${done ? 'selected' : ''}>已完成</option></select><div class="daily-block-actions"><button class="link-button" data-action="toggle-block-freeze">${frozen ? '解冻' : '冻结'}</button>${editBtn}<button class="daily-delete" data-action="delete-daily-item" data-daily-date="${date}" data-daily-bucket="${bucket}" data-item-id="${item.id}" aria-label="删除计划" ${frozen ? 'disabled' : ''}>×</button></div></div>`;
  };
  const taskSubtasks = (task) => {
    const items = Array.isArray(task.subtasks) ? task.subtasks : [];
    return `<div class="task-subtasks" data-task-subtasks="${task.id}">${items.map((item) => `<div class="task-subtask ${item.done ? 'done' : ''}"><input type="checkbox" data-action="toggle-task-subtask" data-task-id="${task.id}" data-subtask-id="${item.id}" ${item.done ? 'checked' : ''} aria-label="完成子任务"><input class="task-subtask-input" data-task-subtask-field="text" data-task-id="${task.id}" data-subtask-id="${item.id}" value="${inputValue(item.text)}" placeholder="子任务名称"><button type="button" class="task-subtask-delete" data-action="delete-task-subtask" data-task-id="${task.id}" data-subtask-id="${item.id}" aria-label="删除子任务">×</button></div>`).join('')}<button type="button" class="task-subtask-add" data-action="add-task-subtask" data-task-id="${task.id}">+ 子任务</button></div>`;
  };
  const taskBlock = (task) => {
    const calculated = calculateDay(task.date, [task], state).tasks[0];
    const progressStatus = Number(task.completionPct) >= 100 ? 'done' : Number(task.completionPct) > 0 ? 'doing' : 'todo';
    const group = `daily|${date}|today`;
    const frozen = false;
    return `<div class="daily-block task-file ${progressStatus === 'done' ? 'done' : ''} ${frozen ? 'frozen' : ''}" ${blockAttrs(group, `task:${task.id}`)}><span class="daily-block-handle ${frozen ? 'disabled' : ''}" draggable="${!frozen}" title="${frozen ? '已冻结' : '拖拽排序'}" aria-hidden="true">⋮⋮</span><input class="daily-task-check" type="checkbox" data-action="toggle-daily-task" data-id="${task.id}" aria-label="标记 ${esc(task.content || '未命名任务')} 完成" ${progressStatus === 'done' ? 'checked' : ''}><div class="daily-block-main"><div class="task-file-title"><input class="daily-block-title" data-daily-task-field="content" data-id="${task.id}" value="${inputValue(task.content)}" placeholder="填写任务内容" ${frozen ? 'readonly' : ''}></div><small>${esc(task.category)} · ${esc(task.planType)} <span class="daily-info-status ${calculated.validationErrors.length ? 'incomplete' : 'complete'}">${calculated.validationErrors.length ? '信息待完善' : '信息完整'}</span></small>${taskSubtasks(task)}</div><select class="daily-status-select ${progressStatus === 'done' ? 'tone-green' : progressStatus === 'doing' ? 'tone-gold' : ''}" data-daily-task-status data-id="${task.id}" ${frozen ? 'disabled' : ''}><option value="todo" ${progressStatus === 'todo' ? 'selected' : ''}>待开始</option><option value="doing" ${progressStatus === 'doing' ? 'selected' : ''}>进行中</option><option value="done" ${progressStatus === 'done' ? 'selected' : ''}>已完成</option></select><div class="daily-block-actions"><button class="link-button" data-action="edit-task" data-id="${task.id}" ${frozen ? 'disabled' : ''}>打开文件</button><button class="daily-delete" data-action="delete-task" data-id="${task.id}" aria-label="删除任务" ${frozen ? 'disabled' : ''}>×</button></div></div>`;
  };
  const todayEntries = sortWorkBlocks([...(plan.today || []).map((item) => ({ kind: 'daily', item })), ...todayTasks.map((item) => ({ kind: 'task', item }))]);
  const renderTodayEntry = (entry) => entry.kind === 'task' ? taskBlock(entry.item) : dailyItem(entry.item, 'today');
  const todayBlocks = todayEntries.map(renderTodayEntry).join('');
  const todayTaskEntries = sortWorkBlocks(todayTasks.map((item) => ({ kind: 'task', item })));
  if (!todayTaskEntries.some((entry) => entry.item.id === selectedDailyTaskId)) {
    selectedDailyTaskId = todayTaskEntries[0]?.item.id || '';
    localStorage.setItem(userPreferenceKey('performance-selected-daily-task'), selectedDailyTaskId);
  }
  const selectedTask = todayTaskEntries.find((entry) => entry.item.id === selectedDailyTaskId)?.item || null;
  const dailyTaskSubtaskRow = (task, subtask) => `<div class="today-task-row today-task-subtask-row"><span class="today-row-index" aria-hidden="true"></span><input class="daily-task-check" type="checkbox" data-action="toggle-task-subtask" data-task-id="${task.id}" data-subtask-id="${subtask.id}" ${subtask.done ? 'checked' : ''} aria-label="完成子任务"><div class="today-task-select today-subtask-copy"><input class="today-subtask-input" data-task-subtask-field="text" data-task-id="${task.id}" data-subtask-id="${subtask.id}" value="${inputValue(subtask.text)}" placeholder="子任务名称"></div><button type="button" class="today-subtask-delete" data-action="delete-task-subtask" data-task-id="${task.id}" data-subtask-id="${subtask.id}" title="删除子任务" aria-label="删除子任务">×</button></div>`;
  const dailyTaskListRow = (task, index) => {
    const calculated = calculateDay(task.date, [task], state).tasks[0];
    const progressStatus = Number(task.completionPct) >= 100 ? 'done' : Number(task.completionPct) > 0 ? 'doing' : 'todo';
    const group = `daily|${date}|today`;
    const subtaskRows = (Array.isArray(task.subtasks) ? task.subtasks : []).map((subtask) => dailyTaskSubtaskRow(task, subtask)).join('');
    return `<div class="today-task-row ${task.id === selectedDailyTaskId ? 'selected' : ''}" ${blockAttrs(group, `task:${task.id}`)}><span class="daily-block-handle today-row-index" draggable="true" title="第 ${index + 1} 行 · 拖拽排序" aria-label="拖动第 ${index + 1} 行">${index + 1}</span><input class="daily-task-check" type="checkbox" data-action="toggle-daily-task" data-id="${task.id}" aria-label="标记 ${esc(task.content || '未命名任务')} 完成" ${progressStatus === 'done' ? 'checked' : ''}><button type="button" class="today-task-select" data-action="select-daily-task" data-id="${task.id}"><span class="today-task-copy"><strong>${esc(task.content || '未命名任务')}</strong><small><span class="task-row-tag">${esc(task.category || '其他')}</span><span class="daily-info-status ${calculated.validationErrors.length ? 'incomplete' : 'complete'}">${calculated.validationErrors.length ? '信息待完善' : '信息完整'}</span></small></span></button><div class="today-task-actions"><select class="daily-status-select ${progressStatus === 'done' ? 'tone-green' : progressStatus === 'doing' ? 'tone-gold' : ''}" data-daily-task-status data-id="${task.id}"><option value="todo" ${progressStatus === 'todo' ? 'selected' : ''}>待开始</option><option value="doing" ${progressStatus === 'doing' ? 'selected' : ''}>进行中</option><option value="done" ${progressStatus === 'done' ? 'selected' : ''}>已完成</option></select><button class="today-task-add-subtask" data-action="add-task-subtask" data-task-id="${task.id}" title="添加子任务" aria-label="添加子任务">+</button></div></div>${subtaskRows}`;
  };
  const blankTaskRowCount = 2;
  const blankTaskRows = Array.from({ length: blankTaskRowCount }, (_, slot) => `<div class="today-task-row today-task-blank-row"><span class="today-row-index" aria-hidden="true">${todayTaskEntries.length + slot + 1}</span><span class="today-blank-check" aria-hidden="true"></span><input class="today-quick-task-input" data-daily-quick-task data-date="${date}" data-quick-slot="${slot}" aria-label="第 ${todayTaskEntries.length + slot + 1} 行新任务" placeholder="${slot === 0 ? '输入任务，按 Enter 到下一行' : ''}"><span class="today-blank-status">待开始</span></div>`).join('');
  const dailyTaskField = (task, field, label, type = 'text', extra = '') => `<label class="today-doc-field"><span>${label}</span><input class="input" data-daily-task-file-field="${field}" data-id="${task.id}" type="${type}" value="${inputValue(task[field])}" ${extra}></label>`;
  const dailyTaskSelect = (task, field, label, options) => `<label class="today-doc-field"><span>${label}</span><select class="select" data-daily-task-file-field="${field}" data-id="${task.id}">${options.map((option) => `<option value="${inputValue(option)}" ${String(task[field] || '') === String(option) ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`;
  function renderTaskPropertiesPanel(task) {
    const visibility = getTaskPropertyVisibility(task);
    const customProps = getTaskCustomProperties(task);
    const expanded = task.propertiesExpanded !== false;
    const visibleBuiltin = BUILTIN_TASK_PROPERTIES.filter((p) => visibility[p.key]);
    const visibleCustom = customProps.filter((p) => p.visible !== false);
    const hiddenBuiltin = BUILTIN_TASK_PROPERTIES.filter((p) => !visibility[p.key]);
    const hiddenCustom = customProps.filter((p) => p.visible === false);
    const hiddenCount = hiddenBuiltin.length + hiddenCustom.length;
    const hiddenExpanded = task.hiddenPropertiesExpanded === true;

    const renderPropertyRow = (prop, isCustom = false, isHidden = false) => {
      const value = isCustom ? prop.value : task[prop.key];
      const key = isCustom ? prop.id : prop.key;
      const hiddenCls = isHidden ? 'task-property-row-hidden' : '';
      let inputHtml = '';
      if (!isCustom && prop.key === 'completionPct') {
        inputHtml = `<select class="task-property-input" data-property-field="completionPct" data-task-id="${task.id}"><option value="0" ${Number(value) <= 0 ? 'selected' : ''}>待开始</option><option value="50" ${Number(value) > 0 && Number(value) < 100 ? 'selected' : ''}>进行中</option><option value="100" ${Number(value) >= 100 ? 'selected' : ''}>已完成</option></select>`;
      } else if (prop.type === 'select') {
        const options = isCustom ? (prop.options || []) : (prop.options ? prop.options() : []);
        inputHtml = `<select class="task-property-input" data-property-field="${key}" data-task-id="${task.id}" ${isCustom ? 'data-custom-property' : ''}>${options.map((opt) => `<option value="${inputValue(opt)}" ${String(value || '') === String(opt) ? 'selected' : ''}>${esc(opt)}</option>`).join('')}</select>`;
      } else if (prop.type === 'number') {
        inputHtml = `<input class="task-property-input" data-property-field="${key}" data-task-id="${task.id}" type="number" value="${inputValue(value)}" ${prop.step ? `step="${prop.step}"` : ''} ${prop.min !== undefined ? `min="${prop.min}"` : ''} ${prop.max !== undefined ? `max="${prop.max}"` : ''} ${isCustom ? 'data-custom-property' : ''}>`;
      } else if (prop.type === 'textarea') {
        return `<div class="task-property-row task-property-row-wide ${hiddenCls}"><div class="task-property-row-wide-head"><span class="task-property-icon">${esc(prop.icon || '≡')}</span><span class="task-property-label">${esc(prop.label)}</span><button class="task-property-eye" data-action="toggle-property-visible" data-property-key="${key}" data-task-id="${task.id}" ${isCustom ? 'data-custom-property' : ''} title="${(isCustom ? prop.visible !== false : visibility[prop.key]) ? '点击隐藏' : '点击显示'}">${(isCustom ? prop.visible !== false : visibility[prop.key]) ? '👁' : '👁‍🗨'}</button>${isCustom ? `<button class="task-property-delete" data-action="delete-task-property" data-property-id="${prop.id}" data-task-id="${task.id}" title="删除属性">×</button>` : ''}</div><textarea class="task-property-input task-property-textarea" data-property-field="${key}" data-task-id="${task.id}" rows="2" placeholder="填写${esc(prop.label)}" ${isCustom ? 'data-custom-property' : ''}>${inputValue(value)}</textarea></div>`;
      } else {
        inputHtml = `<input class="task-property-input" data-property-field="${key}" data-task-id="${task.id}" type="${prop.type || 'text'}" value="${inputValue(value)}" ${isCustom ? 'data-custom-property' : ''}>`;
      }
      return `<div class="task-property-row ${hiddenCls}">
      <span class="task-property-icon">${esc(prop.icon || '≡')}</span>
      <span class="task-property-label">${esc(prop.label)}</span>
      <div class="task-property-value">${inputHtml}</div>
      <button class="task-property-eye" data-action="toggle-property-visible" data-property-key="${key}" data-task-id="${task.id}" ${isCustom ? 'data-custom-property' : ''} title="${(isCustom ? prop.visible !== false : visibility[prop.key]) ? '点击隐藏' : '点击显示'}">
        ${(isCustom ? prop.visible !== false : visibility[prop.key]) ? '👁' : '👁‍🗨'}
      </button>
      ${isCustom ? `<button class="task-property-delete" data-action="delete-task-property" data-property-id="${prop.id}" data-task-id="${task.id}" title="删除属性">×</button>` : ''}
    </div>`;
    };

    const hiddenSection = hiddenCount > 0 ? `
    <div class="task-hidden-properties-section">
      <button class="task-hidden-properties-toggle" data-action="toggle-hidden-properties" data-task-id="${task.id}">
        <span class="task-hidden-properties-arrow ${hiddenExpanded ? 'expanded' : ''}">▾</span>
        <span>其他 ${hiddenCount} 个属性</span>
      </button>
      <div class="task-hidden-properties-content ${hiddenExpanded ? '' : 'collapsed'}">
        ${hiddenBuiltin.map((p) => renderPropertyRow(p, false, true)).join('')}
        ${hiddenCustom.map((p) => renderPropertyRow(p, true, true)).join('')}
      </div>
    </div>` : '';

    return `<div class="task-properties-panel">
    <div class="task-properties-header">
      <button class="task-properties-toggle" data-action="toggle-task-properties" data-task-id="${task.id}">
        <span class="task-properties-arrow ${expanded ? 'expanded' : ''}">▾</span>
        <span>任务属性</span>
      </button>
      <button class="task-properties-edit-btn" data-action="edit-task-properties" data-task-id="${task.id}">编辑属性</button>
    </div>
    <div class="task-properties-content ${expanded ? '' : 'collapsed'}">
      ${visibleBuiltin.map((p) => renderPropertyRow(p)).join('')}
      ${visibleCustom.map((p) => renderPropertyRow(p, true)).join('')}
      ${hiddenSection}
      <button class="task-property-add" data-action="add-task-property" data-task-id="${task.id}">+ 添加属性</button>
    </div>
  </div>`;
  }

  const renderDailyTaskDocument = (task) => {
    if (!task) return '<div class="today-task-document-empty"><strong>选择一个任务文件</strong><p>从左侧任务列表打开今天的工作记录。</p></div>';
    const calculated = calculateDay(task.date, [task], state).tasks[0];
    const progressStatus = Number(task.completionPct) >= 100 ? 'done' : Number(task.completionPct) > 0 ? 'doing' : 'todo';
    const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    const wordCount = ((task.content || '').length + (task.description || '').length);
    return `<article class="today-task-document"><div class="today-doc-header"><div class="today-doc-breadcrumb"><span>今日工作动态</span><span>/</span><span>${esc(task.date)}</span><span>/</span><span>${esc(task.content || '未命名任务')}.md</span></div><span class="daily-info-status ${calculated.validationErrors.length ? 'incomplete' : 'complete'}">${calculated.validationErrors.length ? '信息待完善' : '信息完整'}</span></div>${renderTaskPropertiesPanel(task)}<div class="today-doc-editor">${renderNovelEditor(task, 'task')}</div><div class="today-doc-footer"><span class="today-doc-footer-meta">${esc(task.date || '未设置')}.md · ${wordCount} 字</span></div></article>`;
  };
  const entryStatus = (entry) => entry.kind === 'task' ? (Number(entry.item.completionPct) >= 100 ? 'done' : Number(entry.item.completionPct) > 0 ? 'doing' : 'todo') : (entry.item.done ? 'done' : 'todo');
  const kanbanEntryRow = (entry, index) => {
    const group = `daily|${date}|today`;
    if (entry.kind === 'task') {
      const task = entry.item;
      const progressStatus = Number(task.completionPct) >= 100 ? 'done' : Number(task.completionPct) > 0 ? 'doing' : 'todo';
      return `<div class="today-task-row" ${blockAttrs(group, `task:${task.id}`)}><span class="daily-block-handle today-row-index" draggable="true" aria-label="拖动第 ${index + 1} 行">${index + 1}</span><input class="daily-task-check" type="checkbox" data-action="toggle-daily-task" data-id="${task.id}" ${progressStatus === 'done' ? 'checked' : ''}><span class="today-task-select" style="cursor:default;"><span class="today-task-copy"><strong>${esc(task.content || '未命名任务')}</strong><small><span class="task-row-tag">${esc(task.category || '其他')}</span></small></span></span><div class="today-task-actions"><select class="daily-status-select ${progressStatus === 'done' ? 'tone-green' : progressStatus === 'doing' ? 'tone-gold' : ''}" data-daily-task-status data-id="${task.id}"><option value="todo" ${progressStatus === 'todo' ? 'selected' : ''}>待办</option><option value="doing" ${progressStatus === 'doing' ? 'selected' : ''}>进行中</option><option value="done" ${progressStatus === 'done' ? 'selected' : ''}>已完成</option></select></div></div>`;
    }
    const item = entry.item;
    const done = linkDoneState(item);
    const text = linkText(item);
    return `<div class="today-task-row ${done ? 'done' : ''}" ${blockAttrs(group, `daily:${item.id}`)}><span class="daily-block-handle today-row-index" draggable="true" aria-label="拖动第 ${index + 1} 行">${index + 1}</span><input type="checkbox" class="daily-task-check" data-action="toggle-daily-item" data-daily-date="${date}" data-daily-bucket="today" data-item-id="${item.id}" ${done ? 'checked' : ''}><span class="today-task-select" style="cursor:default;"><span class="today-task-copy"><strong>${esc(text)}</strong><small>${item.linkRef ? '关联计划' : '计划块'}</small></span></span><div class="today-task-actions"><select class="daily-status-select ${done ? 'tone-green' : 'tone-gold'}" data-daily-plan-status data-date="${date}" data-bucket="today" data-item-id="${item.id}"><option value="pending" ${!done ? 'selected' : ''}>待推进</option><option value="done" ${done ? 'selected' : ''}>已完成</option></select></div></div>`;
  };
  const kanbanStatusLabel = { todo: '待办', doing: '进行中', done: '已完成' };
  const kanbanBlankRows = (entries, statusKey) => Array.from({ length: 2 }, (_, slot) => `<div class="today-task-row today-task-blank-row"><span class="today-row-index" aria-hidden="true">${entries.length + slot + 1}</span><span class="today-blank-check" aria-hidden="true"></span><input class="today-quick-task-input" data-kanban-quick data-kanban-status="${statusKey}" data-date="${date}" data-quick-slot="${slot}" placeholder="${slot === 0 ? '输入任务，按 Enter 到下一行' : ''}"><span class="today-blank-status">${kanbanStatusLabel[statusKey]}</span></div>`).join('');
  const kanbanWidths = getKanbanWidths();
  const todayBoard = `<div class="daily-kanban" style="--kanban-w0:${kanbanWidths[0]}%;--kanban-w1:${kanbanWidths[1]}%;--kanban-w2:${kanbanWidths[2]}%">${[['todo', '待办'], ['doing', '进行中'], ['done', '已完成']].map(([statusKey, label], colIdx) => { const entries = todayEntries.filter((entry) => entryStatus(entry) === statusKey); const resizeHandle = colIdx < 2 ? `<span class="kanban-col-resize" data-kanban-resize="${colIdx}" title="拖动调整列宽" aria-hidden="true"></span>` : ''; return `<section class="daily-kanban-column" data-kanban-col="${colIdx}"><div class="daily-kanban-head"><strong>${label}</strong><span>${entries.length}</span></div><div class="daily-kanban-list" data-sort-container data-sort-group="daily|${date}|today" data-daily-status="${statusKey}">${entries.map((entry, index) => kanbanEntryRow(entry, index)).join('')}${kanbanBlankRows(entries, statusKey)}</div></section>${resizeHandle}`; }).join('')}</div>`;
  const handoffGroup = `handoff|${date}`;
  const handoffEntries = sortableBlockEntries(handoffGroup);
  const inheritedRows = handoffEntries.map((entry, index) => { const item = entry.item; const text = entry.kind === 'handoff-task' ? (item.nextPlan || '') : linkText(item); const sourceLabel = entry.kind === 'handoff-task' ? '昨日任务' : (item.linkRef ? '关联计划' : '昨日计划'); return `<div class="today-task-row" ${blockAttrs(handoffGroup, `${entry.kind}:${item.id}`)}><span class="daily-block-handle today-row-index" draggable="true" aria-label="拖动第 ${index + 1} 行">${index + 1}</span><span class="today-blank-check" aria-hidden="true"></span><span class="today-task-select" style="cursor:default;"><span class="today-task-copy"><strong>${esc(text)}</strong><small>${sourceLabel}</small></span></span><div class="today-task-actions"><span class="today-blank-status">${sourceLabel}</span></div></div>`; }).join('');
  const tomorrowTaskBlock = (task) => {
    const group = `daily|${date}|tomorrow`;
    const frozen = false;
    return `<div class="daily-block ${task.nextPlanDone ? 'done' : ''} ${frozen ? 'frozen' : ''}" ${blockAttrs(group, `task-next:${task.id}`)}><span class="daily-block-handle ${frozen ? 'disabled' : ''}" draggable="${!frozen}" title="${frozen ? '已冻结' : '拖拽排序'}" aria-hidden="true">⋮⋮</span><input type="checkbox" data-action="toggle-daily-task-next" data-id="${task.id}" ${task.nextPlanDone ? 'checked' : ''}><div class="daily-block-main"><input class="daily-block-title" data-daily-task-field="nextPlan" data-id="${task.id}" value="${inputValue(task.nextPlan)}" ${frozen ? 'readonly' : ''}><small>来自任务 · ${esc(task.content || '未命名任务')}</small></div><select class="daily-status-select ${task.nextPlanDone ? 'tone-green' : 'tone-gold'}" data-daily-task-next-status data-id="${task.id}" ${frozen ? 'disabled' : ''}><option value="pending" ${!task.nextPlanDone ? 'selected' : ''}>待推进</option><option value="done" ${task.nextPlanDone ? 'selected' : ''}>已完成</option></select><div class="daily-block-actions"><button class="link-button" data-action="toggle-block-freeze">${frozen ? '解冻' : '冻结'}</button><button class="link-button" data-action="edit-task" data-id="${task.id}" ${frozen ? 'disabled' : ''}>编辑</button></div></div>`;
  };
  const tomorrowEntries = sortWorkBlocks([...(plan.tomorrow || []).map((item) => ({ kind: 'daily', item })), ...todayTasks.filter((task) => task.nextPlan?.trim()).map((item) => ({ kind: 'task-next', item, orderKey: 'nextPlanOrder' }))]);
  const tomorrowBlocks = tomorrowEntries.map((entry, index) => {
    const item = entry.item;
    const group = `daily|${date}|tomorrow`;
    if (entry.kind === 'task-next') {
      const task = item;
      const done = task.nextPlanDone;
      return `<div class="today-task-row ${done ? 'done' : ''}" ${blockAttrs(group, `task-next:${task.id}`)}><span class="daily-block-handle today-row-index" draggable="true" aria-label="拖动第 ${index + 1} 行">${index + 1}</span><input type="checkbox" class="daily-task-check" data-action="toggle-daily-task-next" data-id="${task.id}" ${done ? 'checked' : ''}><span class="today-task-select" style="cursor:default;"><span class="today-task-copy"><input class="daily-block-title" data-daily-task-field="nextPlan" data-id="${task.id}" value="${inputValue(task.nextPlan)}" placeholder="填写明日计划"><small>来自任务 · ${esc(task.content || '未命名任务')}</small></span></span><div class="today-task-actions"><select class="daily-status-select ${done ? 'tone-green' : 'tone-gold'}" data-daily-task-next-status data-id="${task.id}"><option value="pending" ${!done ? 'selected' : ''}>待推进</option><option value="done" ${done ? 'selected' : ''}>已完成</option></select></div></div>`;
    } else {
      const done = linkDoneState(item);
      const text = linkText(item);
      return `<div class="today-task-row ${done ? 'done' : ''}" ${blockAttrs(group, `daily:${item.id}`)}><span class="daily-block-handle today-row-index" draggable="true" aria-label="拖动第 ${index + 1} 行">${index + 1}</span><input type="checkbox" class="daily-task-check" data-action="toggle-daily-item" data-daily-date="${date}" data-daily-bucket="tomorrow" data-item-id="${item.id}" ${done ? 'checked' : ''}><span class="today-task-select" style="cursor:default;"><span class="today-task-copy"><input class="daily-block-title" data-daily-item-field="text" data-daily-date="${date}" data-daily-bucket="tomorrow" data-item-id="${item.id}" value="${inputValue(text)}" placeholder="填写计划内容"><small>明日计划 · ${item.linkRef ? '关联计划' : '计划块'}</small></span></span><div class="today-task-actions"><select class="daily-status-select ${done ? 'tone-green' : 'tone-gold'}" data-daily-plan-status data-date="${date}" data-bucket="tomorrow" data-item-id="${item.id}"><option value="pending" ${!done ? 'selected' : ''}>待推进</option><option value="done" ${done ? 'selected' : ''}>已完成</option></select><button class="today-task-add-subtask" data-action="delete-daily-item" data-daily-date="${date}" data-daily-bucket="tomorrow" data-item-id="${item.id}" aria-label="删除计划">×</button></div></div>`;
    }
  }).join('');
  const blankTomorrowRowCount = 2;
  const blankTomorrowRows = Array.from({ length: blankTomorrowRowCount }, (_, slot) => `<div class="today-task-row today-task-blank-row"><span class="today-row-index" aria-hidden="true">${tomorrowEntries.length + slot + 1}</span><span class="today-blank-check" aria-hidden="true"></span><input class="today-quick-task-input" data-daily-quick-tomorrow data-date="${date}" data-quick-slot="${slot}" aria-label="第 ${tomorrowEntries.length + slot + 1} 行新计划" placeholder="${slot === 0 ? '添加明天要推进的工作，按 Enter 继续' : ''}"><span class="today-blank-status">待推进</span></div>`).join('');
  const planPreview = (kind, key, sourcePlan) => {
    const items = sourcePlan.items || [];
    const group = `plan|${kind}|${key}`;
    const rows = sortWorkBlocks(items.map((item) => ({ kind, item }))).map(({ item }, index) => {
      const frozen = false;
      const done = linkDoneState(item);
      const text = linkText(item);
      const taskLink = isTaskLink(item);
      const sourceTag = taskLink ? '关联任务' : (item.linkRef ? '关联计划' : (kind === 'weekly' ? '周计划' : '月计划'));
      return `<div class="today-task-row ${done ? 'done' : ''}" ${blockAttrs(group, `${kind}:${item.id}`)}><span class="daily-block-handle today-row-index" draggable="true" aria-label="拖动第 ${index + 1} 行">${index + 1}</span><input type="checkbox" class="daily-task-check" data-action="toggle-plan-item" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}" ${done ? 'checked' : ''}><span class="today-task-select" style="cursor:default;"><span class="today-task-copy"><input class="daily-block-title" data-plan-item-field="text" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}" value="${inputValue(text)}" placeholder="填写计划内容"><small>${sourceTag}</small></span></span><div class="today-task-actions"><select class="daily-status-select ${done ? 'tone-green' : 'tone-gold'}" data-plan-block-status data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}"><option value="pending" ${!done ? 'selected' : ''}>待推进</option><option value="done" ${done ? 'selected' : ''}>已完成</option></select><button class="today-task-add-subtask" data-action="delete-plan-item" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}" aria-label="删除计划">×</button></div></div>`;
    }).join('');
    const blankCount = 2;
    const blankRows = Array.from({ length: blankCount }, (_, slot) => `<div class="today-task-row today-task-blank-row"><span class="today-row-index" aria-hidden="true">${items.length + slot + 1}</span><span class="today-blank-check" aria-hidden="true"></span><input class="today-quick-task-input" data-plan-quick data-plan-kind="${kind}" data-plan-key="${key}" data-quick-slot="${slot}" aria-label="第 ${items.length + slot + 1} 行新计划" placeholder="${slot === 0 ? '输入计划，按 Enter 到下一行' : ''}"><span class="today-blank-status">待推进</span></div>`).join('');
    return `<div class="today-task-list" data-sort-container data-sort-group="${group}">${rows || ''}${blankRows}</div>`;
  };

  const panelFreezeBtn = (key) => {
    const frozen = Boolean(dailyPanelLayout[key]?.frozen);
    return `<button type="button" class="daily-panel-freeze" data-action="toggle-daily-panel-freeze" title="${frozen ? '解冻模块' : '冻结模块'}"><i class="ri-${frozen ? 'lock-fill' : 'lock-unlock-line'}"></i></button>`;
  };
  const panelContent = {
    today: `${dailyTodayViewMode === 'board' ? `${todayBoard}` : `<div class="today-task-file-layout ${dailyTaskFileOpen ? '' : 'file-collapsed'}" data-task-split data-sort-container data-sort-group="daily|${date}|today" style="--task-split:${dailyTaskSplitRatio}"><aside class="today-task-list-pane"><div class="today-task-list-head"><span>今日任务</span><div class="daily-view-switch"><button class="${dailyTodayViewMode === 'list' ? 'active' : ''}" data-action="daily-view-mode" data-view-mode="list">文档</button><button class="${dailyTodayViewMode === 'board' ? 'active' : ''}" data-action="daily-view-mode" data-view-mode="board">看板</button></div><span class="today-task-count">${todayTaskEntries.length}</span></div><div class="today-task-list" data-sort-container data-sort-group="daily|${date}|today">${todayTaskEntries.map((entry, index) => dailyTaskListRow(entry.item, index)).join('')}${blankTaskRows}</div></aside>${dailyTaskFileOpen ? '<span class="today-task-divider" data-task-divider title="拖动调整左右宽度" aria-hidden="true"></span>' : ''}<div class="today-task-document-pane">${renderDailyTaskDocument(selectedTask)}</div></div>`}`,
    handoff: `<div class="today-task-list-head" style="background:#fafcfb;border-bottom:1px solid #e8efed"><span>昨日带入</span><span class="today-task-count">${handoffEntries.length}</span></div><div class="today-task-list" data-sort-container data-sort-group="${handoffGroup}">${inheritedRows || '<div class="daily-empty">昨日没有写下今天的计划。</div>'}</div>`,
    tomorrow: `<div class="today-task-list-head" style="background:#fafcfb;border-bottom:1px solid #e8efed"><span>明日计划</span><span class="today-task-count">${tomorrowEntries.length}</span><button class="today-task-add-btn" data-action="add-daily-item" data-daily-date="${date}" data-daily-bucket="tomorrow" style="pointer-events:auto" type="button"><i class="ri-add-line"></i></button></div><div class="today-task-list" data-sort-container data-sort-group="daily|${date}|tomorrow">${tomorrowBlocks}${blankTomorrowRows}</div>`,
    weekly: `<div class="today-task-list-head" style="background:#fafcfb;border-bottom:1px solid #e8efed"><span>本周计划</span><span class="today-task-count">${weeklyPlan.items?.length || 0}</span></div>${planPreview('weekly', weeklyKey, weeklyPlan)}`,
    monthly: `<div class="today-task-list-head" style="background:#fafcfb;border-bottom:1px solid #e8efed"><span>本月计划</span><span class="today-task-count">${monthlyPlan.items?.length || 0}</span></div>${planPreview('monthly', monthlyKey, monthlyPlan)}`,
  };
  const panelClasses = { today: 'daily-today-panel', handoff: 'handoff-panel', tomorrow: 'tomorrow-panel', weekly: 'period-panel', monthly: 'period-panel' };
  const panelSortGroups = { today: `daily|${date}|today`, handoff: handoffGroup, tomorrow: `daily|${date}|tomorrow`, weekly: `plan|weekly|${weeklyKey}`, monthly: `plan|monthly|${monthlyKey}` };
  const panels = activeDailyPanelKeys().slice().sort((a, b) => dailyPanelLayout[a].order - dailyPanelLayout[b].order).map((key) => {
    const frozen = Boolean(dailyPanelLayout[key].frozen);
    const geometry = dailyPanelGeometry(key);
    const panelName = key === 'today' ? '今日工作动态' : key === 'handoff' ? '昨日写下的今日计划' : key === 'tomorrow' ? '明日工作计划' : key === 'weekly' ? '本周计划' : '本月计划';
    const canResize = geometry.rowKeys.indexOf(key) < geometry.rowKeys.length - 1;
    return `<section class="card daily-panel resizable-daily-panel ${panelClasses[key]} ${frozen ? 'is-frozen' : ''}" data-daily-panel="${key}" data-sort-container data-sort-group="${panelSortGroups[key]}" style="--panel-span:${geometry.span};--panel-row:${geometry.row};--panel-col:${geometry.col}"><div class="daily-panel-topbar" data-daily-panel-move="${key}" role="button" tabindex="0" aria-label="拖动${panelName}板块" title="拖动板块"></div>${panelContent[key]}${canResize ? `<span class="daily-panel-resize" data-panel-resize="${key}" title="拖动调整当前行占比"></span>` : ''}</section>`;
  }).join('');
  const rowResizeHandles = dailyPanelRows().slice(0, -1).map((_, index) => `<span class="daily-row-resize" data-row-resize="${index}" role="separator" tabindex="0" aria-label="调整第 ${index + 1} 行高度" title="拖动调整上下行高度"></span>`).join('');

  return `<div class="daily-board-layout daily-board-layout--${dailyWorkspaceMode}" style="${dailyBoardRowsStyle()}">${panels}${rowResizeHandles}</div>`;
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
    rows.push({ id: item.id, sourceKey: 'daily', bucket, source: label, period: date, title: linkText(item) || '未命名计划', category: '日计划', planType: bucket === 'today' ? '今日执行' : '次日安排', statusKey: linkDoneState(item) ? 'done' : 'pending', status: linkDoneState(item) ? '已完成' : '待推进', score: null, tab: 'daily' });
  }
  for (const [kind, label, tab] of [['weekly', '周计划', 'weekly'], ['monthly', '月计划', 'monthlyPlan']]) for (const [period, plan] of Object.entries(state.plans[kind] || {})) for (const item of plan.items || []) {
    rows.push({ id: item.id, sourceKey: kind, source: label, period, title: linkText(item) || '未命名计划', category: label, planType: plan.title || label, statusKey: linkDoneState(item) ? 'done' : 'pending', status: linkDoneState(item) ? '已完成' : '待推进', score: null, tab });
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
  const quickType = viewSource || 'task';
  const quickSourceLabel = { task: '绩效任务', pool: '任务池', weekly: '周计划', monthly: '月计划' }[quickType] || '绩效任务';
  const blankSummaryRows = Array.from({ length: 2 }, (_, slot) => { const rowNumber = rows.length + slot + 1; return `<tr class="sheet-row summary-quick-blank-row"><td class="index-cell"><span class="row-number">${rowNumber}</span></td><td><span class="source-chip blue">${esc(quickSourceLabel)}</span></td><td class="summary-quick-na">—</td><td class="wide-cell"><input class="grid-input summary-quick-task-input" data-summary-quick-task data-quick-slot="${slot}" placeholder="${slot === 0 ? '输入内容，按 Enter 快速再建一条' : ''}" aria-label="第 ${rowNumber} 行新记录"></td><td class="summary-quick-na">—</td><td class="summary-quick-na">—</td><td class="summary-quick-na">—</td><td class="summary-quick-na">—</td><td class="summary-quick-na">—</td><td class="summary-quick-na">—</td><td class="summary-quick-na">—</td><td class="calc-cell summary-quick-na">—</td><td class="panorama-actions summary-quick-na">—</td></tr>`; }).join('');
  const viewMeta = { performance: ['绩效汇总', '全部任务与计划的数据库总视图。'], pool: ['任务池', '工作数据库中的任务池视图。'], weekly: ['周计划', '工作数据库中的周计划视图。'], monthly: ['月计划', '工作数据库中的月计划视图。'] }[selectedWorkspaceView] || ['绩效汇总', '全部任务与计划的数据库总视图。'];
  return `<div class="page-head panorama-page-head hub-section-head"><div><h1>${viewMeta[0]}</h1><p>${viewMeta[1]}</p></div><div class="task-save-state"><span class="status-dot"></span>共 ${databaseRows.length} 项数据</div></div>
    <div class="panorama-kpis">${cards.map(([label, value, note], index) => `<div class="card panorama-kpi tone-${index + 1}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join('')}</div>
    <div class="card smart-table-card summary-smart-table-card"><div class="sheet-viewbar"><div class="sheet-view-title"><span class="sheet-view-icon">表</span><strong>绩效与计划明细</strong></div><div class="sheet-view-tab active">全部记录 <span>${rows.length}</span></div></div><div class="smart-toolbar sheet-actionbar"><div class="toolbar-left"><div class="summary-create-group"><select id="summary-create-type" class="select" aria-label="新增事项类型"><option value="task">绩效任务</option><option value="pool">任务池事项</option><option value="daily-today">今日计划</option><option value="daily-tomorrow">明日计划</option><option value="weekly">周计划</option><option value="monthly">月计划</option></select><button class="sheet-add-button" data-action="add-summary-row"><span>+</span> 新增一行</button></div><span class="toolbar-divider"></span><label class="sheet-search"><span>⌕</span><input class="input" placeholder="搜索任务或计划" aria-label="搜索任务或计划" data-summary-filter="search" value="${esc(summaryFilters.search)}"></label><label class="sheet-filter"><span>来源类型</span><select class="select" data-summary-filter="source"><option value="">全部</option><option value="task" ${summaryFilters.source === 'task' ? 'selected' : ''}>绩效任务</option><option value="pool" ${summaryFilters.source === 'pool' ? 'selected' : ''}>任务池</option><option value="daily" ${summaryFilters.source === 'daily' ? 'selected' : ''}>日计划</option><option value="weekly" ${summaryFilters.source === 'weekly' ? 'selected' : ''}>周计划</option><option value="monthly" ${summaryFilters.source === 'monthly' ? 'selected' : ''}>月计划</option></select></label><label class="sheet-filter"><span>状态</span><select class="select" data-summary-filter="status"><option value="">全部</option><option value="done" ${summaryFilters.status === 'done' ? 'selected' : ''}>已完成</option><option value="pending" ${summaryFilters.status === 'pending' ? 'selected' : ''}>待推进</option><option value="error" ${summaryFilters.status === 'error' ? 'selected' : ''}>需修正</option></select></label></div><div class="table-count">当前视图 <strong>${rows.length}</strong> 条</div></div><div class="task-table-wrap smart-scroll"><table class="task-table sheet-table smart-table summary-sheet-table"><thead><tr><th class="index-header">#</th><th>来源</th><th>日期 / 周期</th><th class="wide-header">工作内容</th><th>工作分类</th><th>计划类型 / 主题</th><th>进度状态</th><th class="computed-header">预计工时</th><th class="computed-header">实际工时</th><th class="computed-header">自评分</th><th class="computed-header">负责人评分</th><th class="computed-header">任务得分</th><th>操作</th></tr></thead><tbody>${tableRows || '<tr><td colspan="13"><div class="empty">没有符合筛选条件的数据</div></td></tr>'}${blankSummaryRows}</tbody><tfoot><tr><td colspan="13"><button class="add-record" data-action="add-summary-row"><span>+</span> 新增记录</button><span class="footer-hint">单元格可直接编辑 · 修改后自动保存</span></td></tr></tfoot></table></div></div>`;
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
  return `<div class="page-head"><div><span class="eyebrow">${isWeekly ? 'Weekly Plan' : 'Monthly Plan'}</span><h1>${isWeekly ? '周计划' : '月计划'}</h1><p>${isWeekly ? '把本周最重要的事排清楚，再从任务池逐项推进。' : '用一个月的视角安排目标，避免只盯着眼前的零碎任务。'}</p></div><div class="head-controls"><label class="label">${isWeekly ? '选择日期' : '选择月份'}</label><input class="input" data-plan-date type="${isWeekly ? 'date' : 'month'}" value="${isWeekly ? selectedPlanDate : key}"></div></div><div class="plan-layout"><div class="card plan-main"><div class="plan-heading"><div><span class="eyebrow">${label}</span><input class="plan-title" data-plan-field="title" data-plan-kind="${kind}" data-plan-key="${key}" value="${inputValue(plan.title)}" placeholder="给这段时间一个清晰主题"></div><span class="tag">${items.filter((item) => linkDoneState(item)).length}/${items.length} 已完成</span></div><div class="plan-add"><input class="input" id="new-plan-item-${kind}" placeholder="添加一项计划"><button class="button primary" data-action="add-plan-item" data-plan-kind="${kind}" data-plan-key="${key}">添加</button></div><div class="plan-items">${items.map((item) => `<div class="plan-item ${linkDoneState(item) ? 'done' : ''}"><input type="checkbox" data-action="toggle-plan-item" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}" ${linkDoneState(item) ? 'checked' : ''}><input class="plan-item-text" data-plan-item-field="text" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}" value="${inputValue(linkText(item))}"><button class="link-button danger-link" data-action="delete-plan-item" data-plan-kind="${kind}" data-plan-key="${key}" data-item-id="${item.id}">删除</button></div>`).join('') || '<div class="pool-empty">还没有计划项，先添加一项最重要的事。</div>'}</div></div><div class="card plan-side"><h2>计划说明</h2><textarea class="textarea" data-plan-field="notes" data-plan-kind="${kind}" data-plan-key="${key}" placeholder="记录背景、风险、不要忘记的事情">${inputValue(plan.notes)}</textarea><div class="notice" style="margin-top:14px">任务池是执行层，${isWeekly ? '周计划' : '月计划'}是安排层。计划项可以先写目标，不必马上拆成完整绩效任务。</div></div></div>`;
}

function renderAcceptance() {
  const waitingPool = state.workItems.filter((item) => item.reviewer && item.status === 'done' && item.acceptanceStatus !== 'accepted');
  const projectGroups = (state.projects || []).map((project) => ({ project, items: collectProjectAcceptance(project) })).filter((g) => g.items.length);
  const projectTotal = projectGroups.reduce((sum, g) => sum + g.items.length, 0);
  const total = waitingPool.length + projectTotal;

  const poolSection = `<div class="acceptance-group">
    <div class="acceptance-group-head"><span class="acceptance-group-icon pool"><i class="ri-inbox-line"></i></span><div><strong>任务池</strong><small>独立事项的验收</small></div><span class="acceptance-group-count">${waitingPool.length}</span></div>
    ${waitingPool.length ? waitingPool.map((item) => `<div class="acceptance-item"><div><strong>${esc(item.title)}</strong><div class="task-sub">${esc(item.category)} · 截止 ${item.dueDate || '未设置'} · ${poolTag(item)}</div></div><div class="acceptance-actions"><button class="button primary" data-action="accept-pool" data-id="${item.id}">通过验收</button><button class="button ghost" data-action="rework-pool" data-id="${item.id}">退回修改</button></div></div>`).join('') : '<div class="acceptance-empty">暂无待验收事项</div>'}
  </div>`;

  const projectSections = projectGroups.map(({ project, items }) => `<div class="acceptance-group">
    <div class="acceptance-group-head"><span class="acceptance-group-icon project"><i class="ri-folder-line"></i></span><div><strong>${esc(project.name)}</strong><small>项目任务验收</small></div><span class="acceptance-group-count">${items.length}</span></div>
    ${items.map(({ task, milestone }) => `<div class="acceptance-item"><div><strong>${esc(task.title || '未命名任务')}</strong><div class="task-sub">${esc(milestone?.name || '')} · 验收人 ${esc(task.reviewer || '未指定')} · 截止 ${task.dueDate || '未设置'}</div></div><div class="acceptance-actions"><button class="link-button" data-action="open-project-task-acceptance" data-project-id="${esc(project.id)}" data-task-id="${esc(task.id)}">查看任务</button><button class="button primary" data-action="accept-project-task" data-project-id="${esc(project.id)}" data-task-id="${esc(task.id)}">通过验收</button><button class="button ghost" data-action="rework-project-task" data-project-id="${esc(project.id)}" data-task-id="${esc(task.id)}">退回修改</button></div></div>`).join('')}
  </div>`).join('');

  return `<div class="page-head"><div><span class="eyebrow">Acceptance Queue</span><h1>验收工作</h1><p>指定你为验收人的任务完成后，会自动按来源聚合到这里。</p></div><div class="head-controls"><span class="tag gold">${total} 项待处理</span></div></div>${total ? `<div class="acceptance-groups">${projectSections}${poolSection}</div>` : '<div class="card section-card acceptance-list"><div class="empty">暂时没有待验收任务</div></div>'}`;
}

function addQuickPoolItem() {
  const title = document.querySelector('#quick-title')?.value.trim();
  if (!title) return toast('先写下要做的事情');
  state.workItems.unshift({ id: crypto.randomUUID(), title, description: '', category: state.settings.taskCategories[0] || '其他', planType: '单人工作', priority: document.querySelector('#quick-priority')?.value || '普通', dueDate: document.querySelector('#quick-due')?.value || '', status: 'todo', reviewer: document.querySelector('#quick-reviewer')?.value.trim() || '', acceptanceStatus: '', performanceTaskId: '', createdAt: new Date().toISOString(), completedAt: '', owner: activeUser()?.name || '' });
  save(); render(); toast('已加入任务池');
}
function updatePoolField(target) {
  const item = state.workItems.find((entry) => entry.id === target.dataset.poolId); if (!item) return;
  const key = target.dataset.poolField;
  const previousReviewer = item.reviewer;
  item[key] = target.value;
  if (key === 'reviewer') notifyReviewerAssignment(item, previousReviewer);
  if (key === 'status' && target.value === 'done' && !item.completedAt) item.completedAt = new Date().toISOString();
  if (key === 'status' && target.value !== 'done') { item.completedAt = ''; item.acceptanceStatus = ''; }
  save(); render();
}
function addPlanItem(kind, key) {
  const input = document.querySelector(`#new-plan-item-${kind}`); const text = input?.value.trim(); if (!text) return toast('请输入计划内容');
  const plan = planFor(kind, key); plan.items.push({ id: crypto.randomUUID(), text, done: false }); save(); render();
}
function updatePlanField(target) { const plan = planFor(target.dataset.planKind, target.dataset.planKey); plan[target.dataset.planField] = target.value; save(); }
function updatePlanItem(target) { const plan = planFor(target.dataset.planKind, target.dataset.planKey); const item = plan.items.find((entry) => entry.id === target.dataset.itemId); if (item) { const canonical = resolveLinkTarget(item.linkRef) || item; canonical[isTaskLink(item) ? 'content' : 'text'] = target.value; save(); } }

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

function commitQuickDailyTask(input, focusNext = false) {
  if (!input || input.dataset.committing === '1') return false;
  const text = input.value.trim();
  if (!text) {
    if (focusNext) {
      const nextSlot = Number(input.dataset.quickSlot) + 1;
      document.querySelector(`[data-daily-quick-task][data-quick-slot="${nextSlot}"]`)?.focus();
    }
    return false;
  }
  input.dataset.committing = '1';
  const date = input.dataset.date || selectedDailyDate;
  const maxOrder = state.tasks.filter((task) => task.date === date).reduce((highest, task) => Math.max(highest, Number(task.order) || 0), 0);
  const task = makeTaskRecord(text, date, { order: maxOrder + 10 });
  state.tasks.push(task);
  selectedDailyTaskId = task.id;
  localStorage.setItem(userPreferenceKey('performance-selected-daily-task'), selectedDailyTaskId);
  save();
  render();
  if (focusNext) setTimeout(() => document.querySelector('[data-daily-quick-task][data-quick-slot="0"]')?.focus(), 0);
  return true;
}

function commitQuickKanbanTask(input, focusNext = false) {
  if (!input || input.dataset.committing === '1') return false;
  const text = input.value.trim();
  const status = input.dataset.kanbanStatus || 'todo';
  if (!text) {
    if (focusNext) {
      const nextSlot = Number(input.dataset.quickSlot) + 1;
      document.querySelector(`[data-kanban-quick][data-kanban-status="${status}"][data-quick-slot="${nextSlot}"]`)?.focus();
    }
    return false;
  }
  input.dataset.committing = '1';
  const date = input.dataset.date || selectedDailyDate;
  const completionPct = { todo: 0, doing: 50, done: 100 }[status] ?? 0;
  const maxOrder = state.tasks.filter((task) => task.date === date).reduce((highest, task) => Math.max(highest, Number(task.order) || 0), 0);
  const task = makeTaskRecord(text, date, { order: maxOrder + 10, completionPct });
  state.tasks.push(task);
  selectedDailyTaskId = task.id;
  localStorage.setItem(userPreferenceKey('performance-selected-daily-task'), selectedDailyTaskId);
  save();
  render();
  if (focusNext) setTimeout(() => document.querySelector(`[data-kanban-quick][data-kanban-status="${status}"][data-quick-slot="0"]`)?.focus(), 0);
  return true;
}

function commitQuickTomorrowItem(input, focusNext = false) {
  if (!input || input.dataset.committing === '1') return false;
  const text = input.value.trim();
  if (!text) {
    if (focusNext) {
      const nextSlot = Number(input.dataset.quickSlot) + 1;
      document.querySelector(`[data-daily-quick-tomorrow][data-quick-slot="${nextSlot}"]`)?.focus();
    }
    return false;
  }
  input.dataset.committing = '1';
  const date = input.dataset.date || selectedDailyDate;
  const plan = dailyPlanFor(date);
  const maxOrder = (plan.tomorrow || []).reduce((highest, item) => Math.max(highest, Number(item.order) || 0), 0);
  plan.tomorrow.push({ id: crypto.randomUUID(), text, done: false, order: maxOrder + 10 });
  save();
  render();
  if (focusNext) setTimeout(() => document.querySelector('[data-daily-quick-tomorrow][data-quick-slot="0"]')?.focus(), 0);
  return true;
}

function commitQuickPlanItem(input, focusNext = false) {
  if (!input || input.dataset.committing === '1') return false;
  const text = input.value.trim();
  if (!text) {
    if (focusNext) {
      const nextSlot = Number(input.dataset.quickSlot) + 1;
      const kind = input.dataset.planKind;
      const key = input.dataset.planKey;
      document.querySelector(`[data-plan-quick][data-plan-kind="${kind}"][data-plan-key="${key}"][data-quick-slot="${nextSlot}"]`)?.focus();
    }
    return false;
  }
  input.dataset.committing = '1';
  const kind = input.dataset.planKind;
  const key = input.dataset.planKey;
  const plan = planFor(kind, key);
  const maxOrder = (plan.items || []).reduce((highest, item) => Math.max(highest, Number(item.order) || 0), 0);
  plan.items.push({ id: crypto.randomUUID(), text, done: false, order: maxOrder + 10 });
  save();
  render();
  if (focusNext) setTimeout(() => document.querySelector(`[data-plan-quick][data-plan-kind="${kind}"][data-plan-key="${key}"][data-quick-slot="0"]`)?.focus(), 0);
  return true;
}

function createQuickSummaryItem(type, text) {
  const today = dateToISO(new Date());
  if (type === 'task' || type === 'daily-today') {
    state.tasks.unshift(makeTaskRecord(text, today));
  } else if (type === 'pool') {
    state.workItems.unshift({ id: crypto.randomUUID(), title: text, description: '', category: state.settings.taskCategories[0] || '其他', planType: '单人工作', priority: '普通', dueDate: today, status: 'todo', reviewer: '', acceptanceStatus: '', performanceTaskId: '', createdAt: new Date().toISOString(), completedAt: '', owner: activeUser()?.name || '' });
  } else if (type === 'daily-tomorrow') {
    dailyPlanFor(today).tomorrow.unshift({ id: crypto.randomUUID(), text, done: false });
  } else if (type === 'weekly') {
    planFor('weekly', weekKey(today)).items.unshift({ id: crypto.randomUUID(), text, done: false });
  } else {
    planFor('monthly', today.slice(0, 7)).items.unshift({ id: crypto.randomUUID(), text, done: false });
  }
}

function commitQuickSummaryRow(input, focusNext = false) {
  if (!input || input.dataset.committing === '1') return false;
  const text = input.value.trim();
  if (!text) {
    if (focusNext) {
      const nextSlot = Number(input.dataset.quickSlot) + 1;
      document.querySelector(`[data-summary-quick-task][data-quick-slot="${nextSlot}"]`)?.focus();
    }
    return false;
  }
  input.dataset.committing = '1';
  const type = document.querySelector('#summary-create-type')?.value || ({ pool: 'pool', weekly: 'weekly', monthly: 'monthly' }[selectedWorkspaceView] || 'task');
  createQuickSummaryItem(type, text);
  save();
  render();
  if (focusNext) setTimeout(() => document.querySelector('[data-summary-quick-task][data-quick-slot="0"]')?.focus(), 0);
  return true;
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

function assessmentReviewFor(key, templateId, create = false) {
  const monthReview = state.monthlyReviews[key] || (create ? (state.monthlyReviews[key] = {}) : {});
  const reviews = monthReview.assessmentReviews || (create ? (monthReview.assessmentReviews = {}) : {});
  const review = reviews[templateId] || (create ? (reviews[templateId] = { indicators: {} }) : {});
  if (create && !review.indicators) review.indicators = {};
  return review;
}

function boundedOptionalScore(value, maximum) {
  if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Math.min(maximum, Math.max(0, Number(value)));
}

function automaticAssessmentValue(template, indicator, key) {
  if (template.id !== DEFAULT_TEMPLATE_ID || !indicator.autoSource) return { actualValue: '', score: null };
  const [year, month] = key.split('-').map(Number);
  const legacyMonth = calculateMonth(year, month, state);
  if (indicator.autoSource === 'dailyPerformance') {
    return { actualValue: legacyMonth.averageDailyPerformance === null ? '' : pct(legacyMonth.averageDailyPerformance), score: legacyMonth.averageDailyPerformance === null ? null : legacyMonth.averageDailyPerformance * indicator.weight / 100 };
  }
  const value = boundedOptionalScore(legacyMonth.review?.[indicator.autoSource], 100);
  return { actualValue: value === null ? '' : `${num(value, 1)} / 100`, score: value === null ? null : value * indicator.weight / 100 };
}

function assessmentReviewSummary(review, template, key) {
  const indicators = template.dimensions.flatMap((dimension) => dimension.indicators);
  const indicatorScore = (indicator) => {
    const values = review.indicators?.[indicator.id] || {};
    return boundedOptionalScore(values.finalScore, indicator.weight)
      ?? boundedOptionalScore(values.supervisorScore, indicator.weight)
      ?? boundedOptionalScore(values.selfScore, indicator.weight)
      ?? automaticAssessmentValue(template, indicator, key).score
      ?? 0;
  };
  const maximum = indicators.reduce((sum, indicator) => sum + indicator.weight, 0);
  const subtotal = Math.min(maximum, indicators.reduce((sum, indicator) => sum + indicatorScore(indicator), 0));
  const deduction = boundedOptionalScore(review.disciplineDeduction, template.penaltyMax) ?? 0;
  const legacyBonus = template.id === DEFAULT_TEMPLATE_ID ? boundedOptionalScore(state.monthlyReviews[key]?.innovationBonus, template.bonusMax) : null;
  const bonus = boundedOptionalScore(review.innovationBonus, template.bonusMax) ?? legacyBonus ?? 0;
  const total = Math.max(0, subtotal - deduction + bonus);
  const grade = total >= 95 ? 'S' : total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 60 ? 'C' : 'D';
  return { indicatorScore, maximum, subtotal, deduction, bonus, total, grade };
}

function renderAssessmentMonthly(template) {
  const key = selectedMonthKey();
  const review = assessmentReviewFor(key, template.id);
  const summary = assessmentReviewSummary(review, template, key);
  const scoreInput = (indicator, field, label) => {
    const value = review.indicators?.[indicator.id]?.[field] ?? '';
    const fallback = field === 'finalScore' ? summary.indicatorScore(indicator) : '—';
    return `<input class="input operations-score-input" type="number" min="0" max="${indicator.weight}" step="0.1" aria-label="${label}" data-operations-score="${field}" data-template-id="${template.id}" data-review-month="${key}" data-indicator-id="${indicator.id}" value="${inputValue(value)}" placeholder="${fallback}">`;
  };
  const rows = template.dimensions.map((dimension) => dimension.indicators.map((indicator, index) => {
    const indicatorReview = review.indicators?.[indicator.id] || {};
    const automatic = automaticAssessmentValue(template, indicator, key);
    return `<tr>${index === 0 ? `<th class="operations-dimension" rowspan="${dimension.indicators.length}"><strong>${esc(dimension.name)}</strong><span>${dimension.weight}%</span></th>` : ''}<td class="operations-indicator"><strong>${esc(indicator.name)}</strong></td><td class="operations-weight">${indicator.weight}%</td><td class="operations-standard">${esc(indicator.standard)}</td><td><input class="input operations-actual-input" data-operations-score="actualValue" data-template-id="${template.id}" data-review-month="${key}" data-indicator-id="${indicator.id}" value="${inputValue(indicatorReview.actualValue)}" placeholder="${inputValue(automatic.actualValue || '百分比、数量或说明')}"></td><td>${scoreInput(indicator, 'selfScore', '自评得分')}</td><td>${scoreInput(indicator, 'supervisorScore', '上级评分')}</td><td class="operations-final">${scoreInput(indicator, 'finalScore', '最后得分')}<small>采用 ${num(summary.indicatorScore(indicator), 1)}</small></td><td><input class="input operations-note-input" data-operations-score="note" data-template-id="${template.id}" data-review-month="${key}" data-indicator-id="${indicator.id}" value="${inputValue(indicatorReview.note)}" placeholder="备注"></td></tr>`;
  }).join('')).join('');
  const monthOptions = Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${currentMonth === index + 1 ? 'selected' : ''}>${currentYear()} 年 ${index + 1} 月</option>`).join('');
  const penaltyMax = template.penaltyMax ?? 100;
  const bonusMax = template.bonusMax ?? 10;
  return `${renderProfileStrip()}<div class="page-head operations-page-head"><div><span class="eyebrow">Monthly Scorecard</span><h1>${esc(template.name)}考核表</h1><p>${esc(activeUser()?.name || '当前用户')} · ${esc(template.role)} · 指标合计 ${summary.maximum} 分，另设扣分与加分项。</p></div><div class="head-controls"><label class="label" for="assessment-month">考核月份</label><select id="assessment-month" class="select" data-month-select>${monthOptions}</select><button class="button primary" data-action="export-json">备份当前数据</button></div></div><div class="operations-summary"><div><span>指标得分</span><strong>${num(summary.subtotal, 1)}</strong><small>/ ${summary.maximum}</small></div><div><span>纪律扣分</span><strong class="negative">-${num(summary.deduction, 1)}</strong></div><div><span>创新加分</span><strong class="positive">+${num(summary.bonus, 1)}</strong></div><div class="total"><span>最终绩效</span><strong>${num(summary.total, 1)}</strong><b>${summary.grade} 级</b></div></div><div class="card operations-scorecard"><div class="task-table-wrap"><table class="operations-table"><thead><tr><th>考核维度</th><th>考核指标</th><th>权重</th><th>评分标准</th><th>实际完成值</th><th>自评得分</th><th>上级评分</th><th>最后得分</th><th>备注</th></tr></thead><tbody>${rows}<tr class="operations-special-row"><th>纪律性及忠诚度</th><td><strong>违法违规、泄密或其他纪律问题</strong></td><td>扣分项</td><td>按事件影响扣分，本项最多扣 ${penaltyMax} 分</td><td colspan="3"><input class="input" data-operations-special="disciplineDeduction" data-template-id="${template.id}" data-review-month="${key}" type="number" min="0" max="${penaltyMax}" step="1" value="${inputValue(review.disciplineDeduction)}" placeholder="填写扣分 0-${penaltyMax}"></td><td><strong>-${num(summary.deduction, 1)}</strong></td><td><input class="input" data-operations-special="disciplineNote" data-template-id="${template.id}" data-review-month="${key}" value="${inputValue(review.disciplineNote)}" placeholder="情况说明"></td></tr><tr class="operations-special-row bonus"><th>积极创新</th><td><strong>管理、业务、产品创新或重大贡献 / 节省成本</strong></td><td>加分项</td><td>按实际价值加分，本项最多加 ${bonusMax} 分</td><td colspan="3"><input class="input" data-operations-special="innovationBonus" data-template-id="${template.id}" data-review-month="${key}" type="number" min="0" max="${bonusMax}" step="0.1" value="${inputValue(review.innovationBonus)}" placeholder="填写加分 0-${bonusMax}"></td><td><strong>+${num(summary.bonus, 1)}</strong></td><td><input class="input" data-operations-special="innovationNote" data-template-id="${template.id}" data-review-month="${key}" value="${inputValue(review.innovationNote)}" placeholder="价值说明"></td></tr></tbody></table></div></div><div class="operations-grade-legend"><span><b>S</b> 95 分及以上</span><span><b>A</b> 85-94 分</span><span><b>B</b> 70-84 分</span><span><b>C</b> 60-69 分</span><span><b>D</b> 60 分以下</span><strong>70 分以下不合格</strong></div>`;
}

function renderMonthly() {
  return renderAssessmentMonthly(assessmentTemplate(activeUser()?.assessmentTemplateId));
}

function makeTemplateIndicator(indicator = {}) {
  return { id: String(indicator.id || crypto.randomUUID()), name: String(indicator.name || ''), weight: indicator.weight ?? '', standard: String(indicator.standard || ''), ...(indicator.autoSource ? { autoSource: indicator.autoSource } : {}) };
}

function makeTemplateDimension(dimension = {}) {
  const indicators = Array.isArray(dimension.indicators) && dimension.indicators.length ? dimension.indicators.map(makeTemplateIndicator) : [makeTemplateIndicator()];
  return { name: String(dimension.name || ''), indicators };
}

function templateEditorTotalWeight() {
  return editingTemplateDimensions.reduce((total, dimension) => total + dimension.indicators.reduce((sum, indicator) => sum + (Number(indicator.weight) || 0), 0), 0);
}

function syncTemplateEditorWeight() {
  const node = $('#template-total-weight');
  if (!node) return;
  const total = templateEditorTotalWeight();
  node.textContent = `${num(total, 1)} / 100`;
  node.classList.toggle('valid', Math.abs(total - 100) < 0.001);
}

function renderTemplateDimensionsEditor() {
  const root = $('#template-dimensions-editor');
  if (!root) return;
  root.innerHTML = editingTemplateDimensions.map((dimension, dimensionIndex) => {
    const weight = dimension.indicators.reduce((sum, indicator) => sum + (Number(indicator.weight) || 0), 0);
    return `<section class="template-builder-dimension"><div class="template-builder-dimension-head"><span class="template-builder-index">${dimensionIndex + 1}</span><input class="input" data-template-dimension-field="name" data-dimension-index="${dimensionIndex}" value="${inputValue(dimension.name)}" placeholder="维度名称，例如：销售业绩管理"><strong>${num(weight, 1)}%</strong><button type="button" class="icon-button template-builder-remove" data-action="remove-template-dimension" data-dimension-index="${dimensionIndex}" aria-label="删除维度">×</button></div><div class="template-builder-indicators">${dimension.indicators.map((indicator, indicatorIndex) => `<div class="template-builder-indicator"><input class="input" data-template-indicator-field="name" data-dimension-index="${dimensionIndex}" data-indicator-index="${indicatorIndex}" value="${inputValue(indicator.name)}" placeholder="考核指标"><label><input class="input" type="number" min="0.1" max="100" step="0.1" data-template-indicator-field="weight" data-dimension-index="${dimensionIndex}" data-indicator-index="${indicatorIndex}" value="${inputValue(indicator.weight)}" placeholder="权重"><span>%</span></label><input class="input" data-template-indicator-field="standard" data-dimension-index="${dimensionIndex}" data-indicator-index="${indicatorIndex}" value="${inputValue(indicator.standard)}" placeholder="评分标准"><button type="button" class="icon-button template-builder-remove" data-action="remove-template-indicator" data-dimension-index="${dimensionIndex}" data-indicator-index="${indicatorIndex}" aria-label="删除指标">×</button></div>`).join('')}</div><button type="button" class="button ghost template-builder-add" data-action="add-template-indicator" data-dimension-index="${dimensionIndex}">+ 添加考核指标</button></section>`;
  }).join('');
  syncTemplateEditorWeight();
}

function openAssessmentTemplateDialog(templateId = '', duplicate = false) {
  const source = templateId ? assessmentTemplate(templateId) : null;
  const editableSource = source && !duplicate;
  editingAssessmentTemplateId = editableSource ? source.id : null;
  editingTemplateDimensions = (source?.dimensions || [makeTemplateDimension()]).map(makeTemplateDimension);
  $('#template-dialog-title').textContent = editableSource ? '编辑绩效模板' : (source ? '复制绩效模板' : '新增绩效模板');
  $('#template-form-fields').innerHTML = `<div class="template-builder-basics"><label class="form-field"><span class="label">模板名称 *</span><input class="input" name="name" maxlength="50" required value="${inputValue(source ? `${source.name}${duplicate ? ' 副本' : ''}` : '')}" placeholder="例如：销售经理月度绩效"></label><label class="form-field"><span class="label">适用岗位 *</span><input class="input" name="role" maxlength="40" required value="${inputValue(source?.role)}" placeholder="例如：销售经理"></label><label class="form-field full"><span class="label">模板说明</span><input class="input" name="description" maxlength="160" value="${inputValue(source?.description)}" placeholder="简要说明考核重点"></label><label class="form-field"><span class="label">纪律扣分上限</span><input class="input" name="penaltyMax" type="number" min="0" max="100" value="${inputValue(source?.penaltyMax ?? 100)}"></label><label class="form-field"><span class="label">创新加分上限</span><input class="input" name="bonusMax" type="number" min="0" max="100" value="${inputValue(source?.bonusMax ?? 10)}"></label></div><div class="template-builder-title"><div><strong>考核维度与指标</strong><small>维度权重由其指标权重自动合计</small></div><span>总权重 <b id="template-total-weight">0 / 100</b></span></div><div id="template-dimensions-editor"></div><button type="button" class="button template-add-dimension" data-action="add-template-dimension">+ 添加考核维度</button>`;
  renderTemplateDimensionsEditor();
  $('#template-dialog').showModal();
  $('#template-form [name="name"]')?.focus();
}

function closeAssessmentTemplateDialog() {
  editingAssessmentTemplateId = null;
  editingTemplateDimensions = [];
  $('#template-dialog').close();
}

function saveAssessmentTemplateFromDialog() {
  const data = Object.fromEntries(new FormData($('#template-form')).entries());
  const name = String(data.name || '').trim();
  const role = String(data.role || '').trim();
  if (!name || !role) return toast('请填写模板名称和适用岗位');
  if (ASSESSMENT_TEMPLATES.some((template) => template.id !== editingAssessmentTemplateId && template.name.toLowerCase() === name.toLowerCase())) return toast('已存在同名模板');
  if (editingTemplateDimensions.some((dimension) => !dimension.name.trim() || !dimension.indicators.length || dimension.indicators.some((indicator) => !indicator.name.trim() || !(Number(indicator.weight) > 0)))) return toast('请完整填写维度、指标和权重');
  const totalWeight = templateEditorTotalWeight();
  if (Math.abs(totalWeight - 100) >= 0.001) return toast(`当前总权重为 ${num(totalWeight, 1)}%，请调整为 100%`);
  const template = normalizeAssessmentTemplate({
    id: editingAssessmentTemplateId || `custom-${crypto.randomUUID()}`,
    name,
    role,
    description: data.description,
    penaltyMax: data.penaltyMax,
    bonusMax: data.bonusMax,
    dimensions: editingTemplateDimensions,
  });
  if (!template) return toast('模板内容不完整');
  const existingIndex = customAssessmentTemplates.findIndex((item) => item.id === template.id);
  if (existingIndex >= 0) customAssessmentTemplates[existingIndex] = template; else customAssessmentTemplates.push(template);
  saveAssessmentTemplateLibrary();
  closeAssessmentTemplateDialog();
  render();
  toast(existingIndex >= 0 ? '绩效模板已更新' : '绩效模板已添加，可分配给人员');
}

function viewAssessmentTemplate(templateId) {
  const template = assessmentTemplate(templateId);
  if (!template) return;
  const assigned = users.filter((user) => assessmentTemplate(user.assessmentTemplateId).id === template.id);
  $('#template-view-title').textContent = template.name;
  const editButton = $('#template-view-edit');
  if (editButton) editButton.dataset.templateId = template.id;
  $('#template-view-fields').innerHTML = `<div class="template-view-head"><div><span class="template-role">${esc(template.role)}</span>${template.builtIn ? '<span class="tag">系统内置</span>' : '<span class="tag green">自定义模板</span>'}</div><span class="template-assigned">${assigned.length} 人使用</span></div><p class="template-view-desc">${esc(template.description || '暂无说明')}</p><div class="template-view-stats"><div><small>纪律扣分上限</small><strong>${esc(template.penaltyMax ?? 100)} 分</strong></div><div><small>创新加分上限</small><strong>${esc(template.bonusMax ?? 10)} 分</strong></div><div><small>考核维度</small><strong>${template.dimensions.length} 个</strong></div><div><small>考核指标</small><strong>${template.dimensions.reduce((sum, dimension) => sum + dimension.indicators.length, 0)} 项</strong></div></div><div class="template-view-dimensions">${template.dimensions.map((dimension) => `<div class="template-view-dimension"><div class="template-view-dimension-head"><strong>${esc(dimension.name)}</strong><span>${dimension.weight}%</span></div><div class="template-view-indicators">${dimension.indicators.map((indicator) => `<div class="template-view-indicator"><span class="template-view-indicator-name"><strong>${esc(indicator.name)}</strong><small>${esc(indicator.standard || '未填写评分标准')}</small></span><b>${indicator.weight}%</b></div>`).join('')}</div></div>`).join('')}</div>${assigned.length ? `<div class="template-view-people"><small>使用人员</small><div class="template-people">${assigned.map((user) => `<span>${esc(user.name)}</span>`).join('')}</div></div>` : ''}`;
  $('#template-view-dialog').showModal();
}

function deleteAssessmentTemplate(templateId) {
  const template = assessmentTemplate(templateId);
  if (!template) return;
  if (ASSESSMENT_TEMPLATES.length <= 1) return toast('至少保留一套绩效模板');
  const assigned = users.filter((user) => assessmentTemplate(user.assessmentTemplateId).id === template.id);
  const confirmText = assigned.length ? `模板“${template.name}”正在被 ${assigned.length} 名用户使用，删除后这些用户将自动切换到默认模板。确认删除？` : `确认删除模板“${template.name}”？`;
  openConfirmDialog('删除模板', confirmText, () => {
    if (template.builtIn) deletedBuiltinTemplateIds.push(template.id);
    else customAssessmentTemplates = customAssessmentTemplates.filter((item) => item.id !== template.id);
    saveAssessmentTemplateLibrary();
    const fallback = ASSESSMENT_TEMPLATES[0];
    let reassigned = 0;
    users.forEach((user) => {
      if (user.assessmentTemplateId === templateId) { user.assessmentTemplateId = fallback.id; reassigned += 1; }
    });
    if (reassigned) saveUserDirectory();
    render();
    toast(reassigned ? `模板已删除，${reassigned} 名用户已切换默认模板` : '模板已删除');
  });
}

function renderTemplateLibrary() {
  return `<section class="template-library"><div class="section-title"><div><h2>绩效模板库</h2><p>所有模板统一使用月度考核表，可在用户资料或页面顶部为每个人分配。</p></div><div class="template-library-actions"><span class="tag green">${ASSESSMENT_TEMPLATES.length} 套模板</span><button class="button primary" data-action="add-assessment-template">+ 新增模板</button></div></div><div class="template-grid">${ASSESSMENT_TEMPLATES.map((template) => {
    const assigned = users.filter((user) => assessmentTemplate(user.assessmentTemplateId).id === template.id);
    return `<article class="card template-card ${template.id === activeUser()?.assessmentTemplateId ? 'active' : ''}"><div class="template-card-head"><div><span class="template-role">${esc(template.role)}</span><h3>${esc(template.name)}</h3></div><span class="template-assigned">${assigned.length} 人使用</span></div><p>${esc(template.description)}</p><div class="template-dimensions">${template.dimensions.map((dimension) => `<details><summary><span>${esc(dimension.name)}</span><strong>${dimension.weight}%</strong></summary><ul>${dimension.indicators.map((indicator) => `<li><span><strong>${esc(indicator.name)}</strong><small>${esc(indicator.standard)}</small></span><b>${indicator.weight}%</b></li>`).join('')}</ul></details>`).join('')}</div><div class="template-card-foot"><div class="template-people">${assigned.length ? assigned.map((user) => `<span>${esc(user.name)}</span>`).join('') : '<small>尚未分配人员</small>'}</div><div class="template-card-actions"><button class="link-button" data-action="view-assessment-template" data-template-id="${template.id}">查看详情</button><button class="link-button" data-action="duplicate-assessment-template" data-template-id="${template.id}">复制</button><button class="link-button" data-action="edit-assessment-template" data-template-id="${template.id}">编辑</button><button class="link-button danger-link" data-action="delete-assessment-template" data-template-id="${template.id}">删除</button></div></div></article>`;
  }).join('')}</div></section>`;
}

function renderParams() {
  const s = state.settings;
  const categories = s.taskCategories || TASK_CATEGORIES;
  const categorySection = `<div class="card form-section category-card"><h2>工作分类</h2><p class="helper">这些选项会出现在任务录入的"工作分类"下拉框中。</p><div class="category-add"><input id="new-category" class="input" placeholder="新增工作分类"><button class="button primary" data-action="add-category">添加</button></div><div class="category-list">${categories.map((category) => `<span class="category-chip">${esc(category)}<button class="category-remove" data-action="remove-category" data-category="${esc(category)}" aria-label="删除 ${esc(category)}">×</button></span>`).join('')}</div></div>`;
  const fieldConfigSection = renderFieldConfigPanel(state);
  return `<div class="page-head"><div><span class="eyebrow">Parameters</span><h1>参数设置</h1><p>默认值沿用原 Excel，可按公司口径调整。</p></div><div class="head-controls"><button class="button danger" data-action="reset">恢复默认</button></div></div><div class="settings-grid">${[['standardDayHours', '标准日工时 (h)', '用于填充每日绩效水位'], ['baseRewardPerHour', '基础奖励分 / 小时', '默认为 100 ÷ 标准日工时'], ['plannedOverageFactor', '计划内超额奖励系数', '单人 + 协同'], ['expansionFactor', '拓展工作奖励系数', '正常工作时间的额外工作'], ['overtimeFactor', '加班工作奖励系数', '加班额外工作'], ['efficiencyMin', '效率系数下限', '避免预计工时偏差导致过度扣分'], ['efficiencyMax', '效率系数上限', '避免效率系数无限放大'], ['monthlyInnovationMax', '月度创新加分上限', '默认 10 分']].map(([key,label,help]) => `<label class="field"><span class="label">${label}</span><input class="input" type="number" step="0.01" data-setting="${key}" value="${inputValue(s[key])}"><span class="helper">${help}</span></label>`).join('')}</div></div><div class="card form-section"><h2>权重与等级</h2><div class="settings-form">${[['dailyPerformanceWeight', '日常表现权重', '默认 0.8'], ['competencyWeight', '综合素养权重', '默认 0.2'], ['gradeThresholds.S', 'S 等级起点', ''], ['gradeThresholds.A', 'A 等级起点', ''], ['gradeThresholds.B', 'B 等级起点', ''], ['gradeThresholds.C', 'C 等级起点', '']].map(([key,label,help]) => `<label class="field"><span class="label">${label}</span><input class="input" type="number" step="0.01" data-setting="${key}" value="${inputValue(key.startsWith('grade') ? s.gradeThresholds[key.split('.')[1]] : s[key])}"><span class="helper">${help}</span></label>`).join('')}</div><div class="notice" style="margin-top:16px">月度最终绩效 = 平均每日绩效 × 日常表现权重 + 综合素养评分 × 综合素养权重 + 积极创新加分。</div></div><div class="card form-section"><h2>日历与工作日</h2><div class="settings-form"><label class="field"><span class="label">日期</span><input id="override-date" class="input" type="date"></label><label class="field"><span class="label">日历类型</span><select id="override-kind" class="select"><option value="workday">工作日</option><option value="holiday">节假日</option></select></label><label class="field"><span class="label">标准工时 (可选)</span><input id="override-hours" class="input" type="number" step="0.01" placeholder="留空使用默认值"></label><label class="field" style="align-self:end"><button class="button primary" data-action="add-override">添加日期覆盖</button></label></div><div class="mini-list" style="margin-top:16px">${Object.entries(state.calendarOverrides).length ? Object.entries(state.calendarOverrides).map(([date, override]) => `<div class="mini-row"><strong>${date}</strong><span>${override.kind === 'holiday' ? '节假日' : 'workday · ' + (override.hours ?? '默认') + ' h'} <button class="link-button" data-action="remove-override" data-date="${date}">移除</button></span></div>`).join('') : '<div class="empty">尚未配置特殊日期</div>'}</div></div>${categorySection}${fieldConfigSection}<div class="card form-section"><h2>当前计算口径</h2><div class="rule-list"><div class="rule-item"><strong>工时水位</strong><p>计划内（单人 + 协同）→ 拓展 → 加班，依次填充当天标准工时。</p></div><div class="rule-item"><strong>奖励门槛</strong><p>只有当日绩效和月度最终绩效均达到 100% 时，奖励才兑现。</p></div><div class="rule-item"><strong>数据安全</strong><p>数据仅保存在当前浏览器。建议定期导出 JSON 备份，换设备时导入恢复。</p></div></div></div></div>`;
}

function renderSystemSettings() {
  return `<div class="page-head"><div><span class="eyebrow">System Settings</span><h1>系统设置</h1><p>管理数据、用户与系统偏好，所有数据默认保存在当前浏览器。</p></div></div><div class="settings-grid"><div class="card form-section"><h2>数据与备份</h2><p class="helper">数据默认保存在当前浏览器本地，建议定期导出备份以防丢失。</p><div class="sys-action-list"><button class="button" data-action="import-trigger"><i class="ri-upload-line"></i> 导入 Excel</button><button class="button" data-action="export-json"><i class="ri-save-line"></i> 备份 JSON</button><button class="button primary" data-action="export-excel"><i class="ri-file-excel-2-line"></i> 导出 Excel</button><button class="button danger" data-action="reset">恢复默认</button></div><div class="notice warn" style="margin-top:14px">「恢复默认」会清除当前所有本地数据，操作前请先导出备份。</div></div><div class="card form-section"><h2>工作空间</h2><div class="sys-stat-grid"><div class="sys-stat"><strong>${users.length}</strong><small>用户工作空间</small></div><div class="sys-stat"><strong>${ASSESSMENT_TEMPLATES.length}</strong><small>绩效模板</small></div><div class="sys-stat"><strong>${state.tasks.length}</strong><small>绩效任务</small></div><div class="sys-stat"><strong>${state.workItems.length}</strong><small>任务池事项</small></div></div><button class="button" data-action="add-user" style="margin-top:14px"><i class="ri-user-add-line"></i> 新建用户</button></div><div class="card form-section"><h2>数据安全</h2><div class="rule-list"><div class="rule-item"><strong>本地存储</strong><p>数据仅保存在当前浏览器的本地存储中，不会上传到任何服务器。</p></div><div class="rule-item"><strong>换设备迁移</strong><p>导出 JSON 备份后，在新设备导入即可恢复完整工作空间。</p></div><div class="rule-item"><strong>清除浏览器缓存</strong><p>清除站点数据会同时删除全部绩效记录，请务必先备份。</p></div></div></div><div class="card form-section"><h2>关于系统</h2><div class="rule-list"><div class="rule-item"><strong>绩效考核工作台</strong><p>版本 v1.0 · 专注绩效 · 驱动成长</p></div><div class="rule-item"><strong>功能范围</strong><p>每日工作台、绩效看板、工作全景、验收工作、月度绩效、参数设置。</p></div></div></div></div>`;
}

function openPromptDialog(title, label, defaultValue, onConfirm) {
  $('#prompt-dialog-title').textContent = title;
  $('#prompt-dialog-label').textContent = label;
  const input = $('#prompt-dialog-input');
  input.value = defaultValue || '';
  promptResolve = onConfirm;
  $('#prompt-dialog').showModal();
  setTimeout(() => input.focus(), 0);
}
function closePromptDialog() {
  promptResolve = null;
  $('#prompt-dialog').close();
}
function openConfirmDialog(title, message, onConfirm) {
  $('#confirm-dialog-title').textContent = title;
  $('#confirm-dialog-message').textContent = message;
  confirmResolve = onConfirm;
  $('#confirm-dialog').showModal();
}
function closeConfirmDialog() {
  confirmResolve = null;
  $('#confirm-dialog').close();
}

const SYNC_POOL_SECTIONS = [
  { key: 'today', label: '今日工作动态', hint: '把今天的任务文件同步为任务池事项' },
  { key: 'tomorrow', label: '明日工作计划', hint: '把明天安排的计划同步为任务池事项' },
  { key: 'weekly', label: '本周计划', hint: '把本周计划目标同步为任务池事项' },
  { key: 'monthly', label: '本月计划', hint: '把本月计划目标同步为任务池事项' },
];

function syncPoolItems(sectionKey) {
  const date = selectedDailyDate;
  if (sectionKey === 'today') {
    return state.tasks.filter((task) => task.date === date).map((task) => ({ kind: 'task', task, title: task.content, date: task.date, done: Number(task.completionPct) >= 100 }));
  }
  if (sectionKey === 'tomorrow') {
    return (dailyPlanFor(date).tomorrow || []).filter((item) => linkText(item).trim()).map((item) => ({ kind: 'plan', item, title: linkText(item), date: shiftDate(date, 1), done: linkDoneState(item) }));
  }
  if (sectionKey === 'weekly') {
    const key = weekKey(date);
    const plan = state.plans.weekly?.[key] || { items: [] };
    return (plan.items || []).filter((item) => linkText(item).trim()).map((item) => ({ kind: 'plan', item, title: linkText(item), date, done: linkDoneState(item) }));
  }
  if (sectionKey === 'monthly') {
    const key = date.slice(0, 7);
    const plan = state.plans.monthly?.[key] || { items: [] };
    return (plan.items || []).filter((item) => linkText(item).trim()).map((item) => ({ kind: 'plan', item, title: linkText(item), date: `${key}-01`, done: linkDoneState(item) }));
  }
  return [];
}

function syncPoolValidationErrors(sectionKey) {
  const items = syncPoolItems(sectionKey);
  const errors = [];
  for (const entry of items) {
    if (entry.kind === 'task') {
      const calc = calculateDay(entry.task.date, [entry.task], state).tasks[0];
      if (calc.validationErrors.length) errors.push(`${entry.title || '未命名任务'}：${calc.validationErrors.join('、')}`);
    } else if (!String(entry.title || '').trim()) {
      errors.push('存在未填写内容的计划项');
    }
  }
  return errors;
}

function openSyncPoolDialog() {
  const body = $('#sync-pool-body');
  if (!body) return;
  const rows = SYNC_POOL_SECTIONS.map((section) => {
    const items = syncPoolItems(section.key);
    const errs = syncPoolValidationErrors(section.key);
    const checked = syncPoolSelected.has(section.key);
    const meta = errs.length
      ? `<span class="sync-pool-meta sync-pool-incomplete"><i class="ri-alert-line"></i> ${errs.length} 项待完善</span>`
      : `<span class="sync-pool-meta sync-pool-ready"><i class="ri-check-line"></i> ${items.length} 项可同步</span>`;
    return `<label class="sync-pool-section ${checked ? 'selected' : ''}"><input type="checkbox" data-action="toggle-sync-section" data-section="${section.key}" ${checked ? 'checked' : ''}><span class="sync-pool-section-main"><strong>${section.label}</strong><small>${section.hint}</small></span><span class="sync-pool-section-right"><em>${items.length}</em>${meta}</span></label>`;
  }).join('');
  body.innerHTML = `<div class="sync-pool-sections">${rows}</div><div id="sync-pool-warning" class="sync-pool-warning" hidden></div>`;
  $('#sync-pool-dialog').showModal();
}

function closeSyncPoolDialog() {
  $('#sync-pool-dialog')?.close();
}

function performSyncToPool() {
  const selected = [...syncPoolSelected];
  if (!selected.length) return toast('请至少选择一个板块');
  const incomplete = [];
  for (const key of selected) {
    const errs = syncPoolValidationErrors(key);
    if (errs.length) incomplete.push({ label: SYNC_POOL_SECTIONS.find((section) => section.key === key)?.label || key, errs });
  }
  const warning = $('#sync-pool-warning');
  if (incomplete.length) {
    if (warning) {
      warning.hidden = false;
      warning.innerHTML = `<div class="sync-pool-warning-title"><i class="ri-error-warning-line"></i> 存在信息未完善，无法同步</div><ul>${incomplete.map((group) => `<li><strong>${esc(group.label)}</strong>${group.errs.map((err) => `<span>${esc(err)}</span>`).join('')}</li>`).join('')}</ul><p class="sync-pool-warning-hint">请先回到每日工作台补齐必填字段后再同步。</p>`;
    }
    return;
  }
  let added = 0;
  let skipped = 0;
  for (const key of selected) {
    for (const entry of syncPoolItems(key)) {
      const title = String(entry.title || '').trim();
      if (!title) continue;
      const duplicate = entry.kind === 'task'
        ? state.workItems.some((item) => item.performanceTaskId === entry.task.id)
        : state.workItems.some((item) => String(item.title || '').trim().toLowerCase() === title.toLowerCase());
      if (duplicate) { skipped += 1; continue; }
      const item = {
        id: crypto.randomUUID(),
        title,
        description: entry.kind === 'task' ? [entry.task.blocker, entry.task.breakthrough].filter(Boolean).join('；') : '',
        category: entry.kind === 'task' ? (entry.task.category || '其他') : '项目管理',
        planType: entry.kind === 'task' ? (entry.task.planType || '单人工作') : '单人工作',
        priority: '普通',
        dueDate: entry.date || '',
        status: entry.done ? 'done' : (entry.kind === 'task' && Number(entry.task.completionPct) > 0 ? 'doing' : 'todo'),
        reviewer: '',
        acceptanceStatus: '',
        performanceTaskId: entry.kind === 'task' ? entry.task.id : '',
        createdAt: new Date().toISOString(),
        completedAt: entry.done ? new Date().toISOString() : '',
        owner: activeUser()?.name || '',
      };
      state.workItems.unshift(item);
      added += 1;
    }
  }
  save();
  closeSyncPoolDialog();
  render();
  toast(`已同步 ${added} 项到任务池${skipped ? `，跳过 ${skipped} 项重复` : ''}`);
}

function openProjectDialog(projectId = '') {
  editingProjectId = projectId || null;
  const project = projectId ? projectForId(state, projectId) : null;
  $('#project-dialog-title').textContent = project ? '编辑项目' : '新建项目';
  const value = (key, fallback = '') => project?.[key] ?? fallback;
  $('#project-form-fields').innerHTML = `<label class="form-field full"><span class="label">项目名称 *</span><input class="input" name="name" required maxlength="60" value="${inputValue(value('name'))}" placeholder="例如：季度销售系统重构"></label><label class="form-field"><span class="label">项目分类</span><select class="select" name="category">${(state.settings.taskCategories || TASK_CATEGORIES).map((category) => `<option ${value('category', '项目管理') === category ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select></label><label class="form-field"><span class="label">优先级</span><select class="select" name="priority">${['高', '普通', '低'].map((priority) => `<option ${value('priority', '普通') === priority ? 'selected' : ''}>${priority}</option>`).join('')}</select></label><label class="form-field"><span class="label">状态</span><select class="select" name="status">${[['todo', '待启动'], ['doing', '进行中'], ['done', '已完成']].map(([key, label]) => `<option value="${key}" ${value('status', 'todo') === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="form-field"><span class="label">风险等级</span><select class="select" name="riskOverride">${[['', '自动判断'], ['低', '低'], ['中', '中'], ['高', '高']].map(([key, label]) => `<option value="${key}" ${value('riskOverride', '') === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="form-field"><span class="label">负责人</span><input class="input" name="owner" maxlength="30" value="${inputValue(value('owner'))}" placeholder="负责人姓名"></label><label class="form-field"><span class="label">开始日期</span><input class="input" name="startDate" type="date" value="${inputValue(value('startDate'))}"></label><label class="form-field"><span class="label">截止日期</span><input class="input" name="dueDate" type="date" value="${inputValue(value('dueDate'))}"></label><label class="form-field full"><span class="label">项目说明</span><textarea class="textarea" name="description" rows="3" placeholder="描述项目目标、范围和交付物">${inputValue(value('description'))}</textarea></label>`;
  $('#project-dialog').showModal();
  $('#project-form [name="name"]')?.focus();
}

function closeProjectDialog() {
  editingProjectId = null;
  $('#project-dialog').close();
}

function saveProjectFromDialog() {
  const data = Object.fromEntries(new FormData($('#project-form')).entries());
  const name = String(data.name || '').trim();
  if (!name) return toast('请输入项目名称');
  const payload = {
    name,
    category: data.category,
    priority: data.priority,
    status: data.status,
    riskOverride: data.riskOverride || '',
    owner: String(data.owner || '').trim(),
    startDate: data.startDate,
    dueDate: data.dueDate,
    description: String(data.description || '').trim(),
  };
  if (editingProjectId) {
    const project = projectForId(state, editingProjectId);
    if (!project) return;
    Object.assign(project, payload);
    save(); closeProjectDialog(); render(); toast('项目已更新');
    return;
  }
  const project = createProjectNode(payload);
  if (!Array.isArray(state.projects)) state.projects = [];
  state.projects.push(project);
  selectedProjectId = project.id;
  save(); closeProjectDialog(); render(); toast('项目已创建');
}

function deleteProject(projectId) {
  const project = projectForId(state, projectId);
  if (!project) return;
  openConfirmDialog('删除项目', `确认删除项目“${project.name}”？关联的任务不会被删除。`, () => {
    state.projects = state.projects.filter((entry) => entry.id !== projectId);
    if (selectedProjectId === projectId) selectedProjectId = '';
    save(); render(); toast('项目已删除');
  });
}

function openLinkTasksDialog(projectId) {
  const project = projectForId(state, projectId);
  if (!project) return;
  selectedProjectId = projectId;
  const tasks = [...(state.tasks || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const linkedIds = new Set(project.taskIds || []);
  $('#link-tasks-dialog-title').textContent = `关联任务 · ${project.name}`;
  $('#link-tasks-list').innerHTML = tasks.length ? tasks.map((task) => {
    const done = Number(task.completionPct) >= 100;
    const linked = linkedIds.has(task.id);
    return `<label class="project-task-link-row ${linked ? 'linked' : ''}"><input type="checkbox" class="project-task-link-check" data-action="toggle-project-task-link" data-project-id="${esc(project.id)}" data-task-id="${esc(task.id)}" ${linked ? 'checked' : ''}><span class="project-task-link-status ${done ? 'done' : ''}">${done ? '已完成' : '进行中'}</span><span class="project-task-link-title">${esc(task.content || '未命名任务')}</span><span class="project-task-link-date">${esc(task.date || '未设置')}</span></label>`;
  }).join('') : '<div class="empty">还没有任务，先到「每日工作台」或「工作全景」创建任务。</div>';
  $('#link-tasks-dialog').showModal();
}

function closeLinkTasksDialog() {
  $('#link-tasks-dialog').close();
}

function toggleProjectTaskLink(projectId, taskId, checked) {
  const project = projectForId(state, projectId);
  if (!project) return;
  if (!Array.isArray(project.taskIds)) project.taskIds = [];
  if (checked) {
    if (!project.taskIds.includes(taskId)) project.taskIds.push(taskId);
  } else {
    project.taskIds = project.taskIds.filter((id) => id !== taskId);
  }
  save();
  const row = document.querySelector(`[data-action="toggle-project-task-link"][data-task-id="${taskId}"]`)?.closest('.project-task-link-row');
  if (row) row.classList.toggle('linked', checked);
}

function projectUserOptions() {
  return users.map((user) => `<option value="${esc(user.name)}"></option>`).join('');
}

function openMilestoneDialog(projectId, milestoneId = '') {
  editingMilestoneProjectId = projectId;
  editingMilestoneId = milestoneId || null;
  const project = projectForId(state, projectId);
  const milestone = milestoneId ? project?.milestones?.find((entry) => entry.id === milestoneId) : null;
  $('#milestone-dialog-title').textContent = milestone ? '编辑里程碑' : '新建里程碑';
  const value = (key, fallback = '') => milestone?.[key] ?? fallback;
  $('#milestone-form-fields').innerHTML = `<datalist id="pm-users-list">${projectUserOptions()}</datalist><label class="form-field full"><span class="label">里程碑名称 *</span><input class="input" name="name" required maxlength="60" value="${inputValue(value('name'))}" placeholder="例如：需求评审完成"></label><label class="form-field"><span class="label">状态</span><select class="select" name="status">${[['todo', '待启动'], ['doing', '进行中'], ['done', '已完成']].map(([key, label]) => `<option value="${key}" ${value('status', 'todo') === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="form-field"><span class="label">截止日期</span><input class="input" name="dueDate" type="date" value="${inputValue(value('dueDate'))}"></label><label class="form-field"><span class="label">负责人</span><input class="input" name="owner" list="pm-users-list" maxlength="30" value="${inputValue(value('owner'))}" placeholder="负责人姓名"></label><label class="form-field"><span class="label">验收人</span><input class="input" name="reviewer" list="pm-users-list" maxlength="30" value="${inputValue(value('reviewer'))}" placeholder="验收人姓名"></label><label class="form-field full"><span class="label">里程碑说明</span><textarea class="textarea" name="description" rows="3" placeholder="描述本阶段的交付目标与验收标准">${inputValue(value('description'))}</textarea></label>`;
  $('#milestone-dialog').showModal();
  $('#milestone-form [name="name"]')?.focus();
}

function closeMilestoneDialog() {
  editingMilestoneProjectId = '';
  editingMilestoneId = null;
  $('#milestone-dialog').close();
}

function saveMilestoneFromDialog() {
  const data = Object.fromEntries(new FormData($('#milestone-form')).entries());
  const name = String(data.name || '').trim();
  if (!name) return toast('请输入里程碑名称');
  const project = projectForId(state, editingMilestoneProjectId);
  if (!project) return;
  if (!Array.isArray(project.milestones)) project.milestones = [];
  const payload = {
    name,
    status: data.status,
    dueDate: data.dueDate,
    owner: String(data.owner || '').trim(),
    reviewer: String(data.reviewer || '').trim(),
    description: String(data.description || '').trim(),
  };
  if (editingMilestoneId) {
    const milestone = project.milestones.find((entry) => entry.id === editingMilestoneId);
    if (!milestone) return;
    Object.assign(milestone, payload);
    save(); closeMilestoneDialog(); render(); toast('里程碑已更新');
    return;
  }
  project.milestones.push(createMilestone(payload));
  save(); closeMilestoneDialog(); render(); toast('里程碑已创建');
}

function deleteMilestone(projectId, milestoneId) {
  const project = projectForId(state, projectId);
  const milestone = project?.milestones?.find((entry) => entry.id === milestoneId);
  if (!milestone) return;
  const taskCount = Array.isArray(milestone.tasks) ? milestone.tasks.length : 0;
  openConfirmDialog('删除里程碑', `确认删除里程碑“${milestone.name}”及其下 ${taskCount} 个任务？`, () => {
    project.milestones = (project.milestones || []).filter((entry) => entry.id !== milestoneId);
    save(); render(); toast('里程碑已删除');
  });
}

function openProjectTaskDialog(projectId, milestoneId, taskId = '') {
  editingProjectTaskProjectId = projectId;
  editingProjectTaskMilestoneId = milestoneId;
  editingProjectTaskId = taskId || null;
  const project = projectForId(state, projectId);
  const task = taskId ? findProjectTask(project, taskId)?.task : null;
  $('#project-task-dialog-title').textContent = task ? '编辑任务' : '新建任务';
  const value = (key, fallback = '') => task?.[key] ?? fallback;
  $('#project-task-form-fields').innerHTML = `<datalist id="pm-users-list">${projectUserOptions()}</datalist><label class="form-field full"><span class="label">任务标题 *</span><input class="input" name="title" required maxlength="80" value="${inputValue(value('title'))}" placeholder="例如：完成接口联调"></label><label class="form-field"><span class="label">状态</span><select class="select" name="status">${[['todo', '待办'], ['doing', '进行中'], ['done', '已完成']].map(([key, label]) => `<option value="${key}" ${value('status', 'todo') === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="form-field"><span class="label">优先级</span><select class="select" name="priority">${['高', '普通', '低'].map((priority) => `<option ${value('priority', '普通') === priority ? 'selected' : ''}>${priority}</option>`).join('')}</select></label><label class="form-field"><span class="label">截止日期</span><input class="input" name="dueDate" type="date" value="${inputValue(value('dueDate'))}"></label><label class="form-field"><span class="label">负责人（执行人）</span><input class="input" name="assignee" list="pm-users-list" maxlength="30" value="${inputValue(value('assignee'))}" placeholder="分配给谁"></label><label class="form-field"><span class="label">验收人</span><input class="input" name="reviewer" list="pm-users-list" maxlength="30" value="${inputValue(value('reviewer'))}" placeholder="谁负责验收"></label>`;
  $('#project-task-dialog').showModal();
  $('#project-task-form [name="title"]')?.focus();
}

function closeProjectTaskDialog() {
  editingProjectTaskProjectId = '';
  editingProjectTaskMilestoneId = '';
  editingProjectTaskId = null;
  $('#project-task-dialog').close();
}

function saveProjectTaskFromDialog() {
  const data = Object.fromEntries(new FormData($('#project-task-form')).entries());
  const title = String(data.title || '').trim();
  if (!title) return toast('请输入任务标题');
  const project = projectForId(state, editingProjectTaskProjectId);
  const milestone = project?.milestones?.find((entry) => entry.id === editingProjectTaskMilestoneId);
  if (!milestone) return;
  if (!Array.isArray(milestone.tasks)) milestone.tasks = [];
  const payload = {
    title,
    status: data.status,
    priority: data.priority,
    dueDate: data.dueDate,
    assignee: String(data.assignee || '').trim(),
    reviewer: String(data.reviewer || '').trim(),
  };
  if (editingProjectTaskId) {
    const found = findProjectTask(project, editingProjectTaskId);
    if (!found) return;
    Object.assign(found.task, payload);
    syncProjectTaskLink(found.task, project, found.milestone);
    save(); closeProjectTaskDialog(); render(); toast('任务已更新');
    return;
  }
  milestone.tasks.push(createProjectTask(payload));
  save(); closeProjectTaskDialog(); render(); toast('任务已创建');
}

function deleteProjectTask(projectId, milestoneId, taskId) {
  const project = projectForId(state, projectId);
  const found = findProjectTask(project, taskId);
  if (!found) return;
  const { task, parentTask, milestone } = found;
  const childrenCount = (task.subtasks || []).length;
  const msg = childrenCount ? `确认删除任务“${task.title || '未命名任务'}”及其 ${childrenCount} 个子任务？` : `确认删除任务“${task.title || '未命名任务'}”？`;
  openConfirmDialog('删除任务', msg, () => {
    if (parentTask) parentTask.subtasks = (parentTask.subtasks || []).filter((entry) => entry.id !== taskId);
    else milestone.tasks = (milestone.tasks || []).filter((entry) => entry.id !== taskId);
    if (selectedProjectTaskId === taskId) selectedProjectTaskId = '';
    save(); render(); toast('任务已删除');
  });
}

function toggleTaskBlocked(taskId) {
  const task = findProjectTask(projectForId(state, selectedProjectId), taskId)?.task;
  if (!task) return;
  task.blocked = !task.blocked;
  save(); render();
  toast(task.blocked ? '任务已标记为阻塞' : '已解除阻塞标记');
}

function acceptProjectTask(projectId, taskId) {
  const found = findProjectTask(projectForId(state, projectId), taskId);
  if (!found) return;
  found.task.acceptanceStatus = 'accepted';
  save(); render(); toast('已通过验收');
}

function reworkProjectTask(projectId, taskId) {
  const found = findProjectTask(projectForId(state, projectId), taskId);
  if (!found) return;
  found.task.status = 'doing';
  found.task.acceptanceStatus = 'rework';
  save(); render(); toast('已退回修改');
}

function openProjectTaskFromAcceptance(projectId, taskId) {
  selectedProjectId = projectId;
  selectedProjectTaskId = taskId;
  activeTab = 'projects';
  render();
}

function syncProjectTaskLink(task, project, milestone) {
  if (!task.workItemId) return;
  const item = state.workItems.find((entry) => entry.id === task.workItemId);
  if (!item) return;
  item.title = task.title;
  item.priority = task.priority || item.priority;
  item.dueDate = task.dueDate || item.dueDate;
  item.status = task.status === 'done' ? 'done' : task.status === 'doing' ? 'doing' : item.status;
  item.reviewer = task.reviewer || item.reviewer;
  item.owner = task.assignee || item.owner;
  item.description = `项目「${project.name}」· 里程碑「${milestone.name}」`;
  if (item.status === 'done' && !item.completedAt) item.completedAt = new Date().toISOString();
  if (item.status !== 'done') { item.completedAt = ''; item.acceptanceStatus = ''; }
}

function syncProjectTaskToPool(projectId, milestoneId, taskId) {
  const project = projectForId(state, projectId);
  const found = findProjectTask(project, taskId);
  if (!found) return;
  const { task, milestone } = found;
  const title = String(task.title || '').trim();
  if (!title) return toast('请先填写任务标题');
  const previousReviewer = '';
  let item = task.workItemId ? state.workItems.find((entry) => entry.id === task.workItemId) : null;
  if (!item) {
    item = {
      id: crypto.randomUUID(),
      title,
      description: `项目「${project.name}」· 里程碑「${milestone.name}」`,
      category: project.category || '项目管理',
      planType: '单人工作',
      priority: task.priority || '普通',
      dueDate: task.dueDate || '',
      status: task.status === 'done' ? 'done' : task.status === 'doing' ? 'doing' : 'todo',
      reviewer: task.reviewer || '',
      acceptanceStatus: '',
      performanceTaskId: task.performanceTaskId || '',
      createdAt: new Date().toISOString(),
      completedAt: task.status === 'done' ? new Date().toISOString() : '',
      owner: task.assignee || project.owner || activeUser()?.name || '',
    };
    state.workItems.unshift(item);
    task.workItemId = item.id;
  } else {
    syncProjectTaskLink(task, project, milestone);
  }
  if (item.reviewer) notifyReviewerAssignment(item, previousReviewer);
  save(); render();
  toast('已同步到任务池，可在「验收工作」跟进');
}

function recordProjectTaskPerformance(projectId, milestoneId, taskId) {
  const project = projectForId(state, projectId);
  const found = findProjectTask(project, taskId);
  if (!found) return;
  const { task, milestone } = found;
  if (task.performanceTaskId) {
    selectedWorkspaceView = 'performance';
    activeTab = 'summary';
    summaryFilters = { search: '', source: 'task', status: '' };
    render();
    toast('该任务已建立绩效记录');
    return;
  }
  const title = String(task.title || '').trim();
  if (!title) return toast('请先填写任务标题');
  const performanceTaskId = crypto.randomUUID();
  state.tasks.unshift({
    id: performanceTaskId,
    date: task.dueDate || dateToISO(new Date()),
    content: title,
    body: '',
    category: project.category || state.settings.taskCategories[0] || '其他',
    planType: '单人工作',
    collaborator: '',
    estimatedHours: '',
    actualHours: '',
    completionPct: task.status === 'done' ? 100 : 0,
    collaborationPct: 0,
    innovation: '',
    selfScore: '',
    reviewerScore: '',
    nextPlan: '',
    blocker: milestone.description || '',
    breakthrough: '',
    subtasks: [],
  });
  task.performanceTaskId = performanceTaskId;
  if (task.workItemId) {
    const item = state.workItems.find((entry) => entry.id === task.workItemId);
    if (item) item.performanceTaskId = performanceTaskId;
  }
  save(); render();
  toast('已记入绩效，请补充工时与评分');
}

function addProjectSubtask(projectId, milestoneId, taskId) {
  const project = projectForId(state, projectId);
  const parent = findProjectTask(project, taskId)?.task;
  if (!parent) return;
  if (!Array.isArray(parent.subtasks)) parent.subtasks = [];
  const subtask = createProjectTask({ title: '', assignee: parent.assignee, reviewer: parent.reviewer, dueDate: parent.dueDate, priority: parent.priority });
  parent.subtasks.push(subtask);
  collapsedTasks.delete(taskId);
  selectedProjectTaskId = subtask.id;
  save(); render();
  toast('已添加子任务，请在右侧详情填写标题');
}

function addTaskDeliverable(taskId) {
  const task = findProjectTask(projectForId(state, selectedProjectId), taskId)?.task;
  if (!task) return;
  if (!Array.isArray(task.deliverables)) task.deliverables = [];
  task.deliverables.push({ id: crypto.randomUUID(), text: '', done: false });
  save(); render();
  const input = document.querySelector(`[data-deliverable-field="text"][data-task-id="${taskId}"]:last-of-type`);
  input?.focus();
}

function addTaskComment(taskId) {
  const task = findProjectTask(projectForId(state, selectedProjectId), taskId)?.task;
  if (!task) return;
  const input = document.querySelector(`[data-task-comment-input][data-task-id="${taskId}"]`);
  const text = input?.value.trim();
  if (!text) return toast('请输入评论内容');
  if (!Array.isArray(task.comments)) task.comments = [];
  task.comments.push({ id: crypto.randomUUID(), text, author: activeUser()?.name || '我', createdAt: dateToISO(new Date()) });
  save(); render();
  toast('评论已发布');
}

function openSopTemplateDialog(templateId = '', duplicate = false) {
  const source = templateId ? sopTemplateForId(state, templateId) : null;
  const editable = source && !duplicate;
  editingSopTemplateId = editable ? source.id : null;
  editingSopNodes = (source && source.nodes && source.nodes.length ? source.nodes : [createSopNode()]).map((node) => ({ ...node }));
  $('#sop-template-dialog-title').textContent = editable ? '编辑 SOP 模板' : (source ? '复制 SOP 模板' : '新建 SOP 模板');
  $('#sop-template-form-fields').innerHTML = `<div class="sop-template-basics"><label class="form-field"><span class="label">模板名称 *</span><input class="input" name="name" required maxlength="60" value="${inputValue(source ? `${source.name}${duplicate ? ' 副本' : ''}` : '')}" placeholder="例如：版本发布标准流程"></label><label class="form-field"><span class="label">适用场景</span><input class="input" name="scene" maxlength="80" value="${inputValue(source?.scene)}" placeholder="例如：软件版本迭代与发布"></label><label class="form-field"><span class="label">默认负责人角色</span><input class="input" name="defaultOwnerRole" maxlength="30" value="${inputValue(source?.defaultOwnerRole)}" placeholder="例如：研发负责人"></label><label class="form-field"><span class="label">默认验收角色</span><input class="input" name="defaultReviewerRole" maxlength="30" value="${inputValue(source?.defaultReviewerRole)}" placeholder="例如：质量负责人"></label><label class="form-field"><span class="label">标准工期（天）</span><input class="input" name="standardDuration" type="number" min="1" max="365" value="${inputValue(source?.standardDuration)}" placeholder="例如：7"></label></div><div class="sop-template-nodes-title"><div><strong>节点执行流程</strong><small>每个节点按「输入 → 执行 → 输出 → 验收 → 下一步」流转</small></div><button type="button" class="button ghost" data-action="add-sop-node">+ 添加节点</button></div><div id="sop-node-editor">${renderSopNodeEditor(editingSopNodes)}</div>`;
  $('#sop-template-dialog').showModal();
  $('#sop-template-form [name="name"]')?.focus();
}

function closeSopTemplateDialog() {
  editingSopTemplateId = null;
  editingSopNodes = [];
  $('#sop-template-dialog').close();
}

function saveSopTemplateFromDialog() {
  const data = Object.fromEntries(new FormData($('#sop-template-form')).entries());
  const name = String(data.name || '').trim();
  if (!name) return toast('请输入模板名称');
  const nodes = editingSopNodes.map((node) => ({ ...node })).filter((node) => String(node.action || '').trim() || String(node.input || '').trim());
  if (!nodes.length) return toast('请至少填写一个流程节点');
  const existing = editingSopTemplateId ? sopTemplateForId(state, editingSopTemplateId) : null;
  const template = {
    id: editingSopTemplateId || crypto.randomUUID(),
    name,
    scene: String(data.scene || '').trim(),
    defaultOwnerRole: String(data.defaultOwnerRole || '').trim(),
    defaultReviewerRole: String(data.defaultReviewerRole || '').trim(),
    standardDuration: data.standardDuration,
    nodes,
    createdAt: existing?.createdAt || new Date().toISOString(),
    order: existing && Number.isFinite(Number(existing.order)) ? Number(existing.order) : Date.now(),
  };
  if (!Array.isArray(state.sopTemplates)) state.sopTemplates = [];
  const index = state.sopTemplates.findIndex((item) => item.id === template.id);
  if (index >= 0) state.sopTemplates[index] = template; else state.sopTemplates.push(template);
  save(); closeSopTemplateDialog(); render();
  toast(index >= 0 ? 'SOP 模板已更新' : 'SOP 模板已添加');
}

function deleteSopTemplate(templateId) {
  const template = sopTemplateForId(state, templateId);
  if (!template) return;
  openConfirmDialog('删除模板', `确认删除 SOP 模板「${template.name}」？已由它生成的项目不受影响。`, () => {
    state.sopTemplates = state.sopTemplates.filter((item) => item.id !== templateId);
    save(); render(); toast('SOP 模板已删除');
  });
}

function generateProjectFromTemplate(templateId) {
  const template = sopTemplateForId(state, templateId);
  if (!template) return;
  openPromptDialog('由模板生成项目', '项目名称', template.name, (name) => {
    const projectName = String(name || '').trim() || template.name;
    if (!projectName) return toast('请输入项目名称');
    const nodes = (template.nodes || []).filter((node) => String(node.action || node.input || '').trim());
    const duration = Math.max(1, Number(template.standardDuration) || 7);
    const project = createProjectNode({
      name: projectName,
      description: template.scene || `由 SOP 模板「${template.name}」生成`,
      category: '项目管理',
      status: 'todo',
      stage: '规划立项',
      owner: template.defaultOwnerRole || '',
    });
    const start = new Date();
    nodes.forEach((node, index) => {
      const due = new Date(start);
      due.setDate(start.getDate() + duration * (index + 1));
      const dueISO = dateToISO(due);
      const milestone = createMilestone({
        name: node.action || node.next || `阶段 ${index + 1}`,
        description: node.input || '',
        owner: template.defaultOwnerRole || '',
        reviewer: template.defaultReviewerRole || '',
        dueDate: dueISO,
        status: 'todo',
        order: (index + 1) * 10,
      });
      milestone.tasks = [createProjectTask({
        title: node.action || `执行阶段 ${index + 1}`,
        assignee: template.defaultOwnerRole || '',
        reviewer: template.defaultReviewerRole || '',
        dueDate: dueISO,
        status: 'todo',
        priority: '普通',
        requirement: node.input || '',
        acceptance: node.acceptance || '',
        deliverables: node.output ? [{ id: crypto.randomUUID(), text: node.output, done: false }] : [],
      })];
      project.milestones.push(milestone);
    });
    if (!Array.isArray(state.projects)) state.projects = [];
    state.projects.push(project);
    selectedProjectId = project.id;
    selectedProjectTaskId = '';
    sopViewOpen = false;
    save(); render();
    toast(`已由模板生成项目「${projectName}」，共 ${nodes.length} 个里程碑`);
  });
}

function renderDocEmpty() {
  return `<div class="doc-editor-empty"><span class="doc-editor-empty-icon"><i class="ri-file-text-line"></i></span><strong>选择或新建一篇文档</strong><p>从左侧目录选择文档，或点击「+ 文档」开始创作。任务文档会自动出现在「任务文档」分组中。</p></div>`;
}

function renderDocuments() {
  if (!docSelection.id) {
    const firstTask = state.tasks[0];
    if (firstTask) docSelection = { kind: 'task', id: firstTask.id };
    else {
      const firstDoc = documentNodes(state).find((n) => n.kind === 'doc');
      if (firstDoc) docSelection = { kind: 'doc', id: firstDoc.id };
    }
  }
  let header = '';
  let body = '';
  if (docSelection.kind === 'task') {
    const task = taskForId(docSelection.id);
    if (task) {
      header = `<div class="doc-editor-head"><div class="doc-editor-breadcrumb"><span>任务文档</span><span>/</span><span>${esc(task.content || '未命名任务')}</span></div><span class="tag green">任务文档</span></div><div class="doc-editor-title-row"><input class="doc-editor-title" data-doc-task-title data-task-id="${esc(task.id)}" value="${inputValue(task.content)}" placeholder="未命名任务"></div>`;
      body = `<div class="doc-editor-body">${renderNovelEditor(task, 'task')}</div>`;
    } else {
      body = renderDocEmpty();
    }
  } else if (docSelection.kind === 'doc') {
    const node = documentNodes(state).find((n) => n.id === docSelection.id);
    if (node) {
      header = `<div class="doc-editor-head"><div class="doc-editor-breadcrumb"><span>文档库</span><span>/</span><span>${esc(node.title || '未命名文档')}</span></div><span class="tag">文档</span></div><div class="doc-editor-title-row"><input class="doc-editor-title" data-doc-title data-doc-id="${esc(node.id)}" value="${inputValue(node.title)}" placeholder="未命名文档"></div>`;
      body = `<div class="doc-editor-body">${renderNovelEditor(node, 'doc')}</div>`;
    } else {
      body = renderDocEmpty();
    }
  }
  return `<div class="doc-workspace"><aside class="doc-sidebar"><div class="doc-sidebar-head"><h2>文档</h2><div class="doc-sidebar-actions"><button class="button primary" data-action="add-doc"><i class="ri-add-line"></i> 文档</button><button class="button" data-action="add-doc-folder"><i class="ri-folder-add-line"></i> 文件夹</button></div></div>${renderDocTree(state, { expanded: docExpanded, selectedKind: docSelection.kind, selectedId: docSelection.id })}</aside><section class="doc-editor-pane">${header}${body}</section></div>`;
}

function renderTaskSubtaskEditor() {
  return `<div class="task-dialog-subtask-list">${editingSubtasks.map((item) => `<div class="task-dialog-subtask-row"><input type="checkbox" data-action="toggle-dialog-subtask" data-subtask-id="${item.id}" ${item.done ? 'checked' : ''}><input class="input" data-dialog-subtask-field="text" data-subtask-id="${item.id}" value="${inputValue(item.text)}" placeholder="子任务名称"><button type="button" class="task-subtask-delete" data-action="delete-dialog-subtask" data-subtask-id="${item.id}" aria-label="删除子任务">×</button></div>`).join('')}</div><button type="button" class="button ghost task-dialog-add-subtask" data-action="add-dialog-subtask">+ 添加子任务</button>`;
}
function renderTaskFileEditor(task, value) {
  const fieldRequired = (key) => { const configs = state.settings.fieldConfigs; const cfg = Array.isArray(configs) ? configs.find((c) => c.key === key) : null; return cfg && cfg.required ? 'required' : ''; };
  const field = (name, label, type = 'text', extra = '') => `<label class="task-file-property"><span>${label}${fieldRequired(name) ? ' *' : ''}</span><input class="input" name="${name}" type="${type}" value="${inputValue(value(name))}" ${extra} ${fieldRequired(name)}></label>`;
  const select = (name, label, options, fallback) => `<label class="task-file-property"><span>${label}${fieldRequired(name) ? ' *' : ''}</span><select class="select" name="${name}">${options.map((option) => `<option ${value(name, fallback) === option ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`;
  return `<div class="task-file-properties"><div class="task-file-property-wide"><span class="task-file-property-label">文件名</span><input class="task-file-title-input" name="content" ${fieldRequired('content')} value="${inputValue(value('content'))}" placeholder="未命名任务"></div>${field('date', '日期', 'date')}${select('category', '分类', state.settings.taskCategories || TASK_CATEGORIES, '其他')}${select('planType', '计划类型', PLAN_TYPES, '单人工作')}${field('collaborator', '协作人', 'text')}${field('estimatedHours', '预计工时 (h)', 'number', 'step="0.1" min="0"')}${field('actualHours', '实际工时 (h)', 'number', 'step="0.1" min="0"')}${field('completionPct', '交付完成 (%)', 'number', 'min="0" max="100"')}${field('collaborationPct', '协作完成 (%)', 'number', 'min="0" max="100"')}${field('innovation', '创新分', 'number', 'min="0" max="100"')}${field('selfScore', '自评分', 'number', 'min="0" max="100"')}${field('reviewerScore', '负责人评分', 'number', 'min="0" max="100"')}</div><div class="task-file-editor"><div class="task-file-editor-head"><span>正文 · Markdown</span><span class="task-file-path">${inputValue(value('date', '未设置'))}.md</span></div><textarea class="task-markdown-editor" name="body" placeholder="在这里记录任务背景、执行过程、结论和链接……">${inputValue(value('body'))}</textarea></div><div class="task-file-section"><div class="task-file-section-head"><span>子任务</span><span>${editingSubtasks.length} 项</span></div><div id="task-subtasks-editor">${renderTaskSubtaskEditor()}</div></div><div class="task-file-notes"><label class="form-field"><span class="label">阻塞问题 / 备注</span><textarea class="textarea" name="blocker">${inputValue(value('blocker'))}</textarea></label><label class="form-field"><span class="label">重大突破创新内容</span><textarea class="textarea" name="breakthrough">${inputValue(value('breakthrough'))}</textarea></label></div>`;
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
      completedAt: data.status === 'done' ? (existing?.completedAt || now) : '', owner: existing?.owner || activeUser()?.name || '',
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
  openConfirmDialog('删除事项', '确认删除这条事项？', () => {
    if (metadata.sourceKey === 'task') state.tasks = state.tasks.filter((task) => task.id !== metadata.id);
    else removeSummaryItem(metadata);
    save(); render(); toast('事项已删除');
  });
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
    state.workItems.unshift({ id, title: '', description: '', category: state.settings.taskCategories[0] || '其他', planType: '单人工作', priority: '普通', dueDate: today, status: 'todo', reviewer: '', acceptanceStatus: '', performanceTaskId: '', createdAt: new Date().toISOString(), completedAt: '', owner: activeUser()?.name || '' });
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
    const previousReviewer = item.reviewer;
    item[field] = target.value;
    if (field === 'reviewer') notifyReviewerAssignment(item, previousReviewer);
    if (field === 'status' && target.value === 'done' && !item.completedAt) item.completedAt = new Date().toISOString();
    if (field === 'status' && target.value !== 'done') { item.completedAt = ''; item.acceptanceStatus = ''; }
  } else if (metadata.sourceKey === 'daily') {
    if (field === 'text') { const canonical = resolveLinkTarget(item.linkRef) || item; canonical[isTaskLink(item) ? 'content' : 'text'] = target.value; }
    else if (field === 'done') setLinkDone(item, target.value === 'true');
    else if (field === 'period' || field === 'bucket') {
      const targetPeriod = field === 'period' ? target.value : metadata.period;
      const targetBucket = field === 'bucket' ? target.value : metadata.bucket;
      removeSummaryItem(metadata);
      dailyPlanFor(targetPeriod)[targetBucket].push(item);
    }
  } else if (['weekly', 'monthly'].includes(metadata.sourceKey)) {
    if (field === 'text') { const canonical = resolveLinkTarget(item.linkRef) || item; canonical[isTaskLink(item) ? 'content' : 'text'] = target.value; }
    else if (field === 'done') setLinkDone(item, target.value === 'true');
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
function currentUserFilePrefix() { return (activeUser()?.name || '默认用户').replace(/[\\/:*?"<>|]/g, '-'); }
function exportJson() { download(`${currentUserFilePrefix()}-绩效考核备份.json`, new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); toast('当前用户的 JSON 备份已生成'); }
async function exportExcel() { const response = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }); if (!response.ok) { toast('Excel 导出失败'); return; } download(`${currentUserFilePrefix()}-绩效考核归档.xlsx`, await response.blob()); toast('当前用户的 Excel 归档已生成'); }

function persistOperationsInput(target) {
  if (target.matches('[data-operations-score]')) {
    const template = assessmentTemplate(target.dataset.templateId);
    const review = assessmentReviewFor(target.dataset.reviewMonth, template.id, true);
    const indicator = template.dimensions.flatMap((dimension) => dimension.indicators).find((item) => item.id === target.dataset.indicatorId);
    if (!indicator) return false;
    const values = review.indicators[indicator.id] || (review.indicators[indicator.id] = {});
    const field = target.dataset.operationsScore;
    values[field] = ['actualValue', 'note'].includes(field) ? target.value : (target.value === '' ? '' : Math.min(indicator.weight, Math.max(0, Number(target.value) || 0)));
    save();
    return true;
  }
  if (target.matches('[data-operations-special]')) {
    const template = assessmentTemplate(target.dataset.templateId);
    const review = assessmentReviewFor(target.dataset.reviewMonth, template.id, true);
    const field = target.dataset.operationsSpecial;
    const maximum = field === 'innovationBonus' ? template.bonusMax : template.penaltyMax;
    review[field] = field.endsWith('Note') ? target.value : (target.value === '' ? '' : Math.min(maximum, Math.max(0, Number(target.value) || 0)));
    save();
    return true;
  }
  return false;
}

function addSubtaskToTask(taskId) {
  const task = taskForId(taskId);
  if (!task) return null;
  selectedDailyTaskId = task.id;
  localStorage.setItem(userPreferenceKey('performance-selected-daily-task'), selectedDailyTaskId);
  task.subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const newSubtask = { id: crypto.randomUUID(), text: '', done: false };
  task.subtasks.push(newSubtask);
  save();
  render();
  const input = document.querySelector(`[data-task-subtask-field="text"][data-task-id="${taskId}"][data-subtask-id="${newSubtask.id}"]`);
  input?.focus();
  return newSubtask;
}

document.addEventListener('click', (event) => {
  // 外部点击关闭@菜单
  if (mentionState.open && !event.target.closest('#mention-menu-wrapper') && !event.target.closest('[data-novel-content]')) {
    closeMentionMenu();
  }
  const todoCheckbox = event.target.closest('.novel-todo-checkbox');
  if (todoCheckbox) {
    const todo = todoCheckbox.closest('.novel-todo');
    todo.classList.toggle('done');
    todoCheckbox.textContent = todo.classList.contains('done') ? '☑' : '☐';
    const editor = todo.closest('[data-novel-content]');
    if (editor) saveNovelBody(editor);
    return;
  }
  if (userMenuOpen && !event.target.closest('.user-switcher')) { userMenuOpen = false; renderUserSwitcher(); }
  const blankTaskRow = event.target.closest('.today-task-blank-row');
  if (blankTaskRow && !event.target.matches('[data-daily-quick-task]')) { blankTaskRow.querySelector('[data-daily-quick-task]')?.focus(); return; }
  const summaryBlankRow = event.target.closest('.summary-quick-blank-row');
  if (summaryBlankRow && !event.target.matches('[data-summary-quick-task]')) { summaryBlankRow.querySelector('[data-summary-quick-task]')?.focus(); return; }
  const nav = event.target.closest('[data-tab]'); if (nav) return setActiveTab(nav.dataset.tab);
  const monthSelect = event.target.closest('[data-month-select]'); if (monthSelect) return;
  const day = event.target.closest('[data-day]'); if (day) { selectedDate = day.dataset.day; render(); return; }
  const action = event.target.closest('[data-action]'); if (!action) return;
  const type = action.dataset.action;
  const panel = action.closest('[data-daily-panel]');
  if (panel?.classList.contains('is-frozen') && !['toggle-daily-panel-freeze', 'toggle-daily-item', 'toggle-daily-task', 'toggle-daily-task-next', 'toggle-plan-item', 'toggle-task-subtask', 'daily-view-mode'].includes(type)) return;
  // 通知与聊天
  if (type === 'mark-all-read') {
    (state.notifications || []).forEach((n) => { n.read = true; });
    save(); render();
    return;
  }
  if (type === 'delete-notification') {
    state.notifications = (state.notifications || []).filter((n) => n.id !== action.dataset.notificationId);
    save(); render();
    return;
  }
  if (type === 'click-notification') {
    const notif = (state.notifications || []).find((n) => n.id === action.dataset.notificationId);
    if (notif) notif.read = true;
    if (action.dataset.notificationType === 'chat' && notif?.fromUserId) {
      setSelectedChatUserId(notif.fromUserId);
      chatTab = 'messages';
    } else if (notif?.type === 'overdue' || notif?.type === 'deadline') {
      selectedWorkspaceView = 'pool';
      summaryFilters = { search: '', source: 'pool', status: '' };
      activeTab = 'summary';
    } else if (notif?.type === 'daily-reminder') {
      activeTab = 'daily';
    }
    save(); render();
    return;
  }
  if (type === 'chat-tab') {
    chatTab = action.dataset.chatTab === 'notifications' ? 'notifications' : 'messages';
    render();
    return;
  }
  if (type === 'select-chat-user') {
    setSelectedChatUserId(action.dataset.userId);
    render();
    return;
  }
  if (type === 'send-chat-message') { sendChatMessage(action.dataset.chatTarget); return; }
  // @提及菜单
  if (action.matches('[data-mention-user]')) {
    const userId = action.dataset.mentionUser;
    const userName = action.dataset.mentionName;
    const editor = mentionState.editor;
    if (editor) insertMention(userId, userName, editor);
    return;
  }
  if (type === 'toggle-user-menu') { userMenuOpen = !userMenuOpen; renderUserSwitcher(); return; }
  if (type === 'close-prompt') { closePromptDialog(); return; }
  if (type === 'close-confirm') { closeConfirmDialog(); return; }
  if (type === 'confirm-yes') { const cb = confirmResolve; closeConfirmDialog(); if (cb) cb(); return; }
  if (type === 'switch-user') return switchUser(action.dataset.userId);
  if (type === 'add-user') return openUserDialog();
  if (type === 'edit-user') return openUserDialog(action.dataset.userId);
  if (type === 'cancel-user') return closeUserDialog();
  if (type === 'delete-user') return deleteUser(action.dataset.userId);
  if (type === 'add-assessment-template') return openAssessmentTemplateDialog();
  if (type === 'edit-assessment-template') { $('#template-view-dialog')?.close(); return openAssessmentTemplateDialog(action.dataset.templateId); }
  if (type === 'duplicate-assessment-template') return openAssessmentTemplateDialog(action.dataset.templateId, true);
  if (type === 'view-assessment-template') return viewAssessmentTemplate(action.dataset.templateId);
  if (type === 'delete-assessment-template') return deleteAssessmentTemplate(action.dataset.templateId);
  if (type === 'close-template-view') return $('#template-view-dialog')?.close();
  if (type === 'cancel-assessment-template') return closeAssessmentTemplateDialog();
  if (type === 'add-template-dimension') { editingTemplateDimensions.push(makeTemplateDimension()); renderTemplateDimensionsEditor(); return; }
  if (type === 'remove-template-dimension') {
    if (editingTemplateDimensions.length <= 1) return toast('模板至少需要一个考核维度');
    editingTemplateDimensions.splice(Number(action.dataset.dimensionIndex), 1);
    renderTemplateDimensionsEditor();
    return;
  }
  if (type === 'add-template-indicator') {
    editingTemplateDimensions[Number(action.dataset.dimensionIndex)]?.indicators.push(makeTemplateIndicator());
    renderTemplateDimensionsEditor();
    return;
  }
  if (type === 'remove-template-indicator') {
    const dimension = editingTemplateDimensions[Number(action.dataset.dimensionIndex)];
    if (!dimension) return;
    if (dimension.indicators.length <= 1) return toast('每个维度至少需要一个考核指标');
    dimension.indicators.splice(Number(action.dataset.indicatorIndex), 1);
    renderTemplateDimensionsEditor();
    return;
  }
  if (type === 'toggle-sidebar') { sidebarCollapsed = !sidebarCollapsed; localStorage.setItem('performance-sidebar-collapsed', sidebarCollapsed ? '1' : '0'); render(); return; }
  if (type === 'add-task') return addInlineTask();
  if (type === 'add-daily-task') {
    const newTask = { id: crypto.randomUUID(), content: '', date: selectedDate || dateToISO(new Date()), category: '需求开发', planType: '今日执行', completionPct: 0, createdAt: new Date().toISOString() };
    state.tasks.push(newTask);
    selectedDailyTaskId = newTask.id;
    save(); render();
    setTimeout(() => {
      const input = document.querySelector(`[data-daily-task-field="content"][data-id="${newTask.id}"]`);
      if (input) input.focus();
    }, 50);
    return;
  }
  if (type === 'add-daily-item') {
    const bucket = action.dataset.dailyBucket;
    if (bucket === 'tomorrow') {
      const dateAttr = action.dataset.dailyDate;
      const firstBlank = document.querySelector(`[data-daily-quick-tomorrow][data-date="${dateAttr}"][data-quick-slot="0"]`);
      if (firstBlank) { firstBlank.focus(); return; }
    }
    return addDailyItem(action);
  }
  if (type === 'toggle-daily-item') { const item = dailyItemFrom(action); if (item) { setLinkDone(item, action.checked); save(); render(); } return; }
  if (type === 'toggle-daily-task') { const task = taskForId(action.dataset.id); if (task) { task.completionPct = action.checked ? 100 : 0; save(); render(); toast(action.checked ? '任务已标记完成' : '任务已恢复为未完成'); } return; }
  if (type === 'toggle-task-subtask') { const task = taskForId(action.dataset.taskId); const item = task?.subtasks?.find((entry) => entry.id === action.dataset.subtaskId); if (item) { item.done = action.checked; save(); render(); } return; }
  if (type === 'toggle-dialog-subtask') { const item = editingSubtasks.find((entry) => entry.id === action.dataset.subtaskId); if (item) item.done = action.checked; return; }
  if (type === 'add-dialog-subtask') { editingSubtasks.push({ id: crypto.randomUUID(), text: '', done: false }); $('#task-subtasks-editor').innerHTML = renderTaskSubtaskEditor(); $('#task-subtasks-editor input[data-dialog-subtask-field="text"]:last-of-type')?.focus(); return; }
  if (type === 'delete-dialog-subtask') { editingSubtasks = editingSubtasks.filter((entry) => entry.id !== action.dataset.subtaskId); $('#task-subtasks-editor').innerHTML = renderTaskSubtaskEditor(); return; }
  if (type === 'add-task-subtask') { addSubtaskToTask(action.dataset.taskId); return; }
  if (type === 'delete-task-subtask') { const task = taskForId(action.dataset.taskId); if (task) { task.subtasks = (task.subtasks || []).filter((entry) => entry.id !== action.dataset.subtaskId); save(); render(); } return; }
  if (type === 'toggle-daily-task-next') { const task = taskForId(action.dataset.id); if (task) { task.nextPlanDone = action.checked; save(); render(); } return; }
  if (type === 'toggle-block-freeze') return toggleBlockFreeze(action);
  if (type === 'toggle-daily-panel-freeze') return toggleDailyPanelFreeze(action);
  if (type === 'toggle-task-properties') { const task = taskForId(action.dataset.taskId); if (task) { task.propertiesExpanded = task.propertiesExpanded === false ? true : false; save(); render(); } return; }
  if (type === 'edit-task-properties') { const task = taskForId(action.dataset.taskId); if (task) { task.propertiesExpanded = true; save(); render(); } return; }
  if (type === 'toggle-hidden-properties') { const task = taskForId(action.dataset.taskId); if (task) { task.hiddenPropertiesExpanded = task.hiddenPropertiesExpanded !== true ? true : false; save(); render(); } return; }
  if (type === 'today-task-more') { const task = taskForId(action.dataset.id); if (task) openTaskDialog(task.id); return; }
  if (type === 'toggle-property-visible') { const task = taskForId(action.dataset.taskId); if (!task) return; const key = action.dataset.propertyKey; if (action.hasAttribute('data-custom-property')) { const prop = getTaskCustomProperties(task).find((p) => p.id === key); if (prop) { prop.visible = prop.visible !== false ? false : true; save(); render(); } } else { const visibility = getTaskPropertyVisibility(task); visibility[key] = !visibility[key]; save(); render(); } return; }
  if (type === 'add-task-property') { const task = taskForId(action.dataset.taskId); if (!task) return; openPromptDialog('添加属性', '属性名称', '', (label) => { if (!label || !label.trim()) return; getTaskCustomProperties(task).push({ id: crypto.randomUUID(), label: label.trim(), value: '', icon: '≡', visible: true, type: 'text' }); save(); render(); }); return; }
  if (type === 'delete-task-property') { const task = taskForId(action.dataset.taskId); if (!task) return; const propId = action.dataset.propertyId; task.customProperties = getTaskCustomProperties(task).filter((p) => p.id !== propId); save(); render(); return; }
  if (type === 'daily-view-mode') {
    dailyTodayViewMode = action.dataset.viewMode === 'board' ? 'board' : 'list';
    localStorage.setItem(userPreferenceKey('performance-daily-view-mode'), dailyTodayViewMode);
    // 计划模式切换为看板视图时自动展开为 1-1-3 布局
    if (dailyTodayViewMode === 'board' && dailyWorkspaceMode === 'plan' && !dailyTaskFileOpen) {
      setDailyTaskFileOpen(true);
    }
    render();
    return;
  }
  if (type === 'daily-workspace-mode') {
    dailyWorkspaceMode = action.dataset.mode === 'work' ? 'work' : 'plan';
    localStorage.setItem(userPreferenceKey('performance-daily-workspace-mode'), dailyWorkspaceMode);
    if (dailyWorkspaceMode === 'work') {
      // 工作模式默认展开文件面板
      if (!dailyTaskFileOpen) setDailyTaskFileOpen(true);
    } else if (dailyTaskFileOpen) {
      // 计划模式默认收起文件，呈现上 2 下 3 布局
      setDailyTaskFileOpen(false);
    }
    render();
    return;
  }
  if (type === 'select-daily-task') {
    const nextId = action.dataset.id || '';
    const nextOpen = selectedDailyTaskId === nextId ? !dailyTaskFileOpen : true;
    selectedDailyTaskId = nextId;
    localStorage.setItem(userPreferenceKey('performance-selected-daily-task'), selectedDailyTaskId);
    setDailyTaskFileOpen(nextOpen);
    render();
    return;
  }
  if (type === 'toggle-daily-task-file') {
    setDailyTaskFileOpen(!dailyTaskFileOpen);
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
  if (type === 'rework-pool') { const item = state.workItems.find((entry) => entry.id === action.dataset.id); if (item) { item.status = 'doing'; item.acceptanceStatus = 'rework'; notifyRework(item); save(); render(); toast('已退回修改'); } return; }
  if (type === 'accept-project-task') return acceptProjectTask(action.dataset.projectId, action.dataset.taskId);
  if (type === 'rework-project-task') return reworkProjectTask(action.dataset.projectId, action.dataset.taskId);
  if (type === 'open-project-task-acceptance') return openProjectTaskFromAcceptance(action.dataset.projectId, action.dataset.taskId);
  if (type === 'record-performance') { const item = state.workItems.find((entry) => entry.id === action.dataset.id); if (item) { const taskId = crypto.randomUUID(); state.tasks.unshift({ id: taskId, date: item.completedAt ? dateToISO(item.completedAt) : dateToISO(new Date()), content: item.title, body: '', category: item.category || state.settings.taskCategories[0] || '其他', planType: item.planType || '单人工作', collaborator: '', estimatedHours: '', actualHours: '', completionPct: 100, collaborationPct: 0, innovation: '', selfScore: '', reviewerScore: '', nextPlan: '', blocker: item.description || '', breakthrough: '', subtasks: [] }); item.performanceTaskId = taskId; save(); selectedWorkspaceView = 'performance'; activeTab = 'summary'; summaryFilters = { search: '', source: 'task', status: '' }; render(); toast('已建立绩效记录，请补充工时和评分'); } return; }
  if (type === 'add-plan-item') return addPlanItem(action.dataset.planKind, action.dataset.planKey);
  if (type === 'toggle-plan-item') { const plan = planFor(action.dataset.planKind, action.dataset.planKey); const item = plan.items.find((entry) => entry.id === action.dataset.itemId); if (item) { setLinkDone(item, action.checked); save(); render(); } return; }
  if (type === 'delete-plan-item') { const plan = planFor(action.dataset.planKind, action.dataset.planKey); plan.items = plan.items.filter((item) => item.id !== action.dataset.itemId); save(); render(); return; }
  if (type === 'add-category') { const input = document.querySelector('#new-category'); const category = input?.value.trim(); if (!category) return toast('请输入工作分类名称'); if (state.settings.taskCategories.includes(category)) return toast('该分类已存在'); state.settings.taskCategories.push(category); save(); render(); toast('工作分类已添加'); return; }
  if (type === 'remove-category') { if (state.settings.taskCategories.length <= 1) return toast('至少保留一个工作分类'); state.settings.taskCategories = state.settings.taskCategories.filter((category) => category !== action.dataset.category); save(); render(); toast('工作分类已移除'); return; }
  if (type === 'edit-task') return openTaskDialog(taskForId(action.dataset.id));
  if (type === 'copy-task') { const copy = structuredClone(taskForId(action.dataset.id)); copy.id = crypto.randomUUID(); state.tasks.push(copy); save(); render(); return toast('任务已复制'); }
  if (type === 'delete-task') { openConfirmDialog('删除任务', '确认删除这条任务？', () => { state.tasks = state.tasks.filter((task) => task.id !== action.dataset.id); save(); render(); toast('任务已删除'); }); return; }
  if (type === 'day-tasks') { selectedWorkspaceView = 'performance'; activeTab = 'summary'; summaryFilters = { search: '', source: 'task', status: '' }; selectedDate = action.dataset.date; render(); return; }
  if (type === 'jump-month') { currentMonth = Number(action.dataset.month); activeTab = 'overview'; render(); return; }
  if (type === 'import-trigger') return $('#excel-input').click();
  if (type === 'export-json') return exportJson();
  if (type === 'export-excel') return exportExcel();
  if (type === 'reset') { openConfirmDialog('恢复默认', '恢复默认会清除当前所有本地数据，确认继续？', () => { state = normalizeState(DEFAULT_STATE); save(); render(); toast('已恢复默认'); }); return; }
  if (type === 'add-override') { const date = $('#override-date').value; if (!date) return toast('请选择日期'); const kind = $('#override-kind').value; const hours = $('#override-hours').value; state.calendarOverrides[date] = { kind, ...(hours === '' ? {} : { hours: Number(hours) }) }; save(); render(); return toast('日期规则已添加'); }
  if (type === 'remove-override') { delete state.calendarOverrides[action.dataset.date]; save(); render(); return toast('日期规则已移除'); }
  if (type === 'select-doc') { docSelection = { kind: 'doc', id: action.dataset.docId }; render(); return; }
  if (type === 'select-doc-task') { docSelection = { kind: 'task', id: action.dataset.taskId }; render(); return; }
  if (type === 'toggle-doc-folder') { const fid = action.dataset.folderId; if (docExpanded.has(fid)) docExpanded.delete(fid); else docExpanded.add(fid); render(); return; }
  if (type === 'add-doc') { const node = createDocumentNode(null); state.documentTree.push(node); docSelection = { kind: 'doc', id: node.id }; save(); render(); setTimeout(() => document.querySelector(`[data-doc-title][data-doc-id="${node.id}"]`)?.select(), 0); return; }
  if (type === 'add-doc-folder') { openPromptDialog('新建文件夹', '文件夹名称', '新建文件夹', (name) => { if (name === null) return; const node = createFolderNode(null, name.trim() || '新建文件夹'); state.documentTree.push(node); docExpanded.add(node.id); save(); render(); }); return; }
  if (type === 'add-doc-in-folder') { const node = createDocumentNode(action.dataset.folderId); state.documentTree.push(node); docExpanded.add(action.dataset.folderId); docSelection = { kind: 'doc', id: node.id }; save(); render(); return; }
  if (type === 'rename-doc-node') { const node = documentNodes(state).find((n) => n.id === action.dataset.nodeId); if (!node) return; openPromptDialog(node.kind === 'folder' ? '重命名文件夹' : '重命名文档', node.kind === 'folder' ? '文件夹名称' : '文档名称', node.title || '', (name) => { if (name === null) return; node.title = name.trim() || node.title; save(); render(); }); return; }
  if (type === 'delete-doc-node') {
    const node = documentNodes(state).find((n) => n.id === action.dataset.nodeId);
    if (!node) return;
    const msg = node.kind === 'folder' ? `确认删除文件夹“${node.title}”及其内部全部文档？` : `确认删除文档“${node.title}”？`;
    openConfirmDialog(node.kind === 'folder' ? '删除文件夹' : '删除文档', msg, () => {
      const ids = node.kind === 'folder' ? collectDescendantIds(documentNodes(state), node.id) : new Set([node.id]);
      state.documentTree = state.documentTree.filter((n) => !ids.has(n.id));
      if (docSelection.kind === 'doc' && ids.has(docSelection.id)) docSelection = { kind: 'doc', id: '' };
      save(); render(); toast('已删除');
    });
    return;
  }
  if (type === 'select-project') { selectedProjectId = action.dataset.projectId; render(); return; }
  if (type === 'open-project') { selectedProjectId = action.dataset.projectId; selectedProjectTaskId = ''; activeProjectTab = '概览'; render(); return; }
  if (type === 'project-detail-tab') { activeProjectTab = action.dataset.detailTab; render(); return; }
  if (type === 'open-project-center') { selectedProjectId = ''; selectedProjectTaskId = ''; render(); return; }
  if (type === 'project-filter') { projectCenterFilter = action.dataset.filter; render(); return; }
  if (type === 'project-view-mode') { projectViewMode = action.dataset.mode; localStorage.setItem('performance-projects-view-mode', projectViewMode); render(); return; }
  if (type === 'toggle-milestone') { const mid = action.dataset.milestoneId; if (collapsedMilestones.has(mid)) collapsedMilestones.delete(mid); else collapsedMilestones.add(mid); render(); return; }
  if (type === 'toggle-project-task') { const tid = action.dataset.taskId; if (collapsedTasks.has(tid)) collapsedTasks.delete(tid); else collapsedTasks.add(tid); render(); return; }
  if (type === 'toggle-task-blocked') return toggleTaskBlocked(action.dataset.taskId);
  if (type === 'open-project-task-detail') { selectedProjectTaskId = action.dataset.taskId; render(); return; }
  if (type === 'close-project-task-detail') { selectedProjectTaskId = ''; render(); return; }
  if (type === 'add-project-subtask') return addProjectSubtask(action.dataset.projectId, action.dataset.milestoneId, action.dataset.taskId);
  if (type === 'add-task-deliverable') return addTaskDeliverable(action.dataset.taskId);
  if (type === 'toggle-task-deliverable') { const dTask = findProjectTask(projectForId(state, selectedProjectId), action.dataset.taskId)?.task; const deliverable = dTask?.deliverables?.find((entry) => entry.id === action.dataset.deliverableId); if (deliverable) { deliverable.done = action.checked; save(); render(); } return; }
  if (type === 'delete-task-deliverable') { const dTask = findProjectTask(projectForId(state, selectedProjectId), action.dataset.taskId)?.task; if (dTask) { dTask.deliverables = (dTask.deliverables || []).filter((entry) => entry.id !== action.dataset.deliverableId); save(); render(); } return; }
  if (type === 'add-task-comment') return addTaskComment(action.dataset.taskId);
  if (type === 'open-sop-templates') { sopViewOpen = true; selectedProjectId = ''; selectedProjectTaskId = ''; render(); return; }
  if (type === 'sop-back-center') { sopViewOpen = false; render(); return; }
  if (type === 'add-sop-template') return openSopTemplateDialog();
  if (type === 'edit-sop-template') return openSopTemplateDialog(action.dataset.templateId);
  if (type === 'duplicate-sop-template') return openSopTemplateDialog(action.dataset.templateId, true);
  if (type === 'delete-sop-template') return deleteSopTemplate(action.dataset.templateId);
  if (type === 'sop-generate-project') return generateProjectFromTemplate(action.dataset.templateId);
  if (type === 'add-sop-node') { editingSopNodes.push(createSopNode()); $('#sop-node-editor').innerHTML = renderSopNodeEditor(editingSopNodes); return; }
  if (type === 'remove-sop-node') { if (editingSopNodes.length <= 1) return toast('至少保留一个流程节点'); editingSopNodes.splice(Number(action.dataset.nodeIndex), 1); $('#sop-node-editor').innerHTML = renderSopNodeEditor(editingSopNodes); return; }
  if (type === 'cancel-sop-template') return closeSopTemplateDialog();
  if (type === 'remove-task-predecessor') { const pTask = findProjectTask(projectForId(state, selectedProjectId), action.dataset.taskId)?.task; if (pTask) { pTask.predecessors = (pTask.predecessors || []).filter((id) => id !== action.dataset.predecessorId); save(); render(); } return; }
  if (type === 'add-project') return openProjectDialog();
  if (type === 'edit-project') return openProjectDialog(action.dataset.projectId);
  if (type === 'delete-project') return deleteProject(action.dataset.projectId);
  if (type === 'link-tasks-project') return openLinkTasksDialog(action.dataset.projectId);
  if (type === 'cancel-project') return closeProjectDialog();
  if (type === 'save-project') return saveProjectFromDialog();
  if (type === 'close-link-tasks') return closeLinkTasksDialog();
  if (type === 'toggle-project-task-link') { toggleProjectTaskLink(action.dataset.projectId, action.dataset.taskId, action.checked); return; }
  if (type === 'open-sync-pool') return openSyncPoolDialog();
  if (type === 'close-sync-pool') return closeSyncPoolDialog();
  if (type === 'sync-pool-confirm') return performSyncToPool();
  if (type === 'toggle-sync-section') { const key = action.dataset.section; if (syncPoolSelected.has(key)) syncPoolSelected.delete(key); else syncPoolSelected.add(key); action.closest('.sync-pool-section')?.classList.toggle('selected', syncPoolSelected.has(key)); return; }
});

document.addEventListener('change', async (event) => {
  const target = event.target;
  if (target.matches('[data-project-search]')) { projectSearch = target.value; render(); return; }
  if (target.matches('[data-project-task-filter]')) { projectTaskStatusFilter = target.value; render(); return; }
  if (target.matches('[data-project-task-view]')) { projectTaskView = target.value; render(); return; }
  if (target.matches('[data-task-field]')) { const task = findProjectTask(projectForId(state, selectedProjectId), target.dataset.taskId)?.task; if (task) { task[target.dataset.taskField] = target.value; save(); render(); } return; }
  if (target.matches('[data-task-predecessor-select]')) { if (!target.value) return; const task = findProjectTask(projectForId(state, selectedProjectId), target.dataset.taskId)?.task; if (task) { if (!Array.isArray(task.predecessors)) task.predecessors = []; if (!task.predecessors.includes(target.value)) { task.predecessors.push(target.value); save(); render(); toast('已添加前置任务'); } } return; }
  if (target.matches('[data-deliverable-field]')) { const task = findProjectTask(projectForId(state, selectedProjectId), target.dataset.taskId)?.task; const deliverable = task?.deliverables?.find((entry) => entry.id === target.dataset.deliverableId); if (deliverable) { deliverable.text = target.value; save(); } return; }
  if (target.id === 'topbar-date-input') { selectedDailyDate = target.value || dateToISO(new Date()); render(); return; }
  if (target.matches('[data-month-select]')) { currentMonth = Number(target.value); selectedDate = ''; render(); return; }
  if (target.matches('[data-daily-date-select]')) { selectedDailyDate = target.value || dateToISO(new Date()); render(); return; }
  if (target.matches('[data-daily-task-status]')) { const task = taskForId(target.dataset.id); if (task) { task.completionPct = { todo: 0, doing: 50, done: 100 }[target.value]; save(); render(); } return; }
  if (target.matches('[data-daily-plan-status]')) { const item = dailyPlanFor(target.dataset.date)[target.dataset.bucket].find((entry) => entry.id === target.dataset.itemId); if (item) { setLinkDone(item, target.value === 'done'); save(); render(); } return; }
  if (target.matches('[data-daily-task-next-status]')) { const task = taskForId(target.dataset.id); if (task) { task.nextPlanDone = target.value === 'done'; save(); render(); } return; }
  if (target.matches('[data-plan-block-status]')) { const item = planFor(target.dataset.planKind, target.dataset.planKey).items.find((entry) => entry.id === target.dataset.itemId); if (item) { setLinkDone(item, target.value === 'done'); save(); render(); } return; }
  if (target.matches('[data-daily-item-field]')) { const item = dailyItemFrom(target); if (item) { const canonical = resolveLinkTarget(item.linkRef) || item; canonical[isTaskLink(item) ? 'content' : target.dataset.dailyItemField] = target.value; save(); } return; }
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
  if (target.matches('[data-property-field]')) {
    const task = taskForId(target.dataset.taskId);
    if (!task) return;
    const key = target.dataset.propertyField;
    const isCustom = target.hasAttribute('data-custom-property');
    if (isCustom) {
      const prop = getTaskCustomProperties(task).find((p) => p.id === key);
      if (prop) { prop.value = target.value; save(); }
    } else {
      const numericFields = ['estimatedHours', 'actualHours', 'completionPct', 'collaborationPct', 'innovation', 'selfScore', 'reviewerScore'];
      task[key] = numericFields.includes(key) ? formNumber(key, target.value) : target.value;
      if (key === 'date' && task.date) selectedDailyDate = task.date;
      save();
    }
    if (target.tagName !== 'TEXTAREA') render();
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
  if (target.matches('[data-user-template]')) {
    const user = activeUser();
    if (user) {
      user.assessmentTemplateId = assessmentTemplate(target.value).id;
      saveUserDirectory();
      render();
      toast(`已为 ${user.name} 分配“${assessmentTemplate(user.assessmentTemplateId).name}”`);
    }
    return;
  }
  if (target.matches('[data-profile]')) { state.profile[target.dataset.profile] = target.dataset.profile === 'year' ? Number(target.value) : target.value; save(); render(); return; }
  if (target.matches('.field-config-check[data-field-config]')) {
    const index = Number(target.dataset.index);
    const field = target.dataset.fieldConfig;
    const configs = state.settings.fieldConfigs;
    if (Array.isArray(configs) && configs[index] && ['required', 'visible'].includes(field)) {
      configs[index][field] = target.checked;
      save();
      toast(field === 'required' ? (target.checked ? `"${configs[index].label}" 已设为必填` : `"${configs[index].label}" 已取消必填`) : (target.checked ? `"${configs[index].label}" 已设为可见` : `"${configs[index].label}" 已隐藏`));
    }
    return;
  }
  if (target.matches('[data-setting]')) { const key = target.dataset.setting; const value = Number(target.value); if (key.startsWith('gradeThresholds.')) state.settings.gradeThresholds[key.split('.')[1]] = value; else state.settings[key] = value; if (key === 'standardDayHours' && Number.isFinite(value) && value > 0) state.settings.baseRewardPerHour = 100 / value; save(); render(); return; }
  if (persistOperationsInput(target)) { render(); return; }
  if (target.matches('[data-doc-title]')) { const node = documentNodes(state).find((n) => n.id === target.dataset.docId); if (node) { node.title = target.value; node.updatedAt = new Date().toISOString(); save(); render(); } return; }
  if (target.matches('[data-doc-task-title]')) { const task = taskForId(target.dataset.taskId); if (task) { task.content = target.value; save(); render(); } return; }
  if (target.matches('[data-review]')) { const key = target.dataset.reviewMonth; state.monthlyReviews[key] = { ...(state.monthlyReviews[key] || {}), [target.dataset.review]: target.dataset.review === 'note' ? target.value : formNumber('selfScore', target.value) }; save(); render(); }
});

document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.matches('[data-novel-content]')) {
    saveNovelBody(target);
    detectNovelSlash(target);
    detectNovelMention(target);
    return;
  }
  if (target.matches('textarea[data-property-field]')) {
    const task = taskForId(target.dataset.taskId);
    if (task) {
      const key = target.dataset.propertyField;
      if (target.hasAttribute('data-custom-property')) {
        const prop = getTaskCustomProperties(task).find((p) => p.id === key);
        if (prop) { prop.value = target.value; save(); }
      } else { task[key] = target.value; save(); }
    }
    return;
  }
  if (target.matches('[data-template-dimension-field]')) {
    const dimension = editingTemplateDimensions[Number(target.dataset.dimensionIndex)];
    if (dimension) dimension[target.dataset.templateDimensionField] = target.value;
    return;
  }
  if (target.matches('[data-template-indicator-field]')) {
    const dimensionIndex = Number(target.dataset.dimensionIndex);
    const indicator = editingTemplateDimensions[dimensionIndex]?.indicators[Number(target.dataset.indicatorIndex)];
    if (indicator) indicator[target.dataset.templateIndicatorField] = target.value;
    syncTemplateEditorWeight();
    const dimensionNode = target.closest('.template-builder-dimension');
    if (dimensionNode && editingTemplateDimensions[dimensionIndex]) {
      const weight = editingTemplateDimensions[dimensionIndex].indicators.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
      dimensionNode.querySelector('.template-builder-dimension-head > strong').textContent = `${num(weight, 1)}%`;
    }
    return;
  }
  if (target.matches('[data-sop-node-field]')) { const node = editingSopNodes[Number(target.dataset.nodeIndex)]; if (node) { node[target.dataset.sopNodeField] = target.value; } return; }
  persistOperationsInput(target);
  if (target.matches('.field-config-input[data-field-config]')) {
    const index = Number(target.dataset.index);
    const field = target.dataset.fieldConfig;
    const configs = state.settings.fieldConfigs;
    if (Array.isArray(configs) && configs[index] && ['label', 'defaultValue'].includes(field)) {
      configs[index][field] = target.value;
      save();
    }
    return;
  }
});
document.addEventListener('blur', (event) => {
  if (event.target.matches('[data-task-field]')) updateTaskField(event.target);
  if (event.target.matches('[data-daily-quick-task]')) commitQuickDailyTask(event.target);
  if (event.target.matches('[data-daily-quick-tomorrow]')) commitQuickTomorrowItem(event.target);
  if (event.target.matches('[data-kanban-quick]')) commitQuickKanbanTask(event.target);
  if (event.target.matches('[data-plan-quick]')) commitQuickPlanItem(event.target);
  if (event.target.matches('[data-summary-quick-task]')) commitQuickSummaryRow(event.target);
}, true);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.isComposing) return;
  if (event.target.matches('#chat-message-input')) { event.preventDefault(); const targetId = event.target.dataset.chatTarget; if (targetId) sendChatMessage(targetId); return; }
  if (event.target.matches('[data-task-comment-input]')) { event.preventDefault(); addTaskComment(event.target.dataset.taskId); return; }
  if (event.target.matches('[data-daily-quick-task]')) { event.preventDefault(); commitQuickDailyTask(event.target, true); return; }
  if (event.target.matches('[data-daily-quick-tomorrow]')) { event.preventDefault(); commitQuickTomorrowItem(event.target, true); return; }
  if (event.target.matches('[data-kanban-quick]')) { event.preventDefault(); commitQuickKanbanTask(event.target, true); return; }
  if (event.target.matches('[data-plan-quick]')) { event.preventDefault(); commitQuickPlanItem(event.target, true); return; }
  if (event.target.matches('[data-summary-quick-task]')) { event.preventDefault(); commitQuickSummaryRow(event.target, true); return; }
  if (event.target.matches('[data-daily-new]')) { event.preventDefault(); document.querySelector(`[data-action="add-daily-item"][data-daily-date="${event.target.dataset.date}"][data-daily-bucket="${event.target.dataset.dailyNew}"]`)?.click(); }
  if (event.target.matches('[data-task-subtask-field="text"]')) { event.preventDefault(); addSubtaskToTask(event.target.dataset.taskId); }
});
document.addEventListener('keydown', (event) => {
  const editor = event.target.closest && event.target.closest('[data-novel-content]');
  if (!editor) {
    if (event.key === 'Escape' && novelSlash.open) closeNovelSlash();
    return;
  }
  if (event.key === 'Escape') {
    if (mentionState.open) { event.preventDefault(); closeMentionMenu(); }
    else if (novelSlash.open) { event.preventDefault(); closeNovelSlash(); }
    else if (novelBubble.open) closeNovelBubble();
    return;
  }
  if (event.isComposing) return;
  if (event.key === ' ' || event.key === 'Enter') {
    if (tryNovelMarkdownShortcut(editor)) { event.preventDefault(); return; }
  }
});
document.addEventListener('selectionchange', updateNovelBubble);
document.addEventListener('mousedown', (event) => {
  const insertBtn = event.target.closest('[data-novel-insert]');
  if (insertBtn) {
    event.preventDefault();
    const editor = insertBtn.closest('.novel-editor')?.querySelector('[data-novel-content]');
    if (editor) insertNovelBlockFromSlash(editor, insertBtn.dataset.novelInsert);
    return;
  }
  const formatBtn = event.target.closest('[data-novel-format]');
  if (formatBtn) {
    event.preventDefault();
    applyNovelFormat(formatBtn.dataset.novelFormat, formatBtn.dataset.value || null);
    return;
  }
});
document.addEventListener('dragstart', (event) => {
  const navItem = event.target.closest('.nav-item[data-tab]');
  if (navItem && navItem.closest('.nav-list')) {
    draggedNavItem = navItem;
    navItem.classList.add('dragging');
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', navItem.dataset.tab); }
    return;
  }
  const block = event.target.closest('[data-sortable-block]');
  if (!block) return;
  if (block.closest('[data-daily-panel].is-frozen')) { event.preventDefault(); return; }
  if (!event.target.closest('.daily-block-handle')) { event.preventDefault(); return; }
  draggedSortableBlock = block;
  block.classList.add('dragging');
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'copyMove'; event.dataTransfer.setData('text/plain', block.dataset.blockKey); }
});
document.addEventListener('dragover', (event) => {
  if (draggedNavItem) {
    const target = event.target.closest('.nav-item[data-tab]');
    if (!target || !target.closest('.nav-list') || target === draggedNavItem) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.nav-item.drop-before, .nav-item.drop-after').forEach((node) => node.classList.remove('drop-before', 'drop-after'));
    const rect = target.getBoundingClientRect();
    const placeAfter = event.clientY > rect.top + rect.height / 2;
    target.classList.add(placeAfter ? 'drop-after' : 'drop-before');
    return;
  }
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
  if (draggedNavItem) {
    const target = event.target.closest('.nav-item[data-tab]');
    if (target && target.closest('.nav-list') && target !== draggedNavItem) {
      event.preventDefault();
      const rect = target.getBoundingClientRect();
      const placeAfter = event.clientY > rect.top + rect.height / 2;
      const list = draggedNavItem.parentNode;
      if (placeAfter) target.after(draggedNavItem);
      else target.before(draggedNavItem);
      saveNavOrder();
    }
    draggedNavItem = null;
    document.querySelectorAll('.nav-item[draggable]').forEach((node) => { node.draggable = true; });
    render();
    return;
  }
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
  document.querySelectorAll('.nav-item.dragging, .nav-item.drop-before, .nav-item.drop-after').forEach((node) => node.classList.remove('dragging', 'drop-before', 'drop-after'));
  draggedNavItem = null;
  document.querySelectorAll('[data-sortable-block].dragging, [data-sortable-block].drop-before, [data-sortable-block].drop-after').forEach((block) => block.classList.remove('dragging', 'drop-before', 'drop-after'));
  document.querySelectorAll('[data-sort-container].copy-target').forEach((node) => node.classList.remove('copy-target'));
  draggedSortableBlock = null;
});
document.addEventListener('pointerdown', (event) => {
  const kanbanResizeHandle = event.target.closest('[data-kanban-resize]');
  if (kanbanResizeHandle) {
    event.preventDefault();
    const kanban = kanbanResizeHandle.closest('.daily-kanban');
    if (!kanban) return;
    const colIdx = Number(kanbanResizeHandle.dataset.kanbanResize);
    kanbanResizeHandle.setPointerCapture?.(event.pointerId);
    resizingKanbanCol = {
      kanban,
      handle: kanbanResizeHandle,
      colIdx,
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidths: getKanbanWidths(),
      kanbanWidth: kanban.getBoundingClientRect().width,
    };
    document.body.classList.add('kanban-col-resizing');
    return;
  }
  const taskSplitDivider = event.target.closest('[data-task-divider]');
  if (taskSplitDivider) {
    const layout = taskSplitDivider.closest('.today-task-file-layout');
    if (!layout || layout.classList.contains('file-collapsed')) return;
    event.preventDefault();
    taskSplitDivider.setPointerCapture?.(event.pointerId);
    resizingTaskSplit = { layout, pointerId: event.pointerId, startX: event.clientX, startRatio: dailyTaskSplitRatio, startWidth: layout.getBoundingClientRect().width };
    document.body.classList.add('today-task-split-resizing');
    return;
  }
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
  if (resizingKanbanCol) {
    const resize = resizingKanbanCol;
    const delta = event.clientX - resize.startX;
    const pctDelta = resize.kanbanWidth > 0 ? (delta / resize.kanbanWidth) * 100 : 0;
    const widths = [...resize.startWidths];
    const colIdx = resize.colIdx;
    const nextIdx = colIdx + 1;
    const minW = 15;
    const newCur = Math.min(70, Math.max(minW, widths[colIdx] + pctDelta));
    const diff = newCur - widths[colIdx];
    widths[colIdx] = newCur;
    widths[nextIdx] = Math.max(minW, widths[nextIdx] - diff);
    // normalize sum to 100
    const total = widths.reduce((a, b) => a + b, 0);
    const factor = 100 / total;
    const normalized = widths.map((w) => w * factor);
    resize.kanban.style.setProperty('--kanban-w0', `${normalized[0]}%`);
    resize.kanban.style.setProperty('--kanban-w1', `${normalized[1]}%`);
    resize.kanban.style.setProperty('--kanban-w2', `${normalized[2]}%`);
    resize._pendingWidths = normalized;
    return;
  }
  if (resizingTaskSplit) {
    const resize = resizingTaskSplit;
    const width = resize.layout.getBoundingClientRect().width;
    if (width) {
      const ratio = Math.min(0.7, Math.max(0.15, resize.startRatio + (event.clientX - resize.startX) / resize.startWidth));
      dailyTaskSplitRatio = ratio;
      resize.layout.style.setProperty('--task-split', ratio);
    }
    return;
  }
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
  if (resizingKanbanCol) {
    const resize = resizingKanbanCol;
    resize.handle.releasePointerCapture?.(resize.pointerId);
    if (resize._pendingWidths) {
      saveKanbanWidths(resize._pendingWidths);
    }
    resizingKanbanCol = null;
    document.body.classList.remove('kanban-col-resizing');
    return;
  }
  if (resizingTaskSplit) {
    resizingTaskSplit.layout.releasePointerCapture?.(resizingTaskSplit.pointerId);
    saveTaskSplitRatio();
    resizingTaskSplit = null;
    document.body.classList.remove('today-task-split-resizing');
    return;
  }
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
  resizingTaskSplit = null;
  resizingKanbanCol = null;
  document.body.classList.remove('resizing-panels');
  document.body.classList.remove('resizing-daily-row');
  document.body.classList.remove('today-task-split-resizing');
  document.body.classList.remove('kanban-col-resizing');
});
document.addEventListener('submit', (event) => {
  if (event.target.id === 'summary-item-form') { event.preventDefault(); saveSummaryItem(); return; }
  if (event.target.id === 'user-form') { event.preventDefault(); saveUserFromDialog(); return; }
  if (event.target.id === 'template-form') { event.preventDefault(); saveAssessmentTemplateFromDialog(); return; }
  if (event.target.id === 'project-form') { event.preventDefault(); saveProjectFromDialog(); return; }
  if (event.target.id === 'milestone-form') { event.preventDefault(); saveMilestoneFromDialog(); return; }
  if (event.target.id === 'project-task-form') { event.preventDefault(); saveProjectTaskFromDialog(); return; }
  if (event.target.id === 'sop-template-form') { event.preventDefault(); saveSopTemplateFromDialog(); return; }
  if (event.target.id === 'prompt-form') {
    event.preventDefault();
    const value = $('#prompt-dialog-input')?.value ?? '';
    const cb = promptResolve;
    closePromptDialog();
    if (cb) cb(value);
    return;
  }
});

function updateTaskField(target) {
  const task = taskForId(target.dataset.taskId); if (!task) return;
  const key = target.dataset.taskField;
  const numeric = ['estimatedHours', 'actualHours', 'completionPct', 'collaborationPct', 'innovation', 'selfScore', 'reviewerScore'].includes(key);
  task[key] = numeric ? formNumber(key, target.value) : target.value;
  save();
  const row = target.closest('tr');
  if (row && (target.type === 'number' || target.tagName === 'SELECT' || target.type === 'date')) { render(); }
}

// ===== @提及与通知系统 =====
function loadAllMessages() {
  return parseStoredJson(MESSAGES_KEY, []);
}
function saveAllMessages(messages) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}
function notifyUser(targetUserId, notification) {
  if (!targetUserId) return;
  if (targetUserId === activeUserId) {
    if (!state.notifications) state.notifications = [];
    state.notifications.unshift(notification);
    save();
  } else {
    const targetState = normalizeState(parseStoredJson(userStateKey(targetUserId)));
    targetState.notifications = Array.isArray(targetState.notifications) ? targetState.notifications : [];
    targetState.notifications.unshift(notification);
    localStorage.setItem(userStateKey(targetUserId), JSON.stringify(targetState));
  }
  updateChatNavBadge();
}

function pushSystemNotification(type, payload) {
  const current = activeUser();
  if (!current) return;
  if ((state.notifications || []).some((n) => n.key === payload.key)) return;
  if (!state.notifications) state.notifications = [];
  state.notifications.unshift(createNotification(null, current.id, type, payload));
}

function notifyReviewerAssignment(item, previousReviewer) {
  const reviewerName = String(item?.reviewer || '').trim();
  if (!reviewerName || reviewerName === String(previousReviewer || '').trim()) return;
  const current = activeUser();
  const target = users.find((u) => u.name.trim() === reviewerName && u.id !== current?.id);
  if (!target) return;
  notifyUser(target.id, createNotification(current, target.id, 'reviewer', { title: `「${item.title}」等待你验收`, taskId: item.id, toUserId: target.id }));
}

function notifyRework(item) {
  const current = activeUser();
  const ownerName = String(item?.owner || '').trim();
  if (!ownerName || ownerName === String(current?.name || '').trim()) return;
  const target = users.find((u) => u.name.trim() === ownerName && u.id !== current?.id);
  if (!target) return;
  notifyUser(target.id, createNotification(current, target.id, 'rework', { title: `「${item.title}」被退回修改，请重新处理。`, taskId: item.id, toUserId: target.id }));
}

function runReminderChecks() {
  const current = activeUser();
  if (!current) return;
  const today = dateToISO(new Date());

  if (calendarHours(today, state) > 0 && !state.tasks.some((task) => task.date === today && String(task.content || '').trim())) {
    pushSystemNotification('daily-reminder', { key: `daily-reminder:${today}`, title: '今天还没有填写工作记录，别忘了记录当天的工作投入。' });
  }

  const upcomingDays = 3;
  for (const item of state.workItems) {
    if (!item || item.status === 'done' || !String(item.title || '').trim() || !item.dueDate) continue;
    const due = new Date(`${item.dueDate}T12:00:00`);
    const diffDays = Math.round((due.getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000);
    if (diffDays < 0) {
      pushSystemNotification('overdue', { key: `overdue:${item.id}`, title: `「${item.title}」已超期 ${Math.abs(diffDays)} 天，请尽快处理。`, taskId: item.id });
    } else if (diffDays <= upcomingDays) {
      pushSystemNotification('deadline', { key: `deadline:${item.id}`, title: `「${item.title}」${diffDays === 0 ? '今天到期' : `${diffDays} 天后到期`}，请安排推进。`, taskId: item.id });
    }
  }

  save();
  updateChatNavBadge();
}

function renderChatView() {
  const current = activeUser();
  const isMessages = chatTab === 'messages';
  const selectedTarget = users.find((u) => u.id === getSelectedChatUserId());
  let allMessages = loadAllMessages();
  if (isMessages && selectedTarget) {
    let changed = false;
    allMessages = allMessages.map((m) => {
      if (m.fromUserId === selectedTarget.id && m.toUserId === current.id && !m.read) { changed = true; return { ...m, read: true }; }
      return m;
    });
    if (changed) saveAllMessages(allMessages);
  }
  const notifications = state.notifications || [];
  const unreadNotif = notifications.filter((n) => !n.read).length;
  const unreadMsgs = allMessages.filter((m) => m.toUserId === current.id && !m.read).length;
  const conversationHtml = selectedTarget
    ? `<div class="chat-conv-head"><strong>${esc(selectedTarget.name)}</strong></div><div class="chat-conv-messages" id="chat-conv-messages">${renderChatConversation(allMessages, current.id, selectedTarget)}</div>${renderChatInputArea(selectedTarget.id)}`
    : `<div class="chat-conversation-empty"><div class="chat-empty-avatar"><i class="ri-message-3-line"></i></div><p>选择左侧联系人开始对话</p></div>`;
  return `<div class="chat-view">
    <div class="page-head chat-page-head">
      <div><span class="eyebrow">消息中心</span><h1>聊天</h1><p>通知与协作沟通集中在一个入口。</p></div>
      <div class="head-controls">${isMessages ? '' : '<button class="button" data-action="mark-all-read">全部已读</button>'}</div>
    </div>
    <div class="chat-view-tabs" role="tablist">
      <button type="button" class="chat-view-tab ${isMessages ? 'active' : ''}" data-action="chat-tab" data-chat-tab="messages" role="tab" aria-selected="${isMessages}"><i class="ri-message-3-line"></i><span>消息</span>${unreadMsgs ? `<em class="chat-tab-badge">${unreadMsgs}</em>` : ''}</button>
      <button type="button" class="chat-view-tab ${!isMessages ? 'active' : ''}" data-action="chat-tab" data-chat-tab="notifications" role="tab" aria-selected="${!isMessages}"><i class="ri-notification-3-line"></i><span>通知</span>${unreadNotif ? `<em class="chat-tab-badge">${unreadNotif}</em>` : ''}</button>
    </div>
    <div class="card chat-view-body">
      ${isMessages
        ? `<div class="chat-panel-body">${renderChatUserList(current, users, allMessages)}<div class="chat-conversation">${conversationHtml}</div></div>`
        : `<div class="notification-panel-body">${renderNotificationItems(state)}</div>`}
    </div>
  </div>`;
}

function sendChatMessage(targetUserId) {
  const input = document.getElementById('chat-message-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  const from = activeUser();
  if (!from) return;
  const msg = createMessage(from, targetUserId, content);
  const allMessages = loadAllMessages();
  allMessages.push(msg);
  saveAllMessages(allMessages);
  const notification = createNotification(from, targetUserId, 'chat', { content, toUserId: targetUserId });
  notifyUser(targetUserId, notification);
  setSelectedChatUserId(targetUserId);
  render();
  const msgScroll = document.getElementById('chat-conv-messages');
  if (msgScroll) setTimeout(() => { msgScroll.scrollTop = msgScroll.scrollHeight; }, 50);
}

function detectNovelMention(editor) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return;
  const range = sel.getRangeAt(0);
  const node = sel.anchorNode;
  if (node.nodeType !== 3) return;
  const text = node.textContent || '';
  const offset = sel.anchorOffset;
  const beforeCursor = text.slice(0, offset);
  const atIndex = beforeCursor.lastIndexOf('@');
  if (atIndex < 0) { closeMentionMenu(); return; }
  const query = beforeCursor.slice(atIndex + 1);
  if (query.includes(' ') || query.includes('\n')) { closeMentionMenu(); return; }
  const otherUsers = users.filter((u) => u.id !== activeUser()?.id);
  if (!otherUsers.length) { closeMentionMenu(); return; }
  mentionState = { open: true, editor, query, textNode: node, atIndex, offset };
  const rect = range.getBoundingClientRect();
  const wrapper = document.getElementById('mention-menu-wrapper');
  if (!wrapper) return;
  wrapper.style.left = `${rect.left}px`;
  wrapper.style.top = `${rect.bottom + 6}px`;
  wrapper.innerHTML = renderMentionMenu(otherUsers, query);
}

function closeMentionMenu() {
  if (mentionState.open) {
    mentionState = { open: false, editor: null, query: '', textNode: null, atIndex: 0 };
    const wrapper = document.getElementById('mention-menu-wrapper');
    if (wrapper) wrapper.innerHTML = '';
  }
}

function insertMention(userId, userName, editor) {
  const sel = window.getSelection();
  if (!mentionState.textNode || !sel) { closeMentionMenu(); return; }
  const node = mentionState.textNode;
  const atIndex = mentionState.atIndex;
  const offset = mentionState.offset ?? sel.anchorOffset;
  const before = node.textContent.slice(0, atIndex);
  const after = node.textContent.slice(offset);
  // 创建 @提及 span
  const mentionSpan = document.createElement('span');
  mentionSpan.className = 'novel-mention';
  mentionSpan.dataset.mentionUser = userId;
  mentionSpan.contentEditable = 'false';
  mentionSpan.textContent = `@${userName}`;
  const afterText = document.createTextNode(after + '\u00a0');
  const beforeText = document.createTextNode(before);
  const parent = node.parentNode;
  if (!parent) { closeMentionMenu(); return; }
  parent.replaceChild(afterText, node);
  parent.insertBefore(mentionSpan, afterText);
  parent.insertBefore(beforeText, mentionSpan);
  // 将光标移到后面
  const newRange = document.createRange();
  newRange.setStart(afterText, 1);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
  saveNovelBody(editor);
  // 生成通知给被@的用户
  const from = activeUser();
  if (from && userId && userId !== from.id) {
    const notification = createNotification(from, userId, 'mention', {
      taskId: editor.dataset.id,
      taskTitle: novelTargetTitle(editor),
      toUserId: userId,
    });
    notifyUser(userId, notification);
  }
  closeMentionMenu();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') runReminderChecks();
});

export function initPerformanceApp() {
  runReminderChecks();
  applyNavOrder();
  document.querySelectorAll('.nav-list .nav-item[data-tab]').forEach((button) => { button.draggable = true; button.setAttribute('title', '拖动可自定义导航顺序'); });
  render();
}
