/**
 * Centralized configuration for Sploder-Launcher
 * This file is used by both the main process and the build script
 */

// Default configuration
const config = {
  // Base URL for the application
  baseUrl: "https://www.sploder.net",
  
  // Specific endpoints
  endpoints: {
    update: "/update",
    ping: "/php/ping.php"
  },
  
  // Generate a full URL for an endpoint
  getUrl: function(endpoint) {
    return this.baseUrl + (this.endpoints[endpoint] || endpoint);
  }
};

// Allow overriding the base URL if needed
function setBaseUrl(url) {
  config.baseUrl = url;
}

module.exports = {
  config,
  setBaseUrl
};
