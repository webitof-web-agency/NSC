'use strict';

const http = require('http');
const https = require('https');
const mongoose = require('mongoose');
const LocalConfig = require('../models/LocalConfig');

async function getCloudToken() {
  const config = await LocalConfig.findOne({ key: 'syncToken' }).lean();
  return String(config?.value || '').trim();
}

async function translateDocumentId(body) {
  const documentId = String(body?.documentId || '').trim();
  if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) return body;

  const documentType = String(body.documentType || '').trim().toLowerCase();
  const DocumentModel = documentType === 'quotation'
    ? require('../models/Quotation')
    : require('../models/Invoice');
  const document = await DocumentModel.findById(documentId).select('syncId').lean();

  if (!document?.syncId) return body;
  return { ...body, documentId: document.syncId };
}

function copyResponseHeaders(remoteResponse, response) {
  for (const [name, value] of Object.entries(remoteResponse.headers)) {
    if (value !== undefined && name.toLowerCase() !== 'transfer-encoding') {
      response.setHeader(name, value);
    }
  }
}

function createCloudApiProxy({ remoteBackendUrl }) {
  const remoteOrigin = new URL(remoteBackendUrl);

  return async function cloudApiProxy(req, res) {
    try {
      const target = new URL(req.originalUrl, remoteOrigin);
      const cloudToken = await getCloudToken();
      if (!cloudToken) {
        return res.status(401).json({
          success: false,
          message: 'Online authorization is unavailable. Sign in while connected to the internet and try again.',
        });
      }
      const headers = { ...req.headers, host: target.host, connection: 'close' };
      headers.authorization = `Bearer ${cloudToken}`;

      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      const hasParsedBody = contentType.includes('application/json')
        || contentType.includes('application/x-www-form-urlencoded');
      let serializedBody = null;

      if (hasParsedBody) {
        let body = req.body || {};
        if (req.originalUrl.endsWith('/api/admin/whatsapp/send-manual')) {
          body = await translateDocumentId(body);
        }
        serializedBody = contentType.includes('application/json')
          ? Buffer.from(JSON.stringify(body))
          : Buffer.from(new URLSearchParams(body).toString());
        headers['content-length'] = String(serializedBody.length);
      } else {
        delete headers['content-length'];
      }

      const transport = target.protocol === 'https:' ? https : http;
      const remoteRequest = transport.request(target, {
        method: req.method,
        headers,
      }, (remoteResponse) => {
        res.status(remoteResponse.statusCode || 502);
        copyResponseHeaders(remoteResponse, res);
        remoteResponse.pipe(res);
      });

      remoteRequest.setTimeout(30000, () => {
        remoteRequest.destroy(new Error('Cloud request timed out'));
      });
      remoteRequest.on('error', (error) => {
        if (!res.headersSent) {
          res.status(503).json({
            success: false,
            message: 'This online service is unavailable. Check the internet connection and try again.',
            error: error.message,
          });
        } else {
          res.end();
        }
      });

      if (serializedBody) {
        remoteRequest.end(serializedBody);
      } else {
        req.pipe(remoteRequest);
      }
    } catch (error) {
      res.status(503).json({
        success: false,
        message: 'Unable to connect to the online service.',
        error: error.message,
      });
    }
  };
}

module.exports = {
  createCloudApiProxy,
  translateDocumentId,
};
