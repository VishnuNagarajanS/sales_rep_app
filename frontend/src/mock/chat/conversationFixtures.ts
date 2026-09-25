import { ChatConversation, ChatMember } from '../../types';

export function getMockGhlChatMembers(companyId: string): { admin: ChatMember; exec: ChatMember } {
  return {
    admin: {
      id: 'usr-ghl-admin',
      name: 'Vikram Malhotra',
      email: 'vikram.malhotra@ghl.com',
      roleCode: 'company_admin',
      roleName: 'Company Admin',
      companyId,
      status: 'online',
    },
    exec: {
      id: 'usr-ghl-exec',
      name: 'Ananya Iyer',
      email: 'ananya.iyer@ghl.com',
      roleCode: 'sales_executive',
      roleName: 'Sales Executive',
      companyId,
      status: 'online',
    },
  };
}

export function getMockJaminChatMembers(companyId: string): { admin: ChatMember; exec: ChatMember } {
  return {
    admin: {
      id: 'usr-jamin-admin',
      name: 'Kavita Rao',
      email: 'kavita.rao@jaminbazaar.com',
      roleCode: 'company_admin',
      roleName: 'Company Admin',
      companyId,
      status: 'online',
    },
    exec: {
      id: 'usr-jamin-exec',
      name: 'Pooja Hegde',
      email: 'pooja.hegde@jaminbazaar.com',
      roleCode: 'sales_executive',
      roleName: 'Sales Executive',
      companyId,
      status: 'online',
    },
  };
}

export function createMockGhlGroupConversation(companyId: string, admin: ChatMember, exec: ChatMember): ChatConversation {
  return {
    id: 'conv-grp-ghl-sales',
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
}

export function createMockGhlDmConversation(companyId: string, admin: ChatMember, exec: ChatMember): ChatConversation {
  return {
    id: 'conv-dm-ghl-exec-admin',
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
}

export function createMockJaminDmConversation(companyId: string, admin: ChatMember, exec: ChatMember): ChatConversation {
  return {
    id: 'conv-dm-jamin-exec-admin',
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
}
