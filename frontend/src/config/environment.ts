export type AppEnvironment = 'dev' | 'prod';

/**
 * Returns the current application environment.
 * Always targets real backend API and database operations.
 */
export function getAppEnv(): AppEnvironment {
  return import.meta.env.PROD ? 'prod' : 'dev';
}

/**
 * Returns false. Mock runtime is fully decommissioned in favor of live API integration.
 */
export function isMockMode(): boolean {
  return false;
}

/**
 * Returns true when running in Vite development mode.
 */
export function isDevMode(): boolean {
  return import.meta.env.DEV;
}

/**
 * Alias for isDevMode() - indicates real backend API mode is active.
 */
export function isApiMode(): boolean {
  return true;
}
