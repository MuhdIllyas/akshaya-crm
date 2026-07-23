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

export const createDiscussion = async (req, res) => {
    try {
        const discussion = await knowledgeService.createDiscussion(req.params.workspaceId, req.body, req.user.id);
        res.status(201).json(discussion);
    } catch (err) {
        // 👇 ADD THESE TWO LINES TO REVEAL THE ERROR 👇
        console.error("💥 DISCUSSION CRASH INFO:", err); 
        res.status(500).json({ error: 'Failed to create discussion', details: err.message });
    }
};

export const addDiscussionReply = async (discussionId, content) => {
  const { data } = await api.post(`/discussions/${discussionId}/replies`, { content });
  return data;
};

export const markDiscussionSolved = async (discussionId, replyId = null) => {
  const { data } = await api.put(`/discussions/${discussionId}/solve`, { replyId });
  return data;
};

export default api;