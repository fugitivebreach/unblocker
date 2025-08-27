const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Add MIME type for Unity WebAssembly files
express.static.mime.define({
  'application/wasm': ['wasm'],
  'application/octet-stream': ['unityweb']
});

// Serve static files with proper MIME types
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.unityweb')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    } else if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

app.listen(PORT, () => {
  console.log(`3kh0-lite is running on port ${PORT}`);
});
