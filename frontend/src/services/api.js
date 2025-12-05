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
    throw new Error(error.response.data.error || 'An error occurred');
  } else if (error.request) {
    throw new Error('No response from server. Please check if the backend is running.');
  } else {
    throw new Error(error.message);
  }
};

// Summit API methods
export const summitAPI = {
  // Get all summits with visit counts
  getAll: async () => {
    try {
      const response = await api.get('/summits');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Get single summit with all visits
  getById: async (id) => {
    try {
      const response = await api.get(`/summits/${id}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Create new summit (without visit)
  create: async (summitData) => {
    try {
      const response = await api.post('/summits', summitData);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Create summit with first visit
  createWithVisit: async (data) => {
    try {
      const response = await api.post('/summits-with-visit', data);
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

  // Delete summit (and all visits)
  delete: async (id) => {
    try {
      const response = await api.delete(`/summits/${id}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

// Visit API methods
export const visitAPI = {
  // Get all visits with optional filters
  getAll: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.summitId) params.append('summitId', filters.summitId);
      if (filters.year) params.append('year', filters.year);
      if (filters.season) params.append('season', filters.season);
      
      const response = await api.get(`/visits?${params.toString()}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Create new visit
  create: async (visitData) => {
    try {
      const response = await api.post('/visits', visitData);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Update visit
  update: async (id, visitData) => {
    try {
      const response = await api.put(`/visits/${id}`, visitData);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Delete visit
  delete: async (id) => {
    try {
      const response = await api.delete(`/visits/${id}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

// Statistics API
export const statsAPI = {
  get: async () => {
    try {
      const response = await api.get('/stats');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

// Export/Import utilities
export const dataAPI = {
  // Export summits and visits
  export: async () => {
    try {
      const summits = await summitAPI.getAll();
      const visits = await visitAPI.getAll();
      
      const data = {
        summits,
        visits,
        exportedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gipfel-tracker-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      handleError(error);
    }
  },

  // Import summits and visits
  import: async (data) => {
    try {
      // This would need a backend endpoint to handle bulk import
      // For now, we'll import manually
      const results = {
        summitsCreated: 0,
        visitsCreated: 0,
        errors: []
      };

      // Import summits first
      for (const summit of data.summits || []) {
        try {
          await summitAPI.create(summit);
          results.summitsCreated++;
        } catch (error) {
          results.errors.push(`Summit ${summit.name}: ${error.message}`);
        }
      }

      // Then import visits
      for (const visit of data.visits || []) {
        try {
          await visitAPI.create(visit);
          results.visitsCreated++;
        } catch (error) {
          results.errors.push(`Visit ${visit.id}: ${error.message}`);
        }
      }

      return results;
    } catch (error) {
      handleError(error);
    }
  },
};

export default api;