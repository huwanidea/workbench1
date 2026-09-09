/* eslint-disable */
import { DEFAULT_FIELD_CONFIGS } from './calc.js';

export function getFieldConfigs(state, scope) {
  const configs = Array.isArray(state?.settings?.fieldConfigs) ? state.settings.fieldConfigs : DEFAULT_FIELD_CONFIGS;
  if (!scope || scope === 'all') return configs;
  return configs.filter((c) => c.scope === scope || c.scope === 'both');
}

export function getFieldConfig(state, key) {
  return getFieldConfigs(state).find((c) => c.key === key);
}

export function fieldConfigDefaultValue(state, key) {
  const config = getFieldConfig(state, key);
  return config ? config.defaultValue : '';
}

export function isFieldRequired(state, key) {
  const config = getFieldConfig(state, key);
  return config ? config.required : false;
}

export function isFieldVisible(state, key, scope) {
  const config = getFieldConfig(state, key);
  if (!config) return true;
  if (scope && config.scope !== 'both' && config.scope !== scope) return false;
  return config.visible;
}

const SCOPE_LABELS = { pool: '任务池', task: '任务文件', both: '共用' };

export function renderFieldConfigPanel(state) {
  const configs = getFieldConfigs(state);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  const rows = configs.map((config, index) => {
    const scopeLabel = SCOPE_LABELS[config.scope] || config.scope;
    return `
      <tr class="field-config-row" data-field-config-index="${index}">
        <td class="field-config-key"><code>${esc(config.key)}</code></td>
        <td class="field-config-label"><input class="input field-config-input" data-field-config="label" data-index="${index}" value="${esc(config.label)}" placeholder="显示名称"></td>
        <td class="field-config-scope"><span class="field-config-scope-badge ${esc(config.scope)}">${esc(scopeLabel)}</span></td>
        <td class="field-config-toggle"><input type="checkbox" class="field-config-check" data-field-config="required" data-index="${index}" ${config.required ? 'checked' : ''} aria-label="必填"></td>
        <td class="field-config-toggle"><input type="checkbox" class="field-config-check" data-field-config="visible" data-index="${index}" ${config.visible ? 'checked' : ''} aria-label="可见"></td>
        <td class="field-config-default"><input class="input field-config-input" data-field-config="defaultValue" data-index="${index}" value="${esc(config.defaultValue)}" placeholder="默认值"></td>
      </tr>
    `;
  }).join('');

  return `
    <div class="card form-section field-config-card">
      <div class="field-config-header">
        <h2>字段配置</h2>
        <p>管理任务池和任务文件字段的必填、可见、默认值。共用的字段在两个模块都会生效。</p>
      </div>
      <div class="field-config-table-wrap">
        <table class="field-config-table">
          <thead>
            <tr>
              <th>字段标识</th>
              <th>显示名称</th>
              <th>作用域</th>
              <th>必填</th>
              <th>可见</th>
              <th>默认值</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="field-config-footer">
        <span class="helper">修改后自动保存到当前用户工作空间。字段标识为系统内置，不可更改。</span>
      </div>
    </div>
  `;
}