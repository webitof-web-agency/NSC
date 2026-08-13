const User = require('@models/User');
const CompanySettings = require('@models/CompanySettings');
const APP_VERSION = process.env.APP_VERSION || '1.0.4';

exports.getAppVersionStatus = async (req, res) => {
    try {
        // Check if admin user exists
        const adminUserExists = await User.exists({ user_type: 1 });

        // Check if company settings have been configured
        const companySettingsExists = await CompanySettings.exists({});

        // new_register: true  = no admin user → show registration page
        // new_register: false = admin exists → show login or dashboard
        const isNewRegister = !adminUserExists;

        // company_settings: true  = company setup NOT done → show /setup page
        // company_settings: false = company setup DONE → show login/dashboard
        // Company setup is done when a CompanySettings document exists in the DB
        const needsCompanySetup = !companySettingsExists;

        res.status(200).json({
            success: true,
            message: "App version fetched successfully",
            data: {
                version: APP_VERSION,
                new_register: isNewRegister,
                company_settings: needsCompanySetup
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

