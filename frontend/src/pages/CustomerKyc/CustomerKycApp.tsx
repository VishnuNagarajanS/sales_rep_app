import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  UploadCloud,
  FileCheck,
  RefreshCw,
  Camera,
  Check,
  Clock,
  Sparkles,
  Phone,
  Mail,
  User,
  Building,
  CreditCard,
  FileText,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import './CustomerKycApp.css';

type ScreenId =
  | 'loading'
  | 'invalid'
  | 'otp'
  | 'wizard'
  | 'documents'
  | 'consent'
  | 'liveness'
  | 'submitted';

type WizardStep = 1 | 2 | 3 | 4 | 5;

export const CustomerKycApp: React.FC = () => {
  // Screen switcher state
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('otp');
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  // Screen 3: OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(['4', '9', '', '', '', '']);

  // Screen 4: Wizard sample fields state (matching existing KYC field names)
  const [formData, setFormData] = useState({
    // Step 1: Basic Details
    investorName: 'Aditya Narayan Sen',
    phone: '+91 98450 82914',
    email: 'aditya.sen@nexuscapital.com',
    gender: 'Male',
    investorType: 'Individual / HNI',
    residentType: 'Resident Indian',
    occupation: 'Technology Executive / Founder',

    // Step 2: Identity Details
    panNumber: 'ABCDE1234F',
    nameAsPerPan: 'ADITYA NARAYAN SEN',
    aadhaarNumber: '5842 9012 3419',
    fatherName: 'Late Dr. R. K. Sen',
    dob: '1984-05-14',
    address: 'Flat 402, Oakwood Palms, Outer Ring Road, Bellandur, Bengaluru',
    pincode: '560103',

    // Step 3: Bank Details
    accountHolderName: 'Aditya Narayan Sen',
    bankName: 'HDFC Bank Ltd',
    accountNumber: '50100492817264',
    ifscCode: 'HDFC0000240',
    accountType: 'Savings Account',

    // Step 4: Demat Details
    hasNoDemat: false,
    dematDepository: 'CDSL',
    dematAccountNumber: '1208160004918273',
    dematDpId: '12081600',
    dematClientId: '04918273',

    // Step 5: Nominee Details
    nomineeName: 'Priyanka Sen',
    nomineeRelationship: 'Spouse',
    nomineeDob: '1987-11-20',
    nomineeAllocation: 100,
    nomineeAddress: 'Same as permanent residential address',
  });

  // Screen 6: Consent state (drives button disabled state per requirement)
  const [hasAgreedConsent, setHasAgreedConsent] = useState<boolean>(false);

  // Screen 7: Liveness mock state
  const [livenessState, setLivenessState] = useState<'idle' | 'capturing' | 'captured'>('idle');

  // Helper to calculate progress percentage for the header
  const getProgressPercentage = (): number => {
    switch (currentScreen) {
      case 'loading':
      case 'invalid':
        return 0;
      case 'otp':
        return 10;
      case 'wizard':
        return 10 + wizardStep * 10; // 20% to 60%
      case 'documents':
        return 75;
      case 'consent':
        return 88;
      case 'liveness':
        return 95;
      case 'submitted':
        return 100;
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    // TODO(logic): Auto-focus next input and submit once 6 digits are filled
    const clean = val.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = clean;
    setOtpDigits(updated);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="ckyc-root">
      <div className="ckyc-container">
        {/* Header with GHL Logo and Security Badge */}
        <header className="ckyc-header">
          <img
            src="/ghl-logo.png"
            alt="GHL India Ventures"
            className="ckyc-logo"
            onError={e => {
              // Fallback text if logo path fails
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="ckyc-badge-secure">
            <Lock size={12} /> SEBI Regulated • 256-bit Bank Grade Security
          </div>
        </header>

        {/* Progress Card (hidden on loading and invalid link screens) */}
        {currentScreen !== 'loading' && currentScreen !== 'invalid' && (
          <div className="ckyc-progress-card">
            <div className="ckyc-progress-header">
              <span className="ckyc-progress-label">
                {currentScreen === 'submitted'
                  ? 'Verification Complete'
                  : currentScreen === 'wizard'
                    ? `Step ${wizardStep} of 5: IRM Profile Form`
                    : currentScreen === 'documents'
                      ? 'Step 6: Document Uploads'
                      : currentScreen === 'consent'
                        ? 'Step 7: Regulatory Consent'
                        : currentScreen === 'liveness'
                          ? 'Step 8: AI Liveness Check'
                          : 'Identity Verification'}
              </span>
              <span className="ckyc-progress-pct">{getProgressPercentage()}%</span>
            </div>
            <div className="ckyc-progress-track">
              <div
                className="ckyc-progress-fill"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            SCREEN 1: LOADING (SKELETON)
           ──────────────────────────────────────────────────────────────── */}
        {currentScreen === 'loading' && (
          <div className="ckyc-card">
            <div className="ckyc-skeleton-line" style={{ height: 26, width: '60%' }} />
            <div className="ckyc-skeleton-line" style={{ height: 16, width: '90%' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
              <div className="ckyc-skeleton-line" style={{ height: 48, width: '100%' }} />
              <div className="ckyc-skeleton-line" style={{ height: 48, width: '100%' }} />
              <div className="ckyc-skeleton-line" style={{ height: 48, width: '100%' }} />
            </div>
            <div className="ckyc-skeleton-line" style={{ height: 48, width: '100%', marginTop: 16 }} />
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            SCREEN 2: INVALID / EXPIRED LINK
           ──────────────────────────────────────────────────────────────── */}
        {currentScreen === 'invalid' && (
          <div className="ckyc-card">
            <div className="ckyc-state-banner">
              <div className="ckyc-state-icon-wrap ckyc-state-icon-error">
                <AlertCircle size={36} />
              </div>
              <h2 className="ckyc-card-title">This KYC Link Has Expired</h2>
              <p className="ckyc-card-desc">
                For security reasons, investor verification links expire after 48 hours or once revoked by your Relationship Manager.
              </p>
              <div style={{ width: '100%', maxWidth: 360, marginTop: 8 }}>
                <button
                  type="button"
                  className="ckyc-btn-primary"
                  onClick={() => alert('Support request submitted (demo)')}
                >
                  <Phone size={16} /> Contact Dedicated IRM
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            SCREEN 3: OTP VERIFICATION
           ──────────────────────────────────────────────────────────────── */}
        {currentScreen === 'otp' && (
          <div className="ckyc-card">
            <div className="ckyc-card-title-group">
              <h2 className="ckyc-card-title">Verify Your Mobile Number</h2>
              <p className="ckyc-card-desc">
                We've sent a 6-digit one-time passcode to <strong>+91 98••••••14</strong> linked to your PAN record.
              </p>
            </div>

            <div className="ckyc-otp-row">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="ckyc-otp-box"
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  aria-label={`OTP Digit ${idx + 1}`}
                />
              ))}
            </div>

            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ckyc-text-muted)' }}>
              Didn't receive code?{' '}
              <button
                type="button"
                className="ckyc-resend-link"
                onClick={() => alert('New OTP sent via SMS (demo)')}
              >
                Resend OTP
              </button>
            </div>

            <button
              type="button"
              className="ckyc-btn-primary"
              onClick={() => {
                // TODO(logic): Validate OTP with backend
                setCurrentScreen('wizard');
                setWizardStep(1);
              }}
            >
              Verify &amp; Proceed <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            SCREEN 4: 5-STEP WIZARD
           ──────────────────────────────────────────────────────────────── */}
        {currentScreen === 'wizard' && (
          <div className="ckyc-card">
            {/* Stepper with 5 Nodes */}
            <div className="ckyc-stepper">
              {[
                { step: 1, label: 'Basic' },
                { step: 2, label: 'Identity' },
                { step: 3, label: 'Bank' },
                { step: 4, label: 'Demat' },
                { step: 5, label: 'Nominee' },
              ].map(s => (
                <div
                  key={s.step}
                  className={`ckyc-step-node ${
                    wizardStep === s.step ? 'active' : wizardStep > s.step ? 'completed' : ''
                  }`}
                  onClick={() => setWizardStep(s.step as WizardStep)}
                >
                  <div className="ckyc-step-circle">
                    {wizardStep > s.step ? <Check size={14} /> : s.step}
                  </div>
                  <span className="ckyc-step-title">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Step 1: Basic Details */}
            {wizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="ckyc-card-title-group">
                  <h3 className="ckyc-card-title">1. Basic Investor Details</h3>
                  <p className="ckyc-card-desc">Confirm your personal profile details as per official records.</p>
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-name">Investor Full Name *</label>
                  <input
                    id="w-name"
                    type="text"
                    className="ckyc-input"
                    value={formData.investorName}
                    onChange={e => handleInputChange('investorName', e.target.value)}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-phone">Phone Number *</label>
                  <input
                    id="w-phone"
                    type="text"
                    className="ckyc-input"
                    value={formData.phone}
                    onChange={e => handleInputChange('phone', e.target.value)}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-email">Email Address *</label>
                  <input
                    id="w-email"
                    type="email"
                    className="ckyc-input"
                    value={formData.email}
                    onChange={e => handleInputChange('email', e.target.value)}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-gender">Gender</label>
                  <select
                    id="w-gender"
                    className="ckyc-input"
                    value={formData.gender}
                    onChange={e => handleInputChange('gender', e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-occ">Occupation / Source of Wealth</label>
                  <input
                    id="w-occ"
                    type="text"
                    className="ckyc-input"
                    value={formData.occupation}
                    onChange={e => handleInputChange('occupation', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Identity Details (Includes Sample Validation Error UI) */}
            {wizardStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="ckyc-card-title-group">
                  <h3 className="ckyc-card-title">2. Identity &amp; Tax Information</h3>
                  <p className="ckyc-card-desc">Permanent Account Number (PAN) and Aadhaar UID details.</p>
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-pan">Permanent Account Number (PAN) *</label>
                  <input
                    id="w-pan"
                    type="text"
                    className="ckyc-input"
                    value={formData.panNumber}
                    onChange={e => handleInputChange('panNumber', e.target.value.toUpperCase())}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-pan-name">Full Name as per PAN *</label>
                  <input
                    id="w-pan-name"
                    type="text"
                    className="ckyc-input"
                    value={formData.nameAsPerPan}
                    onChange={e => handleInputChange('nameAsPerPan', e.target.value)}
                  />
                </div>

                {/* Sample Validation Error Demonstrated Here */}
                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-aadhaar">
                    <span>Aadhaar Number (12 Digits) *</span>
                    <span style={{ fontSize: 11, color: 'var(--ckyc-error)' }}>Verification Required</span>
                  </label>
                  <input
                    id="w-aadhaar"
                    type="text"
                    className="ckyc-input ckyc-input-error"
                    value={formData.aadhaarNumber}
                    onChange={e => handleInputChange('aadhaarNumber', e.target.value)}
                  />
                  <div className="ckyc-error-msg">
                    <AlertCircle size={13} /> UID must match name on PAN exactly. Please verify digits.
                  </div>
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-dob">Date of Birth *</label>
                  <input
                    id="w-dob"
                    type="date"
                    className="ckyc-input"
                    value={formData.dob}
                    onChange={e => handleInputChange('dob', e.target.value)}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-addr">Permanent Address *</label>
                  <textarea
                    id="w-addr"
                    className="ckyc-input"
                    style={{ minHeight: 70, resize: 'vertical' }}
                    value={formData.address}
                    onChange={e => handleInputChange('address', e.target.value)}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-pin">PIN Code *</label>
                  <input
                    id="w-pin"
                    type="text"
                    className="ckyc-input"
                    value={formData.pincode}
                    onChange={e => handleInputChange('pincode', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Bank Details */}
            {wizardStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="ckyc-card-title-group">
                  <h3 className="ckyc-card-title">3. Investment Bank Account</h3>
                  <p className="ckyc-card-desc">All capital transfers &amp; redemption yields will be credited here.</p>
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-bank-name">Bank Name *</label>
                  <input
                    id="w-bank-name"
                    type="text"
                    className="ckyc-input"
                    value={formData.bankName}
                    onChange={e => handleInputChange('bankName', e.target.value)}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-acc-no">Bank Account Number *</label>
                  <input
                    id="w-acc-no"
                    type="text"
                    className="ckyc-input"
                    value={formData.accountNumber}
                    onChange={e => handleInputChange('accountNumber', e.target.value)}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-ifsc">IFSC Code *</label>
                  <input
                    id="w-ifsc"
                    type="text"
                    className="ckyc-input"
                    value={formData.ifscCode}
                    onChange={e => handleInputChange('ifscCode', e.target.value.toUpperCase())}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-acc-type">Account Type</label>
                  <select
                    id="w-acc-type"
                    className="ckyc-input"
                    value={formData.accountType}
                    onChange={e => handleInputChange('accountType', e.target.value)}
                  >
                    <option value="Savings Account">Savings Account</option>
                    <option value="Current Account">Current Account</option>
                    <option value="NRE Account">NRE Account</option>
                    <option value="NRO Account">NRO Account</option>
                  </select>
                </div>
              </div>
            )}

            {/* Step 4: Demat Details */}
            {wizardStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="ckyc-card-title-group">
                  <h3 className="ckyc-card-title">4. Demat Account</h3>
                  <p className="ckyc-card-desc">For holding AIF unit certificates in dematerialized form.</p>
                </div>

                <label className="ckyc-checkbox-row">
                  <input
                    type="checkbox"
                    className="ckyc-checkbox"
                    checked={formData.hasNoDemat}
                    onChange={e => handleInputChange('hasNoDemat', e.target.checked)}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    I do not currently have an active Demat Account (Hold in Physical Statement format)
                  </span>
                </label>

                {!formData.hasNoDemat && (
                  <>
                    <div className="ckyc-form-group">
                      <label className="ckyc-form-label" htmlFor="w-depository">Depository *</label>
                      <select
                        id="w-depository"
                        className="ckyc-input"
                        value={formData.dematDepository}
                        onChange={e => handleInputChange('dematDepository', e.target.value)}
                      >
                        <option value="CDSL">CDSL (Central Depository Services Ltd)</option>
                        <option value="NSDL">NSDL (National Securities Depository Ltd)</option>
                      </select>
                    </div>

                    <div className="ckyc-form-group">
                      <label className="ckyc-form-label" htmlFor="w-demat-num">16-Digit Demat Beneficiary ID *</label>
                      <input
                        id="w-demat-num"
                        type="text"
                        className="ckyc-input"
                        value={formData.dematAccountNumber}
                        onChange={e => handleInputChange('dematAccountNumber', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 5: Nominee Details */}
            {wizardStep === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="ckyc-card-title-group">
                  <h3 className="ckyc-card-title">5. Primary Nominee</h3>
                  <p className="ckyc-card-desc">SEBI mandate requires at least one registered legal nominee.</p>
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-nom-name">Nominee Name *</label>
                  <input
                    id="w-nom-name"
                    type="text"
                    className="ckyc-input"
                    value={formData.nomineeName}
                    onChange={e => handleInputChange('nomineeName', e.target.value)}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-nom-rel">Relationship *</label>
                  <select
                    id="w-nom-rel"
                    className="ckyc-input"
                    value={formData.nomineeRelationship}
                    onChange={e => handleInputChange('nomineeRelationship', e.target.value)}
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                  </select>
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-nom-dob">Date of Birth / Age *</label>
                  <input
                    id="w-nom-dob"
                    type="date"
                    className="ckyc-input"
                    value={formData.nomineeDob}
                    onChange={e => handleInputChange('nomineeDob', e.target.value)}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-nom-share">Allocation Percentage (%)</label>
                  <input
                    id="w-nom-share"
                    type="number"
                    className="ckyc-input"
                    value={formData.nomineeAllocation}
                    onChange={e => handleInputChange('nomineeAllocation', Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            {/* Wizard Navigation Buttons */}
            <div className="ckyc-btn-group" style={{ marginTop: 12 }}>
              {wizardStep > 1 && (
                <button
                  type="button"
                  className="ckyc-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setWizardStep((wizardStep - 1) as WizardStep)}
                >
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              <button
                type="button"
                className="ckyc-btn-primary"
                style={{ flex: 2 }}
                onClick={() => {
                  if (wizardStep < 5) {
                    setWizardStep((wizardStep + 1) as WizardStep);
                  } else {
                    // Completed wizard -> go to document uploads
                    setCurrentScreen('documents');
                  }
                }}
              >
                {wizardStep < 5 ? 'Save & Continue' : 'Proceed to Documents'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            SCREEN 5: DOCUMENTS UPLOAD CARDS (4 VISUAL STATES)
           ──────────────────────────────────────────────────────────────── */}
        {currentScreen === 'documents' && (
          <div className="ckyc-card">
            <div className="ckyc-card-title-group">
              <h2 className="ckyc-card-title">Supporting Documents</h2>
              <p className="ckyc-card-desc">
                Upload clear color copies of identity and banking documents (PDF, JPG, PNG up to 5MB).
              </p>
            </div>

            <div className="ckyc-upload-cards-grid">
              {/* State 1: Empty state */}
              <div
                className="ckyc-upload-card empty"
                onClick={() => alert('Document picker opened (demo)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UploadCloud size={20} color="var(--ckyc-primary)" />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>1. Permanent Account Card (PAN)</div>
                      <div style={{ fontSize: 12, color: 'var(--ckyc-text-muted)' }}>Tap to browse or take photo</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ckyc-primary-dark)' }}>Upload</span>
                </div>
              </div>

              {/* State 2: Uploading state (with progress bar) */}
              <div className="ckyc-upload-card uploading">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <RefreshCw size={18} className="spin" color="#3b82f6" />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>2. Aadhaar Offline XML / Card</div>
                      <div style={{ fontSize: 12, color: '#3b82f6' }}>Uploading... 68% (1.6 MB / 2.4 MB)</div>
                    </div>
                  </div>
                </div>
                <div className="ckyc-progress-track" style={{ height: 4, background: 'rgba(59, 130, 246, 0.2)' }}>
                  <div className="ckyc-progress-fill" style={{ width: '68%', background: '#3b82f6' }} />
                </div>
              </div>

              {/* State 3: Uploaded state (green check + file name) */}
              <div className="ckyc-upload-card uploaded">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle size={20} color="#10b981" />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46' }}>3. Bank Account Proof (Cheque)</div>
                      <div style={{ fontSize: 12, color: 'var(--ckyc-text-secondary)' }}>
                        HDFC_Cancelled_Cheque_Aditya.pdf • 1.4 MB
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--ckyc-text-muted)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => alert('Replace document (demo)')}
                  >
                    Replace
                  </button>
                </div>
              </div>

              {/* State 4: Error state (red message + retry button) */}
              <div className="ckyc-upload-card error">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <AlertCircle size={20} color="#dc2626" style={{ marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>4. Demat Client Master Report</div>
                      <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>
                        Upload failed: File resolution below 300 DPI or unsupported HEIC format.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#dc2626',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                    onClick={() => alert('Retrying upload (demo)')}
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>

            <div className="ckyc-btn-group" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="ckyc-btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  setCurrentScreen('wizard');
                  setWizardStep(5);
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className="ckyc-btn-primary"
                style={{ flex: 2 }}
                onClick={() => setCurrentScreen('consent')}
              >
                Proceed to Consent <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            SCREEN 6: REGULATORY CONSENT & DECLARATION
           ──────────────────────────────────────────────────────────────── */}
        {currentScreen === 'consent' && (
          <div className="ckyc-card">
            <div className="ckyc-card-title-group">
              <h2 className="ckyc-card-title">Terms &amp; Regulatory Declarations</h2>
              <p className="ckyc-card-desc">
                SEBI Alternative Investment Fund (AIF) compliance and digital signature declaration.
              </p>
            </div>

            <div className="ckyc-consent-box">
              <p style={{ marginTop: 0 }}>
                <strong>1. SEBI (Alternative Investment Funds) Regulations, 2012:</strong> I hereby declare that I am an eligible investor meeting the minimum ticket size requirements mandated under Category II Alternative Investment Funds.
              </p>
              <p>
                <strong>2. Prevention of Money Laundering Act (PMLA):</strong> The funds invested or to be invested are sourced through legitimate banking channels and do not involve proceeds of any illegal activity.
              </p>
              <p>
                <strong>3. Digital Authentication Consent:</strong> I authorize GHL India Ventures and its SEBI registered KYC Registration Agencies (KRAs) to pull and verify my demographic details from UIDAI/Aadhaar and NSDL/Income Tax systems.
              </p>
              <p style={{ marginBottom: 0 }}>
                <strong>4. Electronic Communications:</strong> I consent to receiving account statements, audit reports, valuation updates, and legal notices via my registered email and verified WhatsApp number.
              </p>
            </div>

            <label className="ckyc-checkbox-row">
              <input
                type="checkbox"
                className="ckyc-checkbox"
                checked={hasAgreedConsent}
                onChange={e => setHasAgreedConsent(e.target.checked)}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ckyc-text-primary)' }}>
                I have read, understood, and accept all the terms, statutory disclosures, and AIF investor declarations listed above.
              </span>
            </label>

            <div className="ckyc-btn-group">
              <button
                type="button"
                className="ckyc-btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setCurrentScreen('documents')}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className="ckyc-btn-primary"
                style={{ flex: 2 }}
                disabled={!hasAgreedConsent}
                onClick={() => setCurrentScreen('liveness')}
              >
                Continue to Liveness <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            SCREEN 7: LIVENESS VERIFICATION
           ──────────────────────────────────────────────────────────────── */}
        {currentScreen === 'liveness' && (
          <div className="ckyc-card">
            <div className="ckyc-card-title-group">
              <h2 className="ckyc-card-title">Live Selfie Verification</h2>
              <p className="ckyc-card-desc">
                Anti-spoofing face match verification against your government ID photograph.
              </p>
            </div>

            {/* Camera Box Placeholder */}
            <div className="ckyc-camera-box">
              <div className="ckyc-oval-frame">
                {livenessState === 'captured' ? (
                  <div style={{ textAlign: 'center', color: '#10b981' }}>
                    <CheckCircle size={48} />
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>Face Captured</div>
                  </div>
                ) : (
                  <Camera size={44} style={{ opacity: 0.6 }} />
                )}
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                {livenessState === 'captured'
                  ? '✓ 98.4% Match with PAN Photo'
                  : 'Position face inside the oval frame'}
              </div>
            </div>

            {/* Tips List */}
            <div className="ckyc-tips-list">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} color="#10b981" /> Ensure clear room lighting with no glare
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} color="#10b981" /> Remove sunglasses, caps or face masks
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} color="#10b981" /> Look directly at the camera at eye level
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {livenessState !== 'captured' ? (
                <button
                  type="button"
                  className="ckyc-btn-primary"
                  onClick={() => setLivenessState('captured')}
                >
                  <Camera size={16} /> Capture Live Selfie (Demo)
                </button>
              ) : (
                <div className="ckyc-btn-group">
                  <button
                    type="button"
                    className="ckyc-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setLivenessState('idle')}
                  >
                    <RotateCw size={15} /> Retake
                  </button>
                  <button
                    type="button"
                    className="ckyc-btn-primary"
                    style={{ flex: 2 }}
                    onClick={() => {
                      // TODO(logic): Submit final packet to backend
                      setCurrentScreen('submitted');
                    }}
                  >
                    Submit KYC Dossier <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────
            SCREEN 8: SUBMITTED SUCCESS
           ──────────────────────────────────────────────────────────────── */}
        {currentScreen === 'submitted' && (
          <div className="ckyc-card">
            <div className="ckyc-state-banner">
              <div className="ckyc-state-icon-wrap ckyc-state-icon-success">
                <CheckCircle size={42} />
              </div>
              <h2 className="ckyc-card-title">KYC Dossier Submitted!</h2>
              <p className="ckyc-card-desc">
                Thank you for completing your verification with GHL India Ventures. Your file is now assigned to our compliance officer.
              </p>

              <div className="ckyc-ref-box" style={{ width: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ckyc-text-muted)', marginBottom: 2 }}>
                  Your Submission Reference Number
                </div>
                GHL-KYC-2026-89421
              </div>

              {/* What Happens Next Timeline */}
              <div style={{ width: '100%', marginTop: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px 0', textTransform: 'uppercase', color: 'var(--ckyc-text-muted)' }}>
                  What Happens Next
                </h4>
                <div className="ckyc-timeline-list">
                  <div className="ckyc-timeline-item">
                    <div className="ckyc-timeline-num">1</div>
                    <div style={{ fontSize: 13 }}>
                      <strong>Automated Agency Verification:</strong> PAN, Bank penny drop and Aadhaar eKYC cryptographic check (completed in real-time).
                    </div>
                  </div>
                  <div className="ckyc-timeline-item">
                    <div className="ckyc-timeline-num">2</div>
                    <div style={{ fontSize: 13 }}>
                      <strong>IRM Review &amp; Capacity Check:</strong> Your assigned Investor Relations Manager reviews the allocation suitability within 2 business hours.
                    </div>
                  </div>
                  <div className="ckyc-timeline-item">
                    <div className="ckyc-timeline-num">3</div>
                    <div style={{ fontSize: 13 }}>
                      <strong>Fund Presentation &amp; Contribution Agreement:</strong> You'll receive your welcome kit and digital contribution agreement for signing.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ width: '100%', marginTop: 14 }}>
                <button
                  type="button"
                  className="ckyc-btn-primary"
                  onClick={() => alert('Dossier summary downloaded (demo)')}
                >
                  <FileText size={16} /> Download Submission Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Fixed Dev-Only Preview Switcher Bar at Bottom ── */}
      <div className="ckyc-preview-bar">
        <span>⚡ Dev Preview:</span>
        <select
          className="ckyc-preview-select"
          value={currentScreen}
          onChange={e => setCurrentScreen(e.target.value as ScreenId)}
        >
          <option value="otp">3. OTP Verification</option>
          <option value="wizard">4. Wizard Steps (1-5)</option>
          <option value="documents">5. Document Uploads (4 States)</option>
          <option value="consent">6. Consent &amp; Declarations</option>
          <option value="liveness">7. AI Liveness Check</option>
          <option value="submitted">8. Submission Success</option>
          <option value="loading">1. Loading Skeleton</option>
          <option value="invalid">2. Expired Link State</option>
        </select>
        {currentScreen === 'wizard' && (
          <select
            className="ckyc-preview-select"
            value={wizardStep}
            onChange={e => setWizardStep(Number(e.target.value) as WizardStep)}
          >
            <option value={1}>Step 1: Basic</option>
            <option value={2}>Step 2: Identity (Validation Demo)</option>
            <option value={3}>Step 3: Bank</option>
            <option value={4}>Step 4: Demat</option>
            <option value={5}>Step 5: Nominee</option>
          </select>
        )}
      </div>
    </div>
  );
};
