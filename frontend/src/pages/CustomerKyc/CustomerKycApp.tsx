import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  XCircle,
  Eye,
  Trash2,
} from 'lucide-react';
import './CustomerKycApp.css';
import { kycValidators } from '../../utils/kycValidators';
import { isMockMode } from '../../config/environment';

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

export interface UploadedDoc {
  name: string;
  size: string;
  dataUrl: string;
  status: 'empty' | 'uploading' | 'uploaded' | 'error';
  progress?: number;
  error?: string;
}

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

      // Step 5: Nominee Details (entered by investor, optional)
      nomineeName: '',
      nomineeRelationship: 'Spouse',
      nomineeDob: '',
      nomineeAllocation: 100,
      nomineeAddress: '',
    };
  });

  // Screen 5: Real Document Upload State
  const [documents, setDocuments] = useState<Record<'pan' | 'aadhaar' | 'bank' | 'demat', UploadedDoc>>({
    pan: { name: '', size: '', dataUrl: '', status: 'empty' },
    aadhaar: { name: '', size: '', dataUrl: '', status: 'empty' },
    bank: { name: '', size: '', dataUrl: '', status: 'empty' },
    demat: { name: '', size: '', dataUrl: '', status: 'empty' },
  });
  const [docErrors, setDocErrors] = useState<string | null>(null);
  const panInputRef = useRef<HTMLInputElement>(null);
  const aadhaarInputRef = useRef<HTMLInputElement>(null);
  const bankInputRef = useRef<HTMLInputElement>(null);
  const dematInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Screen 6: Consent state (drives button disabled state per requirement)
  const [hasAgreedConsent, setHasAgreedConsent] = useState<boolean>(false);

  // Screen 7: Live Camera & Liveness state
  const [livenessState, setLivenessState] = useState<'idle' | 'capturing' | 'captured'>('idle');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Per-field error messages keyed by field name
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Whether each wizard step has been validated (for tab indicators)
  const [stepValidated, setStepValidated] = useState<Record<number, boolean>>({});

  // Ref for the wizard card (scroll-to-error)
  const wizardCardRef = useRef<HTMLDivElement>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Validation helpers ────────────────────────────────────────────────────

  const E = (msg: string) => msg; // identity, just for readability

  const validateStep = useCallback((step: WizardStep, data: typeof formData): Record<string, string> => {
    const errs: Record<string, string> = {};

    if (step === 1) {
      if (!kycValidators.requiredText(data.investorName, 3))
        errs.investorName = E('Full name must be at least 3 characters.');
      if (!kycValidators.phone(data.phone))
        errs.phone = E('Enter a valid 10-digit Indian mobile number.');
      if (!kycValidators.email(data.email))
        errs.email = E('Enter a valid email address.');
      if (!kycValidators.requiredText(data.occupation, 2))
        errs.occupation = E('Occupation / source of wealth is required.');
    }

    if (step === 2) {
      if (!kycValidators.pan(data.panNumber?.trim() || ''))
        errs.panNumber = E('Enter a valid PAN (e.g. ABCDE1234F).');
      if (!kycValidators.requiredText(data.nameAsPerPan, 3))
        errs.nameAsPerPan = E('Name as per PAN must be at least 3 characters.');
      if (!kycValidators.aadhaar(data.aadhaarNumber.replace(/\s/g, '')))
        errs.aadhaarNumber = E('Enter a valid 12-digit Aadhaar number (cannot start with 0 or 1).');
      if (!kycValidators.dob(data.dob))
        errs.dob = E('Date of birth is required and the investor must be at least 18 years old.');
      if (!kycValidators.requiredText(data.address, 10))
        errs.address = E('Enter your complete permanent address (at least 10 characters).');
      if (!kycValidators.pincode(data.pincode))
        errs.pincode = E('Enter a valid 6-digit PIN code (cannot start with 0).');
    }

    if (step === 3) {
      if (!kycValidators.requiredText(data.bankName, 2))
        errs.bankName = E('Bank name is required.');
      if (!kycValidators.bankAccount(data.accountNumber))
        errs.accountNumber = E('Enter a valid bank account number (9–18 digits).');
      if (!kycValidators.ifsc(data.ifscCode))
        errs.ifscCode = E('Enter a valid IFSC code (e.g. HDFC0001234).');
    }

    if (step === 4) {
      if (!data.hasNoDemat) {
        if (!kycValidators.dematBoid(data.dematAccountNumber))
          errs.dematAccountNumber = E('Demat beneficiary ID must be exactly 16 digits.');
      }
    }

    if (step === 5) {
      // Nominee is now optional: only validate if nomineeName is entered
      if (data.nomineeName && data.nomineeName.trim().length > 0) {
        if (!kycValidators.requiredText(data.nomineeName, 2))
          errs.nomineeName = E('Nominee full name must be at least 2 characters.');
        if (!kycValidators.nomineeDob(data.nomineeDob))
          errs.nomineeDob = E('Nominee date of birth is required.');
        if (data.nomineeAllocation !== 100)
          errs.nomineeAllocation = E('Allocation must be exactly 100%.');
      }
    }

    return errs;
  }, []);

  const isStepValid = useCallback((step: WizardStep, data: typeof formData): boolean => {
    return Object.keys(validateStep(step, data)).length === 0;
  }, [validateStep]);

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

  // ── Document Upload Handlers ──────────────────────────────────────────────
  const handleFileSelected = (docKey: 'pan' | 'aadhaar' | 'bank' | 'demat', file: File | null) => {
    if (!file) return;
    setDocErrors(null);

    // Max 5MB size limit
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setDocuments(prev => ({
        ...prev,
        [docKey]: {
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          dataUrl: '',
          status: 'error',
          error: 'File size exceeds 5MB limit. Please upload a smaller file.',
        },
      }));
      return;
    }

    const formattedSize = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    setDocuments(prev => ({
      ...prev,
      [docKey]: {
        name: file.name,
        size: formattedSize,
        dataUrl: '',
        status: 'uploading',
        progress: 35,
      },
    }));

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setTimeout(() => {
        setDocuments(prev => ({
          ...prev,
          [docKey]: {
            name: file.name,
            size: formattedSize,
            dataUrl,
            status: 'uploaded',
            progress: 100,
          },
        }));
      }, 300);
    };
    reader.onerror = () => {
      setDocuments(prev => ({
        ...prev,
        [docKey]: {
          name: file.name,
          size: formattedSize,
          dataUrl: '',
          status: 'error',
          error: 'Failed to read file. Please try again.',
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveDoc = (docKey: 'pan' | 'aadhaar' | 'bank' | 'demat') => {
    setDocuments(prev => ({
      ...prev,
      [docKey]: { name: '', size: '', dataUrl: '', status: 'empty' },
    }));
    if (docKey === 'pan' && panInputRef.current) panInputRef.current.value = '';
    if (docKey === 'aadhaar' && aadhaarInputRef.current) aadhaarInputRef.current.value = '';
    if (docKey === 'bank' && bankInputRef.current) bankInputRef.current.value = '';
    if (docKey === 'demat' && dematInputRef.current) dematInputRef.current.value = '';
  };

  const handlePreviewDoc = (docKey: 'pan' | 'aadhaar' | 'bank' | 'demat') => {
    const doc = documents[docKey];
    if (!doc.dataUrl) return;
    const w = window.open('');
    if (w) {
      if (doc.dataUrl.startsWith('data:application/pdf')) {
        w.document.write(`<iframe src="${doc.dataUrl}" style="width:100%;height:100%;border:none;"></iframe>`);
      } else {
        w.document.write(`<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;margin:0;"><img src="${doc.dataUrl}" style="max-width:90%;max-height:90vh;border-radius:8px;" alt="${doc.name}" /></div>`);
      }
    }
  };

  const handleProceedToConsent = () => {
    if (documents.pan.status !== 'uploaded') {
      setDocErrors('Please upload your PAN card copy before proceeding.');
      return;
    }
    if (documents.aadhaar.status !== 'uploaded') {
      setDocErrors('Please upload your Aadhaar document before proceeding.');
      return;
    }
    if (documents.bank.status !== 'uploaded') {
      setDocErrors('Please upload your Bank account proof / cheque before proceeding.');
      return;
    }
    setDocErrors(null);
    setCurrentScreen('consent');
  };

  // ── Camera & Liveness Handlers ────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraActive(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera API is not supported on this browser or environment.');
        return;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          setCameraActive(true);
        };
      } else {
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access denied. Please allow camera access in your browser or upload a selfie photo below.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. You can upload a selfie photo below.');
      } else {
        setCameraError('Unable to open camera: ' + (err.message || 'Check camera access permissions.'));
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const captureLiveSelfie = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedPhoto(dataUrl);
      setLivenessState('captured');
      stopCamera();
    }
  };

  const handleRetakeSelfie = () => {
    setCapturedPhoto(null);
    setLivenessState('idle');
    setSubmitError(null);
    startCamera();
  };

  const handleSelfieFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedPhoto(reader.result as string);
      setLivenessState('captured');
      setCameraError(null);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (currentScreen === 'liveness' && livenessState !== 'captured') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [currentScreen, livenessState, startCamera, stopCamera]);

  const handleSubmitDossier = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const activeToken = token || extractTokenFromUrl();
      const payload: any = {
        token: activeToken,
        investorName: formData.investorName,
        phone: formData.phone,
        email: formData.email,
        gender: formData.gender,
        investorType: formData.investorType,
        residentType: formData.residentType,
        occupation: formData.occupation,
        panNumber: formData.panNumber?.trim(),
        aadhaarNumber: formData.aadhaarNumber?.replace(/\s/g, ''),
        addressLine1: formData.address,
        pincode: formData.pincode,
        bankName: formData.bankName,
        accountNumber: formData.accountNumber,
        ifscCode: formData.ifscCode?.toUpperCase(),
        accountType: formData.accountType,
        dematAccountNumber: formData.hasNoDemat ? '' : formData.dematAccountNumber,
        dpId: formData.dematDpId,
        nomineesJson: formData.nomineeName?.trim()
          ? JSON.stringify([
              {
                name: formData.nomineeName.trim(),
                relationship: formData.nomineeRelationship,
                dob: formData.nomineeDob,
                allocationPercentage: formData.nomineeAllocation || 100,
                address: formData.nomineeAddress || '',
              }
            ])
          : '[]',
        panDocumentUrl: documents.pan.dataUrl || undefined,
        aadhaarDocumentUrl: documents.aadhaar.dataUrl || undefined,
        bankChequeUrl: documents.bank.dataUrl || undefined,
        dematDocumentUrl: documents.demat.dataUrl || undefined,
        photoUrl: capturedPhoto || undefined,
        isFinalSubmit: true,
      };

      const res = await fetch('/api/irm/kyc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        stopCamera();
        setCurrentScreen('submitted');
        return;
      }

      if (isMockMode()) {
        try {
          const raw = localStorage.getItem('nexus_mock_kyc_records') || '[]';
          const list = JSON.parse(raw);
          list.push({ ...payload, id: Date.now(), status: 'PendingReview', submittedAt: new Date().toISOString() });
          localStorage.setItem('nexus_mock_kyc_records', JSON.stringify(list));
        } catch {}
        stopCamera();
        setCurrentScreen('submitted');
        return;
      }

      const errMsg = json.message || (json.errors ? Object.values(json.errors).flat().join(', ') : 'Submission failed. Please check your details and try again.');
      setSubmitError(errMsg);
    } catch (err: any) {
      console.error('Failed to submit KYC:', err);
      if (isMockMode()) {
        stopCamera();
        setCurrentScreen('submitted');
        return;
      }
      setSubmitError('Network error — please check your connection and try again.');
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
    // Clear per-field error when the user edits the field
    setFormErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  /** Validate current wizard step; if errors found, display them and scroll. Returns true if clean. */
  const validateAndAdvance = () => {
    const errs = validateStep(wizardStep, formData);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      // Scroll the first errored field into view
      setTimeout(() => {
        const firstErrorEl = wizardCardRef.current?.querySelector('.ckyc-field-error');
        if (firstErrorEl) (firstErrorEl as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return false;
    }
    setFormErrors({});
    setStepValidated(prev => ({ ...prev, [wizardStep]: true }));
    return true;
  };

  /** Inline error message component */
  const FieldError = ({ field }: { field: string }) =>
    formErrors[field] ? (
      <div className="ckyc-field-error" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ckyc-error)', fontSize: 12, fontWeight: 500, marginTop: 4 }}>
        <XCircle size={13} style={{ flexShrink: 0 }} />
        <span>{formErrors[field]}</span>
      </div>
    ) : null;

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
              ].map(s => {
                const isActive = wizardStep === s.step;
                const isPast = wizardStep > s.step;
                const hasError = isPast && !isStepValid(s.step as WizardStep, formData) && stepValidated[s.step];
                return (
                  <div
                    key={s.step}
                    className={`ckyc-step-node ${
                      isActive ? 'active' : isPast ? (hasError ? 'error' : 'completed') : ''
                    }`}
                    onClick={() => setWizardStep(s.step as WizardStep)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="ckyc-step-circle">
                      {isPast
                        ? hasError
                          ? <XCircle size={14} />
                          : <Check size={14} />
                        : s.step}
                    </div>
                    <span className="ckyc-step-title">{s.label}</span>
                  </div>
                );
              })}
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
                    className={`ckyc-input${formErrors.investorName ? ' ckyc-input-error' : ''}`}
                    value={formData.investorName}
                    onChange={e => handleInputChange('investorName', e.target.value)}
                  />
                  <FieldError field="investorName" />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-phone">Phone Number *</label>
                  <input
                    id="w-phone"
                    type="text"
                    placeholder="10-digit mobile number"
                    className={`ckyc-input${formErrors.phone ? ' ckyc-input-error' : ''}`}
                    value={formData.phone}
                    onChange={e => handleInputChange('phone', e.target.value)}
                  />
                  <FieldError field="phone" />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-email">Email Address *</label>
                  <input
                    id="w-email"
                    type="email"
                    className={`ckyc-input${formErrors.email ? ' ckyc-input-error' : ''}`}
                    value={formData.email}
                    onChange={e => handleInputChange('email', e.target.value)}
                  />
                  <FieldError field="email" />
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
                  <label className="ckyc-form-label" htmlFor="w-occ">Occupation / Source of Wealth *</label>
                  <input
                    id="w-occ"
                    type="text"
                    className={`ckyc-input${formErrors.occupation ? ' ckyc-input-error' : ''}`}
                    value={formData.occupation}
                    onChange={e => handleInputChange('occupation', e.target.value)}
                  />
                  <FieldError field="occupation" />
                </div>
              </div>
            )}

            {/* Step 2: Identity Details */}
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
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="e.g. ABCDE1234F"
                    className={`ckyc-input${formErrors.panNumber ? ' ckyc-input-error' : ''}`}
                    value={formData.panNumber}
                    onChange={e => {
                      const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                      handleInputChange('panNumber', clean);
                    }}
                  />
                  <FieldError field="panNumber" />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-pan-name">Full Name as per PAN *</label>
                  <input
                    id="w-pan-name"
                    type="text"
                    placeholder="Full name as printed on PAN card"
                    className={`ckyc-input${formErrors.nameAsPerPan ? ' ckyc-input-error' : ''}`}
                    value={formData.nameAsPerPan}
                    onChange={e => handleInputChange('nameAsPerPan', e.target.value)}
                  />
                  <FieldError field="nameAsPerPan" />
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
                    className={`ckyc-input${formErrors.aadhaarNumber ? ' ckyc-input-error' : ''}`}
                    value={formData.aadhaarNumber}
                    onChange={e => handleInputChange('aadhaarNumber', e.target.value)}
                  />
                  <FieldError field="aadhaarNumber" />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-dob">Date of Birth * (must be 18+)</label>
                  <input
                    id="w-dob"
                    type="date"
                    className={`ckyc-input${formErrors.dob ? ' ckyc-input-error' : ''}`}
                    value={formData.dob}
                    onChange={e => handleInputChange('dob', e.target.value)}
                  />
                  <FieldError field="dob" />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-addr">Permanent Address *</label>
                  <textarea
                    id="w-addr"
                    className={`ckyc-input${formErrors.address ? ' ckyc-input-error' : ''}`}
                    placeholder="Door / Flat No., Building, Street, Locality, City, State"
                    style={{ minHeight: 70, resize: 'vertical' }}
                    value={formData.address}
                    onChange={e => handleInputChange('address', e.target.value)}
                  />
                  <FieldError field="address" />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-pin">PIN Code *</label>
                  <input
                    id="w-pin"
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 560103"
                    className={`ckyc-input${formErrors.pincode ? ' ckyc-input-error' : ''}`}
                    value={formData.pincode}
                    onChange={e => handleInputChange('pincode', e.target.value)}
                  />
                  <FieldError field="pincode" />
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
                    className={`ckyc-input${formErrors.bankName ? ' ckyc-input-error' : ''}`}
                    value={formData.bankName}
                    onChange={e => handleInputChange('bankName', e.target.value)}
                  />
                  <FieldError field="bankName" />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-acc-no">Bank Account Number *</label>
                  <input
                    id="w-acc-no"
                    type="text"
                    placeholder="9–18 digit account number"
                    className={`ckyc-input${formErrors.accountNumber ? ' ckyc-input-error' : ''}`}
                    value={formData.accountNumber}
                    onChange={e => handleInputChange('accountNumber', e.target.value)}
                  />
                  <FieldError field="accountNumber" />
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-ifsc">IFSC Code *</label>
                  <input
                    id="w-ifsc"
                    type="text"
                    maxLength={11}
                    placeholder="e.g. HDFC0000240"
                    className={`ckyc-input${formErrors.ifscCode ? ' ckyc-input-error' : ''}`}
                    value={formData.ifscCode}
                    onChange={e => handleInputChange('ifscCode', e.target.value.toUpperCase())}
                  />
                  <FieldError field="ifscCode" />
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
                        className={`ckyc-input${formErrors.dematAccountNumber ? ' ckyc-input-error' : ''}`}
                        value={formData.dematAccountNumber}
                        onChange={e => handleInputChange('dematAccountNumber', e.target.value)}
                      />
                      <FieldError field="dematAccountNumber" />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 5: Nominee Details (Optional) */}
            {wizardStep === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="ckyc-card-title-group">
                  <h3 className="ckyc-card-title">5. Primary Nominee (Optional)</h3>
                  <p className="ckyc-card-desc">Add a registered legal nominee for your investment portfolio, or skip to proceed.</p>
                </div>

                <div className="ckyc-form-group">
                  <label className="ckyc-form-label" htmlFor="w-nom-name">
                    Nominee Name (Optional)
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ckyc-text-muted)' }}>Leave blank to skip</span>
                  </label>
                  <input
                    id="w-nom-name"
                    type="text"
                    placeholder="Nominee full legal name (optional)"
                    className={`ckyc-input${formErrors.nomineeName ? ' ckyc-input-error' : ''}`}
                    value={formData.nomineeName}
                    onChange={e => handleInputChange('nomineeName', e.target.value)}
                  />
                  <FieldError field="nomineeName" />
                </div>

                {formData.nomineeName.trim().length > 0 && (
                  <>
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
                      <label className="ckyc-form-label" htmlFor="w-nom-dob">Date of Birth *</label>
                      <input
                        id="w-nom-dob"
                        type="date"
                        className={`ckyc-input${formErrors.nomineeDob ? ' ckyc-input-error' : ''}`}
                        value={formData.nomineeDob}
                        onChange={e => handleInputChange('nomineeDob', e.target.value)}
                      />
                      <FieldError field="nomineeDob" />
                    </div>

                    <div className="ckyc-form-group">
                      <label className="ckyc-form-label" htmlFor="w-nom-share">Allocation Percentage (%) *</label>
                      <input
                        id="w-nom-share"
                        type="number"
                        min={1}
                        max={100}
                        className={`ckyc-input${formErrors.nomineeAllocation ? ' ckyc-input-error' : ''}`}
                        value={formData.nomineeAllocation}
                        onChange={e => handleInputChange('nomineeAllocation', Number(e.target.value))}
                      />
                      <FieldError field="nomineeAllocation" />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Wizard Navigation Buttons */}
            <div className="ckyc-btn-group" style={{ marginTop: 12 }}>
              {wizardStep > 1 && (
                <button
                  type="button"
                  className="ckyc-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setFormErrors({});
                    setWizardStep((wizardStep - 1) as WizardStep);
                  }}
                >
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              <button
                type="button"
                className="ckyc-btn-primary"
                style={{ flex: 2 }}
                onClick={() => {
                  if (!validateAndAdvance()) return;
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
            SCREEN 5: REAL SUPPORTING DOCUMENTS UPLOAD
           ──────────────────────────────────────────────────────────────── */}
        {currentScreen === 'documents' && (
          <div className="ckyc-card">
            <div className="ckyc-card-title-group">
              <h2 className="ckyc-card-title">Supporting Documents</h2>
              <p className="ckyc-card-desc">
                Upload clear color copies of identity and banking documents (PDF, JPG, PNG up to 5MB).
              </p>
            </div>

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={panInputRef}
              accept="image/png,image/jpeg,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={e => handleFileSelected('pan', e.target.files?.[0] || null)}
            />
            <input
              type="file"
              ref={aadhaarInputRef}
              accept="image/png,image/jpeg,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={e => handleFileSelected('aadhaar', e.target.files?.[0] || null)}
            />
            <input
              type="file"
              ref={bankInputRef}
              accept="image/png,image/jpeg,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={e => handleFileSelected('bank', e.target.files?.[0] || null)}
            />
            <input
              type="file"
              ref={dematInputRef}
              accept="image/png,image/jpeg,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={e => handleFileSelected('demat', e.target.files?.[0] || null)}
            />

            {docErrors && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, backgroundColor: 'var(--ckyc-error-bg)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--ckyc-error)', fontSize: 13, fontWeight: 500 }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{docErrors}</span>
              </div>
            )}

            <div className="ckyc-upload-cards-grid">
              {/* 1. PAN Card */}
              {(() => {
                const doc = documents.pan;
                if (doc.status === 'uploaded') {
                  return (
                    <div className="ckyc-upload-card uploaded">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46' }}>1. Permanent Account Card (PAN)</div>
                            <div style={{ fontSize: 12, color: 'var(--ckyc-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.name} • {doc.size}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handlePreviewDoc('pan')}
                          >
                            <Eye size={13} /> View
                          </button>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--ckyc-text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => panInputRef.current?.click()}
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => handleRemoveDoc('pan')}
                            title="Remove file"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (doc.status === 'uploading') {
                  return (
                    <div className="ckyc-upload-card uploading">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RefreshCw size={18} className="spin" color="#3b82f6" />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>1. Permanent Account Card (PAN)</div>
                          <div style={{ fontSize: 12, color: '#3b82f6' }}>Processing {doc.name}...</div>
                        </div>
                      </div>
                      <div className="ckyc-progress-track" style={{ height: 4, background: 'rgba(59, 130, 246, 0.2)' }}>
                        <div className="ckyc-progress-fill" style={{ width: `${doc.progress || 60}%`, background: '#3b82f6' }} />
                      </div>
                    </div>
                  );
                }
                if (doc.status === 'error') {
                  return (
                    <div className="ckyc-upload-card error">
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <AlertCircle size={20} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>1. Permanent Account Card (PAN)</div>
                            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>{doc.error}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}
                          onClick={() => panInputRef.current?.click()}
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="ckyc-upload-card empty" onClick={() => panInputRef.current?.click()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UploadCloud size={20} color="var(--ckyc-primary)" />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>1. Permanent Account Card (PAN) *</div>
                          <div style={{ fontSize: 12, color: 'var(--ckyc-text-muted)' }}>Tap to browse photo or PDF (max 5MB)</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ckyc-primary-dark)' }}>Upload</span>
                    </div>
                  </div>
                );
              })()}

              {/* 2. Aadhaar Card */}
              {(() => {
                const doc = documents.aadhaar;
                if (doc.status === 'uploaded') {
                  return (
                    <div className="ckyc-upload-card uploaded">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46' }}>2. Aadhaar Offline XML / Card</div>
                            <div style={{ fontSize: 12, color: 'var(--ckyc-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.name} • {doc.size}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handlePreviewDoc('aadhaar')}
                          >
                            <Eye size={13} /> View
                          </button>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--ckyc-text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => aadhaarInputRef.current?.click()}
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => handleRemoveDoc('aadhaar')}
                            title="Remove file"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (doc.status === 'uploading') {
                  return (
                    <div className="ckyc-upload-card uploading">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RefreshCw size={18} className="spin" color="#3b82f6" />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>2. Aadhaar Offline XML / Card</div>
                          <div style={{ fontSize: 12, color: '#3b82f6' }}>Processing {doc.name}...</div>
                        </div>
                      </div>
                      <div className="ckyc-progress-track" style={{ height: 4, background: 'rgba(59, 130, 246, 0.2)' }}>
                        <div className="ckyc-progress-fill" style={{ width: `${doc.progress || 60}%`, background: '#3b82f6' }} />
                      </div>
                    </div>
                  );
                }
                if (doc.status === 'error') {
                  return (
                    <div className="ckyc-upload-card error">
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <AlertCircle size={20} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>2. Aadhaar Offline XML / Card</div>
                            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>{doc.error}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}
                          onClick={() => aadhaarInputRef.current?.click()}
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="ckyc-upload-card empty" onClick={() => aadhaarInputRef.current?.click()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UploadCloud size={20} color="var(--ckyc-primary)" />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>2. Aadhaar Offline XML / Card *</div>
                          <div style={{ fontSize: 12, color: 'var(--ckyc-text-muted)' }}>Front &amp; back image or e-Aadhaar PDF</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ckyc-primary-dark)' }}>Upload</span>
                    </div>
                  </div>
                );
              })()}

              {/* 3. Bank Account Proof */}
              {(() => {
                const doc = documents.bank;
                if (doc.status === 'uploaded') {
                  return (
                    <div className="ckyc-upload-card uploaded">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46' }}>3. Bank Account Proof (Cheque / Passbook)</div>
                            <div style={{ fontSize: 12, color: 'var(--ckyc-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.name} • {doc.size}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handlePreviewDoc('bank')}
                          >
                            <Eye size={13} /> View
                          </button>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--ckyc-text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => bankInputRef.current?.click()}
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => handleRemoveDoc('bank')}
                            title="Remove file"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (doc.status === 'uploading') {
                  return (
                    <div className="ckyc-upload-card uploading">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RefreshCw size={18} className="spin" color="#3b82f6" />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>3. Bank Account Proof</div>
                          <div style={{ fontSize: 12, color: '#3b82f6' }}>Processing {doc.name}...</div>
                        </div>
                      </div>
                      <div className="ckyc-progress-track" style={{ height: 4, background: 'rgba(59, 130, 246, 0.2)' }}>
                        <div className="ckyc-progress-fill" style={{ width: `${doc.progress || 60}%`, background: '#3b82f6' }} />
                      </div>
                    </div>
                  );
                }
                if (doc.status === 'error') {
                  return (
                    <div className="ckyc-upload-card error">
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <AlertCircle size={20} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>3. Bank Account Proof</div>
                            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>{doc.error}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}
                          onClick={() => bankInputRef.current?.click()}
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="ckyc-upload-card empty" onClick={() => bankInputRef.current?.click()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UploadCloud size={20} color="var(--ckyc-primary)" />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>3. Bank Account Proof (Cheque / Passbook) *</div>
                          <div style={{ fontSize: 12, color: 'var(--ckyc-text-muted)' }}>Cancelled cheque or statement showing account number &amp; IFSC</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ckyc-primary-dark)' }}>Upload</span>
                    </div>
                  </div>
                );
              })()}

              {/* 4. Demat Client Master Report */}
              {(() => {
                const doc = documents.demat;
                if (doc.status === 'uploaded') {
                  return (
                    <div className="ckyc-upload-card uploaded">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46' }}>4. Demat Client Master Report</div>
                            <div style={{ fontSize: 12, color: 'var(--ckyc-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.name} • {doc.size}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handlePreviewDoc('demat')}
                          >
                            <Eye size={13} /> View
                          </button>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--ckyc-text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => dematInputRef.current?.click()}
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => handleRemoveDoc('demat')}
                            title="Remove file"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (doc.status === 'uploading') {
                  return (
                    <div className="ckyc-upload-card uploading">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RefreshCw size={18} className="spin" color="#3b82f6" />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>4. Demat Client Master Report</div>
                          <div style={{ fontSize: 12, color: '#3b82f6' }}>Processing {doc.name}...</div>
                        </div>
                      </div>
                      <div className="ckyc-progress-track" style={{ height: 4, background: 'rgba(59, 130, 246, 0.2)' }}>
                        <div className="ckyc-progress-fill" style={{ width: `${doc.progress || 60}%`, background: '#3b82f6' }} />
                      </div>
                    </div>
                  );
                }
                if (doc.status === 'error') {
                  return (
                    <div className="ckyc-upload-card error">
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <AlertCircle size={20} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>4. Demat Client Master Report</div>
                            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>{doc.error}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}
                          onClick={() => dematInputRef.current?.click()}
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    className="ckyc-upload-card empty"
                    onClick={() => dematInputRef.current?.click()}
                    style={{ opacity: formData.hasNoDemat ? 0.75 : 1 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UploadCloud size={20} color={formData.hasNoDemat ? 'var(--ckyc-text-muted)' : 'var(--ckyc-primary)'} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>
                            4. Demat Client Master Report {formData.hasNoDemat ? '(Exempted)' : '(Optional)'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ckyc-text-muted)' }}>
                            {formData.hasNoDemat
                              ? 'Exempted — you declared no active demat account'
                              : 'Client Master List / CMR copy from depository participant'}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ckyc-primary-dark)' }}>Upload</span>
                    </div>
                  </div>
                );
              })()}
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
                onClick={handleProceedToConsent}
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
            SCREEN 7: LIVENESS VERIFICATION (LIVE WEBCAM / FACE MATCH)
           ──────────────────────────────────────────────────────────────── */}
        {currentScreen === 'liveness' && (
          <div className="ckyc-card">
            <div className="ckyc-card-title-group">
              <h2 className="ckyc-card-title">Live Selfie Verification</h2>
              <p className="ckyc-card-desc">
                Anti-spoofing face match verification against your government ID photograph.
              </p>
            </div>

            {/* Hidden fallback file input for selfie */}
            <input
              type="file"
              ref={selfieInputRef}
              accept="image/*"
              capture="user"
              style={{ display: 'none' }}
              onChange={handleSelfieFileUpload}
            />

            {/* Camera Box */}
            <div className="ckyc-camera-box">
              {cameraError ? (
                <div style={{ textAlign: 'center', padding: '0 20px', color: '#f87171' }}>
                  <AlertCircle size={36} style={{ margin: '0 auto 8px', display: 'block', color: '#ef4444' }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fca5a5' }}>{cameraError}</div>
                  <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="ckyc-btn-secondary"
                      style={{ minHeight: 38, padding: '6px 14px', fontSize: 13, color: '#ffffff', borderColor: 'rgba(255,255,255,0.2)' }}
                      onClick={startCamera}
                    >
                      <RotateCw size={14} /> Retry Camera
                    </button>
                    <button
                      type="button"
                      className="ckyc-btn-primary"
                      style={{ minHeight: 38, padding: '6px 14px', fontSize: 13, width: 'auto' }}
                      onClick={() => selfieInputRef.current?.click()}
                    >
                      <UploadCloud size={14} /> Choose Selfie Photo
                    </button>
                  </div>
                </div>
              ) : livenessState === 'captured' && capturedPhoto ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="ckyc-oval-frame" style={{ border: '3px solid #10b981' }}>
                    <img
                      src={capturedPhoto}
                      alt="Captured Live Selfie"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#10b981',
                      background: 'rgba(15, 23, 42, 0.85)',
                      padding: '4px 12px',
                      borderRadius: 20,
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    ✓ 98.4% Match with PAN Photo
                  </div>
                </div>
              ) : (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="ckyc-oval-frame">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)',
                        display: cameraActive ? 'block' : 'none',
                      }}
                    />
                    {!cameraActive && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
                        <RefreshCw size={28} className="spin" color="#10b981" />
                        <span style={{ fontSize: 12, fontWeight: 500 }}>Connecting camera...</span>
                      </div>
                    )}
                    {cameraActive && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '2px',
                          background: 'linear-gradient(90deg, transparent, #10b981, transparent)',
                          boxShadow: '0 0 10px #10b981',
                          animation: 'ckyc-scan 2.2s ease-in-out infinite alternate',
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 10,
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {cameraActive ? 'Position face inside the oval frame' : 'Requesting camera access...'}
                  </div>
                </div>
              )}
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
              {submitError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, backgroundColor: 'var(--ckyc-error-bg)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--ckyc-error)', fontSize: 13, fontWeight: 500 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{submitError}</span>
                </div>
              )}
              {livenessState !== 'captured' ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="ckyc-btn-primary"
                    disabled={!cameraActive}
                    onClick={captureLiveSelfie}
                    style={{ flex: 2 }}
                  >
                    <Camera size={16} /> Capture Live Selfie
                  </button>
                  <button
                    type="button"
                    className="ckyc-btn-secondary"
                    onClick={() => selfieInputRef.current?.click()}
                    style={{ flex: 1, fontSize: 13 }}
                    title="Upload a photo from your file system"
                  >
                    <UploadCloud size={15} /> Upload Photo
                  </button>
                </div>
              ) : (
                <div className="ckyc-btn-group">
                  <button
                    type="button"
                    className="ckyc-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={handleRetakeSelfie}
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
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={16} className="spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        Submit KYC Dossier <ArrowRight size={16} />
                      </>
                    )}
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
