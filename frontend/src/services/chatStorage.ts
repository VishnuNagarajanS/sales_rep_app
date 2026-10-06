import { ChatConversation, ChatMessage, ChatMember, ChatAttachment } from '../types';

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

// ── Conversations ─────────────────────────────────────────────────────────────
export function getConversations(companyId: string): ChatConversation[] {
  try {
    const raw = localStorage.getItem(getConvsKey());
    const all: ChatConversation[] = raw ? JSON.parse(raw) : [];
    return all.filter(c => c.companyId === companyId);
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
  const existing = getConversations(companyId).find(
    c => c.type === 'dm' && c.memberIds.includes(meId) && c.memberIds.includes(them.id),
  );
  if (existing) return existing;
  const conv: ChatConversation = {
    id: `conv-dm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    companyId,
    type: 'dm',
    memberIds: [meId, them.id],
    members: [me, them],
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveConversation(conv);
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
  return conv;
}

// ── Messages ──────────────────────────────────────────────────────────────────
export function getMessages(conversationId: string): ChatMessage[] {
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
  const msg = { ...msgs[idx], reactions: [...msgs[idx].reactions] };
  const rxIdx = msg.reactions.findIndex(r => r.emoji === emoji && r.userId === userId);
  if (rxIdx >= 0) {
    msg.reactions.splice(rxIdx, 1);
  } else {
    msg.reactions.push({ emoji, userId, userName });
  }
  msgs[idx] = { ...msg, updatedAt: new Date().toISOString() };
  localStorage.setItem(getMsgKey(conversationId), JSON.stringify(msgs));
  emit();
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

export function setTyping(conversationId: string, entry: TypingEntry | null): void {
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
      status: (presence[u.id] ?? 'offline') as 'online' | 'offline',
    }));
}



// ── Conversation Settings & Organization ──────────────────────────────────────
export function getChatSettings(companyId: string, userId: string): any {
  try {
    const raw = localStorage.getItem(getSettingsKey(companyId, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveChatSettings(companyId: string, userId: string, settings: any): void {
  try {
    localStorage.setItem(getSettingsKey(companyId, userId), JSON.stringify(settings));
    emit();
  } catch { }
}

export function togglePinConversation(conversationId: string): void {
  try {
    const raw = localStorage.getItem(getConvsKey());
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      conv.isPinned = !conv.isPinned;
      localStorage.setItem(getConvsKey(), JSON.stringify(all));
      emit();
    }
  } catch { }
}

export function toggleMuteConversation(conversationId: string): void {
  try {
    const raw = localStorage.getItem(getConvsKey());
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      conv.isMuted = !conv.isMuted;
      localStorage.setItem(getConvsKey(), JSON.stringify(all));
      emit();
    }
  } catch { }
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
