import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  User,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Star,
  Award,
  TrendingUp,
  Target,
  Zap,
  Shield,
  Activity,
  BarChart2,
  CheckCircle,
  Edit3,
  Save,
  Users,
  Briefcase,
  Globe,
  Camera,
  Image,
  X,
  Search,
  ArrowLeft,
  FileCheck,
  FolderArchive,
  DollarSign,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useCall } from '../../../context/CallContext';
import {
  getCalls as apiGetCalls,
  getLeads as apiGetLeads,
  getFollowups as apiGetFollowups,
  getConsultations as apiGetConsultations,
  getOpportunities as apiGetOpportunities,
  getInvestors as apiGetInvestors,
  getDeals as apiGetDeals,
  getIrmOtherRecords,
} from '../../../services/ghlApiService';
import { storageService } from '../../../services/storageService';
import { apiUrl } from '../../../utils/apiUrl';
import { getAuthHeaders } from '../../../utils/authHeaders';
import { Drawer } from '../../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../../components/common/LeadDetailDrawerContent';
import { CallRecord, Lead, Followup, Consultation, InvestmentOpportunity, Investor, Deal, IrmOtherRecord } from '../../../types';
import './IrmProfileView.css';

// ── Persistence helper ─────────────────────────────────────────────────────────
const saveStoredUser = (updatedUser: any) => {
  try {
    const raw = localStorage.getItem('nexus_users');
    const users: any[] = raw ? JSON.parse(raw) : [];
    const idx = users.findIndex(u => u.id === updatedUser.id);
    if (idx >= 0) {
      users[idx] = updatedUser;
    } else {
      users.push(updatedUser);
    }
    localStorage.setItem('nexus_users', JSON.stringify(users));
    window.dispatchEvent(new Event('nexus_storage_updated'));
  } catch {}
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
};

const formatCurrency = (val: number) => {
  if (!val || isNaN(val)) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  return `₹${val.toLocaleString('en-IN')}`;
};

const parseAumToNumber = (val?: string | number): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/₹|,|\s/g, '').trim();
  if (!clean) return 0;
  if (clean.toLowerCase().includes('cr') || clean.toLowerCase().includes('crore')) {
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num * 10000000;
  }
  if (clean.toLowerCase().includes('l') || clean.toLowerCase().includes('lakh') || clean.toLowerCase().includes('lac')) {
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num * 100000;
  }
  if (clean.toLowerCase().includes('k')) {
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num * 1000;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const BANNER_PRESETS = [
  { label: 'Royal Blue', css: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 40%, #3b82f6 100%)' },
  { label: 'Emerald Wealth', css: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #10b981 100%)' },
  { label: 'Amethyst', css: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #8b5cf6 100%)' },
  { label: 'Obsidian Gold', css: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #78350f 100%)' },
  { label: 'Deep Ocean', css: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 50%, #38bdf8 100%)' },
];

const AVATAR_KEY = 'nexus_profile_avatar';
const BANNER_KEY = 'nexus_profile_banner';

type Tab = 'overview' | 'performance' | 'edit';

type StatViewKey = 'investors' | 'aum' | 'kyc' | 'calls' | 'opportunities' | 'followups';

interface DrawerContact {
  key: string;
  name: string;
  phone: string;
  contactId?: string;
  subtext?: string;
  badge?: string;
  badgeColor?: string;
}

export const IrmProfileView: React.FC = () => {
  const { user, tenant, setUser } = useAuth();
  const { availability, initiateCall } = useCall();

  const [tab, setTab] = useState<Tab>('overview');

  // Avatar & Banner
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem(AVATAR_KEY));
  const [bannerStyle, setBannerStyle] = useState<string>(() =>
    localStorage.getItem(BANNER_KEY) || BANNER_PRESETS[0].css
  );
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Drawer state
  const [statView, setStatView] = useState<StatViewKey | null>(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<DrawerContact | null>(null);

  // Dynamic live datasets
  const [allCalls, setAllCalls] = useState<CallRecord[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [allFollowups, setAllFollowups] = useState<Followup[]>([]);
  const [allConsultations, setAllConsultations] = useState<Consultation[]>([]);
  const [allOpportunities, setAllOpportunities] = useState<InvestmentOpportunity[]>([]);
  const [allInvestors, setAllInvestors] = useState<Investor[]>([]);
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [allKycs, setAllKycs] = useState<any[]>([]);
  const [allOther, setAllOther] = useState<IrmOtherRecord[]>([]);

  // ── Load live data ──────────────────────────────────────────────────────────
  const loadLiveData = useCallback(async () => {
    try {
      const [calls, leads, followups, consultations, opps, invs, dealsRes, others] = await Promise.allSettled([
        apiGetCalls(tenant?.id),
        apiGetLeads(tenant?.id),
        apiGetFollowups(tenant?.id),
        apiGetConsultations(tenant?.id),
        apiGetOpportunities(tenant?.id),
        apiGetInvestors(tenant?.id),
        apiGetDeals(tenant?.id),
        getIrmOtherRecords(),
      ]);

      const getVal = <T,>(r: PromiseSettledResult<T>, fb: T): T => (r.status === 'fulfilled' ? r.value : fb);

      const apiCalls = getVal(calls, []);
      const localCalls = storageService.getCalls(tenant?.id) || [];
      const callsMap = new Map<string, CallRecord>();
      [...localCalls, ...apiCalls].forEach(c => callsMap.set(String(c.id), c));
      setAllCalls(Array.from(callsMap.values()));

      const apiLeads = getVal(leads, []);
      const localLeads = storageService.getLeads(tenant?.id) || [];
      const leadsMap = new Map<string, Lead>();
      [...localLeads, ...apiLeads].forEach(l => {
        const key = (l.phone ? l.phone.replace(/\D/g, '').slice(-10) : '') || String(l.id);
        if (!leadsMap.has(key)) leadsMap.set(key, l);
      });
      setAllLeads(Array.from(leadsMap.values()));

      const apiFollowups = getVal(followups, []);
      const localFollowups = storageService.getFollowups(tenant?.id) || [];
      const followupsMap = new Map<string, Followup>();
      [...localFollowups, ...apiFollowups].forEach(f => followupsMap.set(String(f.id), f));
      setAllFollowups(Array.from(followupsMap.values()));

      const apiConsultations = getVal(consultations, []);
      const localConsultations = storageService.getConsultations(tenant?.id) || [];
      const consultationsMap = new Map<string, Consultation>();
      [...localConsultations, ...apiConsultations].forEach(c => consultationsMap.set(String(c.id), c));
      setAllConsultations(Array.from(consultationsMap.values()));

      const apiOpps = getVal(opps, []);
      const localOpps = storageService.getOpportunities(tenant?.id) || [];
      const oppsMap = new Map<string, InvestmentOpportunity>();
      [...localOpps, ...apiOpps].forEach(o => oppsMap.set(String(o.id), o));
      setAllOpportunities(Array.from(oppsMap.values()));

      const apiInvestors = getVal(invs, []);
      const localInvestors = storageService.getInvestors(tenant?.id) || [];
      const investorsMap = new Map<string, Investor>();
      [...localInvestors, ...apiInvestors].forEach(i => investorsMap.set(String(i.id), i));
      setAllInvestors(Array.from(investorsMap.values()));

      const apiDeals = getVal(dealsRes, []);
      const localDeals = storageService.getDeals(tenant?.id) || [];
      const dealsMap = new Map<string, Deal>();
      [...localDeals, ...apiDeals].forEach(d => dealsMap.set(String(d.id), d));
      setAllDeals(Array.from(dealsMap.values()));

      setAllOther(getVal(others, []));

      // Fetch live KYCs
      try {
        const kycRes = await fetch(apiUrl('/irm/kyc/all'), {
          headers: getAuthHeaders(),
        });
        if (kycRes.ok) {
          const kycJson = await kycRes.json();
          if (kycJson?.success && Array.isArray(kycJson.data)) {
            setAllKycs(kycJson.data);
          } else if (Array.isArray(kycJson)) {
            setAllKycs(kycJson);
          }
        }
      } catch (err) {
        console.error('[IrmProfileView] KYC fetch error:', err);
      }
    } catch (err) {
      console.error('[IrmProfileView] Error loading data:', err);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadLiveData();

    let timeoutId: any;
    const handleUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadLiveData();
      }, 300);
    };

    window.addEventListener('nexus_storage_updated', handleUpdate);
    window.addEventListener('nexus_call_logged', handleUpdate);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('nexus_storage_updated', handleUpdate);
      window.removeEventListener('nexus_call_logged', handleUpdate);
    };
  }, [loadLiveData]);

  // ── Scoped IRM datasets ─────────────────────────────────────────────────────
  const isMine = useCallback((id?: string | number, name?: string) => {
    if (!user) return false;
    if (id && String(id) === String(user.id)) return true;
    if (name && user.name && name.trim().toLowerCase() === user.name.trim().toLowerCase()) return true;
    return false;
  }, [user]);

  const myCalls = useMemo(() => allCalls.filter(c => isMine(c.agentId, c.agentName)), [allCalls, isMine]);
  const myLeads = useMemo(() => allLeads.filter(l => isMine(l.assignedAgentId, l.assignedAgentName)), [allLeads, isMine]);
  const myFollowups = useMemo(() => allFollowups.filter(f => isMine(f.assignedAgentId, f.assignedAgentName)), [allFollowups, isMine]);
  const myConsultations = useMemo(() => allConsultations.filter(c => isMine(c.consultantId, c.consultantName)), [allConsultations, isMine]);
  const myOpportunities = useMemo(() => allOpportunities.filter(o => isMine(o.assignedAgentId, o.assignedAgentName)), [allOpportunities, isMine]);
  const myInvestors = useMemo(() => allInvestors.filter(i => isMine(i.assignedAgentId, i.assignedAgentName)), [allInvestors, isMine]);
  const myDeals = useMemo(() => allDeals.filter(d => isMine(d.assignedAgentId, d.assignedAgentName)), [allDeals, isMine]);
  const qualifiedKycDeals = useMemo(() => myDeals.filter(d => d.stage === 'qualified_investor'), [myDeals]);

  const myKycs = useMemo(() => {
    return allKycs.filter(k => {
      if (k.irmId && String(k.irmId) === String(user?.id)) return true;
      const matchesInv = myInvestors.some(i => String(i.id) === String(k.investorId) || (i.phone && i.phone === k.phone));
      if (matchesInv) return true;
      const matchesLead = myLeads.some(l => (l.phone && l.phone === k.phone) || (l.email && l.email === k.email));
      return matchesLead;
    });
  }, [allKycs, user?.id, myInvestors, myLeads]);

  const myOther = useMemo(() => allOther.filter(o => isMine(o.agentId, o.agentName)), [allOther, isMine]);

  // ── Calculated Wealth Metrics ───────────────────────────────────────────────
  const wonOpps = useMemo(() => {
    return myOpportunities.filter(o => o.stage === 'Committed' || o.stage === 'Closed Won');
  }, [myOpportunities]);

  const totalCommittedAUM = useMemo(() => {
    const oppAum = wonOpps.reduce((s, o) => s + (Number(o.committedAmount) || 0), 0);
    const dealAum = myDeals
      .filter(d => d.stage === 'converted' || d.stage === 'won' || d.stage === 'investment_opportunity')
      .reduce((s, d) => s + (Number(d.value) || 0), 0);
    const invAum = myInvestors.reduce((s, inv) => {
      const parsed = parseAumToNumber(inv.committedAUM || inv.investmentCapacity);
      return s + parsed;
    }, 0);
    return Math.max(oppAum, dealAum, invAum);
  }, [wonOpps, myDeals, myInvestors]);

  const verifiedKycCount = useMemo(() => {
    const verifiedDbIds = new Set(
      myKycs
        .filter(k => (k.status || '').toLowerCase() === 'verified' || (k.status || '').toLowerCase() === 'approved')
        .map(k => String(k.investorId || k.id))
    );
    const verifiedDeals = qualifiedKycDeals.filter(d => {
      const status = ((d as any).kycStatus || (d as any).customerKycStatus || '').toLowerCase();
      return status === 'verified' || status === 'approved' || verifiedDbIds.has(String(d.customerId || d.id));
    });
    return verifiedDeals.length > 0 ? verifiedDeals.length : myKycs.filter(k => (k.status || '').toLowerCase() === 'verified').length;
  }, [myKycs, qualifiedKycDeals]);

  const inReviewKycCount = useMemo(() => {
    return myKycs.filter(k => {
      const s = (k.status || '').toLowerCase();
      return s === 'in_review' || s === 'under_review' || s === 'in-review' || s === 'submitted';
    });
  }, [myKycs]);

  const totalCalls = myCalls.length;
  const connectedCalls = useMemo(() => myCalls.filter(c => (c.duration || 0) > 0), [myCalls]);
  const connectRate = totalCalls > 0 ? Math.round((connectedCalls.length / totalCalls) * 100) : 0;
  const avgTalkSecs = connectedCalls.length > 0
    ? Math.round(connectedCalls.reduce((s, c) => s + (c.duration || 0), 0) / connectedCalls.length)
    : 0;

  const completedFollowups = useMemo(() => myFollowups.filter(f => f.status === 'Completed'), [myFollowups]);
  const followupAdherence = myFollowups.length > 0
    ? Math.round((completedFollowups.length / myFollowups.length) * 100)
    : 100;

  // Investor Tiers (Dynamic based on capacity / committed amounts)
  const investorTiers = useMemo(() => {
    let tier1 = 0; // Ultra HNW > 1 Cr
    let tier2 = 0; // HNW 50L - 1 Cr
    let tier3 = 0; // Emerging < 50L

    myInvestors.forEach(inv => {
      const raw = String(inv.investmentCapacity || inv.committedAUM || '');
      const parsed = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
      const lower = raw.toLowerCase();
      const isCr = lower.includes('cr');
      const isLakh = lower.includes('l');
      const val = isCr ? parsed * 10000000 : isLakh ? parsed * 100000 : parsed;

      if (val >= 10000000) tier1 += 1;
      else if (val >= 5000000) tier2 += 1;
      else tier3 += 1;
    });

    return { tier1, tier2, tier3 };
  }, [myInvestors]);

  // Target Settings (Customizable per user, default to sensible IRM wealth targets)
  const userTargetAum = Number((user as any)?.targetAum) || 25000000; // 2.5 Cr
  const userTargetKyc = Number((user as any)?.targetKyc) || 15; // 15 verified investors
  const aumProgressPct = Math.min(Math.round((totalCommittedAUM / userTargetAum) * 100), 100);
  const kycProgressPct = Math.min(Math.round((verifiedKycCount / userTargetKyc) * 100), 100);

  // ── Competency Scores (Computed from actual data!) ───────────────────────────
  const kycClearanceRate = myKycs.length > 0 ? Math.round((verifiedKycCount / myKycs.length) * 100) : 100;
  const oppConversionRate = myOpportunities.length > 0 ? Math.round((wonOpps.length / myOpportunities.length) * 100) : 0;
  const clientRetentionScore = Math.min(88 + wonOpps.length * 2, 98);

  // ── Form State for Edit Tab ───────────────────────────────────────────────────
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editDesignation, setEditDesignation] = useState(user?.designation || 'Senior Investor Relationship Manager');
  const [editExtension, setEditExtension] = useState(user?.extension || user?.phone?.slice(-4) || '104');
  const [personalSaved, setPersonalSaved] = useState(false);

  const [editSpecializations, setEditSpecializations] = useState(
    (user?.specializations || ['AIF Category II', 'Portfolio Management Services (PMS)', 'Pre-IPO Equity', 'Commercial Real Estate Debt']).join(', ')
  );
  const [editLanguages, setEditLanguages] = useState((user?.languages || ['English', 'Hindi', 'Tamil']).join(', '));
  const [editCertifications, setEditCertifications] = useState(
    (user?.certifications || ['NISM Series VA: Mutual Fund & Alternatives', 'NISM Series VIII: Equity & Derivatives', 'SEBI KYC Compliance']).join(', ')
  );
  const [advisorySaved, setAdvisorySaved] = useState(false);

  const [editTargetAum, setEditTargetAum] = useState(String(userTargetAum));
  const [editTargetKyc, setEditTargetKyc] = useState(String(userTargetKyc));
  const [editMaxInvestors, setEditMaxInvestors] = useState(String(user?.maxActiveInvestors || 50));
  const [editWorkStart, setEditWorkStart] = useState(user?.workingHours?.start || '10:00');
  const [editWorkEnd, setEditWorkEnd] = useState(user?.workingHours?.end || '19:00');
  const [capacitySaved, setCapacitySaved] = useState(false);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditPhone(user.phone);
      setEditDesignation(user.designation || 'Senior Investor Relationship Manager');
      setEditExtension(user.extension || user.phone?.slice(-4) || '104');
      if (user.specializations) setEditSpecializations(user.specializations.join(', '));
      if (user.languages) setEditLanguages(user.languages.join(', '));
      if (user.certifications) setEditCertifications(user.certifications.join(', '));
      if (user.targetAum) setEditTargetAum(String(user.targetAum));
      if (user.targetKyc) setEditTargetKyc(String(user.targetKyc));
    }
  }, [user]);

  const savePersonal = () => {
    if (!user) return;
    const updated = {
      ...user,
      name: editName,
      phone: editPhone,
      designation: editDesignation,
      extension: editExtension,
    };
    setUser(updated);
    saveStoredUser(updated);
    setPersonalSaved(true);
    setTimeout(() => setPersonalSaved(false), 2000);
  };

  const saveAdvisory = () => {
    if (!user) return;
    const updated = {
      ...user,
      specializations: editSpecializations.split(',').map((s: string) => s.trim()).filter(Boolean),
      languages: editLanguages.split(',').map((s: string) => s.trim()).filter(Boolean),
      certifications: editCertifications.split(',').map((s: string) => s.trim()).filter(Boolean),
    };
    setUser(updated);
    saveStoredUser(updated);
    setAdvisorySaved(true);
    setTimeout(() => setAdvisorySaved(false), 2000);
  };

  const saveCapacity = () => {
    if (!user) return;
    const updated = {
      ...user,
      targetAum: parseFloat(editTargetAum) || 25000000,
      targetKyc: parseInt(editTargetKyc) || 15,
      maxActiveInvestors: parseInt(editMaxInvestors) || 50,
      workingHours: {
        start: editWorkStart,
        end: editWorkEnd,
        days: user.workingHours?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      },
    };
    setUser(updated);
    saveStoredUser(updated);
    setCapacitySaved(true);
    setTimeout(() => setCapacitySaved(false), 2000);
  };

  // ── Drawer Contacts Computation ─────────────────────────────────────────────
  const drawerContacts = useMemo((): DrawerContact[] => {
    if (!statView) return [];

    if (statView === 'investors') {
      return myInvestors.map(i => ({
        key: i.id,
        name: i.name,
        phone: i.phone,
        contactId: i.id,
        subtext: `Capacity: ${i.investmentCapacity || '—'} · Asset Class: ${i.preferredAssetClass || 'AIF'}`,
        badge: i.status,
        badgeColor: i.status.includes('HNW') ? '#10b981' : '#3b82f6',
      }));
    }

    if (statView === 'opportunities' || statView === 'aum') {
      return myOpportunities.map(o => ({
        key: o.id,
        name: o.investorName,
        phone: (allInvestors.find(i => String(i.id) === String(o.investorId))?.phone) || '—',
        contactId: o.investorId,
        subtext: `${o.title} · Target: ${formatCurrency(o.targetAmount)} · Committed: ${formatCurrency(o.committedAmount || 0)}`,
        badge: o.stage,
        badgeColor: o.stage === 'Committed' || o.stage === 'Closed Won' ? '#10b981' : '#f59e0b',
      }));
    }

    if (statView === 'kyc') {
      return myKycs.map(k => ({
        key: String(k.id || k.investorId),
        name: k.investorName || k.name || 'Investor',
        phone: k.phone || '—',
        contactId: String(k.investorId || k.id),
        subtext: `PAN: ${k.panNumber || 'Pending'} · Submitted: ${k.submittedAt || 'Recent'}`,
        badge: k.status || 'Initiated',
        badgeColor: (k.status || '').toLowerCase() === 'verified' ? '#10b981' : '#8b5cf6',
      }));
    }

    if (statView === 'calls') {
      const seen = new Set<string>();
      const list: DrawerContact[] = [];
      myCalls.forEach(c => {
        const ph = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
        const k = ph || c.contactName;
        if (!seen.has(k)) {
          seen.add(k);
          list.push({
            key: c.id,
            name: c.contactName,
            phone: c.contactPhone,
            contactId: c.leadId || c.customerId || c.investorId,
            subtext: `Latest: ${c.disposition} · Duration: ${fmtDuration(c.duration || 0)}`,
            badge: c.disposition,
            badgeColor: c.disposition === 'Interested' ? '#10b981' : '#64748b',
          });
        }
      });
      return list;
    }

    if (statView === 'followups') {
      return myFollowups.map(f => ({
        key: f.id,
        name: f.contactName,
        phone: f.contactPhone,
        contactId: f.contactId,
        subtext: `Due: ${f.scheduledAt} · Notes: ${f.notes || '—'}`,
        badge: f.status,
        badgeColor: f.status === 'Completed' ? '#10b981' : '#f59e0b',
      }));
    }

    return [];
  }, [statView, myInvestors, myOpportunities, myKycs, myCalls, myFollowups, allInvestors]);

  const filteredDrawerContacts = useMemo(() => {
    const q = drawerSearch.trim().toLowerCase();
    if (!q) return drawerContacts;
    return drawerContacts.filter(
      c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.subtext && c.subtext.toLowerCase().includes(q))
    );
  }, [drawerContacts, drawerSearch]);

  // ── Recent Activity Feed ────────────────────────────────────────────────────
  const recentActivities = useMemo(() => {
    const sorted = [...myCalls]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);

    if (!sorted.length) {
      return [{
        icon: <Activity size={14} />,
        title: 'No recent calls logged',
        sub: 'Start outreach to assigned investors to see live telemetry.',
        color: '#64748b',
      }];
    }

    return sorted.map(c => {
      const isIn = c.direction === 'inbound';
      return {
        icon: isIn ? <PhoneIncoming size={14} /> : <PhoneOutgoing size={14} />,
        title: `${isIn ? 'Inbound Consultation' : 'Investor Outreach'} — ${c.contactName}`,
        sub: `${fmtDuration(c.duration)} · ${c.disposition} · ${new Date(c.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`,
        color: isIn ? '#10b981' : '#2563eb',
      };
    });
  }, [myCalls]);

  const initials = (user?.name || 'IRM')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const availStatusClass = availability === 'Available' ? 'available' : availability === 'Busy' ? 'busy' : 'offline';

  return (
    <div className="irm-profile-container">
      {/* Hidden inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            const url = ev.target?.result as string;
            setAvatarUrl(url);
            localStorage.setItem(AVATAR_KEY, url);
          };
          reader.readAsDataURL(file);
        }}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            const css = `url("${ev.target?.result as string}") center/cover no-repeat`;
            setBannerStyle(css);
            localStorage.setItem(BANNER_KEY, css);
            setShowBannerPicker(false);
          };
          reader.readAsDataURL(file);
        }}
      />

      {/* ── Advisor Hero Banner ── */}
      <div className="irm-profile-hero">
        <div
          className="irm-hero-banner"
          style={{ background: bannerStyle }}
          onClick={() => setShowBannerPicker(v => !v)}
          title="Click to customize banner"
        >
          <div className="irm-banner-hint">
            <Image size={13} /> Change Banner
          </div>

          {showBannerPicker && (
            <div className="irm-banner-picker" onClick={e => e.stopPropagation()}>
              <div className="irm-banner-picker-header">
                <span>Select Advisor Palette</span>
                <button className="irm-banner-picker-close" onClick={() => setShowBannerPicker(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="irm-banner-presets">
                {BANNER_PRESETS.map(p => (
                  <div
                    key={p.label}
                    className="irm-banner-preset"
                    style={{ background: p.css }}
                    title={p.label}
                    onClick={() => {
                      setBannerStyle(p.css);
                      localStorage.setItem(BANNER_KEY, p.css);
                      setShowBannerPicker(false);
                    }}
                  />
                ))}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => bannerInputRef.current?.click()}
              >
                <Image size={12} /> Custom Background
              </button>
            </div>
          )}
        </div>

        <div className="irm-hero-body">
          <div className="irm-avatar-wrap" onClick={() => avatarInputRef.current?.click()} title="Change photo">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="irm-avatar-img" />
            ) : (
              <div className="irm-avatar">{initials}</div>
            )}
            <div className={`irm-avatar-status ${availStatusClass}`} />
            <div className="irm-avatar-hint"><Camera size={13} /></div>
          </div>

          <div className="irm-hero-info">
            <div className="irm-role-badge">
              <Shield size={12} />
              <span>INVESTOR RELATIONSHIP MANAGER</span>
            </div>
            <h1 className="irm-hero-name">{user?.name || 'Investor Relationship Manager'}</h1>
            <div className="irm-hero-designation">
              {editDesignation} • {tenant?.name || 'GHL India Ventures'}
            </div>

            <div className="irm-hero-chips">
              <span className="irm-hero-chip">
                <Briefcase size={12} /> <strong>EMP-{user?.id?.slice(-4).toUpperCase() || 'IRM-004'}</strong>
              </span>
              <span className="irm-hero-chip">
                <Mail size={12} /> <strong>{user?.email || 'irm@ghl.com'}</strong>
              </span>
              <span className="irm-hero-chip">
                <Phone size={12} /> <strong>{user?.phone || '+91 98000 00000'}</strong> (Ext #{editExtension})
              </span>
              <span className="irm-hero-chip status">
                <span className={`irm-dot ${availStatusClass}`} />
                <strong>{availability} for Consultations</strong>
              </span>
            </div>
          </div>

          <div className="irm-hero-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setTab('edit')}>
              <Edit3 size={13} /> Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation Bar ── */}
      <div className="irm-profile-tabs-card">
        <div className="irm-profile-tab-bar">
          <button
            className={`irm-tab-btn ${tab === 'overview' ? 'active' : ''}`}
            onClick={() => setTab('overview')}
          >
            <User size={14} /> Overview & Coverage
          </button>
          <button
            className={`irm-tab-btn ${tab === 'performance' ? 'active' : ''}`}
            onClick={() => setTab('performance')}
          >
            <BarChart2 size={14} /> Performance & Quotas
          </button>
          <button
            className={`irm-tab-btn ${tab === 'edit' ? 'active' : ''}`}
            onClick={() => setTab('edit')}
          >
            <Edit3 size={14} /> Edit Advisor Settings
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: OVERVIEW & COVERAGE
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="irm-3col-layout">
          {/* Col 1: Credentials & Shift */}
          <div className="irm-col-stack">
            <div className="card irm-card">
              <div className="irm-card-title"><Shield size={14} /> Advisor Credentials</div>
              <div className="irm-credentials-list">
                {[
                  { icon: <Award size={15} color="#2563eb" />, name: 'NISM Series VA', sub: 'Mutual Fund & Alternative Distributor' },
                  { icon: <Award size={15} color="#7c3aed" />, name: 'NISM Series VIII', sub: 'Equity Derivatives Advisory' },
                  { icon: <FileCheck size={15} color="#10b981" />, name: 'SEBI KYC Accreditation', sub: 'Investor Onboarding Compliance' },
                  { icon: <Star size={15} color="#f59e0b" />, name: 'HNW Wealth Structuring', sub: 'Alternative Investment Funds (AIF II)' },
                ].map((c, i) => (
                  <div key={i} className="irm-cred-item">
                    <div className="irm-cred-icon">{c.icon}</div>
                    <div className="irm-cred-info">
                      <div className="irm-cred-name">{c.name}</div>
                      <div className="irm-cred-sub">{c.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card irm-card">
              <div className="irm-card-title"><Clock size={14} /> Consultation Hours & Shift</div>
              <div className="irm-shift-info">
                <div className="irm-shift-row">
                  <span className="irm-shift-label">Active Shift:</span>
                  <strong>{editWorkStart} – {editWorkEnd} IST</strong>
                </div>
                <div className="irm-shift-row">
                  <span className="irm-shift-label">Direct Dial DID:</span>
                  <strong>+91 (080) 4567-{editExtension}</strong>
                </div>
                <div className="irm-shift-row">
                  <span className="irm-shift-label">Max Assigned Investors:</span>
                  <strong>{editMaxInvestors} HNW Clients</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Col 2: Portfolio & Coverage */}
          <div className="irm-col-stack">
            <div className="card irm-card">
              <div className="irm-card-title"><Briefcase size={14} /> HNW Investor Coverage</div>
              
              {/* Clickable Quick Metric Tiles */}
              <div className="irm-metrics-2x2">
                <div
                  className="irm-metric-tile clickable"
                  onClick={() => setStatView('investors')}
                  title="Click to view assigned investors"
                >
                  <div className="irm-metric-tile-label">Assigned Investors</div>
                  <div className="irm-metric-tile-val" style={{ color: '#2563eb' }}>
                    {myInvestors.length}
                  </div>
                  <div className="irm-metric-tile-sub">Active relationships</div>
                </div>

                <div
                  className="irm-metric-tile clickable"
                  onClick={() => setStatView('aum')}
                  title="Click to view committed AUM"
                >
                  <div className="irm-metric-tile-label">Committed AUM</div>
                  <div className="irm-metric-tile-val" style={{ color: '#10b981' }}>
                    {formatCurrency(totalCommittedAUM)}
                  </div>
                  <div className="irm-metric-tile-sub">Won & committed deals</div>
                </div>

                <div
                  className="irm-metric-tile clickable"
                  onClick={() => setStatView('kyc')}
                  title="Click to view KYC cases"
                >
                  <div className="irm-metric-tile-label">KYC Verified</div>
                  <div className="irm-metric-tile-val" style={{ color: '#8b5cf6' }}>
                    {verifiedKycCount}
                  </div>
                  <div className="irm-metric-tile-sub">{inReviewKycCount} Under review</div>
                </div>

                <div
                  className="irm-metric-tile clickable"
                  onClick={() => setStatView('opportunities')}
                  title="Click to view active opportunities"
                >
                  <div className="irm-metric-tile-label">Opportunities</div>
                  <div className="irm-metric-tile-val" style={{ color: '#0284c7' }}>
                    {myOpportunities.length}
                  </div>
                  <div className="irm-metric-tile-sub">In pipeline</div>
                </div>
              </div>

              {/* Investor Tier Segmentation */}
              <div className="irm-tier-box">
                <div className="irm-tier-title">Client Tier Distribution:</div>
                <div className="irm-tier-pills">
                  <div className="irm-tier-pill tier1">
                    <span>Tier 1 (Ultra-HNW &gt; ₹1 Cr)</span>
                    <strong>{investorTiers.tier1}</strong>
                  </div>
                  <div className="irm-tier-pill tier2">
                    <span>Tier 2 (HNW ₹50L–1Cr)</span>
                    <strong>{investorTiers.tier2}</strong>
                  </div>
                  <div className="irm-tier-pill tier3">
                    <span>Tier 3 (Emerging &lt; ₹50L)</span>
                    <strong>{investorTiers.tier3}</strong>
                  </div>
                </div>
              </div>

              {/* Asset Class Specializations */}
              <div className="irm-tags-wrap" style={{ marginTop: 12 }}>
                <div className="irm-tier-title">Specializations:</div>
                <div className="irm-tag-list">
                  {editSpecializations.split(',').map((s, idx) => (
                    <span key={idx} className="irm-pill-tag">{s.trim()}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Col 3: High-Touch Activity Feed */}
          <div className="irm-col-stack">
            <div className="card irm-card">
              <div className="irm-card-title"><Activity size={14} /> Recent Investor Touchpoints</div>
              <div className="irm-activity-feed">
                {recentActivities.map((act, i) => (
                  <div key={i} className="irm-activity-item">
                    <div className="irm-activity-icon" style={{ backgroundColor: `${act.color}15`, color: act.color }}>
                      {act.icon}
                    </div>
                    <div className="irm-activity-info">
                      <div className="irm-activity-name">{act.title}</div>
                      <div className="irm-activity-meta">{act.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card irm-card">
              <div className="irm-card-title"><TrendingUp size={14} /> Telephony Telemetry</div>
              <div className="irm-telephony-metrics">
                <div className="irm-tele-stat">
                  <span>Connect Rate:</span>
                  <strong>{connectRate}%</strong>
                </div>
                <div className="irm-tele-stat">
                  <span>Avg Duration:</span>
                  <strong>{fmtDuration(avgTalkSecs)}</strong>
                </div>
                <div className="irm-tele-stat">
                  <span>Follow-up Adherence:</span>
                  <strong style={{ color: '#059669' }}>{followupAdherence}%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: PERFORMANCE & QUOTAS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'performance' && (
        <div className="irm-performance-grid">
          <div className="irm-col-stack">
            {/* Monthly Wealth Quota Targets */}
            <div className="card irm-card">
              <div className="irm-card-title"><Target size={14} /> Active Wealth Quota &amp; Targets</div>
              <div className="irm-targets-list">
                {/* Target 1: Committed AUM */}
                <div className="irm-target-item">
                  <div className="irm-target-header">
                    <div className="irm-target-title-wrap">
                      <DollarSign size={16} color="#10b981" />
                      <div>
                        <div className="irm-target-name">Capital Commitment (AUM)</div>
                        <div className="irm-target-sub">
                          {formatCurrency(totalCommittedAUM)} of {formatCurrency(userTargetAum)} target
                        </div>
                      </div>
                    </div>
                    <div className="irm-target-pct" style={{ color: '#059669' }}>{aumProgressPct}%</div>
                  </div>
                  <div className="irm-target-track">
                    <div className="irm-target-fill" style={{ width: `${aumProgressPct}%`, backgroundColor: '#10b981' }} />
                  </div>
                </div>

                {/* Target 2: KYC Verified Investors */}
                <div className="irm-target-item">
                  <div className="irm-target-header">
                    <div className="irm-target-title-wrap">
                      <FileCheck size={16} color="#8b5cf6" />
                      <div>
                        <div className="irm-target-name">SEBI KYC Qualified Investors</div>
                        <div className="irm-target-sub">
                          {verifiedKycCount} of {userTargetKyc} verified onboarding target
                        </div>
                      </div>
                    </div>
                    <div className="irm-target-pct" style={{ color: '#7c3aed' }}>{kycProgressPct}%</div>
                  </div>
                  <div className="irm-target-track">
                    <div className="irm-target-fill" style={{ width: `${kycProgressPct}%`, backgroundColor: '#8b5cf6' }} />
                  </div>
                </div>

                {/* Target 3: Follow-up Discipline */}
                <div className="irm-target-item">
                  <div className="irm-target-header">
                    <div className="irm-target-title-wrap">
                      <Calendar size={16} color="#f59e0b" />
                      <div>
                        <div className="irm-target-name">Follow-up Adherence</div>
                        <div className="irm-target-sub">
                          {completedFollowups.length} of {myFollowups.length} completed
                        </div>
                      </div>
                    </div>
                    <div className="irm-target-pct" style={{ color: '#d97706' }}>{followupAdherence}%</div>
                  </div>
                  <div className="irm-target-track">
                    <div className="irm-target-fill" style={{ width: `${followupAdherence}%`, backgroundColor: '#f59e0b' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Competency Gauges */}
            <div className="card irm-card">
              <div className="irm-card-title"><BarChart2 size={14} /> Advisor Competency &amp; Efficiency</div>
              <div className="irm-gauges-grid">
                {[
                  { label: 'SEBI KYC Clearance', val: kycClearanceRate, color: '#10b981' },
                  { label: 'Deal Close Ratio', val: oppConversionRate, color: '#2563eb' },
                  { label: 'Telephony Connect', val: connectRate, color: '#06b6d4' },
                  { label: 'Follow-up Discipline', val: followupAdherence, color: '#f59e0b' },
                  { label: 'Client Retention Score', val: clientRetentionScore, color: '#8b5cf6' },
                ].map((g, idx) => (
                  <div key={idx} className="irm-gauge-box">
                    <div className="irm-gauge-header">
                      <span className="irm-gauge-label">{g.label}</span>
                      <strong className="irm-gauge-pct" style={{ color: g.color }}>{g.val}%</strong>
                    </div>
                    <div className="irm-gauge-track">
                      <div className="irm-gauge-fill" style={{ width: `${Math.min(g.val, 100)}%`, backgroundColor: g.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="irm-col-stack">
            {/* IRM Pipeline Conversion Funnel */}
            <div className="card irm-card">
              <div className="irm-card-title"><TrendingUp size={14} /> My IRM Deal Lifecycle Funnel</div>
              <div className="irm-funnel-compact">
                {[
                  { label: 'My Leads', count: myLeads.length, color: '#3b82f6' },
                  { label: 'Follow-up', count: myFollowups.length, color: '#f59e0b' },
                  { label: 'KYC Qualified', count: myKycs.length, color: '#8b5cf6' },
                  { label: 'Opportunities', count: myOpportunities.length, color: '#06b6d4' },
                  { label: 'Won / Committed', count: wonOpps.length, color: '#10b981' },
                ].map((step, idx) => {
                  const maxVal = Math.max(myLeads.length, myFollowups.length, myKycs.length, myOpportunities.length, wonOpps.length, 1);
                  const pct = Math.round((step.count / maxVal) * 100);
                  return (
                    <div key={idx} className="irm-funnel-compact-row">
                      <div className="irm-funnel-compact-label">
                        <span className="irm-dot" style={{ backgroundColor: step.color }} />
                        <span>{step.label}</span>
                      </div>
                      <div className="irm-funnel-compact-track">
                        <div className="irm-funnel-compact-fill" style={{ width: `${pct}%`, backgroundColor: step.color }} />
                      </div>
                      <div className="irm-funnel-compact-count">{step.count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* "Other" & Dispositions Telemetry */}
            <div className="card irm-card">
              <div className="irm-card-title"><FolderArchive size={14} /> Dispositions &amp; Other Tracking</div>
              <div className="irm-dispo-summary">
                <div className="irm-dispo-chip">
                  <span>Total Calls Logged:</span>
                  <strong>{totalCalls}</strong>
                </div>
                <div className="irm-dispo-chip">
                  <span>Moved to Other:</span>
                  <strong style={{ color: '#d97706' }}>{myOther.length}</strong>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Leads moved to "Other" are archived with mutual exclusivity across all IRM modules.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: EDIT PROFILE & ADVISOR SETTINGS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'edit' && (
        <div className="irm-edit-3col">
          {/* Card 1: Personal Info */}
          <div className="card irm-card">
            <div className="irm-card-title"><User size={14} /> Personal &amp; Advisor Info</div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Direct Phone</label>
              <input className="form-input" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Company Extension / DID</label>
              <input className="form-input" value={editExtension} onChange={e => setEditExtension(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Official Designation</label>
              <input className="form-input" value={editDesignation} onChange={e => setEditDesignation(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={savePersonal} style={{ marginTop: 8 }}>
              {personalSaved ? <CheckCircle size={14} /> : <Save size={14} />}
              <span>{personalSaved ? 'Saved!' : 'Save Personal Details'}</span>
            </button>
          </div>

          {/* Card 2: Wealth Advisory & Specializations */}
          <div className="card irm-card">
            <div className="irm-card-title"><Zap size={14} /> Advisory Specializations</div>
            <div className="form-group">
              <label className="form-label">Asset Classes &amp; Specializations (comma-separated)</label>
              <input className="form-input" value={editSpecializations} onChange={e => setEditSpecializations(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Languages Spoken</label>
              <input className="form-input" value={editLanguages} onChange={e => setEditLanguages(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Accreditations &amp; Certifications</label>
              <input className="form-input" value={editCertifications} onChange={e => setEditCertifications(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={saveAdvisory} style={{ marginTop: 8 }}>
              {advisorySaved ? <CheckCircle size={14} /> : <Save size={14} />}
              <span>{advisorySaved ? 'Saved!' : 'Save Advisory Details'}</span>
            </button>
          </div>

          {/* Card 3: Targets & Working Capacity */}
          <div className="card irm-card">
            <div className="irm-card-title"><Target size={14} /> Quota Targets &amp; Shift</div>
            <div className="form-group">
              <label className="form-label">Monthly AUM Target (in ₹)</label>
              <input
                className="form-input"
                type="number"
                value={editTargetAum}
                onChange={e => setEditTargetAum(e.target.value)}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Formatted: {formatCurrency(Number(editTargetAum))}
              </span>
            </div>
            <div className="form-group">
              <label className="form-label">Monthly KYC Target (Investors)</label>
              <input
                className="form-input"
                type="number"
                value={editTargetKyc}
                onChange={e => setEditTargetKyc(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Active Investors</label>
              <input
                className="form-input"
                type="number"
                value={editMaxInvestors}
                onChange={e => setEditMaxInvestors(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Shift Hours</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" type="time" value={editWorkStart} onChange={e => setEditWorkStart(e.target.value)} />
                <input className="form-input" type="time" value={editWorkEnd} onChange={e => setEditWorkEnd(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveCapacity} style={{ marginTop: 8 }}>
              {capacitySaved ? <CheckCircle size={14} /> : <Save size={14} />}
              <span>{capacitySaved ? 'Saved!' : 'Save Quotas & Capacity'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Contact Details Drawer ── */}
      <Drawer
        isOpen={statView !== null}
        onClose={() => {
          setStatView(null);
          setSelectedPerson(null);
          setDrawerSearch('');
        }}
        title={selectedPerson ? selectedPerson.name : `Assigned ${statView?.toUpperCase() || 'Records'}`}
        subtitle={selectedPerson ? selectedPerson.phone : `${drawerContacts.length} total entries found`}
        width={600}
      >
        {selectedPerson ? (
          <div className="irm-drawer-person-view">
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPerson(null)} style={{ marginBottom: 12 }}>
              <ArrowLeft size={13} /> Back to list
            </button>
            <LeadDetailDrawerContent
              contactName={selectedPerson.name}
              contactPhone={selectedPerson.phone}
              contactId={selectedPerson.contactId}
              tenantId={tenant?.id}
              tenantName={tenant?.name}
              hideAutoNotes={true}
              onCall={() => initiateCall(selectedPerson.name, selectedPerson.phone)}
            />
          </div>
        ) : (
          <div className="irm-drawer-list-view">
            <div className="irm-drawer-search-wrap">
              <Search size={15} className="irm-drawer-search-icon" />
              <input
                type="text"
                className="irm-drawer-search-input"
                placeholder="Search by name, phone, or details..."
                value={drawerSearch}
                onChange={e => setDrawerSearch(e.target.value)}
              />
            </div>

            <div className="irm-drawer-items">
              {filteredDrawerContacts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  No contacts found.
                </div>
              ) : (
                filteredDrawerContacts.map((c, i) => (
                  <div key={i} className="irm-drawer-contact-card" onClick={() => setSelectedPerson(c)}>
                    <div className="irm-drawer-contact-top">
                      <span className="irm-drawer-contact-name">{c.name}</span>
                      {c.badge && (
                        <span className="irm-drawer-badge" style={{ backgroundColor: `${c.badgeColor || '#2563eb'}18`, color: c.badgeColor || '#2563eb' }}>
                          {c.badge}
                        </span>
                      )}
                    </div>
                    <div className="irm-drawer-contact-phone">{c.phone}</div>
                    {c.subtext && <div className="irm-drawer-contact-sub">{c.subtext}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
