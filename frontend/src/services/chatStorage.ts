import { ChatConversation, ChatMessage, ChatMember, ChatAttachment } from '../types';

// ── Storage keys ──────────────────────────────────────────────────────────────
const CONVS_KEY = 'nexus_chat_conversations';
const msgKey = (id: string) => `nexus_chat_messages_${id}`;
const PRESENCE_KEY = 'nexus_chat_presence';
const TYPING_KEY = 'nexus_chat_typing';

function emit() {
  window.dispatchEvent(new CustomEvent('nexus_chat_updated'));
}

// ── Conversations ─────────────────────────────────────────────────────────────
export function getConversations(companyId: string): ChatConversation[] {
  try {
    const raw = localStorage.getItem(CONVS_KEY);
    const all: ChatConversation[] = raw ? JSON.parse(raw) : [];
    return all.filter(c => c.companyId === companyId);
  } catch {
    return [];
  }
}

export function getConversation(id: string): ChatConversation | null {
  try {
    const raw = localStorage.getItem(CONVS_KEY);
    const all: ChatConversation[] = raw ? JSON.parse(raw) : [];
    return all.find(c => c.id === id) ?? null;
  } catch {
    return null;
  }
}

export function saveConversation(conv: ChatConversation): void {
  try {
    const raw = localStorage.getItem(CONVS_KEY);
    const all: ChatConversation[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(c => c.id === conv.id);
    if (idx >= 0) { all[idx] = conv; } else { all.unshift(conv); }
    localStorage.setItem(CONVS_KEY, JSON.stringify(all));
    emit();
  } catch {}
}

export function getOrCreateDm(companyId: string, meId: string, them: ChatMember, me: ChatMember): ChatConversation {
  const existing = getConversations(companyId).find(
    c => c.type === 'dm' && c.memberIds.includes(meId) && c.memberIds.includes(them.id),
  );
  if (existing) return existing;
  const conv: ChatConversation = {
    id: `conv-dm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    companyId, type: 'dm',
    memberIds: [meId, them.id], members: [me, them],
    unreadCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  saveConversation(conv);
  return conv;
}

export function createGroup(companyId: string, name: string, members: ChatMember[]): ChatConversation {
  const conv: ChatConversation = {
    id: `conv-grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    companyId, type: 'group', name,
    memberIds: members.map(m => m.id), members,
    unreadCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  saveConversation(conv);
  return conv;
}

// ── Messages ──────────────────────────────────────────────────────────────────
export function getMessages(conversationId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(msgKey(conversationId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
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
  localStorage.setItem(msgKey(conversationId), JSON.stringify(msgs));

  // Update lastMessage on conversation
  try {
    const raw = localStorage.getItem(CONVS_KEY);
    const all: ChatConversation[] = raw ? JSON.parse(raw) : [];
    const ci = all.findIndex(c => c.id === conversationId && c.companyId === companyId);
    if (ci >= 0) {
      const previewText = msg.content
        ? msg.content
        : (attachments && attachments.length > 0 ? `📎 ${attachments[0].name}` : '');
      all[ci].lastMessage = { content: previewText, senderName: msg.senderName, isDeleted: false };
      all[ci].updatedAt = msg.createdAt;
      localStorage.setItem(CONVS_KEY, JSON.stringify(all));
    }
  } catch {}

  emit();
  return msg;
}

export function editMessage(conversationId: string, messageId: string, newContent: string): void {
  const msgs = getMessages(conversationId);
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx < 0) return;
  msgs[idx] = { ...msgs[idx], content: newContent, isEdited: true, updatedAt: new Date().toISOString() };
  localStorage.setItem(msgKey(conversationId), JSON.stringify(msgs));
  emit();
}

export function deleteMessage(conversationId: string, messageId: string): void {
  const msgs = getMessages(conversationId);
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx < 0) return;
  msgs[idx] = { ...msgs[idx], isDeleted: true, content: '', attachments: undefined, updatedAt: new Date().toISOString() };
  localStorage.setItem(msgKey(conversationId), JSON.stringify(msgs));
  emit();
}

export function toggleReaction(conversationId: string, messageId: string, emoji: string, userId: string, userName: string): void {
  const msgs = getMessages(conversationId);
  const idx = msgs.findIndex(m => m.id === messageId);
  if (idx < 0) return;
  const msg = { ...msgs[idx], reactions: [...msgs[idx].reactions] };
  const rxIdx = msg.reactions.findIndex(r => r.emoji === emoji && r.userId === userId);
  if (rxIdx >= 0) { msg.reactions.splice(rxIdx, 1); } else { msg.reactions.push({ emoji, userId, userName }); }
  msgs[idx] = { ...msg, updatedAt: new Date().toISOString() };
  localStorage.setItem(msgKey(conversationId), JSON.stringify(msgs));
  emit();
}

export function markRead(conversationId: string, companyId: string): void {
  try {
    const raw = localStorage.getItem(CONVS_KEY);
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const idx = all.findIndex(c => c.id === conversationId && c.companyId === companyId);
    if (idx >= 0) { all[idx].unreadCount = 0; localStorage.setItem(CONVS_KEY, JSON.stringify(all)); emit(); }
  } catch {}
}

// ── Presence ──────────────────────────────────────────────────────────────────
export function getPresence(): Record<string, 'online' | 'offline'> {
  try { const raw = localStorage.getItem(PRESENCE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export function setPresence(userId: string, status: 'online' | 'offline'): void {
  const p = getPresence(); p[userId] = status;
  localStorage.setItem(PRESENCE_KEY, JSON.stringify(p));
}

// ── Typing ────────────────────────────────────────────────────────────────────
export interface TypingEntry { userId: string; userName: string; ts: number; }

export function setTyping(conversationId: string, entry: TypingEntry | null): void {
  try {
    const raw = localStorage.getItem(TYPING_KEY);
    const map: Record<string, TypingEntry | null> = raw ? JSON.parse(raw) : {};
    if (entry) { map[conversationId] = entry; } else { delete map[conversationId]; }
    localStorage.setItem(TYPING_KEY, JSON.stringify(map));
  } catch {}
}

export function getTyping(conversationId: string, currentUserId: string): TypingEntry | null {
  try {
    const raw = localStorage.getItem(TYPING_KEY);
    const map: Record<string, TypingEntry | null> = raw ? JSON.parse(raw) : {};
    const entry = map[conversationId];
    if (!entry || entry.userId === currentUserId || Date.now() - entry.ts > 3000) return null;
    return entry;
  } catch { return null; }
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

// ── Seed Demo Conversations ───────────────────────────────────────────────────
export function ensureDemoConversations(companyId: string, tenantSlug?: string): void {
  const existing = getConversations(companyId);
  if (existing.length > 0) return;

  const isGhl = companyId.includes('ghl') || tenantSlug === 'ghl';
  const isJamin = companyId.includes('jamin') || tenantSlug === 'jamin';

  if (isGhl) {
    const admin: ChatMember = {
      id: 'usr-ghl-admin',
      name: 'Vikram Malhotra',
      email: 'vikram.malhotra@ghl.com',
      roleCode: 'company_admin',
      roleName: 'Company Admin',
      companyId,
      status: 'online',
    };
    const exec: ChatMember = {
      id: 'usr-ghl-exec',
      name: 'Ananya Iyer',
      email: 'ananya.iyer@ghl.com',
      roleCode: 'sales_executive',
      roleName: 'Sales Executive',
      companyId,
      status: 'online',
    };

    const grpId = `conv-grp-ghl-sales`;
    const grp: ChatConversation = {
      id: grpId,
      companyId,
      type: 'group',
      name: 'GHL Sales Strategy',
      memberIds: [admin.id, exec.id],
      members: [admin, exec],
      unreadCount: 0,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      lastMessage: {
        content: 'Please prioritize the HNW investor consultations today.',
        senderName: 'Vikram Malhotra',
        isDeleted: false,
      },
    };

    const grpMsgs: ChatMessage[] = [
      {
        id: 'msg-ghl-grp-1',
        conversationId: grpId,
        senderId: admin.id,
        senderName: admin.name,
        content: 'Good morning team! Let’s review today’s pipeline targets.',
        isDeleted: false,
        isEdited: false,
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        reactions: [{ emoji: '👍', userId: exec.id, userName: exec.name }],
      },
      {
        id: 'msg-ghl-grp-2',
        conversationId: grpId,
        senderId: exec.id,
        senderName: exec.name,
        content: 'Morning Vikram! I have 3 consultations scheduled for the Brigade Gateway project.',
        isDeleted: false,
        isEdited: false,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        reactions: [{ emoji: '🔥', userId: admin.id, userName: admin.name }],
      },
      {
        id: 'msg-ghl-grp-3',
        conversationId: grpId,
        senderId: admin.id,
        senderName: admin.name,
        content: 'Please prioritize the HNW investor consultations today.',
        isDeleted: false,
        isEdited: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        reactions: [],
      },
    ];

    const dmId = `conv-dm-ghl-exec-admin`;
    const dm: ChatConversation = {
      id: dmId,
      companyId,
      type: 'dm',
      memberIds: [admin.id, exec.id],
      members: [admin, exec],
      unreadCount: 0,
      createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      lastMessage: {
        content: 'All documents for Dr. Rajesh Nambiar are uploaded and verified.',
        senderName: 'Ananya Iyer',
        isDeleted: false,
      },
    };

    const dmMsgs: ChatMessage[] = [
      {
        id: 'msg-ghl-dm-1',
        conversationId: dmId,
        senderId: admin.id,
        senderName: admin.name,
        content: 'Hi Ananya, could you update the status on Dr. Rajesh Nambiar’s deal?',
        isDeleted: false,
        isEdited: false,
        createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
        reactions: [],
      },
      {
        id: 'msg-ghl-dm-2',
        conversationId: dmId,
        senderId: exec.id,
        senderName: exec.name,
        content: 'All documents for Dr. Rajesh Nambiar are uploaded and verified.',
        isDeleted: false,
        isEdited: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        reactions: [{ emoji: '👏', userId: admin.id, userName: admin.name }],
        attachments: [
          {
            id: 'att-demo-rajesh-docs',
            name: 'Dr_Rajesh_KYC_Verification.pdf',
            size: 2450000,
            type: 'application/pdf',
            category: 'PDF',
            permission: 'read_only',
            dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp...',
          },
          {
            id: 'att-demo-site-plan',
            name: 'Greenfield_Meadows_MasterPlan.png',
            size: 1120000,
            type: 'image/png',
            category: 'Image',
            permission: 'view_download',
            dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" fill="%231e293b"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="16">Master Plan Preview</text></svg>',
          },
        ],
      },
      {
        id: 'msg-ghl-dm-3',
        conversationId: dmId,
        senderId: admin.id,
        senderName: admin.name,
        content: `[CALL:{"type":"call","meetingId":"meet-demo-ghl","callMode":"video","status":"ended","duration":"12m 45s","hostId":"usr-ghl-admin","hostName":"Vikram Malhotra","startedAt":"${new Date(Date.now() - 1000 * 60 * 20).toISOString()}"}]`,
        isDeleted: false,
        isEdited: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        reactions: [],
      },
    ];

    saveConversation(grp);
    saveConversation(dm);
    localStorage.setItem(msgKey(grpId), JSON.stringify(grpMsgs));
    localStorage.setItem(msgKey(dmId), JSON.stringify(dmMsgs));
  } else if (isJamin) {
    const admin: ChatMember = {
      id: 'usr-jamin-admin',
      name: 'Kavita Rao',
      email: 'kavita.rao@jaminbazaar.com',
      roleCode: 'company_admin',
      roleName: 'Company Admin',
      companyId,
      status: 'online',
    };
    const exec: ChatMember = {
      id: 'usr-jamin-exec',
      name: 'Pooja Hegde',
      email: 'pooja.hegde@jaminbazaar.com',
      roleCode: 'sales_executive',
      roleName: 'Sales Executive',
      companyId,
      status: 'online',
    };

    const dmId = `conv-dm-jamin-exec-admin`;
    const dm: ChatConversation = {
      id: dmId,
      companyId,
      type: 'dm',
      memberIds: [admin.id, exec.id],
      members: [admin, exec],
      unreadCount: 0,
      createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      lastMessage: {
        content: 'The site visit for Greenfield Meadows Phase 2 is confirmed for tomorrow.',
        senderName: 'Pooja Hegde',
        isDeleted: false,
      },
    };

    const dmMsgs: ChatMessage[] = [
      {
        id: 'msg-jamin-dm-1',
        conversationId: dmId,
        senderId: admin.id,
        senderName: admin.name,
        content: 'Hi Pooja, please confirm the weekend site visits schedule.',
        isDeleted: false,
        isEdited: false,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        reactions: [],
      },
      {
        id: 'msg-jamin-dm-2',
        conversationId: dmId,
        senderId: exec.id,
        senderName: exec.name,
        content: 'The site visit for Greenfield Meadows Phase 2 is confirmed for tomorrow.',
        isDeleted: false,
        isEdited: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        reactions: [{ emoji: '✅', userId: admin.id, userName: admin.name }],
      },
    ];

    saveConversation(dm);
    localStorage.setItem(msgKey(dmId), JSON.stringify(dmMsgs));
  }
}

// ── Conversation Settings & Organization ──────────────────────────────────────
const SETTINGS_KEY = (companyId: string, userId: string) => `nexus_chat_settings_${companyId}_${userId}`;

export function getChatSettings(companyId: string, userId: string): any {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY(companyId, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveChatSettings(companyId: string, userId: string, settings: any): void {
  try {
    localStorage.setItem(SETTINGS_KEY(companyId, userId), JSON.stringify(settings));
    emit();
  } catch {}
}

export function togglePinConversation(conversationId: string): void {
  try {
    const raw = localStorage.getItem(CONVS_KEY);
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      conv.isPinned = !conv.isPinned;
      localStorage.setItem(CONVS_KEY, JSON.stringify(all));
      emit();
    }
  } catch {}
}

export function toggleMuteConversation(conversationId: string): void {
  try {
    const raw = localStorage.getItem(CONVS_KEY);
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      conv.isMuted = !conv.isMuted;
      localStorage.setItem(CONVS_KEY, JSON.stringify(all));
      emit();
    }
  } catch {}
}

export function renameConversation(conversationId: string, newName: string): void {
  try {
    const raw = localStorage.getItem(CONVS_KEY);
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      conv.name = newName;
      conv.updatedAt = new Date().toISOString();
      localStorage.setItem(CONVS_KEY, JSON.stringify(all));
      emit();
    }
  } catch {}
}

export function clearConversationMessages(conversationId: string): void {
  try {
    localStorage.setItem(msgKey(conversationId), JSON.stringify([]));
    const raw = localStorage.getItem(CONVS_KEY);
    if (raw) {
      const all: ChatConversation[] = JSON.parse(raw);
      const conv = all.find(c => c.id === conversationId);
      if (conv) {
        conv.lastMessage = undefined;
        localStorage.setItem(CONVS_KEY, JSON.stringify(all));
      }
    }
    emit();
  } catch {}
}

export function leaveConversation(conversationId: string, userId: string): void {
  try {
    const raw = localStorage.getItem(CONVS_KEY);
    if (!raw) return;
    const all: ChatConversation[] = JSON.parse(raw);
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      conv.memberIds = conv.memberIds.filter(id => id !== userId);
      conv.members = conv.members.filter(m => m.id !== userId);
      localStorage.setItem(CONVS_KEY, JSON.stringify(all));
      emit();
    }
  } catch {}
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
        } catch {}
      }
    }
    if (updated) {
      localStorage.setItem(msgKey(conversationId), JSON.stringify(msgs));
      emit();
    }
  } catch {}
}

