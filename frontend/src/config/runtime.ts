export type AppEnvironment = 'mock' | 'development';

const configuredEnvironment = import.meta.env.VITE_APP_ENV;
const mockHosts = (import.meta.env.VITE_MOCK_HOSTS || '')
	.split(',')
	.map((host: string) => host.trim())
	.filter(Boolean);
const isMockHost = typeof window !== 'undefined' && mockHosts.includes(window.location.hostname);

export const APP_ENV: AppEnvironment = configuredEnvironment === 'mock' || isMockHost ? 'mock' : 'development';
export const IS_MOCK_ENV = APP_ENV === 'mock';
export const IS_DEVELOPMENT_ENV = APP_ENV === 'development';
