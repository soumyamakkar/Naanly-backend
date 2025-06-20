const Notification = require('../models/notificationModel');
const User = require('../models/userModel');

// Get all notifications for a user with pagination
exports.getAllNotifications = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  try {
    // Get notifications with pagination and populate sender info
    const notifications = await Notification.find({ user: userId })
      .populate('sender', 'name profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination info
    const total = await Notification.countDocuments({ user: userId });

    // Count unread notifications
    const unreadCount = await Notification.countDocuments({ 
      user: userId, 
      isRead: false 
    });

    res.status(200).json({
      notifications,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + notifications.length < total
      }
    });
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

// Get unread notifications
exports.getUnreadNotifications = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  try {
    const notifications = await Notification.find({ 
      user: userId,
      isRead: false 
    })
      .populate('sender', 'name profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments({ 
      user: userId,
      isRead: false 
    });

    res.status(200).json({
      notifications,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + notifications.length < total
      }
    });
  } catch (err) {
    console.error("Get unread notifications error:", err);
    res.status(500).json({ message: "Failed to fetch unread notifications" });
  }
};

// Get read notifications
exports.getReadNotifications = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  try {
    const notifications = await Notification.find({ 
      user: userId,
      isRead: true 
    })
      .populate('sender', 'name profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments({ 
      user: userId,
      isRead: true 
    });

    res.status(200).json({
      notifications,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + notifications.length < total
      }
    });
  } catch (err) {
    console.error("Get read notifications error:", err);
    res.status(500).json({ message: "Failed to fetch read notifications" });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  const userId = req.user.id;
  const { notificationId } = req.params;

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    ).populate('sender', 'name profilePicture');

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json({ 
      message: "Notification marked as read",
      notification 
    });
  } catch (err) {
    console.error("Mark notification error:", err);
    res.status(500).json({ message: "Failed to update notification" });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({ 
      message: "All notifications marked as read",
      count: result.modifiedCount 
    });
  } catch (err) {
    console.error("Mark all notifications error:", err);
    res.status(500).json({ message: "Failed to update notifications" });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  const userId = req.user.id;
  const { notificationId } = req.params;

  try {
    const result = await Notification.findOneAndDelete({ 
      _id: notificationId, 
      user: userId 
    });

    if (!result) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json({ message: "Notification deleted" });
  } catch (err) {
    console.error("Delete notification error:", err);
    res.status(500).json({ message: "Failed to delete notification" });
  }
};

// Get notification count (just the numbers)
exports.getNotificationCount = async (req, res) => {
  const userId = req.user.id;

  try {
    const totalCount = await Notification.countDocuments({ user: userId });
    const unreadCount = await Notification.countDocuments({ 
      user: userId, 
      isRead: false 
    });

    res.status(200).json({
      total: totalCount,
      unread: unreadCount,
      read: totalCount - unreadCount
    });
  } catch (err) {
    console.error("Get notification count error:", err);
    res.status(500).json({ message: "Failed to fetch notification count" });
  }
};

// Create notification (utility function for internal use)
exports.createNotification = async (req, res) => {
  try {
    const { userId, message, senderId } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ message: "User ID and message are required" });
    }

    const notificationData = {
      user: userId,
      message
    };

    // Add sender if provided (for user-to-user notifications)
    if (senderId) {
      notificationData.sender = senderId;
    }

    const notification = new Notification(notificationData);
    await notification.save();

    // Populate sender info before returning
    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'name profilePicture');

    res.status(201).json({
      message: "Notification created successfully",
      notification: populatedNotification
    });
  } catch (err) {
    console.error("Create notification error:", err);
    res.status(500).json({ message: "Failed to create notification" });
  }
};

// Utility function for internal use
exports.createNotificationUtil = async (userId, message, senderId = null) => {
  try {
    const notificationData = {
      user: userId,
      message
    };

    // Add sender if provided
    if (senderId) {
      notificationData.sender = senderId;
    }

    const notification = new Notification(notificationData);
    await notification.save();
    return notification;
  } catch (err) {
    console.error("Create notification error:", err);
    return null;
  }
};