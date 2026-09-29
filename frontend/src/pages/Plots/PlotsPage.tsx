import React, { useState, useEffect } from 'react';
import { Grid } from 'lucide-react';
import { Plot, PropertyProject } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import './PlotsPage.css';

const getStoredPlots = (): Plot[] => {
  try {
    const raw = localStorage.getItem('nexus_plots');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getStoredProjects = (): PropertyProject[] => {
  try {
    const raw = localStorage.getItem('nexus_projects');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredPlot = (plot: Plot) => {
  try {
    const raw = localStorage.getItem('nexus_plots');
    const all: Plot[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(p => p.id === plot.id);
    if (idx >= 0) all[idx] = plot;
    else all.push(plot);
    localStorage.setItem('nexus_plots', JSON.stringify(all));
    window.dispatchEvent(new Event('nexus_storage_updated'));
  } catch {}
};

const addStoredAuditLog = (log: any) => {
  try {
    const raw = localStorage.getItem('nexus_audit_logs');
    const all = raw ? JSON.parse(raw) : [];
    all.unshift(log);
    localStorage.setItem('nexus_audit_logs', JSON.stringify(all));
    window.dispatchEvent(new Event('nexus_storage_updated'));
  } catch {}
};

export const PlotsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const [plots, setPlots] = useState<Plot[]>([]);
  const [projects, setProjects] = useState<PropertyProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('proj-01');
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);

  // Hold action state
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdCustomer, setHoldCustomer] = useState('');
  const [holdDays, setHoldDays] = useState('7');

  const loadData = () => {
    setPlots(getStoredPlots());
    setProjects(getStoredProjects());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, []);

  const projectPlots = plots.filter(p => !selectedProject || p.projectId === selectedProject);

  const availableCount = projectPlots.filter(p => p.status === 'Available').length;
  const holdCount = projectPlots.filter(p => p.status === 'Hold').length;
  const soldCount = projectPlots.filter(p => p.status === 'Sold').length;

  const handleOpenHold = (plot: Plot) => {
    setSelectedPlot(plot);
    setHoldCustomer('');
    setIsHoldModalOpen(true);
  };

  const handleConfirmHold = () => {
    if (selectedPlot && holdCustomer) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(holdDays, 10));

      const updatedPlot: Plot = {
        ...selectedPlot,
        status: 'Hold',
        holdByCustomer: holdCustomer,
        holdByAgent: user?.name || 'Pooja Hegde',
        holdExpiry: expiryDate.toISOString().split('T')[0],
      };

      saveStoredPlot(updatedPlot);

      addStoredAuditLog({
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        actorName: user?.name || 'Agent',
        actorEmail: user?.email || 'agent@jamin.com',
        action: 'PLOT_HOLD_CREATED',
        entityType: 'Plot',
        entityId: selectedPlot.id,
        companyId: tenant?.id,
        companyName: tenant?.name,
        details: `Placed ${selectedPlot.plotNumber} on ${holdDays}-day hold for ${holdCustomer}.`,
      });

      setIsHoldModalOpen(false);
      setSelectedPlot(null);
    }
  };

  const handleReleaseHold = (plot: Plot) => {
    if (confirm(`Release hold on ${plot.plotNumber} back to Available status?`)) {
      const updatedPlot: Plot = {
        ...plot,
        status: 'Available',
        holdByCustomer: undefined,
        holdByAgent: undefined,
        holdExpiry: undefined,
      };
      saveStoredPlot(updatedPlot);
    }
  };

  const formatCurrency = (val: number) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="plots-page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Grid size={24} color="#059669" /> Interactive Plot Inventory
          </h1>
          <p className="page-subtitle">
            Visual plot layout grid, availability statuses, and plot reservation management for {tenant?.name}.
          </p>
        </div>

        {/* Project Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Project:</span>
          <select
            className="form-select plots-project-selector"
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Legend & Telemetry Bar */}
      <div className="card plots-legend-bar">
        <div className="plots-legend-group">
          <div className="plots-legend-item">
            <span className="plots-legend-dot avail" />
            <span className="plots-legend-label">Available: </span>
            <strong style={{ color: '#059669' }}>{availableCount}</strong>
          </div>

          <div className="plots-legend-item">
            <span className="plots-legend-dot hold" />
            <span className="plots-legend-label">On Hold: </span>
            <strong style={{ color: '#d97706' }}>{holdCount}</strong>
          </div>

          <div className="plots-legend-item">
            <span className="plots-legend-dot sold" />
            <span className="plots-legend-label">Sold: </span>
            <strong style={{ color: '#dc2626' }}>{soldCount}</strong>
          </div>
        </div>

        <div className="plots-legend-hint">
          Click any plot below to inspect specifications or initiate a client hold
        </div>
      </div>

      {/* Visual Plot Layout Grid (Blueprint Section 7.19) */}
      <div className="plots-grid-container">
        {projectPlots.map(plot => {
          const isAvailable = plot.status === 'Available';
          const isHold = plot.status === 'Hold';
          const isSold = plot.status === 'Sold';
          const statusClass = isAvailable ? 'available' : isHold ? 'hold' : 'sold';

          return (
            <div
              key={plot.id}
              className={`card card-hover plot-item-card ${statusClass}`}
              onClick={() => setSelectedPlot(plot)}
            >
              <div className="plot-card-header">
                <span className="plot-number-title">
                  {plot.plotNumber}
                </span>
                <StatusChip status={plot.status} size="sm" />
              </div>

              <div className="plot-dimensions">
                {plot.dimension && <span>{plot.dimension} ft • </span>}
                <strong>{plot.sizeSqft} sq.ft</strong>
              </div>

              {plot.facing && (
                <div className="plot-facing">
                  Facing: {plot.facing}
                </div>
              )}

              <div className="plot-pricing-footer">
                <span className="plot-price-highlight">
                  {formatCurrency(plot.totalPrice)}
                </span>
                <span className="plot-sqft-rate">
                  @ ₹{plot.pricePerSqft}/sqft
                </span>
              </div>

              {isHold && (
                <div className="plot-hold-badge">
                  🔒 Held for <strong>{plot.holdByCustomer}</strong>
                  {plot.holdExpiry && <div>Expiry: {plot.holdExpiry}</div>}
                </div>
              )}

              {isSold && (
                <div className="plot-sold-badge">
                  ✓ Registered to <strong>{plot.holdByCustomer || 'Client'}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Plot Detail Modal */}
      <Modal
        isOpen={!!selectedPlot && !isHoldModalOpen}
        onClose={() => setSelectedPlot(null)}
        title={`${selectedPlot?.plotNumber} Specifications`}
        subtitle={`${selectedPlot?.projectName}`}
        footer={
          <>
            {selectedPlot?.status === 'Available' && (
              <button
                className="btn btn-primary plot-hold-btn-gold"
                onClick={() => handleOpenHold(selectedPlot)}
              >
                Put Plot on 7-Day Hold
              </button>
            )}

            {selectedPlot?.status === 'Hold' && (
              <button
                className="btn btn-secondary plot-release-btn"
                onClick={() => handleReleaseHold(selectedPlot)}
              >
                Release Hold to Available
              </button>
            )}

            <button className="btn btn-secondary" onClick={() => setSelectedPlot(null)}>
              Close
            </button>
          </>
        }
      >
        {selectedPlot && (
          <div className="plot-detail-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Current Status:</span>
              <StatusChip status={selectedPlot.status} />
            </div>

            <div className="plot-detail-grid">
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Plot Dimension:</span>
                <div className="plot-detail-val">{selectedPlot.dimension || 'Standard'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total Area:</span>
                <div className="plot-detail-val">{selectedPlot.sizeSqft} sq.ft</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Rate per sq.ft:</span>
                <div className="plot-detail-val">₹{selectedPlot.pricePerSqft}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total Plot Price:</span>
                <div className="plot-detail-price">
                  {formatCurrency(selectedPlot.totalPrice)}
                </div>
              </div>
            </div>

            {selectedPlot.status === 'Hold' && (
              <div className="plot-hold-detail-box">
                <div className="plot-hold-detail-title">
                  Active Hold Reservation Details
                </div>
                <div>Customer: <strong>{selectedPlot.holdByCustomer}</strong></div>
                <div>Agent: <strong>{selectedPlot.holdByAgent}</strong></div>
                <div>Expiry Date: <strong>{selectedPlot.holdExpiry}</strong></div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Place on Hold Form Modal */}
      <Modal
        isOpen={isHoldModalOpen && !!selectedPlot}
        onClose={() => setIsHoldModalOpen(false)}
        title={`Place ${selectedPlot?.plotNumber} on Client Hold`}
        subtitle="Temporarily reserve plot to prevent duplicate bookings during diligence"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsHoldModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirmHold}>
              Confirm Hold Reservation
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Client / Prospect Name *</label>
            <input
              type="text"
              className="form-input"
              required
              value={holdCustomer}
              onChange={e => setHoldCustomer(e.target.value)}
              placeholder="e.g. Brigadier H.S. Rathore"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Hold Validity Duration</label>
            <select
              className="form-select"
              value={holdDays}
              onChange={e => setHoldDays(e.target.value)}
            >
              <option value="3">3 Days (Express Hold)</option>
              <option value="7">7 Days (Standard Diligence)</option>
              <option value="14">14 Days (Executive Approval)</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};
