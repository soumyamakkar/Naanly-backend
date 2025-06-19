const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const User = require('../models/userModel');
const Payment = require('../models/paymentModel');
const Restaurant = require('../models/restaurantModel');

// Place a new order from cart
exports.placeOrder = async (req, res) => {
  const userId = req.user.id;
  const { 
    cartId, 
    deliveryAddressId, 
    paymentMethod, // 'cod', 'card', 'upi', etc.
    paymentGatewayResponse = null // For prepaid orders
  } = req.body;

  if (!cartId || !deliveryAddressId || !paymentMethod) {
    return res.status(400).json({ 
      message: "Cart ID, delivery address ID, and payment method are required" 
    });
  }

  try {
    // Fetch the cart with populated items
    const cart = await Cart.findOne({ _id: cartId, user: userId })
      .populate({
        path: 'items.menuItem',
        select: 'name price isVeg restaurantId'
      })
      .populate('restaurant');

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    if (cart.items.length === 0) {
      return res.status(400).json({ message: "Cannot place an order with empty cart" });
    }

    // Get user's delivery address
    const user = await User.findById(userId).populate({
      path: 'addresses',
      match: { _id: deliveryAddressId }
    });

    if (!user.addresses || user.addresses.length === 0) {
      return res.status(404).json({ message: "Delivery address not found" });
    }

    const deliveryAddress = user.addresses[0];

    // Create order items from cart items
    const orderItems = cart.items.map(item => ({
      itemId: item.menuItem._id,
      quantity: item.quantity,
      price: item.price
    }));

    // Calculate total (recalculate to ensure accuracy)
    const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Create new order
    const order = new Order({
      userId,
      restaurantId: cart.restaurant._id,
      items: orderItems,
      totalAmount,
      status: 'placed',
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending', // Will update based on payment confirmation
      deliveryAddress
    });

    await order.save();

    // Create payment record
    const payment = new Payment({
      orderId: order._id,
      method: paymentMethod,
      status: paymentMethod === 'cod' ? 'pending' : 'pending', // For COD, stays pending until delivery
      amount: totalAmount,
      paymentGatewayResponse
    });

    await payment.save();

    // If payment is prepaid and successful, update order payment status
    if (paymentMethod !== 'cod' && paymentGatewayResponse && paymentGatewayResponse.status === 'success') {
      order.paymentStatus = 'paid';
      payment.status = 'success';
      await order.save();
      await payment.save();
    }

    // Clear the cart after order placement
    await Cart.findByIdAndDelete(cartId);
    
    // Remove this cart from user's active carts
    await User.findByIdAndUpdate(userId, {
      $pull: { activeCarts: cartId }
    });

    res.status(201).json({
      message: "Order placed successfully",
      order,
      payment: {
        method: payment.method,
        status: payment.status
      }
    });
  } catch (err) {
    console.error("Order placement error:", err);
    res.status(500).json({ message: "Failed to place order", error: err.message });
  }
};

// Get order details by ID
exports.getOrderById = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  try {
    const order = await Order.findOne({ _id: orderId, userId })
      .populate({
        path: 'items.itemId',
        select: 'name price isVeg category description'
      })
      .populate('restaurantId', 'name cuisines isVegOnly');

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Get payment info
    const payment = await Payment.findOne({ orderId: order._id })
      .select('method status amount');

    res.status(200).json({ 
      order,
      payment
    });
  } catch (err) {
    console.error("Get order error:", err);
    res.status(500).json({ message: "Failed to fetch order details" });
  }
};

// Get all orders for a user
exports.getUserOrders = async (req, res) => {
  const userId = req.user.id;
  const { status, limit = 10, page = 1 } = req.query;
  
  try {
    const query = { userId };
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('restaurantId', 'name')
      .select('status totalAmount createdAt items');

    const total = await Order.countDocuments(query);

    res.status(200).json({
      orders,
      pagination: {
        totalOrders: total,
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page),
        hasNext: skip + orders.length < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error("Get user orders error:", err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

// Update order status (for admins/restaurants)
exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const validStatuses = ['preparing', 'out-for-delivery', 'delivered', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Prevent updates to delivered/cancelled orders
    if (order.status === 'delivered' || order.status === 'cancelled') {
      return res.status(400).json({ 
        message: `Cannot update status for ${order.status} order` 
      });
    }

    // Update status
    order.status = status;
    
    // If order is delivered and payment method was COD, update payment status
    if (status === 'delivered') {
      const payment = await Payment.findOne({ orderId });
      if (payment && payment.method === 'cod') {
        payment.status = 'success';
        order.paymentStatus = 'paid';
        await payment.save();
      }
    }

    await order.save();

    res.status(200).json({
      message: "Order status updated successfully",
      orderId,
      newStatus: status
    });
  } catch (err) {
    console.error("Update order status error:", err);
    res.status(500).json({ message: "Failed to update order status" });
  }
};

// Cancel order by user
exports.cancelOrder = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  try {
    const order = await Order.findOne({ _id: orderId, userId });
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if order can be cancelled
    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ 
        message: `Cannot cancel a ${order.status} order` 
      });
    }

    // For orders in preparing or later stages, we might want additional logic
    // e.g., notify restaurant, apply cancellation fee, etc.
    if (order.status !== 'placed') {
      // Additional business logic for late cancellation can go here
      // For now, we'll allow it but you might want to customize this
    }

    // Update order status
    order.status = 'cancelled';
    await order.save();

    // Update payment status
    const payment = await Payment.findOne({ orderId });
    if (payment && payment.status !== 'failed') {
      payment.status = 'pending'; // For refund processing
      await payment.save();
    }

    res.status(200).json({
      message: "Order cancelled successfully",
      orderId
    });
  } catch (err) {
    console.error("Cancel order error:", err);
    res.status(500).json({ message: "Failed to cancel order" });
  }
};

// Update payment status (webhook from payment gateway)
exports.updatePaymentStatus = async (req, res) => {
  const { orderId, paymentStatus, paymentResponse } = req.body;

  if (!orderId || !paymentStatus) {
    return res.status(400).json({ 
      message: "Order ID and payment status are required" 
    });
  }

  try {
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const payment = await Payment.findOne({ orderId });
    
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Update payment status
    payment.status = paymentStatus;
    if (paymentResponse) {
      payment.paymentGatewayResponse = paymentResponse;
    }
    await payment.save();

    // Update order payment status
    if (paymentStatus === 'success') {
      order.paymentStatus = 'paid';
    } else if (paymentStatus === 'failed') {
      order.paymentStatus = 'failed';
    }
    await order.save();

    res.status(200).json({
      message: "Payment status updated successfully",
      orderId,
      paymentStatus
    });
  } catch (err) {
    console.error("Update payment status error:", err);
    res.status(500).json({ message: "Failed to update payment status" });
  }
};

// Get order status
exports.getOrderStatus = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  try {
    const order = await Order.findOne({ _id: orderId, userId })
      .select('status paymentStatus createdAt updatedAt')
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const payment = await Payment.findOne({ orderId })
      .select('method status')
      .lean();

    res.status(200).json({ 
      orderId,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: payment ? payment.method : 'unknown',
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    });
  } catch (err) {
    console.error("Get order status error:", err);
    res.status(500).json({ message: "Failed to fetch order status" });
  }
};