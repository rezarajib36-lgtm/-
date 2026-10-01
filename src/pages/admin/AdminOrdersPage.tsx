import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, Filter, Eye, Phone, MapPin, Clock, MessageCircle, Utensils, X, 
  CheckCircle2, ChevronRight, AlertCircle, Printer, Trash2, AlertTriangle, 
  Check, Plus, Edit3, Calendar, TrendingUp, DollarSign 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatWhatsAppNumber } from '../../utils';
import { parseOrderItems } from '../../utils/thermalPrinter';
import ThermalReceiptModal from '../../components/admin/ThermalReceiptModal';
import AddFoodToOrderModal from '../../components/admin/AddFoodToOrderModal';
import EditOrderItemsModal from '../../components/admin/EditOrderItemsModal';

const STATUS_COLORS: Record<string, string> = {
  "Pending": "bg-orange-100 text-orange-800 border-orange-200",
  "Preparing": "bg-blue-100 text-blue-800 border-blue-200",
  "Ready": "bg-purple-100 text-purple-800 border-purple-200",
  "Out for Delivery": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Delivered": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Cancelled": "bg-red-100 text-red-800 border-red-200",
};

export default function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get('date');

  const [filter, setFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState<string>(dateParam || 'All');
  const [customDate, setCustomDate] = useState<string>(dateParam || '');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Instant Fast Load: Load existing orders immediately from local storage with 0ms waiting!
  const [orders, setOrders] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return false;
        }
      } catch (e) {}
    }
    return true;
  });

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [printingOrder, setPrintingOrder] = useState<any | null>(null);
  const [addingFoodOrder, setAddingFoodOrder] = useState<any | null>(null);
  const [editingFoodOrder, setEditingFoodOrder] = useState<any | null>(null);

  // Sync date filter with URL parameter
  useEffect(() => {
    if (dateParam) {
      setDateFilter(dateParam);
      setCustomDate(dateParam);
    }
  }, [dateParam]);

  // Order Deletion States
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const [clearType, setClearType] = useState<'completed' | 'old30' | 'all'>('completed');
  const [isClearing, setIsClearing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to real-time changes on the orders table
    const subscription = supabase
      ?.channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      if (subscription && supabase) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  async function fetchOrders() {
    try {
      let remoteOrders: any[] = [];
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && data) {
            remoteOrders = data;
          }
        } catch (err) {
          console.warn('Supabase fetch error, using local fallback:', err);
        }
      }

      // Fetch local storage backup orders
      let localOrders: any[] = [];
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) localOrders = JSON.parse(stored);
      } catch (err) {
        console.error('Error parsing local orders:', err);
      }

      // Merge remote and local without duplicates (matched by order_number or id)
      const combined = [...remoteOrders];
      localOrders.forEach(local => {
        const alreadyExists = combined.some(
          r => (local.order_number && r.order_number === local.order_number) || (local.id && r.id === local.id)
        );
        if (!alreadyExists) {
          combined.push(local);
        }
      });

      // Sort newest first
      combined.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setOrders(combined);
      try {
        localStorage.setItem('restaurant_local_orders', JSON.stringify(combined));
      } catch (e) {}
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(orderId: string, newStatus: string) {
    try {
      if (supabase) {
        try {
          await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);
        } catch (err) {
          console.warn('Remote status update error:', err);
        }
      }

      // Update local storage copy as well
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) {
          const locals = JSON.parse(stored);
          const updated = locals.map((o: any) => o.id === orderId ? { ...o, status: newStatus } : o);
          localStorage.setItem('restaurant_local_orders', JSON.stringify(updated));
        }
      } catch (e) {
        console.error(e);
      }
      
      // Update local state immediately
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  }

  // Delete a single order from Supabase, localStorage and local state
  async function handleDeleteSingleOrder(order: any) {
    if (!order) return;
    setIsDeletingSingle(true);
    try {
      // 1. Supabase deletion
      if (supabase) {
        try {
          if (order.id) {
            await supabase.from('orders').delete().eq('id', order.id);
          }
          if (order.order_number) {
            await supabase.from('orders').delete().eq('order_number', order.order_number);
          }
        } catch (err) {
          console.warn('Supabase delete error:', err);
        }
      }

      // 2. LocalStorage backup deletion
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) {
          const locals = JSON.parse(stored);
          const updated = locals.filter((o: any) => 
            (order.id ? o.id !== order.id : true) && 
            (order.order_number ? o.order_number !== order.order_number : true)
          );
          localStorage.setItem('restaurant_local_orders', JSON.stringify(updated));
        }
      } catch (e) {
        console.error('Local order delete error:', e);
      }

      // 3. Update React state
      setOrders(prev => prev.filter(o => 
        (order.id ? o.id !== order.id : true) && 
        (order.order_number ? o.order_number !== order.order_number : true)
      ));

      if (selectedOrder && (selectedOrder.id === order.id || selectedOrder.order_number === order.order_number)) {
        setSelectedOrder(null);
      }

      setOrderToDelete(null);
      showToast(`অর্ডার #${order.order_number} সফলভাবে মুছে ফেলা হয়েছে`, 'success');
    } catch (err) {
      console.error('Error deleting single order:', err);
      showToast('অর্ডার ডিলিট করতে সমস্যা হয়েছে', 'error');
    } finally {
      setIsDeletingSingle(false);
    }
  }

  // Clear order history (completed, older than 30 days, or all)
  async function handleClearHistory() {
    setIsClearing(true);
    try {
      const now = new Date().getTime();
      let targetOrders: any[] = [];

      if (clearType === 'completed') {
        targetOrders = orders.filter(o => o.status === 'Delivered' || o.status === 'Cancelled');
      } else if (clearType === 'old30') {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        targetOrders = orders.filter(o => {
          const orderTime = new Date(o.created_at || 0).getTime();
          return (now - orderTime) > thirtyDaysMs;
        });
      } else {
        // all
        targetOrders = [...orders];
      }

      if (targetOrders.length === 0) {
        showToast('মুছে ফেলার মতো কোনো অর্ডার পাওয়া যায়নি', 'error');
        setShowClearHistoryModal(false);
        setIsClearing(false);
        return;
      }

      const idsToDelete = targetOrders.map(o => o.id).filter(Boolean);
      const numbersToDelete = targetOrders.map(o => o.order_number).filter(Boolean);

      // 1. Supabase deletion
      if (supabase) {
        try {
          if (clearType === 'all') {
            await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          } else if (clearType === 'completed') {
            await supabase.from('orders').delete().in('status', ['Delivered', 'Cancelled']);
          } else if (idsToDelete.length > 0) {
            for (let i = 0; i < idsToDelete.length; i += 50) {
              const chunk = idsToDelete.slice(i, i + 50);
              await supabase.from('orders').delete().in('id', chunk);
            }
          }
        } catch (err) {
          console.warn('Supabase bulk delete error:', err);
        }
      }

      // 2. LocalStorage deletion
      try {
        if (clearType === 'all') {
          localStorage.removeItem('restaurant_local_orders');
        } else {
          const stored = localStorage.getItem('restaurant_local_orders');
          if (stored) {
            const locals = JSON.parse(stored);
            const updated = locals.filter((o: any) => 
              !idsToDelete.includes(o.id) && !numbersToDelete.includes(o.order_number)
            );
            localStorage.setItem('restaurant_local_orders', JSON.stringify(updated));
          }
        }
      } catch (e) {
        console.error('Local order clear error:', e);
      }

      // 3. State update
      setOrders(prev => prev.filter(o => 
        !idsToDelete.includes(o.id) && !numbersToDelete.includes(o.order_number)
      ));

      if (selectedOrder && (idsToDelete.includes(selectedOrder.id) || numbersToDelete.includes(selectedOrder.order_number))) {
        setSelectedOrder(null);
      }

      setShowClearHistoryModal(false);
      showToast(`${targetOrders.length} টি অর্ডার সফলভাবে হিস্টোরি থেকে মুছে ফেলা হয়েছে`, 'success');
    } catch (err) {
      console.error('Error clearing history:', err);
      showToast('অর্ডার হিস্টোরি মুছতে সমস্যা হয়েছে', 'error');
    } finally {
      setIsClearing(false);
    }
  }

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Filter and search logic with Status and Date Filter
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Status Filter
      const matchesStatus = filter === 'All' || o.status === filter;

      // 2. Date Filter
      let matchesDate = true;
      if (dateFilter !== 'All') {
        if (!o.created_at) {
          matchesDate = false;
        } else {
          const d = new Date(o.created_at);
          if (isNaN(d.getTime())) {
            matchesDate = false;
          } else {
            const orderDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (dateFilter === 'Today') {
              matchesDate = orderDateStr === todayStr;
            } else if (dateFilter === 'Yesterday') {
              matchesDate = orderDateStr === yesterdayStr;
            } else {
              matchesDate = orderDateStr === dateFilter;
            }
          }
        }
      }

      // 3. Search query
      const query = searchTerm.toLowerCase().trim();
      if (!query) return matchesStatus && matchesDate;

      const matchesSearch = 
        (o.order_number && o.order_number.toLowerCase().includes(query)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(query)) ||
        (o.customer_phone && o.customer_phone.toLowerCase().includes(query)) ||
        (o.location && o.location.toLowerCase().includes(query)) ||
        (o.items_summary && o.items_summary.toLowerCase().includes(query));

      return matchesStatus && matchesDate && matchesSearch;
    });
  }, [orders, filter, dateFilter, searchTerm, todayStr, yesterdayStr]);

  // Sales totals for the filtered subset and today
  const filteredSalesSum = useMemo(() => {
    return filteredOrders
      .filter(o => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  }, [filteredOrders]);

  const todaySalesSum = useMemo(() => {
    return orders
      .filter(o => {
        if (!o.created_at || o.status === 'Cancelled') return false;
        const d = new Date(o.created_at);
        if (isNaN(d.getTime())) return false;
        const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return str === todayStr;
      })
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  }, [orders, todayStr]);

  // Helper to render items in a visually clear chip list with individual item prices
  const renderItemsBadges = (summary: string, totalAmount?: number) => {
    if (!summary || summary.trim() === '') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
          <AlertCircle size={12} /> কোনো আইটেম পাওয়া যায়নি
        </span>
      );
    }

    const items = parseOrderItems(summary, totalAmount);
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, idx) => (
          <span 
            key={idx} 
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/90 text-amber-950 border border-amber-200 rounded-lg text-xs font-semibold shadow-2xs"
          >
            <span className="bg-amber-200/90 text-amber-950 px-1.5 py-0.5 rounded text-[11px] font-black">
              {it.qty}x
            </span>
            <span className="font-bold text-gray-900">{it.name}</span>
            {it.price > 0 && (
              <span className="bg-white text-amber-950 px-1.5 py-0.5 rounded border border-amber-300 text-[11px] font-extrabold shadow-2xs">
                ৳{it.price}{it.qty > 1 ? ` (৳${it.total})` : ''}
              </span>
            )}
            {it.note && (
              <span className="text-[10px] text-amber-800 italic">
                ({it.note})
              </span>
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col pb-12">
      {/* Slim & Space-Saving Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
            <span>অর্ডার সমূহ</span>
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold">
              {filteredOrders.length} টি
            </span>
          </h1>

          {/* Compact Live Sales Chip */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/90 rounded-xl text-xs font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>আজকের বিক্রি: <strong className="text-emerald-950 font-black">৳{todaySalesSum.toLocaleString()}</strong></span>
            {dateFilter !== 'All' && (
              <span className="text-emerald-700 font-semibold border-l border-emerald-200 pl-1.5 ml-0.5">
                ফিল্টারে: ৳{filteredSalesSum.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Compact Right Actions: Date Selector + Clear History */}
        <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto justify-between sm:justify-end">
          {/* Quick Date Select Dropdown & Picker */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1 shadow-2xs text-xs">
            <Calendar size={13} className="text-gray-500 shrink-0" />
            <select
              value={dateFilter}
              onChange={(e) => {
                const val = e.target.value;
                setDateFilter(val);
                if (val === 'Today') setSearchParams({ date: todayStr });
                else if (val === 'Yesterday') setSearchParams({ date: yesterdayStr });
                else if (val === 'All') {
                  setCustomDate('');
                  setSearchParams({});
                } else {
                  setSearchParams({ date: val });
                }
              }}
              className="bg-transparent text-gray-800 font-bold py-0.5 px-0.5 outline-none text-xs cursor-pointer"
            >
              <option value="All">সব দিন</option>
              <option value="Today">🟢 আজ</option>
              <option value="Yesterday">🟡 গতকাল</option>
              {customDate && customDate !== todayStr && customDate !== yesterdayStr && (
                <option value={customDate}>📆 {customDate}</option>
              )}
            </select>

            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                const val = e.target.value;
                setCustomDate(val);
                if (val) {
                  setDateFilter(val);
                  setSearchParams({ date: val });
                } else {
                  setDateFilter('All');
                  setSearchParams({});
                }
              }}
              className="w-5 h-5 opacity-60 hover:opacity-100 cursor-pointer text-xs ml-0.5"
              title="ক্যালেন্ডার থেকে নির্দিষ্ট দিন বেছে নিন"
            />
          </div>

          {/* Clear History Button */}
          {orders.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearHistoryModal(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-gray-200 hover:border-red-200 shadow-2xs cursor-pointer"
              title="অর্ডার হিস্টোরি ডিলিট বা ক্লিয়ার করুন"
            >
              <Trash2 size={13} className="text-red-500" />
              <span>মুছুন</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 flex-1 overflow-hidden flex flex-col">
        {/* Integrated Filter Toolbar */}
        <div className="p-2.5 sm:p-3 border-b border-gray-100 flex items-center justify-between gap-2.5 bg-gray-50/40">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none w-full">
            {['All', 'Preparing', 'Ready', 'Delivered'].map(status => {
              const count = status === 'All' 
                ? orders.length 
                : orders.filter(o => o.status === status).length;
              return (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    filter === status 
                      ? 'bg-gray-900 text-white shadow-2xs' 
                      : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200/70'
                  }`}
                >
                  <span>{status === 'All' ? 'সব অর্ডার' : status}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filter === status ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Filter Active Notification Chip */}
        {dateFilter !== 'All' && (
          <div className="px-4 py-2 bg-amber-50/80 border-b border-amber-100 text-xs flex items-center justify-between">
            <span className="font-semibold text-amber-900">
              📅 ফিল্টার: {dateFilter === 'Today' ? 'আজকের দিন' : dateFilter === 'Yesterday' ? 'গতকাল' : dateFilter} — মোট বিক্রি: <strong>৳{filteredSalesSum.toLocaleString()}</strong> ({filteredOrders.length}টি অর্ডার)
            </span>
            <button
              onClick={() => {
                setDateFilter('All');
                setCustomDate('');
                setSearchParams({});
              }}
              className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
            >
              সব দিন দেখুন
            </button>
          </div>
        )}

        {/* Orders Content Area */}
        <div className="flex-1 overflow-x-auto">
          {loading ? (
            <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-3"></div>
              <p className="text-sm">অর্ডারসমূহ লোড হচ্ছে...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center">
              <Utensils size={36} className="text-gray-300 mb-2" />
              <p className="text-base font-bold text-gray-700">কোনো অর্ডার পাওয়া যায়নি</p>
              <p className="text-xs text-gray-400 mt-1">কাস্টমার অর্ডার করলে সরাসরি এখানে তালিকা চলে আসবে।</p>
            </div>
          ) : (
            <>
              {/* MOBILE CARD VIEW (Phone / Small Screen) */}
              <div className="block lg:hidden divide-y divide-gray-100">
                {filteredOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="p-4 hover:bg-gray-50/70 transition-colors space-y-3 cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    {/* Top Row: Order ID, Type, Amount, Delete Action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900 text-base">{order.order_number}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          order.order_type === 'Dine-in' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.order_type === 'Dine-in' ? `টেবিল: ${order.location}` : 'ডেলিভারি'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold text-gray-900">৳{order.total_amount}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderToDelete(order);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 cursor-pointer active:scale-95"
                          title="অর্ডারটি মুছে ফেলুন"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* PROMINENT ORDERED FOOD SECTION (খাবারসমূহ) */}
                    <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3 shadow-2xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                          <Utensils size={14} className="text-amber-700" />
                          <span>অর্ডারকৃত খাবার:</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFoodOrder(order);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-900 bg-white hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs transition-colors cursor-pointer"
                            title="অর্ডারের খাবার কম-বেশি বা ডিলেট করতে কারেকশন করুন"
                          >
                            <Edit3 size={11} className="text-amber-800" />
                            <span>কারেকশন</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddingFoodOrder(order);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-900 bg-white hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs transition-colors cursor-pointer"
                            title="এই অর্ডারে আরও নতুন খাবার যুক্ত করুন"
                          >
                            <Plus size={11} className="text-amber-800" />
                            <span>+ যোগ</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrintingOrder(order);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-amber-950 bg-amber-200/90 hover:bg-amber-300 px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs transition-colors cursor-pointer"
                            title="মোবাইল প্রিন্টারে রসিদ প্রিন্ট করুন"
                          >
                            <Printer size={12} className="text-amber-900" />
                            <span>প্রিন্ট</span>
                          </button>
                        </div>
                      </div>
                      <div>
                        {renderItemsBadges(order.items_summary, order.total_amount)}
                      </div>
                    </div>

                    {/* Customer Info & Status Row */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{order.customer_name || 'N/A'}</span>
                        {order.customer_phone && order.customer_phone !== 'প্রযোজ্য নয়' && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600">{order.customer_phone}</span>
                            <a
                              href={`https://api.whatsapp.com/send?phone=${formatWhatsAppNumber(order.customer_phone)}&text=${encodeURIComponent(`হ্যালো ${order.customer_name}, আপনার ${order.order_number} অর্ডার সংক্রান্ত তথ্য:`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200"
                              title="WhatsApp Chat"
                            >
                              <MessageCircle size={11} className="text-emerald-600" />
                              <span>Chat</span>
                            </a>
                          </>
                        )}
                      </div>

                      {/* Status Dropdown */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <select 
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border outline-none cursor-pointer ${STATUS_COLORS[order.status] || STATUS_COLORS['Pending']}`}
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Preparing">Preparing</option>
                          <option value="Ready">Ready</option>
                          <option value="Out for Delivery">Out for Delivery</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE VIEW */}
              <table className="hidden lg:table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-600 text-xs uppercase font-bold border-b border-gray-100 tracking-wider">
                    <th className="py-3.5 px-6">অর্ডার নং ও সময়</th>
                    <th className="py-3.5 px-6">কাস্টমার</th>
                    <th className="py-3.5 px-6">ধরণ ও স্থান</th>
                    <th className="py-3.5 px-6 min-w-[280px]">অর্ডারকৃত খাবারসমূহ (Ordered Food)</th>
                    <th className="py-3.5 px-6">টোটাল বিল</th>
                    <th className="py-3.5 px-6">স্ট্যাটাস</th>
                    <th className="py-3.5 px-6 text-right">বিস্তারিত</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredOrders.map((order) => (
                    <tr 
                      key={order.id} 
                      className="hover:bg-gray-50/70 transition-colors group cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      {/* Order ID & Time */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-gray-900">{order.order_number}</span>
                          <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock size={12} /> {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      
                      {/* Customer Info */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900">{order.customer_name || 'N/A'}</span>
                          {order.customer_phone && order.customer_phone !== 'প্রযোজ্য নয়' ? (
                            <>
                              <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Phone size={12} /> {order.customer_phone}
                              </span>
                              <a
                                href={`https://api.whatsapp.com/send?phone=${formatWhatsAppNumber(order.customer_phone)}&text=${encodeURIComponent(`হ্যালো ${order.customer_name}, ${order.order_number} অর্ডার সংক্রান্ত তথ্য:`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded mt-1 transition-colors w-fit border border-emerald-200"
                                title="কাস্টমারকে হোয়াটসঅ্যাপে মেসেজ পাঠান"
                              >
                                <MessageCircle size={10} className="text-emerald-600" />
                                <span>WhatsApp</span>
                              </a>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 mt-0.5 italic">ফোন নম্বর দেওয়া হয়নি</span>
                          )}
                        </div>
                      </td>
                      
                      {/* Order Type & Location */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold capitalize ${
                            order.order_type === 'Dine-in' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {order.order_type}
                          </span>
                          <span className="text-xs text-gray-600 flex items-center gap-1 font-medium">
                            {order.order_type === 'Delivery' ? <MapPin size={13} className="text-gray-400 shrink-0"/> : null}
                            <span className="truncate max-w-[140px]">{order.location}</span>
                          </span>
                        </div>
                      </td>
                      
                      {/* ORDERED FOOD ITEMS (HIGH VISIBILITY) */}
                      <td className="py-4 px-6">
                        <div className="max-w-[340px]">
                          {renderItemsBadges(order.items_summary, order.total_amount)}
                        </div>
                      </td>
                      
                      {/* Amount */}
                      <td className="py-4 px-6 font-extrabold text-gray-900">
                        ৳{order.total_amount}
                      </td>
                      
                      {/* Status Dropdown */}
                      <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                        <select 
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border outline-none cursor-pointer ${STATUS_COLORS[order.status] || STATUS_COLORS['Pending']}`}
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Preparing">Preparing</option>
                          <option value="Ready">Ready</option>
                          <option value="Out for Delivery">Out for Delivery</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      
                      {/* Action */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFoodOrder(order);
                            }}
                            className="px-2.5 py-1.5 text-xs font-bold text-stone-900 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors inline-flex items-center gap-1 border border-amber-300 shadow-2xs cursor-pointer"
                            title="অর্ডারের খাবার কম বেশি বা ডিলেট করতে কারেকশন করুন"
                          >
                            <Edit3 size={13} className="text-amber-800" />
                            <span>কারেকশন</span>
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddingFoodOrder(order);
                            }}
                            className="px-2.5 py-1.5 text-xs font-bold text-stone-900 bg-stone-50 hover:bg-stone-100 rounded-lg transition-colors inline-flex items-center gap-1 border border-stone-300 shadow-2xs cursor-pointer"
                            title="এই অর্ডারে আরও নতুন খাবার যুক্ত করুন"
                          >
                            <Plus size={13} className="text-stone-700" />
                            <span>+ খাবার যোগ</span>
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrintingOrder(order);
                            }}
                            className="px-2.5 py-1.5 text-xs font-bold text-stone-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors inline-flex items-center gap-1.5 border border-amber-300 shadow-2xs cursor-pointer"
                            title="থার্মাল রসিদ ও কিচেন টোকেন প্রিন্ট করুন"
                          >
                            <Printer size={13} className="text-amber-900" />
                            <span>প্রিন্ট</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="px-3 py-1.5 text-xs font-bold text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1.5 border border-gray-200 cursor-pointer"
                          >
                            <Eye size={13} />
                            <span>রসিদ দেখুন</span>
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrderToDelete(order);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center border border-gray-200 hover:border-red-200 cursor-pointer active:scale-95"
                            title="অর্ডারটি মুছে ফেলুন"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* FULL ORDER DETAILS MODAL (অর্ডারের সম্পূর্ণ রসিদ / বিবরণ) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80 rounded-t-3xl sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-gray-900">{selectedOrder.order_number}</h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_COLORS[selectedOrder.status]}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Clock size={12} /> {new Date(selectedOrder.created_at).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              
              {/* Customer Information Card */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  কাস্টমারের বিবরণ (Customer Details)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-gray-500 block">কাস্টমারের নাম:</span>
                    <span className="font-bold text-gray-900">{selectedOrder.customer_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">মোবাইল নম্বর:</span>
                    <span className="font-bold text-gray-900">
                      {selectedOrder.customer_phone && selectedOrder.customer_phone !== 'প্রযোজ্য নয়' 
                        ? selectedOrder.customer_phone 
                        : 'দেওয়া হয়নি (ঐচ্ছিক)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">অর্ডারের ধরণ:</span>
                    <span className="font-bold text-gray-900 capitalize">{selectedOrder.order_type}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">টেবিল / ডেলিভারি ঠিকানা:</span>
                    <span className="font-bold text-gray-900">{selectedOrder.location}</span>
                  </div>
                </div>

                {/* WhatsApp button */}
                {selectedOrder.customer_phone && selectedOrder.customer_phone !== 'প্রযোজ্য নয়' && (
                  <div className="mt-3 pt-3 border-t border-gray-200/60 flex items-center justify-between">
                    <span className="text-xs text-gray-600">কাস্টমারের সাথে যোগাযোগ করুন:</span>
                    <a
                      href={`https://api.whatsapp.com/send?phone=${formatWhatsAppNumber(selectedOrder.customer_phone)}&text=${encodeURIComponent(`হ্যালো ${selectedOrder.customer_name}, ${selectedOrder.order_number} অর্ডার সংক্রান্ত তথ্য:`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      <MessageCircle size={14} />
                      <span>হোয়াটসঅ্যাপ মেসেজ পাঠান</span>
                    </a>
                  </div>
                )}
              </div>

              {/* DETAILED ORDERED FOOD LIST (খাবারসমূহ) */}
              <div className="border border-amber-200/80 bg-amber-50/50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-200 text-amber-900 rounded-lg">
                      <Utensils size={16} />
                    </div>
                    <h3 className="font-bold text-gray-900 text-base">
                      অর্ডারকৃত খাবার ও আইটেমসমূহ
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingFoodOrder(selectedOrder)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                      title="অর্ডারের খাবার কম-বেশি করুন বা আইটেম মুছে ফেলুন"
                    >
                      <Edit3 size={14} />
                      <span>খাবার কারেকশন / কম-বেশি</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingFoodOrder(selectedOrder)}
                      className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-stone-900 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95 border border-amber-300"
                      title="এই অর্ডারে আরও নতুন খাবার যোগ করুন"
                    >
                      <Plus size={13} className="text-amber-800" />
                      <span>+ খাবার যোগ</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3.5 border border-amber-200/60 divide-y divide-gray-100">
                  {selectedOrder.items_summary ? (
                    parseOrderItems(selectedOrder.items_summary, selectedOrder.total_amount).map((item, i) => (
                      <div key={i} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-black text-xs shrink-0 mt-0.5">
                            {item.qty}x
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                              {item.price > 0 && (
                                <span className="bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded text-xs font-black">
                                  প্রতিটি ৳{item.price} {item.qty > 1 ? `• মোট ৳${item.total}` : ''}
                                </span>
                              )}
                            </div>
                            {item.note && (
                              <p className="text-xs text-amber-800 italic mt-0.5">
                                বিশেষ নির্দেশনা: {item.note}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <button
                            type="button"
                            onClick={() => setEditingFoodOrder(selectedOrder)}
                            className="px-2 py-0.5 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                            title="এই খাবারটি কম-বেশি বা ডিলেট করুন"
                          >
                            <Edit3 size={11} />
                            <span>কারেকশন</span>
                          </button>
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 italic py-2">কোনো আইটেম সংরক্ষিত নেই</p>
                  )}
                </div>

                {/* Total Summary */}
                <div className="mt-4 pt-3 border-t border-amber-200 flex justify-between items-center">
                  <span className="font-bold text-gray-700 text-sm">সর্বমোট পরিশোধযোগ্য:</span>
                  <span className="text-xl font-black text-gray-900">৳{selectedOrder.total_amount}</span>
                </div>
              </div>

              {/* Status Update Controls */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  অর্ডারের স্ট্যাটাস পরিবর্তন করুন (Update Status)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Pending', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleStatusChange(selectedOrder.id, status)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                        selectedOrder.status === status
                          ? `${STATUS_COLORS[status]} ring-2 ring-gray-900 shadow-xs font-extrabold`
                          : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 rounded-b-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddingFoodOrder(selectedOrder)}
                  className="px-3.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer active:scale-95"
                  title="এই অর্ডারে আরও নতুন খাবার যোগ করুন"
                >
                  <Plus size={15} className="text-amber-400" />
                  <span>+ খাবার যোগ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingOrder(selectedOrder)}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <Printer size={16} />
                  <span>বিল ও কিচেন প্রিন্ট (RPPO2N / Bluetooth)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderToDelete(selectedOrder)}
                  className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-red-50 text-red-600 hover:text-red-700 font-bold text-xs sm:text-sm flex items-center gap-1.5 border border-gray-200 hover:border-red-300 transition-colors cursor-pointer active:scale-95"
                  title="এই অর্ডারটি মুছে ফেলুন"
                >
                  <Trash2 size={15} />
                  <span>অর্ডার মুছুন</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-bold text-xs sm:text-sm hover:bg-gray-800 transition-colors cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SINGLE ORDER DELETE CONFIRMATION MODAL */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">অর্ডারটি মুছে ফেলতে চান?</h3>
                <p className="text-xs text-gray-500">স্থায়ীভাবে অর্ডার রেকর্ড মুছে ফেলা হবে</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/60 mb-5 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs">অর্ডার নম্বর:</span>
                <span className="font-extrabold text-gray-900">{orderToDelete.order_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs">কাস্টমারের নাম:</span>
                <span className="font-bold text-gray-800">{orderToDelete.customer_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs">মোট বিল:</span>
                <span className="font-black text-gray-900 text-base">৳{orderToDelete.total_amount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs">স্ট্যাটাস:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${STATUS_COLORS[orderToDelete.status] || 'bg-gray-100 text-gray-800'}`}>
                  {orderToDelete.status}
                </span>
              </div>
            </div>

            <p className="text-xs text-red-700 bg-red-50 p-3 rounded-xl border border-red-200/60 mb-6 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
              <span>সতর্কতা: এটি নিশ্চিত করলে ডাটাবেস ও লোকাল মেমোরি থেকে অর্ডারটির সমস্ত বিবরণ স্থায়ীভাবে মুছে যাবে এবং তা আর পুনরুদ্ধার করা সম্ভব হবে না।</span>
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={isDeletingSingle}
                onClick={() => handleDeleteSingleOrder(orderToDelete)}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingSingle ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>মুছে ফেলা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>হ্যাঁ, মুছে ফেলুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK CLEAR ORDER HISTORY MODAL */}
      {showClearHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 size={22} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900">অর্ডার হিস্টোরি মুছুন</h3>
                  <p className="text-xs text-gray-500">পুরোনো ও অতিরিক্ত হিস্টোরি ক্লিয়ার করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClearHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-4 font-medium">
              আপনার প্রয়োজন অনুযায়ী নিচে থেকে একটি অপশন নির্বাচন করুন:
            </p>

            {/* Clear Type Options */}
            <div className="space-y-3 mb-6">
              {/* Option 1: Delivered & Cancelled */}
              {(() => {
                const count = orders.filter(o => o.status === 'Delivered' || o.status === 'Cancelled').length;
                return (
                  <label 
                    onClick={() => setClearType('completed')}
                    className={`block p-4 rounded-2xl border transition-all cursor-pointer ${
                      clearType === 'completed'
                        ? 'border-gray-900 bg-amber-50/40 ring-2 ring-gray-900 shadow-xs'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="clear_type"
                          checked={clearType === 'completed'}
                          onChange={() => setClearType('completed')}
                          className="mt-1 text-gray-900 focus:ring-gray-900 cursor-pointer"
                        />
                        <div>
                          <p className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                            <span>সম্পন্ন ও বাতিলকৃত অর্ডার মুছুন</span>
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              প্রস্তাবিত / নিরাপদ
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            চলমান (Pending/Preparing/Ready) কোনো অর্ডার নষ্ট হবে না, শুধু ডেলিভার্ড ও ক্যান্সেল হওয়া অর্ডারগুলো সাফ করা হবে।
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black bg-gray-100 text-gray-800 px-2.5 py-1 rounded-lg shrink-0 ml-2">
                        {count} টি
                      </span>
                    </div>
                  </label>
                );
              })()}

              {/* Option 2: Older than 30 days */}
              {(() => {
                const now = new Date().getTime();
                const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
                const count = orders.filter(o => (now - new Date(o.created_at || 0).getTime()) > thirtyDaysMs).length;
                return (
                  <label 
                    onClick={() => setClearType('old30')}
                    className={`block p-4 rounded-2xl border transition-all cursor-pointer ${
                      clearType === 'old30'
                        ? 'border-gray-900 bg-amber-50/40 ring-2 ring-gray-900 shadow-xs'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="clear_type"
                          checked={clearType === 'old30'}
                          onChange={() => setClearType('old30')}
                          className="mt-1 text-gray-900 focus:ring-gray-900 cursor-pointer"
                        />
                        <div>
                          <p className="font-extrabold text-gray-900 text-sm">
                            ৩০ দিনের পুরোনো অর্ডার মুছুন
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            গত ৩০ দিনের আগের পুরোনো অর্ডার হিস্টোরি মুছে ডাটাবেস ফ্রেশ রাখবে।
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black bg-gray-100 text-gray-800 px-2.5 py-1 rounded-lg shrink-0 ml-2">
                        {count} টি
                      </span>
                    </div>
                  </label>
                );
              })()}

              {/* Option 3: Clear All */}
              <label 
                onClick={() => setClearType('all')}
                className={`block p-4 rounded-2xl border transition-all cursor-pointer ${
                  clearType === 'all'
                    ? 'border-red-600 bg-red-50/60 ring-2 ring-red-600 shadow-xs'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="clear_type"
                      checked={clearType === 'all'}
                      onChange={() => setClearType('all')}
                      className="mt-1 text-red-600 focus:ring-red-600 cursor-pointer"
                    />
                    <div>
                      <p className="font-extrabold text-red-900 text-sm flex items-center gap-2">
                        <span>সব অর্ডার সম্পূর্ণ মুছে ফেলুন</span>
                        <span className="text-[10px] font-black bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                          সতর্কতা
                        </span>
                      </p>
                      <p className="text-xs text-red-700/80 mt-1">
                        পেন্ডিং ও রানিং সহ বর্তমান ও অতীতের সমস্ত অর্ডার ডাটাবেস ও লোকাল মেমোরি থেকে সম্পূর্ণ খালি হয়ে যাবে।
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black bg-red-100 text-red-900 px-2.5 py-1 rounded-lg shrink-0 ml-2">
                    {orders.length} টি
                  </span>
                </div>
              </label>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setShowClearHistoryModal(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={handleClearHistory}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isClearing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>হিস্টোরি মোছা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>হ্যাঁ, হিস্টোরি মুছুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION TOAST */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold animate-in fade-in slide-in-from-bottom-3 duration-200 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-900 text-white border-emerald-800' 
            : 'bg-red-900 text-white border-red-800'
        }`}>
          {toastMessage.type === 'success' ? (
            <Check size={18} className="text-emerald-300 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-red-300 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Add Food to Existing Order Modal */}
      {addingFoodOrder && (
        <AddFoodToOrderModal
          order={addingFoodOrder}
          onClose={() => setAddingFoodOrder(null)}
          onOrderUpdated={(updatedOrder, shouldPrint) => {
            // Update in orders list
            setOrders(prev => prev.map(o => 
              (o.id === updatedOrder.id || o.order_number === updatedOrder.order_number) 
                ? updatedOrder 
                : o
            ));
            // Update selectedOrder if currently viewed
            if (selectedOrder && (selectedOrder.id === updatedOrder.id || selectedOrder.order_number === updatedOrder.order_number)) {
              setSelectedOrder(updatedOrder);
            }
            showToast(`অর্ডার #${updatedOrder.order_number} এ নতুন খাবার যোগ করা হয়েছে (নতুন সর্বমোট বিল: ৳${updatedOrder.total_amount})`, 'success');
            
            // If requested, immediately open thermal print preview
            if (shouldPrint) {
              setPrintingOrder(updatedOrder);
            }
          }}
        />
      )}

      {/* Edit / Correct Existing Order Items Modal */}
      {editingFoodOrder && (
        <EditOrderItemsModal
          order={editingFoodOrder}
          onClose={() => setEditingFoodOrder(null)}
          onOrderUpdated={(updatedOrder, shouldPrint) => {
            // Update in orders list
            setOrders(prev => prev.map(o => 
              (o.id === updatedOrder.id || o.order_number === updatedOrder.order_number) 
                ? updatedOrder 
                : o
            ));
            // Update selectedOrder if currently viewed
            if (selectedOrder && (selectedOrder.id === updatedOrder.id || selectedOrder.order_number === updatedOrder.order_number)) {
              setSelectedOrder(updatedOrder);
            }
            showToast(`অর্ডার #${updatedOrder.order_number} সফলভাবে সংশোধন করা হয়েছে (নতুন সর্বমোট বিল: ৳${updatedOrder.total_amount})`, 'success');
            
            // If requested, immediately open thermal print preview
            if (shouldPrint) {
              setPrintingOrder(updatedOrder);
            }
          }}
        />
      )}

      {/* Mobile Thermal Receipt & Bluetooth Printer Modal */}
      {printingOrder && (
        <ThermalReceiptModal 
          order={printingOrder} 
          onClose={() => setPrintingOrder(null)} 
          onOrderUpdated={(updatedOrder) => {
            // Update in orders list
            setOrders(prev => prev.map(o => 
              (o.id === updatedOrder.id || o.order_number === updatedOrder.order_number) 
                ? updatedOrder 
                : o
            ));
            // Update selectedOrder if currently open
            if (selectedOrder && (selectedOrder.id === updatedOrder.id || selectedOrder.order_number === updatedOrder.order_number)) {
              setSelectedOrder(updatedOrder);
            }
            // Update printingOrder so receipt stays synced
            setPrintingOrder(updatedOrder);
            showToast(`অর্ডার #${updatedOrder.order_number}-এ ডিসকাউন্ট আপডেট করা হয়েছে (নতুন সর্বমোট বিল: ৳${updatedOrder.total_amount})`, 'success');
          }}
        />
      )}
    </div>
  );
}
