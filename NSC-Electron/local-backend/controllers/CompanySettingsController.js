const CompanySettings = require('@models/CompanySettings');
const mongoose = require('mongoose');
const User = require('@models/User');
const Currency = require('@models/Currency');
const DateFormat = require('@models/DateFormat');
const TimeFormat = require('@models/TimeFormat');
const Timezone = require('@models/Timezone');
const Localization = require('@models/Localization');
const Role = require('@models/Role');
const Permission = require('@models/Permission');
const InvoiceTemplate = require('@models/InvoiceTemplate');
const fs = require('fs');
const path = require('path');
const GeneralSetting = require('@models/GeneralSetting');

// Create a GeneralSetting
const createOrUpdateGeneralSetting = async (req, res) => {
  try {
    const { settings } = req.body; 
    const userId = req.user;

    if (!settings || !Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request must include an array of settings with key, value, and optional groupSlug'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const results = [];

    for (const { key, value, groupSlug = 'general' } of settings) {
      if (!key || value === undefined) {
        results.push({
          key,
          status: 'failed',
          message: 'Key and value are required'
        });
        continue;
      }

      let setting = await GeneralSetting.findOne({ key });

      if (setting) {
        
        setting.value = value;
        setting.groupSlug = groupSlug;
        setting.updatedBy = user._id;
        await setting.save();

        results.push({
          key,
          value,
          groupSlug,
          status: 'updated',
          message: 'Setting updated successfully'
        });
      } else {
       
        setting = new GeneralSetting({
          key,
          value,
          groupSlug,
          createdBy: user._id,
          updatedBy: user._id
        });
        await setting.save();

        results.push({
          key,
          value,
          groupSlug,
          status: 'created',
          message: 'Setting created successfully'
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'General settings processed successfully',
      data: results
    });
  } catch (err) {
    console.error('Error creating/updating general settings:', err);
    res.status(500).json({
      success: false,
      message: 'Error creating/updating general settings',
      error: err.message
    });
  }
};


// List all GeneralSettings
const listGeneralSettings = async (req, res) => {
  try {
    const { groupSlug } = req.query; // Optional filter

    const filter = {};
    if (groupSlug) filter.groupSlug = groupSlug;

    const settings = await GeneralSetting.find(filter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (err) {
    console.error('Error fetching general settings:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching general settings',
      error: err.message
    });
  }
};


const getCompanySettings = async (req, res) => {
  try {
    // Always fetch the single global settings (ignore userId)
    const settings = await CompanySettings.findOne({})
      .populate({
        path: 'country',
        model: 'Country',
        select: 'name iso3 iso2 phonecode currency'
      })
      .populate({
        path: 'state',
        model: 'State',
        select: 'name state_code'
      })
      .populate({
        path: 'city',
        model: 'City',
        select: 'name'
      });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Company settings not found',
        data: null
      });
    }

    const settingsData = settings.toObject();

    const imageFields = ['siteLogo', 'favicon', 'companyLogo', 'companyBanner'];
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    imageFields.forEach(field => {
      if (settingsData[field]) {
        const cleanedPath = settingsData[field].replace(/^[\\/]+/, '');
        settingsData[field] = `${baseUrl}/${cleanedPath.replace(/\\/g, '/')}`;
      }
    });

    settingsData.locationDetails = {
      country: settings.country ? {
        id: settings.country._id,
        name: settings.country.name,
        iso3: settings.country.iso3,
        iso2: settings.country.iso2,
        phonecode: settings.country.phonecode,
        currency: settings.country.currency
      } : null,
      state: settings.state ? {
        id: settings.state._id,
        name: settings.state.name,
        code: settings.state.state_code
      } : null,
      city: settings.city ? {
        id: settings.city._id,
        name: settings.city.name
      } : null
    };

    res.status(200).json({
      success: true,
      data: settingsData
    });
  } catch (err) {
    console.error('Get company settings error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching company settings',
      error: err.message
    });
  }
};

const deleteOldFile = async (filePath) => {
  if (filePath) {
    try {
      const fullPath = path.join(__dirname, '..', filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.error('Error deleting old file:', err);
    }
  }
};

const updateCompanySettings = async (req, res) => {
  try {
    const updates = { ...req.body };

    let currentSettings = await CompanySettings.findOne({});

    if (req.files) {
      const fileFields = {
        siteLogo: 'siteLogo',
        favicon: 'favicon',
        companyLogo: 'companyLogo',
        companyBanner: 'companyBanner'
      };

      for (const [field, fieldName] of Object.entries(fileFields)) {
        if (req.files[field] && req.files[field][0]) {
          // Delete old file if exists
          if (currentSettings && currentSettings[field]) {
            await deleteOldFile(currentSettings[field]);
          }
          updates[field] = `/uploads/company/${req.files[field][0].filename}`;
        }
      }
    }

    const protectedFields = ['_id', 'createdAt', 'updatedAt'];
    protectedFields.forEach(field => delete updates[field]);

    // Update or create a single global settings document
    const settings = await CompanySettings.findOneAndUpdate(
      {},
      { $set: updates },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    const settingsData = settings.toObject();
    const imageFields = ['siteLogo', 'favicon', 'companyLogo', 'companyBanner'];
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    imageFields.forEach(field => {
      if (settingsData[field]) {
        const cleanedPath = settingsData[field].replace(/^[\\/]+/, '');
        settingsData[field] = `${baseUrl}/${cleanedPath.replace(/\\/g, '/')}`;
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Company settings updated successfully',
      data: settingsData
    });

  } catch (err) {
    console.error('Update company settings error:', err);

    if (req.files) {
      for (const fileType in req.files) {
        if (req.files[fileType] && req.files[fileType][0]) {
          const file = req.files[fileType][0];
          const filePath = path.join(__dirname, '../public/uploads/company', file.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Error updating company settings',
      error: err.message
    });
  }
};

// const getBasicDetails = async (req, res) => {
//   try {
//     const userId = req.user || req.query.userId;
//     if (!userId) {
//       return res.status(400).json({ message: 'User ID is required' });
//     }

//     const baseUrl = `${req.protocol}://${req.get('host')}`;

//     const user = await User.findById(userId).lean();
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }

//     let role = null;
//     let permissions = [];
//     if (user.roleId) {
//       role = await Role.findById(user.roleId).lean();
//       if (role && !role.deletedAt) {
//         permissions = await Permission.find({ roleId: role._id, deletedAt: null })
//           .populate('moduleId', 'moduleName moduleSlug status createdAt updatedAt')
//           .lean();
//       }
//     }

//     const [
//       defaultCurrency,
//       companySettings,
//       userLocalization,
//       defaultDateFormat,
//       defaultTimeFormat,
//       defaultTimezone,
//       invoiceTemplate,
//       invoicePrefixSetting,
//       invoiceNumberTypeSetting
//     ] = await Promise.all([
//       Currency.findOne({ isDeleted: false, isDefault: true }).lean(),
//       CompanySettings.findOne({}).sort({ createdAt: -1 }).lean(),
//       Localization.findOne({ isActive: true })
//         .populate('dateFormat timeFormat timezone')
//         .sort({ createdAt: -1 })
//         .lean(),
//       DateFormat.findOne({ isDeleted: false, isActive: true }).sort({ createdAt: 1 }).lean(),
//       TimeFormat.findOne({ isDeleted: false, isActive: true }).sort({ createdAt: 1 }).lean(),
//       Timezone.findOne().sort({ createdAt: 1 }).lean(),
//       InvoiceTemplate.findOne({ userId }).sort({ createdAt: -1 }).lean(),
//       GeneralSetting.findOne({ key: 'invoicePrefix' }).lean(),
//       GeneralSetting.findOne({ key: 'invoiceNumberType' }).lean()
//     ]);

//     const cleanObject = (obj) => {
//       if (!obj) return obj;
//       const { createdAt, updatedAt, isDeleted, __v, ...rest } = obj;
//       return rest;
//     };

//     const defaultValues = {
//       currency: {
//         _id: null,
//         name: "Default Currency",
//         code: "USD",
//         symbol: "$",
//         status: true,
//         isDefault: true,
//         createdBy: null
//       },
//       company: {
//         _id: null,
//         companyLogo: "",
//         companyName: "Default Company",
//         favicon: "",
//         siteLogo: "",
//         email: "contact@default.com",
//         phone: "",
//         city: "",
//         country: "",
//         fax: "",
//         pincode: "",
//         state: "",
//         address: "",
//         companyBanner: ""
//       },
//       dateFormat: {
//         _id: null,
//         title: "DD-MM-YYYY",
//         format: "DD-MM-YYYY",
//         isActive: true
//       },
//       timeFormat: {
//         _id: null,
//         name: "H:i:s",
//         format: "H:i:s",
//         isActive: true
//       },
//       timezone: {
//         _id: null,
//         name: "UTC",
//         utc_offset: "+00:00"
//       },
//       role: {
//         id: null,
//         roleName: "Default Role",
//         status: true
//       },
//       permissions: [],
//       invoiceTemplate: {
//         _id: null,
//         default_invoice_template: "default-template",
//         userId: userId,
//         createdAt: null,
//         updatedAt: null
//       }
//     };

//     // ✅ Apply default values if not set in General Settings
//     const invoicePrefix =
//       invoicePrefixSetting?.value && typeof invoicePrefixSetting.value === 'string'
//         ? invoicePrefixSetting.value
//         : "INV_";

//     const invoiceNumberType =
//       invoiceNumberTypeSetting?.value && typeof invoiceNumberTypeSetting.value === 'string'
//         ? invoiceNumberTypeSetting.value
//         : "auto";

//     // ✅ Process company settings
//     let processedCompanySettings = null;
//     if (companySettings) {
//       processedCompanySettings = cleanObject(companySettings);
//       ['siteLogo', 'favicon', 'companyLogo', 'companyBanner'].forEach(key => {
//         processedCompanySettings[key] = companySettings[key]
//           ? `${baseUrl}${companySettings[key]}`
//           : '';
//       });
//     }

//     const responseData = {
//       currency: cleanObject(defaultCurrency) || defaultValues.currency,
//       company: processedCompanySettings || defaultValues.company,
//       dateFormat: cleanObject(userLocalization?.dateFormat || defaultDateFormat) || defaultValues.dateFormat,
//       timeFormat: cleanObject(userLocalization?.timeFormat || defaultTimeFormat) || defaultValues.timeFormat,
//       timezone: cleanObject(userLocalization?.timezone || defaultTimezone) || defaultValues.timezone,
//       startWeek: userLocalization?.startWeek || "Monday",
//       role: role
//         ? { id: role._id, roleName: role.roleName, status: role.status }
//         : defaultValues.role,
//       permissions: permissions.length
//         ? permissions.map(permission => ({
//           id: permission._id,
//           roleId: permission.roleId?.toString() || null,
//           moduleId: permission.moduleId?._id?.toString() || null,
//           moduleName: permission.moduleId?.moduleName || null,
//           moduleSlug: permission.moduleId?.moduleSlug || null,
//           moduleStatus: permission.moduleId?.status ?? null,
//           moduleCreatedAt: permission.moduleId?.createdAt || null,
//           moduleUpdatedAt: permission.moduleId?.updatedAt || null,
//           create: permission.create,
//           edit: permission.edit,
//           delete: permission.delete,
//           view: permission.view,
//           allowAll: permission.allowAll,
//           deletedAt: permission.deletedAt,
//           createdAt: permission.createdAt,
//           updatedAt: permission.updatedAt
//         }))
//         : defaultValues.permissions,
//       invoiceTemplate: cleanObject(invoiceTemplate) || defaultValues.invoiceTemplate,
//       invoicePrefix,
//       invoiceNumberType
//     };

//     return res.status(200).json({
//       success: true,
//       message: 'Basic details fetched successfully',
//       data: responseData
//     });

//   } catch (error) {
//     console.error('Error fetching basic details:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Server error. Please try again later.',
//       error: error.message
//     });
//   }
// };

const getBasicDetails = async (req, res) => {
  try {
    const userId = req.user || req.query.userId;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // let role = null;
    // let permissions = [];
    // if (user.roleId) {
    //   role = await Role.findById(user.roleId).lean();
    //   if (role && !role.deletedAt) {
    //     permissions = await Permission.find({ roleId: role._id, deletedAt: null })
    //       .populate('moduleId', 'moduleName moduleSlug status createdAt updatedAt')
    //       .lean();
    //   }
    // }

    let role = null;
    let permissions = [];
    if (user.roleId) {
      role = await Role.findById(user.roleId).lean();
      if (role && !role.deletedAt) {
        permissions = await Permission.find({ roleId: role._id, deletedAt: null })
          .populate('moduleId', 'moduleName moduleSlug status createdAt updatedAt')
          .lean();
      }
    }

    // If user is not admin (user_type !== 1), fetch additional permissions granted by admin
    if (user.user_type !== 1) {
      const adminGrantedPermissions = await Permission.find({ 
        userId: user._id, 
        deletedAt: null 
      })
        .populate('moduleId', 'moduleName moduleSlug status createdAt updatedAt')
        .lean();
      
      // Merge role-based permissions with admin-granted permissions
      const mergedPermissions = [...permissions];
      adminGrantedPermissions.forEach(adminPerm => {
        const existingIndex = mergedPermissions.findIndex(p => 
          p.moduleId?._id?.toString() === adminPerm.moduleId?._id?.toString()
        );
        if (existingIndex >= 0) {
          // Merge permissions if module already exists
          mergedPermissions[existingIndex] = {
            ...mergedPermissions[existingIndex],
            create: mergedPermissions[existingIndex].create || adminPerm.create,
            edit: mergedPermissions[existingIndex].edit || adminPerm.edit,
            delete: mergedPermissions[existingIndex].delete || adminPerm.delete,
            view: mergedPermissions[existingIndex].view || adminPerm.view,
            allowAll: mergedPermissions[existingIndex].allowAll || adminPerm.allowAll
          };
        } else {
          // Add new permission if module doesn't exist
          mergedPermissions.push(adminPerm);
        }
      });
      permissions = mergedPermissions;
    }

    const [
      defaultCurrency,
      companySettings,
      userLocalization,
      defaultDateFormat,
      defaultTimeFormat,
      defaultTimezone,
      invoiceTemplate,
      invoicePrefixSetting,
      invoiceNumberTypeSetting
    ] = await Promise.all([
      Currency.findOne({ isDeleted: false, isDefault: true }).lean(),
      CompanySettings.findOne({}).sort({ createdAt: -1 }).lean(),
      Localization.findOne({ isActive: true })
        .populate('dateFormat timeFormat timezone')
        .sort({ createdAt: -1 })
        .lean(),
      DateFormat.findOne({ isDeleted: false, isActive: true }).sort({ createdAt: 1 }).lean(),
      TimeFormat.findOne({ isDeleted: false, isActive: true }).sort({ createdAt: 1 }).lean(),
      Timezone.findOne().sort({ createdAt: 1 }).lean(),
      InvoiceTemplate.findOne({ userId }).sort({ createdAt: -1 }).lean(),
      GeneralSetting.findOne({ key: 'invoicePrefix' }).lean(),
      GeneralSetting.findOne({ key: 'invoiceNumberType' }).lean()
    ]);

    const cleanObject = (obj) => {
      if (!obj) return obj;
      const { createdAt, updatedAt, isDeleted, __v, ...rest } = obj;
      return rest;
    };

    const defaultValues = {
      currency: {
        _id: null,
        name: "Default Currency",
        code: "USD",
        symbol: "$",
        status: true,
        isDefault: true,
        createdBy: null
      },
      company: {
        _id: null,
        companyLogo: "",
        companyName: "Default Company",
        favicon: "",
        siteLogo: "",
        email: "contact@default.com",
        phone: "",
        city: "",
        country: "",
        // fax: "",
        gstin: "",
        udyam: "",
        pincode: "",
        state: "",
        address: "",
        companyBanner: ""
      },
      dateFormat: {
        _id: null,
        title: "DD-MM-YYYY",
        format: "DD-MM-YYYY",
        isActive: true
      },
      timeFormat: {
        _id: null,
        name: "H:i:s",
        format: "H:i:s",
        isActive: true
      },
      timezone: {
        _id: null,
        name: "UTC",
        utc_offset: "+00:00"
      },
      role: {
        id: null,
        roleName: "Default Role",
        status: true
      },
      permissions: [],
      invoiceTemplate: {
        _id: null,
        default_invoice_template: "default-template",
        userId: userId,
        createdAt: null,
        updatedAt: null
      }
    };

    // ✅ Apply default values if not set in General Settings
    const invoicePrefix =
      invoicePrefixSetting?.value && typeof invoicePrefixSetting.value === 'string'
        ? invoicePrefixSetting.value
        : "INV_";

    const invoiceNumberType =
      invoiceNumberTypeSetting?.value && typeof invoiceNumberTypeSetting.value === 'string'
        ? invoiceNumberTypeSetting.value
        : "auto";

    // ✅ Process company settings
    let processedCompanySettings = null;
    if (companySettings) {
      processedCompanySettings = cleanObject(companySettings);
      ['siteLogo', 'favicon', 'companyLogo', 'companyBanner'].forEach(key => {
        processedCompanySettings[key] = companySettings[key]
          ? `${baseUrl}${companySettings[key]}`
          : '';
      });
      
      // 🔍 DEBUG: Verify gstMode is present
      // console.log('Company Settings gstMode:', processedCompanySettings.gstMode);
    }

    const responseData = {
      currency: cleanObject(defaultCurrency) || defaultValues.currency,
      company: processedCompanySettings || defaultValues.company,
      dateFormat: cleanObject(userLocalization?.dateFormat || defaultDateFormat) || defaultValues.dateFormat,
      timeFormat: cleanObject(userLocalization?.timeFormat || defaultTimeFormat) || defaultValues.timeFormat,
      timezone: cleanObject(userLocalization?.timezone || defaultTimezone) || defaultValues.timezone,
      startWeek: userLocalization?.startWeek || "Monday",
      role: role
        ? { id: role._id, roleName: role.roleName, status: role.status }
        : defaultValues.role,
      permissions: permissions.length
        ? permissions.map(permission => ({
          id: permission._id,
          roleId: permission.roleId?.toString() || null,
          moduleId: permission.moduleId?._id?.toString() || null,
          moduleName: permission.moduleId?.moduleName || null,
          moduleSlug: permission.moduleId?.moduleSlug || null,
          moduleStatus: permission.moduleId?.status ?? null,
          moduleCreatedAt: permission.moduleId?.createdAt || null,
          moduleUpdatedAt: permission.moduleId?.updatedAt || null,
          create: permission.create,
          edit: permission.edit,
          delete: permission.delete,
          view: permission.view,
          allowAll: permission.allowAll,
          deletedAt: permission.deletedAt,
          createdAt: permission.createdAt,
          updatedAt: permission.updatedAt
        }))
        : defaultValues.permissions,
      invoiceTemplate: cleanObject(invoiceTemplate) || defaultValues.invoiceTemplate,
      invoicePrefix,
      invoiceNumberType
    };

    return res.status(200).json({
      success: true,
      message: 'Basic details fetched successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching basic details:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
      error: error.message
    });
  }
};

const updateCompanySetup = async (req, res) => {
  try {
    const userId = req.user?._id || req.user;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    const {
      companyName,
      address,
      country,
      state,
      city,
      pincode,
      currencyId,
      timezoneId,
      dateFormatId,
      // timeFormatId
    } = req.body;

    // Validation
    if (!companyName || !country || !state || !city) {
      return res.status(400).json({
        success: false,
        message: 'Company Name, Country, State, and City are required.'
      });
    }

    console.log('Starting company setup update for user:', userId);

    // Validate references
    const validationPromises = [];
    if (currencyId) validationPromises.push(Currency.findById(currencyId));
    if (timezoneId) validationPromises.push(Timezone.findById(timezoneId));
    if (dateFormatId) validationPromises.push(DateFormat.findById(dateFormatId));

    const [currency, timezone, dateFormat, timeFormat] = await Promise.all(validationPromises);

    // Validate found references
    if (currencyId && !currency) {
      throw new Error('Invalid Currency selected.');
    }
    if (timezoneId && !timezone) {
      throw new Error('Invalid Timezone selected.');
    }
    if (dateFormatId && !dateFormat) {
      throw new Error('Invalid Date Format selected.');
    }

    // Handle file upload
    let companyLogoUrl = null;
    if (req.file) {
      companyLogoUrl = `/uploads/company/${req.file.filename}`;
      console.log('Company logo uploaded:', companyLogoUrl);
    }

    // Update or create company settings
    let companySettings = await CompanySettings.findOne({ userId });

    if (companySettings) {
      console.log('Updating existing company settings');

      // Delete old logo if new one is uploaded
      if (companyLogoUrl && companySettings.siteLogo) {
        await deleteOldFile(companySettings.siteLogo);
      }

      companySettings.companyName = companyName;
      companySettings.address = address || companySettings.address;
      companySettings.country = country;
      companySettings.state = state;
      companySettings.city = city;
      companySettings.pincode = pincode;
      if (companyLogoUrl) {
        companySettings.siteLogo = companyLogoUrl;
      }

      await companySettings.save();
    } else {
      console.log('Creating new company settings');
      companySettings = new CompanySettings({
        companyName,
        email: user.email || 'info@example.com',
        phone: user.phone || '9876543212',
        address: address || '',
        country,
        state,
        city,
        pincode: pincode || '',
        siteLogo: companyLogoUrl,
        userId
      });

      await companySettings.save();
    }

    // Update or create localization
    let localization = await Localization.findOne({ user: userId, isActive: true });
    //fetch 1st active timeformat
    let timeFormatId = (await TimeFormat.findOne({ isActive: true }))?._id || null;
    if (localization) {
      console.log('Updating existing localization');
      if (timezoneId) localization.timezone = timezoneId;
      if (dateFormatId) localization.dateFormat = dateFormatId;
      await localization.save();
    } else if (timezoneId || dateFormatId) {
      console.log('Creating new localization');
      localization = new Localization({
        user: userId,
        timezone: timezoneId,
        dateFormat: dateFormatId,
        timeFormat: timeFormatId,
        startWeek: 'Monday',
        isActive: true
      });
      await localization.save();
    }

    // Update default currency if needed
    if (currencyId && currency) {
      console.log('Updating default currency to:', currencyId);

      // Remove default from all currencies first
      await Currency.updateMany(
        { isDefault: true },
        { $set: { isDefault: false } }
      );

      // Set new default
      await Currency.findByIdAndUpdate(
        currencyId,
        { $set: { isDefault: true } }
      );
    }

    console.log('Company setup completed successfully');

    // Prepare response
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const responseData = {
      companySettings: {
        ...companySettings.toObject(),
        companyLogo: companySettings.companyLogo
          ? `${baseUrl}${companySettings.companyLogo}`
          : null
      },
      localization: localization ? {
        timezone: localization.timezone,
        dateFormat: localization.dateFormat,
        timeFormat: localization.timeFormat
      } : null,
      currency: currency ? {
        _id: currency._id,
        name: currency.name,
        code: currency.code,
        symbol: currency.symbol,
        isDefault: currency.isDefault
      } : null
    };

    return res.status(200).json({
      success: true,
      message: 'Company setup updated successfully',
      data: responseData
    });

  } catch (err) {
    console.error('Error updating company setup:', err);

    // Clean up uploaded file if error occurred
    if (req.file) {
      try {
        const filePath = path.join(__dirname, '../public/uploads/company', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('Cleaned up uploaded file due to error');
        }
      } catch (fileError) {
        console.error('Error cleaning up file:', fileError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update company setup',
      error: err.message
    });
  }
};


module.exports = {
  getCompanySettings,
  updateCompanySettings,
  getBasicDetails,
  updateCompanySetup,
  createOrUpdateGeneralSetting,
  listGeneralSettings
};
