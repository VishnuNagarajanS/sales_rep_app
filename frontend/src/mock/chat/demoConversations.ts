import { ChatConversation, ChatMessage } from '../../types';
import { assertMockMode } from '../runtime/mockModeGuard';
import {
  getMockGhlChatMembers,
  getMockJaminChatMembers,
  createMockGhlGroupConversation,
  createMockGhlDmConversation,
  createMockJaminDmConversation,
} from './conversationFixtures';
import {
  createMockGhlGroupMessages,
  createMockGhlDmMessages,
  createMockJaminDmMessages,
} from './messageFixtures';

export interface ChatStorageAdapter {
  getConversations: (companyId: string) => ChatConversation[];
  saveConversation: (conv: ChatConversation) => void;
  setRawMessages?: (conversationId: string, msgs: ChatMessage[]) => void;
}

export function ensureDemoConversations(
  companyId: string,
  tenantSlug: string | undefined,
  adapter: ChatStorageAdapter
): void {
  assertMockMode('ensureDemoConversations');

  const existing = adapter.getConversations(companyId);
  if (existing.length > 0) return;

  const isGhl = companyId.includes('ghl') || tenantSlug === 'ghl';
  const isJamin = companyId.includes('jamin') || tenantSlug === 'jamin';

  if (isGhl) {
    const { admin, exec } = getMockGhlChatMembers(companyId);
    const grp = createMockGhlGroupConversation(companyId, admin, exec);
    const dm = createMockGhlDmConversation(companyId, admin, exec);

    const grpMsgs = createMockGhlGroupMessages(grp.id, admin.id, admin.name, exec.id, exec.name);
    const dmMsgs = createMockGhlDmMessages(dm.id, admin.id, admin.name, exec.id, exec.name);

    adapter.saveConversation(grp);
    adapter.saveConversation(dm);
    if (adapter.setRawMessages) {
      adapter.setRawMessages(grp.id, grpMsgs);
      adapter.setRawMessages(dm.id, dmMsgs);
    }
  } else if (isJamin) {
    const { admin, exec } = getMockJaminChatMembers(companyId);
    const dm = createMockJaminDmConversation(companyId, admin, exec);
    const dmMsgs = createMockJaminDmMessages(dm.id, admin.id, admin.name, exec.id, exec.name);

    adapter.saveConversation(dm);
    if (adapter.setRawMessages) {
      adapter.setRawMessages(dm.id, dmMsgs);
    }
  }
}
