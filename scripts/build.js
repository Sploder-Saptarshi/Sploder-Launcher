/**
 * Build script for Sploder-Launcher
 * Handles the build process with URL parameter support
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const urlArgIndex = args.indexOf('--url');
let customUrl = null;

if (urlArgIndex !== -1 && args[urlArgIndex + 1]) {
  customUrl = args[urlArgIndex + 1];
  console.log(`\x1b[36mCustom URL detected: ${customUrl}\x1b[0m`);
}

// Update config if URL is provided
if (customUrl) {
  try {
    const configPath = path.join(__dirname, '..', 'src', 'config.js');
    console.log(`\x1b[36mUpdating config at: ${configPath}\x1b[0m`);
    
    // Read the current config file
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Replace the baseUrl value
    configContent = configContent.replace(
      /baseUrl: ["'].*?["']/,
      `baseUrl: "${customUrl}"`
    );
    
    // Write the updated config back
    fs.writeFileSync(configPath, configContent, 'utf8');
    console.log(`\x1b[32mConfig updated with base URL: ${customUrl}\x1b[0m`);
  } catch (error) {
    console.error(`\x1b[31mError updating config: ${error.message}\x1b[0m`);
    process.exit(1);
  }
}

// Run the compilation step
console.log('\x1b[36mCompiling the application...\x1b[0m');
try {
  execSync('yarn compile', { stdio: 'inherit' });
} catch (error) {
  console.error('\x1b[31mCompilation failed!\x1b[0m');
  process.exit(1);
}

// Run the appropriate electron-builder command based on the platform
console.log('\x1b[36mBuilding distributable packages...\x1b[0m');
try {
  // Pass all original arguments (except --url and the URL) to electron-builder
  const filteredArgs = args.filter((arg, index) => {
    return index !== urlArgIndex && index !== urlArgIndex + 1;
  }).join(' ');
  
  if (process.platform === 'win32') {
    execSync(`npx yarn electron-builder --ia32 --x64 ${filteredArgs}`, { stdio: 'inherit' });
  } else if (process.platform === 'darwin') {
    execSync(`electron-builder --mac --x64 ${filteredArgs}`, { stdio: 'inherit' });
  } else {
    execSync(`electron-builder --linux appimage snap deb rpm pacman ${filteredArgs}`, { stdio: 'inherit' });
  }
  
  console.log('\x1b[32mBuild completed successfully!\x1b[0m');
} catch (error) {
  console.error('\x1b[31mBuild failed!\x1b[0m');
  process.exit(1);
}
