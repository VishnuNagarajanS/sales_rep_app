import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

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
import { SITE_VISIT_TIME_SLOTS, formatSiteVisitSchedule } from './constants/siteVisit';

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

import { AlertCircle, Calendar, Plus } from 'lucide-react';
import { ProtectedRoute } from './components/common/Guards';
import { Modal } from './components/common/Modal';
import { storageService } from './services/storageService';
import { jaminApiService } from './services/jaminApiService';
import { toast } from './context/ToastContext';
import { Investor, Customer, Lead, Booking, SiteVisit, Followup } from './types';
import {
  saveFollowup as apiSaveFollowup,
  saveConsultation as apiSaveConsultation,
  saveDeal as apiSaveDeal,
  saveCustomer as apiSaveCustomer,
  getInvestors as apiGetInvestors,
  getCustomers as apiGetCustomers,
  getLeads as apiGetLeads,
} from './services/ghlApiService';
import { PERMISSIONS } from './constants/permissions';
import { FEATURES } from './constants/features';
import { useNavigationGuard, useUnsavedChanges } from './context/NavigationGuardContext';
import './App.css';

// Allowed routes corresponding to sidebar options
const SIDEBAR_ROUTES = [
  'dashboard',
  'leads',
  'all-leads',
  'pending-leads',
  'archived-leads',
  'assigned-leads',
  'customers',
  'pipeline',
  'deals',
  'followups',
  'call-center',
  'call-history',
  'call-settings',
  'projects',
  'plots',
  'site-visits',
  'bookings',
  'investors',
  'consultations',
  'opportunities',
  'kyc',
  'not-interested',
  'junk',
  'reports',
  'notifications',
  'company-users',
  'company-settings',
  'company-audit',
  'leave-requests',
  'work-handover',
  'irm-other',
  'other',
  'chat',
  'profile',
  'smarty-ai',
  'admin-dashboard',
  'admin-companies',
  'admin-users',
  'admin-roles',
  'admin-features',
  'admin-call-config',
  'admin-audit',
  'admin-security',
  'admin-system',
];

export const App: React.FC = () => {
  useEffect(() => {
    localStorage.removeItem('nexus_dev_deals');
    localStorage.removeItem('nexus_dev_leads');
  }, []);

  const { isAuthenticated, isSuperAdmin, tenant, user, enabledFeatures = [] } = useAuth();
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
  const isJamin = Boolean(
    tenant?.slug?.toLowerCase() === 'jamin' ||
    tenant?.id === 't-jamin-02' ||
    tenant?.id === '2' ||
    user?.companySlug?.toLowerCase() === 'jamin' ||
    (user?.companyName && /jamin/i.test(user.companyName)) ||
    (user?.companyId as any) === 2 ||
    (user?.companyId as any) === '2'
  );
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01' || tenant?.id === '1' || tenant?.slug === '1' || tenant?.name?.toLowerCase().includes('ghl') || user?.companySlug === 'ghl') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');

  // Set default route for IRM user or redirect invalid routes
  useEffect(() => {
    if (user?.role?.code === 'irm' && !isJamin && (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01')) {
      const savedRoute = sessionStorage.getItem('nexus_current_route');
      if (!savedRoute) {
        setCurrentRoute('dashboard');
        sessionStorage.setItem('nexus_current_route', 'dashboard');
      }
    } else if (user?.role?.code === 'sales_executive' && (currentRoute === 'kyc' || currentRoute === 'all-leads' || currentRoute === 'irm-other' || currentRoute === 'other' || currentRoute === 'investors' || currentRoute === 'opportunities')) {
      setCurrentRoute('dashboard');
      sessionStorage.setItem('nexus_current_route', 'dashboard');
    } else if (isJamin && currentRoute === 'kyc') {
      setCurrentRoute('dashboard');
      sessionStorage.setItem('nexus_current_route', 'dashboard');
    }
  }, [user?.role?.code, currentRoute, isJamin, tenant?.slug, tenant?.id]);

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
    'lead' | 'customer' | 'booking' | 'visit' | 'followup' | 'deal' | 'consultation' | null
  >(null);

  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickLocation, setQuickLocation] = useState('');
  const [quickSource, setQuickSource] = useState('Website Inbound');
  const [quickAssetClass, setQuickAssetClass] = useState('');
  const [quickInvestmentCapacity, setQuickInvestmentCapacity] = useState('');
  const [quickBudgetRange, setQuickBudgetRange] = useState('');
  const [quickPreferredLocation, setQuickPreferredLocation] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickPriority, setQuickPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [quickReadyToRegister, setQuickReadyToRegister] = useState<string>('Immediate');

  // Project & Plot selection for Quick Site Visit & Quick Booking
  const [quickProjectsList, setQuickProjectsList] = useState<any[]>([]);
  const [quickPlotsList, setQuickPlotsList] = useState<any[]>([]);
  const [quickProjectId, setQuickProjectId] = useState('');
  const [quickPlotId, setQuickPlotId] = useState('');
  const [isLoadingQuickPlots, setIsLoadingQuickPlots] = useState(false);
  const [quickTokenAmount, setQuickTokenAmount] = useState<number | ''>('');
  const [quickPaymentMode, setQuickPaymentMode] = useState('UPI');
  const [quickTimeSlot, setQuickTimeSlot] = useState<string>(SITE_VISIT_TIME_SLOTS[0]);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickError, setQuickError] = useState('');

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

  // Contact linkage for Booking, Site Visit & Follow-up
  const [quickContactSource, setQuickContactSource] = useState<'new' | 'lead' | 'customer'>('new');
  const [selectedLeadId, setSelectedLeadId] = useState('');

  // Live API contacts for dropdown selection
  const [liveCustomers, setLiveCustomers] = useState<Customer[]>([]);
  const [liveLeads, setLiveLeads] = useState<Lead[]>([]);
  const [isLoadingLiveContacts, setIsLoadingLiveContacts] = useState(false);

  const fetchLiveContacts = useCallback(async () => {
    setIsLoadingLiveContacts(true);
    const tenantId = user?.companyId ? String(user.companyId) : (tenant?.id || 't-jamin-02');
    try {
      const [leadsRes, custsRes, projsRes] = await Promise.all([
        isJamin
          ? jaminApiService.getLeads(true)
          : apiGetLeads(tenantId).catch(() => storageService.getLeads(tenantId)),
        isJamin
          ? jaminApiService.getCustomers()
          : apiGetCustomers(tenantId).catch(() => storageService.getCustomers(tenantId)),
        isJamin
          ? jaminApiService.getProjects()
          : Promise.resolve([]),
      ]);
      setLiveLeads(Array.isArray(leadsRes) ? leadsRes : []);
      setLiveCustomers(Array.isArray(custsRes) ? custsRes : []);
      if (Array.isArray(projsRes) && projsRes.length > 0) {
        setQuickProjectsList(projsRes);
      }
    } catch (err) {
      console.warn('Could not fetch live contacts for quick modal:', err);
      setLiveCustomers(storageService.getCustomers(tenantId));
      setLiveLeads(storageService.getLeads(tenantId));
    } finally {
      setIsLoadingLiveContacts(false);
    }
  }, [tenant?.id, user?.companyId, isJamin]);

  useEffect(() => {
    fetchLiveContacts();
    const handleSync = () => fetchLiveContacts();
    window.addEventListener('nexus_storage_updated', handleSync);
    return () => {
      window.removeEventListener('nexus_storage_updated', handleSync);
    };
  }, [fetchLiveContacts]);

  const availableCustomers = useMemo(() => {
    const apiList = liveCustomers && liveCustomers.length > 0 ? liveCustomers : storageService.getCustomers(tenant?.id);
    // In real estate, converted leads are also full customer profiles
    const convertedFromLeads = (liveLeads || []).filter(l => (l.status || '').toLowerCase() === 'converted');
    const existingPhones = new Set(apiList.map(c => (c.phone || '').replace(/\D/g, '').slice(-10)));
    const existingIds = new Set(apiList.map(c => String(c.id)));
    const merged = [...apiList];
    for (const cl of convertedFromLeads) {
      const phoneKey = (cl.phone || '').replace(/\D/g, '').slice(-10);
      if ((phoneKey && existingPhones.has(phoneKey)) || existingIds.has(String(cl.id))) continue;
      if (phoneKey) existingPhones.add(phoneKey);
      existingIds.add(String(cl.id));
      merged.push({
        id: String(cl.id),
        companyId: cl.companyId,
        name: cl.name,
        phone: cl.phone,
        email: cl.email || '',
        status: 'Active',
        assignedAgentId: cl.assignedAgentId,
        assignedAgentName: cl.assignedAgentName,
        location: cl.location || '',
        lastContacted: cl.createdAt || '',
        openDealsCount: 0,
        totalValue: 0,
        createdAt: cl.createdAt,
        notes: cl.notes,
        customFields: cl.customFields,
      });
    }
    return merged;
  }, [liveCustomers, liveLeads, tenant?.id]);

  const availableLeads = useMemo(() => {
    const list = liveLeads && liveLeads.length > 0 ? liveLeads : storageService.getLeads(tenant?.id);
    return list.filter(l => (l.status || '').toLowerCase() !== 'converted');
  }, [liveLeads, tenant?.id]);

  const quickEligiblePlots = useMemo(() => {
    if (!quickProjectId || !Array.isArray(quickPlotsList)) return [];
    return quickPlotsList.filter(p => {
      if (String(p.projectId) !== String(quickProjectId)) return false;
      const status = (p.status || '').trim().toLowerCase();
      return status === 'available';
    });
  }, [quickProjectId, quickPlotsList]);

  const handleQuickProjectChange = async (projId: string) => {
    setQuickProjectId(projId);
    setQuickPlotId('');
    if (projId) {
      setIsLoadingQuickPlots(true);
      try {
        const plots = await jaminApiService.getPlots(projId);
        setQuickPlotsList(plots || []);
      } catch (err) {
        console.error(`Failed to load plots for project ${projId}:`, err);
        setQuickPlotsList([]);
      } finally {
        setIsLoadingQuickPlots(false);
      }
    } else {
      setQuickPlotsList([]);
    }
  };

  const handleSwitchQuickTab = async (
    type: 'lead' | 'customer' | 'booking' | 'visit' | 'followup' | 'deal' | 'consultation'
  ) => {
    const resolvedType = isJamin && (type === 'deal' || type === 'consultation') ? 'lead' : type;
    setQuickCreateType(resolvedType);
    setQuickError('');
    fetchLiveContacts();

    if (resolvedType === 'booking') {
      const src = availableCustomers.length > 0 ? 'customer' : (availableLeads.length > 0 ? 'lead' : 'new');
      setQuickContactSource(src);
      if (src === 'customer' && availableCustomers[0]) {
        setSelectedCustomerId(availableCustomers[0].id);
        setSelectedLeadId('');
        setQuickName(availableCustomers[0].name);
        setQuickPhone(availableCustomers[0].phone);
        setQuickEmail(availableCustomers[0].email || '');
      } else if (src === 'lead' && availableLeads[0]) {
        setSelectedLeadId(availableLeads[0].id);
        setSelectedCustomerId('');
        setQuickName(availableLeads[0].name);
        setQuickPhone(availableLeads[0].phone);
        setQuickEmail(availableLeads[0].email || '');
      }
    } else if (resolvedType === 'visit' || resolvedType === 'followup') {
      const src = availableLeads.length > 0 ? 'lead' : (availableCustomers.length > 0 ? 'customer' : 'new');
      setQuickContactSource(src);
      if (src === 'lead' && availableLeads[0]) {
        setSelectedLeadId(availableLeads[0].id);
        setSelectedCustomerId('');
        setQuickName(availableLeads[0].name);
        setQuickPhone(availableLeads[0].phone);
        setQuickEmail(availableLeads[0].email || '');
      } else if (src === 'customer' && availableCustomers[0]) {
        setSelectedCustomerId(availableCustomers[0].id);
        setSelectedLeadId('');
        setQuickName(availableCustomers[0].name);
        setQuickPhone(availableCustomers[0].phone);
        setQuickEmail(availableCustomers[0].email || '');
      }
    }

    if (quickProjectsList.length === 0) {
      try {
        const projs = await jaminApiService.getProjects();
        setQuickProjectsList(projs || []);
        if (projs && projs.length > 0 && (resolvedType === 'visit' || resolvedType === 'booking') && !quickProjectId) {
          const firstProjId = String(projs[0].id);
          setQuickProjectId(firstProjId);
          setIsLoadingQuickPlots(true);
          const plots = await jaminApiService.getPlots(firstProjId);
          setQuickPlotsList(plots || []);
          setIsLoadingQuickPlots(false);
        }
      } catch (err) {
        console.error('Failed to load projects/plots for quick modal', err);
      }
    }
  };

  const isSavingQuickCreate = quickSubmitting;
  const quickCreateError = quickError;
  const setQuickCreateError = (msg: string | null) => setQuickError(msg || '');
  const setIsSavingQuickCreate = (val: boolean) => setQuickSubmitting(val);

  const isQuickCreateDirty = quickCreateType !== null && (
    quickName.trim().length > 0 ||
    quickPhone.replace('+91 ', '').trim().length > 0 ||
    quickNotes.trim().length > 0
  );
  useUnsavedChanges(isQuickCreateDirty, 'You have unsaved changes in Quick Create. Are you sure you want to discard them?', 'app-quick-create');

  const handleOpenQuickCreate = async (
    type: 'lead' | 'customer' | 'booking' | 'visit' | 'followup' | 'deal' | 'consultation'
  ) => {
    const resolvedType = isJamin && (type === 'deal' || type === 'consultation') ? 'lead' : type;
    setQuickCreateType(resolvedType);
    setQuickError('');
    setQuickSubmitting(false);
    fetchLiveContacts();

    let defaultSource: 'new' | 'lead' | 'customer' = 'new';
    if (resolvedType === 'booking') {
      defaultSource = availableCustomers.length > 0 ? 'customer' : (availableLeads.length > 0 ? 'lead' : 'new');
    } else if (resolvedType === 'visit' || resolvedType === 'followup') {
      defaultSource = availableLeads.length > 0 ? 'lead' : (availableCustomers.length > 0 ? 'customer' : 'new');
    }
    setQuickContactSource(defaultSource);

    if (defaultSource === 'customer' && availableCustomers.length > 0) {
      const firstCust = availableCustomers[0];
      setSelectedCustomerId(firstCust.id);
      setSelectedLeadId('');
      setQuickName(firstCust.name);
      setQuickPhone(firstCust.phone);
      setQuickEmail(firstCust.email || '');
      setQuickLocation(firstCust.location || '');
    } else if (defaultSource === 'lead' && availableLeads.length > 0) {
      const firstLead = availableLeads[0];
      setSelectedLeadId(firstLead.id);
      setSelectedCustomerId('');
      setQuickName(firstLead.name);
      setQuickPhone(firstLead.phone);
      setQuickEmail(firstLead.email || '');
      setQuickLocation(firstLead.location || '');
    } else {
      setSelectedLeadId('');
      setSelectedCustomerId('');
      setQuickName('');
      setQuickPhone('+91 ');
      setQuickEmail('');
      setQuickLocation('');
    }

    setQuickSource(tenant?.slug === 'jamin' ? '' : 'Website Inbound');
    setQuickAssetClass('');
    setQuickInvestmentCapacity('');
    setQuickBudgetRange('');
    setQuickPreferredLocation('');
    setQuickNotes('');
    setQuickPriority('Medium');
    setQuickReadyToRegister('Immediate');
    setQuickProjectId('');
    setQuickPlotId('');
    setQuickTokenAmount('');
    setQuickPaymentMode('UPI');
    setQuickTimeSlot(SITE_VISIT_TIME_SLOTS[0]);
    setConsInvestorId('');
    setConsInvestorName('');
    setConsInvestorPhone('');
    setConsSlot('');
    setConsConsultantName(user?.name || '');
    setConsStatus('Scheduled');
    setConsAgenda('');
    setConsOutcome('');
    setScheduledDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    setScheduledTime(storageService.getCallPreferences().defaultFollowupTime || '11:00');
    setDealCustomerMode('existing');
    setNewCustomerName('');

    try {
      const projs = await jaminApiService.getProjects();
      setQuickProjectsList(projs || []);
      if (projs && projs.length > 0) {
        const firstProjId = String(projs[0].id);
        if (resolvedType === 'visit' || resolvedType === 'booking') {
          setQuickProjectId(firstProjId);
          setIsLoadingQuickPlots(true);
          const plots = await jaminApiService.getPlots(firstProjId);
          setQuickPlotsList(plots || []);
          setIsLoadingQuickPlots(false);
        }
      } else {
        setQuickPlotsList([]);
      }
    } catch (err) {
      console.error('Failed to load projects/plots for quick modal', err);
      setQuickProjectsList([]);
      setQuickPlotsList([]);
    }
  };

  const handleSaveQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickError('');

    const currentCompanyId = tenant?.id || '';
    const currentAgentId = user?.id ? String(user.id) : '';
    const currentAgentName = user?.name || '';

    // Validation
    if (quickCreateType !== 'consultation') {
      if (!quickName.trim()) {
        setQuickError('Name is required.');
        return;
      }
      if (!quickPhone.trim()) {
        setQuickError('Phone number is required.');
        return;
      }
    }

    setQuickSubmitting(true);

    try {
      if (quickCreateType === 'lead') {
        let createdLead: Lead | null = null;
        const selProj = quickProjectId ? quickProjectsList.find(p => String(p.id) === String(quickProjectId)) : null;
        const resolvedTargetDev = selProj?.name || quickPreferredLocation.trim();
        const resolvedLocation = quickLocation.trim() || selProj?.location || '';

        // Only auto-assign if the creator is actually a sales executive!
        // Company Admins, Managers, and Super Admins create UNASSIGNED leads so they can assign them to sales executives.
        const isSalesExec = user?.role?.code === 'sales_executive';
        const assignedId = isSalesExec && user?.id ? Number(user.id) : undefined;
        const assignedName = isSalesExec && user?.name ? user.name : 'Unassigned';

        if (isJamin) {
          try {
            createdLead = await jaminApiService.createLead({
              name: quickName.trim(),
              phone: quickPhone.trim(),
              email: quickEmail.trim() || undefined,
              location: resolvedLocation || undefined,
              targetDevelopment: resolvedTargetDev || undefined,
              source: quickSource.trim() || undefined,
              priority: quickPriority,
              budgetRange: quickBudgetRange.trim() || undefined,
              readyToRegister: quickReadyToRegister,
              notes: quickNotes.trim() || undefined,
              assignedAgentId: assignedId,
            });
          } catch (apiErr: any) {
            console.warn('Backend create lead note:', apiErr);
          }
        }

        const finalLead: Lead = createdLead || {
          id: `lead-${Date.now()}`,
          companyId: currentCompanyId,
          name: quickName.trim(),
          phone: quickPhone.trim(),
          email: quickEmail.trim(),
          location: resolvedLocation,
          source: quickSource.trim(),
          status: 'New',
          priority: quickPriority,
          readyToRegister: quickReadyToRegister,
          assignedAgentId: assignedId ? String(assignedId) : '',
          assignedAgentName: assignedName,
          createdAt: new Date().toISOString().split('T')[0],
          notes: quickNotes.trim(),
          targetDevelopment: resolvedTargetDev,
          customFields: tenant?.slug === 'jamin'
            ? {
              budgetRange: quickBudgetRange.trim(),
              preferredLocation: resolvedTargetDev,
              targetDevelopment: resolvedTargetDev,
              readyToRegister: quickReadyToRegister,
            }
            : {
              assetClass: quickAssetClass.trim(),
              preferredAssetClass: quickAssetClass.trim(),
              investmentCapacity: quickInvestmentCapacity.trim(),
            },
        };
        storageService.saveLead(finalLead);
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'customer') {
        const newCust: Customer = {
          id: `cust-${Date.now()}`,
          companyId: currentCompanyId,
          name: quickName.trim(),
          phone: quickPhone.trim(),
          email: quickEmail.trim(),
          location: quickLocation.trim(),
          status: 'Active',
          assignedAgentId: currentAgentId,
          assignedAgentName: currentAgentName,
          lastContacted: new Date().toISOString().split('T')[0],
          openDealsCount: 0,
          totalValue: 0,
          createdAt: new Date().toISOString().split('T')[0],
          notes: quickNotes.trim(),
          customFields: {},
        };
        storageService.saveCustomer(newCust);
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'booking') {
        let linkedCustomerName = quickName.trim();
        let linkedCustomerPhone = quickPhone.trim();
        let linkedCustomerId = selectedCustomerId;

        // Auto-provision Customer record if creating for a new contact
        if (quickContactSource === 'new' && !selectedCustomerId && !selectedLeadId) {
          const autoCust: Customer = {
            id: `cust-${Date.now()}`,
            companyId: currentCompanyId,
            name: quickName.trim(),
            phone: quickPhone.trim(),
            email: quickEmail.trim(),
            location: quickLocation.trim(),
            status: 'Active',
            assignedAgentId: currentAgentId,
            assignedAgentName: currentAgentName,
            lastContacted: new Date().toISOString().split('T')[0],
            openDealsCount: 1,
            totalValue: Number(quickTokenAmount) || 0,
            createdAt: new Date().toISOString().split('T')[0],
            notes: `Auto-created from Quick Booking on ${new Date().toLocaleDateString()}`,
            customFields: {},
          };
          storageService.saveCustomer(autoCust);
          linkedCustomerId = autoCust.id;
        }

        const selProj = quickProjectsList.find(p => String(p.id) === String(quickProjectId));
        const selPlot = quickPlotsList.find(p => String(p.id) === String(quickPlotId));
        const projName = selProj?.name || (quickProjectId ? `Project #${quickProjectId}` : 'Residential Plots');
        const plotNum = selPlot?.plotNumber || (quickPlotId ? `Plot #${quickPlotId}` : 'Plot Assignment Pending');
        const plotArea = selPlot?.sizeSqFt ? `${selPlot.sizeSqFt} sq ft` : '1,500 sq ft';
        const numToken = Number(quickTokenAmount) || 50000;

        const newBk: Booking = {
          id: `bk-${Date.now()}`,
          bookingId: `JB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          companyId: currentCompanyId,
          customerId: linkedCustomerId || `cust-${Date.now()}`,
          customerName: linkedCustomerName,
          customerPhone: linkedCustomerPhone,
          projectName: projName,
          plotNumber: plotNum,
          plotArea,
          status: 'Token Paid',
          tokenAmount: numToken,
          totalAmount: numToken * 10,
          balanceAmount: (numToken * 10) - numToken,
          tokenPaidDate: new Date().toISOString().split('T')[0],
          paymentMode: quickPaymentMode,
          assignedAgentId: currentAgentId,
          assignedAgentName: currentAgentName,
          notes: `Quick Booking created on ${new Date().toLocaleDateString()}.${quickNotes ? ' Notes: ' + quickNotes.trim() : ''}`,
          createdAt: new Date().toISOString().split('T')[0],
        };
        storageService.saveBooking(newBk);

        // Mark plot as 'Booked' in stores if plot selected
        if (quickPlotId) {
          try {
            const plotToUpdate = storageService.getPlots().find(p => String(p.id) === String(quickPlotId));
            if (plotToUpdate) {
              storageService.savePlot({
                ...plotToUpdate,
                status: 'Sold',
                heldByCustomerId: linkedCustomerId,
                holdByCustomer: linkedCustomerName,
              });
            }
          } catch (e) {
            console.warn('Could not sync plot status:', e);
          }
        }
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'visit') {
        const selProj = quickProjectsList.find(p => String(p.id) === String(quickProjectId));
        const selPlot = quickPlotsList.find(p => String(p.id) === String(quickPlotId));
        const devName = selProj?.name || (quickProjectId ? `Project #${quickProjectId}` : (quickPreferredLocation || 'Site'));
        const plotStr = selPlot?.plotNumber ? `Plot #${selPlot.plotNumber}` : (quickPlotId ? `Plot #${quickPlotId}` : undefined);

        const newVisit: SiteVisit = {
          id: `sv-${Date.now()}`,
          companyId: currentCompanyId,
          leadId: selectedLeadId || `lead-${Date.now()}`,
          leadName: quickName.trim(),
          leadPhone: quickPhone.trim(),
          developmentName: devName,
          plotNumber: plotStr,
          scheduledDate,
          scheduledTimeSlot: quickTimeSlot,
          status: 'Scheduled',
          assignedAgentId: currentAgentId,
          assignedAgentName: currentAgentName,
          notes: quickNotes.trim(),
          createdAt: new Date().toISOString().split('T')[0],
        };
        storageService.saveSiteVisit(newVisit);

        // Also schedule a corresponding Follow-up reminder for the visit day
        const linkedFollowup: Followup = {
          id: `flw-${Date.now()}`,
          companyId: currentCompanyId,
          contactId: selectedLeadId || selectedCustomerId || `lead-${Date.now()}`,
          contactName: quickName.trim(),
          contactPhone: quickPhone.trim(),
          contactType: selectedCustomerId ? 'customer' : 'lead',
          scheduledAt: new Date(`${scheduledDate}T10:00:00`).toISOString(),
          scheduledDate,
          scheduledTime: '10:00',
          priority: 'High',
          status: 'Pending',
          notes: `Site visit reminder for ${devName}${plotStr ? ' (' + plotStr + ')' : ''} scheduled at ${quickTimeSlot}. ${quickNotes.trim()}`,
          assignedAgentId: currentAgentId,
          assignedAgentName: currentAgentName,
        };
        storageService.saveFollowup(linkedFollowup);
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'followup') {
        const combinedDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
        const newFlw: Followup = {
          id: `flw-${Date.now()}`,
          companyId: currentCompanyId,
          contactId: selectedCustomerId || selectedLeadId || `contact-${Date.now()}`,
          contactName: quickName.trim(),
          contactPhone: quickPhone.trim(),
          contactType: selectedCustomerId ? 'customer' : 'lead',
          scheduledAt: combinedDateTime,
          scheduledDate,
          scheduledTime,
          priority: 'High',
          status: 'Pending',
          notes: quickNotes.trim(),
          assignedAgentId: currentAgentId,
          assignedAgentName: currentAgentName,
        };
        storageService.saveFollowup(newFlw);
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'consultation') {
        storageService.saveConsultation({
          id: `cons-${Date.now()}`,
          companyId: currentCompanyId,
          investorId: consInvestorId || `inv-${Date.now()}`,
          investorName: consInvestorName || quickName.trim(),
          investorPhone: consInvestorPhone || quickPhone.trim(),
          scheduledAt: consSlot.trim() || new Date(Date.now() + 86400000).toISOString(),
          consultantId: currentAgentId,
          consultantName: consConsultantName.trim() || currentAgentName,
          status: consStatus,
          agenda: consAgenda.trim(),
          outcomeNotes: consOutcome.trim() || undefined,
        });
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'deal') {
        let resolvedCustId = selectedCustomerId;
        let resolvedCustName = quickName.trim();

        if (dealCustomerMode === 'new') {
          if (!newCustomerName.trim()) {
            setQuickError('Please enter the customer name.');
            setQuickSubmitting(false);
            return;
          }
          const createdCust: Customer = {
            id: `cust-${Date.now()}`,
            companyId: currentCompanyId,
            name: newCustomerName.trim(),
            phone: quickPhone.trim(),
            email: '',
            location: 'Bengaluru',
            status: 'Active',
            assignedAgentId: currentAgentId,
            assignedAgentName: currentAgentName,
            lastContacted: new Date().toISOString().split('T')[0],
            openDealsCount: 1,
            totalValue: 5000000,
            createdAt: new Date().toISOString().split('T')[0],
            notes: '',
            customFields: {},
          };
          storageService.saveCustomer(createdCust);
          resolvedCustId = createdCust.id;
          resolvedCustName = createdCust.name;
        } else {
          const cust = availableCustomers.find(c => String(c.id) === String(selectedCustomerId));
          if (cust) {
            resolvedCustName = cust.name;
          }
        }

        storageService.saveDeal({
          id: `deal-${Date.now()}`,
          companyId: currentCompanyId,
          title: quickName.trim(),
          customerId: resolvedCustId,
          customerName: resolvedCustName,
          stage: 'new',
          value: 5000000,
          expectedCloseDate: '30 Days',
          assignedAgentId: currentAgentId,
          assignedAgentName: currentAgentName,
          notes: quickNotes.trim(),
          createdAt: new Date().toISOString().split('T')[0],
        });
        window.dispatchEvent(new Event('nexus_storage_updated'));
      }

      const createdTypeLabel = quickCreateType === 'visit' ? 'Site visit' : (quickCreateType ? quickCreateType.charAt(0).toUpperCase() + quickCreateType.slice(1) : 'Item');
      toast.success(`✓ ${createdTypeLabel} created successfully!`);
      setQuickCreateType(null);
    } catch (err: any) {
      console.error('Quick create failed:', err);
      const msg = err?.message || 'Failed to save entry. Please try again.';
      setQuickError(msg);
      toast.error(msg);
    } finally {
      setQuickSubmitting(false);
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
          {isGhlAdmin || isJamin ? (
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
        <ProtectedRoute feature={FEATURES.PROPERTIES} permission={PERMISSIONS.PROPERTIES_VIEW}>
          <ProjectsPage onNavigate={navigate} />
        </ProtectedRoute>
      ) : currentRoute === 'plots' ? (
        <ProtectedRoute feature={FEATURES.PROPERTIES} permission={PERMISSIONS.PROPERTIES_VIEW}>
          <PlotsPage />
        </ProtectedRoute>
      ) : currentRoute === 'site-visits' ? (
        <ProtectedRoute feature={FEATURES.SITE_VISITS} permission={PERMISSIONS.SITE_VISITS_VIEW}>
          <SiteVisitsPage />
        </ProtectedRoute>
      ) : currentRoute === 'bookings' ? (
        <ProtectedRoute feature={FEATURES.BOOKINGS} permission={PERMISSIONS.BOOKINGS_VIEW}>
          <BookingsPage />
        </ProtectedRoute>
      ) : currentRoute === 'kyc' ? (
        user?.role?.code === 'sales_executive' || isJamin ? (
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
          <ProtectedRoute feature={FEATURES.INVESTORS} permission={PERMISSIONS.INVESTORS_VIEW}>
            <InvestorsPage />
          </ProtectedRoute>
        )
      ) : currentRoute === 'consultations' ? (
        <ProtectedRoute feature={FEATURES.CONSULTATIONS} permission={PERMISSIONS.CONSULTATIONS_VIEW}>
          <ConsultationsPage />
        </ProtectedRoute>
      ) : currentRoute === 'opportunities' ? (
        user?.role?.code === 'sales_executive' ? (
          <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
        ) : (
          <ProtectedRoute feature={FEATURES.INVESTMENT_OPPORTUNITIES} permission={PERMISSIONS.OPPORTUNITIES_VIEW}>
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
        <ProtectedRoute feature={FEATURES.REPORTS} permission={PERMISSIONS.REPORTS_VIEW}>
          <ReportsPage />
        </ProtectedRoute>
      ) : currentRoute === 'notifications' ? (
        <NotificationsPage onNavigate={navigate} />
      ) : currentRoute === 'company-users' ? (
        <ProtectedRoute feature={FEATURES.USERS} permission={PERMISSIONS.USERS_VIEW}>
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
        <ProtectedRoute feature={FEATURES.COMPANY_SETTINGS} permission={PERMISSIONS.SETTINGS_VIEW}>
          <CompanySettingsPage />
        </ProtectedRoute>
      ) : currentRoute === 'company-audit' ? (
        <ProtectedRoute feature={FEATURES.AUDIT_LOGS} permission={PERMISSIONS.AUDIT_VIEW}>
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
        maxWidth={640}
        onClose={() => {
          if (!quickSubmitting) {
            setQuickCreateType(null);
            setQuickError('');
          }
        }}
        title={
          quickCreateType === 'lead' ? 'Quick Create: New Lead' :
            quickCreateType === 'customer' ? 'Quick Create: New Customer' :
              quickCreateType === 'booking' ? 'Quick Create: New Booking' :
                quickCreateType === 'visit' ? 'Quick Schedule: Site Visit' :
                  quickCreateType === 'followup' ? 'Quick Schedule: Follow-up' :
                    quickCreateType === 'consultation' ? 'Quick Schedule: Consultation' :
                      quickCreateType === 'deal' ? 'Quick Create: New Deal' : 'Quick Create'
        }
        subtitle={`Instant creation into ${tenant?.name || 'Workspace'}`}
      >
        {/* Quick Action Switcher Tabs */}
        <div
          className="quick-action-tabs"
          style={{
            display: 'flex',
            gap: '6px',
            backgroundColor: 'var(--bg-surface-hover, #f1f5f9)',
            padding: '5px',
            borderRadius: '9px',
            marginBottom: '18px',
            flexWrap: 'nowrap',
            alignItems: 'stretch',
            width: '100%',
            minHeight: '44px',
            boxSizing: 'border-box'
          }}
        >
          {[
            { id: 'lead', label: 'New Lead' },
            { id: 'customer', label: 'New Customer' },
            ...(isJamin || (Array.isArray(enabledFeatures) && enabledFeatures.includes(FEATURES.BOOKINGS))
              ? [{ id: 'booking', label: 'New Booking' }] : []),
            ...(isJamin || (Array.isArray(enabledFeatures) && enabledFeatures.includes(FEATURES.SITE_VISITS))
              ? [{ id: 'visit', label: 'Site Visit' }] : []),
            { id: 'followup', label: 'Follow-up' },
            ...(!isJamin && Array.isArray(enabledFeatures) && enabledFeatures.includes(FEATURES.CONSULTATIONS)
              ? [{ id: 'consultation', label: 'Consultation' }] : []),
            ...(!isJamin && Array.isArray(enabledFeatures) && enabledFeatures.includes(FEATURES.DEALS)
              ? [{ id: 'deal', label: 'Deal' }] : []),
          ].map(tab => {
            const isActive = quickCreateType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSwitchQuickTab(tab.id as any)}
                style={{
                  flex: '1 1 0',
                  height: '34px',
                  minHeight: '34px',
                  padding: '0 8px',
                  borderRadius: '7px',
                  fontSize: '12.5px',
                  lineHeight: '34px',
                  fontWeight: isActive ? 600 : 500,
                  border: isActive ? '1px solid rgba(220, 38, 38, 0.25)' : '1px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  backgroundColor: isActive ? 'var(--bg-surface, #ffffff)' : 'transparent',
                  color: isActive ? '#dc2626' : 'var(--text-secondary, #64748b)',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  boxSizing: 'border-box'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSaveQuickCreate} className="app-quickcreate-form">
          {quickError && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              color: '#ef4444',
              fontSize: 13,
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{quickError}</span>
            </div>
          )}

          {/* ── 1. LEAD: Prospect Lead Form ── */}
          {quickCreateType === 'lead' ? (
            <>
              <div className="form-group">
                <label htmlFor="quick-lead-name" className="form-label">Full Name *</label>
                <input
                  id="quick-lead-name"
                  name="fullName"
                  type="text"
                  className="form-input"
                  required
                  value={quickName}
                  onChange={e => { setQuickName(e.target.value); setQuickError(''); }}
                  placeholder="e.g. Ramesh Chandra"
                />
              </div>

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
                    onChange={e => { setQuickPhone(e.target.value); setQuickError(''); }}
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
                    placeholder={tenant?.slug === 'jamin' ? "e.g. Bengaluru" : "e.g. Bengaluru, Indiranagar"}
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
                    <option value="">— Select Source —</option>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label htmlFor="quick-lead-priority" className="form-label">Priority</label>
                  <select
                    id="quick-lead-priority"
                    name="priority"
                    className="form-select"
                    value={quickPriority}
                    onChange={e => setQuickPriority(e.target.value as any)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">🔥 Urgent</option>
                  </select>
                </div>
                {tenant?.slug === 'jamin' ? (
                  <div className="form-group">
                    <label htmlFor="quick-lead-register" className="form-label">Registration Timeline</label>
                    <select
                      id="quick-lead-register"
                      name="readyToRegister"
                      className="form-select"
                      value={quickReadyToRegister}
                      onChange={e => setQuickReadyToRegister(e.target.value)}
                    >
                      <option value="Immediate">Immediate</option>
                      <option value="Within 30 Days">Within 30 Days</option>
                      <option value="Within 60 Days">Within 60 Days</option>
                      <option value="Within 90 Days">Within 90 Days</option>
                      <option value="Exploring">Exploring / Future</option>
                    </select>
                  </div>
                ) : <div />}
              </div>

              <div className="lead-custom-schema-box">
                <div className="lead-custom-schema-title">
                  {tenant?.slug === 'jamin'
                    ? `${tenant?.name || 'Jamin Bazaar'} Property Preferences`
                    : 'Asset Terms'}
                </div>

                {tenant?.slug === 'jamin' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label htmlFor="quick-lead-budget" className="form-label">Plot Budget Range</label>
                      <select
                        id="quick-lead-budget"
                        name="budgetRange"
                        className="form-select"
                        value={quickBudgetRange}
                        onChange={e => setQuickBudgetRange(e.target.value)}
                      >
                        <option value="">— Select Budget Range —</option>
                        <option value="₹25L – ₹45L">₹25L – ₹45L</option>
                        <option value="₹45L – ₹65L">₹45L – ₹65L</option>
                        <option value="₹65L – ₹90L">₹65L – ₹90L</option>
                        <option value="₹90L+">₹90L+</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="quick-lead-project" className="form-label">Preferred Project</label>
                      <select
                        id="quick-lead-project"
                        name="project"
                        className="form-select"
                        value={quickProjectId}
                        onChange={e => {
                          const val = e.target.value;
                          setQuickProjectId(val);
                          const matching = quickProjectsList.find(p => String(p.id) === String(val));
                          if (matching) {
                            setQuickPreferredLocation(matching.name);
                            if (!quickLocation && matching.location) {
                              setQuickLocation(matching.location);
                            }
                          } else {
                            setQuickPreferredLocation('');
                          }
                        }}
                      >
                        <option value="">
                          {quickProjectsList.length === 0
                            ? '— Loading projects from server... —'
                            : `— Select Project (${quickProjectsList.length} available) —`}
                        </option>
                        {quickProjectsList.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.location ? `(${p.location})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {user?.role?.code !== 'sales_executive' && (
                      <div className="form-group">
                        <label className="form-label">Asset Class</label>
                        <select
                          className="form-select"
                          value={quickAssetClass}
                          onChange={e => setQuickAssetClass(e.target.value)}
                        >
                          <option value="">— Select Asset Class —</option>
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
                        <option value="">— Select Capacity Range —</option>
                        {[
                          'Contact for Co-Invest Details',
                          '₹1 Cr – ₹5 Cr',
                          '₹5 Cr – ₹10 Cr',
                          '₹10 Cr – ₹25 Cr',
                          '₹25 Cr+',
                          'Not sure yet — help me decide'
                        ].map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="quick-lead-notes" className="form-label">Notes & Requirements</label>
                <textarea
                  id="quick-lead-notes"
                  name="notes"
                  className="form-textarea"
                  rows={2}
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  placeholder="Client background, key objections, time horizon..."
                />
              </div>
            </>

            /* ── 2. CUSTOMER: New Customer Form ── */
          ) : quickCreateType === 'customer' ? (
            <>
              <div className="form-group">
                <label className="form-label">Customer Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={quickName}
                  onChange={e => { setQuickName(e.target.value); setQuickError(''); }}
                  placeholder="e.g. Anand Mahindra"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={quickPhone}
                    onChange={e => { setQuickPhone(e.target.value); setQuickError(''); }}
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
                    placeholder="client@example.com"
                  />
                </div>
              </div>

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
                <label className="form-label">Notes & Requirements</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  placeholder="Preferences, investment size, specific needs..."
                />
              </div>
            </>

            /* ── 3. BOOKING: New Booking Form ── */
          ) : quickCreateType === 'booking' ? (
            <>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Buyer Source</label>
                <div className="app-segmented-toggle">
                  {(['customer', 'lead', 'new'] as const).map(src => (
                    <button
                      key={src}
                      type="button"
                      className={`btn btn-sm app-segmented-btn ${quickContactSource === src ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => {
                        setQuickContactSource(src);
                        if (src === 'new') {
                          setSelectedCustomerId('');
                          setSelectedLeadId('');
                        }
                      }}
                    >
                      {src === 'customer' ? 'Existing Customer' : src === 'lead' ? 'Existing Lead' : 'New Buyer'}
                    </button>
                  ))}
                </div>

                {quickContactSource === 'customer' && (
                  <select
                    className="form-select"
                    value={selectedCustomerId}
                    onChange={e => {
                      const cId = e.target.value;
                      setSelectedCustomerId(cId);
                      const found = availableCustomers.find(c => c.id === cId);
                      if (found) {
                        setQuickName(found.name);
                        setQuickPhone(found.phone);
                        if (found.email) setQuickEmail(found.email);
                      }
                    }}
                  >
                    <option value="">
                      {isLoadingLiveContacts
                        ? '— Loading customers from server... —'
                        : availableCustomers.length === 0
                          ? '— No existing customers found —'
                          : `— Select Customer (${availableCustomers.length} available) —`}
                    </option>
                    {availableCustomers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `· ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
                )}

                {quickContactSource === 'lead' && (
                  <select
                    className="form-select"
                    value={selectedLeadId}
                    onChange={e => {
                      const lId = e.target.value;
                      setSelectedLeadId(lId);
                      const found = availableLeads.find(l => l.id === lId);
                      if (found) {
                        setQuickName(found.name);
                        setQuickPhone(found.phone);
                        if (found.email) setQuickEmail(found.email);
                      }
                    }}
                  >
                    <option value="">
                      {isLoadingLiveContacts
                        ? '— Loading leads from server... —'
                        : availableLeads.length === 0
                          ? '— No active leads found —'
                          : `— Select Lead (${availableLeads.length} available) —`}
                    </option>
                    {availableLeads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.phone ? `· ${l.phone}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Buyer Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={quickName}
                    onChange={e => { setQuickName(e.target.value); setQuickError(''); }}
                    placeholder="e.g. Buyer Name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Buyer Mobile *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={quickPhone}
                    onChange={e => { setQuickPhone(e.target.value); setQuickError(''); }}
                    placeholder="+91 98800 00000"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Project *</label>
                  <select
                    className="form-select"
                    value={quickProjectId}
                    onChange={e => handleQuickProjectChange(e.target.value)}
                    required
                  >
                    <option value="">
                      {quickProjectsList.length === 0
                        ? '— Loading projects from server... —'
                        : `— Select Project (${quickProjectsList.length} available) —`}
                    </option>
                    {quickProjectsList.map(p => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} {p.location ? `· ${p.location}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Plot / Unit * {isLoadingQuickPlots && <span style={{ fontSize: 11, color: '#3b82f6' }}>(Loading...)</span>}
                  </label>
                  <select
                    className="form-select"
                    value={quickPlotId}
                    onChange={e => { setQuickPlotId(e.target.value); setQuickError(''); }}
                    required
                    disabled={!quickProjectId || isLoadingQuickPlots}
                  >
                    <option value="">— Select Available Plot —</option>
                    {quickEligiblePlots.map(pl => (
                      <option key={pl.id} value={String(pl.id)}>
                        Plot {pl.plotNumber} {pl.dimensions ? `· ${pl.dimensions}` : ''} {pl.price ? `· ₹${Number(pl.price).toLocaleString('en-IN')}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Token Amount Paid (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={quickTokenAmount}
                    onChange={e => setQuickTokenAmount(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 50000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-select"
                    value={quickPaymentMode}
                    onChange={e => setQuickPaymentMode(e.target.value)}
                  >
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Booking Notes</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  placeholder="Special conditions, token receipt ref, payment terms..."
                />
              </div>
            </>

            /* ── 4. VISIT: Schedule Site Visit Form ── */
          ) : quickCreateType === 'visit' ? (
            <>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Visitor Contact Source</label>
                <div className="app-segmented-toggle">
                  {(['lead', 'customer', 'new'] as const).map(src => (
                    <button
                      key={src}
                      type="button"
                      className={`btn btn-sm app-segmented-btn ${quickContactSource === src ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => {
                        setQuickContactSource(src);
                        if (src === 'new') {
                          setSelectedCustomerId('');
                          setSelectedLeadId('');
                        }
                      }}
                    >
                      {src === 'lead' ? 'Existing Lead' : src === 'customer' ? 'Existing Customer' : 'New Visitor'}
                    </button>
                  ))}
                </div>

                {quickContactSource === 'lead' && (
                  <select
                    className="form-select"
                    value={selectedLeadId}
                    onChange={e => {
                      const lId = e.target.value;
                      setSelectedLeadId(lId);
                      const found = availableLeads.find(l => l.id === lId);
                      if (found) {
                        setQuickName(found.name);
                        setQuickPhone(found.phone);
                        if (found.email) setQuickEmail(found.email);
                      }
                    }}
                  >
                    <option value="">
                      {isLoadingLiveContacts
                        ? '— Loading leads from server... —'
                        : availableLeads.length === 0
                          ? '— No active leads found —'
                          : `— Select Lead (${availableLeads.length} available) —`}
                    </option>
                    {availableLeads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.phone ? `· ${l.phone}` : ''}
                      </option>
                    ))}
                  </select>
                )}

                {quickContactSource === 'customer' && (
                  <select
                    className="form-select"
                    value={selectedCustomerId}
                    onChange={e => {
                      const cId = e.target.value;
                      setSelectedCustomerId(cId);
                      const found = availableCustomers.find(c => c.id === cId);
                      if (found) {
                        setQuickName(found.name);
                        setQuickPhone(found.phone);
                        if (found.email) setQuickEmail(found.email);
                      }
                    }}
                  >
                    <option value="">
                      {isLoadingLiveContacts
                        ? '— Loading customers from server... —'
                        : availableCustomers.length === 0
                          ? '— No existing customers found —'
                          : `— Select Customer (${availableCustomers.length} available) —`}
                    </option>
                    {availableCustomers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `· ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Visitor / Client Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={quickName}
                    onChange={e => { setQuickName(e.target.value); setQuickError(''); }}
                    placeholder="e.g. Ramesh Chandra"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={quickPhone}
                    onChange={e => { setQuickPhone(e.target.value); setQuickError(''); }}
                    placeholder="+91 98800 00000"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Visit Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time Slot *</label>
                  <select
                    className="form-select"
                    value={quickTimeSlot}
                    onChange={e => setQuickTimeSlot(e.target.value)}
                  >
                    {SITE_VISIT_TIME_SLOTS.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Project *</label>
                  <select
                    className="form-select"
                    value={quickProjectId}
                    onChange={e => handleQuickProjectChange(e.target.value)}
                    required
                  >
                    <option value="">
                      {quickProjectsList.length === 0
                        ? '— Loading projects from server... —'
                        : `— Select Project (${quickProjectsList.length} available) —`}
                    </option>
                    {quickProjectsList.map(p => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} {p.location ? `· ${p.location}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Specific Plot <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>(optional)</span>
                  </label>
                  <select
                    className="form-select"
                    value={quickPlotId}
                    onChange={e => setQuickPlotId(e.target.value)}
                    disabled={!quickProjectId || isLoadingQuickPlots}
                  >
                    <option value="">-- General Project Tour --</option>
                    {quickEligiblePlots.map(pl => (
                      <option key={pl.id} value={String(pl.id)}>
                        Plot {pl.plotNumber} {pl.dimensions ? `· ${pl.dimensions}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Visit Notes / Requirements</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  placeholder="Cab pickup, family visit, plot preferences..."
                />
              </div>
            </>

            /* ── 5. FOLLOWUP: Schedule Follow-up Form ── */
          ) : quickCreateType === 'followup' ? (
            <>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Contact Source</label>
                <div className="app-segmented-toggle">
                  {(['lead', 'customer', 'new'] as const).map(src => (
                    <button
                      key={src}
                      type="button"
                      className={`btn btn-sm app-segmented-btn ${quickContactSource === src ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => {
                        setQuickContactSource(src);
                        if (src === 'new') {
                          setSelectedCustomerId('');
                          setSelectedLeadId('');
                        }
                      }}
                    >
                      {src === 'lead' ? 'Existing Lead' : src === 'customer' ? 'Existing Customer' : 'New Contact'}
                    </button>
                  ))}
                </div>

                {quickContactSource === 'lead' && (
                  <select
                    className="form-select"
                    value={selectedLeadId}
                    onChange={e => {
                      const lId = e.target.value;
                      setSelectedLeadId(lId);
                      const found = availableLeads.find(l => l.id === lId);
                      if (found) {
                        setQuickName(found.name);
                        setQuickPhone(found.phone);
                        if (found.email) setQuickEmail(found.email);
                      }
                    }}
                  >
                    <option value="">
                      {isLoadingLiveContacts
                        ? '— Loading leads from server... —'
                        : availableLeads.length === 0
                          ? '— No active leads found —'
                          : `— Select Lead (${availableLeads.length} available) —`}
                    </option>
                    {availableLeads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.phone ? `· ${l.phone}` : ''}
                      </option>
                    ))}
                  </select>
                )}

                {quickContactSource === 'customer' && (
                  <select
                    className="form-select"
                    value={selectedCustomerId}
                    onChange={e => {
                      const cId = e.target.value;
                      setSelectedCustomerId(cId);
                      const found = availableCustomers.find(c => c.id === cId);
                      if (found) {
                        setQuickName(found.name);
                        setQuickPhone(found.phone);
                        if (found.email) setQuickEmail(found.email);
                      }
                    }}
                  >
                    <option value="">
                      {isLoadingLiveContacts
                        ? '— Loading customers from server... —'
                        : availableCustomers.length === 0
                          ? '— No existing customers found —'
                          : `— Select Customer (${availableCustomers.length} available) —`}
                    </option>
                    {availableCustomers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `· ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Contact Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={quickName}
                    onChange={e => { setQuickName(e.target.value); setQuickError(''); }}
                    placeholder="e.g. Ramesh Chandra"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={quickPhone}
                    onChange={e => { setQuickPhone(e.target.value); setQuickError(''); }}
                    placeholder="+91 98800 00000"
                  />
                </div>
              </div>

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

              <div className="form-group">
                <label className="form-label">Follow-up Notes</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  placeholder="Agenda for follow-up call, discussion topics..."
                />
              </div>
            </>

            /* ── 6. CONSULTATION: Schedule Consultation Form ── */
          ) : quickCreateType === 'consultation' ? (
            <>
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
                        rows={2}
                        placeholder="Key discussion topics, yield requirements, investor questions..."
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
                        rows={2}
                        placeholder="Record key takeaways, investor interest level, follow-up requirements..."
                        value={consOutcome}
                        onChange={e => setConsOutcome(e.target.value)}
                      />
                    </div>
                  </>
                );
              })()}
            </>

            /* ── 7. DEAL: Deal Linked to Customer ── */
          ) : (
            <>
              {(() => {
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

              <div className="form-group">
                <label className="form-label">Deal Title *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={quickName}
                  onChange={e => { setQuickName(e.target.value); setQuickError(''); }}
                  placeholder="e.g. Commercial Office Acquisition"
                />
              </div>

              {!(dealCustomerMode === 'existing') && (
                <div className="form-group">
                  <label htmlFor="quick-generic-phone" className="form-label">Customer Phone</label>
                  <input
                    id="quick-generic-phone"
                    name="phone"
                    type="text"
                    className="form-input"
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    placeholder="+91 98800 00000"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="quick-deal-notes" className="form-label">Deal Notes</label>
                <textarea
                  id="quick-deal-notes"
                  name="notes"
                  className="form-textarea"
                  rows={2}
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  placeholder="Deal background, expected terms..."
                />
              </div>
            </>
          )}

          {(quickError || quickCreateError) && (
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
              {quickError || quickCreateError}
            </div>
          )}

          <div className="app-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setQuickCreateType(null)}
              disabled={quickSubmitting || isSavingQuickCreate}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={quickSubmitting || isSavingQuickCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
            >
              {quickCreateType === 'visit' || quickCreateType === 'followup' || quickCreateType === 'consultation' ? (
                <Calendar size={14} />
              ) : (
                <Plus size={14} />
              )}
              {quickSubmitting || isSavingQuickCreate
                ? 'Saving...'
                : (quickCreateType === 'visit' || quickCreateType === 'followup' || quickCreateType === 'consultation' ? 'Schedule' : 'Create')}
            </button>
          </div>
        </form>
      </Modal>
    </SalesLayout>
  );
};

export default App;
