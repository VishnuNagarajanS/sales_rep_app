import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  AlertTriangle,
  User,
  ShieldCheck,
  CreditCard,
  Building,
  FileText,
  FileCheck,
  Camera,
  Eye,
  Check,
  Clock,
  Sparkles,
  Smartphone,
  Mail,
  Send,
} from 'lucide-react';
import { Deal } from '../../../types';
import { getKycReviewData } from '../../../services/kycService';
import './KycLinkComponents.css';

interface KycReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal | null;
  onShowToast: (msg: string) => void;
}

export const KycReviewDrawer: React.FC<KycReviewDrawerProps> = ({
  isOpen,
  onClose,
  deal,
  onShowToast,
}) => {
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [correctionNote, setCorrectionNote] = useState<string>(
    'Please re-upload a clearer image of your PAN card and ensure the name matches your Aadhaar.'
  );

  if (!isOpen || !deal) return null;

  const mockReviewData = getKycReviewData(deal) || {
    refId: `KYC-${(deal.id || '').slice(-6).toUpperCase()}`,
    submissionDate: 'Pending Submission',
    ipAddress: 'N/A',
    userAgent: 'N/A',
    basicDetails: {
      investorName: deal.customerName,
      phone: deal.phone || '',
      email: deal.email || '',
      gender: 'N/A',
      investorType: deal.investorType || 'Individual',
      residentType: 'Resident Indian',
      occupation: 'N/A',
    },
    identityDetails: {
      panNumber: 'Not provided',
      nameAsPerPan: deal.customerName.toUpperCase(),
      aadhaarNumber: 'Not provided',
      fatherName: 'Not provided',
      dob: 'Not provided',
      address: 'Not provided',
      courierAddress: 'Not provided',
    },
    bankDetails: {
      accountHolderName: deal.customerName,
      bankName: 'Not provided',
      accountNumber: 'Not provided',
      accountType: 'Savings Account',
      ifscCode: 'Not provided',
      branchName: 'Not provided',
    },
    dematDetails: {
      hasNoDemat: true,
      dematAccountNumber: 'Not provided',
      dematDepository: 'N/A',
      dematDpId: 'N/A',
      dematClientId: 'N/A',
    },
    nominees: [],
    documents: [],
    consent: {
      acceptedAt: 'Pending',
      termsVersion: 'N/A',
      ipHash: 'N/A',
    },
    liveness: {
      capturedAt: 'N/A',
      matchScore: 'N/A',
      livenessStatus: 'Pending Verification',
    },
    providerVerifications: [],
  };

  const handleApprove = () => {
    // TODO(logic): Trigger backend API to approve submission and advance deal stage
    onShowToast(`KYC Approved for ${deal.customerName} (demo)`);
    onClose();
  };

  const handleSendCorrection = () => {
    // TODO(logic): Dispatch notification/SMS/WhatsApp link for document re-upload
    onShowToast(`Correction request sent to ${deal.customerName} (demo)`);
    setShowCorrectionModal(false);
    onClose();
  };

  const handleViewDoc = (docName: string) => {
    // TODO(logic): Open document preview lightbox
    onShowToast(`Viewing ${docName} (demo)`);
  };

  return (
    <div
      className="kyc-link-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="kyc-link-drawer"
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative' }}
      >
        {/* Header */}
        <div className="kyc-link-drawer-header">
          <div className="kyc-link-drawer-title-area">
            <h2 className="kyc-link-drawer-title">
              <User size={20} color="var(--primary-600, #2563eb)" />
              {deal.customerName}
            </h2>
            <div className="kyc-link-drawer-ref">
              <span>{mockReviewData.refId}</span>
              <span>•</span>
              <span>Submitted {mockReviewData.submissionDate}</span>
            </div>
          </div>
          <button
            type="button"
            className="kyc-link-modal-close-btn"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="kyc-link-drawer-body">
          {/* Provider Verification Live Checks */}
          <div className="kyc-link-section-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title" style={{ color: '#059669' }}>
                <ShieldCheck size={16} /> Automated Provider Verifications
              </h4>
              <span className="kyc-link-badge kyc-link-badge-verified">4/4 Checks Passed</span>
            </div>
            <div className="kyc-link-providers-grid">
              {mockReviewData.providerVerifications.map((pv, idx) => (
                <div key={idx} className="kyc-link-provider-item">
                  <div>
                    <div className="kyc-link-provider-name">{pv.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pv.detail}</div>
                  </div>
                  <span
                    className="kyc-link-badge kyc-link-badge-verified"
                    style={{ padding: '2px 7px', fontSize: 10 }}
                  >
                    <Check size={11} /> Pass
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 1: Basic Details */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <User size={15} /> 1. Basic Details
              </h4>
            </div>
            <div className="kyc-link-field-grid">
              <div>
                <div className="kyc-link-field-label">Full Name</div>
                <div className="kyc-link-field-val">{mockReviewData.basicDetails.investorName}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Mobile Number</div>
                <div className="kyc-link-field-val">{mockReviewData.basicDetails.phone}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Email Address</div>
                <div className="kyc-link-field-val">{mockReviewData.basicDetails.email}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Gender</div>
                <div className="kyc-link-field-val">{mockReviewData.basicDetails.gender}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Investor Category</div>
                <div className="kyc-link-field-val">{mockReviewData.basicDetails.investorType}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Residential Status</div>
                <div className="kyc-link-field-val">{mockReviewData.basicDetails.residentType}</div>
              </div>
              <div className="kyc-link-field-full">
                <div className="kyc-link-field-label">Occupation / Source of Wealth</div>
                <div className="kyc-link-field-val">{mockReviewData.basicDetails.occupation}</div>
              </div>
            </div>
          </div>

          {/* Section 2: Identity Details */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <FileCheck size={15} /> 2. Identity &amp; Address
              </h4>
            </div>
            <div className="kyc-link-field-grid">
              <div>
                <div className="kyc-link-field-label">Permanent Account Number (PAN)</div>
                <div className="kyc-link-field-val kyc-link-field-val-masked" style={{ color: '#0284c7' }}>
                  {mockReviewData.identityDetails.panNumber}
                </div>
              </div>
              <div>
                <div className="kyc-link-field-label">Name as per PAN</div>
                <div className="kyc-link-field-val">{mockReviewData.identityDetails.nameAsPerPan}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Aadhaar (Masked UID)</div>
                <div className="kyc-link-field-val kyc-link-field-val-masked" style={{ color: '#0284c7' }}>
                  {mockReviewData.identityDetails.aadhaarNumber}
                </div>
              </div>
              <div>
                <div className="kyc-link-field-label">Father's Name</div>
                <div className="kyc-link-field-val">{mockReviewData.identityDetails.fatherName}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Date of Birth</div>
                <div className="kyc-link-field-val">{mockReviewData.identityDetails.dob}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Courier Address</div>
                <div className="kyc-link-field-val">{mockReviewData.identityDetails.courierAddress}</div>
              </div>
              <div className="kyc-link-field-full">
                <div className="kyc-link-field-label">Permanent Address</div>
                <div className="kyc-link-field-val">{mockReviewData.identityDetails.address}</div>
              </div>
            </div>
          </div>

          {/* Section 3: Bank Details */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <CreditCard size={15} /> 3. Bank Account
              </h4>
            </div>
            <div className="kyc-link-field-grid">
              <div>
                <div className="kyc-link-field-label">Bank Name</div>
                <div className="kyc-link-field-val">{mockReviewData.bankDetails.bankName}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Account Number (Masked)</div>
                <div className="kyc-link-field-val kyc-link-field-val-masked" style={{ color: '#059669' }}>
                  {mockReviewData.bankDetails.accountNumber}
                </div>
              </div>
              <div>
                <div className="kyc-link-field-label">Account Type</div>
                <div className="kyc-link-field-val">{mockReviewData.bankDetails.accountType}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">IFSC Code</div>
                <div className="kyc-link-field-val">{mockReviewData.bankDetails.ifscCode}</div>
              </div>
              <div className="kyc-link-field-full">
                <div className="kyc-link-field-label">Branch</div>
                <div className="kyc-link-field-val">{mockReviewData.bankDetails.branchName}</div>
              </div>
            </div>
          </div>

          {/* Section 4: Demat Details */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <Building size={15} /> 4. Demat Account
              </h4>
            </div>
            <div className="kyc-link-field-grid">
              <div>
                <div className="kyc-link-field-label">Depository</div>
                <div className="kyc-link-field-val">{mockReviewData.dematDetails.dematDepository}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Demat Account Number</div>
                <div className="kyc-link-field-val kyc-link-field-val-masked">
                  {mockReviewData.dematDetails.dematAccountNumber}
                </div>
              </div>
              <div>
                <div className="kyc-link-field-label">DP ID</div>
                <div className="kyc-link-field-val">{mockReviewData.dematDetails.dematDpId}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Client ID</div>
                <div className="kyc-link-field-val">{mockReviewData.dematDetails.dematClientId}</div>
              </div>
            </div>
          </div>

          {/* Section 5: Nominees */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <User size={15} /> 5. Nominees
              </h4>
            </div>
            {mockReviewData.nominees.map((nom, idx) => (
              <div key={idx} className="kyc-link-field-grid">
                <div>
                  <div className="kyc-link-field-label">Nominee Name</div>
                  <div className="kyc-link-field-val">{nom.name}</div>
                </div>
                <div>
                  <div className="kyc-link-field-label">Relationship</div>
                  <div className="kyc-link-field-val">{nom.relationship}</div>
                </div>
                <div>
                  <div className="kyc-link-field-label">Date of Birth</div>
                  <div className="kyc-link-field-val">{nom.dob}</div>
                </div>
                <div>
                  <div className="kyc-link-field-label">Allocation Share</div>
                  <div className="kyc-link-field-val" style={{ color: '#059669' }}>
                    {nom.allocationPercentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Section 6: Documents */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <FileText size={15} /> 6. Uploaded Documents
              </h4>
            </div>
            <div className="kyc-link-doc-list">
              {mockReviewData.documents.map(doc => (
                <div key={doc.id} className="kyc-link-doc-row">
                  <div className="kyc-link-doc-info">
                    <FileText size={16} color="var(--primary-600)" />
                    <div>
                      <div className="kyc-link-doc-name">{doc.name}</div>
                      <div className="kyc-link-doc-size">{doc.size} • Verified Format</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: '4px 10px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    onClick={() => handleViewDoc(doc.name)}
                  >
                    <Eye size={12} /> View
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 7: Liveness Check */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <Camera size={15} /> 7. Liveness Verification
              </h4>
              <span className="kyc-link-badge kyc-link-badge-verified">
                <Check size={11} /> {mockReviewData.liveness.matchScore} Match
              </span>
            </div>
            <div className="kyc-link-liveness-container">
              <div className="kyc-link-liveness-thumb">
                <Camera size={26} />
                <span
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    fontSize: 8,
                    fontWeight: 800,
                    background: '#10b981',
                    color: '#fff',
                    padding: '1px 4px',
                    borderRadius: 3,
                  }}
                >
                  LIVE
                </span>
              </div>
              <div className="kyc-link-liveness-info">
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {mockReviewData.liveness.livenessStatus}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Captured on: {mockReviewData.liveness.capturedAt}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Device: {mockReviewData.userAgent}
                </div>
              </div>
            </div>
          </div>

          {/* Section 8: Digital Consent & Timestamp */}
          <div className="kyc-link-section-card">
            <div className="kyc-link-section-header">
              <h4 className="kyc-link-section-title">
                <ShieldCheck size={15} /> 8. Electronic Consent &amp; Audit Trail
              </h4>
            </div>
            <div className="kyc-link-field-grid">
              <div>
                <div className="kyc-link-field-label">Consent Timestamp</div>
                <div className="kyc-link-field-val">{mockReviewData.consent.acceptedAt}</div>
              </div>
              <div>
                <div className="kyc-link-field-label">Agreement Policy Version</div>
                <div className="kyc-link-field-val">{mockReviewData.consent.termsVersion}</div>
              </div>
              <div className="kyc-link-field-full">
                <div className="kyc-link-field-label">IP &amp; Geolocation Trail</div>
                <div className="kyc-link-field-val" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {mockReviewData.consent.ipHash}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="kyc-link-drawer-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowCorrectionModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <AlertTriangle size={14} color="#f59e0b" /> Request Correction
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#10b981', borderColor: '#10b981' }}
            onClick={handleApprove}
          >
            <CheckCircle size={15} /> Approve KYC
          </button>
        </div>

        {/* Sub-modal for Request Correction */}
        {showCorrectionModal && (
          <div
            className="kyc-link-correction-modal"
            onClick={() => setShowCorrectionModal(false)}
          >
            <div
              className="kyc-link-correction-box"
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} color="#ea580c" /> Request Correction
                </h4>
                <button
                  type="button"
                  className="kyc-link-modal-close-btn"
                  onClick={() => setShowCorrectionModal(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                Explain to <strong>{deal.customerName}</strong> what needs to be updated or re-uploaded. An SMS &amp; WhatsApp link will be dispatched automatically.
              </p>
              <textarea
                className="kyc-link-textarea"
                value={correctionNote}
                onChange={e => setCorrectionNote(e.target.value)}
                rows={4}
                placeholder="Enter specific correction instructions..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCorrectionModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={handleSendCorrection}
                >
                  <Send size={13} /> Send Correction Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
