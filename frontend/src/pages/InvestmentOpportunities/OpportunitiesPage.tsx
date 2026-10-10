import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Phone,
  Edit2,
  Trash2,
  ArrowRight,
  Mail,
  MapPin,
  Clock,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { InvestmentOpportunity, Investor, Deal, DealActivity } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { storageService } from '../../services/storageService';
import {
  getOpportunities,
  saveOpportunity as apiSaveOpportunity,
  deleteOpportunity as apiDeleteOpportunity,
  getInvestors,
  getDeals,
  saveDeal as apiSaveDeal,
  addDealActivity as apiAddDealActivity,
  saveInvestor as apiSaveInvestor,
  persistDeal,
} from '../../services/ghlApiService';
import { DataTable, Column, RowAction } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { FilterBar } from '../../components/common/FilterBar';
import { Modal } from '../../components/common/Modal';
import { apiUrl } from '../../utils/apiUrl';
import { getAuthHeaders } from '../../utils/authHeaders';
import './OpportunitiesPage.css';

// ─── Stage enum (full ordered list) ─────────────────────────────────────────
const STAGES: InvestmentOpportunity['stage'][] = [
  'Enquiry',
  'Contacted',
  'Consultation',
  'Qualified',
  'Opportunity',
  'Committed',
  'Closed Won',
  'Closed Lost',
];

const stageOptions = STAGES.map(s => ({ value: s, label: s }));

// ─── Form state shape ────────────────────────────────────────────────────────
interface OppForm {
  title: string;
  investorId: string;
  investorName: string;
  stage: InvestmentOpportunity['stage'];
  targetAmount: string;
  committedAmount: string;
  assignedAgentId: string;
  assignedAgentName: string;
  expectedCloseDate: string;
  notes: string;
}

const BLANK_OPP_FORM: OppForm = {
  title: '',
  investorId: '',
  investorName: '',
  stage: 'Enquiry',
  targetAmount: '',
  committedAmount: '',
  assignedAgentId: '',
  assignedAgentName: '',
  expectedCloseDate: '',
  notes: '',
};

// ─── Component ───────────────────────────────────────────────────────────────
export const OpportunitiesPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const { initiateCall } = useCall();

  const roleCode = user?.role?.code;
  const isExec = roleCode === 'sales_executive';
  const isIrm = roleCode === 'irm';
  const isGhlIrm = isIrm && tenant?.slug === 'ghl';
  const isGhlAdmin =
    (tenant?.slug === 'ghl' || tenant?.id === 't-ghl-01' || tenant?.id === '1') &&
    ['company_admin', 'admin', 'super_admin', 'ghl_admin'].includes(roleCode as string);

  // ── Core data ─────────────────────────────────────────────────────────────
  const [opps, setOpps] = useState<InvestmentOpportunity[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ── Filters ───────────────────────────────────────────────────────────────
  const [stageFilter, setStageFilter] = useState('All');
  const [agentFilter, setAgentFilter] = useState('All');

  // ── Create / Edit modal ───────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<InvestmentOpportunity | null>(null);
  const [form, setForm] = useState<OppForm>(BLANK_OPP_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof OppForm, string>>>({});

  // ── Move Stage mini-modal ─────────────────────────────────────────────────
  const [stageModalOpp, setStageModalOpp] = useState<InvestmentOpportunity | null>(null);
  const [newStage, setNewStage] = useState<InvestmentOpportunity['stage']>('Enquiry');

  // ── IRM Customer Detail Modal state ───────────────────────────────────────
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const [liveKycData, setLiveKycData] = useState<any>(null);
  const [isKycLoading, setIsKycLoading] = useState<boolean>(false);
  const [amountInput, setAmountInput] = useState<string>('');
  const [isEditingAmount, setIsEditingAmount] = useState<boolean>(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoadError(null);
      const [oppsData, investorsData, dealsData] = await Promise.all([
        getOpportunities(tenant?.id),
        getInvestors(tenant?.id),
        getDeals(tenant?.id),
      ]);
      setOpps(oppsData || []);
      setInvestors(investorsData || []);
      setDeals(dealsData || []);
      setDetailDeal(prev => {
        if (!prev) return null;
        const fresh = (dealsData || []).find(d => d.id === prev.id);
        return fresh || prev;
      });
    } catch (err: any) {
      console.error('Failed to load opportunities data:', err);
      setOpps([]);
      setInvestors([]);
      setDeals([]);
      setLoadError(err?.message || 'Failed to load investment opportunities from server.');
    }
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

  // ── Role-based scoping ────────────────────────────────────────────────────
  const scopedOpps = isExec
    ? opps.filter(
      o =>
        (o.assignedAgentId && o.assignedAgentId === user?.id) ||
        (o.assignedAgentName && o.assignedAgentName === user?.name),
    )
    : opps;

  // ── Filter options ────────────────────────────────────────────────────────
  const agentOptions = Array.from(new Set(scopedOpps.map(o => o.assignedAgentName)))
    .filter(Boolean)
    .map(name => ({ value: name, label: name }));

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredOpps = scopedOpps.filter(o => {
    if (stageFilter !== 'All' && o.stage !== stageFilter) return false;
    if (agentFilter !== 'All' && o.assignedAgentName !== agentFilter) return false;
    return true;
  });

  // ── Currency formatter ────────────────────────────────────────────────────
  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openNewModal = () => {
    setEditingOpp(null);
    setForm({
      ...BLANK_OPP_FORM,
      assignedAgentId: isExec ? (user?.id ?? '') : '',
      assignedAgentName: isExec ? (user?.name ?? '') : '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (o: InvestmentOpportunity) => {
    setEditingOpp(o);
    setForm({
      title: o.title,
      investorId: o.investorId,
      investorName: o.investorName,
      stage: o.stage,
      targetAmount: String(o.targetAmount),
      committedAmount: String(o.committedAmount),
      assignedAgentId: o.assignedAgentId?.toString() || '',
      assignedAgentName: o.assignedAgentName,
      expectedCloseDate: o.expectedCloseDate,
      notes: o.notes,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOpp(null);
    setForm(BLANK_OPP_FORM);
    setFormErrors({});
  };

  const setField = <K extends keyof OppForm>(key: K, value: OppForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSaveOpp = () => {
    const errors: Partial<Record<keyof OppForm, string>> = {};
    if (!form.title.trim()) errors.title = 'Title is required.';
    if (!form.investorId) errors.investorId = 'Please select an investor.';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const now = new Date().toISOString().split('T')[0];
    const opp: InvestmentOpportunity = {
      id: editingOpp ? editingOpp.id : `opp-${Date.now()}`,
      companyId: tenant?.id ?? '',
      title: form.title.trim(),
      investorId: form.investorId,
      investorName: form.investorName,
      stage: form.stage,
      targetAmount: parseFloat(form.targetAmount) || 0,
      committedAmount: parseFloat(form.committedAmount) || 0,
      assignedAgentId: form.assignedAgentId.trim() || (user?.id ?? ''),
      assignedAgentName: form.assignedAgentName.trim() || (user?.name ?? ''),
      expectedCloseDate: form.expectedCloseDate || now,
      notes: form.notes.trim(),
    };

    apiSaveOpportunity(opp).catch(console.error);
    closeModal();
  };

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDeleteOpp = (o: InvestmentOpportunity) => {
    if (!window.confirm(`Delete opportunity "${o.title}"? This cannot be undone.`)) return;
    apiDeleteOpportunity(o.id).catch(console.error);
  };

  // ── Move Stage handlers ───────────────────────────────────────────────────
  const openStageModal = (o: InvestmentOpportunity) => {
    setStageModalOpp(o);
    setNewStage(o.stage);
  };

  const handleMoveStage = () => {
    if (!stageModalOpp) return;
    apiSaveOpportunity({ ...stageModalOpp, stage: newStage }).catch(console.error);
    setStageModalOpp(null);
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<InvestmentOpportunity>[] = [
    {
      key: 'title',
      header: 'Commercial Asset / Tranche',
      sortable: true,
      render: o => (
        <div>
          <div className="opp-title-primary">{o.title}</div>
          <div className="opp-notes-sub">{o.notes}</div>
        </div>
      ),
    },
    {
      key: 'investorName',
      header: 'Lead Institutional Backer',
      sortable: true,
      render: o => <span className="opp-investor-text">{o.investorName}</span>,
    },
    {
      key: 'targetAmount',
      header: 'Target Tranche',
      sortable: true,
      render: o => <span className="opp-target-text">{formatCurrency(o.targetAmount)}</span>,
    },
    {
      key: 'committedAmount',
      header: 'Committed Capital',
      sortable: true,
      render: o => <span className="opp-committed-text">{formatCurrency(o.committedAmount)}</span>,
    },
    {
      key: 'stage',
      header: 'Syndicate Stage',
      sortable: true,
      render: o => <StatusChip status={o.stage} size="sm" />,
    },
    {
      key: 'assignedAgentName',
      header: 'Wealth Manager',
      render: o => <span style={{ fontSize: 12 }}>{o.assignedAgentName}</span>,
    },
    {
      key: 'expectedCloseDate',
      header: 'Target Execution',
      sortable: true,
    },
  ];

  // ── Row actions ───────────────────────────────────────────────────────────
  const rowActions: RowAction<InvestmentOpportunity>[] = [
    {
      label: 'Call Customer',
      icon: <Phone size={14} color="#059669" style={{ marginRight: 6 }} />,
      onClick: o => {
        const inv = investors.find(i => i.id === o.investorId);
        if (inv) initiateCall(inv.name, inv.phone, 'customer', inv.id, undefined, 'opportunities');
      },
    },
    {
      label: 'Edit',
      icon: <Edit2 size={14} color="var(--primary-600)" style={{ marginRight: 6 }} />,
      onClick: o => openEditModal(o),
      hidden: () => isGhlAdmin,
    },
    {
      label: 'Move Stage',
      icon: <ArrowRight size={14} style={{ marginRight: 6 }} />,
      onClick: o => openStageModal(o),
      hidden: () => isGhlAdmin,
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} color="#dc2626" style={{ marginRight: 6 }} />,
      onClick: o => handleDeleteOpp(o),
      hidden: () => isGhlAdmin,
    },
  ];

  // ── IRM Stage & Investor Type Handlers ─────────────────────────────────────
  const isScopedAgent = isIrm || isExec;
  const myNameLower = (user?.name || '').toLowerCase().trim();
  const myIdStr = user?.id ? String(user.id) : '';
  const scopedOpportunitiesDeals = isScopedAgent
    ? deals.filter(d => {
        const agentId = d.assignedAgentId ? String(d.assignedAgentId) : '';
        const agentName = (d.assignedAgentName || '').toLowerCase().trim();
        if (myIdStr && agentId === myIdStr) return true;
        if (myNameLower && (agentName === myNameLower || agentName.includes(myNameLower) || myNameLower.includes(agentName))) return true;
        if (!agentId && !agentName) return true;
        return false;
      })
    : deals;
  const irmDeals = scopedOpportunitiesDeals.filter(d => d.stage === 'investment_opportunity');


  const handleAdvanceToConverted = async (deal: Deal) => {
    // 1. Create or link Investor record in DB with stable ID
    let linkedInvestorId = deal.customerId && !deal.customerId.startsWith('lead-') && !deal.customerId.startsWith('cust-') ? deal.customerId : '';

    // Check if an investor already exists with this phone or email or customerId
    const fDigits = (deal.phone || '').replace(/\D/g, '').slice(-10);
    const existingInv = investors.find(inv => {
      if (linkedInvestorId && String(inv.id) === String(linkedInvestorId)) return true;
      const invDigits = (inv.phone || '').replace(/\D/g, '').slice(-10);
      if (fDigits && invDigits && invDigits === fDigits) return true;
      if (deal.email && inv.email && inv.email.toLowerCase() === deal.email.toLowerCase()) return true;
      return false;
    });

    const investorPayload: Investor = {
      id: existingInv ? existingInv.id : linkedInvestorId,
      companyId: tenant?.id || '',
      name: deal.customerName,
      phone: deal.phone || '',
      email: deal.email || '',
      status: 'Active Investor',
      investmentCapacity: deal.investmentRange || '',
      preferredAssetClass: deal.preferredAssetClass || '',
      assignedAgentId: deal.assignedAgentId || user?.id || '',
      assignedAgentName: deal.assignedAgentName || user?.name || '',
      referralSource: 'IRM Pipeline',
      notes: deal.notes || (deal.value ? `Converted from Investment Opportunity. Investment Amount: ₹${(deal.value || 0).toLocaleString('en-IN')}` : ''),
      committedAUM: deal.value ? String(deal.value) : (deal.investmentRange || ''),
      investmentMandate: deal.investorType || '',
      riskTolerance: undefined,
      createdAt: existingInv?.createdAt || new Date().toISOString(),
    };

    let savedInvestor: Investor | null = null;
    try {
      savedInvestor = await apiSaveInvestor(investorPayload);
    } catch (err) {
      console.warn('[OpportunitiesPage] API saveInvestor failed:', err);
    }

    const finalCustomerId = savedInvestor?.id ? String(savedInvestor.id) : (existingInv?.id ? String(existingInv.id) : deal.customerId);

    // 2. Update deal to 'converted' stage with stable linked customerId
    const updatedDeal: Deal = {
      ...deal,
      stage: 'converted',
      customerId: finalCustomerId,
      stageEnteredAt: new Date().toISOString(),
    };
    try {
      await persistDeal(updatedDeal);
    } catch (err) {
      console.warn('[OpportunitiesPage] API saveDeal (convert) failed:', err);
      showToast('Failed to update deal stage');
      return;
    }

    // 3. Log activity
    const activity: DealActivity = {
      id: `act-${Date.now()}`,
      dealId: deal.id,
      companyId: tenant?.id || '',
      type: 'stage_change',
      fromStage: 'investment_opportunity',
      toStage: 'converted',
      text: `Investment Opportunity → Investor 360 (Investment Amount: ₹${(deal.value || 0).toLocaleString('en-IN')})`,
      loggedByName: user?.name || 'IRM User',
      loggedByRole: 'IRM',
      timestamp: new Date().toISOString(),
    };
    try {
      await apiAddDealActivity(activity);
    } catch (err) {
      console.warn('[OpportunitiesPage] API addDealActivity failed:', err);
      storageService.addDealActivity(activity);
    }

    loadData();
    showToast(`✓ ${deal.customerName} is now an Investor! Moved to Investors 360.`);
  };

  const getDealDaysInStage = (deal: Deal) => {
    const timestamp = deal.stageEnteredAt || deal.createdAt;
    if (!timestamp) return 0;
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) return 0;
    const diffMs = new Date().getTime() - time;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  // ── IRM Customer Detail & Investment Amount Handlers ───────────────────────
  const handleOpenDetailModal = (deal: Deal) => {
    setDetailDeal(deal);
    setAmountInput(deal.value ? String(deal.value) : '');
    setIsEditingAmount(false);
    setShowConfirmDialog(false);
  };

  const handleCloseDetailModal = () => {
    setDetailDeal(null);
    setIsEditingAmount(false);
    setShowConfirmDialog(false);
  };

  const handleEditAmount = async () => {
    if (!detailDeal) return;
    const updatedDeal: Deal = {
      ...detailDeal,
      investmentAmountConfirmed: false,
    };
    try {
      await persistDeal(updatedDeal);
    } catch (e) {
      console.error("Error saving deal:", e);
      showToast('Failed to update deal');
    }
    setDetailDeal(updatedDeal);
    setIsEditingAmount(true);
    setAmountInput(detailDeal.value ? String(detailDeal.value) : '');
    loadData();
  };

  const handleConfirmAmount = async () => {
    if (!detailDeal) return;
    const numericAmount = parseFloat(amountInput) || 0;
    const updatedDeal: Deal = {
      ...detailDeal,
      value: numericAmount,
      investmentAmountConfirmed: true,
    };

    // Save investment amount confirmed to DB
    try {
      await persistDeal(updatedDeal);
    } catch (err) {
      console.warn('[OpportunitiesPage] API saveDeal (amount confirm) failed:', err);
      showToast('Failed to save investment amount');
      return;
    }

    setDetailDeal(updatedDeal);
    setIsEditingAmount(false);
    setShowConfirmDialog(false);
    loadData();
    showToast(`✓ Investment amount ₹${numericAmount.toLocaleString('en-IN')} confirmed for "${detailDeal.customerName}"`);
  };

  const getDealKycStatus = (deal: Deal, liveKyc?: any): 'Pending' | 'Partially Completed' | 'Submitted' | 'Verified' | 'Wrong' => {
    // 1. Prefer DB-sourced status from deal or live KYC record
    const raw = (deal.kycStatus || liveKyc?.status || '').toString().toLowerCase();
    if (raw === 'verified' || raw === 'completed' || raw === 'approved' || raw === '3') return 'Verified';
    if (raw === 'wrong' || raw === 'rejected' || raw === '4') return 'Wrong';
    if (raw === 'submitted' || raw === 'pending_review' || raw === 'under_review' || raw === '2') return 'Submitted';
    if (raw === 'partially completed' || raw === 'in_progress' || raw === '1') return 'Partially Completed';

    // 2. kycValidated flag
    if ((deal as any).kycValidated === true) return 'Verified';

    return 'Pending';
  };

  const mapKycDtoToFormData = (dto: any) => {
    if (!dto) return null;
    let parsedNominees: any[] = [];
    if (dto.nomineesJson) {
      try {
        parsedNominees = typeof dto.nomineesJson === 'string' ? JSON.parse(dto.nomineesJson) : dto.nomineesJson;
      } catch {
        parsedNominees = [];
      }
    } else if (Array.isArray(dto.nominees)) {
      parsedNominees = dto.nominees;
    }

    return {
      investorName: dto.investorName || '',
      phone: dto.phone || '',
      email: dto.email || '',
      gender: dto.gender || '',
      investorType: dto.investorType || '',
      residentType: dto.residentType || dto.residentialStatus || '',
      occupation: dto.occupation || '',
      panNumber: dto.panNumber || '',
      nameAsPerPan: dto.nameAsPerPan || '',
      aadhaarNumber: dto.aadhaarNumber || '',
      fatherName: dto.fatherName || '',
      dob: dto.dateOfBirth || dto.dob || '',
      city: dto.city || '',
      state: dto.state || '',
      pincode: dto.pincode || '',
      address: [dto.addressLine1, dto.addressLine2].filter(Boolean).join(', ') || dto.address || '',
      bankName: dto.bankName || '',
      branchName: dto.branchName || '',
      accountNumber: dto.accountNumber || '',
      ifscCode: dto.ifscCode || '',
      accountType: dto.accountType || 'Savings',
      accountHolderName: dto.accountHolderName || dto.investorName || '',
      dematAccountNumber: dto.dematAccountNumber || '',
      dpId: dto.dpId || dto.dematDpId || '',
      dematDpId: dto.dpId || dto.dematDpId || '',
      dematClientId: dto.dematClientId || '',
      dematDepository: dto.dematDepository || '',
      hasNoDemat: dto.hasNoDemat === true || (!dto.dematAccountNumber && !dto.dpId),
      nominees: Array.isArray(parsedNominees) ? parsedNominees : [],
      panDoc: dto.panDocumentUrl ? { name: 'PAN Card Copy', url: dto.panDocumentUrl } : null,
      aadhaarDoc: dto.aadhaarDocumentUrl ? { name: 'Aadhaar Card Copy', url: dto.aadhaarDocumentUrl } : null,
      bankProofDoc: dto.bankChequeUrl ? { name: 'Bank Cheque / Statement', url: dto.bankChequeUrl } : null,
      dematDoc: dto.dematDocumentUrl ? { name: 'Demat Statement Proof', url: dto.dematDocumentUrl } : null,
      status: dto.status || '',
    };
  };

  // ── Fetch live KYC details directly from PostgreSQL database ──────────────────
  useEffect(() => {
    if (!detailDeal) {
      setLiveKycData(null);
      setIsKycLoading(false);
      return;
    }

    let isCancelled = false;

    const fetchLiveKyc = async () => {
      setIsKycLoading(true);
      try {
        let kycRecord: any = null;

        // 1. Direct KYC ID on deal if present
        const kycId = (detailDeal as any).kycId || (detailDeal as any).kycRecordId;
        if (kycId) {
          try {
            const res = await fetch(apiUrl(`/irm/kyc/${kycId}`), { headers: getAuthHeaders() });
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) kycRecord = json.data;
            }
          } catch {}
        }

        // 2. Fetch by numeric customer ID / investor ID
        if (!kycRecord && detailDeal.customerId) {
          const numId = parseInt(String(detailDeal.customerId).replace(/\D/g, ''), 10);
          if (numId > 0) {
            try {
              const res = await fetch(apiUrl(`/irm/kyc/${numId}`), { headers: getAuthHeaders() });
              if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) kycRecord = json.data;
              }
            } catch {}
          }
        }

        // 3. Fetch by email
        if (!kycRecord && detailDeal.email && detailDeal.email.trim()) {
          try {
            const res = await fetch(apiUrl(`/irm/kyc/by-email?email=${encodeURIComponent(detailDeal.email.trim())}`), { headers: getAuthHeaders() });
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) kycRecord = json.data;
            }
          } catch {}
        }

        // 4. Fetch by phone
        if (!kycRecord && detailDeal.phone && detailDeal.phone.trim()) {
          try {
            const res = await fetch(apiUrl(`/irm/kyc/by-phone?phone=${encodeURIComponent(detailDeal.phone.trim())}`), { headers: getAuthHeaders() });
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) kycRecord = json.data;
            }
          } catch {}
        }

        // 5. Fallback: match from all KYCs in DB
        if (!kycRecord) {
          try {
            const res = await fetch(apiUrl('/irm/kyc/all'), { headers: getAuthHeaders() });
            if (res.ok) {
              const json = await res.json();
              if (json.success && Array.isArray(json.data)) {
                const pDigits = (detailDeal.phone || '').replace(/\D/g, '').slice(-10);
                const cleanMail = (detailDeal.email || '').trim().toLowerCase();
                const cleanName = (detailDeal.customerName || '').trim().toLowerCase();

                const matchedSummary = json.data.find((k: any) => {
                  const kp = (k.phone || '').replace(/\D/g, '').slice(-10);
                  if (pDigits && kp && pDigits === kp) return true;
                  const km = (k.email || '').trim().toLowerCase();
                  if (cleanMail && km && cleanMail === km) return true;
                  const kn = (k.investorName || '').trim().toLowerCase();
                  if (cleanName && kn && cleanName === kn) return true;
                  return false;
                });

                if (matchedSummary?.id) {
                  const detailRes = await fetch(apiUrl(`/irm/kyc/${matchedSummary.id}`), { headers: getAuthHeaders() });
                  if (detailRes.ok) {
                    const detailJson = await detailRes.json();
                    if (detailJson.success && detailJson.data) kycRecord = detailJson.data;
                  }
                }
              }
            }
          } catch {}
        }

        if (!isCancelled) {
          setLiveKycData(kycRecord ? mapKycDtoToFormData(kycRecord) : null);
        }
      } catch (err) {
        console.error('Failed to load live KYC form details:', err);
      } finally {
        if (!isCancelled) {
          setIsKycLoading(false);
        }
      }
    };

    fetchLiveKyc();
    return () => {
      isCancelled = true;
    };
  }, [detailDeal?.id, detailDeal?.phone, detailDeal?.email, detailDeal?.customerName]);

  const irmColumns: Column<Deal>[] = [
    {
      key: 'customerName',
      header: 'Name & Contact',
      sortable: true,
      render: deal => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {deal.customerName}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            {deal.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Phone size={12} color="var(--text-muted)" />
                <span>{deal.phone}</span>
              </div>
            )}
            {deal.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={12} color="var(--text-muted)" />
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
      key: 'investmentRange',
      header: 'Investment Capacity',
      sortable: true,
      render: deal => {
        const cap = deal.investmentRange;
        const hasCap = cap && cap !== '—' && cap.trim() !== '' && cap.toLowerCase() !== 'not specified';
        return hasCap ? (
          <span style={{ color: '#10b981', fontWeight: 800, fontSize: 13 }}>
            {cap}
          </span>
        ) : (
          <span className="not-specified-badge">
            Not Specified
          </span>
        );
      },
    },
    {
      key: 'value',
      header: 'Investment Amount',
      sortable: true,
      render: deal => {
        const val = deal.value || (deal as any).customFields?.investmentAmount;
        return val && Number(val) > 0 ? (
          <span style={{ color: '#10b981', fontWeight: 800, fontSize: 13 }}>
            {formatCurrency(Number(val))}
          </span>
        ) : (
          <span className="not-specified-badge">
            Not Specified
          </span>
        );
      },
    },
    {
      key: 'preferredAssetClass',
      header: 'Preferred Asset Class',
      render: deal => {
        const pref = deal.preferredAssetClass;
        const hasPref = pref && pref !== '—' && pref.trim() !== '' && pref.toLowerCase() !== 'not specified';
        return hasPref ? (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {pref}
          </span>
        ) : (
          <span className="not-specified-badge">
            Not Specified
          </span>
        );
      },
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
      key: 'actions',
      header: 'Action',
      render: deal => {
        const isConfirmed = Boolean(deal.investmentAmountConfirmed);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
            {deal.phone && (
              <button
                type="button"
                className="btn btn-sm btn-ghost btn-icon"
                title={`Call ${deal.customerName}`}
                onClick={() => initiateCall(deal.customerName, deal.phone || '', 'customer', deal.customerId || deal.id, undefined, 'opportunities')}
              >
                <Phone size={14} color="#059669" />
              </button>
            )}
            <button
              type="button"
              className="irm-convert-btn"
              title={
                isConfirmed
                  ? 'Convert deal (Mandate executed & funds committed)'
                  : 'Set the investment amount before converting.'
              }
              disabled={!isConfirmed}
              onClick={e => {
                e.stopPropagation();
                if (isConfirmed) {
                  handleAdvanceToConverted(deal);
                }
              }}
              style={{
                opacity: isConfirmed ? 1 : 0.45,
                cursor: isConfirmed ? 'pointer' : 'not-allowed',
              }}
            >
              <CheckCircle size={13} /> Convert
            </button>
          </div>
        );
      },
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="opportunities-page">
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

      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Briefcase size={24} color={isGhlIrm ? '#ec4899' : '#0284c7'} />{' '}
            {isGhlIrm ? 'Investment Opportunities & Term Sheets' : 'Investment Opportunities Syndicate'}
          </h1>
          <p className="page-subtitle">
            {isGhlIrm
              ? 'Pitch deck shared, term sheet under review, legal team active.'
              : `Commercial real-estate fractional tranches, warehousing yields, and capital commitments for ${tenant?.name}.`}
          </p>
        </div>

        {!isGhlIrm && !isGhlAdmin && (
          <button
            id="opps-new-opportunity"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={openNewModal}
          >
            <Plus size={15} /> New Opportunity
          </button>
        )}
      </div>

      {loadError && (
        <div
          className="alert-banner error"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          <span>{loadError}</span>
        </div>
      )}

      {/* ── Data table ───────────────────────────────────────────────────── */}
      {isGhlIrm ? (
        <DataTable
          columns={irmColumns}
          data={irmDeals}
          keyExtractor={d => d.id}
          onRowClick={deal => handleOpenDetailModal(deal)}
          searchPlaceholder="Search opportunities by investor, deal, or asset class..."
          emptyTitle="No Investment Opportunities"
          emptyDescription="No deals currently in the Investment Opportunity stage."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredOpps}
          keyExtractor={o => o.id}
          rowActions={rowActions}
          onRowClick={isGhlAdmin ? undefined : o => openEditModal(o)}
          searchPlaceholder="Search opportunities by asset title or investor..."
          filtersNode={
            <FilterBar
              filters={[
                {
                  key: 'stage',
                  label: 'Stage',
                  value: stageFilter,
                  onChange: setStageFilter,
                  options: stageOptions,
                },
                {
                  key: 'agent',
                  label: 'Agent',
                  value: agentFilter,
                  onChange: setAgentFilter,
                  options: agentOptions,
                },
              ]}
              onClearAll={() => {
                setStageFilter('All');
                setAgentFilter('All');
              }}
            />
          }
        />
      )}

      {/* ── Create / Edit Opportunity Modal ──────────────────────────────── */}
      <Modal
        isOpen={isModalOpen && !isGhlAdmin}
        onClose={closeModal}
        title={editingOpp ? 'Edit Opportunity' : 'New Investment Opportunity'}
        subtitle={
          editingOpp
            ? `Editing "${editingOpp.title}"`
            : 'Create a new capital syndication opportunity linked to a real investor.'
        }
        maxWidth={640}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveOpp}>
              {editingOpp ? 'Update Opportunity' : 'Save Opportunity'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title */}
          <div className="form-group">
            <label htmlFor="opp-form-title" className="form-label">Opportunity Title *</label>
            <input
              id="opp-form-title"
              name="title"
              className={`form-input${formErrors.title ? ' is-invalid' : ''}`}
              placeholder="e.g. Warehouse Tranche A — Phase II"
              value={form.title}
              onChange={e => setField('title', e.target.value)}
            />
            {formErrors.title && <div className="form-error">{formErrors.title}</div>}
          </div>

          {/* Row: Investor + Stage */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="opp-form-investor" className="form-label">Investor *</label>
              <select
                id="opp-form-investor"
                name="investorId"
                className={`form-select${formErrors.investorId ? ' is-invalid' : ''}`}
                value={form.investorId}
                onChange={e => {
                  const inv = investors.find(i => i.id === e.target.value);
                  setField('investorId', e.target.value);
                  setField('investorName', inv?.name ?? '');
                }}
              >
                <option value="">— Select Investor —</option>
                {investors.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name}
                  </option>
                ))}
              </select>
              {formErrors.investorId && (
                <div className="form-error">{formErrors.investorId}</div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="opp-form-stage" className="form-label">Stage</label>
              <select
                id="opp-form-stage"
                name="stage"
                className="form-select"
                value={form.stage}
                onChange={e =>
                  setField('stage', e.target.value as InvestmentOpportunity['stage'])
                }
              >
                {STAGES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Target Amount + Committed Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="opp-form-target" className="form-label">Target Amount (₹)</label>
              <input
                id="opp-form-target"
                name="targetAmount"
                className="form-input"
                placeholder="e.g. 5000000"
                type="number"
                min="0"
                value={form.targetAmount}
                onChange={e => setField('targetAmount', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="opp-form-committed" className="form-label">Committed Amount (₹)</label>
              <input
                id="opp-form-committed"
                name="committedAmount"
                className="form-input"
                placeholder="e.g. 2500000"
                type="number"
                min="0"
                value={form.committedAmount}
                onChange={e => setField('committedAmount', e.target.value)}
              />
            </div>
          </div>

          {/* Row: Assigned Agent + Expected Close Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label htmlFor="opp-form-agent" className="form-label">
                Assigned Agent
                {isExec && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontWeight: 400,
                    }}
                  >
                    (auto-assigned to you)
                  </span>
                )}
              </label>
              {isExec ? (
                <input
                  id="opp-form-agent"
                  name="assignedAgentName"
                  className="form-input"
                  value={form.assignedAgentName}
                  readOnly
                  style={{
                    backgroundColor: 'var(--bg-surface-hover)',
                    cursor: 'not-allowed',
                    color: 'var(--text-secondary)',
                  }}
                />
              ) : (
                <input
                  id="opp-form-agent"
                  name="assignedAgentName"
                  className="form-input"
                  placeholder="e.g. Ananya Iyer"
                  value={form.assignedAgentName}
                  onChange={e => {
                    setField('assignedAgentName', e.target.value);
                    setField('assignedAgentId', '');
                  }}
                />
              )}
            </div>

            <div className="form-group">
              <label htmlFor="opp-form-close-date" className="form-label">Expected Close Date</label>
              <input
                id="opp-form-close-date"
                name="expectedCloseDate"
                className="form-input"
                type="date"
                value={form.expectedCloseDate}
                onChange={e => setField('expectedCloseDate', e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="opp-form-notes" className="form-label">Notes</label>
            <textarea
              id="opp-form-notes"
              name="notes"
              className="form-input"
              rows={3}
              placeholder="Deal highlights, key terms, risk summary…"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
      </Modal>

      {/* ── Move Stage Mini-Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={!!stageModalOpp}
        onClose={() => setStageModalOpp(null)}
        title="Move Stage"
        subtitle={stageModalOpp ? `Update stage for: "${stageModalOpp.title}"` : ''}
        maxWidth={400}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setStageModalOpp(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleMoveStage}>
              Update Stage
            </button>
          </>
        }
      >
        <div className="form-group">
          <label htmlFor="opp-stage-select" className="form-label">New Stage</label>
          <select
            id="opp-stage-select"
            name="newStage"
            className="form-select"
            value={newStage}
            onChange={e =>
              setNewStage(e.target.value as InvestmentOpportunity['stage'])
            }
          >
            {STAGES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {stageModalOpp && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Current:{' '}
              <StatusChip status={stageModalOpp.stage} size="sm" />
              {newStage !== stageModalOpp.stage && (
                <>
                  <ArrowRight size={13} />
                  <StatusChip status={newStage} size="sm" />
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Customer Detail Card Modal (IRM Only) ────────────────────────── */}
      {detailDeal && (
        <Modal
          isOpen={!!detailDeal}
          onClose={handleCloseDetailModal}
          title="Customer Detail Card"
          subtitle={`${detailDeal.customerName} • Deal Details`}
          maxWidth={760}
          footer={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCloseDetailModal}
            >
              Close
            </button>
          }
        >
          {(() => {
            const kycStatus = getDealKycStatus(detailDeal, liveKycData);
            const kycBadgeStyles = {
              Verified: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
              Submitted: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
              'Partially Completed': { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
              Wrong: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
              Pending: { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' },
            }[kycStatus];
            const kycData = liveKycData;
            const isConfirmed = Boolean(detailDeal.investmentAmountConfirmed) && !isEditingAmount;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Header: Customer Name, Phone, Email */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: 10,
                    background: 'var(--bg-surface-hover, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {detailDeal.customerName}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                      {detailDeal.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Phone size={13} color="var(--text-muted)" />
                          <span>{detailDeal.phone}</span>
                        </div>
                      )}
                      {detailDeal.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={13} color="var(--text-muted)" />
                          <span>{detailDeal.email}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Assigned Owner:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{detailDeal.assignedAgentName || 'Unassigned'}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Preferred Asset Class:</span>
                        {detailDeal.preferredAssetClass && detailDeal.preferredAssetClass !== '—' ? (
                          <strong style={{ color: 'var(--text-primary)' }}>{detailDeal.preferredAssetClass}</strong>
                        ) : (
                          <span className="not-specified-badge">Not Specified</span>
                        )}
                      </div>
                      {detailDeal.customerId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Customer ID:</span>
                          <strong style={{ fontFamily: 'monospace' }}>#{detailDeal.customerId}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top Row: KYC Status & Investment Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {/* KYC Status Section */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 10,
                      border: '1px solid var(--border-color, #e2e8f0)',
                      background: 'var(--bg-surface, #ffffff)',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                      KYC Status
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 12px',
                          borderRadius: 9999,
                          fontSize: 12,
                          fontWeight: 700,
                          backgroundColor: kycBadgeStyles.bg,
                          color: kycBadgeStyles.color,
                          border: `1px solid ${kycBadgeStyles.border}`,
                        }}
                      >
                        {kycStatus}
                      </span>
                    </div>
                  </div>

                  {/* Investment Amount Section (Editable) */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 10,
                      border: '1px solid var(--border-color, #e2e8f0)',
                      background: 'var(--bg-surface, #ffffff)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Investment Amount
                      </span>
                      {isConfirmed ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                          }}
                        >
                          Confirmed
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: '#fffbeb',
                            color: '#d97706',
                            border: '1px solid #fde68a',
                          }}
                        >
                          Unconfirmed
                        </span>
                      )}
                    </div>

                    {isConfirmed ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input
                            id="opp-confirmed-amount"
                            name="confirmedAmount"
                            aria-label="Confirmed Investment Amount"
                            type="text"
                            readOnly
                            className="form-input"
                            value={formatCurrency(detailDeal.value)}
                            style={{
                              width: '100%',
                              fontSize: 14,
                              fontWeight: 700,
                              color: '#10b981',
                              height: 38,
                              backgroundColor: 'var(--bg-surface-hover, #f8fafc)',
                              cursor: 'default',
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleEditAmount}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px' }}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <input
                              id="opp-enter-amount"
                              name="amountInput"
                              aria-label="Enter investment amount in rupees"
                              type="number"
                              min="0"
                              step="100000"
                              className="form-input"
                              placeholder="Enter amount in ₹"
                              value={amountInput}
                              onChange={e => setAmountInput(e.target.value)}
                              style={{ width: '100%', fontSize: 13, height: 38 }}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={!amountInput || parseFloat(amountInput) <= 0}
                            onClick={() => {
                              const val = parseFloat(amountInput);
                              if (val && val > 0) {
                                setShowConfirmDialog(true);
                              }
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px' }}
                          >
                            <CheckCircle size={13} /> Confirm
                          </button>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                          Display format: <strong style={{ color: '#10b981' }}>{formatCurrency(parseFloat(amountInput) || 0)}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Details Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Form Details</span>
                    {liveKycData && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={12} /> Database Verified
                      </span>
                    )}
                  </div>

                  {isKycLoading ? (
                    <div
                      style={{
                        padding: '32px',
                        borderRadius: 8,
                        background: 'var(--bg-surface-hover, #f8fafc)',
                        border: '1px dashed var(--border-color, #cbd5e1)',
                        color: 'var(--text-secondary, #64748b)',
                        fontSize: 13,
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          border: '2px solid var(--border-color, #cbd5e1)',
                          borderTopColor: '#3b82f6',
                          animation: 'spin 1s linear infinite',
                        }}
                      />
                      <span>Loading KYC details from database...</span>
                    </div>
                  ) : !kycData ? (
                    <div
                      style={{
                        padding: '24px',
                        borderRadius: 8,
                        background: 'var(--bg-surface-hover, #f8fafc)',
                        border: '1px dashed var(--border-color, #cbd5e1)',
                        color: 'var(--text-muted, #94a3b8)',
                        fontSize: 13,
                        textAlign: 'center',
                      }}
                    >
                      Not filled yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* 1. Basic Details */}
                      <div
                        style={{
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: 8,
                          padding: '16px',
                          background: 'var(--bg-surface, #ffffff)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                          1. Basic Details
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 16px', fontSize: 13 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Investor Name</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.investorName || detailDeal.customerName || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Phone</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.phone || detailDeal.phone || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Email</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.email || detailDeal.email || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Gender</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.gender || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Investor Type</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.investorType || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Resident Type</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.residentType || '—'}</div>
                          </div>
                          {kycData.occupation && (
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Occupation</div>
                              <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.occupation}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Identity Details & Address */}
                      <div
                        style={{
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: 8,
                          padding: '16px',
                          background: 'var(--bg-surface, #ffffff)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                          2. Identity Details & Address
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 16px', fontSize: 13 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PAN Number</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>{kycData.panNumber || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Name as per PAN</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.nameAsPerPan || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Aadhaar Number</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2, fontFamily: 'monospace' }}>
                              {kycData.aadhaarNumber ? (kycData.aadhaarNumber.length >= 4 ? `•••• •••• ${kycData.aadhaarNumber.slice(-4)}` : kycData.aadhaarNumber) : '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Father's Name</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.fatherName || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Date of Birth</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.dob || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>City / State / Pincode</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>
                              {[kycData.city, kycData.state, kycData.pincode].filter(Boolean).join(', ') || '—'}
                            </div>
                          </div>
                          {kycData.address && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Address</div>
                              <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.address}</div>
                            </div>
                          )}
                          {(kycData.panDoc || kycData.aadhaarDoc) && (
                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                              {kycData.panDoc && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--bg-surface-hover, #f1f5f9)', padding: '4px 10px', borderRadius: 6 }}>
                                  <FileText size={13} color="#0284c7" />
                                  <span>PAN Document: {kycData.panDoc.name || 'Uploaded'}</span>
                                </div>
                              )}
                              {kycData.aadhaarDoc && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--bg-surface-hover, #f1f5f9)', padding: '4px 10px', borderRadius: 6 }}>
                                  <FileText size={13} color="#0284c7" />
                                  <span>Aadhaar Document: {kycData.aadhaarDoc.name || 'Uploaded'}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 3. Bank Details */}
                      <div
                        style={{
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: 8,
                          padding: '16px',
                          background: 'var(--bg-surface, #ffffff)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                          3. Bank Details
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 16px', fontSize: 13 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Bank Name</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.bankName || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Branch Name</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.branchName || '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Account Number</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>
                              {kycData.accountNumber || kycData.bankAccountNumber || '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>IFSC Code</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>
                              {kycData.ifscCode || kycData.bankIfsc || '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Account Type</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.accountType || 'Savings'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Account Holder</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.accountHolderName || detailDeal.customerName || '—'}</div>
                          </div>
                          {kycData.bankProofDoc && (
                            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--bg-surface-hover, #f1f5f9)', padding: '4px 10px', borderRadius: 6 }}>
                                <FileText size={13} color="#0284c7" />
                                <span>Bank Proof: {kycData.bankProofDoc.name || 'Uploaded'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 4. Demat Account */}
                      <div
                        style={{
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: 8,
                          padding: '16px',
                          background: 'var(--bg-surface, #ffffff)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                          4. Demat Account
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 16px', fontSize: 13 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Demat Status</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>
                              {kycData.hasNoDemat ? 'No Demat Account' : 'Demat Linked'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Account / Client ID</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2, fontFamily: 'monospace' }}>
                              {kycData.dematAccountNumber || [kycData.dematDpId, kycData.dematClientId].filter(Boolean).join(' / ') || '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Depository</div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{kycData.dematDepository || '—'}</div>
                          </div>
                          {kycData.dematDoc && (
                            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--bg-surface-hover, #f1f5f9)', padding: '4px 10px', borderRadius: 6 }}>
                                <FileText size={13} color="#0284c7" />
                                <span>Demat Document: {kycData.dematDoc.name || 'Uploaded'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 5. Nominee Details */}
                      <div
                        style={{
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: 8,
                          padding: '16px',
                          background: 'var(--bg-surface, #ffffff)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                          5. Nominee Details
                        </div>
                        {kycData.nominees && kycData.nominees.length > 0 && kycData.nominees.some((n: any) => n.name?.trim()) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {kycData.nominees.map((nom: any, idx: number) => (
                              <div
                                key={nom.id || idx}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                  gap: '8px 14px',
                                  fontSize: 13,
                                  padding: '10px 14px',
                                  borderRadius: 6,
                                  background: 'var(--bg-surface-hover, #f8fafc)',
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Nominee Name</div>
                                  <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{nom.name || '—'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Relationship</div>
                                  <div style={{ color: 'var(--text-primary)' }}>{nom.relationship || '—'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Allocation</div>
                                  <div style={{ color: '#10b981', fontWeight: 600 }}>{nom.allocationPercentage ? `${nom.allocationPercentage}%` : '—'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Date of Birth</div>
                                  <div style={{ color: 'var(--text-primary)' }}>{nom.dob || '—'}</div>
                                </div>
                                {nom.guardianName && (
                                  <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Guardian</div>
                                    <div style={{ color: 'var(--text-primary)' }}>{nom.guardianName}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No nominee details recorded.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ── Confirm Investment Amount Dialog ──────────────────────────────── */}
      <Modal
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title="Confirm Investment Amount"
        maxWidth={460}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmAmount}
            >
              Confirm
            </button>
          </>
        }
      >
        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
          Set investment amount to{' '}
          <strong style={{ color: '#10b981' }}>
            {formatCurrency(parseFloat(amountInput) || 0)}
          </strong>{' '}
          for <strong>{detailDeal?.customerName}</strong>? This will be used for conversion.
        </div>
      </Modal>
    </div>
  );
};
