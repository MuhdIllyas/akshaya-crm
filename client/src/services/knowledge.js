import axios from 'axios';

// Set up the base API instance. 
// Note: If your backend runs on a different port during dev, you might need the full URL here (e.g., 'http://localhost:5000/api/knowledge')
const api = axios.create({ 
    baseURL: '/api/knowledge', 
});

// Add a request interceptor to dynamically get the token (safer than grabbing it once on load)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token'); // Adjust if you store it as 'userToken' or similar
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const fetchWorkspace = async (serviceId) => {
  const { data } = await api.get(`/workspace/${serviceId}`);
  return data;
};

export const updateWorkspaceStatus = async (workspaceId, status) => {
  const { data } = await api.put(`/workspace/${workspaceId}/status`, { status });
  return data;
};

export const batchUpdateBlocks = async (workspaceId, documentId, blocks) => {
  const { data } = await api.post(`/documents/${documentId}/blocks/batch`, {
    workspaceId,
    blocks
  });
  return data;
};

export const createDocument = async (payload) => {
    const { data } = await api.post('/documents', payload);
    return data;
};