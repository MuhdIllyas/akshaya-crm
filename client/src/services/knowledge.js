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

export const fetchAllDiscussions = async () => {
  const { data } = await api.get('/hub/discussions/all');
  return data;
};

export const fetchDiscussionById = async (id) => {
  const { data } = await api.get(`/hub/discussions/${id}`);
  return data;
};

export const fetchMyBookmarks = async () => {
  const { data } = await api.get('/hub/me/bookmarks');
  return data;
};

export const toggleBookmark = async (targetType, targetId) => {
  const { data } = await api.post('/hub/me/bookmarks/toggle', { targetType, targetId });
  return data;
};

export const fetchMyMentions = async () => {
  const { data } = await api.get('/hub/me/mentions');
  return data;
};

export const markMentionsRead = async (discussionId) => {
  await api.put('/hub/me/mentions/read', { discussionId });
};

export const fetchStaffSuggestions = async (query) => {
  const { data } = await api.get(`/hub/staff/search?q=${query}`);
  return data;
};

export const fetchMyFollowing = async () => {
  const { data } = await api.get('/hub/me/following');
  return data;
};
export const toggleFollow = async (discussionId) => {
  const { data } = await api.post('/hub/me/following/toggle', { discussionId });
  return data;
};

export const fetchMyHistory = async () => {
  const { data } = await api.get('/hub/me/history');
  return data;
};
export const logRecentView = async (targetType, targetId) => {
  await api.post('/hub/me/history/log', { targetType, targetId });
};

/* Drafts */
export const fetchMyDrafts = async () => {
  const { data } = await api.get('/hub/me/drafts');
  return data;
};
export const saveDraft = async (payload) => {
  const { data } = await api.post('/hub/me/drafts', payload);
  return data;
};
export const deleteDraft = async (draftId) => {
  await api.delete(`/hub/me/drafts/${draftId}`);
};

export const fetchRecentActivity = async () => {
  const { data } = await api.get('/hub/activity');
  return data;
};

export const lookupCrmRecord = async (type, id, serviceId = null) => {
  let url = `/hub/crm-lookup?type=${type}&id=${id}`;
  if (serviceId) url += `&serviceId=${serviceId}`; 
  const { data } = await api.get(url);
  return data;
};

export default api;