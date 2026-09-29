import { isMockMode } from '../../config/environment';

/**
 * Asserts that the application is running in explicit mock mode.
 * Throws an error immediately if invoked in dev/API mode, preventing any mock logic
 * or mock fixtures from leaking into real API operations.
 */
export function assertMockMode(actionName = 'Mock operation'): void {
  if (!isMockMode()) {
    throw new Error(
      `[MOCK VIOLATION] ${actionName} was attempted while running in DEV/API mode. ` +
      `Mock fixtures and mock storage are strictly forbidden outside VITE_APP_ENV=mock.`
    );
  }
}

/**
 * Returns true if mock execution is permitted.
 */
export function canRunMock(): boolean {
  return isMockMode();
}
