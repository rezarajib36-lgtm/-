import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Settings, 
  Wallet, Store, QrCode, CheckCircle2, XCircle, Bell, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getRestaurantSettings, subscribeRestaurantSettings, RestaurantSettings } from '../lib/restaurantSettings';

function toBanglaDigits(num: number | string): string {
  const digits: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
  };
  return String(num).replace(/[0-9]/g, w => digits[w] || w);
}

export default function AdminLayout() {
  const location = useLocation();
  const [settings, setSettings] = useState<RestaurantSettings>(getRestaurantSettings());
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed.filter(o => o.status === 'Pending').length;
          }
        }
      } catch (e) {}
    }
    return 0;
  });

  // Keep settings updated in real-time
  useEffect(() => {
    const unsubscribe = subscribeRestaurantSettings((newSettings) => {
      setSettings(newSettings);
    });
    return () => unsubscribe();
  }, []);

  // Check Supabase connection and calculate pending orders count
  useEffect(() => {
    let isMounted = true;

    async function checkConnectionAndOrders() {
      if (!supabase) {
        if (isMounted) {
          setDbStatus('error');
          setErrorMessage('Supabase client is not initialized.');
        }
        return;
      }

      try {
        const { data: orderData, error } = await supabase
          .from('orders')
          .select('id, status')
          .order('created_at', { ascending: false });

        if (isMounted) {
          if (error && error.code !== '42P01') {
            setDbStatus('error');
            setErrorMessage(`${error.message} (Code: ${error.code})`);
          } else {
            setDbStatus('connected');
            if (Array.isArray(orderData)) {
              const pendingCount = orderData.filter(o => o.status === 'Pending').length;
              setPendingOrdersCount(pendingCount);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setDbStatus('error');
          setErrorMessage(`Caught Exception: ${err.message || 'Failed to connect to database'}`);
        }
      }
    }

    checkConnectionAndOrders();

    // Listen to local order updates
    const handleLocalOrderUpdate = () => {
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setPendingOrdersCount(parsed.filter(o => o.status === 'Pending').length);
          }
        }
      } catch (e) {}
    };

    window.addEventListener('storage', handleLocalOrderUpdate);
    const interval = setInterval(checkConnectionAndOrders, 15000);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleLocalOrderUpdate);
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { name: 'Dashboard', banglaName: 'ড্যাশবোর্ড', path: '/admin', icon: LayoutDashboard },
    { name: 'Orders', banglaName: 'অর্ডার', path: '/admin/orders', icon: ShoppingBag, badge: pendingOrdersCount },
    { name: 'Expenses', banglaName: 'খরচ ও লাভ', path: '/admin/expenses', icon: Wallet },
    { name: 'Menu', banglaName: 'মেনু', path: '/admin/menu', icon: UtensilsCrossed },
    { name: 'Settings', banglaName: 'সেটিংস', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-stone-50 flex-col md:flex-row font-sans text-stone-900 select-none">
      
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR (Visible on md and larger screens)                        */}
      {/* ========================================================================= */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col hidden md:flex shrink-0 shadow-xs">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {settings.logo ? (
              <img 
                src={settings.logo} 
                alt="Logo" 
                className="w-9 h-9 rounded-xl object-cover border border-amber-300 shadow-xs" 
              />
            ) : (
              <div className="w-9 h-9 bg-amber-600 rounded-xl flex items-center justify-center text-white shadow-xs">
                <UtensilsCrossed size={18} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-black text-sm tracking-tight text-stone-900 truncate">
                {settings.name || 'রেস্টুরেন্ট প্যানেল'}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-emerald-700">অনলাইন প্যানেল</span>
              </div>
            </div>
          </div>
        </div>

        {/* View Customer Menu Button */}
        <div className="p-3 border-b border-stone-100">
          <Link 
            to="/" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl text-xs font-bold transition-all shadow-xs hover:shadow-sm"
          >
            <Store size={15} className="text-amber-700" />
            <span>গ্রাহক মেনু দেখুন</span>
            <ExternalLink size={12} className="text-amber-600" />
          </Link>
        </div>
        
        {/* Connection Status Indicator */}
        <div className="px-5 py-2 border-b border-stone-100 flex items-center gap-2">
          {dbStatus === 'checking' && (
            <div className="flex items-center gap-2 text-stone-500 text-[11px] font-medium animate-pulse">
              <div className="w-2 h-2 bg-stone-400 rounded-full"></div>
              <span>ক্লাউড চেক হচ্ছে...</span>
            </div>
          )}
          {dbStatus === 'connected' && (
            <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>ক্লাউড ডেটাবেজ যুক্ত</span>
            </div>
          )}
          {dbStatus === 'error' && (
            <div className="flex items-center gap-1.5 text-rose-600 text-[11px] font-bold" title={errorMessage}>
              <XCircle size={13} />
              <span>অফলাইন ব্যাকআপ মোড</span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all duration-150 font-bold text-xs ${
                  isActive 
                    ? 'bg-stone-900 text-white shadow-md' 
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-amber-400' : 'text-stone-400'} />
                  <span>{item.banglaName}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {toBanglaDigits(item.badge)}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-3 border-t border-stone-100 mt-2">
            <Link
              to="/admin/qr"
              className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all duration-150 font-bold text-xs ${
                location.pathname === '/admin/qr'
                  ? 'bg-stone-900 text-white shadow-md'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <QrCode size={18} className={location.pathname === '/admin/qr' ? 'text-amber-400' : 'text-stone-400'} />
              <span>টেবিল কিউআর কোড</span>
            </Link>
          </div>
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-stone-100 text-center">
          <p className="text-[10px] font-bold text-stone-400">স্মার্ট রেস্টুরেন্ট অ্যাডমিন v4.0</p>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN MOBILE APP-SHELL                                                     */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-stone-50">
        
        {/* Mobile Top App Bar (Sticky Native App Header) */}
        <header className="h-14 bg-white/95 backdrop-blur-md border-b border-stone-200/80 flex items-center justify-between px-3.5 shrink-0 md:hidden z-30 shadow-xs">
          
          {/* Restaurant identity in Top Bar */}
          <div className="flex items-center gap-2.5 min-w-0">
            {settings.logo ? (
              <img 
                src={settings.logo} 
                alt="Logo" 
                className="w-8 h-8 rounded-xl object-cover border border-amber-300 shadow-2xs shrink-0" 
              />
            ) : (
              <div className="w-8 h-8 bg-amber-600 rounded-xl flex items-center justify-center text-white shadow-2xs shrink-0">
                <UtensilsCrossed size={16} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-black text-sm tracking-tight text-stone-900 truncate leading-none">
                {settings.name || 'রেস্টুরেন্ট'}
              </h1>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-stone-500 leading-none">অ্যাডমিন অ্যাপ</span>
              </div>
            </div>
          </div>

          {/* Quick Actions in Mobile Top Bar */}
          <div className="flex items-center gap-2 shrink-0">
            {pendingOrdersCount > 0 && (
              <Link
                to="/admin/orders"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black animate-pulse"
                title={`${pendingOrdersCount}টি নতুন অর্ডার অপেক্ষা করছে`}
              >
                <Bell size={13} className="text-rose-600" />
                <span>{toBanglaDigits(pendingOrdersCount)}</span>
              </Link>
            )}

            <Link 
              to="/" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <Store size={14} />
              <span>মেনু ভিউ</span>
            </Link>
          </div>
        </header>

        {/* Database Warning if offline */}
        {dbStatus === 'error' && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-900 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="font-bold">লোকাল মোড: ডেটা আপনার ব্রাউজার মেমোরিতে সম্পূর্ণ সুরক্ষিত আছে।</span>
            </div>
          </div>
        )}

        {/* Scrollable Page Content Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-8 pb-24 md:pb-8">
          <Outlet />
        </div>

        {/* ========================================================================= */}
        {/* MOBILE BOTTOM NAVIGATION DOCK (Native App Style with Badges & Glow)       */}
        {/* ========================================================================= */}
        <nav 
          aria-label="Mobile Bottom App Bar"
          className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-stone-200/90 px-2 py-1.5 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex items-center justify-around"
          style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-200 active:scale-90 ${
                  isActive ? 'text-amber-800 font-black' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {/* Active Indicator Glow/Pill */}
                <div className={`relative p-1.5 rounded-xl transition-all ${
                  isActive ? 'bg-amber-100 text-amber-900 shadow-2xs scale-105' : 'bg-transparent text-stone-500'
                }`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  
                  {/* Notification badge */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center ring-2 ring-white animate-bounce">
                      {item.badge > 9 ? '৯+' : toBanglaDigits(item.badge)}
                    </span>
                  )}
                </div>

                <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-black text-stone-900' : 'font-medium text-stone-500'}`}>
                  {item.banglaName}
                </span>

                {/* Bottom Active Dot */}
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-amber-600 mt-0.5"></span>
                )}
              </Link>
            );
          })}
        </nav>

      </main>
    </div>
  );
}
