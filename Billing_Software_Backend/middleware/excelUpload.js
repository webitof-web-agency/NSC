const multer = require('multer');
const path = require('path');


const storage = multer.diskStorage({
  destination: 'uploads/excel',
  filename: (req, file, cb) => {
    cb(null, `excel-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls, .csv
    'text/csv', // .csv
    'text/plain' // .csv sometimes
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel (.xlsx) and CSV files are allowed'), false);
  }
};

module.exports = multer({ storage, fileFilter });
