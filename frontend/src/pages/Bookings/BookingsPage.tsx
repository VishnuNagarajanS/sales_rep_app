import React, { useState, useEffect } from 'react';
import { CheckCircle, Plus } from 'lucide-react';
import { Booking, Plot, AuditLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import './BookingsPage.css';

const getStoredBookings = (companyId?: string): Booking[] => {
  try {
    const raw = localStorage.getItem('nexus_bookings');
    const all: Booking[] = raw ? JSON.parse(raw) : [];
    return companyId ? all.filter(b => b.companyId === companyId) : all;
  } catch {
    return [];
  }
};

const saveStoredBooking = (booking: Booking) => {
  try {
    const raw = localStorage.getItem('nexus_bookings');
    const all: Booking[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(b => b.id === booking.id);
    if (idx >= 0) all[idx] = booking;
    else all.unshift(booking);
    localStorage.setItem('nexus_bookings', JSON.stringify(all));
    window.dispatchEvent(new Event('nexus_storage_updated'));
  } catch {}
};

const getStoredPlots = (): Plot[] => {
  try {
    const raw = localStorage.getItem('nexus_plots');
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

export const BookingsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+91 ');
  const [plotNumber, setPlotNumber] = useState('Plot #08');
  const [bookingAmount, setBookingAmount] = useState<number>(500000);
  const [totalAmount, setTotalAmount] = useState<number>(5760000);
  const [paymentTerms, setPaymentTerms] = useState('Token ₹5L paid via RTGS. 20% on agreement signing, 80% on registration.');

  const loadData = () => {
    setBookings(getStoredBookings(tenant?.id));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nexus_storage_updated', handleUpdate);
    return () => window.removeEventListener('nexus_storage_updated', handleUpdate);
  }, [tenant?.id]);

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName) return;

    const newBooking: Booking = {
      id: `bkg-${Date.now()}`,
      companyId: tenant?.id || 't-jamin-02',
      customerId: `cust-${Date.now()}`,
      customerName,
      customerPhone,
      projectId: 'proj-01',
      projectName: 'Greenfield Meadows Phase 2',
      plotId: `plot-${Date.now()}`,
      plotNumber,
      bookingDate: new Date().toISOString().split('T')[0],
      bookingAmount,
      totalAmount,
      status: 'Confirmed',
      agentId: user?.id || 'usr-exec',
      agentName: user?.name || 'Agent',
      paymentTerms,
    };

    saveStoredBooking(newBooking);

    // Update matching plot to Sold
    const plots = getStoredPlots();
    const targetPlot = plots.find((p: Plot) => p.plotNumber.toLowerCase() === plotNumber.toLowerCase());
    if (targetPlot) {
      saveStoredPlot({
        ...targetPlot,
        status: 'Sold',
        holdByCustomer: customerName,
      });
    }

    addStoredAuditLog({
      id: `aud-${Date.now()}`,
      timestamp: 'Just now',
      actorName: user?.name || 'Agent',
      actorEmail: user?.email || 'agent@jamin.com',
      action: 'BOOKING_CREATED',
      entityType: 'Booking',
      entityId: newBooking.id,
      companyId: tenant?.id,
      companyName: tenant?.name,
      details: `Created booking for ${plotNumber} (${customerName}) with ₹${bookingAmount} token.`,
    });

    setIsNewBookingModalOpen(false);
  };

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const columns: Column<Booking>[] = [
    {
      key: 'plotNumber',
      header: 'Plot & Community',
      sortable: true,
      render: b => (
        <div>
          <div className="booking-plot-number">{b.plotNumber}</div>
          <div className="booking-project-name">{b.projectName}</div>
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Buyer Information',
      sortable: true,
      render: b => (
        <div>
          <div className="booking-customer-name">{b.customerName}</div>
          <div className="booking-customer-phone">{b.customerPhone}</div>
        </div>
      ),
    },
    {
      key: 'bookingAmount',
      header: 'Token Paid',
      sortable: true,
      render: b => <span className="booking-token-amount">{formatCurrency(b.bookingAmount)}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Total Sale Value',
      sortable: true,
      render: b => <span className="booking-total-amount">{formatCurrency(b.totalAmount)}</span>,
    },
    {
      key: 'bookingDate',
      header: 'Date',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: b => <StatusChip status={b.status} size="sm" />,
    },
  ];

  return (
    <div className="bookings-page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <CheckCircle size={24} color="#059669" /> Plot Bookings & Contracts
          </h1>
          <p className="page-subtitle">
            Formal reservation contracts, token receipts, and payment schedules for {tenant?.name}.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsNewBookingModalOpen(true)}>
          <Plus size={15} /> Formalize New Booking
        </button>
      </div>

      <DataTable
        columns={columns}
        data={bookings}
        keyExtractor={b => b.id}
        searchPlaceholder="Search bookings by customer, plot, or date..."
        onRowClick={b => setSelectedBooking(b)}
      />

      {/* Booking Documents Drawer */}
      <Drawer
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        title={selectedBooking ? `Booking: ${selectedBooking.plotNumber}` : ''}
        subtitle={selectedBooking ? `${selectedBooking.customerName} • ${selectedBooking.bookingDate}` : ''}
        width={520}
      >
        {selectedBooking && (
          <div className="booking-drawer-content">
            <div className="card booking-drawer-card">
              <h4 className="booking-drawer-section-title">
                Booking Documents
              </h4>
              <DocumentUploader
                entityType="booking"
                entityId={selectedBooking.id}
                allowedCategories={['Token Receipt', 'Sale Agreement', 'Registration Doc', 'Payment Proof', 'Other']}
              />
            </div>
            <DocumentList
              entityType="booking"
              entityId={selectedBooking.id}
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
        subtitle="Confirm token payment and bind plot inventory"
      >
        <form onSubmit={handleCreateBooking} className="booking-form">
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

          <div className="booking-form-grid-2">
            <div className="form-group">
              <label className="form-label">Buyer Phone *</label>
              <input
                type="text"
                className="form-input"
                required
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+91 94140 11223"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Plot Number *</label>
              <input
                type="text"
                className="form-input"
                required
                value={plotNumber}
                onChange={e => setPlotNumber(e.target.value)}
                placeholder="e.g. Plot #08"
              />
            </div>
          </div>

          <div className="booking-form-grid-2">
            <div className="form-group">
              <label className="form-label">Token Advance (₹) *</label>
              <input
                type="number"
                className="form-input"
                required
                value={bookingAmount}
                onChange={e => setBookingAmount(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Agreement Value (₹) *</label>
              <input
                type="number"
                className="form-input"
                required
                value={totalAmount}
                onChange={e => setTotalAmount(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Terms & Milestones</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
            />
          </div>

          <div className="booking-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsNewBookingModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Confirm & Mark Plot Sold
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
