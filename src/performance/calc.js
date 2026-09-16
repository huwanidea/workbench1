/* eslint-disable */
export const PLAN_TYPES = ['单人工作', '协同工作', '拓展工作', '加班工作'];
export const TASK_CATEGORIES = ['Bug 修复', '文档撰写', '需求开发', '学习培训', '会议沟通', '产品设计', '项目管理', '测试验收', '协作工作', '其他'];

export const DEFAULT_FIELD_CONFIGS = [
  // 任务池专用字段
  { key: 'title', label: '事项名称', scope: 'pool', required: true, visible: true, defaultValue: '' },
  { key: 'description', label: '事项说明', scope: 'pool', required: false, visible: true, defaultValue: '' },
  { key: 'priority', label: '优先级', scope: 'pool', required: true, visible: true, defaultValue: '普通' },
  { key: 'dueDate', label: '截止日期', scope: 'pool', required: false, visible: true, defaultValue: '' },
  { key: 'status', label: '状态', scope: 'pool', required: true, visible: true, defaultValue: 'todo' },
  { key: 'reviewer', label: '验收人', scope: 'pool', required: false, visible: true, defaultValue: '' },
  // 任务文件专用字段
  { key: 'content', label: '任务内容', scope: 'task', required: true, visible: true, defaultValue: '' },
  { key: 'estimatedHours', label: '预计工时', scope: 'task', required: true, visible: true, defaultValue: '' },
  { key: 'actualHours', label: '实际工时', scope: 'task', required: true, visible: true, defaultValue: '' },
  { key: 'completionPct', label: '交付完成', scope: 'task', required: true, visible: true, defaultValue: '' },
  { key: 'collaborationPct', label: '协作完成', scope: 'task', required: false, visible: false, defaultValue: '' },
  { key: 'innovation', label: '创新分', scope: 'task', required: false, visible: false, defaultValue: '' },
  { key: 'selfScore', label: '自评分', scope: 'task', required: true, visible: true, defaultValue: '' },
  { key: 'reviewerScore', label: '负责人评分', scope: 'task', required: true, visible: true, defaultValue: '' },
  { key: 'blocker', label: '阻塞问题/备注', scope: 'task', required: false, visible: true, defaultValue: '' },
  { key: 'breakthrough', label: '重大突破', scope: 'task', required: false, visible: true, defaultValue: '' },
  // 共用字段
  { key: 'date', label: '日期', scope: 'both', required: true, visible: true, defaultValue: '' },
  { key: 'category', label: '分类', scope: 'both', required: true, visible: true, defaultValue: '其他' },
  { key: 'planType', label: '计划类型', scope: 'both', required: true, visible: true, defaultValue: '单人工作' },
  { key: 'collaborator', label: '协作人', scope: 'both', required: false, visible: false, defaultValue: '' },
];

function migrateFieldConfigs(stored) {
  if (!Array.isArray(stored)) return DEFAULT_FIELD_CONFIGS.map((c) => ({ ...c }));
  const merged = [];
  const seen = new Set();
  for (const item of stored) {
    if (!item || typeof item !== 'object') continue;
    const base = DEFAULT_FIELD_CONFIGS.find((c) => c.key === item.key);
    if (!base) continue;
    merged.push({
      key: base.key,
      label: String(item.label || base.label),
      scope: ['pool', 'task', 'both'].includes(item.scope) ? item.scope : base.scope,
      required: item.required !== undefined ? Boolean(item.required) : base.required,
      visible: item.visible !== undefined ? Boolean(item.visible) : base.visible,
      defaultValue: String(item.defaultValue !== undefined ? item.defaultValue : base.defaultValue),
    });
    seen.add(base.key);
  }
  for (const base of DEFAULT_FIELD_CONFIGS) {
    if (!seen.has(base.key)) merged.push({ ...base });
  }
  return merged;
}

export const DEFAULT_STATE = {
  version: 2,
  profile: { name: '', department: '', position: '', manager: '', year: new Date().getFullYear(), activationDate: '' },
  settings: {
    standardDayHours: 7 + 20 / 60,
    baseRewardPerHour: 100 / (7 + 20 / 60),
    plannedOverageFactor: 1,
    expansionFactor: 1,
    overtimeFactor: 1,
    efficiencyMin: 0.7,
    efficiencyMax: 1.3,
    monthlyInnovationMax: 10,
    dailyPerformanceWeight: 0.8,
    competencyWeight: 0.2,
    taskCategories: [...TASK_CATEGORIES],
    gradeThresholds: { S: 90, A: 80, B: 70, C: 60 },
    fieldConfigs: DEFAULT_FIELD_CONFIGS.map((c) => ({ ...c })),
  },
  calendarOverrides: {},
  tasks: [],
  workItems: [],
  dailyPlans: {},
  plans: { weekly: {}, monthly: {} },
  monthlyReviews: {},
  notifications: [],
  messages: [],
  documentTree: [],
  projects: [],
};

const numberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function dateToISO(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateFromExcelSerial(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return '';
  const date = new Date(Date.UTC(1899, 11, 30) + numeric * 86400000);
  return dateToISO(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function monthKey(year, month) { return `${year}-${String(month).padStart(2, '0')}`; }
export function monthLabel(key) {
  const [year, month] = key.split('-');
  return `${year}年${Number(month)}月`;
}
export function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

export function defaultHoursForDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  if (day === 0) return 0;
  if (day === 6) return 3 + 20 / 60;
  return 7 + 20 / 60;
}

export function calendarHours(dateString, state) {
  const override = state.calendarOverrides?.[dateString];
  if (override?.kind === 'holiday') return 0;
  if (override?.kind === 'workday' && override.hours !== undefined) return Math.max(0, Number(override.hours) || 0);
  if (override?.hours !== undefined) return Math.max(0, Number(override.hours) || 0);
  const activation = dateToISO(state.profile.activationDate);
  if (activation && dateString < activation) return 0;
  return defaultHoursForDate(dateString);
}

export function validateTask(task) {
  const errors = [];
  const completion = numberOrNull(task.completionPct);
  const collaboration = numberOrNull(task.collaborationPct);
  const estimate = numberOrNull(task.estimatedHours);
  const actual = numberOrNull(task.actualHours);
  const scoreFields = [['selfScore', '自评分'], ['reviewerScore', '负责人评分']];
  if (!task.date) errors.push('缺少日期');
  if (!task.content?.trim()) errors.push('缺少工作内容');
  if (!PLAN_TYPES.includes(task.planType)) errors.push('计划类型无效');
  if (estimate === null || estimate <= 0) errors.push('预计工时需大于 0');
  if (actual === null || actual < 0) errors.push('实际工时需大于等于 0');
  if (completion === null || completion < 0 || completion > 100) errors.push('交付完成占比需在 0–100');
  if (collaboration !== null && (collaboration < 0 || collaboration > 100)) errors.push('协作完成占比需在 0–100');
  if (collaboration !== null && completion !== null && collaboration > completion) errors.push('协作完成占比不能超过交付完成占比');
  if (numberOrNull(task.innovation) !== null && (numberOrNull(task.innovation) < 0 || numberOrNull(task.innovation) > 100)) errors.push('创新分需在 0–100');
  for (const [key, label] of scoreFields) {
    const score = numberOrNull(task[key]);
    if (score === null || score < 0 || score > 100) errors.push(`${label}需在 0–100`);
  }
  if (task.planType === '单人工作' && (task.collaborator?.trim() || (collaboration || 0) > 0)) errors.push('单人工作不能填写协作信息');
  if (task.planType === '协同工作' && (!task.collaborator?.trim() || (collaboration || 0) <= 0)) errors.push('协同工作需填写协作人和协作占比');
  return errors;
}

export function calculateTask(task, settings) {
  const estimate = numberOrNull(task.estimatedHours);
  const actual = numberOrNull(task.actualHours);
  const completion = numberOrNull(task.completionPct) ?? 0;
  const collaboration = numberOrNull(task.collaborationPct) ?? 0;
  const ownCompletion = Math.max(0, completion - collaboration);
  const effectiveOutput = estimate === null ? null : estimate * ownCompletion / 100;
  const efficiency = effectiveOutput === null || actual === null || actual === 0
    ? null
    : clamp(effectiveOutput / actual, Number(settings.efficiencyMin), Number(settings.efficiencyMax));
  const quality = numberOrNull(task.selfScore) === null || numberOrNull(task.reviewerScore) === null
    ? null
    : (Number(task.selfScore) * 0.4 + Number(task.reviewerScore) * 0.6) / 100;
  const qualityWeighted = effectiveOutput === null || quality === null ? null : effectiveOutput * quality;
  const weightedEffective = qualityWeighted === null || efficiency === null ? null : qualityWeighted * efficiency;
  const taskScore = weightedEffective === null || !estimate ? null : Math.min(weightedEffective / estimate * 100, 100);
  return { ...task, ownCompletionPct: ownCompletion, effectiveOutputHours: effectiveOutput, efficiency, quality, qualityWeightedHours: qualityWeighted, weightedEffectiveHours: weightedEffective, taskScore, validationErrors: validateTask(task) };
}

function sum(values) { return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0); }

export function calculateDay(dateString, tasks, state) {
  const settings = state.settings;
  const standardHours = calendarHours(dateString, state);
  const dayTasks = tasks.filter((task) => dateToISO(task.date) === dateString).map((task) => calculateTask(task, settings));
  const validationErrors = dayTasks.flatMap((task) => task.validationErrors.map((error) => `${task.content || '未命名任务'}：${error}`));
  const planned = sum(dayTasks.filter((task) => ['单人工作', '协同工作'].includes(task.planType)).map((task) => task.weightedEffectiveHours));
  const expansion = sum(dayTasks.filter((task) => task.planType === '拓展工作').map((task) => task.weightedEffectiveHours));
  const overtime = sum(dayTasks.filter((task) => task.planType === '加班工作').map((task) => task.weightedEffectiveHours));
  const total = planned + expansion + overtime;
  const performanceHours = Math.min(total, standardHours);
  const today = dateToISO(new Date());
  const isFuture = dateString > today;
  const hasTasks = dayTasks.length > 0;
  const canScore = hasTasks && validationErrors.length === 0 && !isFuture && standardHours > 0;
  const performance = canScore ? (() => { const raw = Math.min(performanceHours / standardHours * 100, 100); return Math.abs(raw - 100) < 1e-9 ? 100 : raw; })() : null;
  const plannedOverage = Math.max(planned - standardHours, 0);
  const expansionOverage = Math.max(expansion - Math.max(standardHours - planned, 0), 0);
  const overtimeOverage = Math.max(overtime - Math.max(standardHours - planned - expansion, 0), 0);
  const rewardHours = plannedOverage * Number(settings.plannedOverageFactor) + expansionOverage * Number(settings.expansionFactor) + overtimeOverage * Number(settings.overtimeFactor);
  const hourReward = performance === 100 ? rewardHours * Number(settings.baseRewardPerHour) : 0;
  const actualHours = sum(dayTasks.map((task) => numberOrNull(task.actualHours)));
  const overtimeActualHours = sum(dayTasks.filter((task) => task.planType === '加班工作').map((task) => numberOrNull(task.actualHours)));
  const status = isFuture ? '未到日期' : !hasTasks ? (standardHours ? '无工作记录' : '不考核') : validationErrors.length ? '需修正' : standardHours === 0 ? '非考核日有工作' : Math.abs(actualHours - standardHours) / (standardHours || 1) > 0.2 ? '需备注说明' : '正常';
  return { date: dateString, standardHours, tasks: dayTasks, taskCount: dayTasks.length, plannedHours: planned, expansionHours: expansion, overtimeHours: overtime, totalHours: total, performanceHours, performance, plannedOverage, expansionOverage, overtimeOverage, rewardHours, hourReward, rewardEligible: performance === 100, dailyReward: hourReward, dailyCombined: performance === null ? null : performance + hourReward, innovationSum: sum(dayTasks.map((task) => numberOrNull(task.innovation))), actualHours, overtimeActualHours, validationErrors, status };
}

export function calculateMonth(year, month, state) {
  const key = monthKey(year, month);
  const days = Array.from({ length: daysInMonth(year, month) }, (_, index) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
    return calculateDay(date, state.tasks, state);
  });
  const scoredDays = days.filter((day) => day.performance !== null);
  const averageDailyPerformance = scoredDays.length ? sum(scoredDays.map((day) => day.performance)) / scoredDays.length : null;
  const review = state.monthlyReviews?.[key] || {};
  const competencyValues = ['collaboration', 'loyalty', 'discipline', 'learning'].map((field) => numberOrNull(review[field]));
  const competencyScore = competencyValues.every((value) => value !== null) ? sum(competencyValues) / competencyValues.length : null;
  const innovationBonus = clamp(numberOrNull(review.innovationBonus) ?? 0, 0, Number(state.settings.monthlyInnovationMax));
  const dailyWeighted = averageDailyPerformance === null ? null : averageDailyPerformance * Number(state.settings.dailyPerformanceWeight);
  const competencyWeighted = competencyScore === null ? null : competencyScore * Number(state.settings.competencyWeight);
  const finalPerformance = dailyWeighted === null || competencyWeighted === null ? null : dailyWeighted + competencyWeighted + innovationBonus;
  const payoutRatio = finalPerformance === null ? null : Math.min(finalPerformance / 100, 1);
  const dailyRewardTotal = sum(days.map((day) => day.dailyReward));
  const monthlyReward = payoutRatio === 1 ? dailyRewardTotal : 0;
  const grade = finalPerformance === null ? '' : finalPerformance >= Number(state.settings.gradeThresholds.S) ? 'S-卓越' : finalPerformance >= Number(state.settings.gradeThresholds.A) ? 'A-优秀' : finalPerformance >= Number(state.settings.gradeThresholds.B) ? 'B-良好' : finalPerformance >= Number(state.settings.gradeThresholds.C) ? 'C-合格' : 'D-待改进';
  return { key, year, month, days, review, scoredDays: scoredDays.length, averageDailyPerformance, competencyScore, innovationBonus, dailyWeighted, competencyWeighted, finalPerformance, payoutRatio, dailyRewardTotal, monthlyReward, grade, validationCount: days.reduce((count, day) => count + day.validationErrors.length, 0) };
}

export function validateState(state) {
  const errors = [];
  if (!state?.profile || !state?.settings || !Array.isArray(state.tasks)) errors.push('数据结构不完整');
  for (const task of state.tasks || []) errors.push(...validateTask(task).map((error) => `${task.date || '未填写日期'}：${error}`));
  return errors;
}

export function normalizeState(input) {
  const state = structuredClone(DEFAULT_STATE);
  if (!input || typeof input !== 'object') return state;
  state.profile = { ...state.profile, ...(input.profile || {}) };
  state.settings = {
    ...state.settings,
    ...(input.settings || {}),
    gradeThresholds: { ...state.settings.gradeThresholds, ...(input.settings?.gradeThresholds || {}) },
    taskCategories: Array.isArray(input.settings?.taskCategories) && input.settings.taskCategories.length
      ? [...new Set(input.settings.taskCategories.map((value) => String(value).trim()).filter(Boolean))]
      : [...TASK_CATEGORIES],
    fieldConfigs: migrateFieldConfigs(input.settings?.fieldConfigs),
  };
  state.calendarOverrides = { ...(input.calendarOverrides || {}) };
  state.tasks = Array.isArray(input.tasks) ? input.tasks.map((task) => ({
    id: task.id || crypto.randomUUID(), date: dateToISO(task.date), content: task.content || '', body: task.body || '', category: task.category || '其他', planType: task.planType || '单人工作', collaborator: task.collaborator || '', estimatedHours: task.estimatedHours ?? '', actualHours: task.actualHours ?? '', completionPct: task.completionPct ?? '', collaborationPct: task.collaborationPct ?? '', innovation: task.innovation ?? '', selfScore: task.selfScore ?? '', reviewerScore: task.reviewerScore ?? '', nextPlan: task.nextPlan || '', blocker: task.blocker || '', breakthrough: task.breakthrough || '', subtasks: Array.isArray(task.subtasks) ? task.subtasks.map((item) => ({ id: item.id || crypto.randomUUID(), text: item.text || '', done: Boolean(item.done) })) : [], ...(Number.isFinite(Number(task.order)) ? { order: Number(task.order) } : {}), ...(Number.isFinite(Number(task.nextPlanOrder)) ? { nextPlanOrder: Number(task.nextPlanOrder) } : {}), ...(task.nextPlanDone ? { nextPlanDone: true } : {}), ...(task.sourceDailyItemId ? { sourceDailyItemId: task.sourceDailyItemId } : {}), ...(task.frozen ? { frozen: true } : {}), ...(task.nextPlanFrozen ? { nextPlanFrozen: true } : {}),
  })) : [];
  state.workItems = Array.isArray(input.workItems) ? input.workItems.map((item) => ({
    id: item.id || crypto.randomUUID(), title: item.title || '', description: item.description || '', category: item.category || state.settings.taskCategories[0] || '其他', planType: item.planType || '单人工作', priority: item.priority || '普通', dueDate: dateToISO(item.dueDate), status: item.status || 'todo', reviewer: item.reviewer || '', acceptanceStatus: item.acceptanceStatus || '', performanceTaskId: item.performanceTaskId || '', createdAt: item.createdAt || new Date().toISOString(), completedAt: item.completedAt || '', ...(Number.isFinite(Number(item.order)) ? { order: Number(item.order) } : {}),
  })) : [];
  state.dailyPlans = Object.fromEntries(Object.entries(input.dailyPlans || {}).map(([date, plan]) => [dateToISO(date), {
    today: Array.isArray(plan?.today) ? plan.today.map((item) => ({ id: item.id || crypto.randomUUID(), text: item.text || '', done: Boolean(item.done), ...(Number.isFinite(Number(item.order)) ? { order: Number(item.order) } : {}), ...(item.frozen ? { frozen: true } : {}), ...(item.linkRef ? { linkRef: item.linkRef } : {}) })) : [],
    tomorrow: Array.isArray(plan?.tomorrow) ? plan.tomorrow.map((item) => ({ id: item.id || crypto.randomUUID(), text: item.text || '', done: Boolean(item.done), ...(Number.isFinite(Number(item.order)) ? { order: Number(item.order) } : {}), ...(item.frozen ? { frozen: true } : {}), ...(item.linkRef ? { linkRef: item.linkRef } : {}) })) : [],
  }]).filter(([date]) => date));
  state.plans = { weekly: { ...(input.plans?.weekly || {}) }, monthly: { ...(input.plans?.monthly || {}) } };
  state.monthlyReviews = { ...(input.monthlyReviews || {}) };
  state.notifications = Array.isArray(input.notifications) ? input.notifications : [];
  state.messages = Array.isArray(input.messages) ? input.messages : [];
  state.documentTree = Array.isArray(input.documentTree) ? input.documentTree.map((node) => ({
    id: node.id || crypto.randomUUID(),
    kind: node.kind === 'folder' ? 'folder' : 'doc',
    title: node.title || '',
    parentId: node.parentId || null,
    body: node.body || '',
    createdAt: node.createdAt || new Date().toISOString(),
    updatedAt: node.updatedAt || '',
    ...(Number.isFinite(Number(node.order)) ? { order: Number(node.order) } : {}),
  })).filter((node) => node.id) : [];
  state.projects = Array.isArray(input.projects) ? input.projects.map((project) => ({
    id: project.id || crypto.randomUUID(),
    name: project.name || '',
    description: project.description || '',
    category: project.category || '项目管理',
    priority: project.priority || '普通',
    status: project.status || 'todo',
    owner: project.owner || '',
    startDate: dateToISO(project.startDate),
    dueDate: dateToISO(project.dueDate),
    taskIds: Array.isArray(project.taskIds) ? project.taskIds.filter((id) => id) : [],
    createdAt: project.createdAt || new Date().toISOString(),
    ...(Number.isFinite(Number(project.order)) ? { order: Number(project.order) } : {}),
  })).filter((project) => project.id) : [];
  return state;
}
