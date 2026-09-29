import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import {
  Bell,
  Shield,
  PhoneCall,
  Sliders,
  Users,
  Pin,
  Volume2,
  Trash2,
  Edit2,
  Check,
  ExternalLink,
  User,
  FileText,
  Folder,
  Headphones,
  Lock,
  Eye,
  Camera,
  Mic,
  VolumeX,
  Play,
  Plus,
  X,
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
  | 'accounts'
  | 'privacy'
  | 'notifications'
  | 'captions'
  | 'files'
  | 'devices'
  | 'permissions'
  | 'accessibility'
  | 'calls'
  | 'conversation'
  | 'admin';

const DEFAULT_SETTINGS: ChatSettings = {
  general: {
    theme: 'default',
    autoStartApp: true,
    openInBackground: false,
    onCloseKeepRunning: true,
    gpuHardwareAcceleration: true,
    registerAsDefaultChatApp: true,
    language: 'English (United States)',
    keyboardLanguage: 'English (United States)',
    turnOffAnimations: false,
    outOfOfficeReply: false,
    outOfOfficeMessage: 'Thank you for reaching out. I am currently out of office.',
  },
  accounts: {
    activeTenant: 'ghl',
  },
  privacy: {
    readReceipts: true,
    typingIndicator: true,
    whoCanDm: 'everyone',
    priorityAccess: ['Ananya Iyer', 'Karthik Rao'],
    blockedContacts: [],
    participateInSurveys: true,
  },
  notifications: {
    desktopPush: true,
    sound: true,
    mentionOnly: false,
    notificationStyle: 'teams',
    showPreview: true,
    missedActivityEmails: 'hourly',
    chatsAndChannels: 'banner_feed',
    meetingsAndCalls: 'banner',
  },
  captions: {
    autoIdentifyMe: true,
    spokenLanguage: 'English (United States)',
    autoStartTranscription: false,
  },
  files: {
    fileOpenPreference: 'teams',
    downloadLocation: 'C:\\Users\\NexusSales\\Downloads',
    alwaysAskWhereToSave: false,
  },
  calls: {
    defaultMic: 'default',
    defaultCamera: 'default',
    defaultSpeaker: 'default',
    noiseSuppression: 'auto',
    secondaryRinger: 'none',
    cameraOffOnJoin: false,
    autoAnswer: false,
    callAnsweringRules: 'ring_me',
    forwardTo: 'voicemail',
    ringDurationBeforeRedirect: 20,
    ringtone: 'Bop',
  },
  appPermissions: {
    media: true,
    location: true,
    notifications: true,
    externalLinks: true,
    midiDevices: false,
  },
  accessibility: {
    signLanguageView: false,
    alwaysShowMeetingControls: true,
    highContrast: false,
  },
  adminGovernance: {
    retentionDays: 0,
    fileRetentionDays: 0,
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
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<ChatSettings>(() => {
    const saved = cs.getChatSettings(companyId, me.id);
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      general: { ...DEFAULT_SETTINGS.general!, ...(saved?.general || {}) },
      accounts: { ...DEFAULT_SETTINGS.accounts!, ...(saved?.accounts || {}) },
      privacy: { ...DEFAULT_SETTINGS.privacy, ...(saved?.privacy || {}) },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(saved?.notifications || {}) },
      captions: { ...DEFAULT_SETTINGS.captions!, ...(saved?.captions || {}) },
      files: { ...DEFAULT_SETTINGS.files!, ...(saved?.files || {}) },
      calls: { ...DEFAULT_SETTINGS.calls, ...(saved?.calls || {}) },
      appPermissions: { ...DEFAULT_SETTINGS.appPermissions!, ...(saved?.appPermissions || {}) },
      accessibility: { ...DEFAULT_SETTINGS.accessibility!, ...(saved?.accessibility || {}) },
      adminGovernance: { ...DEFAULT_SETTINGS.adminGovernance!, ...(saved?.adminGovernance || {}) },
    };
  });

  const [renameValue, setRenameValue] = useState(activeConversation?.name || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [isCameraPreviewOn, setIsCameraPreviewOn] = useState(true);
  const [newPriorityContact, setNewPriorityContact] = useState('');
  const [newBlockedContact, setNewBlockedContact] = useState('');

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

  // Sound test using Web Audio API oscillator
  const handleTestAudio = () => {
    setIsTestingAudio(true);
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (err) {
      console.warn('Audio test error:', err);
    }
    setTimeout(() => setIsTestingAudio(false), 1400);
  };

  const handleAddPriorityContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriorityContact.trim()) return;
    const current = settings.privacy.priorityAccess || [];
    if (!current.includes(newPriorityContact.trim())) {
      handleSelectChange('privacy', 'priorityAccess', [...current, newPriorityContact.trim()]);
    }
    setNewPriorityContact('');
  };

  const handleRemovePriorityContact = (name: string) => {
    const current = settings.privacy.priorityAccess || [];
    handleSelectChange('privacy', 'priorityAccess', current.filter(c => c !== name));
  };

  const handleAddBlockedContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockedContact.trim()) return;
    const current = settings.privacy.blockedContacts || [];
    if (!current.includes(newBlockedContact.trim())) {
      handleSelectChange('privacy', 'blockedContacts', [...current, newBlockedContact.trim()]);
    }
    setNewBlockedContact('');
  };

  const handleRemoveBlockedContact = (name: string) => {
    const current = settings.privacy.blockedContacts || [];
    handleSelectChange('privacy', 'blockedContacts', current.filter(c => c !== name));
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
      title="Settings"
      subtitle="Configure preferences, audio & video devices, privacy, notifications, and application behavior."
      maxWidth={850}
    >
      <div className="chat-settings-layout">
        {/* Microsoft Teams Style Navigation Sidebar */}
        <div className="chat-settings-nav">
          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Sliders size={16} />
            <span>General</span>
          </button>

          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <User size={16} />
            <span>Accounts & orgs</span>
          </button>

          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            <Shield size={16} />
            <span>Privacy</span>
          </button>

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
            className={`chat-settings-nav-item ${activeTab === 'captions' ? 'active' : ''}`}
            onClick={() => setActiveTab('captions')}
          >
            <FileText size={16} />
            <span>Captions & transcripts</span>
          </button>

          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <Folder size={16} />
            <span>Files and links</span>
          </button>

          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'devices' ? 'active' : ''}`}
            onClick={() => setActiveTab('devices')}
          >
            <Headphones size={16} />
            <span>Devices</span>
          </button>

          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('permissions')}
          >
            <Lock size={16} />
            <span>App permissions</span>
          </button>

          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'accessibility' ? 'active' : ''}`}
            onClick={() => setActiveTab('accessibility')}
          >
            <Eye size={16} />
            <span>Accessibility</span>
          </button>

          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'calls' ? 'active' : ''}`}
            onClick={() => setActiveTab('calls')}
          >
            <PhoneCall size={16} />
            <span>Calls</span>
          </button>

          <button
            type="button"
            className={`chat-settings-nav-item ${activeTab === 'conversation' ? 'active' : ''}`}
            onClick={() => setActiveTab('conversation')}
          >
            <MessageSquare size={16} />
            <span>Active Conversation</span>
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
          {/* 1. GENERAL */}
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

              <h4 className="settings-section-title" style={{ marginTop: 20 }}>Application</h4>
              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Auto-start application</div>
                  <div className="settings-toggle-desc">Launch chat automatically upon logging into Windows.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.general?.autoStartApp ?? true}
                  onChange={() => handleToggle('general', 'autoStartApp')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Open application in background</div>
                  <div className="settings-toggle-desc">Start minimized to the system tray without taking focus.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.general?.openInBackground ?? false}
                  onChange={() => handleToggle('general', 'openInBackground')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">On close, keep the application running</div>
                  <div className="settings-toggle-desc">Closing the window will minimize to the notification tray.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.general?.onCloseKeepRunning ?? true}
                  onChange={() => handleToggle('general', 'onCloseKeepRunning')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Turn on GPU hardware acceleration</div>
                  <div className="settings-toggle-desc">Improves rendering speed and reduces CPU consumption.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.general?.gpuHardwareAcceleration ?? true}
                  onChange={() => handleToggle('general', 'gpuHardwareAcceleration')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Register as chat app for Microsoft 365</div>
                  <div className="settings-toggle-desc">Integrates presence and status with Office desktop tools.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.general?.registerAsDefaultChatApp ?? true}
                  onChange={() => handleToggle('general', 'registerAsDefaultChatApp')}
                />
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Language & Display</h4>
              <div className="settings-select-group">
                <label className="settings-label">App Language</label>
                <select
                  className="form-input"
                  value={settings.general?.language || 'English (United States)'}
                  onChange={e => handleSelectChange('general', 'language', e.target.value)}
                >
                  <option value="English (United States)">English (United States)</option>
                  <option value="English (India)">English (India)</option>
                  <option value="English (United Kingdom)">English (United Kingdom)</option>
                  <option value="Hindi (हिंदी)">Hindi (हिंदी)</option>
                  <option value="Spanish (Español)">Spanish (Español)</option>
                  <option value="French (Français)">French (Français)</option>
                  <option value="German (Deutsch)">German (Deutsch)</option>
                </select>
              </div>

              <div className="settings-toggle-row" style={{ marginTop: 12 }}>
                <div>
                  <div className="settings-toggle-label">Turn off animations</div>
                  <div className="settings-toggle-desc">Disables transitions to maximize interface responsiveness.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.general?.turnOffAnimations ?? false}
                  onChange={() => handleToggle('general', 'turnOffAnimations')}
                />
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Out of Office</h4>
              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Automatic replies</div>
                  <div className="settings-toggle-desc">Send automated responses to teammates when you are away.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.general?.outOfOfficeReply ?? false}
                  onChange={() => handleToggle('general', 'outOfOfficeReply')}
                />
              </div>

              {settings.general?.outOfOfficeReply && (
                <div style={{ marginTop: 10 }}>
                  <label className="settings-label">Out of Office Message</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={settings.general?.outOfOfficeMessage || ''}
                    onChange={e => handleSelectChange('general', 'outOfOfficeMessage', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* 2. ACCOUNTS & ORGS */}
          {activeTab === 'accounts' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Accounts & Organizations</h4>
              <p className="settings-section-sub">
                Manage your authenticated identity and active organization tenancy.
              </p>

              <div className="settings-info-card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'var(--gradient-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {me.name ? me.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'ME'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)' }}>{me.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{me.email || 'sales.agent@nexus.io'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--primary-500)', fontWeight: 600, marginTop: 2 }}>
                      Role: {me.roleCode.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 12,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontWeight: 600,
                  }}
                >
                  Active Session
                </span>
              </div>

              <div className="settings-select-group">
                <label className="settings-label">Active Workspace Tenancy</label>
                <select
                  className="form-input"
                  value={settings.accounts?.activeTenant || companyId}
                  onChange={e => handleSelectChange('accounts', 'activeTenant', e.target.value)}
                >
                  <option value="t-ghl-01">GHL India Ventures (AIF & High-Yield Private Placement)</option>
                  <option value="t-jamin-02">Jamin Bazaar (Direct Land Plot Booking & Estates)</option>
                </select>
              </div>
            </div>
          )}

          {/* 3. PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Privacy</h4>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Read Receipts</div>
                  <div className="settings-toggle-desc">Let people know when you've seen their messages and see when they've seen yours.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.privacy.readReceipts}
                  onChange={() => handleToggle('privacy', 'readReceipts')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Typing Indicator</div>
                  <div className="settings-toggle-desc">Display animated "typing…" indicators while you compose messages.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.privacy.typingIndicator}
                  onChange={() => handleToggle('privacy', 'typingIndicator')}
                />
              </div>

              <div className="settings-select-group">
                <label className="settings-label">Who Can Direct Message (DM) Me</label>
                <select
                  className="form-input"
                  value={settings.privacy.whoCanDm}
                  onChange={e => handleSelectChange('privacy', 'whoCanDm', e.target.value)}
                >
                  <option value="everyone">Everyone in my organization</option>
                  <option value="team">My sales department only</option>
                  <option value="managers_admins">Managers & Administrators only</option>
                </select>
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Do Not Disturb — Priority Access</h4>
              <p className="settings-section-sub">
                Allow calls and urgent messages from these contacts even when your status is set to Do Not Disturb.
              </p>
              <form onSubmit={handleAddPriorityContact} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter colleague name..."
                  value={newPriorityContact}
                  onChange={e => setNewPriorityContact(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={14} /> Add
                </button>
              </form>
              <div className="teams-chips-list">
                {(settings.privacy.priorityAccess || []).map(contact => (
                  <span key={contact} className="teams-chip">
                    <span>{contact}</span>
                    <span className="teams-chip-remove" onClick={() => handleRemovePriorityContact(contact)}>
                      <X size={12} />
                    </span>
                  </span>
                ))}
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Blocked Contacts</h4>
              <p className="settings-section-sub">
                Blocked contacts cannot direct message you or view your active presence.
              </p>
              <form onSubmit={handleAddBlockedContact} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter name or phone to block..."
                  value={newBlockedContact}
                  onChange={e => setNewBlockedContact(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={14} /> Block
                </button>
              </form>
              <div className="teams-chips-list">
                {(settings.privacy.blockedContacts || []).length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No blocked contacts.</span>
                ) : (
                  (settings.privacy.blockedContacts || []).map(contact => (
                    <span key={contact} className="teams-chip">
                      <span>{contact}</span>
                      <span className="teams-chip-remove" onClick={() => handleRemoveBlockedContact(contact)}>
                        <X size={12} />
                      </span>
                    </span>
                  ))
                )}
              </div>

              <div className="settings-toggle-row" style={{ marginTop: 18 }}>
                <div>
                  <div className="settings-toggle-label">Surveys & Telemetry Feedback</div>
                  <div className="settings-toggle-desc">Participate in Microsoft Teams platform satisfaction feedback.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.privacy.participateInSurveys ?? true}
                  onChange={() => handleToggle('privacy', 'participateInSurveys')}
                />
              </div>
            </div>
          )}

          {/* 4. NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Appearance and Sound</h4>

              <div className="settings-select-group">
                <label className="settings-label">Notification Style</label>
                <select
                  className="form-input"
                  value={settings.notifications.notificationStyle || 'teams'}
                  onChange={e => handleSelectChange('notifications', 'notificationStyle', e.target.value)}
                >
                  <option value="teams">Teams built-in banner</option>
                  <option value="windows">Windows native notification center</option>
                </select>
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Play Sound for Incoming Calls & Alerts</div>
                  <div className="settings-toggle-desc">Play audible chime whenever messages or meetings ring.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.notifications.sound}
                  onChange={() => handleToggle('notifications', 'sound')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Show Message Preview</div>
                  <div className="settings-toggle-desc">Include message snippets in popup desktop notifications.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.notifications.showPreview ?? true}
                  onChange={() => handleToggle('notifications', 'showPreview')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Desktop & Push Notifications</div>
                  <div className="settings-toggle-desc">Deliver instant popup alerts across devices.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.notifications.desktopPush}
                  onChange={() => handleToggle('notifications', 'desktopPush')}
                />
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Chats and Channels</h4>
              <div className="settings-select-group">
                <label className="settings-label">Chat Messages & @Mentions</label>
                <select
                  className="form-input"
                  value={settings.notifications.chatsAndChannels || 'banner_feed'}
                  onChange={e => handleSelectChange('notifications', 'chatsAndChannels', e.target.value)}
                >
                  <option value="banner_feed">Banner and feed</option>
                  <option value="feed_only">Only show in feed</option>
                  <option value="off">Off</option>
                </select>
              </div>

              <div className="settings-toggle-row" style={{ marginTop: 12 }}>
                <div>
                  <div className="settings-toggle-label">@Mentions Only Mode</div>
                  <div className="settings-toggle-desc">Only alert me when someone explicitly tags @me or calls me directly.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.notifications.mentionOnly}
                  onChange={() => handleToggle('notifications', 'mentionOnly')}
                />
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Meetings and Calls</h4>
              <div className="settings-select-group">
                <label className="settings-label">Meeting Start Notification</label>
                <select
                  className="form-input"
                  value={settings.notifications.meetingsAndCalls || 'banner'}
                  onChange={e => handleSelectChange('notifications', 'meetingsAndCalls', e.target.value)}
                >
                  <option value="banner">Banner alert</option>
                  <option value="off">Muted / Off</option>
                </select>
              </div>

              <div className="settings-select-group">
                <label className="settings-label">Missed Activity Emails</label>
                <select
                  className="form-input"
                  value={settings.notifications.missedActivityEmails || 'hourly'}
                  onChange={e => handleSelectChange('notifications', 'missedActivityEmails', e.target.value)}
                >
                  <option value="asap">As soon as possible</option>
                  <option value="hourly">Once every hour</option>
                  <option value="daily">Daily digest</option>
                  <option value="off">Off</option>
                </select>
              </div>
            </div>
          )}

          {/* 5. CAPTIONS & TRANSCRIPTS */}
          {activeTab === 'captions' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Captions and Transcripts</h4>
              <p className="settings-section-sub">
                Control speech-to-text transcription and live subtitle options in meetings.
              </p>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Automatically identify me in meeting captions</div>
                  <div className="settings-toggle-desc">Attach your speaker name tag to spoken transcript segments.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.captions?.autoIdentifyMe ?? true}
                  onChange={() => handleToggle('captions', 'autoIdentifyMe')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Automatically start transcription for meetings</div>
                  <div className="settings-toggle-desc">Begin recording real-time meeting notes as soon as you join.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.captions?.autoStartTranscription ?? false}
                  onChange={() => handleToggle('captions', 'autoStartTranscription')}
                />
              </div>

              <div className="settings-select-group">
                <label className="settings-label">Spoken Language for Live Captions</label>
                <select
                  className="form-input"
                  value={settings.captions?.spokenLanguage || 'English (United States)'}
                  onChange={e => handleSelectChange('captions', 'spokenLanguage', e.target.value)}
                >
                  <option value="English (United States)">English (United States)</option>
                  <option value="English (India)">English (India)</option>
                  <option value="Hindi (हिंदी)">Hindi (हिंदी)</option>
                  <option value="Spanish (Español)">Spanish (Español)</option>
                  <option value="French (Français)">French (Français)</option>
                </select>
              </div>
            </div>
          )}

          {/* 6. FILES AND LINKS */}
          {activeTab === 'files' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Files and Links</h4>
              <p className="settings-section-sub">
                Choose how shared office documents and attachments are opened and stored.
              </p>

              <div className="settings-select-group">
                <label className="settings-label">File Open Preference</label>
                <select
                  className="form-input"
                  value={settings.files?.fileOpenPreference || 'teams'}
                  onChange={e => handleSelectChange('files', 'fileOpenPreference', e.target.value)}
                >
                  <option value="teams">Teams (Open inside the built-in document viewer)</option>
                  <option value="desktop">Desktop app (Open in Microsoft Office)</option>
                  <option value="browser">Browser (Open in Microsoft 365 for Web)</option>
                </select>
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Downloads</h4>
              <div className="settings-select-group">
                <label className="settings-label">Always Download Files To</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.files?.downloadLocation || 'C:\\Users\\NexusSales\\Downloads'}
                    readOnly
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => alert('Default download location set to standard Downloads folder.')}
                  >
                    Change
                  </button>
                </div>
              </div>

              <div className="settings-toggle-row" style={{ marginTop: 12 }}>
                <div>
                  <div className="settings-toggle-label">Always ask where to save each file before downloading</div>
                  <div className="settings-toggle-desc">Prompts for directory path every time a file attachment is downloaded.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.files?.alwaysAskWhereToSave ?? false}
                  onChange={() => handleToggle('files', 'alwaysAskWhereToSave')}
                />
              </div>
            </div>
          )}

          {/* 7. DEVICES */}
          {activeTab === 'devices' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Audio Devices</h4>

              <div className="settings-select-group">
                <label className="settings-label">Speaker (Audio Output)</label>
                <select
                  className="form-input"
                  value={settings.calls.defaultSpeaker || 'default'}
                  onChange={e => handleSelectChange('calls', 'defaultSpeaker', e.target.value)}
                >
                  <option value="default">Speakers (Realtek(R) Audio)</option>
                  <option value="headset">Headphones / Communications Headset</option>
                  <option value="hdmi">Digital Output (HDMI Audio Device)</option>
                </select>
              </div>

              <div className="teams-device-test-row">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleTestAudio}
                  disabled={isTestingAudio}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Volume2 size={14} />
                  <span>{isTestingAudio ? 'Playing Test Chime...' : 'Make a test call'}</span>
                </button>
                {isTestingAudio && (
                  <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                    Output active • Tone OK
                  </span>
                )}
              </div>

              <div className="settings-select-group" style={{ marginTop: 18 }}>
                <label className="settings-label">Microphone (Audio Input)</label>
                <select
                  className="form-input"
                  value={settings.calls.defaultMic}
                  onChange={e => handleSelectChange('calls', 'defaultMic', e.target.value)}
                >
                  <option value="default">Microphone Array (Intel(R) Smart Sound Technology)</option>
                  <option value="headset">Communications Headset Microphone</option>
                  <option value="external">External USB Audio Interface</option>
                </select>
              </div>

              <div className="teams-mic-meter-container">
                <Mic size={14} style={{ color: 'var(--text-muted)' }} />
                <div className="teams-mic-meter-bar">
                  <div className="teams-mic-meter-fill" />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mic Active</span>
              </div>

              <div className="settings-select-group">
                <label className="settings-label">Noise Suppression</label>
                <select
                  className="form-input"
                  value={settings.calls.noiseSuppression || 'auto'}
                  onChange={e => handleSelectChange('calls', 'noiseSuppression', e.target.value)}
                >
                  <option value="auto">Auto (Default - suppresses background noise)</option>
                  <option value="high">High (Suppresses all background sounds except voice)</option>
                  <option value="low">Low (Suppresses faint persistent noise like fans)</option>
                  <option value="off">Off (Raw uncompressed audio)</option>
                </select>
              </div>

              <div className="settings-select-group">
                <label className="settings-label">Secondary Ringer</label>
                <select
                  className="form-input"
                  value={settings.calls.secondaryRinger || 'none'}
                  onChange={e => handleSelectChange('calls', 'secondaryRinger', e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="speakers">Speakers (Realtek Audio)</option>
                  <option value="headset">Headphones</option>
                </select>
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Camera (Video)</h4>
              <div className="settings-select-group">
                <label className="settings-label">Camera</label>
                <select
                  className="form-input"
                  value={settings.calls.defaultCamera}
                  onChange={e => handleSelectChange('calls', 'defaultCamera', e.target.value)}
                >
                  <option value="default">Integrated Camera (04f2:b6d9)</option>
                  <option value="hd">HD USB WebCam (1080p 60fps)</option>
                </select>
              </div>

              <div className="teams-camera-preview-box">
                {isCameraPreviewOn ? (
                  <div className="teams-camera-active-simulation">
                    <div className="teams-camera-badge">
                      <span className="teams-camera-badge-dot" /> Live Preview
                    </div>
                    <Camera size={32} style={{ color: 'var(--primary-400)', opacity: 0.8 }} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>Integrated Camera Online</span>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <Camera size={28} />
                    <span style={{ fontSize: 12 }}>Camera preview is off</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsCameraPreviewOn(!isCameraPreviewOn)}
                >
                  {isCameraPreviewOn ? 'Turn Off Preview' : 'Turn On Preview'}
                </button>
              </div>

              <div className="settings-toggle-row" style={{ marginTop: 14 }}>
                <div>
                  <div className="settings-toggle-label">Turn Camera Off When Joining Meetings</div>
                  <div className="settings-toggle-desc">Join conference rooms with video muted by default.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.calls.cameraOffOnJoin}
                  onChange={() => handleToggle('calls', 'cameraOffOnJoin')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Automatically Adjust Camera Controls</div>
                  <div className="settings-toggle-desc">Enables automatic lighting compensation and soft focus.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={true}
                  onChange={() => { }}
                />
              </div>
            </div>
          )}

          {/* 8. APP PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="settings-section">
              <h4 className="settings-section-title">App Permissions</h4>
              <p className="settings-section-sub">
                Manage device hardware and system access permissions granted to the Teams chat client.
              </p>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Media (Camera, Microphone, Speakers)</div>
                  <div className="settings-toggle-desc">Permits participation in audio calls and WebRTC video conferences.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.appPermissions?.media ?? true}
                  onChange={() => handleToggle('appPermissions', 'media')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Location Services</div>
                  <div className="settings-toggle-desc">Allows showing local timezone and proximity-based meeting rooms.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.appPermissions?.location ?? true}
                  onChange={() => handleToggle('appPermissions', 'location')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Desktop Notifications</div>
                  <div className="settings-toggle-desc">Allows displaying native desktop popup banners for incoming calls.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.appPermissions?.notifications ?? true}
                  onChange={() => handleToggle('appPermissions', 'notifications')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">External Links</div>
                  <div className="settings-toggle-desc">Permits opening safe external URLs shared by colleagues in default browser.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.appPermissions?.externalLinks ?? true}
                  onChange={() => handleToggle('appPermissions', 'externalLinks')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">MIDI Devices</div>
                  <div className="settings-toggle-desc">Allows interacting with hardware control boards and audio decks.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.appPermissions?.midiDevices ?? false}
                  onChange={() => handleToggle('appPermissions', 'midiDevices')}
                />
              </div>
            </div>
          )}

          {/* 9. ACCESSIBILITY */}
          {activeTab === 'accessibility' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Accessibility</h4>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Sign Language View</div>
                  <div className="settings-toggle-desc">Automatically prioritize and enlarge video feeds of designated signers.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.accessibility?.signLanguageView ?? false}
                  onChange={() => handleToggle('accessibility', 'signLanguageView')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">Always Show Meeting Controls</div>
                  <div className="settings-toggle-desc">Keep toolbar visible at the top during calls rather than auto-hiding.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.accessibility?.alwaysShowMeetingControls ?? true}
                  onChange={() => handleToggle('accessibility', 'alwaysShowMeetingControls')}
                />
              </div>

              <div className="settings-toggle-row">
                <div>
                  <div className="settings-toggle-label">High Contrast Mode</div>
                  <div className="settings-toggle-desc">Maximizes color contrast across elements for improved visual clarity.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.accessibility?.highContrast ?? false}
                  onChange={() => handleToggle('accessibility', 'highContrast')}
                />
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Keyboard Shortcuts</h4>
              <table className="teams-shortcuts-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Shortcut</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Search & Commands</td>
                    <td><kbd className="teams-kbd">Ctrl</kbd> + <kbd className="teams-kbd">E</kbd></td>
                  </tr>
                  <tr>
                    <td>Toggle Mute (Microphone)</td>
                    <td><kbd className="teams-kbd">Ctrl</kbd> + <kbd className="teams-kbd">Shift</kbd> + <kbd className="teams-kbd">M</kbd></td>
                  </tr>
                  <tr>
                    <td>Toggle Video (Camera)</td>
                    <td><kbd className="teams-kbd">Ctrl</kbd> + <kbd className="teams-kbd">Shift</kbd> + <kbd className="teams-kbd">O</kbd></td>
                  </tr>
                  <tr>
                    <td>Decline Incoming Call</td>
                    <td><kbd className="teams-kbd">Ctrl</kbd> + <kbd className="teams-kbd">Shift</kbd> + <kbd className="teams-kbd">D</kbd></td>
                  </tr>
                  <tr>
                    <td>Open Chat Tab</td>
                    <td><kbd className="teams-kbd">Alt</kbd> + <kbd className="teams-kbd">Shift</kbd> + <kbd className="teams-kbd">C</kbd></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 10. CALLS */}
          {activeTab === 'calls' && (
            <div className="settings-section">
              <h4 className="settings-section-title">Call Answering Rules</h4>

              <div className="settings-select-group">
                <label className="settings-label">Incoming Calls Policy</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="callAnsweringRules"
                      checked={(settings.calls.callAnsweringRules || 'ring_me') === 'ring_me'}
                      onChange={() => handleSelectChange('calls', 'callAnsweringRules', 'ring_me')}
                    />
                    <span>Calls ring me</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="callAnsweringRules"
                      checked={settings.calls.callAnsweringRules === 'forward'}
                      onChange={() => handleSelectChange('calls', 'callAnsweringRules', 'forward')}
                    />
                    <span>Forward my calls</span>
                  </label>
                </div>
              </div>

              {settings.calls.callAnsweringRules === 'forward' ? (
                <div className="settings-select-group">
                  <label className="settings-label">Forward To</label>
                  <select
                    className="form-input"
                    value={settings.calls.forwardTo || 'voicemail'}
                    onChange={e => handleSelectChange('calls', 'forwardTo', e.target.value)}
                  >
                    <option value="voicemail">Voicemail</option>
                    <option value="delegates">Authorized Delegates</option>
                  </select>
                </div>
              ) : (
                <div className="settings-select-group">
                  <label className="settings-label">If Unanswered</label>
                  <select
                    className="form-input"
                    value={settings.calls.forwardTo || 'voicemail'}
                    onChange={e => handleSelectChange('calls', 'forwardTo', e.target.value)}
                  >
                    <option value="voicemail">Redirect to voicemail</option>
                    <option value="none">Do nothing (keep ringing)</option>
                  </select>
                </div>
              )}

              <div className="settings-select-group">
                <label className="settings-label">Ring Duration Before Redirecting</label>
                <select
                  className="form-input"
                  value={settings.calls.ringDurationBeforeRedirect || 20}
                  onChange={e => handleSelectChange('calls', 'ringDurationBeforeRedirect', Number(e.target.value))}
                >
                  <option value={10}>10 seconds</option>
                  <option value={20}>20 seconds (Default)</option>
                  <option value={30}>30 seconds</option>
                  <option value={45}>45 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </div>

              <div className="settings-toggle-row" style={{ marginTop: 14 }}>
                <div>
                  <div className="settings-toggle-label">Auto-Answer Incoming Calls</div>
                  <div className="settings-toggle-desc">Automatically accept direct calls from authorized teammates.</div>
                </div>
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={settings.calls.autoAnswer}
                  onChange={() => handleToggle('calls', 'autoAnswer')}
                />
              </div>

              <h4 className="settings-section-title" style={{ marginTop: 24 }}>Ringtones</h4>
              <div className="settings-select-group">
                <label className="settings-label">Calls For You</label>
                <select
                  className="form-input"
                  value={settings.calls.ringtone || 'Bop'}
                  onChange={e => handleSelectChange('calls', 'ringtone', e.target.value)}
                >
                  <option value="Bop">Bop (Teams Default)</option>
                  <option value="Remix">Remix</option>
                  <option value="Rings">Classic Rings</option>
                  <option value="Cascades">Cascades</option>
                  <option value="Synth">Synthesizer</option>
                </select>
              </div>
            </div>
          )}

          {/* 11. ACTIVE CONVERSATION */}
          {activeTab === 'conversation' && (
            <div className="settings-section">
              <h4 className="settings-section-title">
                Conversation: {activeConversation ? (activeConversation.name || (activeConversation.type === 'dm' ? 'Direct Message' : 'Group Chat')) : 'None Selected'}
              </h4>

              {!activeConversation ? (
                <p className="settings-section-sub">Select an active conversation from the sidebar to configure its settings.</p>
              ) : (
                <>
                  {activeConversation.type === 'group' && isManagerOrAdmin && (
                    <form onSubmit={handleRenameGroup} className="settings-form-row">
                      <label className="settings-label">Rename Group Chat</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
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

                  <div className="settings-actions-grid">
                    <button
                      type="button"
                      className={`btn btn-secondary btn-sm ${activeConversation.isPinned ? 'active' : ''}`}
                      onClick={handleTogglePin}
                    >
                      <Pin size={14} />
                      <span>{activeConversation.isPinned ? 'Unpin Conversation' : 'Pin to Top'}</span>
                    </button>

                    <button
                      type="button"
                      className={`btn btn-secondary btn-sm ${activeConversation.isMuted ? 'active' : ''}`}
                      onClick={handleToggleMute}
                    >
                      <Volume2 size={14} />
                      <span>{activeConversation.isMuted ? 'Unmute Notifications' : 'Mute Conversation'}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--warning)' }}
                      onClick={handleClearHistory}
                    >
                      <Trash2 size={14} />
                      <span>Clear Chat History</span>
                    </button>

                    {activeConversation.type === 'group' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger-500)' }}
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

          {/* 12. ADMIN GOVERNANCE */}
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
                <label className="settings-label">Message Retention Policy</label>
                <select
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
                <label className="settings-label">File Share Retention Policy</label>
                <select
                  className="form-input"
                  value={settings.adminGovernance?.fileRetentionDays ?? 0}
                  onChange={e => handleSelectChange('adminGovernance', 'fileRetentionDays', Number(e.target.value))}
                >
                  <option value={0}>Retain Uploads Forever</option>
                  <option value={60}>Purge file data after 60 Days</option>
                  <option value={180}>Purge file data after 180 Days</option>
                </select>
              </div>

              <div className="settings-select-group">
                <label className="settings-label">Group Chat Creation Permissions</label>
                <select
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
