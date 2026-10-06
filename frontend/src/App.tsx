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
import { isMockMode } from './config/environment';

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

// Company Admin
import { CompanyUsersPage } from './pages/Company/CompanyUsersPage';
import { LeaveRequestsPage } from './pages/Company/LeaveRequestsPage';
import { WorkHandoverPage } from './pages/Company/WorkHandoverPage';
import { CompanySettingsPage } from './pages/Company/CompanySettingsPage';
import { CompanyAuditPage } from './pages/Company/CompanyAuditPage';

// Super Admin Platform Pages
import { PlatformDashboardPage } from './pages/Admin/Dashboard/PlatformDashboardPage';
import { CompaniesPage } from './pages/Admin/Companies/CompaniesPage';
import { PlatformUsersPage } from './pages/Admin/Users/PlatformUsersPage';
import { PlatformRolesPage } from './pages/Admin/Roles/PlatformRolesPage';
import { PlatformFeaturesPage } from './pages/Admin/Features/PlatformFeaturesPage';
import { PlatformCallConfigPage } from './pages/Admin/CallConfig/PlatformCallConfigPage';
import { PlatformAuditPage } from './pages/Admin/Audit/PlatformAuditPage';
import { PlatformSystemPage } from './pages/Admin/System/PlatformSystemPage';

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
import './App.css';

export const App: React.FC = () => {
  useEffect(() => {
    if (!isMockMode()) {
      localStorage.removeItem('nexus_dev_deals');
      localStorage.removeItem('nexus_dev_leads');
    }
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
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');
  // In mock mode only, run idempotent mock bootstrap if not yet initialized
  useEffect(() => {
    if (isMockMode()) {
      import('./mock/runtime/mockBootstrap').then(({ runMockBootstrap }) => {
        runMockBootstrap();
      });
    }
  }, []);

  // Set default route for IRM user
  useEffect(() => {
    if (user?.role?.code === 'irm') {
      const savedRoute = sessionStorage.getItem('nexus_current_route');
      if (!savedRoute) {
        setCurrentRoute('dashboard');
        sessionStorage.setItem('nexus_current_route', 'dashboard');
      }
    } else if (user?.role?.code === 'sales_executive' && currentRoute === 'kyc') {
      setCurrentRoute('dashboard');
      sessionStorage.setItem('nexus_current_route', 'dashboard');
    }
  }, [user?.role?.code, currentRoute]);

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

    // CRITICAL: Ensure there is always a deep anti-exit trap buffer in history
    // so pressing the browser Back button can NEVER escape to the Edge new tab!
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

  // Handle browser Back / Forward events
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // 1. If unauthenticated, ensure user stays on /login
      if (!isAuthenticatedRef.current) {
        if (window.location.pathname !== '/login') {
          window.history.replaceState({ unauth: true }, '', '/login');
        }
        return;
      }

      // 2. User is authenticated:
      const state = event.state;

      // Trap Back button if it attempts to leave authenticated application,
      // lands on trap entry, has no state, or returns to /login
      if (!state || !state.auth || state.isTrap || !state.index || state.index <= 0 || window.location.pathname === '/login') {
        const currentPath = routeToPath(currentRouteRef.current, isSuperAdminRef.current);
        // Immediately replenish the anti-exit trap buffer at current location
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

      // 3. Normal in-app internal navigation (Back / Forward between pages)
      if (state.route) {
        currentIndexRef.current = state.index || 1;
        setCurrentRoute(state.route);
        setNavExtraState(state.extraState || null);
        sessionStorage.setItem('nexus_current_route', state.route);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle route change
  const navigate = (route: string, extraState?: any) => {
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

  const handleOpenQuickCreate = (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => {
    setQuickCreateType(type);
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

  const handleSaveQuickCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName) return;

    if (quickCreateType === 'lead') {
      storageService.saveLead({
        id: `lead-${Date.now()}`,
        companyId: tenant?.id || 't-ghl-01',
        name: quickName,
        phone: quickPhone,
        email: quickEmail,
        location: quickLocation,
        source: quickSource,
        status: 'New',
        priority: 'Medium',
        assignedAgentId: user?.id || (tenant?.slug === 'jamin' ? 'usr-jamin-exec' : 'usr-ghl-exec'),
        assignedAgentName: user?.name || (tenant?.slug === 'jamin' ? 'Pooja Hegde' : 'Ananya Iyer'),
        createdAt: new Date().toISOString().split('T')[0],
        notes: quickNotes,
        customFields: {
          assetClass: quickAssetClass,
          preferredAssetClass: quickAssetClass,
          investmentCapacity: quickInvestmentCapacity,
        },
      });

    } else if (quickCreateType === 'followup') {
      const combinedDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      storageService.saveFollowup({
        id: `flw-${Date.now()}`,
        companyId: tenant?.id || 't-ghl-01',
        contactId: `contact-${Date.now()}`,
        contactName: quickName,
        contactPhone: quickPhone,
        contactType: 'lead',
        scheduledAt: combinedDateTime,
        scheduledDate,
        scheduledTime,
        priority: 'High',
        status: 'Pending',
        notes: quickNotes,
        assignedAgentId: user?.id || 'usr-exec',
        assignedAgentName: user?.name || 'Agent',
      });

    } else if (quickCreateType === 'consultation') {
      // Task 1 — Schedule Consultation
      storageService.saveConsultation({
        id: `cons-${Date.now()}`,
        companyId: tenant?.id || 't-ghl-01',
        investorId: consInvestorId || `investor-${Date.now()}`,
        investorName: consInvestorName,
        investorPhone: consInvestorPhone,
        scheduledAt: consSlot.trim(),
        consultantId: user?.id || 'usr-exec',
        consultantName: consConsultantName.trim() || user?.name || 'Agent',
        status: consStatus,
        agenda: consAgenda.trim(),
        outcomeNotes: consOutcome.trim() || undefined,
      });

    } else if (quickCreateType === 'visit') {
      // Task 2 — Schedule Site Visit
      const combinedDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      storageService.saveSiteVisit({
        id: `visit-${Date.now()}`,
        companyId: tenant?.id || 't-jamin-02',
        customerId: `cust-${Date.now()}`,
        customerName: quickName,
        customerPhone: quickPhone,
        projectId: 'proj-01',
        projectName: 'Greenfield Meadows Phase 2',
        scheduledAt: combinedDateTime,
        assignedAgentId: user?.id || 'usr-exec',
        assignedAgentName: user?.name || 'Agent',
        status: 'Scheduled',
        outcomeNotes: quickNotes,
      });

    } else if (quickCreateType === 'deal') {
      // Task 4 — Deal linked to real customer
      let resolvedCustomerId: string;
      let resolvedCustomerName: string;

      if (dealCustomerMode === 'existing' && selectedCustomerId) {
        // Link to the chosen existing customer
        const existing = storageService.getCustomers(tenant?.id)
          .find(c => c.id === selectedCustomerId);
        resolvedCustomerId = existing?.id || selectedCustomerId;
        resolvedCustomerName = existing?.name || 'Customer';
      } else {
        // Create a real Customer record first so it shows in Customer 360
        if (!newCustomerName) return;
        resolvedCustomerId = `cust-${Date.now()}`;
        resolvedCustomerName = newCustomerName;
        storageService.saveCustomer({
          id: resolvedCustomerId,
          companyId: tenant?.id || 't-ghl-01',
          name: resolvedCustomerName,
          phone: quickPhone,
          email: '',
          status: 'Active',
          assignedAgentId: user?.id || 'usr-exec',
          assignedAgentName: user?.name || 'Agent',
          location: 'Bengaluru',
          lastContacted: new Date().toISOString().split('T')[0],
          openDealsCount: 1,
          totalValue: 5000000,
          createdAt: new Date().toISOString().split('T')[0],
          notes: '',
          customFields: {},
        });
      }

      storageService.saveDeal({
        id: `deal-${Date.now()}`,
        companyId: tenant?.id || 't-ghl-01',
        title: quickName,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        stage: 'new',
        value: 5000000,
        expectedCloseDate: '30 Days',
        assignedAgentId: user?.id || 'usr-exec',
        assignedAgentName: user?.name || 'Agent',
        notes: quickNotes,
        createdAt: new Date().toISOString().split('T')[0],
      });
    }

    setQuickCreateType(null);
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
        <ProtectedRoute permission={PERMISSIONS.INVESTORS_VIEW}>
          <InvestorsPage />
        </ProtectedRoute>
      ) : currentRoute === 'consultations' ? (
        <ProtectedRoute permission={PERMISSIONS.CONSULTATIONS_VIEW}>
          <ConsultationsPage />
        </ProtectedRoute>
      ) : currentRoute === 'opportunities' ? (
        <ProtectedRoute permission={PERMISSIONS.OPPORTUNITIES_VIEW}>
          <OpportunitiesPage />
        </ProtectedRoute>
      ) : currentRoute === 'not-interested' ? (
        <ProtectedRoute permission={PERMISSIONS.LEADS_VIEW}>
          <NotInterestedPage />
        </ProtectedRoute>
      ) : currentRoute === 'junk' ? (
        <ProtectedRoute permission={PERMISSIONS.LEADS_VIEW}>
          <JunkPage />
        </ProtectedRoute>
      ) : currentRoute === 'chat' ? (
        <ChatPage onNavigate={navigate} />
      ) : currentRoute === 'smarty-ai' ? (
        <PlaceholderPage title="Smarty AI" />
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
          <WorkHandoverPage initialParams={navExtraState} onNavigate={navigate} />
        </ProtectedRoute>
      ) : currentRoute === 'company-settings' ? (
        <ProtectedRoute permission={PERMISSIONS.SETTINGS_VIEW}>
          <CompanySettingsPage />
        </ProtectedRoute>
      ) : currentRoute === 'company-audit' ? (
        <ProtectedRoute permission={PERMISSIONS.AUDIT_VIEW}>
          <CompanyAuditPage />
        </ProtectedRoute>
      ) : (
        user?.role?.code === 'irm' ? (
          <InvestorsPage />
        ) : (
          <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
        )
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
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={quickName}
                  onChange={e => setQuickName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                />
              </div>

              {/* Phone + Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    placeholder="+91 98800 00000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={quickEmail}
                    onChange={e => setQuickEmail(e.target.value)}
                    placeholder="ramesh@example.com"
                  />
                </div>
              </div>

              {/* Location + Source */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Location / City</label>
                  <input
                    type="text"
                    className="form-input"
                    value={quickLocation}
                    onChange={e => setQuickLocation(e.target.value)}
                    placeholder="e.g. Bengaluru, Indiranagar"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Source</label>
                  <select
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
                      <label className="form-label">Asset Class</label>
                      <select
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
                    <label className="form-label">Investment Capacity</label>
                    <select
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
                <label className="form-label">Notes & Requirements</label>
                <textarea
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
                      <label className="form-label">Investor *</label>
                      <select
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
                        <label className="form-label">Investor Phone</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="+91 98800 00000"
                          value={consInvestorPhone}
                          onChange={e => setConsInvestorPhone(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Consultation Slot *</label>
                        <input
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
                        <label className="form-label">
                          Private Wealth Advisor
                          {user?.role?.code === 'sales_executive' && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                              (auto-assigned to you)
                            </span>
                          )}
                        </label>
                        {user?.role?.code === 'sales_executive' ? (
                          <input
                            className="form-input"
                            value={consConsultantName}
                            readOnly
                            style={{ backgroundColor: 'var(--bg-surface-hover)', cursor: 'not-allowed', color: 'var(--text-secondary)' }}
                          />
                        ) : (
                          <input
                            className="form-input"
                            placeholder="e.g. Vikram Malhotra"
                            value={consConsultantName}
                            onChange={e => setConsConsultantName(e.target.value)}
                          />
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Status</label>
                        <select
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
                      <label className="form-label">Discussion Agenda & Objectives</label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="e.g. Commercial REIT yield analysis & pass-through taxation discussion."
                        value={consAgenda}
                        onChange={e => setConsAgenda(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Outcome Notes & Recommendations</label>
                      <textarea
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
                    <label className="form-label">Link to Customer</label>

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
                        <label className="form-label app-new-customer-label">
                          New Customer Name * — a new Customer record will be created
                        </label>
                        <input
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
                  <label className="form-label">Phone Number</label>
                  <input
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
                    <label className="form-label">Scheduled Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      required
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Scheduled Time *</label>
                    <input
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
                <label className="form-label">Quick Notes</label>
                <textarea
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

          <div className="app-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setQuickCreateType(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Entry
            </button>
          </div>
        </form>
      </Modal>
    </SalesLayout>
  );
};

export default App;