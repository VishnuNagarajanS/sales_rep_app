import { isMockMode } from './mockConfig';

export class MockModeViolationError extends Error {
  constructor(featureName: string) {
    super(
      `[SECURITY/INTEGRITY] Mock feature "${featureName}" was invoked outside of mock environment (current environment: dev). Mock data and mock adapters are strictly forbidden in dev/api mode.`
    );
    this.name = 'MockModeViolationError';
  }
}

export function assertMockMode(featureName: string): void {
  if (!isMockMode()) {
    throw new MockModeViolationError(featureName);
  }
}
