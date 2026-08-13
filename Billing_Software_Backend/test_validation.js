const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');

const app = express();
const upload = multer();

app.post('/test', upload.none(), [
  body('items').isArray(),
  body('items.*.name').notEmpty()
], (req, res) => {
  console.log('req.body:', req.body);
  const errors = validationResult(req);
  res.json({ errors: errors.array() });
});

const request = require('supertest');
request(app)
  .post('/test')
  .field('items[0][name]', 'Test Item')
  .field('items[0][qty]', '2')
  .end((err, res) => {
    console.log('Response:', res.body);
  });
