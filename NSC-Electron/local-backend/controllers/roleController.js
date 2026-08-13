const Role = require('@models/Role');
const mongoose = require('mongoose');
const User = require('@models/User');

const createRole = async (req, res) => {
    try {
        const { roleName, status = true } = req.body;
        const userId = req.user;

        // Collect validation errors
        const errors = {};

        // Validate roleName
        if (!roleName || !roleName.trim()) {
            errors.roleName = 'Role name is required';
        }

        // Validate user existence
        const user = await User.findById(userId);
        if (!user) {
            return res.status(422).json({
                message: "Validation failed",
                errors: { user: "User not found" },
            });
        }

        if (!errors.roleName) {
            const existingRole = await Role.findOne({
                roleName: roleName.trim(),
                deletedAt: null // ignore roles that have been soft-deleted
            });
            if (existingRole) {
                errors.roleName = 'Role name already exists';
            }
        }

        // If any validation errors exist, return 422
        if (Object.keys(errors).length > 0) {
            return res.status(422).json({
                message: "Validation failed",
                errors,
            });
        }

        // Create new role
        const role = new Role({
            roleName: roleName.trim(),
            status,
            createdBy: userId
        });

        await role.save();

        return res.status(201).json({
            success: true,
            message: 'Role created successfully',
            data: {
                id: role._id,
                roleName: role.roleName,
                status: role.status,
                createdBy: role.createdBy,
                createdAt: role.createdAt
            }
        });

    } catch (err) {
        console.error('Role creation error:', err);
        return res.status(500).json({
            success: false,
            message: 'Error creating role',
            error: err.message
        });
    }
};

const getRoles = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            search = '', 
            status 
        } = req.query;

        const query = { deletedAt: null };

        if (search) {
            query.roleName = { 
                $regex: search, 
                $options: 'i'
            };
        }

        if (status !== undefined) {
            query.status = status === 'true';
        }

        const total = await Role.countDocuments(query);

        const roles = await Role.find(query)
            .sort({ roleName: 1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const formattedRoles = roles.map(role => ({
            id: role._id,
            roleName: role.roleName,
            status: role.status,
            createdBy: role.createdBy || null,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt
        }));

        res.status(200).json({
            success: true,
            message: 'Roles fetched successfully',
            data: {
                roles: formattedRoles,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (err) {
        console.error('Error fetching roles:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching roles',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};

const listUsersByRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { search = '' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role ID format'
      });
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    const filter = { roleId };

    if (search.trim() !== '') {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const query = User.find(filter)
      .populate('roleId', 'roleName')
      .select('firstName lastName email phone profileImage balance balance_type createdAt');

    if (search.trim() !== '') {
      query.limit(10);
    }

    const users = await query.sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      role: {
        id: role._id,
        name: role.roleName
      },
      data: users
    });

  } catch (err) {
    console.error('Error listing users by role:', err);
    return res.status(500).json({
      success: false,
      message: 'Error listing users by role',
      error: err.message
    });
  }
};


const getAllRoles = async (req, res) => {
    try {
        const { search = '', status } = req.query;

        const query = { deletedAt: null };

        if (search) {
            query.roleName = { $regex: search, $options: 'i' };
        }

        if (status !== undefined) {
            query.status = status === 'true';
        }

        const roles = await Role.find(query).sort({ roleName: 1 });

        const formattedRoles = roles.map(role => ({
            id: role._id,
            roleName: role.roleName,
            status: role.status,
            createdBy: role.createdBy || null,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt
        }));

        res.status(200).json({
            success: true,
            message: 'All roles fetched successfully',
            data: formattedRoles
        });

    } catch (err) {
        console.error('Error fetching roles:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching roles',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};

const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { roleName, status } = req.body;

        // Find role by ID
        const role = await Role.findById(id);
        if (!role || role.deletedAt) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Validate and check duplicate role name
        if (roleName) {
            if (!roleName.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Role name is required'
                });
            }

            // Check for duplicate roleName ignoring soft-deleted roles
            const existingRole = await Role.findOne({ 
                roleName: roleName.trim(),
                deletedAt: null, // ignore soft-deleted roles
                _id: { $ne: id } // exclude current role from duplicate check
            });

            if (existingRole) {
                return res.status(400).json({
                    success: false,
                    message: 'Role name already exists'
                });
            }

            role.roleName = roleName.trim();
        }

        // Update status if provided
        if (status !== undefined) {
            role.status = status;
        }

        // Update timestamp
        role.updatedAt = new Date();

        // Save updates
        await role.save();

        res.status(200).json({
            success: true,
            message: 'Role updated successfully',
            data: {
                id: role._id,
                roleName: role.roleName,
                status: role.status,
                createdBy: role.createdBy,
                createdAt: role.createdAt,
                updatedAt: role.updatedAt
            }
        });
    } catch (err) {
        console.error('Error updating role:', err);
        res.status(500).json({
            success: false,
            message: 'Error updating role',
            error: err.message
        });
    }
};

const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        const role = await Role.findById(id);
        if (!role || role.deletedAt) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        role.deletedAt = new Date();
        await role.save();

        res.status(200).json({
            success: true,
            message: 'Role deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting role:', err);
        res.status(500).json({
            success: false,
            message: 'Error deleting role',
            error: err.message
        });
    }
};

module.exports = {
    createRole,
    getRoles,
    getAllRoles,
    updateRole,
    deleteRole,
    listUsersByRole
};
