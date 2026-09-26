import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Check,
  Phone,
  Users,
  Calendar,
  Send,
  AlertTriangle,
  Radio,
  FileText,
  UserCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { NotificationItem, User as UserType } from '../../types';
import { storageService } from '../../services/storageService';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/common/Modal';
import './NotificationsPage.css';

interface NotificationsPageProps {
  onNavigate: (route: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate }) => {
  const { tenant, user } = useAuth();
  const roleCode = user?.role?.code;
  const isAdmin =
    (roleCode as string) === 'company_admin' ||
    (roleCode as string) === 'admin' ||
    roleCode === 'super_admin';

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'urgent' | 'sent'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetRecipient, setTargetRecipient] = useState<string>('all');
  const [priority, setPriority] = useState<'urgent' | 'important' | 'normal'>('urgent');
  const [category, setCategory] = useState<'alert' | 'lead' | 'followup' | 'call' | 'system'>('alert');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionLink, setActionLink] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Load tenant users for recipient dropdown
  const tenantUsers: UserType[] = useMemo(() => {
    return storageService.getUsers(tenant?.slug) || [];
  }, [tenant?.slug]);

  const loadData = () => {
    setNotifications(storageService.getNotifications(tenant?.id, user?.id, user?.role?.code));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id, tenant?.slug, user?.id, user?.role?.code]);

  // Check if opened via TopBar quick alert shortcut
  useEffect(() => {
    if (sessionStorage.getItem('nexus_open_alert_modal') === 'true') {
      sessionStorage.removeItem('nexus_open_alert_modal');
      if (isAdmin) {
        setIsModalOpen(true);
      }
    }
  }, [isAdmin]);

  const handleMarkAll = () => {
    storageService.markAllNotificationsRead(tenant?.id, user?.id);
  };

  // Helper to get descriptive recipient label
  const getRecipientLabel = (val: string): string => {
    if (val === 'all') return `All Users in ${tenant?.name || 'Company'}`;
    if (val === 'role:sales_executive') return 'All Sales Executives';
    if (val === 'role:irm') return 'All IRMs (Investor Relations)';
    const foundUser = tenantUsers.find(u => u.id === val);
    if (foundUser) return `${foundUser.name} (${foundUser.role.name})`;
    return val;
  };

  // Submit Alert Creation
  const handleSendAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a notification title.');
      return;
    }
    if (!message.trim()) {
      setErrorMsg('Please enter the notification message.');
      return;
    }

    const isRoleTarget = targetRecipient.startsWith('role:');
    const targetRole = isRoleTarget ? targetRecipient.replace('role:', '') : undefined;
    const targetUserId = isRoleTarget ? 'all' : targetRecipient;

    const newNotification: NotificationItem = {
      id: `notif-${Date.now()}`,
      companyId: tenant?.id || 't-ghl-01',
      companySlug: tenant?.slug || 'ghl',
      type: category,
      title: title.trim(),
      message: message.trim(),
      timestamp: 'Just now',
      read: false,
      link: actionLink.trim() || undefined,
      targetUserId,
      targetUserName: getRecipientLabel(targetRecipient),
      targetRole,
      createdById: user?.id,
      createdByName: `${user?.name} (${user?.role?.name || 'Admin'})`,
      priority,
      createdAt: new Date().toISOString(),
    };

    storageService.createNotification(newNotification);

    // Reset Form & Close
    setTitle('');
    setMessage('');
    setActionLink('');
    setTargetRecipient('all');
    setPriority('urgent');
    setCategory('alert');
    setErrorMsg('');
    setIsModalOpen(false);
  };

  // Filtered notifications based on active tab
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (activeTab === 'unread') return !n.read;
      if (activeTab === 'urgent') return n.priority === 'urgent' || n.type === 'alert' || n.type === 'broadcast';
      if (activeTab === 'sent') return n.createdById === user?.id;
      return true;
    });
  }, [notifications, activeTab, user?.id]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const urgentCount = notifications.filter(
    n => n.priority === 'urgent' || n.type === 'alert' || n.type === 'broadcast'
  ).length;
  const sentCount = notifications.filter(n => n.createdById === user?.id).length;

  return (
    <div className="notifications-page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title">
              <Bell size={24} color="var(--primary-600)" /> Notification Center
            </h1>
            <span className="notif-tenant-pill">
              {tenant?.name}
            </span>
          </div>
          <p className="page-subtitle">
            Real-time activity alerts, incoming call recordings, follow-up deadlines, and team communications.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Send size={15} /> Send Alert / Broadcast
            </button>
          )}

          <button className="btn btn-secondary" onClick={handleMarkAll}>
            <Check size={15} /> Mark All as Read
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="notifications-tabs-row">
        {[
          { id: 'all', label: `All Notifications (${notifications.length})` },
          { id: 'unread', label: `Unread (${unreadCount})` },
          { id: 'urgent', label: `Urgent & Alerts (${urgentCount})`, highlight: urgentCount > 0 },
          ...(isAdmin ? [{ id: 'sent', label: `Sent by Me (${sentCount})` }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn btn-sm ${
              activeTab === tab.id ? 'btn-primary' : 'btn-secondary'
            } ${tab.highlight && activeTab === tab.id ? 'tab-urgent-active' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            {tab.highlight && <AlertTriangle size={13} style={{ marginRight: 4 }} />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="card notifications-card-wrapper">
        {filteredNotifications.length === 0 ? (
          <div className="notifications-empty-state">
            <Bell size={40} color="var(--text-muted)" style={{ opacity: 0.5 }} />
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 12 }}>
              No notifications in this category
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              All team communications within {tenant?.name} are up to date!
            </p>
          </div>
        ) : (
          filteredNotifications.map(n => {
            const isUrgent = n.priority === 'urgent';
            const isImportant = n.priority === 'important';

            return (
              <div
                key={n.id}
                className={`notification-item-row ${!n.read ? 'unread' : ''} ${isUrgent ? 'row-urgent' : ''}`}
                onClick={() => {
                  storageService.markNotificationRead(n.id);
                  if (n.link) onNavigate(n.link.replace('/', ''));
                }}
              >
                <div className="notification-item-left">
                  <div
                    className={`notification-icon-circle ${!n.read ? 'unread' : ''} ${
                      isUrgent ? 'icon-circle-urgent' : isImportant ? 'icon-circle-important' : ''
                    }`}
                  >
                    {n.type === 'call' ? (
                      <Phone size={18} />
                    ) : n.type === 'followup' ? (
                      <Calendar size={18} />
                    ) : n.type === 'alert' || n.type === 'broadcast' ? (
                      <AlertTriangle size={18} />
                    ) : (
                      <Users size={18} />
                    )}
                  </div>

                  <div className="notification-content-block">
                    <div className="notification-title-row">
                      {isUrgent && (
                        <span className="notif-badge-pill pill-urgent">URGENT</span>
                      )}
                      {isImportant && (
                        <span className="notif-badge-pill pill-important">IMPORTANT</span>
                      )}
                      {(n.type === 'alert' || n.type === 'broadcast') && (
                        <span className="notif-badge-pill pill-broadcast">TEAM ALERT</span>
                      )}

                      <span className="notification-title">{n.title}</span>

                      {!n.read && <span className="notification-unread-dot" />}
                    </div>

                    <p className="notification-message">{n.message}</p>

                    <div className="notification-meta-tags">
                      {n.createdByName && (
                        <span className="notif-meta-item">
                          📢 <strong>Sender:</strong> {n.createdByName}
                        </span>
                      )}
                      {n.targetUserName && (
                        <span className="notif-meta-item">
                          🎯 <strong>To:</strong> {n.targetUserName}
                        </span>
                      )}
                      {n.link && (
                        <span className="notif-meta-link">
                          Open Action <ChevronRight size={11} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="notification-time">{n.timestamp}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Admin Alert Composer Modal */}
      {isAdmin && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setErrorMsg('');
          }}
          title="Send Alert / Notify Users"
          subtitle={`Broadcast announcements or direct messages within ${tenant?.name}`}
          maxWidth={620}
        >
          <form onSubmit={handleSendAlert} className="alert-composer-form">
            {errorMsg && (
              <div className="alert-form-error">
                <AlertTriangle size={14} /> {errorMsg}
              </div>
            )}

            {/* Recipient Selection */}
            <div className="form-group">
              <label className="form-label">
                <UserCheck size={14} color="var(--primary-600)" /> Target Recipient (Within {tenant?.name})
              </label>
              <select
                className="form-select alert-form-input"
                value={targetRecipient}
                onChange={e => setTargetRecipient(e.target.value)}
              >
                <optgroup label="Broad Audience">
                  <option value="all">📢 All Users in {tenant?.name} (Broadcast)</option>
                  <option value="role:sales_executive">👥 All Sales Executives in {tenant?.name}</option>
                  {tenant?.slug === 'ghl' && (
                    <option value="role:irm">💼 All IRMs (Investor Relations)</option>
                  )}
                </optgroup>
                <optgroup label="Direct Message (Individual Member)">
                  {tenantUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      👤 {u.name} — {u.role.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Priority Selector Cards */}
            <div className="form-group">
              <label className="form-label">Priority / Alert Level</label>
              <div className="alert-priority-cards-grid">
                <div
                  className={`priority-card urgent ${priority === 'urgent' ? 'selected' : ''}`}
                  onClick={() => setPriority('urgent')}
                >
                  <div className="priority-card-title">🔴 Urgent</div>
                  <div className="priority-card-desc">High visibility red badge, pinned alert</div>
                </div>

                <div
                  className={`priority-card important ${priority === 'important' ? 'selected' : ''}`}
                  onClick={() => setPriority('important')}
                >
                  <div className="priority-card-title">🟠 Important</div>
                  <div className="priority-card-desc">Milestone & deadline attention</div>
                </div>

                <div
                  className={`priority-card normal ${priority === 'normal' ? 'selected' : ''}`}
                  onClick={() => setPriority('normal')}
                >
                  <div className="priority-card-title">🔵 General Info</div>
                  <div className="priority-card-desc">Standard update or notice</div>
                </div>
              </div>
            </div>

            {/* Category / Type */}
            <div className="form-group">
              <label className="form-label">Notification Category</label>
              <select
                className="form-select alert-form-input"
                value={category}
                onChange={e => setCategory(e.target.value as any)}
              >
                <option value="alert">Broadcast Alert / Announcement</option>
                <option value="followup">Follow-up & Commitment Reminder</option>
                <option value="lead">Lead Routing & Assignment</option>
                <option value="call">Calling & Telephony Update</option>
                <option value="system">System / Compliance Notice</option>
              </select>
            </div>

            {/* Title */}
            <div className="form-group">
              <label className="form-label">
                Alert Title <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-input alert-form-input"
                placeholder="e.g. Urgent: Complete all overdue follow-ups by 5:00 PM"
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
              />
            </div>

            {/* Message Body */}
            <div className="form-group">
              <label className="form-label">
                Detailed Message <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                className="form-textarea alert-form-input"
                rows={3}
                placeholder="Write the full message or instructions for the team..."
                value={message}
                onChange={e => {
                  setMessage(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
              />
            </div>

            {/* Action Link Preset */}
            <div className="form-group">
              <label className="form-label">
                <FileText size={14} color="var(--text-muted)" /> Action Destination Link (Optional)
              </label>
              <select
                className="form-select alert-form-input"
                value={actionLink}
                onChange={e => setActionLink(e.target.value)}
              >
                <option value="">None (Message only)</option>
                <option value="/followups">Follow-ups & Reminders (/followups)</option>
                <option value="/pipeline">Pipeline Kanban Board (/pipeline)</option>
                <option value="/assigned-leads">Assigned Leads (/assigned-leads)</option>
                <option value="/call-center">Call Center & Power Dialer (/call-center)</option>
                <option value="/call-history">Call History & Recordings (/call-history)</option>
                {tenant?.slug === 'ghl' && (
                  <option value="/investors">Investors 360 (/investors)</option>
                )}
                {tenant?.slug === 'jamin' && (
                  <option value="/site-visits">Site Visits (/site-visits)</option>
                )}
              </select>
            </div>

            {/* Modal Actions */}
            <div className="alert-composer-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsModalOpen(false);
                  setErrorMsg('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary alert-submit-btn">
                <Send size={15} /> Send Notification
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
