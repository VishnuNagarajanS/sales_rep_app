import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { KYCPage } from './pages/KYC/KYCPage';

// Company Admin
import { CompanyUsersPage } from './pages/Company/CompanyUsersPage';
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

import { AlertCircle, Calendar, Plus } from 'lucide-react';
import { ProtectedRoute } from './components/common/Guards';
import { Modal } from './components/common/Modal';
import { storageService } from './services/storageService';
import { jaminApiService } from './services/jaminApiService';
import { toast } from './context/ToastContext';
import { Investor, Customer, Lead, Booking, SiteVisit } from './types';
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
import './App.css';

// Allowed routes corresponding to sidebar options
const SIDEBAR_ROUTES = [
  'dashboard',
  'leads',
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
];

export const App: React.FC = () => {
  const { isAuthenticated, isSuperAdmin, tenant, user, enabledFeatures = [] } = useAuth();

  // Resolve initial route from browser URL path or sessionStorage
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const path = window.location.pathname.replace(/^\/+/, '').split('/')[0];
    if (path && SIDEBAR_ROUTES.includes(path)) {
      return path;
    }
    const hash = window.location.hash.replace(/^#\/?/, '').split('/')[0];
    if (hash && SIDEBAR_ROUTES.includes(hash)) {
      return hash;
    }
    const saved = sessionStorage.getItem('nexus_current_route');
    if (saved && SIDEBAR_ROUTES.includes(saved)) {
      return saved;
    }
    return 'dashboard';
  });

  const roleCode = user?.role?.code;
  const isJamin = Boolean(
    tenant?.slug?.toLowerCase() === 'jamin' ||
    tenant?.id === 't-jamin-02' ||
    tenant?.id === '2' ||
    user?.companySlug?.toLowerCase() === 'jamin' ||
    (user?.companyName && /jamin/i.test(user.companyName)) ||
    user?.companyId === 2 ||
    (user?.companyId as any) === '2'
  );
  const isGhlAdmin =
    !isJamin &&
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');



  // Set default route for IRM user or redirect invalid routes
  useEffect(() => {
    if (user?.role?.code === 'irm' && !isJamin && (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01')) {
      const savedRoute = sessionStorage.getItem('nexus_current_route');
      if (!savedRoute) {
        setCurrentRoute('dashboard');
        sessionStorage.setItem('nexus_current_route', 'dashboard');
      }
    } else if ((user?.role?.code === 'sales_executive' || isJamin) && currentRoute === 'kyc') {
      setCurrentRoute('dashboard');
      sessionStorage.setItem('nexus_current_route', 'dashboard');
    }
  }, [user?.role?.code, currentRoute, isJamin, tenant?.slug, tenant?.id]);

  // Handle route change and synchronize browser URL bar & history
  const navigate = (route: string) => {
    const validRoute = SIDEBAR_ROUTES.includes(route) ? route : 'dashboard';
    setCurrentRoute(validRoute);
    sessionStorage.setItem('nexus_current_route', validRoute);
    const targetUrl = validRoute === 'dashboard' ? '/' : `/${validRoute}`;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({ route: validRoute }, '', targetUrl);
    }
  };

  // Support browser Back and Forward navigation buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\/+/, '').split('/')[0] || 'dashboard';
      if (SIDEBAR_ROUTES.includes(path)) {
        setCurrentRoute(path);
        sessionStorage.setItem('nexus_current_route', path);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Keep browser address bar in sync on initial mount and route changes
  useEffect(() => {
    const currentPath = window.location.pathname.replace(/^\/+/, '').split('/')[0];
    const targetPath = currentRoute === 'dashboard' ? '' : currentRoute;
    if (currentPath !== targetPath) {
      window.history.replaceState({ route: currentRoute }, '', targetPath ? `/${targetPath}` : '/');
    }
  }, [currentRoute]);

  // Quick Create Modal State
  const [quickCreateType, setQuickCreateType] = useState<
    'lead' | 'customer' | 'booking' | 'visit' | 'followup' | 'deal' | 'consultation' | null
  >(null);

  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickLocation, setQuickLocation] = useState('');
  const [quickSource, setQuickSource] = useState('');
  const [quickAssetClass, setQuickAssetClass] = useState('');
  const [quickInvestmentCapacity, setQuickInvestmentCapacity] = useState('');
  const [quickBudgetRange, setQuickBudgetRange] = useState('');
  const [quickPreferredLocation, setQuickPreferredLocation] = useState('');
  const [quickNotes, setQuickNotes] = useState('');

  // Project & Plot selection for Quick Site Visit & Quick Booking
  const [quickProjectsList, setQuickProjectsList] = useState<any[]>([]);
  const [quickPlotsList, setQuickPlotsList] = useState<any[]>([]);
  const [quickProjectId, setQuickProjectId] = useState('');
  const [quickPlotId, setQuickPlotId] = useState('');
  const [isLoadingQuickPlots, setIsLoadingQuickPlots] = useState(false);
  const [quickTokenAmount, setQuickTokenAmount] = useState<number | ''>('');
  const [quickPaymentMode, setQuickPaymentMode] = useState('UPI');
  const [quickTimeSlot, setQuickTimeSlot] = useState('11:00 AM');
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

      const validLeads = Array.isArray(leadsRes) && leadsRes.length > 0
        ? leadsRes
        : storageService.getLeads(tenantId);
      setLiveLeads(validLeads);

      const validCusts = Array.isArray(custsRes) && custsRes.length > 0
        ? custsRes
        : storageService.getCustomers(tenantId);
      setLiveCustomers(validCusts);

      if (Array.isArray(projsRes) && projsRes.length > 0) {
        setQuickProjectsList(projsRes);
      }
    } catch (err) {
      console.warn('Failed to fetch live contacts from API:', err);
      setLiveLeads(storageService.getLeads(tenantId));
      setLiveCustomers(storageService.getCustomers(tenantId));
    } finally {
      setIsLoadingLiveContacts(false);
    }
  }, [user?.companyId, tenant?.id, isJamin]);

  useEffect(() => {
    fetchLiveContacts();
    let debounceTimer: any = null;
    const debouncedHandler = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchLiveContacts();
      }, 350);
    };
    window.addEventListener('nexus_storage_updated', debouncedHandler);
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('nexus_storage_updated', debouncedHandler);
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

  const handleOpenQuickCreate = async (
    type: 'lead' | 'customer' | 'booking' | 'visit' | 'followup' | 'deal' | 'consultation'
  ) => {
    const resolvedType = isJamin && (type === 'deal' || type === 'consultation') ? 'lead' : type;
    setQuickCreateType(resolvedType);
    setQuickError('');
    setQuickSubmitting(false);
    fetchLiveContacts();

    // Default contact source appropriately for each type:
    // For bookings: prefer existing customer if available, else existing lead
    // For site visits: prefer existing lead if available, else existing customer
    // For followups: prefer existing lead if available, else existing customer
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
      setQuickPhone('');
      setQuickEmail('');
      setQuickLocation('');
    }

    setQuickSource('');
    setQuickAssetClass('');
    setQuickInvestmentCapacity('');
    setQuickBudgetRange('');
    setQuickPreferredLocation('');
    setQuickNotes('');
    setQuickProjectId('');
    setQuickPlotId('');
    setQuickTokenAmount('');
    setQuickPaymentMode('UPI');
    setQuickTimeSlot('11:00 AM');
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
        const selProj = quickProjectsList.find(p => p.name === quickPreferredLocation || String(p.id) === String(quickProjectId));
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
              priority: 'Medium',
              budgetRange: quickBudgetRange.trim() || undefined,
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
          priority: 'Medium',
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
        try {
          const saved = await apiSaveCustomer(newCust);
          storageService.saveCustomer(saved || newCust);
        } catch (apiErr: any) {
          console.warn('Backend customer sync note:', apiErr);
          storageService.saveCustomer(newCust);
        }
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'booking') {
        if (!quickProjectId) {
          setQuickError('Please select a project for the booking.');
          setQuickSubmitting(false);
          return;
        }

        if (!quickPlotId) {
          setQuickError('Please select an available plot for the booking.');
          setQuickSubmitting(false);
          return;
        }

        const selProj = quickProjectsList.find(p => String(p.id) === String(quickProjectId));
        const selPlot = quickPlotId ? quickPlotsList.find(p => String(p.id) === String(quickPlotId)) : null;

        const tokenAmt = typeof quickTokenAmount === 'number' ? quickTokenAmount : 0;
        const totalAmount = selPlot?.price || 0;

        if (isJamin) {
          const res = await jaminApiService.createBooking({
            customerName: quickName.trim(),
            customerPhone: quickPhone.trim(),
            customerId: quickContactSource === 'customer' && selectedCustomerId ? Number(String(selectedCustomerId).replace(/\D/g, '')) : undefined,
            leadId: quickContactSource === 'lead' && selectedLeadId ? Number(String(selectedLeadId).replace(/\D/g, '')) : undefined,
            projectId: Number(quickProjectId),
            plotId: Number(quickPlotId),
            projectName: selProj?.name || '',
            plotNumber: selPlot?.plotNumber || '',
            tokenAmountPaid: tokenAmt,
            totalPlotPrice: totalAmount,
            paymentMode: quickPaymentMode,
            notes: quickNotes.trim(),
          });
          if (!res.success) {
            throw new Error(res.message || 'Failed to create booking.');
          }
        }

        storageService.saveBooking({
          id: `bkg-${Date.now()}`,
          companyId: currentCompanyId,
          dealId: `deal-${Date.now()}`,
          leadId: quickContactSource === 'lead' ? selectedLeadId : '',
          customerId: quickContactSource === 'customer' ? selectedCustomerId : '',
          customerName: quickName.trim(),
          customerPhone: quickPhone.trim(),
          propertyId: quickProjectId,
          propertyName: selProj?.name || '',
          unitNumber: selPlot?.plotNumber || '',
          bookingAmount: tokenAmt,
          totalAmount: totalAmount,
          bookingDate: new Date().toISOString().split('T')[0],
          status: 'Token Paid',
          salesExecId: currentAgentId,
          salesExecName: currentAgentName,
          notes: quickNotes.trim(),
        });
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'visit') {
        if (!quickProjectId) {
          setQuickError('Please select a project for the site visit.');
          setQuickSubmitting(false);
          return;
        }

        const selProj = quickProjectsList.find(p => String(p.id) === String(quickProjectId));
        const selPlot = quickPlotId ? quickPlotsList.find(p => String(p.id) === String(quickPlotId)) : null;

        const formattedSchedule = `${scheduledDate} • ${quickTimeSlot}`;

        if (isJamin) {
          const res = await jaminApiService.scheduleSiteVisit({
            customerName: quickName.trim(),
            customerPhone: quickPhone.trim(),
            contactType: quickContactSource === 'customer' ? 'customer' : 'lead',
            customerId: quickContactSource === 'customer' && selectedCustomerId ? Number(String(selectedCustomerId).replace(/\D/g, '')) : undefined,
            leadId: quickContactSource === 'lead' && selectedLeadId ? Number(String(selectedLeadId).replace(/\D/g, '')) : undefined,
            projectId: Number(quickProjectId),
            plotId: quickPlotId ? Number(quickPlotId) : undefined,
            projectName: selProj?.name || 'Project Tour',
            plotNumber: selPlot?.plotNumber || undefined,
            scheduledAt: formattedSchedule,
            assignedAgentId: user?.id ? Number(user.id) : undefined,
            assignedAgentName: user?.name || 'Agent',
            visitorNote: quickNotes.trim() || undefined,
          });
          if (res) {
            storageService.saveSiteVisit(res);
          }
        } else {
          storageService.saveSiteVisit({
            id: `visit-${Date.now()}`,
            companyId: currentCompanyId,
            customerId: quickContactSource === 'customer' ? selectedCustomerId : '',
            customerName: quickName.trim(),
            customerPhone: quickPhone.trim(),
            projectId: quickProjectId,
            projectName: selProj?.name || '',
            plotNumber: selPlot?.plotNumber || '',
            scheduledAt: formattedSchedule,
            assignedAgentId: currentAgentId,
            assignedAgentName: currentAgentName,
            status: 'Scheduled',
            outcomeNotes: quickNotes.trim(),
          });
        }
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'followup') {
        const combinedDateTime = scheduledDate && scheduledTime
          ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
          : new Date().toISOString();
        const newFlw: Followup = {
          id: `flw-${Date.now()}`,
          companyId: currentCompanyId,
          contactId: quickContactSource === 'customer' && selectedCustomerId ? selectedCustomerId : (quickContactSource === 'lead' && selectedLeadId ? selectedLeadId : `contact-${Date.now()}`),
          contactName: quickName.trim(),
          contactPhone: quickPhone.trim(),
          contactType: quickContactSource === 'customer' ? 'customer' : 'lead',
          scheduledAt: combinedDateTime,
          scheduledDate,
          scheduledTime,
          priority: 'Medium',
          status: 'Pending',
          notes: quickNotes.trim(),
          assignedAgentId: currentAgentId,
          assignedAgentName: currentAgentName,
        };
        try {
          await apiSaveFollowup(newFlw);
        } catch (apiErr: any) {
          console.warn('Backend followup sync note:', apiErr);
          storageService.saveFollowup(newFlw);
        }
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'consultation') {
        storageService.saveConsultation({
          id: `cons-${Date.now()}`,
          companyId: currentCompanyId,
          investorId: consInvestorId || '',
          investorName: consInvestorName.trim(),
          investorPhone: consInvestorPhone.trim(),
          scheduledAt: consSlot.trim(),
          consultantId: currentAgentId,
          consultantName: consConsultantName.trim() || currentAgentName,
          status: consStatus,
          agenda: consAgenda.trim(),
          outcomeNotes: consOutcome.trim() || undefined,
        });
        window.dispatchEvent(new Event('nexus_storage_updated'));

      } else if (quickCreateType === 'deal') {
        let resolvedCustomerId = '';
        let resolvedCustomerName = '';

        if (dealCustomerMode === 'existing' && selectedCustomerId) {
          const existing = storageService.getCustomers(tenant?.id)
            .find(c => c.id === selectedCustomerId);
          resolvedCustomerId = existing?.id || selectedCustomerId;
          resolvedCustomerName = existing?.name || '';
        } else {
          if (!newCustomerName.trim()) {
            setQuickError('Customer name is required.');
            setQuickSubmitting(false);
            return;
          }
          resolvedCustomerId = `cust-${Date.now()}`;
          resolvedCustomerName = newCustomerName.trim();
          storageService.saveCustomer({
            id: resolvedCustomerId,
            companyId: currentCompanyId,
            name: resolvedCustomerName,
            phone: quickPhone.trim(),
            email: '',
            status: 'Active',
            assignedAgentId: currentAgentId,
            assignedAgentName: currentAgentName,
            location: '',
            lastContacted: new Date().toISOString().split('T')[0],
            openDealsCount: 0,
            totalValue: 0,
            createdAt: new Date().toISOString().split('T')[0],
            notes: '',
            customFields: {},
          });
        }

        storageService.saveDeal({
          id: `deal-${Date.now()}`,
          companyId: currentCompanyId,
          title: quickName.trim(),
          customerId: resolvedCustomerId,
          customerName: resolvedCustomerName,
          stage: 'new',
          value: 0,
          expectedCloseDate: '',
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
          <CompaniesPage />
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
          <AssignedLeadsPage />
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
        <ProtectedRoute feature={FEATURES.INVESTORS} permission={PERMISSIONS.INVESTORS_VIEW}>
          <InvestorsPage />
        </ProtectedRoute>
      ) : currentRoute === 'consultations' ? (
        <ProtectedRoute feature={FEATURES.CONSULTATIONS} permission={PERMISSIONS.CONSULTATIONS_VIEW}>
          <ConsultationsPage />
        </ProtectedRoute>
      ) : currentRoute === 'opportunities' ? (
        <ProtectedRoute feature={FEATURES.INVESTMENT_OPPORTUNITIES} permission={PERMISSIONS.OPPORTUNITIES_VIEW}>
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
        <ProtectedRoute feature={FEATURES.REPORTS} permission={PERMISSIONS.REPORTS_VIEW}>
          <ReportsPage />
        </ProtectedRoute>
      ) : currentRoute === 'notifications' ? (
        <NotificationsPage onNavigate={navigate} />
      ) : currentRoute === 'company-users' ? (
        <ProtectedRoute feature={FEATURES.USERS} permission={PERMISSIONS.USERS_VIEW}>
          <CompanyUsersPage />
        </ProtectedRoute>
      ) : currentRoute === 'company-settings' ? (
        <ProtectedRoute feature={FEATURES.COMPANY_SETTINGS} permission={PERMISSIONS.SETTINGS_VIEW}>
          <CompanySettingsPage />
        </ProtectedRoute>
      ) : currentRoute === 'company-audit' ? (
        <ProtectedRoute feature={FEATURES.AUDIT_LOGS} permission={PERMISSIONS.AUDIT_VIEW}>
          <CompanyAuditPage />
        </ProtectedRoute>
      ) : (
        user?.role?.code === 'irm' && !isJamin && (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') ? (
          <InvestorsPage />
        ) : (
          <DashboardPage onNavigate={navigate} onOpenQuickCreate={handleOpenQuickCreate} />
        )
      )}

      {/* Global Quick Action Modal */}
      <Modal
        isOpen={!!quickCreateType}
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
        <div style={{
          display: 'flex',
          gap: 6,
          backgroundColor: 'var(--bg-surface-hover, #f1f5f9)',
          padding: '4px',
          borderRadius: '10px',
          marginBottom: '16px',
          overflowX: 'auto',
          flexWrap: 'nowrap'
        }}>
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
                  padding: '6px 14px',
                  borderRadius: 7,
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 500,
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  backgroundColor: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? 'var(--primary-600, #059669)' : 'var(--text-secondary, #64748b)',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
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
                <label className="form-label">Full Name *</label>
                <input
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
                    placeholder="ramesh@example.com"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Location / City</label>
                  <input
                    type="text"
                    className="form-input"
                    value={quickLocation}
                    onChange={e => setQuickLocation(e.target.value)}
                    placeholder={tenant?.slug === 'jamin' ? "e.g. Bengaluru, Devanahalli" : "e.g. Bengaluru, Indiranagar"}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Source</label>
                  <select
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

              <div className="lead-custom-schema-box">
                <div className="lead-custom-schema-title">
                  {tenant?.slug === 'jamin'
                    ? `${tenant?.name || 'Jamin Bazaar'} Property Preferences`
                    : 'Asset Terms'}
                </div>

                {tenant?.slug === 'jamin' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Plot Budget Range</label>
                      <select
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
                      <label className="form-label">Preferred Micro-Market / Project</label>
                      <select
                        className="form-select"
                        value={quickPreferredLocation}
                        onChange={e => {
                          const val = e.target.value;
                          setQuickPreferredLocation(val);
                          const matching = quickProjectsList.find(p => p.name === val || String(p.id) === val);
                          if (matching) {
                            setQuickProjectId(String(matching.id));
                            if (!quickLocation && matching.location) {
                              setQuickLocation(matching.location);
                            }
                          }
                        }}
                      >
                        <option value="">
                          {quickProjectsList.length === 0
                            ? '— Loading projects from server... —'
                            : `— Select Project (${quickProjectsList.length} available) —`}
                        </option>
                        {quickProjectsList.map(p => (
                          <option key={p.id} value={p.name}>
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
                <label className="form-label">Notes & Requirements</label>
                <textarea
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
                    placeholder="e.g. Rajesh Kumar"
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
                    <option value="09:30 AM">09:30 AM (Morning Tour)</option>
                    <option value="11:00 AM">11:00 AM (Mid-Day Walkthrough)</option>
                    <option value="02:00 PM">02:00 PM (Afternoon Tour)</option>
                    <option value="03:30 PM">03:30 PM (Late Afternoon Slot)</option>
                    <option value="05:00 PM">05:00 PM (Sunset Inspection)</option>
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
                        rows={2}
                        placeholder="Key discussion topics, yield requirements, investor questions..."
                        value={consAgenda}
                        onChange={e => setConsAgenda(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Outcome Notes & Recommendations</label>
                      <textarea
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
                    <label className="form-label">Link to Customer</label>
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
                      <div style={{ marginTop: 8 }}>
                        <label className="form-label app-new-customer-label">
                          New Customer Name *
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
                  <label className="form-label">Customer Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    placeholder="+91 98800 00000"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Deal Notes</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  placeholder="Deal background, expected terms..."
                />
              </div>
            </>
          )}

          <div className="app-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" disabled={quickSubmitting} onClick={() => setQuickCreateType(null)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={quickSubmitting}
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
              {quickSubmitting ? 'Saving...' : (quickCreateType === 'visit' || quickCreateType === 'followup' || quickCreateType === 'consultation' ? 'Schedule' : 'Create')}
            </button>
          </div>
        </form>
      </Modal>
    </SalesLayout>
  );
};

export default App;
