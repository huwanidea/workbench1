/* eslint-disable */
import { findProjectTask, collectProjectTasks } from './projects.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

export function renderProjectTaskDrawer(state, project, taskId, currentUser = '') {
  const found = findProjectTask(project, taskId);
  if (!found) return '';
  const { task, milestone } = found;
  const allTasks = collectProjectTasks(project);
  const userOptions = Array.from(new Set(allTasks.map((t) => t.task.assignee).filter(Boolean).concat(currentUser ? [currentUser] : [])));
  const userListHtml = userOptions.length ? `<datalist id="pm-drawer-users">${userOptions.map((u) => `<option value="${esc(u)}"></option>`).join('')}</datalist>` : '';

  // 前置任务
  const predecessorList = (task.predecessors || []).map((pid) => {
    const pred = allTasks.find((t) => t.task.id === pid);
    return `<span class="pm-predecessor-chip"><span class="pm-predecessor-chip-dot"></span>${esc(pred?.task.title || '未知任务')}<button type="button" data-action="remove-task-predecessor" data-task-id="${esc(task.id)}" data-predecessor-id="${esc(pid)}" aria-label="移除前置">×</button></span>`;
  }).join('') || '<span class="pm-drawer-empty">暂无前置任务，可添加依赖关系</span>';

  const predecessorOptions = allTasks
    .filter((t) => t.task.id !== task.id && !(task.predecessors || []).includes(t.task.id))
    .map((t) => `<option value="${esc(t.task.id)}">${esc(t.milestone ? `M · ` : '')}${esc(t.task.title || '未命名任务')}</option>`)
    .join('');

  // 交付物
  const deliverableList = (task.deliverables || []).map((d) => `<div class="pm-deliverable"><input type="checkbox" data-action="toggle-task-deliverable" data-task-id="${esc(task.id)}" data-deliverable-id="${esc(d.id)}" ${d.done ? 'checked' : ''} aria-label="完成交付物"><input class="pm-deliverable-text" data-deliverable-field="text" data-task-id="${esc(task.id)}" data-deliverable-id="${esc(d.id)}" value="${esc(d.text)}" placeholder="交付物描述"><button type="button" class="pm-deliverable-del" data-action="delete-task-deliverable" data-task-id="${esc(task.id)}" data-deliverable-id="${esc(d.id)}" aria-label="删除交付物">×</button></div>`).join('') || '<span class="pm-drawer-empty">尚未登记交付物</span>';

  // 动态评论
  const commentList = (task.comments || []).map((c) => `<div class="pm-comment"><span class="pm-comment-avatar">${esc(String(c.author || '?').slice(0, 1).toUpperCase())}</span><div class="pm-comment-body"><div class="pm-comment-meta"><strong>${esc(c.author || '匿名')}</strong><small>${esc(c.createdAt || '')}</small></div><p>${esc(c.text)}</p></div></div>`).join('') || '<span class="pm-drawer-empty">暂无动态，写下第一条评论吧</span>';

  return `${userListHtml}<div class="pm-task-drawer-backdrop" data-action="close-project-task-detail"></div>
  <aside class="pm-task-drawer" role="dialog" aria-label="任务详情">
    <div class="pm-task-drawer-head">
      <div class="pm-task-drawer-head-copy"><span class="pm-drawer-eyebrow">任务详情</span><strong>${esc(milestone?.name || '')}</strong></div>
      <button type="button" class="pm-drawer-close" data-action="close-project-task-detail" aria-label="关闭">×</button>
    </div>
    <div class="pm-task-drawer-body">
      <div class="pm-drawer-title-block">
        <span class="pm-drawer-title-id">#${esc(task.id.slice(0, 6))}</span>
        <input class="pm-drawer-title-input" data-task-field="title" data-task-id="${esc(task.id)}" value="${esc(task.title)}" placeholder="任务标题">
        <select class="pm-drawer-status" data-task-field="status" data-task-id="${esc(task.id)}">
          <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>待办</option>
          <option value="doing" ${task.status === 'doing' ? 'selected' : ''}>进行中</option>
          <option value="done" ${task.status === 'done' ? 'selected' : ''}>已完成</option>
        </select>
        ${task.status === 'done' ? `<span class="pm-acceptance-chip ${task.acceptanceStatus === 'accepted' ? 'accepted' : task.acceptanceStatus === 'rework' ? 'rework' : 'pending'}">${task.acceptanceStatus === 'accepted' ? '已验收' : task.acceptanceStatus === 'rework' ? '已退回' : '待验收'}</span>` : ''}
      </div>
      <div class="pm-drawer-fields">
        <label><span>负责人</span><input class="input" data-task-field="assignee" data-task-id="${esc(task.id)}" list="pm-drawer-users" value="${esc(task.assignee)}" placeholder="执行人"></label>
        <label><span>验收人</span><input class="input" data-task-field="reviewer" data-task-id="${esc(task.id)}" list="pm-drawer-users" value="${esc(task.reviewer)}" placeholder="验收人"></label>
        <label><span>截止日期</span><input class="input" type="date" data-task-field="dueDate" data-task-id="${esc(task.id)}" value="${esc(task.dueDate)}"></label>
        <label><span>优先级</span><select class="select" data-task-field="priority" data-task-id="${esc(task.id)}"><option value="普通" ${task.priority === '普通' ? 'selected' : ''}>普通</option><option value="高" ${task.priority === '高' ? 'selected' : ''}>高</option><option value="低" ${task.priority === '低' ? 'selected' : ''}>低</option></select></label>
      </div>
      <section class="pm-drawer-section">
        <div class="pm-drawer-section-head"><h3><i class="ri-git-branch-line"></i>前置任务</h3><span>${(task.predecessors || []).length}</span></div>
        <div class="pm-predecessor-list">${predecessorList}</div>
        ${predecessorOptions ? `<select class="select pm-predecessor-add" data-task-predecessor-select data-task-id="${esc(task.id)}"><option value="">+ 添加前置任务</option>${predecessorOptions}</select>` : ''}
      </section>
      <section class="pm-drawer-section">
        <div class="pm-drawer-section-head"><h3><i class="ri-file-list-3-line"></i>执行要求</h3></div>
        <textarea class="textarea pm-drawer-textarea" data-task-field="requirement" data-task-id="${esc(task.id)}" placeholder="描述任务的具体执行要求、步骤或标准">${esc(task.requirement)}</textarea>
      </section>
      <section class="pm-drawer-section">
        <div class="pm-drawer-section-head"><h3><i class="ri-box-3-line"></i>交付物</h3><span>${(task.deliverables || []).filter((d) => d.done).length}/${(task.deliverables || []).length}</span></div>
        <div class="pm-deliverable-list">${deliverableList}</div>
        <button type="button" class="pm-drawer-add-btn" data-action="add-task-deliverable" data-task-id="${esc(task.id)}"><i class="ri-add-line"></i> 添加交付物</button>
      </section>
      <section class="pm-drawer-section">
        <div class="pm-drawer-section-head"><h3><i class="ri-check-double-line"></i>验收标准</h3></div>
        <textarea class="textarea pm-drawer-textarea" data-task-field="acceptance" data-task-id="${esc(task.id)}" placeholder="明确验收通过的判定标准">${esc(task.acceptance)}</textarea>
      </section>
      <section class="pm-drawer-section">
        <div class="pm-drawer-section-head">
          <h3><i class="ri-error-warning-line"></i>阻塞标记</h3>
          <button type="button" class="pm-block-toggle ${task.blocked ? 'active' : ''}" data-action="toggle-task-blocked" data-task-id="${esc(task.id)}"><i class="ri-error-warning-line"></i>${task.blocked ? '已阻塞' : '标记阻塞'}</button>
        </div>
        ${task.blocked ? `<textarea class="textarea pm-drawer-textarea" data-task-field="blockedReason" data-task-id="${esc(task.id)}" placeholder="说明阻塞原因、依赖什么、预计何时解除">${esc(task.blockedReason)}</textarea>` : '<span class="pm-drawer-empty">任务正常推进中，遇到阻碍时可点击「标记阻塞」。</span>'}
      </section>
      <section class="pm-drawer-section">
        <div class="pm-drawer-section-head"><h3><i class="ri-chat-3-line"></i>动态</h3><span>${(task.comments || []).length}</span></div>
        <div class="pm-comment-list">${commentList}</div>
        <div class="pm-comment-input"><input class="input" data-task-comment-input data-task-id="${esc(task.id)}" placeholder="写下评论，按 Enter 发送"><button type="button" class="pm-comment-send" data-action="add-task-comment" data-task-id="${esc(task.id)}"><i class="ri-send-plane-fill"></i></button></div>
      </section>
    </div>
  </aside>`;
}