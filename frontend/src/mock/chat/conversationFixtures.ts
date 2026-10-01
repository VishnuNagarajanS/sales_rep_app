import { ChatConversation, ChatMember } from '../../types';

export const GHL_CHAT_ADMIN: ChatMember = {
  id: 'usr-ghl-admin',
  name: 'Vishnu',
  email: 'vishnu@ghlindiaventures.com',
  roleCode: 'company_admin',
  roleName: 'Company Admin',
  companyId: 't-ghl-01',
  status: 'online',
};

export const GHL_CHAT_EXEC: ChatMember = {
  id: 'usr-ghl-exec',
  name: 'Naveen',
  email: 'naveen@ghlindiaventures.com',
  roleCode: 'sales_executive',
  roleName: 'Sales Executive',
  companyId: 't-ghl-01',
  status: 'online',
};

export const JAMIN_CHAT_ADMIN: ChatMember = {
  id: 'usr-jamin-admin',
  name: 'Mani',
  email: 'mani@ghlindiaventures.com',
  roleCode: 'company_admin',
  roleName: 'Company Admin',
  companyId: 't-jamin-02',
  status: 'online',
};

export const GHL_GROUP_CONVERSATION: ChatConversation = {
  id: 'conv-grp-ghl-sales',
  companyId: 't-ghl-01',
  type: 'group',
  name: 'GHL Sales Strategy',
  memberIds: [GHL_CHAT_ADMIN.id, GHL_CHAT_EXEC.id],
  members: [GHL_CHAT_ADMIN, GHL_CHAT_EXEC],
  unreadCount: 0,
  createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  lastMessage: {
    content: 'Please prioritize the HNW investor consultations today.',
    senderName: 'Vishnu',
    isDeleted: false,
  },
};

export const GHL_DM_CONVERSATION: ChatConversation = {
  id: 'conv-dm-ghl-exec-admin',
  companyId: 't-ghl-01',
  type: 'dm',
  memberIds: [GHL_CHAT_ADMIN.id, GHL_CHAT_EXEC.id],
  members: [GHL_CHAT_ADMIN, GHL_CHAT_EXEC],
  unreadCount: 0,
  createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  lastMessage: {
    content: 'All documents for Dr. Rajesh Nambiar are uploaded and verified.',
    senderName: 'Naveen',
    isDeleted: false,
  },
};
