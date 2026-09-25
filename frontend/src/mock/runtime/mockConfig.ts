/**
 * Environment configuration and mode detection.
 *
 * Rules:
 * - VITE_APP_ENV=mock explicitly activates mock mode.
 * - Missing or any other value defaults to dev/real API mode.
 * - NODE_ENV is never used to infer mock mode.
 */

export type AppEnvironment = 'mock' | 'dev';

export function getAppEnvironment(): AppEnvironment {
  const envVal = import.meta.env.VITE_APP_ENV;
  if (typeof envVal === 'string' && envVal.toLowerCase().trim() === 'mock') {
    return 'mock';
  }
  return 'dev';
}

export function isMockMode(): boolean {
  return getAppEnvironment() === 'mock';
}

export function isDevMode(): boolean {
  return getAppEnvironment() === 'dev';
}

export function isApiMode(): boolean {
  return isDevMode();
}
