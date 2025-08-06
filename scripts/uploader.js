const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { createHash } = require('crypto');

const CHUNK_SIZE = 90 * 1024 * 1024;
const API_KEY = process.env.UPLOAD_API_KEY;
const UPLOAD_URL = process.env.UPLOAD_URL;

if (!API_KEY || !UPLOAD_URL) {
  console.error('Missing required environment variables: UPLOAD_API_KEY, UPLOAD_URL');
  process.exit(1);
}

const UPLOAD_ENDPOINT = UPLOAD_URL + '/update/upload.php';
const uploadDir = process.argv.find(arg => arg.startsWith('--dir='))?.split('=')[1] || './dist';

function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

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
    if (data) req.write(data);
    req.end();
  });
}

async function uploadChunk(fileName, chunkIndex, chunkData, totalChunks, fileHash) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  
  const parts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="api_key"', '',
    API_KEY,
    `--${boundary}`,
    'Content-Disposition: form-data; name="file_name"', '',
    fileName,
    `--${boundary}`,
    'Content-Disposition: form-data; name="chunk_index"', '',
    chunkIndex.toString(),
    `--${boundary}`,
    'Content-Disposition: form-data; name="total_chunks"', '',
    totalChunks.toString(),
    `--${boundary}`,
    'Content-Disposition: form-data; name="file_hash"', '',
    fileHash,
    `--${boundary}`,
    `Content-Disposition: form-data; name="chunk_data"; filename="chunk_${chunkIndex}"`,
    'Content-Type: application/octet-stream', ''
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
  
  if (response.status !== 200 || !response.data.success) {
    throw new Error(response.data.message || `HTTP ${response.status}`);
  }
  
  return response.data;
}

async function uploadFile(filePath) {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  
  console.log(`Uploading: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB, ${totalChunks} chunks)`);
  
  const fileHash = await calculateFileHash(filePath);
  const fileStream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
  let chunkIndex = 0;
  
  for await (const chunk of fileStream) {
    const progress = ((chunkIndex + 1) / totalChunks * 100).toFixed(1);
    console.log(`Chunk ${chunkIndex + 1}/${totalChunks} (${progress}%)`);
    await uploadChunk(fileName, chunkIndex, chunk, totalChunks, fileHash);
    chunkIndex++;
  }
  
  console.log(`Completed: ${fileName}`);
}

function findFilesToUpload(directory) {
  const files = [];
  
  if (!fs.existsSync(directory)) {
    console.error(`Directory not found: ${directory}`);
    return files;
  }
  
  const items = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const item of items) {
    if (item.isFile()) {
      const fullPath = path.join(directory, item.name);
      
      if (item.name.endsWith('.exe') && item.name.includes('Setup')) {
        files.push({ path: fullPath, type: 'windows-installer' });
      } else if (item.name.endsWith('.zip') && item.name.includes('Portable')) {
        files.push({ path: fullPath, type: 'windows-portable' });
      } else if (item.name.startsWith('Sploder-macOS-') && item.name.endsWith('.zip')) {
        files.push({ path: fullPath, type: 'macos-app' });
      }
    }
  }
  
  return files;
}

async function main() {
  try {
    const files = findFilesToUpload(uploadDir);
    
    if (files.length === 0) {
      console.log('No files found to upload');
      return;
    }
    
    console.log(`Found ${files.length} files:`);
    files.forEach(file => console.log(`- ${path.basename(file.path)} (${file.type})`));
    
    for (const file of files) {
      await uploadFile(file.path);
    }
    
    console.log('All files uploaded successfully');
  } catch (error) {
    console.error(`Upload failed: ${error.message}`);
    process.exit(1);
  }
}

main();
