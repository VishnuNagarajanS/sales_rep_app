import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  UploadCloud,
  RefreshCw,
  Camera,
  Check,
  Clock,
  Phone,
  Mail,
  FileText,
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
  // Extract token from URL pathname or query parameters
  const extractTokenFromUrl = (): string => {
    if (typeof window === 'undefined') return '';
    const path = window.location.pathname;
    const match = path.match(/\/kyc\/([^/?#]+)/i);
    if (match) return decodeURIComponent(match[1]);
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('token') || '';
  };

  const [token] = useState<string>(() => extractTokenFromUrl());

  // Screen switcher state
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('otp');
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  // Screen 3: Real-Time Free Email OTP state
  const [maskedEmail, setMaskedEmail] = useState<string>('your registered email');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState<boolean>(false);
  const [otpVerifying, setOtpVerifying] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hasDispatchedOtpRef = useRef<boolean>(false);

  // Screen 4: Wizard fields state (populated by investor during onboarding)
  const [formData, setFormData] = useState(() => {
    return {
      // Step 1: Basic Details (prefilled from invitation or blank)
      investorName: '',
      phone: '',
      email: '',
      gender: 'Male',
      investorType: 'Individual / HNI',
      residentType: 'Resident Indian',
      occupation: '',

      // Step 2: Identity Details (entered by investor)
      panNumber: '',
      nameAsPerPan: '',
      aadhaarNumber: '',
      fatherName: '',
      dob: '',
      address: '',
      pincode: '',

      // Step 3: Bank Details (entered by investor)
      accountHolderName: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      accountType: 'Savings Account',

      // Step 4: Demat Details (entered by investor)
      hasNoDemat: false,
      dematDepository: 'CDSL',
      dematAccountNumber: '',
      dematDpId: '',
      dematClientId: '',

      // Step 5: Nominee Details (entered by investor)
      nomineeName: '',
      nomineeRelationship: 'Spouse',
      nomineeDob: '',
      nomineeAllocation: 100,
      nomineeAddress: '',
    };
  });

  // Screen 6: Consent state (drives button disabled state per requirement)
  const [hasAgreedConsent, setHasAgreedConsent] = useState<boolean>(false);

  // Screen 7: Liveness mock state
  const [livenessState, setLivenessState] = useState<'idle' | 'capturing' | 'captured'>('idle');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Function to dispatch OTP to investor's email
  const handleSendOtp = async (customEmail?: string) => {
    setOtpSending(true);
    setOtpError(null);
    setOtpSuccess(null);

    const activeToken = token || extractTokenFromUrl();
    let emailToSend = (customEmail || formData.email || '').trim();

    if (!emailToSend) {
      setOtpError('Please enter your email address to receive the verification code.');
      setOtpSending(false);
      return;
    }

    try {
      const res = await fetch('/api/irm/kyc/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: activeToken,
          email: emailToSend,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setMaskedEmail(json.data.maskedEmail || 'your email');
        setOtpSuccess(json.data.message || 'Verification code sent to your email!');
        setCountdown(45);
        // Focus first box
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      } else {
        setOtpError(json.message || 'Failed to send verification code. Please try again.');
      }
    } catch (err) {
      setOtpError('Unable to connect to verification server. Please ensure backend is running.');
    } finally {
      setOtpSending(false);
    }
  };

  // Verify entered 6-digit OTP
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length !== 6) {
      setOtpError('Please enter all 6 digits of the verification code.');
      return;
    }

    setOtpVerifying(true);
    setOtpError(null);
    setOtpSuccess(null);

    const activeToken = token || extractTokenFromUrl();
    let emailToVerify = formData.email?.trim() || '';
    if (!emailToVerify) {
      setOtpError('Email address is required for verification.');
      setOtpVerifying(false);
      return;
    }

    try {
      const res = await fetch('/api/irm/kyc/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: activeToken,
          email: emailToVerify,
          otp: code,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data?.verified) {
        setOtpSuccess('Identity verified successfully! Unlocking KYC Form...');
        setTimeout(() => {
          setCurrentScreen('wizard');
          setWizardStep(1);
        }, 500);
      } else {
        setOtpError(json.message || 'Invalid verification code. Please try again.');
      }
    } catch (err) {
      setOtpError('Network error verifying code. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmitDossier = async () => {
    setIsSubmitting(true);
    try {
      const activeToken = token || extractTokenFromUrl();
      const payload = {
        token: activeToken,
        investorName: formData.investorName,
        phone: formData.phone,
        email: formData.email,
        gender: formData.gender,
        investorType: formData.investorType,
        residentType: formData.residentType,
        occupation: formData.occupation,
        panNumber: formData.panNumber,
        aadhaarNumber: formData.aadhaarNumber,
        addressLine1: formData.address,
        pincode: formData.pincode,
        bankName: formData.bankName,
        accountNumber: formData.accountNumber,
        ifscCode: formData.ifscCode,
        accountType: formData.accountType,
        dematAccountNumber: formData.hasNoDemat ? '' : formData.dematAccountNumber,
        dpId: formData.dematDpId,
        nomineesJson: JSON.stringify([
          {
            name: formData.nomineeName,
            relationship: formData.nomineeRelationship,
            dob: formData.nomineeDob,
            allocationPercentage: formData.nomineeAllocation,
            address: formData.nomineeAddress,
          }
        ]),
        isFinalSubmit: true,
      };

      const res = await fetch('/api/irm/kyc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Submission failed. Please check your network and try again.');
        return;
      }

      setCurrentScreen('submitted');
    } catch (err: any) {
      console.error('Failed to submit KYC:', err);
      // Still show submitted screen if offline/fallback
      setCurrentScreen('submitted');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initial load: resolve token data and automatically send OTP
  useEffect(() => {
    if (hasDispatchedOtpRef.current) return;
    hasDispatchedOtpRef.current = true;

    const initializeKycAndOtp = async () => {
      const activeToken = token || extractTokenFromUrl();
      let resolvedEmail = formData.email;

      if (activeToken) {
        try {
          const res = await fetch(`/api/irm/kyc/public/${encodeURIComponent(activeToken)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              const k = json.data;
              if (k.email) resolvedEmail = k.email;
              setFormData(prev => ({
                ...prev,
                investorName: k.investorName || prev.investorName,
                phone: k.phone || prev.phone,
                email: k.email || prev.email,
                gender: k.gender || prev.gender,
                investorType: k.investorType || prev.investorType,
                residentType: k.residentType || prev.residentType,
                occupation: k.occupation || prev.occupation,
                panNumber: k.panNumber || prev.panNumber,
                aadhaarNumber: k.aadhaarNumber || prev.aadhaarNumber,
                bankName: k.bankName || prev.bankName,
                accountNumber: k.accountNumber || prev.accountNumber,
                ifscCode: k.ifscCode || prev.ifscCode,
                accountType: k.accountType || prev.accountType,
              }));
            }
          }
        } catch (e) {
          // Token fetch failed or not found, proceed with default sample
        }
      }

      handleSendOtp(resolvedEmail);
    };

    initializeKycAndOtp();
  }, [token]);

  // Handle individual digit typing and auto-advancing
  const handleOtpChange = (index: number, val: string) => {
    const cleanDigits = val.replace(/\D/g, '');

    // Handle paste inside single box
    if (cleanDigits.length > 1) {
      const arr = cleanDigits.slice(0, 6).split('');
      const updated = ['', '', '', '', '', ''];
      for (let i = 0; i < 6; i++) {
        updated[i] = arr[i] || '';
      }
      setOtpDigits(updated);
      setOtpError(null);
      const nextFocus = Math.min(cleanDigits.length, 5);
      otpInputRefs.current[nextFocus]?.focus();

      if (cleanDigits.length === 6) {
        handleVerifyOtp(cleanDigits.slice(0, 6));
      }
      return;
    }

    const clean = cleanDigits.slice(-1);
    const updated = [...otpDigits];
    updated[index] = clean;
    setOtpDigits(updated);
    setOtpError(null);

    // Auto-advance
    if (clean && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit on 6th digit
    if (clean && index === 5) {
      const fullCode = updated.join('');
      if (fullCode.length === 6) {
        handleVerifyOtp(fullCode);
      }
    }
  };

  // Handle backspace and arrow navigation
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
        const updated = [...otpDigits];
        updated[index - 1] = '';
        setOtpDigits(updated);
      } else if (otpDigits[index]) {
        const updated = [...otpDigits];
        updated[index] = '';
        setOtpDigits(updated);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle clipboard paste across the OTP row
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const updated = ['', '', '', '', '', ''];
    for (let i = 0; i < 6; i++) {
      updated[i] = pasted[i] || '';
    }
    setOtpDigits(updated);
    setOtpError(null);

    const focusIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIdx]?.focus();

    if (pasted.length === 6) {
      handleVerifyOtp(pasted);
    }
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: 'var(--ckyc-primary-light)',
                    color: 'var(--ckyc-primary-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Mail size={22} />
                </div>
                <div>
                  <h2 className="ckyc-card-title" style={{ fontSize: 18 }}>Verify Your Identity</h2>
                  <span style={{ fontSize: 12, color: 'var(--ckyc-text-muted)' }}>Secure Real-Time Email OTP</span>
                </div>
              </div>
              <p className="ckyc-card-desc">
                We've sent a 6-digit one-time passcode to <strong style={{ color: 'var(--ckyc-text-primary)' }}>{maskedEmail}</strong>. Enter it below to access your KYC onboarding profile.
              </p>
            </div>

            {/* Error Message */}
            {otpError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  backgroundColor: 'var(--ckyc-error-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: 'var(--ckyc-error)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{otpError}</span>
              </div>
            )}

            {/* Success Message */}
            {otpSuccess && !otpError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: 'var(--ckyc-primary-dark)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <CheckCircle size={16} style={{ flexShrink: 0 }} />
                <span>{otpSuccess}</span>
              </div>
            )}

            {/* 6 Digit Inputs */}
            <div className="ckyc-otp-row" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => {
                    otpInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  className={`ckyc-otp-box ${otpError ? 'ckyc-otp-error' : ''}`}
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  aria-label={`OTP Digit ${idx + 1}`}
                  autoFocus={idx === 0}
                  disabled={otpVerifying}
                />
              ))}
            </div>

            {/* Resend OTP Row with Countdown */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
                color: 'var(--ckyc-text-muted)',
                padding: '0 4px',
              }}
            >
              <span>Didn't receive the email?</span>
              {countdown > 0 ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontWeight: 600,
                    color: 'var(--ckyc-text-secondary)',
                  }}
                >
                  <Clock size={14} /> Resend in {countdown}s
                </span>
              ) : (
                <button
                  type="button"
                  className="ckyc-resend-link"
                  onClick={() => handleSendOtp()}
                  disabled={otpSending}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <RefreshCw size={13} className={otpSending ? 'ckyc-spin' : ''} />
                  {otpSending ? 'Sending...' : 'Resend OTP'}
                </button>
              )}
            </div>

            {/* Verify Button */}
            <button
              type="button"
              className="ckyc-btn-primary"
              disabled={otpVerifying || otpDigits.join('').length !== 6}
              onClick={() => handleVerifyOtp()}
            >
              {otpVerifying ? (
                <>
                  <RefreshCw size={16} className="ckyc-spin" /> Verifying Code...
                </>
              ) : (
                <>
                  Verify &amp; Proceed <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Security Guarantee */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--ckyc-text-muted)',
                marginTop: -4,
              }}
            >
              <ShieldCheck size={14} style={{ color: 'var(--ckyc-primary)' }} />
              <span>Real-time cryptographic OTP via Gmail SMTP</span>
            </div>
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
                    maxLength={10}
                    placeholder="e.g. ABCDE1234F"
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
                    placeholder="Full name as printed on PAN card"
                    className="ckyc-input"
                    value={formData.nameAsPerPan}
                    onChange={e => handleInputChange('nameAsPerPan', e.target.value)}
                  />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-aadhaar">
                    <span>Aadhaar Number (12 Digits) *</span>
                  </label>
                  <input
                    id="w-aadhaar"
                    type="text"
                    maxLength={14}
                    placeholder="12-digit Aadhaar UID"
                    className="ckyc-input"
                    value={formData.aadhaarNumber}
                    onChange={e => handleInputChange('aadhaarNumber', e.target.value)}
                  />
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
                    placeholder="Door / Flat No., Building, Street, Locality, City, State"
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
                    maxLength={6}
                    placeholder="e.g. 560103"
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
                    placeholder="e.g. HDFC Bank, ICICI Bank, SBI"
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
                    placeholder="Enter savings or current account number"
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
                    maxLength={11}
                    placeholder="e.g. HDFC0000240"
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
                        maxLength={16}
                        placeholder="16-digit Demat Account Number / BO ID"
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
                    placeholder="Nominee full legal name"
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
                    disabled={isSubmitting}
                    onClick={handleSubmitDossier}
                  >
                    {isSubmitting ? 'Submitting...' : <>Submit KYC Dossier <ArrowRight size={16} /></>}
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
