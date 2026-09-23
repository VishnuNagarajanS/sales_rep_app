import React, { useState, useEffect } from 'react';
import { Bell, Check, Phone, Users, Calendar } from 'lucide-react';
import { NotificationItem } from '../../types';
import { notificationStore } from '../../services/secondaryStores';
import { notificationsApi } from '../../services/crmApi';
import './NotificationsPage.css';

interface NotificationsPageProps {
  onNavigate: (route: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadData = async () => {
    try {
      const apiItems = await notificationsApi.getNotifications();
      if (apiItems && apiItems.length > 0) {
        setNotifications(
          apiItems.map(item => ({
            id: String(item.id),
            title: item.title,
            message: item.message,
            type: (item.type as any) || 'system',
            timestamp: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: item.isRead,
          }))
        );
        return;
      }
    } catch {
      // fallback to local store if offline or no backend notifications yet
    }
    setNotifications(notificationStore.getNotifications());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, []);

  const handleMarkAll = async () => {
    try {
      await notificationsApi.markAllAsRead();
    } catch { }
    notificationStore.markAllNotificationsRead();
    loadData();
  };

  const handleItemClick = async (n: NotificationItem) => {
    try {
      const numId = Number(n.id);
      if (!isNaN(numId)) {
        await notificationsApi.markAsRead(numId);
      }
    } catch { }
    notificationStore.markNotificationRead(n.id);
    loadData();
    if (n.link) onNavigate(n.link.replace('/', ''));
  };

  return (
    <div className="notifications-page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Bell size={24} color="var(--primary-600)" /> Notification Center
          </h1>
          <p className="page-subtitle">
            Real-time activity alerts, incoming call recordings, follow-up deadlines, and system events.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={handleMarkAll}>
          <Check size={15} /> Mark All as Read
        </button>
      </div>

      <div className="card notifications-card-wrapper">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`notification-item-row ${!n.read ? 'unread' : ''}`}
            onClick={() => handleItemClick(n)}
          >
            <div className="notification-item-left">
              <div className={`notification-icon-circle ${!n.read ? 'unread' : ''}`}>
                {n.type === 'call' ? (
                  <Phone size={18} />
                ) : n.type === 'followup' ? (
                  <Calendar size={18} />
                ) : (
                  <Users size={18} />
                )}
              </div>

              <div>
                <div className="notification-title-row">
                  <span className="notification-title">
                    {n.title}
                  </span>
                  {!n.read && (
                    <span className="notification-unread-dot" />
                  )}
                </div>
                <p className="notification-message">
                  {n.message}
                </p>
              </div>
            </div>

            <div className="notification-time">{n.timestamp}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
