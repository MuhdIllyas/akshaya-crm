import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheckCircle, FiTrash2 } from 'react-icons/fi';
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
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <motion.div className="bg-white w-full max-w-md rounded-xl shadow-xl border">
          {/* Header */}
          <div className="flex justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Quick Service Entry</h2>
            <button onClick={onClose}><FiX /></button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Service */}
            <select
              value={service?.id || ''}
              onChange={e =>
                setService(
                  services.find(s => s.id === Number(e.target.value))
                )
              }
              className="w-full border rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="">Select service</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Sub Service */}
            <select
              value={subcategory?.id || ''}
              onChange={e =>
                setSubcategory(
                  subcategories.find(sc => sc.id === Number(e.target.value))
                )
              }
              disabled={!service}
              className="w-full border rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="">Select sub service</option>
              {subcategories.map(sc => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>

            {/* Charges */}
            <input
              type="number"
              value={departmentAmount}
              onChange={e => setDepartmentAmount(e.target.value)}
              placeholder="Department amount"
              className="w-full border rounded-lg px-3 py-2.5 text-sm"
            />

            <input
              type="number"
              value={serviceCharge}
              onChange={e => setServiceCharge(e.target.value)}
              placeholder="Service charge"
              className="w-full border rounded-lg px-3 py-2.5 text-sm"
            />

            {/* Payments */}
            <div className="border rounded-lg p-4 bg-emerald-50 space-y-3">
              <h4 className="text-sm font-semibold">Payments</h4>

              {payments.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={p.wallet}
                    onChange={e => updatePayment(i, 'wallet', e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2.5 text-sm"
                  >
                    <option value="">Wallet</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={p.amount}
                    onChange={e => updatePayment(i, 'amount', e.target.value)}
                    className="w-28 border rounded-lg px-3 py-2.5 text-sm"
                  />

                  {payments.length > 1 && (
                    <button onClick={() => removePayment(i)}>
                      <FiTrash2 className="text-red-500" />
                    </button>
                  )}
                </div>
              ))}

              <button onClick={addPayment} className="text-sm text-blue-600">
                + Add payment
              </button>

              <div className="text-sm">
                Total: <b>₹{total}</b>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t">
            <button onClick={onClose} className="border px-4 py-2 rounded-lg">
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <FiCheckCircle />
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default QuickServiceModal;
