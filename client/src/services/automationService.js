// src/services/automationService.js
import axios from 'axios';

const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/automations`,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getPresets = () => client.get('/presets').then((r) => r.data);

export const previewAutomation = (body) => client.post('/preview', body).then((r) => r.data);

export const createAutomations = (serviceEntryId, actions) =>
  client.post('/', { service_entry_id: serviceEntryId, actions }).then((r) => r.data);

export const getEntryAutomations = (serviceEntryId) =>
  client.get(`/entry/${serviceEntryId}`).then((r) => r.data);

export const cancelAutomation = (id) => client.patch(`/${id}/cancel`).then((r) => r.data);

export const runAutomationNow = (id) => client.post(`/${id}/run-now`).then((r) => r.data);

export const rescheduleAutomation = (id, runAt) =>
  client.patch(`/${id}/reschedule`, { run_at: runAt }).then((r) => r.data);