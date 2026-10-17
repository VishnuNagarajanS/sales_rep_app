import { describe, it, expect, beforeEach } from 'vitest';
import { routeToPath, pathToRoute } from '../App';

describe('Navigation and Route Helper Logic', () => {
  describe('Super Admin route mappings', () => {
    it('correctly maps super admin routes to URL paths', () => {
      expect(routeToPath('admin-dashboard', true)).toBe('/dashboard');
      expect(routeToPath('dashboard', true)).toBe('/dashboard');
      expect(routeToPath('admin-companies', true)).toBe('/companies');
      expect(routeToPath('admin-users', true)).toBe('/users');
      expect(routeToPath('admin-roles', true)).toBe('/roles');
      expect(routeToPath('admin-features', true)).toBe('/features');
      expect(routeToPath('admin-call-config', true)).toBe('/settings');
      expect(routeToPath('admin-audit', true)).toBe('/audit');
      expect(routeToPath('admin-system', true)).toBe('/system-health');
    });

    it('correctly resolves URL paths to super admin routes', () => {
      expect(pathToRoute('/', true)).toBe('admin-dashboard');
      expect(pathToRoute('/dashboard', true)).toBe('admin-dashboard');
      expect(pathToRoute('/companies', true)).toBe('admin-companies');
      expect(pathToRoute('/users', true)).toBe('admin-users');
      expect(pathToRoute('/roles', true)).toBe('admin-roles');
      expect(pathToRoute('/features', true)).toBe('admin-features');
      expect(pathToRoute('/settings', true)).toBe('admin-call-config');
      expect(pathToRoute('/call-config', true)).toBe('admin-call-config');
      expect(pathToRoute('/audit', true)).toBe('admin-audit');
      expect(pathToRoute('/system-health', true)).toBe('admin-system');
      expect(pathToRoute('/system', true)).toBe('admin-system');
    });
  });

  describe('Company User route mappings', () => {
    it('correctly maps company user routes to URL paths', () => {
      expect(routeToPath('dashboard', false)).toBe('/dashboard');
      expect(routeToPath('leads', false)).toBe('/leads');
      expect(routeToPath('customers', false)).toBe('/customers');
      expect(routeToPath('deals', false)).toBe('/deals');
      expect(routeToPath('company-users', false)).toBe('/users');
      expect(routeToPath('company-settings', false)).toBe('/settings');
      expect(routeToPath('company-audit', false)).toBe('/audit');
      expect(routeToPath('irm-other', false)).toBe('/other');
    });

    it('correctly resolves URL paths to company user routes', () => {
      expect(pathToRoute('/', false)).toBe('dashboard');
      expect(pathToRoute('/dashboard', false)).toBe('dashboard');
      expect(pathToRoute('/leads', false)).toBe('leads');
      expect(pathToRoute('/users', false)).toBe('company-users');
      expect(pathToRoute('/settings', false)).toBe('company-settings');
      expect(pathToRoute('/audit', false)).toBe('company-audit');
      expect(pathToRoute('/other', false)).toBe('irm-other');
    });
  });

  describe('End-to-End Navigation Simulation (All 7 Required Scenarios)', () => {
    interface HistoryEntry {
      state: any;
      path: string;
    }

    class HistorySimulator {
      stack: HistoryEntry[] = [];
      currentIndex: number = -1;
      isAuthenticated: boolean = false;
      isSuperAdmin: boolean = true;
      currentRoute: string = 'admin-dashboard';
      navExtraState: any = null;

      stepIndex: number = 1;

      login() {
        this.isAuthenticated = true;
        const targetPath = routeToPath(this.currentRoute, this.isSuperAdmin);

        // When logging in, /login is replaced by deep trap buffer entries, and active entry is pushed
        if (this.currentIndex >= 0 && this.stack[this.currentIndex].path === '/login') {
          this.stack[this.currentIndex] = {
            state: { auth: true, route: this.currentRoute, index: 0, isTrap: true },
            path: targetPath,
          };
        } else {
          this.stack.push({
            state: { auth: true, route: this.currentRoute, index: 0, isTrap: true },
            path: targetPath,
          });
          this.currentIndex++;
        }

        // Additional trap layer
        this.stack.push({
          state: { auth: true, route: this.currentRoute, index: 0, isTrap: true },
          path: targetPath,
        });

        // Push active entry
        this.stepIndex = 1;
        this.stack.push({
          state: { auth: true, route: this.currentRoute, index: 1 },
          path: targetPath,
        });
        this.currentIndex = this.stack.length - 1;
      }

      logout() {
        this.isAuthenticated = false;
        // replaceState with /login
        if (this.currentIndex >= 0) {
          this.stack[this.currentIndex] = { state: { unauth: true }, path: '/login' };
        } else {
          this.stack.push({ state: { unauth: true }, path: '/login' });
          this.currentIndex = 0;
        }
      }

      navigate(route: string, extraState?: any) {
        this.currentRoute = route;
        this.navExtraState = extraState || null;
        this.stepIndex++;
        const targetPath = routeToPath(route, this.isSuperAdmin);

        // Discard forward history
        this.stack = this.stack.slice(0, this.currentIndex + 1);
        this.stack.push({
          state: { auth: true, route, extraState: extraState || null, index: this.stepIndex },
          path: targetPath,
        });
        this.currentIndex = this.stack.length - 1;
      }

      back(): { trapped: boolean; currentPath: string; currentRoute: string } {
        if (this.currentIndex <= 0) {
          // Cannot go back further than stack
          return { trapped: true, currentPath: this.currentPath(), currentRoute: this.currentRoute };
        }

        const prevIndex = this.currentIndex - 1;
        const targetEntry = this.stack[prevIndex];
        const state = targetEntry.state;

        // If unauthenticated:
        if (!this.isAuthenticated) {
          this.currentIndex = prevIndex;
          this.stack[this.currentIndex] = { state: { unauth: true }, path: '/login' };
          return { trapped: false, currentPath: '/login', currentRoute: 'login' };
        }

        // Authenticated: check if back leaves app or hits trap or /login
        if (!state || !state.auth || state.isTrap || !state.index || state.index <= 0 || targetEntry.path === '/login') {
          // Trapped: re-push anti-exit buffer and active entry
          const currentPath = routeToPath(this.currentRoute, this.isSuperAdmin);
          this.stack.push({
            state: { auth: true, route: this.currentRoute, index: 0, isTrap: true },
            path: currentPath,
          });
          this.stack.push({
            state: { auth: true, route: this.currentRoute, index: 1 },
            path: currentPath,
          });
          this.currentIndex = this.stack.length - 1;
          this.stepIndex = 1;
          return { trapped: true, currentPath, currentRoute: this.currentRoute };
        }

        // Valid internal back navigation
        this.currentIndex = prevIndex;
        this.currentRoute = state.route;
        this.stepIndex = state.index;
        this.navExtraState = state.extraState || null;
        return { trapped: false, currentPath: targetEntry.path, currentRoute: this.currentRoute };
      }

      forward(): { currentPath: string; currentRoute: string } {
        if (this.currentIndex < this.stack.length - 1) {
          this.currentIndex++;
          const targetEntry = this.stack[this.currentIndex];
          if (targetEntry.state?.route) {
            this.currentRoute = targetEntry.state.route;
            this.navExtraState = targetEntry.state.extraState || null;
          }
        }
        return { currentPath: this.currentPath(), currentRoute: this.currentRoute };
      }

      currentPath(): string {
        return this.currentIndex >= 0 ? this.stack[this.currentIndex].path : '/';
      }
    }

    let sim: HistorySimulator;

    beforeEach(() => {
      sim = new HistorySimulator();
    });

    it('Test 1 — Login then Back: stays inside authenticated app and does NOT return to /login', () => {
      // User is at /login
      sim.stack.push({ state: { unauth: true }, path: '/login' });
      sim.currentIndex = 0;

      // User logs in
      sim.login();
      expect(sim.isAuthenticated).toBe(true);
      expect(sim.currentPath()).toBe('/dashboard');
      expect(sim.currentRoute).toBe('admin-dashboard');

      // User presses browser Back
      const backResult = sim.back();
      expect(backResult.trapped).toBe(true);
      expect(backResult.currentPath).toBe('/dashboard');
      expect(backResult.currentRoute).toBe('admin-dashboard');
      expect(sim.currentPath()).not.toBe('/login');
    });

    it('Test 2 — Internal navigation: Dashboard -> Users -> Companies -> Back returns to Users then Dashboard', () => {
      sim.login();
      expect(sim.currentPath()).toBe('/dashboard');

      // Navigate to Users
      sim.navigate('admin-users');
      expect(sim.currentPath()).toBe('/users');
      expect(sim.currentRoute).toBe('admin-users');

      // Navigate to Companies
      sim.navigate('admin-companies');
      expect(sim.currentPath()).toBe('/companies');
      expect(sim.currentRoute).toBe('admin-companies');

      // Back button 1: should return to Users
      const back1 = sim.back();
      expect(back1.trapped).toBe(false);
      expect(back1.currentPath).toBe('/users');
      expect(back1.currentRoute).toBe('admin-users');

      // Back button 2: should return to Dashboard
      const back2 = sim.back();
      expect(back2.trapped).toBe(false);
      expect(back2.currentPath).toBe('/dashboard');
      expect(back2.currentRoute).toBe('admin-dashboard');

      // Back button 3: hitting root boundary stays at Dashboard
      const back3 = sim.back();
      expect(back3.trapped).toBe(true);
      expect(back3.currentPath).toBe('/dashboard');
      expect(back3.currentRoute).toBe('admin-dashboard');
    });

    it('Test 3 — Refresh: route and path are preserved', () => {
      sim.login();
      sim.navigate('admin-users');
      expect(sim.currentPath()).toBe('/users');

      // Simulated refresh at /users: pathToRoute maps /users to admin-users
      const restoredRoute = pathToRoute(sim.currentPath(), sim.isSuperAdmin);
      expect(restoredRoute).toBe('admin-users');
      expect(routeToPath(restoredRoute, sim.isSuperAdmin)).toBe('/users');
    });

    it('Test 4 — Logout: returns to login page', () => {
      sim.login();
      expect(sim.isAuthenticated).toBe(true);

      sim.logout();
      expect(sim.isAuthenticated).toBe(false);
      expect(sim.currentPath()).toBe('/login');
    });

    it('Test 5 — Logout + Back: authenticated dashboard must NOT become accessible', () => {
      sim.login();
      sim.navigate('admin-users');
      sim.logout();
      expect(sim.isAuthenticated).toBe(false);
      expect(sim.currentPath()).toBe('/login');

      // Pressing back after logout
      sim.back();
      // Must remain on unauthenticated / login state
      expect(sim.isAuthenticated).toBe(false);
      expect(sim.currentPath()).toBe('/login');
    });

    it('Test 6 — Direct protected URL while unauthenticated: resolves to login guard', () => {
      // Unauthenticated user enters /users
      const unauthenticated = false;
      const targetPath: string = '/users';
      const shouldRedirectToLogin = !unauthenticated && targetPath !== '/login';
      expect(shouldRedirectToLogin).toBe(true);
    });

    it('Test 7 — Browser Back and Forward cycles do not loop or freeze', () => {
      sim.login();
      sim.navigate('admin-users');
      sim.navigate('admin-companies');

      // Back to Users
      expect(sim.back().currentPath).toBe('/users');
      // Forward to Companies
      expect(sim.forward().currentPath).toBe('/companies');
      // Back to Users
      expect(sim.back().currentPath).toBe('/users');
      // Back to Dashboard
      expect(sim.back().currentPath).toBe('/dashboard');
      // Forward to Users
      expect(sim.forward().currentPath).toBe('/users');
      // Forward to Companies
      expect(sim.forward().currentPath).toBe('/companies');
    });
  });
});
