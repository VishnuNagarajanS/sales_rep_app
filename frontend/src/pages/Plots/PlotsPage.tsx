import React, { useState, useEffect } from 'react';
import { Grid, RefreshCw, Plus, Map, Maximize2, ZoomIn, ZoomOut, RotateCcw, Compass, Layers, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { jaminApiService } from '../../services/jaminApiService';
import './PlotsPage.css';

export const PlotsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const [plots, setPlots] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedPlot, setSelectedPlot] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMasterLayoutModalOpen, setIsMasterLayoutModalOpen] = useState(false);
  const [layoutZoom, setLayoutZoom] = useState<number>(1);
  const canManagePlots = user?.role?.code === 'company_admin' || user?.role?.code === 'super_admin';

  // Hold action state
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdCustomer, setHoldCustomer] = useState('');
  const [holdPhone, setHoldPhone] = useState('');
  const [holdDays, setHoldDays] = useState('7');
  const [submittingHold, setSubmittingHold] = useState(false);

  // Add Plot Modal State
  const [isAddPlotModalOpen, setIsAddPlotModalOpen] = useState(false);
  const [newPlotProjectId, setNewPlotProjectId] = useState<string>('');
  const [newPlotNumber, setNewPlotNumber] = useState('');
  const [newPlotDimensions, setNewPlotDimensions] = useState('30 x 40');
  const [newPlotAreaSqFt, setNewPlotAreaSqFt] = useState<number>(1200);
  const [newPlotFacing, setNewPlotFacing] = useState('East');
  const [newPlotPrice, setNewPlotPrice] = useState<number>(4500000);
  const [newPlotNotes, setNewPlotNotes] = useState('');
  const [submittingPlot, setSubmittingPlot] = useState(false);

  const loadData = async (projId?: string) => {
    setLoading(true);
    try {
      const [projList, plotList] = await Promise.all([
        jaminApiService.getProjects(),
        jaminApiService.getPlots(projId || undefined),
      ]);
      setProjects(projList);
      if (projList.length > 0 && !selectedProject && !projId) {
        setSelectedProject(String(projList[0].id));
      }
      setPlots(plotList);
    } catch (err) {
      console.error('Failed to load plots/projects from backend', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProjectChange = async (projId: string) => {
    setSelectedProject(projId);
    setLoading(true);
    try {
      const plotList = await jaminApiService.getPlots(projId || undefined);
      setPlots(plotList);
    } catch (err) {
      console.error('Failed to filter plots', err);
    } finally {
      setLoading(false);
    }
  };

  const projectPlots = selectedProject
    ? plots.filter(p => String(p.projectId) === String(selectedProject))
    : plots;

  const availableCount = projectPlots.filter(p => p.status === 'Available').length;
  const holdCount = projectPlots.filter(p => p.status === 'Hold').length;
  const soldCount = projectPlots.filter(p => p.status === 'Booked' || p.status === 'Registered' || p.status === 'Sold').length;

  const currentProjectObj = projects.find(p => String(p.id) === String(selectedProject));
  const hasMasterLayout = Boolean(currentProjectObj?.imageUrl && currentProjectObj.imageUrl.trim() !== '');

  const getProjectMasterLayout = () => {
    if (hasMasterLayout) {
      return currentProjectObj!.imageUrl;
    }
    return '';
  };

  const handleOpenHold = (plot: any) => {
    setSelectedPlot(plot);
    setHoldCustomer('');
    setHoldPhone('');
    setIsHoldModalOpen(true);
  };

  const handleConfirmHold = async () => {
    if (!selectedPlot || !holdCustomer) return;
    setSubmittingHold(true);
    try {
      const success = await jaminApiService.holdPlot(
        String(selectedPlot.id),
        holdCustomer,
        holdPhone || '9876543210',
        parseInt(holdDays, 10),
        `Hold placed by ${user?.name || 'Agent'}`,
        user?.name || 'Sales Agent'
      );
      if (success) {
        setIsHoldModalOpen(false);
        setSelectedPlot(null);
        await loadData(selectedProject);
      } else {
        alert('Failed to place plot on hold. Please check plot status.');
      }
    } catch (err) {
      console.error('Hold plot error', err);
      alert('Error communicating with server.');
    } finally {
      setSubmittingHold(false);
    }
  };

  const handleReleaseHold = async (plot: any) => {
    if (confirm(`Release hold on ${plot.plotNumber} back to Available status?`)) {
      try {
        const success = await jaminApiService.releasePlot(String(plot.id));
        if (success) {
          setSelectedPlot(null);
          await loadData(selectedProject);
        } else {
          alert('Failed to release plot hold.');
        }
      } catch (err) {
        console.error('Release hold error', err);
      }
    }
  };

  const handleCreatePlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const projId = newPlotProjectId || selectedProject;
    if (!projId || !newPlotNumber.trim()) {
      alert('Project and Plot Number are required.');
      return;
    }

    setSubmittingPlot(true);
    try {
      const success = await jaminApiService.createPlot({
        projectId: parseInt(projId, 10),
        plotNumber: newPlotNumber.trim(),
        dimensions: newPlotDimensions.trim(),
        areaSqFt: Number(newPlotAreaSqFt) || 1200,
        facing: newPlotFacing,
        price: Number(newPlotPrice) || 0,
        notes: newPlotNotes.trim(),
      });

      if (success) {
        setIsAddPlotModalOpen(false);
        setNewPlotNumber('');
        setNewPlotNotes('');
        await loadData(selectedProject);
      } else {
        alert('Failed to add plot. Please verify plot number is unique for this project.');
      }
    } catch (err) {
      console.error('Error creating plot', err);
      alert('Error communicating with server.');
    } finally {
      setSubmittingPlot(false);
    }
  };

  const formatCurrency = (val?: number) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  return (
    <div className="plots-page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">
            <Grid size={24} color="#059669" /> Interactive Plot Inventory
          </h1>
          <p className="page-subtitle">
            Visual plot layout grid, availability statuses, and plot reservation management from backend DB.
          </p>
        </div>

        {/* Project Selector, Refresh, Add Plot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Project:</span>
            <select
              className="form-select plots-project-selector"
              value={selectedProject}
              onChange={e => handleProjectChange(e.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadData(selectedProject)}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          {canManagePlots && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setNewPlotProjectId(selectedProject || (projects[0]?.id ? String(projects[0].id) : ''));
                setIsAddPlotModalOpen(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} /> Add Plot
            </button>
          )}
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
            <span className="plots-legend-label">Booked / Sold: </span>
            <strong style={{ color: '#dc2626' }}>{soldCount}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setLayoutZoom(1); setIsMasterLayoutModalOpen(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 600 }}
          >
            <Map size={15} /> View Master Layout Blueprint
          </button>
          <div className="plots-legend-hint">
            Click any plot below to inspect specs or place hold
          </div>
        </div>
      </div>

      {/* Visual Plot Layout Grid */}
      {loading && projectPlots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
          Loading plots from backend database...
        </div>
      ) : projectPlots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '16px' }}>No plots found for this project in the backend database.</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setNewPlotProjectId(selectedProject || (projects[0]?.id ? String(projects[0].id) : ''));
              setIsAddPlotModalOpen(true);
            }}
          >
            <Plus size={16} /> Add First Plot
          </button>
        </div>
      ) : (
        <div className="plots-grid-container">
          {projectPlots.map(plot => {
            const isAvailable = plot.status === 'Available';
            const isHold = plot.status === 'Hold';
            const isSold = plot.status === 'Booked' || plot.status === 'Registered' || plot.status === 'Sold';
            const statusClass = isAvailable ? 'available' : isHold ? 'hold' : 'sold';

            const price = plot.price || plot.totalPrice || 0;
            const area = plot.areaSqFt || plot.sizeSqft || 0;
            const rate = area > 0 ? Math.round(price / area) : (plot.pricePerSqft || 0);

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
                  {plot.dimensions && <span>{plot.dimensions} ft • </span>}
                  <strong>{area} sq.ft</strong>
                </div>

                {plot.facing && (
                  <div className="plot-facing">
                    Facing: {plot.facing}
                  </div>
                )}

                <div className="plot-pricing-footer">
                  <span className="plot-price-highlight">
                    {formatCurrency(price)}
                  </span>
                  {rate > 0 && (
                    <span className="plot-sqft-rate">
                      @ ₹{rate}/sqft
                    </span>
                  )}
                </div>

                {isHold && (
                  <div className="plot-hold-badge">
                    🔒 Held for <strong>{plot.heldByCustomerName || plot.holdByCustomer || 'Client'}</strong>
                    {(plot.holdExpiresAt || plot.holdExpiry) && (
                      <div>Expiry: {new Date(plot.holdExpiresAt || plot.holdExpiry).toLocaleDateString()}</div>
                    )}
                  </div>
                )}

                {isSold && (
                  <div className="plot-sold-badge">
                    ✓ Booked / Sold {plot.heldByCustomerName ? `to ${plot.heldByCustomerName}` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Plot Detail Modal */}
      <Modal
        isOpen={!!selectedPlot && !isHoldModalOpen}
        onClose={() => setSelectedPlot(null)}
        title={`${selectedPlot?.plotNumber} Specifications`}
        subtitle={`${currentProjectObj?.name || 'Project Layout'}`}
        footer={
          <>
            {selectedPlot?.status === 'Available' && (
              <button
                className="btn btn-primary plot-hold-btn-gold"
                onClick={() => handleOpenHold(selectedPlot)}
              >
                Put Plot on Hold
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
                <div className="plot-detail-val">{selectedPlot.dimensions || selectedPlot.dimension || 'Standard'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total Area:</span>
                <div className="plot-detail-val">{selectedPlot.areaSqFt || selectedPlot.sizeSqft || 0} sq.ft</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Facing:</span>
                <div className="plot-detail-val">{selectedPlot.facing || 'East'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Price per Sq.Ft:</span>
                <div className="plot-detail-val">
                  ₹{(selectedPlot.pricePerSqft || (selectedPlot.areaSqFt > 0 ? Math.round(selectedPlot.price / selectedPlot.areaSqFt) : 0)).toLocaleString('en-IN')}/sq.ft
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total Plot Price:</span>
                <div className="plot-detail-price">
                  {formatCurrency(selectedPlot.price || selectedPlot.totalPrice)}
                </div>
              </div>
            </div>

            {selectedPlot.status === 'Hold' && (
              <div className="plot-hold-detail-box">
                <div className="plot-hold-detail-title">
                  Active Hold Reservation Details
                </div>
                <div>Customer: <strong>{selectedPlot.heldByCustomerName || selectedPlot.holdByCustomer || 'N/A'}</strong></div>
                {selectedPlot.heldByCustomerPhone && <div>Phone: <strong>{selectedPlot.heldByCustomerPhone}</strong></div>}
                {selectedPlot.holdByAgent && <div>Held By Agent: <strong>{selectedPlot.holdByAgent}</strong></div>}
                <div>Expiry: <strong>{selectedPlot.holdExpiresAt ? new Date(selectedPlot.holdExpiresAt).toLocaleDateString() : 'N/A'}</strong></div>
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
        subtitle="Temporarily reserve plot in backend database to prevent duplicate bookings"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsHoldModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirmHold} disabled={submittingHold}>
              {submittingHold ? 'Saving to Database...' : 'Confirm Hold Reservation'}
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
            <label className="form-label">Client Phone Number *</label>
            <input
              type="tel"
              className="form-input"
              value={holdPhone}
              onChange={e => setHoldPhone(e.target.value)}
              placeholder="e.g. 9876543210"
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

      {/* Add New Plot Modal */}
      <Modal
        isOpen={isAddPlotModalOpen}
        onClose={() => setIsAddPlotModalOpen(false)}
        title="Add New Plot to Inventory"
        subtitle="Create an individual plot layout record directly in the backend database"
      >
        <form onSubmit={handleCreatePlot}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Project *</label>
              <select
                className="form-select"
                required
                value={newPlotProjectId}
                onChange={e => setNewPlotProjectId(e.target.value)}
              >
                <option value="">-- Select Project --</option>
                {projects.map(p => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} ({p.location})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Plot Number *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newPlotNumber}
                  onChange={e => setNewPlotNumber(e.target.value)}
                  placeholder="e.g. Plot #16"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Dimensions</label>
                <input
                  type="text"
                  className="form-input"
                  value={newPlotDimensions}
                  onChange={e => setNewPlotDimensions(e.target.value)}
                  placeholder="e.g. 30 x 40"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Area (sq.ft) *</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  min={100}
                  value={newPlotAreaSqFt}
                  onChange={e => setNewPlotAreaSqFt(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Facing Direction</label>
                <select
                  className="form-select"
                  value={newPlotFacing}
                  onChange={e => setNewPlotFacing(e.target.value)}
                >
                  <option value="East">East</option>
                  <option value="North">North</option>
                  <option value="North-East">North-East (Corner)</option>
                  <option value="West">West</option>
                  <option value="South">South</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Total Plot Price (₹) *</label>
              <input
                type="number"
                className="form-input"
                required
                min={1}
                value={newPlotPrice}
                onChange={e => setNewPlotPrice(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes & Landmarks</label>
              <input
                type="text"
                className="form-input"
                value={newPlotNotes}
                onChange={e => setNewPlotNotes(e.target.value)}
                placeholder="e.g. Adjacent to park and 40ft boulevard road"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsAddPlotModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingPlot}>
                {submittingPlot ? 'Adding to Database...' : 'Add Plot'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Master Gated Community Layout Lightbox / Zoom Modal */}
      <Modal
        isOpen={isMasterLayoutModalOpen}
        onClose={() => setIsMasterLayoutModalOpen(false)}
        title={`${currentProjectObj?.name || 'Project'} — Gated Community Master Plan`}
        subtitle="High-resolution master layout map, plot boundary alignments, and sanction diagram"
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Zoom & Control Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: '#475569' }}>
              <span>Zoom Level: <strong>{Math.round(layoutZoom * 100)}%</strong></span>
              <span>•</span>
              <span>Total Plots: <strong>{currentProjectObj?.totalPlots || projectPlots.length}</strong></span>
              <span>•</span>
              <span style={{ color: '#059669', fontWeight: 600 }}>{availableCount} Available</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLayoutZoom(prev => Math.max(0.75, prev - 0.25))}
                disabled={layoutZoom <= 0.75}
                title="Zoom Out"
                style={{ padding: '4px 10px' }}
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLayoutZoom(1)}
                title="Reset Zoom"
                style={{ padding: '4px 10px' }}
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLayoutZoom(prev => Math.min(2.5, prev + 0.25))}
                disabled={layoutZoom >= 2.5}
                title="Zoom In"
                style={{ padding: '4px 10px' }}
              >
                <ZoomIn size={15} />
              </button>
            </div>
          </div>

          {/* Blueprint Canvas Container */}
          <div style={{
            width: '100%',
            height: '520px',
            overflow: 'auto',
            background: '#0f172a',
            borderRadius: '10px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #334155',
          }}>
            {getProjectMasterLayout() ? (
              <img
                src={getProjectMasterLayout()}
                alt="Gated Community Master Layout Blueprint"
                style={{
                  transform: `scale(${layoutZoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px' }}>
                <Map size={48} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                <p style={{ fontSize: '1rem', color: '#cbd5e1', margin: '0 0 8px 0' }}>
                  No Master Layout Blueprint uploaded for {currentProjectObj?.name || 'this project'}.
                </p>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                  Upload a community layout map or CAD blueprint when creating or editing the project in the Projects page.
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
