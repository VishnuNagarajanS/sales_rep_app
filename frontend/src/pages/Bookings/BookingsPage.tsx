import React, { useState, useEffect } from 'react';
import { CheckCircle, Plus, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import { jaminApiService } from '../../services/jaminApiService';
import './BookingsPage.css';

export const BookingsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [plots, setPlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedPlotId, setSelectedPlotId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tokenAmountPaid, setTokenAmountPaid] = useState<number>(100000);
  const [totalPlotPrice, setTotalPlotPrice] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState('Bank Transfer / NEFT');
  const [paymentTerms, setPaymentTerms] = useState('20% on Agreement, 80% on Registration / Bank Loan');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [bkgList, projList, plotList] = await Promise.all([
        jaminApiService.getBookings(),
        jaminApiService.getProjects(),
        jaminApiService.getPlots(),
      ]);
      setBookings(bkgList);
      setProjects(projList);
      setPlots(plotList);
    } catch (err) {
      console.error('Failed to load bookings from backend', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When project changes in the form, reset plot selection
  const handleProjectSelect = (projId: string) => {
    setSelectedProjectId(projId);
    setSelectedPlotId('');
    setTotalPlotPrice(0);
  };

  // When plot is selected, auto-populate the total price
  const handlePlotSelect = (plotId: string) => {
    setSelectedPlotId(plotId);
    const chosenPlot = plots.find(p => String(p.id) === String(plotId));
    if (chosenPlot) {
      setTotalPlotPrice(chosenPlot.price || chosenPlot.totalPrice || 0);
      if (chosenPlot.heldByCustomerName && !customerName) {
        setCustomerName(chosenPlot.heldByCustomerName);
      }
      if (chosenPlot.heldByCustomerPhone && !customerPhone) {
        setCustomerPhone(chosenPlot.heldByCustomerPhone);
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
        projectId: selectedProjectId ? parseInt(selectedProjectId, 10) : undefined,
        plotId: selectedPlotId ? parseInt(selectedPlotId, 10) : undefined,
        projectName: selectedProj?.name || '',
        plotNumber: selectedPlt?.plotNumber || '',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        totalPlotPrice: totalPlotPrice || selectedPlt?.price || 0,
        tokenAmountPaid: tokenAmountPaid || 0,
        paymentMode,
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
        setTokenAmountPaid(100000);
        setTotalPlotPrice(0);
        setPaymentTerms('20% on Agreement, 80% on Registration / Bank Loan');
        setNotes('');
        await loadData();
      } else {
        alert('Failed to create booking on the backend. Please check plot status.');
      }
    } catch (err) {
      console.error('Booking submission error', err);
      alert('Error creating booking on backend.');
    } finally {
      setSubmitting(false);
    }
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
      header: 'Status',
      sortable: true,
      render: b => <StatusChip status={b.status || 'Token Paid'} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: b => (
        <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
          {b.status === 'Token Paid' && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '3px 8px' }}
              onClick={() => handleStatusChange(b.id, 'Agreement Signed')}
            >
              Sign Agreement
            </button>
          )}
          {b.status === 'Agreement Signed' && (
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem', padding: '3px 8px' }}
              onClick={() => handleStatusChange(b.id, 'Registration Completed')}
            >
              Complete Reg.
            </button>
          )}
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
            Live database bookings, token receipts, and registry contracts for {tenant?.name}.
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
        keyExtractor={b => String(b.id)}
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
                  <div>{selectedBooking.paymentMode || 'NEFT / RTGS'}</div>
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
        subtitle="Confirm token payment and bind plot inventory directly in backend database"
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

          <div className="booking-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Buyer Full Name *</label>
              <input
                type="text"
                className="form-input"
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Brigadier H.S. Rathore"
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
                placeholder="e.g. 9876543210"
              />
            </div>
          </div>

          <div className="booking-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Token Advance (₹) *</label>
              <input
                type="number"
                className="form-input"
                required
                min={1}
                value={tokenAmountPaid}
                onChange={e => setTokenAmountPaid(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Agreement Value (₹) *</label>
              <input
                type="number"
                className="form-input"
                required
                min={1}
                value={totalPlotPrice}
                onChange={e => setTotalPlotPrice(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <select
              className="form-select"
              value={paymentMode}
              onChange={e => setPaymentMode(e.target.value)}
            >
              <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="Cheque / DD">Cheque / Demand Draft</option>
              <option value="UPI / Online">UPI / Online Gateway</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Terms / Milestone Schedule</label>
            <input
              type="text"
              className="form-input"
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
              placeholder="e.g. 20% on Agreement Signing, 80% on Registration / Bank Loan"
            />
          </div>

          <div className="form-group">
            <label className="form-label">General Notes & Remarks</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Buyer opted for HDFC Bank plot loan assistance."
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
    </div>
  );
};
