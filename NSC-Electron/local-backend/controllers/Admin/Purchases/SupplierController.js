const mongoose = require('mongoose');
const User = require('@models/User');
const Supplier = require('@models/Supplier');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

//create
// const createSupplier = async (req, res) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const {
//             supplier_name,
//             supplier_email,
//             supplier_phone,
//             balance = 0,
//             balance_type,
//             firstName,
//             lastName,
//             password,
//             gender,
//             dateOfBirth,
//             address,
//             country,
//             state,
//             city,
//             postalCode
//         } = req.body;

//         const profileImage = req.file ? req.file.path : undefined;

//         const nameParts = supplier_name.split(' ');
//         const defaultFirstName = nameParts[0] || '';
//         const defaultLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

//         // Create supplier user
//         const user = new User({
//             firstName: firstName || defaultFirstName,
//             lastName: lastName || defaultLastName,
//             email: supplier_email,
//             phone: supplier_phone,
//             password: password || 'defaultPassword123',
//             user_type: 2, // Supplier
//             balance: Number(balance),
//             balance_type: balance == 0 ? null : (balance_type || 'credit'),
//             gender,
//             dateOfBirth,
//             address,
//             country,
//             state,
//             city,
//             postalCode,
//             profileImage
//         });

//         await user.save({ session });

//         // ✅ Commit the transaction
//         await session.commitTransaction();
//         session.endSession();

//         res.status(201).json({
//             success: true,
//             message: 'Supplier created successfully',
//             data: {
//                 id: user._id,
//                 supplier_name: `${user.firstName} ${user.lastName}`,
//                 supplier_email: user.email,
//                 supplier_phone: user.phone,
//                 balance: user.balance,
//                 balance_type: user.balance_type,
//                 profileImage: user.profileImage
//                     ? `${req.protocol}://${req.get('host')}/${user.profileImage.replace(/\\/g, '/')}`
//                     : null
//             }
//         });
//     } catch (err) {
//         await session.abortTransaction();
//         session.endSession();

//         if (req.file && req.file.path) {
//             try {
//                 fs.unlinkSync(req.file.path);
//             } catch (fileErr) {
//                 console.error('Error cleaning up profile image:', fileErr);
//             }
//         }

//         console.error('Supplier creation error:', err);
//         res.status(500).json({
//             success: false,
//             message: 'Error creating supplier user',
//             error: err.message
//         });
//     }
// };

// const createSupplier = async (req, res) => {
//   try {
//     const {
//       supplier_name,
//       supplier_email,
//       supplier_phone,
//       balance = 0,
//       balance_type,
//       firstName,
//       lastName,
//       password,
//       gender,
//       dateOfBirth,
//       address,
//       country,
//       state,
//       city,
//       postalCode
//     } = req.body;

//     const profileImage = req.file ? req.file.path : undefined;

//     const nameParts = supplier_name.split(" ");
//     const defaultFirstName = nameParts[0] || "";
//     const defaultLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

//     // Create User first
//     const user = await User.create({
//       firstName: firstName || defaultFirstName,
//       lastName: lastName || defaultLastName,
//       email: supplier_email,
//       phone: supplier_phone,
//       password: password || "defaultPassword123",
//       user_type: 2,
//       balance: Number(balance),
//       balance_type: balance == 0 ? null : (balance_type || "credit"),
//       gender,
//       dateOfBirth,
//       address,
//       country,
//       state,
//       city,
//       postalCode,
//       profileImage
//     });

//     // Create Supplier linked with User
//     const supplier = await Supplier.create({
//       user_id: user._id,
//       supplier_name,
//       supplier_email,
//       supplier_phone,
//       balance: Number(balance),
//       balance_type: balance == 0 ? null : balance_type
//     });

//     res.status(201).json({
//       success: true,
//       message: "Supplier created successfully",
//       data: supplier
//     });

//   } catch (err) {
//     // Remove uploaded file if failed
//     if (req.file && req.file.path) {
//       try {
//         fs.unlinkSync(req.file.path);
//       } catch (cleanupErr) {
//         console.error("Error cleaning image:", cleanupErr);
//       }
//     }

//     console.error("Supplier creation error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Error creating supplier",
//       error: err.message
//     });
//   }
// };

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
    const defaultLastName = lastName || "Supplier";

    // ============================
    // GENERATE PLACEHOLDER EMAIL IF NOT PROVIDED
    // ============================
    let userEmail = email;
    if (!email || email.trim() === '') {
      // Generate unique placeholder email using phone number or timestamp
      const uniqueId = phone_number || Date.now();
      userEmail = `supplier_${uniqueId}@placeholder.local`;
    }

    // ============================
    // CREATE USER
    // ============================
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

    // ============================
    // CREATE SUPPLIER
    // ============================
    const supplier = await Supplier.create({
      user_id: user._id,

      company_name,
      email,
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
      data: supplier,
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

//list
// const listSuppliers = async (req, res) => {
//     try {
//         const { page = 1, limit = 10, search = '' } = req.query;

//         // Build search query
//         const searchQuery = {
//             user_type: 2, // Only suppliers
//             $or: [
//                 { firstName: { $regex: search, $options: 'i' } },
//                 { lastName: { $regex: search, $options: 'i' } },
//                 { email: { $regex: search, $options: 'i' } },
//                 { phone: { $regex: search, $options: 'i' } },
//                 { address: { $regex: search, $options: 'i' } }
//             ]
//         };

//         // Get total count for pagination
//         const total = await User.countDocuments(searchQuery);

//         // Get paginated results
//         const users = await User.find(searchQuery)
//             .select('-password -__v') // Exclude sensitive fields
//             .sort({ createdAt: -1 }) // Sort by newest first
//             .skip((page - 1) * limit)
//             .limit(Number(limit));

//         // Transform the data to match your desired format
//         const suppliers = users.map(user => ({
//             id: user._id, // Include the user ID
//             supplier_name: `${user.firstName} ${user.lastName}`,
//             supplier_email: user.email,
//             supplier_phone: user.phone,
//             balance: user.balance,
//             balance_type: user.balance_type,
//             profileImage: user.profileImage
//                 ? `${req.protocol}://${req.get('host')}/${user.profileImage}`
//                 : `${req.protocol}://${req.get('host')}/uploads/default-profile.jpg`,
//             address: user.address,
//             country: user.country,
//             state: user.state,
//             city: user.city,
//             postalCode: user.postalCode,
//             createdAt: user.createdAt,
//             updatedAt: user.updatedAt
//         }));

//         res.status(200).json({
//             message: 'Suppliers fetched successfully',
//             data: {
//                 suppliers,
//                 pagination: {
//                     total,
//                     page: Number(page),
//                     limit: Number(limit),
//                     totalPages: Math.ceil(total / limit)
//                 }
//             }
//         });
//     } catch (err) {
//         res.status(500).json({
//             message: 'Error fetching suppliers',
//             error: err.message
//         });
//     }
// }

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
      email: supplier.email,
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

// Update supplier
// const updateSupplier = async (req, res) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const { id } = req.params;
//         let updates = req.body;

//         // Get existing supplier inside transaction
//         const existingUser = await User.findOne({ _id: id, user_type: 2 }).session(session);

//         if (!existingUser) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(404).json({ message: "Supplier not found" });
//         }

//         if (updates.profile_image_removed === "true") {
//             try {
//                 if (existingUser.profileImage) {
//                     const fullPath = path.join(process.cwd(), existingUser.profileImage);
//                     if (fs.existsSync(fullPath)) {
//                         fs.unlinkSync(fullPath);
//                     }
//                 }
//                 updates.profileImage = null;
//             } catch (err) {
//                 console.error('Error removing profile image:', err);
//             }
//             delete updates.profile_image_removed;
//         }

//         if (req.file) {
//             if (existingUser.profileImage) {
//                 try {
//                     const fullPath = path.join(process.cwd(), existingUser.profileImage);
//                     if (fs.existsSync(fullPath)) {
//                         fs.unlinkSync(fullPath);
//                     }
//                 } catch (err) {
//                     console.error('Error deleting old profile image:', err);
//                 }
//             }
//             updates.profileImage = req.file.path;
//         }

//         const restrictedFields = ['user_type', 'email', '_id', 'password'];
//         restrictedFields.forEach(field => {
//             if (updates[field]) {
//                 delete updates[field];
//             }
//         });

//         if (updates.supplier_name) {
//             const names = updates.supplier_name.split(' ');
//             updates.firstName = names[0] || existingUser.firstName;
//             updates.lastName = names.length > 1 ? names.slice(1).join(' ') : existingUser.lastName;
//             delete updates.supplier_name;
//         }

//         const updatedUser = await User.findOneAndUpdate(
//             { _id: id, user_type: 2 },
//             updates,
//             { new: true, runValidators: true, session }
//         ).select('-password -__v');

//         if (!updatedUser) {
//             if (req.file && fs.existsSync(req.file.path)) {
//                 fs.unlinkSync(req.file.path);
//             }
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(404).json({ message: "Supplier not found or update failed" });
//         }

//         // Commit transaction
//         await session.commitTransaction();
//         session.endSession();

//         res.status(200).json({
//             message: 'Supplier updated successfully',
//             data: {
//                 id: updatedUser._id,
//                 supplier_name: `${updatedUser.firstName} ${updatedUser.lastName}`,
//                 supplier_email: updatedUser.email,
//                 supplier_phone: updatedUser.phone,
//                 balance: updatedUser.balance,
//                 balance_type: updatedUser.balance_type,
//                 profileImage: updatedUser.profileImage
//                     ? `${req.protocol}://${req.get('host')}/${updatedUser.profileImage.replace(/\\/g, '/')}`
//                     : null
//             }
//         });

//     } catch (err) {
//         await session.abortTransaction();
//         session.endSession();

//         if (req.file && fs.existsSync(req.file.path)) {
//             try {
//                 fs.unlinkSync(req.file.path);
//             } catch (fileErr) {
//                 console.error('Error cleaning up uploaded file:', fileErr);
//             }
//         }

//         console.error('Supplier update error:', err);
//         res.status(500).json({
//             message: 'Error updating supplier',
//             error: err.message
//         });
//     }
// };

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

    // ----------------------------------
    // Email uniqueness check
    // ----------------------------------
    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({
        email: req.body.email,
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
    user.email = req.body.email ?? user.email;
    user.phone = req.body.phone_number ?? user.phone;
    user.firstName = req.body.company_name ?? user.firstName;
    user.lastName = "Supplier";

    await user.save();

    // ----------------------------------
    // Update SUPPLIER
    // ----------------------------------
    supplier.company_name = req.body.company_name ?? supplier.company_name;
    supplier.email = req.body.email ?? supplier.email;
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
        email: supplier.email,
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

// const updateSupplier = async (req, res) => {
//   try {
//     const { id } = req.params;
//     let updates = req.body;

//     // find user first
//     const existingUser = await User.findOne({ _id: id, user_type: 2 });

//     if (!existingUser) {
//       return res.status(404).json({ message: "Supplier not found" });
//     }

//     // Handle profile image removal
//     if (updates.profile_image_removed === "true") {
//       try {
//         if (existingUser.profileImage) {
//           const fullPath = path.join(process.cwd(), existingUser.profileImage);
//           if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
//         }
//         updates.profileImage = null;
//       } catch (err) {
//         console.error("Error removing profile image:", err);
//       }
//       delete updates.profile_image_removed;
//     }

//     // Handle image upload
//     if (req.file) {
//       if (existingUser.profileImage) {
//         try {
//           const fullPath = path.join(process.cwd(), existingUser.profileImage);
//           if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
//         } catch (err) {
//           console.error("Error deleting old profile image:", err);
//         }
//       }
//       updates.profileImage = req.file.path;
//     }

//     // Map supplier_email → email
//     if (updates.supplier_email) {
//       updates.email = updates.supplier_email;
//       delete updates.supplier_email;
//     }

//     // Remove restricted fields
//     const restrictedFields = ["user_type", "_id", "password"];
//     restrictedFields.forEach((field) => delete updates[field]);

//     // Check email uniqueness
//     if (updates.email && updates.email !== existingUser.email) {
//       const emailExists = await User.findOne({
//         email: updates.email,
//         _id: { $ne: id }
//       });

//       if (emailExists) {
//         return res.status(400).json({
//           message: "Email already exists"
//         });
//       }
//     }

//     // Convert supplier_name into firstName / lastName
//     if (updates.supplier_name) {
//       const parts = updates.supplier_name.split(" ");
//       updates.firstName = parts[0] || existingUser.firstName;
//       updates.lastName = parts.length > 1 ? parts.slice(1).join(" ") : existingUser.lastName;
//       delete updates.supplier_name;
//     }

//     // Update USER collection
//     const updatedUser = await User.findOneAndUpdate(
//       { _id: id, user_type: 2 },
//       updates,
//       { new: true, runValidators: true }
//     ).select("-password -__v");

//     if (!updatedUser) {
//       return res.status(404).json({ message: "Supplier not found or update failed" });
//     }

//     // Update SUPPLIER collection as well
//     await Supplier.findOneAndUpdate(
//       { user_id: id },
//       {
//         supplier_name: `${updatedUser.firstName} ${updatedUser.lastName}`,
//         supplier_email: updatedUser.email,
//         supplier_phone: updatedUser.phone,
//         balance: updatedUser.balance,
//         balance_type: updatedUser.balance_type
//       },
//       { new: true }
//     );

//     res.status(200).json({
//       message: "Supplier updated successfully",
//       data: {
//         id: updatedUser._id,
//         supplier_name: `${updatedUser.firstName} ${updatedUser.lastName}`,
//         supplier_email: updatedUser.email,
//         supplier_phone: updatedUser.phone,
//         balance: updatedUser.balance,
//         balance_type: updatedUser.balance_type,
//         profileImage: updatedUser.profileImage
//           ? `${req.protocol}://${req.get("host")}/${updatedUser.profileImage.replace(/\\/g, "/")}`
//           : null
//       }
//     });

//   } catch (err) {
//     if (req.file && fs.existsSync(req.file.path)) {
//       try {
//         fs.unlinkSync(req.file.path);
//       } catch (fileErr) {
//         console.error("Error cleaning up uploaded file:", fileErr);
//       }
//     }

//     console.error("Supplier update error:", err);
//     res.status(500).json({
//       message: "Error updating supplier",
//       error: err.message
//     });
//   }
// };

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
        email: supplier.email,
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

// const getSupplierByUserId = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // const user = await User.findOne({ _id: id, user_type: 2 })
//     //   .select("firstName lastName email phone profileImage");

//     const user = await User.findById(id)
//     .select('-password -__v'); // Exclude sensitive fields
    

//     if (!user) {
//       return res.status(404).json({ message: "Supplier user not found" });
//     }

//     const supplier = await Supplier.findOne({ user_id: id })
//       .select("company_address city state pin_code");

//     res.status(200).json({
//       success: true,
//       data: {
//         id: user._id,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         email: user.email,
//         phone: user.phone,
//         profileImage: user.profileImage
//           ? `${req.protocol}://${req.get("host")}/${user.profileImage}`
//           : null,

//         company_address: supplier?.company_address || "",
//         city: supplier?.city || "",
//         state: supplier?.state || "",
//         pin_code: supplier?.pin_code || "",
//       },
//     });
//   } catch (err) {
//     res.status(500).json({
//       message: "Error fetching supplier details",
//       error: err.message,
//     });
//   }
// };

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
                email: supplier.email || '',
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
                 if(header) {
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
    exportSuppliers
};
