/* eslint-disable */
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

export const DOC_TEMPLATE_CATEGORIES = [
  { key: 'all', label: '全部模板' },
  { key: 'work', label: '工作汇报' },
  { key: 'language', label: '语言学习' },
  { key: 'study', label: '学习笔记' },
  { key: 'plan', label: '目标规划' },
];

const ENGLISH_SCENE_BODY = `
<div class="doc-tpl doc-tpl--english">
  <div class="doc-tpl-hero">
    <div class="doc-tpl-hero-badge">📖</div>
    <div class="doc-tpl-hero-text">
      <h2>场景对话学习复盘</h2>
      <p>记录真实场景对话，整理学习笔记，定期复盘，持续提升口语表达能力。</p>
    </div>
  </div>
  <div class="doc-tpl-meta">
    <div class="doc-tpl-meta-item"><span>日期</span><strong>2025-04-24</strong></div>
    <div class="doc-tpl-meta-item"><span>场景</span><strong>咖啡店点餐 (At a Coffee Shop)</strong></div>
    <div class="doc-tpl-meta-item"><span>学习目标</span><strong>熟悉点餐流程，练习日常交流表达</strong></div>
    <div class="doc-tpl-meta-item"><span>难点</span><strong>饮品尺寸、特殊需求的表达</strong></div>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head">
      <h3><span class="doc-tpl-dot"></span>人物库（可自定义）</h3>
      <p>预设头像与名字，记录时直接选择角色。你可以根据不同场景自定义人物，打造专属对话练习。</p>
    </div>
    <div class="doc-tpl-people">
      <div class="doc-tpl-person"><span class="doc-tpl-avatar">👩</span><div><strong>店员</strong><small>咖啡店店员</small></div></div>
      <div class="doc-tpl-person"><span class="doc-tpl-avatar">🧑</span><div><strong>我</strong><small>对话学习者</small></div></div>
      <div class="doc-tpl-person"><span class="doc-tpl-avatar">👧</span><div><strong>朋友</strong><small>同行的朋友</small></div></div>
      <div class="doc-tpl-person"><span class="doc-tpl-avatar">👮</span><div><strong>乘务员</strong><small>飞机乘务员</small></div></div>
    </div>
  </div>

  <div class="doc-tpl-cols">
    <div class="doc-tpl-col">
      <div class="doc-tpl-section-head">
        <h3><span class="doc-tpl-dot doc-tpl-dot--blue"></span>对话记录</h3>
        <p>在这里记录完整的对话过程。可以从人物库中选择角色，或直接输入对话内容。</p>
      </div>
      <div class="doc-tpl-dialog">
        <div class="doc-tpl-dialog-line">
          <span class="doc-tpl-avatar sm">👩</span>
          <div class="doc-tpl-bubble">
            <div class="doc-tpl-dialog-role">店员</div>
            <div class="doc-tpl-dialog-text">Hi! Welcome to our coffee shop. What can I get for you?</div>
            <div class="doc-tpl-dialog-time">10:00</div>
          </div>
        </div>
        <div class="doc-tpl-dialog-line self">
          <span class="doc-tpl-avatar sm">🧑</span>
          <div class="doc-tpl-bubble">
            <div class="doc-tpl-dialog-role">我</div>
            <div class="doc-tpl-dialog-text">I'd like a large latte, please.</div>
            <div class="doc-tpl-dialog-time">10:01</div>
          </div>
        </div>
        <div class="doc-tpl-answers">
          <div class="doc-tpl-answers-head">✨ 可选回答 / 多种表达 <em>（点击选择或参考使用）</em></div>
          <ol>
            <li>I'd like a large latte, please. <small>（我想要一杯大杯拿铁。）</small></li>
            <li>Can I get a large latte? <small>（我可以要一杯大杯拿铁吗？）</small></li>
            <li>Could I have a large latte, please? <small>（我能要一杯大杯拿铁吗？）</small></li>
          </ol>
        </div>
        <div class="doc-tpl-dialog-line">
          <span class="doc-tpl-avatar sm">👩</span>
          <div class="doc-tpl-bubble">
            <div class="doc-tpl-dialog-role">店员</div>
            <div class="doc-tpl-dialog-text">Sure! Would you like it hot or iced?</div>
            <div class="doc-tpl-dialog-time">10:02</div>
          </div>
        </div>
        <div class="doc-tpl-dialog-line self">
          <span class="doc-tpl-avatar sm">🧑</span>
          <div class="doc-tpl-bubble">
            <div class="doc-tpl-dialog-role">我</div>
            <div class="doc-tpl-dialog-text">Iced, please. And can I get an extra shot of espresso?</div>
            <div class="doc-tpl-dialog-time">10:03</div>
          </div>
        </div>
        <div class="doc-tpl-dialog-line">
          <span class="doc-tpl-avatar sm">👩</span>
          <div class="doc-tpl-bubble">
            <div class="doc-tpl-dialog-role">店员</div>
            <div class="doc-tpl-dialog-text">No problem. Anything else?</div>
            <div class="doc-tpl-dialog-time">10:04</div>
          </div>
        </div>
        <div class="doc-tpl-dialog-line self">
          <span class="doc-tpl-avatar sm">🧑</span>
          <div class="doc-tpl-bubble">
            <div class="doc-tpl-dialog-role">我</div>
            <div class="doc-tpl-dialog-text">That's all. How much is it?</div>
            <div class="doc-tpl-dialog-time">10:04</div>
          </div>
        </div>
        <div class="doc-tpl-dialog-line">
          <span class="doc-tpl-avatar sm">👩</span>
          <div class="doc-tpl-bubble">
            <div class="doc-tpl-dialog-role">店员</div>
            <div class="doc-tpl-dialog-text">It's $5.50.</div>
            <div class="doc-tpl-dialog-time">10:05</div>
          </div>
        </div>
        <div class="doc-tpl-dialog-line self">
          <span class="doc-tpl-avatar sm">🧑</span>
          <div class="doc-tpl-bubble">
            <div class="doc-tpl-dialog-role">我</div>
            <div class="doc-tpl-dialog-text">Great, I'll pay by card. Thank you!</div>
            <div class="doc-tpl-dialog-time">10:05</div>
          </div>
        </div>
      </div>
    </div>

    <div class="doc-tpl-col">
      <div class="doc-tpl-section-head">
        <h3><span class="doc-tpl-dot doc-tpl-dot--green"></span>对话笔记（可展开 / 收起）</h3>
        <p>整理重点知识，加深理解，便于后续复习。</p>
      </div>
      <div class="doc-tpl-note">
        <div class="doc-tpl-note-head"><span>📗</span><strong>单词 Vocabulary</strong></div>
        <ul class="doc-tpl-vocab">
          <li><b>latte</b><i>/ˈlɑːteɪ/</i><span>n. 拿铁</span></li>
          <li><b>espresso</b><i>/eˈspresəʊ/</i><span>n. 浓缩咖啡</span></li>
          <li><b>iced</b><i>/aɪst/</i><span>adj. 加冰的；冰的</span></li>
          <li><b>shot</b><i>/ʃɒt/</i><span>n.（一小份）</span></li>
          <li><b>card</b><i>/kɑːd/</i><span>n. 信用卡；卡</span></li>
          <li><b>size</b><i>/saɪz/</i><span>n. 尺寸；大小</span></li>
        </ul>
      </div>
      <div class="doc-tpl-note">
        <div class="doc-tpl-note-head"><span>🔗</span><strong>短语 Phrases</strong></div>
        <ul class="doc-tpl-phrases">
          <li><b>What can I get for you?</b><span>我能为你点什么？</span></li>
          <li><b>I'd like ..., please.</b><span>我想要……</span></li>
          <li><b>Would you like ...?</b><span>你想要……吗？</span></li>
          <li><b>Hot or iced?</b><span>热的还是冰的？</span></li>
          <li><b>An extra shot.</b><span>加一份浓缩。</span></li>
          <li><b>Pay by card.</b><span>用卡支付。</span></li>
        </ul>
      </div>
      <div class="doc-tpl-note">
        <div class="doc-tpl-note-head"><span>💡</span><strong>口语说明 Usage Notes</strong></div>
        <ul class="doc-tpl-bullets">
          <li>“I'd like ...” 是非常常用且礼貌的点餐表达，适用于大多数场合。</li>
          <li>可以根据个人口味选择饮品尺寸（small / medium / large）。</li>
          <li>表达额外需求时，常用 “an extra shot”“less sugar”“non-dairy milk” 等。</li>
        </ul>
      </div>
      <div class="doc-tpl-note">
        <div class="doc-tpl-note-head"><span>🧩</span><strong>语法 / 表达 Grammar &amp; Expression</strong></div>
        <ul class="doc-tpl-bullets">
          <li>“Would you like ...?” 是服务行业中常见的询问句式，语气友好、礼貌。</li>
          <li>“I'd like ...” 与 “I want ...” 意思相近，但前者更礼貌，适合正式或公共场合。</li>
          <li>“Can I get ...?” / “Could I have ...?” 都是常用的点餐表达，Could 更加礼貌。</li>
        </ul>
      </div>
      <div class="doc-tpl-note">
        <div class="doc-tpl-note-head"><span>📝</span><strong>我的复盘 Reflection</strong></div>
        <ul class="doc-tpl-bullets">
          <li>这次对话整体比较顺利，基本掌握了点餐的核心表达。</li>
          <li>需要多练习饮品尺寸、特殊需求的表达方法，比如脱脂奶、少糖等。</li>
          <li>下次可以尝试加入更多细节表达，例如询问甜度、替换牛奶种类等，提升表达的丰富性。</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="doc-tpl-footer">
    <div class="doc-tpl-footer-title">✅ 练习建议 / 下次练习计划</div>
    <div class="doc-tpl-checklist">
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☐</span><span class="novel-todo-text">尝试不同的饮品点单表达</span></div>
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☐</span><span class="novel-todo-text">练习更多相关场景（如餐厅、超市、酒店等）</span></div>
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☐</span><span class="novel-todo-text">复习本次生词和短语</span></div>
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☐</span><span class="novel-todo-text">进行角色扮演练习</span></div>
    </div>
  </div>
</div>`;

const DAILY_REVIEW_BODY = `
<div class="doc-tpl">
  <div class="doc-tpl-hero">
    <div class="doc-tpl-hero-badge">📋</div>
    <div class="doc-tpl-hero-text">
      <h2>每日工作复盘</h2>
      <p>记录今天做了什么、结果如何、明天如何改进，让每天的投入都留下痕迹。</p>
    </div>
  </div>
  <div class="doc-tpl-meta">
    <div class="doc-tpl-meta-item"><span>日期</span><strong>2025-04-24</strong></div>
    <div class="doc-tpl-meta-item"><span>投入工时</span><strong>8.0 h</strong></div>
    <div class="doc-tpl-meta-item"><span>整体完成度</span><strong>80%</strong></div>
    <div class="doc-tpl-meta-item"><span>今日状态</span><strong>专注 / 良好</strong></div>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot"></span>今日完成</h3><p>列出完成的关键事项，勾选表示已收尾。</p></div>
    <div class="doc-tpl-checklist">
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☑</span><span class="novel-todo-text">完成季度报表自动化脚本，已提交测试</span></div>
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☑</span><span class="novel-todo-text">与产品对齐下个迭代需求范围</span></div>
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☐</span><span class="novel-todo-text">整理客户反馈并输出分类清单</span></div>
    </div>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot doc-tpl-dot--blue"></span>关键结果</h3></div>
    <ul class="doc-tpl-bullets">
      <li>报表脚本将原本 2 小时的手工整理压缩到 5 分钟，效率提升明显。</li>
      <li>需求范围比预期更大，评估后建议拆成两个迭代交付。</li>
    </ul>
  </div>

  <div class="doc-tpl-cols">
    <div class="doc-tpl-note">
      <div class="doc-tpl-note-head"><span>🚧</span><strong>问题与阻塞</strong></div>
      <ul class="doc-tpl-bullets">
        <li>测试环境数据不完整，部分边界情况无法验证。</li>
        <li>等待负责人确认反馈优先级。</li>
      </ul>
    </div>
    <div class="doc-tpl-note">
      <div class="doc-tpl-note-head"><span>🌱</span><strong>改进与收获</strong></div>
      <ul class="doc-tpl-bullets">
        <li>提前约定交付口径，可以减少返工。</li>
        <li>把重复操作沉淀成脚本，长期收益更大。</li>
      </ul>
    </div>
  </div>

  <div class="doc-tpl-footer">
    <div class="doc-tpl-footer-title">🔜 明日计划</div>
    <div class="doc-tpl-checklist">
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☐</span><span class="novel-todo-text">完成客户反馈清单并同步负责人</span></div>
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☐</span><span class="novel-todo-text">补齐测试数据，开始边界用例验证</span></div>
    </div>
  </div>
</div>`;

const MEETING_NOTES_BODY = `
<div class="doc-tpl">
  <div class="doc-tpl-hero">
    <div class="doc-tpl-hero-badge">🗂️</div>
    <div class="doc-tpl-hero-text">
      <h2>会议纪要</h2>
      <p>把讨论重点、结论和待办集中记下来，会后一眼看清谁在什么时候做什么。</p>
    </div>
  </div>
  <div class="doc-tpl-meta">
    <div class="doc-tpl-meta-item"><span>会议主题</span><strong>Q2 版本规划评审</strong></div>
    <div class="doc-tpl-meta-item"><span>时间</span><strong>2025-04-24 14:00 - 15:00</strong></div>
    <div class="doc-tpl-meta-item"><span>地点 / 形式</span><strong>线上 · 腾讯会议</strong></div>
    <div class="doc-tpl-meta-item"><span>主持 / 记录</span><strong>张三 / 李四</strong></div>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot"></span>参与人员</h3></div>
    <div class="doc-tpl-people">
      <div class="doc-tpl-person"><span class="doc-tpl-avatar">🧑</span><div><strong>张三</strong><small>产品负责人</small></div></div>
      <div class="doc-tpl-person"><span class="doc-tpl-avatar">👩</span><div><strong>李四</strong><small>研发负责人</small></div></div>
      <div class="doc-tpl-person"><span class="doc-tpl-avatar">🧔</span><div><strong>王五</strong><small>测试负责人</small></div></div>
    </div>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot doc-tpl-dot--blue"></span>议题与讨论要点</h3></div>
    <ul class="doc-tpl-bullets">
      <li><strong>议题一：Q2 版本范围</strong> — 优先保障核心流程稳定性，非关键需求延后。</li>
      <li><strong>议题二：交付节奏</strong> — 采用双周迭代，每个迭代留出 2 天回归测试。</li>
      <li><strong>议题三：风险把控</strong> — 第三方接口不稳定，需要提前准备降级方案。</li>
    </ul>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot doc-tpl-dot--green"></span>结论与决议</h3></div>
    <ul class="doc-tpl-bullets">
      <li>Q2 版本范围以「核心流程稳定 + 数据准确性」为主线。</li>
      <li>双周迭代节奏正式确定，本周内出详细排期。</li>
    </ul>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot"></span>待办事项</h3></div>
    <table class="doc-tpl-table">
      <thead><tr><th>事项</th><th>负责人</th><th>截止</th></tr></thead>
      <tbody>
        <tr><td>输出 Q2 详细排期表</td><td>李四</td><td>04-26</td></tr>
        <tr><td>整理第三方接口降级方案</td><td>王五</td><td>04-28</td></tr>
        <tr><td>同步版本范围给相关团队</td><td>张三</td><td>04-25</td></tr>
      </tbody>
    </table>
  </div>
</div>`;

const WEEKLY_REPORT_BODY = `
<div class="doc-tpl">
  <div class="doc-tpl-hero">
    <div class="doc-tpl-hero-badge">📈</div>
    <div class="doc-tpl-hero-text">
      <h2>项目周报</h2>
      <p>用一页说清本周进展、数据和风险，让协作方快速对齐。</p>
    </div>
  </div>
  <div class="doc-tpl-meta">
    <div class="doc-tpl-meta-item"><span>报告周期</span><strong>2025-04-21 ~ 04-25</strong></div>
    <div class="doc-tpl-meta-item"><span>项目名称</span><strong>销售系统重构</strong></div>
    <div class="doc-tpl-meta-item"><span>负责人</span><strong>李四</strong></div>
    <div class="doc-tpl-meta-item"><span>整体状态</span><strong>正常推进 · 进度 72%</strong></div>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot"></span>本周目标与完成情况</h3></div>
    <table class="doc-tpl-table">
      <thead><tr><th>目标</th><th>完成度</th><th>状态</th></tr></thead>
      <tbody>
        <tr><td>完成订单模块重构</td><td>100%</td><td>已完成</td></tr>
        <tr><td>核心接口性能优化</td><td>80%</td><td>进行中</td></tr>
        <tr><td>补充单元测试覆盖</td><td>60%</td><td>进行中</td></tr>
      </tbody>
    </table>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot doc-tpl-dot--blue"></span>关键数据</h3></div>
    <div class="doc-tpl-stats">
      <div class="doc-tpl-stat"><strong>72%</strong><span>整体进度</span></div>
      <div class="doc-tpl-stat"><strong>1.2s → 0.4s</strong><span>接口响应耗时</span></div>
      <div class="doc-tpl-stat"><strong>86%</strong><span>测试覆盖率</span></div>
    </div>
  </div>

  <div class="doc-tpl-cols">
    <div class="doc-tpl-note">
      <div class="doc-tpl-note-head"><span>⚠️</span><strong>风险与问题</strong></div>
      <ul class="doc-tpl-bullets">
        <li>上游数据接口偶发超时，可能影响联调进度。</li>
        <li>测试资源紧张，回归用例排期偏紧。</li>
      </ul>
    </div>
    <div class="doc-tpl-note">
      <div class="doc-tpl-note-head"><span>🔜</span><strong>下周计划</strong></div>
      <ul class="doc-tpl-bullets">
        <li>完成接口性能优化并上线灰度验证。</li>
        <li>补齐核心链路单元测试，覆盖率提升到 90%。</li>
      </ul>
    </div>
  </div>
</div>`;

const READING_NOTES_BODY = `
<div class="doc-tpl">
  <div class="doc-tpl-hero">
    <div class="doc-tpl-hero-badge">📚</div>
    <div class="doc-tpl-hero-text">
      <h2>读书笔记</h2>
      <p>记录核心观点、金句与自己的思考，把读过的书真正变成自己的东西。</p>
    </div>
  </div>
  <div class="doc-tpl-meta">
    <div class="doc-tpl-meta-item"><span>书名</span><strong>《原则》</strong></div>
    <div class="doc-tpl-meta-item"><span>作者</span><strong>瑞·达利欧</strong></div>
    <div class="doc-tpl-meta-item"><span>阅读进度</span><strong>第 3 章 / 共 8 章</strong></div>
    <div class="doc-tpl-meta-item"><span>推荐指数</span><strong>★★★★☆</strong></div>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot"></span>核心观点</h3></div>
    <ul class="doc-tpl-bullets">
      <li>用系统化的原则代替情绪化决策，才能持续进步。</li>
      <li>痛苦 + 反思 = 进步，把问题当作学习和改进的机会。</li>
      <li>极度求真与极度透明，是高效协作的基础。</li>
    </ul>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot doc-tpl-dot--blue"></span>金句摘录</h3></div>
    <blockquote>如果你不觉得一年前的自己是个蠢货，说明你这一年没学到什么新东西。</blockquote>
    <blockquote>拥抱现实，应对现实。梦想 + 现实 + 决心 = 成功的生活。</blockquote>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot doc-tpl-dot--green"></span>我的思考</h3></div>
    <ul class="doc-tpl-bullets">
      <li>把工作中反复出现的问题，沉淀成可以复用的原则清单。</li>
      <li>在团队里尝试更坦诚地复盘，而不是回避冲突。</li>
    </ul>
  </div>

  <div class="doc-tpl-footer">
    <div class="doc-tpl-footer-title">✅ 读完后的行动清单</div>
    <div class="doc-tpl-checklist">
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☐</span><span class="novel-todo-text">整理一份个人工作原则清单</span></div>
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☐</span><span class="novel-todo-text">在下一次复盘中实践「痛苦 + 反思」</span></div>
    </div>
  </div>
</div>`;

const OKR_BODY = `
<div class="doc-tpl">
  <div class="doc-tpl-hero">
    <div class="doc-tpl-hero-badge">🎯</div>
    <div class="doc-tpl-hero-text">
      <h2>OKR 目标拆解</h2>
      <p>把一个大目标拆成可衡量的关键结果，再用关键举措一步步逼近它。</p>
    </div>
  </div>
  <div class="doc-tpl-meta">
    <div class="doc-tpl-meta-item"><span>周期</span><strong>2025 Q2</strong></div>
    <div class="doc-tpl-meta-item"><span>负责人</span><strong>李四</strong></div>
    <div class="doc-tpl-meta-item"><span>整体进度</span><strong>45%</strong></div>
    <div class="doc-tpl-meta-item"><span>信心指数</span><strong>7 / 10</strong></div>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot"></span>O · 目标</h3></div>
    <p class="doc-tpl-goal">让核心业务系统的稳定性与交付效率显著提升，支撑 Q2 业务扩张。</p>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot doc-tpl-dot--blue"></span>KR · 关键结果</h3><p>可量化、可验证。</p></div>
    <table class="doc-tpl-table">
      <thead><tr><th>关键结果</th><th>目标值</th><th>当前</th><th>进度</th></tr></thead>
      <tbody>
        <tr><td>核心接口 P95 响应耗时</td><td>&lt; 400ms</td><td>620ms</td><td>55%</td></tr>
        <tr><td>线上故障数（月度）</td><td>&lt; 2 起</td><td>3 起</td><td>40%</td></tr>
        <tr><td>迭代按时交付率</td><td>≥ 95%</td><td>88%</td><td>70%</td></tr>
      </tbody>
    </table>
  </div>

  <div class="doc-tpl-section">
    <div class="doc-tpl-section-head"><h3><span class="doc-tpl-dot doc-tpl-dot--green"></span>关键举措</h3></div>
    <ul class="doc-tpl-bullets">
      <li>引入接口性能监控与自动告警。</li>
      <li>建立迭代复盘机制，持续优化排期准确度。</li>
      <li>补齐核心链路自动化测试，减少回归人力。</li>
    </ul>
  </div>

  <div class="doc-tpl-footer">
    <div class="doc-tpl-footer-title">🧭 复盘检查点</div>
    <div class="doc-tpl-checklist">
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☐</span><span class="novel-todo-text">每月末对照 KR 更新进度</span></div>
      <div class="novel-todo"><span class="novel-todo-checkbox" contenteditable="false">☐</span><span class="novel-todo-text">识别偏离的 KR 并调整举措</span></div>
    </div>
  </div>
</div>`;

export const DOCUMENT_TEMPLATES = [
  {
    id: 'english-scene-dialogue',
    name: '英语场景对话学习复盘',
    category: 'language',
    categoryLabel: '语言学习',
    icon: '🌍',
    tint: '#fdeef2',
    title: '场景对话学习复盘',
    desc: '交互式学习工具：预设人物库与头像库，逐条记录对话，点击每条对话切换对应的单词、短语、口语与语法笔记。',
    body: ENGLISH_SCENE_BODY,
  },
  {
    id: 'daily-work-review',
    name: '每日工作复盘',
    category: 'work',
    categoryLabel: '工作汇报',
    icon: '📋',
    tint: '#eef7f4',
    title: '每日工作复盘',
    desc: '记录今日完成、关键结果、问题阻塞与明日计划，适合每天收尾时写。',
    body: DAILY_REVIEW_BODY,
  },
  {
    id: 'meeting-notes',
    name: '会议纪要',
    category: 'work',
    categoryLabel: '工作汇报',
    icon: '🗂️',
    tint: '#fbf4ea',
    title: '会议纪要',
    desc: '包含参与人、议题要点、结论决议与待办分工，开完会即可直接发。',
    body: MEETING_NOTES_BODY,
  },
  {
    id: 'project-weekly-report',
    name: '项目周报',
    category: 'work',
    categoryLabel: '工作汇报',
    icon: '📈',
    tint: '#eef7f4',
    title: '项目周报',
    desc: '用一页讲清本周目标完成度、关键数据、风险问题与下周计划。',
    body: WEEKLY_REPORT_BODY,
  },
  {
    id: 'reading-notes',
    name: '读书笔记',
    category: 'study',
    categoryLabel: '学习笔记',
    icon: '📚',
    tint: '#fbf4ea',
    title: '读书笔记',
    desc: '记录核心观点、金句摘录、个人思考与读完后的行动清单。',
    body: READING_NOTES_BODY,
  },
  {
    id: 'okr-breakdown',
    name: 'OKR 目标拆解',
    category: 'plan',
    categoryLabel: '目标规划',
    icon: '🎯',
    tint: '#fdeef2',
    title: 'OKR 目标拆解',
    desc: '把大目标拆成可衡量的关键结果，配上关键举措与复盘检查点。',
    body: OKR_BODY,
  },
];

export function documentTemplateFor(id) {
  return DOCUMENT_TEMPLATES.find((template) => template.id === id) || null;
}

function renderTemplateCard(template) {
  return `<article class="doc-template-card">
    <div class="doc-template-card-top">
      <span class="doc-template-icon" style="background:${esc(template.tint)}">${esc(template.icon)}</span>
      <span class="doc-template-cat">${esc(template.categoryLabel)}</span>
    </div>
    <h3>${esc(template.name)}</h3>
    <p>${esc(template.desc)}</p>
    <button type="button" class="doc-template-use" data-action="use-doc-template" data-template-id="${esc(template.id)}"><i class="ri-magic-line"></i> 使用此模板</button>
  </article>`;
}

export function renderDocTemplateGallery(activeCategory = 'all') {
  const categories = DOC_TEMPLATE_CATEGORIES.map((category) => `<button type="button" class="${category.key === activeCategory ? 'active' : ''}" data-action="doc-template-category" data-category="${esc(category.key)}">${esc(category.label)}</button>`).join('');
  const list = activeCategory === 'all' ? DOCUMENT_TEMPLATES : DOCUMENT_TEMPLATES.filter((template) => template.category === activeCategory);
  const cards = list.length ? list.map(renderTemplateCard).join('') : '<div class="doc-template-empty">该分类下暂无模板</div>';
  return `<div class="doc-template-filter">${categories}</div><div class="doc-template-gallery">${cards}</div>`;
}