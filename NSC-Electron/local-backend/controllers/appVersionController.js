const User = require('@models/User');
const CompanySettings = require('@models/CompanySettings');
const APP_VERSION = process.env.APP_VERSION || '1.0.4';

exports.getAppVersionStatus = async (req, res) => {
    try {
        // In local embedded backend for desktop billing, we never force
        // initial admin registration or setup wizard locally.
        res.status(200).json({
            success: true,
            message: "App version fetched successfully",
            data: {
                version: APP_VERSION,
                new_register: false,
                company_settings: false
            }
        });
    } catch (error) {
        console.error("App version check error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};
