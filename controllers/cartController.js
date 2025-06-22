const Cart = require('../models/cartModel');
const User = require('../models/userModel');
const { MenuItem } = require('../models/menuItemModel');
const Restaurant = require('../models/restaurantModel');
const Chef = require('../models/chefModel');

// Add item to cart
exports.addToCart = async (req, res) => {
  const userId = req.user.id;
  const { restaurantId, chefId, menuItemId, quantity, customizations = {} } = req.body;

  if ((!restaurantId && !chefId) || (restaurantId && chefId)) {
    return res.status(400).json({ 
      message: "Either restaurant ID or chef ID must be provided, but not both" 
    });
  }

  if (!menuItemId || !quantity) {
    return res.status(400).json({ 
      message: "Menu item ID and quantity are required" 
    });
  }

  try {
    // Check if menu item exists
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Calculate total price including base price and customizations
    let totalItemPrice = menuItem.price;
    
    // Add price for add-ons if any
    if (customizations.selectedAddOns && customizations.selectedAddOns.length > 0) {
      // Validate add-ons against menu item's available add-ons
      const validAddOns = [];
      
      for (const selectedAddOn of customizations.selectedAddOns) {
        const menuAddOn = menuItem.customizationOptions.addOns.find(
          addOn => addOn.name === selectedAddOn.name
        );
        
        if (menuAddOn) {
          // Use the price from the menu item's definition, not from the request
          validAddOns.push({
            name: menuAddOn.name,
            price: menuAddOn.price,
            isVeg: menuAddOn.isVeg
          });
          
          // Add the add-on price to the total
          totalItemPrice += menuAddOn.price;
        }
      }
      
      // Replace selected add-ons with validated ones
      customizations.selectedAddOns = validAddOns;
    }
    
    // Handle spice level price if applicable (future enhancement)
    // This would be implemented if spice levels had different prices

    // Check if source (restaurant or chef) exists and matches menu item
    let sourceExists = false;
    if (restaurantId) {
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      if (menuItem.restaurantId?.toString() !== restaurantId) {
        return res.status(400).json({ message: "Menu item does not belong to this restaurant" });
      }
      sourceExists = true;
    } else {
      const chef = await Chef.findById(chefId);
      if (!chef) {
        return res.status(404).json({ message: "Chef not found" });
      }
      if (menuItem.chefId?.toString() !== chefId) {
        return res.status(400).json({ message: "Menu item does not belong to this chef" });
      }
      sourceExists = true;
    }

    if (!sourceExists) {
      return res.status(400).json({ message: "Invalid source for menu item" });
    }

    // Find existing cart for this restaurant/chef
    let cart = null;
    if (restaurantId) {
      cart = await Cart.findOne({ user: userId, restaurant: restaurantId });
    } else {
      cart = await Cart.findOne({ user: userId, chef: chefId });
    }
    
    // If no cart exists, create one
    if (!cart) {
      cart = new Cart({
        user: userId,
        restaurant: restaurantId || null,
        chef: chefId || null,
        items: []
      });

      // Add this cart to user's active carts
      await User.findByIdAndUpdate(userId, {
        $push: { activeCarts: cart._id }
      });
    }

    // Check if item with exact same customizations already exists in cart
    const existingItemIndex = cart.items.findIndex(item => {
      // Check if same menu item
      if (item.menuItem.toString() !== menuItemId) return false;
      
      // Check if customizations match
      const existingCustom = JSON.stringify(item.customizations || {});
      const newCustom = JSON.stringify(customizations);
      return existingCustom === newCustom;
    });

    if (existingItemIndex > -1) {
      // Update quantity if item with same customizations exists
      cart.items[existingItemIndex].quantity += parseInt(quantity);
    } else {
      // Add new item to cart
      cart.items.push({
        menuItem: menuItemId,
        quantity: parseInt(quantity),
        price: totalItemPrice, // Use calculated total item price
        customizations
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();
    
    // Populate cart items with menu item details
    await cart.populate('items.menuItem');
    if (restaurantId) {
      await cart.populate('restaurant', 'name');
    } else {
      await cart.populate('chef', 'name');
    }

    res.status(200).json({ 
      message: "Item added to cart",
      cart
    });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ message: "Failed to add item to cart", error: err.message });
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

    // Get the menu item to calculate customization prices
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Calculate total price including base price and customizations
    let totalItemPrice = menuItem.price;
    
    // If customizations are being updated, validate and calculate price
    if (customizations) {
      // Add price for add-ons if any
      if (customizations.selectedAddOns && customizations.selectedAddOns.length > 0) {
        // Validate add-ons against menu item's available add-ons
        const validAddOns = [];
        
        for (const selectedAddOn of customizations.selectedAddOns) {
          const menuAddOn = menuItem.customizationOptions.addOns.find(
            addOn => addOn.name === selectedAddOn.name
          );
          
          if (menuAddOn) {
            // Use the price from the menu item's definition
            validAddOns.push({
              name: menuAddOn.name,
              price: menuAddOn.price,
              isVeg: menuAddOn.isVeg
            });
            
            // Add the add-on price to the total
            totalItemPrice += menuAddOn.price;
          }
        }
        
        // Replace selected add-ons with validated ones
        customizations.selectedAddOns = validAddOns;
      }
      
      // Update the item's customizations
      cart.items[itemIndex].customizations = customizations;
    }

    // Update quantity and price
    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.items[itemIndex].price = totalItemPrice; // Use calculated total price

    cart.updatedAt = Date.now();
    await cart.save();

    await cart.populate('items.menuItem');
    await cart.populate('restaurant', 'name');
    if (cart.chef) {
      await cart.populate('chef', 'name');
    }

    res.status(200).json({ 
      message: "Cart item updated",
      cart 
    });
  } catch (err) {
    console.error("Update cart item error:", err);
    res.status(500).json({ message: "Failed to update cart item", error: err.message });
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