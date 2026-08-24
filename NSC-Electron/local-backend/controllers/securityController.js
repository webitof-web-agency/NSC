const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('@models/User');
const CompanySettings = require('@models/CompanySettings');
const LoginActivity = require('@models/LoginActivity');

const resetPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Old password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (err) {
    console.error('Password reset error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: err.message
    });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }


    if (user.profileImage) {
      const profileImagePath = path.join(__dirname, '../public', user.profileImage);
      if (fs.existsSync(profileImagePath)) {
        fs.unlinkSync(profileImagePath);
      }
    }

    await User.deleteOne({ _id: userId });

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (err) {
    console.error('Delete account error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error deleting account',
      error: err.message
    });
  }
};

const getLoginActivitiesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query; // Default page=1, limit=10

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Get total count of activities for the user
    const total = await LoginActivity.countDocuments({ user: userId });

    // Fetch paginated login activities
    const activities = await LoginActivity.find({ user: userId })
      .sort({ loginAt: -1 }) // Most recent first
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'firstName lastName email');

    if (!activities.length) {
      return res.status(404).json({
        success: false,
        message: 'No login activities found for this user',
      });
    }

    // Send paginated response
    res.status(200).json({
      success: true,
      message: 'Login activities fetched successfully',
      data: activities,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching login activities:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching login activities',
      error: err.message,
    });
  }
};

module.exports = {
  resetPassword,
  deleteAccount,
  getLoginActivitiesByUser
};
