import axios from 'axios';

const API = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}` ,
});

// Add auth interceptor for protected routes
API.interceptors.request.use((config) => {
  // For customer routes, use customer_token
  const token = localStorage.getItem("customer_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('ReviewService: Added customer token to request');
  } else {
    console.warn('ReviewService: No customer_token found in localStorage');
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Public review submission (no auth required)
export const submitPublicReview = async (token, reviewData) => {
  try {
    const response = await API.post(`/api/reviews/public/${token}`, reviewData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get public review by token (check if already submitted)
export const getPublicReviewByToken = async (token) => {
  try {
    const response = await API.get(`/api/reviews/public/${token}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Submit review for logged-in customer booking
export const submitBookingReview = async (bookingId, reviewData) => {
  try {
    const response = await API.post(`/api/reviews/booking/${bookingId}`, reviewData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Check if booking is eligible for review
export const checkBookingReviewEligibility = async (bookingId) => {
  try {
    const response = await API.get(`/api/reviews/booking/${bookingId}/eligibility`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Staff view their reviews
export const getStaffReviews = async (staffId) => {
  try {
    const response = await API.get(`/api/reviews/staff/${staffId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Admin view centre reviews
export const getCentreReviews = async (centreId, filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    const response = await API.get(`/api/reviews/centre/${centreId}?${params}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Superadmin view all reviews with filters
export const getAllReviews = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    const response = await API.get(`/api/reviews/all?${params}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get review for a specific booking
export const getBookingReview = async (bookingId) => {
  try {
    const response = await API.get(`/api/reviews/booking/${bookingId}/review`);
    return response.data;
  } catch (error) {
    console.error('getBookingReview error:', error.response?.data || error.message);
    // Return null for 404 (no review found)
    if (error.response?.status === 404) {
      return null;
    }
    throw error.response?.data || { message: error.message };
  }
};
