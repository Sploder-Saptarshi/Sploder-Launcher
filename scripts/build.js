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
const portableArgIndex = args.indexOf('--portable');
let customUrl = null;
let isPortable = false;

if (urlArgIndex !== -1 && args[urlArgIndex + 1]) {
  customUrl = args[urlArgIndex + 1];
  console.log(`\x1b[36mCustom URL detected: ${customUrl}\x1b[0m`);
}

if (portableArgIndex !== -1) {
  isPortable = true;
  console.log(`\x1b[36mBuilding portable version\x1b[0m`);
} else {
  console.log(`\x1b[36mBuilding installed version\x1b[0m`);
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

// Inject build configuration into the main process file
try {
  const mainPath = path.join(__dirname, '..', 'src', 'main', 'index.js');
  console.log(`\x1b[36mInjecting build configuration into: ${mainPath}\x1b[0m`);
  
  // Read the main file
  let mainContent = fs.readFileSync(mainPath, 'utf8');
  
  // Remove any existing injected build configuration
  mainContent = mainContent.replace(
    /\/\/ Injected build configuration\nconst BUILD_CONFIG = .*?;\n\n/g,
    ''
  );
  
  // Define build configuration
  const buildConfig = {
    packagingMethod: isPortable ? 'portable' : 'installed'
  };
  
  // Inject BUILD_CONFIG before the main logic
  const buildConfigInjection = `// Injected build configuration
const BUILD_CONFIG = ${JSON.stringify(buildConfig)};

`;
  
  // Add it at the beginning of the file (after requires)
  const requiresEndPattern = /const isDev = !app\.isPackaged;/;
  mainContent = mainContent.replace(requiresEndPattern, `${buildConfigInjection}const isDev = !app.isPackaged;`);
  
  // Write the updated main file back
  fs.writeFileSync(mainPath, mainContent, 'utf8');
  console.log(`\x1b[32mBuild configuration injected: ${JSON.stringify(buildConfig)}\x1b[0m`);
} catch (error) {
  console.error(`\x1b[31mError injecting build configuration: ${error.message}\x1b[0m`);
  process.exit(1);
}// Run the compilation step
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
  // Pass all original arguments (except --url, --portable and their values) to electron-builder
  const filteredArgs = args.filter((arg, index) => {
    return index !== urlArgIndex && index !== urlArgIndex + 1 && index !== portableArgIndex;
  }).join(' ');
  
  if (isPortable) {
    // Build only portable versions
    if (process.platform === 'win32') {
      execSync(`npx yarn electron-builder --win zip --ia32 --x64 -c.win.artifactName="Sploder-Portable-\${arch}.\${ext}" ${filteredArgs}`, { stdio: 'inherit' });
    } else if (process.platform === 'darwin') {
      execSync(`electron-builder --mac zip --x64 -c.mac.artifactName="Sploder-Portable-\${arch}.\${ext}" ${filteredArgs}`, { stdio: 'inherit' });
    } else {
      // For Linux, we'll use the unpacked directory as "portable"
      execSync(`electron-builder --linux dir ${filteredArgs}`, { stdio: 'inherit' });
    }
  } else {
    // Build installer versions (default)
    if (process.platform === 'win32') {
      execSync(`npx yarn electron-builder --win nsis --ia32 --x64 ${filteredArgs}`, { stdio: 'inherit' });
    } else if (process.platform === 'darwin') {
      execSync(`electron-builder --mac --x64 ${filteredArgs}`, { stdio: 'inherit' });
    } else {
      execSync(`electron-builder --linux appimage snap deb rpm pacman ${filteredArgs}`, { stdio: 'inherit' });
    }
  }
  
  console.log('\x1b[32mBuild completed successfully!\x1b[0m');
} catch (error) {
  console.error('\x1b[31mBuild failed!\x1b[0m');
  process.exit(1);
}
