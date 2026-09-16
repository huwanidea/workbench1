/* eslint-disable */
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

export const AVATAR_LIBRARY = [
  '👩', '👨', '🧑', '👧', '👦', '👵', '👴', '👶',
  '👮', '👷', '💂', '🕵️', '👩‍⚕️', '👨‍⚕️', '👩‍🍳', '👨‍🍳',
  '👩‍🏫', '👨‍🏫', '👩‍💼', '👨‍💼', '👩‍🔧', '👨‍🔧', '👩‍🎓', '👨‍🎓',
  '🧔', '👱', '👩‍🦰', '👨‍🦰', '👩‍🦱', '👨‍🦱', '🦸', '🦹',
  '🧙', '🧚', '🤵', '👰', '🧕', '👳', '👲', '🧑‍🚀',
];

const uid = () => crypto.randomUUID();

function emptyNotes() {
  return { vocab: [], phrases: [], usage: [], grammar: [], alternatives: [] };
}

export function createEnglishSceneData() {
  return {
    type: 'english-scene',
    meta: {
      title: '场景对话学习复盘',
      subtitle: '记录真实场景对话，整理学习笔记，定期复盘，持续提升口语表达能力。',
      date: '2025-04-24',
      scene: '咖啡店点餐 (At a Coffee Shop)',
      goal: '熟悉点餐流程，练习日常交流表达',
      difficulty: '饮品尺寸、特殊需求的表达',
    },
    characters: [
      { id: 'c1', name: '店员', role: '咖啡店店员', avatar: '👩', self: false },
      { id: 'c2', name: '我', role: '对话学习者', avatar: '🧑', self: true },
      { id: 'c3', name: '朋友', role: '同行的朋友', avatar: '👧', self: false },
      { id: 'c4', name: '乘务员', role: '飞机乘务员', avatar: '👮', self: false },
    ],
    dialogue: [
      {
        id: 'd1', characterId: 'c1', time: '10:00',
        text: 'Hi! Welcome to our coffee shop. What can I get for you?',
        notes: {
          vocab: [],
          phrases: [{ id: uid(), text: 'What can I get for you?', meaning: '我能为你点什么？' }],
          usage: [{ id: uid(), text: '“What can I get for you?” 是服务行业最常见的开场白，语气友好自然。' }],
          grammar: [],
          alternatives: [],
        },
      },
      {
        id: 'd2', characterId: 'c2', time: '10:01',
        text: "I'd like a large latte, please.",
        notes: {
          vocab: [{ id: uid(), word: 'latte', phonetic: '/ˈlɑːteɪ/', meaning: 'n. 拿铁' }],
          phrases: [{ id: uid(), text: "I'd like ..., please.", meaning: '我想要……' }],
          usage: [{ id: uid(), text: '饮品尺寸可选用 small / medium / large。' }],
          grammar: [
            { id: uid(), text: '“I\u2019d like ...” 比 “I want ...” 更礼貌，适合点餐等公共场合。' },
            { id: uid(), text: '“Can I get ...?” / “Could I have ...?” 也常用，Could 更礼貌。' },
          ],
          alternatives: [
            { id: uid(), text: "I'd like a large latte, please. （我想要一杯大杯拿铁。）" },
            { id: uid(), text: 'Can I get a large latte? （我可以要一杯大杯拿铁吗？）' },
            { id: uid(), text: 'Could I have a large latte, please? （我能要一杯大杯拿铁吗？）' },
          ],
        },
      },
      {
        id: 'd3', characterId: 'c1', time: '10:02',
        text: 'Sure! Would you like it hot or iced?',
        notes: {
          vocab: [{ id: uid(), word: 'iced', phonetic: '/aɪst/', meaning: 'adj. 加冰的；冰的' }],
          phrases: [
            { id: uid(), text: 'Would you like ...?', meaning: '你想要……吗？' },
            { id: uid(), text: 'Hot or iced?', meaning: '热的还是冰的？' },
          ],
          usage: [], grammar: [], alternatives: [],
        },
      },
      {
        id: 'd4', characterId: 'c2', time: '10:03',
        text: 'Iced, please. And can I get an extra shot of espresso?',
        notes: {
          vocab: [
            { id: uid(), word: 'espresso', phonetic: '/eˈspresəʊ/', meaning: 'n. 浓缩咖啡' },
            { id: uid(), word: 'shot', phonetic: '/ʃɒt/', meaning: 'n.（一小份）' },
          ],
          phrases: [{ id: uid(), text: 'An extra shot.', meaning: '加一份浓缩。' }],
          usage: [{ id: uid(), text: '表达额外需求时，常用 “an extra shot”“less sugar”“non-dairy milk” 等。' }],
          grammar: [], alternatives: [],
        },
      },
      { id: 'd5', characterId: 'c1', time: '10:04', text: 'No problem. Anything else?', notes: emptyNotes() },
      { id: 'd6', characterId: 'c2', time: '10:04', text: "That's all. How much is it?", notes: emptyNotes() },
      { id: 'd7', characterId: 'c1', time: '10:05', text: "It's $5.50.", notes: emptyNotes() },
      { id: 'd8', characterId: 'c2', time: '10:05', text: "Great, I'll pay by card. Thank you!", notes: emptyNotes() },
    ],
    activeDialogueId: 'd2',
    reflection: '这次对话整体比较顺利，基本掌握了点餐的核心表达。需要多练习饮品尺寸、特殊需求的表达方法。下次可以尝试加入更多细节表达，例如询问甜度、替换牛奶种类等。',
    checklist: [
      { id: uid(), text: '尝试不同的饮品点单表达', done: false },
      { id: uid(), text: '练习更多相关场景（如餐厅、超市、酒店等）', done: false },
      { id: uid(), text: '复习本次生词和短语', done: false },
      { id: uid(), text: '进行角色扮演练习', done: false },
    ],
  };
}

export function isEnglishScene(node) {
  return Boolean(node?.sceneData && node.sceneData.type === 'english-scene');
}

function characterFor(data, id) {
  return (data.characters || []).find((c) => c.id === id) || null;
}

function dialogueFor(data, id) {
  return (data.dialogue || []).find((d) => d.id === id) || null;
}

function renderMetaField(label, key, value, type = 'text', placeholder = '') {
  return `<label class="scene-meta-item"><span>${esc(label)}</span><input class="scene-meta-input" type="${type}" data-scene-meta="${esc(key)}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;
}

function renderCharacterCard(data, character) {
  const selfTag = character.self ? '<span class="scene-person-self">我</span>' : '';
  return `<div class="scene-person" data-scene-char-id="${esc(character.id)}">
    <button type="button" class="scene-person-avatar" data-action="scene-open-avatar" data-scene-char-id="${esc(character.id)}" title="更换头像">${esc(character.avatar || '👤')}</button>
    <div class="scene-person-info">
      <div class="scene-person-name-row">${selfTag}<input class="scene-person-name" data-scene-char-field="name" data-scene-char-id="${esc(character.id)}" value="${esc(character.name)}" placeholder="人物名"></div>
      <input class="scene-person-role" data-scene-char-field="role" data-scene-char-id="${esc(character.id)}" value="${esc(character.role)}" placeholder="身份 / 角色说明">
    </div>
    <button type="button" class="scene-person-del" data-action="scene-del-char" data-scene-char-id="${esc(character.id)}" title="删除人物" aria-label="删除人物">×</button>
  </div>`;
}

function renderDialogueBubble(data, dialogue, active) {
  const character = characterFor(data, dialogue.characterId);
  const avatar = character?.avatar || '👤';
  const name = character?.name || '未选择人物';
  const self = Boolean(character?.self);
  return `<div class="scene-bubble ${self ? 'self' : ''} ${active ? 'active' : ''}" data-action="scene-select-dialogue" data-scene-dialogue-id="${esc(dialogue.id)}">
    <div class="scene-bubble-head">
      <span class="scene-bubble-avatar">${esc(avatar)}</span>
      <span class="scene-bubble-name">${esc(name)}</span>
      <input class="scene-bubble-time" type="text" data-scene-dialogue-field="time" data-scene-dialogue-id="${esc(dialogue.id)}" value="${esc(dialogue.time)}" placeholder="10:00">
      <button type="button" class="scene-bubble-del" data-action="scene-del-dialogue" data-scene-dialogue-id="${esc(dialogue.id)}" title="删除这条对话" aria-label="删除对话">×</button>
    </div>
    <textarea class="scene-bubble-text" rows="2" data-scene-dialogue-field="text" data-scene-dialogue-id="${esc(dialogue.id)}" placeholder="输入这句话的英文内容……">${esc(dialogue.text)}</textarea>
  </div>`;
}

function renderAlternatives(notes) {
  const items = notes.alternatives || [];
  return `<div class="scene-note scene-note--alt">
    <div class="scene-note-head"><span>✨</span><strong>可选回答 / 多种表达</strong><em>点击上方对话切换</em></div>
    <div class="scene-alt-list">${items.map((item) => `<div class="scene-alt-row"><span class="scene-alt-dot">•</span><input class="scene-alt-input" data-scene-alt-field="text" data-scene-alt-id="${esc(item.id)}" value="${esc(item.text)}" placeholder="一种可替换的表达"><button type="button" class="scene-note-del" data-action="scene-del-alt" data-scene-alt-id="${esc(item.id)}" title="删除" aria-label="删除表达">×</button></div>`).join('') || '<div class="scene-note-empty">还没有可选表达</div>'}</div>
    <button type="button" class="scene-note-add" data-action="scene-add-alt">+ 添加表达</button>
  </div>`;
}

function renderVocab(notes) {
  const items = notes.vocab || [];
  return `<div class="scene-note">
    <div class="scene-note-head"><span>📗</span><strong>单词 Vocabulary</strong></div>
    <div class="scene-vocab-list">${items.map((item) => `<div class="scene-vocab-row">
      <input class="scene-vocab-word" data-scene-vocab-field="word" data-scene-vocab-id="${esc(item.id)}" value="${esc(item.word)}" placeholder="单词">
      <input class="scene-vocab-phonetic" data-scene-vocab-field="phonetic" data-scene-vocab-id="${esc(item.id)}" value="${esc(item.phonetic)}" placeholder="/音标/">
      <input class="scene-vocab-meaning" data-scene-vocab-field="meaning" data-scene-vocab-id="${esc(item.id)}" value="${esc(item.meaning)}" placeholder="词义">
      <button type="button" class="scene-note-del" data-action="scene-del-vocab" data-scene-vocab-id="${esc(item.id)}" title="删除" aria-label="删除单词">×</button>
    </div>`).join('') || '<div class="scene-note-empty">暂无单词</div>'}</div>
    <button type="button" class="scene-note-add" data-action="scene-add-vocab">+ 添加单词</button>
  </div>`;
}

function renderPhrases(notes) {
  const items = notes.phrases || [];
  return `<div class="scene-note">
    <div class="scene-note-head"><span>🔗</span><strong>短语 Phrases</strong></div>
    <div class="scene-phrase-list">${items.map((item) => `<div class="scene-phrase-row">
      <input class="scene-phrase-text" data-scene-phrase-field="text" data-scene-phrase-id="${esc(item.id)}" value="${esc(item.text)}" placeholder="英文短语">
      <input class="scene-phrase-meaning" data-scene-phrase-field="meaning" data-scene-phrase-id="${esc(item.id)}" value="${esc(item.meaning)}" placeholder="中文含义">
      <button type="button" class="scene-note-del" data-action="scene-del-phrase" data-scene-phrase-id="${esc(item.id)}" title="删除" aria-label="删除短语">×</button>
    </div>`).join('') || '<div class="scene-note-empty">暂无短语</div>'}</div>
    <button type="button" class="scene-note-add" data-action="scene-add-phrase">+ 添加短语</button>
  </div>`;
}

function renderBullets(notes, type, label, icon, addAction, delAction, fieldKey) {
  const items = notes[type] || [];
  return `<div class="scene-note">
    <div class="scene-note-head"><span>${esc(icon)}</span><strong>${esc(label)}</strong></div>
    <div class="scene-bullet-list">${items.map((item) => `<div class="scene-bullet-row">
      <span class="scene-bullet-dot"></span>
      <textarea class="scene-bullet-text" rows="2" data-scene-${fieldKey}-field="text" data-scene-${fieldKey}-id="${esc(item.id)}" placeholder="记录一个知识点……">${esc(item.text)}</textarea>
      <button type="button" class="scene-note-del" data-action="${esc(delAction)}" data-scene-${fieldKey}-id="${esc(item.id)}" title="删除" aria-label="删除">×</button>
    </div>`).join('') || '<div class="scene-note-empty">暂无记录</div>'}</div>
    <button type="button" class="scene-note-add" data-action="${esc(addAction)}">+ 添加一条</button>
  </div>`;
}

function renderNotesPanel(data, dialogue) {
  if (!dialogue) return '<div class="scene-notes-empty">点击左侧任意一条对话，查看并整理它的知识点。</div>';
  const notes = dialogue.notes || emptyNotes();
  return `${renderAlternatives(notes)}${renderVocab(notes)}${renderPhrases(notes)}${renderBullets(notes, 'usage', '口语说明 Usage Notes', '💡', 'scene-add-usage', 'scene-del-usage', 'usage')}${renderBullets(notes, 'grammar', '语法 / 表达 Grammar & Expression', '🧩', 'scene-add-grammar', 'scene-del-grammar', 'grammar')}
  <div class="scene-note scene-note--reflection">
    <div class="scene-note-head"><span>📝</span><strong>我的复盘 Reflection</strong></div>
    <textarea class="scene-reflection" rows="4" data-scene-reflection placeholder="写下这次对话的整体感受、收获和下一步改进……">${esc(data.reflection || '')}</textarea>
  </div>`;
}

function renderAvatarPicker(data, pickerCharId) {
  if (!pickerCharId) return '';
  const character = characterFor(data, pickerCharId);
  const current = character?.avatar || '';
  return `<div class="scene-avatar-picker" data-scene-avatar-picker>
    <div class="scene-avatar-picker-mask" data-action="scene-close-avatar"></div>
    <div class="scene-avatar-picker-panel">
      <div class="scene-avatar-picker-head"><strong>选择头像</strong><span>为「${esc(character?.name || '人物')}」挑选一个头像</span><button type="button" class="scene-avatar-picker-close" data-action="scene-close-avatar" aria-label="关闭">×</button></div>
      <div class="scene-avatar-grid">${AVATAR_LIBRARY.map((avatar) => `<button type="button" class="scene-avatar-option ${avatar === current ? 'selected' : ''}" data-action="scene-pick-avatar" data-avatar="${esc(avatar)}">${esc(avatar)}</button>`).join('')}</div>
    </div>
  </div>`;
}

function renderDialogueBlankRows(charOptions) {
  return Array.from({ length: 3 }, (_, slot) => `<div class="scene-bubble scene-bubble--blank" data-scene-blank-row data-slot="${slot}">
      <div class="scene-bubble-head">
        <span class="scene-bubble-avatar"><i class="ri-user-add-line"></i></span>
        <select class="scene-blank-char" data-scene-blank-char="${slot}" aria-label="选择说话人物">${charOptions}</select>
        <input class="scene-blank-time" data-scene-blank-time="${slot}" type="text" placeholder="10:00" aria-label="时间">
      </div>
      <input class="scene-blank-text" data-scene-blank-text data-slot="${slot}" placeholder="${slot === 0 ? '输入这句话的英文内容，按 Enter 连续添加' : ''}" aria-label="新对话内容">
    </div>`).join('');
}

export function renderEnglishScene(node, pickerCharId = null) {
  const data = node.sceneData;
  const meta = data.meta || {};
  const characters = data.characters || [];
  const dialogue = data.dialogue || [];
  const activeDialogue = dialogueFor(data, data.activeDialogueId) || dialogue[0] || null;
  const charOptions = characters.map((c) => `<option value="${esc(c.id)}">${esc(c.name || '未命名')}</option>`).join('');
  const checklist = data.checklist || [];

  return `<div class="scene" data-scene="english">
    <div class="scene-meta">
      ${renderMetaField('日期', 'date', meta.date, 'date')}
      ${renderMetaField('场景', 'scene', meta.scene)}
      ${renderMetaField('学习目标', 'goal', meta.goal)}
      ${renderMetaField('难点', 'difficulty', meta.difficulty)}
    </div>

    <div class="scene-section">
      <div class="scene-section-head">
        <div class="scene-section-head-title"><span class="scene-dot scene-dot--pink"></span><h3>人物库</h3><p>预设头像与名字，记录对话时直接选择角色。</p></div>
        <button type="button" class="scene-add-btn" data-action="scene-add-char"><i class="ri-add-line"></i> 添加人物</button>
      </div>
      <div class="scene-people">${characters.map((c) => renderCharacterCard(data, c)).join('')}</div>
    </div>

    <div class="scene-cols">
      <div class="scene-col scene-col--dialog">
        <div class="scene-section-head">
          <div class="scene-section-head-title"><span class="scene-dot scene-dot--teal"></span><h3>对话记录</h3><p>点击某条对话，右侧笔记会切到它的知识点。</p></div>
        </div>
        <div class="scene-dialog-list">${dialogue.map((d) => renderDialogueBubble(data, d, d.id === (activeDialogue?.id))).join('')}${renderDialogueBlankRows(charOptions)}</div>
      </div>
      <div class="scene-col scene-col--notes">
        <div class="scene-section-head">
          <div class="scene-section-head-title"><span class="scene-dot scene-dot--green"></span><h3>对话笔记</h3><p>${activeDialogue ? `当前：${esc((characterFor(data, activeDialogue.characterId)?.name) || '未选择')} · ${esc(activeDialogue.time || '')}` : '选择一条对话'}</p></div>
        </div>
        <div class="scene-notes">${renderNotesPanel(data, activeDialogue)}</div>
      </div>
    </div>

    <div class="scene-footer">
      <div class="scene-footer-title">✅ 练习建议 / 下次练习计划</div>
      <div class="scene-checklist">${checklist.map((item) => `<div class="scene-check-row">
        <input type="checkbox" class="scene-check" data-scene-check-id="${esc(item.id)}" ${item.done ? 'checked' : ''} aria-label="勾选完成">
        <input class="scene-check-text" data-scene-check-field="text" data-scene-check-id="${esc(item.id)}" value="${esc(item.text)}" placeholder="练习计划">
        <button type="button" class="scene-note-del" data-action="scene-del-check" data-scene-check-id="${esc(item.id)}" title="删除" aria-label="删除计划">×</button>
      </div>`).join('')}</div>
      <button type="button" class="scene-note-add scene-check-add" data-action="scene-add-check">+ 添加练习计划</button>
    </div>
    ${renderAvatarPicker(data, pickerCharId)}
  </div>`;
}