
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
