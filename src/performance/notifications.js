/* eslint-disable */
export const NOTIFICATION_TYPES = {
  MENTION: 'mention',
  CHAT: 'chat',
  SYSTEM: 'system',
  OVERDUE: 'overdue',
  DEADLINE: 'deadline',
  DAILY_REMINDER: 'daily-reminder',
  REVIEWER: 'reviewer',
  REWORK: 'rework',
};

export function createNotification(fromUser, toUserId, type, payload) {
  return {
    id: crypto.randomUUID(),
    type,
    fromUserId: fromUser?.id || '',
    fromUserName: fromUser?.name || '',
    read: false,
    createdAt: new Date().toISOString(),
    ...payload,
  };
}

export function createMessage(fromUser, toUserId, content) {
  return {
    id: crypto.randomUUID(),
    fromUserId: fromUser?.id || '',
    fromUserName: fromUser?.name || '',
    toUserId,
    content: String(content || '').trim(),
    read: false,
    createdAt: new Date().toISOString(),
  };
}

export function parseMentions(html) {
  const mentions = [];
  if (!html) return mentions;
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('[data-mention-user]').forEach((el) => {
    mentions.push({
      userId: el.dataset.mentionUser,
      userName: el.textContent.replace(/^@/, '').trim(),
    });
  });
  return mentions;
}

export function renderNotificationBell(state) {
  const notifications = state.notifications || [];
  const unread = notifications.filter((n) => !n.read).length;
  return `<button class="topbar-icon-btn" data-action="toggle-notifications" title="通知" aria-label="通知">
    <i class="ri-notification-3-line"></i>
    ${unread > 0 ? `<span class="topbar-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
  </button>`;
}

export function renderChatButton() {
  return `<button class="topbar-icon-btn" data-action="toggle-chat" title="协作沟通" aria-label="协作沟通">
    <i class="ri-message-3-line"></i>
  </button>`;
}

export function renderNotificationPanel(state) {
  const notifications = [...(state.notifications || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unread = notifications.filter((n) => !n.read).length;

  if (!notifications.length) {
    return `<div class="notification-panel" id="notification-panel">
      <div class="notification-panel-head">
        <strong>通知</strong>
        <button class="notification-close" data-action="close-notifications" aria-label="关闭">×</button>
      </div>
      <div class="notification-panel-body">
        <div class="notification-empty"><i class="ri-notification-3-line"></i><p>暂无通知</p></div>
      </div>
    </div>`;
  }

  return `<div class="notification-panel" id="notification-panel">
    <div class="notification-panel-head">
      <strong>通知</strong>
      <span class="notification-subtitle">${unread > 0 ? `${unread} 条未读` : '全部已读'}</span>
      <div class="notification-panel-actions">
        <button class="link-button" data-action="mark-all-read">全部已读</button>
        <button class="notification-close" data-action="close-notifications" aria-label="关闭">×</button>
      </div>
    </div>
    <div class="notification-panel-body">
      ${notifications.map((n) => {
        const time = new Date(n.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const meta = notificationMeta(n);
        return `<div class="notification-item ${n.read ? 'read' : 'unread'}" data-notification-id="${n.id}" data-action="click-notification" data-notification-type="${n.type}">
          <div class="notification-icon">${meta.icon}</div>
          <div class="notification-content">
            <div class="notification-title">${meta.title}</div>
            <div class="notification-text">${meta.text}</div>
            <div class="notification-time">${time}</div>
          </div>
          <button class="notification-delete" data-action="delete-notification" data-notification-id="${n.id}" aria-label="删除">×</button>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

export function renderChatPanel(currentUser, allUsers, messages) {
  const otherUsers = allUsers.filter((u) => u.id !== currentUser.id);

  return `<div class="chat-panel" id="chat-panel">
    <div class="chat-panel-head">
      <strong>协作沟通</strong>
      <button class="chat-panel-close" data-action="close-chat" aria-label="关闭">×</button>
    </div>
    <div class="chat-panel-body">
      <div class="chat-user-list">
        ${otherUsers.length ? otherUsers.map((u) => {
          const userMessages = (messages || []).filter((m) =>
            (m.fromUserId === currentUser.id && m.toUserId === u.id) ||
            (m.fromUserId === u.id && m.toUserId === currentUser.id)
          );
          const lastMsg = userMessages[userMessages.length - 1];
          const unread = userMessages.filter((m) => m.fromUserId === u.id && !m.read).length;
          return `<div class="chat-user-item ${selectedChatUserId === u.id ? 'active' : ''}" data-action="select-chat-user" data-user-id="${u.id}">
            <span class="chat-user-avatar">${u.name.slice(0, 1)}</span>
            <div class="chat-user-info">
              <strong>${esc(u.name)}</strong>
              <small>${lastMsg ? esc(lastMsg.content.slice(0, 30)) : '点击开始对话'}</small>
            </div>
            ${unread > 0 ? `<span class="chat-unread-badge">${unread}</span>` : ''}
          </div>`;
        }).join('') : '<div class="chat-empty"><p>暂无其他用户</p></div>'}
      </div>
      <div class="chat-conversation" id="chat-conversation"></div>
    </div>
  </div>`;
}

export function renderChatConversation(messages, currentUserId, targetUser) {
  const conversationMessages = (messages || []).filter((m) =>
    (m.fromUserId === currentUserId && m.toUserId === targetUser.id) ||
    (m.fromUserId === targetUser.id && m.toUserId === currentUserId)
  ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (!conversationMessages.length) {
    return `<div class="chat-conversation-empty">
      <div class="chat-empty-avatar">${targetUser.name.slice(0, 1)}</div>
      <p>还没有消息，发送一条开始对话吧</p>
    </div>`;
  }

  const dateMap = new Map();
  conversationMessages.forEach((m) => {
    const date = new Date(m.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    if (!dateMap.has(date)) dateMap.set(date, []);
    dateMap.get(date).push(m);
  });

  let html = '';
  dateMap.forEach((msgs, date) => {
    html += `<div class="chat-date-divider">${date}</div>`;
    msgs.forEach((m) => {
      const isMe = m.fromUserId === currentUserId;
      const time = new Date(m.createdAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      html += `<div class="chat-message ${isMe ? 'chat-message-me' : 'chat-message-other'}">
        <div class="chat-message-bubble">
          <div class="chat-message-sender">${esc(m.fromUserName)}</div>
          <div class="chat-message-text">${esc(m.content)}</div>
          <div class="chat-message-time">${time}</div>
        </div>
      </div>`;
    });
  });

  return html;
}

export function renderChatInputArea(targetUserId) {
  return `<div class="chat-input-area">
    <input class="chat-input" id="chat-message-input" placeholder="输入消息…" maxlength="500" data-chat-target="${targetUserId}">
    <button class="button primary" data-action="send-chat-message" data-chat-target="${targetUserId}">发送</button>
  </div>`;
}

export function renderNotificationItems(state) {
  const notifications = [...(state.notifications || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!notifications.length) {
    return `<div class="notification-empty"><i class="ri-notification-3-line"></i><p>暂无通知</p></div>`;
  }
  return notifications.map((n) => {
    const time = new Date(n.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const meta = notificationMeta(n);
    return `<div class="notification-item ${n.read ? 'read' : 'unread'}" data-notification-id="${n.id}" data-action="click-notification" data-notification-type="${n.type}">
      <div class="notification-icon">${meta.icon}</div>
      <div class="notification-content">
        <div class="notification-title">${meta.title}</div>
        <div class="notification-text">${meta.text}</div>
        <div class="notification-time">${time}</div>
      </div>
      <button class="notification-delete" data-action="delete-notification" data-notification-id="${n.id}" aria-label="删除">×</button>
    </div>`;
  }).join('');
}

export function renderChatUserList(currentUser, allUsers, messages) {
  const otherUsers = allUsers.filter((u) => u.id !== currentUser.id);
  if (!otherUsers.length) return '<div class="chat-empty"><p>暂无其他用户</p></div>';
  return otherUsers.map((u) => {
    const userMessages = (messages || []).filter((m) =>
      (m.fromUserId === currentUser.id && m.toUserId === u.id) ||
      (m.fromUserId === u.id && m.toUserId === currentUser.id)
    );
    const lastMsg = userMessages[userMessages.length - 1];
    const unread = userMessages.filter((m) => m.fromUserId === u.id && !m.read).length;
    return `<div class="chat-user-item ${selectedChatUserId === u.id ? 'active' : ''}" data-action="select-chat-user" data-user-id="${u.id}">
      <span class="chat-user-avatar">${u.name.slice(0, 1)}</span>
      <div class="chat-user-info">
        <strong>${esc(u.name)}</strong>
        <small>${lastMsg ? esc(lastMsg.content.slice(0, 30)) : '点击开始对话'}</small>
      </div>
      ${unread > 0 ? `<span class="chat-unread-badge">${unread}</span>` : ''}
    </div>`;
  }).join('');
}

export function renderMentionMenu(users, query) {
  const filtered = query ? users.filter((u) =>
    u.name.toLowerCase().includes(query.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(query.toLowerCase())
  ) : users;

  if (!filtered.length) return '<div class="mention-menu-empty">没有匹配的用户</div>';

  return `<div class="mention-menu">
    <div class="mention-menu-head">@ 提及用户</div>
    <div class="mention-menu-list">
      ${filtered.map((u, index) => `<button type="button" class="mention-menu-item" data-mention-user="${u.id}" data-mention-index="${index}" data-mention-name="${esc(u.name)}">
        <span class="mention-menu-avatar">${u.name.slice(0, 1)}</span>
        <span class="mention-menu-name">${esc(u.name)}</span>
        <span class="mention-menu-dept">${esc(u.department || '未分配部门')}</span>
      </button>`).join('')}
    </div>
  </div>`;
}

function notificationMeta(n) {
  const text = String(n?.title || n?.taskTitle || n?.content || '');
  switch (n?.type) {
    case 'mention':
      return { icon: '<i class="ri-at-line"></i>', title: `<strong>${esc(n.fromUserName)}</strong> 在任务中提到了你`, text: esc(text) };
    case 'chat':
      return { icon: '<i class="ri-message-3-line"></i>', title: `<strong>${esc(n.fromUserName)}</strong> 发来消息`, text: esc(text) };
    case 'overdue':
      return { icon: '<i class="ri-time-line"></i>', title: '任务已超期', text: esc(text) };
    case 'deadline':
      return { icon: '<i class="ri-timer-flash-line"></i>', title: '截止日期临近', text: esc(text) };
    case 'daily-reminder':
      return { icon: '<i class="ri-edit-box-line"></i>', title: '今日工作记录提醒', text: esc(text) };
    case 'reviewer':
      return { icon: '<i class="ri-user-star-line"></i>', title: '你被指定为验收人', text: esc(text) };
    case 'rework':
      return { icon: '<i class="ri-arrow-go-back-line"></i>', title: '任务被退回修改', text: esc(text) };
    default:
      return { icon: '<i class="ri-information-line"></i>', title: '系统通知', text: esc(text) };
  }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

let selectedChatUserId = null;
export function setSelectedChatUserId(id) { selectedChatUserId = id; }
export function getSelectedChatUserId() { return selectedChatUserId; }