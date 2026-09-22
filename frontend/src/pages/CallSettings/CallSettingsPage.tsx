import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  ArrowUpRight,
  ArrowUpLeft,
  ArrowDownRight,
  ArrowDownLeft,
  Phone,
  Volume2,
  Bell,
  BellOff,
  Clock,
  Activity,
} from 'lucide-react';
import { preferenceStore, CallPreferences, PopupPosition } from '../../services/secondaryStores';
export type { PopupPosition, CallPreferences };

import { useCall } from '../../context/CallContext';
import './CallSettingsPage.css';
// ── Shared inline toggle component matching this file's visual language ──────
const SettingToggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}> = ({ checked, onChange, id }) => (
  <label
    htmlFor={id}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      cursor: 'pointer',
      userSelect: 'none',
    }}
  >
    <div
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: checked ? 'var(--primary-600)' : 'var(--border-strong)',
        transition: 'background-color 0.2s',
        flexShrink: 0,
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'left 0.2s',
        }}
      />
    </div>
  </label>
);

// ── Helper: play the Web Audio beep used for ringtone ────────────────────────
const playTestBeep = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.type = 'sine';
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* audio not available */ }
};

export const CallSettingsPage: React.FC = () => {
  const [position, setPosition] = useState<PopupPosition>(() => preferenceStore.getPopupPosition());
  const { simulateIncomingCall } = useCall();

  // ── Call preferences state ────────────────────────────────────────────────
  const [prefs, setPrefs] = useState<CallPreferences>(() => preferenceStore.getCallPreferences());

  // Keep prefs in sync with other tabs / external writes
  useEffect(() => {
    const handleUpdate = () => {
      setPosition(preferenceStore.getPopupPosition());
      setPrefs(preferenceStore.getCallPreferences());
    };
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('nexus_storage_updated', handleUpdate);
    };
  }, []);

  // Notification permission state (live)
  const notifSupported = typeof Notification !== 'undefined';
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    notifSupported ? Notification.permission : 'denied'
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectPosition = (newPos: PopupPosition) => {
    setPosition(newPos);
    preferenceStore.setPopupPosition(newPos);
  };

  const updatePref = <K extends keyof CallPreferences>(key: K, value: CallPreferences[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    preferenceStore.setCallPreferences({ [key]: value });
  };

  const handleToggleDesktopNotif = async (enabled: boolean) => {
    if (enabled && notifSupported && Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      if (result !== 'granted') return; // don't enable if permission wasn't granted
    }
    updatePref('desktopNotifEnabled', enabled);
  };

  const options: {
    value: PopupPosition;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
      {
        value: 'top-right',
        label: 'Top Right',
        description: 'Popup appears at the top-right corner of the viewport (Standard default)',
        icon: <ArrowUpRight size={18} />,
      },
      {
        value: 'top-left',
        label: 'Top Left',
        description: 'Popup appears at the top-left corner of the viewport',
        icon: <ArrowUpLeft size={18} />,
      },
      {
        value: 'bottom-right',
        label: 'Bottom Right',
        description: 'Popup appears at the bottom-right corner of the viewport',
        icon: <ArrowDownRight size={18} />,
      },
      {
        value: 'bottom-left',
        label: 'Bottom Left',
        description: 'Popup appears at the bottom-left corner of the viewport',
        icon: <ArrowDownLeft size={18} />,
      },
    ];

  // Notification permission status label
  const notifPermissionLabel = () => {
    if (!notifSupported) return null;
    if (notifPermission === 'granted') {
      return <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Granted</span>;
    }
    if (notifPermission === 'denied') {
      return (
        <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
          Blocked — enable in browser settings
        </span>
      );
    }
    return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Not yet requested</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PhoneCall size={24} color="var(--primary-600)" /> Call Settings
          </h1>
          <p className="page-subtitle">
            Configure telephony preferences, caller alerts, and incoming call notification display positioning.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>

        {/* ── EXISTING CARD (UNCHANGED): Incoming Call Popup Position ── */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Incoming Call Popup
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>
                Select the screen corner where incoming call notifications appear.
                The active call window also opens at this corner when you accept a call — and you can drag it anywhere on screen during the call.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => simulateIncomingCall('Rahul Sharma (VIP Lead)', '+91 98765 43210')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              title="Test the popup at the currently selected position"
            >
              <Volume2 size={14} color="var(--primary-600)" /> Simulate Incoming Call
            </button>
          </div>

          {/* Radio Options List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {options.map(opt => {
              const isSelected = position === opt.value;
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelectPosition(opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--primary-500)' : 'var(--border-base)',
                    boxShadow: isSelected ? '0 0 0 1px var(--primary-500)' : 'none',
                    backgroundColor: isSelected ? 'var(--primary-50)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        type="radio"
                        id={`pos-${opt.value}`}
                        name="popup-position"
                        value={opt.value}
                        checked={isSelected}
                        onChange={() => handleSelectPosition(opt.value)}
                        style={{
                          width: 18,
                          height: 18,
                          cursor: 'pointer',
                          accentColor: 'var(--primary-600)',
                        }}
                      />
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: isSelected ? 700 : 600,
                          color: isSelected ? 'var(--primary-700)' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {opt.label}
                        {opt.value === 'top-right' && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 4,
                              backgroundColor: 'rgba(37, 99, 235, 0.1)',
                              color: 'var(--primary-600)',
                            }}
                          >
                            Default
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {opt.description}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: isSelected ? 'var(--primary-100)' : 'var(--bg-surface-hover)',
                      color: isSelected ? 'var(--primary-600)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {opt.icon}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Viewport Preview Box */}
          <div
            style={{
              marginTop: 10,
              padding: 16,
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-base)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Screen Viewport Preview
              </span>
              <span style={{ fontSize: 11, color: 'var(--primary-600)', fontWeight: 600 }}>
                Active Position: {options.find(o => o.value === position)?.label}
              </span>
            </div>

            {/* Screen representation */}
            <div
              style={{
                position: 'relative',
                height: 140,
                backgroundColor: '#1e293b',
                borderRadius: 8,
                border: '1px solid #334155',
                overflow: 'hidden',
              }}
            >
              {/* Mini mock topbar */}
              <div
                style={{
                  height: 16,
                  backgroundColor: '#000000',
                  borderBottom: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  gap: 4,
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
              </div>

              {/* Mini mock sidebar */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 16,
                  bottom: 0,
                  width: 32,
                  backgroundColor: '#0f172a',
                  borderRight: '1px solid #334155',
                }}
              />

              {/* Mini incoming call popup representation */}
              <div
                style={{
                  position: 'absolute',
                  top: position.startsWith('top') ? 22 : 'auto',
                  bottom: position.startsWith('bottom') ? 8 : 'auto',
                  left: position.endsWith('left') ? 40 : 'auto',
                  right: position.endsWith('right') ? 8 : 'auto',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 4px 10px rgba(37, 99, 235, 0.5)',
                  zIndex: 5,
                }}
              >
                <Phone size={10} /> Incoming Call
              </div>
            </div>
          </div>
        </div>

        {/* ── NEW CARD 1: Incoming Call Sound ── */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: prefs.soundEnabled ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface-hover)',
                  color: prefs.soundEnabled ? '#059669' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Volume2 size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Incoming Call Sound
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                  Play a short beep when a call starts ringing.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={playTestBeep}
                style={{ fontSize: 12 }}
                title="Preview the sound now"
              >
                Test Sound
              </button>
              <SettingToggle
                id="toggle-sound"
                checked={prefs.soundEnabled}
                onChange={v => updatePref('soundEnabled', v)}
              />
            </div>
          </div>
        </div>

        {/* ── NEW CARD 2: Desktop Notification ── */}
        {notifSupported ? (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: prefs.desktopNotifEnabled ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-surface-hover)',
                    color: prefs.desktopNotifEnabled ? 'var(--primary-600)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Bell size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Browser Desktop Notification
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                    Show a system notification when an incoming call rings.
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Permission:</span>
                    {notifPermissionLabel()}
                  </div>
                </div>
              </div>

              <div style={{ flexShrink: 0 }}>
                <SettingToggle
                  id="toggle-notif"
                  checked={prefs.desktopNotifEnabled}
                  onChange={handleToggleDesktopNotif}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <BellOff size={18} color="var(--text-muted)" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>
                  Browser Desktop Notification
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  Not supported in this browser.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── NEW CARD 3: Auto-Busy Toggle ── */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: prefs.autoBusyEnabled ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-surface-hover)',
                  color: prefs.autoBusyEnabled ? '#d97706' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Activity size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Auto-Busy During Calls
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                  Automatically set your status to <strong>Busy</strong> when a call starts.
                  Your status always reverts to Available after the call ends.
                </div>
              </div>
            </div>

            <div style={{ flexShrink: 0 }}>
              <SettingToggle
                id="toggle-autobusy"
                checked={prefs.autoBusyEnabled}
                onChange={v => updatePref('autoBusyEnabled', v)}
              />
            </div>
          </div>
        </div>

        {/* ── NEW CARD 4: Default Follow-up Time ── */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clock size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Default Follow-up Time
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, marginBottom: 12 }}>
                Pre-fills the time field in Quick Create follow-ups and the post-call Disposition Modal.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="time"
                  className="form-input"
                  style={{ width: 140 }}
                  value={prefs.defaultFollowupTime}
                  onChange={e => updatePref('defaultFollowupTime', e.target.value)}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Saved instantly — takes effect the next time you open either form.
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
