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
} from 'lucide-react';
import { TenantDidMapping, PlatformCarrierSettings, Tenant } from '../../../types';
import { superAdminService } from '../../../services/superAdminService';
import { Modal } from '../../../components/common/Modal';
import './PlatformCallConfigPage.css';

export const PlatformCallConfigPage: React.FC = () => {
  const [dids, setDids] = useState<TenantDidMapping[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [carrierSettings, setCarrierSettings] = useState<PlatformCarrierSettings>(() =>
    superAdminService.getCarrierSettings()
  );

  // Modal State for DID Allocation
  const [isDidModalOpen, setIsDidModalOpen] = useState(false);
  const [editingDidId, setEditingDidId] = useState<string | null>(null);
  const [didPhone, setDidPhone] = useState('+91 80 4700 800');
  const [didTenantId, setDidTenantId] = useState('');
  const [didRoutingStrategy, setDidRoutingStrategy] = useState<
    'Round-Robin' | 'Skill/Priority' | 'Least-Busy Rep' | 'Direct Extension'
  >('Round-Robin');
  const [didQueueName, setDidQueueName] = useState('Inbound Queue');
  const [didEnableRecording, setDidEnableRecording] = useState(true);
  const [didEnableAiWhisper, setDidEnableAiWhisper] = useState(true);
  const [didChannels, setDidChannels] = useState(8);

  // Carrier Test state
  const [isTestingCarrier, setIsTestingCarrier] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);

  // Interactive Test Call Simulator state
  const [simulatedDid, setSimulatedDid] = useState('');
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Success Feedback
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = () => {
    setDids(superAdminService.getDidMappings());
    setTenants(superAdminService.getTenants());
    setCarrierSettings(superAdminService.getCarrierSettings());
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
    setDidPhone(`+91 80 4700 800${dids.length + 1}`);
    setDidTenantId(tenants[0]?.id || '');
    setDidRoutingStrategy('Round-Robin');
    setDidQueueName('Inbound Sales Queue');
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

  const handleSaveDid = () => {
    if (!didPhone.trim()) return;

    const tenantObj = tenants.find(t => t.id === didTenantId);

    if (editingDidId) {
      superAdminService.updateDidMapping(editingDidId, {
        phoneNumber: didPhone,
        tenantId: didTenantId,
        tenantName: tenantObj ? tenantObj.name : 'Unassigned Pool',
        tenantSlug: tenantObj ? tenantObj.slug : '',
        routingStrategy: didRoutingStrategy,
        queueName: didQueueName,
        enableRecording: didEnableRecording,
        enableAiWhisper: didEnableAiWhisper,
        channelsCount: didChannels,
        status: didTenantId ? 'Online' : 'Reserved',
      });
      showSuccess(`DID hotline ${didPhone} configuration updated.`);
    } else {
      superAdminService.createDidMapping({
        phoneNumber: didPhone,
        tenantId: didTenantId,
        tenantName: tenantObj ? tenantObj.name : 'Unassigned Pool',
        tenantSlug: tenantObj ? tenantObj.slug : '',
        routingStrategy: didRoutingStrategy,
        queueName: didQueueName,
        enableRecording: didEnableRecording,
        enableAiWhisper: didEnableAiWhisper,
        channelsCount: didChannels,
        status: didTenantId ? 'Online' : 'Reserved',
      });
      showSuccess(`Virtual DID hotline ${didPhone} allocated.`);
    }

    setIsDidModalOpen(false);
  };

  const handleDeleteDid = (did: TenantDidMapping) => {
    if (confirm(`Release virtual DID number "${did.phoneNumber}" back to reserve pool?`)) {
      superAdminService.deleteDidMapping(did.id);
      showSuccess(`DID ${did.phoneNumber} released.`);
    }
  };

  const handleSaveCarrierSettings = () => {
    superAdminService.updateCarrierSettings(carrierSettings);
    showSuccess('Platform SIP Trunk carrier settings saved.');
  };

  const handleTestCarrier = async () => {
    setIsTestingCarrier(true);
    setTestResult(null);
    const res = await superAdminService.testCarrierConnection();
    setIsTestingCarrier(false);
    setTestResult(res);
  };

  const handleRunSimulation = () => {
    const targetDid = dids.find(d => d.phoneNumber === simulatedDid) || dids[0];
    if (!targetDid) return;

    setIsSimulating(true);
    setSimulationLog([]);

    const steps = [
      `[T+0.0s] Inbound call received on DID: ${targetDid.phoneNumber} from +91 98450 99881 (Bangalore caller ID)`,
      `[T+0.2s] Carrier Gateway: Handshake verified with ${carrierSettings.primaryCarrier}`,
      `[T+0.4s] Tenant Resolution: Mapping matched tenant organization -> "${targetDid.tenantName}" (ID: ${targetDid.tenantId || 'GLOBAL'})`,
      `[T+0.6s] Queue Execution: Routing Strategy [${targetDid.routingStrategy}] dispatched to "${targetDid.queueName}"`,
      `[T+0.8s] Speech Intelligence: Initializing Whisper-Large AI transcription stream and cloud voice recorder`,
      `[T+1.0s] Agent Allocation: Candidate Rep found (Available, Priority #1). Ringing target WebRTC softphone... Call Connected!`,
    ];

    steps.forEach((msg, idx) => {
      setTimeout(() => {
        setSimulationLog(prev => [...prev, msg]);
        if (idx === steps.length - 1) {
          setIsSimulating(false);
        }
      }, (idx + 1) * 450);
    });
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

        <button className="btn btn-primary btn-sm btn-allocate-did" onClick={handleOpenAddDid}>
          <Plus size={14} /> Allocate Virtual DID
        </button>
      </div>

      {successMsg && (
        <div className="callconfig-success-alert animate-fade-in">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* DID Mapping Table */}
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
              {dids.map(d => (
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
                        onClick={() => handleDeleteDid(d)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Layout: Carrier Settings & Live Simulator */}
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
            <div className="test-result-banner animate-fade-in">
              <CheckCircle2 size={16} color="#10b981" />
              <div>
                <strong>Handshake Verified ({testResult.latencyMs}ms):</strong> {testResult.message}
              </div>
            </div>
          )}

          <div className="carrier-form-grid">
            <div className="form-group">
              <label className="form-label">Primary SIP Carrier Gateway</label>
              <input
                type="text"
                className="form-control"
                value={carrierSettings.primaryCarrier}
                onChange={e =>
                  setCarrierSettings({ ...carrierSettings, primaryCarrier: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Failover Backup Gateway</label>
              <input
                type="text"
                className="form-control"
                value={carrierSettings.secondaryCarrier}
                onChange={e =>
                  setCarrierSettings({ ...carrierSettings, secondaryCarrier: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">SIP Realm & Domain</label>
              <input
                type="text"
                className="form-control font-mono"
                value={carrierSettings.sipRealm}
                onChange={e =>
                  setCarrierSettings({ ...carrierSettings, sipRealm: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">WebRTC Signaling Gateway</label>
              <input
                type="text"
                className="form-control font-mono"
                value={carrierSettings.webrtcGatewayUrl}
                onChange={e =>
                  setCarrierSettings({ ...carrierSettings, webrtcGatewayUrl: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cloud Call Recording Retention (Days)</label>
              <input
                type="number"
                className="form-control"
                value={carrierSettings.recordingRetentionDays}
                onChange={e =>
                  setCarrierSettings({
                    ...carrierSettings,
                    recordingRetentionDays: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Speech-to-Text Transcription AI Model</label>
              <input
                type="text"
                className="form-control"
                value={carrierSettings.whisperAiModel}
                onChange={e =>
                  setCarrierSettings({ ...carrierSettings, whisperAiModel: e.target.value })
                }
              />
            </div>
          </div>

          <div className="carrier-footer-action">
            <button className="btn btn-primary btn-sm" onClick={handleSaveCarrierSettings}>
              <Save size={14} /> Save Carrier Configuration
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

          <div className="simulator-controls">
            <div className="form-group">
              <label className="form-label">Select Inbound DID to Test</label>
              <select
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
              <label className="form-label required">Inbound DID Number (E.164 Format)</label>
              <input
                type="text"
                className="form-control font-mono"
                placeholder="+91 80 4700 8004"
                value={didPhone}
                onChange={e => setDidPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assign to Tenant Organization</label>
              <select
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
                <label className="form-label">Routing Strategy</label>
                <select
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
                <label className="form-label">Concurrent SIP Trunks</label>
                <input
                  type="number"
                  className="form-control"
                  value={didChannels}
                  onChange={e => setDidChannels(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Queue Name</label>
              <input
                type="text"
                className="form-control"
                value={didQueueName}
                onChange={e => setDidQueueName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Telephony Features</label>
              <div className="checkbox-stack">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={didEnableRecording}
                    onChange={e => setDidEnableRecording(e.target.checked)}
                  />
                  <span>Enable Cloud Voice Call Recording</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={didEnableAiWhisper}
                    onChange={e => setDidEnableAiWhisper(e.target.checked)}
                  />
                  <span>Enable Real-time OpenAI Whisper Speech Transcripts</span>
                </label>
              </div>
            </div>

            <div className="modal-actions-footer">
              <button className="btn btn-ghost" onClick={() => setIsDidModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveDid}>
                {editingDidId ? 'Save Configuration' : 'Allocate DID'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
