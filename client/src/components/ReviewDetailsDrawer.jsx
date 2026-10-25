//Review Details Drawer inside the notification page
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { 
  FiX, FiStar, FiUser, 
  FiBriefcase, FiCalendar, FiMessageCircle, FiMapPin
} from 'react-icons/fi';

const ReviewDetailsDrawer = ({ isOpen, onClose, reviewId }) => {
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'staff';

  const API_BASE_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    let isMounted = true;

    const fetchReview = async () => {
      if (!isOpen || !reviewId) return;
      
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/reviews/single/${reviewId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to fetch review');
        
        const data = await res.json();
        if (isMounted) setReview(data);
      } catch (error) {
        console.error(error);
        toast.error("Could not load review details.");
        onClose(); 
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReview();
    return () => { isMounted = false; };
  }, [isOpen, reviewId, API_BASE_URL, onClose]);

  // Helper to render stars
  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <FiStar key={i} className={`h-8 w-8 ${i < rating ? 'fill-current text-yellow-400' : 'text-slate-200'}`} />
    ));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          />

          {/* Slide-out Drawer */}
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 w-full max-w-md h-full bg-white shadow-2xl z-50 flex flex-col overflow-hidden sm:rounded-l-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Customer review"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Customer Review</h2>
              <button onClick={onClose} aria-label="Close" className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {/* Content Loader */}
            {loading || !review ? (
              <div className="flex-1 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-700"></div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Status Hero Section */}
                <div className="text-center pb-6 border-b border-slate-100">
                  <div className="flex justify-center gap-1 mb-4">
                    {renderStars(review.service_rating)}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {review.service_rating} / 5 Stars
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 flex items-center justify-center gap-1">
                    <FiCalendar /> {new Date(review.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* 2. Review Text */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FiMessageCircle /> Feedback
                  </h4>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 relative">
                    <p className="text-slate-800 text-sm italic relative z-10">"{review.review_text}"</p>
                  </div>
                </div>

                {/* 3. Customer & Service Details */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Service Details</h4>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
                    <div className="flex items-start gap-3">
                      <FiUser className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{review.display_customer_name}</p>
                        <p className="text-xs text-slate-500">Customer</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pt-2 border-t border-slate-200">
                      <FiBriefcase className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{review.service_name || "General Service"}</p>
                        <p className="text-xs text-slate-500">Service Rendered</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pt-2 border-t border-slate-200">
                      <FiUser className="h-4 w-4 text-navy-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-navy-800">{review.staff_name || "Unassigned"}</p>
                        <p className="text-xs text-navy-500 uppercase tracking-wider">{review.staff_role || "Staff Member"}</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
            
            {/* Footer Action */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
              {review?.tracking_id && (
                <button 
                  onClick={() => {
                    onClose();
                    // 🔥 Route Admins to servicelogs, and Staff to track_service
                    const targetRoute = ["admin", "superadmin"].includes(role)
                      ? `/dashboard/${role}/servicelogs` 
                      : `/dashboard/staff/track_service/${review.tracking_id}`;
                      
                    navigate(targetRoute, { state: { trackingId: review.tracking_id } });
                  }} 
                  className="w-full py-3 bg-navy-700 text-white rounded-xl font-semibold hover:bg-navy-800 transition shadow-sm flex items-center justify-center gap-2"
                >
                  <FiMapPin /> Open Service Logs
                </button>
              )}
              <button onClick={onClose} className="w-full py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition">
                Close Drawer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ReviewDetailsDrawer;