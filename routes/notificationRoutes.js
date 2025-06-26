const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  getAllNotifications,
  getUnreadNotifications,
  getReadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationCount,
  createNotification,
  deleteAllNotifications
} = require('../controllers/notificationController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get notifications
router.get('/', getAllNotifications);
router.get('/unread', getUnreadNotifications);
router.get('/read', getReadNotifications);
router.get('/count', getNotificationCount);

// Mark notifications as read
router.put('/read/:notificationId', markAsRead);
router.put('/read-all', markAllAsRead);

// Delete notification
router.delete('/delete/:notificationId', deleteNotification);
router.delete('/clear-all', protect, deleteAllNotifications);

//admin api, wil be deleted from here
router.post('/send',createNotification);

module.exports = router;