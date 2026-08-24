const User = require('@models/User');
const CompanySettings = require('@models/CompanySettings');
const APP_VERSION = process.env.APP_VERSION || '1.0.4';

exports.getAppVersionStatus = async (req, res) => {
    try {
        const companySettingsExists = await CompanySettings.exists({});
        const hasCompanySettings = !companySettingsExists; // true if no company settings exist

        const newRegisterExists = await User.exists({ user_type: 1 });
        const isNewRegister = !newRegisterExists; // true if no user exists

        res.status(200).json({
            success: true,
            message: "App version fetched successfully",
            data: {
                version: APP_VERSION,
                new_register: isNewRegister,
                company_settings: hasCompanySettings
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
