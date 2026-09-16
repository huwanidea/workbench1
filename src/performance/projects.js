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
    createdAt: new Date().toISOString(),
    order: Date.now(),
    ...overrides,
  };
}

export function projectProgress(state, project) {
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const ids = Array.isArray(project.taskIds) ? project.taskIds : [];
  const total = ids.length;
  const done = ids.filter((id) => {
    const task = tasks.find((entry) => entry.id === id);
    return task && Number(task.completionPct) >= 100;
  }).length;
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}

const statusLabel = (status) => (status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待启动');
const statusTag = (status) => (status === 'done' ? '<span class="tag">已完成</span>' : status === 'doing' ? '<span class="tag green">进行中</span>' : '<span class="tag gold">待启动</span>');
const priorityTag = (priority) => (priority === '高' ? '<span class="tag red">高</span>' : priority === '低' ? '<span class="tag">低</span>' : '<span class="tag gold">普通</span>');

export function renderProjects(state, opts = {}) {
  const projects = projectNodes(state).slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  let selected = projectForId(state, opts.selectedId || '');
  if (!selected && projects.length) selected = projects[0];
  const selectedId = selected ? selected.id : '';

  const sidebarRows = projects.map((project) => {
    const progress = projectProgress(state, project);
    return `<div class="project-list-item ${selectedId === project.id ? 'active' : ''}" data-action="select-project" data-project-id="${esc(project.id)}">
      <div class="project-list-item-main">
        <span class="project-list-name">${esc(project.name || '未命名项目')}</span>
        <span class="project-list-meta"><span class="project-status-dot ${esc(project.status)}"></span>${statusLabel(project.status)} · ${progress.total} 项任务</span>
      </div>
      <span class="project-list-actions">
        <button type="button" class="project-mini" data-action="edit-project" data-project-id="${esc(project.id)}" title="编辑项目"><i class="ri-edit-line"></i></button>
        <button type="button" class="project-mini" data-action="delete-project" data-project-id="${esc(project.id)}" title="删除项目"><i class="ri-delete-bin-line"></i></button>
      </span>
    </div>`;
  }).join('');

  const sidebar = `<aside class="project-sidebar">
    <div class="project-sidebar-head"><h2>项目</h2><button class="button primary" data-action="add-project"><i class="ri-add-line"></i> 项目</button></div>
    <div class="project-sidebar-list">${sidebarRows || '<div class="project-sidebar-empty">还没有项目，点上方「项目」新建</div>'}</div>
  </aside>`;

  let detail = '';
  if (selected) {
    const progress = projectProgress(state, selected);
    const linkedTasks = (selected.taskIds || []).map((id) => state.tasks.find((task) => task.id === id)).filter(Boolean);
    const tasksHtml = linkedTasks.length ? linkedTasks.map((task) => {
      const done = Number(task.completionPct) >= 100;
      return `<div class="project-task-row" data-action="edit-task" data-id="${esc(task.id)}">
        <span class="project-task-status ${done ? 'done' : ''}">${done ? '已完成' : '进行中'}</span>
        <span class="project-task-title">${esc(task.content || '未命名任务')}</span>
        <span class="project-task-date">${esc(task.date || '未设置')}</span>
      </div>`;
    }).join('') : '<div class="empty">还没有关联任务，点右上角「关联任务」添加。</div>';

    detail = `<section class="project-detail">
      <div class="project-detail-head">
        <div class="project-detail-title">
          <span class="project-detail-kicker">PROJECT</span>
          <h1>${esc(selected.name || '未命名项目')}</h1>
          <div class="project-detail-tags">${priorityTag(selected.priority)}${statusTag(selected.status)}</div>
        </div>
        <div class="project-detail-actions">
          <button class="button" data-action="link-tasks-project" data-project-id="${esc(selected.id)}"><i class="ri-link"></i> 关联任务</button>
          <button class="button ghost" data-action="edit-project" data-project-id="${esc(selected.id)}"><i class="ri-edit-line"></i> 编辑</button>
        </div>
      </div>
      <div class="project-detail-progress">
        <div class="project-progress-bar"><span style="width:${progress.pct}%"></span></div>
        <span>${progress.pct}%</span>
      </div>
      <p class="project-detail-desc">${esc(selected.description || '暂无项目说明')}</p>
      <div class="project-detail-meta">
        <div class="project-meta-cell"><small>负责人</small><strong>${esc(selected.owner || '未指定')}</strong></div>
        <div class="project-meta-cell"><small>分类</small><strong>${esc(selected.category || '未分类')}</strong></div>
        <div class="project-meta-cell"><small>开始日期</small><strong>${esc(selected.startDate || '未设置')}</strong></div>
        <div class="project-meta-cell"><small>截止日期</small><strong>${esc(selected.dueDate || '未设置')}</strong></div>
      </div>
      <div class="project-detail-section">
        <div class="project-detail-section-head"><h2>关联任务</h2><span>${linkedTasks.length} 项</span></div>
        <div class="project-task-list">${tasksHtml}</div>
      </div>
    </section>`;
  } else {
    detail = `<section class="project-detail"><div class="project-detail-empty"><i class="ri-folder-open-line"></i><strong>选择或新建一个项目</strong><p>项目用于把相关的绩效任务组织在一起，追踪整体进度。</p></div></section>`;
  }

  return `<div class="project-workspace">${sidebar}${detail}</div>`;
}