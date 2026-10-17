import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import {
  Bell,
  Shield,
  Sliders,
  Users,
  Pin,
  Volume2,
  Trash2,
  Edit2,
  Check,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { ChatConversation, ChatMember, ChatSettings } from '../../types';
import * as cs from '../../services/chatStorage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  me: ChatMember;
  companyId: string;
  activeConversation: ChatConversation | null;
  onConversationUpdated?: () => void;
  onNavigate?: (route: string) => void;
}

type SettingsTab =
  | 'general'
  | 'notifications'
  | 'privacy'
  | 'conversation'
  | 'admin';

const DEFAULT_SETTINGS: ChatSettings = {
  general: {
    theme: 'default',
    language: 'English (United States)',
    turnOffAnimations: false,
    outOfOfficeReply: false,
    outOfOfficeMessage: 'Thank you for reaching out. I am currently out of office.',
  },
  privacy: {
    readReceipts: true,
    typingIndicator: true,
    whoCanDm: 'everyone',
  },
  notifications: {
    desktopPush: true,
    sound: true,
    mentionOnly: false,
    showPreview: true,
  },
  adminGovernance: {
    retentionDays: 0,
    whoCanCreateGroups: 'everyone',
  },
};

export const ChatSettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  me,
  companyId,
  activeConversation,
  onConversationUpdated,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(activeConversation ? 'conversation' : 'general');
  const [settings, setSettings] = useState<ChatSettings>(() => {
    const saved = cs.getChatSettings(companyId, me.id);
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      general: { ...DEFAULT_SETTINGS.general!, ...(saved?.general || {}) },
      privacy: { ...DEFAULT_SETTINGS.privacy, ...(saved?.privacy || {}) },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(saved?.notifications || {}) },
      adminGovernance: { ...DEFAULT_SETTINGS.adminGovernance!, ...(saved?.adminGovernance || {}) },
    };
  });

  const [renameValue, setRenameValue] = useState(activeConversation?.name || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setRenameValue(activeConversation?.name || '');
  }, [activeConversation]);

  const isAdmin = me.roleCode === 'company_admin' || me.roleCode === 'super_admin';
  const isManagerOrAdmin = isAdmin;

  const handleToggle = (category: keyof ChatSettings, key: string) => {
    setSettings(prev => {
      const cat = { ...((prev[category] as any) || {}) };
      cat[key] = !cat[key];
      const updated = { ...prev, [category]: cat };
      cs.saveChatSettings(companyId, me.id, updated);
      return updated;
    });
  };

  const handleSelectChange = (category: keyof ChatSettings, key: string, value: any) => {
    setSettings(prev => {
      const cat = { ...((prev[category] as any) || {}) };
      cat[key] = value;
      const updated = { ...prev, [category]: cat };
      cs.saveChatSettings(companyId, me.id, updated);
      return updated;
    });
  };

  // Per-conversation actions
  const handleTogglePin = () => {
    if (!activeConversation) return;
    cs.togglePinConversation(activeConversation.id);
    onConversationUpdated?.();
  };

  const handleToggleMute = () => {
    if (!activeConversation) return;
    cs.toggleMuteConversation(activeConversation.id);
    onConversationUpdated?.();
  };

  const handleRenameGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !renameValue.trim() || activeConversation.type !== 'group') return;
    cs.renameConversation(activeConversation.id, renameValue.trim());
    onConversationUpdated?.();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleClearHistory = () => {
    if (!activeConversation) return;
    if (confirm('Are you sure you want to clear chat history for this conversation?')) {
      cs.clearConversationMessages(activeConversation.id);
      onConversationUpdated?.();
      alert('Conversation history cleared.');
    }
  };

  const handleLeaveGroup = () => {
    if (!activeConversation || activeConversation.type !== 'group') return;
    if (confirm('Are you sure you want to leave this group chat?')) {
      cs.leaveConversation(activeConversation.id, me.id);
      onConversationUpdated?.();
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chat Settings"
      subtitle="Configure notifications, privacy, appearance, and conversation preferences."
      maxWidth={720}
    >
      <div className="chat-settings-layout">
        {/* Navigation Sidebar */}
        <div className="chat-settings-nav">
          {activeConversation && (
            <button
              type="button"
              className={`chat-settings-nav-item ${activeTab === 'conversation' ? 'active' : ''}`}
              onClick={() => setActiveTab('conversation')}
            >
              <MessageSquare size={16} />
              <span>Current Chat</span>
            </button>
          )}

          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={16} />
            <span>Notifications</span>
          </button>

          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            <Shield size={16} />
            <span>Privacy & Presence</span>
          </button>

          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Sliders size={16} />
            <span>Appearance & Display</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className={`chat-settings-nav-item ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              <Users size={16} />
              <span>Admin Governance</span>
            </button>
          )}
        </div>

        {/* Tab Panels */}
        <div className="chat-settings-panel">
          {/* 1. CURRENT CONVERSATION */}
          {activeTab === 'conversation' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Current Conversation Settings</h4>
              {!activeConversation ? (
                <p className="settings-section-sub">Select an active conversation to configure specific settings.</p>
              ) : (
                <>
                  <div className="settings-info-card" style={{ marginBottom: 16 }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>{activeConversation.name}</strong>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                        Type: {activeConversation.type === 'group' ? 'Group Channel' : 'Direct Message'} • {activeConversation.memberIds?.length || 2} participants
                      </p>
                    </div>
                  </div>

                  {activeConversation.type === 'group' && isManagerOrAdmin && (
                    <form onSubmit={handleRenameGroup} className="settings-form-row" style={{ marginBottom: 16 }}>
                      <label htmlFor="settings-conversation-rename" className="settings-label">Rename Group Chat</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          id="settings-conversation-rename"
                          name="renameGroupChat"
                          type="text"
                          className="form-input"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          placeholder="Group name"
                        />
                        <button type="submit" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {saveSuccess ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Edit2 size={14} />} Save
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="settings-actions-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      type="button"
                      className={`btn btn-secondary btn-sm ${activeConversation.isPinned ? 'active' : ''}`}
                      onClick={handleTogglePin}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Pin size={14} />
                      <span>{activeConversation.isPinned ? 'Unpin Conversation' : 'Pin to Top'}</span>
                    </button>

                    <button
                      type="button"
                      className={`btn btn-secondary btn-sm ${activeConversation.isMuted ? 'active' : ''}`}
                      onClick={handleToggleMute}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Volume2 size={14} />
                      <span>{activeConversation.isMuted ? 'Unmute Notifications' : 'Mute Conversation'}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={handleClearHistory}
                    >
                      <Trash2 size={14} />
                      <span>Clear Chat History</span>
                    </button>

                    {activeConversation.type === 'group' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger-500)', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={handleLeaveGroup}
                      >
                        <Trash2 size={14} />
                        <span>Leave Group</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 2. NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Notification Alerts & Sound</h4>

              <div className="settings-toggle-row">
                <div>
                  <label htmlFor="settings-notifications-sound" className="settings-toggle-label">Play Sound for Messages</label>
                  <div className="settings-toggle-desc">Play an audible chime whenever new messages arrive.</div>
                </div>
                <input
                  id="settings-notifications-sound"
                  name="sound"
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.notifications.sound}
                  onChange={() => handleToggle('notifications', 'sound')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <label htmlFor="settings-notifications-desktopPush" className="settings-toggle-label">Desktop Push Notifications</label>
                  <div className="settings-toggle-desc">Show browser popup notifications when you are in another tab or application.</div>
                </div>
                <input
                  id="settings-notifications-desktopPush"
                  name="desktopPush"
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.notifications.desktopPush}
                  onChange={() => handleToggle('notifications', 'desktopPush')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <label htmlFor="settings-notifications-showPreview" className="settings-toggle-label">Show Message Preview</label>
                  <div className="settings-toggle-desc">Include message text snippets in popup notification alerts.</div>
                </div>
                <input
                  id="settings-notifications-showPreview"
                  name="showPreview"
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.notifications.showPreview ?? true}
                  onChange={() => handleToggle('notifications', 'showPreview')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <label htmlFor="settings-notifications-mentionOnly" className="settings-toggle-label">@Mentions Only Mode</label>
                  <div className="settings-toggle-desc">Only alert me when someone explicitly tags @me or direct messages me.</div>
                </div>
                <input
                  id="settings-notifications-mentionOnly"
                  name="mentionOnly"
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.notifications.mentionOnly}
                  onChange={() => handleToggle('notifications', 'mentionOnly')}
                />
              </div>
            </div>
          )}

          {/* 3. PRIVACY & PRESENCE */}
          {activeTab === 'privacy' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Privacy & Presence</h4>

              <div className="settings-toggle-row">
                <div>
                  <label htmlFor="settings-privacy-readReceipts" className="settings-toggle-label">Read Receipts</label>
                  <div className="settings-toggle-desc">Let colleagues know when you have seen their messages.</div>
                </div>
                <input
                  id="settings-privacy-readReceipts"
                  name="readReceipts"
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.privacy.readReceipts}
                  onChange={() => handleToggle('privacy', 'readReceipts')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <label htmlFor="settings-privacy-typingIndicator" className="settings-toggle-label">Typing Indicator</label>
                  <div className="settings-toggle-desc">Display animated "typing…" indicators while you compose messages.</div>
                </div>
                <input
                  id="settings-privacy-typingIndicator"
                  name="typingIndicator"
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.privacy.typingIndicator}
                  onChange={() => handleToggle('privacy', 'typingIndicator')}
                />
              </div>

              <div className="settings-select-group" style={{ marginTop: 16 }}>
                <label htmlFor="settings-privacy-whoCanDm" className="settings-label">Who Can Direct Message (DM) Me</label>
                <select
                  id="settings-privacy-whoCanDm"
                  name="whoCanDm"
                  className="form-input"
                  value={settings.privacy.whoCanDm}
                  onChange={e => handleSelectChange('privacy', 'whoCanDm', e.target.value)}
                >
                  <option value="everyone">Everyone in my organization</option>
                  <option value="team">My sales department only</option>
                  <option value="managers_admins">Managers & Administrators only</option>
                </select>
              </div>
            </div>
          )}

          {/* 4. GENERAL & APPEARANCE */}
          {activeTab === 'general' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Theme</h4>
              <div className="teams-theme-grid">
                <div
                  className={`teams-theme-card ${settings.general?.theme === 'default' ? 'active' : ''}`}
                  onClick={() => handleSelectChange('general', 'theme', 'default')}
                >
                  <div className="teams-theme-preview theme-preview-default">
                    <div className="preview-bar" />
                    <div className="preview-content">
                      <div className="preview-line" style={{ width: '80%' }} />
                      <div className="preview-line" style={{ width: '50%' }} />
                    </div>
                  </div>
                  <div className="teams-theme-name">Default (Light)</div>
                </div>

                <div
                  className={`teams-theme-card ${settings.general?.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => handleSelectChange('general', 'theme', 'dark')}
                >
                  <div className="teams-theme-preview theme-preview-dark">
                    <div className="preview-bar" />
                    <div className="preview-content">
                      <div className="preview-line" style={{ width: '80%', color: '#fff' }} />
                      <div className="preview-line" style={{ width: '50%', color: '#fff' }} />
                    </div>
                  </div>
                  <div className="teams-theme-name">Dark</div>
                </div>

                <div
                  className={`teams-theme-card ${settings.general?.theme === 'high_contrast' ? 'active' : ''}`}
                  onClick={() => handleSelectChange('general', 'theme', 'high_contrast')}
                >
                  <div className="teams-theme-preview theme-preview-hc">
                    <div className="preview-bar" />
                    <div className="preview-content">
                      <div className="preview-line" style={{ width: '80%', color: '#ffff00' }} />
                      <div className="preview-line" style={{ width: '50%', color: '#00ffff' }} />
                    </div>
                  </div>
                  <div className="teams-theme-name">High contrast</div>
                </div>
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Language & Display</h4>
              <div className="settings-select-group">
                <label htmlFor="settings-general-language" className="settings-label">App Language</label>
                <select
                  id="settings-general-language"
                  name="language"
                  className="form-input"
                  value={settings.general?.language || 'English (United States)'}
                  onChange={e => handleSelectChange('general', 'language', e.target.value)}
                >
                  <option value="English (United States)">English (United States)</option>
                  <option value="English (India)">English (India)</option>
                  <option value="Hindi (हिंदी)">Hindi (हिंदी)</option>
                  <option value="Tamil (தமிழ்)">Tamil (தமிழ்)</option>
                  <option value="Spanish (Español)">Spanish (Español)</option>
                  <option value="French (Français)">French (Français)</option>
                </select>
              </div>

              <div className="settings-toggle-row" style={{ marginTop: 12 }}>
                <div>
                  <label htmlFor="settings-general-turnOffAnimations" className="settings-toggle-label">Reduce Motion / Turn off animations</label>
                  <div className="settings-toggle-desc">Disables transitions to maximize interface responsiveness.</div>
                </div>
                <input
                  id="settings-general-turnOffAnimations"
                  name="turnOffAnimations"
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.general?.turnOffAnimations ?? false}
                  onChange={() => handleToggle('general', 'turnOffAnimations')}
                />
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Out of Office / Away Status</h4>
              <div className="settings-toggle-row">
                <div>
                  <label htmlFor="settings-general-outOfOfficeReply" className="settings-toggle-label">Automatic Away Replies</label>
                  <div className="settings-toggle-desc">Send automated responses to colleagues when you are away on leave or site visits.</div>
                </div>
                <input
                  id="settings-general-outOfOfficeReply"
                  name="outOfOfficeReply"
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.general?.outOfOfficeReply ?? false}
                  onChange={() => handleToggle('general', 'outOfOfficeReply')}
                />
              </div>

              {settings.general?.outOfOfficeReply && (
                <div style={{ marginTop: 10 }}>
                  <label htmlFor="settings-general-outOfOfficeMessage" className="settings-label">Away Message</label>
                  <textarea
                    id="settings-general-outOfOfficeMessage"
                    name="outOfOfficeMessage"
                    className="form-textarea"
                    rows={2}
                    value={settings.general?.outOfOfficeMessage || ''}
                    onChange={e => handleSelectChange('general', 'outOfOfficeMessage', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* 5. ADMIN GOVERNANCE */}
          {activeTab === 'admin' && isAdmin && (
            <div className="settings-section">
              <h4 className="settings-section-title">Admin Governance & Organization Policies</h4>

              <div className="settings-info-card">
                <div>
                  <strong>Company Users & Department Directory</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    Manage user roles, departmental assignments, and permissions directly in the company user management portal.
                  </p>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { onClose(); onNavigate('company-users'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>Manage Directory</span>
                    <ExternalLink size={13} />
                  </button>
                )}
              </div>

              <div className="settings-select-group" style={{ marginTop: 16 }}>
                <label htmlFor="settings-admin-retentionDays" className="settings-label">Message Retention Policy</label>
                <select
                  id="settings-admin-retentionDays"
                  name="retentionDays"
                  className="form-input"
                  value={settings.adminGovernance?.retentionDays ?? 0}
                  onChange={e => handleSelectChange('adminGovernance', 'retentionDays', Number(e.target.value))}
                >
                  <option value={0}>Retain Forever (No automated expiration)</option>
                  <option value={30}>Auto-delete after 30 Days</option>
                  <option value={90}>Auto-delete after 90 Days</option>
                  <option value={365}>Auto-delete after 1 Year</option>
                </select>
              </div>

              <div className="settings-select-group">
                <label htmlFor="settings-admin-whoCanCreateGroups" className="settings-label">Group Channel Creation Permissions</label>
                <select
                  id="settings-admin-whoCanCreateGroups"
                  name="whoCanCreateGroups"
                  className="form-input"
                  value={settings.adminGovernance?.whoCanCreateGroups ?? 'everyone'}
                  onChange={e => handleSelectChange('adminGovernance', 'whoCanCreateGroups', e.target.value)}
                >
                  <option value="everyone">All Employees & Agents</option>
                  <option value="managers_admins">Managers and Company Admins Only</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="chat-settings-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
};
