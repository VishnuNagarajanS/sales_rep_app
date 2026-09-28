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
} from 'lucide-react';
import { Deal } from '../../../types';
import './KycLinkComponents.css';

interface SendKycLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal | null;
  onShowToast: (msg: string) => void;
}

export const SendKycLinkModal: React.FC<SendKycLinkModalProps> = ({
  isOpen,
  onClose,
  deal,
  onShowToast,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [expiry, setExpiry] = useState<string>('48h');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen || !deal) return null;

  // TODO(logic): In production, generate this unique token via backend API (/api/kyc/generate-link)
  const mockToken = `tok_${(deal.id || 'demo').replace(/[^a-zA-Z0-9]/g, '').slice(-8)}_${deal.customerName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)}`;
  const generatedLink = `${window.location.origin}/kyc/${mockToken}`;

  const handleCopyLink = () => {
    // TODO(logic): Replace with navigator.clipboard or native share API in production
    navigator.clipboard?.writeText(generatedLink);
    setCopied(true);
    onShowToast('Link copied to clipboard (demo)');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendLink = () => {
    // TODO(logic): Trigger backend dispatch to selected channel (WhatsApp / SMS / Email)
    onShowToast(`Link sent to ${deal.customerName} via ${selectedChannel.toUpperCase()} (demo)`);
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
            Send Customer KYC Link
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
              <span className="kyc-link-readonly-val">{deal.customerName || '—'}</span>
            </div>
            <div className="kyc-link-readonly-item">
              <span className="kyc-link-readonly-label">Phone</span>
              <span className="kyc-link-readonly-val">{deal.phone || '—'}</span>
            </div>
            <div className="kyc-link-readonly-item" style={{ gridColumn: '1 / -1' }}>
              <span className="kyc-link-readonly-label">Email Address</span>
              <span className="kyc-link-readonly-val">{deal.email || '—'}</span>
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={handleSendLink}
          >
            <Send size={13} /> Send KYC Link
          </button>
        </div>
      </div>
    </div>
  );
};
