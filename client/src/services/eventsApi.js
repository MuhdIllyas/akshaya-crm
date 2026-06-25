import axios from "axios";

const API = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api/events`,
  withCredentials: true,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const getEvents = async (params = {}) => {
  const res = await API.get("/", { params });
  return res.data;
};

export const createEvent = async (data) => {
  const res = await API.post("/", data);
  return res.data;
};

export const updateEvent = async (id, data) => {
  const res = await API.put(`/${id}`, data);
  return res.data;
};

export const deleteEvent = async (id) => {
  const res = await API.delete(`/${id}`);
  return res.data;
};