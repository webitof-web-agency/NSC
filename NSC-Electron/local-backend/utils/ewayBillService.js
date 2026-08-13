// ===================== SERVICE: services/ewaybill.mock.service.js =====================

/**
 * Mock E-Way Bill Service
 * Used ONLY for development & testing
 * Mimics Government / GSP response structure
 */

function generateMockEwbNumber() {
  // 12-digit number starting with 22 (looks realistic)
  return '22' + Math.floor(1000000000 + Math.random() * 9000000000);
}

function generateMockEWayBill(payload) {
  return {
    success: true,
    ewayBillNo: generateMockEwbNumber(),
    validUpto: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days validity
    alert: 'This is a MOCK E-Way Bill for testing only',
    payloadSnapshot: payload
  };
}

module.exports = {
  generateMockEWayBill
};


// ===================== SERVICE: services/ewaybill.prod.service.js =====================

/**
 * REAL E-Way Bill Service (PRODUCTION)
 * ----------------------------------
 * This service calls Government / GSP production APIs
 * ⚠️ DO NOT use without valid production credentials
 *
 * To activate:
 * 1. Get real credentials from GSP / NIC
 * 2. Set ENV variables
 * 3. Import this service instead of mock service
 */

// const axios = require('axios');

// // Choose base URL depending on provider (example)
// const BASE_URL = process.env.EWB_PROD_BASE_URL; // e.g. https://api.cleartax.in/ewaybill

// /**
//  * Build headers as per your GSP / NIC requirement
//  * (This example is generic – adjust for your provider)
//  */
// function buildAuthHeaders() {
//   return {
//     'Content-Type': 'application/json',
//     'X-API-KEY': process.env.EWB_PROD_API_KEY,
//     'X-API-SECRET': process.env.EWB_PROD_API_SECRET,
//     'GSTIN': process.env.EWB_PROD_GSTIN
//   };
// }

// /**
//  * Generate REAL E-Way Bill
//  * @param {Object} payload - Legal EWB payload
//  */
// async function generateRealEWayBill(payload) {
//   try {
//     const response = await axios.post(
//       `${BASE_URL}/generate`,
//       payload,
//       { headers: buildAuthHeaders() }
//     );

//     /**
//      * Typical SUCCESS response from GSP/NIC:
//      * {
//      *   success: true,
//      *   ewayBillNo: '831012345678',
//      *   validUpto: '2025-12-10 23:59:59',
//      *   alert: null
//      * }
//      */

//     return response.data;
//   } catch (error) {
//     // Normalize errors for controller
//     if (error.response) {
//       throw new Error(
//         error.response.data?.message ||
//         'E-Way Bill generation failed (Government API)'
//       );
//     }
//     throw new Error(error.message || 'E-Way Bill service error');
//   }
// }

// module.exports = {
//   generateRealEWayBill
// };