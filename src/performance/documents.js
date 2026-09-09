/* eslint-disable */
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

export const TASKS_GROUP_ID = '__tasks__';

export function documentNodes(state) {
  return Array.isArray(state.documentTree) ? state.documentTree : [];
}

export function docChildrenMap(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const parentId = node.parentId || null;
    if (!map.has(parentId)) map.set(parentId, []);
    map.get(parentId).push(node);
  }
  for (const list of map.values()) list.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  return map;
}

export function createDocumentNode(parentId = null, title = '未命名文档') {
  return {
    id: crypto.randomUUID(),
    kind: 'doc',
    title,
    parentId,
    body: '',
    createdAt: new Date().toISOString(),
    updatedAt: '',
    order: Date.now(),
  };
}

export function createFolderNode(parentId = null, title = '新建文件夹') {
  return {
    id: crypto.randomUUID(),
    kind: 'folder',
    title,
    parentId,
    order: Date.now(),
  };
}

export function collectDescendantIds(nodes, folderId) {
  const result = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (!result.has(node.id) && result.has(node.parentId)) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return result;
}

export function renderDocTree(state, opts = {}) {
  const nodes = documentNodes(state);
  const byParent = docChildrenMap(nodes);
  const expanded = opts.expanded || new Set();
  const selectedDocId = opts.selectedKind === 'doc' ? opts.selectedId : null;
  const selectedTaskId = opts.selectedKind === 'task' ? opts.selectedId : null;

  const renderNode = (node, depth) => {
    const children = byParent.get(node.id) || [];
    if (node.kind === 'folder') {
      const isOpen = expanded.has(node.id);
      return `<div class="doc-tree-node">
        <div class="doc-tree-row doc-tree-row--folder" data-action="toggle-doc-folder" data-folder-id="${esc(node.id)}" style="--doc-depth:${depth}">
          <span class="doc-tree-chevron ${isOpen ? 'open' : ''}"><i class="ri-arrow-right-s-line"></i></span>
          <span class="doc-tree-icon"><i class="ri-folder-3-line"></i></span>
          <span class="doc-tree-title">${esc(node.title || '未命名文件夹')}</span>
          <span class="doc-tree-count">${children.length}</span>
          <span class="doc-tree-row-actions">
            <button type="button" class="doc-tree-mini" data-action="add-doc-in-folder" data-folder-id="${esc(node.id)}" title="在文件夹内新建文档"><i class="ri-add-line"></i></button>
            <button type="button" class="doc-tree-mini" data-action="rename-doc-node" data-node-id="${esc(node.id)}" title="重命名"><i class="ri-edit-line"></i></button>
            <button type="button" class="doc-tree-mini" data-action="delete-doc-node" data-node-id="${esc(node.id)}" title="删除"><i class="ri-delete-bin-line"></i></button>
          </span>
        </div>
        ${isOpen ? `<div class="doc-tree-children">${children.map((child) => renderNode(child, depth + 1)).join('') || '<div class="doc-tree-empty">空文件夹</div>'}</div>` : ''}
      </div>`;
    }
    return `<div class="doc-tree-node">
      <div class="doc-tree-row doc-tree-row--doc ${selectedDocId === node.id ? 'active' : ''}" data-action="select-doc" data-doc-id="${esc(node.id)}" style="--doc-depth:${depth}">
        <span class="doc-tree-icon"><i class="ri-file-text-line"></i></span>
        <span class="doc-tree-title">${esc(node.title || '未命名文档')}</span>
        <span class="doc-tree-row-actions">
          <button type="button" class="doc-tree-mini" data-action="rename-doc-node" data-node-id="${esc(node.id)}" title="重命名"><i class="ri-edit-line"></i></button>
          <button type="button" class="doc-tree-mini" data-action="delete-doc-node" data-node-id="${esc(node.id)}" title="删除"><i class="ri-delete-bin-line"></i></button>
        </span>
      </div>
    </div>`;
  };

  const roots = byParent.get(null) || [];
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const tasksOpen = expanded.has(TASKS_GROUP_ID);

  const tasksGroup = `<div class="doc-tree-group doc-tree-group--preset">
    <div class="doc-tree-group-row" data-action="toggle-doc-folder" data-folder-id="${TASKS_GROUP_ID}">
      <span class="doc-tree-chevron ${tasksOpen ? 'open' : ''}"><i class="ri-arrow-right-s-line"></i></span>
      <span class="doc-tree-icon doc-tree-icon--preset"><i class="ri-task-line"></i></span>
      <span class="doc-tree-title">任务文档</span>
      <span class="doc-tree-count">${tasks.length}</span>
    </div>
    ${tasksOpen ? `<div class="doc-tree-children">${tasks.length ? tasks.map((task) => `<div class="doc-tree-node"><div class="doc-tree-row doc-tree-row--doc doc-tree-row--task ${selectedTaskId === task.id ? 'active' : ''}" data-action="select-doc-task" data-task-id="${esc(task.id)}" style="--doc-depth:1"><span class="doc-tree-icon doc-tree-icon--task"><i class="ri-file-text-line"></i></span><span class="doc-tree-title">${esc(task.content || '未命名任务')}</span></div></div>`).join('') : '<div class="doc-tree-empty">暂无任务文档</div>'}</div>` : ''}
  </div>`;

  const library = `<div class="doc-tree-group">
    <div class="doc-tree-group-head"><span>文档库</span></div>
    <div class="doc-tree-children doc-tree-children--root">${roots.map((node) => renderNode(node, 0)).join('') || '<div class="doc-tree-empty">还没有文档，点上方「+ 文档」新建</div>'}</div>
  </div>`;

  return `<div class="doc-tree">${tasksGroup}${library}</div>`;
}