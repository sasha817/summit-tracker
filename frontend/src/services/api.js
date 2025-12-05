import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handler
const handleError = (error) => {
  if (error.response) {
    // Server responded with error
    throw new Error(error.response.data.error || 'An error occurred');
  } else if (error.request) {
    // Request made but no response
    throw new Error('No response from server. Please check if the backend is running.');
  } else {
    // Something else happened
    throw new Error(error.message);
  }
};

// Summit API methods
export const summitAPI = {
  // Get all summits
  getAll: async () => {
    try {
      const response = await api.get('/summits');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Get single summit
  getById: async (id) => {
    try {
      const response = await api.get(`/summits/${id}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Create new summit
  create: async (summitData) => {
    try {
      const response = await api.post('/summits', summitData);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Update summit
  update: async (id, summitData) => {
    try {
      const response = await api.put(`/summits/${id}`, summitData);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Delete summit
  delete: async (id) => {
    try {
      const response = await api.delete(`/summits/${id}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Export summits
  export: async () => {
    try {
      const response = await api.get('/summits/export/json');
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `summits-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      handleError(error);
    }
  },

  // Import summits
  import: async (summits, mode = 'replace') => {
    try {
      const response = await api.post('/summits/import', { summits, mode });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

export default api;