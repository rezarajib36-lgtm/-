import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Link, useSearchParams, useParams, useLocation, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, MapPin, Clock, Phone, MessageCircle, ExternalLink, Plus, Info, X, Check, UtensilsCrossed, LayoutGrid, List, ChevronRight, Grid2X2, Layers } from 'lucide-react';
import FoodDetailsModal from '../../components/customer/FoodDetailsModal';
import BrandHeaderBanner from '../../components/customer/BrandHeaderBanner';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../context/CartContext';
import { parseDescriptionData, parseCategoryData, formatWhatsAppNumber, formatTelNumber, sortCategoriesByOrder, getCategoryVisualInfo, getFoodBadges, sortMenuItemsByOrder } from '../../utils';
import { getRestaurantSettings, subscribeRestaurantSettings, RestaurantSettings, isRestaurantCurrentlyOpen, fetchRestaurantSettingsFromCloud } from '../../lib/restaurantSettings';
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from '../../data/initialMenuData';
import { getAllImagesFromIDB, saveImagesToIDB, safeCacheMenuItemsMetadata } from '../../lib/imageStorage';

export default function MenuPage() {
  const [searchParams] = useSearchParams();
  const routeParams = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const initialSearch = searchParams.get('q') || searchParams.get('search') || '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedFood, setSelectedFood] = useState<any>(null);

  // Fast Instant Cache: Load saved categories and items immediately from localStorage or pre-bundled menu so zero loading screen is shown!
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_menu_categories');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return sortCategoriesByOrder(parsed);
        } catch (e) {}
      }
    }
    return sortCategoriesByOrder(INITIAL_CATEGORIES as any);
  });

  const [menuItems, setMenuItems] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_menu_items');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return sortMenuItemsByOrder(parsed);
        } catch (e) {}
      }
    }
    return sortMenuItemsByOrder(INITIAL_MENU_ITEMS as any);
  });

  const [loading, setLoading] = useState(false);

  const [settings, setSettings] = useState<RestaurantSettings>(getRestaurantSettings());
  const liveStatus = useMemo(() => isRestaurantCurrentlyOpen(settings), [settings]);
  
  // View mode: 'grid' (mobile 2-column grid) vs 'cards' (large food picture grid) vs 'list' (compact row list)
  const [viewMode, setViewMode] = useState<'grid' | 'cards' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('menu_view_mode_v2');
      if (saved === 'list' || saved === 'cards' || saved === 'grid') return saved as any;
    }
    return 'grid'; // Grid view by default for mobile-friendly 2-column layout
  });

  const handleSetViewMode = (mode: 'grid' | 'cards' | 'list') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('menu_view_mode_v2', mode);
    }
  };

  // Quick Mobile Category Sheet / Modal state
  const [showCategorySheet, setShowCategorySheet] = useState(false);

  const { totalItems, totalPrice } = useCart();

  // Redirect to admin if requested via ?admin or #admin
  useEffect(() => {
    if (searchParams.has('admin') || location.hash === '#admin') {
      navigate('/admin', { replace: true });
    }
  }, [searchParams, location, navigate]);

  // 1. Enhanced Table number detection from QR code query param or route
  const detectedTable = 
    searchParams.get('table') || 
    searchParams.get('table_name') || 
    searchParams.get('tbl') || 
    searchParams.get('t') || 
    routeParams.tableId;

  // 2. View-only and Delivery mode detection
  const isViewOnlyParam = 
    searchParams.get('mode') === 'view' || 
    searchParams.get('viewOnly') === 'true' || 
    searchParams.get('view') === 'true';

  const isDeliveryExplicit = 
    location.pathname === '/delivery' ||
    searchParams.get('mode') === 'delivery' || 
    searchParams.get('delivery') === 'true';

  const isDineInExplicit = 
    location.pathname === '/dine-in' ||
    searchParams.get('mode') === 'dine_in' ||
    searchParams.get('dine_in') === 'true';

  useEffect(() => {
    if (isDeliveryExplicit) {
      sessionStorage.setItem('orderMode', 'delivery');
      localStorage.setItem('orderMode', 'delivery');
      sessionStorage.removeItem('currentTable');
      localStorage.removeItem('currentTable');
    } else if (isDineInExplicit) {
      sessionStorage.removeItem('orderMode');
      localStorage.removeItem('orderMode');
    } else if (detectedTable) {
      const cleanTable = detectedTable.replace(/^Table\s*/i, '');
      sessionStorage.setItem('currentTable', cleanTable);
      localStorage.setItem('currentTable', cleanTable);
      sessionStorage.setItem('orderMode', `table_${cleanTable}`);
      localStorage.setItem('orderMode', `table_${cleanTable}`);
    } else if (isViewOnlyParam) {
      sessionStorage.setItem('orderMode', 'viewOnly');
    }
  }, [detectedTable, isDeliveryExplicit, isDineInExplicit, isViewOnlyParam]);

  const storedMode = typeof window !== 'undefined' ? (sessionStorage.getItem('orderMode') || localStorage.getItem('orderMode')) : null;
  const isDeliveryMode = isDeliveryExplicit || storedMode === 'delivery';
  const effectiveViewOnly = isViewOnlyParam || storedMode === 'viewOnly';

  const rawStoredTable = typeof window !== 'undefined' ? (sessionStorage.getItem('currentTable') || localStorage.getItem('currentTable')) : null;
  const effectiveTable = isDeliveryMode ? null : (detectedTable ? detectedTable.replace(/^Table\s*/i, '') : rawStoredTable);
  const currentTable = effectiveTable;

  // 3. Auto-scroll to Menu when scanning QR or when table / hash / search query is provided
  useEffect(() => {
    const hasSearch = searchParams.has('q') || searchParams.has('search');
    const hasTableOrHash = !!detectedTable || location.hash === '#menu' || searchParams.has('menu') || location.pathname === '/delivery' || location.pathname === '/menu' || hasSearch;
    if (hasTableOrHash) {
      const scrollAction = (behavior: ScrollBehavior = 'smooth') => {
        const menuElement = document.getElementById('menu');
        if (menuElement) {
          menuElement.scrollIntoView({ behavior, block: 'start' });
        }
      };
      // Auto-jump immediately so customer scanning QR or clicking link lands right at the food list
      scrollAction('auto');
      const timer1 = setTimeout(() => scrollAction('smooth'), 150);
      const timer2 = setTimeout(() => scrollAction('smooth'), 500);
      const timer3 = setTimeout(() => scrollAction('smooth'), 1000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [detectedTable, location.hash, location.pathname, searchParams]);

  // Subscribe to settings changes from Admin Settings & Cloud
  useEffect(() => {
    setSettings(getRestaurantSettings());
    const unsubscribe = subscribeRestaurantSettings((updated) => {
      setSettings(updated);
    });
    // Fetch latest permanent settings from Supabase cloud database
    fetchRestaurantSettingsFromCloud().then((cloudSettings) => {
      if (cloudSettings) {
        setSettings(cloudSettings);
      }
    });
    return unsubscribe;
  }, []);

  // Load cached images from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;
    getAllImagesFromIDB().then((idbMap) => {
      if (isMounted && idbMap.size > 0) {
        setMenuItems((prev: any[]) => {
          let changed = false;
          const updated = prev.map((item: any) => {
            const idbImg = idbMap.get(item.id);
            if (idbImg && idbImg !== item.image_url) {
              changed = true;
              return { ...item, image_url: idbImg };
            }
            return item;
          });
          return changed ? updated : prev;
        });
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Fetch Menu from Supabase and cache locally for zero-latency instant future loads
  useEffect(() => {
    let isMounted = true;

    const loadCustomerImages = async (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      const CHUNK = 15;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        chunks.push(ids.slice(i, i + CHUNK));
      }

      await Promise.all(
        chunks.map(async (chunk) => {
          if (!isMounted) return;
          try {
            const { data: imgData } = await supabase
              .from('menu_items')
              .select('id, image_url')
              .in('id', chunk);

            if (isMounted && imgData && imgData.length > 0) {
              // Persist into IndexedDB
              saveImagesToIDB(imgData);

              setMenuItems((prev: any[]) => {
                let changed = false;
                const updated = prev.map((item: any) => {
                  const found = imgData.find((d: any) => d.id === item.id);
                  if (found && found.image_url && found.image_url !== item.image_url) {
                    changed = true;
                    return { ...item, image_url: found.image_url };
                  }
                  return item;
                });
                return changed ? updated : prev;
              });
            }
          } catch (e) {}
        })
      );
    };

    async function fetchData() {
      try {
        const [catRes, itemsRes] = await Promise.all([
          supabase.from('categories').select('*').order('created_at'),
          supabase.from('menu_items').select('id, name, description, price, category_id, is_available, created_at').order('created_at')
        ]);

        if (isMounted) {
          if (catRes?.data) {
            const cleanCats = catRes.data.filter((c: any) => c.name && !c.name.startsWith('__SYSTEM_') && !c.name.startsWith('__CONFIG_'));
            const sortedCats = sortCategoriesByOrder(cleanCats);
            setCategories(sortedCats);
            try {
              localStorage.setItem('cached_menu_categories', JSON.stringify(sortedCats));
            } catch (e) {}
          }
          if (itemsRes?.data && itemsRes.data.length > 0) {
            // Build rich image map: Seed initial items -> current in-memory items -> IndexedDB
            const imageMap = new Map<string, string>();
            INITIAL_MENU_ITEMS.forEach((m: any) => {
              if (m.image_url) imageMap.set(m.id, m.image_url);
            });
            menuItems.forEach((m: any) => {
              if (m.image_url) imageMap.set(m.id, m.image_url);
            });

            try {
              const idbMap = await getAllImagesFromIDB();
              idbMap.forEach((val, key) => {
                if (val) imageMap.set(key, val);
              });
            } catch (e) {}

            const merged = itemsRes.data.map((item: any) => {
              const existingImg = imageMap.get(item.id);
              return {
                ...item,
                image_url: existingImg || '',
                category_id: item.category_id || ''
              };
            });

            const sortedItems = sortMenuItemsByOrder(merged);
            setMenuItems(sortedItems);
            safeCacheMenuItemsMetadata(sortedItems);

            // Fetch any missing images in parallel
            const missingIds = itemsRes.data.filter((i: any) => !imageMap.has(i.id) || !imageMap.get(i.id)).map((i: any) => i.id);
            if (missingIds.length > 0) {
              loadCustomerImages(missingIds);
            }
          }
        }
      } catch (err) {
        console.warn("Fast menu load notice:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchData();

    // 1. Regular background synchronizer (45 seconds - realtime channel handles immediate updates)
    const pollInterval = setInterval(() => {
      fetchData();
    }, 45000);

    // 2. Supabase Realtime channel: if admin adds food, updates availability, or modifies menu, update instantly
    const realtimeChannel = supabase
      .channel('public:menu_customer_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchData();
      })
      .subscribe();

    // 3. Cross-tab and Local Storage Instant Synchronizer
    const handleSync = async () => {
      if (typeof window !== 'undefined') {
        try {
          const cachedCats = localStorage.getItem('cached_menu_categories');
          if (cachedCats) {
            const parsed = JSON.parse(cachedCats);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCategories(sortCategoriesByOrder(parsed));
            }
          }
          const idbImages = await getAllImagesFromIDB();
          if (idbImages.size > 0) {
            setMenuItems((prev: any[]) => {
              return prev.map((item: any) => {
                const img = idbImages.get(item.id);
                return (img && img !== item.image_url) ? { ...item, image_url: img } : item;
              });
            });
          }
        } catch (e) {}
      }
    };

    window.addEventListener('restaurant_menu_updated', handleSync);
    window.addEventListener('restaurant_category_order_updated', handleSync);
    window.addEventListener('restaurant_item_order_updated', handleSync);
    window.addEventListener('storage', handleSync);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('restaurant_menu_sync');
      bc.onmessage = () => {
        handleSync();
        fetchData();
      };
    } catch (e) {}

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(realtimeChannel);
      window.removeEventListener('restaurant_menu_updated', handleSync);
      window.removeEventListener('restaurant_category_order_updated', handleSync);
      window.removeEventListener('restaurant_item_order_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      if (bc) bc.close();
    };
  }, []);

  const categoryList = useMemo(() => {
    return ["All", ...categories.map(c => parseCategoryData(c.name).name)];
  }, [categories]);

  // Group items by sorted category for category-wise separation
  const groupedCategories = useMemo(() => {
    return categories.map(cat => {
      const catName = parseCategoryData(cat.name).name;
      const catPortions = parseCategoryData(cat.name).portions;
      let items = menuItems.filter(i => i.category_id === cat.id);

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        items = items.filter(i => {
          const nameMatch = i.name && i.name.toLowerCase().includes(q);
          const descMatch = i.description && i.description.toLowerCase().includes(q);
          const catMatch = catName.toLowerCase().includes(q);
          return nameMatch || descMatch || catMatch;
        });
      }

      return {
        category: cat,
        name: catName,
        portions: catPortions,
        items
      };
    }).filter(group => {
      return group.items.length > 0; // only show categories with items
    });
  }, [categories, menuItems, searchQuery]);

  // Items not linked to any category
  const uncategorizedItems = useMemo(() => {
    let items = menuItems.filter(i => !i.category_id || !categories.some(c => c.id === i.category_id));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(i => 
        (i.name && i.name.toLowerCase().includes(q)) || 
        (i.description && i.description.toLowerCase().includes(q))
      );
    }
    return items;
  }, [menuItems, categories, searchQuery]);

  const filteredItems = useMemo(() => {
    let items = menuItems;

    // Filter by category
    if (activeCategory !== "All") {
      const selectedCat = categories.find(c => parseCategoryData(c.name).name === activeCategory);
      if (selectedCat) {
        items = items.filter(i => i.category_id === selectedCat.id);
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(i => {
        const nameMatch = i.name && i.name.toLowerCase().includes(q);
        const descMatch = i.description && i.description.toLowerCase().includes(q);
        const cat = categories.find(c => c.id === i.category_id);
        const catMatch = cat && parseCategoryData(cat.name).name.toLowerCase().includes(q);
        return nameMatch || descMatch || catMatch;
      });
    }

    return items;
  }, [menuItems, activeCategory, categories, searchQuery]);

  const primaryColor = settings.primaryColor || '#c2410c';

  const scrollToMenu = () => {
    const el = document.getElementById('menu');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleResetTable = () => {
    sessionStorage.removeItem('currentTable');
    localStorage.removeItem('currentTable');
    sessionStorage.removeItem('orderMode');
    localStorage.removeItem('orderMode');
    window.location.href = '/menu';
  };

  const handleSwitchToDelivery = () => {
    sessionStorage.setItem('orderMode', 'delivery');
    localStorage.setItem('orderMode', 'delivery');
    sessionStorage.removeItem('currentTable');
    localStorage.removeItem('currentTable');
    window.location.href = '/delivery#menu';
  };

  const handleSwitchToDineIn = () => {
    sessionStorage.removeItem('orderMode');
    localStorage.removeItem('orderMode');
    window.location.href = '/#menu';
  };

  // Render a food item as a compact 2-column mobile card (মোবাইলের জন্য নিখুঁত ও আরামদায়ক ২-কলাম ভিউ)
  const renderCompactFoodCard = (item: any) => {
    const parsedDesc = parseDescriptionData(item.description);
    const hasVariants = parsedDesc.variants && parsedDesc.variants.length > 0;
    const lowestPrice = hasVariants 
      ? Math.min(...parsedDesc.variants.map((v: any) => v.price))
      : item.price;
    const foodBadges = getFoodBadges(item.name);

    return (
      <motion.article 
        key={item.id}
        onClick={() => setSelectedFood(item)}
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10px' }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        whileHover={{ y: -3, transition: { duration: 0.15 } }}
        className="bg-white/95 rounded-2xl sm:rounded-3xl overflow-hidden border border-stone-200/90 shadow-2xs hover:shadow-lg hover:border-amber-400/80 transition-all flex flex-col justify-between group cursor-pointer"
      >
        {/* Thumbnail Container */}
        <div className="relative aspect-4/3 w-full overflow-hidden bg-stone-100">
          {item.image_url ? (
            <img 
              src={item.image_url} 
              alt={item.name} 
              className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-300 ease-out"
              decoding="async"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 bg-stone-50">
              <span className="text-3xl mb-0.5">🍽️</span>
              <span className="text-[10px] font-bold text-stone-400">ইলিশের বাড়ি</span>
            </div>
          )}

          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent pointer-events-none" />

          {/* Floating Price Pill */}
          <div className="absolute bottom-2 right-2 z-10">
            <span 
              className="px-2.5 py-0.5 sm:py-1 rounded-full text-white font-black text-xs sm:text-sm shadow-md backdrop-blur-xs flex items-center gap-0.5"
              style={{ backgroundColor: primaryColor }}
            >
              <span>৳ {lowestPrice}</span>
              {hasVariants && <span className="text-[10px] opacity-90">+</span>}
            </span>
          </div>

          {/* Status Badges */}
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
            {!item.is_available && (
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[9px] shadow-sm">
                স্টক শেষ
              </span>
            )}
            {foodBadges.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full font-black text-[9px] shadow-sm border ${foodBadges[0].className}`}>
                {foodBadges[0].icon} {foodBadges[0].text}
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
          <div>
            <h4 className="text-xs sm:text-base font-black text-stone-900 group-hover:text-amber-800 transition-colors line-clamp-2 leading-snug">
              {item.name}
            </h4>

            {hasVariants ? (
              <p className="mt-1 text-[10px] sm:text-xs text-amber-800 font-extrabold flex items-center gap-1">
                <span>{parsedDesc.variants.length} টি সাইজ</span>
              </p>
            ) : parsedDesc.description ? (
              <p className="mt-1 text-[10px] sm:text-xs text-stone-400 line-clamp-1 font-normal">
                {parsedDesc.description}
              </p>
            ) : null}
          </div>

          {/* Action Row */}
          {!effectiveViewOnly && (
            <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!item.is_available) return;
                  setSelectedFood(item);
                }}
                className={`w-full py-1.5 sm:py-2 px-2 rounded-xl text-white font-black text-[11px] sm:text-xs flex items-center justify-center gap-1 shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer ${!item.is_available ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ backgroundColor: item.is_available ? primaryColor : '#9CA3AF' }}
                disabled={!item.is_available}
              >
                <Plus size={13} className="stroke-[3]" />
                <span>{!item.is_available ? 'স্টক শেষ' : (hasVariants ? 'সাইজ বেছে নিন' : 'যোগ করুন')}</span>
              </button>
            </div>
          )}
        </div>
      </motion.article>
    );
  };

  // Render a food item as a rich visual card (খাবারের বড় ছবি ও আকর্ষণীয় ডিজাইন)
  const renderFoodCard = (item: any) => {
    const parsedDesc = parseDescriptionData(item.description);
    const hasVariants = parsedDesc.variants && parsedDesc.variants.length > 0;
    const lowestPrice = hasVariants 
      ? Math.min(...parsedDesc.variants.map((v: any) => v.price))
      : item.price;
    const foodBadges = getFoodBadges(item.name);

    return (
      <motion.article 
        key={item.id}
        onClick={() => setSelectedFood(item)}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="bg-white/95 rounded-3xl overflow-hidden border border-stone-200/90 shadow-2xs hover:shadow-xl hover:border-amber-400/80 transition-all duration-300 flex flex-col group cursor-pointer"
      >
        {/* Food Image Container */}
        <div className="relative aspect-4/3 sm:aspect-16/10 w-full overflow-hidden bg-stone-100">
          {item.image_url ? (
            <img 
              src={item.image_url} 
              alt={item.name} 
              className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
              decoding="async"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 bg-stone-50">
              <span className="text-4xl mb-1">🍽️</span>
              <span className="text-[11px] font-bold text-stone-400">ইলিশের বাড়ি</span>
            </div>
          )}

          {/* Bottom Gradient for high contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

          {/* Floating Price Badge */}
          <div className="absolute bottom-3 right-3 z-10">
            <div 
              className="px-3.5 py-1.5 rounded-full text-white font-black text-sm sm:text-base shadow-lg backdrop-blur-xs flex items-center gap-1 ring-1 ring-white/20"
              style={{ backgroundColor: primaryColor }}
            >
              <span>৳ {lowestPrice}</span>
              {hasVariants && <span className="text-[11px] font-normal opacity-90">+</span>}
            </div>
          </div>

          {/* Badges on Top-Left */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 items-start">
            {!item.is_available && (
              <span className="px-2.5 py-1 rounded-full bg-red-600/95 text-white font-bold text-[10px] shadow-md backdrop-blur-xs">
                স্টক শেষ
              </span>
            )}
            {foodBadges.length > 0 && (
              <span className={`px-2.5 py-1 rounded-full font-black text-[10px] shadow-md backdrop-blur-xs border ${foodBadges[0].className}`}>
                {foodBadges[0].icon} {foodBadges[0].text}
              </span>
            )}
            {hasVariants && (
              <span className="px-2.5 py-1 rounded-full bg-black/70 text-amber-300 font-bold text-[10px] shadow-md backdrop-blur-xs border border-amber-300/40">
                {parsedDesc.variants.length} টি সাইজ
              </span>
            )}
          </div>
        </div>

        {/* Card Content Body */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
          <div>
            {/* Badges list if any */}
            {foodBadges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {foodBadges.map((badge, idx) => (
                  <span 
                    key={idx} 
                    className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.className}`}
                  >
                    <span>{badge.icon}</span>
                    <span>{badge.text}</span>
                  </span>
                ))}
              </div>
            )}

            <h4 className="text-base sm:text-lg font-black text-stone-900 group-hover:text-amber-700 transition-colors line-clamp-1 tracking-tight leading-snug">
              {item.name}
            </h4>

            {parsedDesc.description && (
              <p className="mt-1.5 text-xs text-stone-500 line-clamp-2 leading-relaxed font-normal">
                {parsedDesc.description}
              </p>
            )}
          </div>

          {/* Action Row */}
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
            <div className="text-xs text-stone-600 font-bold">
              {hasVariants ? (
                <span className="text-amber-800 font-extrabold flex items-center gap-1">
                  <span>সাইজ বেছে নিন</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-black">
                    {parsedDesc.variants.length}
                  </span>
                </span>
              ) : (
                <span>একক মূল্য: ৳{item.price}</span>
              )}
            </div>

            {!effectiveViewOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!item.is_available) return;
                  setSelectedFood(item);
                }}
                className={`px-3.5 py-2 rounded-xl text-white font-black text-xs flex items-center gap-1.5 shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer shrink-0 ${!item.is_available ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ backgroundColor: item.is_available ? primaryColor : '#9CA3AF' }}
                title={!item.is_available ? 'স্টক শেষ' : (hasVariants ? 'সাইজ নির্বাচন করুন' : 'অর্ডারে যোগ করুন')}
                disabled={!item.is_available}
              >
                <Plus size={14} className="stroke-[3]" />
                <span>{!item.is_available ? 'স্টক শেষ' : (hasVariants ? 'সাইজ বেছে নিন' : 'যোগ করুন')}</span>
              </button>
            )}
          </div>
        </div>
      </motion.article>
    );
  };

  // Render a food item as a compact horizontal row (ক্লাসিক লিস্ট ভিউ)
  const renderFoodRow = (item: any) => {
    const parsedDesc = parseDescriptionData(item.description);
    const hasVariants = parsedDesc.variants && parsedDesc.variants.length > 0;
    const lowestPrice = hasVariants 
      ? Math.min(...parsedDesc.variants.map((v: any) => v.price))
      : item.price;
    const foodBadges = getFoodBadges(item.name);

    return (
      <motion.article 
        key={item.id}
        onClick={() => setSelectedFood(item)}
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15px' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        whileHover={{ x: 3, transition: { duration: 0.15 } }}
        className="flex min-h-[96px] items-center justify-between gap-4 border-b border-stone-200/70 py-4 px-2.5 rounded-2xl hover:bg-white/70 transition-colors cursor-pointer group"
      >
        {/* Left: Food thumbnail & details */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          {item.image_url ? (
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200/80 shadow-xs relative">
              <img 
                src={item.image_url} 
                alt={item.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                decoding="async"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                }}
              />
              {foodBadges.length > 0 && (
                <div className="absolute top-1 left-1 bg-black/75 text-white text-[9px] px-1 py-0.2 rounded font-black backdrop-blur-xs">
                  {foodBadges[0].icon}
                </div>
              )}
            </div>
          ) : (
            <div className="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center shrink-0 text-stone-400 text-xl border border-stone-200">
              🍽️
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm sm:text-base font-black text-stone-900 group-hover:text-amber-800 transition-colors truncate">
                {item.name}
              </h4>
              {foodBadges.slice(0, 1).map((badge, idx) => (
                <span 
                  key={idx} 
                  className={`inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.2 rounded-full border ${badge.className}`}
                >
                  <span>{badge.icon}</span>
                  <span>{badge.text}</span>
                </span>
              ))}
            </div>
            
            {parsedDesc.description && (
              <p className="mt-0.5 text-xs text-stone-500 line-clamp-1 leading-relaxed font-normal">
                {parsedDesc.description}
              </p>
            )}

            {hasVariants && (
              <span className="inline-block mt-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                {parsedDesc.variants.length} টি সাইজ উপলব্ধ
              </span>
            )}
          </div>
        </div>

        {/* Right: Price & Order button */}
        <div className="shrink-0 flex items-center gap-3">
          <div className="text-right">
            <span className="block text-base sm:text-lg font-black" style={{ color: primaryColor }}>
              ৳ {lowestPrice}
            </span>
            {hasVariants && (
              <span className="text-[10px] text-stone-400 font-medium">হতে শুরু</span>
            )}
          </div>

          {!effectiveViewOnly && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!item.is_available) return;
                setSelectedFood(item);
              }}
              className={`w-9 h-9 rounded-full text-white flex items-center justify-center shadow-sm hover:scale-110 active:scale-95 transition-transform cursor-pointer ${!item.is_available ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ backgroundColor: item.is_available ? primaryColor : '#9CA3AF' }}
              title={!item.is_available ? 'স্টক শেষ' : 'অর্ডার করুন বা সাইজ নির্বাচন করুন'}
              disabled={!item.is_available}
            >
              <Plus size={18} className="stroke-[2.5]" />
            </button>
          )}
        </div>
      </motion.article>
    );
  };

  return (
    <div 
      className="site-canvas min-h-screen text-stone-900 pb-20 font-sans selection:bg-amber-200/50"
      style={{ '--site-bg-art': `url(${settings.backgroundArt || '/images/ilisher-bari/background.png'})` } as React.CSSProperties}
    >
      {/* 1. FLOATING GLASS HEADER */}
      <header className="relative z-20 mx-auto flex h-20 w-[calc(100%-2rem)] max-w-5xl items-center justify-between md:h-24 pt-2">
        {/* Brand Logo & Quick Menu Jump */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link 
            to="/" 
            className="brand-logo glass-control h-13 sm:h-14 px-2 sm:px-2.5 overflow-hidden rounded-xl p-1.5 flex items-center gap-2 sm:gap-2.5 transition-transform hover:scale-105"
            aria-label={settings.name || "ইলিশের বাড়ি"}
          >
            <img 
              src={settings.logo || '/images/ilisher-bari/logo.png'} 
              alt={settings.name || "ইলিশের বাড়ি"} 
              className="h-9 w-9 sm:h-10 sm:w-10 object-contain shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/ilisher-bari/logo.png';
              }}
            />
            <div className="flex flex-col text-left">
              <span className="font-black text-sm sm:text-base text-stone-900 leading-tight">
                {settings.name || "ইলিশের বাড়ি"}
              </span>
              <span className="text-[10px] font-bold text-amber-700 hidden xs:inline">
                রেস্টুরেন্ট মেনু
              </span>
            </div>
          </Link>

          <button 
            type="button"
            onClick={scrollToMenu}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-black glass-control hover:bg-white text-stone-800 transition-colors cursor-pointer shadow-xs"
            title="খাবারের মেনুতে সরাসরি চলে যান"
          >
            <UtensilsCrossed size={14} style={{ color: primaryColor }} />
            <span className="font-black">খাবারের মেনু</span>
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* Delivery Badge or Table Badge */}
          {isDeliveryMode ? (
            <div 
              onClick={scrollToMenu}
              className="glass-control px-3 py-1.5 rounded-full text-xs font-black border border-amber-400/80 bg-amber-50/95 text-amber-900 flex items-center gap-1.5 shadow-xs cursor-pointer hover:bg-amber-100 transition-colors"
              title="হোম ডেলিভারি মোড চালু আছে। মেনু দেখতে ক্লিক করুন।"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>🛵 হোম ডেলিভারি</span>
            </div>
          ) : currentTable ? (
            <div 
              onClick={scrollToMenu}
              className="glass-control px-3 py-1.5 rounded-full text-xs font-black border border-emerald-300 bg-emerald-50/90 text-emerald-900 flex items-center gap-1.5 shadow-xs cursor-pointer hover:bg-emerald-100 transition-colors"
              title="টেবিল নং সংযুক্ত আছে। মেনুতে যেতে ক্লিক করুন।"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>🍽️ টেবিল {currentTable}</span>
            </div>
          ) : null}

          {/* Status & Language Pill */}
          <div className="glass-control flex items-center rounded-full p-1 text-xs font-bold gap-1">
            <span className="flex items-center gap-1.5 px-2.5 py-1 text-stone-700" title={liveStatus.subText}>
              <span className={`w-2 h-2 rounded-full ${liveStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-[11px] font-bold sm:inline">{liveStatus.statusText}</span>
            </span>
            <span 
              className="rounded-full px-3 py-1 text-white shadow-xs"
              style={{ backgroundColor: primaryColor }}
            >
              বাংলা
            </span>
          </div>

          {/* Quick Cart Trigger if items exist */}
          {!effectiveViewOnly && (
            <Link 
              to="/cart" 
              className="glass-control p-2.5 rounded-full relative transition-transform hover:scale-105 flex items-center justify-center text-stone-800"
              aria-label="View Cart"
            >
              <ShoppingBag size={19} />
              {totalItems > 0 && (
                <span 
                  className="absolute -top-1 -right-1 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-md animate-bounce"
                  style={{ backgroundColor: primaryColor }}
                >
                  {totalItems}
                </span>
              )}
            </Link>
          )}
        </div>
      </header>

      {/* 1.1 BRAND HEADER BANNER COMPONENT (DISPLAYING LOGO & NAME TO ALL VISITORS) */}
      <BrandHeaderBanner
        settings={settings}
        isDeliveryMode={isDeliveryMode}
        currentTable={currentTable}
        onScrollToMenu={scrollToMenu}
        onSwitchToDelivery={handleSwitchToDelivery}
        onSwitchToDineIn={handleSwitchToDineIn}
      />

      {/* 2. HERO SHELL SECTION (ILISHER BARI 2-COLUMN DISPLAY) */}
      <section className="hero-shell relative z-10 mx-auto grid min-h-[540px] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-3xl shadow-hero md:grid-cols-[54%_46%] bg-stone-950 mt-2">
        {/* Left Artwork / Photo */}
        <div className="relative min-h-[360px] md:min-h-[540px] overflow-hidden bg-stone-900">
          <img 
            src={settings.heroImage || '/images/ilisher-bari/hero.png'} 
            alt={settings.name} 
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/ilisher-bari/hero.png';
            }}
          />
          {/* Subtle gradient on mobile */}
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent md:hidden" />
        </div>

        {/* Right Hero Glass Content */}
        <div className="hero-glass flex flex-col justify-center px-7 py-10 text-stone-100 md:px-12">
          {/* Eyebrow Highlight */}
          <p className="mb-3 text-xs sm:text-sm font-black tracking-wider uppercase text-amber-400">
            {settings.heroEyebrow || "নদীর হাওয়া, বাংলার স্বাদে"}
          </p>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight tracking-tight text-white">
            {settings.heroTitle || "খাবার নয়, এক টুকরো অনুভব"}
          </h1>

          {/* Subtitle */}
          <p className="mt-4 sm:mt-6 max-w-md text-sm sm:text-base leading-7 sm:leading-8 text-stone-300">
            {settings.heroSubtitle || "স্বাদ, গল্প আর প্রিয়জনের আড্ডা—সব একসঙ্গে।"}
          </p>

          {/* Call to Actions */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button 
              type="button" 
              onClick={scrollToMenu}
              className="rounded-xl px-6 py-3.5 font-black text-white transition-all hover:opacity-95 shadow-lg active:scale-95 cursor-pointer flex items-center gap-2.5 text-sm sm:text-base ring-2 ring-white/20"
              style={{ backgroundColor: primaryColor }}
            >
              <UtensilsCrossed size={18} />
              <span>{settings.heroPrimaryBtnText || "আমাদের আয়োজন ও মেনু দেখুন"}</span>
              <span aria-hidden="true" className="text-lg">›</span>
            </button>

            <a 
              href="#location"
              className="rounded-xl border border-stone-700 bg-stone-900/80 px-5 py-3.5 font-bold text-stone-200 transition-all hover:bg-stone-800 active:scale-95 text-sm sm:text-base flex items-center gap-1.5"
            >
              <span>{settings.heroSecondaryBtnText || "⌖ ঠিকানা ও লোকেশন"}</span>
            </a>
          </div>
        </div>
      </section>

      {/* 3. "আমাদের কথা" (ABOUT US / STORY SECTION) */}
      <section className="glass-section relative z-10 mx-auto my-12 md:my-16 max-w-5xl w-[calc(100%-2rem)] px-6 py-10 md:my-18 md:px-12 md:py-14">
        <p 
          className="text-xs sm:text-sm font-black tracking-wider uppercase"
          style={{ color: primaryColor }}
        >
          {settings.aboutBadge || "আমাদের কথা"}
        </p>

        <div className="mt-4 grid gap-8 md:grid-cols-[1fr_1.2fr] items-start">
          <h2 className="text-2xl sm:text-4xl font-black leading-tight text-stone-900">
            {settings.aboutTitle || "স্বাদ আর আনন্দের এক আপন ঠিকানা"}
          </h2>

          <div className="space-y-4 text-sm sm:text-base leading-7 sm:leading-8 text-stone-600">
            <p>
              {settings.aboutText1 || "শ্রীরায়েরচর বাজার ব্রিজ সংলগ্ন ইলিশের বাড়ি রেস্টুরেন্ট—পরিবার ও বন্ধুদের সঙ্গে পছন্দের খাবার উপভোগ করার মনোরম জায়গা।"}
            </p>
            <p>
              {settings.aboutText2 || "পিজ্জা, বার্গার, বিরিয়ানি, খিচুড়ি, চাইনিজ, কফি, লাচ্ছি ও ফ্রেশ জুসসহ আমাদের বিস্তৃত আয়োজনে সবার জন্য রয়েছে পছন্দের কিছু না কিছু।"}
            </p>
            <p className="font-black text-stone-950 border-l-4 pl-3.5 py-1" style={{ borderColor: primaryColor }}>
              {settings.aboutTagline || "ইলিশের বাড়ি—নতুন স্বাদ, নতুন অভিজ্ঞতা, নতুন বন্ধুত্ব।"}
            </p>
          </div>
        </div>
      </section>

      {/* 4. "খাবারের মেনু" (FOOD MENU SECTION) */}
      <section id="menu" className="menu-glass relative z-10 border-y border-stone-200/90 py-10 md:py-16 scroll-mt-6">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">

          {/* BRAND HEADER FOR MENU VISITORS */}
          <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-stone-900 via-stone-950 to-stone-900 rounded-3xl border border-amber-500/30 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4 text-center sm:text-left">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white p-1.5 shrink-0 shadow-lg border-2 border-amber-400 flex items-center justify-center">
                <img 
                  src={settings.logo || '/images/ilisher-bari/logo.png'} 
                  alt={settings.name || "ইলিশের বাড়ি"} 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/ilisher-bari/logo.png';
                  }}
                />
              </div>
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white">
                    {settings.name || "ইলিশের বাড়ি রেস্টুরেন্ট"}
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-stone-950 shadow-xs">
                    ডিজিটাল মেনু
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-stone-300 mt-0.5 line-clamp-1 font-medium">
                  {settings.shortDesc || "নদীর তাজা রূপালী ইলিশ ও মুখরোচক খাঁটি খাবারের সেরা আয়োজন"}
                </p>
              </div>
            </div>

            {settings.phone && (
              <a 
                href={`tel:${formatTelNumber(settings.phone)}`}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-xs font-bold transition-all shadow-xs shrink-0"
              >
                <Phone size={14} className="text-amber-400" />
                <span>অর্ডার হেল্পলাইন: {settings.phone}</span>
              </a>
            )}
          </div>

          {/* CLOSED BANNER NOTICE (WHEN CLOSED ACCORDING TO SCHEDULE) */}
          {!liveStatus.isOpen && (
            <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 border border-red-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-300">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-sm border border-red-500">
                  <Clock size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-red-950">
                      রেস্টুরেন্ট এখন বন্ধ আছে (Closed Now)
                    </h3>
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  </div>
                  <p className="text-xs text-red-800 mt-0.5 leading-relaxed">
                    আমাদের সময়সূচী: <strong>প্রতিদিন সকাল ১১:০০ AM থেকে রাত ১০:৩০ PM</strong>। সকাল ১১:০০ টায় আবার নতুন অর্ডার নেওয়া শুরু হবে। তবে আপনি এখনই সম্পূর্ণ ডিজিটাল মেনু ঘুরে দেখতে পারেন।
                  </p>
                </div>
              </div>

              {settings.phone && (
                <a
                  href={`tel:${formatTelNumber(settings.phone)}`}
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs self-end sm:self-center shrink-0 flex items-center gap-1.5"
                >
                  <Phone size={13} />
                  <span>জরুরী কল: {settings.phone}</span>
                </a>
              )}
            </div>
          )}

          {/* WELCOME / MODE BANNER (DELIVERY, TABLE, OR GENERAL) */}
          {isDeliveryMode ? (
            <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-black text-2xl shrink-0 shadow-sm border border-amber-500">
                  🛵
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-amber-950">
                      হোম ডেলিভারি মোড সক্রিয় (Home Delivery Active)
                    </h3>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5">
                    পছন্দের খাবার কার্টে যোগ করুন। চেকআউট পেজে ঠিকানা বা লাইভ লোকেশন দিলে দ্রুততম সময়ে পৌঁছে দেওয়া হবে।
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={handleSwitchToDineIn}
                  className="text-xs text-amber-900 hover:text-stone-950 font-bold underline px-2 py-1 transition-colors cursor-pointer"
                  title="রেস্টুরেন্টে বসে খেতে চাইলে এখানে ক্লিক করুন"
                >
                  রেস্টুরেন্টে খেতে চান?
                </button>
              </div>
            </div>
          ) : currentTable ? (
            <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shrink-0 shadow-sm border border-emerald-500">
                  {currentTable}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-emerald-950">
                      স্বাগতম! আপনি টেবিল নং {currentTable}-এ সফলভাবে যুক্ত হয়েছেন
                    </h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    নিচের মেনু থেকে খাবার পছন্দ করে কার্টে যোগ করুন। অর্ডার সরাসরি এই টেবিলে পরিবেশন করা হবে।
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handleResetTable}
                  className="text-xs text-emerald-800 hover:text-red-600 font-bold underline px-2 py-1 transition-colors cursor-pointer"
                  title="অন্য টেবিলে পরিবর্তন করুন"
                >
                  টেবিল পরিবর্তন
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-3.5 sm:p-4 bg-white/90 border border-stone-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">✨</span>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-stone-900">
                    ইলিশের বাড়ি ডিজিটাল মেনুতে স্বাগতম!
                  </p>
                  <p className="text-[11px] text-stone-500">
                    বাসায় বসে হোম ডেলিভারি নিতে চান, নাকি রেস্টুরেন্টে বসে খাবেন?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={handleSwitchToDelivery}
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🛵 হোম ডেলিভারি অর্ডার</span>
                </button>
              </div>
            </div>
          )}

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p 
                className="text-xs sm:text-sm font-black tracking-wider uppercase"
                style={{ color: primaryColor }}
              >
                আমাদের আয়োজন
              </p>
              <h2 className="mt-1 text-3xl sm:text-4xl font-black text-stone-900">খাবারের মেনু</h2>
            </div>

            {/* Search Input Bar with Instant Form Submit */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                scrollToMenu();
              }}
              className="relative w-full sm:w-80"
            >
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                <Search size={16} />
              </div>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    scrollToMenu();
                  }
                }}
                placeholder="খাবারের নাম লিখে খুঁজুন (যেমন: ইলিশ)..."
                className="w-full pl-10 pr-9 py-2.5 bg-white/90 border border-stone-200 rounded-full text-xs sm:text-sm outline-none focus:bg-white focus:border-amber-500 shadow-xs transition-all placeholder:text-stone-400 font-medium"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 cursor-pointer"
                  title="মুছুন"
                >
                  <X size={15} />
                </button>
              )}
            </form>
          </div>

          {/* Sticky Mobile/Desktop Category Navigation Bar with All Categories Sheet */}
          <div className="sticky top-2 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 py-2.5 bg-stone-900/90 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-b border-stone-800/80 sm:border-none shadow-md sm:shadow-none transition-all mt-4 sm:mt-6">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              {/* Quick All Categories Modal Trigger */}
              <button
                type="button"
                onClick={() => setShowCategorySheet(true)}
                className="whitespace-nowrap rounded-full px-3.5 py-1.5 sm:py-2 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md active:scale-95"
                title="সকল ক্যাটাগরি একনজরে দেখুন"
              >
                <Layers size={14} className="stroke-[2.5]" />
                <span>সকল ক্যাটাগরি</span>
              </button>

              {loading && categories.length === 0 ? (
                <span className="text-stone-400 text-xs py-2 font-medium">ক্যাটাগরি লোড হচ্ছে...</span>
              ) : (
                categoryList.map(cat => {
                  const isSelected = activeCategory === cat;
                  const visual = cat === 'All' ? { emoji: '✨', subtitle: '' } : getCategoryVisualInfo(cat);
                  const displayName = cat === 'All' ? 'সকল খাবার' : cat;
                  return (
                    <button 
                      key={cat}
                      type="button"
                      onClick={() => {
                        setActiveCategory(cat);
                        if (searchQuery.trim()) setSearchQuery('');
                      }}
                      className={`whitespace-nowrap rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        isSelected 
                          ? 'text-white shadow-md scale-105 ring-2 ring-amber-400/50'
                          : 'bg-white/90 text-stone-700 hover:text-stone-950 hover:bg-white border border-stone-200/90 shadow-2xs hover:shadow-xs'
                      }`}
                      style={isSelected ? { backgroundColor: primaryColor } : {}}
                    >
                      <span className="text-sm sm:text-base select-none leading-none">{visual.emoji}</span>
                      <span>{displayName}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Category Display Banner & View Mode Switch */}
          {(() => {
            const activeVisual = activeCategory === 'All' ? null : getCategoryVisualInfo(activeCategory);
            return (
              <div className="mt-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
                <div className="flex items-center gap-3.5">
                  {activeVisual && (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200/80 text-amber-950 border border-amber-300 flex items-center justify-center text-2xl shadow-xs shrink-0 select-none">
                      {activeVisual.emoji}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg sm:text-2xl font-black text-stone-900 tracking-tight">
                        {searchQuery.trim() 
                          ? `"${searchQuery}" এর সার্চ ফলাফল` 
                          : (activeCategory === 'All' ? 'ক্যাটাগরি অনুযায়ী আমাদের আয়োজন' : activeCategory)}
                      </h3>
                      <span className="text-xs font-black text-stone-800 bg-amber-100/90 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                        {filteredItems.length} টি খাবার
                      </span>
                      {searchQuery.trim() && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="text-xs text-amber-800 font-black hover:underline cursor-pointer ml-1"
                        >
                          ফিল্টার মুছুন
                        </button>
                      )}
                    </div>
                    {activeVisual && (
                      <p className="text-xs sm:text-sm text-stone-500 font-medium mt-0.5">
                        {activeVisual.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* View Mode Switch (Grid vs Cards vs List) */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-bold text-stone-500 hidden sm:inline">ভিউ মোড:</span>
                  <div className="flex bg-stone-100/90 p-1 rounded-2xl border border-stone-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleSetViewMode('grid')}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        viewMode === 'grid'
                          ? 'bg-white text-stone-950 shadow-xs scale-102 font-black'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                      title="মোবাইল অপ্টিমাইজড ২-কলাম গ্রিড"
                    >
                      <Grid2X2 size={14} className={viewMode === 'grid' ? 'text-amber-600' : ''} />
                      <span>গ্রিড</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetViewMode('cards')}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        viewMode === 'cards'
                          ? 'bg-white text-stone-950 shadow-xs scale-102 font-black'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                      title="বড় ছবিসহ গ্রিড কার্ড ভিউ"
                    >
                      <LayoutGrid size={14} className={viewMode === 'cards' ? 'text-amber-600' : ''} />
                      <span>বড় কার্ড</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetViewMode('list')}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        viewMode === 'list'
                          ? 'bg-white text-stone-950 shadow-xs scale-102 font-black'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                      title="কমপ্যাক্ট লিস্ট ভিউ"
                    >
                      <List size={14} className={viewMode === 'list' ? 'text-amber-600' : ''} />
                      <span>লিস্ট</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* View Only Warning notice if enabled */}
          {effectiveViewOnly && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-bold flex items-center gap-2">
              <Info size={16} className="shrink-0 text-amber-600" />
              <span>আপনি বর্তমানে শুধু মেনু দেখার মোডে (View-Only Mode) রয়েছেন। খাবার অর্ডার করার অপশন বন্ধ রয়েছে।</span>
            </div>
          )}

          {/* Menu Items: Category-wise grouped display OR single category display */}
          {loading && menuItems.length === 0 ? (
            <div className="text-center py-16 text-stone-400 font-medium">মেনুর খাবারসমূহ লোড হচ্ছে...</div>
          ) : activeCategory === 'All' && !searchQuery.trim() ? (
            /* ALL CATEGORIES: SEPARATED BY CATEGORY ACCORDING TO ADMIN ORDER */
            <div className="space-y-12">
              {groupedCategories.map(({ category, name, portions, items }) => (
                <motion.section 
                  key={category.id} 
                  id={`cat-${category.id}`} 
                  className="scroll-mt-28"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  {/* Category Header */}
                  {(() => {
                    const catVisual = getCategoryVisualInfo(name);
                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-amber-200/80 pb-4 mb-6 gap-3">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200/80 text-amber-950 border border-amber-300 flex items-center justify-center text-2xl shadow-xs shrink-0 select-none">
                            {catVisual.emoji}
                          </div>
                          <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h4 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                                {name}
                              </h4>
                              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-100/90 text-amber-950 border border-amber-300/80 shadow-2xs">
                                {items.length} টি আইটেম
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm font-medium text-stone-500 mt-0.5">
                              {catVisual.subtitle}
                            </p>
                            {portions && portions.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="text-[10px] font-bold text-stone-400">সাইজ:</span>
                                {portions.map(p => (
                                  <span key={p} className="text-[10px] font-bold text-amber-900 bg-amber-50/90 px-2 py-0.5 rounded-md border border-amber-200/80 shadow-2xs">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveCategory(name);
                            scrollToMenu();
                          }}
                          className="self-start sm:self-center text-xs font-black text-amber-800 hover:text-amber-950 flex items-center gap-1 bg-amber-50 hover:bg-amber-100 px-3.5 py-2 rounded-xl border border-amber-200 transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>শুধু {name}</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    );
                  })()}

                  {/* Items Grid/List */}
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
                      {items.map(item => renderCompactFoodCard(item))}
                    </div>
                  ) : viewMode === 'cards' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                      {items.map(item => renderFoodCard(item))}
                    </div>
                  ) : (
                    <div className="grid gap-x-10 gap-y-1 md:grid-cols-2">
                      {items.map(item => renderFoodRow(item))}
                    </div>
                  )}
                </motion.section>
              ))}

              {/* Uncategorized Items if any */}
              {uncategorizedItems.length > 0 && (
                <motion.section 
                  className="scroll-mt-28"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  <div className="border-b-2 border-stone-200 pb-3 mb-6">
                    <h4 className="text-xl sm:text-2xl font-black text-stone-900">অন্যান্য খাবার</h4>
                  </div>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
                      {uncategorizedItems.map(item => renderCompactFoodCard(item))}
                    </div>
                  ) : viewMode === 'cards' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                      {uncategorizedItems.map(item => renderFoodCard(item))}
                    </div>
                  ) : (
                    <div className="grid gap-x-10 gap-y-1 md:grid-cols-2">
                      {uncategorizedItems.map(item => renderFoodRow(item))}
                    </div>
                  )}
                </motion.section>
              )}
            </div>
          ) : (
            /* SINGLE CATEGORY OR SEARCH RESULTS */
            filteredItems.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
                  {filteredItems.map(item => renderCompactFoodCard(item))}
                </div>
              ) : viewMode === 'cards' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                  {filteredItems.map(item => renderFoodCard(item))}
                </div>
              ) : (
                <div className="grid gap-x-10 gap-y-1 md:grid-cols-2">
                  {filteredItems.map(item => renderFoodRow(item))}
                </div>
              )
            ) : (
              <div className="text-center py-16 text-stone-400">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-stone-100 flex items-center justify-center text-2xl">
                  🔍
                </div>
                <p className="text-base font-bold text-stone-800">
                  {searchQuery.trim() ? `"${searchQuery}" নামে কোনো খাবার খুঁজে পাওয়া যায়নি` : 'কোন খাবার পাওয়া যায়নি'}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  বানান পরিবর্তন করে চেষ্টা করুন অথবা অন্য ক্যাটাগরি ব্রাউজ করুন।
                </p>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-full shadow-xs transition-colors cursor-pointer"
                  >
                    সকল খাবার দেখুন
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </section>

      {/* 5. "আমাদের ঠিকানা ও সময়সূচি" (LOCATION & HOURS SECTION) */}
      <section id="location" className="glass-section relative z-10 mx-auto my-12 md:my-18 grid max-w-5xl w-[calc(100%-2rem)] gap-8 px-6 py-10 md:grid-cols-2 md:px-12 md:py-14">
        {/* Left: Location & Maps */}
        <div>
          <p 
            className="text-xs sm:text-sm font-black tracking-wider uppercase"
            style={{ color: primaryColor }}
          >
            আমাদের ঠিকানা
          </p>
          <h2 className="mt-2 text-2xl sm:text-4xl font-black leading-tight text-stone-900">
            {settings.locationTitle || "শ্রীরায়েরচর বাজার, মতলব উত্তর"}
          </h2>
          <p className="mt-4 text-sm sm:text-base leading-7 text-stone-600">
            {settings.address || "ব্রিজ সংলগ্ন, গালিমখা, বাংলাবাজার, মতলব উত্তর, চাঁদপুর"}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a 
              href={settings.mapLink || "https://maps.app.goo.gl/dUSj2s41bhvhfK8bA?g_st=ac"} 
              target="_blank" 
              rel="noreferrer" 
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-extrabold text-white transition-all hover:opacity-95 shadow-md active:scale-95 text-xs sm:text-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <MapPin size={16} />
              <span>মানচিত্রে দেখুন (View on Google Map)</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Right: Contact & Hours Glass Card */}
        <div className="glass-card rounded-2xl border border-stone-200/90 p-6 sm:p-8 shadow-soft">
          <dl className="space-y-5">
            {/* Opening Hours */}
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 shrink-0 mt-0.5">
                <Clock size={18} />
              </div>
              <div>
                <dt className="text-xs font-bold text-stone-500 uppercase tracking-wider">খোলার সময়</dt>
                <dd className="mt-0.5 text-base sm:text-lg font-black text-stone-900">
                  {settings.openingHours || "প্রতিদিন ১২:০০ PM — ১০:৩০ PM"}
                </dd>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-3.5 border-t border-stone-100 pt-4">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 shrink-0 mt-0.5">
                <Phone size={18} />
              </div>
              <div className="flex-1">
                <dt className="text-xs font-bold text-stone-500 uppercase tracking-wider">ফোন নম্বর</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                  <a 
                    href={`tel:${formatTelNumber(settings.phone || '01918308706')}`}
                    className="text-base sm:text-lg font-black hover:underline"
                    style={{ color: primaryColor }}
                  >
                    {settings.phone || "০১৯১৮৩০৮৭০৬"}
                  </a>
                  <a
                    href={`tel:${formatTelNumber(settings.phone || '01918308706')}`}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 hover:bg-stone-200"
                  >
                    সরাসরি কল দিন
                  </a>
                </dd>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="flex items-start gap-3.5 border-t border-stone-100 pt-4">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 mt-0.5">
                <MessageCircle size={18} />
              </div>
              <div className="flex-1">
                <dt className="text-xs font-bold text-stone-500 uppercase tracking-wider">হোয়াটসঅ্যাপ অর্ডার ও যোগাযোগ</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                  <a 
                    href={`https://wa.me/${formatWhatsAppNumber(settings.whatsapp || settings.phone || '01918308706')}?text=${encodeURIComponent('আসসালামু আলাইকুম, আমি ইলিশের বাড়ি রেস্টুরেন্ট থেকে খাবার অর্ডার/তথ্য জানতে যোগাযোগ করছি।')}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-sm sm:text-base font-black text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <span>{settings.whatsapp || "০১৯১৮৩০৮৭০৬"}</span>
                    <ExternalLink size={12} />
                  </a>
                  <a
                    href={`https://wa.me/${formatWhatsAppNumber(settings.whatsapp || settings.phone || '01918308706')}?text=${encodeURIComponent('আসসালামু আলাইকুম, আমি ইলিশের বাড়ি রেস্টুরেন্ট থেকে খাবার অর্ডার/তথ্য জানতে যোগাযোগ করছি।')}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  >
                    হোয়াটসঅ্যাপ চ্যাট
                  </a>
                </dd>
              </div>
            </div>

            {/* Facebook */}
            {settings.facebookUrl && (
              <div className="flex items-start gap-3.5 border-t border-stone-100 pt-4">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 shrink-0 mt-0.5 font-bold text-sm">
                  f
                </div>
                <div>
                  <dt className="text-xs font-bold text-stone-500 uppercase tracking-wider">ফেসবুক পেজ</dt>
                  <dd className="mt-0.5">
                    <a 
                      href={settings.facebookUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-sm font-extrabold hover:underline flex items-center gap-1 text-blue-700"
                    >
                      <span>আমাদের অফিসিয়াল ফেসবুক পেজ</span>
                      <ExternalLink size={12} />
                    </a>
                  </dd>
                </div>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="hero-glass relative z-10 px-5 py-12 text-center text-stone-200 mt-14 border-t border-stone-800">
        <div className="brand-logo mx-auto h-16 w-28 overflow-hidden rounded-xl bg-stone-900/60 p-1 flex items-center justify-center border border-stone-800">
          <img 
            src={settings.logo || '/images/ilisher-bari/logo.png'} 
            alt={settings.name} 
            className="h-full w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/ilisher-bari/logo.png';
            }}
          />
        </div>
        <h4 className="mt-3 font-extrabold text-stone-100 text-base">{settings.name}</h4>
        <p className="mt-1 text-xs text-stone-400 max-w-sm mx-auto">{settings.shortDesc}</p>
        <p className="mt-5 text-xs text-stone-500">{settings.footerCopyright || "© ২০২৬ ইলিশের বাড়ি রেস্টুরেন্ট। সর্বস্বত্ব সংরক্ষিত।"}</p>
      </footer>

      {/* 7. FLOATING BOTTOM CART BAR (FOR EASY ORDERING) */}
      {!effectiveViewOnly && totalItems > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-40 pointer-events-none animate-in slide-in-from-bottom-6 duration-300">
          <div className="w-full max-w-md pointer-events-auto">
            <Link 
              to="/cart" 
              className="w-full text-white rounded-2xl py-3.5 px-6 flex items-center justify-between shadow-2xl active:scale-[0.98] transition-all hover:brightness-110"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/25 px-3 py-1 rounded-full text-xs font-black border border-white/20">
                  {totalItems} টি আইটেম
                </div>
                <span className="font-extrabold text-sm sm:text-base">অর্ডার দেখুন (View Cart)</span>
              </div>
              <span className="font-black text-base sm:text-lg">৳ {totalPrice}</span>
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

      {/* 8. QUICK CATEGORY SHEET MODAL (MOBILE FRIENDLY) */}
      {showCategorySheet && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-200 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200 overflow-hidden"
          >
            {/* Sheet Header */}
            <div className="flex items-center justify-between p-4.5 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">সকল খাবারের ক্যাটাগরি</h3>
                  <p className="text-[11px] text-stone-500">পছন্দের ক্যাটাগরিতে এক ক্লিকে যেতে ট্যাপ করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCategorySheet(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Categories Grid */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('All');
                  if (searchQuery.trim()) setSearchQuery('');
                  setShowCategorySheet(false);
                  scrollToMenu();
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  activeCategory === 'All'
                    ? 'border-amber-500 bg-amber-50/80 shadow-xs ring-1 ring-amber-400'
                    : 'border-stone-200 hover:border-amber-300 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">✨</span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                    {menuItems.length} টি
                  </span>
                </div>
                <div className="mt-2">
                  <span className="block text-xs font-black text-stone-900">সকল খাবার</span>
                  <span className="text-[10px] text-stone-400">সম্পূর্ণ মেনু</span>
                </div>
              </button>

              {categories.map((cat) => {
                const count = menuItems.filter(m => m.category_id === cat.id).length;
                const visual = getCategoryVisualInfo(cat.name);
                const isSelected = activeCategory === cat.name;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat.name);
                      if (searchQuery.trim()) setSearchQuery('');
                      setShowCategorySheet(false);
                      scrollToMenu();
                    }}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/80 shadow-xs ring-1 ring-amber-400'
                        : 'border-stone-200 hover:border-amber-300 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{visual.emoji}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        {count} টি
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="block text-xs font-black text-stone-900 line-clamp-1">{cat.name}</span>
                      <span className="text-[10px] text-stone-400 line-clamp-1">{visual.subtitle || 'সুস্বাদু খাবার'}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Sheet Footer */}
            <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[11px] font-medium text-stone-500">মোট ক্যাটাগরি: {categories.length} টি</span>
              <button
                type="button"
                onClick={() => setShowCategorySheet(false)}
                className="px-4 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition-colors cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
