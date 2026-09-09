/* eslint-disable */
import { sopTemplateNodes } from './projects.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

export function renderSopNodeEditor(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  return list.map((node, index) => `
    <section class="sop-node-editor">
      <div class="sop-node-editor-head">
        <span class="sop-node-editor-index">${index + 1}</span>
        <strong>节点 ${index + 1}</strong>
        <span class="sop-node-editor-flow">输入 → 执行 → 输出 → 验收 → 下一步</span>
        <button type="button" class="icon-button" data-action="remove-sop-node" data-node-index="${index}" aria-label="删除节点" ${list.length <= 1 ? 'disabled' : ''}>×</button>
      </div>
      <div class="sop-node-editor-grid">
        <label class="sop-node-field"><span><i class="ri-login-box-line"></i> 输入</span><textarea class="textarea" data-sop-node-field="input" data-node-index="${index}" placeholder="本节点的前置输入 / 依赖材料">${esc(node.input)}</textarea></label>
        <label class="sop-node-field"><span><i class="ri-play-circle-line"></i> 执行动作</span><input class="input" data-sop-node-field="action" data-node-index="${index}" value="${esc(node.action)}" placeholder="例如：需求评审、编码开发、测试验收"></label>
        <label class="sop-node-field"><span><i class="ri-box-3-line"></i> 输出</span><textarea class="textarea" data-sop-node-field="output" data-node-index="${index}" placeholder="本节点的交付物">${esc(node.output)}</textarea></label>
        <label class="sop-node-field"><span><i class="ri-check-double-line"></i> 验收标准</span><textarea class="textarea" data-sop-node-field="acceptance" data-node-index="${index}" placeholder="判定本节点通过的标准">${esc(node.acceptance)}</textarea></label>
        <label class="sop-node-field"><span><i class="ri-arrow-right-circle-line"></i> 下一步</span><input class="input" data-sop-node-field="next" data-node-index="${index}" value="${esc(node.next)}" placeholder="流转到下一个节点 / 角色"></label>
      </div>
    </section>
  `).join('');
}

function sopTemplateCard(template) {
  const nodes = Array.isArray(template.nodes) ? template.nodes : [];
  const steps = nodes.map((node, index) => `<div class="sop-step"><span class="sop-step-index">${index + 1}</span><div class="sop-step-body"><strong>${esc(node.action || '未命名节点')}</strong>${node.output ? `<small>输出：${esc(node.output)}</small>` : ''}</div></div>`).join('');
  return `<article class="sop-card">
    <div class="sop-card-head">
      <div><span class="sop-scene">${esc(template.scene || '通用场景')}</span><h3>${esc(template.name || '未命名模板')}</h3></div>
      <span class="sop-node-count">${nodes.length} 节点</span>
    </div>
    <div class="sop-card-meta">
      <span><i class="ri-user-line"></i>${esc(template.defaultOwnerRole || '未设置负责人')}</span>
      <span><i class="ri-award-line"></i>${esc(template.defaultReviewerRole || '未设置验收')}</span>
      <span><i class="ri-time-line"></i>${template.standardDuration ? `${esc(template.standardDuration)} 天` : '未设置工期'}</span>
    </div>
    <div class="sop-flow">${steps || '<div class="sop-flow-empty">暂无流程节点</div>'}</div>
    <div class="sop-card-foot">
      <button type="button" class="button primary sm" data-action="sop-generate-project" data-template-id="${esc(template.id)}"><i class="ri-rocket-2-line"></i> 生成项目</button>
      <button type="button" class="link-button" data-action="edit-sop-template" data-template-id="${esc(template.id)}">编辑</button>
      <button type="button" class="link-button" data-action="duplicate-sop-template" data-template-id="${esc(template.id)}">复制</button>
      <button type="button" class="link-button danger-link" data-action="delete-sop-template" data-template-id="${esc(template.id)}">删除</button>
    </div>
  </article>`;
}

export function renderSopTemplateLibrary(state, opts = {}) {
  const templates = sopTemplateNodes(state).slice().sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const nodeTotal = templates.reduce((sum, template) => sum + (Array.isArray(template.nodes) ? template.nodes.length : 0), 0);
  const withDuration = templates.filter((template) => Number(template.standardDuration) > 0);
  const avgDuration = withDuration.length ? Math.round(withDuration.reduce((sum, template) => sum + Number(template.standardDuration), 0) / withDuration.length) : 0;
  const stats = [
    { icon: 'ri-stack-line', label: '模板总数', value: templates.length },
    { icon: 'ri-node-tree', label: '流程节点', value: nodeTotal },
    { icon: 'ri-time-line', label: '平均工期', value: avgDuration ? `${avgDuration} 天` : '—' },
  ];
  const body = templates.length
    ? templates.map(sopTemplateCard).join('')
    : `<div class="sop-empty"><i class="ri-flow-chart"></i><strong>还没有 SOP 模板</strong><p>把重复性的标准流程沉淀成模板，之后一键生成项目结构与任务树。</p><button type="button" class="button primary" data-action="add-sop-template"><i class="ri-add-line"></i> 新建模板</button></div>`;
  return `<div class="sop-view">
    <div class="pc-head">
      <div class="pc-head-left"><span class="pc-eyebrow">SOP Templates</span><h1>SOP 项目模板</h1><p>把标准流程沉淀为模板，一键生成项目里程碑与任务树。</p></div>
      <div class="pc-head-right">
        <button type="button" class="button ghost" data-action="sop-back-center"><i class="ri-arrow-left-line"></i> 返回项目中心</button>
        <button type="button" class="button primary" data-action="add-sop-template"><i class="ri-add-line"></i> 新建模板</button>
      </div>
    </div>
    <div class="sop-stat-strip">${stats.map((stat) => `<div class="sop-stat"><span class="sop-stat-icon"><i class="${stat.icon}"></i></span><div><strong>${stat.value}</strong><small>${stat.label}</small></div></div>`).join('')}</div>
    <div class="sop-grid">${body}</div>
  </div>`;
}