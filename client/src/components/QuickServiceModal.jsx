import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheckCircle, FiTrash2, FiLayers, FiDollarSign, FiCreditCard } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { createServiceEntry, getCategories } from '/src/services/serviceService';

const QuickServiceModal = ({ open, onClose, wallets }) => {
  /* ───────────── Services ───────────── */
  const [services, setServices] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  const [service, setService] = useState(null);
  const [subcategory, setSubcategory] = useState(null);

  /* ───────────── Charges ───────────── */
  const [departmentAmount, setDepartmentAmount] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');

  /* ───────────── Payments ───────────── */
  const [payments, setPayments] = useState([{ wallet: '', amount: '' }]);

  const [loading, setLoading] = useState(false);

  /* ───────────── Load Quick Services Only ───────────── */
  useEffect(() => {
    if (!open) return;

    getCategories()
      .then(res => {
        const quickServices = (res.data || []).filter(
          s => s.requires_workflow === false
        );
        setServices(quickServices);
      })
      .catch(() => toast.error('Failed to load services'));
  }, [open]);

  /* ───────────── When service changes ───────────── */
  useEffect(() => {
    if (!service) return;

    setSubcategories(service.subcategories || []);
    setSubcategory(null);
  }, [service]);

  /* ───────────── When subcategory changes ───────────── */
  useEffect(() => {
    if (!subcategory) return;

    // Auto-fill default charges (same as Service Entry)
    setDepartmentAmount(subcategory.department_charges || 0);
    setServiceCharge(subcategory.service_charges || 0);
  }, [subcategory]);

  const total =
    Number(departmentAmount || 0) +
    Number(serviceCharge || 0);

  /* ───────────── Payment helpers ───────────── */
  const addPayment = () => {
    setPayments([...payments, { wallet: '', amount: '' }]);
  };

  const removePayment = (index) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const updatePayment = (index, field, value) => {
    const updated = [...payments];
    updated[index][field] = value;
    setPayments(updated);
  };

  /* ───────────── Submit ───────────── */
  const handleSubmit = async () => {
    if (!service || !subcategory) {
      toast.error('Select service and sub service');
      return;
    }

    const validPayments = payments.filter(
      p => p.wallet && Number(p.amount) > 0
    );

    if (!validPayments.length) {
      toast.error('At least one payment is required');
      return;
    }

    const totalPaid = validPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    if (totalPaid !== total) {
      toast.error(`Payment total ₹${totalPaid} must equal ₹${total}`);
      return;
    }

    try {
      setLoading(true);

      const payload = {
        tokenId: null,
        customerName: null,
        phone: null,

        categoryId: service.id,
        subcategoryId: subcategory.id,

        serviceCharge: Number(serviceCharge),
        departmentCharge: Number(departmentAmount),
        totalCharge: total,

        // 🔥 IMPORTANT: auto debit from service wallet
        serviceWalletId: service.wallet_id,

        status: 'completed',
        expiryDate: null,

        payments: validPayments.map(p => ({
          wallet: Number(p.wallet),
          amount: Number(p.amount),
          status: 'received',
        })),

        staffId: Number(localStorage.getItem('id')),
      };

      await createServiceEntry(payload);

      toast.success('Quick service recorded');

      // Reset
      setService(null);
      setSubcategory(null);
      setDepartmentAmount('');
      setServiceCharge('');
      setPayments([{ wallet: '', amount: '' }]);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save quick service');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  /* ───────────── UI ───────────── */
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="qs-title"
          className="bg-white w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(90dvh,760px)] flex flex-col rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        >
          {/* ─── Header ─── */}
          <div className="relative shrink-0 bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex items-center gap-3 pr-12">
              <div className="p-2 bg-white/20 rounded-xl shrink-0">
                <FiLayers className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 id="qs-title" className="text-lg sm:text-xl font-bold text-white">Quick Service Entry</h2>
                <p className="text-white/80 text-sm mt-0.5">Record a service without tracking details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 sm:top-5 sm:right-5 p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {/* ─── Body ─── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 space-y-4 sm:space-y-5 bg-slate-50/60">
            {/* Service selection */}
            <div className="space-y-1.5">
              <label htmlFor="qs-service" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <FiLayers className="h-4 w-4 text-navy-700" />
                Service
              </label>
              <select
                id="qs-service"
                value={service?.id || ''}
                onChange={e =>
                  setService(
                    services.find(s => s.id === Number(e.target.value))
                  )
                }
                className="w-full border border-slate-300 rounded-xl px-4 py-3 min-h-[44px] text-base sm:text-sm bg-white focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-shadow shadow-sm"
              >
                <option value="">Select service</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Sub‑service selection */}
            <div className="space-y-1.5">
              <label htmlFor="qs-subservice" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <FiLayers className="h-4 w-4 text-navy-700" />
                Sub Service
              </label>
              <select
                id="qs-subservice"
                value={subcategory?.id || ''}
                onChange={e =>
                  setSubcategory(
                    subcategories.find(sc => sc.id === Number(e.target.value))
                  )
                }
                disabled={!service}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 min-h-[44px] text-base sm:text-sm bg-white focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 disabled:bg-slate-100 disabled:cursor-not-allowed transition-shadow shadow-sm"
              >
                <option value="">Select sub service</option>
                {subcategories.map(sc => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>

            {/* Charges */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <label htmlFor="qs-dept" className="text-sm font-medium text-slate-700">Dept. Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-500">₹</span>
                  </div>
                  <input
                    id="qs-dept"
                    type="number"
                    inputMode="decimal"
                    value={departmentAmount}
                    onChange={e => setDepartmentAmount(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl pl-8 pr-4 py-3 min-h-[44px] text-base sm:text-sm bg-white focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-shadow shadow-sm"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="qs-charge" className="text-sm font-medium text-slate-700">Service Charge</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-500">₹</span>
                  </div>
                  <input
                    id="qs-charge"
                    type="number"
                    inputMode="decimal"
                    value={serviceCharge}
                    onChange={e => setServiceCharge(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl pl-8 pr-4 py-3 min-h-[44px] text-base sm:text-sm bg-white focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-shadow shadow-sm"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Total preview */}
            <div role="status" className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded-lg">
                  <FiDollarSign className="h-4 w-4 text-navy-700" />
                </div>
                <span className="text-sm font-medium text-slate-700">Total Amount</span>
              </div>
              <span className="text-lg font-bold text-slate-900">₹{total.toLocaleString('en-IN')}</span>
            </div>

            {/* Payments section */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 rounded-lg">
                    <FiCreditCard className="h-4 w-4 text-emerald-700" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">Payments</h4>
                </div>
                <span className="text-xs text-slate-600 shrink-0">Total: ₹{total.toLocaleString('en-IN')}</span>
              </div>

              <div className="space-y-3">
                {payments.map((p, i) => (
                  <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 items-start">
                    <div className="flex-1 basis-full sm:basis-0 min-w-0 space-y-1.5">
                      <select
                        aria-label={`Wallet for payment ${i + 1}`}
                        value={p.wallet}
                        onChange={e => updatePayment(i, 'wallet', e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2.5 min-h-[44px] text-base sm:text-sm bg-white focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-shadow"
                      >
                        <option value="">Choose Wallet</option>
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 sm:flex-none sm:w-36 min-w-0 space-y-1.5">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-slate-500 text-sm">₹</span>
                        </div>
                        <input
                          type="number"
                          inputMode="decimal"
                          aria-label={`Amount for payment ${i + 1}`}
                          value={p.amount}
                          onChange={e => updatePayment(i, 'amount', e.target.value)}
                          className="w-full border border-slate-300 rounded-xl pl-7 pr-3 py-2.5 min-h-[44px] text-base sm:text-sm bg-white focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-shadow"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {payments.length > 1 && (
                      <button
                        onClick={() => removePayment(i)}
                        aria-label={`Remove payment ${i + 1}`}
                        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addPayment}
                className="w-full py-2.5 min-h-[44px] text-sm font-medium text-navy-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-lg leading-none">+</span> Add another payment
              </button>
            </div>
          </div>

          {/* ─── Footer ─── */}
          <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 bg-white border-t border-slate-200 flex flex-col-reverse min-[420px]:flex-row min-[420px]:justify-end gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 min-h-[44px] text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 min-h-[44px] text-sm font-medium text-white bg-navy-700 rounded-xl hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <FiCheckCircle className="h-4 w-4" />
                  Save Entry
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default QuickServiceModal;