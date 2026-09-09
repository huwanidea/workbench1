# 绩效考核工作台 · 项目模块升级计划

## 1. 项目描述
「绩效考核工作台」是一款面向团队/个人的绩效与项目管理工具。当前「项目」模块已具备：项目信息管理、里程碑 + 任务两级拆解、任务分配（负责人/验收人）、任务打通（同步任务池 + 记入绩效）。
本轮目标是参考成熟的 PM 工具（ONES/Worktile 风格），把「项目」模块从「可用的拆解器」升级为「可落地的项目管理中枢」：项目中心仪表盘、树状任务拆解、前置任务与优先级、任务详情面板（交付物/执行要求/验收标准/动态）、SOP 模板化生成项目。

## 2. 页面结构
- `src/pages/home/page.tsx` — 绩效考核工作台主界面（左侧工作区导航，含「项目」）
- `src/performance/projects.js` — 项目模块渲染
- `src/performance/projects.css` — 项目模块样式
- `src/performance/app.js` — 主逻辑（数据操作、事件处理）
- `src/performance/calc.js` — 数据模型归一化（normalizeState）

## 3. 核心功能清单
- [ ] 项目中心：统计卡片（项目总数/进行中/待验收任务/风险项目）、待我关注/即将到期
- [ ] 项目列表增强：阶段、状态、负责人、成员、进度、截止日期、风险等级、筛选/排序
- [ ] 项目详情：概览 / 任务 / SOP / 验收 / 文档 / 成员 / 动态 多标签页
- [x] 树状任务拆解：任务层级树 + 分组里程碑，负责人/验收人/进度/截止/前置任务/优先级
- [x] 任务详情面板：基本信息、前置任务、执行要求、交付物、验收标准、动态与评论、发布/提交验收
- [x] 项目 SOP 模板：节点执行流程（输入/执行/输出/验收/下一步）、默认角色与工期、由模板生成项目
- [x] 风险与阻塞：任务阻塞标记、项目风险等级

## 4. 数据模型设计
当前为浏览器本地存储（localStorage），数据结构经 `calc.js normalizeState` 归一化。项目（projects）包含：
- 项目字段：name、description、stage（阶段）、status（状态）、owner、members、deadline、risk、milestones、templates
- 里程碑（milestone）：name、status、deadline、owner、acceptors、desc、tasks[]
- 任务（task）：name、status、owner、acceptors、progress、deadline、priority、predecessors（前置任务）、requirement（执行要求）、deliverables（交付物）、acceptance（验收标准）、comments（动态）
- SOP 模板（template）：name、scene、defaultRoles、standardDuration、nodes[]、node 字段（input/action/output/acceptance/next）

## 5. 后端 / 第三方集成计划
- 数据库：当前不使用。全部数据暂存浏览器 localStorage。若后续要求「换设备同步 / 多人协作」，需接入 Readdy Backend 或 SaaS Supabase（`<action>connect_supabase</action>`），届时再迁移数据模型到数据表。
- Shopify / Stripe：不涉及，本项目无电商需求。

## 6. 分阶段开发计划

### 阶段 A：项目中心仪表盘（已完成）
- 目标：把「项目」列表页升级为统计型项目中心
- 交付：顶部统计卡片（项目总数/进行中/待验收任务/风险项目）、待我关注/即将到期、筛选/排序/看板视图切换、项目列表新增阶段/成员/风险列

### 阶段 B：树状任务拆解 + 任务详情面板（已完成）
- 目标：把里程碑/任务升级为可展开的树状结构，并加任务详情侧栏
- 交付：任务树（分组 + 缩进层级）、前置任务、优先级、打开任务详情面板（基本信息/前置任务/执行要求/交付物/验收标准/动态评论）

### 阶段 C：SOP 模板化生成项目（已完成）
- 目标：把「从项目模板生成项目」落地
- 交付：模板管理（名称/场景/默认角色/工期）、节点执行流程（输入/执行/输出/验收/下一步）、由模板批量生成项目结构

### 阶段 D：风险与阻塞、验收增强（已完成）
- 目标：完善质量闭环
- 交付：任务阻塞标记（阻塞开关 + 原因）、项目风险等级增强（阻塞计入风险 + 手动覆盖 + 风险构成面板）、验收工作按项目聚合（任务池 + 项目任务分组验收，支持通过/退回）

## 7. 备注
- 每个阶段完成需构建验证（build_project_check），并等用户确认后再进入下一阶段
- 变更需求时及时更新本文档