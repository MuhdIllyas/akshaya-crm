import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiStar, FiCheckCircle, FiAlertCircle, FiMessageSquare, FiUser, FiBriefcase } from 'react-icons/fi';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import StarRating from '@/components/StarRating';
import { getPublicReviewByToken, submitPublicReview } from '@/services/reviewService';

const PublicReviewPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [formData, setFormData] = useState({
    service_rating: 0,
    staff_rating: 0,
    review_text: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchReviewDetails();
  }, [token]);

  const fetchReviewDetails = async () => {
    try {
      setLoading(true);
      const data = await getPublicReviewByToken(token);
      
      if (data.is_submitted) {
        setAlreadySubmitted(true);
        setReview(data);
      } else {
        setReview(data);
        setFormData({
          service_rating: 0,
          staff_rating: 0,
          review_text: ''
        });
      }
    } catch (error) {
      console.error('Error fetching review:', error);
      toast.error(error.message || 'Invalid or expired review link');
      // Redirect to home after 3 seconds
      setTimeout(() => navigate('/'), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      setSubmitting(true);
      await submitPublicReview(token, formData);
      toast.success('Thank you for your feedback!');
      setAlreadySubmitted(true);
      setReview({ ...review, ...formData, is_submitted: true });
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading review form...</p>
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <ToastContainer position="top-right" autoClose={3000} />
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiCheckCircle className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">
            Your feedback has been submitted successfully. We appreciate your time and valuable input.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-gray-900 mb-3">Your Review Summary</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-1">Service Rating</p>
                <StarRating rating={review?.service_rating} size="sm" editable={false} showLabel={false} />
              </div>
              {review?.staff_rating > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Staff Rating</p>
                  <StarRating rating={review?.staff_rating} size="sm" editable={false} showLabel={false} />
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 mb-1">Your Feedback</p>
                <p className="text-sm text-gray-800 bg-white p-2 rounded border border-gray-200">
                  "{review?.review_text}"
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiAlertCircle className="h-10 w-10 text-rose-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-gray-600 mb-6">
            This review link is invalid or has expired. Please contact the service centre for assistance.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-navy-700 to-navy-800 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiMessageSquare className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">We Value Your Feedback!</h1>
            <p className="text-navy-100">
              Help us improve our services by sharing your experience
            </p>
          </div>

          {/* Service Info */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="bg-navy-100 p-2 rounded-lg">
                <FiBriefcase className="h-5 w-5 text-navy-700" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Service</p>
                <p className="font-medium text-gray-900">{review.service_name || 'Service'}</p>
              </div>
            </div>
          </div>

          {/* Review Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                rows="5"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-colors ${
                  errors.review_text ? 'border-rose-500' : 'border-gray-300'
                }`}
                placeholder="Please share your experience with us..."
              ></textarea>
              {errors.review_text && (
                <p className="mt-1 text-sm text-rose-600">{errors.review_text}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Your feedback helps us serve you better
              </p>
            </div>

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
                'Submit Feedback'
              )}
            </button>

            <p className="text-xs text-center text-gray-500">
              Your feedback is anonymous and will help us improve our services
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PublicReviewPage;