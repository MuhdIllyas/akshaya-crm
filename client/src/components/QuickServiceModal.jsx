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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        >
          {/* ─── Header ─── */}
          <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <FiLayers className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Quick Service Entry</h2>
                <p className="text-blue-100 text-sm mt-0.5">Record a service without tracking details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {/* ─── Body ─── */}
          <div className="px-6 py-6 space-y-5 bg-gray-50/30">
            {/* Service selection */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FiLayers className="h-4 w-4 text-blue-600" />
                Service
              </label>
              <select
                value={service?.id || ''}
                onChange={e =>
                  setService(
                    services.find(s => s.id === Number(e.target.value))
                  )
                }
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm"
              >
                <option value="">Select service</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Sub‑service selection */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FiLayers className="h-4 w-4 text-blue-600" />
                Sub Service
              </label>
              <select
                value={subcategory?.id || ''}
                onChange={e =>
                  setSubcategory(
                    subcategories.find(sc => sc.id === Number(e.target.value))
                  )
                }
                disabled={!service}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-shadow shadow-sm"
              >
                <option value="">Select sub service</option>
                {subcategories.map(sc => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>

            {/* Charges */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Dept. Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">₹</span>
                  </div>
                  <input
                    type="number"
                    value={departmentAmount}
                    onChange={e => setDepartmentAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl pl-8 pr-4 py-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Service Charge</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">₹</span>
                  </div>
                  <input
                    type="number"
                    value={serviceCharge}
                    onChange={e => setServiceCharge(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl pl-8 pr-4 py-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Total preview */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <FiDollarSign className="h-4 w-4 text-blue-700" />
                </div>
                <span className="text-sm font-medium text-gray-700">Total Amount</span>
              </div>
              <span className="text-lg font-bold text-gray-900">₹{total.toLocaleString('en-IN')}</span>
            </div>

            {/* Payments section */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 rounded-lg">
                    <FiCreditCard className="h-4 w-4 text-emerald-700" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900">Payments</h4>
                </div>
                <span className="text-xs text-gray-500">Total: ₹{total.toLocaleString('en-IN')}</span>
              </div>

              <div className="space-y-3">
                {payments.map((p, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex-1 space-y-1.5">
                      <select
                        value={p.wallet}
                        onChange={e => updatePayment(i, 'wallet', e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                      >
                        <option value="">Choose Wallet</option>
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-36 space-y-1.5">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-400 text-sm">₹</span>
                        </div>
                        <input
                          type="number"
                          value={p.amount}
                          onChange={e => updatePayment(i, 'amount', e.target.value)}
                          className="w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {payments.length > 1 && (
                      <button
                        onClick={() => removePayment(i)}
                        className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors mt-0.5"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addPayment}
                className="w-full py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-lg leading-none">+</span> Add another payment
              </button>
            </div>
          </div>

          {/* ─── Footer ─── */}
          <div className="px-6 py-4 bg-white border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-2"
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
