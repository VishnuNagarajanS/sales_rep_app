import { assertMockMode } from './mockModeGuard';
import { MOCK_STORAGE_KEYS } from '../shared/mockStorageKeys';
import { MOCK_TENANTS } from '../tenants/tenantFixtures';
import { MOCK_USERS } from '../users/userFixtures';
import { INITIAL_LEADS } from '../data/leadFixtures';
import { INITIAL_CUSTOMERS } from '../data/customerFixtures';
import { INITIAL_DEALS } from '../data/dealFixtures';
import { INITIAL_CALLS } from '../data/callFixtures';
import { INITIAL_FOLLOWUPS } from '../data/followupFixtures';
import { INITIAL_PROJECTS } from '../data/projectFixtures';
import { INITIAL_PLOTS } from '../data/plotFixtures';
import { INITIAL_SITE_VISITS } from '../data/siteVisitFixtures';
import { INITIAL_BOOKINGS } from '../data/bookingFixtures';
import { INITIAL_INVESTORS } from '../data/investorFixtures';
import { INITIAL_CONSULTATIONS } from '../data/consultationFixtures';
import { INITIAL_OPPORTUNITIES } from '../data/opportunityFixtures';
import { INITIAL_AUDIT_LOGS } from '../data/auditLogFixtures';
import { INITIAL_NOTIFICATIONS } from '../data/notificationFixtures';
import { INITIAL_CUSTOM_FIELD_DEFINITIONS } from '../features/customFieldFixtures';

/**
 * Idempotent, tenant-aware mock initialization.
 * Only runs in mock mode. Never runs in dev mode.
 */
export function mockBootstrap(force: boolean = false): void {
  assertMockMode('mockBootstrap');

  if (typeof window === 'undefined' || !window.localStorage) return;

  const initialized = localStorage.getItem(MOCK_STORAGE_KEYS.BOOTSTRAP_DONE);
  if (initialized && !force) {
    return;
  }

  // Populate mock keys
  const setIfNotPresent = (key: string, value: any) => {
    if (force || localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  setIfNotPresent(MOCK_STORAGE_KEYS.TENANTS, Object.values(MOCK_TENANTS));
  setIfNotPresent(MOCK_STORAGE_KEYS.USERS, MOCK_USERS);
  setIfNotPresent(MOCK_STORAGE_KEYS.LEADS, INITIAL_LEADS);
  setIfNotPresent(MOCK_STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  setIfNotPresent(MOCK_STORAGE_KEYS.DEALS, INITIAL_DEALS);
  setIfNotPresent(MOCK_STORAGE_KEYS.CALLS, INITIAL_CALLS);
  setIfNotPresent(MOCK_STORAGE_KEYS.FOLLOWUPS, INITIAL_FOLLOWUPS);
  setIfNotPresent(MOCK_STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
  setIfNotPresent(MOCK_STORAGE_KEYS.PLOTS, INITIAL_PLOTS);
  setIfNotPresent(MOCK_STORAGE_KEYS.SITE_VISITS, INITIAL_SITE_VISITS);
  setIfNotPresent(MOCK_STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
  setIfNotPresent(MOCK_STORAGE_KEYS.INVESTORS, INITIAL_INVESTORS);
  setIfNotPresent(MOCK_STORAGE_KEYS.CONSULTATIONS, INITIAL_CONSULTATIONS);
  setIfNotPresent(MOCK_STORAGE_KEYS.OPPORTUNITIES, INITIAL_OPPORTUNITIES);
  setIfNotPresent(MOCK_STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  setIfNotPresent(MOCK_STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  setIfNotPresent(MOCK_STORAGE_KEYS.CUSTOM_FIELD_DEFINITIONS, INITIAL_CUSTOM_FIELD_DEFINITIONS);

  localStorage.setItem(MOCK_STORAGE_KEYS.BOOTSTRAP_DONE, 'true');
  window.dispatchEvent(new Event('nexus_storage_updated'));
  window.dispatchEvent(new Event('nexus_mock_storage_updated'));
}
