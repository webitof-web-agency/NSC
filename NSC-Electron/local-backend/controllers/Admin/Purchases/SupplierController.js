const mongoose = require('mongoose');
const User = require('@models/User');
const Supplier = require('@models/Supplier');
const Purchase = require('@models/Purchase');
const SupplierPayment = require('@models/SupplierPayment');
const DebitNote = require('@models/DebitNote');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const isPlaceholderSupplierEmail = (email = "") =>
  /^supplier_.+@placeholder\.local$/i.test(String(email || ""));

const displaySupplierEmail = (email) =>
  isPlaceholderSupplierEmail(email) ? "" : (email || "");

const createSupplier = async (req, res) => {
  try {
    const {
      // Company Details
      company_name,
      email,
      phone_number,

      // Address
      company_address,
      country,
      city,
      state,
      pin_code,

      // Tax Details
      pan_no,
      gst_no,

      // Account Details (Array)
      account_details = [],

      // User Related (Optional)
      firstName,
      lastName,
      password,
      gender,
      dateOfBirth,
      address,
      supplierCountry,
      postalCode,
    } = req.body;

    const profileImage = req.file ? req.file.path : undefined;

    // Fallback names for User
    const defaultFirstName = firstName || company_name;
    const defaultLastName = lastName || "";

    const normalizedSupplierEmail = email && email.trim() !== '' ? email.trim() : undefined;

    let userEmail = normalizedSupplierEmail;
    if (!normalizedSupplierEmail) {
      const uniqueId = `${phone_number || "no_phone"}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      userEmail = `supplier_${uniqueId}@placeholder.local`;
    }

    const user = await User.create({
      firstName: defaultFirstName,
      lastName: defaultLastName,
      email: userEmail, // Use generated email if original was empty
      phone: phone_number,
      password: password || "defaultPassword123",
      user_type: 2, // Supplier
      gender,
      dateOfBirth,
      // address,
      // country,
      // state,
      // city,
      // postalCode,
      profileImage,
    });

    let parsedAccountDetails = [];

    if (req.body.account_details) {
      if (typeof req.body.account_details === "string") {
        try {
          parsedAccountDetails = JSON.parse(req.body.account_details);
        } catch (err) {
          return res.status(422).json({
            success: false,
            message: "Invalid account details format",
          });
        }
      } else if (Array.isArray(req.body.account_details)) {
        parsedAccountDetails = req.body.account_details;
      }
    }

    const supplier = await Supplier.create({
      user_id: user._id,

      company_name,
      email: normalizedSupplierEmail || userEmail,
      phone_number,

      company_address,
      country: country || null,
      city,
      state,
      pin_code,

      pan_no,
      gst_no,

      account_details: parsedAccountDetails,
    });

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: {
        ...supplier.toObject(),
        email: displaySupplierEmail(supplier.email),
      },
    });
  } catch (err) {
    // Cleanup uploaded image if error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error("Image cleanup error:", cleanupErr);
      }
    }

    console.error("Supplier creation error:", err);
    res.status(500).json({
      success: false,
      message: "Error creating supplier",
      error: err.message,
    });
  }
};


const listSuppliers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const skip = (page - 1) * limit;

    // -----------------------------
    // Build search query (Supplier)
    // -----------------------------
    const supplierQuery = {
      isDeleted: false,
      // user_type: 2, // Only suppliers
      $or: [
        { company_name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone_number: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { state: { $regex: search, $options: "i" } },
        { gst_no: { $regex: search, $options: "i" } },
      ],
    };

    // -----------------------------
    // Total count
    // -----------------------------
    const total = await Supplier.countDocuments(supplierQuery);

    // -----------------------------
    // Fetch suppliers
    // -----------------------------
    const suppliers = await Supplier.find(supplierQuery)
      .populate({
        path: "user_id",
        select: "profileImage",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // -----------------------------
    // Response transform
    // -----------------------------
    const formattedSuppliers = suppliers.map((supplier) => ({
      id: supplier._id,
      userId: supplier.user_id?._id,

      company_name: supplier.company_name,
      email: displaySupplierEmail(supplier.email),
      phone_number: supplier.phone_number,

      profileImage: supplier.user_id?.profileImage
        ? `${req.protocol}://${req.get("host")}/${supplier.user_id.profileImage}`
        : `${req.protocol}://${req.get("host")}/uploads/default-profile.jpg`,

      createdAt: supplier.createdAt,
    }));

    res.status(200).json({
      message: "Suppliers fetched successfully",
      data: {
        suppliers: formattedSuppliers,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error("Error fetching suppliers:", err);
    res.status(500).json({
      message: "Error fetching suppliers",
      error: err.message,
    });
  }
};


const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params; // supplier ID

    // ----------------------------------
    // Find supplier
    // ----------------------------------
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    // ----------------------------------
    // Find linked user
    // ----------------------------------
    const user = await User.findById(supplier.user_id);
    if (!user) {
      return res.status(404).json({ message: "Linked user not found" });
    }

    // ----------------------------------
    // Parse account_details safely
    // ----------------------------------
    let parsedAccountDetails = supplier.account_details;

    if (req.body.account_details) {
      if (typeof req.body.account_details === "string") {
        try {
          parsedAccountDetails = JSON.parse(req.body.account_details);
        } catch (err) {
          return res.status(422).json({
            message: "Invalid account details format",
          });
        }
      } else if (Array.isArray(req.body.account_details)) {
        parsedAccountDetails = req.body.account_details;
      }
    }

    // ----------------------------------
    // Handle profile image removal
    // ----------------------------------
    if (req.body.profile_image_removed === "true") {
      if (user.profileImage) {
        const fullPath = path.join(process.cwd(), user.profileImage);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
      user.profileImage = null;
    }

    // ----------------------------------
    // Handle profile image upload
    // ----------------------------------
    if (req.file) {
      if (user.profileImage) {
        const oldPath = path.join(process.cwd(), user.profileImage);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      user.profileImage = req.file.path;
    }

    const hasEmailField = Object.prototype.hasOwnProperty.call(req.body, "email");
    const nextSupplierEmail = hasEmailField
      ? (String(req.body.email || "").trim() || undefined)
      : supplier.email;
    const nextUserEmail = nextSupplierEmail || `supplier_${supplier._id}_${Date.now()}@placeholder.local`;

    // ----------------------------------
    // Email uniqueness check
    // ----------------------------------
    if (nextSupplierEmail && nextSupplierEmail !== user.email) {
      const emailExists = await User.findOne({
        email: nextSupplierEmail,
        _id: { $ne: user._id },
      });

      if (emailExists) {
        return res.status(422).json({
          message: "Email already exists",
        });
      }
    }

    // ----------------------------------
    // Update USER (shared fields only)
    // ----------------------------------
    user.email = hasEmailField ? nextUserEmail : user.email;
    user.phone = req.body.phone_number ?? user.phone;
    user.firstName = req.body.company_name ?? user.firstName;
    user.lastName = "Supplier";

    await user.save();

    // ----------------------------------
    // Update SUPPLIER
    // ----------------------------------
    supplier.company_name = req.body.company_name ?? supplier.company_name;
    supplier.email = hasEmailField ? (nextSupplierEmail || nextUserEmail) : supplier.email;
    supplier.phone_number = req.body.phone_number ?? supplier.phone_number;

    supplier.company_address = req.body.company_address ?? supplier.company_address;
    supplier.country = req.body.country ?? supplier.country;
    supplier.city = req.body.city ?? supplier.city;
    supplier.state = req.body.state ?? supplier.state;
    supplier.pin_code = req.body.pin_code ?? supplier.pin_code;

    supplier.pan_no = req.body.pan_no ?? supplier.pan_no;
    supplier.gst_no = req.body.gst_no ?? supplier.gst_no;

    supplier.account_details = parsedAccountDetails;

    await supplier.save();

    // ----------------------------------
    // Response (for form population)
    // ----------------------------------
    res.status(200).json({
      message: "Supplier updated successfully",
      data: {
        id: supplier._id,
        company_name: supplier.company_name,
        email: displaySupplierEmail(supplier.email),
        phone_number: supplier.phone_number,

        company_address: supplier.company_address,
        country: supplier.country,
        city: supplier.city,
        state: supplier.state,
        pin_code: supplier.pin_code,

        pan_no: supplier.pan_no,
        gst_no: supplier.gst_no,

        account_details: supplier.account_details,

        profileImage: user.profileImage
          ? `${req.protocol}://${req.get("host")}/${user.profileImage.replace(/\\/g, "/")}`
          : null,
      },
    });

  } catch (err) {
    // Cleanup uploaded file if error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error("File cleanup error:", cleanupErr);
      }
    }

    console.error("Supplier update error:", err);
    res.status(500).json({
      message: "Error updating supplier",
      error: err.message,
    });
  }
};


const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    // Accept both supplier id or linked user id
    let supplier = await Supplier.findById(id);
    if (!supplier) {
      supplier = await Supplier.findOne({ user_id: id });
    }

    if (!supplier) {
      return res.status(404).json({
        message: "Supplier not found"
      });
    }

    const userId = supplier.user_id;

    // Remove supplier first
    await Supplier.findByIdAndDelete(supplier._id);

    // Remove linked user (permanent delete)
    const deletedUser = await User.findByIdAndDelete(userId).select('-password -__v');

    // TODO: Add any additional cleanup (e.g., delete profile image file)

    res.status(200).json({
      message: 'Supplier deleted successfully',
      data: deletedUser
    });
  } catch (err) {
    res.status(500).json({
      message: 'Error deleting supplier',
      error: err.message
    });
  }
}

const deleteSupplierById = async (id) => {
  let supplier = await Supplier.findById(id);
  if (!supplier) {
    supplier = await Supplier.findOne({ user_id: id });
  }

  if (!supplier) {
    return false;
  }

  const userId = supplier.user_id;
  await Supplier.findByIdAndDelete(supplier._id);
  await User.findByIdAndDelete(userId).select('-password -__v');
  return true;
};

const bulkDeleteSuppliers = async (req, res) => {
  const { ids, all } = req.body;
  try {
    let targetIds = ids;
    if (all) {
      const suppliers = await Supplier.find({}).select('_id');
      targetIds = suppliers.map(s => s._id);
    }
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ message: 'Please provide supplier ids.' });
    }
    const failed = [];
    for (const id of targetIds) {
      try {
        const ok = await deleteSupplierById(id);
        if (!ok) failed.push(id);
      } catch {
        failed.push(id);
      }
    }
    return res.status(200).json({
      message: 'Suppliers deleted',
      deletedCount: targetIds.length - failed.length,
      failedIds: failed
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Error deleting suppliers',
      error: err.message
    });
  }
};

const getSupplierById = async (req, res) => {
  try {
    let supplier = await Supplier.findById(req.params.id)
      .populate("user_id", "profileImage")
      .lean();

    if (!supplier) {
      supplier = await Supplier.findOne({ user_id: req.params.id })
        .populate("user_id", "profileImage")
        .lean();
    }

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.status(200).json({
      data: {
        id: supplier._id,
        userId: supplier.user_id?._id,
        company_name: supplier.company_name,
        email: displaySupplierEmail(supplier.email),
        phone_number: supplier.phone_number,

        company_address: supplier.company_address,
        country: supplier.country,
        city: supplier.city,
        state: supplier.state,
        pin_code: supplier.pin_code,

        pan_no: supplier.pan_no,
        gst_no: supplier.gst_no,

        account_details: supplier.account_details,

        profileImage: supplier.user_id?.profileImage
          ? `${req.protocol}://${req.get("host")}/${supplier.user_id.profileImage}`
          : null,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// Download Supplier Excel Template
const downloadSupplierExcelTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Suppliers Template');

    // Define columns
    worksheet.columns = [
      { header: 'Company Name', key: 'company_name', width: 30 },
      { header: 'Phone Number', key: 'phone_number', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Country', key: 'country', width: 20 },
      { header: 'Address', key: 'company_address', width: 30 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'State', key: 'state', width: 15 },
      { header: 'Pin Code', key: 'pin_code', width: 10 },
      { header: 'PAN', key: 'pan_no', width: 15 },
      { header: 'GST', key: 'gst_no', width: 20 },
      // Bank Details (Optional)
      { header: 'Bank Name', key: 'bank_name', width: 20 },
      { header: 'Account Number', key: 'account_number', width: 20 },
      { header: 'IFSC', key: 'ifsc_code', width: 15 },
      { header: 'Account Holder', key: 'account_holder_name', width: 20 },
      { header: 'Account Type', key: 'account_type', width: 15 }
    ];

    // Style headers (yellow background + bold)
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' }
      };
    });

    // Add sample row
    worksheet.addRow({
      company_name: 'ABC Supplies',
      phone_number: '9876543210',
      email: 'abc@example.com',
      country: 'India',
      company_address: '123 Market St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pin_code: '400001',
      pan_no: 'ABCDE1234F',
      gst_no: '27ABCDE1234F1Z5',
      bank_name: 'HDFC Bank',
      account_number: '1234567890',
      ifsc_code: 'HDFC0001234',
      account_holder_name: 'ABC Supplies',
      account_type: 'current'
    });

    // Add note for optional bank details
    worksheet.addRow(['* Bank details are optional. Leave blank if not available.']);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Supplier_Import_Template.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating template',
      error: error.message
    });
  }
};

// Export Suppliers (All Details) with search filter
const exportSuppliers = async (req, res) => {
  try {
    const { search = "" } = req.query;

    const supplierQuery = {
      isDeleted: false,
      $or: [
        { company_name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone_number: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { state: { $regex: search, $options: "i" } },
        { gst_no: { $regex: search, $options: "i" } },
      ],
    };

    const suppliers = await Supplier.find(supplierQuery)
      .sort({ company_name: 1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Suppliers');

    worksheet.columns = [
      { header: 'Company Name', key: 'company_name', width: 30 },
      { header: 'Phone Number', key: 'phone_number', width: 18 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Country', key: 'country', width: 20 },
      { header: 'Address', key: 'company_address', width: 30 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'State', key: 'state', width: 15 },
      { header: 'Pin Code', key: 'pin_code', width: 10 },
      { header: 'PAN', key: 'pan_no', width: 15 },
      { header: 'GST', key: 'gst_no', width: 20 },
      { header: 'Bank Name', key: 'bank_name', width: 20 },
      { header: 'Account Number', key: 'account_number', width: 20 },
      { header: 'IFSC', key: 'ifsc_code', width: 15 },
      { header: 'Account Holder', key: 'account_holder_name', width: 20 },
      { header: 'Account Type', key: 'account_type', width: 15 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' }
      };
    });

    suppliers.forEach((supplier) => {
      const account = Array.isArray(supplier.account_details) && supplier.account_details.length > 0
        ? supplier.account_details[0]
        : null;
      worksheet.addRow({
        company_name: supplier.company_name || '',
        phone_number: supplier.phone_number || '',
        email: displaySupplierEmail(supplier.email),
        country: supplier.country || '',
        company_address: supplier.company_address || '',
        city: supplier.city || '',
        state: supplier.state || '',
        pin_code: supplier.pin_code || '',
        pan_no: supplier.pan_no || '',
        gst_no: supplier.gst_no || '',
        bank_name: account?.bankName || '',
        account_number: account?.accountNumber || '',
        ifsc_code: account?.ifscCode || '',
        account_holder_name: account?.accountHolderName || '',
        account_type: account?.accountType || ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Suppliers_Export.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Supplier export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export suppliers',
      error: error.message
    });
  }
};


// Upload Suppliers from Excel
const uploadSuppliersFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Excel file is required' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Excel sheet not found' });
    }

    const rows = [];
    let headers = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        headers = row.values;
        if (Array.isArray(headers) && headers.length > 0 && headers[0] === undefined) {
          headers = headers.slice(1);
        }
      } else {
        const rowData = {};
        headers.forEach((header, index) => {
          if (header) {
            let cellValue = row.getCell(index + 1).value;
            if (typeof cellValue === 'object' && cellValue !== null) {
              if (cellValue.text) cellValue = cellValue.text;
              else if (cellValue.result) cellValue = cellValue.result;
            }
            rowData[header] = cellValue;
          }
        });
        if (Object.keys(rowData).length > 0) rows.push({ rowData, rowNumber });
      }
    });

    const results = {
      totalRows: rows.length,
      suppliersCreated: 0,
      errors: []
    };

    for (const { rowData, rowNumber } of rows) {
      try {
        // Helper to get value case-insensitive
        const getVal = (keys) => {
          for (const key of keys) {
            const foundKey = Object.keys(rowData).find(k => k.toLowerCase() === key.toLowerCase());
            if (foundKey) return rowData[foundKey];
          }
          return null;
        };

        const companyName = getVal(['Company Name', 'Supplier Name', 'Name']);
        const phoneNumber = getVal(['Phone Number', 'Phone', 'Mobile']);

        // Validation
        if (!companyName) throw new Error('Company Name is required');
        if (!phoneNumber) throw new Error('Phone Number is required');

        const email = getVal(['Email', 'Email Address']);

        // Email Logic
        let userEmail = email;
        if (!userEmail || userEmail.toString().trim() === '') {
          // Check if unique placeholder needed? Or just use null?
          // Schema says email is unique if provided.
          // CreateSupplier logic generates placeholder.
          const uniqueId = phoneNumber || Date.now() + Math.floor(Math.random() * 1000);
          userEmail = `supplier_${uniqueId}@placeholder.local`;
        }

        // Check duplicate email if it's a real email
        if (email && email.toString().trim() !== '') {
          const existingUser = await User.findOne({ email: email, user_type: 2 });
          if (existingUser) throw new Error(`Email ${email} already exists`);
        }

        const country = getVal(['Country']) || '';

        // Bank Details Logic (OPTIONAL)
        const bankName = getVal(['Bank Name', 'Bank']);
        const accountNumber = getVal(['Account Number', 'Account No']);
        const ifscCode = getVal(['IFSC', 'IFSC Code']);
        const accountHolder = getVal(['Account Holder', 'Account Holder Name', 'Namne']);
        const accountType = getVal(['Account Type']) || 'savings';

        let accountDetails = [];
        if (bankName && accountNumber && ifscCode) {
          accountDetails.push({
            bankName: bankName.toString(),
            accountNumber: accountNumber.toString(),
            ifscCode: ifscCode.toString(),
            accountHolderName: accountHolder ? accountHolder.toString() : companyName.toString(),
            accountType: ['savings', 'current'].includes(accountType.toString().toLowerCase()) ? accountType.toString().toLowerCase() : 'savings'
          });
        }

        // Create User
        const newUser = await User.create({
          firstName: companyName.toString(),
          lastName: 'Supplier',
          email: userEmail.toString(),
          phone: phoneNumber.toString(),
          password: 'defaultPassword123',
          user_type: 2 // Supplier
        });

        // Create Supplier
        await Supplier.create({
          user_id: newUser._id,
          company_name: companyName.toString(),
          email: email ? email.toString() : userEmail.toString(),
          phone_number: phoneNumber.toString(),
          country: country ? country.toString() : null,
          company_address: (getVal(['Address', 'Company Address']) || '').toString(),
          city: (getVal(['City']) || '').toString(),
          state: (getVal(['State']) || '').toString(),
          pin_code: (getVal(['Pin Code', 'Pincode']) || '').toString(),
          pan_no: (getVal(['PAN', 'Pan No']) || '').toString(),
          gst_no: (getVal(['GST', 'GST No']) || '').toString(),
          account_details: accountDetails
        });

        results.suppliersCreated++;

      } catch (error) {
        results.errors.push({
          row: rowNumber,
          reason: error.message,
          data: rowData
        });
      }
    }

    fs.unlinkSync(req.file.path);
    res.status(200).json({
      success: true,
      message: 'Import processed',
      results
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Supplier Import Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing file',
      error: error.message
    });
  }
};

const formatLedgerDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-IN', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const sanitizeSheetName = (name = '') =>
  String(name || '')
    .replace(/[\\/*?:[\]]/g, ' ')
    .trim();

const styleLedgerWorkbook = (workbook) => {
  workbook.creator = 'NSC Billing Software';
  workbook.company = 'NSC';
  workbook.created = new Date();
  workbook.modified = new Date();
};

const applyTitleBlock = (sheet, title, subtitle, totalColumns) => {
  sheet.mergeCells(1, 1, 1, totalColumns);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF111827' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 22;

  sheet.mergeCells(2, 1, 2, totalColumns);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { size: 10, color: { argb: 'FF4B5563' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(2).height = 18;
};

const applyTableHeaderStyle = (row) => {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF111827' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
};

const applyDataRowStyle = (row, index) => {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    if (index % 2 === 0) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFCFCFD' },
      };
    }
  });
};

const applyTotalsRowStyle = (row) => {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF111827' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9FAFB' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF9CA3AF' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });
};

const setCurrencyFormat = (sheet, columns = []) => {
  columns.forEach((columnNumber) => {
    sheet.getColumn(columnNumber).numFmt = '"₹"#,##0.00';
  });
};

const setColumnWidths = (sheet, widths = []) => {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
};

const addSummaryMetricCards = (sheet, metrics = []) => {
  let rowPointer = 4;
  metrics.forEach((metric, index) => {
    const startColumn = index % 2 === 0 ? 1 : 5;
    if (index > 0 && index % 2 === 0) rowPointer += 1;
    const labelCell = sheet.getCell(rowPointer, startColumn);
    const valueCell = sheet.getCell(rowPointer, startColumn + 1);
    labelCell.value = metric.label;
    valueCell.value = metric.value;

    labelCell.font = { bold: true, color: { argb: 'FF374151' } };
    valueCell.font = { bold: true, size: 11, color: { argb: 'FF111827' } };
    [labelCell, valueCell].forEach((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
    if (metric.isCurrency) {
      valueCell.numFmt = '"₹"#,##0.00';
    }
  });
  return rowPointer + 3;
};

const downloadSupplierLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, format } = req.query;

    const supplier = await Supplier.findOne({ _id: id, isDeleted: false }).lean();
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    const supplierUserId = supplier.user_id;
    const dateFilter = {};
    if (startDate || endDate) {
      if (startDate) {
        const parsedStartDate = new Date(startDate);
        if (!Number.isNaN(parsedStartDate.getTime())) {
          dateFilter.$gte = parsedStartDate;
        }
      }
      if (endDate) {
        const parsedEndDate = new Date(endDate);
        if (!Number.isNaN(parsedEndDate.getTime())) {
          dateFilter.$lte = parsedEndDate;
        }
      }
    }

    const purchaseQuery = { vendorId: supplierUserId, isDeleted: false };
    const supplierPaymentQuery = { supplierId: supplierUserId, isDeleted: false };
    const debitNoteQuery = { vendorId: supplierUserId, isDeleted: false };

    if (Object.keys(dateFilter).length > 0) {
      purchaseQuery.purchaseDate = dateFilter;
      supplierPaymentQuery.paymentDate = dateFilter;
      debitNoteQuery.debitNoteDate = dateFilter;
    }

    const [purchases, supplierPayments, debitNotes] = await Promise.all([
      Purchase.find(purchaseQuery)
        .populate('paymentMode', 'name slug')
        .sort({ purchaseDate: -1 })
        .lean(),
      SupplierPayment.find(supplierPaymentQuery)
        .populate('purchaseId', 'purchaseId supplier_bill_number totalAmount purchaseDate dueDate')
        .populate('paymentMode', 'name slug')
        .populate('bankId', 'bankName')
        .sort({ paymentDate: -1 })
        .lean(),
      DebitNote.find(debitNoteQuery)
        .populate('purchaseId', 'purchaseId supplier_bill_number')
        .populate('paymentMode', 'name slug')
        .sort({ debitNoteDate: -1 })
        .lean(),
    ]);

    const workbook = new ExcelJS.Workbook();
    styleLedgerWorkbook(workbook);

    const totalPurchaseAmount = purchases.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const totalPurchasePaid = purchases.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
    const totalPurchaseBalance = purchases.reduce((sum, item) => sum + Number(item.balanceAmount || 0), 0);
    const totalDebitReturn = debitNotes.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const totalDebitReplacement = debitNotes.reduce((sum, item) => sum + Number(item.replacementAmount || 0), 0);
    const totalDebitNetAdjustment = debitNotes.reduce((sum, item) => sum + Number(item.netAdjustment || 0), 0);
    const totalSupplierPayments = supplierPayments.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
    const netPayable = Number((totalPurchaseBalance - totalDebitNetAdjustment).toFixed(2));

    const safeSupplierName = sanitizeSheetName(supplier.company_name || 'Supplier');
    const periodLabel =
      startDate || endDate
        ? `Period: ${formatLedgerDate(startDate)} - ${formatLedgerDate(endDate)}`
        : 'Period: All Time';
    const generatedLabel = `Supplier: ${supplier.company_name || '-'}   |   ${periodLabel}   |   Generated: ${formatLedgerDate(new Date())}`;

    const purchaseRows = purchases.map((purchase) => ({
      purchaseId: purchase.purchaseId || '-',
      supplierBillNumber: purchase.supplier_bill_number || 'No Bill No',
      purchaseDate: formatLedgerDate(purchase.purchaseDate),
      purchaseBillDate: formatLedgerDate(purchase.purchaseBillDate),
      dueDate: formatLedgerDate(purchase.dueDate),
      status: String(purchase.status || '').replace(/_/g, ' ').toUpperCase(),
      itemsCount: Array.isArray(purchase.items) ? purchase.items.length : 0,
      taxType: purchase.taxType || 'N/A',
      gstType: purchase.gstType || 'N/A',
      totalDiscount: Number(purchase.totalDiscount || 0),
      totalTax: Number(purchase.totalTax || 0),
      totalAmount: Number(purchase.totalAmount || 0),
      paidAmount: Number(purchase.paidAmount || 0),
      balanceAmount: Number(purchase.balanceAmount || 0),
      paymentMode: purchase.paymentMode?.name || 'N/A',
      notes: purchase.notes || '',
    }));

    const paymentRows = supplierPayments.map((payment) => ({
      paymentId: payment.paymentId || '-',
      purchaseId: payment.purchaseId?.purchaseId || '-',
      supplierBillNumber: payment.purchaseId?.supplier_bill_number || 'No Bill No',
      paymentDate: formatLedgerDate(payment.paymentDate),
      paymentMode: payment.paymentMode?.name || payment.sourceType || 'N/A',
      sourceType: payment.sourceType || 'N/A',
      referenceNumber: payment.referenceNumber || 'N/A',
      chequeNumber: payment.chequeNumber || 'N/A',
      amount: Number(payment.amount || payment.purchaseId?.totalAmount || 0),
      paidAmount: Number(payment.paidAmount || 0),
      dueAmount: Number(payment.dueAmount || 0),
      bankName: payment.bankId?.bankName || 'N/A',
    }));

    const debitNoteRows = debitNotes.map((note) => ({
      debitNoteId: note.debitNoteId || '-',
      purchaseId: note.purchaseId?.purchaseId || '-',
      supplierBillNumber: note.purchaseId?.supplier_bill_number || 'No Bill No',
      debitNoteDate: formatLedgerDate(note.debitNoteDate),
      dueDate: formatLedgerDate(note.dueDate),
      status: String(note.status || '').replace(/_/g, ' ').toUpperCase(),
      adjustmentType: String(note.adjustmentType || '').replace(/_/g, ' ').toUpperCase(),
      returnedItemsCount: Array.isArray(note.items) ? note.items.length : 0,
      replacementItemsCount: Array.isArray(note.replacementItems) ? note.replacementItems.length : 0,
      totalAmount: Number(note.totalAmount || 0),
      replacementAmount: Number(note.replacementAmount || 0),
      netAdjustment: Number(note.netAdjustment || 0),
      paidAmount: Number(note.paidAmount || 0),
      balanceAmount: Number(note.balanceAmount || 0),
      paymentMode: note.paymentMode?.name || 'N/A',
      notes: note.notes || '',
    }));

    if (String(format || '').toLowerCase() === 'json') {
      return res.status(200).json({
        success: true,
        data: {
          supplier: {
            companyName: supplier.company_name || '-',
            phone: supplier.phone_number || '-',
            email: displaySupplierEmail(supplier.email) || 'N/A',
            gstNo: supplier.gst_no || 'N/A',
            address: supplier.company_address || 'N/A',
            panNo: supplier.pan_no || 'N/A',
            city: supplier.city || 'N/A',
            state: supplier.state || 'N/A',
            country: supplier.country || 'N/A',
            pinCode: supplier.pin_code || 'N/A',
            bankAccounts: Array.isArray(supplier.account_details) ? supplier.account_details : [],
          },
          meta: {
            periodLabel,
            generatedLabel,
            fileDate: new Date().toISOString().split('T')[0],
            safeSupplierName: safeSupplierName.replace(/\s+/g, '_'),
          },
          summary: {
            totalPurchases: purchases.length,
            totalPurchaseAmount,
            totalSupplierPayments,
            totalPurchaseBalance,
            totalDebitReturn,
            totalDebitReplacement,
            totalDebitNetAdjustment,
            netPayable,
          },
          purchases: purchaseRows,
          payments: paymentRows,
          debitNotes: debitNoteRows,
        },
      });
    }

    const summarySheet = workbook.addWorksheet('Supplier Summary', {
      views: [{ state: 'frozen', ySplit: 2 }],
    });
    setColumnWidths(summarySheet, [26, 34, 24, 22, 24, 34, 24, 22]);
    applyTitleBlock(summarySheet, 'Supplier Ledger Summary', generatedLabel, 8);

    const summaryStartRow = addSummaryMetricCards(summarySheet, [
      { label: 'Total Purchases', value: purchases.length, isCurrency: false },
      { label: 'Total Purchase Amount', value: totalPurchaseAmount, isCurrency: true },
      { label: 'Total Paid to Supplier', value: totalSupplierPayments, isCurrency: true },
      { label: 'Outstanding Purchase Balance', value: totalPurchaseBalance, isCurrency: true },
      { label: 'Total Debit Return', value: totalDebitReturn, isCurrency: true },
      { label: 'Total Debit Replacement', value: totalDebitReplacement, isCurrency: true },
      { label: 'Total Net Adjustment', value: totalDebitNetAdjustment, isCurrency: true },
      { label: 'Net Payable', value: netPayable, isCurrency: true },
    ]);

    const supplierProfileRows = [
      ['Company Name', supplier.company_name || '-', 'Phone', supplier.phone_number || '-'],
      ['Email', displaySupplierEmail(supplier.email) || 'N/A', 'GST No', supplier.gst_no || 'N/A'],
      ['Address', supplier.company_address || 'N/A', 'PAN No', supplier.pan_no || 'N/A'],
      ['City', supplier.city || 'N/A', 'State', supplier.state || 'N/A'],
      ['Country', supplier.country || 'N/A', 'Pin Code', supplier.pin_code || 'N/A'],
    ];

    let profileRow = summaryStartRow;
    supplierProfileRows.forEach((item) => {
      summarySheet.getCell(profileRow, 1).value = item[0];
      summarySheet.getCell(profileRow, 2).value = item[1];
      summarySheet.getCell(profileRow, 5).value = item[2];
      summarySheet.getCell(profileRow, 6).value = item[3];
      [1, 5].forEach((col) => {
        summarySheet.getCell(profileRow, col).font = { bold: true, color: { argb: 'FF374151' } };
        summarySheet.getCell(profileRow, col + 1).font = { color: { argb: 'FF111827' } };
      });
      profileRow += 1;
    });

    profileRow += 1;
    summarySheet.mergeCells(profileRow, 1, profileRow, 8);
    const bankHeader = summarySheet.getCell(profileRow, 1);
    bankHeader.value = 'Bank Account Details';
    bankHeader.font = { bold: true, color: { argb: 'FF111827' } };
    bankHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };

    const bankHeaderRow = profileRow + 1;
    const bankHeaders = ['Account Holder', 'Bank Name', 'Branch', 'Type', 'Account No', 'IFSC'];
    bankHeaders.forEach((header, idx) => {
      summarySheet.getCell(bankHeaderRow, idx + 1).value = header;
    });
    applyTableHeaderStyle(summarySheet.getRow(bankHeaderRow));

    const bankAccounts = Array.isArray(supplier.account_details) ? supplier.account_details : [];
    if (bankAccounts.length === 0) {
      const row = summarySheet.addRow(['No bank account details available']);
      summarySheet.mergeCells(row.number, 1, row.number, 6);
      row.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
    } else {
      bankAccounts.forEach((account, index) => {
        const row = summarySheet.addRow([
          account.accountHolderName || 'N/A',
          account.bankName || 'N/A',
          account.branchName || 'N/A',
          account.accountType || 'N/A',
          account.accountNumber || 'N/A',
          account.ifscCode || 'N/A',
        ]);
        applyDataRowStyle(row, index);
      });
    }

    const purchasesSheet = workbook.addWorksheet('Purchases', {
      views: [{ state: 'frozen', ySplit: 3 }],
    });
    setColumnWidths(purchasesSheet, [22, 24, 18, 18, 18, 20, 14, 14, 14, 18, 18, 20, 20, 20, 20, 34]);
    applyTitleBlock(purchasesSheet, 'Supplier Ledger - Purchases', generatedLabel, 16);
    purchasesSheet.columns = [
      { key: 'purchaseId' },
      { key: 'supplierBillNumber' },
      { key: 'purchaseDate' },
      { key: 'purchaseBillDate' },
      { key: 'dueDate' },
      { key: 'status' },
      { key: 'itemsCount' },
      { key: 'taxType' },
      { key: 'gstType' },
      { key: 'totalDiscount' },
      { key: 'totalTax' },
      { key: 'totalAmount' },
      { key: 'paidAmount' },
      { key: 'balanceAmount' },
      { key: 'paymentMode' },
      { key: 'notes' },
    ];
    purchasesSheet.getRow(3).values = [
      'Purchase ID',
      'Supplier Bill No',
      'Purchase Date',
      'Bill Date',
      'Due Date',
      'Status',
      'Items',
      'Tax Type',
      'GST Type',
      'Discount',
      'Tax',
      'Total Amount',
      'Paid Amount',
      'Balance Amount',
      'Payment Mode',
      'Notes',
    ];
    applyTableHeaderStyle(purchasesSheet.getRow(3));
    purchasesSheet.autoFilter = 'A3:P3';

    if (purchases.length === 0) {
      const row = purchasesSheet.addRow({ purchaseId: 'No purchases found for this supplier' });
      purchasesSheet.mergeCells(row.number, 1, row.number, 16);
      row.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
    } else {
      purchaseRows.forEach((purchase, index) => {
        const row = purchasesSheet.addRow(purchase);
        applyDataRowStyle(row, index);
      });
      const totalsRow = purchasesSheet.addRow({
        purchaseId: 'Totals',
        totalDiscount: totalPurchasePaid ? purchases.reduce((sum, item) => sum + Number(item.totalDiscount || 0), 0) : purchases.reduce((sum, item) => sum + Number(item.totalDiscount || 0), 0),
        totalTax: purchases.reduce((sum, item) => sum + Number(item.totalTax || 0), 0),
        totalAmount: totalPurchaseAmount,
        paidAmount: totalPurchasePaid,
        balanceAmount: totalPurchaseBalance,
      });
      applyTotalsRowStyle(totalsRow);
    }
    setCurrencyFormat(purchasesSheet, [10, 11, 12, 13, 14]);

    const paymentsSheet = workbook.addWorksheet('Supplier Payments', {
      views: [{ state: 'frozen', ySplit: 3 }],
    });
    setColumnWidths(paymentsSheet, [20, 22, 24, 18, 18, 18, 24, 22, 20, 20, 20, 24]);
    applyTitleBlock(paymentsSheet, 'Supplier Ledger - Supplier Payments', generatedLabel, 12);
    paymentsSheet.columns = [
      { key: 'paymentId' },
      { key: 'purchaseId' },
      { key: 'supplierBillNumber' },
      { key: 'paymentDate' },
      { key: 'paymentMode' },
      { key: 'sourceType' },
      { key: 'referenceNumber' },
      { key: 'chequeNumber' },
      { key: 'amount' },
      { key: 'paidAmount' },
      { key: 'dueAmount' },
      { key: 'bankName' },
    ];
    paymentsSheet.getRow(3).values = [
      'Payment ID',
      'Purchase ID',
      'Supplier Bill No',
      'Payment Date',
      'Payment Mode',
      'Source Type',
      'Reference No',
      'Cheque No',
      'Purchase Amount',
      'Paid Amount',
      'Due Amount',
      'Bank Name',
    ];
    applyTableHeaderStyle(paymentsSheet.getRow(3));
    paymentsSheet.autoFilter = 'A3:L3';

    if (supplierPayments.length === 0) {
      const row = paymentsSheet.addRow({ paymentId: 'No supplier payments found for this supplier' });
      paymentsSheet.mergeCells(row.number, 1, row.number, 12);
      row.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
    } else {
      paymentRows.forEach((payment, index) => {
        const row = paymentsSheet.addRow(payment);
        applyDataRowStyle(row, index);
      });
      const totalsRow = paymentsSheet.addRow({
        paymentId: 'Totals',
        amount: supplierPayments.reduce((sum, item) => sum + Number(item.amount || item.purchaseId?.totalAmount || 0), 0),
        paidAmount: totalSupplierPayments,
        dueAmount: supplierPayments.reduce((sum, item) => sum + Number(item.dueAmount || 0), 0),
      });
      applyTotalsRowStyle(totalsRow);
    }
    setCurrencyFormat(paymentsSheet, [9, 10, 11]);

    const debitNotesSheet = workbook.addWorksheet('Debit Notes', {
      views: [{ state: 'frozen', ySplit: 3 }],
    });
    setColumnWidths(debitNotesSheet, [22, 22, 24, 18, 18, 16, 24, 18, 18, 20, 20, 20, 20, 20, 20, 28]);
    applyTitleBlock(debitNotesSheet, 'Supplier Ledger - Debit Notes', generatedLabel, 16);
    debitNotesSheet.columns = [
      { key: 'debitNoteId' },
      { key: 'purchaseId' },
      { key: 'supplierBillNumber' },
      { key: 'debitNoteDate' },
      { key: 'dueDate' },
      { key: 'status' },
      { key: 'adjustmentType' },
      { key: 'returnedItemsCount' },
      { key: 'replacementItemsCount' },
      { key: 'totalAmount' },
      { key: 'replacementAmount' },
      { key: 'netAdjustment' },
      { key: 'paidAmount' },
      { key: 'balanceAmount' },
      { key: 'paymentMode' },
      { key: 'notes' },
    ];
    debitNotesSheet.getRow(3).values = [
      'Debit Note ID',
      'Purchase ID',
      'Supplier Bill No',
      'Debit Note Date',
      'Due Date',
      'Status',
      'Adjustment Type',
      'Returned Items',
      'Replacement Items',
      'Returned Amount',
      'Replacement Amount',
      'Net Adjustment',
      'Paid Amount',
      'Balance Amount',
      'Payment Mode',
      'Notes',
    ];
    applyTableHeaderStyle(debitNotesSheet.getRow(3));
    debitNotesSheet.autoFilter = 'A3:P3';

    if (debitNotes.length === 0) {
      const row = debitNotesSheet.addRow({ debitNoteId: 'No debit notes found for this supplier' });
      debitNotesSheet.mergeCells(row.number, 1, row.number, 16);
      row.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
    } else {
      debitNoteRows.forEach((note, index) => {
        const row = debitNotesSheet.addRow(note);
        applyDataRowStyle(row, index);
      });
      const totalsRow = debitNotesSheet.addRow({
        debitNoteId: 'Totals',
        totalAmount: totalDebitReturn,
        replacementAmount: totalDebitReplacement,
        netAdjustment: totalDebitNetAdjustment,
        paidAmount: debitNotes.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0),
        balanceAmount: debitNotes.reduce((sum, item) => sum + Number(item.balanceAmount || 0), 0),
      });
      applyTotalsRowStyle(totalsRow);
    }
    setCurrencyFormat(debitNotesSheet, [10, 11, 12, 13, 14]);

    const fileDate = new Date().toISOString().split('T')[0];
    const periodSuffix =
      startDate || endDate
        ? `${String(startDate || 'start').split('T')[0]}_to_${String(endDate || 'end').split('T')[0]}`
        : fileDate;
    const fileName = `Supplier_Ledger_${safeSupplierName.replace(/\s+/g, '_')}_${periodSuffix}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Supplier ledger export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download supplier ledger',
      error: error.message,
    });
  }
};


module.exports = {
  createSupplier,
  listSuppliers,
  updateSupplier,
  deleteSupplier,
  bulkDeleteSuppliers,
  getSupplierById,
  // getSupplierByUserId,
  downloadSupplierExcelTemplate,
  uploadSuppliersFromExcel,
  exportSuppliers,
  downloadSupplierLedger
};
