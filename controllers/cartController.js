const Cart = require('../models/cartModel');
const User = require('../models/userModel');
const { MenuItem } = require('../models/menuItemModel');
const Restaurant = require('../models/restaurantModel');

// Add item to cart
exports.addToCart = async (req, res) => {
  const userId = req.user.id;
  const { restaurantId, menuItemId, quantity, customizations = {} } = req.body;

  if (!restaurantId || !menuItemId || !quantity) {
    return res.status(400).json({ 
      message: "Restaurant ID, menu item ID, and quantity are required" 
    });
  }

  try {
    // Check if menu item exists
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Check if restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Find existing cart for this restaurant
    let cart = await Cart.findOne({ user: userId, restaurant: restaurantId });
    
    // If no cart exists for this restaurant, create one
    if (!cart) {
      cart = new Cart({
        user: userId,
        restaurant: restaurantId,
        items: []
      });

      // Add this cart to user's active carts
      await User.findByIdAndUpdate(userId, {
        $push: { activeCarts: cart._id }
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.menuItem.toString() === menuItemId
    );

    if (existingItemIndex > -1) {
      // Update quantity if item exists
      cart.items[existingItemIndex].quantity = quantity;
    } else {
      // Add new item to cart
      cart.items.push({
        menuItem: menuItemId,
        quantity,
        price: menuItem.price,
        customizations
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();
    
    // Populate cart items with menu item details
    await cart.populate('items.menuItem');
    await cart.populate('restaurant', 'name');

    res.status(200).json({ 
      message: "Item added to cart",
      cart
    });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ message: "Failed to add item to cart" });
  }
};

// Remove item from cart
exports.removeFromCart = async (req, res) => {
  const userId = req.user.id;
  const { cartId, menuItemId } = req.body;

  if (!cartId || !menuItemId) {
    return res.status(400).json({ 
      message: "Cart ID and menu item ID are required" 
    });
  }

  try {
    const cart = await Cart.findOne({ 
      _id: cartId, 
      user: userId 
    });

    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Remove the item from the cart
    cart.items = cart.items.filter(
      item => item.menuItem.toString() !== menuItemId
    );

    // If cart is empty, delete it
    if (cart.items.length === 0) {
      await Cart.findByIdAndDelete(cartId);
      
      // Remove from user's active carts
      await User.findByIdAndUpdate(userId, {
        $pull: { activeCarts: cartId }
      });

      return res.status(200).json({ message: "Item removed and cart deleted" });
    } else {
      cart.updatedAt = Date.now();
      await cart.save();
      
      await cart.populate('items.menuItem');
      await cart.populate('restaurant', 'name');

      return res.status(200).json({ 
        message: "Item removed from cart",
        cart 
      });
    }
  } catch (err) {
    console.error("Remove from cart error:", err);
    res.status(500).json({ message: "Failed to remove item from cart" });
  }
};

// Get all user's carts
exports.getUserCarts = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).populate({
      path: 'activeCarts',
      populate: [
        { path: 'restaurant', select: 'name isVegOnly' },
        { path: 'items.menuItem', select: 'name price isVeg' }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ 
      carts: user.activeCarts 
    });
  } catch (err) {
    console.error("Get carts error:", err);
    res.status(500).json({ message: "Failed to fetch carts" });
  }
};

// Get a single cart by ID
exports.getCartById = async (req, res) => {
  const userId = req.user.id;
  const { cartId } = req.params;

  try {
    const cart = await Cart.findOne({ 
      _id: cartId, 
      user: userId 
    }).populate('restaurant', 'name isVegOnly')
      .populate('items.menuItem');
    
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    res.status(200).json({ cart });
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ message: "Failed to fetch cart" });
  }
};

// Update item quantity in cart
exports.updateCartItem = async (req, res) => {
  const userId = req.user.id;
  const { cartId, menuItemId, quantity, customizations } = req.body;

  if (!cartId || !menuItemId || !quantity) {
    return res.status(400).json({ 
      message: "Cart ID, menu item ID, and quantity are required" 
    });
  }

  try {
    const cart = await Cart.findOne({ _id: cartId, user: userId });
    
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Find the item in the cart
    const itemIndex = cart.items.findIndex(
      item => item.menuItem.toString() === menuItemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Update quantity
    cart.items[itemIndex].quantity = quantity;
    
    // Update customizations if provided
    if (customizations) {
      cart.items[itemIndex].customizations = customizations;
    }

    cart.updatedAt = Date.now();
    await cart.save();

    await cart.populate('items.menuItem');
    await cart.populate('restaurant', 'name');

    res.status(200).json({ 
      message: "Cart item updated",
      cart 
    });
  } catch (err) {
    console.error("Update cart item error:", err);
    res.status(500).json({ message: "Failed to update cart item" });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  const userId = req.user.id;
  const { cartId } = req.params;

  try {
    // Delete the cart
    await Cart.findOneAndDelete({ _id: cartId, user: userId });
    
    // Remove from user's active carts
    await User.findByIdAndUpdate(userId, {
      $pull: { activeCarts: cartId }
    });

    res.status(200).json({ message: "Cart cleared successfully" });
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ message: "Failed to clear cart" });
  }
};