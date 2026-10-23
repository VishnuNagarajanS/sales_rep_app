import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Clock,
  PhoneCall,
  TrendingUp,
  Calendar,
  AlertCircle,
  ArrowUpRight,
  Phone,
  Plus,
  Briefcase,
  FileCheck,
  FolderArchive,
  Shield,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Layers,
  PhoneIncoming,
  CalendarCheck
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useCall } from '../../../context/CallContext';
import {
  getLeads,
  getDeals,
  getCalls,
  getFollowups,
  getConsultations,
  getInvestors,
  getOpportunities,
  getIrmOtherRecords,
} from '../../../services/ghlApiService';
import { fetchIrmAllLeads, IrmAllLeadsSummary } from '../../../services/irmAllLeadsService';
import { apiUrl } from '../../../utils/apiUrl';
import { getAuthHeaders } from '../../../utils/authHeaders';
import { formatSmartScheduleDate, isDateToday, isDateOverdue, isDateDueTodayOrOverdue } from '../../../utils/dateUtils';
import { getAgentRoleInfo, getAssigningSalesAgentInfo } from '../../../utils/agentRoleUtils';
import {
  Lead,
  Deal,
  CallRecord,
  Followup,
  Consultation,
  Investor,
  InvestmentOpportunity,
  IrmOtherRecord,
} from '../../../types';
import { StatusChip } from '../../../components/common/StatusChip';
import './IrmDashboardView.css';

interface IrmDashboardViewProps {
  onNavigate: (route: string) => void;
  onOpenQuickCreate: (type: 'lead' | 'followup' | 'deal' | 'visit' | 'consultation') => void;
}

export const IrmDashboardView: React.FC<IrmDashboardViewProps> = ({
  onNavigate,
  onOpenQuickCreate,
}) => {
  const { user, tenant } = useAuth();
  const { initiateCall } = useCall();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [opportunities, setOpportunities] = useState<InvestmentOpportunity[]>([]);
  const [kycs, setKycs] = useState<any[]>([]);
  const [otherRecords, setOtherRecords] = useState<IrmOtherRecord[]>([]);
  const [irmSummary, setIrmSummary] = useState<IrmAllLeadsSummary | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [scheduleTab, setScheduleTab] = useState<'followups' | 'consultations'>('followups');

  // ── Currency Formatter ───────────────────────────────────────────────────────
  const formatCurrency = (val: number) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // ── Number parser for currency strings (e.g. "2 Cr", "50 L", "20000000") ─────
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

  // ── Live Data Loading ────────────────────────────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [l, d, c, f, con, inv, opp, oth, allLeadsSum] = await Promise.allSettled([
        getLeads(tenant?.id),
        getDeals(tenant?.id),
        getCalls(tenant?.id),
        getFollowups(tenant?.id),
        getConsultations(tenant?.id),
        getInvestors(tenant?.id),
        getOpportunities(tenant?.id),
        getIrmOtherRecords(),
        fetchIrmAllLeads(user?.id, undefined, user?.name, tenant?.id),
      ]);

      const getVal = <T,>(res: PromiseSettledResult<T>, fb: T): T =>
        res.status === 'fulfilled' ? res.value : fb;

      setLeads(getVal(l, []));
      setDeals(getVal(d, []));
      setCalls(getVal(c, []));
      setFollowups(getVal(f, []));
      setConsultations(getVal(con, []));
      setInvestors(getVal(inv, []));
      setOpportunities(getVal(opp, []));
      setOtherRecords(getVal(oth, []));
      setIrmSummary(getVal(allLeadsSum, null));

      // Fetch live KYC records from backend
      try {
        const kycRes = await fetch(apiUrl('/irm/kyc/all'), {
          headers: getAuthHeaders(),
        });
        if (kycRes.ok) {
          const kycJson = await kycRes.json();
          if (kycJson?.success && Array.isArray(kycJson.data)) {
            setKycs(kycJson.data);
          } else if (Array.isArray(kycJson)) {
            setKycs(kycJson);
          }
        }
      } catch (err) {
        console.error('[IrmDashboardView] Failed to fetch KYC records:', err);
      }
    } catch (err) {
      console.error('[IrmDashboardView] Error loading dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant?.id, user?.id, user?.name]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData(true);
    window.addEventListener('nexus_storage_updated', handleUpdate);
    window.addEventListener('nexus_call_logged', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('nexus_storage_updated', handleUpdate);
      window.removeEventListener('nexus_call_logged', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadData]);

  // ── Role Scoping Helper ──────────────────────────────────────────────────────
  const isMine = useCallback((id?: string | number, name?: string) => {
    if (!user) return false;
    const uId = String(user.id);
    const uName = (user.name || '').trim().toLowerCase();
    if (id && String(id) === uId) return true;
    if (name) {
      const n = name.trim().toLowerCase();
      if (n === uName || n.includes(uName) || uName.includes(n)) return true;
    }
    return false;
  }, [user]);

  // Lead scoping for this IRM: includes leads directly assigned to IRM or handed over to IRM
  const isMineLead = useCallback((l: Lead) => {
    if (!user) return false;
    const uId = String(user.id);
    const uName = (user.name || '').trim().toLowerCase();
    const lAgentId = l.assignedAgentId != null ? String(l.assignedAgentId) : '';
    const lIrmId = l.assignedIrmId != null ? String(l.assignedIrmId) : '';
    const lAgentName = (l.assignedAgentName || '').trim().toLowerCase();
    const lIrmName = (l.assignedIrmName || '').trim().toLowerCase();

    if (uId && (lAgentId === uId || lIrmId === uId || String(l.customFields?.assignedIrmId || '') === uId)) return true;
    if (uName && (
      lAgentName === uName || lAgentName.includes(uName) || uName.includes(lAgentName) ||
      lIrmName === uName || lIrmName.includes(uName) || uName.includes(lIrmName) ||
      String(l.customFields?.assignedIrmName || '').trim().toLowerCase().includes(uName)
    )) return true;

    return false;
  }, [user]);

  // Scoped datasets for the logged-in IRM
  const scopedLeads = useMemo(() => leads.filter(l => isMineLead(l)), [leads, isMineLead]);
  const scopedInvestors = useMemo(() => investors.filter(i => isMine(i.assignedAgentId, i.assignedAgentName) || (i.assignedIrmId && String(i.assignedIrmId) === String(user?.id)) || (i.assignedIrmName && i.assignedIrmName.trim().toLowerCase() === (user?.name || '').trim().toLowerCase())), [investors, isMine, user]);
  const scopedOpportunities = useMemo(() => opportunities.filter(o => isMine(o.assignedAgentId, o.assignedAgentName)), [opportunities, isMine]);
  const scopedFollowups = useMemo(() => followups.filter(f => isMine(f.assignedAgentId, f.assignedAgentName)), [followups, isMine]);
  const scopedConsultations = useMemo(() => consultations.filter(c => isMine(c.consultantId, c.consultantName)), [consultations, isMine]);
  const scopedCalls = useMemo(() => calls.filter(c => isMine(c.agentId, c.agentName)), [calls, isMine]);
  const scopedOther = useMemo(() => otherRecords.filter(o => isMine(o.agentId, o.agentName)), [otherRecords, isMine]);

  const scopedKycs = useMemo(() => {
    return kycs.filter(k => {
      if (k.irmId && String(k.irmId) === String(user?.id)) return true;
      const matchesInv = scopedInvestors.some(i => String(i.id) === String(k.investorId) || (i.phone && i.phone === k.phone));
      if (matchesInv) return true;
      const matchesLead = scopedLeads.some(l => (l.phone && l.phone === k.phone) || (l.email && l.email === k.email));
      return matchesLead;
    });
  }, [kycs, user?.id, scopedInvestors, scopedLeads]);

  // ── Calculated Metrics (Real-Time Synced) ────────────────────────────────────
  // 1. AUM Calculation — Aggregates Won Opportunities, Converted Deals, and Converted Leads
  const wonOpps = useMemo(() => {
    return scopedOpportunities.filter(o => o.stage === 'Committed' || o.stage === 'Closed Won');
  }, [scopedOpportunities]);

  const totalCommittedAUM = useMemo(() => {
    const seenPhones = new Set<string>();
    let sum = 0;

    // A. From won/converted deals scoped to this IRM
    deals
      .filter(d => (d.stage === 'converted' || d.stage === 'won') && isMine(d.assignedAgentId, d.assignedAgentName))
      .forEach(d => {
        const ph = (d.phone || '').replace(/\D/g, '').slice(-10);
        if (ph) seenPhones.add(ph);
        sum += Number(d.value) || 0;
      });

    // B. From won opportunities
    wonOpps.forEach(o => {
      sum += Number(o.committedAmount) || 0;
    });

    // C. From converted leads in IRM summary
    (irmSummary?.leads || [])
      .filter(l => l.currentStage === 'Converted')
      .forEach(l => {
        const ph = (l.phone || '').replace(/\D/g, '').slice(-10);
        if (!ph || !seenPhones.has(ph)) {
          if (ph) seenPhones.add(ph);
          sum += Number(l.dealValue) || parseAumToNumber(l.investmentCapacity) || 0;
        }
      });

    // D. From scoped investors not already counted
    scopedInvestors.forEach(inv => {
      const ph = (inv.phone || '').replace(/\D/g, '').slice(-10);
      if (!ph || !seenPhones.has(ph)) {
        if (ph) seenPhones.add(ph);
        sum += parseAumToNumber(inv.committedAUM || inv.investmentCapacity);
      }
    });

    return sum;
  }, [wonOpps, deals, irmSummary, scopedInvestors, isMine]);

  const targetAum = Number((user as any)?.targetAum) || 25000000; // 2.5 Cr
  const aumProgress = targetAum > 0 ? Math.min(Math.round((totalCommittedAUM / targetAum) * 100), 100) : 0;

  // 2. KYC Metrics — Synced with KYC Page UI (deals at stage qualified_investor + leads in KYC)
  const allKycTargets = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string; verified: boolean; inReview: boolean }>();

    // Collect keys of investors/leads that have graduated/moved forward past KYC (Opportunities, Converted, etc.)
    const movedKeys = new Set<string>();

    deals
      .filter(d => isMine(d.assignedAgentId, d.assignedAgentName))
      .forEach(d => {
        const stage = (d.stage || '').toLowerCase().trim();
        if (stage === 'investment_opportunity' || stage === 'opportunity' || stage === 'term_sheet' || stage === 'committed' || stage === 'converted' || stage === 'won' || stage === 'lost') {
          const ph = (d.phone || '').replace(/\D/g, '').slice(-10);
          if (ph) movedKeys.add(ph);
          if (d.customerId) movedKeys.add(`cid:${d.customerId}`);
        }
      });

    (irmSummary?.leads || []).forEach(l => {
      const stage = (l.currentStage || '').toLowerCase().trim();
      const status = (l.status || '').toLowerCase().trim();
      if (stage === 'opportunities' || stage === 'converted' || stage === 'investor 360' || stage === 'archived' || status === 'converted') {
        const ph = (l.phone || '').replace(/\D/g, '').slice(-10);
        if (ph) movedKeys.add(ph);
      }
    });

    scopedInvestors.forEach(i => {
      const ph = (i.phone || '').replace(/\D/g, '').slice(-10);
      if (ph) movedKeys.add(ph);
      if (i.id) movedKeys.add(`cid:${i.id}`);
    });

    // From qualified KYC deals (only those currently active in qualified_investor stage)
    deals
      .filter(d => d.stage === 'qualified_investor' && isMine(d.assignedAgentId, d.assignedAgentName))
      .forEach(d => {
        const ph = (d.phone || '').replace(/\D/g, '').slice(-10);
        const cid = d.customerId ? `cid:${d.customerId}` : '';
        if ((ph && movedKeys.has(ph)) || (cid && movedKeys.has(cid))) return;

        const key = ph || String(d.id);
        const status = ((d as any).kycStatus || (d as any).customerKycStatus || '').toLowerCase();
        const isVer = status === 'verified' || status === 'approved';
        const isRev = status.includes('review') || status.includes('submitted');
        map.set(key, { name: d.customerName, phone: d.phone, verified: isVer, inReview: isRev });
      });

    // From IRM leads in KYC stage (only those currently active in KYC stage)
    (irmSummary?.leads || [])
      .filter(l => l.currentStage === 'KYC')
      .forEach(l => {
        const ph = (l.phone || '').replace(/\D/g, '').slice(-10);
        if (ph && movedKeys.has(ph)) return;

        const key = ph || String(l.id);
        const kStatus = (l.kycStatus || '').toLowerCase();
        const isVer = kStatus === 'verified' || kStatus === 'approved';
        const isRev = kStatus.includes('review') || kStatus.includes('submitted') || kStatus === 'in_progress';
        if (!map.has(key)) {
          map.set(key, { name: l.name, phone: l.phone, verified: isVer, inReview: isRev });
        } else if (isVer) {
          const existing = map.get(key)!;
          existing.verified = true;
        }
      });

    // From live DB KYC records (ONLY if NOT moved forward past KYC)
    scopedKycs.forEach(k => {
      const ph = (k.phone || '').replace(/\D/g, '').slice(-10);
      const invId = k.investorId ? `cid:${k.investorId}` : '';
      if ((ph && movedKeys.has(ph)) || (invId && movedKeys.has(invId))) return;

      const key = ph || String(k.investorId || k.id);
      const s = (k.status || '').toLowerCase();
      const isVer = s === 'verified' || s === 'approved';
      const isRev = s.includes('review') || s.includes('submitted');
      if (!map.has(key)) {
        map.set(key, { name: k.investorName, phone: k.phone, verified: isVer, inReview: isRev });
      } else if (isVer) {
        const existing = map.get(key)!;
        existing.verified = true;
      }
    });

    return Array.from(map.values());
  }, [deals, irmSummary, scopedKycs, scopedInvestors, isMine]);

  const totalKycTargetCount = allKycTargets.length;
  const verifiedKycsCount = allKycTargets.filter(k => k.verified).length;
  const inReviewKycsCount = allKycTargets.filter(k => k.inReview).length;
  const kycClearanceRate = totalKycTargetCount > 0
    ? Math.round((verifiedKycsCount / totalKycTargetCount) * 100)
    : 0;

  // 3. Active Opportunities (matches OpportunitiesPage Deals + IRM Leads in Opportunities stage)
  const allOpportunities = useMemo(() => {
    const map = new Map<string, { title: string; corpus: number }>();

    // From deals in opportunity stages
    deals
      .filter(d => (d.stage === 'investment_opportunity' || d.stage === 'opportunity') && isMine(d.assignedAgentId, d.assignedAgentName))
      .forEach(d => {
        const key = (d.phone || '').replace(/\D/g, '').slice(-10) || String(d.id);
        map.set(key, { title: d.title || d.customerName, corpus: Number(d.value) || 0 });
      });

    // From scoped opportunities
    scopedOpportunities
      .filter(o => o.stage !== 'Closed Lost')
      .forEach(o => {
        const key = `opp-${o.id}`;
        map.set(key, { title: o.title, corpus: Number(o.targetAmount) || Number(o.committedAmount) || 0 });
      });

    // From IRM leads in Opportunities stage (e.g. Dr Raja Selvarajan)
    (irmSummary?.leads || [])
      .filter(l => l.currentStage === 'Opportunities')
      .forEach(l => {
        const key = (l.phone || '').replace(/\D/g, '').slice(-10) || String(l.id);
        if (!map.has(key)) {
          map.set(key, { title: l.name, corpus: Number(l.dealValue) || parseAumToNumber(l.investmentCapacity) || 0 });
        }
      });

    return Array.from(map.values());
  }, [deals, scopedOpportunities, irmSummary, isMine]);

  const activeOpportunitiesCount = allOpportunities.length;
  const totalPipelineCorpus = allOpportunities.reduce((s, o) => s + (o.corpus || 0), 0);
  const targetOpportunities = Number((user as any)?.targetOpportunities) || 5;
  const opportunitiesProgress = targetOpportunities > 0
    ? Math.min(Math.round((activeOpportunitiesCount / targetOpportunities) * 100), 100)
    : 0;

  // 4. Follow-ups
  const allPendingFollowups = useMemo(() => {
    const map = new Map<string, Followup>();

    scopedFollowups.filter(f => f.status === 'Pending').forEach(f => {
      const key = (f.contactPhone || '').replace(/\D/g, '').slice(-10) || String(f.id);
      map.set(key, f);
    });

    (irmSummary?.leads || [])
      .filter(l => l.currentStage === 'Follow-up' && l.nextFollowupDate)
      .forEach(l => {
        const key = (l.phone || '').replace(/\D/g, '').slice(-10) || String(l.id);
        if (!map.has(key)) {
          map.set(key, {
            id: `lead-flw-${l.id}`,
            companyId: String(l.companyId || ''),
            contactId: String(l.id),
            contactName: l.name,
            contactPhone: l.phone,
            contactEmail: l.email,
            contactType: 'lead',
            scheduledAt: l.nextFollowupDate!,
            status: 'Pending',
            priority: (l.priority as any) || 'Medium',
            notes: l.stageDetails || 'Follow-up scheduled',
            assignedAgentId: String(l.assignedAgentId || ''),
            assignedAgentName: l.assignedAgentName || '',
          });
        }
      });

    return Array.from(map.values());
  }, [scopedFollowups, irmSummary]);

  const pendingFollowups = allPendingFollowups;
  const overdueFollowups = useMemo(() => pendingFollowups.filter(f => isDateOverdue(f.scheduledAt)), [pendingFollowups]);
  const todaysFollowups = useMemo(() => pendingFollowups.filter(f => isDateToday(f.scheduledAt)), [pendingFollowups]);
  const dueFollowups = useMemo(() => pendingFollowups.filter(f => isDateDueTodayOrOverdue(f.scheduledAt)), [pendingFollowups]);

  // 5. Assigned HNW Clients (Investors + Converted Deals + Converted Leads)
  const allHnwClients = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string; capacity: number }>();

    scopedInvestors.forEach(inv => {
      const key = (inv.phone || '').replace(/\D/g, '').slice(-10) || String(inv.id);
      const cap = parseAumToNumber(inv.investmentCapacity || inv.committedAUM);
      map.set(key, { name: inv.name, phone: inv.phone, capacity: cap });
    });

    deals
      .filter(d => (d.stage === 'converted' || d.stage === 'won') && isMine(d.assignedAgentId, d.assignedAgentName))
      .forEach(d => {
        const key = (d.phone || '').replace(/\D/g, '').slice(-10) || String(d.customerId || d.id);
        const val = Number(d.value) || 0;
        if (!map.has(key)) {
          map.set(key, { name: d.customerName, phone: d.phone, capacity: val });
        } else {
          const existing = map.get(key)!;
          existing.capacity = Math.max(existing.capacity, val);
        }
      });

    (irmSummary?.leads || [])
      .filter(l => l.currentStage === 'Converted')
      .forEach(l => {
        const key = (l.phone || '').replace(/\D/g, '').slice(-10) || String(l.id);
        const val = Number(l.dealValue) || parseAumToNumber(l.investmentCapacity) || 0;
        if (!map.has(key)) {
          map.set(key, { name: l.name, phone: l.phone, capacity: val });
        } else {
          const existing = map.get(key)!;
          existing.capacity = Math.max(existing.capacity, val);
        }
      });

    return Array.from(map.values());
  }, [scopedInvestors, deals, irmSummary, isMine]);

  const totalHnwClientsCount = allHnwClients.length;
  const tier1Count = useMemo(() => allHnwClients.filter(c => c.capacity >= 10000000).length, [allHnwClients]);
  const targetHnwClients = Number((user as any)?.targetHnwClients) || 10;
  const clientsProgress = targetHnwClients > 0
    ? Math.min(Math.round((totalHnwClientsCount / targetHnwClients) * 100), 100)
    : 0;

  // Seven days delta
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newInvestorsThisWeek = useMemo(() => {
    return scopedInvestors.filter(i => {
      if (!i.createdAt) return false;
      const d = new Date(i.createdAt);
      return !isNaN(d.getTime()) && d.getTime() >= sevenDaysAgo;
    }).length;
  }, [scopedInvestors, sevenDaysAgo]);

  // ── Today's Assigned Leads for this IRM (Present Day only & Not in Follow-up) ──

  const todayLeads = useMemo(() => {
    // 1. Pending follow-ups tracking
    const pendingFollowupContactIds = new Set<string>();
    const pendingFollowupPhones = new Set<string>();

    (followups || []).forEach(f => {
      if (String(f.status || '').toLowerCase() === 'pending') {
        if (f.contactId) pendingFollowupContactIds.add(String(f.contactId));
        const ph = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        if (ph) pendingFollowupPhones.add(ph);
      }
    });

    // 2. Deals tracking (KYC / Opportunity / Converted)
    const dealtContactIds = new Set<string>();
    const dealtPhones = new Set<string>();
    (deals || []).forEach(d => {
      const dStage = (d.stage || '').toLowerCase();
      if (dStage && dStage !== 'lost') {
        if (d.customerId) dealtContactIds.add(String(d.customerId));
        const ph = (d.phone || '').replace(/\D/g, '').slice(-10);
        if (ph) dealtPhones.add(ph);
      }
    });

    return scopedLeads.filter(l => {
      // Must be assigned or created today
      const d = l.assignedIrmAt || (l as any).assignedAt || l.createdAt;
      if (!isDateToday(d)) return false;

      // If status moved to follow-up or callback, do not show here
      const s = (l.status || '').trim().toLowerCase();
      if (
        s === 'follow-up' ||
        s === 'followup' ||
        s === 'follow-up required' ||
        s === 'callback' ||
        s === 'call back' ||
        s.includes('follow')
      ) {
        return false;
      }


      const lPhone = (l.phone || '').replace(/\D/g, '').slice(-10);
      const lId = String(l.id || '');

      // If a pending follow-up record exists, it belongs in Follow-ups
      if (lId && pendingFollowupContactIds.has(lId)) return false;
      if (lPhone && pendingFollowupPhones.has(lPhone)) return false;

      // If already converted, won, in opportunity, or KYC deal exists, do not show here
      if (lId && dealtContactIds.has(lId)) return false;
      if (lPhone && dealtPhones.has(lPhone)) return false;
      if (
        s === 'converted' ||
        s === 'qualified' ||
        s.includes('opportunity') ||
        s === 'lost' ||
        s === 'junk' ||
        s === 'not interested'
      ) {
        return false;
      }

      return true;
    });
  }, [scopedLeads, followups, deals]);

  const todayDateLabel = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const formatLeadTime = (dateVal?: string | Date) => {
    if (!dateVal) return 'Today';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Today';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="irm-dashboard-container">
      {/* ── Advisor Welcome Banner ── */}
      <div className="card irm-dashboard-banner">
        <div className="irm-banner-left">
          <div className="irm-banner-badge">
            <Shield size={12} />
            <span>INVESTOR RELATIONSHIP MANAGER DESK</span>
          </div>
          <h1 className="irm-banner-title">
            Welcome back, {user?.name?.split(' ')[0] || user?.name || 'Advisor'} 👋
          </h1>
          <p className="irm-banner-subtitle">
            You have <strong>{dueFollowups.length} follow-up{dueFollowups.length === 1 ? '' : 's'}</strong> due today and{' '}
            <strong>{Math.max(0, totalKycTargetCount - verifiedKycsCount)} investor KYC case{Math.max(0, totalKycTargetCount - verifiedKycsCount) === 1 ? '' : 's'}</strong> awaiting compliance verification.
          </p>
        </div>

        <div className="irm-banner-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadData(true)}
            title="Refresh dashboard metrics"
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? 'irm-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenQuickCreate('followup')}
          >
            <Calendar size={13} /> Log Follow-up
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('kyc')}
          >
            <FileCheck size={13} /> Verify KYC
          </button>
        </div>
      </div>

      {/* ── Top 5 Wealth KPI Metric Cards ── */}
      <div className="irm-dashboard-kpi-grid">
        {/* Card 1: Committed Capital (AUM) */}
        <div
          className="card card-hover irm-kpi-card aum"
          onClick={() => onNavigate('investors')}
          title="Click to view Investor 360 portfolio"
        >
          <div className="irm-kpi-header">
            <span className="irm-kpi-label">COMMITTED CAPITAL (AUM)</span>
            <div className="irm-kpi-icon aum"><DollarSign size={16} /></div>
          </div>
          <div className="irm-kpi-val">{formatCurrency(totalCommittedAUM)}</div>
          <div className="irm-kpi-progress-track">
            <div className="irm-kpi-progress-fill aum" style={{ width: `${aumProgress}%` }} />
          </div>
          <div className="irm-kpi-sub positive">
            <ArrowUpRight size={13} /> {aumProgress}% of {formatCurrency(targetAum)} target
          </div>
        </div>

        {/* Card 2: KYC Qualified Pipeline */}
        <div
          className="card card-hover irm-kpi-card kyc"
          onClick={() => onNavigate('kyc')}
          title="Click to view KYC module"
        >
          <div className="irm-kpi-header">
            <span className="irm-kpi-label">KYC QUALIFIED INVESTORS</span>
            <div className="irm-kpi-icon kyc"><FileCheck size={16} /></div>
          </div>
          <div className="irm-kpi-val">
            {verifiedKycsCount} <span className="irm-kpi-sub-num">/ {totalKycTargetCount}</span>
          </div>
          <div className="irm-kpi-progress-track">
            <div className="irm-kpi-progress-fill kyc" style={{ width: `${kycClearanceRate}%` }} />
          </div>
          <div className="irm-kpi-sub" style={{ color: '#8b5cf6' }}>
            <CheckCircle2 size={13} /> {kycClearanceRate}% clearance ({inReviewKycsCount} in review)
          </div>
        </div>

        {/* Card 3: Active Deal Pipeline */}
        <div
          className="card card-hover irm-kpi-card deals"
          onClick={() => onNavigate('opportunities')}
          title="Click to view Opportunities"
        >
          <div className="irm-kpi-header">
            <span className="irm-kpi-label">Opportunities</span>
            <div className="irm-kpi-icon deals"><Briefcase size={16} /></div>
          </div>
          <div className="irm-kpi-val">{activeOpportunitiesCount}</div>
          <div className="irm-kpi-progress-track">
            <div className="irm-kpi-progress-fill deals" style={{ width: `${opportunitiesProgress}%` }} />
          </div>
          <div className="irm-kpi-sub" style={{ color: '#0284c7' }}>
            <TrendingUp size={13} /> {opportunitiesProgress}% of target • Corpus: {formatCurrency(totalPipelineCorpus)}
          </div>
        </div>

        {/* Card 4: Actionable Follow-ups */}
        <div
          className="card card-hover irm-kpi-card followups"
          onClick={() => onNavigate('followups')}
          title="Click to view Follow-ups"
        >
          <div className="irm-kpi-header">
            <span className="irm-kpi-label">DUE FOLLOW-UPS</span>
            <div className="irm-kpi-icon followups"><Clock size={16} /></div>
          </div>
          <div className="irm-kpi-val">{dueFollowups.length}</div>
          <div className="irm-kpi-progress-track">
            <div
              className="irm-kpi-progress-fill followups"
              style={{
                width: `${overdueFollowups.length > 0 ? 100 : (dueFollowups.length > 0 ? 60 : 0)}%`,
                backgroundColor: overdueFollowups.length > 0 ? '#ef4444' : '#f59e0b',
              }}
            />
          </div>
          <div
            className={`irm-kpi-sub ${overdueFollowups.length > 0 ? 'overdue' : ''}`}
            style={{ color: overdueFollowups.length > 0 ? '#ef4444' : '#d97706' }}
          >
            {overdueFollowups.length > 0 ? (
              <>
                <AlertCircle size={13} /> {overdueFollowups.length} overdue follow-up item!
              </>
            ) : dueFollowups.length > 0 ? (
              `${dueFollowups.length} scheduled for today`
            ) : (
              'All scheduled on time'
            )}
          </div>
        </div>

        {/* Card 5: Assigned HNW Investors */}
        <div
          className="card card-hover irm-kpi-card investors"
          onClick={() => onNavigate('investors')}
          title="Click to view Investor 360"
        >
          <div className="irm-kpi-header">
            <span className="irm-kpi-label">ASSIGNED HNW CLIENTS</span>
            <div className="irm-kpi-icon investors"><Users size={16} /></div>
          </div>
          <div className="irm-kpi-val">{totalHnwClientsCount}</div>
          <div className="irm-kpi-progress-track">
            <div className="irm-kpi-progress-fill investors" style={{ width: `${clientsProgress}%` }} />
          </div>
          <div className="irm-kpi-sub" style={{ color: '#3b82f6' }}>
            <Shield size={13} /> {tier1Count} Tier 1 Ultra-HNW • {clientsProgress}% of target
          </div>
        </div>
      </div>

      {/* ── Main Clean 2-Column Split View ── */}
      <div className="irm-dashboard-split">
        {/* Left Column: Today's Assigned Leads (Present day only) */}
        <div className="card irm-widget-card">
          <div className="irm-widget-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 className="irm-widget-title">Today's Assigned Leads</h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  {todayLeads.length} Today
                </span>
              </div>
              <p className="irm-widget-subtitle">
                Leads assigned to you today ({todayDateLabel}) • Older leads available in All Leads
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('all-leads')}>
              View All Leads <ArrowRight size={13} />
            </button>
          </div>

          <div className="irm-followups-list">
            {todayLeads.slice(0, 5).map(lead => {
              const salesAgent = getAssigningSalesAgentInfo(lead);
              return (
                <div key={lead.id} className="irm-followup-row">
                  <div className="irm-followup-info">
                    <div className="irm-followup-top">
                      <span className="irm-followup-name">{lead.name}</span>
                      <StatusChip status={lead.status} size="sm" />
                      {lead.priority && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            background:
                              lead.priority.toLowerCase() === 'high' || lead.priority.toLowerCase() === 'urgent'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(59, 130, 246, 0.15)',
                            color:
                              lead.priority.toLowerCase() === 'high' || lead.priority.toLowerCase() === 'urgent'
                                ? '#ef4444'
                                : '#3b82f6',
                          }}
                        >
                          {lead.priority}
                        </span>
                      )}
                    </div>
                    <div className="irm-td-sub" style={{ marginTop: 2 }}>
                      📞 {lead.phone} {lead.location ? `• 📍 ${lead.location}` : ''}
                    </div>
                    <div className="irm-followup-due" style={{ color: 'var(--text-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                      <span>👤 Assigned by:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{salesAgent.name}</strong>
                      <span className={`badge-role-inline ${salesAgent.badgeClass}`}>
                        {salesAgent.role}
                      </span>
                      <span>• 🕒 {formatLeadTime(lead.assignedIrmAt || (lead as any).assignedAt || lead.createdAt)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn btn-call btn-sm irm-action-call-btn"
                      title={`Dial ${lead.name}`}
                      onClick={() => initiateCall(lead.name, lead.phone, 'lead', lead.id, undefined, 'my_leads')}
                    >
                      <Phone size={12} /> Call
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      title="Open in My Leads"
                      onClick={() => onNavigate('leads')}
                    >
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}

            {todayLeads.length === 0 && (
              <div className="irm-empty-box">
                <Clock size={28} color="var(--text-muted)" />
                <p>No new leads assigned today yet.</p>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  When sales agents assign leads to you today, they will appear here in real time.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Follow-ups & Consultations */}
        <div className="card irm-widget-card">
          <div className="irm-widget-header">
            <div className="irm-tab-toggle">
              <button
                className={`irm-toggle-btn ${scheduleTab === 'followups' ? 'active' : ''}`}
                onClick={() => setScheduleTab('followups')}
              >
                <Calendar size={13} /> Follow-ups ({dueFollowups.length})
              </button>
              <button
                className={`irm-toggle-btn ${scheduleTab === 'consultations' ? 'active' : ''}`}
                onClick={() => setScheduleTab('consultations')}
              >
                <CalendarCheck size={13} /> Consultations ({scopedConsultations.length})
              </button>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate(scheduleTab === 'followups' ? 'followups' : 'consultations')}
            >
              View All <ArrowRight size={13} />
            </button>
          </div>

          {scheduleTab === 'followups' ? (
            <div className="irm-followups-list">
              {dueFollowups.slice(0, 5).map(f => (
                <div key={f.id} className="irm-followup-row">
                  <div className="irm-followup-info">
                    <div className="irm-followup-top">
                      <span className="irm-followup-name">{f.contactName}</span>
                      <StatusChip status={f.priority} size="sm" />
                    </div>
                    <p className="irm-followup-notes">{f.notes || 'Scheduled touchpoint'}</p>
                    <div className="irm-followup-due">
                      ⏰ Due: <strong>{formatSmartScheduleDate(f.scheduledAt)}</strong>
                    </div>
                  </div>
                  <button
                    className="btn btn-call btn-sm irm-action-call-btn"
                    onClick={() => initiateCall(f.contactName, f.contactPhone, (f.contactType as any) || 'customer', f.contactId, f.id, 'follow_up')}
                  >
                    <Phone size={12} /> Call
                  </button>
                </div>
              ))}

              {dueFollowups.length === 0 && (
                <div className="irm-empty-box">
                  <CheckCircle2 size={28} color="#10b981" />
                  <p>No follow-ups due today. You are completely caught up!</p>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {pendingFollowups.length > 0
                      ? `${pendingFollowups.length} upcoming follow-up${pendingFollowups.length > 1 ? 's' : ''} scheduled for later dates.`
                      : 'When new follow-ups are scheduled for today, they will appear here.'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="irm-followups-list">
              {scopedConsultations.slice(0, 5).map(c => (
                <div key={c.id} className="irm-followup-row">
                  <div className="irm-followup-info">
                    <div className="irm-followup-top">
                      <span className="irm-followup-name">{c.investorName}</span>
                      <StatusChip status={c.status} size="sm" />
                      {c.referredByAgentName && (
                        <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                          • Sent by {c.referredByAgentName}
                        </span>
                      )}
                    </div>
                    <p className="irm-followup-notes">{c.agenda || 'Advisory session'}</p>
                    <div className="irm-followup-due">
                      📅 Scheduled: <strong>{formatSmartScheduleDate(c.scheduledAt)}</strong>
                    </div>
                  </div>
                  <button
                    className="btn btn-call btn-sm irm-action-call-btn"
                    onClick={() => initiateCall(c.investorName, c.investorPhone, 'customer', c.investorId)}
                  >
                    <Phone size={12} /> Call
                  </button>
                </div>
              ))}

              {scopedConsultations.length === 0 && (
                <div className="irm-empty-box">
                  <CalendarCheck size={28} color="var(--text-muted)" />
                  <p>No upcoming advisory consultations scheduled.</p>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    When sales agents refer customer consultations, they will appear here.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
