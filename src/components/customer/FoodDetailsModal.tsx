import { useState, useEffect } from 'react';
import { X, Minus, Plus, Check } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { parseDescriptionData, getFoodBadges } from '../../utils';

interface FoodDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
}

export default function FoodDetailsModal({ isOpen, onClose, item }: FoodDetailsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [instruction, setInstruction] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  
  const { addToCart } = useCart();

  // Reset state when modal opens with a new item
  useEffect(() => {
    if (isOpen && item) {
      setQuantity(1);
      setInstruction('');
      const variants = parseDescriptionData(item.description).variants;
      if (variants && variants.length > 0) {
        setSelectedVariant(variants[0]);
      } else {
        setSelectedVariant(null);
      }
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const currentPrice = selectedVariant ? selectedVariant.price : item.price;
  const totalPrice = currentPrice * quantity;
  const foodBadges = getFoodBadges(item.name);

  const handleAddToCart = () => {
    addToCart({
      menuItemId: item.id,
      name: selectedVariant ? `${item.name} (${selectedVariant.name})` : item.name,
      price: currentPrice,
      image: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=500&auto=format&fit=crop',
      quantity,
      instruction: instruction.trim() || undefined,
      variantName: selectedVariant?.name
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content - Bottom Sheet on Mobile, Centered Modal on Desktop */}
      <div 
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] pointer-events-auto relative shadow-2xl animate-in slide-in-from-bottom-full duration-300 flex flex-col overflow-hidden"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white p-2 rounded-full z-10 hover:bg-black/80 transition cursor-pointer shadow-md"
          title="বন্ধ করুন"
        >
          <X size={20} />
        </button>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto flex-1 flex flex-col">
          {/* Large Image */}
          <div className="h-60 sm:h-72 w-full bg-stone-100 shrink-0 relative overflow-hidden">
            <img 
              src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=500&auto=format&fit=crop'} 
              alt={item.name} 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />
            
            {/* Top-left Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
              {foodBadges.map((badge, idx) => (
                <span 
                  key={idx} 
                  className={`px-3 py-1 rounded-full font-black text-xs shadow-md backdrop-blur-xs border ${badge.className}`}
                >
                  {badge.icon} {badge.text}
                </span>
              ))}
            </div>

            {/* Price badge on bottom image corner */}
            <div className="absolute bottom-4 right-4 z-10">
              <span className="px-4 py-1.5 rounded-full bg-amber-600 text-white font-black text-lg shadow-lg backdrop-blur-xs ring-2 ring-white/20">
                ৳ {currentPrice}
              </span>
            </div>
          </div>

          <div className="px-5 py-6 flex-1 flex flex-col gap-5 pb-6">
            {/* Title & Description */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-stone-900 leading-tight tracking-tight">
                {item.name}
              </h2>
              {parseDescriptionData(item.description).description && (
                <p className="text-stone-600 mt-2 text-sm sm:text-base leading-relaxed">
                  {parseDescriptionData(item.description).description}
                </p>
              )}
            </div>

            {/* Portion / Size Selection */}
            {parseDescriptionData(item.description).variants?.length > 0 && (
              <>
                <hr className="border-stone-200" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-stone-900 text-base sm:text-lg flex items-center gap-1.5">
                      <span>সাইজ বা পরিবেশন নির্বাচন করুন</span>
                    </h3>
                    <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full">
                      বাধ্যতামূলক
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {parseDescriptionData(item.description).variants.map((v:any, idx:number) => {
                      const isSelected = selectedVariant?.name === v.name;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedVariant(v)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                            isSelected 
                              ? 'border-amber-600 bg-amber-50/70 shadow-xs ring-1 ring-amber-500' 
                              : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${isSelected ? 'border-amber-600 bg-amber-600 text-white' : 'border-stone-300 bg-white'}`}>
                              {isSelected && <Check size={12} className="stroke-[3]" />}
                            </div>
                            <span className={`font-black text-sm sm:text-base ${isSelected ? 'text-amber-950' : 'text-stone-800'}`}>
                              {v.name}
                            </span>
                          </div>
                          <span className={`font-black text-base ${isSelected ? 'text-amber-700' : 'text-stone-600'}`}>
                            ৳ {v.price}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <hr className="border-stone-200" />

            {/* Special Instructions */}
            {!effectiveViewOnly && (
              <div>
                <h3 className="font-black text-stone-900 mb-2 text-sm sm:text-base">
                  বিশেষ রন্ধন নির্দেশনা (ঐচ্ছিক)
                </h3>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="যেমন: ঝাল কম দেবেন, পেঁয়াজ ছাড়া, অতিরিক্ত সস দেবেন..."
                  className="w-full border border-stone-200 rounded-2xl p-3.5 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500 resize-none h-24 text-sm text-stone-800 placeholder:text-stone-400 bg-stone-50/60"
                />
              </div>
            )}
          </div>
        </div>

        {/* Floating Add to Cart Bar */}
        {!effectiveViewOnly && (
        <div className="p-4 sm:p-5 bg-white border-t border-stone-200 flex items-center gap-3 shrink-0 shadow-lg">
          <div className={`flex items-center gap-3 bg-stone-100 rounded-2xl p-1.5 shrink-0 border border-stone-200 ${!item.is_available ? 'opacity-50' : ''}`}>
            <button 
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-2xs text-stone-700 hover:text-stone-950 disabled:opacity-40 cursor-pointer transition-all active:scale-95"
              disabled={quantity <= 1 || !item.is_available}
              title="পরিমাণ কমান"
            >
              <Minus size={18} className="stroke-[2.5]" />
            </button>
            <span className="font-black text-base w-6 text-center text-stone-900">{quantity}</span>
            <button 
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-2xs text-stone-700 hover:text-stone-950 disabled:opacity-40 cursor-pointer transition-all active:scale-95"
              disabled={!item.is_available}
              title="পরিমাণ বাড়ান"
            >
              <Plus size={18} className="stroke-[2.5]" />
            </button>
          </div>
          
          <button 
            type="button"
            onClick={handleAddToCart}
            className={`flex-1 ${item.is_available ? 'bg-amber-600 hover:bg-amber-700' : 'bg-stone-400'} text-white font-black rounded-2xl py-3.5 px-5 flex items-center justify-between active:scale-[0.98] transition-all shadow-md cursor-pointer`}
            disabled={!item.is_available}
          >
            <span className="text-sm sm:text-base">
              {item.is_available ? 'ব্যাগে যোগ করুন' : 'স্টক শেষ'}
            </span>
            {item.is_available && (
              <span className="text-base sm:text-lg bg-black/20 px-3 py-1 rounded-xl">৳ {totalPrice}</span>
            )}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
