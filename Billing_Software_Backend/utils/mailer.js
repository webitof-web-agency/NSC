// utils/mailer.js
const nodemailer = require("nodemailer");

const createTransporter = () => {
    const port = Number(process.env.SMTP_PORT || 465);
    let secure = String(process.env.SMTP_SECURE || (port === 465 ? "true" : "false")) === "true";

    if (port === 587) {
        secure = false;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port,
        secure,
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });
};

const sendMail = async (options) => {
    const transporter = createTransporter();
    return await transporter.sendMail(options);
};

module.exports = { sendMail };
