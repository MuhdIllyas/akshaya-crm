// Tags (like WhatsApp tags): your own named tags of chats and notes.
import axios from 'axios';

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api/tags` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')?.trim();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fetchTags = () => api.get('/').then((r) => r.data);
export const createTag = (data) => api.post('/', data).then((r) => r.data);
export const updateTag = (id, data) => api.patch(`/${id}`, data).then((r) => r.data);
export const deleteTag = (id) => api.delete(`/${id}`).then((r) => r.data);
export const reorderTags = (ids) => api.put('/order', { ids }).then((r) => r.data);
export const addToTag = (tagId, kind, itemId) => api.put(`/${tagId}/${kind}/${itemId}`).then((r) => r.data);
export const removeFromTag = (tagId, kind, itemId) => api.delete(`/${tagId}/${kind}/${itemId}`).then((r) => r.data);

export const tagErrorMessage = (err, fallback) => err?.response?.data?.error || fallback;
