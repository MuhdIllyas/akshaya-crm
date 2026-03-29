// PublicReview.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FiStar, FiCheckCircle, FiBriefcase, FiCalendar, 
  FiMessageSquare, FiUser, FiAlertCircle, FiClock
} from 'react-icons/fi';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import StarRating from './StarRating';

const PublicReview = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    service_rating: 0,
    staff_rating: 0,
    review_text: ''
  });
  
  const [errors, setErrors] = useState({});

  // Initialize Axios instance
  const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL ,
  });

  // Validate token and fetch review details
  useEffect(() => {
    const validateToken = async () => {
      try {
        setValidating(true);
        const response = await API.get(`/api/reviews/public/${token}`);
        
        setReviewData(response.data);
        
        // Check if already submitted
        if (response.data.is_submitted) {
          setError('This review has already been submitted. Thank you for your feedback!');
        }
      } catch (error) {
        console.error('Error validating token:', error);
        setError(
          error.response?.data?.message || 
          'Unable to load review. Please check your link or contact support.'
        );
      } finally {
        setValidating(false);
        setLoading(false);
      }
    };

    if (token) {
      validateToken();
    }
  }, [token]);

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
      await API.post(`/api/reviews/public/${token}`, formData);
      setSubmitted(true);
      toast.success('Thank you for your feedback!');
    } catch (error) {
      console.error('Error submitting review:', error);
      const errorMessage = error.response?.data?.message || 'Failed to submit review';
      setErrors({ submit: errorMessage });
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your review request...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-8 text-center">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiAlertCircle className="h-10 w-10 text-rose-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load Review</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              If you believe this is an error, please contact the Akshaya Centre where you availed the service.
            </p>
            <button
              onClick={() => window.location.href = 'https://akshayacentre.gov.in'}
              className="w-full px-6 py-3 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
            >
              Visit Akshaya Centre Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Already submitted state
  if (reviewData?.is_submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-8 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiCheckCircle className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Review Already Submitted</h2>
          <p className="text-gray-600 mb-6">
            Thank you! Your feedback has already been recorded. We appreciate your time and input.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Submitted on:</span>{' '}
              {reviewData.submitted_at ? new Date(reviewData.submitted_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : 'N/A'}
            </p>
          </div>
          <button
            onClick={() => window.location.href = 'https://akshayacentre.gov.in'}
            className="w-full px-6 py-3 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-8 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiCheckCircle className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Thank You!</h2>
          <p className="text-gray-600 mb-6">
            Your feedback has been successfully submitted. We truly appreciate you taking the time to share your experience with us.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
            <p className="text-sm text-blue-800">
              Your feedback helps us improve our services and serve you better.
            </p>
          </div>
          <button
            onClick={() => window.location.href = 'https://akshayacentre.gov.in'}
            className="w-full px-6 py-3 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  // Main review form
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <ToastContainer position="top-right" autoClose={3000} />
      
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src="/logo.png" 
            alt="Akshaya Centre" 
            className="h-16 mx-auto mb-4"
            onError={(e) => e.target.style.display = 'none'}
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Share Your Feedback</h1>
          <p className="text-gray-600">
            We value your opinion! Please take a moment to rate your experience.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Customer Info Banner */}
          {reviewData && (
            <div className="bg-gradient-to-r from-navy-700 to-navy-800 p-6 text-white">
              <div className="flex items-start space-x-4">
                <div className="bg-white/20 p-3 rounded-lg">
                  <FiUser className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-navy-200 mb-1">Dear</p>
                  <h2 className="text-xl font-semibold mb-2">
                    {reviewData.customer_name || 'Valued Customer'}
                  </h2>
                  <div className="flex items-center text-sm text-navy-200">
                    <FiBriefcase className="mr-2" />
                    Service: {reviewData.service_name || 'Government Service'}
                  </div>
                  {reviewData.staff_name && (
                    <div className="flex items-center text-sm text-navy-200 mt-1">
                      <FiUser className="mr-2" />
                      Staff: {reviewData.staff_name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Service Rating */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <StarRating
                rating={formData.service_rating}
                onRatingChange={(value) => setFormData(prev => ({ ...prev, service_rating: value }))}
                size="lg"
                label="How would you rate the overall service?"
              />
              {errors.service_rating && (
                <p className="mt-1 text-sm text-rose-600">{errors.service_rating}</p>
              )}
            </div>

            {/* Staff Rating (Optional) */}
            {reviewData?.staff_name && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <StarRating
                  rating={formData.staff_rating}
                  onRatingChange={(value) => setFormData(prev => ({ ...prev, staff_rating: value }))}
                  size="lg"
                  label={`How would you rate the assistance from ${reviewData.staff_name}? (Optional)`}
                />
              </div>
            )}

            {/* Review Text */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Feedback <span className="text-rose-500">*</span>
              </label>
              <textarea
                name="review_text"
                value={formData.review_text}
                onChange={handleInputChange}
                rows="5"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 ${
                  errors.review_text ? 'border-rose-500' : 'border-gray-300'
                }`}
                placeholder="Please share your experience with us... What did you like? How can we improve?"
              ></textarea>
              {errors.review_text && (
                <p className="mt-1 text-sm text-rose-600">{errors.review_text}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Your feedback helps us serve you better. Minimum 10 characters.
              </p>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-sm text-rose-700">{errors.submit}</p>
              </div>
            )}

            {/* Privacy Notice */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                <span className="font-medium">Privacy Notice:</span> Your feedback will be used to improve our services. We will not share your personal information with third parties.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-navy-700 text-white rounded-lg font-semibold hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Submitting Feedback...
                </>
              ) : (
                'Submit Feedback'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by Akshaya Centre | Government of Kerala Initiative</p>
          <p className="mt-1">For any assistance, please contact the Akshaya Centre where you availed the service.</p>
        </div>
      </div>
    </div>
  );
};

export default PublicReview;
