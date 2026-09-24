import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileCheck,
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Eye,
  ShieldCheck,
  User,
  Upload,
  X,
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  Building,
  CreditCard,
  Layers,
  Users,
} from 'lucide-react';
import { Deal, DealActivity, DocumentItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Modal } from '../../components/common/Modal';
import './KYCPage.css';

// ── Types for GHL IRM 5-Step Flow ──────────────────────────────────────────────
interface NomineeItem {
  id: string;
  name: string;
  relationship: string;
  dob: string;
  allocationPercentage: number;
  address: string;
  guardianName: string;
}

interface KYCFormData {
  // Step 1: Basic Details
  investorName: string;
  phone: string;
  email: string;
  gender: string;
  investorType: string;
  residentType: string;

  // Step 2: Identity Details
  panNumber: string;
  nameAsPerPan: string;
  aadhaarNumber: string;
  fatherName: string;
  dob: string;
  address: string;
  courierAddress: string;
  country: string;
  state: string;
  city: string;
  pincode: string;
  aadhaarDoc: { name: string; size: string; type: string } | null;
  panDoc: { name: string; size: string; type: string } | null;

  // Step 3: Bank Details
  accountType: string;
  accountNumber: string;
  ifscCode: string;
  swiftCode: string;
  accountHolderName: string;
  bankName: string;
  branchName: string;
  bankProofDoc: { name: string; size: string; type: string } | null;

  // Step 4: Demat Account
  hasNoDemat: boolean;
  dematAccountNumber: string;
  dematDoc: { name: string; size: string; type: string } | null;

  // Step 5: Nominee Details
  nominees: NomineeItem[];
}

const INITIAL_NOMINEE: NomineeItem = {
  id: 'nom-1',
  name: '',
  relationship: 'Spouse',
  dob: '',
  allocationPercentage: 100,
  address: '',
  guardianName: '',
};

const BLANK_KYC_FORM: KYCFormData = {
  investorName: '',
  phone: '+91 ',
  email: '',
  gender: 'Male',
  investorType: 'Individual / Retail HNW',
  residentType: 'Resident Indian (RI)',

  panNumber: '',
  nameAsPerPan: '',
  aadhaarNumber: '',
  fatherName: '',
  dob: '',
  address: '',
  courierAddress: '',
  country: 'India',
  state: '',
  city: '',
  pincode: '',
  aadhaarDoc: null,
  panDoc: null,

  accountType: 'Savings',
  accountNumber: '',
  ifscCode: '',
  swiftCode: '',
  accountHolderName: '',
  bankName: '',
  branchName: '',
  bankProofDoc: null,

  hasNoDemat: false,
  dematAccountNumber: '',
  dematDoc: null,

  nominees: [INITIAL_NOMINEE],
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── File Upload Helper Card ───────────────────────────────────────────────────
interface KYCUploadProps {
  label: string;
  required?: boolean;
  doc: { name: string; size: string; type: string } | null;
  error?: string;
  onUpload: (doc: { name: string; size: string; type: string }) => void;
  onRemove: () => void;
}

const KYCUploadCard: React.FC<KYCUploadProps> = ({
  label,
  required,
  doc,
  error,
  onUpload,
  onRemove,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    onUpload({
      name: file.name,
      size: formatBytes(file.size),
      type: file.type || 'application/pdf',
    });
  };

  return (
    <div className="form-group" style={{ marginBottom: 12 }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</span>
        {doc && <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>✓ Uploaded</span>}
      </label>

      {doc ? (
        <div className="kyc-uploaded-card">
          <div className="kyc-uploaded-info">
            <FileText size={18} color="#10b981" />
            <div>
              <div className="kyc-uploaded-name" title={doc.name}>{doc.name}</div>
              <div className="kyc-uploaded-size">{doc.size}</div>
            </div>
          </div>
          <button
            type="button"
            className="kyc-remove-upload-btn"
            title="Remove document"
            onClick={onRemove}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div>
          <div
            className={`kyc-upload-dropzone ${error ? 'has-error' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <Upload size={22} color="var(--primary-600)" />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Click to upload or drag & drop
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              PDF, JPG, PNG up to 15 MB
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              if (inputRef.current) inputRef.current.value = '';
            }}
          />
        </div>
      )}

      {error && <div className="kyc-field-error">{error}</div>}
    </div>
  );
};

// ==============================================================================
// GHL INDIA VENTURES -> IRM KYC EXPERIENCE
// ==============================================================================
const GhlIrmKycView: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [deals, setDeals] = useState<Deal[]>([]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // View state: 'table' or 'flow'
  const [viewMode, setViewMode] = useState<'table' | 'flow'>('table');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Dossier modal for table preview
  const [selectedDealForDetail, setSelectedDealForDetail] = useState<Deal | null>(null);

  // Form State
  const [formData, setFormData] = useState<KYCFormData>(BLANK_KYC_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [sameAsPermanent, setSameAsPermanent] = useState(false);

  const loadData = () => {
    const allDeals = storageService.getDeals(tenant?.id);
    setDeals(allDeals.filter(d => d.stage === 'qualified_investor'));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getDaysInStage = (deal: Deal) => {
    const timestamp = deal.stageEnteredAt || deal.createdAt;
    if (!timestamp) return 0;
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) return 0;
    const diffMs = new Date().getTime() - time;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Helper to open the 5-step wizard prefilled with deal info
  const startKycFlow = (deal?: Deal) => {
    const targetDeal = deal || null;
    setSelectedDeal(targetDeal);

    // Check if there is existing saved KYC data for this deal
    const savedKycKey = targetDeal ? `nexus_kyc_data_${targetDeal.id}` : null;
    let initialForm = BLANK_KYC_FORM;

    if (savedKycKey) {
      try {
        const existing = localStorage.getItem(savedKycKey);
        if (existing) {
          initialForm = JSON.parse(existing);
        }
      } catch {
        // fallback
      }
    }

    if (targetDeal && (!savedKycKey || !localStorage.getItem(savedKycKey))) {
      initialForm = {
        ...BLANK_KYC_FORM,
        investorName: targetDeal.customerName || '',
        phone: targetDeal.phone || '+91 ',
        email: targetDeal.email || '',
        city: targetDeal.location || '',
        nameAsPerPan: targetDeal.customerName || '',
        accountHolderName: targetDeal.customerName || '',
      };
    }

    setFormData(initialForm);
    setFormErrors({});
    setCurrentStep(1);
    setViewMode('flow');
  };

  // Advance deal to opportunity
  const handleAdvanceStage = (deal: Deal) => {
    const updatedDeal: Deal = {
      ...deal,
      stage: 'investment_opportunity',
      stageEnteredAt: new Date().toISOString(),
    };
    storageService.saveDeal(updatedDeal);

    const activity: DealActivity = {
      id: `act-${Date.now()}`,
      dealId: deal.id,
      companyId: tenant?.id || '',
      type: 'stage_change',
      fromStage: 'qualified_investor',
      toStage: 'investment_opportunity',
      text: 'Qualified Investor → Investment Opportunity (KYC Verified)',
      loggedByName: user?.name || 'IRM User',
      loggedByRole: 'IRM',
      timestamp: new Date().toISOString(),
    };
    storageService.addDealActivity(activity);

    if (selectedDealForDetail?.id === deal.id) {
      setSelectedDealForDetail(null);
    }

    loadData();
    showToast(`Investor "${deal.customerName}" advanced to Investment Opportunity!`);
  };

  // IFSC Lookup Logic
  const handleIfscChange = async (val: string) => {
    const ifsc = val.toUpperCase().trim();
    setFormData(prev => ({ ...prev, ifscCode: ifsc }));

    if (formErrors.ifscCode) {
      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy.ifscCode;
        return copy;
      });
    }

    // Known bank prefix deduction
    const prefix = ifsc.slice(0, 4);
    const bankPrefixMap: Record<string, string> = {
      HDFC: 'HDFC Bank',
      SBIN: 'State Bank of India',
      ICIC: 'ICICI Bank',
      UTIB: 'Axis Bank',
      KKBK: 'Kotak Mahindra Bank',
      PUNB: 'Punjab National Bank',
      BARB: 'Bank of Baroda',
      YESB: 'Yes Bank',
      IDFB: 'IDFC FIRST Bank',
      INDB: 'IndusInd Bank',
      CNRB: 'Canara Bank',
      UBIN: 'Union Bank of India',
    };

    if (bankPrefixMap[prefix] && !formData.bankName) {
      setFormData(prev => ({ ...prev, bankName: bankPrefixMap[prefix] }));
    }

    // If 11 chars, lookup branch from public ifsc endpoint
    if (ifsc.length === 11) {
      try {
        const res = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
        if (res.ok) {
          const data = await res.json();
          setFormData(prev => ({
            ...prev,
            bankName: data.BANK || prev.bankName,
            branchName: data.BRANCH || prev.branchName,
          }));
        }
      } catch {
        // silent fallback
      }
    }
  };

  // ── Step Validations ────────────────────────────────────────────────────────
  const validateStep = (step: number): boolean => {
    const errs: Record<string, string> = {};

    if (step === 1) {
      // Step 1: Basic Details
      if (!formData.investorName.trim()) {
        errs.investorName = 'Investor Name is required';
      }
      const digits = formData.phone.replace(/\D/g, '');
      if (!formData.phone.trim() || digits.length < 10) {
        errs.phone = 'Valid phone number with at least 10 digits is required';
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
        errs.email = 'Valid email address is required';
      }
      if (!formData.gender) {
        errs.gender = 'Gender is required';
      }
      if (!formData.investorType) {
        errs.investorType = 'Investor Type is required';
      }
      if (!formData.residentType) {
        errs.residentType = 'Resident Type is required';
      }
    }

    if (step === 2) {
      // Step 2: Identity Details
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      const cleanPan = formData.panNumber.trim().toUpperCase();
      if (!cleanPan) {
        errs.panNumber = 'PAN Number is required';
      } else if (!panRegex.test(cleanPan)) {
        errs.panNumber = 'Invalid PAN format (e.g. ABCDE1234F)';
      }

      if (!formData.nameAsPerPan.trim()) {
        errs.nameAsPerPan = 'Name as per PAN is required';
      }

      const cleanAadhaar = formData.aadhaarNumber.replace(/\D/g, '');
      if (!cleanAadhaar) {
        errs.aadhaarNumber = 'Aadhaar Number is required';
      } else if (cleanAadhaar.length !== 12) {
        errs.aadhaarNumber = 'Aadhaar Number must be exactly 12 digits';
      }

      if (!formData.fatherName.trim()) {
        errs.fatherName = "Father's Name is required";
      }
      if (!formData.dob.trim()) {
        errs.dob = 'Date of Birth is required';
      }
      if (!formData.address.trim()) {
        errs.address = 'Permanent Address is required';
      }
      if (!formData.courierAddress.trim()) {
        errs.courierAddress = 'Courier / Current Address is required';
      }
      if (!formData.country.trim()) {
        errs.country = 'Country is required';
      }
      if (!formData.state.trim()) {
        errs.state = 'State is required';
      }
      if (!formData.city.trim()) {
        errs.city = 'City is required';
      }
      const cleanPincode = formData.pincode.replace(/\D/g, '');
      if (!cleanPincode) {
        errs.pincode = 'Pincode is required';
      } else if (cleanPincode.length !== 6) {
        errs.pincode = 'Pincode must be exactly 6 digits';
      }

      if (!formData.aadhaarDoc) {
        errs.aadhaarDoc = 'Upload Aadhaar is required';
      }
      if (!formData.panDoc) {
        errs.panDoc = 'Upload PAN is required';
      }
    }

    if (step === 3) {
      // Step 3: Bank Details
      if (!formData.accountType) {
        errs.accountType = 'Account Type is required';
      }
      if (!formData.accountNumber.trim()) {
        errs.accountNumber = 'Account Number is required';
      }
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      const cleanIfsc = formData.ifscCode.trim().toUpperCase();
      if (!cleanIfsc) {
        errs.ifscCode = 'IFSC Code is required';
      } else if (!ifscRegex.test(cleanIfsc)) {
        errs.ifscCode = 'Invalid IFSC format (e.g. HDFC0001234)';
      }
      if (!formData.accountHolderName.trim()) {
        errs.accountHolderName = 'Account Holder Name is required';
      }
      if (!formData.bankName.trim()) {
        errs.bankName = 'Bank Name is required';
      }
      if (!formData.bankProofDoc) {
        errs.bankProofDoc = 'Upload Bank Statement / Cheque / Passbook is required';
      }
    }

    if (step === 4) {
      // Step 4: Demat Account
      if (!formData.hasNoDemat) {
        if (!formData.dematAccountNumber.trim()) {
          errs.dematAccountNumber = 'Demat Account Number is required';
        }
        if (!formData.dematDoc) {
          errs.dematDoc = 'Upload Demat Statement is required';
        }
      }
    }

    if (step === 5) {
      // Step 5: Nominee Details
      if (formData.nominees.length === 0) {
        errs.nominees = 'Please add at least one nominee';
      } else {
        formData.nominees.forEach((nom, idx) => {
          if (!nom.name.trim()) {
            errs[`nominee_${idx}_name`] = 'Nominee Name is required';
          }
          if (!nom.dob.trim()) {
            errs[`nominee_${idx}_dob`] = 'Nominee DOB / Age is required';
          }
          if (!nom.allocationPercentage || nom.allocationPercentage <= 0) {
            errs[`nominee_${idx}_pct`] = 'Allocation % must be greater than 0';
          }
        });
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = () => {
    if (validateStep(currentStep)) {
      setFormErrors({});
      if (currentStep < 5) {
        setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5);
      }
    }
  };

  const handleBack = () => {
    setFormErrors({});
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5);
    } else {
      setViewMode('table');
    }
  };

  // Submit KYC for Review
  const handleSubmitKycForReview = () => {
    if (!validateStep(5)) return;

    const investorName = formData.investorName.trim();
    const dealId = selectedDeal ? selectedDeal.id : `deal-${Date.now()}`;

    // 1. Persist full KYC form data in localStorage
    localStorage.setItem(`nexus_kyc_data_${dealId}`, JSON.stringify(formData));
    localStorage.setItem(`nexus_kyc_status_${dealId}`, 'Submitted for Review');

    // 2. Persist Document metadata in storageService
    const nowStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const docsToSave: Array<{ name: string; size: string; type: string; category: string }> = [];
    if (formData.aadhaarDoc) {
      docsToSave.push({ ...formData.aadhaarDoc, category: 'KYC - Aadhaar' });
    }
    if (formData.panDoc) {
      docsToSave.push({ ...formData.panDoc, category: 'KYC - PAN' });
    }
    if (formData.bankProofDoc) {
      docsToSave.push({ ...formData.bankProofDoc, category: 'KYC - Bank Proof' });
    }
    if (formData.dematDoc && !formData.hasNoDemat) {
      docsToSave.push({ ...formData.dematDoc, category: 'KYC - Demat Statement' });
    }

    docsToSave.forEach(d => {
      const docItem: DocumentItem = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: d.name,
        size: d.size,
        type: d.type,
        uploadedBy: user?.name || 'IRM User',
        uploadedAt: nowStr,
        category: d.category,
        entityType: 'investor',
        entityId: dealId,
      };
      storageService.saveDocument(docItem);
    });

    // 3. Log deal activity
    if (selectedDeal) {
      const activity: DealActivity = {
        id: `act-${Date.now()}`,
        dealId: selectedDeal.id,
        companyId: tenant?.id || '',
        type: 'note',
        text: `KYC & Documents submitted for review (Basic, Identity, Bank, Demat: ${formData.hasNoDemat ? 'Skipped' : 'Provided'}, Nominees: ${formData.nominees.length}).`,
        loggedByName: user?.name || 'IRM User',
        loggedByRole: 'IRM',
        timestamp: new Date().toISOString(),
      };
      storageService.addDealActivity(activity);
    }

    // 4. Update deal or create qualified deal if new
    if (selectedDeal) {
      const updatedDeal: Deal = {
        ...selectedDeal,
        notes: selectedDeal.notes ? `${selectedDeal.notes} | KYC Submitted` : 'KYC Submitted for Review',
      };
      storageService.saveDeal(updatedDeal);
    }

    loadData();
    showToast(`KYC & Documents for "${investorName}" submitted for review!`);
    setViewMode('table');
  };

  // Nominee helpers
  const handleAddNominee = () => {
    const newNominee: NomineeItem = {
      id: `nom-${Date.now()}`,
      name: '',
      relationship: 'Spouse',
      dob: '',
      allocationPercentage: 50,
      address: '',
      guardianName: '',
    };
    setFormData(prev => ({
      ...prev,
      nominees: [...prev.nominees, newNominee],
    }));
  };

  const handleRemoveNominee = (id: string) => {
    setFormData(prev => ({
      ...prev,
      nominees: prev.nominees.filter(n => n.id !== id),
    }));
  };

  const handleNomineeChange = (id: string, field: keyof NomineeItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      nominees: prev.nominees.map(n => (n.id === id ? { ...n, [field]: value } : n)),
    }));
  };

  const filteredDeals = deals;

  const getDealKycStatus = (deal: Deal) => {
    const status = localStorage.getItem(`nexus_kyc_status_${deal.id}`);
    if (status === 'Submitted for Review') {
      return (
        <span className="kyc-badge-review">
          <Clock size={12} /> Under Review
        </span>
      );
    }
    return (
      <span className="kyc-badge-verified">
        <CheckCircle size={12} /> SEBI KYC Validated
      </span>
    );
  };

  const columns: Column<Deal>[] = [
    {
      key: 'customerName',
      header: 'Investor & Deal',
      sortable: true,
      render: deal => (
        <div>
          <div className="kyc-customer-name">{deal.customerName}</div>
          <div className="kyc-deal-subtitle">{deal.title}</div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Details',
      render: deal => (
        <div className="kyc-contact-info">
          {deal.phone && (
            <div className="kyc-contact-row">
              <Phone size={12} color="var(--text-muted)" />
              <span>{deal.phone}</span>
            </div>
          )}
          {deal.email && (
            <div className="kyc-contact-row">
              <Mail size={12} color="var(--text-muted)" />
              <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deal.email}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: deal => (
        <div className="kyc-contact-row" style={{ fontSize: 12 }}>
          <MapPin size={12} color="var(--text-muted)" />
          <span>{deal.location || '—'}</span>
        </div>
      ),
    },
    {
      key: 'investmentRange',
      header: 'Investment Capacity',
      sortable: true,
      render: deal => (
        <span style={{ color: '#10b981', fontWeight: 800, fontSize: 13 }}>
          {deal.investmentRange || formatCurrency(deal.value)}
        </span>
      ),
    },
    {
      key: 'preferredAssetClass',
      header: 'Preferred Asset Class',
      render: deal => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {deal.preferredAssetClass || 'Commercial Pre-Leased'}
        </span>
      ),
    },
    {
      key: 'kycStatus',
      header: 'KYC Document Status',
      render: deal => getDealKycStatus(deal),
    },
    {
      key: 'assignedAgentName',
      header: 'Assigned IRM',
      render: deal => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {deal.assignedAgentName || 'Ananya Iyer'}
        </span>
      ),
    },
    {
      key: 'stageEnteredAt',
      header: 'Stage Duration',
      render: deal => {
        const days = getDaysInStage(deal);
        return (
          <span className="kyc-days-pill">
            <Clock size={11} /> {days}d
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Stage Action',
      render: deal => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-icon"
            title={`Call ${deal.customerName}`}
            onClick={() => initiateCall(deal.customerName, deal.phone || '', 'customer', deal.id)}
          >
            <Phone size={14} color="#059669" />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            title="Complete 5-step KYC & Documents flow"
            style={{ fontSize: 11, padding: '4px 8px', fontWeight: 600 }}
            onClick={() => startKycFlow(deal)}
          >
            <FileCheck size={13} style={{ marginRight: 4 }} /> KYC Flow
          </button>
          <button
            type="button"
            className="kyc-advance-btn"
            title="Advance stage to Investment Opportunity"
            onClick={() => handleAdvanceStage(deal)}
          >
            Advance <ArrowRight size={13} />
          </button>
        </div>
      ),
    },
  ];

  const rowActions: RowAction<Deal>[] = [
    {
      label: 'Complete / Edit KYC Flow',
      icon: <FileCheck size={14} style={{ marginRight: 6 }} color="#06b6d4" />,
      onClick: deal => startKycFlow(deal),
    },
    {
      label: 'View KYC Dossier',
      icon: <Eye size={14} style={{ marginRight: 6 }} />,
      onClick: deal => setSelectedDealForDetail(deal),
    },
    {
      label: 'Call Investor',
      icon: <Phone size={14} color="#059669" style={{ marginRight: 6 }} />,
      onClick: deal => initiateCall(deal.customerName, deal.phone || '', 'customer', deal.id),
    },
    {
      label: 'Advance to Opportunity',
      icon: <ArrowRight size={14} color="var(--primary-600)" style={{ marginRight: 6 }} />,
      onClick: deal => handleAdvanceStage(deal),
    },
  ];

  const stepTitles = [
    { step: 1, label: 'Basic Details', icon: <User size={16} /> },
    { step: 2, label: 'Identity Details', icon: <ShieldCheck size={16} /> },
    { step: 3, label: 'Bank Details', icon: <Building size={16} /> },
    { step: 4, label: 'Demat Account', icon: <CreditCard size={16} /> },
    { step: 5, label: 'Nominee Details', icon: <Users size={16} /> },
  ];

  return (
    <div className="kyc-page-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            backgroundColor: '#059669',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <CheckCircle size={18} /> {toastMessage}
        </div>
      )}

      {viewMode === 'table' ? (
        <>
          {/* Header */}
          <div className="page-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 className="page-title">
                <FileCheck size={24} color="#06b6d4" /> Qualified Investor & KYC Verification
              </h1>
              <p className="page-subtitle">
                SEBI compliance checked, ticket size verified, KYC validated investors ready for investment opportunities.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => startKycFlow()}
            >
              <Plus size={16} /> Start KYC Verification
            </button>
          </div>

          {/* Data Table */}
          <DataTable
            data={filteredDeals}
            columns={columns}
            rowActions={rowActions}
            keyExtractor={d => d.id}
            searchPlaceholder="Search by investor, phone, city..."
            searchFilter={(deal, q) => {
              const matchName = deal.customerName?.toLowerCase().includes(q);
              const matchPhone = deal.phone?.toLowerCase().includes(q);
              const matchTitle = deal.title?.toLowerCase().includes(q);
              const matchLocation = deal.location?.toLowerCase().includes(q);
              return Boolean(matchName || matchPhone || matchTitle || matchLocation);
            }}
            emptyTitle="No Qualified Investors"
            emptyDescription="No investors currently in the Qualified Investor / KYC stage."

          />
        </>
      ) : (
        /* ── 5-STEP KYC FLOW CONTAINER ── */
        <div className="kyc-flow-card">
          {/* Top Bar with Back to Table link */}
          <div className="kyc-flow-top-bar">
            <div>
              <button
                type="button"
                className="kyc-flow-back-btn"
                onClick={() => setViewMode('table')}
              >
                <ArrowLeft size={16} /> Back to Qualified Investors
              </button>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedDeal ? selectedDeal.customerName : formData.investorName || 'New Investor KYC'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                SEBI Regulated AIF • Cat-II Investor Onboarding
              </div>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="kyc-stepper-wrapper">
            <div className="kyc-stepper">
              <div className="kyc-stepper-line-bg" />
              <div
                className="kyc-stepper-line-progress"
                style={{
                  width: `${((currentStep - 1) / 4) * 100}%`,
                }}
              />
              {stepTitles.map(item => {
                const isCompleted = item.step < currentStep;
                const isActive = item.step === currentStep;
                return (
                  <div
                    key={item.step}
                    className={`kyc-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                    onClick={() => {
                      if (item.step < currentStep) {
                        setCurrentStep(item.step as 1 | 2 | 3 | 4 | 5);
                      }
                    }}
                  >
                    <div className="kyc-step-circle">
                      {isCompleted ? <CheckCircle size={18} /> : item.step}
                    </div>
                    <div className="kyc-step-label">{item.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Form Body */}
          <div className="kyc-step-body">
            {/* ── STEP 1: BASIC DETAILS ── */}
            {currentStep === 1 && (
              <div>
                <div className="kyc-step-header">
                  <h2 className="kyc-step-title">
                    <User size={20} color="var(--primary-600)" /> Step 1: Basic Details
                  </h2>
                  <p className="kyc-step-subtitle">
                    Enter basic investor contact and demographic profile information.
                  </p>
                </div>

                <div className="kyc-form-grid">
                  <div className="form-group">
                    <label className="form-label">Investor Name *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.investorName ? 'kyc-input-error' : ''}`}
                      placeholder="e.g. Ramesh Chandra Verma"
                      value={formData.investorName}
                      onChange={e => {
                        setFormData({ ...formData, investorName: e.target.value });
                        if (formErrors.investorName) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.investorName; return c; });
                        }
                      }}
                    />
                    {formErrors.investorName && <div className="kyc-field-error">{formErrors.investorName}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.phone ? 'kyc-input-error' : ''}`}
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={e => {
                        setFormData({ ...formData, phone: e.target.value });
                        if (formErrors.phone) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.phone; return c; });
                        }
                      }}
                    />
                    {formErrors.phone && <div className="kyc-field-error">{formErrors.phone}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className={`form-input ${formErrors.email ? 'kyc-input-error' : ''}`}
                      placeholder="e.g. ramesh.verma@example.com"
                      value={formData.email}
                      onChange={e => {
                        setFormData({ ...formData, email: e.target.value });
                        if (formErrors.email) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.email; return c; });
                        }
                      }}
                    />
                    {formErrors.email && <div className="kyc-field-error">{formErrors.email}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gender *</label>
                    <select
                      className={`form-select ${formErrors.gender ? 'kyc-input-error' : ''}`}
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    {formErrors.gender && <div className="kyc-field-error">{formErrors.gender}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Investor Type *</label>
                    <select
                      className={`form-select ${formErrors.investorType ? 'kyc-input-error' : ''}`}
                      value={formData.investorType}
                      onChange={e => setFormData({ ...formData, investorType: e.target.value })}
                    >
                      <option value="Individual / Retail HNW">Individual / Retail HNW</option>
                      <option value="HUF (Hindu Undivided Family)">HUF (Hindu Undivided Family)</option>
                      <option value="Corporate / Private Ltd">Corporate / Private Ltd</option>
                      <option value="Partnership / LLP">Partnership / LLP</option>
                      <option value="Family Office / AIF">Family Office / AIF</option>
                      <option value="Trust / Society">Trust / Society</option>
                    </select>
                    {formErrors.investorType && <div className="kyc-field-error">{formErrors.investorType}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Resident Type *</label>
                    <select
                      className={`form-select ${formErrors.residentType ? 'kyc-input-error' : ''}`}
                      value={formData.residentType}
                      onChange={e => setFormData({ ...formData, residentType: e.target.value })}
                    >
                      <option value="Resident Indian (RI)">Resident Indian (RI)</option>
                      <option value="Non-Resident Indian (NRI)">Non-Resident Indian (NRI)</option>
                      <option value="Overseas Citizen of India (OCI)">Overseas Citizen of India (OCI)</option>
                      <option value="Person of Indian Origin (PIO)">Person of Indian Origin (PIO)</option>
                      <option value="Foreign National">Foreign National</option>
                    </select>
                    {formErrors.residentType && <div className="kyc-field-error">{formErrors.residentType}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: IDENTITY DETAILS ── */}
            {currentStep === 2 && (
              <div>
                <div className="kyc-step-header">
                  <h2 className="kyc-step-title">
                    <ShieldCheck size={20} color="var(--primary-600)" /> Step 2: Identity Details
                  </h2>
                  <p className="kyc-step-subtitle">
                    Permanent Account Number (PAN), Aadhaar, address verification, and government ID uploads.
                  </p>
                </div>

                <div className="kyc-form-grid">
                  <div className="form-group">
                    <label className="form-label">PAN Number *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.panNumber ? 'kyc-input-error' : ''}`}
                      placeholder="e.g. ABCDE1234F"
                      maxLength={10}
                      value={formData.panNumber}
                      onChange={e => {
                        const val = e.target.value.toUpperCase();
                        setFormData({ ...formData, panNumber: val });
                        if (formErrors.panNumber) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.panNumber; return c; });
                        }
                      }}
                    />
                    {formErrors.panNumber && <div className="kyc-field-error">{formErrors.panNumber}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Name (As per PAN) *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.nameAsPerPan ? 'kyc-input-error' : ''}`}
                      placeholder="Full legal name"
                      value={formData.nameAsPerPan}
                      onChange={e => {
                        setFormData({ ...formData, nameAsPerPan: e.target.value });
                        if (formErrors.nameAsPerPan) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.nameAsPerPan; return c; });
                        }
                      }}
                    />
                    {formErrors.nameAsPerPan && <div className="kyc-field-error">{formErrors.nameAsPerPan}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Aadhaar Number *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.aadhaarNumber ? 'kyc-input-error' : ''}`}
                      placeholder="12-digit Aadhaar number"
                      maxLength={14}
                      value={formData.aadhaarNumber}
                      onChange={e => {
                        setFormData({ ...formData, aadhaarNumber: e.target.value });
                        if (formErrors.aadhaarNumber) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.aadhaarNumber; return c; });
                        }
                      }}
                    />
                    {formErrors.aadhaarNumber && <div className="kyc-field-error">{formErrors.aadhaarNumber}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Father's Name *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.fatherName ? 'kyc-input-error' : ''}`}
                      placeholder="Father's full name"
                      value={formData.fatherName}
                      onChange={e => {
                        setFormData({ ...formData, fatherName: e.target.value });
                        if (formErrors.fatherName) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.fatherName; return c; });
                        }
                      }}
                    />
                    {formErrors.fatherName && <div className="kyc-field-error">{formErrors.fatherName}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date of Birth (DOB) *</label>
                    <input
                      type="date"
                      className={`form-input ${formErrors.dob ? 'kyc-input-error' : ''}`}
                      value={formData.dob}
                      onChange={e => {
                        setFormData({ ...formData, dob: e.target.value });
                        if (formErrors.dob) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.dob; return c; });
                        }
                      }}
                    />
                    {formErrors.dob && <div className="kyc-field-error">{formErrors.dob}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Country *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.country ? 'kyc-input-error' : ''}`}
                      placeholder="India"
                      value={formData.country}
                      onChange={e => setFormData({ ...formData, country: e.target.value })}
                    />
                    {formErrors.country && <div className="kyc-field-error">{formErrors.country}</div>}
                  </div>

                  <div className="form-group kyc-form-grid-full">
                    <label className="form-label">Permanent Address *</label>
                    <textarea
                      rows={2}
                      className={`form-textarea ${formErrors.address ? 'kyc-input-error' : ''}`}
                      placeholder="Flat/House No, Building, Street, Area"
                      value={formData.address}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          address: val,
                          courierAddress: sameAsPermanent ? val : prev.courierAddress,
                        }));
                        if (formErrors.address) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.address; return c; });
                        }
                      }}
                    />
                    {formErrors.address && <div className="kyc-field-error">{formErrors.address}</div>}
                  </div>

                  <div className="form-group kyc-form-grid-full">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0 }}>Courier Address (Current Address) *</label>
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <input
                          type="checkbox"
                          checked={sameAsPermanent}
                          onChange={e => {
                            const chk = e.target.checked;
                            setSameAsPermanent(chk);
                            if (chk) {
                              setFormData(prev => ({ ...prev, courierAddress: prev.address }));
                            }
                          }}
                        />
                        Same as Permanent Address
                      </label>
                    </div>
                    <textarea
                      rows={2}
                      className={`form-textarea ${formErrors.courierAddress ? 'kyc-input-error' : ''}`}
                      placeholder="Delivery & physical documentation address"
                      value={formData.courierAddress}
                      onChange={e => {
                        setFormData({ ...formData, courierAddress: e.target.value });
                        if (formErrors.courierAddress) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.courierAddress; return c; });
                        }
                      }}
                    />
                    {formErrors.courierAddress && <div className="kyc-field-error">{formErrors.courierAddress}</div>}
                  </div>
                </div>

                <div className="kyc-form-grid-3">
                  <div className="form-group">
                    <label className="form-label">State *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.state ? 'kyc-input-error' : ''}`}
                      placeholder="e.g. Karnataka"
                      value={formData.state}
                      onChange={e => {
                        setFormData({ ...formData, state: e.target.value });
                        if (formErrors.state) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.state; return c; });
                        }
                      }}
                    />
                    {formErrors.state && <div className="kyc-field-error">{formErrors.state}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">City *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.city ? 'kyc-input-error' : ''}`}
                      placeholder="e.g. Bengaluru"
                      value={formData.city}
                      onChange={e => {
                        setFormData({ ...formData, city: e.target.value });
                        if (formErrors.city) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.city; return c; });
                        }
                      }}
                    />
                    {formErrors.city && <div className="kyc-field-error">{formErrors.city}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Pincode *</label>
                    <input
                      type="text"
                      maxLength={6}
                      className={`form-input ${formErrors.pincode ? 'kyc-input-error' : ''}`}
                      placeholder="6-digit PIN code"
                      value={formData.pincode}
                      onChange={e => {
                        setFormData({ ...formData, pincode: e.target.value });
                        if (formErrors.pincode) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.pincode; return c; });
                        }
                      }}
                    />
                    {formErrors.pincode && <div className="kyc-field-error">{formErrors.pincode}</div>}
                  </div>
                </div>

                {/* Uploads */}
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Identity Document Uploads *
                  </h4>
                  <div className="kyc-form-grid">
                    <KYCUploadCard
                      label="Upload Aadhaar (Front & Back) *"
                      required
                      doc={formData.aadhaarDoc}
                      error={formErrors.aadhaarDoc}
                      onUpload={doc => {
                        setFormData({ ...formData, aadhaarDoc: doc });
                        if (formErrors.aadhaarDoc) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.aadhaarDoc; return c; });
                        }
                      }}
                      onRemove={() => setFormData({ ...formData, aadhaarDoc: null })}
                    />

                    <KYCUploadCard
                      label="Upload PAN Card *"
                      required
                      doc={formData.panDoc}
                      error={formErrors.panDoc}
                      onUpload={doc => {
                        setFormData({ ...formData, panDoc: doc });
                        if (formErrors.panDoc) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.panDoc; return c; });
                        }
                      }}
                      onRemove={() => setFormData({ ...formData, panDoc: null })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: BANK DETAILS ── */}
            {currentStep === 3 && (
              <div>
                <div className="kyc-step-header">
                  <h2 className="kyc-step-title">
                    <Building size={20} color="var(--primary-600)" /> Step 3: Bank Details
                  </h2>
                  <p className="kyc-step-subtitle">
                    Investment account details for capital drawdowns, dividends, and distributions.
                  </p>
                </div>

                <div className="kyc-form-grid">
                  <div className="form-group">
                    <label className="form-label">Account Type *</label>
                    <select
                      className={`form-select ${formErrors.accountType ? 'kyc-input-error' : ''}`}
                      value={formData.accountType}
                      onChange={e => setFormData({ ...formData, accountType: e.target.value })}
                    >
                      <option value="Savings">Savings Account</option>
                      <option value="Current">Current Account</option>
                      <option value="NRE">NRE (Non-Resident External)</option>
                      <option value="NRO">NRO (Non-Resident Ordinary)</option>
                    </select>
                    {formErrors.accountType && <div className="kyc-field-error">{formErrors.accountType}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Account Number *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.accountNumber ? 'kyc-input-error' : ''}`}
                      placeholder="Bank account number"
                      value={formData.accountNumber}
                      onChange={e => {
                        setFormData({ ...formData, accountNumber: e.target.value });
                        if (formErrors.accountNumber) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.accountNumber; return c; });
                        }
                      }}
                    />
                    {formErrors.accountNumber && <div className="kyc-field-error">{formErrors.accountNumber}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">IFSC Code *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.ifscCode ? 'kyc-input-error' : ''}`}
                      placeholder="e.g. HDFC0001234"
                      maxLength={11}
                      value={formData.ifscCode}
                      onChange={e => handleIfscChange(e.target.value)}
                    />
                    {formErrors.ifscCode && <div className="kyc-field-error">{formErrors.ifscCode}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">SWIFT / IBAN Code</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="For international / NRI wires"
                      value={formData.swiftCode}
                      onChange={e => setFormData({ ...formData, swiftCode: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Account Holder Name *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.accountHolderName ? 'kyc-input-error' : ''}`}
                      placeholder="Name as registered with the bank"
                      value={formData.accountHolderName}
                      onChange={e => {
                        setFormData({ ...formData, accountHolderName: e.target.value });
                        if (formErrors.accountHolderName) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.accountHolderName; return c; });
                        }
                      }}
                    />
                    {formErrors.accountHolderName && <div className="kyc-field-error">{formErrors.accountHolderName}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Bank Name *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.bankName ? 'kyc-input-error' : ''}`}
                      placeholder="e.g. HDFC Bank Ltd"
                      value={formData.bankName}
                      onChange={e => {
                        setFormData({ ...formData, bankName: e.target.value });
                        if (formErrors.bankName) {
                          setFormErrors(prev => { const c = { ...prev }; delete c.bankName; return c; });
                        }
                      }}
                    />
                    {formErrors.bankName && <div className="kyc-field-error">{formErrors.bankName}</div>}
                  </div>

                  <div className="form-group kyc-form-grid-full">
                    <label className="form-label">Branch Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Koramangala 5th Block Branch"
                      value={formData.branchName}
                      onChange={e => setFormData({ ...formData, branchName: e.target.value })}
                    />
                  </div>
                </div>

                {/* Upload Bank Proof */}
                <div style={{ marginTop: 20 }}>
                  <KYCUploadCard
                    label="Upload Bank Statement / Cancelled Cheque / Passbook *"
                    required
                    doc={formData.bankProofDoc}
                    error={formErrors.bankProofDoc}
                    onUpload={doc => {
                      setFormData({ ...formData, bankProofDoc: doc });
                      if (formErrors.bankProofDoc) {
                        setFormErrors(prev => { const c = { ...prev }; delete c.bankProofDoc; return c; });
                      }
                    }}
                    onRemove={() => setFormData({ ...formData, bankProofDoc: null })}
                  />
                </div>
              </div>
            )}

            {/* ── STEP 4: DEMAT ACCOUNT ── */}
            {currentStep === 4 && (
              <div>
                <div className="kyc-step-header">
                  <h2 className="kyc-step-title">
                    <CreditCard size={20} color="var(--primary-600)" /> Step 4: Demat Account
                  </h2>
                  <p className="kyc-step-subtitle">
                    Provide depository participant (NSDL / CDSL) details for unlisted/listed securities allotment.
                  </p>
                </div>

                {/* Skip Checkbox */}
                <div className="kyc-demat-card">
                  <label className="kyc-checkbox-label">
                    <input
                      type="checkbox"
                      className="kyc-checkbox-input"
                      checked={formData.hasNoDemat}
                      onChange={e => {
                        const checked = e.target.checked;
                        setFormData({ ...formData, hasNoDemat: checked });
                        if (checked) {
                          setFormErrors(prev => {
                            const c = { ...prev };
                            delete c.dematAccountNumber;
                            delete c.dematDoc;
                            return c;
                          });
                        }
                      }}
                    />
                    <span>I don't have a Demat account (Skip this step)</span>
                  </label>
                  {formData.hasNoDemat && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      ℹ️ <em>You have elected to skip the Demat step. Physical investment certificate & holding statement will be issued instead. You may proceed directly to Nominee Details.</em>
                    </div>
                  )}
                </div>

                {/* If Not Skipped: Demat Fields */}
                {!formData.hasNoDemat && (
                  <div className="kyc-form-grid">
                    <div className="form-group kyc-form-grid-full">
                      <label className="form-label">Demat Account Number (16-digit BO ID / DP ID) *</label>
                      <input
                        type="text"
                        className={`form-input ${formErrors.dematAccountNumber ? 'kyc-input-error' : ''}`}
                        placeholder="e.g. 1208160012345678 or IN30012345678901"
                        value={formData.dematAccountNumber}
                        onChange={e => {
                          setFormData({ ...formData, dematAccountNumber: e.target.value });
                          if (formErrors.dematAccountNumber) {
                            setFormErrors(prev => { const c = { ...prev }; delete c.dematAccountNumber; return c; });
                          }
                        }}
                      />
                      {formErrors.dematAccountNumber && (
                        <div className="kyc-field-error">{formErrors.dematAccountNumber}</div>
                      )}
                    </div>

                    <div className="kyc-form-grid-full">
                      <KYCUploadCard
                        label="Upload Demat Statement (CML / Holding Statement) *"
                        required
                        doc={formData.dematDoc}
                        error={formErrors.dematDoc}
                        onUpload={doc => {
                          setFormData({ ...formData, dematDoc: doc });
                          if (formErrors.dematDoc) {
                            setFormErrors(prev => { const c = { ...prev }; delete c.dematDoc; return c; });
                          }
                        }}
                        onRemove={() => setFormData({ ...formData, dematDoc: null })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 5: NOMINEE DETAILS ── */}
            {currentStep === 5 && (
              <div>
                <div className="kyc-step-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 className="kyc-step-title">
                      <Users size={20} color="var(--primary-600)" /> Step 5: Nominee Details
                    </h2>
                    <p className="kyc-step-subtitle">
                      SEBI statutory nomination declaration. Designate up to 3 nominees for asset succession.
                    </p>
                  </div>
                  {formData.nominees.length < 3 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      onClick={handleAddNominee}
                    >
                      <Plus size={14} /> Add Nominee
                    </button>
                  )}
                </div>

                {formErrors.nominees && (
                  <div className="kyc-field-error" style={{ marginBottom: 16 }}>{formErrors.nominees}</div>
                )}

                {formData.nominees.map((nom, idx) => (
                  <div key={nom.id} className="kyc-nominee-box">
                    <div className="kyc-nominee-box-header">
                      <div className="kyc-nominee-box-title">
                        Nominee #{idx + 1}
                      </div>
                      {formData.nominees.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleRemoveNominee(nom.id)}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      )}
                    </div>

                    <div className="kyc-form-grid">
                      <div className="form-group">
                        <label className="form-label">Nominee Name *</label>
                        <input
                          type="text"
                          className={`form-input ${formErrors[`nominee_${idx}_name`] ? 'kyc-input-error' : ''}`}
                          placeholder="Nominee full name"
                          value={nom.name}
                          onChange={e => handleNomineeChange(nom.id, 'name', e.target.value)}
                        />
                        {formErrors[`nominee_${idx}_name`] && (
                          <div className="kyc-field-error">{formErrors[`nominee_${idx}_name`]}</div>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Relationship with Investor *</label>
                        <select
                          className="form-select"
                          value={nom.relationship}
                          onChange={e => handleNomineeChange(nom.id, 'relationship', e.target.value)}
                        >
                          <option value="Spouse">Spouse</option>
                          <option value="Son">Son</option>
                          <option value="Daughter">Daughter</option>
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Brother">Brother</option>
                          <option value="Sister">Sister</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Date of Birth / Age *</label>
                        <input
                          type="date"
                          className={`form-input ${formErrors[`nominee_${idx}_dob`] ? 'kyc-input-error' : ''}`}
                          value={nom.dob}
                          onChange={e => handleNomineeChange(nom.id, 'dob', e.target.value)}
                        />
                        {formErrors[`nominee_${idx}_dob`] && (
                          <div className="kyc-field-error">{formErrors[`nominee_${idx}_dob`]}</div>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Allocation Percentage (%) *</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className={`form-input ${formErrors[`nominee_${idx}_pct`] ? 'kyc-input-error' : ''}`}
                          value={nom.allocationPercentage}
                          onChange={e => handleNomineeChange(nom.id, 'allocationPercentage', Number(e.target.value))}
                        />
                        {formErrors[`nominee_${idx}_pct`] && (
                          <div className="kyc-field-error">{formErrors[`nominee_${idx}_pct`]}</div>
                        )}
                      </div>

                      <div className="form-group kyc-form-grid-full">
                        <label className="form-label">Nominee Address</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Address (Leave blank if same as investor)"
                          value={nom.address}
                          onChange={e => handleNomineeChange(nom.id, 'address', e.target.value)}
                        />
                      </div>

                      <div className="form-group kyc-form-grid-full">
                        <label className="form-label">Guardian Name (If nominee is a minor under 18)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Guardian full name"
                          value={nom.guardianName}
                          onChange={e => handleNomineeChange(nom.id, 'guardianName', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── ACTION NAVIGATION BAR ── */}
            <div className="kyc-nav-bar">
              <div className="kyc-nav-left">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleBack}
                >
                  <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back
                </button>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Step {currentStep} of 5
              </div>

              <div className="kyc-nav-right">
                {currentStep < 5 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleContinue}
                  >
                    Continue <ArrowRight size={14} style={{ marginLeft: 6 }} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                    onClick={handleSubmitKycForReview}
                  >
                    <CheckCircle size={15} style={{ marginRight: 6 }} /> Submit KYC for Review
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KYC Dossier Modal (Preview / SEBI checklist) */}
      {selectedDealForDetail && (
        <Modal
          isOpen={!!selectedDealForDetail}
          onClose={() => setSelectedDealForDetail(null)}
          title={`KYC Dossier: ${selectedDealForDetail.customerName}`}
          subtitle={`SEBI Compliance & Investor Mandate Verification • ID: ${selectedDealForDetail.id}`}
          maxWidth={640}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedDealForDetail(null)}
              >
                Close
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const d = selectedDealForDetail;
                    setSelectedDealForDetail(null);
                    startKycFlow(d);
                  }}
                >
                  Open 5-Step KYC Form
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleAdvanceStage(selectedDealForDetail)}
                >
                  Confirm KYC & Advance to Opportunity <ArrowRight size={14} style={{ marginLeft: 6 }} />
                </button>
              </div>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Overview Card */}
            <div style={{ padding: 14, background: 'var(--bg-surface-hover)', borderRadius: 8, border: '1px solid var(--border-base)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selectedDealForDetail.customerName}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedDealForDetail.title}</div>
                </div>
                {getDealKycStatus(selectedDealForDetail)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <div><strong>Phone:</strong> {selectedDealForDetail.phone || '—'}</div>
                <div><strong>Email:</strong> {selectedDealForDetail.email || '—'}</div>
                <div><strong>City:</strong> {selectedDealForDetail.location || '—'}</div>
                <div><strong>Investment Size:</strong> <span style={{ color: '#10b981', fontWeight: 700 }}>{selectedDealForDetail.investmentRange || formatCurrency(selectedDealForDetail.value)}</span></div>
              </div>
            </div>

            {/* Checklist */}
            <h4 style={{ margin: '4px 0 0 0', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              KYC & Compliance Checklist
            </h4>

            <div className="kyc-detail-grid">
              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>PAN Verification</span>
                  <span className="kyc-badge-verified">Verified</span>
                </div>
                <div className="kyc-doc-desc">Income Tax Department NSDL API instant match. Valid PAN.</div>
              </div>

              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>CKYC Status</span>
                  <span className="kyc-badge-verified">Validated</span>
                </div>
                <div className="kyc-doc-desc">CKYC-IN Registry: 14-digit CKYC record retrieved and certified.</div>
              </div>

              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>AIF Ticket Size Eligibility</span>
                  <span className="kyc-badge-verified">Passed</span>
                </div>
                <div className="kyc-doc-desc">SEBI Cat-II AIF minimum ticket requirement (≥ ₹1 Cr) validated.</div>
              </div>

              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>Address & Bank Verification</span>
                  <span className="kyc-badge-verified">Completed</span>
                </div>
                <div className="kyc-doc-desc">Aadhaar Offline XML and penny-drop bank account verification verified.</div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ==============================================================================
// ORIGINAL KYC VIEW (For any non-GHL IRM persona/company)
// ==============================================================================
const OriginalKYCView: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [agentFilter, setAgentFilter] = useState('All');
  const [selectedDealForDetail, setSelectedDealForDetail] = useState<Deal | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = () => {
    const allDeals = storageService.getDeals(tenant?.id);
    setDeals(allDeals.filter(d => d.stage === 'qualified_investor'));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getDaysInStage = (deal: Deal) => {
    const timestamp = deal.stageEnteredAt || deal.createdAt;
    if (!timestamp) return 0;
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) return 0;
    const diffMs = new Date().getTime() - time;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const handleAdvanceStage = (deal: Deal) => {
    const updatedDeal: Deal = {
      ...deal,
      stage: 'investment_opportunity',
      stageEnteredAt: new Date().toISOString(),
    };
    storageService.saveDeal(updatedDeal);

    const activity: DealActivity = {
      id: `act-${Date.now()}`,
      dealId: deal.id,
      companyId: tenant?.id || '',
      type: 'stage_change',
      fromStage: 'qualified_investor',
      toStage: 'investment_opportunity',
      text: 'Qualified Investor → Investment Opportunity (KYC Verified)',
      loggedByName: user?.name || 'IRM User',
      loggedByRole: 'IRM',
      timestamp: new Date().toISOString(),
    };
    storageService.addDealActivity(activity);

    if (selectedDealForDetail?.id === deal.id) {
      setSelectedDealForDetail(null);
    }

    loadData();
    showToast(`Investor "${deal.customerName}" advanced to Investment Opportunity!`);
  };

  const agentOptions = useMemo(() => {
    return Array.from(new Set(deals.map(d => d.assignedAgentName).filter(Boolean)))
      .sort()
      .map(name => ({ value: name, label: name }));
  }, [deals]);

  const filteredDeals = deals.filter(deal => {
    if (agentFilter !== 'All' && deal.assignedAgentName !== agentFilter) return false;
    return true;
  });

  const columns: Column<Deal>[] = [
    {
      key: 'customerName',
      header: 'Investor & Deal',
      sortable: true,
      render: deal => (
        <div>
          <div className="kyc-customer-name">{deal.customerName}</div>
          <div className="kyc-deal-subtitle">{deal.title}</div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Details',
      render: deal => (
        <div className="kyc-contact-info">
          {deal.phone && (
            <div className="kyc-contact-row">
              <Phone size={12} color="var(--text-muted)" />
              <span>{deal.phone}</span>
            </div>
          )}
          {deal.email && (
            <div className="kyc-contact-row">
              <Mail size={12} color="var(--text-muted)" />
              <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deal.email}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: deal => (
        <div className="kyc-contact-row" style={{ fontSize: 12 }}>
          <MapPin size={12} color="var(--text-muted)" />
          <span>{deal.location || '—'}</span>
        </div>
      ),
    },
    {
      key: 'investmentRange',
      header: 'Investment Capacity',
      sortable: true,
      render: deal => (
        <span style={{ color: '#10b981', fontWeight: 800, fontSize: 13 }}>
          {deal.investmentRange || formatCurrency(deal.value)}
        </span>
      ),
    },
    {
      key: 'preferredAssetClass',
      header: 'Preferred Asset Class',
      render: deal => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {deal.preferredAssetClass || 'Commercial Pre-Leased'}
        </span>
      ),
    },
    {
      key: 'kycStatus',
      header: 'KYC Document Status',
      render: () => (
        <span className="kyc-badge-verified">
          <CheckCircle size={12} /> SEBI KYC Validated
        </span>
      ),
    },
    {
      key: 'assignedAgentName',
      header: 'Assigned IRM',
      render: deal => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {deal.assignedAgentName || 'Ananya Iyer'}
        </span>
      ),
    },
    {
      key: 'stageEnteredAt',
      header: 'Stage Duration',
      render: deal => {
        const days = getDaysInStage(deal);
        return (
          <span className="kyc-days-pill">
            <Clock size={11} /> {days}d
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Stage Action',
      render: deal => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-icon"
            title={`Call ${deal.customerName}`}
            onClick={() => initiateCall(deal.customerName, deal.phone || '', 'customer', deal.id)}
          >
            <Phone size={14} color="#059669" />
          </button>
          <button
            type="button"
            className="kyc-advance-btn"
            title="Advance stage to Investment Opportunity"
            onClick={() => handleAdvanceStage(deal)}
          >
            Advance <ArrowRight size={13} />
          </button>
        </div>
      ),
    },
  ];

  const rowActions: RowAction<Deal>[] = [
    {
      label: 'View KYC Dossier',
      icon: <Eye size={14} style={{ marginRight: 6 }} />,
      onClick: deal => setSelectedDealForDetail(deal),
    },
    {
      label: 'Call Investor',
      icon: <Phone size={14} color="#059669" style={{ marginRight: 6 }} />,
      onClick: deal => initiateCall(deal.customerName, deal.phone || '', 'customer', deal.id),
    },
    {
      label: 'Advance to Opportunity',
      icon: <ArrowRight size={14} color="var(--primary-600)" style={{ marginRight: 6 }} />,
      onClick: deal => handleAdvanceStage(deal),
    },
  ];

  return (
    <div className="kyc-page-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            backgroundColor: '#059669',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <CheckCircle size={18} /> {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">
            <FileCheck size={24} color="#06b6d4" /> Qualified Investor & KYC Verification
          </h1>
          <p className="page-subtitle">
            SEBI compliance checked, ticket size verified, KYC validated investors ready for investment opportunities.
          </p>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={filteredDeals}
        columns={columns}
        rowActions={rowActions}
        keyExtractor={d => d.id}
        searchPlaceholder="Search by investor, phone, city..."
        searchFilter={(deal, q) => {
          const matchName = deal.customerName?.toLowerCase().includes(q);
          const matchPhone = deal.phone?.toLowerCase().includes(q);
          const matchTitle = deal.title?.toLowerCase().includes(q);
          const matchLocation = deal.location?.toLowerCase().includes(q);
          return Boolean(matchName || matchPhone || matchTitle || matchLocation);
        }}
        emptyTitle="No Qualified Investors"
        emptyDescription="No investors currently in the Qualified Investor / KYC stage."
        filtersNode={
          <FilterBar
            filters={[
              {
                key: 'agent',
                label: 'Assigned IRM',
                value: agentFilter,
                onChange: setAgentFilter,
                options: agentOptions,
              },
            ]}
            onClearAll={() => {
              setAgentFilter('All');
            }}
          />
        }
      />

      {/* KYC Dossier Modal */}
      {selectedDealForDetail && (
        <Modal
          isOpen={!!selectedDealForDetail}
          onClose={() => setSelectedDealForDetail(null)}
          title={`KYC Dossier: ${selectedDealForDetail.customerName}`}
          subtitle={`SEBI Compliance & Investor Mandate Verification • ID: ${selectedDealForDetail.id}`}
          maxWidth={640}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedDealForDetail(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleAdvanceStage(selectedDealForDetail)}
              >
                Confirm KYC & Advance to Opportunity <ArrowRight size={14} style={{ marginLeft: 6 }} />
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Overview Card */}
            <div style={{ padding: 14, background: 'var(--bg-surface-hover)', borderRadius: 8, border: '1px solid var(--border-base)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selectedDealForDetail.customerName}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedDealForDetail.title}</div>
                </div>
                <span className="kyc-badge-verified">
                  <ShieldCheck size={13} /> Verified & Eligible
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <div><strong>Phone:</strong> {selectedDealForDetail.phone || '—'}</div>
                <div><strong>Email:</strong> {selectedDealForDetail.email || '—'}</div>
                <div><strong>City:</strong> {selectedDealForDetail.location || '—'}</div>
                <div><strong>Investment Size:</strong> <span style={{ color: '#10b981', fontWeight: 700 }}>{selectedDealForDetail.investmentRange || formatCurrency(selectedDealForDetail.value)}</span></div>
              </div>
            </div>

            {/* Checklist */}
            <h4 style={{ margin: '4px 0 0 0', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              KYC & Compliance Checklist
            </h4>

            <div className="kyc-detail-grid">
              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>PAN Verification</span>
                  <span className="kyc-badge-verified">Verified</span>
                </div>
                <div className="kyc-doc-desc">Income Tax Department NSDL API instant match. Valid PAN.</div>
              </div>

              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>CKYC Status</span>
                  <span className="kyc-badge-verified">Validated</span>
                </div>
                <div className="kyc-doc-desc">CKYC-IN Registry: 14-digit CKYC record retrieved and certified.</div>
              </div>

              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>AIF Ticket Size Eligibility</span>
                  <span className="kyc-badge-verified">Passed</span>
                </div>
                <div className="kyc-doc-desc">SEBI Cat-II AIF minimum ticket requirement (≥ ₹1 Cr) validated.</div>
              </div>

              <div className="kyc-doc-card">
                <div className="kyc-doc-title">
                  <span>Address & Bank Verification</span>
                  <span className="kyc-badge-verified">Completed</span>
                </div>
                <div className="kyc-doc-desc">Aadhaar Offline XML and penny-drop bank account verification verified.</div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ==============================================================================
// MAIN KYC PAGE EXPORT (WITH STRICT PERSONA & TENANT GATING)
// ==============================================================================
export const KYCPage: React.FC = () => {
  const { tenant, user } = useAuth();

  const isGhl =
    tenant?.slug === 'ghl' ||
    tenant?.id === 't-ghl-01' ||
    tenant?.name === 'GHL India Ventures' ||
    user?.companySlug === 'ghl' ||
    user?.companyName === 'GHL India Ventures';

  const isIrm = user?.role?.code === 'irm';
  const isGhlIrm = isGhl && isIrm;

  // STRICT REQUIREMENT: Only GHL India Ventures IRM receives the new 5-step KYC & Documents flow.
  // Every other persona, role, or tenant retains the exact existing KYC implementation.
  if (!isGhlIrm) {
    return <OriginalKYCView />;
  }

  return <GhlIrmKycView />;
};
