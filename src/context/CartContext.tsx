import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CartItem {
  id: string; // generate unique id for each cart item
  menuItemId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  instruction?: string;
  variantName?: string;
  // If we add variants/addons later, we can add them here
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = (newItem: Omit<CartItem, 'id'>) => {
    // Check if exact same item exists (same id & instruction)
    const existingIndex = items.findIndex(
      (item) => item.menuItemId === newItem.menuItemId && 
                item.instruction === newItem.instruction &&
                item.variantName === newItem.variantName
    );

    if (existingIndex > -1) {
      // increase quantity
      const newItems = [...items];
      newItems[existingIndex].quantity += newItem.quantity;
      setItems(newItems);
    } else {
      // add new
      const cartItemId = Math.random().toString(36).substr(2, 9);
      setItems([...items, { ...newItem, id: cartItemId }]);
    }
  };

  const removeFromCart = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const newQ = item.quantity + delta;
        return { ...item, quantity: newQ > 0 ? newQ : 1 };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
