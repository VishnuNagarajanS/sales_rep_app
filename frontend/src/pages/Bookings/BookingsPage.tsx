import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Plus, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import { jaminApiService } from '../../services/jaminApiService';
import { getCustomers, getLeads } from '../../services/ghlApiService';
import { storageService } from '../../services/storageService';
import './BookingsPage.css';

const PAYMENT_MODES = ['Bank Transfer / NEFT', 'RTGS', 'Cheque / DD', 'UPI / Online', 'Cash'];

export const BookingsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [plots, setPlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Unified Manage Status Modal State
  const [managingBooking, setManagingBooking] = useState<any | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [manageMode, setManageMode] = useState<'details' | 'status'>('details');
  const [manageStatus, setManageStatus] = useState<string>('');
  const [manageNote, setManageNote] = useState<string>('');
  const [manageTokenAmount, setManageTokenAmount] = useState<number>();
  const [managePaymentMode, setManagePaymentMode] = useState('');
  const [managePaymentModeOther, setManagePaymentModeOther] = useState('');
  const [managePaymentTerms, setManagePaymentTerms] = useState('');
  const [isSubmittingManage, setIsSubmittingManage] = useState(false);

  // Form State
  const [buyerSourceType, setBuyerSourceType] = useState<'customer' | 'lead' | 'custom'>('customer');
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedPlotId, setSelectedPlotId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tokenAmountPaid, setTokenAmountPaid] = useState<number>();
  const [totalPlotPrice, setTotalPlotPrice] = useState<number>();
  const [paymentMode, setPaymentMode] = useState('');
  const [paymentModeOther, setPaymentModeOther] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [bkgList, projList, plotList, custs, lds] = await Promise.all([
        jaminApiService.getBookings(),
        jaminApiService.getProjects(),
        jaminApiService.getPlots(),
        getCustomers(tenant?.id).catch(() => storageService.getCustomers(tenant?.id) || []),
        getLeads(tenant?.id).catch(() => storageService.getLeads(tenant?.id) || []),
      ]);
      setBookings(bkgList);
      setProjects(projList);
      setPlots(plotList);
      setCustomersList(custs || []);
      setLeadsList(lds || []);
    } catch (err) {
      console.error('Failed to load bookings from backend', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  // When project changes in the form, reset plot selection
  const handleProjectSelect = (projId: string) => {
    setSelectedProjectId(projId);
    setSelectedPlotId('');
    setSelectedCustomerId('');
    setSelectedLeadId('');
    setTotalPlotPrice(undefined);
  };

  const handleBuyerSourceChange = (type: 'customer' | 'lead' | 'custom') => {
    setBuyerSourceType(type);
    setSelectedCustomerId('');
    setSelectedLeadId('');
    setCustomerName('');
    setCustomerPhone('');
  };

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const found = effectiveCustomersList.find(c => String(c.id) === String(custId));
    if (found) {
      setCustomerName(found.name || '');
      setCustomerPhone(found.phone || '');
    } else {
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  const handleLeadSelect = (leadId: string) => {
    setSelectedLeadId(leadId);
    const found = availableLeadsList.find(l => String(l.id) === String(leadId));
    if (found) {
      setCustomerName(found.name || '');
      setCustomerPhone(found.phone || '');
    } else {
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  // When plot is selected, auto-populate the total price and match customer/lead if held
  const handlePlotSelect = (plotId: string) => {
    setSelectedPlotId(plotId);
    const chosenPlot = plots.find(p => String(p.id) === String(plotId));
    if (chosenPlot) {
      setTotalPlotPrice(chosenPlot.price || chosenPlot.totalPrice || 0);
      const heldPhone = (chosenPlot.heldByCustomerPhone || chosenPlot.holdPhone || '').trim();
      const heldName = (chosenPlot.heldByCustomerName || chosenPlot.holdCustomer || '').trim();

      if (chosenPlot.heldByCustomerId) {
        setBuyerSourceType('customer');
        setSelectedCustomerId(String(chosenPlot.heldByCustomerId));
        setSelectedLeadId('');
        const matched = effectiveCustomersList.find(c => String(c.id) === String(chosenPlot.heldByCustomerId));
        setCustomerName(matched?.name || heldName);
        setCustomerPhone(matched?.phone || heldPhone);
      } else if (heldPhone) {
        const matchedCustomer = effectiveCustomersList.find(c => c.phone && c.phone.trim() === heldPhone);
        const matchedLead = leadsList.find(l => l.phone && l.phone.trim() === heldPhone);
        if (matchedCustomer || (matchedLead && (matchedLead.status || '').toLowerCase() === 'converted')) {
          const person = matchedCustomer || matchedLead;
          setBuyerSourceType('customer');
          setSelectedCustomerId(String(person.id));
          setSelectedLeadId('');
          setCustomerName(person.name || heldName);
          setCustomerPhone(person.phone || heldPhone);
        } else if (matchedLead) {
          setBuyerSourceType('lead');
          setSelectedCustomerId('');
          setSelectedLeadId(String(matchedLead.id));
          setCustomerName(matchedLead.name || heldName);
          setCustomerPhone(matchedLead.phone || heldPhone);
        } else {
          setBuyerSourceType('custom');
          setSelectedCustomerId('');
          setSelectedLeadId('');
          setCustomerName(heldName);
          setCustomerPhone(heldPhone);
        }
      } else if (heldName) {
        const matchedCustomer = effectiveCustomersList.find(c => c.name && c.name.trim().toLowerCase() === heldName.toLowerCase());
        const matchedLead = leadsList.find(l => l.name && l.name.trim().toLowerCase() === heldName.toLowerCase());
        if (matchedCustomer || (matchedLead && (matchedLead.status || '').toLowerCase() === 'converted')) {
          const person = matchedCustomer || matchedLead;
          setBuyerSourceType('customer');
          setSelectedCustomerId(String(person.id));
          setSelectedLeadId('');
          setCustomerName(person.name || heldName);
          setCustomerPhone(person.phone || '');
        } else {
          setBuyerSourceType('custom');
          setSelectedCustomerId('');
          setSelectedLeadId('');
          setCustomerName(heldName);
        }
      }
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      alert('Buyer Name and Phone are required.');
      return;
    }

    const selectedProj = projects.find(p => String(p.id) === String(selectedProjectId));
    const selectedPlt = plots.find(p => String(p.id) === String(selectedPlotId));

    setSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomerId ? parseInt(selectedCustomerId, 10) : (selectedPlt?.heldByCustomerId ? parseInt(String(selectedPlt.heldByCustomerId), 10) : undefined),
        leadId: selectedLeadId ? parseInt(selectedLeadId, 10) : undefined,
        projectId: selectedProjectId ? parseInt(selectedProjectId, 10) : undefined,
        plotId: selectedPlotId ? parseInt(selectedPlotId, 10) : undefined,
        projectName: selectedProj?.name || '',
        plotNumber: selectedPlt?.plotNumber || '',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        totalPlotPrice: totalPlotPrice || selectedPlt?.price || 0,
        tokenAmountPaid: tokenAmountPaid || 0,
        paymentMode: paymentMode === 'Other' ? paymentModeOther.trim() : paymentMode,
        paymentTerms: paymentTerms.trim(),
        notes,
      };

      const success = await jaminApiService.createBooking(payload);
      if (success) {
        setIsNewBookingModalOpen(false);
        // Reset form
        setCustomerName('');
        setCustomerPhone('');
        setSelectedProjectId('');
        setSelectedPlotId('');
        setSelectedCustomerId('');
        setSelectedLeadId('');
        setTokenAmountPaid(undefined);
        setTotalPlotPrice(undefined);
        setPaymentMode('');
        setPaymentModeOther('');
        setPaymentTerms('');
        setNotes('');
        await loadData();
      } else {
        alert('Unable to create the booking. Please check plot availability.');
      }
    } catch (err) {
      console.error('Booking submission error', err);
      alert('Unable to create the booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenManageModal = (b: any, requestedStatus?: string) => {
    setManagingBooking(b);
    setManageMode('details');
    setManageStatus(b.status || 'Token Paid');
    setManageNote(b.notes || '');
    setManageTokenAmount(b.tokenAmountPaid ?? b.bookingAmount ?? 0);
    const savedPaymentMode = b.paymentMode || '';
    setManagePaymentMode(PAYMENT_MODES.includes(savedPaymentMode) ? savedPaymentMode : savedPaymentMode ? 'Other' : '');
    setManagePaymentModeOther(PAYMENT_MODES.includes(savedPaymentMode) ? '' : savedPaymentMode);
    setManagePaymentTerms(b.paymentTerms || '');
    setIsManageModalOpen(true);
  };

  const handleSaveManageBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingBooking || !manageStatus) return;
    setIsSubmittingManage(true);
    try {
      const trimmedNote = manageNote.trim();
      const success = await jaminApiService.updateBookingStatus(
        managingBooking.id,
        manageStatus,
        trimmedNote,
        manageMode === 'details' ? {
          tokenAmountPaid: manageTokenAmount,
          paymentMode: managePaymentMode === 'Other' ? managePaymentModeOther.trim() : managePaymentMode.trim(),
          paymentTerms: managePaymentTerms.trim(),
        } : undefined
      );
      if (success) {
        setIsManageModalOpen(false);
        if (selectedBooking && String(selectedBooking.id) === String(managingBooking.id)) {
          setSelectedBooking((prev: any) => prev ? {
            ...prev,
            status: manageStatus,
            ...(manageMode === 'details' ? {
              tokenAmountPaid: manageTokenAmount,
              paymentMode: managePaymentMode,
              paymentTerms: managePaymentTerms,
            } : {}),
            notes: trimmedNote || prev.notes,
          } : null);
        }
        setManagingBooking(null);
        window.dispatchEvent(new Event('nexus_storage_updated'));
        await loadData();
      } else {
        alert('Failed to update booking status.');
      }
    } catch (err) {
      console.error('Error updating booking', err);
      alert('Unable to update the booking. Please try again.');
    } finally {
      setIsSubmittingManage(false);
    }
  };

  const getAvailableStatusOptions = (currentStatus?: string) => {
    return [
      { value: 'Token Paid', label: 'Token Paid' },
      { value: 'Agreement Signed', label: 'Agreement Signed' },
      { value: 'Registration Completed', label: 'Registration Completed' },
      { value: 'Cancelled', label: 'Cancelled' },
    ];
  };

  const handleStatusChange = async (bookingId: number | string, newStatus: string) => {
    try {
      const success = await jaminApiService.updateBookingStatus(bookingId, newStatus);
      if (success) {
        await loadData();
        if (selectedBooking && String(selectedBooking.id) === String(bookingId)) {
          setSelectedBooking((prev: any) => prev ? { ...prev, status: newStatus } : null);
        }
      } else {
        alert('Failed to update booking status.');
      }
    } catch (err) {
      console.error('Error updating status', err);
    }
  };

  const formatCurrency = (val?: number) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const filteredPlotsForProject = selectedProjectId
    ? plots.filter(p => String(p.projectId) === String(selectedProjectId) && (p.status === 'Available' || p.status === 'Hold'))
    : plots.filter(p => p.status === 'Available' || p.status === 'Hold');

  const columns: Column<any>[] = [
    {
      key: 'plotNumber',
      header: 'Plot & Community',
      sortable: true,
      render: b => (
        <div>
          <div className="booking-plot-number" style={{ fontWeight: 700, color: '#0f172a' }}>{b.plotNumber || 'Plot'}</div>
          <div className="booking-project-name" style={{ fontSize: '0.8rem', color: '#64748b' }}>{b.projectName || 'Jamin Project'}</div>
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Buyer Information',
      sortable: true,
      render: b => (
        <div>
          <div className="booking-customer-name" style={{ fontWeight: 600 }}>{b.customerName}</div>
          <div className="booking-customer-phone" style={{ fontSize: '0.8rem', color: '#64748b' }}>{b.customerPhone}</div>
        </div>
      ),
    },
    {
      key: 'tokenAmountPaid',
      header: 'Token Paid',
      sortable: true,
      render: b => <span className="booking-token-amount" style={{ fontWeight: 700, color: '#059669' }}>{formatCurrency(b.tokenAmountPaid || b.bookingAmount)}</span>,
    },
    {
      key: 'totalPlotPrice',
      header: 'Total Sale Value',
      sortable: true,
      render: b => <span className="booking-total-amount" style={{ fontWeight: 700 }}>{formatCurrency(b.totalPlotPrice || b.totalAmount)}</span>,
    },
    {
      key: 'bookingDate',
      header: 'Date',
      sortable: true,
      render: b => (
        <span style={{ fontSize: '0.85rem' }}>
          {b.bookingDate ? new Date(b.bookingDate).toLocaleDateString() : 'Recent'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status & Remarks',
      sortable: true,
      render: b => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '150px', maxWidth: '240px', width: '100%', textAlign: 'center' }}>
          <StatusChip status={b.status || 'Token Paid'} size="sm" />
          {b.notes ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontStyle: 'italic', wordBreak: 'break-word', lineHeight: 1.35 }} title={b.notes}>
              "{b.notes}"
            </div>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="bookings-page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">
            <CheckCircle size={24} color="#059669" /> Plot Bookings & Contracts
          </h1>
          <p className="page-subtitle">
            Bookings, token receipts, and registration contracts for {tenant?.name}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-primary" onClick={() => setIsNewBookingModalOpen(true)}>
            <Plus size={15} /> Formalize New Booking
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={bookings}
        loading={loading}
        keyExtractor={b => String(b.id)}
        rowActions={[
          {
            label: 'Update Status',
            onClick: b => handleOpenManageModal(b, '__status__'),
          },
          {
            label: 'Edit Details',
            onClick: b => handleOpenManageModal(b),
          },
          {
            label: 'Documents',
            icon: <FileText size={14} />,
            onClick: b => setSelectedBooking(b),
          },
        ]}
        searchPlaceholder="Search bookings by customer, plot, or date..."
        onRowClick={b => setSelectedBooking(b)}
      />

      {/* Booking Documents Drawer */}
      <Drawer
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        title={selectedBooking ? `Booking: ${selectedBooking.plotNumber || 'Plot'}` : ''}
        subtitle={selectedBooking ? `${selectedBooking.customerName} • ${selectedBooking.bookingDate ? new Date(selectedBooking.bookingDate).toLocaleDateString() : ''}` : ''}
        width={520}
      >
        {selectedBooking && (
          <div className="booking-drawer-content">
            <div className="card booking-drawer-card" style={{ marginBottom: '16px', padding: '16px' }}>
              <h4 className="booking-drawer-section-title" style={{ fontWeight: 600, marginBottom: '10px' }}>
                Booking Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Project:</span>
                  <div style={{ fontWeight: 600 }}>{selectedBooking.projectName || 'Jamin Community'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Status:</span>
                  <div><StatusChip status={selectedBooking.status || 'Token Paid'} size="sm" /></div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Token Paid:</span>
                  <div style={{ fontWeight: 700, color: '#059669' }}>{formatCurrency(selectedBooking.tokenAmountPaid || selectedBooking.bookingAmount)}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Total Sale Value:</span>
                  <div style={{ fontWeight: 700 }}>{formatCurrency(selectedBooking.totalPlotPrice || selectedBooking.totalAmount)}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Payment Mode:</span>
                  <div>{selectedBooking.paymentMode}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Assigned Agent:</span>
                  <div>{selectedBooking.assignedAgentName || user?.name || 'Agent'}</div>
                </div>
                {selectedBooking.paymentTerms && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: '#64748b' }}>Payment Terms / Milestones:</span>
                    <div style={{ fontWeight: 600, color: '#0f172a', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', marginTop: '2px' }}>
                      {selectedBooking.paymentTerms}
                    </div>
                  </div>
                )}
              </div>
              {selectedBooking.notes && (
                <div style={{ marginTop: '12px', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b' }}>Notes:</span>
                  <p style={{ marginTop: '4px', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>{selectedBooking.notes}</p>
                </div>
              )}
              {(
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '14px', width: '100%', fontWeight: 600, padding: '7px 12px' }}
                  onClick={() => handleOpenManageModal(selectedBooking)}
                >
                  Edit Booking Details
                </button>
              )}
            </div>

            <div className="card booking-drawer-card">
              <h4 className="booking-drawer-section-title">
                Booking Documents
              </h4>
              <DocumentUploader
                entityType="booking"
                entityId={String(selectedBooking.id)}
                allowedCategories={['Token Receipt', 'Sale Agreement', 'Registration Doc', 'Payment Proof', 'Other']}
              />
            </div>
            <DocumentList
              entityType="booking"
              entityId={String(selectedBooking.id)}
              canDelete
            />
          </div>
        )}
      </Drawer>

      {/* New Booking Modal */}
      <Modal
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        title="Formalize Plot Booking Agreement"
        subtitle=""
      >
        <form onSubmit={handleCreateBooking} className="booking-form">
          <div className="booking-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Project *</label>
              <select
                className="form-select"
                required
                value={selectedProjectId}
                onChange={e => handleProjectSelect(e.target.value)}
              >
                <option value="">-- Select Project --</option>
                {projects.map(p => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} ({p.location})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Plot Number *</label>
              <select
                className="form-select"
                required
                value={selectedPlotId}
                onChange={e => handlePlotSelect(e.target.value)}
                disabled={!selectedProjectId}
              >
                <option value="">{selectedProjectId ? '-- Select Available/Held Plot --' : '-- First Select Project --'}</option>
                {filteredPlotsForProject.map(p => (
                  <option key={p.id} value={String(p.id)}>
                    {p.plotNumber} - {p.areaSqFt || p.sizeSqft} sq.ft ({p.status}) - ₹{(p.price / 100000).toFixed(2)}L
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Buyer selection tabs: Customer, Lead, Custom */}
          <div className="form-group">
            <label className="form-label">Link Buyer To</label>
            <div className="booking-source-tabs">
              <button
                type="button"
                className={`booking-source-tab ${buyerSourceType === 'customer' ? 'active' : ''}`}
                onClick={() => handleBuyerSourceChange('customer')}
              >
                Customer
              </button>
              <button
                type="button"
                className={`booking-source-tab ${buyerSourceType === 'lead' ? 'active' : ''}`}
                onClick={() => handleBuyerSourceChange('lead')}
              >
                Lead
              </button>
              <button
                type="button"
                className={`booking-source-tab ${buyerSourceType === 'custom' ? 'active' : ''}`}
                onClick={() => handleBuyerSourceChange('custom')}
              >
                Custom
              </button>
            </div>
          </div>

          {buyerSourceType === 'customer' && (
            <>
              <div className="form-group">
                <label className="form-label">Select Customer *</label>
                <select
                  className="form-select"
                  value={selectedCustomerId}
                  onChange={e => handleCustomerSelect(e.target.value)}
                >
                  <option value="">-- Choose Existing Customer --</option>
                  {effectiveCustomersList.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {customerName && (
                <div className="booking-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Customer Name</label>
                    <input type="text" className="form-input" value={customerName} readOnly />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer Phone</label>
                    <input type="text" className="form-input" value={customerPhone} readOnly />
                  </div>
                </div>
              )}
            </>
          )}

          {buyerSourceType === 'lead' && (
            <>
              <div className="form-group">
                <label className="form-label">Select Lead *</label>
                <select
                  className="form-select"
                  value={selectedLeadId}
                  onChange={e => handleLeadSelect(e.target.value)}
                >
                  <option value="">-- Choose Existing Lead --</option>
                  {availableLeadsList.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.phone ? `(${l.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {customerName && (
                <div className="booking-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Lead Name</label>
                    <input type="text" className="form-input" value={customerName} readOnly />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lead Phone</label>
                    <input type="text" className="form-input" value={customerPhone} readOnly />
                  </div>
                </div>
              )}
            </>
          )}

          {buyerSourceType === 'custom' && (
            <div className="booking-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Buyer Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Buyer Phone *</label>
                <input
                  type="tel"
                  className="form-input"
                  required
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="booking-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Token Advance (₹) <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}></span></label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={tokenAmountPaid ?? ''}
                onChange={e => setTokenAmountPaid(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Agreement Value (₹) <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}></span></label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={totalPlotPrice ?? ''}
                onChange={e => setTotalPlotPrice(e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <select
              className="form-select"
              value={paymentMode}
              onChange={e => {
                setPaymentMode(e.target.value);
                if (e.target.value !== 'Other') setPaymentModeOther('');
              }}
            >
              <option value="">-- Select Payment Mode --</option>
              {PAYMENT_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
              <option value="Other">Other</option>
            </select>
            {paymentMode === 'Other' && (
              <input
                className="form-input"
                style={{ marginTop: 8 }}
                value={paymentModeOther}
                onChange={e => setPaymentModeOther(e.target.value)}
                placeholder="Enter payment mode"
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Payment Terms / Milestone Schedule <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)' }}></span></label>
            <input
              type="text"
              className="form-input"
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">General Notes & Remarks</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="booking-form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsNewBookingModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating Booking...' : 'Confirm & Mark Plot Booked'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Unified Manage Booking Status Modal */}
      <Modal
        isOpen={isManageModalOpen && !!managingBooking}
        onClose={() => setIsManageModalOpen(false)}
        title={`Edit Booking: ${managingBooking?.plotNumber || 'Plot'}`}
        subtitle={`Update booking details and status for ${managingBooking?.customerName || ''}`}
        size="md"
      >
        <form onSubmit={handleSaveManageBooking} className="booking-form">
          {/* Booking Summary Card */}
          <div className="booking-summary-card">
            <div className="booking-summary-row">
              <span className="booking-summary-label">Buyer:</span>
              <span className="booking-summary-val">{managingBooking?.customerName} ({managingBooking?.customerPhone})</span>
            </div>
            <div className="booking-summary-row">
              <span className="booking-summary-label">Project / Plot:</span>
              <span className="booking-summary-val">{managingBooking?.projectName || 'Project'} · Plot {managingBooking?.plotNumber}</span>
            </div>
            <div className="booking-summary-row">
              <span className="booking-summary-label">Token Paid / Total Value:</span>
              <span className="booking-summary-val" style={{ color: '#059669' }}>
                {formatCurrency(managingBooking?.tokenAmountPaid || managingBooking?.bookingAmount)} of {formatCurrency(managingBooking?.totalPlotPrice || managingBooking?.totalAmount)}
              </span>
            </div>
            <div className="booking-summary-row">
              <span className="booking-summary-label">Current Status:</span>
              <span className="booking-summary-val"><StatusChip status={managingBooking?.status || 'Token Paid'} size="sm" /></span>
            </div>
          </div>

          {manageMode === 'details' && (
            <>
              <div className="form-group">
                <label className="form-label">Token Amount Paid (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  min={0}
                  max={managingBooking?.totalPlotPrice || managingBooking?.totalAmount || undefined}
                  value={manageTokenAmount ?? ''}
                  onChange={e => setManageTokenAmount(e.target.value === '' ? undefined : Number(e.target.value))}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                      <select
                        className="form-select"
                        value={managePaymentMode}
                        onChange={e => {
                          setManagePaymentMode(e.target.value);
                          if (e.target.value !== 'Other') setManagePaymentModeOther('');
                        }}
                      >
                        <option value="">-- Select Payment Mode --</option>
                        {PAYMENT_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                        <option value="Other">Other</option>
                      </select>
                      {managePaymentMode === 'Other' && (
                        <input
                          className="form-input"
                          style={{ marginTop: 8 }}
                          value={managePaymentModeOther}
                          onChange={e => setManagePaymentModeOther(e.target.value)}
                          placeholder="Enter payment mode"
                        />
                      )}
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Terms</label>
                  <input
                    className="form-input"
                    value={managePaymentTerms}
                    onChange={e => setManagePaymentTerms(e.target.value)}
                    placeholder="Installment or milestone terms"
                  />
                </div>
              </div>
            </>
          )}

          {manageMode === 'details' ? (
            <>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700, fontSize: '13px' }}>
                  Booking Status *
                </label>
                <select
                  className="form-select"
                  required
                  value={manageStatus}
                  onChange={e => setManageStatus(e.target.value)}
                  style={{ fontWeight: 600, fontSize: '13px', borderColor: 'var(--primary-500)' }}
                >
                  <option value="">-- Select Status to Proceed --</option>
                  {getAvailableStatusOptions(managingBooking?.status).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

            </>
          ) : null}

          {/* Dynamic Guidance Banner & Notes */}
          {manageStatus === 'Agreement Signed' && (
            <>
              <div className="booking-manage-banner agreement">
                <span>📄 <strong>Agreement Signed:</strong> Confirm that the official sale agreement has been signed by the buyer.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Agreement Remarks & Date / Document Ref</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={manageNote}
                  onChange={e => setManageNote(e.target.value)}
                  placeholder="e.g. Agreement executed on 15 Oct, Stamp duty paid, 30% milestone due next week..."
                />
              </div>
            </>
          )}

          {manageStatus === 'Registration Completed' && (
            <>
              <div className="booking-manage-banner registration">
                <span>🏛️ <strong>Registration Completed:</strong> Mark deed registration as completed. The plot will be permanently marked as Registered / Sold in inventory.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Registration Deed Number & Office Remarks</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={manageNote}
                  onChange={e => setManageNote(e.target.value)}
                  placeholder="e.g. Deed #REG-4091 at Sub-Registrar Office, all dues settled..."
                />
              </div>
            </>
          )}

          {manageStatus === 'Cancelled' && (
            <>
              <div className="booking-manage-banner cancelled">
                <span>⚠️ <strong>Booking Cancellation:</strong> This will cancel the booking and immediately release <strong>Plot {managingBooking?.plotNumber}</strong> back to <strong>Available</strong> inventory.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Cancellation *</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  required
                  value={manageNote}
                  onChange={e => setManageNote(e.target.value)}
                  placeholder="Why is this booking cancelled? (e.g. Buyer opted out, loan rejected, token refunded...)"
                />
              </div>
            </>
          )}

          {manageMode === 'details' && manageStatus !== 'Agreement Signed' && manageStatus !== 'Registration Completed' && (
            <div className="form-group">
              <label className="form-label">Booking Notes / Remarks</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={manageNote}
                onChange={e => setManageNote(e.target.value)}
                placeholder="Add booking remarks..."
              />
            </div>
          )}

          {/* Modal Actions */}
          <div className="booking-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsManageModalOpen(false)}
              disabled={isSubmittingManage}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmittingManage || !manageStatus}
              style={{
                backgroundColor:
                  manageStatus === 'Registration Completed'
                    ? '#059669'
                    : manageStatus === 'Cancelled'
                      ? '#dc2626'
                      : manageStatus === 'Agreement Signed'
                        ? '#2563eb'
                        : 'var(--primary-600, #4f46e5)',
                borderColor:
                  manageStatus === 'Registration Completed'
                    ? '#059669'
                    : manageStatus === 'Cancelled'
                      ? '#dc2626'
                      : manageStatus === 'Agreement Signed'
                        ? '#2563eb'
                        : 'var(--primary-600, #4f46e5)',
                color: '#ffffff',
                fontWeight: 600,
                opacity: !manageStatus ? 0.6 : 1,
                cursor: !manageStatus ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmittingManage
                ? 'Saving...'
                : 'Save Booking Details'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
