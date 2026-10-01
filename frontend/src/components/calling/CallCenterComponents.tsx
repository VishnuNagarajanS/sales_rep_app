
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
export type PopupPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const getPopupPosition = (): PopupPosition => {
  const pos = (localStorage.getItem('nexus_popup_pos') || localStorage.getItem('nexus_popup_position')) as PopupPosition;
  if (['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(pos)) {
    return pos;
  }
  return 'top-right';
};

interface CallPreferences {
  soundEnabled: boolean;
  desktopNotifEnabled: boolean;
  autoBusyEnabled: boolean;
  defaultFollowupTime: string;
}

const DEFAULT_CALL_PREFS: CallPreferences = {
  soundEnabled: true,
  desktopNotifEnabled: false,
  autoBusyEnabled: true,
  defaultFollowupTime: '10:00',
};

const getCallPreferences = (): CallPreferences => {
  try {
    const raw = localStorage.getItem('nexus_call_prefs') || localStorage.getItem('nexus_call_preferences');
    return raw ? { ...DEFAULT_CALL_PREFS, ...JSON.parse(raw) } : DEFAULT_CALL_PREFS;
  } catch {
    return DEFAULT_CALL_PREFS;
  }
};


import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  FileText,
  Clock,
  User,
  Users,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Mail,
  Volume2,
  Minimize2,
  Maximize2,
  Video,
  Headphones,
  MessageCircle,
  MessageSquare,
  Inbox,
  ExternalLink,
  Library,
} from 'lucide-react';
import { useCall, AgentAvailability } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { CallDisposition, Lead, Consultation, CallRecord } from '../../types';
import { logCall, saveConsultation, sendCustomerMessage, getMessagingChannels, MessagingChannelStatus } from '../../services/ghlApiService';
import { Modal } from '../common/Modal';
import { Drawer } from '../common/Drawer';
import { DocumentUploader } from '../common/DocumentUploader';
import { DocumentList } from '../common/DocumentList';
import { EmptyState } from '../common/EmptyState';
import { storageService } from '../../services/storageService';
import './CallCenterComponents.css';

// --- Agent Availability Toggle ---
export const AgentAvailabilityToggle: React.FC = () => {
  const { availability, setAvailability, simulateIncomingCall } = useCall();
  const [isOpen, setIsOpen] = useState(false);

  const getStatusColor = (status: AgentAvailability) => {
    switch (status) {
      case 'Available':
        return '#10b981';
      case 'Busy':
        return '#f59e0b';
      case 'Offline':
        return '#64748b';
    }
  };

  return (
    <div className="agent-availability-container">
      <button
        className="btn btn-secondary btn-sm agent-availability-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span
          className="agent-availability-status-dot"
          style={{
            backgroundColor: getStatusColor(availability),
            boxShadow: `0 0 6px ${getStatusColor(availability)}`,
          }}
        />
        <span className="agent-availability-label">{availability}</span>
      </button>

      {/* Demo helper: button to simulate incoming call */}
      <button
        className="btn btn-ghost btn-sm agent-availability-simulate-btn"
        title="Simulate Inbound Call for Testing"
        onClick={() => simulateIncomingCall()}
      >
        <PhoneCall size={13} /> Simulate Ring
      </button>

      {isOpen && (
        <>
          <div
            className="agent-availability-backdrop"
            onClick={() => setIsOpen(false)}
          />
          <div className="card animate-slide-down agent-availability-dropdown">
            {(['Available', 'Busy', 'Offline'] as AgentAvailability[]).map(status => (
              <button
                key={status}
                className="btn btn-ghost btn-sm agent-availability-item-btn"
                style={{
                  fontWeight: availability === status ? 700 : 400,
                  color:
                    availability === status ? getStatusColor(status) : 'var(--text-primary)',
                }}
                onClick={() => {
                  setAvailability(status);
                  setIsOpen(false);
                }}
              >
                <span
                  className="agent-availability-item-dot"
                  style={{
                    backgroundColor: getStatusColor(status),
                  }}
                />
                {status}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// --- Global Incoming Call Popup ---
export const IncomingCallPopup: React.FC = () => {
  const { activeCall, acceptCall, rejectCall } = useCall();
  const [popupPosition, setPopupPosition] = useState<PopupPosition>(() => getPopupPosition());

  useEffect(() => {
    const handleUpdate = () => {
      setPopupPosition(getPopupPosition());
    };
    window.addEventListener('nexus_storage_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('nexus_storage_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  if (!activeCall || activeCall.status !== 'ringing') return null;

  const getPositionStyles = (): React.CSSProperties => {
    switch (popupPosition) {
      case 'top-left':
        return { top: 24, left: 24 };
      case 'bottom-right':
        return { bottom: 24, right: 24 };
      case 'bottom-left':
        return { bottom: 24, left: 24 };
      case 'top-right':
      default:
        return { top: 24, right: 24 };
    }
  };

  return (
    <div
      className="incoming-call-popup-wrapper"
      style={getPositionStyles()}
    >
      <div className="card animate-slide-down incoming-call-card">
        <div className="incoming-call-header">
          <div className="incoming-call-icon-pulse">
            <Volume2 size={24} />
          </div>
          <div>
            <div className="incoming-call-title">
              Incoming Call
            </div>
            <div className="incoming-call-caller-name">
              {activeCall.contactName}
            </div>
            <div className="incoming-call-caller-phone">
              {activeCall.contactPhone}
            </div>
          </div>
        </div>

        {activeCall.matchedRecord && (
          <div className="incoming-call-matched-badge">
            <User size={14} color="var(--primary-600)" />
            <span>{activeCall.matchedRecord.meta || 'Matched Contact Record'}</span>
          </div>
        )}

        <div className="incoming-call-actions">
          <button
            className="btn btn-danger"
            onClick={rejectCall}
          >
            <PhoneOff size={16} /> Decline
          </button>
          <button
            className="btn btn-primary incoming-call-btn-accept"
            onClick={acceptCall}
          >
            <Phone size={16} /> Accept Call
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Global In-Call Panel (Expanded + Minimized modes) ---
export const InCallBar: React.FC = () => {
  const {
    activeCall,
    endCall,
    toggleMute,
    toggleHold,
    toggleExpanded,
    toggleVideoMode,
    setQuickNotes,
    setMeetingLink,
  } = useCall();
  const { tenant, user } = useAuth();

  const [docsOpen, setDocsOpen] = useState(false);
  const [docsTab, setDocsTab] = useState<'customer' | 'company'>('customer');
  const [meetLaunched, setMeetLaunched] = useState(false);
  const [meetInput, setMeetInput] = useState('');
  const [irmMenuOpen, setIrmMenuOpen] = useState(false);
  const [irmButtonRect, setIrmButtonRect] = useState<DOMRect | null>(null);
  const [irmSearchQuery, setIrmSearchQuery] = useState('');
  const [connectingIrm, setConnectingIrm] = useState<string | null>(null);
  const [pendingIrm, setPendingIrm] = useState<{ name: string; status: string; isPrevious?: boolean } | null>(null);
  const [consultationReason, setConsultationReason] = useState('');

  const irmPortalRef = useRef<HTMLDivElement>(null);
  const irmButtonRef = useRef<HTMLButtonElement>(null);

  const isIrm = user?.role?.code === 'irm';

  // Look up the full lead record to find who previously handled this contact
  const matchedLead = activeCall?.matchedRecord?.type === 'lead'
    ? storageService.getLeads(tenant?.id).find((l: Lead) => l.id === activeCall.matchedRecord?.id)
    : (activeCall?.contactPhone ? storageService.findLeadByPhone(activeCall.contactPhone, tenant?.id) : undefined);
  const previousAgentName = matchedLead?.assignedAgentName;

  const connectOptions = isIrm
    ? (() => {
        const base = storageService.getAgents(tenant?.id).map((a: { id: string | number; name: string }) => ({ name: a.name, status: 'Available' as const }));
        if (!previousAgentName) return base;
        // Move the previously-assigned agent to the top of the list as the default
        const rest = base.filter((a: { name: string }) => a.name !== previousAgentName);
        return [{ name: previousAgentName, status: 'Available' as const, isPrevious: true }, ...rest];
      })()
    : storageService.getIrms(tenant?.id);

  const filteredConnectOptions = connectOptions.filter((o: any) =>
    o.name.toLowerCase().includes(irmSearchQuery.toLowerCase())
  );

  const handleConnectIrm = (irm: { name: string; status: string } | null, reason: string) => {
    if (!activeCall || !irm || !tenant || !user) return;

    const callId = `call-${Date.now()}`;
    const callRecord: CallRecord = {
      id: callId,
      companyId: tenant.id,
      contactName: activeCall.contactName,
      contactPhone: activeCall.contactPhone,
      direction: activeCall.direction,
      duration: activeCall.duration,
      agentId: user.id,
      agentName: user.name,
      disposition: 'Converted',
      timestamp: new Date().toISOString(),
      notes: isIrm
        ? `Connected to Agent: ${irm.name}. Reason: ${reason}`
        : `Connected to IRM: ${irm.name}. Reason: ${reason}`,
      leadId: activeCall.matchedRecord?.id,
    };

    if (tenant.slug === 'ghl' || tenant.id === 't-ghl-01') {
      logCall(callRecord).catch(console.error);
    } else {
      try {
        const calls = JSON.parse(localStorage.getItem('nexus_calls') || '[]');
        calls.unshift(callRecord);
        localStorage.setItem('nexus_calls', JSON.stringify(calls));
        window.dispatchEvent(new Event('nexus_storage_updated'));
      } catch { }
    }

    const consult: Consultation = {
      id: `cns-${Date.now()}`,
      companyId: user?.companyId || tenant.id,
      investorId: activeCall.matchedRecord?.id || '',
      investorName: activeCall.contactName,
      investorPhone: activeCall.contactPhone,
      scheduledAt: new Date().toISOString(),
      consultantId: irm.name,
      consultantName: irm.name,
      status: 'Scheduled',
      agenda: isIrm ? `Connected to Agent: ${reason}` : reason,
    };

    if (tenant.slug === 'ghl' || tenant.id === 't-ghl-01') {
      saveConsultation(consult).catch(console.error);
    }
    storageService.saveConsultation(consult);

    endCall(true);

    setConnectingIrm(irm.name);
    setPendingIrm(null);
    setConsultationReason('');
    setTimeout(() => setConnectingIrm(null), 3000);
  };

  useEffect(() => {
    if (!irmMenuOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (irmButtonRef.current && irmButtonRef.current.contains(target)) return;
      if (irmPortalRef.current && irmPortalRef.current.contains(target)) return;
      setIrmMenuOpen(false);
      setIrmSearchQuery('');
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [irmMenuOpen]);

  // Camera preview state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Draggable position state — null means "use default corner from popup position setting"
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragStart = useRef<{ mx: number; my: number; ex: number; ey: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Compute initial pixel position from the configured popup corner
  const getCornerStyles = (): React.CSSProperties => {
    const pos = getPopupPosition();
    switch (pos) {
      case 'top-left': return { top: 24, left: 24, bottom: 'auto', right: 'auto' };
      case 'bottom-left': return { bottom: 24, left: 24, top: 'auto', right: 'auto' };
      case 'bottom-right': return { bottom: 24, right: 24, top: 'auto', left: 'auto' };
      case 'top-right':
      default: return { top: 24, right: 24, bottom: 'auto', left: 'auto' };
    }
  };

  const getWrapperStyle = (): React.CSSProperties => {
    if (dragPos) {
      return { top: dragPos.y, left: dragPos.x, right: 'auto', bottom: 'auto' };
    }
    return getCornerStyles();
  };

  // Reset drag position whenever a new call starts (status changes to connected)
  const prevCallId = useRef<string | null>(null);
  useEffect(() => {
    if (activeCall?.status === 'connected' && activeCall.id !== prevCallId.current) {
      prevCallId.current = activeCall.id;
      setDragPos(null);
    }
  }, [activeCall?.id, activeCall?.status]);

  // Drag handlers
  const handleDragMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIrmMenuOpen(false);
    setIrmSearchQuery('');
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    isDragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, ex: rect.left, ey: rect.top };

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !dragStart.current) return;
      const dx = ev.clientX - dragStart.current.mx;
      const dy = ev.clientY - dragStart.current.my;
      setDragPos({ x: dragStart.current.ex + dx, y: dragStart.current.ey + dy });
    };

    const onMouseUp = () => {
      isDragging.current = false;
      dragStart.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Start / stop camera based on isVideoMode
  useEffect(() => {
    if (activeCall?.isVideoMode) {
      setCameraError(null);
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          if (err.name === 'NotAllowedError') {
            setCameraError('Camera permission denied. Allow camera access in your browser settings.');
          } else {
            setCameraError('Camera is unavailable on this device.');
          }
        });
    } else {
      // Stop any running stream when toggling back to Audio or call ends
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setCameraError(null);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [activeCall?.isVideoMode]);

  // Close camera + reset meet state when call ends
  useEffect(() => {
    if (!activeCall) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setDocsOpen(false);
      setDocsTab('customer');
      setMeetLaunched(false);
      setMeetInput('');
      setIrmMenuOpen(false);
      setIrmSearchQuery('');
      setPendingIrm(null);
      setConsultationReason('');
    }
  }, [activeCall]);

  if (!activeCall || activeCall.status !== 'connected') return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initials avatar
  const initials = activeCall.contactName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // WhatsApp deep-link
  const waNumber = activeCall.contactPhone.replace(/\D/g, '');
  const handleWhatsApp = () => {
    window.open(`https://wa.me/${waNumber}`, '_blank', 'noopener,noreferrer');
  };

  const hasMatchedRecord =
    activeCall.matchedRecord &&
    activeCall.matchedRecord.type !== 'unknown' &&
    activeCall.matchedRecord.id;

  // ── MINIMIZED MODE ──────────────────────────────────────────────────────────
  if (!activeCall.isExpanded) {
    return (
      <div
        ref={panelRef}
        className="incall-minimized-wrapper"
        style={getWrapperStyle()}
      >
        <div
          className="incall-minimized-card"
          style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
          onMouseDown={handleDragMouseDown}
        >
          {/* Pulse dot */}
          <div className="incall-minimized-dot" />

          {/* Name + timer */}
          <div className="incall-minimized-info">
            <div className="incall-minimized-name">{activeCall.contactName}</div>
            <div className="incall-minimized-timer">
              {formatDuration(activeCall.duration)}
            </div>
          </div>

          {/* Expand */}
          <button
            className="btn btn-icon btn-sm incall-minimized-btn-expand"
            title="Expand panel"
            onClick={toggleExpanded}
            onMouseDown={e => e.stopPropagation()}
          >
            <Maximize2 size={14} />
          </button>

          {/* End Call — always accessible even when minimised */}
          <button
            className="btn btn-danger btn-icon btn-sm incall-minimized-btn-end"
            title="End Call"
            onClick={() => endCall()}
            onMouseDown={e => e.stopPropagation()}
          >
            <PhoneOff size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ── EXPANDED MODE ───────────────────────────────────────────────────────────
  return (
    <>
      <div
        ref={panelRef}
        className="incall-expanded-wrapper"
        style={getWrapperStyle()}
      >
        <div className="animate-slide-down incall-expanded-card">
          {/* ── Header row (drag handle) ── */}
          <div
            className="incall-header incall-drag-handle"
            onMouseDown={handleDragMouseDown}
            style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
            title="Drag to move"
          >
            {/* Avatar */}
            <div className="incall-avatar">
              {initials}
            </div>

            {/* Name / phone / timer */}
            <div className="incall-caller-info">
              <div className="incall-caller-name">
                {activeCall.contactName}
              </div>
              <div className="incall-caller-sub">
                {activeCall.contactPhone}
                <span>•</span>
                {/* Pulse dot + live timer */}
                <span className="incall-live-dot" />
                <span className="incall-live-timer">
                  {formatDuration(activeCall.duration)}
                </span>
              </div>
            </div>

            {/* Minimize button */}
            <button
              className="btn btn-icon btn-sm incall-btn-minimize"
              title="Minimize panel"
              onClick={toggleExpanded}
              onMouseDown={e => e.stopPropagation()}
            >
              <Minimize2 size={14} />
            </button>
          </div>

          {/* ── Audio / Video segmented toggle ── */}
          <div className="incall-mode-toggle-bar">
            <div className="incall-toggle-group">
              <button
                onClick={() => activeCall.isVideoMode && toggleVideoMode()}
                className={`incall-toggle-btn ${!activeCall.isVideoMode ? 'incall-toggle-btn-audio-active' : 'incall-toggle-btn-inactive'}`}
              >
                <Headphones size={13} /> Audio
              </button>
              <button
                onClick={() => !activeCall.isVideoMode && toggleVideoMode()}
                className={`incall-toggle-btn ${activeCall.isVideoMode ? 'incall-toggle-btn-video-active' : 'incall-toggle-btn-inactive'}`}
              >
                <Video size={13} /> Video
              </button>
            </div>

            {/* Simulated-call disclaimer */}
            <span className="incall-simulated-tag">
              Simulated call — no live audio
            </span>
          </div>

          {/* ── Camera preview (Video mode only) ── */}
          {activeCall.isVideoMode && (
            <div className="incall-video-container">
              {cameraError ? (
                <div className="incall-video-error">
                  <AlertCircle size={14} />
                  {cameraError}
                </div>
              ) : (
                <div className="incall-video-preview-wrapper">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="incall-video-element"
                  />
                  <div className="incall-video-caption">
                    Your camera preview — the customer isn't receiving live video yet
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── IRM / Agent connect toast ── */}
          {connectingIrm && (
            <div style={{ fontSize: 12, color: '#38bdf8', padding: '4px 8px' }}>
              {isIrm
                ? `Call ended. Connected to ${connectingIrm} — reconnected with Agent.`
                : `Call ended. Connected to ${connectingIrm} — moved to Consultations.`}
            </div>
          )}

          {/* ── Quick notes ── */}
          <div className="incall-notes-container">
            <input
              type="text"
              className="form-input incall-notes-input"
              placeholder="Quick call note..."
              value={activeCall.quickNotes}
              onChange={e => setQuickNotes(e.target.value)}
            />
          </div>

          {/* ── Action row: Documents + WhatsApp + divider + call controls ── */}
          <div className="incall-action-row">
            {/* Documents */}
            <button
              className="btn btn-sm incall-btn-action incall-btn-docs"
              onClick={() => setDocsOpen(true)}
            >
              <FileText size={13} /> Documents
            </button>

            {/* WhatsApp (contact number only — no meet link) */}
            <button
              className="btn btn-sm incall-btn-action incall-btn-whatsapp"
              title="Open WhatsApp chat with this number"
              onClick={handleWhatsApp}
            >
              <MessageCircle size={13} /> WhatsApp
            </button>

            {/* Google Meet */}
            <button
              className="btn btn-sm incall-btn-action incall-btn-meet"
              title="Start a Google Meet room"
              onClick={() => {
                window.open('https://meet.google.com/new', '_blank', 'noopener,noreferrer');
                setMeetLaunched(true);
              }}
            >
              <ExternalLink size={13} /> Meet
            </button>

            {/* Connect IRM / Connect Agent */}
            <button
              ref={irmButtonRef}
              className="btn btn-sm incall-btn-action incall-btn-irm"
              title={isIrm ? 'Connect to an Agent' : 'Connect to an IRM'}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setIrmButtonRect(rect);
                setIrmMenuOpen(prev => !prev);
                setIrmSearchQuery('');
              }}
            >
              <Users size={13} /> {isIrm ? 'Connect Agent' : 'Connect IRM'}
            </button>

            {irmMenuOpen && irmButtonRect && ReactDOM.createPortal(
              <div
                ref={irmPortalRef}
                style={{
                  position: 'fixed',
                  top: irmButtonRect.bottom + 6,
                  left: irmButtonRect.left,
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: 6,
                  minWidth: 200,
                  zIndex: 9999,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  autoFocus
                  placeholder={isIrm ? 'Search agent by name...' : 'Search IRM by name...'}
                  value={irmSearchQuery}
                  onChange={e => setIrmSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    marginBottom: 6,
                    fontSize: 13,
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    color: '#e2e8f0',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />

                {filteredConnectOptions.length === 0 && (
                  <div style={{ padding: '8px', fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                    {isIrm ? 'No agent found' : 'No IRM found'}
                  </div>
                )}

                {filteredConnectOptions.map((o: any) => (
                  <div
                    key={o.name}
                    onClick={() => {
                      setPendingIrm(o);
                      setIrmMenuOpen(false);
                      setIrmSearchQuery('');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#e2e8f0',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: o.status === 'Available' ? '#22c55e' : '#d97706',
                      }}
                    />
                    {o.name}
                    {isIrm && (o as any).isPrevious && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          color: 'var(--primary-600, #38bdf8)',
                          background: 'rgba(56, 189, 248, 0.12)',
                          padding: '1px 5px',
                          borderRadius: 4,
                          fontWeight: 500,
                        }}
                      >
                        Previously handled
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{o.status}</span>
                  </div>
                ))}
              </div>,
              document.body
            )}

            {/* ── Reason for Consultation Modal ── */}
            {pendingIrm && ReactDOM.createPortal(
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10000,
                  backdropFilter: 'blur(2px)',
                }}
                onClick={() => {
                  setPendingIrm(null);
                  setConsultationReason('');
                }}
              >
                <div
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 10,
                    padding: '18px 20px',
                    width: '90%',
                    maxWidth: 380,
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                    color: '#e2e8f0',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc', marginBottom: 12 }}>
                    Connect {pendingIrm.name} to this call
                  </div>
                  <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                    {isIrm ? 'Reason for Connecting Agent *' : 'Reason for Consultation *'}
                  </label>
                  <textarea
                    autoFocus
                    rows={3}
                    placeholder={isIrm ? 'Enter reason for connecting agent...' : 'Enter reason for consultation...'}
                    value={consultationReason}
                    onChange={e => setConsultationReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: 13,
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      color: '#e2e8f0',
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'none',
                      marginBottom: 16,
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setPendingIrm(null);
                        setConsultationReason('');
                      }}
                      style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!consultationReason.trim() || !pendingIrm}
                      onClick={() => {
                        if (pendingIrm) {
                          handleConnectIrm(pendingIrm, consultationReason.trim());
                        }
                      }}
                      style={{
                        padding: '6px 14px',
                        fontSize: 12,
                        opacity: consultationReason.trim() && pendingIrm ? 1 : 0.5,
                        cursor: consultationReason.trim() && pendingIrm ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Confirm & Connect
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Mute */}
            <button
              className="btn btn-icon btn-sm incall-btn-ctrl-round"
              style={{
                backgroundColor: activeCall.isMuted ? '#dc2626' : '#1e293b',
              }}
              title={activeCall.isMuted ? 'Unmute' : 'Mute'}
              onClick={toggleMute}
            >
              {activeCall.isMuted ? <MicOff size={15} /> : <Mic size={15} />}
            </button>

            {/* Hold */}
            <button
              className="btn btn-icon btn-sm incall-btn-ctrl-round"
              style={{
                backgroundColor: activeCall.isOnHold ? '#d97706' : '#1e293b',
              }}
              title={activeCall.isOnHold ? 'Resume Call' : 'Hold Call'}
              onClick={toggleHold}
            >
              {activeCall.isOnHold ? <Play size={15} /> : <Pause size={15} />}
            </button>

            {/* End Call */}
            <button
              className="btn btn-danger btn-sm incall-btn-end"
              onClick={() => endCall()}
            >
              <PhoneOff size={14} /> End
            </button>
          </div>

          {/* ── Google Meet paste-link row (appears after Meet is launched) ── */}
          {meetLaunched && (
            <div className="incall-meet-link-box">
              <div className="incall-meet-link-input-row">
                <input
                  type="text"
                  className="form-input incall-meet-input"
                  placeholder="Paste the Meet link here to share it"
                  value={meetInput}
                  onChange={e => {
                    setMeetInput(e.target.value);
                    setMeetingLink(e.target.value || null);
                  }}
                />
                {meetInput.trim() && (
                  <button
                    className="btn btn-sm incall-btn-action incall-btn-whatsapp"
                    title="Share Meet link via WhatsApp"
                    onClick={() =>
                      window.open(
                        `https://wa.me/${waNumber}?text=${encodeURIComponent('Join our call here: ' + meetInput.trim())}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                  >
                    <MessageCircle size={11} /> Share via WA
                  </button>
                )}
              </div>
              <span className="incall-simulated-tag">
                Opens a real Google Meet room — screen share and video happen inside Meet itself, not in this app.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Documents Drawer (tabbed) ── */}
      <Drawer
        isOpen={docsOpen}
        onClose={() => setDocsOpen(false)}
        title="Call Documents"
        subtitle={`${activeCall.contactName} ${activeCall.contactPhone}`}
        width={500}
      >
        {/* Tab bar — same active-underline style as CustomersPage */}
        <div className="incall-docs-tabs-bar">
          {[
            { id: 'customer' as const, label: 'Customer Documents' },
            { id: 'company' as const, label: 'Company Resources' },
          ].map(tab => (
            <button
              key={tab.id}
              className="btn btn-ghost incall-docs-tab-btn"
              style={{
                borderBottom: docsTab === tab.id ? '2px solid var(--primary-600)' : '2px solid transparent',
                color: docsTab === tab.id ? 'var(--primary-600)' : 'var(--text-secondary)',
                fontWeight: docsTab === tab.id ? 700 : 500,
              }}
              onClick={() => setDocsTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Customer Documents tab */}
        {docsTab === 'customer' && (
          hasMatchedRecord ? (
            <>
              <DocumentUploader
                entityType={activeCall.matchedRecord!.type as 'lead' | 'customer'}
                entityId={activeCall.matchedRecord!.id!}
                allowedCategories={['KYC', 'Agreement', 'Payment Receipt', 'Identity Proof', 'Other']}
              />
              <DocumentList
                entityType={activeCall.matchedRecord!.type as 'lead' | 'customer'}
                entityId={activeCall.matchedRecord!.id!}
                canDelete
              />
            </>
          ) : (
            <EmptyState
              icon={<Inbox size={24} />}
              title="No Matched Record"
              description="Documents can only be attached when the caller is matched to a lead or customer. Create a lead for this contact first."
            />
          )
        )}

        {/* Company Resources tab — always available regardless of matched record */}
        {docsTab === 'company' && tenant && (
          <>
            <DocumentUploader
              entityType="company"
              entityId={tenant.id}
              allowedCategories={['Brochure', 'Price List', 'Terms & Conditions', 'Policy Document', 'Other']}
            />
            <DocumentList
              entityType="company"
              entityId={tenant.id}
              canDelete={false}
            />
          </>
        )}
      </Drawer>
    </>
  );
};

// --- Mandatory Post-Call Disposition Modal ---
export const DispositionModal: React.FC = () => {
  const { showDispositionModal, lastCallRecord, saveDisposition, skipDispositionWithReason } = useCall();
  const { tenant, user } = useAuth();

  const [disposition, setDisposition] = useState<CallDisposition>('Interested');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [scheduleFollowup, setScheduleFollowup] = useState(false);
  const [followupDate, setFollowupDate] = useState('');
  const [followupTime, setFollowupTime] = useState('');
  const [followupPriority, setFollowupPriority] = useState<'Low' | 'Medium' | 'High'>('High');

  // Skip outcome workflow state
  const [isSkipping, setIsSkipping] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [skipError, setSkipError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // No Response customized customer message state
  const [customerMessage, setCustomerMessage] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [channelsStatus, setChannelsStatus] = useState<MessagingChannelStatus[]>([
    { channel: 'email', name: 'Email', configured: true, provider: 'SMTP (smtp.gmail.com)', statusMessage: 'Active and configured via Gmail SMTP.' },
    { channel: 'sms', name: 'SMS', configured: false, provider: 'None', statusMessage: 'No SMS gateway provider (e.g., Twilio / AWS SNS) is configured on the backend server.' },
    { channel: 'whatsapp', name: 'WhatsApp', configured: false, provider: 'None', statusMessage: 'No WhatsApp Business API provider is configured on the backend server.' },
  ]);
  const [sendDeliveryNotice, setSendDeliveryNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const QUICK_SKIP_REASONS = [
    'Customer disconnected abruptly',
    'Customer requested callback later',
    'Customer busy / in a meeting',
    'Wrong contact / invalid number',
    'Requires manager consultation',
    'Handled via WhatsApp / offline',
  ];

  // Reset all form state fresh for every new call — keyed on lastCallRecord.id so
  // it fires once per finished call, before the modal renders to the agent.
  // tomorrowDate and defaultFollowupTime are recomputed here (not at module scope)
  // so midnight rollovers and mid-session Call Settings changes both take effect.
  useEffect(() => {
    if (!lastCallRecord) return;
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const freshTomorrow = d.toISOString().slice(0, 10);
    const isFollowup = !!lastCallRecord.sourceFollowupId;
    const isIrmLead = user?.role?.code === 'irm' && lastCallRecord.matchedRecord?.type === 'lead';
    const defaultDispo: CallDisposition = isIrmLead && !isFollowup ? 'Follow-up Required' : 'Interested';
    setDisposition(defaultDispo);
    setNotes('');
    setReason('');
    setScheduleFollowup(defaultDispo === 'Follow-up Required');
    setFollowupDate(freshTomorrow);
    setFollowupTime(getCallPreferences().defaultFollowupTime);
    setFollowupPriority('High');
    setIsSkipping(false);
    setSkipReason('');
    setSkipError('');
    setIsSubmitting(false);

    // Look up email address from local store / matched record
    let foundEmail = '';
    if (tenant?.id) {
      const localLeads = storageService.getLeads(tenant.id);
      const l = localLeads.find(x => (lastCallRecord.matchedRecord?.id && x.id === lastCallRecord.matchedRecord.id) || (x.phone && x.phone.replace(/\D/g, '').slice(-10) === (lastCallRecord.contactPhone || '').replace(/\D/g, '').slice(-10)));
      if (l?.email) foundEmail = l.email;
      if (!foundEmail) {
        const localCusts = storageService.getCustomers(tenant.id);
        const c = localCusts.find(x => (lastCallRecord.matchedRecord?.id && x.id === lastCallRecord.matchedRecord.id) || (x.phone && x.phone.replace(/\D/g, '').slice(-10) === (lastCallRecord.contactPhone || '').replace(/\D/g, '').slice(-10)));
        if (c?.email) foundEmail = c.email;
      }
    }
    setRecipientEmail(foundEmail);
    setRecipientPhone(lastCallRecord.contactPhone || '');
    setSelectedChannel('email');
    setCustomerMessage(`Hi ${lastCallRecord.contactName || 'there'}, I tried reaching you regarding your investment inquiry with GHL India Ventures, but couldn't connect. I have scheduled our next follow-up. Please feel free to reply or call back when convenient.`);
    setSendDeliveryNotice(null);

    // Fetch active backend messaging channel configurations
    getMessagingChannels().then(ch => {
      if (ch && ch.length) setChannelsStatus(ch);
    }).catch(console.error);
  }, [lastCallRecord?.id, lastCallRecord?.matchedRecord?.type, lastCallRecord?.sourceFollowupId, user?.role?.code, tenant?.id]);

  if (!showDispositionModal || !lastCallRecord) return null;

  const isGhlSalesExec = (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01') && user?.role?.code === 'sales_executive';
  // This call was launched from the Follow-ups page (a previously scheduled follow-up task).
  const isFollowupCall = !!lastCallRecord.sourceFollowupId;
  const isIrm = user?.role?.code === 'irm';
  const isIrmLeadCall = isIrm && lastCallRecord.matchedRecord?.type === 'lead';

  const allDispositions: CallDisposition[] = [
    'Interested',
    'Follow-up Required',
    'Call Back',
    'Converted',
    'Not Interested',
    'Wrong Number',
    'No Response',
  ];

  // For follow-up calls, "Call Back" and "Wrong Number" are not valid outcomes.
  // IRM follow-up calls support Interested, Follow-up Required, and No Response.
  const FOLLOWUP_CALL_OUTCOMES: CallDisposition[] = ['Interested', 'Follow-up Required', 'Not Interested'];

  // For IRM follow-up calls, outcomes include Interested, Follow-up Required, and No Response.
  const IRM_FOLLOWUP_CALL_OUTCOMES: CallDisposition[] = ['Interested', 'Follow-up Required', 'No Response'];

  // For IRM calls against Lead records, restrict to Follow-up Required, Converted, and No Response beside Converted
  const IRM_LEAD_OUTCOMES: CallDisposition[] = ['Follow-up Required', 'Converted', 'No Response'];

  const dispositions: CallDisposition[] = isFollowupCall
    ? (isIrm ? IRM_FOLLOWUP_CALL_OUTCOMES : FOLLOWUP_CALL_OUTCOMES)
    : isIrmLeadCall
      ? IRM_LEAD_OUTCOMES
      : isGhlSalesExec
        ? allDispositions.filter(d => d !== 'Converted')
        : allDispositions;

  const handleSave = async () => {
    if (isSubmitting) return;

    if ((disposition === 'Not Interested' || disposition === 'Wrong Number') && !reason.trim()) {
      alert(`Please provide a reason why this contact was marked as "${disposition}".`);
      return;
    }

    if (disposition === 'No Response') {
      if (!customerMessage.trim()) {
        alert('Please provide a message for the customer before saving wrap-up.');
        return;
      }

      // Validate contact for selected channel
      if (selectedChannel === 'email') {
        if (!recipientEmail.trim()) {
          setSendDeliveryNotice({
            type: 'error',
            text: 'Message delivery unavailable: No email address on file. Please enter a valid recipient email address above.',
          });
          return;
        }
        if (!recipientEmail.includes('@') || !recipientEmail.includes('.')) {
          setSendDeliveryNotice({
            type: 'error',
            text: `Message delivery failed: "${recipientEmail}" is not a valid email address.`,
          });
          return;
        }
      } else {
        const phone = recipientPhone.trim() || (lastCallRecord.contactPhone || '').trim();
        if (!phone) {
          setSendDeliveryNotice({
            type: 'error',
            text: `Message delivery unavailable: No phone number provided for ${selectedChannel.toUpperCase()}.`,
          });
          return;
        }
      }
    }

    // Combine date + time into a proper ISO string so scheduledAt is parseable
    const targetDate = followupDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
    const combinedDateTime = (scheduleFollowup || disposition === 'Follow-up Required' || disposition === 'No Response')
      ? new Date(`${targetDate}T${followupTime || '11:00'}:00`).toISOString()
      : '';

    setIsSubmitting(true);
    try {
      let finalNotes = notes;

      if (disposition === 'No Response') {
        const leadIdNum = parseInt(String(lastCallRecord.matchedRecord?.type === 'lead' ? lastCallRecord.matchedRecord.id : '').replace(/\D/g, ''), 10) || undefined;
        const customerIdNum = parseInt(String(lastCallRecord.matchedRecord?.type === 'customer' ? lastCallRecord.matchedRecord.id : '').replace(/\D/g, ''), 10) || undefined;
        const effectivePhone = recipientPhone.trim() || (lastCallRecord.contactPhone || '').trim();

        const sendResult = await sendCustomerMessage({
          recipientEmail: recipientEmail.trim(),
          recipientPhone: effectivePhone,
          recipientName: lastCallRecord.contactName,
          message: customerMessage.trim(),
          channel: selectedChannel,
          leadId: leadIdNum,
          customerId: customerIdNum,
        });

        if (!sendResult.delivered) {
          // Delivery failed or unavailable!
          // Do not show as sent; preserve state so IRM can retry or switch channel
          setSendDeliveryNotice({
            type: 'error',
            text: sendResult.deliveryResult || `Message delivery via ${selectedChannel.toUpperCase()} is unavailable or failed. State preserved for retry.`,
          });
          setIsSubmitting(false);
          return;
        }

        // Delivery succeeded!
        const channelLabel = selectedChannel.toUpperCase();
        const contactTarget = selectedChannel === 'email' ? recipientEmail.trim() : effectivePhone;
        const logSnippet = `[No Response Follow-up Message Sent via ${channelLabel} to ${contactTarget}]: ${customerMessage.trim()}`;
        finalNotes = finalNotes ? `${finalNotes}\n\n${logSnippet}` : logSnippet;
      }

      await saveDisposition(
        disposition,
        finalNotes,
        combinedDateTime
          ? {
            scheduledAt: combinedDateTime,
            priority: followupPriority,
            notes: finalNotes ? `Follow-up from call with ${lastCallRecord.contactName}: ${finalNotes}` : `Follow-up required from call with ${lastCallRecord.contactName}`,
          }
          : undefined,
        (disposition === 'Not Interested' || disposition === 'Wrong Number') ? reason : undefined
      );
    } catch (err: any) {
      if (disposition === 'No Response') {
        setSendDeliveryNotice({
          type: 'error',
          text: `Message dispatch error: ${err.message || 'Unable to connect to server'}. State preserved for retry.`,
        });
      } else {
        alert(`Failed to save wrap-up: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSkip = async () => {
    if (isSubmitting) return;

    if (!skipReason.trim()) {
      setSkipError('Please provide a reason before skipping wrap-up.');
      return;
    }

    setIsSubmitting(true);
    try {
      await skipDispositionWithReason(skipReason.trim(), notes.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={showDispositionModal}
      onClose={() => {
        // Prevent accidental closing; modal must not disappear until saved or skipped with reason
      }}
      closeOnBackdrop={false}
      closeOnEscape={false}
      hideCloseButton={true}
      title={isSkipping ? "Skip Call Wrap-up" : "Call Wrap-up & Disposition"}
      subtitle={`Call with ${lastCallRecord.contactName} (${lastCallRecord.contactPhone}) • Duration: ${Math.floor(lastCallRecord.duration / 60)}m ${lastCallRecord.duration % 60}s`}
      maxWidth={580}
      footer={
        isSkipping ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsSkipping(false);
                setSkipError('');
              }}
              disabled={isSubmitting}
            >
              Back to Wrap-up
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmSkip}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Reason & Skip'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsSkipping(true);
                setSkipError('');
              }}
              disabled={isSubmitting}
            >
              Skip for Now
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Disposition & Wrap Up'}
            </button>
          </>
        )
      }
    >
      {isSkipping ? (
        <div className="disposition-form-container">
          <div className="disposition-skip-banner">
            <AlertCircle size={18} className="disposition-skip-banner-icon" />
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <strong>Reason Required to Skip Wrap-up</strong>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                Please specify why this call wrap-up is being skipped. The reason will be permanently recorded in Call Details.
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Select a Common Reason</label>
            <div className="disposition-skip-chips">
              {QUICK_SKIP_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  className={`disposition-skip-chip ${skipReason === r ? 'disposition-skip-chip-active' : ''}`}
                  onClick={() => {
                    setSkipReason(r);
                    setSkipError('');
                  }}
                >
                  {skipReason === r && <CheckCircle2 size={12} style={{ marginRight: 4 }} />}
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Reason for Skipping <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Explain why wrap-up is skipped (e.g. customer dropped, will re-dial in 10 mins)..."
              value={skipReason}
              onChange={e => {
                setSkipReason(e.target.value);
                if (skipError) setSkipError('');
              }}
              autoFocus
            />
            {skipError && (
              <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={13} /> {skipError}
              </p>
            )}
          </div>

          {notes && (
            <div className="form-group" style={{ opacity: 0.85 }}>
              <label className="form-label" style={{ fontSize: 12 }}>Notes from call</label>
              <div style={{ fontSize: 12, padding: '8px 12px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}>
                {notes}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="disposition-form-container">
          {/* Disposition Selector */}
          <div className="form-group">
            <label className="form-label">Call Outcome / Disposition *</label>
            {isFollowupCall && (
              <p className="disposition-followup-context-hint">
                Follow-up call — outcomes restricted to relevant results.
              </p>
            )}
            <div className="disposition-grid">
              {dispositions.map(d => (
                <button
                  key={d}
                  type="button"
                  className={`btn btn-sm disposition-choice-btn ${disposition === d ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setDisposition(d);
                    if (d === 'Follow-up Required' || d === 'Call Back' || d === 'No Response') {
                      setScheduleFollowup(true);
                      if (!followupDate) {
                        const dt = new Date();
                        dt.setDate(dt.getDate() + 1);
                        setFollowupDate(dt.toISOString().slice(0, 10));
                      }
                      if (!followupTime) {
                        setFollowupTime(getCallPreferences().defaultFollowupTime);
                      }
                    } else {
                      setScheduleFollowup(false);
                      setFollowupDate('');
                      setFollowupTime('');
                      setFollowupPriority('High');
                    }
                  }}
                >
                  {disposition === d && <CheckCircle2 size={13} style={{ marginRight: 4 }} />}
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Call Notes */}
          {!(disposition === 'Not Interested' || disposition === 'Wrong Number') && (
            <div className="form-group">
              <label className="form-label">Call Discussion Summary & Notes</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Key discussion points, customer objections, next steps..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          )}

          {/* No Response: Customized Message to Customer */}
          {disposition === 'No Response' && (
            <div className="disposition-message-box">
              <div className="disposition-message-header">
                <div className="disposition-message-title">
                  {selectedChannel === 'email' ? <Mail size={16} color="var(--primary-600)" /> : selectedChannel === 'sms' ? <MessageSquare size={16} color="var(--primary-600)" /> : <MessageCircle size={16} color="var(--primary-600)" />}
                  <span>Customized Message to Customer</span>
                </div>
                <span className="disposition-channel-badge">
                  {selectedChannel === 'email' ? 'Provider: Gmail SMTP (Active)' : `${selectedChannel.toUpperCase()} Gateway (Not Configured)`}
                </span>
              </div>

              {/* Selectable Message Channels: Email, SMS, WhatsApp */}
              <div className="form-group" style={{ marginBottom: 4 }}>
                <label className="form-label" style={{ fontSize: 12, marginBottom: 6 }}>
                  Select Message Channel *
                </label>
                <div className="disposition-channel-selector">
                  {([
                    { id: 'email' as const, label: 'Email', icon: <Mail size={14} /> },
                    { id: 'sms' as const, label: 'SMS', icon: <MessageSquare size={14} /> },
                    { id: 'whatsapp' as const, label: 'WhatsApp', icon: <MessageCircle size={14} /> },
                  ]).map(ch => {
                    const status = channelsStatus.find(s => s.channel === ch.id);
                    const isConfigured = status ? status.configured : ch.id === 'email';
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        className={`disposition-channel-btn ${selectedChannel === ch.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedChannel(ch.id);
                          if (sendDeliveryNotice?.type === 'error') setSendDeliveryNotice(null);
                        }}
                      >
                        <div className="disposition-channel-btn-top">
                          {ch.icon}
                          <span>{ch.label}</span>
                        </div>
                        <span className={`disposition-channel-tag ${isConfigured ? 'active' : 'unavailable'}`}>
                          {isConfigured ? (
                            <><CheckCircle2 size={10} /> Active</>
                          ) : (
                            <><AlertCircle size={10} /> Unavailable</>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clear notice when selected channel is NOT configured */}
              {selectedChannel !== 'email' && (
                <div className="disposition-notice-alert error" style={{ margin: '4px 0 6px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong>{selectedChannel.toUpperCase()} Provider Unavailable</strong>
                    <div style={{ fontSize: 11, marginTop: 2 }}>
                      No {selectedChannel === 'sms' ? 'SMS gateway provider (e.g., Twilio or AWS SNS)' : 'WhatsApp Business API provider'} is configured on the backend server.
                      Outbound messages cannot be dispatched via this channel. To deliver this follow-up, switch to <strong>Email (Gmail SMTP)</strong>.
                    </div>
                  </div>
                </div>
              )}

              {sendDeliveryNotice && (
                <div className={`disposition-notice-alert ${sendDeliveryNotice.type}`}>
                  {sendDeliveryNotice.type === 'error' ? (
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  ) : (
                    <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{sendDeliveryNotice.text}</div>
                    {sendDeliveryNotice.type === 'error' && (
                      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.9 }}>
                        Call disposition and follow-up date/time are preserved. You can edit the recipient contact or switch channels and click <strong>"Save Disposition &amp; Wrap Up"</strong> to retry.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recipient Contact based on channel */}
              {selectedChannel === 'email' ? (
                <div className="form-group" style={{ marginBottom: 4 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Recipient Email Address <span style={{ color: '#ef4444' }}>*</span></span>
                    <span style={{ fontSize: 11, color: '#10b981' }}>● Gmail SMTP Active</span>
                  </label>
                  <input
                    type="email"
                    className={`form-input ${!recipientEmail.trim() && sendDeliveryNotice?.type === 'error' ? 'is-invalid' : ''}`}
                    placeholder="Enter recipient email (e.g. client@example.com)"
                    value={recipientEmail}
                    onChange={e => {
                      setRecipientEmail(e.target.value);
                      if (sendDeliveryNotice?.type === 'error') setSendDeliveryNotice(null);
                    }}
                  />
                  {!recipientEmail.trim() && (
                    <span style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, display: 'block' }}>
                      ⚠️ No email address on file. Please enter a valid recipient email address above.
                    </span>
                  )}
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: 4 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Recipient Mobile Number ({selectedChannel.toUpperCase()}) <span style={{ color: '#ef4444' }}>*</span></span>
                    <span style={{ fontSize: 11, color: '#ef4444' }}>● Gateway Not Configured</span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${!recipientPhone.trim() && sendDeliveryNotice?.type === 'error' ? 'is-invalid' : ''}`}
                    placeholder="Enter phone number (e.g. +91 98765 43210)"
                    value={recipientPhone}
                    onChange={e => {
                      setRecipientPhone(e.target.value);
                      if (sendDeliveryNotice?.type === 'error') setSendDeliveryNotice(null);
                    }}
                  />
                  {!recipientPhone.trim() && (
                    <span style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'block' }}>
                      ⚠️ No phone number provided for {selectedChannel.toUpperCase()}.
                    </span>
                  )}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Message to Customer <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Write customized follow-up message to the customer..."
                  value={customerMessage}
                  onChange={e => {
                    setCustomerMessage(e.target.value);
                    if (sendDeliveryNotice?.type === 'error') setSendDeliveryNotice(null);
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Message will be dispatched to the customer only when you click "Save Disposition &amp; Wrap Up".
                </span>
              </div>
            </div>
          )}

          {/* Reason Box for Not Interested / Wrong Number */}
          {(disposition === 'Not Interested' || disposition === 'Wrong Number') && (
            <div className="form-group">
              <label className="form-label">Reason *</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder={disposition === 'Not Interested' ? 'Why are they not interested?' : 'Details about the wrong number...'}
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
              />
            </div>
          )}

          {/* Conditional Follow-up Section */}
          {!(disposition === 'Not Interested' || disposition === 'Wrong Number') && (
            <div className="disposition-followup-box">
              <div
                className="disposition-followup-header"
                style={{ marginBottom: scheduleFollowup ? 12 : 0 }}
              >
                <label className="disposition-followup-label">
                  <input
                    type="checkbox"
                    checked={scheduleFollowup}
                    onChange={e => setScheduleFollowup(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Schedule a Next Follow-up Task
                </label>
                <Calendar size={16} color="var(--primary-600)" />
              </div>

              {scheduleFollowup && (
                <div className="disposition-followup-fields">
                  <div className="form-group">
                    <label className="form-label">Follow-up Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={followupDate}
                      onChange={e => setFollowupDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-up Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={followupTime}
                      onChange={e => setFollowupTime(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      className="form-select"
                      value={followupPriority}
                      onChange={e => setFollowupPriority(e.target.value as any)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
