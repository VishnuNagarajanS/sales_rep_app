import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle,
  Plus,
  RefreshCw,
  FileText,
  ShieldCheck,
  CreditCard,
  XCircle,
  AlertTriangle,
  History,
  Building2,
  DollarSign,
  UserCheck,
  Edit,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { FilterBar } from '../../components/common/FilterBar';
import { StatusChip } from '../../components/common/StatusChip';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { DocumentUploader } from '../../components/common/DocumentUploader';
import { DocumentList } from '../../components/common/DocumentList';
import { jaminApiService } from '../../services/jaminApiService';
import { getCustomers, getLeads } from '../../services/ghlApiService';
import { storageService } from '../../services/storageService';
import { apiClient } from '../../services/apiClient';
import { toast } from '../../context/ToastContext';
import './BookingsPage.css';

const PAYMENT_MODES = ['Bank Transfer / NEFT', 'RTGS', 'Cheque / DD', 'UPI / Online', 'Cash'];
const PAYMENT_TYPES = ['Installment', 'Milestone', 'Registration Fee', 'Maintenance', 'Token Addition', 'Other'];

export const BookingsPage: React.FC = () => {
  const { tenant, user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [plots, setPlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filters for Buyer Type (Lead vs Customer) and Payment Status (Verified vs Pending)
  const [buyerTypeFilter, setBuyerTypeFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');

  // Role checking for financial actions
  const roleCode = String(user?.role?.code || user?.role?.name || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const canVerifyPayment = ['company_admin', 'super_admin', 'sales_manager', 'admin', 'manager'].includes(roleCode);

  // Verification Modal State
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyingBooking, setVerifyingBooking] = useState<any | null>(null);
  const [verifyReceiptNumber, setVerifyReceiptNumber] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);

  // Add Installment Payment Modal State
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [payingBooking, setPayingBooking] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | undefined>();
  const [paymentType, setPaymentType] = useState('Installment');
  const [newPaymentMode, setNewPaymentMode] = useState('Bank Transfer / NEFT');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentReceiptNo, setPaymentReceiptNo] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Cancellation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelRefundAmount, setCancelRefundAmount] = useState<number>(0);
  const [cancelRefundMode, setCancelRefundMode] = useState('Bank Transfer / NEFT');
  const [cancelRefundRef, setCancelRefundRef] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

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
  const [manageCancelReason, setManageCancelReason] = useState('');
  const [manageCancelRefundAmount, setManageCancelRefundAmount] = useState<number>(0);
  const [manageCancelRefundMode, setManageCancelRefundMode] = useState('Bank Transfer / NEFT');
  const [manageCancelRefundRef, setManageCancelRefundRef] = useState('');

  // Form State for New Booking
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
        jaminApiService.getPlots().catch(() => []),
        jaminApiService.getCustomers().catch(() => getCustomers(tenant?.id).catch(() => storageService.getCustomers(tenant?.id) || [])),
        jaminApiService.getLeads(true).catch(() => getLeads(tenant?.id).catch(() => storageService.getLeads(tenant?.id) || [])),
      ]);
      setBookings(bkgList || []);
      setProjects(projList || []);
      setPlots(plotList || []);
      setCustomersList(custs || []);
      setLeadsList(lds || []);

      // If a booking is currently selected in the drawer, refresh it too
      if (selectedBooking) {
        const refreshed = (bkgList || []).find((b: any) => String(b.id) === String(selectedBooking.id));
        if (refreshed) {
          setSelectedBooking(refreshed);
        }
      }
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

  // Active unconverted leads ONLY
  const availableLeadsList = useMemo(() => {
    return leadsList.filter(l => (l.status || '').toLowerCase() !== 'converted');
  }, [leadsList]);

  const handleProjectSelect = (projId: string) => {
    setSelectedProjectId(projId);
    setSelectedPlotId('');
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
      const targetProj = found.targetDevelopment || found.customFields?.targetDevelopment || found.customFields?.project;
      if (targetProj) {
        const matchedP = projects.find(p => p.name.trim().toLowerCase() === targetProj.trim().toLowerCase() || targetProj.trim().toLowerCase().includes(p.name.trim().toLowerCase()));
        if (matchedP) {
          setSelectedProjectId(String(matchedP.id));
          setSelectedPlotId('');
          setTotalPlotPrice(undefined);
        }
      }
    } else {
      setCustomerName('');
      setCustomerPhone('');
    }
  };

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

      const res = await jaminApiService.createBooking(payload);
      if (res.success) {
        // Automatically transition linked lead status to 'Booking In Progress'
        const leadObj = selectedLeadId
          ? leadsList.find(l => String(l.id) === String(selectedLeadId))
          : leadsList.find(l => l.phone.replace(/\D/g, '').slice(-10) === customerPhone.replace(/\D/g, '').slice(-10));

        if (leadObj && leadObj.status !== 'Converted') {
          const updatedLead = { ...leadObj, status: 'Booking In Progress' as const };
          storageService.saveLead(updatedLead);
          setLeadsList(prev => prev.map(l => String(l.id) === String(leadObj.id) ? updatedLead : l));
          const numId = parseInt(String(leadObj.id).replace('db-', ''), 10);
          if (!isNaN(numId)) {
            apiClient.put(`/leads/${numId}`, {
              name: updatedLead.name,
              phone: updatedLead.phone,
              status: 'Booking In Progress',
              companyId: 2
            }).catch(() => { });
          }
        }

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
        window.dispatchEvent(new Event('nexus_storage_updated'));
        await loadData();
      } else {
        alert(res.message || 'Unable to create the booking. The plot may already be held or booked by another transaction.');
      }
    } catch (err: any) {
      console.error('Booking submission error', err);
      alert(err?.message || 'Unable to create the booking. Please check plot availability and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── PAYMENT VERIFICATION WORKFLOW ──────────────────────────────────────────
  const handleOpenVerifyModal = (b: any) => {
    setVerifyingBooking(b);
    setVerifyReceiptNumber(`RCPT-${Date.now().toString().slice(-6)}`);
    setVerifyNotes(`Token payment verified for ${b.plotNumber || 'Plot'}.`);
    setIsVerifyModalOpen(true);
  };

  const handleConfirmVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingBooking) return;

    const bkg = verifyingBooking;
    const prevBooking = bkg;
    const updatedBooking = { ...bkg, status: 'Token Verified', paymentStatus: 'Verified' };

    // 0ms Optimistic UI update
    setBookings(prev => prev.map(b => b.id === bkg.id ? updatedBooking : b));
    if (selectedBooking && selectedBooking.id === bkg.id) {
      setSelectedBooking(updatedBooking);
    }
    setIsVerifyModalOpen(false);
    setVerifyingBooking(null);
    toast.success(`✓ Token payment verified for Plot ${bkg.plotNumber || ''}!`);

    try {
      const res = await jaminApiService.verifyBookingPayment(
        bkg.id,
        undefined,
        verifyReceiptNumber.trim(),
        verifyNotes.trim()
      );

      if (res && res.success) {
        window.dispatchEvent(new Event('nexus_storage_updated'));
      } else {
        throw new Error(res?.message || 'Payment verification failed on server.');
      }
    } catch (err: any) {
      console.error('Error verifying payment', err);
      // Revert optimistic update
      setBookings(prev => prev.map(b => b.id === bkg.id ? prevBooking : b));
      if (selectedBooking && selectedBooking.id === bkg.id) {
        setSelectedBooking(prevBooking);
      }
      toast.error(err?.message || 'Verification failed. Reverted.');
    }
  };

  // ── ADD INSTALLMENT PAYMENT WORKFLOW ───────────────────────────────────────
  const handleOpenAddPaymentModal = (b: any) => {
    setPayingBooking(b);
    setPaymentAmount(undefined);
    setPaymentType('Installment');
    setNewPaymentMode('Bank Transfer / NEFT');
    setPaymentRef('');
    setPaymentReceiptNo(`RCPT-${Date.now().toString().slice(-6)}`);
    setPaymentNotes('');
    setIsAddPaymentModalOpen(true);
  };

  const handleConfirmAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBooking || !paymentAmount || paymentAmount <= 0) {
      toast.warning('Please enter a valid payment amount.');
      return;
    }

    const bkg = payingBooking;
    const amt = paymentAmount;
    setIsAddPaymentModalOpen(false);
    setPayingBooking(null);
    toast.success(`✓ Recorded ₹${amt.toLocaleString()} payment for ${bkg.plotNumber || 'plot'}!`);

    try {
      const success = await jaminApiService.addBookingPayment(bkg.id, {
        amount: amt,
        paymentType,
        paymentMode: newPaymentMode,
        transactionReference: paymentRef.trim(),
        receiptNumber: paymentReceiptNo.trim(),
        notes: paymentNotes.trim(),
      });

      if (success) {
        window.dispatchEvent(new Event('nexus_storage_updated'));
        loadData();
      } else {
        toast.error('Failed to record payment on server.');
        loadData();
      }
    } catch (err) {
      console.error('Error adding payment', err);
      toast.error('Unable to record payment on server.');
      loadData();
    }
  };

  // ── UNIFIED CANCELLATION & INVENTORY RELEASE LOGIC ────────────────────────
  const executeCancelBooking = async (
    bookingId: number | string,
    plotNumber: string,
    reason: string,
    refundAmount: number,
    refundMode: string,
    refundRef: string
  ): Promise<boolean> => {
    if (!reason.trim()) {
      toast.warning('Please state a reason for cancellation.');
      return false;
    }

    const bkg = bookings.find(b => String(b.id) === String(bookingId)) || cancellingBooking || managingBooking;
    const updated = bkg ? { ...bkg, status: 'Cancelled' } : null;
    if (updated) {
      setBookings(prev => prev.map(b => String(b.id) === String(bookingId) ? updated : b));
      if (selectedBooking && String(selectedBooking.id) === String(bookingId)) {
        setSelectedBooking(updated);
      }
    }
    toast.info(`✓ Booking cancelled for Plot ${plotNumber || ''}.`);

    try {
      const success = await jaminApiService.cancelBookingWithAudit(bookingId, {
        cancellationReason: reason.trim(),
        refundAmount: refundAmount,
        refundPaymentMode: refundAmount > 0 ? refundMode : undefined,
        refundTransactionReference: refundAmount > 0 ? refundRef.trim() : undefined,
      });

      if (success) {
        window.dispatchEvent(new Event('nexus_storage_updated'));
        await loadData();
        return true;
      } else {
        toast.error('Server failed to cancel booking. Reverting.');
        await loadData();
        return false;
      }
    } catch (err) {
      console.error('Error cancelling booking', err);
      toast.error('Unable to cancel booking on server.');
      await loadData();
      return false;
    }
  };

  // ── DIRECT CANCELLATION MODAL ──────────────────────────────────────────────
  const handleOpenCancelModal = (b: any) => {
    setCancellingBooking(b);
    setCancelReason('');
    const verifiedPaid = b.verifiedReceipts ?? b.tokenAmountPaid ?? 0;
    setCancelRefundAmount(verifiedPaid);
    setCancelRefundMode('Bank Transfer / NEFT');
    setCancelRefundRef('');
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancelBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingBooking) return;
    setIsSubmittingCancel(true);
    const ok = await executeCancelBooking(
      cancellingBooking.id,
      cancellingBooking.plotNumber || '',
      cancelReason,
      cancelRefundAmount,
      cancelRefundMode,
      cancelRefundRef
    );
    setIsSubmittingCancel(false);
    if (ok) {
      setIsCancelModalOpen(false);
      setCancellingBooking(null);
    }
  };

  // ── MANAGE DETAILS / STATUS MODAL ──────────────────────────────────────────
  const handleOpenManageModal = (b: any, requestedMode?: 'details' | 'status') => {
    setManagingBooking(b);
    setManageMode(requestedMode === 'status' ? 'status' : 'details');
    setManageStatus(b.status || 'Token Verified');
    setManageNote(b.notes || '');
    setManageTokenAmount(b.tokenAmountPaid ?? b.bookingAmount ?? 0);
    const savedPaymentMode = b.paymentMode || '';
    setManagePaymentMode(PAYMENT_MODES.includes(savedPaymentMode) ? savedPaymentMode : savedPaymentMode ? 'Other' : '');
    setManagePaymentModeOther(PAYMENT_MODES.includes(savedPaymentMode) ? '' : savedPaymentMode);
    setManagePaymentTerms(b.paymentTerms || '');

    // Synchronize cancellation fields with direct cancel modal
    const verifiedPaid = b.verifiedReceipts ?? b.tokenAmountPaid ?? 0;
    setManageCancelReason(b.cancellationReason || '');
    setManageCancelRefundAmount(verifiedPaid);
    setManageCancelRefundMode('Bank Transfer / NEFT');
    setManageCancelRefundRef('');

    setIsManageModalOpen(true);
  };

  const handleSaveManageBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingBooking || !manageStatus) return;

    // Unified cancellation: execute identical plot release, refund audit, and status transition
    if (manageStatus === 'Cancelled') {
      setIsSubmittingManage(true);
      const ok = await executeCancelBooking(
        managingBooking.id,
        managingBooking.plotNumber || '',
        manageCancelReason,
        manageCancelRefundAmount,
        manageCancelRefundMode,
        manageCancelRefundRef
      );
      setIsSubmittingManage(false);
      if (ok) {
        setIsManageModalOpen(false);
        setManagingBooking(null);
      }
      return;
    }

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
    if (currentStatus === 'Cancelled') {
      return [{ value: 'Cancelled', label: 'Cancelled (Plot Released - Permanent)' }];
    }
    return [
      { value: 'Hold', label: 'Hold (Temporary Reservation)' },
      { value: 'Pending Verification', label: 'Pending Verification' },
      { value: 'Token Paid', label: 'Token Paid (Pending Verification)' },
      { value: 'Token Verified', label: 'Token Verified' },
      { value: 'Agreement Signed', label: 'Agreement Signed' },
      { value: 'Registration Completed', label: 'Registration Completed' },
      { value: 'Cancelled', label: 'Cancel Booking & Release Plot' },
    ];
  };

  const formatCurrency = (val?: number) => {
    if (!val || val === 0) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const filteredPlotsForProject = useMemo(() => {
    if (!selectedProjectId) return [];
    const normPhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
    const buyerPhone10 = normPhone(customerPhone);
    const buyerCustId = selectedCustomerId ? String(selectedCustomerId) : '';

    return plots.filter(p => {
      if (String(p.projectId) !== String(selectedProjectId)) return false;
      // Do not expose already-booked, registered, or sold plots
      if (p.status === 'Registered' || p.status === 'Sold' || p.status === 'Booked') return false;

      // Available plots are open for booking
      if (p.status === 'Available') return true;

      // Plots on Hold: only selectable if held by this buyer or before buyer is selected
      if (p.status === 'Hold') {
        const heldPhone10 = normPhone(p.heldByCustomerPhone || p.holdPhone);
        const heldCustId = p.heldByCustomerId ? String(p.heldByCustomerId) : '';
        if (buyerCustId && heldCustId && buyerCustId === heldCustId) return true;
        if (buyerPhone10 && heldPhone10 && buyerPhone10 === heldPhone10) return true;
        if (!buyerCustId && !buyerPhone10) return true;
        return false;
      }

      return false;
    });
  }, [selectedProjectId, plots, customerPhone, selectedCustomerId]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // 1. Buyer Type filter: 'Customer' vs 'Lead'
      if (buyerTypeFilter === 'Customer') {
        const isCustomer = Boolean(b.customerId && Number(b.customerId) > 0);
        if (!isCustomer) return false;
      } else if (buyerTypeFilter === 'Lead') {
        const isCustomer = Boolean(b.customerId && Number(b.customerId) > 0);
        if (isCustomer) return false;
      }

      // 2. Payment Status filter: 'Verified' vs 'Pending'
      if (paymentStatusFilter !== 'All') {
        const pStatus = (b.paymentStatus || (b.status === 'Booking Pending Verification' ? 'Pending' : 'Verified')).toLowerCase();
        if (pStatus !== paymentStatusFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [bookings, buyerTypeFilter, paymentStatusFilter]);

  const columns: Column<any>[] = [
    {
      key: 'plotNumber',
      header: 'Plot & Community',
      sortable: true,
      width: '16%',
      render: b => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div className="booking-plot-number" style={{ fontWeight: 700, color: '#0f172a' }}>{b.plotNumber || 'Plot'}</div>
          <div className="booking-project-name" style={{ fontSize: '0.8rem', color: '#64748b' }}>{b.projectName || 'Jamin Project'}</div>
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Buyer Information',
      sortable: true,
      width: '22%',
      render: b => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div className="booking-customer-name" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ color: '#0f172a', fontSize: '0.9rem' }}>{b.customerName || '—'}</span>
            {b.customerId ? (
              <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block' }}>Customer</span>
            ) : (
              <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block' }}>Lead</span>
            )}
          </div>
          <div className="booking-customer-phone" style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
            {b.customerPhone || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'totalPlotPrice',
      header: 'Contract & Balance Due',
      sortable: true,
      width: '19%',
      render: b => {
        const val = b.contractBalance ?? Math.max(0, (b.totalPlotPrice || 0) - (b.verifiedReceipts ?? b.tokenAmountPaid ?? 0));
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span className="booking-total-amount" style={{ fontWeight: 700, color: '#0f172a' }}>
              {formatCurrency(b.totalPlotPrice || b.totalAmount)}
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: b.status === 'Cancelled' ? '#94a3b8' : val > 0 ? '#d97706' : '#059669', whiteSpace: 'nowrap' }}>
              {b.status === 'Cancelled' ? 'Cancelled' : val > 0 ? `Due: ${formatCurrency(val)}` : 'Fully Settled'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'verifiedReceipts',
      header: 'Payment & Status',
      sortable: true,
      width: '16%',
      render: b => {
        const verified = b.verifiedReceipts ?? (b.status === 'Token Paid' || b.paymentStatus === 'Verified' ? b.tokenAmountPaid : 0);
        const pStatus = b.paymentStatus || (b.status === 'Booking Pending Verification' ? 'Pending' : 'Verified');
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
            <span className="booking-token-amount" style={{ fontWeight: 700, color: verified > 0 ? '#059669' : '#64748b' }}>
              {formatCurrency(verified)}
            </span>
            <StatusChip status={pStatus} size="sm" />
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Booking Lifecycle',
      sortable: true,
      width: '16%',
      render: b => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
          <StatusChip status={b.status || 'Booking Pending Verification'} size="sm" />
          {b.notes ? (
            <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', wordBreak: 'break-word', lineHeight: 1.25, maxWidth: '140px' }} title={b.notes}>
              "{b.notes}"
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'bookingDate',
      header: 'Date',
      sortable: true,
      width: '11%',
      render: b => (
        <span style={{ fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
          {b.bookingDate ? new Date(b.bookingDate).toLocaleDateString() : 'Recent'}
        </span>
      ),
    },
  ];

  return (
    <div className="bookings-page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={24} color="#059669" /> Plot Bookings & Contracts
          </h1>
          <p className="page-subtitle">
            Authoritative plot inventory reservations, payment ledgers, and buyer contracts for {tenant?.name}.
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
        data={filteredBookings}
        loading={loading}
        keyExtractor={b => String(b.id)}
        searchPlaceholder="Search bookings by buyer, plot, or status..."
        searchFilter={(b: any, query: string) => {
          const q = query.toLowerCase();
          return (
            (b.customerName || '').toLowerCase().includes(q) ||
            (b.customerPhone || '').toLowerCase().includes(q) ||
            (b.plotNumber || '').toLowerCase().includes(q) ||
            (b.projectName || '').toLowerCase().includes(q) ||
            (b.status || '').toLowerCase().includes(q) ||
            (b.paymentStatus || '').toLowerCase().includes(q)
          );
        }}
        emptyTitle="No bookings found"
        emptyDescription={
          buyerTypeFilter !== 'All' || paymentStatusFilter !== 'All'
            ? 'No booking records match the selected buyer and payment filters. Try resetting filters.'
            : 'No plot reservations or booking contracts have been registered yet.'
        }
        filtersNode={
          <FilterBar
            showLabel={false}
            hideItemLabels={true}
            filters={[
              {
                key: 'buyerType',
                label: 'Buyer Type',
                allLabel: 'All(Leads & Customers)',
                value: buyerTypeFilter,
                onChange: setBuyerTypeFilter,
                options: [
                  { value: 'Customer', label: 'Customers' },
                  { value: 'Lead', label: 'Leads' },
                ],
              },
              {
                key: 'paymentStatus',
                label: 'Payment Status',
                allLabel: 'All Payment Statuses',
                value: paymentStatusFilter,
                onChange: setPaymentStatusFilter,
                options: [
                  { value: 'Verified', label: 'Verified Payments' },
                  { value: 'Pending', label: 'Pending Verification' },
                ],
              },
            ]}
            onClearAll={() => {
              setBuyerTypeFilter('All');
              setPaymentStatusFilter('All');
            }}
          />
        }
        rowActions={[
          {
            label: 'Verify Payment',
            icon: <ShieldCheck size={14} color="#059669" />,
            onClick: (b: any) => handleOpenVerifyModal(b),
            // Show only if payment is pending and user is authorized
            disabled: (b: any) => !(canVerifyPayment && (b.paymentStatus === 'Pending' || b.status === 'Booking Pending Verification' || b.status === 'Pending Verification')),
          },
          {
            label: 'Add Installment',
            icon: <CreditCard size={14} color="#2563eb" />,
            onClick: (b: any) => handleOpenAddPaymentModal(b),
            disabled: (b: any) => b.status === 'Cancelled' || b.status === 'Registration Completed',
          },
          {
            label: 'Edit Booking',
            icon: <Edit size={14} color="#3b82f6" />,
            onClick: (b: any) => handleOpenManageModal(b, 'details'),
            disabled: (b: any) => b.status === 'Cancelled',
          },
          {
            label: 'Cancel Booking',
            icon: <XCircle size={14} color="#dc2626" />,
            onClick: (b: any) => handleOpenCancelModal(b),
            disabled: (b: any) => b.status === 'Cancelled',
          },
          {
            label: 'Documents',
            icon: <FileText size={14} />,
            onClick: b => setSelectedBooking(b),
          },
        ]}
        onRowClick={b => setSelectedBooking(b)}
      />

      {/* ── BOOKING DETAILS & PAYMENT LEDGER DRAWER ────────────────────────── */}
      <Drawer
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        title={selectedBooking ? `Booking: ${selectedBooking.plotNumber || 'Plot'}` : ''}
        subtitle={selectedBooking ? `${selectedBooking.customerName} • ${selectedBooking.bookingDate ? new Date(selectedBooking.bookingDate).toLocaleDateString() : ''}` : ''}
        width={580}
      >
        {selectedBooking && (
          <div className="booking-drawer-content">
            {/* Cancellation Notice if cancelled */}
            {selectedBooking.status === 'Cancelled' && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#991b1b',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}>
                <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>This booking has been cancelled</div>
                  <div><strong>Reason:</strong> {selectedBooking.cancellationReason || 'No reason specified'}</div>
                  {selectedBooking.refundAmount > 0 && (
                    <div style={{ marginTop: '2px' }}><strong>Refund Issued:</strong> {formatCurrency(selectedBooking.refundAmount)}</div>
                  )}
                  {selectedBooking.cancelledByName && (
                    <div style={{ marginTop: '2px', fontSize: '0.8rem', color: '#b91c1c' }}>
                      Processed by {selectedBooking.cancelledByName} on {selectedBooking.cancelledAt ? new Date(selectedBooking.cancelledAt).toLocaleDateString() : ''}
                    </div>
                  )}
                  <div style={{ marginTop: '4px', fontWeight: 600 }}>Plot {selectedBooking.plotNumber} has been released back to Available inventory.</div>
                </div>
              </div>
            )}

            {/* Financial Ledger Metrics Card */}
            <div className="card booking-drawer-card" style={{ padding: '16px', background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Contract Financials & Ledger
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <StatusChip status={selectedBooking.status || 'Booking Pending Verification'} size="sm" />
                  <StatusChip status={selectedBooking.paymentStatus || 'Pending'} size="sm" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Contract Value</span>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                    {formatCurrency(selectedBooking.contractValue ?? selectedBooking.totalPlotPrice)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#059669' }}>Verified Receipts</span>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#059669' }}>
                    {formatCurrency(selectedBooking.verifiedReceipts ?? selectedBooking.tokenAmountPaid ?? 0)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#d97706' }}>Balance Due</span>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: selectedBooking.status === 'Cancelled' ? '#94a3b8' : '#d97706' }}>
                    {selectedBooking.status === 'Cancelled' ? '₹0' : formatCurrency(selectedBooking.contractBalance ?? Math.max(0, (selectedBooking.totalPlotPrice || 0) - (selectedBooking.verifiedReceipts || 0)))}
                  </div>
                </div>
              </div>

              {selectedBooking.totalRefunds > 0 && (
                <div style={{ fontSize: '12px', color: '#dc2626', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                  Total Refunds Issued: <strong>{formatCurrency(selectedBooking.totalRefunds)}</strong> • Net Cash Received: <strong>{formatCurrency(selectedBooking.netCashReceived)}</strong>
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {canVerifyPayment && (selectedBooking.paymentStatus === 'Pending' || selectedBooking.status === 'Booking Pending Verification') && (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: '#059669', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
                  onClick={() => handleOpenVerifyModal(selectedBooking)}
                >
                  <ShieldCheck size={14} /> Verify Token Payment
                </button>
              )}
              {selectedBooking.status !== 'Cancelled' && selectedBooking.status !== 'Registration Completed' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  onClick={() => handleOpenAddPaymentModal(selectedBooking)}
                >
                  <CreditCard size={14} /> Record Installment
                </button>
              )}
              {selectedBooking.status !== 'Cancelled' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  onClick={() => handleOpenManageModal(selectedBooking, 'details')}
                >
                  <Edit size={14} /> Edit Booking
                </button>
              )}
              {selectedBooking.status !== 'Cancelled' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  onClick={() => handleOpenCancelModal(selectedBooking)}
                >
                  <XCircle size={14} /> Cancel & Refund
                </button>
              )}
            </div>

            {/* Property and Buyer Details Card */}
            <div className="card booking-drawer-card" style={{ padding: '16px' }}>
              <h4 className="booking-drawer-section-title" style={{ fontWeight: 600, marginBottom: '10px' }}>
                Property & Buyer Info
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Project:</span>
                  <div style={{ fontWeight: 600 }}>{selectedBooking.projectName || 'Jamin Community'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Plot Number:</span>
                  <div style={{ fontWeight: 700 }}>{selectedBooking.plotNumber}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Buyer Name:</span>
                  <div style={{ fontWeight: 600 }}>{selectedBooking.customerName}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Buyer Phone:</span>
                  <div style={{ fontWeight: 600 }}>{selectedBooking.customerPhone}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Assigned Agent:</span>
                  <div>{selectedBooking.assignedAgentName || user?.name || 'Agent'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Booking Date:</span>
                  <div>{selectedBooking.bookingDate ? new Date(selectedBooking.bookingDate).toLocaleDateString() : '—'}</div>
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
            </div>

            {/* ── PAYMENT LEDGER TABLE ────────────────────────────────────── */}
            <div className="card booking-drawer-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 className="booking-drawer-section-title" style={{ fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={15} /> Payment Ledger Records
                </h4>
                {selectedBooking.status !== 'Cancelled' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => handleOpenAddPaymentModal(selectedBooking)}
                  >
                    + Add Payment
                  </button>
                )}
              </div>

              {selectedBooking.payments && selectedBooking.payments.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                        <th style={{ padding: '6px 4px' }}>Date</th>
                        <th style={{ padding: '6px 4px' }}>Type</th>
                        <th style={{ padding: '6px 4px' }}>Amount</th>
                        <th style={{ padding: '6px 4px' }}>Mode / Ref</th>
                        <th style={{ padding: '6px 4px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBooking.payments.map((p: any) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 4px', color: '#64748b' }}>
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ padding: '8px 4px', fontWeight: 600 }}>
                            {p.paymentType}
                          </td>
                          <td style={{
                            padding: '8px 4px',
                            fontWeight: 700,
                            color: p.paymentType === 'Refund' ? '#dc2626' : '#059669',
                          }}>
                            {p.paymentType === 'Refund' ? '-' : '+'}{formatCurrency(p.amount)}
                          </td>
                          <td style={{ padding: '8px 4px', fontSize: '11px' }}>
                            <div>{p.paymentMode}</div>
                            {p.transactionReference && (
                              <div style={{ color: '#64748b', fontFamily: 'monospace' }}>{p.transactionReference}</div>
                            )}
                          </td>
                          <td style={{ padding: '8px 4px' }}>
                            <StatusChip status={p.status || 'Verified'} size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
                  No standalone ledger receipts recorded yet. Initial token payment was recorded at booking creation.
                </div>
              )}
            </div>

            {/* Documents Section */}
            <div className="card booking-drawer-card">
              <h4 className="booking-drawer-section-title">
                Booking Documents
              </h4>
              <DocumentUploader
                entityType="booking"
                entityId={String(selectedBooking.id)}
                allowedCategories={['Token Receipt', 'Sale Agreement', 'Registration Doc', 'Payment Proof', 'Other']}
              />
              <DocumentList
                entityType="booking"
                entityId={String(selectedBooking.id)}
                canDelete
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* ── VERIFY PAYMENT MODAL ────────────────────────────────────────────── */}
      <Modal
        isOpen={isVerifyModalOpen && !!verifyingBooking}
        onClose={() => setIsVerifyModalOpen(false)}
        title="Verify Token Payment"
        subtitle={`Confirm receipt of token funds for Plot ${verifyingBooking?.plotNumber || ''}`}
        size="md"
      >
        <form onSubmit={handleConfirmVerification} className="booking-form">
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '12px 16px', color: '#065f46', fontSize: '13px' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Finance Verification Notice</div>
            <div>
              Verifying this token payment will:
            </div>
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              <li>Record receipt of <strong>{formatCurrency(verifyingBooking?.tokenAmountPaid ?? verifyingBooking?.bookingAmount)}</strong> as verified in the ledger.</li>
              <li>Advance booking status to <strong>Token Verified</strong> and payment status to <strong>Verified</strong>.</li>
              <li>Automatically convert any linked Lead into an official <strong>Customer in Customer 360</strong>.</li>
            </ul>
          </div>

          <div className="booking-form-grid-2">
            <div className="form-group">
              <label className="form-label">Buyer</label>
              <input type="text" className="form-input" value={verifyingBooking?.customerName || ''} readOnly />
            </div>
            <div className="form-group">
              <label className="form-label">Token Amount (₹)</label>
              <input type="text" className="form-input" value={formatCurrency(verifyingBooking?.tokenAmountPaid ?? verifyingBooking?.bookingAmount)} readOnly />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Official Receipt Number *</label>
            <input
              type="text"
              className="form-input"
              required
              value={verifyReceiptNumber}
              onChange={e => setVerifyReceiptNumber(e.target.value)}
              placeholder="e.g. RCPT-2026-091"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Verification Remarks / Bank UTR</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={verifyNotes}
              onChange={e => setVerifyNotes(e.target.value)}
              placeholder="Enter bank statement reference or finance notes..."
            />
          </div>

          <div className="booking-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsVerifyModalOpen(false)} disabled={isSubmittingVerify}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ background: '#059669', borderColor: '#059669' }} disabled={isSubmittingVerify}>
              {isSubmittingVerify ? 'Verifying...' : 'Confirm & Authorize Verification'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── ADD INSTALLMENT PAYMENT MODAL ──────────────────────────────────── */}
      <Modal
        isOpen={isAddPaymentModalOpen && !!payingBooking}
        onClose={() => setIsAddPaymentModalOpen(false)}
        title="Record Installment / Milestone Payment"
        subtitle={`Post a receipt into the payment ledger for Plot ${payingBooking?.plotNumber || ''}`}
        size="md"
      >
        <form onSubmit={handleConfirmAddPayment} className="booking-form">
          <div className="booking-form-grid-2">
            <div className="form-group">
              <label className="form-label">Payment Amount (₹) *</label>
              <input
                type="number"
                className="form-input"
                required
                min={1}
                value={paymentAmount ?? ''}
                onChange={e => setPaymentAmount(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="e.g. 500000"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Type *</label>
              <select
                className="form-select"
                value={paymentType}
                onChange={e => setPaymentType(e.target.value)}
              >
                {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="booking-form-grid-2">
            <div className="form-group">
              <label className="form-label">Payment Mode *</label>
              <select
                className="form-select"
                value={newPaymentMode}
                onChange={e => setNewPaymentMode(e.target.value)}
              >
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Transaction Reference / UTR / Cheque #</label>
              <input
                type="text"
                className="form-input"
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                placeholder="UTR, Cheque number or Txn ID"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Receipt Number</label>
            <input
              type="text"
              className="form-input"
              value={paymentReceiptNo}
              onChange={e => setPaymentReceiptNo(e.target.value)}
              placeholder="e.g. RCPT-2026-092"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Notes</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
              placeholder="Milestone notes or bank details..."
            />
          </div>

          <div className="booking-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddPaymentModalOpen(false)} disabled={isSubmittingPayment}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmittingPayment}>
              {isSubmittingPayment ? 'Recording...' : 'Post to Ledger'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── CANCELLATION & REFUND MODAL ─────────────────────────────────────── */}
      <Modal
        isOpen={isCancelModalOpen && !!cancellingBooking}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Booking & Release Plot"
        subtitle={`Process cancellation for Plot ${cancellingBooking?.plotNumber || ''}`}
        size="md"
      >
        <form onSubmit={handleConfirmCancelBooking} className="booking-form">
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', color: '#991b1b', fontSize: '13px' }}>
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Inventory Release Warning</div>
            <div>
              Cancelling this booking will:
            </div>
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              <li>Immediately release <strong>Plot {cancellingBooking?.plotNumber}</strong> back to <strong>Available</strong> inventory.</li>
              <li>Record cancellation audit details (time, staff, reason) permanently.</li>
              <li>If refund amount is entered, write a verified refund transaction into the payment ledger.</li>
              <li>Preserve historical buyer records in Customer 360.</li>
            </ul>
          </div>

          <div className="form-group">
            <label className="form-label">Cancellation Reason *</label>
            <textarea
              className="form-textarea"
              rows={3}
              required
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="e.g. Buyer opted out due to financial constraints, loan rejected, or plot relocated..."
            />
          </div>

          <div className="booking-form-grid-2">
            <div className="form-group">
              <label className="form-label">Refund Amount (₹)</label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={cancelRefundAmount}
                onChange={e => setCancelRefundAmount(Number(e.target.value))}
              />
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Total previously verified: {formatCurrency(cancellingBooking?.verifiedReceipts ?? cancellingBooking?.tokenAmountPaid)}
              </span>
            </div>

            {cancelRefundAmount > 0 && (
              <div className="form-group">
                <label className="form-label">Refund Payment Mode</label>
                <select
                  className="form-select"
                  value={cancelRefundMode}
                  onChange={e => setCancelRefundMode(e.target.value)}
                >
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
          </div>

          {cancelRefundAmount > 0 && (
            <div className="form-group">
              <label className="form-label">Refund Transaction Reference / UTR</label>
              <input
                type="text"
                className="form-input"
                value={cancelRefundRef}
                onChange={e => setCancelRefundRef(e.target.value)}
                placeholder="Bank UTR or refund transaction reference"
              />
            </div>
          )}

          <div className="booking-form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsCancelModalOpen(false)} disabled={isSubmittingCancel}>
              Back
            </button>
            <button type="submit" className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }} disabled={isSubmittingCancel}>
              {isSubmittingCancel ? 'Cancelling...' : 'Confirm Cancellation & Release Plot'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── NEW BOOKING MODAL ──────────────────────────────────────────────── */}
      <Modal
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        title="Formalize Plot Booking Agreement"
        subtitle=""
      >
        <form onSubmit={handleCreateBooking} className="booking-form">
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
                <div className="booking-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '10px' }}>
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

          {/* Project & Plot selection placed under the Buyer/Customer section */}
          <div className="booking-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '14px' }}>
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
              <label className="form-label">Token Advance (₹)</label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={tokenAmountPaid ?? ''}
                onChange={e => setTokenAmountPaid(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="e.g. 100000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Agreement Value (₹) *</label>
              <input
                type="number"
                className="form-input"
                required
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
            <label className="form-label">Payment Terms / Milestone Schedule</label>
            <input
              type="text"
              className="form-input"
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
              placeholder="e.g. 10% token, 40% on agreement, 50% on registration"
            />
          </div>

          <div className="form-group">
            <label className="form-label">General Notes & Remarks</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal remarks or special requests..."
            />
          </div>

          <div className="booking-form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsNewBookingModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating Booking...' : 'Confirm & Reserve Plot'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MANAGE DETAILS & STATUS MODAL ──────────────────────────────────── */}
      <Modal
        isOpen={isManageModalOpen && !!managingBooking}
        onClose={() => setIsManageModalOpen(false)}
        title={`Edit Booking: ${managingBooking?.plotNumber || 'Plot'}`}
        subtitle={`Update booking details and status for ${managingBooking?.customerName || ''}`}
        size="md"
      >
        <form onSubmit={handleSaveManageBooking} className="booking-form">
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
              <span className="booking-summary-label">Current Status:</span>
              <span className="booking-summary-val">
                <StatusChip status={managingBooking?.status || 'Booking Pending Verification'} size="sm" />
              </span>
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

          {manageStatus === 'Agreement Signed' && (
            <div className="booking-manage-banner agreement">
              <span>📄 <strong>Agreement Signed:</strong> Official sale agreement executed with the buyer.</span>
            </div>
          )}

          {manageStatus === 'Registration Completed' && (
            <div className="booking-manage-banner registration">
              <span>🏛️ <strong>Registration Completed:</strong> Deed registration is registered in sub-registrar office. The plot is permanently marked as Registered.</span>
            </div>
          )}

          {manageStatus === 'Cancelled' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', color: '#991b1b', fontSize: '13px' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Inventory Release Warning</div>
                <div>Cancelling this booking will immediately release <strong>Plot {managingBooking?.plotNumber}</strong> back to <strong>Available</strong> inventory and record cancellation audit.</div>
              </div>

              <div className="form-group">
                <label className="form-label">Cancellation Reason *</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  required
                  value={manageCancelReason}
                  onChange={e => setManageCancelReason(e.target.value)}
                  placeholder="e.g. Buyer opted out due to financial constraints, loan rejected, or plot relocated..."
                />
              </div>

              <div className="booking-form-grid-2">
                <div className="form-group">
                  <label className="form-label">Refund Amount (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    min={0}
                    value={manageCancelRefundAmount}
                    onChange={e => setManageCancelRefundAmount(Number(e.target.value))}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Total verified: {formatCurrency(managingBooking?.verifiedReceipts ?? managingBooking?.tokenAmountPaid)}
                  </span>
                </div>

                {manageCancelRefundAmount > 0 && (
                  <div className="form-group">
                    <label className="form-label">Refund Payment Mode</label>
                    <select
                      className="form-select"
                      value={manageCancelRefundMode}
                      onChange={e => setManageCancelRefundMode(e.target.value)}
                    >
                      {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {manageCancelRefundAmount > 0 && (
                <div className="form-group">
                  <label className="form-label">Refund Transaction Reference / UTR</label>
                  <input
                    type="text"
                    className="form-input"
                    value={manageCancelRefundRef}
                    onChange={e => setManageCancelRefundRef(e.target.value)}
                    placeholder="Bank UTR or refund transaction reference"
                  />
                </div>
              )}
            </div>
          )}

          {manageStatus !== 'Cancelled' && (
            <div className="form-group">
              <label className="form-label">Remarks / Notes</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={manageNote}
                onChange={e => setManageNote(e.target.value)}
                placeholder="Add booking remarks..."
              />
            </div>
          )}

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
              style={manageStatus === 'Cancelled' ? { background: '#dc2626', borderColor: '#dc2626' } : undefined}
              disabled={isSubmittingManage || !manageStatus}
            >
              {isSubmittingManage
                ? (manageStatus === 'Cancelled' ? 'Cancelling...' : 'Saving...')
                : (manageStatus === 'Cancelled' ? 'Confirm Cancellation & Release Plot' : 'Save Booking Details')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
