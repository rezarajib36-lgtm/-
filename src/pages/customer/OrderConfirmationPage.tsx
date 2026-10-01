import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getRestaurantSettings, createWhatsAppOrderLink } from '../../utils';

export default function OrderConfirmationPage() {
  const location = useLocation();
  const orderId = location.state?.orderId;
  const localItems = location.state?.localItems || [];
  const deliveryFee = location.state?.deliveryFee || 0;
  const stateWhatsAppUrl = location.state?.whatsappUrl;
  
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
          
        if (error) throw error;
        setOrderData(data);
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderId]);

  const restSettings = getRestaurantSettings();
  const targetWhatsAppNumber = restSettings.whatsapp || restSettings.phone || '01711123456';
  
  const calculatedWhatsAppUrl = stateWhatsAppUrl || (orderData ? createWhatsAppOrderLink(
    targetWhatsAppNumber,
    {
      orderNumber: orderData.order_number,
      customerName: orderData.customer_name,
      customerPhone: orderData.customer_phone,
      orderType: orderData.order_type,
      location: orderData.location,
      items: localItems.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        instruction: item.instruction
      })),
      itemsSummary: orderData.items_summary,
      subtotal: orderData.total_amount - deliveryFee,
      deliveryFee: deliveryFee,
      total: orderData.total_amount,
      restaurantName: restSettings.name
    }
  ) : '#');

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col pb-28">
      {/* Header */}
      <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-5 py-4">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </Link>
          <h1 className="font-bold text-lg text-gray-900">Order Status</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="px-5 py-6 flex flex-col gap-6">
        
        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading order details...</div>
        ) : !orderData ? (
          <div className="text-center py-10 text-red-500">
            <p>Order not found or missing ID.</p>
            <Link to="/" className="text-blue-600 underline mt-4 block">Return to Menu</Link>
          </div>
        ) : (
          <>
            {/* Success Message & Status */}
            <div className="bg-white rounded-3xl p-6 flex flex-col items-center text-center shadow-sm border border-gray-100">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Order Received!</h2>
              <p className="text-gray-500 text-sm mb-6">Your order has been sent to the kitchen.</p>
              
              <div className="w-full bg-gray-50 rounded-2xl p-4 border border-gray-100 flex justify-between items-center">
                <div className="text-left max-w-[50%]">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">Order Number</p>
                  <p className="font-bold text-gray-900 text-sm truncate" title={orderData.order_number}>{orderData.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">Status</p>
                  <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-lg text-sm font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                    {orderData.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Prominent WhatsApp Send Card */}
            <div className="bg-gradient-to-br from-emerald-600 to-green-700 text-white rounded-3xl p-6 shadow-lg border border-emerald-500 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
              
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md text-white rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                <MessageCircle size={32} className="text-white" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-1">
                হোয়াটসঅ্যাপে অর্ডার নিশ্চিত করুন
              </h3>
              <p className="text-xs text-emerald-100 max-w-sm mb-5 leading-relaxed">
                অর্ডারটি দ্রুত রান্না শুরু করার জন্য রেস্তোরাঁর হোয়াটসঅ্যাপে এক ক্লিকে সম্পূর্ণ রসিদ পাঠিয়ে দিন।
              </p>
              
              <a
                href={calculatedWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full max-w-xs py-3.5 px-5 bg-white hover:bg-emerald-50 active:scale-[0.98] text-emerald-800 font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <MessageCircle size={20} className="text-emerald-600" />
                <span>হোয়াটসঅ্যাপে পাঠান (Send)</span>
                <ExternalLink size={16} className="text-emerald-500" />
              </a>
              <p className="text-[11px] text-emerald-200 mt-2 font-medium">
                নম্বর: {targetWhatsAppNumber}
              </p>
            </div>

            {/* Customer Information */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Customer Info
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-gray-50 pb-3">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium text-gray-900">{orderData.customer_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-3">
                  <span className="text-gray-500">Order Type</span>
                  <span className="font-medium text-gray-900 capitalize">{orderData.order_type}</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-3">
                  <span className="text-gray-500">Location</span>
                  <span className="font-medium text-gray-900">{orderData.location}</span>
                </div>
                {orderData.customer_phone && orderData.customer_phone !== 'প্রযোজ্য নয়' && (
                  <div className="flex justify-between border-b border-gray-50 pb-3">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium text-gray-900">{orderData.customer_phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="font-medium text-gray-900">
                    {new Date(orderData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Order Receipt */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Receipt
              </h3>
              
              <div className="space-y-3 border-b border-dashed border-gray-200 pb-4 mb-4 text-sm">
                {localItems.length > 0 ? (
                  localItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start">
                      <div className="pr-4">
                        <span className="font-medium text-gray-900">{item.name}</span>
                        <span className="text-gray-500 ml-2">x{item.quantity}</span>
                        {item.instruction && (
                           <p className="text-xs text-orange-500 italic mt-0.5">Note: {item.instruction}</p>
                        )}
                      </div>
                      <span className="font-medium text-gray-900 shrink-0">৳{item.price * item.quantity}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500">
                    <p>{orderData.items_summary}</p>
                    <p className="text-xs text-gray-400 mt-2">(Detailed items not available after page refresh)</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>৳{orderData.total_amount - deliveryFee}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span>৳{deliveryFee}</span>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between font-bold text-lg text-gray-900">
                <span>Total Amount</span>
                <span>৳{orderData.total_amount}</span>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
