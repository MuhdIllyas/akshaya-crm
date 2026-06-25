import axios from 'axios';

export const getServiceEntries = async () => {
  try {
    const response = await axios.get('/api/servicemanagement/entries');
    return Array.isArray(response.data) ? response.data : response.data.data || [];
  } catch (error) {
    console.error('Error fetching service entries:', error);
    throw error;
  }
};

export const getServiceEntryByTokenId = async (tokenId) => {
  try {
    const response = await axios.get(`/api/servicemanagement/entry/${tokenId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching service entry for tokenId ${tokenId}:`, error);
    throw error;
  }
};