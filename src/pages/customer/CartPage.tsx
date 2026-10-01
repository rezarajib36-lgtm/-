import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { Trash2, Minus, Plus } from 'lucide-react';

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, totalPrice } = useCart();
  const finalTotal = totalPrice;

  if (items.length === 0) {
    return (
      <div className="bg-gray-50 min-h-screen flex flex-col items-center justify-center p-5">
        <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 text-amber-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">আপনার কার্ট বর্তমানে খালি</h2>
        <p className="text-gray-500 text-center mb-8 text-sm">মেনু থেকে পছন্দের খাবার কার্টে যোগ করুন।</p>
        <Link to="/#menu" className="bg-amber-600 text-white px-8 py-3.5 rounded-xl font-black shadow-md hover:bg-amber-700 transition-colors">
          খাবারের মেনু দেখুন
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col pb-28">
      {/* 1. Header */}
      <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-5 py-4">
          <Link to="/#menu" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors" title="মেনুতে ফিরে যান">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="font-black text-lg text-gray-900">আপনার কার্ট (Your Cart)</h1>
          <div className="w-10"></div> {/* For centering the title */}
        </div>
      </div>

      {/* 2. Cart Items */}
      <div className="p-5 flex flex-col gap-4">
        {items.map((item) => {
          const itemTotal = item.price * item.quantity;
          
          return (
            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-black text-gray-900 leading-tight">{item.name}</h3>
                      {item.variantName && (
                        <p className="text-xs text-amber-800 font-bold mt-0.5">সাইজ/পোরশন: {item.variantName}</p>
                      )}
                  <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1 -mr-1" title="মুছে ফেলুন">
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                  {item.instruction && (
                    <p className="text-orange-500 italic flex items-center gap-1 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                      {item.instruction}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4">
                  <span className="font-black text-base text-gray-900">৳{itemTotal}</span>
                  
                  {/* Quantity Control */}
                  <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-gray-900 cursor-pointer"
                      title="কমান"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 rounded-full bg-amber-600 text-white shadow-sm flex items-center justify-center hover:bg-amber-700 cursor-pointer"
                      title="বাড়ান"
                    >
                      <Plus size={14} className="text-white stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Order Summary */}
      <div className="mt-auto bg-white rounded-t-3xl pt-6 px-5 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        <h2 className="font-black text-gray-900 mb-4 text-base">অর্ডার সারাংশ (Order Summary)</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>মোট খাবারের মূল্য</span>
            <span className="font-bold text-gray-900">৳{totalPrice}</span>
          </div>

          <div className="flex justify-between text-gray-600">
            <span>ডেলিভারি চার্জ</span>
            <span className="text-xs text-amber-700 font-bold italic">চেকআউট পেজে নির্ধারিত হবে</span>
          </div>

          <div className="pt-3 border-t border-gray-100 flex justify-between font-black text-lg text-gray-900">
            <span>সর্বমোট</span>
            <span className="text-amber-700">৳{finalTotal}</span>
          </div>
        </div>
      </div>

      {/* 5. Fixed Checkout Button */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-5 z-30 pointer-events-none">
        <div className="w-full max-w-md pointer-events-auto">
          <Link to="/checkout" className="w-full bg-amber-600 text-white rounded-2xl py-4 px-6 flex items-center justify-between shadow-2xl active:scale-[0.98] transition-transform hover:bg-amber-700 font-black">
            <span className="text-base">অর্ডার সম্পন্ন করুন (Checkout)</span>
            <span className="text-lg">৳{finalTotal} ›</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
