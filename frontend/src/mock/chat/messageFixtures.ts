import { ChatMessage } from '../../types';
import { MOCK_CHAT_ATTACHMENTS } from './attachmentFixtures';

export function createMockGhlGroupMessages(
  conversationId: string,
  adminId: string,
  adminName: string,
  execId: string,
  execName: string
): ChatMessage[] {
  return [
    {
      id: 'msg-ghl-grp-1',
      conversationId,
      senderId: adminId,
      senderName: adminName,
      content: 'Good morning team! Let’s review today’s pipeline targets.',
      isDeleted: false,
      isEdited: false,
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      reactions: [{ emoji: '👍', userId: execId, userName: execName }],
    },
    {
      id: 'msg-ghl-grp-2',
      conversationId,
      senderId: execId,
      senderName: execName,
      content: 'Morning Vikram! I have 3 consultations scheduled for the Brigade Gateway project.',
      isDeleted: false,
      isEdited: false,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      reactions: [{ emoji: '🔥', userId: adminId, userName: adminName }],
    },
    {
      id: 'msg-ghl-grp-3',
      conversationId,
      senderId: adminId,
      senderName: adminName,
      content: 'Please prioritize the HNW investor consultations today.',
      isDeleted: false,
      isEdited: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      reactions: [],
    },
  ];
}

export function createMockGhlDmMessages(
  conversationId: string,
  adminId: string,
  adminName: string,
  execId: string,
  execName: string
): ChatMessage[] {
  return [
    {
      id: 'msg-ghl-dm-1',
      conversationId,
      senderId: adminId,
      senderName: adminName,
      content: 'Hi Ananya, could you update the status on Dr. Rajesh Nambiar’s deal?',
      isDeleted: false,
      isEdited: false,
      createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
      reactions: [],
    },
    {
      id: 'msg-ghl-dm-2',
      conversationId,
      senderId: execId,
      senderName: execName,
      content: 'All documents for Dr. Rajesh Nambiar are uploaded and verified.',
      isDeleted: false,
      isEdited: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      reactions: [{ emoji: '👏', userId: adminId, userName: adminName }],
      attachments: [
        MOCK_CHAT_ATTACHMENTS.rajeshDocs,
        MOCK_CHAT_ATTACHMENTS.sitePlan,
      ],
    },
    {
      id: 'msg-ghl-dm-3',
      conversationId,
      senderId: adminId,
      senderName: adminName,
      content: `[CALL:{"type":"call","meetingId":"meet-demo-ghl","callMode":"video","status":"ended","duration":"12m 45s","hostId":"usr-ghl-admin","hostName":"Vikram Malhotra","startedAt":"${new Date(Date.now() - 1000 * 60 * 20).toISOString()}"}]`,
      isDeleted: false,
      isEdited: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      reactions: [],
    },
  ];
}

export function createMockJaminDmMessages(
  conversationId: string,
  adminId: string,
  adminName: string,
  execId: string,
  execName: string
): ChatMessage[] {
  return [
    {
      id: 'msg-jamin-dm-1',
      conversationId,
      senderId: adminId,
      senderName: adminName,
      content: 'Hi Pooja, please confirm the weekend site visits schedule.',
      isDeleted: false,
      isEdited: false,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      reactions: [],
    },
    {
      id: 'msg-jamin-dm-2',
      conversationId,
      senderId: execId,
      senderName: execName,
      content: 'The site visit for Greenfield Meadows Phase 2 is confirmed for tomorrow.',
      isDeleted: false,
      isEdited: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      reactions: [{ emoji: '✅', userId: adminId, userName: adminName }],
    },
  ];
}
