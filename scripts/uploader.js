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
const API_KEY = process.env.UPLOAD_API_KEY;
const UPLOAD_URL = process.env.UPLOAD_URL;

// Validate environment
if (!API_KEY) {
  console.error('❌ UPLOAD_API_KEY environment variable is required');
  process.exit(1);
}

if (!UPLOAD_URL) {
  console.error('❌ UPLOAD_URL environment variable is required');
  process.exit(1);
}

const UPLOAD_ENDPOINT = UPLOAD_URL + '/update/upload.php';

// Parse command line arguments
const uploadDir = process.argv.find(arg => arg.startsWith('--dir='))?.split('=')[1] || './dist';

console.log(`🚀 Starting chunked upload from directory: ${uploadDir}`);
console.log(`📡 Upload endpoint: ${UPLOAD_ENDPOINT}`);
console.log(`📦 Chunk size: ${(CHUNK_SIZE / 1024 / 1024).toFixed(1)}MB`);
console.log(`🔑 API Key: ${API_KEY.substring(0, 4)}...${API_KEY.substring(API_KEY.length - 4)}\n`);

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
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: options.headers || {}
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
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
 * Upload a single chunk using multipart/form-data with raw binary data
 */
async function uploadChunk(fileName, chunkIndex, chunkData, totalChunks, fileHash) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  
  // Build multipart form data
  const parts = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="api_key"`,
    '',
    API_KEY,
    `--${boundary}`,
    `Content-Disposition: form-data; name="file_name"`,
    '',
    fileName,
    `--${boundary}`,
    `Content-Disposition: form-data; name="chunk_index"`,
    '',
    chunkIndex.toString(),
    `--${boundary}`,
    `Content-Disposition: form-data; name="total_chunks"`,
    '',
    totalChunks.toString(),
    `--${boundary}`,
    `Content-Disposition: form-data; name="file_hash"`,
    '',
    fileHash,
    `--${boundary}`,
    `Content-Disposition: form-data; name="chunk_data"; filename="chunk_${chunkIndex}"`,
    `Content-Type: application/octet-stream`,
    ''
  ];
  
  const header = Buffer.from(parts.join('\r\n') + '\r\n');
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const formData = Buffer.concat([header, chunkData, footer]);
  
  const response = await makeRequest(UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': formData.length
    }
  }, formData);
  
  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }
  
  if (!response.data.success) {
    throw new Error(`Server error: ${response.data.message}`);
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
  
  console.log(`📄 Uploading: ${fileName}`);
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
    const chunkSize = (chunk.length / 1024 / 1024).toFixed(2);
    
    console.log(`⬆️  Uploading chunk ${chunkIndex + 1}/${totalChunks} (${progress}%) - ${chunkSize}MB`);
    
    await uploadChunk(fileName, chunkIndex, chunk, totalChunks, fileHash);
    chunkIndex++;
  }
  
  console.log(`✅ Successfully uploaded: ${fileName}\n`);
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
      // Windows installer files
      if (item.name.endsWith('.exe') && item.name.includes('Setup')) {
        files.push({ path: fullPath, type: 'windows-installer' });
      }
      // Windows portable files
      else if (item.name.endsWith('.zip') && item.name.includes('Portable')) {
        files.push({ path: fullPath, type: 'windows-portable' });
      }
      // macOS zip file
      else if (item.name === 'Sploder-macOS.zip') {
        files.push({ path: fullPath, type: 'macos-app' });
      }
    }
    // Note: Directory handling removed to avoid duplicates
    // The build script should create Sploder-macOS.zip directly
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
    
    console.log(`📋 Found ${files.length} files to upload:`);
    files.forEach(file => {
      console.log(`  • ${path.basename(file.path)} (${file.type})`);
    });
    console.log('');
    
    // Upload each file
    for (const file of files) {
      try {
        await uploadFile(file.path);
      } catch (error) {
        console.error(`❌ Failed to upload ${file.path}: ${error.message}`);
        process.exit(1);
      }
    }
    
    console.log('🎉 All files uploaded successfully!');
    
  } catch (error) {
    console.error(`❌ Upload process failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the uploader
main();
