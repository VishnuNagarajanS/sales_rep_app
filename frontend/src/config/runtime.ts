export type AppEnvironment = 'mock' | 'development';

const configuredEnvironment = import.meta.env.VITE_APP_ENV;

export const APP_ENV: AppEnvironment = configuredEnvironment === 'mock' ? 'mock' : 'development';
export const IS_MOCK_ENV = APP_ENV === 'mock';
export const IS_DEVELOPMENT_ENV = APP_ENV === 'development';
