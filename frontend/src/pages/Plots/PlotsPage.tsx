import React, { useState, useEffect, useMemo } from 'react';
import { Grid, RefreshCw, Plus, Map, Maximize2, ZoomIn, ZoomOut, RotateCcw, Compass, Layers, ShieldCheck, Edit3, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { jaminApiService } from '../../services/jaminApiService';
import { getCustomers, getLeads } from '../../services/ghlApiService';
import { storageService } from '../../services/storageService';
import './PlotsPage.css';

const comparePlotNumbers = (left: any, right: any): number => {
  const leftNumber = Number.parseInt(String(left.plotNumber ?? ''), 10);
  const rightNumber = Number.parseInt(String(right.plotNumber ?? ''), 10);
  const leftIsNumber = Number.isFinite(leftNumber);
  const rightIsNumber = Number.isFinite(rightNumber);
  if (leftIsNumber && rightIsNumber && leftNumber !== rightNumber) return leftNumber - rightNumber;
  if (leftIsNumber !== rightIsNumber) return leftIsNumber ? -1 : 1;
  return String(left.plotNumber ?? '').localeCompare(String(right.plotNumber ?? ''), undefined, { numeric: true });
};

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
  const [holdSourceType, setHoldSourceType] = useState<'customer' | 'lead' | 'custom'>('customer');
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [leadsList, setLeadsList] = useState<any[]>([]);

  // Effective customers list: includes all customers from CRM database, PLUS any converted leads who are already customers
  const effectiveCustomersList = useMemo(() => {
    const list = [...customersList];
    leadsList.forEach(l => {
      if ((l.status || '').toLowerCase() === 'converted') {
        const exists = list.some(c =>
          (c.phone && l.phone && c.phone.trim() === l.phone.trim()) ||
          (String(c.id) === String(l.id))
        );
        if (!exists) {
          list.push({
            id: l.id,
            name: l.name,
            phone: l.phone,
            status: 'Active',
            email: l.email,
            location: l.location,
          });
        }
      }
    });
    return list;
  }, [customersList, leadsList]);

  // Active unconverted leads ONLY (leads who are already converted are customers and excluded here)
  const availableLeadsList = useMemo(() => {
    return leadsList.filter(l => (l.status || '').toLowerCase() !== 'converted');
  }, [leadsList]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [holdCustomer, setHoldCustomer] = useState('');
  const [holdPhone, setHoldPhone] = useState('');
  const [holdDays, setHoldDays] = useState('7');
  const [submittingHold, setSubmittingHold] = useState(false);

  // Booking action state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingSourceType, setBookingSourceType] = useState<'customer' | 'lead' | 'custom'>('customer');
  const [selectedBookingCustomerId, setSelectedBookingCustomerId] = useState('');
  const [selectedBookingLeadId, setSelectedBookingLeadId] = useState('');
  const [bookingCustomerName, setBookingCustomerName] = useState('');
  const [bookingCustomerPhone, setBookingCustomerPhone] = useState('');
  const [bookingTokenAmount, setBookingTokenAmount] = useState<number | undefined>(undefined);
  const [bookingTotalAgreementValue, setBookingTotalAgreementValue] = useState<number | undefined>(undefined);
  const [bookingPaymentMode, setBookingPaymentMode] = useState('');
  const [bookingPaymentTerms, setBookingPaymentTerms] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Add Plot Modal State
  const [isAddPlotModalOpen, setIsAddPlotModalOpen] = useState(false);
  const [newPlotProjectId, setNewPlotProjectId] = useState<string>('');
  const [newPlotNumber, setNewPlotNumber] = useState('');
  const [newPlotDimensions, setNewPlotDimensions] = useState('');
  const [newPlotAreaSqFt, setNewPlotAreaSqFt] = useState<number>(0);
  const [newPlotFacing, setNewPlotFacing] = useState('East');
  const [newPlotPrice, setNewPlotPrice] = useState<number>(0);
  const [newPlotNotes, setNewPlotNotes] = useState('');
  const [submittingPlot, setSubmittingPlot] = useState(false);

  // Edit Plot Modal State
  const [isEditPlotModalOpen, setIsEditPlotModalOpen] = useState(false);
  const [editPlotNumber, setEditPlotNumber] = useState('');
  const [editPlotDimensions, setEditPlotDimensions] = useState('');
  const [editPlotAreaSqFt, setEditPlotAreaSqFt] = useState<number>(0);
  const [editPlotFacing, setEditPlotFacing] = useState('East');
  const [editPlotPrice, setEditPlotPrice] = useState<number>(0);
  const [editPlotStatus, setEditPlotStatus] = useState('Available');
  const [editPlotNotes, setEditPlotNotes] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete Plot Modal State
  const [isDeletePlotModalOpen, setIsDeletePlotModalOpen] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(false);

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
      setPlots([...plotList].sort(comparePlotNumbers));
    } catch (err) {
      console.error('Failed to load plots/projects from backend', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadHoldEntities();
  }, []);

  const handleProjectChange = async (projId: string) => {
    setSelectedProject(projId);
    setLoading(true);
    try {
      const plotList = await jaminApiService.getPlots(projId || undefined);
      setPlots([...plotList].sort(comparePlotNumbers));
    } catch (err) {
      console.error('Failed to filter plots', err);
    } finally {
      setLoading(false);
    }
  };

  const projectPlots = selectedProject
    ? plots.filter(p => String(p.projectId) === String(selectedProject)).sort(comparePlotNumbers)
    : [...plots].sort(comparePlotNumbers);

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

  const loadHoldEntities = async () => {
    try {
      const [custs, lds] = await Promise.all([
        getCustomers(tenant?.id).catch(() => []),
        getLeads(tenant?.id).catch(() => storageService.getLeads(tenant?.id) || []),
      ]);
      setCustomersList(custs || []);
      setLeadsList(lds || []);
      return { custs: custs || [], lds: lds || [] };
    } catch (err) {
      console.error('Failed to load customers/leads for hold modal', err);
      return { custs: [], lds: [] };
    }
  };

  const handleOpenHold = (plot: any) => {
    setSelectedPlot(plot);
    setHoldSourceType('customer');
    setSelectedCustomerId('');
    setSelectedLeadId('');
    setHoldCustomer('');
    setHoldPhone('');
    setIsHoldModalOpen(true);
    loadHoldEntities();
  };

  const handleSourceTypeChange = (type: 'customer' | 'lead' | 'custom') => {
    setHoldSourceType(type);
    setSelectedCustomerId('');
    setSelectedLeadId('');
    setHoldCustomer('');
    setHoldPhone('');
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custId = e.target.value;
    setSelectedCustomerId(custId);
    const found = effectiveCustomersList.find(c => String(c.id) === String(custId));
    if (found) {
      setHoldCustomer(found.name || '');
      setHoldPhone(found.phone || '');
    } else {
      setHoldCustomer('');
      setHoldPhone('');
    }
  };

  const handleLeadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const leadId = e.target.value;
    setSelectedLeadId(leadId);
    const found = availableLeadsList.find(l => String(l.id) === String(leadId));
    if (found) {
      setHoldCustomer(found.name || '');
      setHoldPhone(found.phone || '');
    } else {
      setHoldCustomer('');
      setHoldPhone('');
    }
  };

  const handleConfirmHold = async () => {
    if (!selectedPlot) return;
    if (!holdCustomer.trim()) {
      alert(holdSourceType === 'customer' ? 'Please select a customer.' : holdSourceType === 'lead' ? 'Please select a lead.' : 'Client name is required.');
      return;
    }
    if (!holdPhone.trim()) {
      alert('Phone number is required.');
      return;
    }
    setSubmittingHold(true);
    try {
      const success = await jaminApiService.holdPlot(
        String(selectedPlot.id),
        holdCustomer.trim(),
        holdPhone.trim(),
        parseInt(holdDays, 10),
        undefined,
        user?.name || undefined,
        holdSourceType === 'customer' && selectedCustomerId ? selectedCustomerId : undefined
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

  const handleOpenBooking = async (plot: any) => {
    setSelectedPlot(plot);
    const { custs, lds } = await loadHoldEntities();

    const heldPhone = (plot.heldByCustomerPhone || plot.holdPhone || '').trim();
    const heldName = (plot.heldByCustomerName || plot.holdCustomer || '').trim();

    if (plot.heldByCustomerId) {
      setBookingSourceType('customer');
      setSelectedBookingCustomerId(String(plot.heldByCustomerId));
      setSelectedBookingLeadId('');
      const matched = effectiveCustomersList.find((c: any) => String(c.id) === String(plot.heldByCustomerId));
      setBookingCustomerName(matched?.name || heldName);
      setBookingCustomerPhone(matched?.phone || heldPhone);
    } else if (heldPhone) {
      const matchedCustomer = effectiveCustomersList.find((c: any) => c.phone && c.phone.trim() === heldPhone);
      const matchedLead = lds.find((l: any) => l.phone && l.phone.trim() === heldPhone);

      if (matchedCustomer || (matchedLead && (matchedLead.status || '').toLowerCase() === 'converted')) {
        const person = matchedCustomer || matchedLead;
        setBookingSourceType('customer');
        setSelectedBookingCustomerId(String(person.id));
        setSelectedBookingLeadId('');
        setBookingCustomerName(person.name || heldName);
        setBookingCustomerPhone(person.phone || heldPhone);
      } else if (matchedLead) {
        setBookingSourceType('lead');
        setSelectedBookingCustomerId('');
        setSelectedBookingLeadId(String(matchedLead.id));
        setBookingCustomerName(matchedLead.name || heldName);
        setBookingCustomerPhone(matchedLead.phone || heldPhone);
      } else {
        setBookingSourceType('custom');
        setSelectedBookingCustomerId('');
        setSelectedBookingLeadId('');
        setBookingCustomerName(heldName);
        setBookingCustomerPhone(heldPhone);
      }
    } else if (heldName) {
      const matchedCustomer = effectiveCustomersList.find((c: any) => c.name && c.name.trim().toLowerCase() === heldName.toLowerCase());
      const matchedLead = lds.find((l: any) => l.name && l.name.trim().toLowerCase() === heldName.toLowerCase());
      if (matchedCustomer || (matchedLead && (matchedLead.status || '').toLowerCase() === 'converted')) {
        const person = matchedCustomer || matchedLead;
        setBookingSourceType('customer');
        setSelectedBookingCustomerId(String(person.id));
        setSelectedBookingLeadId('');
        setBookingCustomerName(person.name || heldName);
        setBookingCustomerPhone(person.phone || '');
      } else {
        setBookingSourceType('custom');
        setSelectedBookingCustomerId('');
        setSelectedBookingLeadId('');
        setBookingCustomerName(heldName);
      }
    } else {
      setBookingSourceType('customer');
      setSelectedBookingCustomerId('');
      setSelectedBookingLeadId('');
      setBookingCustomerName('');
      setBookingCustomerPhone('');
    }

    const price = plot.price || plot.totalPrice || 0;
    setBookingTotalAgreementValue(price);
    setBookingTokenAmount(undefined);
    setBookingPaymentMode('');
    setBookingPaymentTerms('');
    setBookingNotes('');
    setIsBookingModalOpen(true);
  };

  const handleBookingSourceTypeChange = (type: 'customer' | 'lead' | 'custom') => {
    setBookingSourceType(type);
    setSelectedBookingCustomerId('');
    setSelectedBookingLeadId('');
    setBookingCustomerName('');
    setBookingCustomerPhone('');
  };

  const handleBookingCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custId = e.target.value;
    setSelectedBookingCustomerId(custId);
    const found = effectiveCustomersList.find(c => String(c.id) === String(custId));
    if (found) {
      setBookingCustomerName(found.name || '');
      setBookingCustomerPhone(found.phone || '');
    } else {
      setBookingCustomerName('');
      setBookingCustomerPhone('');
    }
  };

  const handleBookingLeadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const leadId = e.target.value;
    setSelectedBookingLeadId(leadId);
    const found = availableLeadsList.find(l => String(l.id) === String(leadId));
    if (found) {
      setBookingCustomerName(found.name || '');
      setBookingCustomerPhone(found.phone || '');
    } else {
      setBookingCustomerName('');
      setBookingCustomerPhone('');
    }
  };

  const handleConfirmBooking = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPlot) return;
    if (!bookingCustomerName.trim()) {
      alert(bookingSourceType === 'customer' ? 'Please select a customer.' : bookingSourceType === 'lead' ? 'Please select a lead.' : 'Buyer / Customer name is required to confirm booking.');
      return;
    }
    if (!bookingCustomerPhone.trim()) {
      alert('Buyer / Customer phone number is required.');
      return;
    }

    setSubmittingBooking(true);
    try {
      const price = bookingTotalAgreementValue ?? (selectedPlot.price || selectedPlot.totalPrice || 0);
      const result = await jaminApiService.createBooking({
        plotId: selectedPlot.id,
        projectId: selectedPlot.projectId,
        customerId: bookingSourceType === 'customer' && selectedBookingCustomerId ? parseInt(selectedBookingCustomerId, 10) : (selectedPlot?.heldByCustomerId ? parseInt(String(selectedPlot.heldByCustomerId), 10) : undefined),
        leadId: bookingSourceType === 'lead' && selectedBookingLeadId ? parseInt(selectedBookingLeadId, 10) : undefined,
        customerName: bookingCustomerName.trim(),
        customerPhone: bookingCustomerPhone.trim(),
        totalPlotPrice: price,
        tokenAmountPaid: bookingTokenAmount || 0,
        paymentMode: bookingPaymentMode,
        paymentTerms: bookingPaymentTerms.trim(),
        notes: bookingNotes.trim(),
        plotNumber: selectedPlot.plotNumber,
        projectName: currentProjectObj?.name || '',
      });

      if (result.success) {
        setIsBookingModalOpen(false);
        setSelectedPlot(null);
        await loadData(selectedProject);
        alert(`✓ Plot ${selectedPlot.plotNumber} successfully reserved! The token payment of ₹${(bookingTokenAmount || 0).toLocaleString('en-IN')} is awaiting finance verification. The prospect will be officially confirmed in Customer 360 once the payment is verified.`);
      } else {
        alert(result.message || 'Failed to confirm booking. The plot may already be held or booked by another transaction.');
      }
    } catch (err: any) {
      console.error('Error confirming booking', err);
      alert(err?.message || 'Error communicating with server.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleOpenEditPlot = (plot: any) => {
    setSelectedPlot(plot);
    setEditPlotNumber(plot.plotNumber || '');
    setEditPlotDimensions(plot.dimensions || '');
    setEditPlotAreaSqFt(plot.areaSqFt || 1200);
    setEditPlotFacing(plot.facing || 'East');
    setEditPlotPrice(plot.price || 0);
    setEditPlotStatus(plot.status || 'Available');
    setEditPlotNotes(plot.notes || '');
    setIsEditPlotModalOpen(true);
  };

  const handleSaveEditPlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlot || !editPlotNumber.trim()) {
      alert('Plot number is required.');
      return;
    }
    setSubmittingEdit(true);
    try {
      const success = await jaminApiService.updatePlot(selectedPlot.id, {
        plotNumber: editPlotNumber.trim(),
        dimensions: editPlotDimensions.trim(),
        areaSqFt: Number(editPlotAreaSqFt) || 1200,
        facing: editPlotFacing,
        price: Number(editPlotPrice) || 0,
        ...(editPlotStatus === 'Available' ? { status: editPlotStatus } : {}),
        notes: editPlotNotes.trim(),
      });
      if (success) {
        setIsEditPlotModalOpen(false);
        setSelectedPlot(null);
        await loadData(selectedProject);
      } else {
        alert('Failed to update plot. Please verify inputs.');
      }
    } catch (err) {
      console.error('Error updating plot', err);
      alert('Error communicating with server.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleOpenDeletePlot = (plot: any) => {
    setSelectedPlot(plot);
    setIsDeletePlotModalOpen(true);
  };

  const handleConfirmDeletePlot = async () => {
    if (!selectedPlot) return;
    setSubmittingDelete(true);
    try {
      const success = await jaminApiService.deletePlot(selectedPlot.id);
      if (success) {
        setIsDeletePlotModalOpen(false);
        setSelectedPlot(null);
        await loadData(selectedProject);
      } else {
        alert('Failed to delete plot. It may have active bookings.');
      }
    } catch (err) {
      console.error('Error deleting plot', err);
      alert('Error communicating with server.');
    } finally {
      setSubmittingDelete(false);
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
            Visual plot layout, availability status, and reservation management.
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
          Loading plots for selected project...
        </div>
      ) : projectPlots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '16px' }}>No plots have been added to this project yet.</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setNewPlotProjectId(selectedProject || (projects[0]?.id ? String(projects[0].id) : ''));
              setIsAddPlotModalOpen(true);
            }}
          >
            <Plus size={16} /> Add Plot
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
                style={{ position: 'relative' }}
              >
                <div className="plot-card-header">
                  <span className="plot-number-title">
                    {plot.plotNumber}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusChip status={plot.status} size="sm" />
                  </div>
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
                    {price > 0 ? formatCurrency(price) : '—'}
                  </span>
                  {rate > 0 && (
                    <span className="plot-sqft-rate">
                      @ ₹{rate}/sqft
                    </span>
                  )}
                </div>

                {isHold && (
                  <div className="plot-hold-badge">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span>🔒 Held for <strong>{plot.heldByCustomerName || '—'}</strong></span>
                      <button
                        title="Confirm Booking"
                        onClick={e => {
                          e.stopPropagation();
                          handleOpenBooking(plot);
                        }}
                        style={{
                          background: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Book
                      </button>
                    </div>
                    {plot.holdExpiresAt && (
                      <div style={{ marginTop: 2 }}>Expiry: {new Date(plot.holdExpiresAt).toLocaleDateString()}</div>
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
        isOpen={!!selectedPlot && !isHoldModalOpen && !isBookingModalOpen && !isEditPlotModalOpen && !isDeletePlotModalOpen}
        onClose={() => setSelectedPlot(null)}
        title={`${selectedPlot?.plotNumber} Specifications`}
        subtitle={`${currentProjectObj?.name || 'Project Layout'}`}
        footer={
          <>
            {selectedPlot?.status === 'Available' && (
              <>
                <button
                  className="btn btn-primary plot-hold-btn-gold"
                  onClick={() => handleOpenHold(selectedPlot)}
                >
                  Put Plot on Hold
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleOpenBooking(selectedPlot)}
                  style={{ backgroundColor: '#10b981', borderColor: '#059669', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  ✓ Confirm Booking
                </button>
              </>
            )}

            {selectedPlot?.status === 'Hold' && (
              <>
                <button
                  className="btn btn-primary"
                  onClick={() => handleOpenBooking(selectedPlot)}
                  style={{ backgroundColor: '#10b981', borderColor: '#059669', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  ✓ Confirm to Book
                </button>
                <button
                  className="btn btn-secondary plot-release-btn"
                  onClick={() => handleReleaseHold(selectedPlot)}
                >
                  Release Hold to Available
                </button>
              </>
            )}

            {canManagePlots && selectedPlot && (
              <>
                <button
                  className="btn btn-secondary"
                  title="Edit Plot"
                  aria-label="Edit Plot"
                  onClick={() => handleOpenEditPlot(selectedPlot)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px' }}
                >
                  <Edit3 size={14} />
                </button>
                <button
                  className="btn btn-secondary"
                  title="Delete Plot"
                  aria-label="Delete Plot"
                  onClick={() => handleOpenDeletePlot(selectedPlot)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', color: '#b91c1c' }}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}

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
                <div className="plot-detail-val">{selectedPlot.dimensions || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total Area:</span>
                <div className="plot-detail-val">
                  {(selectedPlot.areaSqFt || selectedPlot.sizeSqft) ? `${selectedPlot.areaSqFt || selectedPlot.sizeSqft} sq.ft` : '—'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Facing:</span>
                <div className="plot-detail-val">{selectedPlot.facing || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Price per Sq.Ft:</span>
                <div className="plot-detail-val">
                  {selectedPlot.pricePerSqft
                    ? `₹${Number(selectedPlot.pricePerSqft).toLocaleString('en-IN')}/sq.ft`
                    : selectedPlot.areaSqFt > 0 && selectedPlot.price > 0
                      ? `₹${Math.round(selectedPlot.price / selectedPlot.areaSqFt).toLocaleString('en-IN')}/sq.ft`
                      : '—'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total Plot Price:</span>
                <div className="plot-detail-price">
                  {(selectedPlot.price || selectedPlot.totalPrice) > 0
                    ? formatCurrency(selectedPlot.price || selectedPlot.totalPrice)
                    : '—'}
                </div>
              </div>
              {selectedPlot.notes && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Notes:</span>
                  <div className="plot-detail-val">{selectedPlot.notes}</div>
                </div>
              )}
            </div>

            {selectedPlot.status === 'Hold' && (
              <div className="plot-hold-detail-box">
                <div className="plot-hold-detail-title">
                  Active Hold Reservation Details
                </div>
                <div>Customer: <strong>{selectedPlot.heldByCustomerName || '—'}</strong></div>
                <div>Phone: <strong>{selectedPlot.heldByCustomerPhone || '—'}</strong></div>
                {selectedPlot.holdByAgent && <div>Held By Agent: <strong>{selectedPlot.holdByAgent}</strong></div>}
                <div>Expiry: <strong>{selectedPlot.holdExpiresAt ? new Date(selectedPlot.holdExpiresAt).toLocaleDateString() : '—'}</strong></div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Place on Hold Form Modal */}
      <Modal
        isOpen={isHoldModalOpen && !!selectedPlot}
        onClose={() => setIsHoldModalOpen(false)}
        title={`Place ${selectedPlot?.plotNumber} on Hold`}
        subtitle="Reserve plot for a Customer, Lead, or Custom contact"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsHoldModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirmHold} disabled={submittingHold}>
              {submittingHold ? 'Saving Reservation...' : 'Confirm Hold Reservation'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Link Reservation To</label>
            <div className="hold-source-tabs">
              <button
                type="button"
                className={`hold-source-tab ${holdSourceType === 'customer' ? 'active' : ''}`}
                onClick={() => handleSourceTypeChange('customer')}
              >
                Customer
              </button>
              <button
                type="button"
                className={`hold-source-tab ${holdSourceType === 'lead' ? 'active' : ''}`}
                onClick={() => handleSourceTypeChange('lead')}
              >
                Lead
              </button>
              <button
                type="button"
                className={`hold-source-tab ${holdSourceType === 'custom' ? 'active' : ''}`}
                onClick={() => handleSourceTypeChange('custom')}
              >
                Custom
              </button>
            </div>
          </div>

          {holdSourceType === 'customer' && (
            <>
              <div className="form-group">
                <label className="form-label">Select Customer *</label>
                <select
                  className="form-select"
                  value={selectedCustomerId}
                  onChange={handleCustomerChange}
                >
                  <option value="">-- Choose Existing Customer --</option>
                  {effectiveCustomersList.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {holdCustomer && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Customer Name</label>
                    <input type="text" className="form-input" value={holdCustomer} readOnly />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer Phone</label>
                    <input type="text" className="form-input" value={holdPhone} readOnly />
                  </div>
                </div>
              )}
            </>
          )}

          {holdSourceType === 'lead' && (
            <>
              <div className="form-group">
                <label className="form-label">Select Lead *</label>
                <select
                  className="form-select"
                  value={selectedLeadId}
                  onChange={handleLeadChange}
                >
                  <option value="">-- Choose Existing Lead --</option>
                  {availableLeadsList.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.phone ? `(${l.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {holdCustomer && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Lead Name</label>
                    <input type="text" className="form-input" value={holdCustomer} readOnly />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lead Phone</label>
                    <input type="text" className="form-input" value={holdPhone} readOnly />
                  </div>
                </div>
              )}
            </>
          )}

          {holdSourceType === 'custom' && (
            <>
              <div className="form-group">
                <label className="form-label">Client Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={holdCustomer}
                  onChange={e => setHoldCustomer(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Client Phone Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  required
                  value={holdPhone}
                  onChange={e => setHoldPhone(e.target.value)}
                />
              </div>
            </>
          )}

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

      {/* Confirm Booking Modal */}
      <Modal
        isOpen={isBookingModalOpen && !!selectedPlot}
        onClose={() => setIsBookingModalOpen(false)}
        title={`Confirm Booking — ${selectedPlot?.plotNumber}`}
        subtitle={`Confirm plot sale & register customer into CRM for ${currentProjectObj?.name || 'Project'}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsBookingModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirmBooking}
              disabled={submittingBooking}
              style={{ backgroundColor: '#10b981', borderColor: '#059669' }}
            >
              {submittingBooking ? 'Confirming Booking...' : '✓ Confirm & Book Plot'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Plot:</span>
              <strong>{selectedPlot?.plotNumber} ({selectedPlot?.areaSqFt || selectedPlot?.sizeSqft || 0} sq.ft)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Plot Price:</span>
              <strong style={{ color: '#059669' }}>{formatCurrency(selectedPlot?.price || selectedPlot?.totalPrice)}</strong>
            </div>
          </div>

          {/* Buyer selection tabs: Customer, Lead, Custom */}
          <div className="form-group">
            <label className="form-label">Link Buyer To</label>
            <div className="hold-source-tabs">
              <button
                type="button"
                className={`hold-source-tab ${bookingSourceType === 'customer' ? 'active' : ''}`}
                onClick={() => handleBookingSourceTypeChange('customer')}
              >
                Customer
              </button>
              <button
                type="button"
                className={`hold-source-tab ${bookingSourceType === 'lead' ? 'active' : ''}`}
                onClick={() => handleBookingSourceTypeChange('lead')}
              >
                Lead
              </button>
              <button
                type="button"
                className={`hold-source-tab ${bookingSourceType === 'custom' ? 'active' : ''}`}
                onClick={() => handleBookingSourceTypeChange('custom')}
              >
                Custom
              </button>
            </div>
          </div>

          {bookingSourceType === 'customer' && (
            <>
              <div className="form-group">
                <label className="form-label">Select Customer *</label>
                <select
                  className="form-select"
                  value={selectedBookingCustomerId}
                  onChange={handleBookingCustomerChange}
                >
                  <option value="">-- Choose Existing Customer --</option>
                  {effectiveCustomersList.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {bookingCustomerName && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Customer Name</label>
                    <input type="text" className="form-input" value={bookingCustomerName} readOnly />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer Phone</label>
                    <input type="text" className="form-input" value={bookingCustomerPhone} readOnly />
                  </div>
                </div>
              )}
            </>
          )}

          {bookingSourceType === 'lead' && (
            <>
              <div className="form-group">
                <label className="form-label">Select Lead *</label>
                <select
                  className="form-select"
                  value={selectedBookingLeadId}
                  onChange={handleBookingLeadChange}
                >
                  <option value="">-- Choose Existing Lead --</option>
                  {availableLeadsList.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.phone ? `(${l.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {bookingCustomerName && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Lead Name</label>
                    <input type="text" className="form-input" value={bookingCustomerName} readOnly />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lead Phone</label>
                    <input type="text" className="form-input" value={bookingCustomerPhone} readOnly />
                  </div>
                </div>
              )}
            </>
          )}

          {bookingSourceType === 'custom' && (
            <>
              <div className="form-group">
                <label className="form-label">Buyer Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={bookingCustomerName}
                  onChange={e => setBookingCustomerName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Buyer Phone Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  required
                  value={bookingCustomerPhone}
                  onChange={e => setBookingCustomerPhone(e.target.value)}
                />
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Token Advance (₹) <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}></span></label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={bookingTokenAmount ?? ''}
                onChange={e => setBookingTokenAmount(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Total Agreement Value (₹) <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}></span></label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={bookingTotalAgreementValue ?? ''}
                onChange={e => setBookingTotalAgreementValue(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <select
              className="form-select"
              value={bookingPaymentMode}
              onChange={e => setBookingPaymentMode(e.target.value)}
            >
              <option value="">-- Select Payment Mode --</option>
              <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="Cheque / DD">Cheque / Demand Draft</option>
              <option value="UPI / Online">UPI / Online Gateway</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Terms / Milestone Schedule <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}></span></label>
            <input
              type="text"
              className="form-input"
              value={bookingPaymentTerms}
              onChange={e => setBookingPaymentTerms(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">General Notes & Remarks</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={bookingNotes}
              onChange={e => setBookingNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Edit Plot Modal */}
      <Modal
        isOpen={isEditPlotModalOpen && !!selectedPlot}
        onClose={() => setIsEditPlotModalOpen(false)}
        title={`Edit Plot — ${selectedPlot?.plotNumber}`}
        subtitle="Update plot specifications and inventory details"
      >
        <form onSubmit={handleSaveEditPlot}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Plot Number *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={editPlotNumber}
                  onChange={e => setEditPlotNumber(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Dimensions</label>
                <input
                  type="text"
                  className="form-input"
                  value={editPlotDimensions}
                  onChange={e => setEditPlotDimensions(e.target.value)}
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
                  value={editPlotAreaSqFt}
                  onChange={e => setEditPlotAreaSqFt(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Facing Direction</label>
                <select
                  className="form-select"
                  value={editPlotFacing}
                  onChange={e => setEditPlotFacing(e.target.value)}
                >
                  <option value="East">East</option>
                  <option value="North">North</option>
                  <option value="North-East">North-East (Corner)</option>
                  <option value="West">West</option>
                  <option value="South">South</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Total Plot Price (₹) *</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  min={1}
                  value={editPlotPrice}
                  onChange={e => setEditPlotPrice(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={editPlotStatus}
                  onChange={e => setEditPlotStatus(e.target.value)}
                  disabled={editPlotStatus !== 'Available'}
                >
                  <option value="Available">Available</option>
                  {editPlotStatus !== 'Available' && (
                    <option value={editPlotStatus}>{editPlotStatus} (booking controlled)</option>
                  )}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input
                type="text"
                className="form-input"
                value={editPlotNotes}
                onChange={e => setEditPlotNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsEditPlotModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingEdit}>
                {submittingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Plot Confirmation Modal */}
      <Modal
        isOpen={isDeletePlotModalOpen && !!selectedPlot}
        onClose={() => setIsDeletePlotModalOpen(false)}
        title="Delete Plot"
        subtitle="This action cannot be undone"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsDeletePlotModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirmDeletePlot}
              disabled={submittingDelete}
              style={{ background: '#dc2626', borderColor: '#dc2626' }}
            >
              {submittingDelete ? 'Deleting...' : 'Yes, Delete Plot'}
            </button>
          </>
        }
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Trash2 size={48} style={{ color: '#dc2626', margin: '0 auto 16px auto' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>
            Delete <strong>{selectedPlot?.plotNumber}</strong>?
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
            This will permanently remove the plot from the project inventory.
            Plots with active bookings cannot be deleted.
          </p>
        </div>
      </Modal>

      {/* Add New Plot Modal */}
      <Modal
        isOpen={isAddPlotModalOpen}
        onClose={() => setIsAddPlotModalOpen(false)}
        title="Add New Plot to Inventory"
        subtitle="Add an individual plot to the project inventory"
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
                />
              </div>

              <div className="form-group">
                <label className="form-label">Dimensions</label>
                <input
                  type="text"
                  className="form-input"
                  value={newPlotDimensions}
                  onChange={e => setNewPlotDimensions(e.target.value)}
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
              <label className="form-label">Notes</label>
              <input
                type="text"
                className="form-input"
                value={newPlotNotes}
                onChange={e => setNewPlotNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsAddPlotModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingPlot}>
                {submittingPlot ? 'Adding Plot...' : 'Add Plot'}
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
