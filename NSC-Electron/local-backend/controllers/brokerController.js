const Broker = require('../models/Broker');
const Purchase = require('../models/Purchase');
const BrokerDetail = require('../models/BrokerDetail');

// Create a new broker record (Master or Deal)
exports.createBroker = async (req, res) => {
  try {
    const { name, phone, commissionType, commissionValue, purchaseId, isMasterUpdate, address, city, state, country, previousPhone } = req.body;

    // 1. Handle Master Record (BrokerDetail)
    if (!name || !phone) {
      return res.status(400).json({ message: 'Missing required fields: name, phone' });
    }

    // Upsert Broker Detail (Master)
    let brokerDetail = null;
    if (isMasterUpdate && previousPhone && previousPhone !== phone) {
        brokerDetail = await BrokerDetail.findOne({ phone: previousPhone, isDeleted: false });
    }
    if (!brokerDetail) {
        brokerDetail = await BrokerDetail.findOne({ phone: phone, isDeleted: false });
    }
    
    if (brokerDetail) {
         // Update existing master if requested or if simpler flow
         if (isMasterUpdate || (!purchaseId)) {
             brokerDetail.name = name;
             if (phone) brokerDetail.phone = phone;
             if (address !== undefined) brokerDetail.address = address || "";
             if (city !== undefined) brokerDetail.city = city || "";
             if (state !== undefined) brokerDetail.state = state || "";
             if (country !== undefined) brokerDetail.country = country || "";
             if (commissionType) brokerDetail.commissionType = commissionType;
             if (commissionValue !== undefined) brokerDetail.commissionValue = Number(commissionValue);
             await brokerDetail.save();

             if (previousPhone && previousPhone !== phone) {
                await Broker.updateMany(
                    { phone: previousPhone, isDeleted: false },
                    { $set: { phone, name: brokerDetail.name } }
                );
             } else {
                await Broker.updateMany(
                    { phone: brokerDetail.phone, isDeleted: false },
                    { $set: { name: brokerDetail.name } }
                );
             }
         }
    } else {
        // Create new master
        brokerDetail = new BrokerDetail({
            name,
            phone,
            commissionType: commissionType || 'Percentage',
            commissionValue: commissionValue !== undefined ? Number(commissionValue) : 0,
            address: address || "",
            city: city || "",
            state: state || "",
            country: country || "",
            userId: req.user
        });
        await brokerDetail.save();
    }

    // 2. Handle Deal Creation (Transaction)
    let populatedBroker = null;
    if (purchaseId) {
        // Use defaults from Master if not provided in request
        const finalCommType = commissionType || brokerDetail.commissionType;
        const finalCommValue = commissionValue !== undefined ? Number(commissionValue) : brokerDetail.commissionValue;

        const purchase = await Purchase.findById(purchaseId);
        if (!purchase) {
            return res.status(404).json({ message: 'Purchase not found' });
        }

        const baseAmount = purchase.finalAmount || purchase.totalAmount || 0;
        let commissionAmount = 0;

        if (finalCommType === 'Percentage') {
            commissionAmount = (baseAmount * finalCommValue) / 100;
        } else {
            commissionAmount = finalCommValue;
        }

        // Find or create broker document
        let broker = await Broker.findOne({ phone: brokerDetail.phone, isDeleted: false });
        
        if (!broker) {
            // Create new broker document with first deal
            broker = new Broker({
                name: brokerDetail.name,
                phone: brokerDetail.phone,
                userId: req.user,
                deals: [{
                    purchaseId,
                    purchaseNumber: purchase.purchaseId,
                    commissionType: finalCommType,
                    commissionValue: finalCommValue,
                    commissionAmount
                }]
            });
            await broker.save();
        } else {
            // Push new deal to existing broker's deals array
            broker.deals.push({
                purchaseId,
                purchaseNumber: purchase.purchaseId,
                commissionType: finalCommType,
                commissionValue: finalCommValue,
                commissionAmount
            });
            broker.name = brokerDetail.name; // Update name if changed
            await broker.save();
        }
        
        // Populate the deals
        populatedBroker = await Broker.findById(broker._id)
            .populate('deals.purchaseId', 'purchaseId finalAmount totalAmount');
    }

    res.status(201).json({
      message: purchaseId ? 'Deal added successfully' : 'Broker details saved successfully',
      broker: populatedBroker || brokerDetail,
      isMaster: !purchaseId
    });

  } catch (error) {
    console.error('Error creating broker:', error);
    res.status(500).json({
      message: 'Error creating broker record',
      error: error.message
    });
  }
};

// Update Broker Master (Name) or Update a specific Deal
exports.updateBroker = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, commissionType, commissionValue, purchaseId, isMasterUpdate } = req.body;

    // Check if this is a "Master Update" request (updating name for provided phone)
    if (isMasterUpdate && phone) {
        // Update Name for ALL records with this phone number
        await Broker.updateMany(
            { phone: phone, isDeleted: false },
            { $set: { name: name } }
        );
         return res.status(200).json({
            message: 'Broker master details updated successfully'
        });
    }

    // Otherwise, standard single record update (e.g. editing a deal)
    const broker = await Broker.findById(id);
    if (!broker) {
      return res.status(404).json({ message: 'Broker record not found' });
    }

    // Logic to update deal specific fields (recalculate if needed)
    // NOTE: If updating name/phone on a specific deal, do we update all? 
    // For now, let's assume valid single deal edits.

    let commissionAmount = broker.commissionAmount;
    let purchaseNumber = broker.purchaseNumber;

    if ((purchaseId && broker.purchaseId?.toString() !== purchaseId) ||
        (commissionValue !== undefined && broker.commissionValue !== Number(commissionValue)) ||
        (commissionType && broker.commissionType !== commissionType)) {
      
        // Need to recalculate
        const puId = purchaseId || broker.purchaseId;
        if(puId) {
             const purchase = await Purchase.findById(puId);
             if (purchase) {
                 const baseAmount = purchase.finalAmount || purchase.totalAmount || 0;
                 const cType = commissionType || broker.commissionType;
                 const cVal = commissionValue !== undefined ? Number(commissionValue) : broker.commissionValue;
                 
                 commissionAmount = cType === 'Percentage' ? (baseAmount * cVal) / 100 : cVal;
                 purchaseNumber = purchase.purchaseId;
             }
        }
    }

    if (name) broker.name = name;
    if (phone) broker.phone = phone;
    if (commissionType) broker.commissionType = commissionType;
    if (commissionValue !== undefined) broker.commissionValue = commissionValue;
    if (commissionAmount !== undefined ) broker.commissionAmount = commissionAmount;
    if (purchaseId) broker.purchaseId = purchaseId;
    if (purchaseNumber) broker.purchaseNumber = purchaseNumber;

    await broker.save();

     const populatedBroker = await Broker.findById(broker._id)
      .populate('purchaseId', 'purchaseId finalAmount totalAmount');

    res.status(200).json({
      message: 'Broker record updated successfully',
      broker: populatedBroker
    });

  } catch (error) {
    console.error('Error updating broker:', error);
    res.status(500).json({
      message: 'Error updating broker record',
      error: error.message
    });
  }
};

// Get all brokers (Masters)
exports.getBrokers = async (req, res) => {
  try {
    const { search, phone, aggregated } = req.query;
    
    const matchStage = { isDeleted: false };
    if (search) {
        // Escape special regex characters
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        matchStage.$or = [
            { name: { $regex: escapedSearch, $options: 'i' } },
            { phone: { $regex: escapedSearch, $options: 'i' } }
        ];
    }
    if (phone) {
        matchStage.phone = phone;
    }

    // Fetch from BrokerDetail
    const brokers = await BrokerDetail.find(matchStage).sort({ name: 1 });
    
    // If aggregated flag is set, enhance with totalDeals count
    if (aggregated === 'true') {
        const brokersWithCounts = await Promise.all(
            brokers.map(async (broker) => {
                // Find the broker document for this phone
                const brokerDoc = await Broker.findOne({
                    phone: broker.phone,
                    isDeleted: false
                });
                const dealCount = brokerDoc ? brokerDoc.deals.length : 0;
                
                return {
                    _id: broker._id, // BrokerDetail document ID
                    name: broker.name,
                    phone: broker.phone,
                    address: broker.address || "",
                    city: broker.city || "",
                    state: broker.state || "",
                    country: broker.country || "",
                    commissionType: broker.commissionType,
                    commissionValue: broker.commissionValue,
                    totalDeals: dealCount
                };
            })
        );
        return res.status(200).json({
            message: 'Brokers retrieved successfully',
            brokers: brokersWithCounts
        });
    }

    res.status(200).json({
      message: 'Brokers retrieved successfully',
      brokers
    });

  } catch (error) {
    console.error('Error fetching brokers:', error);
    res.status(500).json({
      message: 'Error fetching brokers',
      error: error.message
    });
  }
};

// Get Deals for a specific Broker (by ID) - New endpoint logic
exports.getBrokerDeals = async (req, res) => {
    try {
        const { id } = req.params; // Expecting BrokerDetail _id
        
        const master = await BrokerDetail.findById(id);
        if (!master) return res.status(404).json({ message: "Broker not found" });

        // Find broker document with deals array
        const broker = await Broker.findOne({ phone: master.phone, isDeleted: false })
            .populate('deals.purchaseId', 'purchaseId finalAmount totalAmount purchaseDate')
            .sort({ 'deals.createdAt': -1 });

        const deals = broker ? broker.deals : [];

        res.status(200).json({
            message: "Deals retrieved",
            deals,
            master // Return master defaults too for UI convenience
        });
    } catch (error) {
        console.error("Error fetching deals:", error);
        res.status(500).json({ message: "Error fetching deals" });
    }
};

// Delete a broker deal (permanent delete from deals array)
exports.deleteBroker = async (req, res) => {
  try {
    const { id } = req.params; // This is the deal _id (subdocument)

    // Find broker containing this deal and remove it
    const broker = await Broker.findOne({ 'deals._id': id, isDeleted: false });
    
    if (!broker) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    // Remove the deal from the deals array
    broker.deals.pull( id);
    await broker.save();

    res.status(200).json({
      message: 'Deal deleted permanently'
    });

  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({
      message: 'Error deleting deal',
      error: error.message
    });
  }
};

// Delete broker master + all deals (hard delete)
exports.deleteBrokerMaster = async (req, res) => {
  try {
    const { id } = req.params; // BrokerDetail _id

    const master = await BrokerDetail.findById(id);
    if (!master) {
      return res.status(404).json({ message: "Broker not found" });
    }

    // Delete broker detail (master)
    await BrokerDetail.deleteOne({ _id: master._id });

    // Delete broker deals document (by phone + user)
    await Broker.deleteOne({ phone: master.phone, userId: master.userId });

    res.status(200).json({ message: "Broker deleted permanently" });
  } catch (error) {
    console.error("Error deleting broker:", error);
    res.status(500).json({
      message: "Error deleting broker",
      error: error.message,
    });
  }
};

exports.bulkDeleteBrokerMasters = async (req, res) => {
  const { ids, all } = req.body;
  try {
    let targetIds = ids;
    if (all) {
      const masters = await BrokerDetail.find({}).select('_id');
      targetIds = masters.map(m => m._id);
    }
    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ message: "Please provide broker ids." });
    }
    const failed = [];
    for (const id of targetIds) {
      try {
        const master = await BrokerDetail.findById(id);
        if (!master) {
          failed.push(id);
          continue;
        }
        await BrokerDetail.deleteOne({ _id: master._id });
        await Broker.deleteOne({ phone: master.phone, userId: master.userId });
      } catch {
        failed.push(id);
      }
    }
    return res.status(200).json({
      message: "Brokers deleted",
      deletedCount: targetIds.length - failed.length,
      failedIds: failed
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error deleting brokers",
      error: error.message,
    });
  }
};

// Bulk upload brokers from Excel
exports.uploadBrokersFromExcel = async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const ExcelJS = require('exceljs');
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    // Use readFile because middleware saves to disk (req.file.path)
    await workbook.xlsx.readFile(req.file.path);
    
    const worksheet = workbook.getWorksheet(1); // Get first sheet
    if (!worksheet) {
      // Clean up file if error
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      return res.status(400).json({ message: 'Excel file is empty' });
    }

    const data = [];
    const headers = {};
    
    // Map headers from first row
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value;
    });

    // Iterate rows starting from 2
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      data.push(rowData);
    });

    // Clean up file after reading
    try { fs.unlinkSync(req.file.path); } catch(e) { console.error('Error deleting file:', e); }

    if (data.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty' });
    }

    const results = {
      success: [],
      errors: []
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // match Excel row numbers

      try {
        // Validate required fields
        if (!row['Broker Name'] || !row['Phone Number']) {
          results.errors.push({
            row: rowNum,
            data: row,
            error: 'Missing required fields: Broker Name and Phone Number'
          });
          continue;
        }

        const brokerData = {
          name: String(row['Broker Name']).trim(),
          phone: String(row['Phone Number']).trim(),
          commissionType: row['Commission Type'] || 'Percentage',
          commissionValue: row['Commission Value'] ? Number(row['Commission Value']) : 0,
          userId: req.user
        };

        // Validate commission type
        if (!['Percentage', 'Fixed'].includes(brokerData.commissionType)) {
          results.errors.push({
            row: rowNum,
            data: row,
            error: 'Invalid Commission Type. Must be "Percentage" or "Fixed"'
          });
          continue;
        }

        // Check if broker exists
        let broker = await BrokerDetail.findOne({ phone: brokerData.phone, isDeleted: false });

        if (broker) {
          // Update existing broker
          broker.name = brokerData.name;
          broker.commissionType = brokerData.commissionType;
          broker.commissionValue = brokerData.commissionValue;
          await broker.save();
          results.success.push({
            row: rowNum,
            data: row,
            action: 'Updated',
            broker: broker.name
          });
        } else {
          // Create new broker
          broker = await BrokerDetail.create(brokerData);
          results.success.push({
            row: rowNum,
            data: row,
            action: 'Created',
            broker: broker.name
          });
        }

      } catch (error) {
        results.errors.push({
          row: rowNum,
          data: row,
          error: error.message
        });
      }
    }

    res.status(200).json({
      message: 'Upload completed',
      totalRows: data.length,
      successCount: results.success.length,
      errorCount: results.errors.length,
      results
    });

  } catch (error) {
    console.error('Error uploading brokers:', error);
    // Cleanup if critical error
    if (req.file && req.file.path) {
        try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
    res.status(500).json({
      message: 'Error processing Excel file',
      error: error.message
    });
  }
};

// Download broker sample template
exports.downloadBrokerSampleTemplate = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Brokers');

    // Define columns
    worksheet.columns = [
      { header: 'Broker Name', key: 'brokerName', width: 25 },
      { header: 'Phone Number', key: 'phoneNumber', width: 15 },
      { header: 'Commission Type', key: 'commissionType', width: 20 },
      { header: 'Commission Value', key: 'commissionValue', width: 20 }
    ];

    // Add sample rows
    worksheet.addRow({
      brokerName: 'John Doe',
      phoneNumber: '9876543210',
      commissionType: 'Percentage',
      commissionValue: 5
    });

    worksheet.addRow({
      brokerName: 'Jane Smith',
      phoneNumber: '9876543211',
      commissionType: 'Fixed',
      commissionValue: 100
    });

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

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=broker_sample_template.xlsx');

    await workbook.xlsx.write(res);

  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      message: 'Error generating sample template',
      error: error.message
    });
  }
};
