import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Headphones,
  Users,
  Briefcase,
  Globe,
  Camera,
  Image,
  X,
  Search,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { leadsApi, callsApi, followupsApi, profileApi } from '../../services/crmApi';
import { Drawer } from '../../components/common/Drawer';
import { LeadDetailDrawerContent } from '../../components/common/LeadDetailDrawerContent';
import { StatusChip } from '../../components/common/StatusChip';
import { CallRecord, Lead, Followup } from '../../types';
import './ProfilePage.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
};

const fmtAvgDuration = (secs: number) => {
  if (!secs) return '0m 0s';
  return fmtDuration(Math.round(secs));
};

const formatCallDateTime = (ts?: string): string => {
  if (!ts) return '—';
  const parsed = Date.parse(ts);
  if (isNaN(parsed)) return '—';
  return new Date(parsed).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getInitials = (name?: string): string => {
  const clean = (name || '').trim();
  if (!clean || clean === '—') return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

type StatViewKey =
  | 'total-calls'
  | 'inbound'
  | 'outbound'
  | 'avg-duration'
  | 'converted'
  | 'conv-rate'
  | 'total-leads'
  | 'active-leads'
  | 'pending-followups';

interface StatPerson {
  key: string;
  name: string;
  phone: string;
  contactId?: string;
  callCount?: number;
  totalDuration?: number;
  latestTimestamp?: string;
  latestDisposition?: string;
  location?: string;
  leadStatus?: string;
  createdAt?: string;
  pendingCount?: number;
  earliestScheduledAt?: string;
}

const GaugeBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="profile-gauge-item">
    <div className="profile-gauge-header">
      <span className="profile-gauge-label">{label}</span>
      <span className="profile-gauge-pct">{value}%</span>
    </div>
    <div className="profile-gauge-track">
      <div className="profile-gauge-fill" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
    </div>
  </div>
);

// Preset banner gradients
const BANNER_PRESETS = [
  { label: 'Aurora', css: 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 40%, #7c3aed 80%, #db2777 100%)' },
  { label: 'Sunset', css: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #7c3aed 100%)' },
  { label: 'Ocean', css: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 50%, #1e1b4b 100%)' },
  { label: 'Forest', css: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #34d399 100%)' },
  { label: 'Midnight', css: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)' },
  { label: 'Rose Gold', css: 'linear-gradient(135deg, #7f1d1d 0%, #be185d 40%, #f9a8d4 100%)' },
];

// LocalStorage keys for avatar/banner
const AVATAR_KEY = 'nexus_profile_avatar';
const BANNER_KEY = 'nexus_profile_banner';

// Statuses counted as "Active" leads
const ACTIVE_LEAD_STATUSES = ['Follow-up Required', 'Contacted'];

type Tab = 'overview' | 'performance' | 'edit';

// ── Main Component ────────────────────────────────────────────────────────────
export const ProfilePage: React.FC = () => {
  const { user, tenant, setUser } = useAuth();
  const { availability, initiateCall } = useCall();

  const [tab, setTab] = useState<Tab>('overview');

  // ── Clickable stats drawer state ──────────────────────────────────────────
  const [statView, setStatView] = useState<StatViewKey | null>(null);
  const [statSearch, setStatSearch] = useState('');
  const [statPerson, setStatPerson] = useState<StatPerson | null>(null);

  const handleCloseDrawer = () => {
    setStatView(null);
    setStatSearch('');
    setStatPerson(null);
  };

  const handleStatClick = (key: StatViewKey) => {
    setStatView(key);
    setStatSearch('');
    setStatPerson(null);
  };

  // ── Avatar & banner customization ─────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem(AVATAR_KEY));
  const [bannerStyle, setBannerStyle] = useState<string>(() =>
    localStorage.getItem(BANNER_KEY) || BANNER_PRESETS[0].css
  );
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setAvatarUrl(url);
      localStorage.setItem(AVATAR_KEY, url);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBannerImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      const css = `url("${url}") center/cover no-repeat`;
      setBannerStyle(css);
      localStorage.setItem(BANNER_KEY, css);
      setShowBannerPicker(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const selectBannerPreset = (css: string) => {
    setBannerStyle(css);
    localStorage.setItem(BANNER_KEY, css);
    setShowBannerPicker(false);
  };

  // ── Live data from API ───────────────────────────────────────────────────
  const [allCalls, setAllCalls] = useState<CallRecord[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [allFollowups, setAllFollowups] = useState<Followup[]>([]);

  useEffect(() => {
    let isMounted = true;
    const emptyPaged = { items: [], totalCount: 0, page: 1, pageSize: 100, totalPages: 0 };
    Promise.all([
      callsApi.getCalls({ pageSize: 100 }).catch(() => emptyPaged),
      leadsApi.getActiveLeads({ pageSize: 100 }).catch(() => emptyPaged),
      followupsApi.getFollowups({ pageSize: 100 }).catch(() => emptyPaged),
    ]).then(([callsRes, leadsRes, fwRes]) => {
      if (!isMounted) return;
      if (callsRes?.items) {
        const raw = callsRes.items;
        setAllCalls(raw.map((c: any) => ({
          id: String(c.id),
          tenantId: String(tenant?.id || ''),
          companyId: String(tenant?.id || ''),
          contactName: c.contactName || '',
          contactPhone: c.contactPhone || '',
          agentId: String(c.agentId || ''),
          agentName: c.agentName || '',
          direction: (c.direction || 'outbound').toLowerCase() as any,
          duration: Number(c.duration || 0),
          disposition: c.disposition || 'Interested',
          timestamp: c.timestamp || new Date().toISOString(),
          notes: c.notes || '',
        })));
      }
      if (leadsRes?.items) {
        const raw = leadsRes.items;
        setAllLeads(raw.map((l: any) => ({
          id: String(l.id),
          tenantId: String(tenant?.id || ''),
          companyId: String(tenant?.id || ''),
          name: l.name || '',
          phone: l.phone || '',
          email: l.email || '',
          location: l.location || '',
          status: l.status || 'New',
          priority: l.priority || 'Medium',
          source: l.source || 'Direct',
          assignedAgentId: String(l.assignedAgentId || ''),
          assignedAgentName: l.assignedAgentName || '',
          notes: l.notes || '',
          customFields: l.customFields || {},
          createdAt: l.createdAt || new Date().toISOString(),
        })));
      }
      if (fwRes?.items) {
        const raw = fwRes.items;
        setAllFollowups(raw.map((f: any) => ({
          id: String(f.id),
          tenantId: String(tenant?.id || ''),
          companyId: String(tenant?.id || ''),
          contactName: f.contactName || '',
          contactPhone: f.contactPhone || '',
          contactType: f.contactType || 'lead',
          contactId: f.contactId ? String(f.contactId) : '',
          assignedAgentId: String(f.assignedAgentId || ''),
          assignedAgentName: f.assignedAgentName || '',
          scheduledAt: f.scheduledAt || '',
          notes: f.notes || '',
          priority: f.priority || 'Medium',
          status: f.status || 'Pending',
        })));
      }
    });
    return () => { isMounted = false; };
  }, [tenant?.id]);

  const myCalls = useMemo(
    () => allCalls.filter(c => c.agentId === user?.id || c.agentName === user?.name),
    [allCalls, user]
  );
  const myLeads = useMemo(
    () => allLeads.filter(l => l.assignedAgentId === user?.id || l.assignedAgentName === user?.name),
    [allLeads, user]
  );
  const myFollowups = useMemo(
    () => allFollowups.filter(f => f.assignedAgentId === user?.id || f.assignedAgentName === user?.name),
    [allFollowups, user]
  );

  // ── KPI Metrics ───────────────────────────────────────────────────────────
  const totalCalls = myCalls.length;
  const inboundCalls = myCalls.filter(c => c.direction === 'inbound').length;
  const outboundCalls = myCalls.filter(c => c.direction === 'outbound').length;
  const avgDuration = totalCalls ? myCalls.reduce((s, c) => s + c.duration, 0) / totalCalls : 0;

  // Deduped total leads: 1 row per unique phone (fallback: name)
  const dedupedLeads = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof myLeads = [];
    // Prefer most recently created lead per phone
    const sorted = [...myLeads].sort((a, b) => {
      const ta = Date.parse(a.createdAt || '') || 0;
      const tb = Date.parse(b.createdAt || '') || 0;
      return tb - ta;
    });
    for (const l of sorted) {
      const digits = (l.phone || '').replace(/\D/g, '').slice(-10);
      const key = digits || (l.name || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(l);
    }
    return result;
  }, [myLeads]);

  const totalLeadsCount = dedupedLeads.length;
  // Unique customers with Interested disposition calls
  const interestedContactKeys = useMemo(() => {
    const keys = new Set<string>();
    myCalls.filter(c => c.disposition === 'Interested').forEach(c => {
      const digits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
      const key = digits || (c.contactName || '').trim().toLowerCase();
      if (key) keys.add(key);
    });
    return keys;
  }, [myCalls]);
  const convertedCalls = interestedContactKeys.size;
  const interestedCalls = myCalls.filter(c => c.disposition === 'Interested').length;
  const conversionRate = totalCalls ? Math.round((convertedCalls / totalCalls) * 100) : 0;
  const activeLeads = dedupedLeads.filter(l => ACTIVE_LEAD_STATUSES.includes(l.status)).length;
  const convertedLeads = myLeads.filter(l => l.status === 'Converted').length;
  const pendingFollowups = myFollowups.filter(f => f.status === 'Pending').length;
  const completedFollowups = myFollowups.filter(f => f.status === 'Completed').length;
  const followupCompletionRate = myFollowups.length
    ? Math.round((completedFollowups / myFollowups.length) * 100)
    : 0;

  // ── Stat Grouped Lists (Computed once per statView/data change) ───────────
  const { people, rawCount } = useMemo(() => {
    if (!statView) return { people: [] as StatPerson[], rawCount: 0 };

    if (
      statView === 'total-calls' ||
      statView === 'inbound' ||
      statView === 'outbound' ||
      statView === 'avg-duration' ||
      statView === 'converted' ||
      statView === 'conv-rate'
    ) {
      let sourceCalls = myCalls;
      if (statView === 'inbound') sourceCalls = myCalls.filter(c => c.direction === 'inbound');
      else if (statView === 'outbound') sourceCalls = myCalls.filter(c => c.direction === 'outbound');
      else if (statView === 'avg-duration') sourceCalls = myCalls.filter(c => (c.duration || 0) > 0);
      else if (statView === 'converted' || statView === 'conv-rate') {
        sourceCalls = myCalls.filter(c => c.disposition === 'Interested');
      }

      const total = sourceCalls.length;
      const groups = new Map<string, CallRecord[]>();

      sourceCalls.forEach(c => {
        const digits = (c.contactPhone || '').replace(/\D/g, '').slice(-10);
        const key = digits || (c.contactName || '').trim().toLowerCase() || c.id;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(c);
      });

      const personList: StatPerson[] = [];

      groups.forEach((calls, key) => {
        const sortedCalls = [...calls].sort((a, b) => {
          const ta = Date.parse(a.timestamp) || 0;
          const tb = Date.parse(b.timestamp) || 0;
          return tb - ta;
        });

        const latestCall = sortedCalls[0];
        const name = sortedCalls.find(c => (c.contactName || '').trim())?.contactName || latestCall.contactName || '—';
        const phone = sortedCalls.find(c => (c.contactPhone || '').trim())?.contactPhone || latestCall.contactPhone || '—';
        const rawContactId = latestCall.leadId || latestCall.customerId || latestCall.investorId || latestCall.contactId;
        const contactId = (rawContactId && rawContactId !== 'contact-new') ? rawContactId : undefined;
        const totalDuration = sortedCalls.reduce((s, c) => s + (c.duration || 0), 0);

        personList.push({
          key,
          name,
          phone,
          contactId,
          callCount: sortedCalls.length,
          totalDuration,
          latestTimestamp: latestCall.timestamp,
          latestDisposition: latestCall.disposition,
        });
      });

      if (statView === 'avg-duration') {
        personList.sort((a, b) => (b.totalDuration || 0) - (a.totalDuration || 0));
      } else {
        personList.sort((a, b) => {
          const ta = Date.parse(a.latestTimestamp || '') || 0;
          const tb = Date.parse(b.latestTimestamp || '') || 0;
          return tb - ta;
        });
      }

      return { people: personList, rawCount: total };
    }

    if (statView === 'total-leads' || statView === 'active-leads') {
      const sourceLeads = statView === 'active-leads'
        ? dedupedLeads.filter(l => ACTIVE_LEAD_STATUSES.includes(l.status))
        : dedupedLeads;

      const total = sourceLeads.length;

      const personList: StatPerson[] = sourceLeads.map((l: Lead, idx: number) => {
        const contactId = (l.id && l.id !== 'contact-new') ? l.id : undefined;
        return {
          key: l.id || `lead-${idx}`,
          name: (l.name || '').trim() || '—',
          phone: (l.phone || '').trim() || '—',
          contactId,
          location: l.location,
          leadStatus: l.status,
          createdAt: l.createdAt,
        };
      });

      personList.sort((a, b) => {
        const ta = Date.parse(a.createdAt || '') || 0;
        const tb = Date.parse(b.createdAt || '') || 0;
        return tb - ta;
      });

      return { people: personList, rawCount: total };
    }

    if (statView === 'pending-followups') {
      const sourceFollowups = myFollowups.filter(f => f.status === 'Pending');
      const total = sourceFollowups.length;
      const groups = new Map<string, Followup[]>();

      sourceFollowups.forEach(f => {
        const digits = (f.contactPhone || '').replace(/\D/g, '').slice(-10);
        const key = digits || (f.contactName || '').trim().toLowerCase() || f.id;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(f);
      });

      const personList: StatPerson[] = [];

      groups.forEach((fups, key) => {
        const sortedFups = [...fups].sort((a, b) => {
          const ta = Date.parse(a.scheduledAt || '') || Number.MAX_SAFE_INTEGER;
          const tb = Date.parse(b.scheduledAt || '') || Number.MAX_SAFE_INTEGER;
          return ta - tb;
        });

        const earliestFup = sortedFups[0];
        const name = sortedFups.find(f => (f.contactName || '').trim())?.contactName || earliestFup.contactName || '—';
        const phone = sortedFups.find(f => (f.contactPhone || '').trim())?.contactPhone || earliestFup.contactPhone || '—';
        const rawContactId = sortedFups.find(f => f.contactId && f.contactId !== 'contact-new')?.contactId;
        const contactId = rawContactId || undefined;

        personList.push({
          key,
          name,
          phone,
          contactId,
          pendingCount: sortedFups.length,
          earliestScheduledAt: earliestFup.scheduledAt,
        });
      });

      personList.sort((a, b) => {
        const ta = Date.parse(a.earliestScheduledAt || '') || Number.MAX_SAFE_INTEGER;
        const tb = Date.parse(b.earliestScheduledAt || '') || Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });

      return { people: personList, rawCount: total };
    }

    return { people: [] as StatPerson[], rawCount: 0 };
  }, [statView, myCalls, myLeads, myFollowups]);

  const filteredPeople = useMemo(() => {
    const q = statSearch.trim().toLowerCase();
    if (!q) return people;
    const qDigits = q.replace(/\D/g, '');
    return people.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const phoneMatch = (p.phone || '').toLowerCase().includes(q);
      const digitsMatch = Boolean(qDigits && (p.phone || '').replace(/\D/g, '').includes(qDigits));
      return nameMatch || phoneMatch || digitsMatch;
    });
  }, [people, statSearch]);

  const drawerTitle = useMemo(() => {
    switch (statView) {
      case 'inbound':
        return 'Inbound Calls';
      case 'outbound':
        return 'Outbound Calls';
      case 'total-calls':
        return 'Total Calls';
      case 'avg-duration':
        return 'Avg Duration — Talk Time';
      case 'converted':
      case 'conv-rate':
        return 'Converted Calls';
      case 'total-leads':
        return 'Total Leads';
      case 'active-leads':
        return 'Active Leads';
      case 'pending-followups':
        return 'Pending Follow-ups';
      default:
        return 'Call Stats';
    }
  }, [statView]);

  const drawerSubtitle = useMemo(() => {
    const peopleCount = people.length;
    const peopleStr = `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`;
    if (
      statView === 'total-calls' ||
      statView === 'inbound' ||
      statView === 'outbound' ||
      statView === 'avg-duration' ||
      statView === 'converted' ||
      statView === 'conv-rate'
    ) {
      const callsStr = `${rawCount} ${rawCount === 1 ? 'call' : 'calls'}`;
      return `${callsStr} · ${peopleStr}`;
    }
    if (statView === 'total-leads' || statView === 'active-leads') {
      const leadsStr = `${rawCount} ${rawCount === 1 ? 'lead' : 'leads'}`;
      return `${leadsStr} · ${peopleStr}`;
    }
    if (statView === 'pending-followups') {
      return `${rawCount} pending · ${peopleStr}`;
    }
    return `${rawCount} items · ${peopleStr}`;
  }, [statView, rawCount, people.length]);

  // ── Disposition breakdown ─────────────────────────────────────────────────
  const dispoColors: Record<string, string> = {
    'Interested': '#10b981', 'Converted': '#2563eb',
    'Follow-up Required': '#f59e0b', 'Call Back': '#8b5cf6',
    'Not Interested': '#ef4444', 'Wrong Number': '#64748b', 'No Response': '#94a3b8',
  };

  const dispoBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    myCalls.forEach(c => { counts[c.disposition] = (counts[c.disposition] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, color: dispoColors[name] || '#64748b' }));
  }, [myCalls]);

  const maxDispo = dispoBreakdown[0]?.count || 1;

  // ── Edit form state — SEPARATE save flags per section ─────────────────────
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editDesignation, setEditDesignation] = useState(user?.designation || '');
  const [personalSaved, setPersonalSaved] = useState(false);

  const [editSkills, setEditSkills] = useState((user?.skills || []).join(', '));
  const [editLanguages, setEditLanguages] = useState((user?.languages || []).join(', '));
  const [editSpecializations, setEditSpecializations] = useState((user?.specializations || []).join(', '));
  const [skillsSaved, setSkillsSaved] = useState(false);

  const [editWorkStart, setEditWorkStart] = useState(user?.workingHours?.start || '09:00');
  const [editWorkEnd, setEditWorkEnd] = useState(user?.workingHours?.end || '18:00');
  const [editMaxLeads, setEditMaxLeads] = useState(String(user?.maxActiveLeads || 50));
  const [hoursSaved, setHoursSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditPhone(user.phone);
      setEditDesignation(user.designation || '');
      setEditSkills((user.skills || []).join(', '));
      setEditLanguages((user.languages || []).join(', '));
      setEditSpecializations((user.specializations || []).join(', '));
      setEditWorkStart(user.workingHours?.start || '09:00');
      setEditWorkEnd(user.workingHours?.end || '18:00');
      setEditMaxLeads(String(user.maxActiveLeads || 50));
    }

    profileApi.getProfile().then(p => {
      if (!p) return;
      if (p.name) setEditName(p.name);
      if (p.phone) setEditPhone(p.phone);
      if (p.designation) setEditDesignation(p.designation);
      if (p.skills?.length) setEditSkills(p.skills.join(', '));
      if (p.languages?.length) setEditLanguages(p.languages.join(', '));
      if (p.specializations?.length) setEditSpecializations(p.specializations.join(', '));
      if (p.maxActiveLeads) setEditMaxLeads(String(p.maxActiveLeads));
    }).catch(() => { });
  }, [user?.id]);

  const savePersonal = async () => {
    if (!user) return;
    const updated = { ...user, name: editName, phone: editPhone, designation: editDesignation };
    setUser(updated);
    setPersonalSaved(true);
    setTimeout(() => setPersonalSaved(false), 2200);
    try {
      await profileApi.updateProfile({ name: editName, phone: editPhone, designation: editDesignation });
    } catch { }
  };

  const saveSkills = async () => {
    if (!user) return;
    const sArr = editSkills.split(',').map(s => s.trim()).filter(Boolean);
    const lArr = editLanguages.split(',').map(s => s.trim()).filter(Boolean);
    const spArr = editSpecializations.split(',').map(s => s.trim()).filter(Boolean);
    const updated = {
      ...user,
      skills: sArr,
      languages: lArr,
      specializations: spArr,
    };
    setUser(updated);
    setSkillsSaved(true);
    setTimeout(() => setSkillsSaved(false), 2200);
    try {
      await profileApi.updateProfile({ skills: sArr, languages: lArr, specializations: spArr });
    } catch { }
  };

  const saveHours = async () => {
    if (!user) return;
    const maxVal = parseInt(editMaxLeads) || 50;
    const updated = {
      ...user,
      maxActiveLeads: maxVal,
      workingHours: { start: editWorkStart, end: editWorkEnd, days: user.workingHours?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
    };
    setUser(updated);
    setHoursSaved(true);
    setTimeout(() => setHoursSaved(false), 2200);
    try {
      await profileApi.updateProfile({
        workingHours: `${editWorkStart} - ${editWorkEnd}`,
        maxActiveLeads: maxVal,
      });
    } catch { }
  };

  // ── Static enrichment data ────────────────────────────────────────────────
  const skills = user?.skills?.length ? user.skills : ['Lead Qualification', 'CRM Management', 'Cold Calling', 'Objection Handling', 'Deal Closing'];
  const languages = user?.languages?.length ? user.languages : ['English', 'Hindi', 'Kannada'];
  const specializations = user?.specializations?.length ? user.specializations : ['Residential Real Estate', 'High-Value Investors', 'NRI Clients'];
  const workDays = user?.workingHours?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const designation = user?.designation || (user?.role?.code === 'sales_executive' ? 'Sales Executive' : user?.role?.name || 'Agent');
  const employeeCode = user?.employeeCode || `EMP-${user?.id?.slice(-4).toUpperCase() || '0001'}`;
  const joinedAt = user?.joinedAt || user?.createdAt || '2024-01-15';
  const routingPriority = user?.routingPriority || 2;
  const maxLeads = user?.maxActiveLeads || 50;

  const initials = (user?.name || 'Agent')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const availStatusClass = availability === 'Available' ? 'available' : availability === 'Busy' ? 'busy' : 'offline';

  // ── Recent activity ───────────────────────────────────────────────────────
  const recentActivity = useMemo(() => {
    const sorted = [...myCalls]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
    if (!sorted.length) return [{
      icon: <Activity size={14} />, bgColor: 'rgba(100,116,139,0.12)',
      title: 'No recent call activity', sub: 'Start making or receiving calls to see activity here.',
    }];
    return sorted.map(c => {
      const isIn = c.direction === 'inbound';
      return {
        icon: isIn ? <PhoneIncoming size={14} /> : <PhoneOutgoing size={14} />,
        bgColor: isIn ? 'rgba(16,185,129,0.12)' : 'rgba(37,99,235,0.12)',
        title: `${isIn ? 'Inbound' : 'Outbound'} — ${c.contactName}`,
        sub: `${fmtDuration(c.duration)} · ${c.disposition} · ${new Date(c.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`,
      };
    });
  }, [myCalls]);

  // ── Certifications ────────────────────────────────────────────────────────
  const certs = [
    { name: 'Certified Sales Professional (CSP)', issuer: 'Sales & Marketing Assoc.', date: '2024-03-10', color: '#2563eb' },
    { name: 'Call Center Excellence Badge', issuer: 'Nexus Platform', date: '2025-01-20', color: '#7c3aed' },
    { name: 'Real Estate Fundamentals', issuer: 'RERA Board', date: '2023-11-05', color: '#059669' },
    { name: 'CRM Power User', issuer: `Internal — ${tenant?.name || 'Company'}`, date: '2025-06-01', color: '#d97706' },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="profile-page">
      {/* Hidden file inputs */}
      <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
      <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerImageChange} />

      {/* ── Hero Banner ── */}
      <div className="profile-hero">
        {/* Clickable banner */}
        <div
          className="profile-hero-banner"
          style={{ background: bannerStyle }}
          onClick={() => setShowBannerPicker(v => !v)}
          title="Click to change banner"
        >
          <div className="profile-banner-edit-hint">
            <Image size={14} /> Change Banner
          </div>

          {/* Banner picker overlay */}
          {showBannerPicker && (
            <div className="profile-banner-picker" onClick={e => e.stopPropagation()}>
              <div className="profile-banner-picker-header">
                <span>Choose a banner</span>
                <button className="profile-banner-picker-close" onClick={() => setShowBannerPicker(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="profile-banner-presets">
                {BANNER_PRESETS.map(p => (
                  <div
                    key={p.label}
                    className="profile-banner-preset-swatch"
                    style={{ background: p.css }}
                    title={p.label}
                    onClick={() => selectBannerPreset(p.css)}
                  >
                    <span className="profile-banner-preset-label">{p.label}</span>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => { bannerInputRef.current?.click(); }}
              >
                <Image size={13} /> Upload Custom Image
              </button>
            </div>
          )}
        </div>

        <div className="profile-hero-body">
          {/* Clickable avatar */}
          <div className="profile-avatar-wrap" onClick={() => avatarInputRef.current?.click()} title="Click to change photo">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="profile-avatar profile-avatar-img" />
            ) : (
              <div className="profile-avatar">{initials}</div>
            )}
            <div className={`profile-avatar-status ${availStatusClass}`} />
            <div className="profile-avatar-camera-hint">
              <Camera size={14} />
            </div>
          </div>

          {/* Identity */}
          <div className="profile-hero-info">
            <h1 className="profile-name">{user?.name || 'Sales Agent'}</h1>
            <div className="profile-designation">
              <span className="profile-role-badge"><Shield size={11} /> {user?.role?.name || 'Agent'}</span>
              <span>{designation}</span>
            </div>
            <div className="profile-meta-row">
              <span className="profile-meta-item"><Briefcase size={12} /><strong>{employeeCode}</strong></span>
              <span className="profile-meta-item"><Mail size={12} /><strong>{user?.email}</strong></span>
              <span className="profile-meta-item"><Phone size={12} /><strong>{user?.phone}</strong></span>
              <span className="profile-meta-item"><MapPin size={12} /><strong>{tenant?.city || tenant?.name || 'Bengaluru'}</strong></span>
              <span className="profile-meta-item">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: availability === 'Available' ? '#10b981' : availability === 'Busy' ? '#f59e0b' : '#64748b' }} />
                <strong>{availability}</strong>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="profile-hero-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setTab('edit')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit3 size={14} /> Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="profile-tab-bar">
          {([
            { id: 'overview', label: 'Overview', icon: <User size={13} /> },
            { id: 'performance', label: 'Performance', icon: <BarChart2 size={13} /> },
            { id: 'edit', label: 'Edit Profile', icon: <Edit3 size={13} /> },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.id}
              id={`profile-tab-${t.id}`}
              className={`profile-tab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: OVERVIEW — 3-column layout
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="profile-overview-3col">

          {/* ── Col 1: Personal + Shift ── */}
          <div className="profile-col-stack">
            <div className="profile-card">
              <div className="profile-card-title"><User size={14} /> Personal Details</div>
              <div className="profile-info-rows">
                {[
                  { icon: <Mail size={14} />, label: 'Email', val: user?.email },
                  { icon: <Phone size={14} />, label: 'Phone', val: user?.phone },
                  { icon: <Briefcase size={14} />, label: 'Designation', val: designation },
                  { icon: <Calendar size={14} />, label: 'Joined', val: new Date(joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) },
                  { icon: <Globe size={14} />, label: 'Company', val: tenant?.name || user?.companyName },
                  { icon: <Clock size={14} />, label: 'Last Active', val: user?.lastLogin || 'Just now' },
                ].map(row => (
                  <div key={row.label} className="profile-info-row">
                    <div className="profile-info-icon">{row.icon}</div>
                    <div>
                      <div className="profile-info-label">{row.label}</div>
                      <div className="profile-info-value">{row.val || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="profile-card">
              <div className="profile-card-title"><Clock size={14} /> Shift & Capacity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={14} color="var(--primary-600)" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {user?.workingHours?.start || '09:00'} – {user?.workingHours?.end || '18:00'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>IST</span>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Working Days</div>
                  <div className="profile-shift-days">
                    {allDays.map(d => (
                      <div key={d} className={`profile-shift-day ${workDays.includes(d) ? 'active' : 'off'}`}>{d.slice(0, 2)}</div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Max Leads: <strong style={{ color: 'var(--text-primary)' }}>{maxLeads}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Priority: <strong style={{ color: 'var(--primary-600)' }}>P{routingPriority}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Col 2: KPI stats + Skills ── */}
          <div className="profile-col-stack">
            <div className="profile-card">
              <div className="profile-card-title"><PhoneCall size={14} /> My Call Stats (All Time)</div>
              <div className="profile-kpi-grid">
                {[
                  { id: 'total-calls' as const, icon: <PhoneCall size={16} />, val: totalCalls, label: 'Total Calls', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
                  { id: 'inbound' as const, icon: <PhoneIncoming size={16} />, val: inboundCalls, label: 'Inbound', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                  { id: 'outbound' as const, icon: <PhoneOutgoing size={16} />, val: outboundCalls, label: 'Outbound', color: '#7c3aed', bg: 'rgba(139,92,246,0.1)' },
                  { id: 'avg-duration' as const, icon: <Clock size={16} />, val: fmtAvgDuration(avgDuration), label: 'Avg Duration', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                  { id: 'converted' as const, icon: <CheckCircle size={16} />, val: convertedCalls, label: 'Converted Calls', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                  { id: 'conv-rate' as const, icon: <TrendingUp size={16} />, val: `${conversionRate}%`, label: 'Conv. Rate', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
                ].map(k => (
                  <div
                    key={k.label}
                    className="profile-kpi-box profile-stat-clickable"
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${k.label}`}
                    onClick={() => handleStatClick(k.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStatClick(k.id);
                      }
                    }}
                  >
                    <div className="profile-kpi-icon" style={{ background: k.bg, color: k.color }}>{k.icon}</div>
                    <div className="profile-kpi-value">{k.val}</div>
                    <div className="profile-kpi-label">{k.label}</div>
                  </div>
                ))}
              </div>

              <div className="profile-divider" />

              <div className="profile-kpi-grid">
                {[
                  { id: 'total-leads' as const, icon: <Users size={16} />, val: totalLeadsCount, label: 'Total Leads', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
                  { id: 'active-leads' as const, icon: <Star size={16} />, val: activeLeads, label: 'Active Leads', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                  { id: 'pending-followups' as const, icon: <Calendar size={16} />, val: pendingFollowups, label: 'Pending F/ups', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                ].map(k => (
                  <div
                    key={k.label}
                    className="profile-kpi-box profile-stat-clickable"
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${k.label}`}
                    onClick={() => handleStatClick(k.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStatClick(k.id);
                      }
                    }}
                  >
                    <div className="profile-kpi-icon" style={{ background: k.bg, color: k.color }}>{k.icon}</div>
                    <div className="profile-kpi-value">{k.val}</div>
                    <div className="profile-kpi-label">{k.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="profile-card">
              <div className="profile-card-title"><Zap size={14} /> Skills</div>
              <div className="profile-tags-wrap">
                {skills.map(s => <span key={s} className="profile-tag">{s}</span>)}
              </div>
              <div className="profile-card-title" style={{ marginTop: 4 }}><Globe size={14} /> Languages</div>
              <div className="profile-tags-wrap">
                {languages.map(l => <span key={l} className="profile-tag lang">{l}</span>)}
              </div>
              <div className="profile-card-title" style={{ marginTop: 4 }}><Star size={14} /> Specializations</div>
              <div className="profile-tags-wrap">
                {specializations.map(s => <span key={s} className="profile-tag spec">{s}</span>)}
              </div>
            </div>
          </div>

          {/* ── Col 3: Recent Activity + Certs ── */}
          <div className="profile-col-stack">
            <div className="profile-card">
              <div className="profile-card-title"><Activity size={14} /> Recent Activity</div>
              <div className="profile-timeline">
                {recentActivity.map((item, i) => (
                  <div key={i} className="profile-tl-item">
                    <div className="profile-tl-dot" style={{ background: item.bgColor }}>
                      {item.icon}
                    </div>
                    <div className="profile-tl-body">
                      <div className="profile-tl-title">{item.title}</div>
                      <div className="profile-tl-sub">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="profile-card">
              <div className="profile-card-title"><Award size={14} /> Certifications & Badges</div>
              <div className="profile-cert-list">
                {certs.map((c, i) => (
                  <div key={i} className="profile-cert-item">
                    <div className="profile-cert-icon" style={{ background: `${c.color}18`, color: c.color }}>
                      <Award size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="profile-cert-name">{c.name}</div>
                      <div className="profile-cert-date">{c.issuer} · {new Date(c.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>
                    </div>
                    <CheckCircle size={15} color="#10b981" style={{ flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: PERFORMANCE
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'performance' && (
        <div className="profile-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Monthly Targets */}
            <div className="profile-card">
              <div className="profile-card-title"><Target size={14} /> This Month's Targets</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { icon: <PhoneCall size={18} />, label: 'Calls Target', current: totalCalls, target: 200, color: '#2563eb' },
                  { icon: <TrendingUp size={18} />, label: 'Conversions Target', current: convertedCalls, target: 15, color: '#10b981' },
                  { icon: <Calendar size={18} />, label: 'Follow-ups Completed', current: completedFollowups, target: myFollowups.length || 1, color: '#f59e0b' },
                ].map(item => (
                  <div key={item.label} className="profile-target-row">
                    <div className="profile-target-icon" style={{ background: `${item.color}18`, color: item.color }}>{item.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div className="profile-target-label">{item.label}</div>
                      <div className="profile-target-value">{item.current} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>/ {item.target}</span></div>
                      <div className="profile-target-sub">{Math.round((item.current / item.target) * 100)}% achieved</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skill Proficiency */}
            <div className="profile-card">
              <div className="profile-card-title"><BarChart2 size={14} /> Skill Proficiency</div>
              <div className="profile-gauge-row">
                <GaugeBar label="Lead Qualification" value={88} color="#2563eb" />
                <GaugeBar label="Cold Calling" value={74} color="#7c3aed" />
                <GaugeBar label="Objection Handling" value={81} color="#059669" />
                <GaugeBar label="CRM Proficiency" value={92} color="#d97706" />
                <GaugeBar label="Product Knowledge" value={79} color="#db2777" />
                <GaugeBar label="Deal Closing" value={conversionRate || 65} color="#2563eb" />
              </div>
            </div>

            {/* Routing & Capacity */}
            <div className="profile-card">
              <div className="profile-card-title"><Headphones size={14} /> Routing & Capacity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Routing Priority', val: `P${routingPriority}`, color: 'var(--primary-600)' },
                  { label: 'Max Active Leads', val: String(maxLeads), color: 'var(--text-primary)' },
                  { label: 'Current Active Leads', val: String(activeLeads), color: activeLeads > maxLeads * 0.8 ? '#f59e0b' : '#10b981' },
                  { label: 'Capacity Used', val: `${maxLeads ? Math.round((activeLeads / maxLeads) * 100) : 0}%`, color: 'var(--text-primary)' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-base)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: row.color }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="profile-right-col">
            {/* Performance Scores */}
            <div className="profile-card">
              <div className="profile-card-title"><Star size={14} /> Performance Scores</div>
              <div className="profile-gauge-row">
                <GaugeBar label="Overall Performance" value={Math.min(Math.round((conversionRate + followupCompletionRate) / 2 + 30), 100)} color="linear-gradient(90deg,#2563eb,#7c3aed)" />
                <GaugeBar label="Call Conversion Rate" value={conversionRate} color="#10b981" />
                <GaugeBar label="Follow-up Completion" value={followupCompletionRate} color="#f59e0b" />
                <GaugeBar label="Customer Satisfaction (CSAT)" value={87} color="#6366f1" />
                <GaugeBar label="First Call Resolution (FCR)" value={72} color="#059669" />
                <GaugeBar label="Attendance & Punctuality" value={96} color="#db2777" />
              </div>
            </div>

            {/* Disposition Breakdown */}
            <div className="profile-card">
              <div className="profile-card-title"><BarChart2 size={14} /> Call Disposition Breakdown</div>
              {dispoBreakdown.length > 0 ? (
                <div className="profile-dispo-list">
                  {dispoBreakdown.map(d => (
                    <div key={d.name} className="profile-dispo-item">
                      <div className="profile-dispo-dot" style={{ background: d.color }} />
                      <span className="profile-dispo-name">{d.name}</span>
                      <span className="profile-dispo-count">{d.count}</span>
                      <div className="profile-dispo-bar-wrap">
                        <div className="profile-dispo-bar" style={{ width: `${Math.round((d.count / maxDispo) * 100)}%`, background: d.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No call data yet.</div>
              )}
            </div>

            {/* Lead Funnel */}
            <div className="profile-card">
              <div className="profile-card-title"><TrendingUp size={14} /> Lead Funnel</div>
              <div className="profile-dispo-list">
                {[
                  { label: 'Total Assigned', count: myLeads.length, color: '#6366f1' },
                  { label: 'Active / In-Progress', count: activeLeads, color: '#2563eb' },
                  { label: 'Interested (calls)', count: interestedCalls, color: '#10b981' },
                  { label: 'Converted', count: convertedLeads, color: '#059669' },
                  { label: 'Not Interested', count: myLeads.filter(l => l.status === 'Not Interested').length, color: '#ef4444' },
                ].map(item => (
                  <div key={item.label} className="profile-dispo-item">
                    <div className="profile-dispo-dot" style={{ background: item.color }} />
                    <span className="profile-dispo-name">{item.label}</span>
                    <span className="profile-dispo-count">{item.count}</span>
                    <div className="profile-dispo-bar-wrap">
                      <div className="profile-dispo-bar" style={{ width: myLeads.length ? `${Math.round((item.count / myLeads.length) * 100)}%` : '0%', background: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: EDIT PROFILE
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'edit' && (
        <div className="profile-edit-3col">

          {/* ── Personal Information ── */}
          <div className="profile-card">
            <div className="profile-card-title"><User size={14} /> Personal Information</div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your full name" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+91 98000 00000" />
            </div>
            <div className="form-group">
              <label className="form-label">Email <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(read-only)</span></label>
              <input className="form-input" value={user?.email || ''} readOnly style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input className="form-input" value={editDesignation} onChange={e => setEditDesignation(e.target.value)} placeholder="e.g. Senior Sales Executive" />
            </div>
            <button
              id="profile-save-personal-btn"
              className="btn btn-primary profile-save-btn"
              onClick={savePersonal}
              style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}
            >
              {personalSaved ? <CheckCircle size={15} /> : <Save size={15} />}
              {personalSaved ? 'Saved!' : 'Save Personal Info'}
            </button>
          </div>

          {/* ── Skills & Languages ── */}
          <div className="profile-card">
            <div className="profile-card-title"><Zap size={14} /> Skills & Languages</div>
            <div className="form-group">
              <label className="form-label">Skills <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(comma-separated)</span></label>
              <input className="form-input" value={editSkills} onChange={e => setEditSkills(e.target.value)} placeholder="e.g. Lead Qualification, Cold Calling" />
            </div>
            <div className="form-group">
              <label className="form-label">Languages <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(comma-separated)</span></label>
              <input className="form-input" value={editLanguages} onChange={e => setEditLanguages(e.target.value)} placeholder="e.g. English, Hindi" />
            </div>
            <div className="form-group">
              <label className="form-label">Specializations <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(comma-separated)</span></label>
              <input className="form-input" value={editSpecializations} onChange={e => setEditSpecializations(e.target.value)} placeholder="e.g. Real Estate, HNW Investors" />
            </div>
            <button
              id="profile-save-skills-btn"
              className="btn btn-primary profile-save-btn"
              onClick={saveSkills}
              style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}
            >
              {skillsSaved ? <CheckCircle size={15} /> : <Save size={15} />}
              {skillsSaved ? 'Saved!' : 'Save Skills & Languages'}
            </button>
          </div>

          {/* ── Working Hours & Capacity ── */}
          <div className="profile-card">
            <div className="profile-card-title"><Clock size={14} /> Working Hours & Capacity</div>
            <div className="form-group">
              <label className="form-label">Shift Start</label>
              <input className="form-input" type="time" value={editWorkStart} onChange={e => setEditWorkStart(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Shift End</label>
              <input className="form-input" type="time" value={editWorkEnd} onChange={e => setEditWorkEnd(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Active Leads</label>
              <input className="form-input" type="number" min="1" max="500" value={editMaxLeads} onChange={e => setEditMaxLeads(e.target.value)} />
            </div>
            <button
              id="profile-save-hours-btn"
              className="btn btn-primary profile-save-btn"
              onClick={saveHours}
              style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}
            >
              {hoursSaved ? <CheckCircle size={15} /> : <Save size={15} />}
              {hoursSaved ? 'Saved!' : 'Save Hours & Capacity'}
            </button>
          </div>
        </div>
      )}

      {/* ── Stat Person / Call Details Drawer ── */}
      <Drawer
        isOpen={statView !== null}
        onClose={handleCloseDrawer}
        title={statPerson ? (statPerson.name || '—') : drawerTitle}
        subtitle={statPerson ? `Phone: ${statPerson.phone || '—'} • ${tenant?.name || ''}` : drawerSubtitle}
        width={600}
      >
        {statPerson ? (
          <div className="profile-stat-person-view">
            <button
              type="button"
              className="btn btn-ghost btn-sm profile-stat-back-btn"
              onClick={() => setStatPerson(null)}
            >
              <ArrowLeft size={14} /> Back
            </button>
            <LeadDetailDrawerContent
              contactName={statPerson.name}
              contactPhone={statPerson.phone}
              contactId={statPerson.contactId}
              tenantId={tenant?.id}
              tenantName={tenant?.name}
              hideAutoNotes={true}
              onCall={() => initiateCall(statPerson.name, statPerson.phone)}
            />
          </div>
        ) : (
          <div className="profile-stat-drawer-body">
            <div className="profile-stat-search-wrap">
              <Search size={15} className="profile-stat-search-icon" />
              <input
                type="text"
                className="profile-stat-search-input"
                placeholder="Search by name or phone…"
                value={statSearch}
                onChange={e => setStatSearch(e.target.value)}
                autoFocus
              />
              {statSearch.length > 0 && (
                <button
                  type="button"
                  className="profile-stat-search-clear"
                  onClick={() => setStatSearch('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {statSearch.trim() !== '' && (
              <div className="profile-stat-search-meta">
                Showing {filteredPeople.length} of {people.length} people
              </div>
            )}

            {people.length === 0 ? (
              <div className="profile-stat-empty">
                {statView === 'total-leads' || statView === 'active-leads'
                  ? 'No leads yet.'
                  : statView === 'pending-followups'
                    ? 'No pending follow-ups.'
                    : 'No calls yet.'}
              </div>
            ) : filteredPeople.length === 0 ? (
              <div className="profile-stat-empty">
                No people match &ldquo;{statSearch}&rdquo;.
              </div>
            ) : (
              <div className="profile-stat-list">
                {filteredPeople.map(p => {
                  const isCallTile =
                    statView === 'total-calls' ||
                    statView === 'inbound' ||
                    statView === 'outbound' ||
                    statView === 'avg-duration' ||
                    statView === 'converted' ||
                    statView === 'conv-rate';
                  const isLeadTile = statView === 'total-leads' || statView === 'active-leads';
                  const isFollowupTile = statView === 'pending-followups';

                  return (
                    <div
                      key={p.key}
                      className="profile-stat-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => setStatPerson(p)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setStatPerson(p);
                        }
                      }}
                    >
                      <div className="profile-stat-row-left">
                        <div className="profile-stat-avatar">{getInitials(p.name)}</div>
                        <div className="profile-stat-person-info">
                          <div className="profile-stat-person-name">{p.name || '—'}</div>
                          <div className="profile-stat-person-meta">
                            <span>{p.phone || '—'}</span>
                            {isCallTile && (
                              <>
                                <span>•</span>
                                <span>{p.callCount} {p.callCount === 1 ? 'call' : 'calls'}</span>
                                <span>•</span>
                                <span>{fmtDuration(p.totalDuration || 0)}</span>
                              </>
                            )}
                            {isLeadTile && p.location && (
                              <>
                                <span>•</span>
                                <span>{p.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="profile-stat-person-right">
                        {isCallTile && (
                          <>
                            <span className="profile-stat-person-date">
                              {formatCallDateTime(p.latestTimestamp)}
                            </span>
                            <StatusChip status={p.latestDisposition || 'No Response'} size="sm" />
                          </>
                        )}
                        {isLeadTile && (
                          <StatusChip status={p.leadStatus || 'New'} size="sm" />
                        )}
                        {isFollowupTile && (
                          <span className="profile-stat-pending-badge">
                            {p.pendingCount} pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
