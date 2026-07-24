import axios from 'axios';

// USE YOUR VITE_API_URL SO IT HITS YOUR NODE.JS BACKEND
const api = axios.create({ 
    baseURL: `${import.meta.env.VITE_API_URL}/api/knowledge`, 
});

// Add a request interceptor to dynamically get the token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token'); 
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

export const fetchDiscussions = async (workspaceId) => {
  const { data } = await api.get(`/workspaces/${workspaceId}/discussions`);
  return data;
};

export const createDiscussion = async (workspaceId, payload) => {
  // This tells React to send the data to your backend!
  const { data } = await api.post(`/workspaces/${workspaceId}/discussions`, payload);
  return data;
};

export const addDiscussionReply = async (discussionId, content) => {
  const { data } = await api.post(`/discussions/${discussionId}/replies`, { content });
  return data;
};

export const markDiscussionSolved = async (discussionId, replyId = null) => {
  const { data } = await api.put(`/discussions/${discussionId}/solve`, { replyId });
  return data;
};

// ==========================================
// RESOURCES ENDPOINTS
// ==========================================

export const addResource = async (workspaceId, payload) => {
  // payload should include: { type, title, url, fileId }
  const { data } = await api.post(`/workspaces/${workspaceId}/resources`, payload);
  return data;
};

export const deleteResource = async (resourceId) => {
  const { data } = await api.delete(`/resources/${resourceId}`);
  return data;
};

// ==========================================
// CASES ENDPOINT
// ==========================================

export const fetchCases = async (workspaceId) => {
  const { data } = await api.get(`/workspaces/${workspaceId}/cases`);
  return data;
};

export const fetchGlobalHubStats = async () => {
  const { data } = await api.get('/hub/stats');
  return data;
};

export const createAnnouncement = async (payload) => {
  const { data } = await api.post('/hub/announcements', payload);
  return data;
};

export const fetchAnnouncements = async () => {
  const { data } = await api.get('/hub/announcements');
  return data;
};

export const fetchTrainings = async () => {
  const { data } = await api.get('/hub/trainings');
  return data;
};

export const createTraining = async (payload) => {
  const { data } = await api.post('/hub/trainings', payload);
  return data;
};

export default api;