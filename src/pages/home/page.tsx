import { useEffect } from "react";
import { initPerformanceApp } from "@/performance/app";
import "@/performance/styles.css";
import "@/performance/theme.css";
import "@/performance/notifications.css";
import "@/performance/documents.css";
import "@/performance/projects.css";
import "@/performance/sync-pool.css";
import "@/performance/english-scene.css";

const workbenchMarkup = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">绩</div><div><strong>绩效考核工作台</strong><span>专注绩效 · 驱动成长</span></div><button class="sidebar-toggle" data-action="toggle-sidebar" aria-label="收起侧边栏">‹</button></div>
      <div class="topbar-daily-stats" id="topbar-daily-stats"></div>
      <div class="topbar-right">
        <div class="top-actions">
          <button type="button" class="daily-sync-btn" data-action="open-sync-pool"><i class="ri-refresh-line"></i> 同步到任务池<span class="daily-sync-tooltip">把今日任务、明日计划、本周计划、本月计划一键同步到任务池，同步前会自动校验必填信息。</span></button>
          <div id="topbar-mode-switch"></div>
          <div class="topbar-date-group">
            <i class="ri-calendar-2-line topbar-date-icon"></i>
            <input type="date" id="topbar-date-input" class="topbar-date-input" />
          </div>
          <button class="button ghost topbar-today-btn" data-action="daily-today">回到今天</button>
          <input id="excel-input" type="file" accept=".xlsx,.xls" hidden>
        </div>
      </div>
    </header>
    <div class="shell-body">
      <aside class="sidebar">
        <div>
          <div class="sidebar-head"><span>工作区</span></div>
          <nav class="nav-list">
            <button class="nav-item active" data-tab="daily"><span class="nav-short">日</span><span class="nav-label">每日工作台</span></button>
            <button class="nav-item" data-tab="overview"><span class="nav-short">看</span><span class="nav-label">绩效看板</span></button>
            <button class="nav-item" data-tab="summary"><span class="nav-short">全</span><span class="nav-label">工作全景</span></button>
            <button class="nav-item" data-tab="acceptance"><span class="nav-short">验</span><span class="nav-label">验收工作</span></button>
            <button class="nav-item" data-tab="documents"><span class="nav-short">文</span><span class="nav-label">文档</span></button>
            <button class="nav-item" data-tab="projects"><span class="nav-short">项</span><span class="nav-label">项目</span></button>
            <button class="nav-item" data-tab="chat"><span class="nav-short">聊</span><span class="nav-label">聊天</span></button>
            <button class="nav-item" data-tab="monthly"><span class="nav-short">月</span><span class="nav-label">月度绩效</span></button>
            <button class="nav-item" data-tab="params"><span class="nav-short">参</span><span class="nav-label">参数设置</span></button>
          </nav>
        </div>
        <div class="sidebar-bottom">
          <button class="nav-item sidebar-settings-item" data-tab="settings"><span class="nav-short sidebar-icon-gear"><i class="ri-settings-3-line"></i></span><span class="nav-label">系统设置</span></button>
          <div id="user-switcher" class="sidebar-user-area"></div>
        </div>
      </aside>
      <main class="main-content">
        <div id="toast" class="toast" role="status"></div>
        <section id="view-daily" class="view active"></section>
        <section id="view-overview" class="view"></section>
        <section id="view-summary" class="view"></section>
        <section id="view-acceptance" class="view"></section>
        <section id="view-monthly" class="view"></section>
        <section id="view-params" class="view"></section>
        <section id="view-settings" class="view"></section>
        <section id="view-documents" class="view"></section>
        <section id="view-projects" class="view"></section>
        <section id="view-chat" class="view"></section>
      </main>
    </div>
  </div>
  <dialog id="task-dialog" class="modal"><form id="task-form"><div class="modal-head"><div><span class="eyebrow">任务记录</span><h2 id="task-dialog-title">新增任务</h2></div><button type="button" class="icon-button" data-action="cancel-task" aria-label="关闭">×</button></div><div id="task-form-fields" class="form-grid"></div><div class="modal-foot"><button type="button" class="button ghost" data-action="cancel-task">取消</button><button type="button" class="button primary" data-action="save-task">保存任务</button></div></form></dialog>
  <dialog id="summary-item-dialog" class="modal summary-item-modal"><form id="summary-item-form"><div class="modal-head"><div><span class="summary-dialog-kicker">工作全景</span><h2 id="summary-item-dialog-title">新增事项</h2></div><button type="button" class="icon-button" data-action="cancel-summary-item" aria-label="关闭">×</button></div><div id="summary-item-fields" class="form-grid summary-item-fields"></div><div class="modal-foot"><button type="button" class="button ghost" data-action="cancel-summary-item">取消</button><button type="button" class="button primary" data-action="save-summary-item">保存事项</button></div></form></dialog>
  <dialog id="user-dialog" class="modal user-dialog"><form id="user-form"><div class="modal-head"><div><span class="summary-dialog-kicker">用户工作空间</span><h2 id="user-dialog-title">新建用户</h2></div><button type="button" class="icon-button" data-action="cancel-user" aria-label="关闭">×</button></div><div id="user-form-fields" class="form-grid"></div><div class="modal-foot"><button type="button" class="button ghost" data-action="cancel-user">取消</button><button type="submit" class="button primary">保存用户</button></div></form></dialog>
  <dialog id="template-dialog" class="modal template-dialog"><form id="template-form"><div class="modal-head"><div><span class="summary-dialog-kicker">绩效模板库</span><h2 id="template-dialog-title">新增绩效模板</h2></div><button type="button" class="icon-button" data-action="cancel-assessment-template" aria-label="关闭">×</button></div><div id="template-form-fields" class="template-form-fields"></div><div class="modal-foot"><button type="button" class="button ghost" data-action="cancel-assessment-template">取消</button><button type="submit" class="button primary">保存模板</button></div></form></dialog>
  <dialog id="template-view-dialog" class="modal template-view-dialog"><div class="modal-head"><div><span class="summary-dialog-kicker">绩效模板库</span><h2 id="template-view-title">模板详情</h2></div><button type="button" class="icon-button" data-action="close-template-view" aria-label="关闭">×</button></div><div id="template-view-fields" class="template-view-fields"></div><div class="modal-foot"><button type="button" class="button ghost" data-action="close-template-view">关闭</button><button type="button" class="button primary" id="template-view-edit" data-action="edit-assessment-template" data-template-id="">编辑此模板</button></div></dialog>
  <dialog id="prompt-dialog" class="modal prompt-modal"><form id="prompt-form"><div class="modal-head"><div><h2 id="prompt-dialog-title">输入</h2></div><button type="button" class="icon-button" data-action="close-prompt" aria-label="关闭">×</button></div><div class="form-grid"><label class="form-field full"><span class="label" id="prompt-dialog-label">内容</span><input class="input" id="prompt-dialog-input" name="value" type="text" required></label></div><div class="modal-foot"><button type="button" class="button ghost" data-action="close-prompt">取消</button><button type="submit" class="button primary">确定</button></div></form></dialog>
  <dialog id="confirm-dialog" class="modal confirm-modal"><div class="modal-head"><div><h2 id="confirm-dialog-title">确认</h2></div><button type="button" class="icon-button" data-action="close-confirm" aria-label="关闭">×</button></div><div class="form-grid" style="padding-bottom:0"><p id="confirm-dialog-message" style="margin:0;font-size:14px;line-height:1.6"></p></div><div class="modal-foot"><button type="button" class="button ghost" data-action="close-confirm">取消</button><button type="button" class="button primary" data-action="confirm-yes">确定</button></div></dialog>
  <dialog id="project-dialog" class="modal project-dialog"><form id="project-form"><div class="modal-head"><div><span class="summary-dialog-kicker">项目管理</span><h2 id="project-dialog-title">新建项目</h2></div><button type="button" class="icon-button" data-action="cancel-project" aria-label="关闭">×</button></div><div id="project-form-fields" class="form-grid"></div><div class="modal-foot"><button type="button" class="button ghost" data-action="cancel-project">取消</button><button type="submit" class="button primary">保存项目</button></div></form></dialog>
  <dialog id="link-tasks-dialog" class="modal link-tasks-dialog"><div class="modal-head"><div><span class="summary-dialog-kicker">项目管理</span><h2 id="link-tasks-dialog-title">关联任务</h2></div><button type="button" class="icon-button" data-action="close-link-tasks" aria-label="关闭">×</button></div><div id="link-tasks-list" class="link-tasks-list"></div><div class="modal-foot"><button type="button" class="button primary" data-action="close-link-tasks">完成</button></div></dialog>
  <dialog id="sync-pool-dialog" class="modal sync-pool-dialog"><div class="modal-head"><div><span class="summary-dialog-kicker">每日工作台</span><h2>同步到任务池</h2></div><button type="button" class="icon-button" data-action="close-sync-pool" aria-label="关闭">×</button></div><div id="sync-pool-body"></div><div class="modal-foot"><button type="button" class="button ghost" data-action="close-sync-pool">取消</button><button type="button" class="button primary" data-action="sync-pool-confirm">同步到任务池</button></div></dialog>
  <dialog id="doc-template-dialog" class="modal doc-template-dialog"><div class="modal-head"><div><span class="summary-dialog-kicker">文档模板库</span><h2>选择模板 · 新建文档</h2></div><button type="button" class="icon-button" data-action="close-doc-template" aria-label="关闭">×</button></div><div id="doc-template-body"></div><div class="modal-foot"><span class="doc-template-foot-hint">选择模板后会创建一篇新文档，内容可以自由编辑。</span><button type="button" class="button ghost" data-action="close-doc-template">取消</button></div></dialog>
  <div id="mention-menu-wrapper" style="position:fixed;z-index:300;"></div>
`;

export default function Home() {
  useEffect(() => {
    initPerformanceApp();
  }, []);

  return (
    <div dangerouslySetInnerHTML={{ __html: workbenchMarkup }} />
  );
}