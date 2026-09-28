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
  Edit2,
  Send,
} from 'lucide-react';
import { SendKycLinkModal } from './components/SendKycLinkModal';
import { KycStatusBadge, getMockCustomerKycStatus } from './components/KycStatusBadge';
import { KycRowActionsMenu } from './components/KycRowActionsMenu';
import { KycReviewDrawer } from './components/KycReviewDrawer';
import { Deal, DealActivity, DocumentItem, Lead, Customer } from '../../types';
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
  occupation?: string;

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
  dematDepository?: string;
  dematDpId?: string;
  dematClientId?: string;
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
  occupation: '',

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
  dematDepository: '',
  dematDpId: '',
  dematClientId: '',
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // KYC Link Feature State
  const [sendLinkDeal, setSendLinkDeal] = useState<Deal | null>(null);
  const [reviewDeal, setReviewDeal] = useState<Deal | null>(null);

  // View state: 'table' | 'flow' | 'profile'
  const [viewMode, setViewMode] = useState<'table' | 'flow' | 'profile'>('table');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [selectedCustomerDeal, setSelectedCustomerDeal] = useState<Deal | null>(null);
  const [profileKycData, setProfileKycData] = useState<Partial<KYCFormData> | null>(null);

  // Quick Section Edit State (Personal Details / Address & Identity)
  const [editingSection, setEditingSection] = useState<'personal' | 'address' | null>(null);
  const [sectionFormData, setSectionFormData] = useState<Record<string, any>>({});

  // Dossier modal for table preview
  const [selectedDealForDetail, setSelectedDealForDetail] = useState<Deal | null>(null);

  // Form State
  const [formData, setFormData] = useState<KYCFormData>(BLANK_KYC_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [sameAsPermanent, setSameAsPermanent] = useState(false);

  const loadData = () => {
    const allDeals = storageService.getDeals(tenant?.id) || [];
    setDeals(allDeals.filter(d => d.stage === 'qualified_investor'));
    setLeads(storageService.getLeads(tenant?.id) || []);
    setCustomers(storageService.getCustomers(tenant?.id) || []);
  };

  const getResolvedLocation = (deal: Deal) => {
    if (deal.location && deal.location !== '—') return deal.location;
    const fDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
    const matchingLead = leads.find(l => {
      if (deal.customerId && l.id === deal.customerId) return true;
      const lDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(lDigits && fDigits && lDigits === fDigits);
    });
    const matchingCustomer = customers.find(c => {
      if (deal.customerId && c.id === deal.customerId) return true;
      const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(cDigits && fDigits && cDigits === fDigits);
    });
    return matchingLead?.location || matchingCustomer?.location || '—';
  };

  const getCustomerFilledCapacity = (deal: Deal) => {
    const fDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
    const matchingLead = leads.find(l => {
      if (deal.customerId && l.id === deal.customerId) return true;
      const lDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(lDigits && fDigits && lDigits === fDigits);
    });
    const matchingCustomer = customers.find(c => {
      if (deal.customerId && c.id === deal.customerId) return true;
      const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(cDigits && fDigits && cDigits === fDigits);
    });

    return (
      matchingLead?.customFields?.investmentCapacity ||
      matchingLead?.customFields?.capacityRange ||
      matchingLead?.customFields?.investmentRange ||
      (matchingLead as any)?.investmentRange ||
      matchingCustomer?.customFields?.investmentCapacity ||
      deal.investmentRange ||
      (deal.value ? formatCurrency(deal.value) : '—')
    );
  };

  const getIrmPreferredAssetClass = (deal: Deal) => {
    const fDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
    let savedLocal: any = null;
    try {
      const raw =
        (deal.customerId ? localStorage.getItem(`nexus_irm_pref_${deal.customerId}`) : null) ||
        (fDigits ? localStorage.getItem(`nexus_irm_pref_${fDigits}`) : null) ||
        localStorage.getItem(`nexus_irm_pref_${deal.id}`);
      if (raw) savedLocal = JSON.parse(raw);
    } catch { }

    const matchingLead = leads.find(l => {
      if (deal.customerId && l.id === deal.customerId) return true;
      const lDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(lDigits && fDigits && lDigits === fDigits);
    });
    const matchingCustomer = customers.find(c => {
      if (deal.customerId && c.id === deal.customerId) return true;
      const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(cDigits && fDigits && cDigits === fDigits);
    });

    const isConfirmed =
      savedLocal?.confirmed === true ||
      matchingLead?.customFields?.irmPreferencesConfirmed === true ||
      matchingCustomer?.customFields?.irmPreferencesConfirmed === true;

    if (savedLocal?.preferredAssetClass) return savedLocal.preferredAssetClass;
    if (matchingLead?.customFields?.preferredAssetClass && isConfirmed) return matchingLead.customFields.preferredAssetClass;
    if (matchingCustomer?.customFields?.preferredAssetClass && isConfirmed) return matchingCustomer.customFields.preferredAssetClass;
    if (deal.preferredAssetClass && (deal.preferredAssetClass === 'CO-AIF' || deal.preferredAssetClass === 'AIF' || isConfirmed)) {
      return deal.preferredAssetClass;
    }

    return '—';
  };

  const getDynamicKycStatus = (deal: Deal): 'completed' | 'continue' | 'pending' => {
    const status = localStorage.getItem(`nexus_kyc_status_${deal.id}`);
    if (status === 'Completed' || status === 'Submitted for Review' || status === 'SEBI KYC Validated') {
      return 'completed';
    }
    if (status === 'Partially Completed') {
      return 'continue';
    }

    const savedDataStr = localStorage.getItem(`nexus_kyc_data_${deal.id}`);
    if (savedDataStr) {
      try {
        const data = JSON.parse(savedDataStr);
        const isAllFilled =
          Boolean(data.investorName?.trim()) &&
          Boolean(data.panNumber?.trim()) &&
          Boolean(data.bankAccountNumber?.trim()) &&
          Boolean(data.bankIfsc?.trim()) &&
          (Boolean(data.dematDoc) || data.hasNoDemat) &&
          Boolean(data.nominees && data.nominees.length > 0 && data.nominees[0]?.name?.trim());

        if (isAllFilled) return 'completed';

        const isPartiallyFilled =
          Boolean(data.panNumber?.trim()) ||
          Boolean(data.aadhaarNumber?.trim()) ||
          Boolean(data.bankAccountNumber?.trim()) ||
          Boolean(data.aadhaarDoc) ||
          Boolean(data.panDoc);

        if (isPartiallyFilled) return 'continue';
      } catch { }
    }

    if ((deal as any).kycValidated === true) {
      return 'completed';
    }

    return 'pending';
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

  const getGhlId = (deal: Deal) => {
    const digits = (deal.id || '').replace(/\D/g, '');
    if (digits.length >= 6) return `GHL${digits.slice(-6)}`;
    let hash = 0;
    for (let i = 0; i < deal.id.length; i++) {
      hash = (hash << 5) - hash + deal.id.charCodeAt(i);
      hash |= 0;
    }
    const clean = Math.abs(hash).toString().padEnd(6, '7').slice(0, 6);
    return `GHL${clean}`;
  };

  const getJoinedDate = (deal: Deal) => {
    const d = deal.createdAt ? new Date(deal.createdAt) : new Date();
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const calculateProfileCompletion = (data: Partial<KYCFormData> | null, deal: Deal) => {
    if (!data) return 25;
    const fields = [
      data.investorName || deal.customerName,
      data.phone || deal.phone,
      data.email || deal.email,
      data.panNumber,
      data.dob,
      data.city || deal.location,
      data.occupation,
      data.aadhaarNumber,
      data.address,
      data.courierAddress,
      data.bankName,
      data.accountNumber,
      data.ifscCode,
      data.nominees?.[0]?.name,
      data.nominees?.[0]?.relationship,
      data.hasNoDemat || data.dematAccountNumber || data.dematDpId,
    ];
    const filled = fields.filter(f => Boolean(f && String(f).trim() && f !== 'Not provided')).length;
    const pct = Math.round((filled / fields.length) * 100);
    return Math.max(25, Math.min(100, pct));
  };

  const handleOpenCustomerProfile = (deal: Deal) => {
    setSelectedCustomerDeal(deal);
    const savedKycKey = `nexus_kyc_data_${deal.id}`;
    let saved: Partial<KYCFormData> | null = null;
    try {
      const raw = localStorage.getItem(savedKycKey);
      if (raw) saved = JSON.parse(raw);
    } catch { }

    const fDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
    const matchingLead = leads.find(l => {
      if (deal.customerId && l.id === deal.customerId) return true;
      const lDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(lDigits && fDigits && lDigits === fDigits);
    });
    const matchingCustomer = customers.find(c => {
      if (deal.customerId && c.id === deal.customerId) return true;
      const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(cDigits && fDigits && cDigits === fDigits);
    });

    const merged: Partial<KYCFormData> = {
      investorName: saved?.investorName || deal.customerName || matchingLead?.name || matchingCustomer?.name || '',
      phone: saved?.phone || deal.phone || matchingLead?.phone || matchingCustomer?.phone || '',
      email: saved?.email || deal.email || matchingLead?.email || matchingCustomer?.email || '',
      city: saved?.city || deal.location || matchingLead?.location || matchingCustomer?.location || '',
      panNumber: saved?.panNumber || (deal as any).pan || matchingLead?.customFields?.pan || matchingCustomer?.customFields?.pan || '',
      ...saved,
    };

    setProfileKycData(merged);
    setViewMode('profile');
  };

  // Helper to open the 5-step wizard prefilled with deal info
  const startKycFlow = (deal?: Deal, targetStep?: 1 | 2 | 3 | 4 | 5) => {
    const targetDeal = deal || selectedCustomerDeal || null;
    setSelectedDeal(targetDeal);
    if (targetDeal) setSelectedCustomerDeal(targetDeal);

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
    setCurrentStep(targetStep || 1);
    setViewMode('flow');
  };

  const handleOpenSectionEdit = (section: 'personal' | 'address') => {
    setEditingSection(section);
    const deal = selectedCustomerDeal;
    const current = profileKycData || {};

    if (section === 'personal') {
      setSectionFormData({
        investorName: current.investorName || deal?.customerName || '',
        email: current.email || deal?.email || '',
        phone: current.phone || deal?.phone || '',
        panNumber: current.panNumber || '',
        city: current.city || (deal ? getResolvedLocation(deal) : '') || '',
        dob: current.dob || '',
        occupation: current.occupation || '',
        gender: current.gender || 'Male',
        investorType: current.investorType || 'Individual / Retail HNW',
        residentType: current.residentType || 'Resident Indian (RI)',
        preferredAssetClass: deal ? getIrmPreferredAssetClass(deal) : 'CO-AIF',
      });
    } else {
      setSectionFormData({
        nameAsPerPan: current.nameAsPerPan || current.investorName || deal?.customerName || '',
        fatherName: current.fatherName || '',
        aadhaarNumber: current.aadhaarNumber || '',
        address: current.address || '',
        courierAddress: current.courierAddress || current.address || '',
        city: current.city || (deal ? getResolvedLocation(deal) : '') || '',
        state: current.state || '',
        pincode: current.pincode || '',
        country: current.country || 'India',
      });
    }
  };

  const handleSaveSectionEdit = () => {
    if (!selectedCustomerDeal) return;
    const deal = selectedCustomerDeal;
    const dealId = deal.id;
    const savedKey = `nexus_kyc_data_${dealId}`;

    let currentSaved: any = {};
    try {
      const raw = localStorage.getItem(savedKey);
      if (raw) currentSaved = JSON.parse(raw);
    } catch { }

    const updatedData: Partial<KYCFormData> = {
      ...currentSaved,
      ...(profileKycData || {}),
      ...sectionFormData,
    };

    localStorage.setItem(savedKey, JSON.stringify(updatedData));
    setProfileKycData(updatedData);

    // Update Deal in storageService if primary contact fields changed
    let dealChanged = false;
    const updatedDeal: Deal = { ...deal };
    if (sectionFormData.investorName && sectionFormData.investorName !== deal.customerName) {
      updatedDeal.customerName = sectionFormData.investorName;
      dealChanged = true;
    }
    if (sectionFormData.phone && sectionFormData.phone !== deal.phone) {
      updatedDeal.phone = sectionFormData.phone;
      dealChanged = true;
    }
    if (sectionFormData.email && sectionFormData.email !== deal.email) {
      updatedDeal.email = sectionFormData.email;
      dealChanged = true;
    }
    if (sectionFormData.city && sectionFormData.city !== deal.location) {
      updatedDeal.location = sectionFormData.city;
      dealChanged = true;
    }

    if (dealChanged) {
      storageService.saveDeal(updatedDeal);
      setSelectedCustomerDeal(updatedDeal);
      loadData();
    }

    // Save preferred asset class if changed
    if (editingSection === 'personal' && sectionFormData.preferredAssetClass) {
      const fDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
      const prefObj = {
        preferredAssetClass: sectionFormData.preferredAssetClass,
        confirmed: true,
      };
      if (deal.customerId) localStorage.setItem(`nexus_irm_pref_${deal.customerId}`, JSON.stringify(prefObj));
      if (fDigits) localStorage.setItem(`nexus_irm_pref_${fDigits}`, JSON.stringify(prefObj));
      localStorage.setItem(`nexus_irm_pref_${deal.id}`, JSON.stringify(prefObj));
    }

    const currentStatus = localStorage.getItem(`nexus_kyc_status_${dealId}`);
    if (currentStatus !== 'Completed' && currentStatus !== 'Submitted for Review') {
      localStorage.setItem(`nexus_kyc_status_${dealId}`, 'Partially Completed');
    }

    window.dispatchEvent(new Event('nexus_storage_updated'));
    setEditingSection(null);
    showToast(`${editingSection === 'personal' ? 'Personal Details' : 'Address & Identity'} updated successfully!`);
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
      if (selectedDeal) {
        localStorage.setItem(`nexus_kyc_data_${selectedDeal.id}`, JSON.stringify(formData));
        const currentStatus = localStorage.getItem(`nexus_kyc_status_${selectedDeal.id}`);
        if (currentStatus !== 'Completed' && currentStatus !== 'Submitted for Review') {
          localStorage.setItem(`nexus_kyc_status_${selectedDeal.id}`, 'Partially Completed');
        }
        window.dispatchEvent(new Event('nexus_storage_updated'));
      }
      if (currentStep < 5) {
        setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5);
      }
    }
  };

  const handleBack = () => {
    setFormErrors({});
    if (selectedDeal) {
      localStorage.setItem(`nexus_kyc_data_${selectedDeal.id}`, JSON.stringify(formData));
      const currentStatus = localStorage.getItem(`nexus_kyc_status_${selectedDeal.id}`);
      if (currentStatus !== 'Completed' && currentStatus !== 'Submitted for Review') {
        localStorage.setItem(`nexus_kyc_status_${selectedDeal.id}`, 'Partially Completed');
      }
      window.dispatchEvent(new Event('nexus_storage_updated'));
    }
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
    localStorage.setItem(`nexus_kyc_status_${dealId}`, 'Completed');
    window.dispatchEvent(new Event('nexus_storage_updated'));

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
    const status = getDynamicKycStatus(deal);
    if (status === 'completed') {
      return (
        <span className="kyc-badge-verified">
          <CheckCircle size={12} /> Completed
        </span>
      );
    }
    if (status === 'continue') {
      return (
        <span className="kyc-badge-review">
          <Clock size={12} /> Partially Completed
        </span>
      );
    }
    return (
      <span className="kyc-badge-review" style={{ background: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}>
        <AlertCircle size={12} /> Pending
      </span>
    );
  };

  const columns: Column<Deal>[] = [
    {
      key: 'customerName',
      header: 'Name & Contact',
      width: '210px',
      sortable: true,
      render: deal => (
        <div>
          <div
            className="kyc-customer-name"
            style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenCustomerProfile(deal);
            }}
            title="Click to view KYC profile"
          >
            {deal.customerName}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            {deal.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                <Phone size={11} color="var(--text-muted)" />
                <span>{deal.phone}</span>
              </div>
            )}
            {deal.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                <Mail size={11} color="var(--text-muted)" />
                <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {deal.email}
                </span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      width: '120px',
      render: deal => {
        const loc = getResolvedLocation(deal);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
            <MapPin size={12} color="var(--text-muted)" />
            <span>{loc}</span>
          </div>
        );
      },
    },
    {
      key: 'investmentRange',
      header: 'Investment Capacity',
      width: '150px',
      sortable: true,
      render: deal => {
        const capacity = getCustomerFilledCapacity(deal);
        return (
          <span style={{ color: '#10b981', fontWeight: 800, fontSize: 13 }}>
            {capacity}
          </span>
        );
      },
    },
    {
      key: 'preferredAssetClass',
      header: 'Preferred Asset Class',
      width: '150px',
      render: deal => {
        const pref = getIrmPreferredAssetClass(deal);
        return (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: pref !== '—' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {pref}
          </span>
        );
      },
    },
    {
      key: 'kycStatus',
      header: 'KYC Status',
      width: '140px',
      render: deal => {
        const status = getDynamicKycStatus(deal);
        if (status === 'completed') {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <CheckCircle size={12} /> Completed
            </span>
          );
        }
        if (status === 'continue') {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <Clock size={12} /> Partially Completed
            </span>
          );
        }
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
              background: 'rgba(148, 163, 184, 0.12)',
              color: '#94a3b8',
              border: '1px solid rgba(148, 163, 184, 0.25)',
            }}
          >
            <AlertCircle size={12} /> Pending
          </span>
        );
      },
    },
    {
      key: 'customerKycStatus',
      header: 'Customer KYC',
      width: '140px',
      render: deal => {
        // TODO(logic): Connect to live backend customer KYC link status
        const custStatus = getMockCustomerKycStatus(deal.id, getDynamicKycStatus(deal));
        return <KycStatusBadge status={custStatus} />;
      },
    },
    {
      key: 'stageAction',
      header: 'Stage Action',
      width: '160px',
      render: deal => (
        <div style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
          {/* Send KYC Link Button */}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            title="Send Customer KYC Link"
            style={{
              fontSize: 11,
              padding: '5px 10px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              borderColor: 'var(--primary-500, #3b82f6)',
              color: 'var(--primary-600, #2563eb)',
              background: 'rgba(37, 99, 235, 0.06)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSendLinkDeal(deal);
            }}
          >
            <Send size={12} />
            Send KYC Link
          </button>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '65px',
      align: 'center',
      render: deal => (
        <KycRowActionsMenu
          deal={deal}
          onOpenReview={d => setReviewDeal(d)}
          onShowToast={msg => showToast(msg)}
          onViewProfile={d => handleOpenCustomerProfile(d)}
          onEditKyc={d => startKycFlow(d)}
          onCallInvestor={d => initiateCall(d.customerName, d.phone || '', 'customer', d.id)}
          onAdvanceStage={d => handleAdvanceStage(d)}
        />
      ),
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

      {viewMode === 'profile' && selectedCustomerDeal ? (() => {
        const deal = selectedCustomerDeal;
        const data = profileKycData || {};
        const completionPct = calculateProfileCompletion(profileKycData, deal);
        const status = getDynamicKycStatus(deal);
        const isCompleted = status === 'completed';
        const isContinue = status === 'continue';
        const initial = (deal.customerName || 'U').trim().charAt(0).toUpperCase();

        const renderField = (label: string, value?: string | number | null) => (
          <div className="kyc-profile-field">
            <span className="kyc-profile-label">{label}</span>
            {value && String(value).trim() && String(value).trim() !== 'Not provided' ? (
              <span className="kyc-profile-value">{String(value)}</span>
            ) : (
              <span className="kyc-profile-value not-provided">Not provided</span>
            )}
          </div>
        );

        return (
          <div className="kyc-profile-container">
            {/* Header: Back Button + Your Profile + Edit Profile button */}
            <div>
              <button
                type="button"
                className="kyc-flow-back-btn"
                style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                onClick={() => setViewMode('table')}
              >
                <ArrowLeft size={16} /> Back to Qualified Investors
              </button>
              <div className="kyc-profile-header-row">
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Your Profile
                </h1>
                <button
                  type="button"
                  className="btn-edit-profile"
                  onClick={() => startKycFlow(deal)}
                >
                  <FileText size={14} /> Edit Profile
                </button>
              </div>
            </div>

            {/* Profile Completion Progress Card */}
            <div className="kyc-completion-card">
              <div className="kyc-completion-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }}></span>
                  <span>Profile Completion</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
                  {completionPct}%
                </span>
              </div>
              <div className="kyc-progress-track">
                <div className="kyc-progress-fill" style={{ width: `${completionPct}%` }}></div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
                Complete your profile to unlock all platform features and faster KYC approval.
              </div>
            </div>

            {/* Main Layout: Left Sidebar + Right Stacked Cards */}
            <div className="kyc-profile-layout">
              {/* Left Sidebar Card */}
              <div className="kyc-profile-sidebar">
                <div className="kyc-profile-avatar">
                  {initial}
                  <span className="kyc-profile-avatar-badge">CE</span>
                </div>
                <div className="kyc-profile-sidebar-name">{deal.customerName}</div>
                <div className="kyc-profile-sidebar-email">{data.email || deal.email || '—'}</div>

                {/* Status Pill */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 12 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 14px',
                      borderRadius: 16,
                      fontSize: 11.5,
                      fontWeight: 700,
                      background: isCompleted ? 'rgba(16, 185, 129, 0.15)' : '#FEF3C7',
                      color: isCompleted ? '#10b981' : '#B45309',
                      border: isCompleted ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #FDE68A',
                      cursor: 'pointer',
                    }}
                    onClick={() => startKycFlow(deal)}
                  >
                    <span style={{ fontSize: 9 }}>●</span>
                    {isCompleted ? 'KYC completed' : isContinue ? 'KYC in progress' : 'KYC pending'}
                  </span>
                  <span
                    style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, cursor: 'pointer' }}
                    onClick={() => startKycFlow(deal)}
                  >
                    Tap to complete your KYC
                  </span>
                </div>

                {/* Meta Details Table */}
                <div className="kyc-profile-meta-table">
                  <div className="kyc-profile-meta-row">
                    <span className="kyc-profile-meta-key">GHL ID</span>
                    <span className="kyc-profile-meta-val">{getGhlId(deal)}</span>
                  </div>
                  <div className="kyc-profile-meta-row">
                    <span className="kyc-profile-meta-key">PAN</span>
                    <span className="kyc-profile-meta-val">{data.panNumber || 'Not provided'}</span>
                  </div>
                  <div className="kyc-profile-meta-row">
                    <span className="kyc-profile-meta-key">Mobile</span>
                    <span className="kyc-profile-meta-val">{data.phone || deal.phone || 'Not provided'}</span>
                  </div>
                  <div className="kyc-profile-meta-row">
                    <span className="kyc-profile-meta-key">Joined</span>
                    <span className="kyc-profile-meta-val">{getJoinedDate(deal)}</span>
                  </div>
                </div>

                {/* Complete KYC Action Button */}
                <button
                  type="button"
                  className="btn-complete-kyc"
                  onClick={() => startKycFlow(deal)}
                >
                  <FileText size={14} /> {isCompleted ? 'Edit KYC' : isContinue ? 'Continue KYC' : 'Complete KYC'}
                </button>
              </div>

              {/* Right Stacked Cards */}
              <div className="kyc-profile-main-cards">
                {/* 1. Personal Details */}
                <div className="kyc-profile-card">
                  <h3 className="kyc-profile-card-title">Personal Details</h3>
                  <div className="kyc-profile-fields-grid">
                    {renderField('Full Name', data.investorName || deal.customerName)}
                    {renderField('Email', data.email || deal.email)}
                    {renderField('Phone', data.phone || deal.phone)}
                    {renderField('Pan Number', data.panNumber)}
                    {renderField('City', data.city || getResolvedLocation(deal))}
                    {renderField('Date of Birth', data.dob)}
                    {renderField('Occupation', data.occupation)}
                    {renderField('Gender', data.gender)}
                    {renderField('Investor Type', data.investorType)}
                    {renderField('Resident Type', data.residentType)}
                    {renderField('Investment Capacity', getCustomerFilledCapacity(deal))}
                    {renderField('Preferred Asset Class', getIrmPreferredAssetClass(deal))}
                  </div>
                  <div className="kyc-card-footer-action">
                    <button
                      type="button"
                      className="btn-card-edit"
                      onClick={() => handleOpenSectionEdit('personal')}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                  </div>
                </div>

                {/* 2. Address & Identity */}
                <div className="kyc-profile-card">
                  <h3 className="kyc-profile-card-title">Address &amp; Identity</h3>
                  <div className="kyc-profile-fields-grid">
                    {renderField('Name on Document', data.nameAsPerPan || data.investorName || deal.customerName)}
                    {renderField("Father's Name", data.fatherName)}
                    {renderField('Aadhaar Number', data.aadhaarNumber)}
                    {renderField('Permanent Address', data.address)}
                    {renderField('Courier Address', data.courierAddress || data.address)}
                    {renderField('City', data.city || getResolvedLocation(deal))}
                    {renderField('State', data.state)}
                    {renderField('Pincode', data.pincode)}
                    {renderField('Country', data.country || 'India')}
                    {renderField('Aadhaar Document', data.aadhaarDoc?.name)}
                    {renderField('PAN Document', data.panDoc?.name)}
                  </div>
                  <div className="kyc-card-footer-action">
                    <button
                      type="button"
                      className="btn-card-edit"
                      onClick={() => handleOpenSectionEdit('address')}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                  </div>
                </div>

                {/* 3. Nominee Details */}
                <div className="kyc-profile-card">
                  <h3 className="kyc-profile-card-title">Nominee Details</h3>
                  <div className="kyc-profile-fields-grid">
                    {renderField('Nominee Name', data.nominees?.[0]?.name)}
                    {renderField('Relationship', data.nominees?.[0]?.relationship)}
                    {renderField('ID Proof', data.nominees?.[0]?.guardianName ? `Guardian: ${data.nominees[0].guardianName}` : (data.nominees?.[0] ? 'Provided' : null))}
                    {renderField('Share', data.nominees?.[0]?.allocationPercentage ? `${data.nominees[0].allocationPercentage}%` : null)}
                    {renderField('Date of Birth / Age', data.nominees?.[0]?.dob)}
                    {renderField('Nominee Address', data.nominees?.[0]?.address)}
                  </div>
                </div>

                {/* 4. Bank Details */}
                <div className="kyc-profile-card">
                  <h3 className="kyc-profile-card-title">Bank Details</h3>
                  <div className="kyc-profile-fields-grid">
                    {renderField('Bank Name', data.bankName)}
                    {renderField('Account No', data.accountNumber)}
                    {renderField('IFSC', data.ifscCode)}
                    {renderField('Account Type', data.accountType)}
                    {renderField('Bank Proof Document', data.bankProofDoc?.name)}
                  </div>
                </div>

                {/* 5. Demat Details */}
                <div className="kyc-profile-card">
                  <h3 className="kyc-profile-card-title">Demat Details</h3>
                  <div className="kyc-profile-fields-grid">
                    {renderField('Demat Account', data.hasNoDemat ? 'No Demat Account' : (data.dematAccountNumber || data.dematDepository || data.dematDpId ? 'Active Demat' : null))}
                    {renderField('Demat Account Number', data.dematAccountNumber)}
                    {renderField('Depository', data.dematDepository)}
                    {renderField('DP ID', data.dematDpId)}
                    {renderField('Client ID', data.dematClientId)}
                    {renderField('Demat Statement Proof', data.dematDoc?.name)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })() : viewMode === 'table' ? (
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
            onRowClick={deal => handleOpenCustomerProfile(deal)}
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
                onClick={() => setViewMode(selectedCustomerDeal ? 'profile' : 'table')}
              >
                <ArrowLeft size={16} /> Back to {selectedCustomerDeal ? 'Profile' : 'Qualified Investors'}
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

      {/* Quick Section Edit Modal (Personal Details / Address & Identity) */}
      {editingSection && selectedCustomerDeal && (
        <Modal
          isOpen={!!editingSection}
          onClose={() => setEditingSection(null)}
          title={editingSection === 'personal' ? 'Edit Personal Details' : 'Edit Address & Identity'}
          subtitle={`Investor: ${selectedCustomerDeal.customerName} • GHL ID: ${getGhlId(selectedCustomerDeal)}`}
          maxWidth={680}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingSection(null)}
              >
                Cancel
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
                  onClick={() => {
                    const targetStep = editingSection === 'personal' ? 1 : 2;
                    setEditingSection(null);
                    startKycFlow(selectedCustomerDeal, targetStep);
                  }}
                >
                  <FileText size={13} /> Open Full KYC Step ({editingSection === 'personal' ? '1' : '2'})
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveSectionEdit}
                >
                  Save Changes
                </button>
              </div>
            </div>
          }
        >
          {editingSection === 'personal' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sectionFormData.investorName || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, investorName: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={sectionFormData.email || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, email: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sectionFormData.phone || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">PAN Number</label>
                  <input
                    type="text"
                    className="form-input"
                    maxLength={10}
                    placeholder="e.g. ABCDE1234F"
                    value={sectionFormData.panNumber || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, panNumber: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sectionFormData.city || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, city: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-input"
                    value={sectionFormData.dob || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, dob: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Occupation</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Business Owner / Executive"
                    value={sectionFormData.occupation || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, occupation: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Gender</label>
                  <select
                    className="form-select"
                    value={sectionFormData.gender || 'Male'}
                    onChange={e => setSectionFormData({ ...sectionFormData, gender: e.target.value })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Investor Type</label>
                  <select
                    className="form-select"
                    value={sectionFormData.investorType || 'Individual / Retail HNW'}
                    onChange={e => setSectionFormData({ ...sectionFormData, investorType: e.target.value })}
                  >
                    <option value="Individual / Retail HNW">Individual / Retail HNW</option>
                    <option value="HUF (Hindu Undivided Family)">HUF (Hindu Undivided Family)</option>
                    <option value="Corporate / Private Ltd">Corporate / Private Ltd</option>
                    <option value="Partnership / LLP">Partnership / LLP</option>
                    <option value="Family Office / AIF">Family Office / AIF</option>
                    <option value="Trust / Society">Trust / Society</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Resident Type</label>
                  <select
                    className="form-select"
                    value={sectionFormData.residentType || 'Resident Indian (RI)'}
                    onChange={e => setSectionFormData({ ...sectionFormData, residentType: e.target.value })}
                  >
                    <option value="Resident Indian (RI)">Resident Indian (RI)</option>
                    <option value="Non-Resident Indian (NRI)">Non-Resident Indian (NRI)</option>
                    <option value="Overseas Citizen of India (OCI)">Overseas Citizen of India (OCI)</option>
                    <option value="Person of Indian Origin (PIO)">Person of Indian Origin (PIO)</option>
                    <option value="Foreign National">Foreign National</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Preferred Asset Class</label>
                  <select
                    className="form-select"
                    value={sectionFormData.preferredAssetClass || 'CO-AIF'}
                    onChange={e => setSectionFormData({ ...sectionFormData, preferredAssetClass: e.target.value })}
                  >
                    <option value="CO-AIF">CO-AIF</option>
                    <option value="AIF">AIF</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Name on Document</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sectionFormData.nameAsPerPan || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, nameAsPerPan: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Father's Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sectionFormData.fatherName || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, fatherName: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Aadhaar Number</label>
                  <input
                    type="text"
                    className="form-input"
                    maxLength={14}
                    placeholder="12-digit Aadhaar"
                    value={sectionFormData.aadhaarNumber || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, aadhaarNumber: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sectionFormData.city || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, city: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sectionFormData.state || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, state: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Pincode</label>
                  <input
                    type="text"
                    className="form-input"
                    maxLength={6}
                    value={sectionFormData.pincode || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, pincode: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Country</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sectionFormData.country || 'India'}
                    onChange={e => setSectionFormData({ ...sectionFormData, country: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Permanent Address</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={sectionFormData.address || ''}
                  onChange={e => setSectionFormData({ ...sectionFormData, address: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Courier Address</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={sectionFormData.courierAddress || ''}
                  onChange={e => setSectionFormData({ ...sectionFormData, courierAddress: e.target.value })}
                />
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Send Customer KYC Link Modal */}
      <SendKycLinkModal
        isOpen={!!sendLinkDeal}
        onClose={() => setSendLinkDeal(null)}
        deal={sendLinkDeal}
        onShowToast={showToast}
      />

      {/* Review Customer KYC Drawer */}
      <KycReviewDrawer
        isOpen={!!reviewDeal}
        onClose={() => setReviewDeal(null)}
        deal={reviewDeal}
        onShowToast={showToast}
      />
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
