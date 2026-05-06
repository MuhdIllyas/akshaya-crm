import axios from "axios";

const API = axios.create({
  baseURL: "/api/events",
  withCredentials: true,
});

/* =========================
   GET EVENTS
========================= */

export const getEvents = async (params = {}) => {
  const res = await API.get("/", { params });
  return res.data;
};

/* =========================
   CREATE EVENT
========================= */

export const createEvent = async (data) => {
  const res = await API.post("/", data);
  return res.data;
};

/* =========================
   UPDATE EVENT
========================= */

export const updateEvent = async (id, data) => {
  const res = await API.put(`/${id}`, data);
  return res.data;
};

/* =========================
   DELETE EVENT
========================= */

export const deleteEvent = async (id) => {
  const res = await API.delete(`/${id}`);
  return res.data;
};