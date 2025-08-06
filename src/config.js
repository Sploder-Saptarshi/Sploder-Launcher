/**
 * Centralized configuration for Sploder-Launcher
 * This file is used by both the main process and the build script
 */

// Create configuration factory function
function createConfig(isDev = false, buildConfig = {}) {
  return {
    // Base URL for the application
    baseUrl: "https://www.sploder.net",
    
    // Build-time configuration
    build: {
      packagingMethod: buildConfig.packagingMethod || 'portable', // 'portable' or 'installed'
      ...buildConfig
    },
    
    // Specific endpoints
    endpoints: {
      update: isDev ? "/" : "/update",
      ping: "/php/ping.php"
    },
    
    // Generate a full URL for an endpoint
    getUrl: function(endpoint) {
      const baseUrl = this.baseUrl + (this.endpoints[endpoint] || endpoint);
      
      // Add parameters for update endpoint
      if (endpoint === 'update') {
        const params = new URLSearchParams();
        
        // Add OS information
        params.append('os', process.platform);
        
        // Add architecture information (ensure it's not undefined)
        const arch = process.arch || 'unknown';
        params.append('arch', arch);
        
        // Add packaging method from build configuration (Windows only)
        if (process.platform === 'win32' && this.build && this.build.packagingMethod) {
          params.append('method', this.build.packagingMethod);
        }
        
        return `${baseUrl}?${params.toString()}`;
      }
      
      return baseUrl;
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
