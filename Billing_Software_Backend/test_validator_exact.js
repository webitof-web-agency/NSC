require('module-alias/register');
require('dotenv').config();
const { validationResult } = require('express-validator');
const { createCreditNoteValidator } = require('./validators/Admin/Invoice/creditNoteValidator');

const req2 = {
  body: {
    creditNoteDate: "2023-10-10",
    billFrom: "650c82f0c78b8a5b23d9b4c0", 
    billTo: "", // empty string
    // items: [] is empty or missing because multer doesn't parse it?
    // Wait, if frontend sends no items, or they are filtered out, items is missing!
  }
};

const runValidation = async () => {
  for (const middleware of createCreditNoteValidator) {
    await middleware(req2, {}, () => {});
  }
  const errors = validationResult(req2).array();
  console.log(errors);
  console.log(`Total errors: ${errors.length}`);
};

runValidation();
