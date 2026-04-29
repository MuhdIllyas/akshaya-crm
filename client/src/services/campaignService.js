import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/servicemanagement`,
});

// Add JWT token for authentication
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  console.log('campaignService.js: Token from localStorage:', token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('campaignService.js: Sending Authorization header:', `Bearer ${token}`);
  } else {
    console.warn('campaignService.js: No JWT token found in localStorage');
  }
  return config;
}, error => {
  console.error('campaignService.js: Request interceptor error:', error);
  return Promise.reject(error);
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error('campaignService.js: API error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    if (error.response?.status === 401) {
      console.warn('campaignService.js: Unauthorized, clearing localStorage');
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('centre_id');
      localStorage.removeItem('id');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Get all campaigns
export const getCampaigns = async (centreId = 'all') => {
  console.log('campaignService.js: Fetching campaigns with centreId:', centreId);
  return await api.get('/campaigns', { params: { centre_id: centreId } });
};

// Create a new campaign
export const createCampaign = async (campaignData) => {
  console.log('campaignService.js: Creating campaign with data:', campaignData);
  return await api.post('/campaigns', campaignData);
};

// Update a campaign
export const updateCampaign = async (id, campaignData) => {
  console.log('campaignService.js: Updating campaign:', { id, campaignData });
  return await api.put(`/campaigns/${id}`, campaignData);
};

// Delete a campaign
export const deleteCampaign = async (id) => {
  console.log('campaignService.js: Deleting campaign:', id);
  return await api.delete(`/campaigns/${id}`);
};

// Get campaign reports
export const getCampaignReports = async (filters) => {
  console.log('campaignService.js: Fetching campaign reports with filters:', filters);
  return await api.get('/campaigns/reports', { params: filters });
};

// Get all services
export const getServices = async (searchQuery = '') => {
  console.log('campaignService.js: Fetching services with query:', searchQuery);
  return await api.get('/services', { params: { search: searchQuery } });
};

// Get all centres
export const getAllCentres = async () => {
  console.log('campaignService.js: Fetching all centres');
  return await api.get('/centres');
};

//token related
export const createToken = async (data) => {
  console.log('campaignService.js: Creating token:', JSON.stringify(data, null, 2));
  return await api.post('/tokens', data);
};

export const getTokens = async (centreId = null) => {
  console.log('campaignService.js: Fetching tokens:', { centreId });
  return await api.get('/tokens', { params: { centreId } });
};

export const updateTokenStatus = async (tokenId, status) => {
  console.log('campaignService.js: Updating token status:', { tokenId, status });
  return await api.put(`/token/${tokenId}/status`, { status }); 
};

export default api;
