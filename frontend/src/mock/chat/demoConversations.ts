import { ChatConversation, ChatMessage } from '../../types';
import {
  GHL_GROUP_CONVERSATION,
  GHL_DM_CONVERSATION,
} from './conversationFixtures';
import {
  GHL_GROUP_MESSAGES,
  GHL_DM_MESSAGES,
} from './messageFixtures';

export {
  GHL_GROUP_CONVERSATION,
  GHL_DM_CONVERSATION,
  GHL_GROUP_MESSAGES,
  GHL_DM_MESSAGES,
};

export interface DemoChatBootstrapResult {
  conversations: ChatConversation[];
  messagesByConversationId: Record<string, ChatMessage[]>;
}

export function getDemoChatData(companyId: string, tenantSlug?: string): DemoChatBootstrapResult | null {
  const isGhl = companyId.includes('ghl') || tenantSlug === 'ghl';

  if (isGhl) {
    return {
      conversations: [GHL_GROUP_CONVERSATION, GHL_DM_CONVERSATION],
      messagesByConversationId: {
        [GHL_GROUP_CONVERSATION.id]: GHL_GROUP_MESSAGES,
        [GHL_DM_CONVERSATION.id]: GHL_DM_MESSAGES,
      },
    };
  }

  return null;
}
