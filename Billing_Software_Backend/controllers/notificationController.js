const Notification = require("@models/Notification");
const {
  CREDIT_NOTIFICATION_TYPE,
  QUOTATION_NOTIFICATION_TYPE,
  PURCHASE_NOTIFICATION_TYPE,
  syncNotificationsForAllUsers,
  syncNotificationsForUser,
} = require("@services/notificationService");

const NOTIFICATION_TYPE_FILTERS = {
  purchase: PURCHASE_NOTIFICATION_TYPE,
  quotation: QUOTATION_NOTIFICATION_TYPE,
  credit_invoice: CREDIT_NOTIFICATION_TYPE,
  invoice_credit: CREDIT_NOTIFICATION_TYPE,
};

const fireAndForgetNotificationSyncForUser = (userId) => {
  if (!userId) return;

  setImmediate(() => {
    syncNotificationsForUser(userId).catch((error) => {
      console.error("Notification background sync failed:", error.message);
    });
  });
};

const listNotifications = async (req, res) => {
  try {
    const userId = req.user;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const requestedType = String(req.query.type || "").trim();
    const notificationType = NOTIFICATION_TYPE_FILTERS[requestedType] || requestedType;

    fireAndForgetNotificationSyncForUser(userId);

    const query = {
      userId,
      status: "active",
      ...(notificationType ? { type: notificationType } : {}),
    };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({ ...query, isRead: false });

    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

const getUnreadNotificationCount = async (req, res) => {
  try {
    const userId = req.user;

    fireAndForgetNotificationSyncForUser(userId);

    const unreadCount = await Notification.countDocuments({
      userId,
      status: "active",
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      message: "Unread notification count fetched successfully",
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
      error: error.message,
    });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user;
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId,
      status: "active",
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update notification",
      error: error.message,
    });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user;

    await Notification.updateMany(
      {
        userId,
        status: "active",
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update notifications",
      error: error.message,
    });
  }
};

const runNotificationCheck = async (req, res) => {
  try {
    const results = await syncNotificationsForAllUsers();

    return res.status(200).json({
      success: true,
      message: "Notification sync completed successfully",
      data: results,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to run notification sync",
      error: error.message,
    });
  }
};

module.exports = {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  runNotificationCheck,
};
