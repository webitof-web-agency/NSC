// FIXED: Removed require('dotenv').config() to prevent reload in production
// FIXED: Removed initializeCron() auto-execution to prevent MongoDB connection conflicts
const mongoose = require('mongoose');
const cron = require('node-cron');
const Quotation = require('./models/Quotation');
const Reminder = require('./models/Reminder');
const Customer = require('./models/Customer');
const User = require('./models/User');
const { sendMail } = require('./utils/mailer');
const { replacePlaceholders, replaceSubjectPlaceholders } = require('./utils/placeholderHelper');

/**
 * Calculate target date for reminders
 */
const calculateTargetDate = (referenceDate, days, timing) => {
  const targetDate = new Date(referenceDate);
  if (timing === 'before') {
    targetDate.setDate(targetDate.getDate() - days);
  } else {
    targetDate.setDate(targetDate.getDate() + days);
  }
  return targetDate;
};

/**
 * Send reminder email for quotation
 */
const sendQuotationReminderEmail = async (reminder, quotation, customer) => {
  try {
    if (!customer?.email) {
      console.log(`Skipping quotation ${quotation.quotationId} - No customer email`);
      return;
    }

    // Populate references if not populated
    if (!quotation.customerId || typeof quotation.customerId === 'string') {
      await quotation.populate('customerId', 'name email');
    }
    if (!quotation.billTo || typeof quotation.billTo === 'string') {
      await quotation.populate('billTo', 'name email');
    }
    if (!quotation.userId || typeof quotation.userId === 'string') {
      await quotation.populate('userId', 'firstName lastName email');
    }
    if (!quotation.billFrom || typeof quotation.billFrom === 'string') {
      await quotation.populate('billFrom', 'firstName lastName email');
    }

    // Replace placeholders
    const subject = await replaceSubjectPlaceholders(reminder.emailConfig.subject, quotation);
    const body = await replacePlaceholders(reminder.emailConfig.body, quotation);

    // Email options
    const mailOptions = {
      from: reminder.emailConfig.fromEmail || process.env.SMTP_EMAIL,
      to: customer.email,
      cc: reminder.emailConfig.cc,
      bcc: reminder.emailConfig.bcc,
      subject: subject,
      html: body
    };

    // Send mail
    await sendMail(mailOptions);
    console.log(`Quotation reminder sent successfully for ${quotation.quotationId} to ${customer.email}`);

    reminder.lastSent = new Date();
    await reminder.save();

  } catch (err) {
    console.error(`Error sending quotation reminder for ${quotation.quotationId}:`, err.message);
  }
};

/**
 * Check if quotation matches reminder criteria
 */
const quotationMatchesCriteria = async (quotation, reminder) => {
  // Skip deleted or converted quotations
  if (quotation.isDeleted || quotation.convert_type !== 'quotation') {
    return false;
  }

  // Determine reference date
  let referenceDate;
  switch (reminder.remindEvent) {
    case 'quotation_date':
      referenceDate = quotation.quotationDate;
      break;
    case 'expiry_date':
      referenceDate = quotation.expiryDate;
      break;
    default:
      return false;
  }

  if (!referenceDate) return false;

  // Calculate target date
  const targetDate = calculateTargetDate(referenceDate, reminder.remindDays, reminder.remindTiming);

  // Compare with today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  return today.getTime() === target.getTime();
};

/**
 * Main quotation reminder cron logic
 */
const runQuotationReminderCron = async () => {
  console.log(`Running quotation reminder cron at ${new Date().toISOString()}`);

  try {
    // Fetch all active automatic reminders for quotations
    const reminders = await Reminder.find({
      type: { $in: ['automatic', 'automatic_Purchase'] },
      isEnabled: true,
      status: 'active'
    });

    if (reminders.length === 0) {
      console.log('No active automatic quotation reminders found');
      return;
    }

    console.log(`Found ${reminders.length} active quotation reminder(s)`);

    for (const reminder of reminders) {
      try {
        // Fetch quotations matching possible reminder conditions
        const quotations = await Quotation.find({
          isDeleted: false,
          status: { $in: ['draft', 'sent', 'accepted', 'declined'] }
        })
        .populate('customerId', 'name email')
        .populate('billTo', 'name email')
        .populate('userId', 'firstName lastName email')
        .populate('billFrom', 'firstName lastName email');

        console.log(`Processing reminder "${reminder.name}" - Found ${quotations.length} quotations`);

        // Filter quotations that match reminder date
        const matchingQuotations = [];
        for (const quotation of quotations) {
          const match = await quotationMatchesCriteria(quotation, reminder);
          if (match) matchingQuotations.push(quotation);
        }

        console.log(`Found ${matchingQuotations.length} matching quotation(s) for "${reminder.name}"`);

        for (const quotation of matchingQuotations) {
          const customer = quotation.billTo || quotation.customerId;
          if (!customer) {
            console.log(`Skipping quotation ${quotation.quotationId} - No customer found`);
            continue;
          }

          // Prevent duplicate send on same day
          const lastSent = reminder.lastSent;
          if (lastSent) {
            const lastSentDate = new Date(lastSent);
            lastSentDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (lastSentDate.getTime() === today.getTime()) {
              console.log(`Reminder "${reminder.name}" already sent today, skipping`);
              continue;
            }
          }

          // Send reminder
          await sendQuotationReminderEmail(reminder, quotation, customer);
        }

      } catch (err) {
        console.error(`Error processing quotation reminder "${reminder.name}":`, err.message);
      }
    }

    console.log('Quotation reminder cron completed successfully');

  } catch (err) {
    console.error('Error in quotation reminder cron:', err);
  }
};


module.exports = { runQuotationReminderCron };
