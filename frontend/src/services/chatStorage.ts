import { ChatConversation, ChatMessage, ChatMember, ChatAttachment, ChatSettings } from '../types';
import { chatApiService } from './chatApiService';
import { signalRService } from './signalRService';
import { playChatNotificationChime, showDesktopNotification } from '../utils/chatNotificationSound';

// ── Storage keys ──────────────────────────────────────────────────────────────
const getPrefix = () => 'nexus_dev_';
const getConvsKey = () => `${getPrefix()}chat_conversations`;
const getMsgKey = (id: string) => `${getPrefix()}chat_messages_${id}`;
const getPresenceKey = () => `${getPrefix()}chat_presence`;
const getTypingKey = () => `${getPrefix()}chat_typing`;
const getSettingsKey = (companyId: string, userId: string) => `${getPrefix()}chat_settings_${companyId}_${userId}`;

function emit() {
  window.dispatchEvent(new CustomEvent('nexus_chat_updated'));
}

// ── Real-Time SignalR Synchronization ─────────────────────────────────────────
let isSyncInitialized = false;

function getCurrentAuthUser(): { id: string; name: string; companyId: string } | null {
  try {
    const raw = sessionStorage.getItem('nexus_current_user') || localStorage.getItem('nexus_current_user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return {
      id: String(u.id || ''),
      name: u.name || '',
      companyId: String(u.companyId || '1'),
    };
  } catch {
    return null;
  }
}

export function initChatRealtimeSync(): void {
  if (isSyncInitialized || typeof window === 'undefined') return;
  isSyncInitialized = true;

  signalRService.startConnection().catch(() => {});

  // 1. New incoming message
  signalRService.on('ReceiveChatMessage', (msg: ChatMessage) => {
    if (!msg || !msg.conversationId) return;

    const me = getCurrentAuthUser();
    const isFromMe = me && String(msg.senderId) === me.id;

    // Check notification preferences if message is from colleague
    if (!isFromMe && me) {
      const settings = getChatSettings(me.companyId, me.id);
      const conv = getConversation(msg.conversationId);
      const isMuted = conv?.isMuted ?? false;

      // Audio notification chime
      if (settings?.notifications?.sound !== false && !isMuted) {
        playChatNotificationChime();
      }

      // Desktop push notification
      if (settings?.notifications?.desktopPush !== false && !isMuted) {
        const preview = settings?.notifications?.showPreview !== false ? msg.content : 'New message received';
        showDesktopNotification(msg.senderName || 'Team Chat', preview);
      }
    }

    // Merge into local messages
    const msgs = getMessages(msg.conversationId);
    const existingIndex = msgs.findIndex(m => m.id === msg.id);
    if (existingIndex >= 0) {
      msgs[existingIndex] = msg;
    } else {
      msgs.push(msg);
    }
    localStorage.setItem(getMsgKey(msg.conversationId), JSON.stringify(msgs));

    // Update conversation preview and unread count
    try {
      const raw = localStorage.getItem(getConvsKey());
      if (raw) {
        const all: ChatConversation[] = JSON.parse(raw);
        const ci = all.findIndex(c => c.id === msg.conversationId);
        if (ci >= 0) {
          all[ci].lastMessage = {
            content: msg.content || (msg.attachments && msg.attachments.length > 0 ? `📎 ${msg.attachments[0].name}` : ''),
            senderName: msg.senderName,
            isDeleted: msg.isDeleted,
          };
          all[ci].updatedAt = msg.createdAt;
          if (!isFromMe) {
            all[ci].unreadCount = (all[ci].unreadCount || 0) + 1;
          }
          localStorage.setItem(getConvsKey(), JSON.stringify(all));
        } else {
          chatApiService.getConversations().then(remoteConvs => {
            if (Array.isArray(remoteConvs) && remoteConvs.length > 0) {
              localStorage.setItem(getConvsKey(), JSON.stringify(remoteConvs));
              emit();
            }
          }).catch(() => {});
        }
      }
    } catch { }

    emit();
  });

  // 2. Typing indicator broadcast
  signalRService.on('ChatUserTyping', (data: { convId: string; userId: number; userName: string; isTyping: boolean }) => {
    if (!data || !data.convId) return;
    const me = getCurrentAuthUser();
    if (me && String(data.userId) === me.id) return;

    if (data.isTyping) {
      setLocalTyping(data.convId, {
        userId: String(data.userId),
        userName: data.userName,
        ts: Date.now(),
      });
    } else {
      setLocalTyping(data.convId, null);
    }
    emit();
  });

  // 3. Conversation modified (pinned, renamed, created, history cleared)
  signalRService.on('ChatConversationUpdated', (data: { conversationId: string }) => {
    // Refresh conversations in background
    chatApiService.getConversations().then(remoteConvs => {
      if (Array.isArray(remoteConvs) && remoteConvs.length > 0) {
        localStorage.setItem(getConvsKey(), JSON.stringify(remoteConvs));
        emit();
      }
    }).catch(() => {});
  });

  // 4. Message read broadcast
  signalRService.on('ChatMessageRead', (data: { conversationId: string; userId: number; messageId: string }) => {
    emit();
  });
}

export function isMatchingCompany(cCompId?: string | number, targetCompId?: string | number): boolean {
  if (!cCompId || !targetCompId) return true;
  const c1 = String(cCompId).toLowerCase();
  const c2 = String(targetCompId).toLowerCase();
  if (c1 === c2) return true;
  if ((c1 === '1' || c1 === 'ghl' || c1 === 't-ghl-01') && (c2 === '1' || c2 === 'ghl' || c2 === 't-ghl-01')) return true;
  if ((c1 === '2' || c1 === 'jamin' || c1 === 't-jamin-02') && (c2 === '2' || c2 === 'jamin' || c2 === 't-jamin-02')) return true;
  return false;
}

// ── Conversations ─────────────────────────────────────────────────────────────
export function getConversations(companyId: string): ChatConversation[] {
  // Trigger realtime init on first fetch
  initChatRealtimeSync();

  // 1. Sync from backend in background
  chatApiService.getConversations().then(remoteConvs => {
    if (Array.isArray(remoteConvs)) {
      const raw = localStorage.getItem(getConvsKey());
      const currentList: ChatConversation[] = raw ? JSON.parse(raw) : [];

      const map = new Map<string, ChatConversation>();
      currentList.forEach(c => map.set(c.id, c));
      remoteConvs.forEach(rc => {
        const existing = map.get(rc.id);
        map.set(rc.id, {
          ...rc,
          isPinned: existing?.isPinned ?? rc.isPinned,
          isMuted: existing?.isMuted ?? rc.isMuted,
        });
      });

      const merged = Array.from(map.values());
      const currentStr = raw || '[]';
      const newStr = JSON.stringify(merged);
      if (currentStr !== newStr) {
        localStorage.setItem(getConvsKey(), newStr);
        emit();
      }
    }
  }).catch(() => {});

  // 2. Return local cached conversations
  try {
    const raw = localStorage.getItem(getConvsKey());
    const all: ChatConversation[] = raw ? JSON.parse(raw) : [];
    return all.filter(c => isMatchingCompany(c.companyId, companyId));
  } catch {
    return [];
  }
}

export function getConversation(id: string): ChatConversation | null {
  try {
    const raw = localStorage.getItem(getConvsKey());
    const all: ChatConversation[] = raw ? JSON.parse(raw) : [];
    return all.find(c => c.id === id) ?? null;
  } catch {
    return null;
  }
}

export function saveConversation(conv: ChatConversation): void {
  try {
    const raw = localStorage.getItem(getConvsKey());
    const all: ChatConversation[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(c => c.id === conv.id);
    if (idx >= 0) {
      all[idx] = conv;
    } else {
      all.unshift(conv);
    }
    localStorage.setItem(getConvsKey(), JSON.stringify(all));
    emit();
  } catch { }
}

export function getOrCreateDm(companyId: string, meId: string, them: ChatMember, me: ChatMember): ChatConversation {
  const meNum = parseInt(meId, 10);
  const themNum = parseInt(them.id, 10);
  const safeCompId = companyId && !isNaN(parseInt(companyId, 10)) ? companyId : '1';
  const deterministicId = (!isNaN(meNum) && !isNaN(themNum))
    ? `conv-dm-${safeCompId}-${Math.min(meNum, themNum)}-${Math.max(meNum, themNum)}`
    : `conv-dm-${safeCompId}-${meId}-${them.id}`;

  const existing = getConversations(companyId).find(
    c => c.id === deterministicId || (c.type === 'dm' && c.memberIds.includes(meId) && c.memberIds.includes(them.id)),
  );
  if (existing) {
    if (existing.id !== deterministicId) {
      existing.id = deterministicId;
      saveConversation(existing);
    }
    return existing;
  }

  const conv: ChatConversation = {
    id: deterministicId,
    companyId: safeCompId,
    type: 'dm',
    memberIds: [meId, them.id],
    members: [me, them],
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveConversation(conv);

  // Sync to PostgreSQL backend
  if (!isNaN(meNum) && !isNaN(themNum)) {
    chatApiService.createConversation({
      id: deterministicId,
      type: 'dm',
      memberUserIds: [meNum, themNum],
    }).then(created => {
      if (created && created.id) {
        saveConversation(created);
      }
    }).catch(() => {});
  }

  return conv;
}

export function createGroup(companyId: string, name: string, members: ChatMember[]): ChatConversation {
  const conv: ChatConversation = {
    id: `conv-grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    companyId,
    type: 'group',
    name,
    memberIds: members.map(m => m.id),
    members,
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveConversation(conv);

  // Sync to PostgreSQL backend
  const memberIdsNum = members.map(m => parseInt(m.id, 10)).filter(id => !isNaN(id));
  chatApiService.createConversation({
    type: 'group',
    name,
    memberUserIds: memberIdsNum,
  }).then(created => {
    if (created && created.id) {
      saveConversation(created);
    }
  }).catch(() => {});

  return conv;
}

// ── Messages ──────────────────────────────────────────────────────────────────
export function getMessages(conversationId: string): ChatMessage[] {
  // Background fetch from backend
  chatApiService.getMessages(conversationId).then(remoteMsgs => {
    if (Array.isArray(remoteMsgs) && remoteMsgs.length > 0) {
      const raw = localStorage.getItem(getMsgKey(conversationId));
      const currentStr = raw || '[]';
      const newStr = JSON.stringify(remoteMsgs);
      if (currentStr !== newStr) {
        localStorage.setItem(getMsgKey(conversationId), newStr);
        emit();
      }
    }
  }).catch(() => {});

  try {
    const raw = localStorage.getItem(getMsgKey(conversationId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function sendMessage(
  conversationId: string,
  companyId: string,
  sender: ChatMember,
  content: string,
  attachments?: ChatAttachment[],
): ChatMessage {
  const msg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conversationId,
    senderId: sender.id,
    senderName: sender.name,
    content: content.trim(),
    isDeleted: false,
    isEdited: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reactions: [],
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
  };

  // 1. Optimistic local cache update
  const msgs = getMessages(conversationId);
  msgs.push(msg);
  localStorage.setItem(getMsgKey(conversationId), JSON.stringify(msgs));

  // Update lastMessage on conversation
  try {
    const raw = localStorage.getItem(getConvsKey());
    const all: ChatConversation[] = raw ? JSON.parse(raw) : [];
    const ci = all.findIndex(c => c.id === conversationId && c.companyId === companyId);
    if (ci >= 0) {
      const previewText = msg.content
        ? msg.content
        : (attachments && attachments.length > 0 ? `📎 ${attachments[0].name}` : '');
      all[ci].lastMessage = { content: previewText, senderName: msg.senderName, isDeleted: false };
      all[ci].updatedAt = msg.createdAt;
      localStorage.setItem(getConvsKey(), JSON.stringify(all));
    }
  } catch { }

  emit();

  // 2. Dispatch to backend REST API & SignalR
  chatApiService.sendMessage(conversationId, {
    content: msg.content,
    attachments,
  }).then(saved => {
    if (saved && saved.id) {
      // Reconcile client generated ID with server ID
      const updatedMsgs = getMessages(conversationId);
      const localIdx = updatedMsgs.findIndex(m => m.id === msg.id);
      if (localIdx >= 0) {
        updatedMsgs[localIdx] = saved;
        localStorage.setItem(getMsgKey(conversationId), JSON.stringify(updatedMsgs));
        emit();
      }
    }
  }).catch(err => {
    console.warn('[chatStorage] sendMessage backend dispatch error:', err);
  });

  return msg;
}

export function editMessage(conversationId: string, messageId: string, newContent: string): void {
  const msgs = getMessages(conversationId);
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx < 0) return;
  msgs[idx] = { ...msgs[idx], content: newContent, isEdited: true, updatedAt: new Date().toISOString() };
  localStorage.setItem(getMsgKey(conversationId), JSON.stringify(msgs));
  emit();
}

export function deleteMessage(conversationId: string, messageId: string): void {
  const msgs = getMessages(conversationId);
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx < 0) return;
  msgs[idx] = { ...msgs[idx], isDeleted: true, content: '', attachments: undefined, updatedAt: new Date().toISOString() };
  localStorage.setItem(getMsgKey(conversationId), JSON.stringify(msgs));
  emit();
}

export function toggleReaction(conversationId: string, messageId: string, emoji: string, userId: string, userName: string): void {
  const msgs = getMessages(conversationId);
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx < 0) return;
  const reactions = [...(msgs[idx].reactions || [])];
  const rxIdx = reactions.findIndex(r => r.emoji === emoji && r.userId === userId);
  if (rxIdx >= 0) {
    reactions.splice(rxIdx, 1);
  } else {
    reactions.push({ emoji, userId, userName });
  }
  msgs[idx] = { ...msgs[idx], reactions, updatedAt: new Date().toISOString() };
  localStorage.setItem(getMsgKey(conversationId), JSON.stringify(msgs));
  emit();

  // Sync to PostgreSQL backend
  chatApiService.toggleReaction(conversationId, messageId, emoji).catch(() => {});
}

export function markRead(conversationId: string, companyId: string): void {
  try {
    const raw = localStorage.getItem(getConvsKey());
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const idx = all.findIndex(c => c.id === conversationId && c.companyId === companyId);
    if (idx >= 0) {
      all[idx].unreadCount = 0;
      localStorage.setItem(getConvsKey(), JSON.stringify(all));
      emit();
    }
  } catch { }

  chatApiService.markAsRead(conversationId).catch(() => {});
}

// ── Presence ──────────────────────────────────────────────────────────────────
export function getPresence(): Record<string, 'online' | 'offline'> {
  try {
    const raw = localStorage.getItem(getPresenceKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setPresence(userId: string, status: 'online' | 'offline'): void {
  const p = getPresence();
  p[userId] = status;
  localStorage.setItem(getPresenceKey(), JSON.stringify(p));
}

// ── Typing ────────────────────────────────────────────────────────────────────
export interface TypingEntry {
  userId: string;
  userName: string;
  ts: number;
}

function setLocalTyping(conversationId: string, entry: TypingEntry | null): void {
  try {
    const raw = localStorage.getItem(getTypingKey());
    const map: Record<string, TypingEntry | null> = raw ? JSON.parse(raw) : {};
    if (entry) {
      map[conversationId] = entry;
    } else {
      delete map[conversationId];
    }
    localStorage.setItem(getTypingKey(), JSON.stringify(map));
  } catch { }
}

export function setTyping(conversationId: string, entry: TypingEntry | null, companyId?: string, currentUserId?: string): void {
  setLocalTyping(conversationId, entry);

  // Check user privacy settings: respect typingIndicator toggle
  if (companyId && currentUserId) {
    const settings = getChatSettings(companyId, currentUserId);
    if (settings?.privacy?.typingIndicator === false) {
      return; // Suppress sending typing status to colleagues
    }
  }

  // Broadcast to backend via SignalR
  chatApiService.sendTyping(conversationId, entry !== null).catch(() => {});
}

export function getTyping(conversationId: string, currentUserId: string): TypingEntry | null {
  try {
    const raw = localStorage.getItem(getTypingKey());
    const map: Record<string, TypingEntry | null> = raw ? JSON.parse(raw) : {};
    const entry = map[conversationId];
    if (!entry || entry.userId === currentUserId || Date.now() - entry.ts > 3000) return null;
    return entry;
  } catch {
    return null;
  }
}

// ── Directory ─────────────────────────────────────────────────────────────────
export function buildDirectory(
  users: Array<{ id: string; name: string; email?: string; role?: { code: string; name: string }; companyId?: string; companySlug?: string }>,
  companyId: string,
  tenantSlug?: string,
): ChatMember[] {
  const presence = getPresence();
  return users
    .filter(u => {
      if (u.companyId && companyId && (u.companyId === companyId || u.companyId.includes(companyId) || companyId.includes(u.companyId))) return true;
      if (tenantSlug && u.companySlug === tenantSlug) return true;
      if (u.companySlug && (u.companySlug === companyId || companyId.includes(u.companySlug))) return true;
      return false;
    })
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roleCode: u.role?.code || 'sales_executive',
      roleName: u.role?.name || 'Sales Executive',
      companyId,
      status: (presence[u.id] ?? 'online') as 'online' | 'offline',
    }));
}

// ── Conversation Settings & Organization ──────────────────────────────────────
export function getChatSettings(companyId: string, userId: string): ChatSettings | null {
  try {
    const raw = localStorage.getItem(getSettingsKey(companyId, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveChatSettings(companyId: string, userId: string, settings: ChatSettings): void {
  try {
    localStorage.setItem(getSettingsKey(companyId, userId), JSON.stringify(settings));
    emit();
  } catch { }
}

export function togglePinConversation(conversationId: string): void {
  let isPinned = false;
  try {
    const raw = localStorage.getItem(getConvsKey());
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      conv.isPinned = !conv.isPinned;
      isPinned = Boolean(conv.isPinned);
      localStorage.setItem(getConvsKey(), JSON.stringify(all));
      emit();
    }
  } catch { }

  chatApiService.updateConversation(conversationId, { isPinned }).catch(() => {});
}

export function toggleMuteConversation(conversationId: string): void {
  let isMuted = false;
  try {
    const raw = localStorage.getItem(getConvsKey());
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      conv.isMuted = !conv.isMuted;
      isMuted = Boolean(conv.isMuted);
      localStorage.setItem(getConvsKey(), JSON.stringify(all));
      emit();
    }
  } catch { }

  chatApiService.updateConversation(conversationId, { isMuted }).catch(() => {});
}

export function renameConversation(conversationId: string, newName: string): void {
  try {
    const raw = localStorage.getItem(getConvsKey());
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      conv.name = newName;
      conv.updatedAt = new Date().toISOString();
      localStorage.setItem(getConvsKey(), JSON.stringify(all));
      emit();
    }
  } catch { }

  chatApiService.updateConversation(conversationId, { name: newName }).catch(() => {});
}

export function clearConversationMessages(conversationId: string): void {
  try {
    localStorage.setItem(getMsgKey(conversationId), JSON.stringify([]));
    const raw = localStorage.getItem(getConvsKey());
    if (raw) {
      const all: ChatConversation[] = JSON.parse(raw);
      const conv = all.find(c => c.id === conversationId);
      if (conv) {
        conv.lastMessage = undefined;
        localStorage.setItem(getConvsKey(), JSON.stringify(all));
      }
    }
    emit();
  } catch { }

  chatApiService.clearHistory(conversationId).catch(() => {});
}

export function leaveConversation(conversationId: string, userId: string): void {
  try {
    const raw = localStorage.getItem(getConvsKey());
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      conv.memberIds = conv.memberIds.filter(id => id !== userId);
      conv.members = conv.members.filter(m => m.id !== userId);
      localStorage.setItem(getConvsKey(), JSON.stringify(all));
      emit();
    }
  } catch { }

  chatApiService.leaveGroup(conversationId).catch(() => {});
}

// ── Call Cards ────────────────────────────────────────────────────────────────
export function sendCallCardMessage(
  conversationId: string,
  companyId: string,
  sender: ChatMember,
  meetingId: string,
  callMode: 'video' | 'audio',
): ChatMessage {
  const callPayload = {
    type: 'call',
    meetingId,
    callMode,
    status: 'active',
    hostId: sender.id,
    hostName: sender.name,
    startedAt: new Date().toISOString(),
  };
  const cardContent = `[CALL:${JSON.stringify(callPayload)}]`;
  return sendMessage(conversationId, companyId, sender, cardContent);
}

export function updateCallCardMessage(
  conversationId: string,
  meetingId: string,
  durationStr: string,
): void {
  try {
    const msgs = getMessages(conversationId);
    let updated = false;
    for (const msg of msgs) {
      if (msg.content.startsWith('[CALL:')) {
        try {
          const payload = JSON.parse(msg.content.slice(6, -1));
          if (payload.meetingId === meetingId && payload.status === 'active') {
            payload.status = 'ended';
            payload.duration = durationStr;
            payload.endedAt = new Date().toISOString();
            msg.content = `[CALL:${JSON.stringify(payload)}]`;
            msg.updatedAt = new Date().toISOString();
            updated = true;
          }
        } catch { }
      }
    }
    if (updated) {
      localStorage.setItem(getMsgKey(conversationId), JSON.stringify(msgs));
      emit();
    }
  } catch { }
}
