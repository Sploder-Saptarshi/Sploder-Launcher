/**
 * Chunked file uploader for Sploder-Launcher builds
 * Uploads build artifacts in 90MB chunks with API key authentication
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { createHash } = require('crypto');

// Configuration
const CHUNK_SIZE = 90 * 1024 * 1024; // 90MB chunks
const UPLOAD_ENDPOINT = process.env.UPLOAD_URL+"/update/upload.php";
const API_KEY = process.env.UPLOAD_API_KEY;

if (!API_KEY) {
  console.error('❌ UPLOAD_API_KEY environment variable is required');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const uploadDirArg = args.find(arg => arg.startsWith('--dir='));
const uploadDir = uploadDirArg ? uploadDirArg.split('=')[1] : './dist';

console.log(`🚀 Starting chunked upload from directory: ${uploadDir}`);
console.log(`📡 Upload endpoint: ${UPLOAD_ENDPOINT}`);
console.log(`📦 Chunk size: ${(CHUNK_SIZE / 1024 / 1024).toFixed(1)}MB`);

/**
 * Calculate MD5 hash of a file
 */
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('md5');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Make HTTP request
 */
function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const req = client.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: options.headers || {}
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (error) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

/**
 * Upload a single chunk
 */
async function uploadChunk(filePath, fileName, chunkIndex, chunkData, totalChunks, fileHash) {
  const formData = new URLSearchParams();
  formData.append('api_key', API_KEY);
  formData.append('file_name', fileName);
  formData.append('chunk_index', chunkIndex.toString());
  formData.append('total_chunks', totalChunks.toString());
  formData.append('file_hash', fileHash);
  formData.append('chunk_data', chunkData.toString('base64'));
  
  const response = await makeRequest(UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(formData.toString())
    }
  }, formData.toString());
  
  if (response.status !== 200 || !response.data.success) {
    throw new Error(`Upload failed for chunk ${chunkIndex}: ${JSON.stringify(response.data)}`);
  }
  
  return response.data;
}

/**
 * Upload a file in chunks
 */
async function uploadFile(filePath) {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  
  console.log(`\n📄 Uploading: ${fileName}`);
  console.log(`📊 Size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`🧩 Chunks: ${totalChunks}`);
  
  // Calculate file hash
  console.log('🔍 Calculating file hash...');
  const fileHash = await calculateFileHash(filePath);
  console.log(`✅ File hash: ${fileHash}`);
  
  // Upload chunks
  const fileStream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
  let chunkIndex = 0;
  
  for await (const chunk of fileStream) {
    const progress = ((chunkIndex + 1) / totalChunks * 100).toFixed(1);
    console.log(`⬆️  Uploading chunk ${chunkIndex + 1}/${totalChunks} (${progress}%)`);
    
    await uploadChunk(filePath, fileName, chunkIndex, chunk, totalChunks, fileHash);
    chunkIndex++;
  }
  
  console.log(`✅ Successfully uploaded: ${fileName}`);
}

/**
 * Find files to upload based on platform
 */
function findFilesToUpload(directory) {
  const files = [];
  
  if (!fs.existsSync(directory)) {
    console.error(`❌ Directory not found: ${directory}`);
    return files;
  }
  
  const items = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(directory, item.name);
    
    if (item.isFile()) {
      // Windows installer files (.exe)
      if (item.name.endsWith('.exe') && item.name.includes('Setup')) {
        files.push({ path: fullPath, type: 'windows-installer' });
      }
      // Windows portable files (.zip)
      else if (item.name.endsWith('.zip') && item.name.includes('Portable')) {
        files.push({ path: fullPath, type: 'windows-portable' });
      }
    } else if (item.isDirectory()) {
      // macOS app files (in mac/ directory)
      if (item.name === 'mac') {
        // Zip the entire mac directory for upload
        const macZipPath = path.join(directory, 'Sploder-macOS.zip');
        if (fs.existsSync(macZipPath)) {
          files.push({ path: macZipPath, type: 'macos-app' });
        } else {
          console.log(`📝 Note: macOS app directory found but no zip file. Consider creating ${macZipPath}`);
        }
      }
    }
  }
  
  return files;
}

/**
 * Main upload process
 */
async function main() {
  try {
    console.log('🔍 Scanning for files to upload...');
    const files = findFilesToUpload(uploadDir);
    
    if (files.length === 0) {
      console.log('📭 No files found to upload');
      return;
    }
    
    console.log(`\n📋 Found ${files.length} files to upload:`);
    files.forEach(file => {
      console.log(`  • ${path.basename(file.path)} (${file.type})`);
    });
    
    // Upload each file
    for (const file of files) {
      try {
        await uploadFile(file.path);
      } catch (error) {
        console.error(`❌ Failed to upload ${file.path}:`, error.message);
        process.exit(1);
      }
    }
    
    console.log('\n🎉 All files uploaded successfully!');
    
  } catch (error) {
    console.error('❌ Upload process failed:', error.message);
    process.exit(1);
  }
}

// Run the uploader
main();
