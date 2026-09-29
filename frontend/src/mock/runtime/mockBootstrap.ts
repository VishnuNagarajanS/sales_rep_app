import { assertMockMode } from './mockModeGuard';
import { MOCK_STORAGE_KEYS, mockMsgKey } from '../shared/mockStorageKeys';
import { MOCK_TENANTS } from '../tenants/tenantFixtures';
import { MOCK_ROLES } from '../roles/roleFixtures';
import { MOCK_USERS } from '../users/userFixtures';
import { INITIAL_CUSTOM_FIELD_DEFINITIONS } from '../features/customFieldFixtures';
import { INITIAL_LEADS } from '../data/leadFixtures';
import { INITIAL_CUSTOMERS } from '../data/customerFixtures';
import { INITIAL_DEALS } from '../data/dealFixtures';
import { INITIAL_CALLS } from '../data/callFixtures';
import { INITIAL_ADMIN_FOLLOWUPS } from '../data/followupFixtures';
import { INITIAL_PROJECTS } from '../data/projectFixtures';
import { INITIAL_PLOTS } from '../data/plotFixtures';
import { INITIAL_SITE_VISITS } from '../data/siteVisitFixtures';
import { INITIAL_BOOKINGS } from '../data/bookingFixtures';
import { INITIAL_INVESTORS } from '../data/investorFixtures';
import { INITIAL_CONSULTATIONS } from '../data/consultationFixtures';
import { INITIAL_OPPORTUNITIES } from '../data/opportunityFixtures';
import { INITIAL_NOTIFICATIONS } from '../data/notificationFixtures';
import { INITIAL_AUDIT_LOGS } from '../data/auditLogFixtures';
import { INITIAL_ADMIN_KANBAN_CARDS } from '../data/kanbanFixtures';
import {
  GHL_GROUP_CONVERSATION,
  GHL_DM_CONVERSATION,
  JAMIN_DM_CONVERSATION,
  GHL_GROUP_MESSAGES,
  GHL_DM_MESSAGES,
  JAMIN_DM_MESSAGES,
} from '../chat/demoConversations';
import { mockStorageAdapter } from './mockStorageAdapter';
import { registerMockStorageAdapter, registerMockBootstrapRunner } from '../../services/storageService';
import { mockKycProvider } from '../data/kycFixtures';
import { registerMockKycProvider } from '../../services/kycService';
import { registerMockAuthProvider } from '../../context/AuthContext';
import { getDemoChatData } from '../chat/demoConversations';
import { registerDemoChatLoader } from '../../services/chatStorage';

// Wire up all mock adapters immediately when mock module is loaded in mock mode
registerMockStorageAdapter(mockStorageAdapter);
registerMockKycProvider(mockKycProvider);
registerMockAuthProvider({
  getRoles: () => MOCK_ROLES,
  getTenants: () => MOCK_TENANTS,
});
registerDemoChatLoader(getDemoChatData);

/**
 * Idempotently initializes mock localStorage fixtures.
 * Only executes in mock mode. Safe to run repeatedly.
 */
export function runMockBootstrap(force = false): void {
  assertMockMode('runMockBootstrap');

  try {
    const isBootstrapped = localStorage.getItem(MOCK_STORAGE_KEYS.BOOTSTRAPPED);
    if (isBootstrapped && !force) {
      return;
    }

    const setIfMissing = (key: string, data: any) => {
      if (force || !localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(data));
      }
    };

    // 1. Tenants, Roles, Users
    setIfMissing(MOCK_STORAGE_KEYS.TENANTS, Object.values(MOCK_TENANTS));
    setIfMissing(MOCK_STORAGE_KEYS.ROLES, Object.values(MOCK_ROLES));
    setIfMissing(MOCK_STORAGE_KEYS.USERS, MOCK_USERS);
    setIfMissing(MOCK_STORAGE_KEYS.CUSTOM_FIELDS, INITIAL_CUSTOM_FIELD_DEFINITIONS);

    // 2. Business entities
    setIfMissing(MOCK_STORAGE_KEYS.LEADS, INITIAL_LEADS);
    setIfMissing(MOCK_STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    setIfMissing(MOCK_STORAGE_KEYS.DEALS, INITIAL_DEALS);
    setIfMissing(MOCK_STORAGE_KEYS.CALLS, INITIAL_CALLS);
    setIfMissing(MOCK_STORAGE_KEYS.FOLLOWUPS, INITIAL_ADMIN_FOLLOWUPS);
    setIfMissing(MOCK_STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
    setIfMissing(MOCK_STORAGE_KEYS.PLOTS, INITIAL_PLOTS);
    setIfMissing(MOCK_STORAGE_KEYS.SITE_VISITS, INITIAL_SITE_VISITS);
    setIfMissing(MOCK_STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
    setIfMissing(MOCK_STORAGE_KEYS.INVESTORS, INITIAL_INVESTORS);
    setIfMissing(MOCK_STORAGE_KEYS.CONSULTATIONS, INITIAL_CONSULTATIONS);
    setIfMissing(MOCK_STORAGE_KEYS.OPPORTUNITIES, INITIAL_OPPORTUNITIES);
    setIfMissing(MOCK_STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    setIfMissing(MOCK_STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    setIfMissing(MOCK_STORAGE_KEYS.ADMIN_KANBAN_CARDS, INITIAL_ADMIN_KANBAN_CARDS);

    // 3. Demo Chat Conversations and Messages
    const chatConversations = [
      GHL_GROUP_CONVERSATION,
      GHL_DM_CONVERSATION,
      JAMIN_DM_CONVERSATION,
    ];
    setIfMissing(MOCK_STORAGE_KEYS.CHAT_CONVERSATIONS, chatConversations);
    setIfMissing(mockMsgKey(GHL_GROUP_CONVERSATION.id), GHL_GROUP_MESSAGES);
    setIfMissing(mockMsgKey(GHL_DM_CONVERSATION.id), GHL_DM_MESSAGES);
    setIfMissing(mockMsgKey(JAMIN_DM_CONVERSATION.id), JAMIN_DM_MESSAGES);

    localStorage.setItem(MOCK_STORAGE_KEYS.BOOTSTRAPPED, 'true');
  } catch (error) {
    console.error('Failed to run mock bootstrap:', error);
  }
}

registerMockBootstrapRunner(runMockBootstrap);

/**
 * Resets all mock data back to factory defaults.
 */
export function resetMockData(): void {
  assertMockMode('resetMockData');
  Object.values(MOCK_STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  runMockBootstrap(true);
}
