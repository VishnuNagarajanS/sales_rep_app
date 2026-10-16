import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  Radio,
  Server,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  Activity,
  Layers,
  Sparkles,
  Save,
  Check,
  Building2,
  Sliders,
  Play,
  RotateCcw,
  Mic,
  Volume2,
  BookOpen,
  Cpu,
  Wand2,
  Tag,
  Globe,
  Languages,
} from 'lucide-react';
import {
  TenantDidMapping,
  PlatformCarrierSettings,
  Tenant,
  SpeechVocabulary,
  SpeechKeywordBoost,
  PhoneticSubstitution,
  SimulateSpeechResult,
} from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { useUnsavedChanges } from '../../../context/NavigationGuardContext';
import { Modal } from '../../../components/common/Modal';
import './PlatformCallConfigPage.css';

export const PlatformCallConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dids' | 'carrier' | 'speech'>('dids');

  const [dids, setDids] = useState<TenantDidMapping[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [carrierSettings, setCarrierSettings] = useState<PlatformCarrierSettings>({
    primaryCarrier: '',
    secondaryCarrier: '',
    sipRealm: '',
    webrtcGatewayUrl: '',
    recordingRetentionDays: 0,
    maxConcurrentChannels: 0,
    emergencyRoutingEnabled: true,
    whisperAiModel: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavingCarrier, setIsSavingCarrier] = useState(false);

  // Modal State for DID Allocation
  const [isDidModalOpen, setIsDidModalOpen] = useState(false);
  const [editingDidId, setEditingDidId] = useState<string | null>(null);
  const [didPhone, setDidPhone] = useState('');
  const [didTenantId, setDidTenantId] = useState('');
  const [didRoutingStrategy, setDidRoutingStrategy] = useState<
    'Round-Robin' | 'Skill/Priority' | 'Least-Busy Rep' | 'Direct Extension'
  >('Round-Robin');
  const [didQueueName, setDidQueueName] = useState('');
  const [didEnableRecording, setDidEnableRecording] = useState(true);
  const [didEnableAiWhisper, setDidEnableAiWhisper] = useState(true);
  const [didChannels, setDidChannels] = useState(8);
  const [isSavingDid, setIsSavingDid] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // Speech AI Vocabulary State
  const [vocabularies, setVocabularies] = useState<SpeechVocabulary[]>([]);
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<string>('all');
  const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);
  const [editingVocabId, setEditingVocabId] = useState<string | null>(null);
  const [vocabName, setVocabName] = useState('');
  const [vocabKey, setVocabKey] = useState('');
  const [vocabLanguage, setVocabLanguage] = useState('Kannada / English-IN');
  const [vocabLangCode, setVocabLangCode] = useState('kn-IN');
  const [vocabEngine, setVocabEngine] = useState('Sarvam AI (Saarika) + Whisper Large-v3');
  const [vocabDesc, setVocabDesc] = useState('');
  const [vocabKeywords, setVocabKeywords] = useState<SpeechKeywordBoost[]>([]);
  const [vocabSubs, setVocabSubs] = useState<PhoneticSubstitution[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [newCategory, setNewCategory] = useState<'Land Metric' | 'Documentation' | 'Financial' | 'Location' | 'Legal'>('Land Metric');
  const [newWeight, setNewWeight] = useState(4.0);
  const [newPattern, setNewPattern] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [isSavingVocab, setIsSavingVocab] = useState(false);

  // Speech Simulation State
  const [simTranscript, setSimTranscript] = useState('');
  const [simResult, setSimResult] = useState<SimulateSpeechResult | null>(null);
  const [isSimulatingSpeech, setIsSimulatingSpeech] = useState(false);

  // Unsaved changes check
  useUnsavedChanges(
    isDidModalOpen && didPhone.trim() !== '',
    'You have unsaved changes in virtual DID allocation. Are you sure you want to leave?',
    'callconfig-page'
  );

  // Carrier Test state
  const [isTestingCarrier, setIsTestingCarrier] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);

  // Interactive Test Call Simulator state
  const [simulatedDid, setSimulatedDid] = useState('');
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Success Feedback
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [allDids, allTenants, carrier, vocabs] = await Promise.all([
        superAdminService.fetchDidMappingsFromApi(),
        superAdminService.fetchTenantsFromApi(),
        superAdminService.fetchCarrierSettingsFromApi(),
        superAdminService.fetchSpeechVocabulariesApi(),
      ]);
      setDids(allDids || []);
      setTenants(allTenants || []);
      if (carrier) {
        setCarrierSettings(carrier);
      }
      setVocabularies(vocabs || []);
      if (allDids && allDids.length > 0) {
        setSimulatedDid(prev => prev || allDids[0].phoneNumber);
      }
    } catch (err: any) {
      console.error('Error fetching telephony config from API:', err);
      setErrorMsg(err.message || 'Failed to load telephony configuration from backend database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('nexus_admin_updated', loadData);
    return () => window.removeEventListener('nexus_admin_updated', loadData);
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleOpenAddDid = () => {
    setEditingDidId(null);
    setDidPhone('');
    setDidTenantId('');
    setDidRoutingStrategy('Round-Robin');
    setDidQueueName('');
    setDidEnableRecording(true);
    setDidEnableAiWhisper(true);
    setDidChannels(8);
    setIsDidModalOpen(true);
  };

  const handleOpenEditDid = (did: TenantDidMapping) => {
    setEditingDidId(did.id);
    setDidPhone(did.phoneNumber);
    setDidTenantId(did.tenantId);
    setDidRoutingStrategy(did.routingStrategy);
    setDidQueueName(did.queueName);
    setDidEnableRecording(did.enableRecording);
    setDidEnableAiWhisper(did.enableAiWhisper);
    setDidChannels(did.channelsCount);
    setIsDidModalOpen(true);
  };

  const handleSaveDid = async () => {
    if (!didPhone.trim() || isSavingDid) return;
    setIsSavingDid(true);

    try {
      if (editingDidId) {
        const updated = await superAdminService.updateDidMappingApi(editingDidId, {
          phoneNumber: didPhone.trim(),
          tenantId: didTenantId,
          routingStrategy: didRoutingStrategy,
          queueName: didQueueName.trim() || 'Inbound Queue',
          enableRecording: didEnableRecording,
          enableAiWhisper: didEnableAiWhisper,
          channelsCount: didChannels,
          status: didTenantId ? 'Online' : 'Reserved',
        });
        setDids(prev => prev.map(d => d.id === updated.id ? updated : d));
        showSuccess(`DID hotline ${didPhone} configuration updated.`);
      } else {
        const created = await superAdminService.createDidMappingApi({
          phoneNumber: didPhone.trim(),
          tenantId: didTenantId,
          routingStrategy: didRoutingStrategy,
          queueName: didQueueName.trim() || 'Inbound Queue',
          enableRecording: didEnableRecording,
          enableAiWhisper: didEnableAiWhisper,
          channelsCount: didChannels,
          status: didTenantId ? 'Online' : 'Reserved',
        });
        setDids(prev => [...prev, created]);
        showSuccess(`Virtual DID hotline ${didPhone} allocated.`);
      }
      setIsDidModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save virtual DID');
    } finally {
      setIsSavingDid(false);
    }
  };

  const handleDeleteDid = async (did: TenantDidMapping) => {
    if (isActionInProgress) return;
    if (confirm(`Release virtual DID number "${did.phoneNumber}" back to reserve pool?`)) {
      setIsActionInProgress(true);
      try {
        await superAdminService.deleteDidMappingApi(did.id);
        setDids(prev => prev.filter(d => d.id !== did.id));
        showSuccess(`DID ${did.phoneNumber} released.`);
      } catch (err: any) {
        alert(err.message || 'Failed to release DID');
      } finally {
        setIsActionInProgress(false);
      }
    }
  };

  const handleSaveCarrierSettings = async () => {
    setIsSavingCarrier(true);
    setErrorMsg(null);
    try {
      const saved = await superAdminService.updateCarrierSettingsApi(carrierSettings);
      setCarrierSettings(saved);
      showSuccess('Platform SIP Trunk carrier settings saved to PostgreSQL.');
    } catch (err: any) {
      alert(err.message || 'Failed to save carrier settings');
    } finally {
      setIsSavingCarrier(false);
    }
  };

  const handleTestCarrier = async () => {
    setIsTestingCarrier(true);
    setTestResult(null);
    try {
      const res = await superAdminService.testCarrierConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: err.message || 'Telephony gateway connection failed.'
      });
    } finally {
      setIsTestingCarrier(false);
    }
  };

  const handleRunSimulation = async () => {
    const targetDid = dids.find(d => d.phoneNumber === simulatedDid) || dids[0];
    if (!targetDid) return;

    setIsSimulating(true);
    setSimulationLog([]);

    try {
      const res = await superAdminService.simulateInboundCall(targetDid.phoneNumber);
      if (res && res.traceLogs && res.traceLogs.length > 0) {
        res.traceLogs.forEach((msg, idx) => {
          setTimeout(() => {
            setSimulationLog(prev => [...prev, msg]);
            if (idx === res.traceLogs.length - 1) {
              setIsSimulating(false);
            }
          }, (idx + 1) * 350);
        });
      } else {
        setIsSimulating(false);
      }
    } catch (err: any) {
      setIsSimulating(false);
      setSimulationLog([`[ERROR] Simulation failed: ${err.message || 'Carrier gateway trace unreachable'}`]);
    }
  };

  const handleOpenAddVocab = () => {
    setEditingVocabId(null);
    setVocabName('');
    setVocabKey('');
    setVocabLanguage('Kannada / English-IN');
    setVocabLangCode('kn-IN');
    setVocabEngine('Sarvam AI (Saarika) + Whisper Large-v3');
    setVocabDesc('');
    setVocabKeywords([]);
    setVocabSubs([]);
    setNewTerm('');
    setNewPattern('');
    setNewReplacement('');
    setIsVocabModalOpen(true);
  };

  const handleOpenEditVocab = (v: SpeechVocabulary) => {
    setEditingVocabId(v.id);
    setVocabName(v.name);
    setVocabKey(v.key);
    setVocabLanguage(v.language);
    setVocabLangCode(v.languageCode);
    setVocabEngine(v.engine);
    setVocabDesc(v.description);
    setVocabKeywords([...(v.keywords || [])]);
    setVocabSubs([...(v.phoneticSubstitutions || [])]);
    setNewTerm('');
    setNewPattern('');
    setNewReplacement('');
    setIsVocabModalOpen(true);
  };

  const handleAddKeywordToVocab = () => {
    if (!newTerm.trim()) return;
    const exists = vocabKeywords.some(k => k.term.toLowerCase() === newTerm.trim().toLowerCase());
    if (exists) {
      alert(`Term "${newTerm}" already added.`);
      return;
    }
    setVocabKeywords(prev => [...prev, {
      term: newTerm.trim(),
      category: newCategory,
      boostWeight: Number(newWeight) || 4.0
    }]);
    setNewTerm('');
  };

  const handleRemoveKeywordFromVocab = (term: string) => {
    setVocabKeywords(prev => prev.filter(k => k.term !== term));
  };

  const handleAddSubToVocab = () => {
    if (!newPattern.trim() || !newReplacement.trim()) return;
    setVocabSubs(prev => [...prev, {
      spokenPattern: newPattern.trim().toLowerCase(),
      normalizedTarget: newReplacement.trim()
    }]);
    setNewPattern('');
    setNewReplacement('');
  };

  const handleRemoveSubFromVocab = (pattern: string) => {
    setVocabSubs(prev => prev.filter(s => s.spokenPattern !== pattern));
  };

  const handleSaveVocab = async () => {
    if (!vocabName.trim() || isSavingVocab) return;
    setIsSavingVocab(true);
    try {
      const saved = await superAdminService.saveSpeechVocabularyApi({
        id: editingVocabId || undefined,
        key: vocabKey.trim() || vocabName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: vocabName.trim(),
        language: vocabLanguage,
        languageCode: vocabLangCode,
        engine: vocabEngine,
        description: vocabDesc.trim(),
        isActive: true,
        keywords: vocabKeywords,
        phoneticSubstitutions: vocabSubs,
      });

      if (editingVocabId) {
        setVocabularies(prev => prev.map(v => v.id === saved.id ? saved : v));
        showSuccess(`Speech vocabulary "${saved.name}" updated.`);
      } else {
        setVocabularies(prev => [saved, ...prev]);
        showSuccess(`Speech vocabulary "${saved.name}" created and loaded into acoustic cache.`);
      }
      setIsVocabModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save speech vocabulary');
    } finally {
      setIsSavingVocab(false);
    }
  };

  const handleDeleteVocab = async (vocab: SpeechVocabulary) => {
    if (isActionInProgress) return;
    if (confirm(`Delete acoustic vocabulary "${vocab.name}"?`)) {
      setIsActionInProgress(true);
      try {
        await superAdminService.deleteSpeechVocabularyApi(vocab.id);
        setVocabularies(prev => prev.filter(v => v.id !== vocab.id));
        showSuccess(`Vocabulary "${vocab.name}" deleted.`);
      } catch (err: any) {
        alert(err.message || 'Failed to delete vocabulary');
      } finally {
        setIsActionInProgress(false);
      }
    }
  };

  const handleRunSpeechSimulation = async (textToSimulate?: string) => {
    const raw = (textToSimulate || simTranscript).trim();
    if (!raw || isSimulatingSpeech) return;
    setIsSimulatingSpeech(true);
    setSimResult(null);
    try {
      const res = await superAdminService.simulateSpeechTranscriptionApi(raw);
      setSimResult(res);
      showSuccess(`Simulated with ${res.acousticConfidenceGainPercent}% acoustic confidence gain in ${res.processingLatencyMs}ms`);
    } catch (err: any) {
      alert(err.message || 'Failed to run acoustic simulation');
    } finally {
      setIsSimulatingSpeech(false);
    }
  };

  return (
    <div className="platform-callconfig-page-container">
      {/* Header */}
      <div className="callconfig-page-header">
        <div>
          <div className="header-breadcrumbs">
            <span>PLATFORM CONSOLE</span> &gt; <span className="current">TELEPHONY & DIDS</span>
          </div>
          <h1 className="page-main-title">Telephony Trunks & Inbound DID Routing</h1>
          <p className="page-main-desc">
            Manage virtual phone number allocations, cloud carrier SIP gateways, WebRTC softphone routing, and Whisper AI audio transcription.
          </p>
        </div>

        {activeTab === 'speech' ? (
          <button className="btn btn-primary btn-sm btn-allocate-did" onClick={handleOpenAddVocab}>
            <Plus size={14} /> Add Regional Dictionary
          </button>
        ) : (
          <button className="btn btn-primary btn-sm btn-allocate-did" onClick={handleOpenAddDid}>
            <Plus size={14} /> Allocate Virtual DID
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="callconfig-success-alert animate-fade-in" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.35)', color: '#f87171' }}>
          <AlertTriangle size={16} /> {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="callconfig-success-alert animate-fade-in">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="callconfig-nav-tabs">
        <button
          className={`callconfig-tab-btn ${activeTab === 'dids' ? 'active' : ''}`}
          onClick={() => setActiveTab('dids')}
        >
          <PhoneCall size={15} /> Virtual DID Hotlines ({dids.length})
        </button>
        <button
          className={`callconfig-tab-btn ${activeTab === 'carrier' ? 'active' : ''}`}
          onClick={() => setActiveTab('carrier')}
        >
          <Server size={15} /> SIP Carrier Gateways & Trunks
        </button>
        <button
          className={`callconfig-tab-btn ${activeTab === 'speech' ? 'active' : ''}`}
          onClick={() => setActiveTab('speech')}
        >
          <Mic size={15} /> 🎙️ Speech AI & Indian Regional Vocabularies ({vocabularies.length})
        </button>
      </div>

      {/* Tab 1: DID Mapping Table */}
      {activeTab === 'dids' && (
        <div className="card did-table-card">
          <div className="did-card-header">
            <div>
              <h3 className="did-card-title">Virtual DID Inbound Mapping Pool</h3>
              <p className="did-card-desc">
                Dedicated phone hotlines routed to client organization call centers.
              </p>
            </div>
            <span className="total-dids-badge">{dids.length} Allocated Numbers</span>
          </div>

          <div className="table-responsive">
            <table className="did-data-table">
              <thead>
                <tr>
                  <th>Virtual DID Hotline</th>
                  <th>Mapped Tenant Organization</th>
                  <th>Routing Strategy & Queue</th>
                  <th>Channels</th>
                  <th>Audio AI / Recording</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && dids.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                      <Activity size={16} className="animate-spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                      Loading virtual DIDs...
                    </td>
                  </tr>
                ) : dids.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                      No virtual DID hotlines allocated yet. Click 'Allocate Virtual DID' to add one.
                    </td>
                  </tr>
                ) : (
                  dids.map(d => (
                    <tr key={d.id} className="did-row">
                      <td>
                        <div className="did-phone-cell">
                          <PhoneCall size={14} color="#38bdf8" />
                          <code className="did-number-text">{d.phoneNumber}</code>
                        </div>
                      </td>

                      <td>
                        <div className="did-tenant-cell">
                          <Building2 size={13} color="#94a3b8" />
                          <span className="did-tenant-name">{d.tenantName}</span>
                        </div>
                      </td>

                      <td>
                        <div className="did-queue-cell">
                          <span className="routing-strategy-tag">{d.routingStrategy}</span>
                          <span className="queue-name-sub">{d.queueName}</span>
                        </div>
                      </td>

                      <td>
                        <span className="channels-pill">{d.channelsCount} SIP Trunks</span>
                      </td>

                      <td>
                        <div className="ai-features-cell">
                          {d.enableAiWhisper && (
                            <span className="ai-tag">
                              <Sparkles size={11} /> Whisper AI
                            </span>
                          )}
                          {d.enableRecording && <span className="rec-tag">● Rec</span>}
                        </div>
                      </td>

                      <td>
                        <span className={`did-status-pill ${d.status.toLowerCase()}`}>
                          ● {d.status}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="did-actions-group">
                          <button
                            className="action-btn"
                            title="Edit DID Configuration"
                            onClick={() => handleOpenEditDid(d)}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="action-btn text-danger"
                            title="Release Number"
                            disabled={isActionInProgress}
                            onClick={() => handleDeleteDid(d)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Carrier Settings & Simulator */}
      {activeTab === 'carrier' && (
        <div className="callconfig-split-grid">
          {/* Left: Global Platform Carrier & SIP Settings */}
          <div className="card carrier-settings-card">
            <div className="carrier-header-row">
              <div>
                <h3 className="carrier-settings-title">Carrier & SIP Trunk Infrastructure</h3>
                <p className="carrier-settings-desc">
                  Core telephony trunk gateways and audio retention policies across all tenants.
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                disabled={isTestingCarrier}
                onClick={handleTestCarrier}
              >
                <Activity size={13} className={isTestingCarrier ? 'animate-spin' : ''} />
                {isTestingCarrier ? 'Testing Ping...' : 'Test Trunk Health'}
              </button>
            </div>

            {testResult && (
              <div
                className="test-result-banner animate-fade-in"
                style={!testResult.success ? { background: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.35)', color: '#fca5a5' } : undefined}
              >
                {testResult.success ? (
                  <CheckCircle2 size={16} color="#10b981" />
                ) : (
                  <AlertTriangle size={16} color="#ef4444" />
                )}
                <div>
                  <strong>{testResult.success ? `Handshake Verified (${testResult.latencyMs}ms):` : `Gateway Unreachable (${testResult.latencyMs}ms):`}</strong> {testResult.message}
                </div>
              </div>
            )}

            <div className="carrier-form-grid">
              <div className="form-group">
                <label htmlFor="carrier-primary" className="form-label">Primary SIP Carrier Gateway</label>
                <input
                  id="carrier-primary"
                  name="primaryCarrier"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Twilio Elastic SIP Trunking"
                  value={carrierSettings.primaryCarrier}
                  onChange={e =>
                    setCarrierSettings({ ...carrierSettings, primaryCarrier: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="carrier-secondary" className="form-label">Failover Backup Gateway</label>
                <input
                  id="carrier-secondary"
                  name="secondaryCarrier"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Tata Communications / Exotel SIP"
                  value={carrierSettings.secondaryCarrier}
                  onChange={e =>
                    setCarrierSettings({ ...carrierSettings, secondaryCarrier: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="carrier-sip-realm" className="form-label">SIP Realm & Domain</label>
                <input
                  id="carrier-sip-realm"
                  name="sipRealm"
                  type="text"
                  className="form-control font-mono"
                  placeholder="e.g. sip.yourdomain.com:5060"
                  value={carrierSettings.sipRealm}
                  onChange={e =>
                    setCarrierSettings({ ...carrierSettings, sipRealm: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="carrier-webrtc-gateway" className="form-label">WebRTC Signaling Gateway</label>
                <input
                  id="carrier-webrtc-gateway"
                  name="webrtcGatewayUrl"
                  type="text"
                  className="form-control font-mono"
                  placeholder="e.g. wss://webrtc.yourdomain.com:8443/ws"
                  value={carrierSettings.webrtcGatewayUrl}
                  onChange={e =>
                    setCarrierSettings({ ...carrierSettings, webrtcGatewayUrl: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="carrier-recording-retention" className="form-label">Cloud Call Recording Retention (Days)</label>
                <input
                  id="carrier-recording-retention"
                  name="recordingRetentionDays"
                  type="number"
                  className="form-control"
                  placeholder="90"
                  value={carrierSettings.recordingRetentionDays || ''}
                  onChange={e =>
                    setCarrierSettings({
                      ...carrierSettings,
                      recordingRetentionDays: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="carrier-whisper-model" className="form-label">Speech-to-Text Transcription AI Model</label>
                <input
                  id="carrier-whisper-model"
                  name="whisperAiModel"
                  type="text"
                  className="form-control"
                  placeholder="e.g. OpenAI Whisper-Large-v3"
                  value={carrierSettings.whisperAiModel}
                  onChange={e =>
                    setCarrierSettings({ ...carrierSettings, whisperAiModel: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="carrier-footer-action">
              <button
                className="btn btn-primary btn-sm"
                disabled={isSavingCarrier}
                onClick={handleSaveCarrierSettings}
              >
                <Save size={14} className={isSavingCarrier ? 'animate-spin' : ''} />
                {isSavingCarrier ? 'Saving Carrier...' : 'Save Carrier Configuration'}
              </button>
            </div>
          </div>

          {/* Right: Live Inbound Routing Simulator Sandbox */}
          <div className="card call-simulator-card">
            <div className="simulator-header">
              <div>
                <h3 className="simulator-title">Telephony Routing Sandbox</h3>
                <p className="simulator-desc">Simulate an incoming carrier call and trace execution.</p>
              </div>
              <Radio size={18} color="#38bdf8" />
            </div>

            {dids.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', background: '#090d16', borderRadius: 8, border: '1px solid #1e293b' }}>
                <PhoneCall size={20} color="#64748b" style={{ margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: 12 }}>
                  No virtual DID hotlines allocated yet. Allocate a virtual DID number to test carrier resolution and agent queue routing.
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleOpenAddDid}>
                  <Plus size={13} /> Allocate Virtual DID
                </button>
              </div>
            ) : (
              <div className="simulator-controls">
                <div className="form-group">
                  <label htmlFor="simulator-did" className="form-label">Select Inbound DID to Test</label>
                  <select
                    id="simulator-did"
                    name="simulatedDid"
                    className="form-control"
                    value={simulatedDid}
                    onChange={e => setSimulatedDid(e.target.value)}
                  >
                    {dids.map(d => (
                      <option key={d.id} value={d.phoneNumber}>
                        {d.phoneNumber} — {d.tenantName} ({d.routingStrategy})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn btn-primary btn-sm btn-run-sim"
                  disabled={isSimulating}
                  onClick={handleRunSimulation}
                >
                  <Play size={13} /> {isSimulating ? 'Simulating Call...' : 'Trigger Test Inbound Call'}
                </button>
              </div>
            )}

            <div className="simulator-terminal">
              <div className="terminal-header">
                <span>CARRIER ROUTING TRACE LOGS</span>
                <button
                  className="btn-clear-term"
                  onClick={() => setSimulationLog([])}
                  title="Clear Logs"
                >
                  <RotateCcw size={11} /> Clear
                </button>
              </div>
              <div className="terminal-body font-mono">
                {simulationLog.length === 0 ? (
                  <div className="terminal-placeholder">
                    Click 'Trigger Test Inbound Call' to trace carrier resolution, tenant matching, and agent dispatch.
                  </div>
                ) : (
                  simulationLog.map((log, i) => (
                    <div key={i} className="terminal-line animate-fade-in">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Speech AI & Indian Regional Vocabularies */}
      {activeTab === 'speech' && (
        <div className="speech-ai-section animate-fade-in">
          {/* KPI Summary Grid */}
          <div className="speech-ai-kpi-grid">
            <div className="speech-kpi-card">
              <span className="speech-kpi-label">Active Dictionaries</span>
              <span className="speech-kpi-val" style={{ color: '#c084fc' }}>{vocabularies.length}</span>
              <span className="speech-kpi-sub">Regional acoustic packs</span>
            </div>
            <div className="speech-kpi-card">
              <span className="speech-kpi-label">Boosted Keywords</span>
              <span className="speech-kpi-val" style={{ color: '#38bdf8' }}>
                {vocabularies.reduce((acc, v) => acc + (v.keywords?.length || 0), 0)}
              </span>
              <span className="speech-kpi-sub">Domain-specialized metrics</span>
            </div>
            <div className="speech-kpi-card">
              <span className="speech-kpi-label">Phonetic Sound-Alikes</span>
              <span className="speech-kpi-val" style={{ color: '#34d399' }}>
                {vocabularies.reduce((acc, v) => acc + (v.phoneticSubstitutions?.length || 0), 0)}
              </span>
              <span className="speech-kpi-sub">Acoustic normalization rules</span>
            </div>
            <div className="speech-kpi-card">
              <span className="speech-kpi-label">Acoustic Pipeline Engine</span>
              <span className="speech-kpi-val" style={{ fontSize: '15px', color: '#fbbf24', marginTop: '4px' }}>
                {carrierSettings.whisperAiModel || (vocabularies.length > 0 ? vocabularies[0].engine : 'Unconfigured')}
              </span>
              <span className="speech-kpi-sub">
                {carrierSettings.whisperAiModel ? 'Active Platform STT Model' : 'Configurable in Carrier Settings'}
              </span>
            </div>
          </div>

          {/* Interactive Acoustic Simulation Workbench */}
          <div className="speech-sim-card">
            <div className="speech-sim-header">
              <div className="speech-sim-title">
                <Wand2 size={16} color="#c084fc" />
                <span>Interactive Speech Normalization & Acoustic Boosting Workbench</span>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Test transcript normalizer against loaded acoustic dictionaries
              </span>
            </div>

            {vocabularies.length > 0 && (
              <div className="speech-presets-row">
                <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center', marginRight: '4px' }}>Load Dictionary Sample:</span>
                {vocabularies.slice(0, 4).map(v => (
                  <button
                    key={v.id}
                    type="button"
                    className="btn-preset-pill"
                    onClick={() => {
                      const terms = (v.keywords || []).slice(0, 3).map(k => k.term).join(' ');
                      const subs = (v.phoneticSubstitutions || []).slice(0, 2).map(s => s.spokenPattern).join(' ');
                      const prompt = `Client inquiry regarding ${terms || v.name} verification ${subs ? `and ${subs}` : ''}.`;
                      setSimTranscript(prompt);
                      handleRunSpeechSimulation(prompt);
                    }}
                  >
                    {v.name} ({v.languageCode})
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                className="form-control font-mono"
                rows={3}
                style={{ fontSize: '13px', background: '#090d16', color: '#f1f5f9' }}
                placeholder="Enter raw rep voice speech transcript to test keyword boosting..."
                value={simTranscript}
                onChange={e => setSimTranscript(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', borderColor: '#a855f7' }}
                  disabled={isSimulatingSpeech || !simTranscript.trim()}
                  onClick={() => handleRunSpeechSimulation()}
                >
                  <Wand2 size={13} className={isSimulatingSpeech ? 'animate-spin' : ''} />
                  {isSimulatingSpeech ? 'Processing Acoustic Normalization...' : 'Run Acoustic Normalization'}
                </button>
              </div>
            </div>

            {simResult && (
              <div className="speech-sim-result-box animate-fade-in">
                <div className="speech-sim-result-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={15} color="#34d399" />
                    <strong style={{ color: '#f8fafc' }}>Acoustic Normalization Output</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="gain-badge">+{simResult.acousticConfidenceGainPercent}% Confidence Boost</span>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>{simResult.processingLatencyMs}ms</span>
                  </div>
                </div>

                <div style={{ fontSize: '14px', color: '#38bdf8', fontFamily: 'monospace', background: 'rgba(15, 23, 42, 0.7)', padding: 12, borderRadius: 6 }}>
                  "{simResult.normalizedTranscript}"
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
                      BOOSTED ACOUSTIC TERMS MATCHED ({simResult.boostedTermsMatched.length}):
                    </div>
                    <div className="matched-tags-cluster">
                      {simResult.boostedTermsMatched.length === 0 ? (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>None</span>
                      ) : (
                        simResult.boostedTermsMatched.map((term, i) => (
                          <span key={i} className="boost-tag">⚡ {term}</span>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
                      PHONETIC RULES APPLIED ({simResult.substitutionsApplied.length}):
                    </div>
                    <div className="matched-tags-cluster">
                      {simResult.substitutionsApplied.length === 0 ? (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>None</span>
                      ) : (
                        simResult.substitutionsApplied.map((sub, i) => (
                          <span key={i} className="sub-tag">{sub}</span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dialect Filter and Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Languages size={15} color="#94a3b8" />
              <button
                type="button"
                className={`btn btn-xs ${selectedLanguageFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedLanguageFilter('all')}
              >
                All Languages ({vocabularies.length})
              </button>
              {Array.from(new Set(vocabularies.map(v => v.languageCode).filter(Boolean))).map(code => {
                const count = vocabularies.filter(v => v.languageCode === code).length;
                const vocab = vocabularies.find(v => v.languageCode === code);
                return (
                  <button
                    key={code}
                    type="button"
                    className={`btn btn-xs ${selectedLanguageFilter === code ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedLanguageFilter(code)}
                  >
                    {vocab?.language || code} ({count})
                  </button>
                );
              })}
            </div>

            <button className="btn btn-secondary btn-sm" onClick={handleOpenAddVocab}>
              <Plus size={13} /> Add Vocabulary Dictionary
            </button>
          </div>

          {/* Vocabulary Cards Grid */}
          {vocabularies.length === 0 ? (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.4)', border: '1px dashed #334155' }}>
              <Mic size={32} style={{ margin: '0 auto 12px', opacity: 0.5, color: '#c084fc' }} />
              <h4 style={{ color: '#f8fafc', marginBottom: 8, fontSize: '15px' }}>No Regional Speech Dictionaries Configured</h4>
              <p style={{ maxWidth: '480px', margin: '0 auto 20px', fontSize: '13px', lineHeight: 1.5, color: '#94a3b8' }}>
                Add custom domain dictionaries with boosted keywords and phonetic sound-alike normalization rules to optimize transcription accuracy for regional dialects.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleOpenAddVocab}
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', borderColor: '#a855f7' }}
              >
                <Plus size={13} /> Add Vocabulary Dictionary
              </button>
            </div>
          ) : (
            <div className="vocab-grid">
              {vocabularies
                .filter(v => selectedLanguageFilter === 'all' || v.languageCode === selectedLanguageFilter)
                .map(v => (
                  <div key={v.id} className="vocab-card">
                    <div>
                      <div className="vocab-card-header">
                        <div>
                          <h4 className="vocab-title">{v.name}</h4>
                          <span className="vocab-lang-badge">{v.language} ({v.languageCode})</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="action-btn"
                            title="Edit Dictionary"
                            onClick={() => handleOpenEditVocab(v)}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="action-btn text-danger"
                            title="Delete Dictionary"
                            onClick={() => handleDeleteVocab(v)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <p className="vocab-desc" style={{ marginTop: 8 }}>{v.description}</p>
                    </div>

                    {/* Keywords list */}
                    <div className="vocab-terms-box">
                      <div className="vocab-terms-title">
                        Boosted Keywords ({v.keywords?.length || 0}):
                      </div>
                      <div className="matched-tags-cluster">
                        {(v.keywords || []).slice(0, 8).map((k, idx) => (
                          <span key={idx} className="boost-tag">
                            {k.term} ({k.boostWeight?.toFixed ? k.boostWeight.toFixed(1) : k.boostWeight}x)
                          </span>
                        ))}
                        {(v.keywords?.length || 0) > 8 && (
                          <span style={{ fontSize: '10px', color: '#94a3b8', alignSelf: 'center' }}>
                            +{(v.keywords?.length || 0) - 8} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Phonetic rules */}
                    <div className="vocab-terms-box" style={{ background: 'rgba(30, 41, 59, 0.4)' }}>
                      <div className="vocab-terms-title" style={{ color: '#38bdf8' }}>
                        Phonetic Sound-Alikes ({v.phoneticSubstitutions?.length || 0}):
                      </div>
                      <div className="matched-tags-cluster">
                        {(v.phoneticSubstitutions || []).slice(0, 5).map((sub, idx) => (
                          <span key={idx} className="sub-tag">
                            "{sub.spokenPattern}" ➔ {sub.normalizedTarget}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ALLOCATE / EDIT DID MODAL */}
      {/* ========================================================================= */}
      {isDidModalOpen && (
        <Modal
          isOpen={isDidModalOpen}
          onClose={() => setIsDidModalOpen(false)}
          title={editingDidId ? '⚡ Edit Virtual DID Allocation' : '⚡ Allocate Virtual DID Phone Number'}
          size="md"
        >
          <div className="did-modal-content">
            <div className="form-group">
              <label htmlFor="did-phone-number" className="form-label required">Inbound DID Number (E.164 Format)</label>
              <input
                id="did-phone-number"
                name="phoneNumber"
                type="text"
                className="form-control font-mono"
                placeholder="+91 98765 43210"
                value={didPhone}
                onChange={e => setDidPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="did-tenant-id" className="form-label">Assign to Tenant Organization</label>
              <select
                id="did-tenant-id"
                name="tenantId"
                className="form-control"
                value={didTenantId}
                onChange={e => setDidTenantId(e.target.value)}
              >
                <option value="">Reserve Pool (Unassigned)</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid-two">
              <div className="form-group">
                <label htmlFor="did-routing-strategy" className="form-label">Routing Strategy</label>
                <select
                  id="did-routing-strategy"
                  name="routingStrategy"
                  className="form-control"
                  value={didRoutingStrategy}
                  onChange={e => setDidRoutingStrategy(e.target.value as any)}
                >
                  <option value="Round-Robin">Round-Robin</option>
                  <option value="Skill/Priority">Skill & Priority Based</option>
                  <option value="Least-Busy Rep">Least-Busy Rep</option>
                  <option value="Direct Extension">Direct Extension</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="did-concurrent-channels" className="form-label">Concurrent SIP Trunks</label>
                <input
                  id="did-concurrent-channels"
                  name="channels"
                  type="number"
                  className="form-control"
                  value={didChannels}
                  onChange={e => setDidChannels(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="did-queue-name" className="form-label">Queue Name</label>
              <input
                id="did-queue-name"
                name="queueName"
                type="text"
                className="form-control"
                value={didQueueName}
                onChange={e => setDidQueueName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <div className="form-label">Telephony Features</div>
              <div className="checkbox-stack">
                <label htmlFor="did-enable-recording" className="checkbox-row">
                  <input
                    id="did-enable-recording"
                    name="enableRecording"
                    type="checkbox"
                    checked={didEnableRecording}
                    onChange={e => setDidEnableRecording(e.target.checked)}
                  />
                  <span>Enable Cloud Voice Call Recording</span>
                </label>
                <label htmlFor="did-enable-ai-whisper" className="checkbox-row">
                  <input
                    id="did-enable-ai-whisper"
                    name="enableAiWhisper"
                    type="checkbox"
                    checked={didEnableAiWhisper}
                    onChange={e => setDidEnableAiWhisper(e.target.checked)}
                  />
                  <span>Enable Real-time OpenAI Whisper Speech Transcripts</span>
                </label>
              </div>
            </div>

            <div className="modal-actions-footer">
              <button className="btn btn-ghost" disabled={isSavingDid} onClick={() => setIsDidModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={isSavingDid || !didPhone.trim()} onClick={handleSaveDid}>
                {isSavingDid ? 'Saving...' : (editingDidId ? 'Save Configuration' : 'Allocate DID')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT REGIONAL SPEECH VOCABULARY MODAL */}
      {/* ========================================================================= */}
      {isVocabModalOpen && (
        <Modal
          isOpen={isVocabModalOpen}
          onClose={() => setIsVocabModalOpen(false)}
          title={editingVocabId ? '🎙️ Edit Regional Speech Dictionary' : '🎙️ Create Regional Speech Dictionary'}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-grid-two">
              <div className="form-group">
                <label className="form-label required">Dictionary Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Karnataka Real Estate & Land Survey"
                  value={vocabName}
                  onChange={e => setVocabName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Dictionary Key / Slug</label>
                <input
                  type="text"
                  className="form-control font-mono"
                  placeholder="e.g. ka-realty"
                  value={vocabKey}
                  onChange={e => setVocabKey(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-two">
              <div className="form-group">
                <label className="form-label">Regional Language / Dialect</label>
                <select
                  className="form-control"
                  value={vocabLangCode}
                  onChange={e => {
                    const code = e.target.value;
                    setVocabLangCode(code);
                    if (code === 'kn-IN') setVocabLanguage('Kannada / English-IN');
                    else if (code === 'hi-IN') setVocabLanguage('Hindi / English-IN');
                    else if (code === 'te-IN') setVocabLanguage('Telugu / English-IN');
                    else if (code === 'ta-IN') setVocabLanguage('Tamil / English-IN');
                    else setVocabLanguage('English-IN / Multilingual');
                  }}
                >
                  <option value="kn-IN">Kannada / English-IN (kn-IN)</option>
                  <option value="hi-IN">Hindi / English-IN (hi-IN)</option>
                  <option value="te-IN">Telugu / English-IN (te-IN)</option>
                  <option value="ta-IN">Tamil / English-IN (ta-IN)</option>
                  <option value="en-IN">English-IN / Multilingual (en-IN)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Acoustic Pipeline Engine</label>
                <select
                  className="form-control"
                  value={vocabEngine}
                  onChange={e => setVocabEngine(e.target.value)}
                >
                  <option value="Sarvam AI (Saarika) + Whisper Large-v3">Sarvam AI (Saarika) + Whisper Large-v3</option>
                  <option value="Sarvam AI Multilingual Acoustics">Sarvam AI Multilingual Acoustics</option>
                  <option value="OpenAI Whisper Large-v3 (GPU Cluster)">OpenAI Whisper Large-v3 (GPU Cluster)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-control"
                placeholder="Scope of specialized terms and regional phonetic nuances"
                value={vocabDesc}
                onChange={e => setVocabDesc(e.target.value)}
              />
            </div>

            {/* Keyword Boost Manager */}
            <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={14} color="#c084fc" />
                <span>Acoustic Boosted Keywords ({vocabKeywords.length})</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr auto', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Keyword (e.g. Guntas, Khata, Debenture)"
                  value={newTerm}
                  onChange={e => setNewTerm(e.target.value)}
                />
                <select
                  className="form-control"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as any)}
                >
                  <option value="Land Metric">Land Metric</option>
                  <option value="Documentation">Documentation</option>
                  <option value="Financial">Financial</option>
                  <option value="Location">Location</option>
                  <option value="Legal">Legal</option>
                </select>
                <select
                  className="form-control font-mono"
                  value={newWeight}
                  onChange={e => setNewWeight(Number(e.target.value))}
                >
                  <option value={2.0}>2.0x Boost</option>
                  <option value={3.0}>3.0x Boost</option>
                  <option value={4.0}>4.0x Boost</option>
                  <option value={4.5}>4.5x Boost</option>
                  <option value={5.0}>5.0x Max</option>
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddKeywordToVocab}
                >
                  <Plus size={13} /> Add
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                {vocabKeywords.length === 0 ? (
                  <span style={{ fontSize: '12px', color: '#64748b' }}>No boosted terms added yet.</span>
                ) : (
                  vocabKeywords.map((k, idx) => (
                    <span
                      key={idx}
                      className="boost-tag"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      {k.term} ({k.category}, {k.boostWeight?.toFixed ? k.boostWeight.toFixed(1) : k.boostWeight}x)
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                        onClick={() => handleRemoveKeywordFromVocab(k.term)}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Phonetic Sound-Alikes */}
            <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Volume2 size={14} color="#38bdf8" />
                <span>Phonetic Sound-Alike Normalization ({vocabSubs.length})</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Spoken pattern (e.g. guntha, katha)"
                  value={newPattern}
                  onChange={e => setNewPattern(e.target.value)}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Target term (e.g. Guntas, Khata)"
                  value={newReplacement}
                  onChange={e => setNewReplacement(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddSubToVocab}
                >
                  <Plus size={13} /> Add
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 100, overflowY: 'auto' }}>
                {vocabSubs.length === 0 ? (
                  <span style={{ fontSize: '12px', color: '#64748b' }}>No phonetic substitution rules added yet.</span>
                ) : (
                  vocabSubs.map((s, idx) => (
                    <span
                      key={idx}
                      className="sub-tag"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      "{s.spokenPattern}" ➔ {s.normalizedTarget}
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                        onClick={() => handleRemoveSubFromVocab(s.spokenPattern)}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="modal-actions-footer">
              <button className="btn btn-ghost" disabled={isSavingVocab} onClick={() => setIsVocabModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={isSavingVocab || !vocabName.trim()}
                onClick={handleSaveVocab}
              >
                {isSavingVocab ? 'Saving Dictionary...' : (editingVocabId ? 'Save Changes' : 'Create Dictionary')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
