const cron = require("node-cron");
const { syncNotificationsForAllUsers } = require("@services/notificationService");

const runInvoiceCreditNotificationCron = async () => {
  try {
    const results = await syncNotificationsForAllUsers();
    console.log("[Notifications] Credit and quotation notification sync completed.", results);
  } catch (error) {
    console.error("[Notifications] Notification sync failed:", error);
  }
};

cron.schedule("0 9 * * *", runInvoiceCreditNotificationCron);

module.exports = { runInvoiceCreditNotificationCron };
