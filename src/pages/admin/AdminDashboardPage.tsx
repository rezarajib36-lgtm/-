import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, ShoppingBag, Utensils, QrCode, UtensilsCrossed, ArrowRight, Edit3, 
  Clock, Calendar, TrendingUp, TrendingDown, BarChart3, CheckCircle2, AlertCircle, ChevronDown, DollarSign,
  Wallet, ArrowDownRight, ArrowUpRight, Receipt, RefreshCw, Bell, Sparkles, Store
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { getRestaurantSettings } from '../../lib/restaurantSettings';

const STATUS_COLORS: Record<string, string> = {
  "Pending": "bg-orange-100 text-orange-800 border-orange-200",
  "Preparing": "bg-blue-100 text-blue-800 border-blue-200",
  "Ready": "bg-purple-100 text-purple-800 border-purple-200",
  "Out for Delivery": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Delivered": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Cancelled": "bg-red-100 text-red-800 border-red-200",
};

const BANGLA_MONTHS: Record<number, string> = {
  0: 'জানুয়ারি',
  1: 'ফেব্রুয়ারি',
  2: 'মার্চ',
  3: 'এপ্রিল',
  4: 'মে',
  5: 'জুন',
  6: 'জুলাই',
  7: 'আগস্ট',
  8: 'সেপ্টেম্বর',
  9: 'অক্টোবর',
  10: 'নভেম্বর',
  11: 'ডিসেম্বর',
};

const BANGLA_DAYS: Record<number, string> = {
  0: 'রবিবার',
  1: 'সোমবার',
  2: 'মঙ্গলবার',
  3: 'বুধবার',
  4: 'বৃহস্পতিবার',
  5: 'শুক্রবার',
  6: 'শনিবার',
};

function toBanglaDigits(num: number | string): string {
  const digits: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
  };
  return String(num).replace(/[0-9]/g, w => digits[w] || w);
}

export default function AdminDashboardPage() {
  const settings = useMemo(() => getRestaurantSettings(), []);
  
  // Fast Instant Load: Load cached orders immediately
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

  // Fast Instant Load: Load cached expenses
  const [expenses, setExpenses] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const v4 = localStorage.getItem('restaurant_expenses_v4');
        if (v4) {
          const parsed = JSON.parse(v4);
          if (Array.isArray(parsed)) return parsed;
        }
        const stored = localStorage.getItem('restaurant_expenses');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Default month: Current YYYY-MM
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  // Time-based greeting helper (সকাল / দুপুর / বিকাল / রাত)
  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return 'শুভ সকাল';
    if (hr >= 12 && hr < 16) return 'শুভ দুপুর';
    if (hr >= 16 && hr < 19) return 'শুভ বিকাল';
    return 'শুভ রাত্রি';
  }, []);

  // Fetch Dashboard Data from Supabase and sync with localStorage
  const loadDashboardData = async () => {
    setIsRefreshing(true);
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
          console.warn("Supabase fetch error, fallback to local:", err);
        }
      }

      // Local backup orders
      let localOrders: any[] = [];
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) localOrders = JSON.parse(stored);
      } catch (e) {}

      // Merge remote and local without duplicates
      const combinedOrders = [...remoteOrders];
      localOrders.forEach(local => {
        const exists = combinedOrders.some(
          r => (local.order_number && r.order_number === local.order_number) || (local.id && r.id === local.id)
        );
        if (!exists) combinedOrders.push(local);
      });

      combinedOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setOrders(combinedOrders);
      try {
        localStorage.setItem('restaurant_local_orders', JSON.stringify(combinedOrders));
      } catch (e) {}

      // Load expenses from Supabase categories store or local
      let loadedExpenses: any[] = [];
      if (supabase) {
        try {
          const { data } = await supabase
            .from('categories')
            .select('name')
            .like('name', '__SYSTEM_EXPENSES__:%')
            .limit(1);

          if (data && data[0]?.name) {
            const raw = data[0].name.replace('__SYSTEM_EXPENSES__:', '');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) loadedExpenses = parsed;
          }
        } catch (e) {}
      }

      if (loadedExpenses.length === 0) {
        try {
          const v4 = localStorage.getItem('restaurant_expenses_v4');
          if (v4) {
            const parsed = JSON.parse(v4);
            if (Array.isArray(parsed) && parsed.length > 0) loadedExpenses = parsed;
          } else {
            const storedExp = localStorage.getItem('restaurant_expenses');
            if (storedExp) loadedExpenses = JSON.parse(storedExp);
          }
        } catch (e) {}
      }

      if (loadedExpenses.length > 0) {
        setExpenses(loadedExpenses);
      }

    } catch (e) {
      console.error("Failed to load dashboard orders", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Today and yesterday strings
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Available months list
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthKey);
    orders.forEach(o => {
      if (o.created_at) {
        const d = new Date(o.created_at);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          set.add(key);
        }
      }
    });
    return Array.from(set).sort().reverse();
  }, [orders, currentMonthKey]);

  // Orders in selected month
  const ordersInSelectedMonth = useMemo(() => {
    return orders.filter(o => {
      if (!o.created_at) return false;
      const d = new Date(o.created_at);
      if (isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [orders, selectedMonth]);

  // Monthly stats
  const monthlyStats = useMemo(() => {
    const totalOrders = ordersInSelectedMonth.length;
    const deliveredOrders = ordersInSelectedMonth.filter(o => o.status === 'Delivered').length;
    const cancelledOrders = ordersInSelectedMonth.filter(o => o.status === 'Cancelled').length;
    const pendingOrders = ordersInSelectedMonth.filter(o => o.status === 'Pending').length;
    
    // Total sales (excluding cancelled)
    const validSalesOrders = ordersInSelectedMonth.filter(o => o.status !== 'Cancelled');
    const totalSales = validSalesOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const avgOrderValue = validSalesOrders.length > 0 ? Math.round(totalSales / validSalesOrders.length) : 0;

    return {
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      pendingOrders,
      totalSales,
      avgOrderValue
    };
  }, [ordersInSelectedMonth]);

  // Daily breakdown for the selected month
  const dailyBreakdown = useMemo(() => {
    const map = new Map<string, {
      dateStr: string;
      dateObj: Date;
      totalSales: number;
      totalOrders: number;
      deliveredOrders: number;
      pendingOrders: number;
      cancelledOrders: number;
    }>();

    ordersInSelectedMonth.forEach(o => {
      if (!o.created_at) return;
      const d = new Date(o.created_at);
      if (isNaN(d.getTime())) return;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      let entry = map.get(dateStr);
      if (!entry) {
        entry = {
          dateStr,
          dateObj: d,
          totalSales: 0,
          totalOrders: 0,
          deliveredOrders: 0,
          pendingOrders: 0,
          cancelledOrders: 0,
        };
        map.set(dateStr, entry);
      }

      entry.totalOrders += 1;
      if (o.status === 'Delivered') entry.deliveredOrders += 1;
      else if (o.status === 'Pending') entry.pendingOrders += 1;
      else if (o.status === 'Cancelled') entry.cancelledOrders += 1;

      if (o.status !== 'Cancelled') {
        entry.totalSales += (Number(o.total_amount) || 0);
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    return list;
  }, [ordersInSelectedMonth]);

  const highestDailySales = useMemo(() => {
    if (dailyBreakdown.length === 0) return 1;
    const max = Math.max(...dailyBreakdown.map(d => d.totalSales));
    return max > 0 ? max : 1;
  }, [dailyBreakdown]);

  // Today's and Yesterday's sales
  const todayOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o.created_at) return false;
      const d = new Date(o.created_at);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return str === todayStr && o.status !== 'Cancelled';
    });
  }, [orders, todayStr]);

  const yesterdayOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o.created_at) return false;
      const d = new Date(o.created_at);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return str === yesterdayStr && o.status !== 'Cancelled';
    });
  }, [orders, yesterdayStr]);

  const todaySalesSum = todayOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const yesterdaySalesSum = yesterdayOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // Month label helper (e.g., সেপ্টেম্বর ২০২৬)
  const getMonthLabel = (key: string) => {
    const [year, month] = key.split('-');
    const monthNum = parseInt(month, 10) - 1;
    const banglaMonth = BANGLA_MONTHS[monthNum] || month;
    const banglaYear = toBanglaDigits(year);
    return `${banglaMonth} ${banglaYear}`;
  };

  // Current Month strictly automated calculations
  const currentMonthData = useMemo(() => {
    const curMonthOrders = orders.filter(o => {
      if (!o.created_at || o.status === 'Cancelled') return false;
      const d = new Date(o.created_at);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return str === currentMonthKey;
    });

    const totalSales = curMonthOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const curMonthExpenses = expenses.filter(e => e.date && e.date.startsWith(currentMonthKey));
    const totalExpenses = curMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const netProfit = totalSales - totalExpenses;
    const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    const expenseRatio = totalSales > 0 ? Math.min(100, Math.max(0, (totalExpenses / totalSales) * 100)) : (totalExpenses > 0 ? 100 : 0);

    return {
      totalSales,
      ordersCount: curMonthOrders.length,
      totalExpenses,
      expensesCount: curMonthExpenses.length,
      netProfit,
      profitMargin,
      expenseRatio,
      label: getMonthLabel(currentMonthKey)
    };
  }, [orders, expenses, currentMonthKey]);

  // Daily spending trends data for Recharts Line Chart
  const currentMonthDailySpending = useMemo(() => {
    const parts = currentMonthKey.split('-');
    const year = parseInt(parts[0], 10) || new Date().getFullYear();
    const month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    const curMonthExpenses = expenses.filter(e => e.date && e.date.startsWith(currentMonthKey));

    const dailyMap: Record<number, { amount: number; count: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      dailyMap[d] = { amount: 0, count: 0 };
    }

    curMonthExpenses.forEach(exp => {
      const p = exp.date.split('-');
      if (p.length === 3) {
        const d = parseInt(p[2], 10);
        if (d >= 1 && d <= daysInMonth) {
          dailyMap[d].amount += (Number(exp.amount) || 0);
          dailyMap[d].count += 1;
        }
      }
    });

    const today = new Date();
    const isThisMonth = (today.getFullYear() === year && (today.getMonth() + 1) === month);
    const lastDayToShow = isThisMonth ? Math.max(today.getDate(), 7) : daysInMonth;

    const chartData = [];
    for (let day = 1; day <= lastDayToShow; day++) {
      chartData.push({
        dayNumber: day,
        dayLabel: `${toBanglaDigits(day)} তারিখ`,
        shortDay: `${toBanglaDigits(day)}`,
        spending: dailyMap[day]?.amount || 0,
        count: dailyMap[day]?.count || 0
      });
    }

    return chartData;
  }, [expenses, currentMonthKey]);

  // Recent 6 orders
  const recentOrders = useMemo(() => orders.slice(0, 6), [orders]);
  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter(o => o.status === 'Pending').length;

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 pb-6">
      
      {/* ========================================================================= */}
      {/* 1. MOBILE APP GREETING & STATUS BANNER                                     */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-stone-900 rounded-3xl p-4 sm:p-6 text-white shadow-md relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -right-12 -top-12 w-44 h-44 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {settings.logo ? (
              <img 
                src={settings.logo} 
                alt="Logo" 
                className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-300 shadow-md shrink-0 bg-white" 
              />
            ) : (
              <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-amber-300 shadow-md shrink-0 border border-white/20">
                <UtensilsCrossed size={22} />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-amber-200 font-bold">
                <span>{greeting}!</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-emerald-300 font-extrabold">লাইভ</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black truncate tracking-tight text-white mt-0.5">
                {settings.name || 'রেস্টুরেন্ট ড্যাশবোর্ড'}
              </h1>
              <p className="text-[11px] text-amber-100/90 font-medium truncate mt-0.5">
                {new Date().toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Quick Refresh Button */}
          <button
            onClick={loadDashboardData}
            disabled={isRefreshing}
            className="p-2.5 rounded-2xl bg-white/15 hover:bg-white/25 active:scale-90 transition-all text-white backdrop-blur-md border border-white/20 shrink-0 cursor-pointer shadow-xs"
            title="ডাটা রিফ্রেশ করুন"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MOBILE APP QUICK ACTIONS ROW (Horizontal Touch Bar)                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {/* Quick Orders */}
        <Link
          to="/admin/orders"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-stone-200 shadow-xs hover:shadow-md active:scale-95 transition-all text-center group"
        >
          <div className="relative p-2.5 rounded-xl bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
            <ShoppingBag size={20} />
            {pendingOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-bounce">
                {toBanglaDigits(pendingOrdersCount)}
              </span>
            )}
          </div>
          <span className="text-[11px] font-extrabold text-stone-800 mt-1.5 truncate max-w-full">
            অর্ডারসমূহ
          </span>
        </Link>

        {/* Quick Expenses */}
        <Link
          to="/admin/expenses"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-stone-200 shadow-xs hover:shadow-md active:scale-95 transition-all text-center group"
        >
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
            <Receipt size={20} />
          </div>
          <span className="text-[11px] font-extrabold text-stone-800 mt-1.5 truncate max-w-full">
            + খরচ এন্ট্রি
          </span>
        </Link>

        {/* Quick Menu */}
        <Link
          to="/admin/menu"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-stone-200 shadow-xs hover:shadow-md active:scale-95 transition-all text-center group"
        >
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <UtensilsCrossed size={20} />
          </div>
          <span className="text-[11px] font-extrabold text-stone-800 mt-1.5 truncate max-w-full">
            মেনু খাবার
          </span>
        </Link>

        {/* Quick QR / Customer View */}
        <Link
          to="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-500 hover:bg-amber-600 border border-amber-600 shadow-xs hover:shadow-md active:scale-95 transition-all text-center text-white group"
        >
          <div className="p-2.5 rounded-xl bg-white/20 text-white transition-colors">
            <Store size={20} />
          </div>
          <span className="text-[11px] font-black mt-1.5 truncate max-w-full">
            কাস্টমার মেনু
          </span>
        </Link>
      </div>

      {/* ========================================================================= */}
      {/* 3. 2x2 CORE STATS GRID (Mobile App Card Touch Targets)                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Today's Sales Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase text-emerald-100 tracking-wider">
              আজকের বিক্রি
            </span>
            <div className="p-1.5 sm:p-2 bg-white/20 rounded-xl">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-3xl font-black">
              ৳{toBanglaDigits(todaySalesSum.toLocaleString())}
            </div>
            <div className="flex items-center justify-between text-[11px] text-emerald-100 font-medium mt-1">
              <span>অর্ডার: <strong>{toBanglaDigits(todayOrders.length)}টি</strong></span>
              <span className="text-[10px] text-emerald-200">গতকাল ৳{toBanglaDigits(yesterdaySalesSum.toLocaleString())}</span>
            </div>
          </div>
        </div>

        {/* Monthly Net Profit Card */}
        <div className={`text-white rounded-3xl p-4 sm:p-5 shadow-sm relative overflow-hidden flex flex-col justify-between ${
          currentMonthData.netProfit >= 0 
            ? 'bg-gradient-to-br from-indigo-600 to-blue-700' 
            : 'bg-gradient-to-br from-rose-600 to-red-700'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase text-white/90 tracking-wider">
              {currentMonthData.netProfit >= 0 ? 'মাসের নিট লাভ' : 'মাসের নিট লোকসান'}
            </span>
            <div className="p-1.5 sm:p-2 bg-white/20 rounded-xl">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-3xl font-black">
              {currentMonthData.netProfit < 0 ? '-' : ''}৳{toBanglaDigits(Math.abs(currentMonthData.netProfit).toLocaleString())}
            </div>
            <div className="flex items-center justify-between text-[11px] text-white/90 font-medium mt-1">
              <span>মার্জিন: <strong>{currentMonthData.profitMargin.toFixed(0)}%</strong></span>
              <span className="text-[10px] text-white/80">{currentMonthData.label}</span>
            </div>
          </div>
        </div>

        {/* Total Orders Card */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-extrabold text-stone-500 uppercase tracking-wider">
              সর্বমোট অর্ডার
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-50 text-blue-600">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-3xl font-black text-stone-900">
              {toBanglaDigits(totalOrdersCount)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium mt-1">
              <span>ডেলিভারি: <strong className="text-emerald-700">{toBanglaDigits(orders.filter(o => o.status === 'Delivered').length)}টি</strong></span>
              <span className="text-blue-600 font-bold text-[10px]">লাইভ ডাটা</span>
            </div>
          </div>
        </div>

        {/* Pending Orders Card */}
        <Link 
          to="/admin/orders" 
          className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-xs hover:border-orange-300 transition-all flex flex-col justify-between cursor-pointer group active:scale-95"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-extrabold text-orange-600 uppercase tracking-wider flex items-center gap-1">
              <Clock size={12} />
              <span>পেন্ডিং অর্ডার</span>
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-orange-50 text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors">
              <ArrowRight size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-3xl font-black text-orange-600 flex items-center gap-2">
              <span>{toBanglaDigits(pendingOrdersCount)}</span>
              {pendingOrdersCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 animate-pulse">
                  নতুন
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium mt-1">
              <span>প্রস্তুত করতে হবে</span>
              <span className="text-orange-600 font-bold text-[10px]">ট্যাপ করুন →</span>
            </div>
          </div>
        </Link>

      </div>

      {/* ========================================================================= */}
      {/* 4. CURRENT MONTH AUTOMATED FINANCIAL OVERVIEW CARD                         */}
      {/* ========================================================================= */}
      <div className="bg-stone-900 rounded-3xl p-4 sm:p-6 text-white shadow-lg border border-stone-800 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Card Header */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-stone-950 font-black shadow-md shrink-0">
              <Wallet size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-black text-base sm:text-lg text-white">
                  চলতি মাসের স্বয়ংক্রিয় হিসাব
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-stone-950">
                  {currentMonthData.label}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                বিক্রি, খরচ এবং নিট মুনাফার লাইভ রিপোর্ট
              </p>
            </div>
          </div>
          
          <Link
            to="/admin/expenses"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0"
          >
            <Receipt size={14} />
            <span>খরচ ব্যবস্থাপনা</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* 3 Metric Summary Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {/* Sales Block */}
          <div className="bg-stone-800/80 rounded-2xl p-4 border border-stone-700/60 flex flex-col justify-between">
            <span className="text-[11px] text-emerald-400 font-extrabold uppercase flex items-center gap-1">
              <ArrowUpRight size={14} />
              <span>চলতি মাসের মোট বিক্রি</span>
            </span>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-black text-white">
                ৳{toBanglaDigits(currentMonthData.totalSales.toLocaleString())}
              </div>
              <span className="text-[11px] text-emerald-300 font-bold">
                মোট অর্ডার: {toBanglaDigits(currentMonthData.ordersCount)}টি
              </span>
            </div>
            <p className="text-[10px] text-stone-400 pt-2 border-t border-stone-700/50">
              সফলভাবে সম্পন্ন হওয়া সকল অর্ডার
            </p>
          </div>

          {/* Expenses Block */}
          <div className="bg-stone-800/80 rounded-2xl p-4 border border-stone-700/60 flex flex-col justify-between">
            <span className="text-[11px] text-rose-400 font-extrabold uppercase flex items-center gap-1">
              <ArrowDownRight size={14} />
              <span>চলতি মাসের মোট খরচ</span>
            </span>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-black text-white">
                ৳{toBanglaDigits(currentMonthData.totalExpenses.toLocaleString())}
              </div>
              <span className="text-[11px] text-rose-300 font-bold">
                এন্ট্রি করা খরচ: {toBanglaDigits(currentMonthData.expensesCount)}টি
              </span>
            </div>
            <p className="text-[10px] text-stone-400 pt-2 border-t border-stone-700/50">
              মাছ, তেল, গ্যাস, দোকান ভাড়া ও বেতন
            </p>
          </div>

          {/* Profit Block */}
          <div className={`rounded-2xl p-4 border flex flex-col justify-between ${
            currentMonthData.netProfit >= 0 
              ? 'bg-emerald-950/40 border-emerald-500/40' 
              : 'bg-rose-950/40 border-rose-500/40'
          }`}>
            <span className={`text-[11px] font-extrabold uppercase flex items-center gap-1 ${
              currentMonthData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              <DollarSign size={14} />
              <span>{currentMonthData.netProfit >= 0 ? 'চলতি মাসের নিট লাভ' : 'নিট লোকসান'}</span>
            </span>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {currentMonthData.netProfit < 0 ? '-' : ''}৳{toBanglaDigits(Math.abs(currentMonthData.netProfit).toLocaleString())}
              </div>
              <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full inline-block mt-1 ${
                currentMonthData.netProfit >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                মুনাফা মার্জিন: {currentMonthData.profitMargin.toFixed(1)}%
              </span>
            </div>
            <p className="text-[10px] text-stone-400 pt-2 border-t border-white/10">
              সকল খরচ বাদ দিয়ে অবশিষ্ট নগদ মুনাফা
            </p>
          </div>
        </div>

        {/* Daily Spending Trend Chart */}
        <div className="bg-stone-950/70 rounded-2xl p-3.5 border border-stone-800">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-bold text-stone-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>প্রতিদিনের খরচের গ্রাফ (৳)</span>
            </span>
            <span className="text-[10px] text-stone-500">চলতি মাস</span>
          </div>

          <div className="h-44 sm:h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentMonthDailySpending} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
                <XAxis 
                  dataKey="shortDay" 
                  stroke="#78716c" 
                  tick={{ fill: '#a8a29e', fontSize: 10 }}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#78716c" 
                  tick={{ fill: '#a8a29e', fontSize: 10 }}
                  tickLine={false}
                  tickFormatter={(val) => `৳${toBanglaDigits(val)}`}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-stone-900 border border-stone-700 p-2.5 rounded-xl text-xs shadow-xl text-white">
                          <p className="font-black text-amber-400">{item.dayLabel}</p>
                          <p className="text-rose-400 font-bold mt-1">
                            খরচ: ৳{toBanglaDigits(item.spending.toLocaleString())}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="spending" 
                  stroke="#f43f5e" 
                  strokeWidth={2.5}
                  dot={{ fill: '#f43f5e', r: 2 }}
                  activeDot={{ r: 5, fill: '#fda4af' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 5. MONTHLY & DAILY SALES BREAKDOWN SECTION                                 */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
        
        {/* Section Header with Month Selector */}
        <div className="p-4 sm:p-5 bg-stone-50/80 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                <BarChart3 size={18} />
              </div>
              <h2 className="text-base sm:text-lg font-black text-stone-900">
                বিক্রয় রিপোর্ট (Sales Report)
              </h2>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              মাস নির্বাচন করে প্রতিদিনের বিক্রির হিসাব দেখুন
            </p>
          </div>

          {/* Month Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-600 shrink-0">মাস:</span>
            <div className="relative flex-1 sm:flex-initial">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full sm:w-auto appearance-none bg-white border-2 border-amber-300 hover:border-amber-500 focus:outline-rose-500 text-stone-900 text-xs font-black py-2 pl-3 pr-8 rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                {availableMonths.map(monthKey => (
                  <option key={monthKey} value={monthKey}>
                    📅 {getMonthLabel(monthKey)} {monthKey === currentMonthKey ? '(চলতি মাস)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Selected Month Summary Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 sm:p-4 bg-amber-50/50 border-b border-stone-100">
          <div className="bg-white p-3 rounded-2xl border border-amber-100 shadow-2xs">
            <p className="text-[10px] font-bold text-stone-500">নির্বাচিত মাস</p>
            <p className="text-xs font-black text-stone-900 mt-0.5">{getMonthLabel(selectedMonth)}</p>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-amber-100 shadow-2xs">
            <p className="text-[10px] font-bold text-stone-500">মোট বিক্রি</p>
            <p className="text-xs sm:text-sm font-black text-emerald-600 mt-0.5">
              ৳{toBanglaDigits(monthlyStats.totalSales.toLocaleString())}
            </p>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-amber-100 shadow-2xs">
            <p className="text-[10px] font-bold text-stone-500">মোট অর্ডার</p>
            <p className="text-xs sm:text-sm font-black text-blue-600 mt-0.5">
              {toBanglaDigits(monthlyStats.totalOrders)} টি
            </p>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-amber-100 shadow-2xs">
            <p className="text-[10px] font-bold text-stone-500">ডেলিভারি সম্পন্ন</p>
            <p className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">
              {toBanglaDigits(monthlyStats.deliveredOrders)} টি
            </p>
          </div>
        </div>

        {/* Mobile-friendly daily records list */}
        <div className="divide-y divide-stone-100">
          {dailyBreakdown.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-xs flex flex-col items-center">
              <Calendar size={28} className="text-stone-300 mb-2" />
              <p className="font-bold text-stone-700">{getMonthLabel(selectedMonth)} মাসে এখনও কোনো বিক্রি সম্পন্ন হয়নি।</p>
            </div>
          ) : (
            dailyBreakdown.map((day) => {
              const isToday = day.dateStr === todayStr;
              const isYesterday = day.dateStr === yesterdayStr;
              const dayNum = day.dateObj.getDate();
              const monthName = BANGLA_MONTHS[day.dateObj.getMonth()];
              const dayName = BANGLA_DAYS[day.dateObj.getDay()];
              const progressPct = Math.round((day.totalSales / highestDailySales) * 100);

              return (
                <div 
                  key={day.dateStr}
                  className={`p-3 sm:p-4 flex items-center justify-between gap-3 transition-colors ${
                    isToday ? 'bg-emerald-50/50' : isYesterday ? 'bg-amber-50/30' : 'hover:bg-stone-50'
                  }`}
                >
                  {/* Left: Date & Badges */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-2xl flex flex-col items-center justify-center text-xs font-black shrink-0 ${
                      isToday ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-700'
                    }`}>
                      <span>{toBanglaDigits(dayNum)}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs text-stone-900 truncate">
                          {toBanglaDigits(dayNum)} {monthName}
                        </span>
                        {isToday && (
                          <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                            আজ
                          </span>
                        )}
                        {isYesterday && (
                          <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                            গতকাল
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-500 font-medium">
                        {dayName} • {toBanglaDigits(day.totalOrders)}টি অর্ডার
                      </span>
                    </div>
                  </div>

                  {/* Right: Amount & Link */}
                  <div className="flex items-center gap-2.5 shrink-0 text-right">
                    <div>
                      <div className="text-xs sm:text-sm font-black text-stone-900">
                        ৳{toBanglaDigits(day.totalSales.toLocaleString())}
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold block">
                        ডেলিভারি {toBanglaDigits(day.deliveredOrders)}টি
                      </span>
                    </div>

                    <Link
                      to={`/admin/orders?date=${day.dateStr}`}
                      className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 transition-all cursor-pointer"
                      title="অর্ডার দেখুন"
                    >
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 6. RECENT ORDERS (Native Mobile Card Feed)                                 */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="font-black text-base text-stone-900">
              সাম্প্রতিক অর্ডার (Recent Orders)
            </h2>
            <p className="text-[11px] text-stone-500">
              সর্বশেষ গ্রাহকদের দেওয়া অর্ডারসমূহ
            </p>
          </div>
          <Link
            to="/admin/orders"
            className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 transition-colors"
          >
            <span>সব দেখুন</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            এখনো কোনো অর্ডার জমা পড়েনি।
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {recentOrders.map((order) => (
              <div key={order.id} className="p-3.5 sm:p-4 hover:bg-stone-50/80 transition-colors flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-xs text-stone-900">
                      {order.order_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      STATUS_COLORS[order.status] || 'bg-stone-100 text-stone-700'
                    }`}>
                      {order.status}
                    </span>
                    <span className="text-[10px] text-stone-400 flex items-center gap-1 font-medium">
                      <Clock size={10} /> {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-stone-800 truncate">
                    {order.customer_name || 'কাস্টমার'} {order.customer_phone ? `(${order.customer_phone})` : ''}
                  </p>

                  {order.items_summary && (
                    <p className="text-[11px] text-stone-500 truncate max-w-sm">
                      🍽️ {order.items_summary}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-black text-rose-600">
                    ৳{toBanglaDigits(order.total_amount)}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 inline-block mt-0.5">
                    {order.order_type === 'Dine-in' ? `টেবিল: ${order.location}` : 'ডেলিভারি'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
