import React, { useState, useEffect, useRef } from 'react';

export const routeToPath = (route: string, isSuperAdmin: boolean): string => {
  if (isSuperAdmin) {
    switch (route) {
      case 'admin-dashboard':
      case 'dashboard':
        return '/dashboard';
      case 'admin-companies':
        return '/companies';
      case 'admin-users':
        return '/users';
      case 'admin-roles':
        return '/roles';
      case 'admin-features':
        return '/features';
      case 'admin-call-config':
        return '/settings';
      case 'admin-audit':
        return '/audit';
      case 'admin-security':
        return '/security';
      case 'admin-system':
        return '/system-health';
      default:
        return '/dashboard';
    }
  } else {
    switch (route) {
      case 'dashboard':
        return '/dashboard';
      case 'company-users':
        return '/users';
      case 'leave-requests':
        return '/leave-requests';
      case 'work-handover':
        return '/handover';
      case 'company-settings':
        return '/settings';
      case 'company-audit':
        return '/audit';
      case 'irm-other':
      case 'other':
        return '/other';
      default:
        return `/${route}`;
    }
  }
};

export const pathToRoute = (pathname: string, isSuperAdmin: boolean): string => {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  if (cleanPath === '/' || cleanPath === '/dashboard') {
    return isSuperAdmin ? 'admin-dashboard' : 'dashboard';
  }
  if (isSuperAdmin) {
    switch (cleanPath) {
      case '/companies':
        return 'admin-companies';
      case '/users':
        return 'admin-users';
      case '/roles':
        return 'admin-roles';
      case '/features':
        return 'admin-features';
      case '/settings':
      case '/call-config':
        return 'admin-call-config';
      case '/audit':
        return 'admin-audit';
      case '/security':
        return 'admin-security';
      case '/system-health':
      case '/system':
        return 'admin-system';
      default:
        return 'admin-dashboard';
    }
  } else {
    switch (cleanPath) {
      case '/users':
        return 'company-users';
      case '/leave-requests':
        return 'leave-requests';
      case '/handover':
      case '/work-handover':
        return 'work-handover';
      case '/settings':
        return 'company-settings';
      case '/audit':
        return 'company-audit';
      case '/other':
        return 'irm-other';
      default: {
        const seg = cleanPath.slice(1);
        return seg || 'dashboard';
      }
    }
  }
};
import { useAuth } from './context/AuthContext';
import { AuthLayout } from './layouts/AuthLayout';
import { SalesLayout } from './layouts/SalesLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Sales Core Pages
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { LeadsPage } from './pages/Leads/LeadsPage';
import { CustomersPage } from './pages/Customers/CustomersPage';
import { PipelinePage } from './pages/Pipeline/PipelinePage';
import { DealsPage } from './pages/Deals/DealsPage';
import { FollowupsPage } from './pages/Followups/FollowupsPage';
import { CallCenterPage } from './pages/CallCenter/CallCenterPage';
import { CallHistoryPage } from './pages/CallHistory/CallHistoryPage';
import { CallSettingsPage } from './pages/CallSettings/CallSettingsPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { NotificationsPage } from './pages/Notifications/NotificationsPage';
import { NotInterestedPage } from './pages/NotInterested/NotInterestedPage';
import { JunkPage } from './pages/Junk/JunkPage';
import { ChatPage } from './pages/Chat/ChatPage';
import { ProfilePage } from './pages/Profile/ProfilePage';

const PlaceholderPage = ({ title }: { title: string }) => (
  <div style={{ padding: 24, textAlign: 'center' }}>
    <h2>{title}</h2>
    <p>This module is coming soon.</p>
  </div>
);

// Tenant Specific: Jamin
import { ProjectsPage } from './pages/Properties/ProjectsPage';
import { PlotsPage } from './pages/Plots/PlotsPage';
import { SiteVisitsPage } from './pages/SiteVisits/SiteVisitsPage';
import { BookingsPage } from './pages/Bookings/BookingsPage';

// Tenant Specific: GHL
import { InvestorsPage } from './pages/Investors/InvestorsPage';
import { ConsultationsPage } from './pages/Consultations/ConsultationsPage';
import { OpportunitiesPage } from './pages/InvestmentOpportunities/OpportunitiesPage';
import { AssignedLeadsPage } from './pages/AssignedLeads/AssignedLeadsPage';
import { PendingLeadsPage } from './pages/PendingLeads/PendingLeadsPage';
import { ArchivedLeadsPage } from './pages/ArchivedLeads/ArchivedLeadsPage';
import { KYCPage } from './pages/KYC/KYCPage';
import { IrmOtherPage } from './pages/IrmOther/IrmOtherPage';
import { AllLeadsPage } from './pages/Irm/AllLeadsPage';

// Company Admin
import { CompanyUsersPage } from './pages/Company/CompanyUsersPage';
import { LeaveRequestsPage } from './pages/Company/LeaveRequestsPage';
import { WorkHandoverPage } from './pages/Company/WorkHandoverPage';
import { CompanySettingsPage } from './pages/Company/CompanySettingsPage';
import { CompanyAuditPage } from './pages/Company/CompanyAuditPage';
import { SmartyAIPage } from './pages/AI/SmartyAIPage';

// Super Admin Platform Pages
import { PlatformDashboardPage } from './pages/Admin/Dashboard/PlatformDashboardPage';
import { CompaniesPage } from './pages/Admin/Companies/CompaniesPage';
import { PlatformUsersPage } from './pages/Admin/Users/PlatformUsersPage';
import { PlatformRolesPage } from './pages/Admin/Roles/PlatformRolesPage';
import { PlatformFeaturesPage } from './pages/Admin/Features/PlatformFeaturesPage';
import { PlatformCallConfigPage } from './pages/Admin/CallConfig/PlatformCallConfigPage';
import { PlatformAuditPage } from './pages/Admin/Audit/PlatformAuditPage';
import { PlatformSystemPage } from './pages/Admin/System/PlatformSystemPage';
import { PlatformSecurityPage } from './pages/Admin/Security/PlatformSecurityPage';
import { signalRService } from './services/signalRService';

import { ProtectedRoute } from './components/common/Guards';
import { Modal } from './components/common/Modal';
import { storageService } from './services/storageService';
import { Investor, Customer } from './types';
import {
  saveLead as apiSaveLead,
  saveFollowup as apiSaveFollowup,
  saveConsultation as apiSaveConsultation,
  saveDeal as apiSaveDeal,
  saveCustomer as apiSaveCustomer,
  getInvestors as apiGetInvestors,
  getCustomers as apiGetCustomers,
} from './services/ghlApiService';
import { PERMISSIONS } from './constants/permissions';
import { useNavigationGuard, useUnsavedChanges } from './context/NavigationGuardContext';
import './App.css';

export const App: React.FC = () => {
  useEffect(() => {
    localStorage.removeItem('nexus_dev_deals');
    localStorage.removeItem('nexus_dev_leads');
  }, []);

  const { isAuthenticated, isSuperAdmin, tenant, user } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const path = window.location.pathname;
    if (path && path !== '/' && path !== '/login') {
      const mapped = pathToRoute(path, isSuperAdmin);
      if (mapped) return mapped;
    }
    const saved = sessionStorage.getItem('nexus_current_route');
    if (saved) return saved;
    return isSuperAdmin ? 'admin-dashboard' : 'dashboard';
  });

  const roleCode = user?.role?.code;
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01' || tenant?.id === '1' || tenant?.slug === '1' || tenant?.name?.toLowerCase().includes('ghl') || user?.companySlug === 'ghl') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');

  // Set default route for IRM user
  useEffect(() => {
    if (user?.role?.code === 'irm') {
      const savedRoute = sessionStorage.getItem('nexus_current_route');
      if (!savedRoute) {
        setCurrentRoute('dashboard');
        sessionStorage.setItem('nexus_current_route', 'dashboard');
      }
    } else if (user?.role?.code === 'sales_executive' && (currentRoute === 'kyc' || currentRoute === 'all-leads' || currentRoute === 'irm-other' || currentRoute === 'other' || currentRoute === 'investors' || currentRoute === 'opportunities')) {
      setCurrentRoute('dashboard');
      sessionStorage.setItem('nexus_current_route', 'dashboard');
    }
  }, [user?.role?.code, currentRoute]);

  // Real-Time SignalR Fleet Event Listener
  useEffect(() => {
    if (!isAuthenticated) return;

    signalRService.startConnection().catch((err) => {
      console.warn('Real-time SignalR connection failed to initialize:', err);
    });

    const unsubUserSuspended = signalRService.on('UserSuspended', (data: any) => {
      console.warn('Real-time event: User suspended', data);
      if (data?.userId === user?.id) {
        alert('Your user account has been suspended by an administrator. You will be signed out.');
        window.location.href = '/login';
      }
    });

    const unsubTenantSuspended = signalRService.on('TenantSuspended', (data: any) => {
      console.warn('Real-time event: Tenant suspended', data);
      if (data?.tenantId === tenant?.id && !isSuperAdmin) {
        alert('Your organization has been suspended by the platform administrator. Access is restricted.');
        window.location.href = '/login';
      }
    });

    const unsubMaintenance = signalRService.on('MaintenanceModeToggled', (data: any) => {
      console.info('Real-time event: Maintenance mode toggled', data);
      if (data?.isEnabled && !isSuperAdmin) {
        alert(`Platform Maintenance Notice: ${data.message || 'System maintenance in progress.'}`);
      }
    });

    const unsubPlatformUpdated = signalRService.on('PlatformDataUpdated', (data: any) => {
      window.dispatchEvent(new CustomEvent('nexus_admin_updated', { detail: data }));
    });

    return () => {
      unsubUserSuspended();
      unsubTenantSuspended();
      unsubMaintenance();
      unsubPlatformUpdated();
    };
  }, [isAuthenticated, user?.id, tenant?.id, isSuperAdmin]);

  // Quick Create Modal State
  const [quickCreateType, setQuickCreateType] = useState<
    'lead' | 'followup' | 'deal' | 'visit' | 'consultation' | null
  >(null);

  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('+91 ');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickLocation, setQuickLocation] = useState('');
  const [quickSource, setQuickSource] = useState('Website Inbound');
  const [quickAssetClass, setQuickAssetClass] = useState('');
  const [quickInvestmentCapacity, setQuickInvestmentCapacity] = useState('');
  const [quickNotes, setQuickNotes] = useState('');

  // Consultation-specific state
  const [consInvestorId, setConsInvestorId] = useState('');
  const [consInvestorName, setConsInvestorName] = useState('');
  const [consInvestorPhone, setConsInvestorPhone] = useState('');
  const [consSlot, setConsSlot] = useState('');
  const [consConsultantName, setConsConsultantName] = useState('');
  const [consStatus, setConsStatus] = useState<'Scheduled' | 'Completed' | 'Cancelled' | 'No-show'>('Scheduled');
  const [consAgenda, setConsAgenda] = useState('');
  const [consOutcome, setConsOutcome] = useState('');
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [scheduledTime, setScheduledTime] = useState('11:00');

  // Deal-specific state
  const [dealCustomerMode, setDealCustomerMode] = useState<'existing' | 'new'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [navExtraState, setNavExtraState] = useState<any>(() => {
    return window.history.state?.extraState || null;
  });

  const { isDirty, dirtyMessage, confirmNavigation, clearDirty } = useNavigationGuard();
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const dirtyMessageRef = useRef(dirtyMessage);
  dirtyMessageRef.current = dirtyMessage;

  const currentRouteRef = useRef(currentRoute);
  currentRouteRef.current = currentRoute;

  const isSuperAdminRef = useRef(isSuperAdmin);
  isSuperAdminRef.current = isSuperAdmin;

  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  const currentIndexRef = useRef<number>(1);

  // Synchronize history state and enforce auth guards on mount or auth change
  useEffect(() => {
    if (!isAuthenticated) {
      sessionStorage.removeItem('nexus_has_armed_trap');
      if (
        window.location.pathname !== '/login' &&
        !window.location.pathname.startsWith('/reset-password') &&
        !window.location.pathname.startsWith('/kyc')
      ) {
        window.history.replaceState({ unauth: true }, '', '/login');
      }
      return;
    }

    // Authenticated state: resolve active route
    let activeRoute = currentRouteRef.current;
    const currentPath = window.location.pathname;

    if (currentPath !== '/login' && currentPath !== '/') {
      const mapped = pathToRoute(currentPath, isSuperAdmin);
      if (mapped && mapped !== activeRoute) {
        activeRoute = mapped;
        setCurrentRoute(mapped);
        sessionStorage.setItem('nexus_current_route', mapped);
      }
    } else if (isSuperAdmin && activeRoute === 'dashboard') {
      activeRoute = 'admin-dashboard';
      setCurrentRoute('admin-dashboard');
      sessionStorage.setItem('nexus_current_route', 'admin-dashboard');
    }

    const targetPath = routeToPath(activeRoute, isSuperAdmin);

    const isArmed = sessionStorage.getItem('nexus_has_armed_trap') === 'true';
    if (!isArmed || !window.history.state || !window.history.state.auth || window.history.state.isTrap || !window.history.state.index) {
      window.history.replaceState(
        { auth: true, route: activeRoute, index: 0, isTrap: true },
        '',
        targetPath
      );
      window.history.pushState(
        { auth: true, route: activeRoute, index: 0, isTrap: true },
        '',
        targetPath
      );
      window.history.pushState(
        { auth: true, route: activeRoute, index: 1 },
        '',
        targetPath
      );
      currentIndexRef.current = 1;
      sessionStorage.setItem('nexus_has_armed_trap', 'true');
    }
  }, [isAuthenticated, isSuperAdmin]);

  // Ensure trap is also reinforced on first user interaction for Chromium gesture activation
  useEffect(() => {
    if (!isAuthenticated) return;
    const armOnInteraction = () => {
      const currentPath = routeToPath(currentRouteRef.current, isSuperAdminRef.current);
      if (!window.history.state || window.history.state.index === undefined || window.history.state.isTrap) {
        window.history.replaceState({ auth: true, route: currentRouteRef.current, index: 0, isTrap: true }, '', currentPath);
        window.history.pushState({ auth: true, route: currentRouteRef.current, index: 0, isTrap: true }, '', currentPath);
        window.history.pushState({ auth: true, route: currentRouteRef.current, index: 1 }, '', currentPath);
        currentIndexRef.current = 1;
      }
      sessionStorage.setItem('nexus_has_armed_trap', 'true');
    };
    window.addEventListener('click', armOnInteraction, { once: true, capture: true });
    window.addEventListener('keydown', armOnInteraction, { once: true, capture: true });
    return () => {
      window.removeEventListener('click', armOnInteraction, { capture: true });
      window.removeEventListener('keydown', armOnInteraction, { capture: true });
    };
  }, [isAuthenticated]);

  // Handle browser Back / Forward events & back-forward cache protection
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // 1. If unauthenticated, ensure user stays on /login
      if (!isAuthenticatedRef.current) {
        if (window.location.pathname !== '/login') {
          window.history.replaceState({ unauth: true }, '', '/login');
        }
        return;
      }

      // 2. If there are unsaved changes, prompt user before navigating
      if (isDirtyRef.current) {
        const confirmed = window.confirm(
          dirtyMessageRef.current || 'You have unsaved changes. Are you sure you want to discard them and navigate away?'
        );
        if (!confirmed) {
          const currentPath = routeToPath(currentRouteRef.current, isSuperAdminRef.current);
          window.history.pushState(
            { auth: true, route: currentRouteRef.current, index: currentIndexRef.current },
            '',
            currentPath
          );
          return;
        }
        clearDirty();
      }

      // 3. User is authenticated:
      const state = event.state;

      // Trap Back button if it attempts to leave authenticated application,
      // lands on trap entry, has no state, or returns to /login
      if (!state || !state.auth || state.isTrap || !state.index || state.index <= 0 || window.location.pathname === '/login') {
        const currentPath = routeToPath(currentRouteRef.current, isSuperAdminRef.current);
        window.history.pushState(
          { auth: true, route: currentRouteRef.current, index: 0, isTrap: true },
          '',
          currentPath
        );
        window.history.pushState(
          { auth: true, route: currentRouteRef.current, index: 1 },
          '',
          currentPath
        );
        currentIndexRef.current = 1;
        return;
      }

      // 4. Normal in-app internal navigation (Back / Forward between pages)
      if (state.route) {
        currentIndexRef.current = state.index || 1;
        setCurrentRoute(state.route);
        setNavExtraState(state.extraState || null);
        sessionStorage.setItem('nexus_current_route', state.route);
      }
    };

    // Back-Forward Cache (bfcache) revalidation
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        const hasAuth = !!sessionStorage.getItem('nexus_current_user') || !!localStorage.getItem('nexus_current_user');
        if (!hasAuth && window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [clearDirty]);

  // Handle route change with Navigation Guard confirmation
  const navigate = (route: string, extraState?: any) => {
    confirmNavigation(() => {
      setCurrentRoute(route);
      setNavExtraState(extraState || null);
      sessionStorage.setItem('nexus_current_route', route);

      const nextIndex = (currentIndexRef.current || 1) + 1;
      currentIndexRef.current = nextIndex;

      const targetPath = routeToPath(route, isSuperAdmin);
      window.history.pushState(
        { auth: true, route, extraState: extraState || null, index: nextIndex },
        '',
        targetPath
      );
    });
  };

  useEffect(() => {
    const handleCustomNav = (e: any) => {
      if (e.detail) {
        navigate(e.detail);
      }
    };
    window.addEventListener('nexus_navigate', handleCustomNav);
    return () => window.removeEventListener('nexus_navigate', handleCustomNav);
  }, []);

  const [isSavingQuickCreate, setIsSavingQuickCreate] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);

  const isQuickCreateDirty = quickCreateType !== null && (
    quickName.trim().length > 0 ||
    quickPhone.replace('+91 ', '').trim().length > 0 ||
    quickNotes.trim().length > 0
  );
  useUnsavedChanges(isQuickCreateDirty, 'You have unsaved changes in Quick Create. Are you sure you want to discard them?', 'app-quick-create');

  const handleOpenQuickCreate = (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => {
    setQuickCreateType(type);
    setQuickCreateError(null);
    setIsSavingQuickCreate(false);
    setQuickName('');
    setQuickPhone('+91 ');
    setQuickEmail('');
    setQuickLocation('');
    setQuickSource('Website Inbound');
    setQuickAssetClass('');
    setQuickInvestmentCapacity('');
    setQuickNotes('');
    setConsInvestorId('');
    setConsInvestorName('');
    setConsInvestorPhone('');
    setConsSlot('This Friday, 03:00 PM');
    setConsConsultantName(user?.name ?? 'Advisor');
    setConsStatus('Scheduled');
    setConsAgenda('Commercial REIT yield analysis & pass-through taxation discussion.');
    setConsOutcome('');
    setScheduledDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    setScheduledTime(storageService.getCallPreferences().defaultFollowupTime);
    // Reset deal-specific state; pre-select first available customer
    setDealCustomerMode('existing');
    setNewCustomerName('');
    const existingCustomers = storageService.getCustomers(tenant?.id);
    setSelectedCustomerId(existingCustomers[0]?.id || '');
  };

  const handleSaveQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim() || isSavingQuickCreate) return;
    setQuickCreateError(null);
    setIsSavingQuickCreate(true);

    try {
      if (quickCreateType === 'lead') {
        const newLead = {
          id: `lead-${Date.now()}`,
          companyId: tenant?.id || 't-ghl-01',
          name: quickName.trim(),
          phone: quickPhone.trim(),
          email: quickEmail.trim(),
          location: quickLocation.trim(),
          source: quickSource,
          status: 'New' as const,
          priority: 'Medium' as const,
          assignedAgentId: user?.id || (tenant?.slug === 'jamin' ? 'usr-jamin-exec' : 'usr-ghl-exec'),
          assignedAgentName: user?.name || (tenant?.slug === 'jamin' ? 'Pooja Hegde' : 'Ananya Iyer'),
          createdAt: new Date().toISOString().split('T')[0],
          notes: quickNotes,
          customFields: {
            assetClass: quickAssetClass,
            preferredAssetClass: quickAssetClass,
            investmentCapacity: quickInvestmentCapacity,
          },
        };
        await apiSaveLead(newLead);

      } else if (quickCreateType === 'followup') {
        const combinedDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
        const newFlw = {
          id: `flw-${Date.now()}`,
          companyId: tenant?.id || 't-ghl-01',
          contactId: `contact-${Date.now()}`,
          contactName: quickName.trim(),
          contactPhone: quickPhone.trim(),
          contactType: 'lead' as const,
          scheduledAt: combinedDateTime,
          scheduledDate,
          scheduledTime,
          priority: 'High' as const,
          status: 'Pending' as const,
          notes: quickNotes,
          assignedAgentId: user?.id || 'usr-exec',
          assignedAgentName: user?.name || 'Agent',
        };
        await apiSaveFollowup(newFlw);

      } else if (quickCreateType === 'consultation') {
        // Task 1 — Schedule Consultation
        const newCons = {
          id: `cons-${Date.now()}`,
          companyId: tenant?.id || 't-ghl-01',
          investorId: consInvestorId || `investor-${Date.now()}`,
          investorName: consInvestorName || quickName.trim(),
          investorPhone: consInvestorPhone || quickPhone.trim(),
          scheduledAt: consSlot.trim(),
          consultantId: user?.id || 'usr-exec',
          consultantName: consConsultantName.trim() || user?.name || 'Agent',
          status: consStatus,
          agenda: consAgenda.trim(),
          outcomeNotes: consOutcome.trim() || undefined,
        };
        await apiSaveConsultation(newCons);

      } else if (quickCreateType === 'visit') {
        // Task 2 — Schedule Site Visit
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'deal') {
        // Task 4 — Deal linked to real customer
        let resolvedCustomerId: string;
        let resolvedCustomerName: string;

        if (dealCustomerMode === 'existing' && selectedCustomerId) {
          const existing = storageService.getCustomers(tenant?.id).find((c: any) => c.id === selectedCustomerId);
          resolvedCustomerId = existing?.id || selectedCustomerId;
          resolvedCustomerName = existing?.name || 'Customer';
        } else {
          if (!newCustomerName.trim()) {
            throw new Error('Please enter customer full name.');
          }
          resolvedCustomerId = `cust-${Date.now()}`;
          resolvedCustomerName = newCustomerName.trim();
          const newCust = {
            id: resolvedCustomerId,
            companyId: tenant?.id || 't-ghl-01',
            name: resolvedCustomerName,
            phone: quickPhone.trim(),
            email: '',
            status: 'Active' as const,
            assignedAgentId: user?.id || 'usr-exec',
            assignedAgentName: user?.name || 'Agent',
            location: 'Bengaluru',
            lastContacted: new Date().toISOString().split('T')[0],
            openDealsCount: 1,
            totalValue: 5000000,
            createdAt: new Date().toISOString().split('T')[0],
            notes: '',
            customFields: {},
          };
          await apiSaveCustomer(newCust);
        }

        const newDeal = {
          id: `deal-${Date.now()}`,
          companyId: tenant?.id || 't-ghl-01',
          title: quickName.trim(),
          customerId: resolvedCustomerId,
          customerName: resolvedCustomerName,
          stage: 'new',
          value: 5000000,
          expectedCloseDate: '30 Days',
          assignedAgentId: user?.id || 'usr-exec',
          assignedAgentName: user?.name || 'Agent',
          notes: quickNotes,
          createdAt: new Date().toISOString().split('T')[0],
        };
        await apiSaveDeal(newDeal);
      }

      setQuickCreateType(null);
    } catch (err: any) {
      setQuickCreateError(err.message || 'Failed to save entry. Please verify your connection and try again.');
    } finally {
      setIsSavingQuickCreate(false);
    }
  };

  // If unauthenticated
  if (!isAuthenticated) {
    return <AuthLayout />;
  }

  // Super Admin Console
  if (isSuperAdmin) {
    return (
      <AdminLayout currentRoute={currentRoute} onNavigate={navigate}>
        {currentRoute === 'admin-dashboard' || currentRoute === 'dashboard' ? (
          <PlatformDashboardPage onNavigate={navigate} />
        ) : currentRoute === 'admin-companies' ? (
          <CompaniesPage
            initialOpenWizard={Boolean(navExtraState?.openWizard)}
            selectedTenantId={navExtraState?.selectedTenantId}
          />
        ) : currentRoute === 'admin-users' ? (
          <PlatformUsersPage />
        ) : currentRoute === 'admin-roles' ? (
          <PlatformRolesPage />
        ) : currentRoute === 'admin-features' ? (
          <PlatformFeaturesPage />
        ) : currentRoute === 'admin-call-config' ? (
          <PlatformCallConfigPage />
        ) : currentRoute === 'admin-audit' ? (
          <PlatformAuditPage />
        ) : currentRoute === 'admin-system' ? (
          <PlatformSystemPage />
        ) : currentRoute === 'admin-security' ? (
          <PlatformSecurityPage />
        ) : (
          <PlatformDashboardPage onNavigate={navigate} />
        )}
      </AdminLayout>
    );
  }

  // Company User Layout (GHL & Jamin)
  return (
    <SalesLayout
      currentRoute={currentRoute}
      onNavigate={navigate}
      onOpenQuickCreate={handleOpenQuickCreate}
    >
      {currentRoute === 'dashboard' ? (
        <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
      ) : currentRoute === 'all-leads' ? (
        user?.role?.code !== 'irm' && !isGhlAdmin && !isSuperAdmin ? (
          <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
        ) : (
          <ProtectedRoute permission={PERMISSIONS.LEADS_VIEW}>
            <AllLeadsPage onNavigate={navigate} />
          </ProtectedRoute>
        )
      ) : currentRoute === 'leads' ? (
        <ProtectedRoute permission={PERMISSIONS.LEADS_VIEW}>
          <LeadsPage onNavigate={navigate} />
        </ProtectedRoute>
      ) : currentRoute === 'assigned-leads' ? (
        <ProtectedRoute permission={PERMISSIONS.LEADS_VIEW}>
          {isGhlAdmin ? (
            <AssignedLeadsPage onNavigate={navigate} />
          ) : (
            <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
          )}
        </ProtectedRoute>
      ) : currentRoute === 'pending-leads' ? (
        <ProtectedRoute permission={PERMISSIONS.LEADS_VIEW}>
          {isGhlAdmin ? (
            <PendingLeadsPage />
          ) : (
            <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
          )}
        </ProtectedRoute>
      ) : currentRoute === 'archived-leads' ? (
        <ProtectedRoute permission={PERMISSIONS.LEADS_VIEW}>
          {isGhlAdmin ? (
            <ArchivedLeadsPage />
          ) : (
            <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
          )}
        </ProtectedRoute>
      ) : currentRoute === 'customers' ? (
        <ProtectedRoute permission={PERMISSIONS.CUSTOMERS_VIEW}>
          <CustomersPage />
        </ProtectedRoute>
      ) : currentRoute === 'pipeline' ? (
        <ProtectedRoute permission={PERMISSIONS.DEALS_VIEW}>
          <PipelinePage onOpenQuickCreate={handleOpenQuickCreate} />
        </ProtectedRoute>
      ) : currentRoute === 'deals' ? (
        <ProtectedRoute permission={PERMISSIONS.DEALS_VIEW}>
          <DealsPage onNavigate={navigate} />
        </ProtectedRoute>
      ) : currentRoute === 'followups' ? (
        <ProtectedRoute permission={PERMISSIONS.FOLLOWUPS_VIEW}>
          <FollowupsPage />
        </ProtectedRoute>
      ) : currentRoute === 'call-center' ? (
        <ProtectedRoute permission={PERMISSIONS.CALLS_MAKE}>
          <CallCenterPage />
        </ProtectedRoute>
      ) : currentRoute === 'call-history' ? (
        <ProtectedRoute permission={PERMISSIONS.CALLS_VIEW}>
          <CallHistoryPage />
        </ProtectedRoute>
      ) : currentRoute === 'call-settings' ? (
        <CallSettingsPage />
      ) : currentRoute === 'projects' ? (
        <ProtectedRoute permission={PERMISSIONS.PROPERTIES_VIEW}>
          <ProjectsPage onNavigate={navigate} />
        </ProtectedRoute>
      ) : currentRoute === 'plots' ? (
        <ProtectedRoute permission={PERMISSIONS.PROPERTIES_VIEW}>
          <PlotsPage />
        </ProtectedRoute>
      ) : currentRoute === 'site-visits' ? (
        <ProtectedRoute permission={PERMISSIONS.SITE_VISITS_VIEW}>
          <SiteVisitsPage />
        </ProtectedRoute>
      ) : currentRoute === 'bookings' ? (
        <ProtectedRoute permission={PERMISSIONS.BOOKINGS_VIEW}>
          <BookingsPage />
        </ProtectedRoute>
      ) : currentRoute === 'kyc' ? (
        user?.role?.code === 'sales_executive' ? (
          <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
        ) : (
          <ProtectedRoute permission={PERMISSIONS.INVESTORS_VIEW}>
            <KYCPage />
          </ProtectedRoute>
        )
      ) : currentRoute === 'investors' ? (
        user?.role?.code === 'sales_executive' ? (
          <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
        ) : (
          <ProtectedRoute permission={PERMISSIONS.INVESTORS_VIEW}>
            <InvestorsPage />
          </ProtectedRoute>
        )
      ) : currentRoute === 'consultations' ? (
        <ProtectedRoute permission={PERMISSIONS.CONSULTATIONS_VIEW}>
          <ConsultationsPage />
        </ProtectedRoute>
      ) : currentRoute === 'opportunities' ? (
        user?.role?.code === 'sales_executive' ? (
          <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
        ) : (
          <ProtectedRoute permission={PERMISSIONS.OPPORTUNITIES_VIEW}>
            <OpportunitiesPage />
          </ProtectedRoute>
        )
      ) : currentRoute === 'not-interested' ? (
        user?.role?.code === 'irm' ? (
          <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
        ) : (
          <ProtectedRoute permission={PERMISSIONS.LEADS_VIEW}>
            <NotInterestedPage />
          </ProtectedRoute>
        )
      ) : currentRoute === 'junk' ? (
        user?.role?.code === 'irm' ? (
          <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
        ) : (
          <ProtectedRoute permission={PERMISSIONS.LEADS_VIEW}>
            <JunkPage />
          </ProtectedRoute>
        )
      ) : currentRoute === 'chat' ? (
        <ChatPage onNavigate={navigate} />
      ) : currentRoute === 'smarty-ai' ? (
        <SmartyAIPage />
      ) : currentRoute === 'profile' ? (
        <ProfilePage />
      ) : currentRoute === 'reports' ? (
        <ProtectedRoute permission={PERMISSIONS.REPORTS_VIEW}>
          <ReportsPage />
        </ProtectedRoute>
      ) : currentRoute === 'notifications' ? (
        <NotificationsPage onNavigate={navigate} />
      ) : currentRoute === 'company-users' ? (
        <ProtectedRoute permission={PERMISSIONS.USERS_VIEW}>
          <CompanyUsersPage />
        </ProtectedRoute>
      ) : currentRoute === 'leave-requests' ? (
        <LeaveRequestsPage onNavigate={navigate} />
      ) : currentRoute === 'work-handover' ? (
        <ProtectedRoute permission={PERMISSIONS.USERS_VIEW}>
          {isGhlAdmin ? (
            <WorkHandoverPage initialParams={navExtraState} onNavigate={navigate} />
          ) : (
            <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
          )}
        </ProtectedRoute>
      ) : currentRoute === 'company-settings' ? (
        <ProtectedRoute permission={PERMISSIONS.SETTINGS_VIEW}>
          <CompanySettingsPage />
        </ProtectedRoute>
      ) : currentRoute === 'company-audit' ? (
        <ProtectedRoute permission={PERMISSIONS.AUDIT_VIEW}>
          <CompanyAuditPage />
        </ProtectedRoute>
      ) : currentRoute === 'irm-other' || currentRoute === 'other' ? (
        user?.role?.code !== 'irm' && !isGhlAdmin && !isSuperAdmin ? (
          <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
        ) : (
          <IrmOtherPage onNavigate={navigate} />
        )
      ) : (
        <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
      )}

      {/* Global Quick Action Modal */}
      <Modal
        isOpen={!!quickCreateType}
        onClose={() => setQuickCreateType(null)}
        title={`Quick Create: ${quickCreateType?.toUpperCase()}`}
        subtitle={`Instant creation into ${tenant?.name}`}
      >
        <form onSubmit={handleSaveQuickCreate} className="app-quickcreate-form">

          {/* ── LEAD: Full form matching Add New Prospect Lead ── */}
          {quickCreateType === 'lead' ? (
            <>
              {/* Full Name */}
              <div className="form-group">
                <label htmlFor="quick-lead-name" className="form-label">Full Name *</label>
                <input
                  id="quick-lead-name"
                  name="fullName"
                  type="text"
                  className="form-input"
                  required
                  value={quickName}
                  onChange={e => setQuickName(e.target.value)}
                  placeholder="e.g. Agent One"
                />
              </div>

              {/* Phone + Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label htmlFor="quick-lead-phone" className="form-label">Phone Number *</label>
                  <input
                    id="quick-lead-phone"
                    name="phone"
                    type="text"
                    className="form-input"
                    required
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    placeholder="+91 98800 00000"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="quick-lead-email" className="form-label">Email Address</label>
                  <input
                    id="quick-lead-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className="form-input"
                    value={quickEmail}
                    onChange={e => setQuickEmail(e.target.value)}
                    placeholder="agent1@example.com"
                  />
                </div>
              </div>

              {/* Location + Source */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label htmlFor="quick-lead-location" className="form-label">Location / City</label>
                  <input
                    id="quick-lead-location"
                    name="location"
                    type="text"
                    className="form-input"
                    value={quickLocation}
                    onChange={e => setQuickLocation(e.target.value)}
                    placeholder="e.g. Bengaluru, Indiranagar"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="quick-lead-source" className="form-label">Source</label>
                  <select
                    id="quick-lead-source"
                    name="source"
                    className="form-select"
                    value={quickSource}
                    onChange={e => setQuickSource(e.target.value)}
                  >
                    <option value="Website Inbound">Website Inbound</option>
                    <option value="Google Search">Google Search</option>
                    <option value="Facebook / Instagram">Facebook / Instagram</option>
                    <option value="Referral - HNW">Referral - HNW</option>
                    <option value="Walk-in Site Office">Walk-in Site Office</option>
                    <option value="LinkedIn Executive Campaign">LinkedIn Executive Campaign</option>
                    <option value="Inbound Call">Inbound Call</option>
                  </select>
                </div>
              </div>

              {/* GHL India Ventures Asset Terms */}
              <div className="lead-custom-schema-box">
                <div className="lead-custom-schema-title">GHL India Ventures Asset Terms</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {user?.role?.code !== 'sales_executive' && (
                    <div className="form-group">
                      <label htmlFor="quick-lead-asset-class" className="form-label">Asset Class</label>
                      <select
                        id="quick-lead-asset-class"
                        name="assetClass"
                        className="form-select"
                        value={quickAssetClass}
                        onChange={e => setQuickAssetClass(e.target.value)}
                      >
                        <option value="">--</option>
                        <option value="AIF">AIF</option>
                        <option value="CO-AIF">CO-AIF</option>
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label htmlFor="quick-lead-capacity" className="form-label">Investment Capacity</label>
                    <select
                      id="quick-lead-capacity"
                      name="investmentCapacity"
                      className="form-select"
                      value={quickInvestmentCapacity}
                      onChange={e => setQuickInvestmentCapacity(e.target.value)}
                    >
                      <option value="" disabled>Select a range</option>
                      {[
                        'Contact for Co-Invest Details',
                        '₹1 Cr – ₹5 Cr',
                        '₹5 Cr – ₹10 Cr',
                        '₹10 Cr – ₹25 Cr',
                        '₹25 Cr+'
                      ].map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes & Requirements */}
              <div className="form-group">
                <label htmlFor="quick-lead-notes" className="form-label">Notes & Requirements</label>
                <textarea
                  id="quick-lead-notes"
                  name="notes"
                  className="form-textarea"
                  rows={3}
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  placeholder="Client background, key objections, time horizon..."
                />
              </div>
            </>
          ) : quickCreateType === 'consultation' ? (
            <>
              {/* ── CONSULTATION: Full form matching Schedule Consultation ── */}
              {(() => {
                const investors = storageService.getInvestors(tenant?.id);
                return (
                  <>
                    <div className="form-group">
                      <label htmlFor="quick-cons-investor" className="form-label">Investor *</label>
                      <select
                        id="quick-cons-investor"
                        name="investorId"
                        className="form-select"
                        value={consInvestorId}
                        required
                        onChange={e => {
                          const inv = investors.find(i => i.id === e.target.value);
                          setConsInvestorId(e.target.value);
                          setConsInvestorName(inv?.name ?? '');
                          setConsInvestorPhone(inv?.phone ?? '');
                        }}
                      >
                        <option value="">— Select Investor —</option>
                        {investors.map(inv => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} {inv.phone ? `(${inv.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label htmlFor="quick-cons-phone" className="form-label">Investor Phone</label>
                        <input
                          id="quick-cons-phone"
                          name="investorPhone"
                          type="text"
                          className="form-input"
                          placeholder="+91 98800 00000"
                          value={consInvestorPhone}
                          onChange={e => setConsInvestorPhone(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="quick-cons-slot" className="form-label">Consultation Slot *</label>
                        <input
                          id="quick-cons-slot"
                          name="consultationSlot"
                          type="text"
                          className="form-input"
                          required
                          placeholder="e.g. Thursday, 04:00 PM"
                          value={consSlot}
                          onChange={e => setConsSlot(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label htmlFor="quick-cons-advisor" className="form-label">
                          Private Wealth Advisor
                          {user?.role?.code === 'sales_executive' && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                              (auto-assigned to you)
                            </span>
                          )}
                        </label>
                        {user?.role?.code === 'sales_executive' ? (
                          <input
                            id="quick-cons-advisor"
                            name="advisorName"
                            className="form-input"
                            value={consConsultantName}
                            readOnly
                            style={{ backgroundColor: 'var(--bg-surface-hover)', cursor: 'not-allowed', color: 'var(--text-secondary)' }}
                          />
                        ) : (
                          <input
                            id="quick-cons-advisor"
                            name="advisorName"
                            className="form-input"
                            placeholder="e.g. Vikram Malhotra"
                            value={consConsultantName}
                            onChange={e => setConsConsultantName(e.target.value)}
                          />
                        )}
                      </div>
                      <div className="form-group">
                        <label htmlFor="quick-cons-status" className="form-label">Status</label>
                        <select
                          id="quick-cons-status"
                          name="status"
                          className="form-select"
                          value={consStatus}
                          onChange={e => setConsStatus(e.target.value as any)}
                        >
                          {['Scheduled', 'Completed', 'Cancelled', 'No-show'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="quick-cons-agenda" className="form-label">Discussion Agenda & Objectives</label>
                      <textarea
                        id="quick-cons-agenda"
                        name="agenda"
                        className="form-textarea"
                        rows={3}
                        placeholder="e.g. Commercial REIT yield analysis & pass-through taxation discussion."
                        value={consAgenda}
                        onChange={e => setConsAgenda(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="quick-cons-outcome" className="form-label">Outcome Notes & Recommendations</label>
                      <textarea
                        id="quick-cons-outcome"
                        name="outcome"
                        className="form-textarea"
                        rows={3}
                        placeholder="Record key takeaways, investor interest level, follow-up requirements..."
                        value={consOutcome}
                        onChange={e => setConsOutcome(e.target.value)}
                      />
                    </div>
                  </>
                );
              })()}
            </>
          ) : (
            <>
              {/* ── Deal: existing vs. new customer picker ── */}
              {quickCreateType === 'deal' && (() => {
                const tenantCustomers = storageService.getCustomers(tenant?.id);
                const hasCustomers = tenantCustomers.length > 0;
                return (
                  <div className="form-group">
                    <label htmlFor={dealCustomerMode === 'existing' && hasCustomers ? 'quick-deal-customer' : 'quick-deal-new-customer'} className="form-label">Link to Customer</label>

                    {/* Segmented toggle — same style as Reports page period toggle */}
                    <div className="app-segmented-toggle">
                      {(['existing', 'new'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          className={`btn btn-sm app-segmented-btn ${dealCustomerMode === mode ? 'btn-primary' : 'btn-ghost'} ${mode === 'existing' && !hasCustomers ? 'disabled' : ''}`}
                          disabled={mode === 'existing' && !hasCustomers}
                          onClick={() => setDealCustomerMode(mode)}
                        >
                          {mode === 'existing' ? 'Existing customer' : 'New customer'}
                        </button>
                      ))}
                    </div>

                    {!hasCustomers && (
                      <p className="app-no-customers-msg">
                        No customers in this workspace yet — deal will create a new customer record.
                      </p>
                    )}

                    {dealCustomerMode === 'existing' && hasCustomers ? (
                      <select
                        id="quick-deal-customer"
                        name="customerId"
                        aria-label="Link to existing customer"
                        className="form-select"
                        value={selectedCustomerId}
                        onChange={e => setSelectedCustomerId(e.target.value)}
                        required
                      >
                        {tenantCustomers.map((c: Customer) => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.phone ? ` · ${c.phone}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div>
                        <label htmlFor="quick-deal-new-customer" className="form-label app-new-customer-label">
                          New Customer Name * — a new Customer record will be created
                        </label>
                        <input
                          id="quick-deal-new-customer"
                          name="newCustomerName"
                          type="text"
                          className="form-input"
                          required
                          placeholder="Customer full name"
                          value={newCustomerName}
                          onChange={e => setNewCustomerName(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Phone (non-lead, non-deal-existing) ── */}
              {!(quickCreateType === 'deal' && dealCustomerMode === 'existing') && (
                <div className="form-group">
                  <label htmlFor="quick-generic-phone" className="form-label">Phone Number</label>
                  <input
                    id="quick-generic-phone"
                    name="phone"
                    type="text"
                    className="form-input"
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                  />
                </div>
              )}

              {/* ── Scheduled Date + Time (followup, visit) ── */}
              {(quickCreateType === 'followup' || quickCreateType === 'visit') && (
                <div className="app-schedule-grid">
                  <div className="form-group">
                    <label htmlFor="quick-schedule-date" className="form-label">Scheduled Date *</label>
                    <input
                      id="quick-schedule-date"
                      name="scheduledDate"
                      type="date"
                      className="form-input"
                      required
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="quick-schedule-time" className="form-label">Scheduled Time *</label>
                    <input
                      id="quick-schedule-time"
                      name="scheduledTime"
                      type="time"
                      className="form-input"
                      required
                      value={scheduledTime}
                      onChange={e => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* ── Notes/Agenda (non-lead types) ── */}
              <div className="form-group">
                <label htmlFor="quick-generic-notes" className="form-label">Quick Notes</label>
                <textarea
                  id="quick-generic-notes"
                  name="notes"
                  className="form-textarea"
                  rows={2}
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  placeholder={
                    quickCreateType === 'visit'
                      ? 'Special requirements, preferred plots...'
                      : 'Brief requirement summary...'
                  }
                />
              </div>
            </>
          )}

          {quickCreateError && (
            <div
              className="alert alert-danger"
              style={{
                marginBottom: 12,
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                borderRadius: 6,
                fontSize: 13,
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              {quickCreateError}
            </div>
          )}

          <div className="app-modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setQuickCreateType(null)}
              disabled={isSavingQuickCreate}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSavingQuickCreate}
            >
              {isSavingQuickCreate ? 'Saving Entry...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </Modal>
    </SalesLayout>
  );
};

export default App;