import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, FiCheckCircle, FiClock, FiUser, 
  FiBriefcase, FiHash, FiCreditCard, FiTag 
} from 'react-icons/fi';

const PaymentReceiptDrawer = ({ isOpen, onClose, paymentId }) => {
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);

  // Simulate fetching the exact payment details from the database
  useEffect(() => {
    if (isOpen && paymentId) {
      setLoading(true);
      // Replace this setTimeout with your actual fetch call:
      // fetch(`/api/servicemanagement/payment-receipt/${paymentId}`)
      setTimeout(() => {
        setReceipt({
          id: paymentId,
          status: 'fully_paid', // or 'partially_paid'
          amountCollected: 500,
          totalBill: 1500,
          previouslyPaid: 1000,
          remainingBalance: 0,
          date: new Date().toISOString(),
          customer: { name: 'Rahul', phone: '+91 98765 43210' },
          service: { name: 'Passport Renewal', trackingId: 'SRV-10396' },
          audit: { collectedBy: 'Prajith', role: 'Staff', wallet: 'Cash Drawer 1' }
        });
        setLoading(false);
      }, 600);
    }
  }, [isOpen, paymentId]);

  const formatCurrency = (amt) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amt);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Slide-out Drawer */}
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 w-full max-w-md h-full bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800">Payment Receipt</h2>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {/* Content Loader */}
            {loading || !receipt ? (
              <div className="flex-1 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Status Hero Section */}
                <div className="text-center pb-6 border-b border-gray-100">
                  <div className={`mx-auto w-12 h-12 flex items-center justify-center rounded-full mb-3 ${receipt.status === 'fully_paid' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                    {receipt.status === 'fully_paid' ? <FiCheckCircle className="h-6 w-6" /> : <FiClock className="h-6 w-6" />}
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">{formatCurrency(receipt.amountCollected)}</h3>
                  <p className={`text-sm font-medium mt-1 ${receipt.status === 'fully_paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {receipt.status === 'fully_paid' ? 'Fully Paid' : 'Partially Paid'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(receipt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* 2. Customer & Service Details */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Service Details</h4>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
                    <div className="flex items-start gap-3">
                      <FiUser className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{receipt.customer.name}</p>
                        <p className="text-xs text-gray-500">{receipt.customer.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pt-2 border-t border-gray-200">
                      <FiBriefcase className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{receipt.service.name}</p>
                        <p className="text-xs text-gray-500">Tracking: {receipt.service.trackingId}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Financial Breakdown */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Financial Breakdown</h4>
                  <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Total Service Bill</span>
                      <span className="font-medium text-gray-900">{formatCurrency(receipt.totalBill)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Previously Paid</span>
                      <span className="font-medium text-gray-900">{formatCurrency(receipt.previouslyPaid)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium text-indigo-600 bg-indigo-50 px-2 py-1.5 rounded -mx-2">
                      <span>This Payment</span>
                      <span>+{formatCurrency(receipt.amountCollected)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-900 font-bold pt-2 border-t border-gray-200 mt-2">
                      <span>Remaining Balance</span>
                      <span className={receipt.remainingBalance === 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(receipt.remainingBalance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Audit Trail */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Audit Trail</h4>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-100 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 flex items-center gap-1"><FiUser className="h-3 w-3"/> Collected By</span>
                      <span className="font-medium text-gray-900">{receipt.audit.collectedBy} ({receipt.audit.role})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 flex items-center gap-1"><FiCreditCard className="h-3 w-3"/> Deposited To</span>
                      <span className="font-medium text-gray-900">{receipt.audit.wallet}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 flex items-center gap-1"><FiHash className="h-3 w-3"/> Transaction ID</span>
                      <span className="font-medium text-gray-900 font-mono text-xs">TXN-{receipt.id}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}
            
            {/* Footer Action */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button onClick={onClose} className="w-full py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition shadow-md hover:shadow-lg">
                Close Receipt
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PaymentReceiptDrawer;