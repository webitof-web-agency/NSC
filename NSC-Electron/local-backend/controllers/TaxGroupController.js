const TaxGroup = require('../models/TaxGroup');
const mongoose = require('mongoose');
const exceljs = require('exceljs');
const fs = require('fs');
const TaxRate = require('../models/TaxRate');

// Get all tax groups
exports.getAllTaxGroups = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        
        // Build the query
        const query = {};
        if (search) {
            query.$or = [
                { tax_name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Get total count for pagination info
        const total = await TaxGroup.countDocuments(query);

        // Fetch tax groups with pagination and population
        const taxGroups = await TaxGroup.find(query)
            .populate('tax_rate_ids')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Calculate total tax rates and format response
        const result = taxGroups.map(taxGroup => {
            const totalTaxRate = taxGroup.tax_rate_ids.reduce(
                (sum, rate) => sum + (rate.tax_rate || 0), 0
            );

            return {
                ...taxGroup.toObject(),
                total_tax_rate: totalTaxRate
            };
        });

        res.status(200).json({
            data: result,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ 
            message: 'Failed to fetch tax groups', 
            error: err.message 
        });
    }
};

// Create new tax group
// exports.createTaxGroup = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { tax_name, tax_rate, tax_rate_ids } = req.body;

//     const newGroup = new TaxGroup({
//       tax_name,
//       tax_rate,
//       tax_rate_ids
//     });

//     await newGroup.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       message: 'Tax group created successfully',
//       data: newGroup
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();

//     console.error('Tax group creation error:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to create tax group',
//       error: err.message
//     });
//   }
// };

exports.createTaxGroup = async (req, res) => {
    try {
        const { tax_name, tax_rate_ids } = req.body;

        const newGroup = new TaxGroup({
            tax_name,
            tax_rate_ids
        });

        await newGroup.save();

        res.status(201).json({
            success: true,
            message: 'Tax group created successfully',
            data: newGroup
        });
    } catch (err) {
        console.error('Tax group creation error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to create tax group',
            error: err.message
        });
    }
};


// Get a single tax group
exports.getTaxGroupById = async (req, res) => {
    try {
        const group = await TaxGroup.findById(req.params.id).populate('tax_rate_ids');
        if (!group) return res.status(404).json({ message: 'Tax group not found' });

        res.status(200).json(group);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tax group', error: err.message });
    }
};

// Update a tax group
// exports.updateTaxGroup = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const updated = await TaxGroup.findByIdAndUpdate(
//       req.params.id,
//       { $set: req.body },
//       { new: true, runValidators: true, session }
//     );

//     if (!updated) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({
//         success: false,
//         message: 'Tax group not found'
//       });
//     }

//     await session.commitTransaction();
//     session.endSession();

//     res.status(200).json({
//       success: true,
//       message: 'Tax group updated successfully',
//       data: updated
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();

//     console.error('Tax group update error:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to update tax group',
//       error: err.message
//     });
//   }
// };


// Update a tax group
exports.updateTaxGroup = async (req, res) => {
  try {
    const { tax_name, tax_rate_ids } = req.body;

    const updated = await TaxGroup.findByIdAndUpdate(
      req.params.id,
      {
        tax_name,
        tax_rate_ids
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Tax group not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tax group updated successfully',
      data: updated
    });
  } catch (err) {
    console.error('Tax group update error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update tax group',
      error: err.message
    });
  }
};


// Delete a tax group
exports.deleteTaxGroup = async (req, res) => {
    try {
        const deleted = await TaxGroup.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Tax group not found' });

        res.status(200).json({ message: 'Tax group deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete tax group', error: err.message });
    }
};

// Unified Upload for Tax Rates and Tax Groups
exports.uploadUnifiedTaxExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Excel file is required' });
        }

        const workbook = new exceljs.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        
        let summary = {
            rates: { inserted: 0, skipped: [] },
            groups: { inserted: 0, skipped: [] }
        };

        // --- 1. Process Tax Rates ---
        const rateSheet = workbook.getWorksheet('TaxRates');
        if (rateSheet) {
            const taxRatesData = [];
            rateSheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header
                taxRatesData.push({
                    rowNumber,
                    tax_name: row.getCell(1).text ? String(row.getCell(1).value || '').trim() : '',
                    tax_rate: row.getCell(2).value,
                    status: row.getCell(3).value
                });
            });

            for (const item of taxRatesData) {
                const { rowNumber, tax_name, tax_rate, status } = item;

                if (!tax_name || tax_rate === null || tax_rate === undefined || tax_rate === '') {
                    summary.rates.skipped.push({ row: rowNumber, reason: 'tax_name or tax_rate missing' });
                    continue;
                }

                const rate = Number(tax_rate);
                if (isNaN(rate)) {
                    summary.rates.skipped.push({ row: rowNumber, reason: 'Invalid tax_rate' });
                    continue;
                }

                // Check duplicate
                const exists = await TaxRate.findOne({ tax_name: { $regex: `^${tax_name}$`, $options: 'i' } });
                if (exists) {
                    summary.rates.skipped.push({ row: rowNumber, reason: 'Tax name already exists' });
                    continue;
                }

                // Determine boolean status (Excel boolean or string)
                let statusBool = true;
                if (typeof status === 'boolean') statusBool = status;
                else if (String(status).toLowerCase() === 'false') statusBool = false;

                await TaxRate.create({
                    tax_name,
                    tax_rate: rate,
                    status: statusBool
                });
                summary.rates.inserted++;
            }
        }

        // --- 2. Process Tax Groups ---
        const groupSheet = workbook.getWorksheet('TaxGroups');
        if (groupSheet) {
            const taxGroupsData = [];
            groupSheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                taxGroupsData.push({
                    rowNumber,
                    tax_name: row.getCell(1).text ? String(row.getCell(1).value || '').trim() : '',
                    tax_rates: row.getCell(2).text ? String(row.getCell(2).value || '').trim() : ''
                });
            });

            for (const item of taxGroupsData) {
                const { rowNumber, tax_name, tax_rates: tax_rates_raw } = item;

                if (!tax_name || !tax_rates_raw) {
                    summary.groups.skipped.push({ row: rowNumber, reason: 'tax_name or tax_rates missing' });
                    continue;
                }

                // Check duplicate group
                const exists = await TaxGroup.findOne({ tax_name: { $regex: `^${tax_name}$`, $options: 'i' } });
                if (exists) {
                    summary.groups.skipped.push({ row: rowNumber, reason: 'Tax group already exists' });
                    continue;
                }

                // Find Tax Rates
                const taxRateNames = tax_rates_raw.split(',').map(r => r.trim()).filter(Boolean);
                // Perform case-insensitive search for each rate
                const taxRateIds = [];
                let allFound = true;

                for (const rateName of taxRateNames) {
                    const rateDoc = await TaxRate.findOne({ tax_name: { $regex: `^${rateName}$`, $options: 'i' } });
                    if (rateDoc) {
                        taxRateIds.push(rateDoc._id);
                    } else {
                        allFound = false;
                        summary.groups.skipped.push({ row: rowNumber, reason: `Tax Rate '${rateName}' not found` });
                        break; 
                    }
                }

                if (!allFound) continue;

                await TaxGroup.create({
                    tax_name,
                    tax_rate_ids: taxRateIds,
                    status: true
                });
                summary.groups.inserted++;
            }
        }

        // Cleanup
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.status(200).json({
            success: true,
            message: 'Unified Tax Excel uploaded successfully',
            summary
        });

    } catch (error) {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error('Unified Tax Excel upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload Unified Tax Excel',
            error: error.message
        });
    }
};

exports.downloadUnifiedTaxSample = async (req, res) => {
    try {
        const workbook = new exceljs.Workbook();

        // 1. TaxRates Sheet
        const rateSheet = workbook.addWorksheet('TaxRates');
        rateSheet.columns = [
            { header: 'tax_name', key: 'tax_name', width: 20 },
            { header: 'tax_rate', key: 'tax_rate', width: 15 },
            { header: 'status', key: 'status', width: 10 }
        ];
        const rateHeader = rateSheet.getRow(1);
        rateHeader.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' }
            };
        });
        // Sample Data for Rates
        rateSheet.addRow({ tax_name: 'CGST 9%', tax_rate: 9, status: true });
        rateSheet.addRow({ tax_name: 'SGST 9%', tax_rate: 9, status: true });
        rateSheet.addRow({ tax_name: 'IGST 18%', tax_rate: 18, status: true });

        // 2. TaxGroups Sheet
        const groupSheet = workbook.addWorksheet('TaxGroups');
        groupSheet.columns = [
            { header: 'tax_name', key: 'tax_name', width: 20 },
            { header: 'tax_rates', key: 'tax_rates', width: 40 }
        ];
        const groupHeader = groupSheet.getRow(1);
        groupHeader.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' }
            };
        });
        // Sample Data for Groups
        groupSheet.addRow({ tax_name: 'GST 18%', tax_rates: 'CGST 9%, SGST 9%' });
        groupSheet.addRow({ tax_name: 'Interstate GST', tax_rates: 'IGST 18%' });

        // Set Headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Tax_Upload_Template.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error downloading sample:', error);
        res.status(500).json({ message: 'Failed to download sample template' });
    }
};
