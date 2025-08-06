/**
 * Centralized configuration for Sploder-Launcher
 * This file is used by both the main process and the build script
 */

// Create configuration factory function
function createConfig(isDev = false) {
  return {
    // Base URL for the application
    baseUrl: "https://www.sploder.net",
    
    // Specific endpoints
    endpoints: {
      update: isDev ? "/" : "/update",
      ping: "/php/ping.php"
    },
    
    // Generate a full URL for an endpoint
    getUrl: function(endpoint) {
      return this.baseUrl + (this.endpoints[endpoint] || endpoint);
    }
  };
}

// Default configuration (fallback detection for development)
const config = createConfig(process.env.NODE_ENV === 'development' || !process.env.NODE_ENV);

// Allow overriding the base URL if needed
function setBaseUrl(url) {
  config.baseUrl = url;
}

module.exports = {
  config,
  createConfig,
  setBaseUrl
};
