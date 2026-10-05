import React, { useState, useEffect } from 'react';
import {
  Send,
  X,
  Copy,
  Check,
  MessageSquare,
  Smartphone,
  Mail,
  Shield,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Deal } from '../../../types';
import { getAuthHeaders } from '../../../utils/authHeaders';
import './KycLinkComponents.css';

interface SendKycLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal | null;
  onShowToast: (msg: string) => void;
  onSent?: (deal: Deal) => void;
  isResend?: boolean;
}

export const SendKycLinkModal: React.FC<SendKycLinkModalProps> = ({
  isOpen,
  onClose,
  deal,
  onShowToast,
  onSent,
  isResend = false,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [expiry, setExpiry] = useState<string>('48h');
  const [copied, setCopied] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Secure backend link state — never initialized with or displaying client mock tokens
  const [secureLink, setSecureLink] = useState<string | null>(null);
  const [isLoadingLink, setIsLoadingLink] = useState<boolean>(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const rawCustomerName = (deal?.customerName || (deal as any)?.name || '').trim();
  const customerNameDisplay = rawCustomerName || '—';
  const resolvedPhone = (deal?.phone || '').trim();
  const resolvedEmail = (deal?.email || '').trim();

  const fetchOrCreateSecureLink = async (targetExpiry?: string, forceNew = false) => {
    if (!deal) return;
    setIsLoadingLink(true);
    setLinkError(null);

    try {
      const payload = {
        customerName: deal.customerName,
        phone: resolvedPhone || deal.phone || '',
        email: selectedChannel === 'email' ? recipientEmail.trim() : (resolvedEmail || deal.email || ''),
        channel: 'link', // 'link' channel generates or reuses the cryptographically secure token
        expiry: targetExpiry || expiry,
        baseUrl: window.location.origin,
        forceNewToken: forceNew,
      };

      const res = await fetch('/api/irm/kyc/send-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (res.ok && json?.success && json?.data?.link) {
        setSecureLink(json.data.link);
        setLinkError(null);
      } else {
        setSecureLink(null);
        setLinkError(json?.message || `Server error (${res.status}) generating secure link.`);
      }
    } catch (err: any) {
      setSecureLink(null);
      setLinkError(err?.message || 'Network error connecting to KYC service.');
    } finally {
      setIsLoadingLink(false);
    }
  };

  useEffect(() => {
    if (isOpen && deal) {
      setRecipientEmail((deal.email || '').trim());
      setErrorMessage(null);
      setCopied(false);
      // Fetch or generate real cryptographically secure link from backend
      fetchOrCreateSecureLink(expiry, isResend);
    } else {
      setSecureLink(null);
      setLinkError(null);
      setErrorMessage(null);
      setCopied(false);
    }
  }, [isOpen, deal?.id]);

  if (!isOpen || !deal) return null;

  const isValidEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.trim());
  };

  const getCleanPhone = (phoneStr: string) => {
    let clean = (phoneStr || '').replace(/[^0-9]/g, '');
    if (clean.length === 10) {
      clean = `91${clean}`;
    }
    return clean;
  };

  const buildWhatsAppMessage = (link: string) => {
    const expiryLabel = expiry === '24h' ? '24 hours' : expiry === '72h' ? '72 hours' : '48 hours';
    return `Hello ${rawCustomerName || 'Valued Investor'},

You have been invited by GHL India Ventures to complete your Qualified Investor & Regulatory KYC verification.

Please click the secure link below to complete your verification:
🔗 ${link}

⏱ Security Notice: This link is confidential and will expire in ${expiryLabel}.

    Best regards,
    GHL India Ventures | IRM Desk`;
  };

  const handleCopyLink = () => {
    if (!secureLink) return;
    navigator.clipboard?.writeText(secureLink);
    setCopied(true);
    onShowToast('Secure KYC link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExpiryChange = (newExpiry: string) => {
    setExpiry(newExpiry);
    fetchOrCreateSecureLink(newExpiry, true);
  };

  const handleSendLink = async () => {
    setErrorMessage(null);

    if (selectedChannel === 'email') {
      const trimmed = recipientEmail.trim();
      if (!trimmed) {
        setErrorMessage('Please provide an email address for the investor.');
        return;
      }
      if (!isValidEmail(trimmed)) {
        setErrorMessage(`'${trimmed}' is not in the form required for an email address.`);
        return;
      }
    }

    setIsSending(true);

    try {
      const targetEmail = selectedChannel === 'email' ? recipientEmail.trim() : (resolvedEmail || deal.email || '');
      const payload = {
        customerName: deal.customerName,
        phone: resolvedPhone || deal.phone || '',
        email: targetEmail,
        channel: selectedChannel === 'email' ? 'email' : 'link',
        expiry: expiry,
        baseUrl: window.location.origin,
        forceNewToken: isResend || selectedChannel === 'email',
      };

      const res = await fetch('/api/irm/kyc/send-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        const failureMessage =
          json?.message ||
          (res.status === 401
            ? 'You are not logged in. Please log in again.'
            : `Server error (${res.status}) while processing KYC link.`);
        setIsSending(false);
        setErrorMessage(failureMessage);
        onShowToast(`Failed: ${failureMessage}`);
        return;
      }

      const returnedLink = json.data?.link || secureLink;
      const emailSent = !!json.data?.emailSent;
      if (returnedLink) {
        setSecureLink(returnedLink);
      }

      setIsSending(false);

      // ── 1. WhatsApp Web Click-to-Chat ────────────────────────────────────────
      if (selectedChannel === 'whatsapp') {
        if (!returnedLink) {
          setErrorMessage('Could not obtain secure link from backend.');
          return;
        }
        onSent?.(deal);
        const cleanPhone = getCleanPhone(resolvedPhone || deal.phone || '');
        const message = buildWhatsAppMessage(returnedLink);
        const waUrl = cleanPhone
          ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

        window.open(waUrl, '_blank', 'noopener,noreferrer');
        onShowToast(`WhatsApp Web opened with pre-filled KYC message for ${deal.customerName}! (Server gateway offline)`);
        onClose();
        return;
      }

      // ── 2. SMS App Deep Link ─────────────────────────────────────────────────
      if (selectedChannel === 'sms') {
        if (!returnedLink) {
          setErrorMessage('Could not obtain secure link from backend.');
          return;
        }
        onSent?.(deal);
        const cleanPhone = getCleanPhone(resolvedPhone || deal.phone || '');
        const smsText = `Hello ${deal.customerName || 'Investor'}, please complete your GHL India KYC verification: ${returnedLink}`;
        if (cleanPhone) {
          window.open(`sms:${cleanPhone}?body=${encodeURIComponent(smsText)}`, '_blank');
        }
        onShowToast(`SMS app launched for ${deal.customerName}! (Server gateway offline)`);
        onClose();
        return;
      }

      // ── 3. Real-Time Email Delivery ──────────────────────────────────────────
      if (selectedChannel === 'email') {
        if (emailSent) {
          onSent?.(deal);
          onShowToast(`KYC Verification email delivered in real time to ${recipientEmail.trim()}!`);
          onClose();
          return;
        }

        // Real delivery failure: show clear error styling and retain modal state
        const errText = json?.message || json?.data?.deliveryStatus || 'SMTP delivery failed. Please check SMTP configuration.';
        setErrorMessage(errText);
        onShowToast(`Email delivery failed: ${errText}`);
        return;
      }
    } catch (err: any) {
      setIsSending(false);
      console.warn('Backend send-link API error:', err);
      const failureMessage = err?.message || 'Network error connecting to backend.';
      setErrorMessage(failureMessage);
      onShowToast(`Error: ${failureMessage}`);
      return;
    }

    onClose();
  };

  return (
    <div
      className="kyc-link-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="kyc-link-modal-container"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="kyc-link-modal-header">
          <h3 className="kyc-link-modal-title">
            <Send size={18} color="var(--primary-600, #2563eb)" />
            {isResend ? 'Resend Customer KYC Link' : 'Send Customer KYC Link'}
          </h3>
          <button
            type="button"
            className="kyc-link-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="kyc-link-modal-body">
          {/* Read-Only Customer Info */}
          <div className="kyc-link-readonly-box">
            <div className="kyc-link-readonly-item">
              <span className="kyc-link-readonly-label">Investor Name</span>
              <span className={`kyc-link-readonly-val ${!rawCustomerName ? 'is-empty' : ''}`} title={rawCustomerName || 'Not available'}>
                {customerNameDisplay}
              </span>
            </div>
            <div className="kyc-link-readonly-item">
              <span className="kyc-link-readonly-label">Phone</span>
              <span className={`kyc-link-readonly-val ${!resolvedPhone ? 'is-empty' : ''}`} title={resolvedPhone || 'Not available'}>
                {resolvedPhone || '—'}
              </span>
            </div>
            <div className="kyc-link-readonly-item" style={{ gridColumn: '1 / -1' }}>
              <span className="kyc-link-readonly-label">Email Address</span>
              <span className={`kyc-link-readonly-val ${!(selectedChannel === 'email' ? recipientEmail : resolvedEmail) ? 'is-empty' : ''}`} title={selectedChannel === 'email' ? recipientEmail : (resolvedEmail || 'Not available')}>
                {(selectedChannel === 'email' ? recipientEmail : resolvedEmail) || '—'}
              </span>
            </div>
          </div>

          {/* Delivery Channel Selector */}
          <div className="kyc-link-form-group">
            <label className="kyc-link-form-label">Delivery Channel</label>
            <div className="kyc-link-channel-chips">
              <button
                type="button"
                className={`kyc-link-channel-chip ${selectedChannel === 'whatsapp' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedChannel('whatsapp');
                  setErrorMessage(null);
                }}
              >
                <MessageSquare size={14} /> WhatsApp Web
              </button>
              <button
                type="button"
                className={`kyc-link-channel-chip ${selectedChannel === 'sms' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedChannel('sms');
                  setErrorMessage(null);
                }}
              >
                <Smartphone size={14} /> SMS App
              </button>
              <button
                type="button"
                className={`kyc-link-channel-chip ${selectedChannel === 'email' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedChannel('email');
                  setErrorMessage(null);
                }}
              >
                <Mail size={14} /> Email (SMTP)
              </button>
            </div>

            {/* Dynamic Channel Helper Box */}
            {selectedChannel === 'whatsapp' && (
              <div className="kyc-link-helper-box kyc-link-helper-box-whatsapp">
                <MessageSquare size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>WhatsApp Web (Client-Side):</strong> Server-side WhatsApp Business gateway is offline/unconfigured. Clicking Send will launch WhatsApp Web client-side with the secure KYC link ready to send to <strong>{resolvedPhone || 'the investor'}</strong>.
                </span>
              </div>
            )}

            {selectedChannel === 'email' && (
              <div className="kyc-link-helper-box kyc-link-helper-box-email">
                <Mail size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>Configured Server SMTP:</strong> Clicking Send will dispatch a branded HTML KYC verification email to <strong>{recipientEmail || resolvedEmail || 'investor email'}</strong> via configured Gmail SMTP.
                </span>
              </div>
            )}

            {selectedChannel === 'sms' && (
              <div className="kyc-link-helper-box kyc-link-helper-box-sms">
                <Smartphone size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>Direct SMS (Device-Side):</strong> Server-side SMS gateway is offline/unconfigured. Clicking Send will trigger your device's SMS app with the secure KYC link ready to send to <strong>{resolvedPhone || 'the investor'}</strong>.
                </span>
              </div>
            )}

            {/* Recipient Email Input for Email Channel */}
            {selectedChannel === 'email' && (
              <div style={{ marginTop: 12 }}>
                <label className="kyc-link-form-label" htmlFor="kyc-recipient-email" style={{ marginBottom: 4, display: 'block' }}>
                  Recipient Email Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="kyc-recipient-email"
                  type="email"
                  className="form-input"
                  placeholder="e.g. investor@domain.com"
                  value={recipientEmail}
                  onChange={e => {
                    setRecipientEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  style={{
                    width: '100%',
                    height: 38,
                    fontSize: 13,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color, #cbd5e1)',
                  }}
                />
              </div>
            )}
          </div>

          {/* Link Expiry Selector */}
          <div className="kyc-link-form-group">
            <label className="kyc-link-form-label" htmlFor="kyc-expiry-select">
              Link Expiry Window
            </label>
            <div style={{ position: 'relative' }}>
              <select
                id="kyc-expiry-select"
                className="form-select"
                value={expiry}
                onChange={e => handleExpiryChange(e.target.value)}
                style={{ width: '100%', fontSize: 13, height: 38 }}
                disabled={isLoadingLink}
              >
                <option value="24h">24 Hours (High Security)</option>
                <option value="48h">48 Hours (Recommended)</option>
                <option value="72h">72 Hours (Extended)</option>
              </select>
            </div>
          </div>

          {/* Generated Customer KYC Link Box — Displays and copies ONLY real backend link */}
          <div className="kyc-link-form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="kyc-link-form-label">Secure Verification Link</label>
              {secureLink && !isLoadingLink && (
                <span style={{ fontSize: 11, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Shield size={11} /> 256-bit Encrypted
                </span>
              )}
            </div>
            <div className="kyc-link-url-box" style={{ minHeight: 42, display: 'flex', alignItems: 'center' }}>
              {isLoadingLink ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Requesting cryptographically secure link from server...</span>
                </div>
              ) : secureLink ? (
                <>
                  <span
                    className="kyc-link-url-text"
                    title={secureLink}
                    style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 12 }}
                  >
                    {secureLink}
                  </span>
                  <button
                    type="button"
                    className="kyc-link-copy-btn"
                    onClick={handleCopyLink}
                    title="Copy secure link to clipboard"
                  >
                    {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontSize: 12, color: '#dc2626' }}>
                    {linkError || 'No secure link returned by backend.'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', fontSize: 11, height: 26, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={() => fetchOrCreateSecureLink(expiry, true)}
                  >
                    <RefreshCw size={11} /> Retry
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Error Alert Box with Error Styling */}
          {errorMessage && (
            <div
              className="kyc-link-error-alert"
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #f87171',
                borderRadius: 8,
                padding: '12px 14px',
                color: '#991b1b',
                fontSize: 13,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginTop: 14,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1, color: '#dc2626' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: 2 }}>KYC Link Delivery Failed</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="kyc-link-modal-footer">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              ...(selectedChannel === 'whatsapp' ? { backgroundColor: '#10b981', borderColor: '#10b981', color: '#ffffff' } : {})
            }}
            onClick={handleSendLink}
            disabled={isSending || isLoadingLink}
          >
            {isSending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : selectedChannel === 'whatsapp' ? (
              <MessageSquare size={13} />
            ) : selectedChannel === 'email' ? (
              <Mail size={13} />
            ) : (
              <Send size={13} />
            )}

            {isSending
              ? 'Sending...'
              : selectedChannel === 'whatsapp'
              ? 'Send via WhatsApp Web →'
              : selectedChannel === 'email'
              ? 'Send Real-Time Email'
              : 'Send via SMS →'}
          </button>
        </div>
      </div>
    </div>
  );
};
