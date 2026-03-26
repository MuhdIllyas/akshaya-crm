import axios from "axios";
import { toast } from "react-toastify";

const customerApi = axios.create({
  baseURL: "http://localhost:5000/api/customer",
});

/* ================= REQUEST INTERCEPTOR ================= */
customerApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token")?.trim();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn("customerService: No token found");
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ================= RESPONSE INTERCEPTOR ================= */
customerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("customerService API error:", {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (error.response?.status === 401) {
      toast.error("Unauthorized. Please login again.");
    }

    return Promise.reject(error);
  }
);

/* ================= APIs ================= */

/** GLOBAL CUSTOMER FETCH (staff/admin/superadmin) */
export const getCustomerById = (customerId) => {
  return customerApi.get(`/${customerId}`);
};

export const getAllCustomers = () => {
  return customerApi.get("/"); // Assuming GET /api/customer returns all
};

export default customerApi;