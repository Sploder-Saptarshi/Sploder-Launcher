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
        console.log('[CONFIG] Adding OS parameter:', process.platform);
        params.append('os', process.platform);
        
        // Add architecture information (ensure it's not undefined)
        const arch = process.arch || 'unknown';
        console.log('[CONFIG] Adding ARCH parameter:', arch);
        params.append('arch', arch);
        
        // Add packaging method from build configuration (Windows only)
        console.log('[CONFIG] Platform check:', process.platform);
        console.log('[CONFIG] Build config:', JSON.stringify(this.build, null, 2));
        
        if (process.platform === 'win32' && this.build && this.build.packagingMethod) {
          console.log('[CONFIG] Adding METHOD parameter:', this.build.packagingMethod);
          params.append('method', this.build.packagingMethod);
        } else {
          console.log('[CONFIG] METHOD parameter NOT added. Reasons:');
          console.log('  - Platform is Windows:', process.platform === 'win32');
          console.log('  - Build config exists:', !!this.build);
          console.log('  - Packaging method exists:', !!(this.build && this.build.packagingMethod));
        }
        
        // Log all parameters before creating URL
        console.log('[CONFIG] All URL parameters:');
        for (const [key, value] of params) {
          console.log(`  ${key} = ${value}`);
        }
        
        const finalUrl = `${baseUrl}?${params.toString()}`;
        console.log('[CONFIG] Final generated URL:', finalUrl);
        
        return finalUrl;
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
