export type AppEnvironment = 'mock' | 'dev';

/**
 * Returns the current application environment.
 * Only returns 'mock' when VITE_APP_ENV is explicitly set to 'mock'.
 * In all other cases (missing env, 'dev', production), it defaults strictly to 'dev' (real API/database mode).
 */
export function getAppEnv(): AppEnvironment {
  const envVal = import.meta.env.VITE_APP_ENV;
  if (typeof envVal === 'string' && envVal.trim().toLowerCase() === 'mock') {
    return 'mock';
  }
  return 'dev';
}

/**
 * Returns true only when explicitly running in mock/demo mode.
 */
export function isMockMode(): boolean {
  return getAppEnv() === 'mock';
}

/**
 * Returns true when running in dev/API/database mode (not mock mode).
 */
export function isDevMode(): boolean {
  return getAppEnv() === 'dev';
}

/**
 * Alias for isDevMode() - indicates real backend API mode is active.
 */
export function isApiMode(): boolean {
  return isDevMode();
}
