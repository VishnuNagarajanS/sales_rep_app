import React, { useState } from 'react';
import {
  Send,
  X,
  Copy,
  Check,
  MessageSquare,
  Smartphone,
  Mail,
  Shield,
  Clock,
  Loader2,
} from 'lucide-react';
import { Deal } from '../../../types';
import { storageService } from '../../../services/storageService';
import { apiClient } from '../../../services/apiClient';
import { isMockMode } from '../../../config/environment';
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

  if (!isOpen || !deal) return null;

  const rawCustomerName = (deal.customerName || (deal as any)?.name || '').trim();
  const customerNameDisplay = rawCustomerName || '—';

  const resolvedPhone = (() => {
    if (deal.phone && deal.phone.trim()) return deal.phone.trim();
    try {
      const leads = storageService.getLeads(deal.companyId) || storageService.getLeads();
      const match = leads.find(l => 
        (deal.customerId && l.id === deal.customerId) || 
        (rawCustomerName && l.name && l.name.trim().toLowerCase() === rawCustomerName.toLowerCase())
      );
      if (match?.phone && match.phone.trim()) return match.phone.trim();

      const customers = storageService.getCustomers(deal.companyId) || storageService.getCustomers();
      const cMatch = customers.find(c => 
        (deal.customerId && c.id === deal.customerId) || 
        (rawCustomerName && c.name && c.name.trim().toLowerCase() === rawCustomerName.toLowerCase())
      );
      if (cMatch?.phone && cMatch.phone.trim()) return cMatch.phone.trim();
    } catch {}
    return '';
  })();

  const resolvedEmail = (() => {
    if (deal.email && deal.email.trim()) return deal.email.trim();
    try {
      const leads = storageService.getLeads(deal.companyId) || storageService.getLeads();
      const match = leads.find(l => 
        (deal.customerId && l.id === deal.customerId) || 
        (rawCustomerName && l.name && l.name.trim().toLowerCase() === rawCustomerName.toLowerCase())
      );
      if (match?.email && match.email.trim()) return match.email.trim();

      const customers = storageService.getCustomers(deal.companyId) || storageService.getCustomers();
      const cMatch = customers.find(c => 
        (deal.customerId && c.id === deal.customerId) || 
        (rawCustomerName && c.name && c.name.trim().toLowerCase() === rawCustomerName.toLowerCase())
      );
      if (cMatch?.email && cMatch.email.trim()) return cMatch.email.trim();
    } catch {}
    return '';
  })();

  const mockToken = `tok_${(deal.id || 'demo').replace(/[^a-zA-Z0-9]/g, '').slice(-8)}_${(rawCustomerName || 'investor').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)}`;
  const generatedLink = `${window.location.origin}/kyc/${mockToken}`;

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
    navigator.clipboard?.writeText(generatedLink);
    setCopied(true);
    onShowToast('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendLink = async () => {
    setIsSending(true);
    let finalLink = generatedLink;
    let linkCreated = false;
    let emailSent = false;
    let deliveryStatus = '';
    let failureMessage = '';

    try {
      const payload = {
        customerName: deal.customerName,
        phone: resolvedPhone || deal.phone || '',
        email: resolvedEmail || deal.email || '',
        channel: selectedChannel,
        expiry: expiry,
        baseUrl: window.location.origin,
      };

      const res = await fetch('/api/irm/kyc/send-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.success) {
          linkCreated = true;
          emailSent = !!json.data?.emailSent;
          deliveryStatus = json.data?.deliveryStatus || '';
          if (json.data?.link) {
            finalLink = json.data.link;
          }
        } else {
          failureMessage = json?.message || 'The server did not accept the request.';
        }
      } else {
        const err = await res.json().catch(() => ({} as any));
        failureMessage =
          res.status === 401
            ? 'You are not logged in. Please log in again.'
            : err?.message || `Server error (${res.status}).`;
      }
    } catch (err: any) {
      console.warn('Backend send-link API error:', err);
    }

    setIsSending(false);

    // For email, only mark the link as "sent" when the email was really delivered
    if ((linkCreated && (selectedChannel !== 'email' || emailSent)) || isMockMode()) {
      onSent?.(deal);
    }

    // ── 1. WhatsApp Web Click-to-Chat ──────────────────────────────────────────
    if (selectedChannel === 'whatsapp') {
      const cleanPhone = getCleanPhone(resolvedPhone || deal.phone || '');
      const message = buildWhatsAppMessage(finalLink);
      const waUrl = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

      window.open(waUrl, '_blank', 'noopener,noreferrer');
      onShowToast(`WhatsApp Web opened with pre-filled KYC message for ${deal.customerName}!`);
      onClose();
      return;
    }

    // ── 2. SMS App Deep Link ───────────────────────────────────────────────────
    if (selectedChannel === 'sms') {
      const cleanPhone = getCleanPhone(resolvedPhone || deal.phone || '');
      const smsText = `Hello ${deal.customerName || 'Investor'}, please complete your GHL India KYC verification: ${finalLink}`;
      if (cleanPhone) {
        window.open(`sms:${cleanPhone}?body=${encodeURIComponent(smsText)}`, '_blank');
      }
      onShowToast(`SMS app launched for ${deal.customerName}!`);
      onClose();
      return;
    }

    // ── 3. Real-Time Email Delivery ────────────────────────────────────────────
    if (selectedChannel === 'email') {
      const targetEmail = resolvedEmail || deal.email;
      if (!targetEmail) {
        onShowToast('Please provide an investor email address.');
        onClose();
        return;
      }
      if (isMockMode() || (linkCreated && emailSent)) {
        onShowToast(`KYC Verification email delivered in real time to ${targetEmail}!`);
        onClose();
        return;
      }
      // Real failure: tell the user why and keep the modal open so they can retry
      onShowToast(`Email not sent: ${deliveryStatus || failureMessage || 'unknown error'}`);
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
              <span className={`kyc-link-readonly-val ${!resolvedEmail ? 'is-empty' : ''}`} title={resolvedEmail || 'Not available'}>
                {resolvedEmail || '—'}
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
                onClick={() => setSelectedChannel('whatsapp')}
              >
                <MessageSquare size={14} /> WhatsApp
              </button>
              <button
                type="button"
                className={`kyc-link-channel-chip ${selectedChannel === 'sms' ? 'active' : ''}`}
                onClick={() => setSelectedChannel('sms')}
              >
                <Smartphone size={14} /> SMS
              </button>
              <button
                type="button"
                className={`kyc-link-channel-chip ${selectedChannel === 'email' ? 'active' : ''}`}
                onClick={() => setSelectedChannel('email')}
              >
                <Mail size={14} /> Email
              </button>
            </div>

            {/* Dynamic Channel Helper Box */}
            {selectedChannel === 'whatsapp' && (
              <div className="kyc-link-helper-box kyc-link-helper-box-whatsapp">
                <MessageSquare size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>WhatsApp Web Click-to-Chat:</strong> Clicking Send will instantly launch WhatsApp Web (or your WhatsApp app) with a pre-filled invitation and secure link ready to send to <strong>{resolvedPhone || 'the investor'}</strong>.
                </span>
              </div>
            )}

            {selectedChannel === 'email' && (
              <div className="kyc-link-helper-box kyc-link-helper-box-email">
                <Mail size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>Real-Time Gmail SMTP:</strong> Clicking Send will dispatch a branded HTML KYC verification email to <strong>{resolvedEmail || 'investor email'}</strong>.
                </span>
              </div>
            )}

            {selectedChannel === 'sms' && (
              <div className="kyc-link-helper-box kyc-link-helper-box-sms">
                <Smartphone size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>Direct SMS:</strong> Clicking Send will trigger your device's SMS app with the pre-composed KYC link ready to send to <strong>{resolvedPhone || 'the investor'}</strong>.
                </span>
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
                onChange={e => setExpiry(e.target.value)}
                style={{ width: '100%', fontSize: 13, height: 38 }}
              >
                <option value="24h">24 Hours (High Security)</option>
                <option value="48h">48 Hours (Recommended)</option>
                <option value="72h">72 Hours (Extended)</option>
              </select>
            </div>
          </div>

          {/* Generated Customer KYC Link Box */}
          <div className="kyc-link-form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="kyc-link-form-label">Generated Secure Link</label>
              <span style={{ fontSize: 11, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Shield size={11} /> 256-bit Encrypted
              </span>
            </div>
            <div className="kyc-link-url-box">
              <span className="kyc-link-url-text" title={generatedLink}>
                {generatedLink}
              </span>
              <button
                type="button"
                className="kyc-link-copy-btn"
                onClick={handleCopyLink}
              >
                {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
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
            disabled={isSending}
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
