const Permission = require('@models/Permission');
const Role = require('@models/Role');
const Module = require('@models/Module');

// -----------------------------
// Create or Update Permissions
// -----------------------------
const createOrUpdatePermissions = async (req, res) => {
    try {
        const { roleId, permissions } = req.body;

        // Validate role existence
        const role = await Role.findById(roleId);
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        if (!Array.isArray(permissions) || permissions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Permissions array is required'
            });
        }

        const updatedPermissions = [];

        for (const perm of permissions) {
            if (!perm.moduleId) {
                return res.status(400).json({
                    success: false,
                    message: 'Each permission must have a moduleId'
                });
            }

            // Check if permission already exists
            const existingPermission = await Permission.findOne({
                roleId,
                moduleId: perm.moduleId,
                deletedAt: null
            });

            if (existingPermission) {
                // Update existing permission
                existingPermission.create = perm.create || false;
                existingPermission.edit = perm.edit || false;
                existingPermission.delete = perm.delete || false;
                existingPermission.view = perm.view || false;
                existingPermission.allowAll = perm.allowAll || false;

                await existingPermission.save();
                updatedPermissions.push(existingPermission);
            } else {
                // Create new permission
                const newPermission = new Permission({
                    roleId,
                    moduleId: perm.moduleId,
                    create: perm.create || false,
                    edit: perm.edit || false,
                    delete: perm.delete || false,
                    view: perm.view || false,
                    allowAll: perm.allowAll || false
                });

                await newPermission.save();
                updatedPermissions.push(newPermission);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Permissions created or updated successfully',
            data: updatedPermissions
        });
    } catch (err) {
        console.error('Error in createOrUpdatePermissions:', err);
        res.status(500).json({
            success: false,
            message: 'Error creating/updating permissions',
            error: err.message
        });
    }
};

const getPermissionsByRole = async (req, res) => {
    try {
        const { roleId } = req.params;

        // Fetch role and validate existence
        const role = await Role.findOne({ _id: roleId, deletedAt: null }).lean();
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found or has been deleted'
            });
        }

        // Fetch permissions with module details
        const permissions = await Permission.find({ roleId, deletedAt: null })
            .populate('moduleId', 'moduleName status createdAt updatedAt')
            .lean();

        return res.status(200).json({
            success: true,
            message: 'Permissions fetched successfully',
            data: {
                roleId: role._id,
                roleName: role.roleName, // Added role name
                permissions
            }
        });
    } catch (err) {
        console.error('Error fetching permissions:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching permissions',
            error: err.message
        });
    }
};

const getModuleHierarchy = async (req, res) => {
  try {
    const modules = await Module.find({ deletedAt: null }).lean();

    const moduleMap = {};
    modules.forEach(mod => {
      moduleMap[mod._id] = { ...mod, children: [] };
    });

    const hierarchy = [];
    modules.forEach(mod => {
      if (mod.parentId) {
        if (moduleMap[mod.parentId]) {
          moduleMap[mod.parentId].children.push(moduleMap[mod._id]);
        }
      } else {
        hierarchy.push(moduleMap[mod._id]);
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Modules fetched successfully',
      data: hierarchy
    });

  } catch (error) {
    console.error('Error fetching module hierarchy:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching modules',
      error: error.message
    });
  }
};


module.exports = {
    createOrUpdatePermissions,
    getModuleHierarchy,
    getPermissionsByRole
};
