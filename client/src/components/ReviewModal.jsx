import React, { useState, useEffect } from 'react';
import { FiStar, FiX, FiCheckCircle, FiUser, FiBriefcase, FiCalendar, FiMessageSquare } from 'react-icons/fi';
import StarRating from './StarRating';
import { submitBookingReview, getBookingReview } from '@/services/reviewService';
import { format } from 'date-fns';

const ReviewModal = ({ isOpen, onClose, booking, mode = 'submit', onSuccess }) => {
  const [step, setStep] = useState('form'); // 'form', 'success'
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState(null);
  const [formData, setFormData] = useState({
    service_rating: 0,
    staff_rating: 0,
    review_text: ''
  });
  const [errors, setErrors] = useState({});

  // Fetch review if in view mode
  useEffect(() => {
    if (isOpen && mode === 'view' && booking?.review) {
      setReview(booking.review);
    } else if (isOpen && mode === 'submit') {
      setStep('form');
      setFormData({
        service_rating: 0,
        staff_rating: 0,
        review_text: ''
      });
      setErrors({});
    }
  }, [isOpen, mode, booking]);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.service_rating || formData.service_rating < 1) {
      newErrors.service_rating = 'Please rate the service';
    }
    
    if (!formData.review_text || formData.review_text.trim() === '') {
      newErrors.review_text = 'Please provide your feedback';
    } else if (formData.review_text.trim().length < 10) {
      newErrors.review_text = 'Feedback should be at least 10 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setSubmitting(true);
      await submitBookingReview(booking.id, formData);
      setStep('success');
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      setErrors({ submit: error.message || 'Failed to submit review' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === 'success' && onSuccess) {
      onSuccess();
    }
    onClose();
  };

  // Render view mode
  if (mode === 'view' && review) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
            <h3 className="text-xl font-bold text-gray-800">Your Review</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* Service Info */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
              <div className="flex items-center space-x-3">
                <div className="bg-navy-100 p-2 rounded-lg">
                  <FiBriefcase className="h-5 w-5 text-navy-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Service</p>
                  <p className="font-medium text-gray-900">
                    {booking.service_name || booking.category || 'Service'}
                  </p>
                </div>
              </div>
              {booking.application_number && (
                <div className="flex items-center mt-2 text-xs text-gray-500">
                  <FiCalendar className="mr-1" />
                  Application: {booking.application_number}
                </div>
              )}
            </div>

            {/* Review Date */}
            <div className="mb-4 text-right">
              <p className="text-xs text-gray-500">
                Submitted on {format(new Date(review.submitted_at), 'dd MMM yyyy, hh:mm a')}
              </p>
            </div>

            {/* Service Rating */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <FiStar className="h-5 w-5 text-yellow-500" />
                <span className="font-medium text-gray-700">Service Rating</span>
              </div>
              <StarRating rating={review.service_rating} size="lg" editable={false} showLabel={false} />
              <p className="mt-1 text-sm text-gray-600">{review.service_rating}/5</p>
            </div>

            {/* Staff Rating (if provided) */}
            {review.staff_rating > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <FiUser className="h-5 w-5 text-blue-500" />
                  <span className="font-medium text-gray-700">Staff Rating</span>
                </div>
                <StarRating rating={review.staff_rating} size="lg" editable={false} showLabel={false} />
                <p className="mt-1 text-sm text-gray-600">{review.staff_rating}/5</p>
                {review.staff_name && (
                  <p className="text-xs text-gray-500 mt-1">Staff: {review.staff_name}</p>
                )}
              </div>
            )}

            {/* Review Text */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <FiMessageSquare className="h-5 w-5 text-gray-500" />
                <span className="font-medium text-gray-700">Your Feedback</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-gray-800 italic">"{review.review_text}"</p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-full py-3 bg-navy-700 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render submit mode (existing code)
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-gray-800">
            {step === 'form' ? 'Rate Your Experience' : 'Thank You!'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Service Info */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="bg-navy-100 p-2 rounded-lg">
                    <FiBriefcase className="h-5 w-5 text-navy-700" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Service</p>
                    <p className="font-medium text-gray-900">
                      {booking.service_name || booking.category || 'Service'}
                    </p>
                  </div>
                </div>
                {booking.application_number && (
                  <p className="text-xs text-gray-500 mt-2">
                    Application: {booking.application_number}
                  </p>
                )}
              </div>

              {/* Service Rating */}
              <div>
                <StarRating
                  rating={formData.service_rating}
                  onRatingChange={(value) => setFormData(prev => ({ ...prev, service_rating: value }))}
                  size="lg"
                  label="How would you rate our service?"
                />
                {errors.service_rating && (
                  <p className="mt-1 text-sm text-rose-600">{errors.service_rating}</p>
                )}
              </div>

              {/* Staff Rating (Optional) */}
              <div>
                <StarRating
                  rating={formData.staff_rating}
                  onRatingChange={(value) => setFormData(prev => ({ ...prev, staff_rating: value }))}
                  size="lg"
                  label="How would you rate the staff assistance? (Optional)"
                />
              </div>

              {/* Review Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Feedback <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="review_text"
                  value={formData.review_text}
                  onChange={handleInputChange}
                  rows="4"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-colors ${
                    errors.review_text ? 'border-rose-500' : 'border-gray-300'
                  }`}
                  placeholder="Please share your experience with us..."
                ></textarea>
                {errors.review_text && (
                  <p className="mt-1 text-sm text-rose-600">{errors.review_text}</p>
                )}
              </div>

              {errors.submit && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <p className="text-sm text-rose-700">{errors.submit}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-navy-700 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  'Submit Review'
                )}
              </button>
            </form>
          ) : (
            // Success Message
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiCheckCircle className="h-10 w-10 text-emerald-600" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Review Submitted!</h4>
              <p className="text-gray-600 mb-8">
                Thank you for taking the time to share your feedback. We truly appreciate your input!
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;