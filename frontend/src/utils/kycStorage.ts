/**
 * Local (browser) cache helpers for KYC form data.
 *
 * Government IDs, bank/demat account numbers and date of birth must NEVER be written to
 * localStorage in plaintext: it survives logout and is readable by anyone using the same browser
 * profile. The backend (assisted-draft / submit endpoints) is the source of truth for those fields.
 */

const DATA_PREFIX = 'nexus_kyc_data_';

export const SENSITIVE_KYC_FIELDS = [
  'panNumber',
  'aadhaarNumber',
  'accountNumber',
  'bankAccountNumber',
  'dematAccountNumber',
  'dematClientId',
  'dematDpId',
  'dob',
] as const;

export function stripSensitiveKycFields<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  const copy: Record<string, any> = { ...data };
  for (const key of SENSITIVE_KYC_FIELDS) delete copy[key];
  return copy as T;
}

/** Saves non-sensitive KYC form fields for a deal. Sensitive fields are dropped. */
export function saveKycLocal(dealId: string | number, data: Record<string, any>): void {
  try {
    localStorage.setItem(`${DATA_PREFIX}${dealId}`, JSON.stringify(stripSensitiveKycFields(data)));
  } catch (err) {
    console.warn('[kycStorage] could not cache KYC form locally:', err);
  }
}

function forEachKycKey(fn: (key: string) => void): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DATA_PREFIX)) keys.push(k);
    }
    keys.forEach(fn);
  } catch (err) {
    console.warn('[kycStorage] could not enumerate local KYC cache:', err);
  }
}

/** One-time clean-up for data written by older versions: strips sensitive fields from existing entries. */
export function sanitizeStoredKycData(): void {
  forEachKycKey(key => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        localStorage.setItem(key, JSON.stringify(stripSensitiveKycFields(parsed)));
      }
    } catch {
      localStorage.removeItem(key); // unreadable entry: drop it
    }
  });
}

/** Removes all locally cached KYC keys (drafts, forms, assisted metadata, statuses) across the app. */
export function clearAllKycLocalStorage(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('nexus_kyc_')) {
        keys.push(k);
      }
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.warn('[kycStorage] could not clear local KYC storage:', err);
  }
}

/** Removes all locally cached KYC form data (call on logout). */
export function clearKycLocalData(): void {
  clearAllKycLocalStorage();
}

