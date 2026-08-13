const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');

const app = express();
const upload = multer();

app.post('/test', upload.none(), [
  body('items').isArray(),
  body('items.*.name').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  res.json({ body: req.body, errors: errors.array() });
});

const server = app.listen(0, () => {
  const port = server.address().port;
  const http = require('http');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  
  const postData = 
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="items[0][name]"\r\n\r\n' +
    'Test Item\r\n' +
    '--' + boundary + '\r\n' +
    'Content-Disposition: form-data; name="items[0][qty]"\r\n\r\n' +
    '2\r\n' +
    '--' + boundary + '--\r\n';

  const req = http.request({
    hostname: 'localhost',
    port: port,
    path: '/test',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Response:', data);
      server.close();
    });
  });

  req.write(postData);
  req.end();
});
