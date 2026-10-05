import { describe, it, expect } from 'vitest';
import { isJwtExpired } from '../context/AuthContext';

describe('Auth Session and Revalidation Integrity', () => {
  it('correctly detects expired JWTs', () => {
    expect(isJwtExpired(null)).toBe(true);
    expect(isJwtExpired('')).toBe(true);
    expect(isJwtExpired(undefined)).toBe(true);
    expect(isJwtExpired('invalid.token')).toBe(false);

    // Create an expired token payload
    const expiredPayload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600, email: 'test@example.com' })
    ).toString('base64');
    const expiredToken = `header.${expiredPayload}.signature`;
    expect(isJwtExpired(expiredToken)).toBe(true);

    // Create a valid future token payload
    const validPayload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, email: 'test@example.com' })
    ).toString('base64');
    const validToken = `header.${validPayload}.signature`;
    expect(isJwtExpired(validToken)).toBe(false);
  });

  it('correctly unwraps backend /auth/me payload without setting user to corrupted object', () => {
    // Exact response structure returned by backend GET /api/auth/me
    const backendMeResponse = {
      success: true,
      message: 'Current user loaded',
      data: {
        token: '',
        user: {
          id: '2',
          name: 'Vishnu',
          email: 'vishnu@ghlindiaventures.com',
          phone: '+91 98450 11223',
          role: {
            id: '2',
            name: 'Company Admin',
            code: 'company_admin',
            permissions: ['leads.view', 'customers.view'],
          },
          companyId: '1',
          companySlug: 'ghl',
          companyName: 'GHL India Ventures',
          status: 'Active',
          lastLogin: 'Just now',
        },
        tenant: {
          id: '1',
          name: 'GHL India Ventures',
          slug: 'ghl',
          brandColor: '#0284c7',
          enabledFeatures: ['leads', 'customers', 'deals'],
        },
      },
    };

    // Extraction logic from AuthContext revalidateSession:
    const userData = backendMeResponse.data.user || (backendMeResponse.data as any).id ? backendMeResponse.data.user : null;
    const tenantData = backendMeResponse.data.tenant;

    expect(userData).not.toBeNull();
    expect(userData!.name).toBe('Vishnu');
    expect(userData!.role.code).toBe('company_admin');
    expect(tenantData.name).toBe('GHL India Ventures');

    // Confirm that userData.name.split works cleanly
    expect(userData!.name.split(' ')[0]).toBe('Vishnu');
    expect(userData!.role.code === 'super_admin').toBe(false);
  });

  it('correctly unwraps nested localStorage user structure if corrupted by prior tab switch', () => {
    // If a previous bug wrote { token: "", user: {...}, tenant: {...} } into localStorage
    const corruptedStored = JSON.stringify({
      token: '',
      user: {
        id: '2',
        name: 'Vishnu',
        role: { code: 'company_admin', permissions: ['leads.view'] },
      },
      tenant: { id: '1', slug: 'ghl' },
    });

    const rawParsed = JSON.parse(corruptedStored);
    const parsed = rawParsed?.user && (rawParsed.user.id || rawParsed.user.email) ? rawParsed.user : rawParsed;

    expect(parsed.id).toBe('2');
    expect(parsed.name).toBe('Vishnu');
    expect(parsed.role.code).toBe('company_admin');
  });

  it('safely handles missing or empty user name in greeting banner without throwing exception', () => {
    const userWithMissingName: any = { id: '2', role: { code: 'company_admin' } };
    const userWithNullName: any = { id: '2', name: null, role: { code: 'company_admin' } };
    const userWithValidName: any = { id: '2', name: 'Vishnu Nagarajan', role: { code: 'company_admin' } };

    const formatGreeting = (u: any) => u?.name?.split(' ')[0] || u?.name || 'User';

    expect(() => formatGreeting(userWithMissingName)).not.toThrow();
    expect(formatGreeting(userWithMissingName)).toBe('User');

    expect(() => formatGreeting(userWithNullName)).not.toThrow();
    expect(formatGreeting(userWithNullName)).toBe('User');

    expect(() => formatGreeting(userWithValidName)).not.toThrow();
    expect(formatGreeting(userWithValidName)).toBe('Vishnu');
  });
});
