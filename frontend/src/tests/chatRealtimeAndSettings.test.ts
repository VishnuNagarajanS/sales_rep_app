import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectCategory } from '../pages/Chat/FileShareModal';
import * as cs from '../services/chatStorage';
import { playChatNotificationChime, showDesktopNotification } from '../utils/chatNotificationSound';
import { ChatSettings } from '../types';

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createStorageMock() as any;
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = createStorageMock() as any;
}

globalThis.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([]),
    text: () => Promise.resolve('[]'),
  })
) as any;

describe('Chat Realtime, Permissions & Settings Verification', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('File Attachment Category Detection', () => {
    it('correctly classifies PDF files', () => {
      expect(detectCategory('proposal.pdf', 'application/pdf')).toBe('PDF');
      expect(detectCategory('doc.PDF', '')).toBe('PDF');
    });

    it('correctly classifies image files', () => {
      expect(detectCategory('screenshot.png', 'image/png')).toBe('Image');
      expect(detectCategory('avatar.jpeg', 'image/jpeg')).toBe('Image');
      expect(detectCategory('graphic.webp', '')).toBe('Image');
    });

    it('correctly classifies spreadsheets', () => {
      expect(detectCategory('pipeline.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('Spreadsheet');
      expect(detectCategory('leads.csv', 'text/csv')).toBe('Spreadsheet');
    });

    it('correctly classifies documents', () => {
      expect(detectCategory('contract.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('Document');
      expect(detectCategory('notes.txt', 'text/plain')).toBe('Document');
    });

    it('falls back to Other for unknown extensions', () => {
      expect(detectCategory('archive.zip', 'application/zip')).toBe('Other');
    });
  });

  describe('Chat Settings & Preferences Storage', () => {
    const companyId = 'comp-test-99';
    const userId = 'user-1';

    it('returns null when no settings are stored', () => {
      const settings = cs.getChatSettings(companyId, userId);
      expect(settings).toBeNull();
    });

    it('persists and retrieves updated settings', () => {
      const newSettings: ChatSettings = {
        general: {
          theme: 'default',
          language: 'en-US',
          turnOffAnimations: false,
          outOfOfficeReply: false,
          outOfOfficeMessage: '',
        },
        notifications: {
          mentionOnly: false,
          sound: false,
          desktopPush: false,
        },
        privacy: {
          typingIndicator: false,
          readReceipts: true,
          whoCanDm: 'managers_admins',
        },
        adminGovernance: {
          whoCanCreateGroups: 'managers_admins',
          retentionDays: 90,
        },
      };

      cs.saveChatSettings(companyId, userId, newSettings);
      const fetched = cs.getChatSettings(companyId, userId);

      expect(fetched).not.toBeNull();
      expect(fetched?.notifications?.sound).toBe(false);
      expect(fetched?.privacy?.typingIndicator).toBe(false);
      expect(fetched?.privacy?.whoCanDm).toBe('managers_admins');
      expect(fetched?.adminGovernance?.whoCanCreateGroups).toBe('managers_admins');
    });
  });

  describe('Audio Chime & Desktop Push Notifications', () => {
    it('safely handles playChatNotificationChime in non-audio or muted environments', () => {
      expect(() => playChatNotificationChime()).not.toThrow();
    });

    it('safely handles showDesktopNotification without crashing', () => {
      expect(() => showDesktopNotification('Alice Smith', 'Hey team, deal closed!')).not.toThrow();
    });
  });

  describe('Chat Conversation Creation & Local Storage', () => {
    const companyId = 'comp-test-99';
    const me = { id: '1', name: 'John Admin', email: 'john@test.com', roleCode: 'company_admin', roleName: 'Admin', status: 'online' as const, companyId };
    const them = { id: '2', name: 'Sara Rep', email: 'sara@test.com', roleCode: 'sales_executive', roleName: 'Sales Rep', status: 'online' as const, companyId };

    it('creates and caches direct message conversation', () => {
      const conv = cs.getOrCreateDm(companyId, me.id, them, me);
      expect(conv.type).toBe('dm');
      expect(conv.memberIds).toContain('1');
      expect(conv.memberIds).toContain('2');

      // Calling again returns the existing conversation
      const convAgain = cs.getOrCreateDm(companyId, me.id, them, me);
      expect(convAgain.id).toBe(conv.id);
    });

    it('creates group conversation with given members', () => {
      const group = cs.createGroup(companyId, 'Alpha Squad', [me, them]);
      expect(group.type).toBe('group');
      expect(group.name).toBe('Alpha Squad');
      expect(group.memberIds).toEqual(['1', '2']);
    });
  });
});
