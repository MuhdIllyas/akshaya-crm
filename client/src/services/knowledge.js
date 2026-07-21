import axios from 'axios';

export const fetchWorkspace = async (serviceId) => {
  // Replace with your actual auth setup if needed
  const { data } = await axios.get(`/api/knowledge/workspace/${serviceId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  return data;
};