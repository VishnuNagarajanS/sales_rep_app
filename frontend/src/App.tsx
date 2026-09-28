import React, { useState, useEffect } from 'react';
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

import { ProtectedRoute } from './components/common/Guards';
import { Modal } from './components/common/Modal';
import { storageService } from './services/storageService';
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
  const { isAuthenticated, isSuperAdmin, tenant, user } = useAuth();

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
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') &&
    (roleCode === 'company_admin' || (roleCode as string) === 'admin' || roleCode === 'super_admin');

  // Seed initial mock data on clean install / empty session
  useEffect(() => {
    if (storageService.getUsers().length === 0) {
      storageService.loadMockDataFromSeparateFolder();
    }
  }, []);

  // Set default route for IRM user if not on an active route
  useEffect(() => {
    if (user?.role?.code === 'irm') {
      const savedRoute = sessionStorage.getItem('nexus_current_route');
      if (!savedRoute) {
        setCurrentRoute('dashboard');
        sessionStorage.setItem('nexus_current_route', 'dashboard');
      }
    }
  }, [user?.role?.code]);

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
    'lead' | 'followup' | 'deal' | 'visit' | 'consultation' | null
  >(null);

  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('+91 ');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickLocation, setQuickLocation] = useState('');
  const [quickSource, setQuickSource] = useState('Website Inbound');
  const [quickAssetClass, setQuickAssetClass] = useState('AIF');
  const [quickInvestmentCapacity, setQuickInvestmentCapacity] = useState('');
  const [quickBudgetRange, setQuickBudgetRange] = useState('₹45L – ₹65L');
  const [quickPreferredLocation, setQuickPreferredLocation] = useState('Devanahalli North');
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

  const handleOpenQuickCreate = (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => {
    setQuickCreateType(type);
    setQuickName('');
    setQuickPhone('+91 ');
    setQuickEmail('');
    setQuickLocation('');
    setQuickSource('Website Inbound');
    setQuickAssetClass('AIF');
    setQuickInvestmentCapacity('₹1 Cr – ₹5 Cr');
    setQuickBudgetRange('₹45L – ₹65L');
    setQuickPreferredLocation('Devanahalli North');
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
        companyId: tenant?.id || (tenant?.slug === 'jamin' ? 't-jamin-02' : 't-ghl-01'),
        name: quickName,
        phone: quickPhone,
        email: quickEmail,
        location: quickLocation || (tenant?.slug === 'jamin' ? 'Bengaluru, Devanahalli' : 'Bengaluru'),
        source: quickSource,
        status: 'New',
        priority: 'Medium',
        assignedAgentId: user?.id || (tenant?.slug === 'jamin' ? 'usr-jamin-exec' : 'usr-ghl-exec'),
        assignedAgentName: user?.name || (tenant?.slug === 'jamin' ? 'Pooja Hegde' : 'Ananya Iyer'),
        createdAt: new Date().toISOString().split('T')[0],
        notes: quickNotes,
        customFields: tenant?.slug === 'jamin'
          ? {
              budgetRange: quickBudgetRange,
              preferredLocation: quickPreferredLocation,
            }
          : {
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
          <LeadsPage />
        </ProtectedRoute>
      ) : currentRoute === 'assigned-leads' ? (
        <ProtectedRoute permission={PERMISSIONS.LEADS_VIEW}>
          {isGhlAdmin ? (
            <AssignedLeadsPage />
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
        <ProtectedRoute feature={FEATURES.INVESTORS} permission={PERMISSIONS.INVESTORS_VIEW}>
          <KYCPage />
        </ProtectedRoute>
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

              {/* Tenant-Specific Custom Schema Terms */}
              <div className="lead-custom-schema-box">
                <div className="lead-custom-schema-title">
                  {tenant?.slug === 'jamin'
                    ? `${tenant?.name || 'Jamin Bazaar'} Property Preferences`
                    : 'GHL India Ventures Asset Terms'}
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
                        <option value="₹25L – ₹45L">₹25L – ₹45L</option>
                        <option value="₹45L – ₹65L">₹45L – ₹65L</option>
                        <option value="₹65L – ₹90L">₹65L – ₹90L</option>
                        <option value="₹90L+">₹90L+</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Preferred Micro-Market</label>
                      <select
                        className="form-select"
                        value={quickPreferredLocation}
                        onChange={e => setQuickPreferredLocation(e.target.value)}
                      >
                        <option value="Devanahalli North">Devanahalli North (Airport)</option>
                        <option value="Sarjapur East">Sarjapur East</option>
                        <option value="Mysore Highway Corridor">Mysore Highway Corridor</option>
                        <option value="Kanakapura Road">Kanakapura Road</option>
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

              {/* Notes & Requirements */}
              <div className="form-group">
                <label className="form-label">Notes & Requirements</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={quickNotes}
                  onChange={e => setQuickNotes(e.target.value)}
                  placeholder={tenant?.slug === 'jamin' ? "Interested plot dimensions, site visit availability, token readiness..." : "Client background, key objections, time horizon..."}
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
                        {tenantCustomers.map(c => (
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