/* eslint-disable */
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

export function projectNodes(state) {
  return Array.isArray(state.projects) ? state.projects : [];
}

export function projectForId(state, id) {
  return projectNodes(state).find((project) => project.id === id) || null;
}

export function createProjectNode(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    category: '项目管理',
    priority: '普通',
    status: 'todo',
    owner: '',
    startDate: '',
    dueDate: '',
    taskIds: [],
    milestones: [],
    createdAt: new Date().toISOString(),
    order: Date.now(),
    ...overrides,
  };
}

export function createMilestone(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    dueDate: '',
    status: 'todo',
    owner: '',
    reviewer: '',
    order: Date.now(),
    tasks: [],
    ...overrides,
  };
}

export function createProjectTask(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: '',
    assignee: '',
    reviewer: '',
    dueDate: '',
    status: 'todo',
    priority: '普通',
    workItemId: '',
    performanceTaskId: '',
    predecessors: [],
    requirement: '',
    acceptance: '',
    deliverables: [],
    comments: [],
    blocked: false,
    blockedReason: '',
    acceptanceStatus: '',
    subtasks: [],
    order: Date.now(),
    ...overrides,
  };
}

export function createSopNode(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    input: '',
    action: '',
    output: '',
    acceptance: '',
    next: '',
    order: Date.now(),
    ...overrides,
  };
}

export function createSopTemplate(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: '',
    scene: '',
    defaultOwnerRole: '',
    defaultReviewerRole: '',
    standardDuration: '',
    nodes: [createSopNode()],
    createdAt: new Date().toISOString(),
    order: Date.now(),
    ...overrides,
  };
}

export function sopTemplateNodes(state) {
  return Array.isArray(state.sopTemplates) ? state.sopTemplates : [];
}

export function sopTemplateForId(state, id) {
  return sopTemplateNodes(state).find((template) => template.id === id) || null;
}

export function milestoneProgress(milestone) {
  let total = 0;
  let done = 0;
  const walk = (tasks) => {
    for (const task of tasks || []) {
      total += 1;
      if (task.status === 'done') done += 1;
      walk(task.subtasks);
    }
  };
  walk(Array.isArray(milestone.tasks) ? milestone.tasks : []);
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}

export function projectProgress(state, project) {
  const milestones = Array.isArray(project.milestones) ? project.milestones : [];
  if (milestones.length) {
    let total = 0;
    let done = 0;
    milestones.forEach((milestone) => {
      const progress = milestoneProgress(milestone);
      total += progress.total;
      done += progress.done;
    });
    if (total) return { total, done, pct: Math.round(done / total * 100), byMilestone: true };
  }
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const ids = Array.isArray(project.taskIds) ? project.taskIds : [];
  const total = ids.length;
  const done = ids.filter((id) => {
    const task = tasks.find((entry) => entry.id === id);
    return task && Number(task.completionPct) >= 100;
  }).length;
  return { total, done, pct: total ? Math.round(done / total * 100) : 0, byMilestone: !!milestones.length };
}

// ===== 树状任务查找辅助 =====
export function findProjectTask(project, taskId) {
  const milestones = Array.isArray(project?.milestones) ? project.milestones : [];
  for (const milestone of milestones) {
    const found = findTaskInTree(milestone.tasks, taskId, milestone, null);
    if (found) return found;
  }
  return null;
}

function findTaskInTree(tasks, taskId, milestone, parentTask) {
  for (const task of tasks || []) {
    if (task.id === taskId) return { milestone, task, parentTask };
    const found = findTaskInTree(task.subtasks, taskId, milestone, task);
    if (found) return found;
  }
  return null;
}

export function collectProjectTasks(project) {
  const result = [];
  const walk = (tasks, milestone, parentTask) => {
    for (const task of tasks || []) {
      result.push({ task, milestone, parentTask });
      walk(task.subtasks, milestone, task);
    }
  };
  (Array.isArray(project?.milestones) ? project.milestones : []).forEach((milestone) => walk(milestone.tasks, milestone, null));
  return result;
}

export function countAllProjectTasks(project) {
  return collectProjectTasks(project).length;
}

// ===== 项目中心增强字段 =====
const dateToISO = (dateString) => {
  if (!dateString) return '';
  const date = dateString instanceof Date ? dateString : new Date(`${String(dateString).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const todayISO = () => dateToISO(new Date());

function projectMembers(project) {
  const members = new Set();
  if (project.owner && project.owner.trim()) members.add(project.owner.trim());
  (Array.isArray(project.milestones) ? project.milestones : []).forEach((milestone) => {
    if (milestone.owner && milestone.owner.trim()) members.add(milestone.owner.trim());
    if (milestone.reviewer && milestone.reviewer.trim()) members.add(milestone.reviewer.trim());
    collectProjectTasks({ milestones: [milestone] }).forEach(({ task }) => {
      if (task.assignee && task.assignee.trim()) members.add(task.assignee.trim());
      if (task.reviewer && task.reviewer.trim()) members.add(task.reviewer.trim());
    });
  });
  return Array.from(members);
}

function projectPendingAcceptCount(project) {
  let count = 0;
  collectProjectTasks(project).forEach(({ task }) => {
    if (task.status === 'done' && task.reviewer && task.reviewer.trim()) count += 1;
  });
  return count;
}

function projectRiskBreakdown(state, project) {
  const today = todayISO();
  const breakdown = { overdueMilestones: 0, overdueTasks: 0, blockedTasks: 0, overdueLinkedTasks: 0 };
  (Array.isArray(project.milestones) ? project.milestones : []).forEach((milestone) => {
    if (milestone.status !== 'done' && milestone.dueDate && milestone.dueDate < today) breakdown.overdueMilestones += 1;
  });
  collectProjectTasks(project).forEach(({ task }) => {
    if (task.blocked) breakdown.blockedTasks += 1;
    if (task.status !== 'done' && task.dueDate && task.dueDate < today) breakdown.overdueTasks += 1;
  });
  (Array.isArray(project.taskIds) ? project.taskIds : []).forEach((id) => {
    const task = (Array.isArray(state.tasks) ? state.tasks : []).find((entry) => entry.id === id);
    if (task && Number(task.completionPct) < 100 && task.date && task.date < today) breakdown.overdueLinkedTasks += 1;
  });
  return breakdown;
}

function projectRisk(state, project) {
  if (project.riskOverride === '高' || project.riskOverride === '中' || project.riskOverride === '低') return project.riskOverride;
  const b = projectRiskBreakdown(state, project);
  const risky = b.overdueMilestones + b.overdueTasks + b.overdueLinkedTasks + b.blockedTasks;
  if (risky >= 2) return '高';
  if (risky === 1) return '中';
  return '低';
}

export function collectProjectAcceptance(project) {
  const items = [];
  collectProjectTasks(project).forEach(({ task, milestone }) => {
    if (task.status === 'done' && task.reviewer && task.reviewer.trim() && task.acceptanceStatus !== 'accepted') {
      items.push({ task, milestone, project });
    }
  });
  return items;
}

const isUpcoming = (project, today) => {
  if (project.dueDate && project.dueDate >= today && project.status !== 'done') {
    const diff = Math.round((new Date(`${project.dueDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000);
    if (diff <= 14) return true;
  }
  return false;
};

const statusLabel = (status) => (status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待启动');
const statusTag = (status) => (status === 'done' ? '<span class="tag">已完成</span>' : status === 'doing' ? '<span class="tag green">进行中</span>' : '<span class="tag gold">待启动</span>');
const priorityTag = (priority) => (priority === '高' ? '<span class="tag red">高</span>' : priority === '低' ? '<span class="tag">低</span>' : '<span class="tag gold">普通</span>');
const riskTag = (risk) => (risk === '高' ? '<span class="pc-risk pc-risk-high"><i class="ri-error-warning-line"></i>高</span>' : risk === '中' ? '<span class="pc-risk pc-risk-mid"><i class="ri-alert-line"></i>中</span>' : '<span class="pc-risk pc-risk-low"><i class="ri-checkbox-circle-line"></i>低</span>');
const milestoneStatusTag = (status) => (status === 'done' ? '<span class="pm-status done">已完成</span>' : status === 'doing' ? '<span class="pm-status doing">进行中</span>' : '<span class="pm-status todo">待启动</span>');
const pmTaskStatusTag = (status) => (status === 'done' ? '<span class="pm-task-status done">已完成</span>' : status === 'doing' ? '<span class="pm-task-status doing">进行中</span>' : '<span class="pm-task-status todo">待办</span>');

function avatar(name, index) {
  const initials = String(name || '?').slice(0, 1).toUpperCase();
  return `<span class="pc-avatar pc-avatar-tone-${index % 5}" title="${esc(name)}">${esc(initials)}</span>`;
}

function valueOrDash(value) {
  return value && String(value).trim() ? esc(value) : '<span class="pc-muted">—</span>';
}

function renderStatCards(state, projects) {
  const doing = projects.filter((p) => p.status === 'doing').length;
  const pendingAccept = projects.reduce((sum, p) => sum + projectPendingAcceptCount(p), 0);
  const riskProjects = projects.filter((p) => projectRisk(state, p) === '高' || projectRisk(state, p) === '中').length;
  const cards = [
    { icon: 'ri-folder-2-line', tone: 'teal', label: '项目总数', value: projects.length, note: '在管项目' },
    { icon: 'ri-loader-4-line', tone: 'blue', label: '进行中', value: doing, note: '正在推进' },
    { icon: 'ri-award-line', tone: 'violet', label: '待验收任务', value: pendingAccept, note: '等待验收' },
    { icon: 'ri-error-warning-line', tone: 'red', label: '风险项目', value: riskProjects, note: '待关注' },
  ];
  return `<div class="pc-stats">${cards.map((card) => `<div class="pc-stat pc-stat-tone-${card.tone}"><div class="pc-stat-icon"><i class="${card.icon}"></i></div><div class="pc-stat-body"><span>${card.label}</span><strong>${card.value}</strong><small>${card.note}</small></div><div class="pc-stat-trend"><i class="ri-arrow-up-line"></i><em>较上月</em></div></div>`).join('')}</div>`;
}

function renderQuickPanels(state, projects, currentUser) {
  const today = todayISO();
  const upcoming = projects.filter((p) => isUpcoming(p, today)).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 4);
  const mine = projects.filter((p) => projectMembers(p).some((m) => currentUser && m === currentUser)).sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || ''))).slice(0, 4);
  const upcomingPanel = upcoming.length ? upcoming.map((p) => `<div class="pc-quick-row" data-action="open-project" data-project-id="${esc(p.id)}"><div class="pc-quick-main"><strong>${esc(p.name)}</strong><small>${esc(p.stage)} · ${esc(p.category)}</small></div><span class="pc-quick-due ${p.dueDate < today ? 'overdue' : ''}">${p.dueDate && p.dueDate < today ? `超期 ${esc(p.dueDate)}` : (p.dueDate ? esc(p.dueDate) : '未设截止')}</span></div>`).join('') : '<div class="pc-quick-empty">14 天内暂无即将到期的项目</div>';
  const minePanel = mine.length ? mine.map((p) => `<div class="pc-quick-row" data-action="open-project" data-project-id="${esc(p.id)}"><div class="pc-quick-main"><strong>${esc(p.name)}</strong><small>${esc(p.category)} · 负责人 ${esc(p.owner || '未指定')}</small></div>${statusTag(p.status)}</div>`).join('') : '<div class="pc-quick-empty">当前没有你关注的项目</div>';
  return `<div class="pc-quick-grid">
    <div class="pc-quick-card"><div class="pc-quick-card-head"><span class="pc-quick-card-icon"><i class="ri-timer-line"></i></span><div><strong>即将到期</strong><small>14 天内到期项目</small></div><span class="pc-quick-count">${upcoming.length}</span></div><div class="pc-quick-list">${upcomingPanel}</div></div>
    <div class="pc-quick-card"><div class="pc-quick-card-head"><span class="pc-quick-card-icon"><i class="ri-user-heart-line"></i></span><div><strong>待我关注</strong><small>我是成员的进行中项目</small></div><span class="pc-quick-count">${mine.length}</span></div><div class="pc-quick-list">${minePanel}</div></div>
  </div>`;
}

function memberMini(state, project) {
  const members = projectMembers(project);
  if (!members.length) return '<span class="pc-muted">—</span>';
  const shown = members.slice(0, 4).map((name, index) => avatar(name, index)).join('');
  const extra = members.length > 4 ? `<span class="pc-avatar pc-avatar-more">+${members.length - 4}</span>` : '';
  return `<span class="pc-member-stack">${shown}${extra}</span>`;
}

function renderListRows(state, projects, filter, search, currentUser) {
  let rows = projects.slice();
  if (filter === 'doing') rows = rows.filter((p) => p.status === 'doing');
  else if (filter === 'todo') rows = rows.filter((p) => p.status === 'todo');
  else if (filter === 'done') rows = rows.filter((p) => p.status === 'done');
  else if (filter === 'risk') rows = rows.filter((p) => projectRisk(state, p) === '高' || projectRisk(state, p) === '中');
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((p) => `${p.name} ${p.category} ${p.stage} ${p.owner} ${projectMembers(p).join(' ')}`.toLowerCase().includes(q));
  }
  const today = todayISO();
  return rows.map((p) => {
    const progress = projectProgress(state, p);
    const riskLevel = projectRisk(state, p);
    const overdue = p.status !== 'done' && p.dueDate && p.dueDate < today;
    return `<tr class="pc-row">
      <td class="pc-cell-check"><input type="checkbox" class="pc-check" aria-label="选择 ${esc(p.name)}"></td>
      <td class="pc-cell-project"><div class="pc-project-cell"><span class="pc-project-icon"><i class="ri-folder-fill"></i></span><div class="pc-project-copy"><button type="button" class="pc-project-name" data-action="open-project" data-project-id="${esc(p.id)}">${esc(p.name)}</button><small>${esc(p.description || p.category || '暂无描述')}</small></div></div></td>
      <td><span class="pc-stage pc-stage-${esc(p.stage)}">${esc(p.stage)}</span></td>
      <td>${statusTag(p.status)}</td>
      <td class="pc-cell-owner">${valueOrDash(p.owner)}</td>
      <td>${memberMini(state, p)}</td>
      <td class="pc-cell-progress"><div class="pc-progress"><div class="pc-progress-bar"><span style="width:${progress.pct}%"></span></div><small>${progress.pct}%</small></div></td>
      <td class="pc-cell-due ${overdue ? 'overdue' : ''}">${p.dueDate ? `<span class="${overdue ? 'pc-overdue-text' : ''}">${esc(p.dueDate)}${overdue ? '<i class="ri-error-warning-line"></i>' : ''}</span>` : '<span class="pc-muted">—</span>'}</td>
      <td>${riskTag(riskLevel)}</td>
      <td class="pc-cell-actions"><div class="pc-actions">
        <button type="button" class="pc-icon-btn" data-action="edit-project" data-project-id="${esc(p.id)}" title="编辑项目"><i class="ri-edit-line"></i></button>
        <button type="button" class="pc-icon-btn" data-action="delete-project" data-project-id="${esc(p.id)}" title="删除项目"><i class="ri-delete-bin-line"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}

function renderBoardCards(state, projects, filter, search) {
  const columnKeys = [['todo', '待启动', 'gold'], ['doing', '进行中', 'green'], ['done', '已完成', 'gray']];
  if (search) {
    const q = search.toLowerCase();
    return columnKeys.map(([key, label, tone]) => {
      const items = projects.filter((p) => p.status === key && `${p.name} ${p.category}`.toLowerCase().includes(q));
      return renderBoardColumn(state, items, label, tone);
    }).join('');
  }
  return columnKeys.map(([key, label, tone]) => renderBoardColumn(state, projects.filter((p) => p.status === key), label, tone)).join('');
}

function renderBoardColumn(state, items, label, tone) {
  const cards = items.map((p) => {
    const progress = projectProgress(state, p);
    return `<div class="pc-board-card" data-action="open-project" data-project-id="${esc(p.id)}"><div class="pc-board-card-head"><span class="pc-stage">${esc(p.stage)}</span>${priorityTag(p.priority)}</div><strong class="pc-board-card-title">${esc(p.name)}</strong><p class="pc-board-card-desc">${esc(p.description || '暂无描述')}</p><div class="pc-board-card-meta"><span><i class="ri-user-line"></i>${esc(p.owner || '未指定')}</span><span>${esc(p.dueDate || '未设截止')}</span></div><div class="pc-progress"><div class="pc-progress-bar"><span style="width:${progress.pct}%"></span></div><small>${progress.pct}%</small></div></div>`;
  }).join('');
  return `<section class="pc-board-col"><div class="pc-board-col-head"><span class="pc-board-col-dot dot-${tone}"></span><strong>${label}</strong><em>${items.length}</em></div><div class="pc-board-col-body">${cards || '<div class="pc-board-empty">暂无项目</div>'}</div></section>`;
}

function renderProjectCenter(state, opts, currentUser) {
  const projects = projectNodes(state).slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const filter = opts.filter || 'all';
  const viewMode = opts.viewMode || 'list';
  const search = opts.search || '';
  const filterTabs = [
    ['all', '全部项目', projects.length],
    ['doing', '进行中', projects.filter((p) => p.status === 'doing').length],
    ['todo', '待启动', projects.filter((p) => p.status === 'todo').length],
    ['risk', '风险', projects.filter((p) => projectRisk(state, p) === '高' || projectRisk(state, p) === '中').length],
    ['done', '已完成', projects.filter((p) => p.status === 'done').length],
  ];
  const body = viewMode === 'board'
    ? `<div class="pc-board">${renderBoardCards(state, projects, filter, search)}</div>`
    : `<div class="pc-table-wrap"><table class="pc-table">
        <thead><tr>
          <th class="pc-cell-check"><input type="checkbox" class="pc-check" aria-label="全选"></th>
          <th>项目名称</th><th>阶段</th><th>状态</th><th>负责人</th><th>成员</th><th>进度</th><th>截止日期</th><th>风险等级</th><th>操作</th>
        </tr></thead>
        <tbody>${renderListRows(state, projects, filter, search, currentUser) || '<tr><td colspan="10"><div class="pc-table-empty"><i class="ri-inbox-line"></i><span>没有符合筛选条件的项目</span></div></td></tr>'}</tbody>
      </table></div>`;

  return `<div class="pc-view">
    <div class="pc-head">
      <div class="pc-head-left"><span class="pc-eyebrow">Project Center</span><h1>项目中心</h1><p>把项目、阶段、成员和风险集中管理，快速掌握整体推进情况。</p></div>
      <div class="pc-head-right">
        <label class="pc-search"><i class="ri-search-line"></i><input class="input" data-project-search placeholder="搜索项目名称、成员或分类" value="${esc(search)}"></label>
        <button type="button" class="button ghost" data-action="open-sop-templates"><i class="ri-flow-chart"></i> SOP 模板</button>
        <button type="button" class="button primary" data-action="add-project"><i class="ri-add-line"></i> 新建项目</button>
      </div>
    </div>
    ${renderStatCards(state, projects)}
    ${renderQuickPanels(state, projects, currentUser)}
    <div class="pc-list-card">
      <div class="pc-list-toolbar">
        <div class="pc-filter-tabs">${filterTabs.map(([key, label, count]) => `<button type="button" class="pc-filter-tab ${filter === key ? 'active' : ''}" data-action="project-filter" data-filter="${key}">${label}<em>${count}</em></button>`).join('')}</div>
        <div class="pc-toolbar-right">
          <button type="button" class="pc-tool-btn" title="排序" aria-label="排序"><i class="ri-sort-asc"></i>排序</button>
          <button type="button" class="pc-tool-btn" title="筛选" aria-label="筛选"><i class="ri-filter-3-line"></i>筛选</button>
          <div class="pc-view-switch"><button type="button" class="${viewMode === 'list' ? 'active' : ''}" data-action="project-view-mode" data-mode="list" title="列表视图"><i class="ri-list-check"></i></button><button type="button" class="${viewMode === 'board' ? 'active' : ''}" data-action="project-view-mode" data-mode="board" title="看板视图"><i class="ri-layout-grid-line"></i></button></div>
        </div>
      </div>
      ${body}
    </div>
  </div>`;
}

export function renderProjects(state, opts = {}) {
  const currentUser = opts.currentUser || activeUserName();
  if (opts.selectedId && projectForId(state, opts.selectedId)) {
    return renderProjectDetail(state, projectForId(state, opts.selectedId), opts);
  }
  if (!projectNodes(state).length) {
    return `<div class="project-workspace"><section class="project-detail"><div class="project-milestone-empty"><i class="ri-folder-open-line"></i><strong>从项目中心开始</strong><p>还没有项目，点右上角「新建项目」创建你的第一个项目，再拆解里程碑与任务。</p><button type="button" class="button primary" data-action="add-project"><i class="ri-add-line"></i> 新建项目</button></div></section></div>`;
  }
  return renderProjectCenter(state, opts, currentUser);
}

function activeUserName() {
  return '';
}

// ===== 项目详情（概览 / 任务 / SOP / 验收 / 文档 / 成员 / 动态） =====
const PROJECT_DETAIL_TABS = [
  { key: '概览', icon: 'ri-dashboard-3-line' },
  { key: '里程碑', icon: 'ri-flag-2-line' },
  { key: '任务', icon: 'ri-list-check-2' },
  { key: 'SOP', icon: 'ri-flow-chart' },
  { key: '验收', icon: 'ri-award-line' },
  { key: '文档', icon: 'ri-file-text-line' },
  { key: '成员', icon: 'ri-team-line' },
  { key: '动态', icon: 'ri-time-line' },
];

function countProjectDeliverables(project) {
  let count = 0;
  collectProjectTasks(project).forEach(({ task }) => { count += (task.deliverables || []).length; });
  return count;
}

function collectProjectActivity(project) {
  const events = [];
  (Array.isArray(project?.milestones) ? project.milestones : []).forEach((milestone) => {
    events.push({ date: milestone.dueDate || '', type: 'milestone', name: milestone.name || '', status: milestone.status, owner: milestone.owner, reviewer: milestone.reviewer });
  });
  collectProjectTasks(project).forEach(({ task, milestone }) => {
    if (task.blocked) events.push({ date: task.dueDate || '', type: 'blocked', name: task.title || '未命名任务', reason: task.blockedReason, milestone: milestone?.name });
    if (task.status === 'done') events.push({ date: task.dueDate || '', type: 'done', name: task.title || '未命名任务', milestone: milestone?.name, assignee: task.assignee });
    if (task.status === 'doing') events.push({ date: task.dueDate || '', type: 'doing', name: task.title || '未命名任务', milestone: milestone?.name, assignee: task.assignee });
    (task.comments || []).forEach((comment) => events.push({ date: comment.createdAt || '', type: 'comment', name: task.title || '未命名任务', text: comment.text, author: comment.author }));
    (task.deliverables || []).forEach((deliverable) => { if (deliverable.text) events.push({ date: task.dueDate || '', type: 'deliverable', name: deliverable.text, done: deliverable.done, task: task.title }); });
  });
  const iconMap = {
    milestone: ['ri-flag-line', 'milestone'], done: ['ri-check-double-line', 'done'], doing: ['ri-loader-4-line', 'doing'],
    blocked: ['ri-error-warning-line', 'blocked'], comment: ['ri-chat-3-line', 'comment'], deliverable: ['ri-box-3-line', 'deliverable'],
  };
  return events
    .map((event) => {
      const [icon, tone] = iconMap[event.type] || ['ri-information-line', 'default'];
      return { ...event, icon, tone };
    })
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function pmActivityBadge(event) {
  switch (event.type) {
    case 'milestone': return `<span class="pm-activity-badge milestone"><i class="ri-flag-line"></i>里程碑</span>`;
    case 'done': return `<span class="pm-activity-badge done"><i class="ri-check-double-line"></i>完成</span>`;
    case 'doing': return `<span class="pm-activity-badge doing"><i class="ri-loader-4-line"></i>推进</span>`;
    case 'blocked': return `<span class="pm-activity-badge blocked"><i class="ri-error-warning-line"></i>阻塞</span>`;
    case 'comment': return `<span class="pm-activity-badge comment"><i class="ri-chat-3-line"></i>评论</span>`;
    default: return `<span class="pm-activity-badge deliverable"><i class="ri-box-3-line"></i>交付物</span>`;
  }
}

function memberRoleSummary(state, project, name) {
  let milestonesOwner = 0;
  let milestonesReviewer = 0;
  let tasksAssigned = 0;
  let tasksReviewed = 0;
  let tasksDone = 0;
  (Array.isArray(project.milestones) ? project.milestones : []).forEach((milestone) => {
    if (milestone.owner && milestone.owner.trim() === name) milestonesOwner += 1;
    if (milestone.reviewer && milestone.reviewer.trim() === name) milestonesReviewer += 1;
    collectProjectTasks({ milestones: [milestone] }).forEach(({ task }) => {
      if (task.assignee && task.assignee.trim() === name) { tasksAssigned += 1; if (task.status === 'done') tasksDone += 1; }
      if (task.reviewer && task.reviewer.trim() === name) tasksReviewed += 1;
    });
  });
  return { milestonesOwner, milestonesReviewer, tasksAssigned, tasksReviewed, tasksDone, isOwner: project.owner === name };
}

function renderProjectDetail(state, selected, opts = {}) {
  const progress = projectProgress(state, selected);
  const riskBreakdown = projectRiskBreakdown(state, selected);
  const milestones = Array.isArray(selected.milestones) ? selected.milestones : [];
  const collapsedMilestones = opts.collapsedMilestones instanceof Set ? opts.collapsedMilestones : new Set();
  const collapsedTasks = opts.collapsedTasks instanceof Set ? opts.collapsedTasks : new Set();
  const selectedTaskId = opts.selectedProjectTaskId || '';
  const activeTab = PROJECT_DETAIL_TABS.some((tab) => tab.key === opts.activeProjectTab) ? opts.activeProjectTab : '概览';
  const linkedTasks = (selected.taskIds || []).map((id) => (Array.isArray(state.tasks) ? state.tasks : []).find((task) => task.id === id)).filter(Boolean);

  const taskLinkBadges = (task) => {
    if (task.performanceTaskId) return '<span class="pm-task-link-badge perf">已记绩效</span>';
    if (task.workItemId) return '<span class="pm-task-link-badge pool">已同步任务池</span>';
    return '';
  };

  // 递归渲染任务树节点
  const renderTaskNode = (task, milestone, depth) => {
    const children = Array.isArray(task.subtasks) ? task.subtasks : [];
    const hasChildren = children.length > 0;
    const collapsed = collapsedTasks.has(task.id);
    const predecessorCount = (task.predecessors || []).length;
    const isActive = selectedTaskId === task.id;
    const indent = Math.min(depth, 4);
    return `<div class="pm-tree-node">
      <div class="pm-task-row ${isActive ? 'is-active' : ''}" style="padding-left:${10 + indent * 22}px">
        ${hasChildren
          ? `<button type="button" class="pm-task-toggle" data-action="toggle-project-task" data-task-id="${esc(task.id)}" aria-label="${collapsed ? '展开' : '收起'}子任务"><i class="${collapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line'}"></i></button>`
          : '<span class="pm-task-toggle-spacer"></span>'}
        ${pmTaskStatusTag(task.status)}
        ${task.blocked ? `<span class="pm-blocked-badge" title="${esc(task.blockedReason || '该任务已被阻塞')}"><i class="ri-error-warning-line"></i>阻塞</span>` : ''}
        <button type="button" class="pm-task-title" data-action="open-project-task-detail" data-task-id="${esc(task.id)}" title="打开任务详情">${esc(task.title || '未命名任务')}</button>
        ${priorityTag(task.priority)}
        ${predecessorCount ? `<span class="pm-predecessor-badge" title="${predecessorCount} 个前置任务"><i class="ri-git-branch-line"></i>${predecessorCount}</span>` : ''}
        <span class="pm-task-meta"><i class="ri-user-line"></i>${esc(task.assignee || '未分配')}</span>
        <span class="pm-task-meta"><i class="ri-award-line"></i>${esc(task.reviewer || '无验收')}</span>
        <span class="pm-task-date">${esc(task.dueDate || '未设截止')}</span>
        ${hasChildren ? `<span class="pm-task-subcount">${children.length} 子</span>` : ''}
        ${taskLinkBadges(task)}
        <span class="pm-task-actions">
          <button type="button" class="project-mini" data-action="add-project-subtask" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(milestone.id)}" data-task-id="${esc(task.id)}" title="添加子任务"><i class="ri-subtract-line"></i></button>
          <button type="button" class="project-mini" data-action="edit-project-task" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(milestone.id)}" data-task-id="${esc(task.id)}" title="编辑任务"><i class="ri-edit-line"></i></button>
          <button type="button" class="project-mini" data-action="sync-project-task" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(milestone.id)}" data-task-id="${esc(task.id)}" title="同步到任务池">${task.workItemId ? '<i class="ri-refresh-line"></i>' : '<i class="ri-send-plane-line"></i>'}</button>
          <button type="button" class="project-mini" data-action="record-project-performance" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(milestone.id)}" data-task-id="${esc(task.id)}" title="记入绩效">${task.performanceTaskId ? '<i class="ri-file-check-line"></i>' : '<i class="ri-file-add-line"></i>'}</button>
          <button type="button" class="project-mini" data-action="delete-project-task" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(milestone.id)}" data-task-id="${esc(task.id)}" title="删除任务"><i class="ri-delete-bin-line"></i></button>
        </span>
      </div>
      ${hasChildren && !collapsed ? `<div class="pm-task-children">${children.map((child) => renderTaskNode(child, milestone, depth + 1)).join('')}</div>` : ''}
    </div>`;
  };

  const milestoneCard = (milestone, index) => {
    const collapsed = collapsedMilestones.has(milestone.id);
    const milestoneProg = milestoneProgress(milestone);
    const tasks = Array.isArray(milestone.tasks) ? milestone.tasks : [];
    return `<div class="pm-milestone pm-collapsible ${collapsed ? 'is-collapsed' : ''}">
      <div class="pm-milestone-head">
        <button type="button" class="pm-toggle" data-action="toggle-milestone" data-milestone-id="${esc(milestone.id)}" aria-label="${collapsed ? '展开' : '收起'}里程碑"><i class="${collapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line'}"></i></button>
        <span class="project-milestone-index">M${index + 1}</span>
        <strong>${esc(milestone.name || '未命名里程碑')}</strong>
        ${milestoneStatusTag(milestone.status)}
        <span class="pm-milestone-task-count">${tasks.length} 任务</span>
        <div class="pm-milestone-actions">
          <button type="button" class="button ghost sm" data-action="add-project-task" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(milestone.id)}"><i class="ri-add-line"></i> 任务</button>
          <button type="button" class="button ghost sm" data-action="edit-milestone" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(milestone.id)}"><i class="ri-edit-line"></i> 编辑</button>
          <button type="button" class="button ghost sm danger-text" data-action="delete-milestone" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(milestone.id)}"><i class="ri-delete-bin-line"></i></button>
        </div>
      </div>
      ${collapsed ? '' : `<div class="pm-milestone-body">
        <div class="pm-milestone-meta">
          <span><i class="ri-user-line"></i>负责人 ${esc(milestone.owner || '未指定')}</span>
          <span><i class="ri-award-line"></i>验收人 ${esc(milestone.reviewer || '未指定')}</span>
          <span><i class="ri-calendar-line"></i>截止 ${esc(milestone.dueDate || '未设置')}</span>
          <span class="pm-milestone-progress-mini">完成 ${milestoneProg.done}/${milestoneProg.total}</span>
        </div>
        ${milestone.description ? `<p class="pm-milestone-desc">${esc(milestone.description)}</p>` : ''}
        <div class="pm-milestone-progress"><div class="project-progress-bar"><span style="width:${milestoneProg.pct}%"></span></div><span>${milestoneProg.pct}%</span></div>
        <div class="pm-task-list">${tasks.length ? tasks.map((task) => renderTaskNode(task, milestone, 0)).join('') : '<div class="pm-task-empty">还没有拆解任务，点上方「任务」把里程碑拆成可执行的工作项。</div>'}</div>
      </div>`}
    </div>`;
  };

  const linkedTasksHtml = linkedTasks.length ? linkedTasks.map((task) => {
    const done = Number(task.completionPct) >= 100;
    return `<div class="project-task-row" data-action="edit-task" data-id="${esc(task.id)}">
      <span class="project-task-status ${done ? 'done' : ''}">${done ? '已完成' : '进行中'}</span>
      <span class="project-task-title">${esc(task.content || '未命名任务')}</span>
      <span class="project-task-date">${esc(task.date || '未设置')}</span>
    </div>`;
  }).join('') : '<div class="empty">还没有关联绩效任务，点「关联任务」添加。</div>';

  // ===== 概览 =====
  const overviewStats = [
    { icon: 'ri-flag-line', tone: 'teal', label: '里程碑', value: milestones.length },
    { icon: 'ri-list-check-2', tone: 'blue', label: '任务', value: collectProjectTasks(selected).length },
    { icon: 'ri-checkbox-circle-line', tone: 'green', label: '已完成任务', value: collectProjectTasks(selected).filter(({ task }) => task.status === 'done').length },
    { icon: 'ri-user-3-line', tone: 'violet', label: '成员', value: projectMembers(selected).length },
    { icon: 'ri-award-line', tone: 'orange', label: '待验收', value: projectPendingAcceptCount(selected) },
  ];
  const overviewTab = `<div class="pm-tab-kpis">${overviewStats.map((stat) => `<div class="pm-tab-kpi pm-tab-kpi-${stat.tone}"><span class="pm-tab-kpi-icon"><i class="${stat.icon}"></i></span><div><strong>${stat.value}</strong><small>${stat.label}</small></div></div>`).join('')}</div>
    <div class="project-risk-panel">
      <div class="project-risk-panel-head"><i class="ri-shield-line"></i><span>风险构成</span>${riskTag(projectRisk(state, selected))}</div>
      <div class="project-risk-panel-body">
        <span>超期里程碑 <b>${riskBreakdown.overdueMilestones}</b></span>
        <span>超期任务 <b>${riskBreakdown.overdueTasks}</b></span>
        <span>阻塞任务 <b>${riskBreakdown.blockedTasks}</b></span>
        <span>超期关联任务 <b>${riskBreakdown.overdueLinkedTasks}</b></span>
      </div>
    </div>
    <div class="project-detail-section">
      <div class="project-detail-section-head"><div><h2>关联绩效任务</h2></div><span>${linkedTasks.length} 项</span></div>
      <div class="project-task-list">${linkedTasksHtml}</div>
    </div>`;

  // ===== 里程碑 =====
  const msToday = todayISO();
  const milestoneDoneCount = milestones.filter((m) => m.status === 'done').length;
  const milestoneDoingCount = milestones.filter((m) => m.status === 'doing').length;
  const milestoneTodoCount = milestones.filter((m) => m.status === 'todo').length;
  const milestoneOverdueCount = milestones.filter((m) => m.status !== 'done' && m.dueDate && m.dueDate < msToday).length;
  const milestoneStatsHtml = [
    ['ri-flag-line', 'teal', '里程碑总数', milestones.length],
    ['ri-checkbox-circle-line', 'green', '已完成', milestoneDoneCount],
    ['ri-loader-4-line', 'blue', '进行中', milestoneDoingCount],
    ['ri-time-line', 'orange', '待启动', milestoneTodoCount],
    ['ri-error-warning-line', 'red', '已超期', milestoneOverdueCount],
  ].map(([icon, tone, label, value]) => `<div class="pm-task-stat pm-task-stat-${tone}"><span class="pm-task-stat-icon"><i class="${icon}"></i></span><div class="pm-task-stat-copy"><small>${label}</small><strong>${value}</strong></div></div>`).join('');
  const milestoneTimelineNode = (milestone, index) => {
    const prog = milestoneProgress(milestone);
    const taskEntries = collectProjectTasks({ milestones: [milestone] });
    const doneCount = taskEntries.filter(({ task }) => task.status === 'done').length;
    const totalCount = taskEntries.length;
    const overdue = milestone.status !== 'done' && milestone.dueDate && milestone.dueDate < msToday;
    return `<div class="pm-ms-node">
      <div class="pm-ms-rail"><span class="pm-ms-dot ${milestone.status}"></span>${index < milestones.length - 1 ? '<span class="pm-ms-line"></span>' : ''}</div>
      <div class="pm-ms-card">
        <div class="pm-ms-card-head">
          <span class="pm-ms-index">M${index + 1}</span>
          <strong>${esc(milestone.name || '未命名里程碑')}</strong>
          ${milestoneStatusTag(milestone.status)}
          <div class="pm-ms-actions">
            <button type="button" class="button ghost sm" data-action="add-project-task" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(milestone.id)}"><i class="ri-add-line"></i> 任务</button>
            <button type="button" class="button ghost sm" data-action="edit-milestone" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(milestone.id)}"><i class="ri-edit-line"></i> 编辑</button>
            <button type="button" class="button ghost sm danger-text" data-action="delete-milestone" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(milestone.id)}"><i class="ri-delete-bin-line"></i></button>
          </div>
        </div>
        ${milestone.description ? `<p class="pm-ms-desc">${esc(milestone.description)}</p>` : ''}
        <div class="pm-ms-meta">
          <span><i class="ri-user-line"></i>负责人 ${esc(milestone.owner || '未指定')}</span>
          <span><i class="ri-award-line"></i>验收人 ${esc(milestone.reviewer || '未指定')}</span>
          <span class="${overdue ? 'pm-ms-overdue' : ''}"><i class="ri-calendar-line"></i>截止 ${milestone.dueDate ? esc(milestone.dueDate) : '未设置'}</span>
          <span><i class="ri-list-check-2"></i>任务 ${doneCount}/${totalCount}</span>
        </div>
        <div class="pm-ms-progress"><div class="project-progress-bar"><span style="width:${prog.pct}%"></span></div><em>${prog.pct}%</em></div>
      </div>
    </div>`;
  };
  const milestonesTab = milestones.length ? `<div class="pm-ms-section"><div class="pm-ms-stats">${milestoneStatsHtml}</div><div class="pm-ms-timeline">${milestones.map((milestone, index) => milestoneTimelineNode(milestone, index)).join('')}</div></div>` : '<div class="project-milestone-empty"><i class="ri-flag-line"></i><strong>还没有里程碑</strong><p>先添加里程碑，再为每个里程碑拆解任务、负责人与验收人。</p><button type="button" class="button primary" data-action="add-milestone" data-project-id="${esc(selected.id)}"><i class="ri-add-line"></i> 添加里程碑</button></div>';

  // ===== 任务 =====
  const allProjectTasks = collectProjectTasks(selected);
  const totalTasks = allProjectTasks.length;
  const doneTasks = allProjectTasks.filter(({ task }) => task.status === 'done').length;
  const doingTasks = allProjectTasks.filter(({ task }) => task.status === 'doing').length;
  const pendingAcceptTasks = projectPendingAcceptCount(selected);
  const blockedTasks = allProjectTasks.filter(({ task }) => task.blocked).length;
  const taskStatusFilter = opts.taskStatusFilter || '';
  const taskView = opts.taskView === 'flat' ? 'flat' : 'tree';
  const todayStr = todayISO();
  const taskUserCell = (name, seed) => (name && String(name).trim())
    ? `<span class="pm-task-user"><span class="pc-avatar pc-avatar-tone-${(seed || 0) % 5}">${esc(String(name).slice(0, 1).toUpperCase())}</span><span class="pm-task-user-name">${esc(name)}</span></span>`
    : '<span class="pm-task-muted">—</span>';
  const taskProgressPct = (task) => {
    const subTasks = Array.isArray(task.subtasks) ? task.subtasks : [];
    if (subTasks.length) {
      const subDone = subTasks.filter((sub) => sub.status === 'done').length;
      return Math.round(subDone / subTasks.length * 100);
    }
    if (task.status === 'done') return 100;
    if (task.status === 'doing') return 60;
    return 0;
  };
  const taskPredecessorText = (task) => {
    const names = (task.predecessors || []).map((id) => findProjectTask(selected, id)?.task?.title).filter(Boolean);
    return names.length ? esc(names.join('、')) : '<span class="pm-task-muted">—</span>';
  };
  const taskProgressCell = (task) => {
    const pctValue = taskProgressPct(task);
    return `<div class="pm-task-progress"><div class="pc-progress-bar"><span style="width:${pctValue}%"></span></div><em>${pctValue}%</em></div>`;
  };
  const milestoneProgressCell = (milestone) => {
    const prog = milestoneProgress(milestone);
    return `<div class="pm-task-progress"><div class="pc-progress-bar"><span style="width:${prog.pct}%"></span></div><em>${prog.pct}%</em></div>`;
  };
  const taskDueCell = (task) => {
    if (!task.dueDate) return '<span class="pm-task-muted">—</span>';
    const overdue = task.status !== 'done' && task.dueDate < todayStr;
    return `<span class="${overdue ? 'pm-task-due-overdue' : 'pm-task-due'}">${esc(task.dueDate)}${overdue ? '<i class="ri-error-warning-line"></i>' : ''}</span>`;
  };
  const taskStatusCell = (task) => {
    let badge;
    if (task.status === 'done' && task.reviewer && task.acceptanceStatus !== 'accepted') {
      badge = '<span class="pm-task-status pending">待验收</span>';
    } else {
      badge = pmTaskStatusTag(task.status);
    }
    if (task.blocked) badge += `<span class="pm-task-blocked-chip" title="${esc(task.blockedReason || '该任务被阻塞')}"><i class="ri-error-warning-line"></i>阻塞</span>`;
    return badge;
  };
  const renderProjectTaskRow = (task, depth, milestoneName) => {
    const children = Array.isArray(task.subtasks) ? task.subtasks : [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedTasks.has(task.id);
    const isActive = selectedTaskId === task.id;
    const indent = Math.min(depth, 5) * 26;
    return `<tr class="pm-task-tree-row ${task.blocked ? 'is-blocked' : ''} ${isActive ? 'is-active' : ''}">
      <td class="pm-task-check-cell"><input type="checkbox" class="pm-check" aria-label="选择 ${esc(task.title || '任务')}"></td>
      <td class="pm-task-name-cell">
        <div class="pm-task-name-row" style="padding-left:${10 + indent}px">
          ${hasChildren
            ? `<button type="button" class="pm-task-toggle" data-action="toggle-project-task" data-task-id="${esc(task.id)}" aria-label="${isCollapsed ? '展开' : '收起'}"><i class="${isCollapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line'}"></i></button>`
            : '<span class="pm-task-toggle-spacer"></span>'}
          ${taskView === 'flat' && milestoneName ? `<span class="pm-task-milestone-tag">${esc(milestoneName)}</span>` : ''}
          ${task.blocked ? '<i class="ri-error-warning-line pm-task-blocked-icon"></i>' : ''}
          <button type="button" class="pm-task-name-link" data-action="open-project-task-detail" data-task-id="${esc(task.id)}" title="打开任务详情">${esc(task.title || '未命名任务')}</button>
          ${(task.predecessors || []).length ? `<span class="pm-task-predecessor-count" title="${(task.predecessors || []).length} 个前置任务"><i class="ri-git-branch-line"></i>${(task.predecessors || []).length}</span>` : ''}
        </div>
      </td>
      <td>${taskStatusCell(task)}</td>
      <td>${taskUserCell(task.assignee, depth)}</td>
      <td>${taskUserCell(task.reviewer, depth + 1)}</td>
      <td>${taskProgressCell(task)}</td>
      <td>${taskDueCell(task)}</td>
      <td class="pm-task-predecessor-cell">${taskPredecessorText(task)}</td>
      <td>${priorityTag(task.priority)}</td>
    </tr>`;
  };
  const renderMilestoneRow = (milestone, index) => {
    const tasksCount = (Array.isArray(milestone.tasks) ? milestone.tasks : []).length;
    const collapsed = collapsedMilestones.has(milestone.id);
    return `<tr class="pm-task-milestone-row">
      <td class="pm-task-check-cell"><input type="checkbox" class="pm-check" aria-label="选择 ${esc(milestone.name || '里程碑')}"></td>
      <td class="pm-task-name-cell">
        <div class="pm-task-milestone-name">
          <button type="button" class="pm-task-toggle" data-action="toggle-milestone" data-milestone-id="${esc(milestone.id)}" aria-label="${collapsed ? '展开' : '收起'}里程碑"><i class="${collapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line'}"></i></button>
          <span class="pm-task-milestone-icon"><i class="ri-flag-line"></i></span>
          <strong>${esc(milestone.name || '未命名里程碑')}</strong>
          <span class="pm-task-milestone-count">${tasksCount} 项任务</span>
        </div>
      </td>
      <td>${milestoneStatusTag(milestone.status)}</td>
      <td>${taskUserCell(milestone.owner, index)}</td>
      <td>${taskUserCell(milestone.reviewer, index + 1)}</td>
      <td>${milestoneProgressCell(milestone)}</td>
      <td>${taskDueCell(milestone)}</td>
      <td><span class="pm-task-muted">—</span></td>
      <td><span class="pm-task-muted">—</span></td>
    </tr>`;
  };
  const taskMatchesFilter = (task) => {
    if (!taskStatusFilter) return true;
    if (taskStatusFilter === 'blocked') return task.blocked;
    if (taskStatusFilter === 'pending-accept') return task.status === 'done' && task.reviewer && task.acceptanceStatus !== 'accepted';
    return task.status === taskStatusFilter;
  };
  const statusFilterOptions = [
    ['', '全部状态'],
    ['todo', '未开始'],
    ['doing', '进行中'],
    ['done', '已完成'],
    ['blocked', '已阻塞'],
    ['pending-accept', '待验收'],
  ];
  let taskRowsHtml = '';
  if (taskView === 'flat') {
    const filteredFlat = allProjectTasks.filter(({ task }) => taskMatchesFilter(task));
    if (taskStatusFilter && !filteredFlat.length) {
      taskRowsHtml = '';
    } else {
      filteredFlat.forEach(({ task, milestone }) => { taskRowsHtml += renderProjectTaskRow(task, 0, milestone?.name); });
    }
  } else {
    milestones.forEach((milestone, index) => {
      const flatChildren = [];
      const walk = (task, depth) => {
        flatChildren.push({ task, depth });
        (Array.isArray(task.subtasks) ? task.subtasks : []).forEach((sub) => walk(sub, depth + 1));
      };
      (Array.isArray(milestone.tasks) ? milestone.tasks : []).forEach((task) => walk(task, 1));
      const matching = flatChildren.filter(({ task }) => taskMatchesFilter(task));
      if (taskStatusFilter && !matching.length) return;
      taskRowsHtml += renderMilestoneRow(milestone, index);
      if (!collapsedMilestones.has(milestone.id)) {
        matching.forEach(({ task, depth }) => { taskRowsHtml += renderProjectTaskRow(task, depth, milestone.name); });
      }
    });
  }
  const taskStatsHtml = [
    ['ri-list-check-2', 'blue', '总任务', totalTasks],
    ['ri-checkbox-circle-line', 'green', '已完成', doneTasks],
    ['ri-loader-4-line', 'teal', '进行中', doingTasks],
    ['ri-time-line', 'orange', '待验收', pendingAcceptTasks],
    ['ri-error-warning-line', 'red', '已阻塞', blockedTasks],
  ].map(([icon, tone, label, value]) => `<div class="pm-task-stat pm-task-stat-${tone}"><span class="pm-task-stat-icon"><i class="${icon}"></i></span><div class="pm-task-stat-copy"><small>${label}</small><strong>${value}</strong></div></div>`).join('');
  const firstMilestoneId = milestones[0] ? milestones[0].id : '';
  const tasksTab = `<div class="pm-task-section">
    <div class="pm-task-stats">${taskStatsHtml}</div>
    <div class="pm-task-table-card">
      <div class="pm-task-toolbar">
        <div class="pm-task-toolbar-left"><h3>任务列表</h3><span class="pm-task-total">共 ${totalTasks} 项</span></div>
        <div class="pm-task-toolbar-right">
          ${firstMilestoneId ? `<button type="button" class="button primary sm" data-action="add-project-task" data-project-id="${esc(selected.id)}" data-milestone-id="${esc(firstMilestoneId)}"><i class="ri-add-line"></i> 添加任务</button>` : ''}
          <label class="pm-task-tool-filter"><i class="ri-filter-3-line"></i><select class="pm-task-tool-select" data-project-task-filter aria-label="筛选状态">${statusFilterOptions.map(([value, label]) => `<option value="${value}" ${taskStatusFilter === value ? 'selected' : ''}>筛选：${label}</option>`).join('')}</select></label>
          <label class="pm-task-tool-view"><i class="ri-list-check"></i><select class="pm-task-tool-select" data-project-task-view aria-label="视图方式"><option value="tree" ${taskView === 'tree' ? 'selected' : ''}>视图：树状</option><option value="flat" ${taskView === 'flat' ? 'selected' : ''}>视图：扁平</option></select></label>
        </div>
      </div>
      ${totalTasks || milestones.length ? `<div class="pm-task-table-wrap"><table class="pm-task-table">
        <thead><tr>
          <th class="pm-task-check-cell"><input type="checkbox" class="pm-check" aria-label="全选"></th>
          <th>任务名称</th><th>状态</th><th>负责人</th><th>验收人</th><th>进度</th><th>截止时间</th><th>前置任务</th><th>优先级</th>
        </tr></thead>
        <tbody>${taskRowsHtml || `<tr><td colspan="9"><div class="pm-task-table-empty">没有符合筛选条件的任务</div></td></tr>`}</tbody>
      </table></div>` : `<div class="project-milestone-empty"><i class="ri-flag-line"></i><strong>还没有里程碑</strong><p>先添加里程碑，再为每个里程碑拆解任务、负责人与验收人。</p><button type="button" class="button primary" data-action="add-milestone" data-project-id="${esc(selected.id)}"><i class="ri-add-line"></i> 添加里程碑</button></div>`}
    </div>
  </div>`;

  // ===== SOP =====
  const sopNodes = milestones.length ? milestones.map((milestone, index) => {
    const prog = milestoneProgress(milestone);
    const taskList = Array.isArray(milestone.tasks) ? milestone.tasks : [];
    const outputs = [];
    collectProjectTasks({ milestones: [milestone] }).forEach(({ task }) => (task.deliverables || []).forEach((deliverable) => { if (deliverable.text) outputs.push(deliverable.text); }));
    const nextMilestone = milestones[index + 1];
    const outputText = outputs.length ? outputs.slice(0, 3).map(esc).join('<br>') : '阶段交付物';
    return `<div class="pm-sop-node">
      <div class="pm-sop-node-head">
        <span class="pm-sop-node-index">${index + 1}</span>
        <strong>${esc(milestone.name || '未命名里程碑')}</strong>
        ${milestoneStatusTag(milestone.status)}
      </div>
      <div class="pm-sop-node-grid">
        <div class="pm-sop-field"><span><i class="ri-login-box-line"></i>输入</span><p>${milestone.description ? esc(milestone.description) : '前置依赖或上一阶段输出'}</p></div>
        <div class="pm-sop-field"><span><i class="ri-play-circle-line"></i>执行</span><p>${esc(milestone.name || '阶段推进')} · ${taskList.length} 项任务</p></div>
        <div class="pm-sop-field"><span><i class="ri-box-3-line"></i>输出</span><p>${taskList.length ? outputText : '阶段交付物'}</p></div>
        <div class="pm-sop-field"><span><i class="ri-award-line"></i>验收</span><p>${milestone.reviewer ? esc(milestone.reviewer) : '待指定验收人'}</p></div>
        <div class="pm-sop-field"><span><i class="ri-arrow-right-circle-line"></i>下一步</span><p>${nextMilestone ? esc(nextMilestone.name) : '项目交付 / 复盘归档'}</p></div>
      </div>
      <div class="pm-sop-node-progress"><span>完成度</span><div class="project-progress-bar"><span style="width:${prog.pct}%"></span></div><em>${prog.pct}%</em></div>
    </div>`;
  }).join('') : '';
  const sopTab = `<div class="pm-sop-wrap">${sopNodes ? `<div class="pm-sop-flow">${sopNodes}</div>` : '<div class="project-milestone-empty"><i class="ri-flow-chart"></i><strong>还没有 SOP 流程</strong><p>SOP 会基于项目的里程碑自动生成「输入 → 执行 → 输出 → 验收 → 下一步」的阶段流程。</p><button type="button" class="button primary" data-action="add-milestone" data-project-id="${esc(selected.id)}"><i class="ri-add-line"></i> 添加里程碑</button></div>'}</div>`;

  // ===== 验收 =====
  const acceptanceItems = collectProjectAcceptance(selected);
  const acceptanceTab = acceptanceItems.length ? `<div class="pm-accept-list">${acceptanceItems.map(({ task, milestone }) => `<div class="pm-accept-item"><div class="pm-accept-main"><div class="pm-accept-title"><i class="ri-award-line"></i>${esc(task.title || '未命名任务')}</div><div class="pm-accept-meta"><span>${esc(milestone?.name || '未分组')}</span><span>验收人 ${esc(task.reviewer || '未指定')}</span><span>截止 ${task.dueDate || '未设置'}</span>${task.status === 'done' ? '<span class="tag green">已完成</span>' : ''}</div></div><div class="pm-accept-actions"><button class="link-button" data-action="open-project-task-acceptance" data-project-id="${esc(selected.id)}" data-task-id="${esc(task.id)}">查看任务</button><button class="button primary sm" data-action="accept-project-task" data-project-id="${esc(selected.id)}" data-task-id="${esc(task.id)}">通过验收</button><button class="button ghost sm" data-action="rework-project-task" data-project-id="${esc(selected.id)}" data-task-id="${esc(task.id)}">退回修改</button></div></div>`).join('')}</div>` : '<div class="project-milestone-empty"><i class="ri-award-line"></i><strong>暂无待验收任务</strong><p>任务完成后且指定了验收人，会出现在这里等待验收。</p></div>';

  // ===== 文档 =====
  const docGroups = milestones.map((milestone) => {
    const docs = [];
    collectProjectTasks({ milestones: [milestone] }).forEach(({ task }) => (task.deliverables || []).forEach((deliverable) => { if (deliverable.text) docs.push({ ...deliverable, task: task }); }));
    return { milestone, docs };
  }).filter((group) => group.docs.length);
  const docsTab = docGroups.length ? `<div class="pm-doc-groups">${docGroups.map(({ milestone, docs }) => `<div class="pm-doc-group"><div class="pm-doc-group-head"><i class="ri-folder-3-line"></i><strong>${esc(milestone.name)}</strong><span>${docs.length} 个交付物</span></div><div class="pm-doc-list">${docs.map((doc) => `<div class="pm-doc-item"><span class="pm-doc-status ${doc.done ? 'done' : ''}"><i class="ri-${doc.done ? 'checkbox-circle-fill' : 'checkbox-blank-circle-line'}"></i></span><div class="pm-doc-copy"><strong>${esc(doc.text)}</strong><small>来源任务：${esc(doc.task?.title || '未命名任务')} · 负责人 ${esc(doc.task?.assignee || '未指定')}</small></div></div>`).join('')}</div></div>`).join('')}</div>` : '<div class="project-milestone-empty"><i class="ri-file-text-line"></i><strong>还没有项目文档</strong><p>为任务添加交付物后，会在这里自动汇总成项目文档清单。</p></div>';

  // ===== 成员 =====
  const members = projectMembers(selected);
  const membersTab = members.length ? `<div class="pm-member-grid">${members.map((name, index) => {
    const summary = memberRoleSummary(state, selected, name);
    const roles = [];
    if (summary.isOwner) roles.push('<span class="pm-member-role owner">负责人</span>');
    if (summary.milestonesOwner) roles.push(`<span class="pm-member-role">里程碑负责人 ×${summary.milestonesOwner}</span>`);
    if (summary.tasksAssigned) roles.push(`<span class="pm-member-role">执行人 ×${summary.tasksAssigned}</span>`);
    if (summary.tasksReviewed) roles.push(`<span class="pm-member-role">验收人 ×${summary.tasksReviewed}</span>`);
    const prog = summary.tasksAssigned ? Math.round(summary.tasksDone / summary.tasksAssigned * 100) : 0;
    return `<div class="pm-member-card">
      <div class="pm-member-head">${avatar(name, index)}<div><strong>${esc(name)}</strong><small>${roles.join('') || '项目成员'}</small></div></div>
      <div class="pm-member-stats">
        <span><em>${summary.tasksAssigned}</em>执行</span>
        <span><em>${summary.tasksReviewed}</em>验收</span>
        <span><em>${summary.milestonesOwner}</em>里程碑</span>
        <span><em>${summary.tasksDone}</em>已完成</span>
      </div>
      <div class="pm-member-progress"><div class="project-progress-bar"><span style="width:${prog}%"></span></div><small>任务完成率 ${prog}%</small></div>
    </div>`;
  }).join('')}</div>` : '<div class="project-milestone-empty"><i class="ri-team-line"></i><strong>还没有成员</strong><p>为里程碑或任务指定负责人 / 执行人后，成员会显示在这里。</p></div>';

  // ===== 动态 =====
  const events = collectProjectActivity(selected);
  const activityTab = events.length ? `<div class="pm-activity">${events.map((event) => `<div class="pm-activity-item"><span class="pm-activity-dot ${event.tone}"></span><div class="pm-activity-body">${pmActivityBadge(event)}<div class="pm-activity-text">${event.type === 'comment' ? `<strong>${esc(event.author || '成员')}</strong> 在任务「${esc(event.name)}」中评论：${esc(event.text)}` : event.type === 'blocked' ? `<strong>${esc(event.name)}</strong> 被标记为阻塞${event.reason ? `（${esc(event.reason)}）` : ''}` : event.type === 'deliverable' ? `交付物「${esc(event.name)}」${event.done ? '已完成' : '进行中'}` : event.type === 'milestone' ? `里程碑「${esc(event.name)}」${statusLabel(event.status)}` : `任务「${esc(event.name)}」${event.tone === 'done' ? '已完成' : '进入推进'}`}</div><span class="pm-activity-date">${event.date ? esc(event.date) : '未设置'}</span></div></div>`).join('')}</div>` : '<div class="project-milestone-empty"><i class="ri-time-line"></i><strong>暂无动态</strong><p>项目、任务和交付物的变更会在这里留下时间线。</p></div>';

  const tabContent = { '概览': overviewTab, '里程碑': milestonesTab, '任务': tasksTab, 'SOP': sopTab, '验收': acceptanceTab, '文档': docsTab, '成员': membersTab, '动态': activityTab }[activeTab];

  return `<section class="project-detail pc-detail">
    <div class="pc-detail-back-row"><button type="button" class="pc-back-btn" data-action="open-project-center"><i class="ri-arrow-left-line"></i> 返回项目中心</button></div>
    <div class="project-detail-head">
      <div class="project-detail-title">
        <span class="project-detail-kicker">PROJECT</span>
        <h1>${esc(selected.name || '未命名项目')}</h1>
        <div class="project-detail-tags">${priorityTag(selected.priority)}${statusTag(selected.status)}${riskTag(projectRisk(state, selected))}</div>
      </div>
      <div class="project-detail-actions">
        <button class="button" data-action="add-milestone" data-project-id="${esc(selected.id)}"><i class="ri-flag-line"></i> 里程碑</button>
        <button class="button" data-action="link-tasks-project" data-project-id="${esc(selected.id)}"><i class="ri-link"></i> 关联任务</button>
        <button class="button ghost" data-action="edit-project" data-project-id="${esc(selected.id)}"><i class="ri-edit-line"></i> 编辑</button>
      </div>
    </div>
    <div class="project-detail-progress"><div class="project-progress-bar"><span style="width:${progress.pct}%"></span></div><span>${progress.pct}%</span></div>
    <p class="project-detail-desc">${esc(selected.description || '暂无项目说明')}</p>
    <div class="project-detail-meta">
      <div class="project-meta-cell"><small>负责人</small><strong>${esc(selected.owner || '未指定')}</strong></div>
      <div class="project-meta-cell"><small>分类</small><strong>${esc(selected.category || '未分类')}</strong></div>
      <div class="project-meta-cell"><small>阶段</small><strong>${esc(selected.stage || '未设定')}</strong></div>
      <div class="project-meta-cell"><small>截止日期</small><strong>${esc(selected.dueDate || '未设置')}</strong></div>
    </div>
    <div class="pm-detail-tabs" role="tablist">${PROJECT_DETAIL_TABS.map((tab) => `<button type="button" class="pm-detail-tab ${activeTab === tab.key ? 'active' : ''}" data-action="project-detail-tab" data-detail-tab="${tab.key}" role="tab" aria-selected="${activeTab === tab.key}"><i class="${tab.icon}"></i>${tab.key}</button>`).join('')}</div>
    <div class="pm-detail-body">${tabContent}</div>
  </section>`;
}