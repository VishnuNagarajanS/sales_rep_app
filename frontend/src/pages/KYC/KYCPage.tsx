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
  RefreshCw,
  UserCheck,
  Save,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { SendKycLinkModal } from './components/SendKycLinkModal';
import { KycStatusBadge } from './components/KycStatusBadge';
import { KycStatusDropdown } from './components/KycStatusDropdown';
import { getCustomerKycStatus, normalizeLegacyKycStatus, KycChecklist, CustomerKycStatus } from '../../services/kycService';
import { KycRowActionsMenu } from './components/KycRowActionsMenu';
import { KycReviewDrawer } from './components/KycReviewDrawer';
import { KycVerifyModal } from './components/KycVerifyModal';
import { KycStageActionDropdown } from './components/KycStageActionDropdown';
import { PERMISSIONS } from '../../constants/permissions';
import { Deal, DealActivity, DocumentItem, Lead, Customer } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import {
  getDeals,
  saveDeal as apiSaveDeal,
  addDealActivity as apiAddDealActivity,
  getLeads,
  getCustomers,
  persistDeal,
} from '../../services/ghlApiService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { Modal } from '../../components/common/Modal';
import { getAuthHeaders } from '../../utils/authHeaders';
import {
  SharedKycFormData,
  NomineeItem,
  validateKycStep,
  GENDER_OPTIONS,
  INVESTOR_TYPE_OPTIONS,
  RESIDENT_TYPE_OPTIONS,
  ACCOUNT_TYPE_OPTIONS,
} from '../../utils/kycValidators';
import './KYCPage.css';

// ── Types for GHL IRM 5-Step Flow ──────────────────────────────────────────────
export type { NomineeItem };

export interface KYCFormData extends SharedKycFormData {
  aadhaarDoc: { name: string; size: string; type: string } | null;
  panDoc: { name: string; size: string; type: string } | null;
  bankProofDoc: { name: string; size: string; type: string } | null;
  dematDoc: { name: string; size: string; type: string } | null;
}

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

  accountType: 'Savings Account',
  accountNumber: '',
  ifscCode: '',
  swiftCode: '',
  accountHolderName: '',
  bankName: '',
  branchName: '',
  bankProofDoc: null,

  hasNoDemat: false,
  dematAccountNumber: '',
  dematDepository: 'CDSL',
  dematDpId: '',
  dematClientId: '',
  dematDoc: null,

  hasNominee: false,
  nominees: [],
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
// PREFERRED ASSET CLASS RESOLVER (Only display if confirmed from real customer/IRM input)
// ==============================================================================
const resolvePreferredAssetClass = (deal: Deal, leadsList: Lead[] = [], customersList: Customer[] = []) => {
  const fDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
  let savedLocal: any = null;
  try {
    const raw =
      (deal.customerId ? localStorage.getItem(`nexus_irm_pref_${deal.customerId}`) : null) ||
      (fDigits ? localStorage.getItem(`nexus_irm_pref_${fDigits}`) : null) ||
      localStorage.getItem(`nexus_irm_pref_${deal.id}`);
    if (raw) savedLocal = JSON.parse(raw);
  } catch { }

  const matchingLead = leadsList.find(l => {
    if (deal.customerId && l.id === deal.customerId) return true;
    const lDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
    return Boolean(lDigits && fDigits && lDigits === fDigits);
  });
  const matchingCustomer = customersList.find(c => {
    if (deal.customerId && c.id === deal.customerId) return true;
    const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
    return Boolean(cDigits && fDigits && cDigits === fDigits);
  });

  const isConfirmed =
    savedLocal?.confirmed === true ||
    matchingLead?.customFields?.irmPreferencesConfirmed === true ||
    matchingCustomer?.customFields?.irmPreferencesConfirmed === true;

  if (savedLocal?.preferredAssetClass && savedLocal.confirmed) return savedLocal.preferredAssetClass;
  if (matchingLead?.customFields?.preferredAssetClass && isConfirmed) return matchingLead.customFields.preferredAssetClass;
  if (matchingCustomer?.customFields?.preferredAssetClass && isConfirmed) return matchingCustomer.customFields.preferredAssetClass;
  if (deal.preferredAssetClass) {
    return deal.preferredAssetClass;
  }

  return '—';
};

// ==============================================================================
// GHL INDIA VENTURES -> IRM KYC EXPERIENCE
// ==============================================================================
const GhlIrmKycView: React.FC = () => {
  const { tenant, user, permissions = [] } = useAuth();
  const { initiateCall } = useCall();

  const reqId = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // KYC Link Feature State
  const [sendLinkDeal, setSendLinkDeal] = useState<Deal | null>(null);
  const [reviewDeal, setReviewDeal] = useState<Deal | null>(null);
  const [dbKycs, setDbKycs] = useState<Record<string, any>>({});
  const [sentDealIds, setSentDealIds] = useState<Record<string, boolean>>({});

  // View state: 'table' | 'flow' | 'profile'
  const [viewMode, setViewMode] = useState<'table' | 'flow' | 'profile'>('table');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [selectedCustomerDeal, setSelectedCustomerDeal] = useState<Deal | null>(null);
  const [profileKycData, setProfileKycData] = useState<Partial<KYCFormData> | null>(null);
  const [verifyModalDeal, setVerifyModalDeal] = useState<Deal | null>(null);

  // Quick Section Edit State (Personal Details / Address & Identity)
  const [editingSection, setEditingSection] = useState<'personal' | 'address' | null>(null);
  const [sectionFormData, setSectionFormData] = useState<Record<string, any>>({});

  // Dossier modal for table preview
  const [selectedDealForDetail, setSelectedDealForDetail] = useState<Deal | null>(null);

  // Form State
  const [formData, setFormData] = useState<KYCFormData>(BLANK_KYC_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [sameAsPermanent, setSameAsPermanent] = useState(false);

  // Assisted KYC State
  const [isAssistedFlow, setIsAssistedFlow] = useState<boolean>(false);
  const [isAssistedReviewModalOpen, setIsAssistedReviewModalOpen] = useState<boolean>(false);
  const [customerConsentChecked, setCustomerConsentChecked] = useState<boolean>(false);
  const [lastSavedDraftAt, setLastSavedDraftAt] = useState<string | null>(null);
  const [validationErrorSummary, setValidationErrorSummary] = useState<string | null>(null);

  const enrichDealWithContact = (d: Deal, leadsList: Lead[], customersList: Customer[]): Deal => {
    // If the API already populated all three contact fields, nothing to do
    if (d.phone && d.email && d.location) return d;

    // Prefer ID-based match; fall back to normalised-phone match; then name match
    const custIdStr = d.customerId ? String(d.customerId) : null;
    const dealPhoneDigits = (d.phone || '').replace(/\D/g, '').slice(-10);
    const dealNameLower = (d.customerName || '').trim().toLowerCase();

    const matchCust = customersList.find(c => {
      if (custIdStr && String(c.id) === custIdStr) return true;
      const cDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
      if (cDigits && dealPhoneDigits && cDigits === dealPhoneDigits) return true;
      if (dealNameLower && c.name && c.name.trim().toLowerCase() === dealNameLower) return true;
      return false;
    });

    const matchLead = !matchCust ? leadsList.find(l => {
      if (custIdStr && String(l.id) === custIdStr) return true;
      const lDigits = (l.phone || '').replace(/\D/g, '').slice(-10);
      if (lDigits && dealPhoneDigits && lDigits === dealPhoneDigits) return true;
      if (dealNameLower && l.name && l.name.trim().toLowerCase() === dealNameLower) return true;
      return false;
    }) : null;

    return {
      ...d,
      phone: d.phone || matchCust?.phone || matchLead?.phone || '',
      email: d.email || matchCust?.email || matchLead?.email || '',
      location: d.location || matchCust?.location || matchLead?.location || '',
    };
  };

  const findBackendKyc = (
    deal: Deal | null | undefined,
    dbKycsMap: Record<string, any>,
    companyId?: string | number
  ): any => {
    if (!deal) return null;
    const allKycs: any[] = Array.from(new Set(Object.values(dbKycsMap || {})));
    const compIdStr = companyId ? String(companyId) : deal.companyId ? String(deal.companyId) : '';

    // 1. Stable direct KYC record ID
    const directKycId = (deal as any).kycId || (deal as any).kycRecordId;
    if (directKycId) {
      const byId = dbKycsMap[`id_${directKycId}`] || allKycs.find(k => k && k.id === Number(directKycId));
      if (byId) return byId;
    }

    // 2. Stable Investor ID (deal.customerId / deal.investorId) and company scope
    const investorIdNum = deal.customerId ? Number(deal.customerId) : (deal as any).investorId ? Number((deal as any).investorId) : 0;
    if (investorIdNum > 0) {
      if (compIdStr) {
        const scopedMatch = allKycs.find(
          k => k && k.investorId === investorIdNum && (!k.companyId || String(k.companyId) === compIdStr)
        );
        if (scopedMatch) return scopedMatch;
      }
      const invMatch = dbKycsMap[`inv_${investorIdNum}`] || allKycs.find(k => k && k.investorId === investorIdNum);
      if (invMatch) return invMatch;
    }

    // 3. Stable Deal ID match if tracked on KYC record
    if (deal.id) {
      const dealMatch = allKycs.find(k => k && (k as any).dealId && String((k as any).dealId) === String(deal.id));
      if (dealMatch) return dealMatch;
    }

    // 4. Fallback to phone match (sanitized 10 digits)
    const phoneDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
    if (phoneDigits) {
      const phoneMatch = allKycs.find(
        k => k && (k.phone || '').replace(/\D/g, '').slice(-10) === phoneDigits &&
          (!compIdStr || !k.companyId || String(k.companyId) === compIdStr)
      );
      if (phoneMatch) return phoneMatch;
    }

    // 5. Fallback to email match
    const email = (deal.email || '').toLowerCase().trim();
    if (email) {
      const emailMatch = allKycs.find(
        k => k && (k.email || '').toLowerCase().trim() === email &&
          (!compIdStr || !k.companyId || String(k.companyId) === compIdStr)
      );
      if (emailMatch) return emailMatch;
    }

    return null;
  };

  const refreshDbKycs = async () => {
    try {
      const res = await fetch('/api/irm/kyc/all', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        const map: Record<string, any> = {};
        json.data.forEach((k: any) => {
          if (!k) return;
          if (k.id) map[`id_${k.id}`] = k;
          if (k.investorId) map[`inv_${k.investorId}`] = k;
          if (k.email) {
            map[`email_${k.email.toLowerCase().trim()}`] = k;
            map[k.email.toLowerCase().trim()] = k;
          }
          if (k.phone) {
            const p10 = (k.phone || '').replace(/\D/g, '').slice(-10);
            if (p10) map[`phone_${p10}`] = k;
          }
          if (k.companyId && k.investorId) {
            map[`comp_${k.companyId}_inv_${k.investorId}`] = k;
          }
        });
        setDbKycs(map);
      }
    } catch {
      // background refresh
    }
  };

  const resolveCustomerKycStatus = (deal: Deal): CustomerKycStatus => {
    // 1. IRM has explicitly set kycStatus on the deal
    if (deal.kycStatus === 'Verified') return 'Verified';
    if (deal.kycStatus === 'Wrong') return 'Needs Correction';

    // 1.5 Check if Assisted KYC was submitted for this deal locally
    const assistedKey = `nexus_kyc_assisted_${deal.id}`;
    const assistedRaw = localStorage.getItem(assistedKey);
    if (assistedRaw) {
      try {
        const parsed = JSON.parse(assistedRaw);
        if (parsed.status === 'Assisted KYC – Submitted for Verification') {
          return 'Assisted KYC – Submitted for Verification';
        }
      } catch {}
    }
    if ((deal as any).customerKycStatus === 'Assisted KYC – Submitted for Verification') {
      return 'Assisted KYC – Submitted for Verification';
    }

    // 2. Check DB KYC record by stable IDs and scope first
    const rec = findBackendKyc(deal, dbKycs, tenant?.id);

    if (rec) {
      const recStatus = (rec.status || '').toLowerCase();
      if (recStatus === 'approved') return 'Verified';
      if (recStatus === 'reuploadrequested') return 'Needs Correction';
      if (recStatus === 'rejected') return 'Rejected';

      // Confirmed backend submission awaiting verification
      if (rec.submittedAt || recStatus === 'pendingreview') {
        if (rec.isAssisted) {
          return 'Assisted KYC – Submitted for Verification';
        }
        return 'Submitted';
      }

      if (recStatus === 'draft') {
        if (rec.isAssisted) return 'Assisted Draft';
        if (rec.kycLinkSent) return 'Link Sent';
        return 'Assisted Draft';
      }
      if (recStatus === 'linksent') return 'Link Sent';
    }

    // 2.5 Check if there is an active Assisted KYC Draft
    const draftKey = `nexus_kyc_draft_${deal.id}`;
    const draftRaw = localStorage.getItem(draftKey);
    if (draftRaw) {
      try {
        const parsed = JSON.parse(draftRaw);
        if (parsed && (parsed.isAssisted || parsed.step)) {
          return 'Assisted Draft';
        }
      } catch {}
    }
    if ((deal as any).customerKycStatus === 'Assisted Draft') {
      return 'Assisted Draft';
    }
    if (rec && (rec.status || '').toLowerCase() === 'draft' && !rec.kycLinkSent) {
      return 'Assisted Draft';
    }

    // 3. IRM clicked "Send Link" in this session but DB hasn't refreshed yet
    if (rec?.kycLinkSent || sentDealIds[deal.id]) return 'Link Sent';

    // 4. Legacy deal property / mock KYC status
    const existing = (deal as any).customerKycStatus;
    if (existing) return existing as CustomerKycStatus;

    return getCustomerKycStatus(deal.id, undefined);
  };

  const loadData = async () => {
    const my = ++reqId.current;
    setIsLoading(true);
    setLoadError(false);
    try {
      const [allDeals, apiLeads, apiCustomers] = await Promise.all([
        getDeals(tenant?.id),
        getLeads(tenant?.id),
        getCustomers(tenant?.id),
      ]);
      if (my !== reqId.current) return;
      const leadsList = apiLeads || [];
      const customersList = apiCustomers || [];
      const enriched = (allDeals || []).map(d => enrichDealWithContact(d, leadsList, customersList));
      const qualified = enriched.filter(d => d.stage === 'qualified_investor');
      const isIrmUser = user?.role?.code === 'irm';
      const scopedQualified = isIrmUser
        ? qualified.filter(d =>
            (d.assignedAgentId && String(d.assignedAgentId) === String(user?.id)) ||
            (d.assignedAgentName && d.assignedAgentName === user?.name)
          )
        : qualified;

      const seenCustomer = new Set<string>();
      const dedupedDeals: Deal[] = [];
      for (const d of scopedQualified) {
        const ph = (d.phone || '').replace(/\D/g, '').slice(-10);
        const em = (d.email || '').trim().toLowerCase();
        const key = ph ? `ph:${ph}` : em ? `em:${em}` : d.customerId ? `cid:${d.customerId}` : `id:${d.id}`;
        if (!seenCustomer.has(key)) {
          seenCustomer.add(key);
          dedupedDeals.push(d);
        }
      }
      setDeals(dedupedDeals);
      setLeads(leadsList);
      setCustomers(customersList);
      setIsLoading(false);
    } catch {
      if (my !== reqId.current) return;
      setLoadError(true);
      setIsLoading(false);
    }

    fetch('/api/irm/kyc/all', {
      headers: getAuthHeaders(),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (my !== reqId.current) return;
        if (json?.success && Array.isArray(json.data)) {
          const map: Record<string, any> = {};
          json.data.forEach((k: any) => {
            if (!k) return;
            if (k.id) map[`id_${k.id}`] = k;
            if (k.investorId) map[`inv_${k.investorId}`] = k;
            if (k.email) {
              map[`email_${k.email.toLowerCase().trim()}`] = k;
              map[k.email.toLowerCase().trim()] = k;
            }
            if (k.phone) {
              const p10 = (k.phone || '').replace(/\D/g, '').slice(-10);
              if (p10) map[`phone_${p10}`] = k;
            }
            if (k.companyId && k.investorId) {
              map[`comp_${k.companyId}_inv_${k.investorId}`] = k;
            }
          });
          setDbKycs(map);
        }
      })
      .catch(() => {
        if (my !== reqId.current) return;
      });
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

    // Only use explicitly provided values — never fall back to deal.value
    return (
      matchingLead?.customFields?.investmentCapacity ||
      matchingLead?.customFields?.capacityRange ||
      matchingLead?.customFields?.investmentRange ||
      (matchingLead as any)?.investmentRange ||
      matchingCustomer?.customFields?.investmentCapacity ||
      (deal.investmentRange && deal.investmentRange.trim() ? deal.investmentRange : null) ||
      '—'
    );
  };

  const getIrmPreferredAssetClass = (deal: Deal) => {
    return resolvePreferredAssetClass(deal, leads, customers);
  };

  const getDynamicKycStatus = (deal: Deal): 'completed' | 'continue' | 'pending' => {
    // Only manual IRM action setting deal.kycStatus === 'Verified' (or legacy Completed with recorded verifiedBy) counts as completed
    const normalized = normalizeLegacyKycStatus(deal.kycStatus, deal.verifiedBy);
    if (normalized === 'Verified') return 'completed';
    return 'pending';
  };

  useEffect(() => {
    loadData();
    let timeoutId: any;
    const handleUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadData();
      }, 300);
    };
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('nexus_storage_updated', handleUpdate);
    };
  }, [tenant?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshDbKycs();
    }, 15000);

    const handleFocus = () => {
      refreshDbKycs();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshDbKycs();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Browser Back button handling while in KYC flow
  useEffect(() => {
    if (viewMode === 'flow') {
      window.history.pushState({ kycFlow: true }, '');
      const handlePopState = () => {
        handleExitFlow();
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [viewMode]);

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

  const buildMergedProfileData = (
    deal: Deal,
    dbKyc: any,
    matchingLead?: any,
    matchingCustomer?: any
  ): Partial<KYCFormData> => {
    const savedKycKey = `nexus_kyc_data_${deal.id}`;
    let saved: Partial<KYCFormData> | null = null;
    try {
      const raw = localStorage.getItem(savedKycKey);
      if (raw) saved = JSON.parse(raw);
    } catch { }

    let dbNominees: NomineeItem[] = [];
    if (dbKyc?.nomineesJson) {
      try {
        const parsed = typeof dbKyc.nomineesJson === 'string'
          ? JSON.parse(dbKyc.nomineesJson)
          : dbKyc.nomineesJson;
        if (Array.isArray(parsed)) {
          dbNominees = parsed.map((n: any, i: number) => ({
            id: String(n.id || `nom-${i + 1}`),
            name: String(n.name || n.nomineeName || ''),
            relationship: String(n.relationship || n.nomineeRelationship || 'Spouse'),
            dob: String(n.dob || n.nomineeDob || ''),
            allocationPercentage: Number(n.allocationPercentage ?? n.nomineeAllocation) || 100,
            address: String(n.address || n.nomineeAddress || ''),
            guardianName: String(n.guardianName || ''),
          }));
        }
      } catch (err) {
        console.warn('Could not parse nomineesJson:', err);
      }
    }

    const docFrom = (url?: string | null, label = 'Uploaded document') =>
      url && String(url).trim() ? { name: label, size: '', type: '' } : null;

    const savedNonEmpty: Record<string, any> = {};
    if (saved && typeof saved === 'object') {
      for (const [key, val] of Object.entries(saved)) {
        if (val !== '' && val !== null && val !== undefined) {
          if (Array.isArray(val)) {
            if (val.length > 0) savedNonEmpty[key] = val;
          } else {
            savedNonEmpty[key] = val;
          }
        }
      }
    }

    return {
      ...savedNonEmpty,
      investorName: dbKyc?.investorName || savedNonEmpty.investorName || deal.customerName || matchingLead?.name || matchingCustomer?.name || '',
      phone: dbKyc?.phone || savedNonEmpty.phone || deal.phone || matchingLead?.phone || matchingCustomer?.phone || '',
      email: dbKyc?.email || savedNonEmpty.email || deal.email || matchingLead?.email || matchingCustomer?.email || '',
      gender: dbKyc?.gender || savedNonEmpty.gender || 'Male',
      investorType: dbKyc?.investorType || savedNonEmpty.investorType || deal.investorType || 'Individual',
      residentType: dbKyc?.residentType || savedNonEmpty.residentType || 'Resident Indian',
      occupation: dbKyc?.occupation || savedNonEmpty.occupation || '',
      city: dbKyc?.city || savedNonEmpty.city || deal.location || matchingLead?.location || matchingCustomer?.location || '',
      state: dbKyc?.state || savedNonEmpty.state || '',
      pincode: dbKyc?.pincode || savedNonEmpty.pincode || '',
      address: dbKyc?.addressLine1 || dbKyc?.address || savedNonEmpty.address || '',
      courierAddress: dbKyc?.addressLine2 || dbKyc?.courierAddress || savedNonEmpty.courierAddress || '',
      country: dbKyc?.country || savedNonEmpty.country || 'India',
      panNumber: dbKyc?.panNumber || savedNonEmpty.panNumber || (deal as any).pan || matchingLead?.customFields?.pan || matchingCustomer?.customFields?.pan || '',
      nameAsPerPan: dbKyc?.nameAsPerPan || dbKyc?.investorName || savedNonEmpty.nameAsPerPan || deal.customerName || '',
      aadhaarNumber: dbKyc?.aadhaarNumber || savedNonEmpty.aadhaarNumber || '',
      fatherName: dbKyc?.fatherName || savedNonEmpty.fatherName || '',
      dob: dbKyc?.dateOfBirth || dbKyc?.dob || savedNonEmpty.dob || '',
      bankName: dbKyc?.bankName || savedNonEmpty.bankName || '',
      accountNumber: dbKyc?.accountNumber || savedNonEmpty.accountNumber || '',
      ifscCode: dbKyc?.ifscCode || savedNonEmpty.ifscCode || '',
      swiftCode: dbKyc?.swiftCode || savedNonEmpty.swiftCode || '',
      accountHolderName: dbKyc?.accountHolderName || dbKyc?.investorName || savedNonEmpty.accountHolderName || deal.customerName || '',
      accountType: dbKyc?.accountType || savedNonEmpty.accountType || '',
      branchName: dbKyc?.branchName || savedNonEmpty.branchName || '',
      hasNoDemat: dbKyc?.hasNoDemat !== undefined ? Boolean(dbKyc.hasNoDemat) : Boolean(savedNonEmpty.hasNoDemat),
      dematAccountNumber: dbKyc?.dematAccountNumber || savedNonEmpty.dematAccountNumber || '',
      dematDepository: dbKyc?.dematDepository || savedNonEmpty.dematDepository || '',
      dematDpId: dbKyc?.dpId || dbKyc?.dematDpId || savedNonEmpty.dematDpId || '',
      dematClientId: dbKyc?.dematClientId || savedNonEmpty.dematClientId || '',
      nominees: dbNominees.length ? dbNominees : (savedNonEmpty.nominees as NomineeItem[] | undefined) || [],
      aadhaarDoc: docFrom(dbKyc?.aadhaarDocumentUrl, 'Aadhaar (uploaded)') || savedNonEmpty.aadhaarDoc || null,
      panDoc: docFrom(dbKyc?.panDocumentUrl, 'PAN (uploaded)') || savedNonEmpty.panDoc || null,
      bankProofDoc: docFrom(dbKyc?.bankChequeUrl, 'Bank proof (uploaded)') || savedNonEmpty.bankProofDoc || null,
      dematDoc: docFrom(dbKyc?.dematDocumentUrl, 'Demat proof (uploaded)') || savedNonEmpty.dematDoc || null,
    };
  };

  const handleOpenCustomerProfile = (deal: Deal) => {
    setSelectedCustomerDeal(deal);

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

    // 1. Stable lookup using stable investor / deal / KYC record ID and company scope first
    const dbKyc = findBackendKyc(deal, dbKycs, tenant?.id);
    const merged = buildMergedProfileData(deal, dbKyc, matchingLead, matchingCustomer);

    setProfileKycData(merged);
    setViewMode('profile');
  };

  useEffect(() => {
    if (!selectedCustomerDeal || viewMode !== 'profile') return;
    let isCancelled = false;
    const fetchLiveKycForProfile = async () => {
      try {
        const targetId = (selectedCustomerDeal as any).kycId ||
                         (selectedCustomerDeal as any).kycRecordId ||
                         (selectedCustomerDeal.customerId ? Number(selectedCustomerDeal.customerId) : 0);
        let liveRecord: any = null;
        if (targetId) {
          const res = await fetch(`/api/irm/kyc/${targetId}`, { headers: getAuthHeaders() });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              liveRecord = json.data;
            }
          }
        }
        if (!liveRecord && selectedCustomerDeal.email) {
          const res = await fetch(`/api/irm/kyc/by-email?email=${encodeURIComponent(selectedCustomerDeal.email)}`, { headers: getAuthHeaders() });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              liveRecord = json.data;
            }
          }
        }
        if (!isCancelled && liveRecord) {
          setDbKycs(prev => ({
            ...prev,
            [`id_${liveRecord.id}`]: liveRecord,
            ...(liveRecord.investorId ? { [`inv_${liveRecord.investorId}`]: liveRecord } : {}),
            ...(liveRecord.email ? { [`email_${liveRecord.email.toLowerCase().trim()}`]: liveRecord, [liveRecord.email.toLowerCase().trim()]: liveRecord } : {}),
          }));
          const fDigits = (selectedCustomerDeal.phone || '').replace(/\D/g, '').slice(-10);
          const matchLead = leads.find(l => (selectedCustomerDeal.customerId && l.id === selectedCustomerDeal.customerId) || (l.phone && l.phone.replace(/\D/g, '').slice(-10) === fDigits));
          const matchCust = customers.find(c => (selectedCustomerDeal.customerId && c.id === selectedCustomerDeal.customerId) || (c.phone && c.phone.replace(/\D/g, '').slice(-10) === fDigits));
          setProfileKycData(buildMergedProfileData(selectedCustomerDeal, liveRecord, matchLead, matchCust));
        }
      } catch (err) {
        console.warn('Error loading live KYC record for customer profile:', err);
      }
    };
    fetchLiveKycForProfile();
    return () => {
      isCancelled = true;
    };
  }, [selectedCustomerDeal, viewMode]);

  const handleExitFlow = () => {
    if (isAssistedFlow && selectedDeal) {
      handleSaveDraft(false);
    }
    setViewMode('table');
    setSelectedCustomerDeal(null);
    setIsAssistedFlow(false);
  };

  // Helper to open the 5-step wizard prefilled with deal info
  const startKycFlow = (deal?: Deal, targetStep?: 1 | 2 | 3 | 4 | 5, isAssisted?: boolean) => {
    const targetDeal = deal || selectedCustomerDeal || null;
    setSelectedDeal(targetDeal);
    if (!isAssisted) {
      if (targetDeal) setSelectedCustomerDeal(targetDeal);
    } else {
      setSelectedCustomerDeal(null);
    }
    setIsAssistedFlow(!!isAssisted);

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
      const matchLead = leads.find(l => (targetDeal.phone && l.phone && l.phone.replace(/\D/g, '').slice(-10) === targetDeal.phone.replace(/\D/g, '').slice(-10)) || (l.id === targetDeal.customerId));
      const matchCust = customers.find(c => (targetDeal.phone && c.phone && c.phone.replace(/\D/g, '').slice(-10) === targetDeal.phone.replace(/\D/g, '').slice(-10)) || (c.id === targetDeal.customerId));
      const custom = matchLead?.customFields || matchCust?.customFields || {};

      initialForm = {
        ...BLANK_KYC_FORM,
        investorName: targetDeal.customerName || '',
        phone: targetDeal.phone || '+91 ',
        email: targetDeal.email || '',
        city: targetDeal.location || custom.city || '',
        nameAsPerPan: targetDeal.customerName || '',
        accountHolderName: targetDeal.customerName || '',
        panNumber: custom.panNumber || custom.pan || '',
        aadhaarNumber: custom.aadhaarNumber || custom.aadhaar || '',
        occupation: custom.occupation || '',
        address: custom.address || '',
        state: custom.state || '',
        pincode: custom.pincode || '',
      };
    }

    // If backend record exists in dbKycs, reload genuine submitted/drafted KYC data
    if (targetDeal) {
      const emailKey = (targetDeal.email || '').toLowerCase().trim();
      const phoneDigits = (targetDeal.phone || '').replace(/\D/g, '').slice(-10);
      const dbKyc = dbKycs[emailKey] || (phoneDigits ? Object.values(dbKycs).find((k: any) => (k.phone || '').replace(/\D/g, '').slice(-10) === phoneDigits) : null);

      if (dbKyc) {
        let dbNominees: NomineeItem[] = [];
        let hasNomineeFlag = false;
        if (dbKyc.nomineesJson) {
          try {
            const parsed = typeof dbKyc.nomineesJson === 'string'
              ? JSON.parse(dbKyc.nomineesJson)
              : dbKyc.nomineesJson;
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.name) {
              dbNominees = parsed.map((n: any, i: number) => ({
                id: String(n.id || `nom-${i + 1}`),
                name: String(n.name || n.nomineeName || ''),
                relationship: String(n.relationship || n.nomineeRelationship || 'Spouse'),
                dob: String(n.dob || n.nomineeDob || ''),
                allocationPercentage: Number(n.allocationPercentage ?? n.nomineeAllocation) || 100,
                address: String(n.address || n.nomineeAddress || ''),
                guardianName: String(n.guardianName || ''),
              }));
              hasNomineeFlag = true;
            }
          } catch {}
        }

        const docFrom = (url?: string | null, label = 'Uploaded document') =>
          url && String(url).trim() ? { name: label, size: 'Saved', type: 'application/pdf' } : null;

        initialForm = {
          ...initialForm,
          investorName: dbKyc.investorName || initialForm.investorName || targetDeal.customerName || '',
          phone: dbKyc.phone || initialForm.phone || targetDeal.phone || '',
          email: dbKyc.email || initialForm.email || targetDeal.email || '',
          gender: dbKyc.gender || initialForm.gender || 'Male',
          investorType: dbKyc.investorType || initialForm.investorType || 'Individual / Retail HNW',
          residentType: dbKyc.residentType || initialForm.residentType || 'Resident Indian (RI)',
          occupation: dbKyc.occupation || initialForm.occupation || '',
          panNumber: dbKyc.panNumber || initialForm.panNumber || '',
          nameAsPerPan: dbKyc.nameAsPerPan || dbKyc.investorName || initialForm.nameAsPerPan || '',
          aadhaarNumber: dbKyc.aadhaarNumber || initialForm.aadhaarNumber || '',
          fatherName: dbKyc.fatherName || initialForm.fatherName || '',
          dob: dbKyc.dateOfBirth || dbKyc.dob || initialForm.dob || '',
          address: dbKyc.addressLine1 || dbKyc.address || initialForm.address || '',
          courierAddress: dbKyc.addressLine2 || dbKyc.courierAddress || initialForm.courierAddress || '',
          country: dbKyc.country || initialForm.country || 'India',
          state: dbKyc.state || initialForm.state || '',
          city: dbKyc.city || initialForm.city || '',
          pincode: dbKyc.pincode || initialForm.pincode || '',
          bankName: dbKyc.bankName || initialForm.bankName || '',
          accountNumber: dbKyc.accountNumber || initialForm.accountNumber || '',
          ifscCode: dbKyc.ifscCode || initialForm.ifscCode || '',
          accountType: dbKyc.accountType || initialForm.accountType || 'Savings Account',
          accountHolderName: dbKyc.accountHolderName || dbKyc.nameAsPerPan || dbKyc.investorName || initialForm.accountHolderName || '',
          hasNoDemat: dbKyc.dematAccountNumber ? false : initialForm.hasNoDemat,
          dematAccountNumber: dbKyc.dematAccountNumber || initialForm.dematAccountNumber || '',
          dematDepository: dbKyc.dematDepository || initialForm.dematDepository || 'CDSL',
          dematDpId: dbKyc.dpId || dbKyc.dematDpId || initialForm.dematDpId || '',
          dematClientId: dbKyc.dematClientId || initialForm.dematClientId || '',
          hasNominee: hasNomineeFlag,
          nominees: dbNominees,
          aadhaarDoc: docFrom(dbKyc.aadhaarDocumentUrl, 'Aadhaar (saved)') || initialForm.aadhaarDoc,
          panDoc: docFrom(dbKyc.panDocumentUrl, 'PAN (saved)') || initialForm.panDoc,
          bankProofDoc: docFrom(dbKyc.bankChequeUrl, 'Bank proof (saved)') || initialForm.bankProofDoc,
          dematDoc: docFrom(dbKyc.dematDocumentUrl, 'Demat statement (saved)') || initialForm.dematDoc,
        };
      }
    }

    // Check if there was a saved draft with step info
    let resumeStep = targetStep;
    if (targetDeal) {
      try {
        const draftMeta = localStorage.getItem(`nexus_kyc_draft_${targetDeal.id}`);
        if (draftMeta) {
          const parsed = JSON.parse(draftMeta);
          if (parsed.savedAt) {
            setLastSavedDraftAt(parsed.savedAt);
          }
          if (!resumeStep && parsed.step && parsed.step >= 1 && parsed.step <= 5) {
            resumeStep = parsed.step;
          }
        }
      } catch {}
    }

    setFormData(initialForm);
    setFormErrors({});
    setValidationErrorSummary(null);
    setCurrentStep(resumeStep || 1);
    setViewMode('flow');
  };

  const startAssistedKycFlow = (deal: Deal, targetStep?: 1 | 2 | 3 | 4 | 5) => {
    startKycFlow(deal, targetStep, true);
  };

  const saveBackendDraft = async (deal: Deal, data: KYCFormData, step: number) => {
    try {
      const payload = {
        investorId: deal.customerId ? Number(deal.customerId) || 0 : 0,
        investorName: data.investorName || deal.customerName,
        phone: data.phone || deal.phone,
        email: data.email || deal.email,
        gender: data.gender,
        investorType: data.investorType,
        residentType: data.residentType,
        occupation: data.occupation,
        panNumber: data.panNumber,
        nameAsPerPan: data.nameAsPerPan,
        aadhaarNumber: data.aadhaarNumber,
        fatherName: data.fatherName,
        dob: data.dob,
        country: data.country,
        addressLine1: data.address,
        addressLine2: data.courierAddress,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode,
        accountType: data.accountType,
        dematAccountNumber: data.hasNoDemat ? null : data.dematAccountNumber,
        nomineesJson: data.hasNominee && data.nominees && data.nominees.length > 0 ? JSON.stringify(data.nominees) : '[]',
        panDocumentUrl: data.panDoc?.name || null,
        aadhaarDocumentUrl: data.aadhaarDoc?.name || null,
        bankChequeUrl: data.bankProofDoc?.name || null,
        dematDocumentUrl: data.hasNoDemat ? null : (data.dematDoc?.name || null),
        customerConsentObtained: true,
        customerConsentTimestamp: new Date().toISOString(),
        customerConsentDetails: "Customer verbal and electronic consent obtained during assisted KYC session.",
        isFinalSubmit: false,
      };
      await fetch('/api/irm/kyc/assisted-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('Draft save error:', err);
    }
  };

  const submitBackendAssistedKyc = async (deal: Deal, data: KYCFormData) => {
    try {
      const payload = {
        investorId: deal.customerId ? Number(deal.customerId) || 0 : 0,
        investorName: data.investorName || deal.customerName,
        phone: data.phone || deal.phone,
        email: data.email || deal.email,
        gender: data.gender,
        investorType: data.investorType,
        residentType: data.residentType,
        occupation: data.occupation,
        panNumber: data.panNumber,
        nameAsPerPan: data.nameAsPerPan,
        aadhaarNumber: data.aadhaarNumber,
        fatherName: data.fatherName,
        dob: data.dob,
        country: data.country,
        addressLine1: data.address,
        addressLine2: data.courierAddress,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        ifscCode: data.ifscCode,
        accountType: data.accountType,
        dematAccountNumber: data.hasNoDemat ? null : data.dematAccountNumber,
        nomineesJson: data.hasNominee && data.nominees && data.nominees.length > 0 ? JSON.stringify(data.nominees) : '[]',
        panDocumentUrl: data.panDoc?.name || null,
        aadhaarDocumentUrl: data.aadhaarDoc?.name || null,
        bankChequeUrl: data.bankProofDoc?.name || null,
        dematDocumentUrl: data.hasNoDemat ? null : (data.dematDoc?.name || null),
        customerConsentObtained: Boolean(customerConsentChecked),
        customerConsentTimestamp: new Date().toISOString(),
        customerConsentDetails: "Customer verbal and electronic consent obtained during assisted KYC session.",
        isFinalSubmit: true,
      };
      const res = await fetch('/api/irm/kyc/assisted-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Failed to submit assisted KYC to backend');
      }
      const json = await res.json().catch(() => null);
      return json?.data;
    } catch (err) {
      console.error('[Assisted KYC] Backend submit error:', err);
      throw err;
    }
  };

  const handleSaveDraft = (showToastNotice: boolean = true) => {
    if (!selectedDeal) return;
    const dealId = selectedDeal.id;

    // Preserve existing submitted/verified status — avoid overwriting
    const currentResolved = resolveCustomerKycStatus(selectedDeal);
    const isAlreadyFinished =
      currentResolved === 'Verified' ||
      currentResolved === 'Submitted' ||
      currentResolved === 'Assisted KYC – Submitted for Verification';

    // 1. Save all form field values
    localStorage.setItem(`nexus_kyc_data_${dealId}`, JSON.stringify(formData));

    // 2. Save draft metadata
    const nowIso = new Date().toISOString();
    const draftPayload = {
      isAssisted: true,
      step: currentStep,
      savedAt: nowIso,
      assistedByIrmId: user?.id,
      assistedByIrmName: user?.name,
      status: 'Assisted Draft',
    };
    localStorage.setItem(`nexus_kyc_draft_${dealId}`, JSON.stringify(draftPayload));
    setLastSavedDraftAt(nowIso);

    // 3. Mark status as 'Assisted Draft' ONLY if not already finished
    if (!isAlreadyFinished) {
      localStorage.setItem(`nexus_kyc_status_${dealId}`, 'Assisted Draft');
      const updatedDeal: Deal = {
        ...selectedDeal,
        customerKycStatus: 'Assisted Draft' as any,
      };
      persistDeal(updatedDeal).catch(() => {});
    }

    // 4. Save to backend if authenticated
    if (user) {
      saveBackendDraft(selectedDeal, formData, currentStep).catch(() => {});
    }

    window.dispatchEvent(new Event('nexus_storage_updated'));
    if (showToastNotice) {
      showToast(`Assisted KYC draft saved at Step ${currentStep} of 5. You can resume at any time.`);
    }
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
        gender: current.gender || '',
        investorType: current.investorType || '',
        residentType: current.residentType || '',
        preferredAssetClass: deal ? (getIrmPreferredAssetClass(deal) === '—' ? '' : getIrmPreferredAssetClass(deal)) : '',
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
  void handleOpenSectionEdit;

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
      persistDeal(updatedDeal).catch(e => showToast("Error saving deal:"));
      setSelectedCustomerDeal(updatedDeal);
      loadData();
    }

    // Save preferred asset class if changed
    if (editingSection === 'personal') {
      const fDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
      const val = sectionFormData.preferredAssetClass?.trim() || '';
      const prefObj = {
        preferredAssetClass: val,
        confirmed: Boolean(val),
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

  // Advance deal to opportunity — saves to DB
  
  const handleStatusChange = async (
    deal: Deal,
    newStatus: 'Pending' | 'Wrong' | 'Verified',
    comment?: string,
    flaggedSections?: string[],
    checklist?: KycChecklist
  ) => {
    const newCustStatus =
      newStatus === 'Verified' ? 'Verified' : newStatus === 'Wrong' ? 'Needs Correction' : 'Submitted';
    const verifiedBy = newStatus === 'Verified' ? (user?.email || 'irm@ghl.com') : undefined;
    const verifiedAt = newStatus === 'Verified' ? new Date().toISOString() : undefined;

    // Resolve KYC record ID from the deal's own kycId / kycRecordId or matching dbKycs
    const emailKey = (deal.email || '').toLowerCase().trim();
    const phoneDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
    const dbItem = dbKycs[emailKey] || (phoneDigits ? Object.values(dbKycs).find((k: any) => (k.phone || '').replace(/\D/g, '').slice(-10) === phoneDigits) : null);
    const resolvedKycId =
      (deal as any).kycId ||
      (deal as any).kycRecordId ||
      dbItem?.id ||
      deal.customerId ||
      deal.id;

    if (typeof resolvedKycId === 'number' || /^\d+$/.test(String(resolvedKycId))) {
      try {
        const res = await fetch(`/api/irm/kyc/${resolvedKycId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            status: newStatus,
            comment,
            flaggedSections,
            checklist,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.message || `KYC status update rejected by backend (${res.status})`;
          showToast(errMsg);
          throw new Error(errMsg);
        }
      } catch (err: any) {
        console.warn('[KYCPage] PATCH status error:', err);
        showToast(err?.message || 'Error updating KYC status in backend.');
        throw err;
      }
    } else if (newStatus === 'Verified') {
      const errMsg = 'Cannot verify KYC: No valid backend KYC submission found for this customer.';
      showToast(errMsg);
      throw new Error(errMsg);
    }

    const updatedDeal: Deal = {
      ...deal,
      kycStatus: newStatus,
      verifiedBy,
      verifiedAt,
      remarks: comment,
      flaggedSections,
      customerKycStatus: newCustStatus,
    };

    setSelectedCustomerDeal(updatedDeal);
    setDeals(prev => prev.map(d => (d.id === deal.id ? updatedDeal : d)));
    await persistDeal(updatedDeal);
    showToast(`KYC Status updated to ${newStatus}`);
    loadData();
  };

  const handleAdvanceStage = async (deal: Deal) => {
    const updatedDeal: Deal = {
      ...deal,
      stage: 'investment_opportunity',
      stageEnteredAt: new Date().toISOString(),
    };

    // Save updated deal stage to DB
    try {
      await persistDeal(updatedDeal);
    } catch (err) {
      console.warn('[KYCPage] API saveDeal (advance stage) failed:', err);
      showToast("Error updating deal stage");
    }

    const activity: DealActivity = {
      id: `act-${Date.now()}`,
      dealId: deal.id,
      companyId: tenant?.id || '',
      type: 'stage_change',
      fromStage: 'qualified_investor',
      toStage: 'investment_opportunity',
      text: 'KYC Completed → Moved to Investment Opportunities by IRM',
      loggedByName: user?.name || 'IRM User',
      loggedByRole: 'IRM',
      timestamp: new Date().toISOString(),
    };

    // Save activity to DB
    try {
      await apiAddDealActivity(activity);
    } catch (err) {
      console.warn('[KYCPage] API addDealActivity failed:', err);
      storageService.addDealActivity(activity);
    }

    if (selectedDealForDetail?.id === deal.id) {
      setSelectedDealForDetail(null);
    }

    loadData();
    showToast(`✓ ${deal.customerName} moved to Investment Opportunities!`);
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
    const errs = validateKycStep(step as 1 | 2 | 3 | 4 | 5, formData);

    // In Assisted KYC flow, validate document uploads:
    if (step === 2) {
      if (!formData.aadhaarDoc) {
        errs.aadhaarDoc = 'Upload Aadhaar is required';
      }
      if (!formData.panDoc) {
        errs.panDoc = 'Upload PAN is required';
      }
    }
    if (step === 3) {
      if (!formData.bankProofDoc) {
        errs.bankProofDoc = 'Upload Bank Statement / Cheque / Passbook is required';
      }
    }
    if (step === 4) {
      if (!formData.hasNoDemat && !formData.dematDoc) {
        errs.dematDoc = 'Upload Demat Statement is required';
      }
    }

    const count = Object.keys(errs).length;
    if (count > 0) {
      setValidationErrorSummary(`Please correct the ${count} required field(s) marked in red below before continuing.`);
    } else {
      setValidationErrorSummary(null);
    }
    setFormErrors(errs);
    return count === 0;
  };

  const handleContinue = () => {
    if (validateStep(currentStep)) {
      setFormErrors({});
      setValidationErrorSummary(null);
      if (selectedDeal) {
        localStorage.setItem(`nexus_kyc_data_${selectedDeal.id}`, JSON.stringify(formData));
        if (isAssistedFlow) {
          const nextStep = Math.min(5, currentStep + 1);
          localStorage.setItem(`nexus_kyc_draft_${selectedDeal.id}`, JSON.stringify({
            isAssisted: true,
            step: nextStep,
            savedAt: new Date().toISOString(),
            assistedByIrmId: user?.id,
            assistedByIrmName: user?.name,
            status: 'Assisted Draft',
          }));
          const currentStatus = localStorage.getItem(`nexus_kyc_status_${selectedDeal.id}`);
          if (currentStatus !== 'Completed' && currentStatus !== 'Submitted for Review' && currentStatus !== 'Assisted KYC – Submitted for Verification') {
            localStorage.setItem(`nexus_kyc_status_${selectedDeal.id}`, 'Assisted Draft');
          }
        } else {
          const currentStatus = localStorage.getItem(`nexus_kyc_status_${selectedDeal.id}`);
          if (currentStatus !== 'Completed' && currentStatus !== 'Submitted for Review') {
            localStorage.setItem(`nexus_kyc_status_${selectedDeal.id}`, 'Partially Completed');
          }
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
    setValidationErrorSummary(null);
    if (isAssistedFlow && selectedDeal) {
      handleSaveDraft(false);
    }
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5);
    } else {
      handleExitFlow();
    }
  };

  const handleOpenReviewForSubmission = () => {
    if (!validateStep(5)) return;
    setCustomerConsentChecked(false);
    setIsAssistedReviewModalOpen(true);
  };

  const handleConfirmAssistedSubmit = async () => {
    if (!customerConsentChecked) {
      showToast('Please obtain and confirm customer consent before submitting.');
      return;
    }
    if (!selectedDeal) return;

    let savedKycDto: any = null;
    // Await server submission first; never report success if backend save fails
    if (user) {
      try {
        savedKycDto = await submitBackendAssistedKyc(selectedDeal, formData);
        if (savedKycDto?.id) {
          selectedDeal.kycId = savedKycDto.id;
          (selectedDeal as any).kycRecordId = savedKycDto.id;
        }
      } catch (err: any) {
        showToast(`⚠️ Failed to submit assisted KYC: ${err.message || 'Server error'}`);
        return;
      }
    }

    const investorName = formData.investorName.trim();
    const dealId = selectedDeal.id;
    const nowIso = new Date().toISOString();

    const assistedMetadata = {
      isAssisted: true,
      assistedByIrmId: user?.id,
      assistedByIrmName: user?.name,
      submittedAt: nowIso,
      customerConsentObtained: true,
      customerConsentTimestamp: nowIso,
      status: 'Assisted KYC – Submitted for Verification',
    };

    // 1. Persist full KYC form data in localStorage
    localStorage.setItem(`nexus_kyc_data_${dealId}`, JSON.stringify({
      ...formData,
      assistedMetadata,
    }));
    localStorage.setItem(`nexus_kyc_status_${dealId}`, 'Submitted for Review');
    localStorage.setItem(`nexus_kyc_assisted_${dealId}`, JSON.stringify(assistedMetadata));

    // Clear draft
    localStorage.removeItem(`nexus_kyc_draft_${dealId}`);

    try {
      const raw = localStorage.getItem('nexus_mock_kyc_records');
      const records = raw ? JSON.parse(raw) : {};
      records[dealId] = {
        ...(records[dealId] || {}),
        status: 'Submitted',
        kycStatus: 'Pending',
        isAssisted: true,
        assistedByIrmId: user?.id,
        assistedByIrmName: user?.name,
        submittedAt: nowIso,
      };
      localStorage.setItem('nexus_mock_kyc_records', JSON.stringify(records));
    } catch {}

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

    // 3. Log deal activity & audit log
    const activityText = `Assisted KYC – Submitted for Verification on behalf of customer with consent by IRM ${user?.name || 'IRM User'} (ID: ${user?.id || '—'}) at ${new Date(nowIso).toLocaleString()}`;
    const activity: DealActivity = {
      id: `act-${Date.now()}`,
      dealId: selectedDeal.id,
      companyId: tenant?.id || '',
      type: 'note',
      text: activityText,
      loggedByName: user?.name || 'IRM User',
      loggedByRole: 'IRM',
      timestamp: nowIso,
    };
    storageService.addDealActivity(activity);

    storageService.addAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: nowIso,
      actorName: user?.name || 'IRM User',
      actorEmail: user?.email || '',
      action: 'assisted_kyc_submit',
      entityType: 'kyc',
      entityId: selectedDeal.id,
      details: activityText,
    });

    // 4. Update deal with Assisted KYC status, stable kycId, and attribution
    const updatedDeal: Deal = {
      ...selectedDeal,
      kycId: selectedDeal.kycId,
      customerKycStatus: 'Assisted KYC – Submitted for Verification' as any,
      notes: selectedDeal.notes ? `${selectedDeal.notes} | ${activityText}` : activityText,
    };
    try {
      await persistDeal(updatedDeal);
    } catch (e) {
      console.warn('Error saving deal:', e);
    }

    if (savedKycDto?.id) {
      const kycRec = { ...savedKycDto, status: 'PendingReview', submittedAt: nowIso };
      setDbKycs(prev => ({
        ...prev,
        [`id_${savedKycDto.id}`]: kycRec,
        ...(savedKycDto.investorId ? { [`inv_${savedKycDto.investorId}`]: kycRec } : {}),
      }));
    }
    refreshDbKycs();

    setIsAssistedReviewModalOpen(false);
    setIsAssistedFlow(false);
    showToast(`Assisted KYC for "${investorName}" submitted for verification!`);
    loadData();
    setSelectedCustomerDeal(null);
    setViewMode('table');
  };

  // Submit KYC for Review
  const handleSubmitKycForReview = () => {
    handleOpenReviewForSubmission();
  };

  // Nominee helpers
  const handleAddNominee = () => {
    if (formData.nominees.length >= 3) return;
    const currentCount = formData.nominees.length;
    const newNominee: NomineeItem = {
      id: `nom-${Date.now()}`,
      name: '',
      relationship: 'Spouse',
      dob: '',
      allocationPercentage: currentCount === 0 ? 100 : 0,
      address: '',
      guardianName: '',
    };
    setFormData(prev => ({
      ...prev,
      hasNominee: true,
      nominees: [...prev.nominees, newNominee],
    }));
  };

  const handleRemoveNominee = (idOrIndex: string | number) => {
    setFormData(prev => {
      const updated = prev.nominees.filter((n, i) => (n.id ? n.id !== idOrIndex : i !== idOrIndex));
      return {
        ...prev,
        nominees: updated,
        hasNominee: updated.length > 0,
      };
    });
  };

  const handleNomineeChange = (idOrIndex: string | number, field: keyof NomineeItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      nominees: prev.nominees.map((n, i) =>
        (n.id ? n.id === idOrIndex : i === idOrIndex) ? { ...n, [field]: value } : n
      ),
    }));
    setFormErrors(prev => {
      const c = { ...prev };
      delete c.nominees;
      return c;
    });
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
      width: '160px',
      render: deal => {
        const custStatus = resolveCustomerKycStatus(deal);
        return (
          <KycStatusDropdown
            deal={deal}
            customerKycStatus={custStatus}
            hideArrow
            onChange={(status, comment, flaggedSections, checklist) =>
              handleStatusChange(deal, status, comment, flaggedSections, checklist)
            }
            onShowToast={(msg) => showToast(msg)}
          />
        );
      },
    },
    {
      key: 'customerKycStatus',
      header: 'Customer KYC',
      width: '140px',
      render: deal => {
        const custStatus = resolveCustomerKycStatus(deal);
        return <KycStatusBadge status={custStatus} />;
      },
    },
    {
      key: 'stageAction',
      header: 'Stage Action',
      width: '180px',
      render: deal => {
        const status = resolveCustomerKycStatus(deal);

        // IRM-verified: show professional Verified badge with checkmark
        if (status === 'Verified') {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: 'rgba(16,185,129,0.1)',
                color: '#059669',
                border: '1px solid rgba(16,185,129,0.3)',
              }}
              title="KYC verified by IRM"
            >
              <CheckCircle size={12} /> Verified
            </span>
          );
        }

        // Assisted KYC submitted awaiting IRM verification: show compact green assisted icon with hover/focus tooltip
        if (status === 'Assisted KYC – Submitted for Verification') {
          return (
            <div
              className="kyc-stage-action-group"
              onClick={e => e.stopPropagation()}
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <div className="kyc-stage-action-tooltip-wrapper">
                <button
                  type="button"
                  className="kyc-stage-action-btn"
                  tabIndex={0}
                  aria-label="Assisted KYC submitted — awaiting IRM verification"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    borderColor: 'rgba(16, 185, 129, 0.35)',
                    color: '#059669',
                    cursor: 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    minWidth: 28,
                    borderRadius: 6,
                    padding: 0,
                  }}
                >
                  <UserCheck size={14} />
                </button>
                <span
                  className="kyc-stage-action-tooltip"
                  role="tooltip"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Assisted KYC submitted — awaiting IRM verification
                </span>
              </div>
            </div>
          );
        }

        // Customer or IRM submitted: waiting for IRM review — show a status badge, not a send button
        if (
          status === 'Submitted' ||
          status === 'Under Verification' ||
          status === 'Completed'
        ) {
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 6,
                backgroundColor: 'rgba(99, 102, 241, 0.10)',
                color: '#6366f1',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                whiteSpace: 'nowrap',
              }}
              title="Customer has submitted the KYC form — awaiting IRM review"
            >
              <CheckCircle size={12} />
              KYC Submitted
            </span>
          );
        }

        // Assisted Draft: show distinct standalone Resume Draft icon and Send Link icon
        if (status === 'Assisted Draft') {
          return (
            <div
              className="kyc-stage-action-group"
              onClick={e => e.stopPropagation()}
            >
              <div className="kyc-stage-action-tooltip-wrapper">
                <button
                  type="button"
                  className="kyc-stage-action-btn kyc-stage-action-btn--draft"
                  aria-label="Resume Draft"
                  title="Resume Draft"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startAssistedKycFlow(deal);
                  }}
                >
                  <Clock size={13} />
                </button>
                <span className="kyc-stage-action-tooltip" role="tooltip">
                  Resume Draft
                </span>
              </div>

              <div className="kyc-stage-action-tooltip-wrapper">
                <button
                  type="button"
                  className="kyc-stage-action-btn kyc-stage-action-btn--link"
                  aria-label="Send KYC Link"
                  title="Send KYC Link"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const enriched = enrichDealWithContact(deal, leads, customers);
                    setSendLinkDeal(enriched);
                  }}
                >
                  <Send size={13} />
                </button>
                <span className="kyc-stage-action-tooltip" role="tooltip">
                  Send KYC Link
                </span>
              </div>
            </div>
          );
        }

        const isResend = ['Link Sent', 'In Progress', 'Needs Correction', 'Rejected'].includes(status);
        const isIrmRole = user?.role?.code === 'irm';

        return (
          <KycStageActionDropdown
            deal={deal}
            isResend={isResend}
            isIrmRole={isIrmRole}
            onSendLink={() => {
              const enriched = enrichDealWithContact(deal, leads, customers);
              setSendLinkDeal(enriched);
            }}
            onAssistedKyc={() => {
              startAssistedKycFlow(deal);
            }}
          />
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '80px',
      align: 'center',
      render: deal => {
        const kycStatus = getDynamicKycStatus(deal);
        return (
          <KycRowActionsMenu
            deal={deal}
            onOpenReview={d => setReviewDeal(d)}
            onShowToast={msg => showToast(msg)}
            onViewProfile={d => handleOpenCustomerProfile(d)}
            onEditKyc={d => startKycFlow(d)}
            onAssistedKyc={d => startAssistedKycFlow(d)}
            onCallInvestor={d => initiateCall(d.customerName, d.phone || '', 'customer', d.id)}
            // Only show "Advance to Opportunity" after KYC is fully completed
            onAdvanceStage={normalizeLegacyKycStatus(deal.kycStatus, deal.verifiedBy) === 'Verified' ? d => handleAdvanceStage(d) : undefined}
          />
        );
      },
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

                {/* Status Dropdown on Profile Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 12 }}>
                  <KycStatusDropdown
                    deal={deal}
                    customerKycStatus={resolveCustomerKycStatus(deal)}
                    onChange={(status, comment, flaggedSections, checklist) =>
                      handleStatusChange(deal, status, comment, flaggedSections, checklist)
                    }
                    onShowToast={showToast}
                  />
                  {deal.kycStatus === 'Verified' && (deal.verifiedBy || deal.verifiedAt) && (
                    <span style={{ fontSize: 11, color: '#059669', marginTop: 5, fontWeight: 600, textAlign: 'center' }}>
                      Verified by {deal.verifiedBy ? deal.verifiedBy.split('@')[0] : 'IRM'}
                      {deal.verifiedAt ? ' on ' + new Date(deal.verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    </span>
                  )}
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

                {/* Verify KYC Button */}
                {(() => {
                  const normalizedStatus = normalizeLegacyKycStatus(deal.kycStatus, deal.verifiedBy);
                  const custStatus = resolveCustomerKycStatus(deal);
                  const backendKyc = findBackendKyc(deal, dbKycs, tenant?.id);

                  // Backend confirmed submission: record has submittedAt and is awaiting review or approved
                  const backendSubmitted = Boolean(
                    backendKyc && (
                      (backendKyc.submittedAt && (backendKyc.status || '').toLowerCase() === 'pendingreview') ||
                      (backendKyc.submittedAt && (backendKyc.status || '').toLowerCase() === 'approved') ||
                      (backendKyc.isAssisted && backendKyc.customerConsentObtained && backendKyc.submittedAt)
                    )
                  );

                  // Distinguish draft-only records from submitted records
                  const isBackendDraft = Boolean(
                    backendKyc &&
                    (backendKyc.status || '').toLowerCase() === 'draft' &&
                    !backendKyc.submittedAt
                  );

                  const isAssistedSubmitted =
                    custStatus === 'Assisted KYC – Submitted for Verification' ||
                    (deal as any).customerKycStatus === 'Assisted KYC – Submitted for Verification' ||
                    Boolean(backendKyc?.isAssisted && backendSubmitted);

                  const isDraftOnly =
                    custStatus === 'Assisted Draft' ||
                    (deal as any).customerKycStatus === 'Assisted Draft' ||
                    isBackendDraft;

                  const customerSubmitted =
                    !isDraftOnly && (
                      backendSubmitted ||
                      isAssistedSubmitted ||
                      custStatus === 'Completed' ||
                      custStatus === 'Submitted' ||
                      custStatus === 'Under Verification' ||
                      custStatus === 'Verified'
                    );

                  const canVerify =
                    permissions.includes(PERMISSIONS.KYC_VERIFY) ||
                    user?.role?.code === 'irm' ||
                    user?.role?.code === 'company_admin' ||
                    user?.role?.code === 'super_admin' ||
                    user?.role?.code === 'sales_executive' ||
                    !permissions ||
                    permissions.length === 0;

                  const isBtnDisabled = !canVerify || !customerSubmitted;
                  const tooltipText = !canVerify
                    ? 'You do not have permission to verify KYC'
                    : isDraftOnly
                      ? 'Assisted KYC is currently an incomplete draft and has not been submitted yet'
                      : !customerSubmitted
                        ? 'Customer has not submitted KYC yet'
                        : undefined;

                  return (
                    <button
                      type="button"
                      className="btn-complete-kyc"
                      disabled={isBtnDisabled}
                      title={tooltipText}
                      style={{
                        backgroundColor: normalizedStatus === 'Verified' ? '#059669' : '#2563eb',
                        borderColor: normalizedStatus === 'Verified' ? '#059669' : '#2563eb',
                        cursor: isBtnDisabled ? 'not-allowed' : 'pointer',
                        opacity: isBtnDisabled ? 0.6 : 1,
                      }}
                      onClick={() => {
                        if (!profileKycData) {
                          const fDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
                          const matchLead = leads.find(l => (deal.customerId && l.id === deal.customerId) || (l.phone && l.phone.replace(/\D/g, '').slice(-10) === fDigits));
                          const matchCust = customers.find(c => (deal.customerId && c.id === deal.customerId) || (c.phone && c.phone.replace(/\D/g, '').slice(-10) === fDigits));
                          setProfileKycData(buildMergedProfileData(deal, backendKyc, matchLead, matchCust));
                        }
                        setVerifyModalDeal(deal);
                      }}
                    >
                      <ShieldCheck size={14} />
                      {normalizedStatus === 'Verified' ? 'Re-verify KYC' : 'Verify KYC'}
                    </button>
                  );
                })()}
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

          </div>

          {/* Inline Error Banner */}
          {loadError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              marginBottom: 16,
              borderRadius: 8,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              fontSize: 13,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} />
                <span>Failed to load KYC data from server. Please check your connection or try again.</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => loadData()}
                style={{ borderColor: '#ef4444', color: '#ef4444' }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Data Table */}
          {isLoading && filteredDeals.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>Loading Qualified Investors...</p>
            </div>
          ) : (
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
          )}
        </>
      ) : (        /* ── 5-STEP KYC FLOW CONTAINER ── */
        <div className="kyc-flow-card">
          {/* Top Bar with Back to Table link */}
          <div className="kyc-flow-top-bar">
            <div>
              <button
                type="button"
                className="kyc-flow-back-btn"
                onClick={handleExitFlow}
                title="Exit KYC flow and return to Qualified Investors list"
              >
                <ArrowLeft size={16} /> Back to Qualified Investors
              </button>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedDeal ? selectedDeal.customerName : formData.investorName || 'New Investor KYC'}
              </div>
              <div style={{ fontSize: 11, color: isAssistedFlow ? '#a78bfa' : 'var(--text-muted)' }}>
                {isAssistedFlow ? 'Assisted KYC Mode • IRM Onboarding on Behalf' : 'SEBI Regulated AIF • Cat-II Investor Onboarding'}
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

          {/* Assisted KYC Banner */}
          {isAssistedFlow && (
            <div className="kyc-assisted-banner">
              <div className="kyc-assisted-banner-icon">
                <UserCheck size={20} />
              </div>
              <div className="kyc-assisted-banner-content">
                <div className="kyc-assisted-banner-title">
                  Assisted KYC Mode: Onboarding on Behalf of {selectedDeal?.customerName || formData.investorName || 'Customer'}
                </div>
                <div className="kyc-assisted-banner-desc">
                  You are entering verified information on behalf of the customer. All inputs are saved as a draft. You can exit anytime and resume later. Official verification status will only be submitted upon your final confirmation at Step 5.
                </div>
              </div>
              {lastSavedDraftAt && (
                <div className="kyc-assisted-banner-saved">
                  <Clock size={12} />
                  Draft auto-saved {new Date(lastSavedDraftAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          )}

          {/* Validation Error Summary Banner */}
          {validationErrorSummary && (
            <div className="kyc-validation-summary">
              <AlertTriangle size={18} className="kyc-validation-summary-icon" />
              <div className="kyc-validation-summary-text">
                {validationErrorSummary}
              </div>
            </div>
          )}

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
                    Enter primary investor contact and demographic profile information for regulatory records.
                  </p>
                </div>

                <div className="kyc-step-guidance-box">
                  <Info size={16} className="kyc-step-guidance-box-icon" />
                  <div className="kyc-step-guidance-box-text">
                    <strong>Guidance:</strong> Ensure the investor's legal name, phone number, and email match their official identification. All communication and SEBI AIF confirmation will be routed to these coordinates.
                  </div>
                </div>

                {/* Section Card: Primary Investor Contact */}
                <div className="kyc-form-section-card">
                  <div className="kyc-form-section-header">
                    <h3 className="kyc-form-section-title">Primary Investor Contact</h3>
                    <p className="kyc-form-section-subtitle">Core contact details for all investor communications and OTP verification</p>
                  </div>
                  <div className="kyc-form-grid">
                    <div className="form-group">
                      <label className="form-label">Investor Full Name <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">Phone Number <span className="kyc-required-star">*</span></label>
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

                    <div className="form-group kyc-form-grid-full">
                      <label className="form-label">Email Address <span className="kyc-required-star">*</span></label>
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
                  </div>
                </div>

                {/* Section Card: Investor & Tax Classification */}
                <div className="kyc-form-section-card">
                  <div className="kyc-form-section-header">
                    <h3 className="kyc-form-section-title">Investor &amp; Tax Classification</h3>
                    <p className="kyc-form-section-subtitle">Required for FATCA/CRS compliance and applicable withholding taxes</p>
                  </div>
                  <div className="kyc-form-grid-3">
                    <div className="form-group">
                      <label className="form-label">Gender <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">Investor Type <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">Resident Type <span className="kyc-required-star">*</span></label>
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

                    <div className="form-group kyc-form-grid-full">
                      <label className="form-label">Occupation / Source of Wealth (Optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Salaried / Business / Professional"
                        value={formData.occupation || ''}
                        onChange={e => setFormData({ ...formData, occupation: e.target.value })}
                      />
                    </div>
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

                <div className="kyc-step-guidance-box">
                  <Info size={16} className="kyc-step-guidance-box-icon" />
                  <div className="kyc-step-guidance-box-text">
                    <strong>Guidance:</strong> PAN is mandatory under SEBI regulations. Name must match exactly as printed on the PAN card. Uploaded documents must be legible and in PDF, JPG, or PNG format.
                  </div>
                </div>

                {/* Card 1: Government Identification */}
                <div className="kyc-form-section-card">
                  <div className="kyc-form-section-header">
                    <h3 className="kyc-form-section-title">Government Identification</h3>
                    <p className="kyc-form-section-subtitle">Official tax and identity identifiers</p>
                  </div>
                  <div className="kyc-form-grid">
                    <div className="form-group">
                      <label className="form-label">PAN Number <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">Name (As per PAN) <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">Aadhaar Number <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">Father's Full Name (Optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Father's full name"
                        value={formData.fatherName || ''}
                        onChange={e => setFormData({ ...formData, fatherName: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Date of Birth (DOB) <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">Country</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="India"
                        value={formData.country || 'India'}
                        onChange={e => setFormData({ ...formData, country: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Card 2: Residential & Mailing Addresses */}
                <div className="kyc-form-section-card">
                  <div className="kyc-form-section-header">
                    <h3 className="kyc-form-section-title">Residential &amp; Mailing Addresses</h3>
                    <p className="kyc-form-section-subtitle">Permanent registered address and physical courier delivery location</p>
                  </div>
                  <div className="kyc-form-grid">
                    <div className="form-group kyc-form-grid-full">
                      <label className="form-label">Permanent Address <span className="kyc-required-star">*</span></label>
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
                        <label className="form-label" style={{ margin: 0 }}>Communication / Courier Address (Optional)</label>
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
                        className="form-textarea"
                        placeholder="Delivery & physical documentation address"
                        value={formData.courierAddress || ''}
                        onChange={e => setFormData({ ...formData, courierAddress: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="kyc-form-grid-3">
                    <div className="form-group">
                      <label className="form-label">State <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">City <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">Pincode <span className="kyc-required-star">*</span></label>
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
                </div>

                {/* Card 3: Identity Proof Documents */}
                <div className="kyc-form-section-card">
                  <div className="kyc-form-section-header">
                    <h3 className="kyc-form-section-title">Identity Proof Documents</h3>
                    <p className="kyc-form-section-subtitle">Upload clear scanned copies or photos of the investor's Aadhaar and PAN cards</p>
                  </div>
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

                <div className="kyc-step-guidance-box">
                  <Info size={16} className="kyc-step-guidance-box-icon" />
                  <div className="kyc-step-guidance-box-text">
                    <strong>Guidance:</strong> The bank account must be held in the name of the investor. Joint accounts are permitted if the investor is the primary holder. Third-party bank accounts are strictly prohibited by SEBI.
                  </div>
                </div>

                {/* Card 1: Bank Account Information */}
                <div className="kyc-form-section-card">
                  <div className="kyc-form-section-header">
                    <h3 className="kyc-form-section-title">Bank Account Information</h3>
                    <p className="kyc-form-section-subtitle">Account numbers and branch routing identifiers</p>
                  </div>
                  <div className="kyc-form-grid">
                    <div className="form-group">
                      <label className="form-label">Account Type <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">Account Number <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">IFSC Code <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">Account Holder Name <span className="kyc-required-star">*</span></label>
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
                      <label className="form-label">Bank Name <span className="kyc-required-star">*</span></label>
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
                </div>

                {/* Card 2: Bank Verification Document */}
                <div className="kyc-form-section-card">
                  <div className="kyc-form-section-header">
                    <h3 className="kyc-form-section-title">Bank Verification Document</h3>
                    <p className="kyc-form-section-subtitle">Proof of account showing investor name, account number, and IFSC</p>
                  </div>
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

                <div className="kyc-step-guidance-box">
                  <Info size={16} className="kyc-step-guidance-box-icon" />
                  <div className="kyc-step-guidance-box-text">
                    <strong>Guidance:</strong> A Demat account enables electronic credit of units. If the investor does not currently hold a Demat account, check the skip option below to issue physical certificates instead.
                  </div>
                </div>

                {/* Skip Checkbox Card */}
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
                    <span style={{ fontWeight: 600 }}>I don't have a Demat account (Skip this step)</span>
                  </label>
                  {formData.hasNoDemat && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      ℹ️ <em>You have elected to skip the Demat step. Physical investment certificate &amp; holding statement will be issued instead. You may proceed directly to Nominee Details.</em>
                    </div>
                  )}
                </div>

                {/* If Not Skipped: Demat Fields Card */}
                {!formData.hasNoDemat && (
                  <div className="kyc-form-section-card">
                    <div className="kyc-form-section-header">
                      <h3 className="kyc-form-section-title">Demat Account Details</h3>
                      <p className="kyc-form-section-subtitle">NSDL / CDSL Beneficiary Account information</p>
                    </div>
                    <div className="kyc-form-grid">
                      <div className="form-group kyc-form-grid-full">
                        <label className="form-label">Demat Account Number (16-digit BO ID / DP ID) <span className="kyc-required-star">*</span></label>
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
                  {formData.hasNominee && formData.nominees.length < 3 && (
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

                {/* Optional Nominee Toggle */}
                <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <label className="kyc-checkbox-label" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="kyc-checkbox-input"
                      checked={formData.hasNominee}
                      onChange={e => {
                        const enabled = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          hasNominee: enabled,
                          nominees: enabled
                            ? (prev.nominees.length > 0 ? prev.nominees : [
                                {
                                  id: `nom-${Date.now()}`,
                                  name: '',
                                  relationship: 'Spouse',
                                  dob: '',
                                  allocationPercentage: 100,
                                  address: '',
                                  guardianName: '',
                                }
                              ])
                            : [],
                        }));
                        if (!enabled) {
                          setFormErrors(prev => {
                            const c = { ...prev };
                            delete c.nominees;
                            Object.keys(c).forEach(k => {
                              if (k.startsWith('nominee_')) delete c[k];
                            });
                            return c;
                          });
                        }
                      }}
                    />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                        Register Nominee(s) for this Investment Account
                      </span>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        Nomination is optional. Designate up to 3 legal nominees or uncheck to proceed as a single applicant without nominee.
                      </div>
                    </div>
                  </label>
                </div>

                {!formData.hasNominee ? (
                  <div style={{ padding: '14px 16px', borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <ShieldCheck size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>No Nominee Appointed (Opted Out):</strong> You or the investor has elected to proceed without declaring a nominee. All investment account rights and redemption proceeds will accrue strictly to the primary applicant or legal succession heirs.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="kyc-step-guidance-box">
                      <Info size={16} className="kyc-step-guidance-box-icon" />
                      <div className="kyc-step-guidance-box-text">
                        <strong>Guidance:</strong> The sum of allocation percentages across all nominees must total <strong>exactly 100%</strong>. If any nominee is a minor (under 18), guardian details must be provided.
                      </div>
                    </div>

                    {/* Total Allocation Progress Pill */}
                    {(() => {
                      const totalPct = formData.nominees.reduce((sum, n) => sum + (Number(n.allocationPercentage) || 0), 0);
                      const is100 = totalPct === 100;
                      return (
                        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={is100 ? 'kyc-allocation-pill-ok' : 'kyc-allocation-pill-warn'}>
                            {is100 ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                            Total Allocation: {totalPct}% / 100% {is100 ? '(Valid)' : `(Needs ${100 - totalPct > 0 ? `${100 - totalPct}% more` : `${totalPct - 100}% less`})`}
                          </span>
                        </div>
                      );
                    })()}

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
                              onClick={() => handleRemoveNominee(nom.id || idx)}
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          )}
                        </div>

                        <div className="kyc-form-grid">
                          <div className="form-group">
                            <label className="form-label">Nominee Full Name <span className="kyc-required-star">*</span></label>
                            <input
                              type="text"
                              className={`form-input ${formErrors[`nominee_${idx}_name`] ? 'kyc-input-error' : ''}`}
                              placeholder="Nominee legal name"
                              value={nom.name}
                              onChange={e => handleNomineeChange(nom.id || idx, 'name', e.target.value)}
                            />
                            {formErrors[`nominee_${idx}_name`] && (
                              <div className="kyc-field-error">{formErrors[`nominee_${idx}_name`]}</div>
                            )}
                          </div>

                          <div className="form-group">
                            <label className="form-label">Relationship with Investor <span className="kyc-required-star">*</span></label>
                            <select
                              className="form-select"
                              value={nom.relationship}
                              onChange={e => handleNomineeChange(nom.id || idx, 'relationship', e.target.value)}
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
                            <label className="form-label">Date of Birth / Age <span className="kyc-required-star">*</span></label>
                            <input
                              type="date"
                              className={`form-input ${formErrors[`nominee_${idx}_dob`] ? 'kyc-input-error' : ''}`}
                              value={nom.dob}
                              onChange={e => handleNomineeChange(nom.id || idx, 'dob', e.target.value)}
                            />
                            {formErrors[`nominee_${idx}_dob`] && (
                              <div className="kyc-field-error">{formErrors[`nominee_${idx}_dob`]}</div>
                            )}
                          </div>

                          <div className="form-group">
                            <label className="form-label">Allocation Percentage (%) <span className="kyc-required-star">*</span></label>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              className={`form-input ${formErrors[`nominee_${idx}_pct`] ? 'kyc-input-error' : ''}`}
                              value={nom.allocationPercentage}
                              onChange={e => handleNomineeChange(nom.id || idx, 'allocationPercentage', Number(e.target.value))}
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
                              onChange={e => handleNomineeChange(nom.id || idx, 'address', e.target.value)}
                            />
                          </div>

                          <div className="form-group kyc-form-grid-full">
                            <label className="form-label">Guardian Name (If nominee is a minor under 18)</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Guardian full name"
                              value={nom.guardianName}
                              onChange={e => handleNomineeChange(nom.id || idx, 'guardianName', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── ACTION NAVIGATION BAR ── */}
            <div className="kyc-nav-bar">
              <div className="kyc-nav-left" style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleBack}
                  title={currentStep === 1 ? 'Exit Assisted KYC and return to list' : 'Return to previous step'}
                >
                  <ArrowLeft size={14} style={{ marginRight: 6 }} />
                  {currentStep === 1 ? 'Back to Table' : 'Previous Step'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleSaveDraft(true)}
                  title="Save current details as draft"
                  style={{ border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                >
                  <Save size={14} /> Save Draft
                </button>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Step {currentStep} of 5 {isAssistedFlow ? '• Assisted KYC Draft' : ''}
              </div>

              <div className="kyc-nav-right">
                {currentStep < 5 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleContinue}
                  >
                    {currentStep === 1 && 'Continue to Identity Details (Step 2) →'}
                    {currentStep === 2 && 'Continue to Bank Details (Step 3) →'}
                    {currentStep === 3 && 'Continue to Demat Details (Step 4) →'}
                    {currentStep === 4 && 'Continue to Nominee Details (Step 5) →'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={handleOpenReviewForSubmission}
                  >
                    <CheckCircle size={15} /> Review &amp; Submit on Behalf
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
                    value={sectionFormData.preferredAssetClass || ''}
                    onChange={e => setSectionFormData({ ...sectionFormData, preferredAssetClass: e.target.value })}
                  >
                    <option value="">— Select Preferred Asset Class —</option>
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
        isResend={!!sendLinkDeal && ['Link Sent', 'In Progress', 'Needs Correction', 'Rejected'].includes(resolveCustomerKycStatus(sendLinkDeal))}
        onSent={sent => {
          setSentDealIds(prev => ({ ...prev, [sent.id]: true }));
          refreshDbKycs();
        }}
      />

      {/* Review Customer KYC Drawer */}
      <KycReviewDrawer isOpen={!!reviewDeal} onClose={() => setReviewDeal(null)} deal={reviewDeal} onShowToast={showToast} onChangeKycStatus={handleStatusChange} />

      {/* ── Assisted KYC Review & Consent Confirmation Modal ── */}
      <Modal
        isOpen={isAssistedReviewModalOpen && !!selectedDeal}
        onClose={() => setIsAssistedReviewModalOpen(false)}
        title="Review & Submit Assisted KYC"
        subtitle={`Submitting KYC on behalf of customer: ${formData.investorName || selectedDeal?.customerName}`}
        maxWidth={640}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAssistedReviewModalOpen(false)}
            >
              Back to Edit
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                backgroundColor: customerConsentChecked ? '#7c3aed' : '#a78bfa',
                borderColor: customerConsentChecked ? '#7c3aed' : '#a78bfa',
                cursor: customerConsentChecked ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              disabled={!customerConsentChecked}
              onClick={handleConfirmAssistedSubmit}
            >
              <CheckCircle size={15} /> Confirm &amp; Submit for Verification
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Box */}
          <div style={{ background: 'var(--bg-card, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 14 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Application Summary
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Full Name:</span>
                <div style={{ fontWeight: 600 }}>{formData.investorName || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Contact Phone:</span>
                <div style={{ fontWeight: 600 }}>{formData.phone || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Email:</span>
                <div style={{ fontWeight: 600 }}>{formData.email || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>PAN Number:</span>
                <div style={{ fontWeight: 600 }}>{formData.panNumber || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Aadhaar Number:</span>
                <div style={{ fontWeight: 600 }}>
                  {formData.aadhaarNumber ? `•••• •••• ${formData.aadhaarNumber.slice(-4)}` : '—'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Bank &amp; Account:</span>
                <div style={{ fontWeight: 600 }}>
                  {formData.bankName ? `${formData.bankName} (${formData.accountNumber ? '••••' + formData.accountNumber.slice(-4) : '—'})` : '—'}
                </div>
              </div>
            </div>

            {/* Documents preview summary */}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color, #e2e8f0)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Uploaded Documents:</span>
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {formData.panDoc && (
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontSize: 11, fontWeight: 600 }}>
                    ✓ PAN Card
                  </span>
                )}
                {formData.aadhaarDoc && (
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontSize: 11, fontWeight: 600 }}>
                    ✓ Aadhaar Card
                  </span>
                )}
                {formData.bankProofDoc && (
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontSize: 11, fontWeight: 600 }}>
                    ✓ Bank Proof
                  </span>
                )}
                {formData.dematDoc && !formData.hasNoDemat && (
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontSize: 11, fontWeight: 600 }}>
                    ✓ Demat
                  </span>
                )}
                {!formData.panDoc && !formData.aadhaarDoc && !formData.bankProofDoc && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>No documents attached</span>
                )}
              </div>
            </div>
          </div>

          {/* IRM Attribution Info */}
          <div style={{ background: 'rgba(124, 58, 237, 0.05)', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: 8, padding: 12, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>
              <UserCheck size={14} /> IRM Assisted Onboarding Record
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Entered By: <strong style={{ color: 'var(--text-primary)' }}>{user?.name || 'IRM User'}</strong> (ID: {user?.id || '—'}) • Timestamp: <strong>{new Date().toLocaleString()}</strong>
            </div>
          </div>

          {/* Customer Consent Checkbox (Mandatory) */}
          <div style={{
            background: customerConsentChecked ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${customerConsentChecked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            borderRadius: 8,
            padding: 14,
          }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, lineHeight: '1.4' }}>
              <input
                type="checkbox"
                checked={customerConsentChecked}
                onChange={e => setCustomerConsentChecked(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, cursor: 'pointer', accentColor: '#7c3aed', flexShrink: 0 }}
              />
              <span style={{ color: 'var(--text-primary)' }}>
                <strong>Customer Consent &amp; Authorization:</strong> I certify that the information and documents entered in this form were provided directly by the customer (<strong>{formData.investorName || selectedDeal?.customerName}</strong>), and the customer has granted explicit consent and authorization for the IRM to submit this KYC application on their behalf.
              </span>
            </label>
            {!customerConsentChecked && (
              <div style={{ marginTop: 6, marginLeft: 28, fontSize: 11, color: '#d97706', fontWeight: 600 }}>
                * Customer consent must be recorded before submission.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* KycVerifyModal — opened from profile card Verify KYC button */}
      {verifyModalDeal && (
        <KycVerifyModal
          isOpen={verifyModalDeal !== null}
          onClose={() => setVerifyModalDeal(null)}
          deal={verifyModalDeal}
          profileKycData={
            (profileKycData || buildMergedProfileData(
              verifyModalDeal,
              findBackendKyc(verifyModalDeal, dbKycs, tenant?.id),
              leads.find(l => (verifyModalDeal.customerId && l.id === verifyModalDeal.customerId) || (l.phone && l.phone.replace(/\D/g, '').slice(-10) === (verifyModalDeal.phone || '').replace(/\D/g, '').slice(-10))),
              customers.find(c => (verifyModalDeal.customerId && c.id === verifyModalDeal.customerId) || (c.phone && c.phone.replace(/\D/g, '').slice(-10) === (verifyModalDeal.phone || '').replace(/\D/g, '').slice(-10)))
            )) as Record<string, any>
          }
          onSaveVerification={async (status, comment, flaggedSections, checklist) => {
            await handleStatusChange(verifyModalDeal, status, comment, flaggedSections, checklist);
          }}
          onShowToast={showToast}
        />
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
    let timeoutId: any;
    const handleUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadData();
      }, 300);
    };
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('nexus_storage_updated', handleUpdate);
    };
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
    persistDeal(updatedDeal).catch(e => showToast("Error saving deal:"));

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
          {deal.investmentRange || (deal.value > 0 ? formatCurrency(deal.value) : '—')}
        </span>
      ),
    },
    {
      key: 'preferredAssetClass',
      header: 'Preferred Asset Class',
      render: deal => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {resolvePreferredAssetClass(deal)}
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
