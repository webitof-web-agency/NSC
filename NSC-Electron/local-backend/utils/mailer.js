// utils/mailer.js
const nodemailer = require("nodemailer");

const createTransporter = () => {
    return nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
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
