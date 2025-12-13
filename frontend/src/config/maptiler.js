// MapTiler Configuration for Summit Tracker
// Get your free API key at: https://cloud.maptiler.com/

export const MAPTILER_CONFIG = {
  // Your MapTiler API key
  apiKey: process.env.REACT_APP_MAPTILER_KEY,
  
  // Available map styles
  styles: {
    // Outdoor map - perfect for hiking and summits (recommended)
    outdoor: {
      id: 'outdoor-v4',
      name: 'Outdoor',
      url: 'https://api.maptiler.com/maps/outdoor-v4/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 20,
    },
    
    // Topographic map with contour lines
    topo: {
      id: 'topo-v2',
      name: 'Topographic',
      url: 'https://api.maptiler.com/maps/topo-v2/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 20,
    },
    
    // Satellite imagery
    satellite: {
      id: 'satellite',
      name: 'Satellite',
      url: 'https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg',
      attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>',
      maxZoom: 20,
    },
    
    // Hybrid (satellite + labels)
    hybrid: {
      id: 'hybrid',
      name: 'Hybrid',
      url: 'https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg',
      attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>',
      maxZoom: 20,
    },
    
    // Winter map (good for ski tours)
    winter: {
      id: 'winter-v2',
      name: 'Winter',
      url: 'https://api.maptiler.com/maps/winter-v2/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    },
    
    // Basic map (clean, minimal)
    basic: {
      id: 'basic-v2',
      name: 'Basic',
      url: 'https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 20,
    },
  },
  
  // Default style to use
  defaultStyle: 'outdoor',
};

// Helper function to get tile URL with API key
export function getTileUrl(styleId = 'outdoor') {
  const style = MAPTILER_CONFIG.styles[styleId] || MAPTILER_CONFIG.styles.outdoor;
  return `${style.url}?key=${MAPTILER_CONFIG.apiKey}`;
}

// Helper function to get style config
export function getMapStyle(styleId = 'outdoor') {
  return MAPTILER_CONFIG.styles[styleId] || MAPTILER_CONFIG.styles.outdoor;
}

export default MAPTILER_CONFIG;