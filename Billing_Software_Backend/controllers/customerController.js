const Customer = require('@models/Customer');
const User = require('@models/User');
const Invoice = require('@models/Invoice');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { error } = require('console');
const { v4: uuidv4 } = require('uuid');
const SyncJournal = require('@models/SyncJournal');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// Create Customer
const createCustomer = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      website,
      notes,
      status,
      billingAddress,
      shippingAddress,
      bankDetails,
      // profile_image_removed
    } = req.body;

    const userId = req.user;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check for existing customer with same email
    const existingCustomer = await Customer.findOne({ phone, userId }); // email (prevoiusly email instead of phone)
    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: 'Customer with this phone number already exists'
      });
    }


    // Create new customer
    const customer = new Customer({
      // name,
      // email,
      name: name || '',
      email: email || '',
      // phone: phone || '',
      phone,
      website: website || '',
      notes: notes || '',
      // image: imagePath,
      status: status || 'Active',
      billingAddress: billingAddress || {},
      shippingAddress: shippingAddress || {},
      bankDetails: bankDetails || {},
      portalPassword: await bcrypt.hash(String(phone), 12),
      userId
    });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await customer.save({ session });

      const deviceId = req.headers['x-device-id'] || null;

      const journalEvent = new SyncJournal({
        cursor: new mongoose.Types.ObjectId().toString(),
        syncId: customer.syncId,
        operation: 'CREATE',
        collectionName: 'customers',
        payload: customer.toObject(),
        version: customer.version || 1,
        deviceId: deviceId
      });
      await journalEvent.save({ session });

      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: formatCustomerResponse(customer)
    });
  } catch (err) {

    console.error('Customer creation error:', err);
    res.status(500).json({
      success: false,
      message: 'Error creating customer',
      error: err.message
    });
  }
};

const createMinimalCustomer = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const userId = req.user; // assuming this is set by authentication middleware


    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check for duplicate email for this user
    const existingCustomer = await Customer.findOne({ phone, userId }); // email removed, findOne by phone
    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: 'Customer with this phone number already exists',
        errors: { phone: 'Customer with this phone number already exists' }
      });
    }

    const customer = new Customer({
      // name,
      // email,
      name: name || '',
      email: email || '',
      // phone: phone || '',
      phone,
      portalPassword: await bcrypt.hash(String(phone), 12),
      userId
    });

    await customer.save();

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone
      }
    });
  } catch (err) {
    console.error('Minimal Customer creation error:', err);
    res.status(500).json({
      success: false,
      message: 'Error creating customer',
      error: err.message
    });
  }
};

// Get All Customers with Pagination

const getCustomers = async (req, res) => {
  try {
    const userId = req.user;
    const {
      page = 1,
      limit = 10,
      search = "",
      status
    } = req.query;

    const query = { isDeleted: false };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { "billingAddress.city": { $regex: search, $options: "i" } },
        { "shippingAddress.city": { $regex: search, $options: "i" } }
      ];
    }

    const total = await Customer.countDocuments(query);

    const customers = await Customer.aggregate([
      { $match: query },
      {
        $addFields: {
          lowerName: { $toLower: "$name" }
        }
      },
      { $sort: { lowerName: 1 } },
      { $skip: (page - 1) * Number(limit) },
      { $limit: Number(limit) },

      // Lookup invoices
      {
        $lookup: {
          from: "invoices",
          localField: "_id",
          foreignField: "billTo",
          as: "invoices"
        }
      },

      // Lookup payments
      {
        $lookup: {
          from: "invoicepayments",
          let: { invoiceIds: "$invoices._id" },
          pipeline: [
            { $match: { $expr: { $in: ["$invoiceId", "$$invoiceIds"] } } }
          ],
          as: "payments"
        }
      },

      // Compute totals
      {
        $addFields: {
          totalInvoiceCount: {
            $size: {
              $filter: {
                input: "$invoices",
                as: "inv",
                cond: {
                  $and: [
                    { $eq: ["$$inv.isDeleted", false] },
                    { $ne: ["$$inv.status", "CANCELLED"] }
                  ]
                }
              }
            }
          },
          invoiceTotal: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$invoices",
                    as: "inv",
                    cond: {
                      $and: [
                        { $eq: ["$$inv.isDeleted", false] },
                        { $ne: ["$$inv.status", "CANCELLED"] }
                      ]
                    }
                  }
                },
                as: "inv",
                in: "$$inv.TotalAmount"
              }
            }
          },
          paymentTotal: { $sum: "$payments.amount" },
          balanceAmount: {
            $subtract: [
              {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: "$invoices",
                        as: "inv",
                        cond: {
                          $and: [
                            { $eq: ["$$inv.isDeleted", false] },
                            { $ne: ["$$inv.status", "CANCELLED"] }
                          ]
                        }
                      }
                    },
                    as: "inv",
                    in: "$$inv.TotalAmount"
                  }
                }
              },
              { $sum: "$payments.amount" }
            ]
          }
        }
      },

      // Clean response (remove raw invoices/payments)
      {
        $project: {
          invoices: 0,
          payments: 0
        }
      }
    ]);

    const formattedCustomers = customers.map(c => ({
      id: c._id,
      ...c,
      imageUrl: c.image
        ? `${process.env.BASE_URL}/${c.image.replace(/\\/g, "/")}`
        : null
    }));

    res.status(200).json({
      success: true,
      message: "Customers fetched successfully",
      data: {
        customers: formattedCustomers,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    console.error("Error fetching customers:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching customers",
      error: err.message
    });
  }
};


// Get Single Customer
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;

    const customer = await Customer.findOne({
      _id: id,
      userId,
      isDeleted: false
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Customer retrieved successfully',
      data: formatCustomerResponse(customer)
    });
  } catch (err) {
    console.error('Error fetching customer:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

// Update Customer
const updateCustomer = async (req, res) => {
  try {

    const { id } = req.params;
    const userId = req.user;
    const {
      name,
      email,
      phone,
      website,
      notes,
      status,
      billingAddress,
      shippingAddress,
      bankDetails,
      profile_image_removed
    } = req.body;

    // Find customer
    const customer = await Customer.findOne({
      _id: id,
      userId,
      isDeleted: false
    });

    if (!customer) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check for email conflict if email is being updated
    if (email && email !== customer.email) {
      const existingCustomer = await Customer.findOne({
        email: email,
        userId
      });
      if (existingCustomer) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        return res.status(409).json({
          success: false,
          message: 'Another customer with this email already exists'
        });
      }
    }

    // Handle image update/removal
    let oldImagePath = '';
    if (profile_image_removed === 'true') {
      oldImagePath = customer.image;
      customer.image = '';
    } else if (req.file) {
      oldImagePath = customer.image;
      customer.image = req.file.path;
    }

    // Update fields with proper validation
    const previousPhone = customer.phone;
    const nextPhone = phone !== undefined ? phone || '' : customer.phone;
    const updateFields = {
      name: name !== undefined ? name : customer.name,
      email: email !== undefined ? email : customer.email,
      phone: nextPhone,
      website: website !== undefined ? website || '' : customer.website,
      notes: notes !== undefined ? notes || '' : customer.notes,
      status: status !== undefined ? status || 'Active' : customer.status,
      billingAddress: billingAddress !== undefined ?
        (typeof billingAddress === 'string' ? JSON.parse(billingAddress) : billingAddress) || {}
        : customer.billingAddress,
      shippingAddress: shippingAddress !== undefined ?
        (typeof shippingAddress === 'string' ? JSON.parse(shippingAddress) : shippingAddress) || {}
        : customer.shippingAddress,
      bankDetails: bankDetails !== undefined ?
        (typeof bankDetails === 'string' ? JSON.parse(bankDetails) : bankDetails) || {}
        : customer.bankDetails
    };

    // Apply updates
    Object.assign(customer, updateFields);
    if (
      nextPhone &&
      nextPhone !== previousPhone &&
      !customer.portalPasswordChanged
    ) {
      customer.portalPassword = await bcrypt.hash(String(nextPhone), 12);
    }
    
    customer.version = (customer.version || 1) + 1;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await customer.save({ session });

      const deviceId = req.headers['x-device-id'] || null;

      const journalEvent = new SyncJournal({
        cursor: new mongoose.Types.ObjectId().toString(),
        syncId: customer.syncId,
        operation: 'UPDATE',
        collectionName: 'customers',
        payload: customer.toObject(),
        version: customer.version,
        deviceId: deviceId
      });
      await journalEvent.save({ session });

      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    // Delete old image if it was replaced or removed
    if ((req.file || profile_image_removed === 'true') && oldImagePath) {
      try {
        fs.unlinkSync(oldImagePath);
      } catch (err) {
        console.error('Error deleting old image:', err);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: formatCustomerResponse(customer)
    });
  } catch (err) {
    if (req.file?.path) fs.unlinkSync(req.file.path);
    console.error('Error updating customer:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating customer',
      error: err.message
    });
  }
};

// Delete Customer (Soft Delete)
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;

    const session = await mongoose.startSession();
    session.startTransaction();
    let customer;
    try {
      customer = await Customer.findOneAndUpdate(
        {
          _id: id,
          userId,
          isDeleted: false
        },
        {
          isDeleted: true,
          deletedAt: new Date(),
          $inc: { version: 1 }
        },
        { new: true, session }
      );

      if (customer) {
        const deviceId = req.headers['x-device-id'] || null;
        const journalEvent = new SyncJournal({
          cursor: new mongoose.Types.ObjectId().toString(),
          syncId: customer.syncId,
          operation: 'DELETE',
          collectionName: 'customers',
          payload: { syncId: customer.syncId, isDeleted: true, deletedAt: customer.deletedAt },
          version: customer.version,
          deviceId: deviceId
        });
        await journalEvent.save({ session });
      }

      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully',
      data: { id: customer._id }
    });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({
      success: false,
      message: 'Error deleting customer',
      error: err.message
    });
  }
};

// Helper function to format customer response
const formatCustomerResponse = (customer) => {
  return {
    id: customer._id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    website: customer.website,
    notes: customer.notes,
    status: customer.status,
    // imageUrl: customer.imageUrl,
    totalInvoiceCount: customer.totalInvoiceCount || 0,
    billingAddress: customer.billingAddress,
    shippingAddress: customer.shippingAddress,
    bankDetails: customer.bankDetails,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt
  };
};

// Download Customer Excel Template
const downloadCustomerTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customers Template');

    // Define columns
    worksheet.columns = [
      { header: 'Phone Number', key: 'phone', width: 15 }, // REQUIRED
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Website', key: 'website', width: 25 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Billing Name', key: 'billing_name', width: 20 },
      { header: 'Billing Address Line 1', key: 'billing_address1', width: 30 },
      { header: 'Billing Address Line 2', key: 'billing_address2', width: 30 },
      { header: 'Billing City', key: 'billing_city', width: 15 },
      { header: 'Billing State', key: 'billing_state', width: 15 },
      { header: 'Billing Pincode', key: 'billing_pincode', width: 10 },
      { header: 'Billing Country', key: 'billing_country', width: 15 },
      // Shipping Address
      { header: 'Shipping Name', key: 'shipping_name', width: 20 },
      { header: 'Shipping Address Line 1', key: 'shipping_address1', width: 30 },
      { header: 'Shipping Address Line 2', key: 'shipping_address2', width: 30 },
      { header: 'Shipping City', key: 'shipping_city', width: 15 },
      { header: 'Shipping State', key: 'shipping_state', width: 15 },
      { header: 'Shipping Pincode', key: 'shipping_pincode', width: 10 },
      { header: 'Shipping Country', key: 'shipping_country', width: 15 },
      // Bank Details
      { header: 'Bank Name', key: 'bank_name', width: 20 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'Account Holder Name', key: 'account_holder_name', width: 25 },
      { header: 'Account Number', key: 'account_number', width: 20 },
      { header: 'IFSC', key: 'ifsc', width: 15 }
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
      phone: '9876543210',
      name: 'John Doe',
      email: 'john@example.com',
      website: 'www.example.com',
      notes: 'Sample customer',
      // status: 'Active',
      billing_name: 'John Doe',
      billing_address1: '123 Main St',
      billing_address2: 'Apt 4B',
      billing_city: 'Mumbai',
      billing_state: 'Maharashtra',
      billing_pincode: '400001',
      billing_country: 'India',
      shipping_name: 'John Doe',
      shipping_address1: '123 Main St',
      shipping_address2: 'Apt 4B',
shipping_city: 'Mumbai',
      shipping_state: 'Maharashtra',
      shipping_pincode: '400001',
      shipping_country: 'India',
      bank_name: 'HDFC Bank',
      branch: 'Andheri',
      account_holder_name: 'John Doe',
      account_number: '1234567890',
      ifsc: 'HDFC0001234'
    });

    // Add notes
    worksheet.addRow([]);
    worksheet.addRow(['* Phone Number is REQUIRED. All other fields are OPTIONAL.']);
    worksheet.addRow(['* Status can be: Active or Inactive']);
    worksheet.addRow(['* Duplicate phone numbers will be rejected.']);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Customer_Import_Template.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating customer template:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating template',
      error: error.message
    });
  }
};

// Upload Customers from Excel
const uploadCustomersFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required'
      });
    }

    const userId = req.user;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Excel sheet not found'
      });
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
      customersCreated: 0,
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

        // Get phone number (REQUIRED)
        const phone = getVal(['Phone Number', 'Phone', 'Mobile']);

        if (!phone || phone.toString().trim() === '') {
          throw new Error('Phone Number is required');
        }

        // Check for duplicate customer by phone for this user
        const existingCustomer = await Customer.findOne({
          phone: phone.toString().trim(),
          userId
        });

        if (existingCustomer) {
          throw new Error(`Customer with phone number ${phone} already exists`);
        }

        // Get optional fields
        const name = getVal(['Name', 'Customer Name']) || '';
        const email = getVal(['Email', 'Email Address']) || '';
        const website = getVal(['Website', 'Web']) || '';
        const notes = getVal(['Notes', 'Note', 'Comments']) || '';
        const status = getVal(['Status']) || 'Active';

        // Parse billing address
        const billingAddress = {
          name: getVal(['Billing Name']) || '',
          addressLine1: getVal(['Billing Address Line 1', 'Billing Address 1']) || '',
          addressLine2: getVal(['Billing Address Line 2', 'Billing Address 2']) || '',
          city: getVal(['Billing City']) || '',
          state: getVal(['Billing State']) || '',
          pincode: getVal(['Billing Pincode', 'Billing Pin']) || '',
          country: getVal(['Billing Country']) || ''
        };

        // Parse shipping address
        const shippingAddress = {
          name: getVal(['Shipping Name']) || '',
          addressLine1: getVal(['Shipping Address Line 1', 'Shipping Address 1']) || '',
          addressLine2: getVal(['Shipping Address Line 2', 'Shipping Address 2']) || '',
          city: getVal(['Shipping City']) || '',
          state: getVal(['Shipping State']) || '',
          pincode: getVal(['Shipping Pincode', 'Shipping Pin']) || '',
          country: getVal(['Shipping Country']) || ''
        };

        // Parse bank details
        const bankDetails = {
          bankName: getVal(['Bank Name', 'Bank']) || '',
          branch: getVal(['Branch']) || '',
          accountHolderName: getVal(['Account Holder Name', 'Account Holder']) || '',
          accountNumber: getVal(['Account Number', 'Account No']) || '',
          IFSC: getVal(['IFSC', 'IFSC Code']) || ''
        };

        // Create customer
        const customer = new Customer({
          name,
          email,
          phone: phone.toString().trim(),
          website,
          notes,
          status: ['Active', 'Inactive'].includes(status) ? status : 'Active',
          billingAddress,
          shippingAddress,
          bankDetails,
          userId
        });

        await customer.save();
        results.customersCreated++;

      } catch (error) {
        results.errors.push({
          row: rowNumber,
          reason: error.message,
          data: rowData
        });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      message: 'Import processed successfully',
      results
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Customer Import Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing file',
      error: error.message
    });
  }
};

const buildInvoiceStatsMap = async (userId) => {
  const userObjectId = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId;
  const rows = await Invoice.aggregate([
    {
      $match: {
        userId: userObjectId,
        isDeleted: false,
        status: { $ne: "CANCELLED" },
        billTo: { $ne: null }
      }
    },
    { $sort: { invoiceDate: -1 } },
    {
      $group: {
        _id: "$billTo",
        visits: { $sum: 1 },
        lifetimeValue: { $sum: "$TotalAmount" },
        avgTrxValue: { $avg: "$TotalAmount" },
        maxBillAmount: { $max: "$TotalAmount" },
        lastBillDate: { $first: "$invoiceDate" },
        lastBillValue: { $first: "$TotalAmount" },
      }
    }
  ]);

  const map = {};
  rows.forEach((row) => {
    map[row._id.toString()] = row;
  });
  return map;
};

const getDormancyBucket = (lastBillDate, now = new Date()) => {
  if (!lastBillDate) return "DORMANT_12_PLUS";
  const diffDays = Math.floor((now - new Date(lastBillDate)) / (1000 * 60 * 60 * 24));
  if (diffDays <= 90) return "ACTIVE_3";
  if (diffDays <= 180) return "DORMANT_3_6";
  if (diffDays <= 365) return "DORMANT_6_12";
  return "DORMANT_12_PLUS";
};

const getCustomerActivitySummary = async (req, res) => {
  try {
    const userId = req.user;
    const customers = await Customer.find({ userId, isDeleted: false })
      .select("name phone status")
      .lean();

    const statsMap = await buildInvoiceStatsMap(userId);

    const summary = {
      totalCustomers: customers.length,
      active3Months: 0,
      dormant3To6: 0,
      dormant6To12: 0,
      dormant12Plus: 0
    };

    const visitsBuckets = {
      one: 0,
      two: 0,
      three: 0,
      four: 0,
      fivePlus: 0,
      tenPlus: 0
    };

    customers.forEach((c) => {
      const stat = statsMap[c._id.toString()];
      const bucket = getDormancyBucket(stat?.lastBillDate);

      if (bucket === "ACTIVE_3") summary.active3Months++;
      else if (bucket === "DORMANT_3_6") summary.dormant3To6++;
      else if (bucket === "DORMANT_6_12") summary.dormant6To12++;
      else summary.dormant12Plus++;

      const visits = stat?.visits || 0;
      if (visits === 1) visitsBuckets.one++;
      else if (visits === 2) visitsBuckets.two++;
      else if (visits === 3) visitsBuckets.three++;
      else if (visits === 4) visitsBuckets.four++;
      else if (visits >= 10) visitsBuckets.tenPlus++;
      else if (visits >= 5) visitsBuckets.fivePlus++;
    });

    res.status(200).json({
      success: true,
      data: {
        summary,
        visits: visitsBuckets
      }
    });
  } catch (err) {
    console.error("Customer activity summary error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer activity summary",
      error: err.message
    });
  }
};

const deleteCustomerById = async (id, userId) => {
  const customer = await Customer.findOneAndDelete(
    {
      _id: id,
      userId,
      isDeleted: false
    },
    {
      isDeleted: true,
      deletedAt: new Date()
    },
    { new: true }
  );
  return !!customer;
};

const bulkDeleteCustomers = async (req, res) => {
  const { ids, all } = req.body;
  const userId = req.user;
  try {
    let targetIds = ids;
    if (all) {
      const customers = await Customer.find({ userId, isDeleted: false }).select('_id');
      targetIds = customers.map(c => c._id);
    }
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ message: 'Please provide customer ids.' });
    }
    const failed = [];
    for (const id of targetIds) {
      try {
        const ok = await deleteCustomerById(id, userId);
        if (!ok) failed.push(id);
      } catch {
        failed.push(id);
      }
    }
    return res.status(200).json({
      success: true,
      message: 'Customers deleted',
      deletedCount: targetIds.length - failed.length,
      failedIds: failed
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Error deleting customers',
      error: err.message
    });
  }
};

// Export Customers (Name, Phone, Email) with search filter
const exportCustomers = async (req, res) => {
  try {
    const {
      search = "",
      status
    } = req.query;

    const query = { isDeleted: false };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { "billingAddress.city": { $regex: search, $options: "i" } },
        { "shippingAddress.city": { $regex: search, $options: "i" } }
      ];
    }

    const customers = await Customer.find(query)
      .select("name phone email")
      .sort({ name: 1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customers');

    worksheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 30 }
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

    customers.forEach((customer) => {
      worksheet.addRow({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=customers_export.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Customer export error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to export customers",
      error: err.message
    });
  }
};

const listCustomerActivity = async (req, res) => {
  try {
    const userId = req.user;
    const {
      page = 1,
      limit = 10,
      search = "",
      profileStatus,
      fromDate,
      toDate
    } = req.query;

    const query = { userId, isDeleted: false };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    const customers = await Customer.find(query)
      .select("name phone status")
      .lean();

    const statsMap = await buildInvoiceStatsMap(userId);
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    let rows = customers.map((c) => {
      const stat = statsMap[c._id.toString()] || {};
      const lastBillDate = stat.lastBillDate ? new Date(stat.lastBillDate) : null;
      const dormancyBucket = getDormancyBucket(lastBillDate);
      const shortStatus = dormancyBucket === "ACTIVE_3" ? "Active" : "Dormant";

      return {
        id: c._id,
        profileStatus: shortStatus,
        phone: c.phone || "",
        visits: stat.visits || 0,
        lifetimeValue: stat.lifetimeValue || 0,
        avgTrxValue: stat.avgTrxValue || 0,
        lastBillValue: stat.lastBillValue || 0,
        lastBillDate: lastBillDate ? lastBillDate.toISOString().slice(0, 10) : "",
        maxBillAmount: stat.maxBillAmount || 0
      };
    });

    if (profileStatus && profileStatus !== "all") {
      const normalized = profileStatus.toLowerCase();
      rows = rows.filter((r) => r.profileStatus.toLowerCase() === normalized);
    }

    if (from || to) {
      rows = rows.filter((r) => {
        if (!r.lastBillDate) return false;
        const d = new Date(r.lastBillDate);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }

    const total = rows.length;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const paginated = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.status(200).json({
      success: true,
      data: {
        customers: paginated,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (err) {
    console.error("Customer activity list error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer activity list",
      error: err.message
    });
  }
};

const exportCustomerActivity = async (req, res) => {
  try {
    const userId = req.user;
    const { search = "", profileStatus, fromDate, toDate } = req.query;

    const query = { userId, isDeleted: false };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    const customers = await Customer.find(query)
      .select("name phone status")
      .lean();

    const statsMap = await buildInvoiceStatsMap(userId);
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    let rows = customers.map((c) => {
      const stat = statsMap[c._id.toString()] || {};
      const lastBillDate = stat.lastBillDate ? new Date(stat.lastBillDate) : null;
      const dormancyBucket = getDormancyBucket(lastBillDate);
      const shortStatus = dormancyBucket === "ACTIVE_3" ? "Active" : "Dormant";

      return {
        profileStatus: shortStatus,
        phone: c.phone || "",
        visits: stat.visits || 0,
        lifetimeValue: stat.lifetimeValue || 0,
        avgTrxValue: stat.avgTrxValue || 0,
        lastBillValue: stat.lastBillValue || 0,
        lastBillDate: lastBillDate ? lastBillDate.toISOString().slice(0, 10) : "",
        maxBillAmount: stat.maxBillAmount || 0
      };
    });

    if (profileStatus && profileStatus !== "all") {
      const normalized = profileStatus.toLowerCase();
      rows = rows.filter((r) => r.profileStatus.toLowerCase() === normalized);
    }

    if (from || to) {
      rows = rows.filter((r) => {
        if (!r.lastBillDate) return false;
        const d = new Date(r.lastBillDate);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Customer Activity");

    worksheet.columns = [
      { header: "Profile Status", key: "profileStatus", width: 16 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "No Of Visit", key: "visits", width: 12 },
      { header: "Lifetime Value", key: "lifetimeValue", width: 14 },
      { header: "Avg Trx Value", key: "avgTrxValue", width: 14 },
      { header: "Last Bill Value", key: "lastBillValue", width: 14 },
      { header: "Last Bill Date", key: "lastBillDate", width: 14 },
      { header: "Max Bill Amt", key: "maxBillAmount", width: 14 },
    ];

    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Customer_Activity.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Customer activity export error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to export customer activity",
      error: err.message
    });
  }
};

module.exports = {
  createCustomer,
  createMinimalCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  bulkDeleteCustomers,
  downloadCustomerTemplate,
  uploadCustomersFromExcel,
  getCustomerActivitySummary,
  listCustomerActivity,
  exportCustomerActivity,
  exportCustomers
};
