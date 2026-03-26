import axios from 'axios';
import { toast } from 'react-toastify';

const api = axios.create({
  baseURL: 'http://localhost:5000/api/servicemanagement',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')?.trim();
  console.log('serviceService.js: Token from localStorage:', token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('serviceService.js: Sending Authorization header:', `Bearer ${token}`);
  } else {
    console.warn('serviceService.js: No JWT token found in localStorage');
  }
  console.log('serviceService.js: Request URL:', config.url);
  return config;
}, error => {
  console.error('serviceService.js: Request interceptor error:', error);
  return Promise.reject(error);
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error('serviceService.js: API error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    if (error.response?.status === 401) {
      console.warn('serviceService.js: Unauthorized for URL:', error.config?.url);
      toast.error(`Unauthorized access for ${error.config?.url}. Please log in again.`, {
        position: 'top-right',
        autoClose: 3000,
        theme: 'light',
        toastId: `auth-error-${error.config?.url}`,
      });
      // Do not clear localStorage or redirect; let ProtectedRoute handle authentication
    }
    return Promise.reject(error);
  }
);

// Service Tracking API
const trackingApi = axios.create({
  baseURL: 'http://localhost:5000/api/servicetracking',
});

trackingApi.interceptors.request.use(config => {
  const token = localStorage.getItem('token')?.trim();
  console.log('serviceService.js: Token from localStorage (tracking):', token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('serviceService.js: Sending Authorization header (tracking):', `Bearer ${token}`);
  } else {
    console.warn('serviceService.js: No JWT token found in localStorage (tracking)');
  }
  console.log('serviceService.js: Request URL (tracking):', config.url);
  return config;
}, error => {
  console.error('serviceService.js: Request interceptor error (tracking):', error);
  return Promise.reject(error);
});

trackingApi.interceptors.response.use(
  response => response,
  error => {
    console.error('serviceService.js: API error (tracking):', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    if (error.response?.status === 401) {
      console.warn('serviceService.js: Unauthorized for URL (tracking):', error.config?.url);
      toast.error(`Unauthorized access for ${error.config?.url}. Please log in again.`, {
        position: 'top-right',
        autoClose: 3000,
        theme: 'light',
        toastId: `auth-error-${error.config?.url}`,
      });
    }
    return Promise.reject(error);
  }
);

// Get all services (admin only)
export const getServices = async (searchQuery = '') => {
  console.log('serviceService.js: Fetching services with query:', searchQuery);
  return await api.get('/services', { params: { search: searchQuery } });
};

// Get all categories (staff)
export const getCategories = async () => {
  console.log('serviceService.js: Fetching categories');
  return await api.get('/categories');
};

// Create a new service (admin only)
export const createService = async (serviceData) => {
  console.log('serviceService.js: Creating service with data:', serviceData);
  return await api.post('/services', serviceData);
};

// Update a service (admin only)
export const updateService = async (id, serviceData) => {
  console.log('serviceService.js: Updating service:', { id, serviceData });
  return await api.put(`/services/${id}`, serviceData);
};

// Delete a service (admin only)
export const deleteService = async (id) => {
  console.log('serviceService.js: Deleting service:', id);
  return await api.delete(`/services/${id}`);
};

// Add a subcategory (admin only)
export const addSubcategory = async (serviceId, subcategoryData) => {
  console.log('serviceService.js: Adding subcategory to service:', { serviceId, subcategoryData });
  return await api.post(`/services/${serviceId}/subcategories`, subcategoryData);
};

// Delete a subcategory (admin only)
export const deleteSubcategory = async (serviceId, subId) => {
  console.log('serviceService.js: Deleting subcategory:', { serviceId, subId });
  return await api.delete(`/services/${serviceId}/subcategories/${subId}`);
};

// Get all wallets
export const getWallets = async () => {
  console.log('serviceService.js: Fetching wallets');
  return await api.get('/wallets');
};

// Get all staff
export const getStaff = async (centreId) => {
  console.log('serviceService.js: Fetching staff for centre:', centreId);
  return await api.get('/staff', { params: { centre_id: centreId } });
};

// Create a token (staff)
export const createToken = async (tokenData) => {
  console.log('serviceService.js: Creating token with data:', tokenData);
  return await api.post('/tokens', tokenData);
};

// Get tokens by centre and status (staff)
export const getTokens = async (centreId, status = 'pending') => {
  console.log('serviceService.js: Fetching tokens for centre:', centreId, 'with status:', status);
  return await api.get('/tokens', { params: { centre_id: centreId, status } });
};

// Get token by ID (staff)
export const getTokenById = async (tokenId) => {
  console.log('serviceService.js: Fetching token:', tokenId);
  return await api.get(`/tokens/${tokenId}`);
};

// Assign staff to token (admin only)
export const assignStaffToToken = async (tokenId, staffId) => {
  console.log('serviceService.js: Assigning staff to token:', { tokenId, staffId });
  return await api.put(`/token/${tokenId}/assign`, { staffId });
};

// Get all campaigns (admin only)
export const getCampaigns = async (centreId) => {
  console.log('serviceService.js: Fetching campaigns for centre:', centreId);
  return await api.get('/campaigns', { params: { centre_id: centreId } });
};

// Get active campaigns for staff
export const getStaffCampaigns = async () => {
  console.log('serviceService.js: Fetching active campaigns for staff');
  return await api.get('/staff/campaigns');
};

// Create a campaign (admin only)
export const createCampaign = async (campaignData) => {
  console.log('serviceService.js: Creating campaign with data:', campaignData);
  return await api.post('/campaigns', campaignData);
};

// Update a campaign (admin only)
export const updateCampaign = async (id, campaignData) => {
  console.log('serviceService.js: Updating campaign:', { id, campaignData });
  return await api.put(`/campaigns/${id}`, campaignData);
};

// Delete a campaign (admin only)
export const deleteCampaign = async (id) => {
  console.log('serviceService.js: Deleting campaign:', id);
  return await api.delete(`/campaigns/${id}`);
};

// Get token data for service entry (staff)
export const getTokenData = async (tokenId) => {
  console.log('serviceService.js: Fetching token data for service entry:', tokenId);
  return await api.get(`/tokens/${tokenId}`);
};

// Get all service entries (staff)
export const getServiceEntries = async (today = false) => {
  console.log('serviceService.js: Fetching service entries', { today });
  return await api.get('/entries', { params: { today } });
};

// Create a service entry (staff)
export const createServiceEntry = async (entryData) => {
  console.log('serviceService.js: Creating/updating service entry:', entryData);
  return await api.post('/entry', entryData);
};

// Update a service entry (staff)
export const updateServiceEntry = async (id, entryData) => {
  console.log('serviceService.js: Updating service entry:', { id, entryData });
  return (await api.put(`/entry/${id}`, entryData)).data;
};

// Update token status (staff)
export const updateTokenStatus = async (tokenId, status) => {
  console.log('serviceService.js: Updating token status:', { tokenId, status });
  return await api.put(`/token/${tokenId}/status`, { status });
};

// Get active campaigns only (not expired)
export const getActiveCampaigns = async (centreId = 'all') => {
  console.log('serviceService.js: Fetching active campaigns with centreId:', centreId);
  return await api.get('/campaigns/active', { params: { centre_id: centreId } });
};

// Get campaign token history (includes expired)
export const getCampaignHistory = async (centreId = null) => {
  console.log('serviceService.js: Fetching campaign history:', { centreId });
  return await api.get('/tokens/history', { params: { centreId } });
};

// Delete token (with protection for campaign tokens)
export const deleteToken = async (tokenId) => {
  console.log('serviceService.js: Deleting token:', tokenId);
  return await api.delete(`/tokens/${tokenId}`);
};

//Service Tracking
export const getTrackingEntries = async (params = {}) => {
  console.log('serviceService.js: Fetching tracking entries with params:', params);
  const response = await trackingApi.get('/entries', { params });
  console.log('serviceService.js: Raw tracking entries response:', response.data);
  return response.data;
};

export const updateTrackingEntry = async (id, trackingData) => {
  console.log('serviceService.js: Updating tracking entry:', { id, trackingData });
  return (await trackingApi.put(`/${id}`, trackingData)).data;
};

export const updateTrackingStatus = async (id, status) => {
  console.log('serviceService.js: Updating tracking status:', { id, status });
  return (await trackingApi.put(`/entries/${id}/update-status`, { status })).data;
};

export const notifyCustomer = async (id, message) => {
  console.log('serviceService.js: Sending notification for tracking entry:', { id, message });
  return (await trackingApi.post(`/entries/${id}/notify`, { message })).data;
};

//service_logs in admin / superadmin related
export const getServiceEntryByTokenId = async (tokenId) => {
  try {
    const response = await axios.get(`/api/servicemanagement/entry/${tokenId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching service entry for tokenId ${tokenId}:`, error);
    throw error;
  }
};

// Fetch all centres
/*export const getCentres = async () => {
  try {
    console.log('serviceService.js: Fetching centres');
    const response = await api.get('/centres');
    console.log('serviceService.js: Centres response:', response.data);
    return response.data;
  } catch (error) {
    console.error('serviceService.js: Error fetching centres:', error);
    throw error;
  }
}; */

// ================================
// Pending Payments APIs
// ================================

export const getPendingPayments = async (params = {}) => {
  const response = await api.get(`/pending-payments`, { params });
  return response.data;
};

export const receiveServicePayment = async (serviceEntryId, payload) => {
  const response = await api.post(
    `/pending-payments/${serviceEntryId}/receive-payment`,
    payload
  );
  return response.data;
};

export const getPendingPaymentsHistory = async (params = {}) => {
  const response = await api.get(`/pending-payments/history`, { params });
  return response.data;
};

/************************************ 
 * for Customers History *
*************************************/
export const getCustomerHistory = async (params) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.aadhaar) queryParams.append('aadhaar', params.aadhaar);
    if (params.email) queryParams.append('email', params.email);
    if (params.phone) queryParams.append('phone', params.phone);
    
    const response = await trackingApi.get(`/customer/history?${queryParams.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching customer history:', error);
    throw error;
  }
};

// Get single tracking entry by ID
export const getTrackingEntryById = async (id) => {
  try {
    const response = await trackingApi.get(`/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching tracking entry:', error);
    throw error;
  }
};

export default api;