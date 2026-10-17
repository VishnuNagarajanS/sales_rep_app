export type AppEnvironment = 'dev' | 'prod';

/**
 * Returns the current application environment.
 * Always targets real backend API and database operations.
 */
export function getAppEnv(): AppEnvironment {
  return 'dev';
}

/**
 * Returns false - mock mode is completely removed; all data is fetched from backend.
 */
export function isMockMode(): boolean {
  return false;
}

/**
 * Returns true when running in real API / database mode.
 */
export function isDevMode(): boolean {
  return true;
}

/**
 * Alias for isDevMode() - indicates real backend API mode is active.
 */
export function isApiMode(): boolean {
  return true;
}
