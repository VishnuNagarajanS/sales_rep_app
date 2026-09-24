import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Followup, Lead } from './types';
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
import { salesApi } from './services/salesApi';
import { PERMISSIONS } from './constants/permissions';
import { IS_MOCK_ENV } from './config/runtime';
import './App.css';

export const App: React.FC = () => {
  const { isAuthenticated, isSuperAdmin, tenant, user, setUser, setTenant } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return sessionStorage.getItem('nexus_current_route') || 'dashboard';
  });

  useEffect(() => {
    if (storageService.ensureEnvironment()) {
      setUser(null);
      setTenant(null);
    }
    if (IS_MOCK_ENV && storageService.getUsers().length === 0) {
      storageService.loadMockDataFromSeparateFolder();
    }
  }, [setTenant, setUser]);

  // Set default route for IRM user
  useEffect(() => {
    if (user?.role?.code === 'irm') {
      const savedRoute = sessionStorage.getItem('nexus_current_route');
      if (!savedRoute) {
        setCurrentRoute('dashboard');
        sessionStorage.setItem('nexus_current_route', 'dashboard');
      }
    }
  }, [user?.role?.code]);

  // Quick Create Modal State
  const [quickCreateType, setQuickCreateType] = useState<
    'lead' | 'followup' | 'deal' | 'visit' | 'consultation' | null
  >(null);

  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('+91 ');
  const [quickNotes, setQuickNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [scheduledTime, setScheduledTime] = useState('11:00');

  // Deal-specific state
  const [dealCustomerMode, setDealCustomerMode] = useState<'existing' | 'new'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');

  // Handle route change
  const navigate = (route: string) => {
    setCurrentRoute(route);
    sessionStorage.setItem('nexus_current_route', route);
  };

  const handleOpenQuickCreate = (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => {
    setQuickCreateType(type);
    setQuickName('');
    setQuickPhone('+91 ');
    setQuickNotes('');
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
    if (!quickName) return;

    if (quickCreateType === 'lead') {
      const lead: Lead = {
        id: `lead-${Date.now()}`,
        companyId: tenant?.id || 't-ghl-01',
        name: quickName,
        phone: quickPhone,
        email: '',
        location: 'Bengaluru',
        source: 'Quick Create',
        status: 'New',
        priority: 'Medium',
        assignedAgentId: user?.id || 'usr-exec',
        assignedAgentName: user?.name || 'Agent',
        createdAt: new Date().toISOString().split('T')[0],
        notes: quickNotes,
        customFields: {},
      };
      if (IS_MOCK_ENV) {
        storageService.saveLead(lead);
      } else {
        await salesApi.saveLead(lead);
      }

    } else if (quickCreateType === 'followup') {
      const combinedDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      const followup: Followup = {
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
      };
      if (IS_MOCK_ENV) {
        storageService.saveFollowup(followup);
      } else {
        await salesApi.saveFollowup(followup);
      }

    } else if (quickCreateType === 'consultation') {
      if (!IS_MOCK_ENV) {
        window.alert('Consultations are not available until the database API is implemented.');
        return;
      }
      // Task 1 — Schedule Consultation
      const combinedDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      storageService.saveConsultation({
        id: `cons-${Date.now()}`,
        companyId: tenant?.id || 't-ghl-01',
        investorId: `investor-${Date.now()}`,
        investorName: quickName,
        investorPhone: quickPhone,
        scheduledAt: combinedDateTime,
        consultantId: user?.id || 'usr-exec',
        consultantName: user?.name || 'Agent',
        status: 'Scheduled',
        agenda: quickNotes || 'Initial consultation',
      });

    } else if (quickCreateType === 'visit') {
      if (!IS_MOCK_ENV) {
        window.alert('Site visits are not available until the database API is implemented.');
        return;
      }
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
      if (!IS_MOCK_ENV) {
        window.alert('Deals are not available until the database API is implemented.');
        return;
      }
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

          {/* ── Deal Title (deals only) or Contact Name (everything else) ── */}
          <div className="form-group">
            <label className="form-label">
              {quickCreateType === 'deal' ? 'Deal Title *' : 'Contact Name *'}
            </label>
            <input
              type="text"
              className="form-input"
              required
              value={quickName}
              onChange={e => setQuickName(e.target.value)}
              placeholder={quickCreateType === 'deal' ? 'e.g. Commercial Plot Purchase' : 'e.g. Ramesh Chandra'}
            />
          </div>

          {/* ── Deal: existing vs. new customer picker (Task 4) ── */}
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

          {/* ── Phone (all types except deal-existing-customer) ── */}
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

          {/* ── Scheduled Date + Time (followup, consultation, visit) ── */}
          {(quickCreateType === 'followup' || quickCreateType === 'consultation' || quickCreateType === 'visit') && (
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

          <div className="form-group">
            <label className="form-label">
              {quickCreateType === 'consultation' ? 'Consultation Agenda' : 'Quick Notes'}
            </label>
            <textarea
              className="form-textarea"
              rows={2}
              value={quickNotes}
              onChange={e => setQuickNotes(e.target.value)}
              placeholder={
                quickCreateType === 'consultation'
                  ? 'Topics to discuss, investor interest area...'
                  : quickCreateType === 'visit'
                    ? 'Special requirements, preferred plots...'
                    : 'Brief requirement summary...'
              }
            />
          </div>

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
