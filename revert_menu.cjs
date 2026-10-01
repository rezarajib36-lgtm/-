const fs = require('fs');

const menuPageOriginal = `import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ShoppingBag, MapPin, Info, Plus } from 'lucide-react';
import FoodDetailsModal from '../../components/customer/FoodDetailsModal';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';

const DEFAULT_RESTAURANT = {
  name: "The Gourmet Kitchen",
  shortDesc: "Premium Burgers, Pasta & Steak",
  address: "Dhanmondi, Dhaka",
  status: "Open",
  closingTime: "10:30 PM",
  coverImage: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?q=80&w=1000&auto=format&fit=crop",
  logo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop"
};

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedFood, setSelectedFood] = useState<any>(null);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState(DEFAULT_RESTAURANT);

  const { totalItems, totalPrice } = useCart();
  
  // View mode check
  const [searchParams] = useSearchParams();
  const isViewOnlyParam = searchParams.get('mode') === 'view';
  const storedMode = typeof window !== 'undefined' ? sessionStorage.getItem('orderMode') : null;
  const effectiveViewOnly = isViewOnlyParam || storedMode === 'viewOnly';

  useEffect(() => {
    if (isViewOnlyParam && typeof window !== 'undefined') {
      sessionStorage.setItem('orderMode', 'viewOnly');
    }
  }, [isViewOnlyParam]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [catRes, itemsRes] = await Promise.all([
          supabase.from('categories').select('*').order('created_at'),
          supabase.from('menu_items').select('*').order('created_at')
        ]);
        if (catRes.data) setCategories(catRes.data);
        if (itemsRes.data) setMenuItems(itemsRes.data);
      } catch (err) {
        console.error("Error fetching menu:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const CATEGORY_NAMES = ["All", ...categories.map(c => c.name)];
  
  const filteredItems = activeCategory === "All" 
    ? menuItems 
    : menuItems.filter(item => {
        const cat = categories.find(c => c.name === activeCategory);
        return cat && item.category_id === cat.id;
      });

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans selection:bg-gray-200">
      {/* 1. Hero Cover */}
      <div 
        className="h-64 sm:h-72 w-full bg-gray-200 bg-cover bg-center relative"
        style={{ backgroundImage: \`url(\${restaurant.coverImage})\` }}
      >
        <div className="absolute inset-0 bg-black/40" />
        
        {/* Top Floating Actions */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center text-white z-10">
          <button className="bg-white/20 backdrop-blur-md p-2.5 rounded-full hover:bg-white/30 transition">
            <Info size={20} />
          </button>
          <div className="flex gap-3">
            <button className="bg-white/20 backdrop-blur-md p-2.5 rounded-full hover:bg-white/30 transition">
              <Search size={20} />
            </button>
            {!effectiveViewOnly && (
            <Link to="/cart" className="bg-white/20 backdrop-blur-md p-2.5 rounded-full relative hover:bg-white/30 transition">
              <ShoppingBag size={20} />
              {!effectiveViewOnly && totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-transparent">
                  {totalItems}
                </span>
              )}
            </Link>
            )}
          </div>
        </div>
      </div>

      {/* 2. Restaurant Info Container (Overlapping the hero) */}
      <div className="bg-white rounded-t-[2.5rem] -mt-8 relative z-10 px-6 pt-7 pb-5 shadow-sm">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{restaurant.name}</h1>
            <p className="text-gray-500 text-sm mt-1">{restaurant.shortDesc}</p>
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-white shadow-lg overflow-hidden -mt-14 shrink-0 bg-white">
            <img src={restaurant.logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 text-sm font-medium text-gray-600">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-600">{restaurant.status}</span>
            <span className="text-gray-400 font-normal ml-1">until {restaurant.closingTime}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <MapPin size={16} />
            <span className="font-normal">{restaurant.address}</span>
          </div>
        </div>
        
        {effectiveViewOnly && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-sm flex items-center gap-2">
            <Info size={18} className="shrink-0" />
            <span>You are viewing the menu in <strong>View-Only</strong> mode.</span>
          </div>
        )}
      </div>

      {/* 3. Sticky Category Navigation */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-lg z-20 border-b border-gray-100 shadow-sm">
        <div className="flex overflow-x-auto py-3 px-5 gap-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {loading ? (
             <span className="text-gray-400 text-sm">Loading categories...</span>
          ) : (
            CATEGORY_NAMES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={\`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300 \${
                  activeCategory === cat 
                    ? 'bg-gray-900 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }\`}
              >
                {cat}
              </button>
            ))
          )}
        </div>
      </div>

      {/* 4. Food Items List */}
      <div className="px-5 py-6 flex flex-col gap-5">
        {loading ? (
           <div className="text-center py-10 text-gray-400">Loading menu items...</div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map(item => (
            <div 
              key={item.id} 
              onClick={() => setSelectedFood(item)}
              className="bg-white rounded-2xl p-3 flex gap-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform cursor-pointer"
            >
              {/* Food Info */}
              <div className="flex-1 py-1">
                <h3 className="font-bold text-gray-900 text-base">{item.name}</h3>
                <p className="text-gray-500 text-sm mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                <div className="mt-3 font-bold text-gray-900">
                  ৳{item.price}
                </div>
              </div>
              
              {/* Food Image & Add Button */}
              <div className="relative shrink-0">
                <div className="w-28 h-28 rounded-xl overflow-hidden bg-gray-100">
                  <img src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=500&auto=format&fit=crop'} alt={item.name} className="w-full h-full object-cover" />
                </div>
                {!effectiveViewOnly && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); // prevent double modal opening
                    setSelectedFood(item);
                  }}
                  className="absolute -bottom-2 -right-2 bg-white text-gray-900 shadow-lg rounded-full p-2 border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <Plus size={20} className="stroke-[3]" />
                </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-gray-400">
            <p>No items found in this category.</p>
          </div>
        )}
      </div>

      {/* 5. Floating Cart Bottom Bar (Menusa style) */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-5 z-30 pointer-events-none animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="w-full max-w-md pointer-events-auto">
            <Link to="/cart" className="w-full bg-gray-900 text-white rounded-2xl py-4 px-6 flex items-center justify-between shadow-2xl active:scale-[0.98] transition-transform hover:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-bold border border-white/10">{totalItems}</div>
                <span className="font-semibold text-base">View Cart</span>
              </div>
              <span className="font-bold text-lg">৳{totalPrice}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Food Details Modal */}
      <FoodDetailsModal 
        isOpen={!!selectedFood} 
        item={selectedFood} 
        onClose={() => setSelectedFood(null)} 
      />
    </div>
  );
}
`;

fs.writeFileSync('src/pages/customer/MenuPage.tsx', menuPageOriginal);

const modalOriginal = `import { useState, useEffect } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { useCart } from '../../context/CartContext';

interface FoodDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
}

export default function FoodDetailsModal({ isOpen, onClose, item }: FoodDetailsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [instruction, setInstruction] = useState('');
  
  const { addToCart } = useCart();

  // Reset state when modal opens with a new item
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setInstruction('');
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const totalPrice = item.price * quantity;

  const handleAddToCart = () => {
    addToCart({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      image: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=500&auto=format&fit=crop',
      quantity,
      instruction: instruction.trim() || undefined
    });
    onClose();
  };
  
  // Determine current effective viewOnly mode
  const currentMode = typeof window !== 'undefined' ? sessionStorage.getItem('orderMode') : null;
  const effectiveViewOnly = currentMode === 'viewOnly';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content - Bottom Sheet on Mobile, Centered Modal on Desktop */}
      <div 
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto pointer-events-auto relative shadow-2xl animate-in slide-in-from-bottom-full duration-300 flex flex-col"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white p-2 rounded-full z-10 hover:bg-black/70 transition"
        >
          <X size={20} />
        </button>

        {/* Large Image */}
        <div className="h-64 w-full bg-gray-100 shrink-0">
          <img src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=500&auto=format&fit=crop'} alt={item.name} className="w-full h-full object-cover" />
        </div>

        <div className="px-5 py-6 flex-1 flex flex-col gap-6 pb-32">
          {/* Header */}
          <div>
            <div className="flex justify-between items-start gap-4">
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">{item.name}</h2>
              <span className="text-xl font-bold text-gray-900 shrink-0">৳{item.price}</span>
            </div>
            <p className="text-gray-500 mt-2 leading-relaxed">{item.description}</p>
          </div>

          <hr className="border-gray-100" />

          {/* Special Instructions */}
          {!effectiveViewOnly && (
            <div>
              <h3 className="font-bold text-gray-900 mb-3 text-lg">Special Instructions</h3>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="E.g. No onions, extra spicy..."
                className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 resize-none h-24"
              />
            </div>
          )}
        </div>

        {/* Floating Add to Cart Bar */}
        {!effectiveViewOnly && (
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 flex items-center gap-4">
          <div className="flex items-center gap-4 bg-gray-100 rounded-2xl p-2 shrink-0">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
              disabled={quantity <= 1}
            >
              <Minus size={20} />
            </button>
            <span className="font-bold text-lg w-4 text-center">{quantity}</span>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-600 hover:text-gray-900"
            >
              <Plus size={20} />
            </button>
          </div>
          
          <button 
            onClick={handleAddToCart}
            className="flex-1 bg-gray-900 text-white font-bold rounded-2xl py-4 px-6 flex items-center justify-between active:scale-[0.98] transition-transform"
          >
            <span>Add to Cart</span>
            <span>৳{totalPrice}</span>
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/customer/FoodDetailsModal.tsx', modalOriginal);

