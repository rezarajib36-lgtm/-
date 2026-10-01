import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Search, Plus, Minus, Trash2, Printer, Utensils, 
  Check, AlertCircle, ShoppingCart, Tag, Sparkles
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { parseDescriptionData, parseCategoryData } from '../../utils';
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from '../../data/initialMenuData';
import { getAllImagesFromIDB } from '../../lib/imageStorage';
import { parseOrderItems, extractDiscountFromSummary } from '../../utils/thermalPrinter';

interface AddFoodToOrderModalProps {
  order: any;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: any, shouldPrint?: boolean) => void;
}

interface StagedItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
  variantName?: string;
  isCustom?: boolean;
}

export default function AddFoodToOrderModal({
  order,
  onClose,
  onOrderUpdated,
}: AddFoodToOrderModalProps) {
  const [activeTab, setActiveTab] = useState<'menu' | 'custom'>('menu');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Menu items and categories with guaranteed fallbacks
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_menu_categories');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }
    }
    return (INITIAL_CATEGORIES as any) || [];
  });

  const [menuItems, setMenuItems] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_menu_items');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }
    }
    return (INITIAL_MENU_ITEMS as any) || [];
  });

  const [loadingMenu, setLoadingMenu] = useState(false);

  // Selected new items to be added to this order
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);

  // Item currently being configured from menu (if it has variants or instructions)
  const [configuringItem, setConfiguringItem] = useState<any | null>(null);
  const [configQty, setConfigQty] = useState(1);
  const [configVariant, setConfigVariant] = useState<any | null>(null);
  const [configNote, setConfigNote] = useState('');

  // Custom Item inputs
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState(1);
  const [customNote, setCustomNote] = useState('');

  // Existing discount extracted from order
  const existingDiscountInfo = useMemo(() => {
    return extractDiscountFromSummary(order.items_summary || '');
  }, [order.items_summary]);

  const initialDiscount = useMemo(() => {
    if (order.discount_amount !== undefined && order.discount_amount !== null && Number(order.discount_amount) > 0) {
      return String(order.discount_amount);
    }
    if (order.discount !== undefined && order.discount !== null && Number(order.discount) > 0) {
      return String(order.discount);
    }
    if (existingDiscountInfo.discount > 0) {
      return String(existingDiscountInfo.discount);
    }
    return '';
  }, [order.discount_amount, order.discount, existingDiscountInfo.discount]);

  // Discount state (কাস্টমারকে দেওয়া ছাড় / ডিসকাউন্ট)
  const [discountAmount, setDiscountAmount] = useState<string>(initialDiscount);
  const [discountNote, setDiscountNote] = useState<string>(existingDiscountInfo.discountNote || '');

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveAction, setSaveAction] = useState<'save' | 'print'>('save');

  // Parse existing food items (strictly food only, without discount tags)
  const existingItems = useMemo(() => parseOrderItems(order.items_summary), [order.items_summary]);

  const existingFoodSubtotal = useMemo(() => {
    const sum = existingItems.reduce((acc, it) => acc + ((it.price || 0) * (it.qty || 1)), 0);
    if (sum > 0) return sum;
    const baseSaved = Number(order.total_amount || 0);
    const prevDisc = Number(order.discount_amount || order.discount || existingDiscountInfo.discount || 0);
    return baseSaved + prevDisc;
  }, [existingItems, order.total_amount, order.discount_amount, order.discount, existingDiscountInfo.discount]);

  // Load menu items from IndexedDB and Supabase
  useEffect(() => {
    async function fetchMenu() {
      // 1. First attach stored IndexedDB images to local items
      try {
        const idbImages = await getAllImagesFromIDB();
        if (idbImages && Object.keys(idbImages).length > 0) {
          setMenuItems(prev => prev.map(it => {
            if (idbImages[it.id]) {
              return { ...it, image_url: idbImages[it.id] };
            }
            return it;
          }));
        }
      } catch (err) {
        console.warn('IDB images fetch warning in AddFood modal:', err);
      }

      // 2. Fetch from Supabase if online
      if (!supabase) return;
      setLoadingMenu(true);
      try {
        const [catRes, itemRes] = await Promise.all([
          supabase.from('categories').select('*').order('created_at'),
          supabase.from('menu_items').select('*').order('created_at')
        ]);

        if (catRes.data && catRes.data.length > 0) {
          const cleanCats = catRes.data.filter((c: any) => c.name && !c.name.startsWith('__SYSTEM_') && !c.name.startsWith('__CONFIG_'));
          setCategories(cleanCats);
          localStorage.setItem('cached_menu_categories', JSON.stringify(cleanCats));
        }
        if (itemRes.data && itemRes.data.length > 0) {
          const idbImages = await getAllImagesFromIDB().catch(() => ({}));
          const merged = itemRes.data.map((it: any) => ({
            ...it,
            image_url: idbImages[it.id] || it.image_url
          }));
          setMenuItems(merged);
          localStorage.setItem('cached_menu_items', JSON.stringify(merged));
        }
      } catch (err) {
        console.warn('Error fetching menu items for order update:', err);
      } finally {
        setLoadingMenu(false);
      }
    }

    fetchMenu();
  }, []);

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.description && item.description.toLowerCase().includes(query));

      const matchesCat = selectedCategory === 'All' || item.category_id === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [menuItems, searchQuery, selectedCategory]);

  // Handle clicking a menu item
  const handleItemSelect = (item: any) => {
    const { variants } = parseDescriptionData(item.description);
    if (variants && variants.length > 0) {
      // Has variants (Half / Full), open configuration
      setConfiguringItem(item);
      setConfigVariant(variants[0]);
      setConfigQty(1);
      setConfigNote('');
    } else {
      // Direct quick add
      addStagedItem({
        id: `item_${item.id}_${Date.now()}`,
        name: item.name,
        price: item.price,
        quantity: 1,
      });
    }
  };

  // Add or increment staged item
  const addStagedItem = (newItem: StagedItem) => {
    setStagedItems(prev => {
      const existingIdx = prev.findIndex(i => 
        i.name === newItem.name && 
        i.price === newItem.price && 
        i.variantName === newItem.variantName &&
        i.note === newItem.note
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += newItem.quantity;
        return updated;
      }
      return [...prev, newItem];
    });

    // Reset configuring item if open
    setConfiguringItem(null);
  };

  // Confirm adding configured item
  const handleConfirmConfiguredItem = () => {
    if (!configuringItem) return;
    const finalPrice = configVariant ? configVariant.price : configuringItem.price;
    const displayName = configVariant 
      ? `${configuringItem.name} (${configVariant.name})` 
      : configuringItem.name;

    addStagedItem({
      id: `item_${configuringItem.id}_${Date.now()}`,
      name: displayName,
      price: finalPrice,
      quantity: configQty,
      variantName: configVariant?.name,
      note: configNote.trim() || undefined,
    });
  };

  // Handle adding custom item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const priceNum = parseFloat(customPrice);
    if (isNaN(priceNum) || priceNum < 0) return;

    addStagedItem({
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      price: priceNum,
      quantity: customQty,
      note: customNote.trim() || undefined,
      isCustom: true,
    });

    setCustomName('');
    setCustomPrice('');
    setCustomQty(1);
    setCustomNote('');
  };

  // Update staged item quantity
  const updateStagedQty = (idx: number, delta: number) => {
    setStagedItems(prev => {
      const updated = [...prev];
      const target = updated[idx];
      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== idx);
      }
      target.quantity = newQty;
      return updated;
    });
  };

  // Remove staged item
  const removeStagedItem = (idx: number) => {
    setStagedItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Calculations
  const addedTotal = stagedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const totalFoodSubtotal = existingFoodSubtotal + addedTotal;
  const discountVal = Math.max(0, parseFloat(discountAmount) || 0);
  // Discount is STRICTLY SUBTRACTED from total food cost:
  const updatedTotal = Math.max(0, totalFoodSubtotal - discountVal);

  // Submit and update order in Supabase and LocalStorage
  const handleSaveOrder = async (shouldPrint: boolean) => {
    if (stagedItems.length === 0 && discountVal === 0 && discountAmount === initialDiscount) return;
    setIsSaving(true);
    setSaveAction(shouldPrint ? 'print' : 'save');

    try {
      // 1. Generate text snippet for the newly added items with exact unit price
      let newFoodSnippet = '';
      if (stagedItems.length > 0) {
        newFoodSnippet = stagedItems.map(item => {
          const noteStr = item.note ? ` (${item.note})` : '';
          const priceStr = item.price > 0 ? ` [৳${item.price}]` : '';
          return `${item.quantity}x ${item.name}${priceStr}${noteStr}`;
        }).join(', ');
      }

      // 2. Base summary without previous discount tags
      let cleanBase = existingDiscountInfo.cleanSummary;
      if (cleanBase && newFoodSnippet) {
        cleanBase = `${cleanBase}, ${newFoodSnippet}`;
      } else if (newFoodSnippet) {
        cleanBase = newFoodSnippet;
      }

      // 3. Attach single clean discount tag if discountVal > 0
      let combinedSummary = cleanBase;
      if (discountVal > 0) {
        const dNote = discountNote.trim() ? ` (${discountNote.trim()})` : '';
        const tag = `[ছাড়/Discount: -৳${discountVal}${dNote}]`;
        combinedSummary = cleanBase ? `${cleanBase}, ${tag}` : tag;
      }

      const newTotalAmount = updatedTotal;

      // 4. Update Supabase
      if (supabase) {
        try {
          if (order.id) {
            await supabase.from('orders').update({
              items_summary: combinedSummary,
              total_amount: newTotalAmount,
            }).eq('id', order.id);
          }
          if (order.order_number) {
            await supabase.from('orders').update({
              items_summary: combinedSummary,
              total_amount: newTotalAmount,
            }).eq('order_number', order.order_number);
          }
        } catch (dbErr) {
          console.warn('Supabase update order error:', dbErr);
        }
      }

      // 5. Update LocalStorage backup
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) {
          const locals = JSON.parse(stored);
          const updated = locals.map((o: any) => {
            if ((order.id && o.id === order.id) || (order.order_number && o.order_number === order.order_number)) {
              return {
                ...o,
                items_summary: combinedSummary,
                total_amount: newTotalAmount,
                discount_amount: discountVal,
                discount_note: discountNote.trim() || undefined,
              };
            }
            return o;
          });
          localStorage.setItem('restaurant_local_orders', JSON.stringify(updated));
        }
      } catch (lsErr) {
        console.warn('LocalStorage update order error:', lsErr);
      }

      // 6. Build updated order object
      const updatedOrder = {
        ...order,
        items_summary: combinedSummary,
        total_amount: newTotalAmount,
        discount_amount: discountVal,
        discount_note: discountNote.trim() || undefined,
      };

      // 7. Notify parent component
      onOrderUpdated(updatedOrder, shouldPrint);
      onClose();
    } catch (err) {
      console.error('Failed to update order with new items:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 to-stone-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Utensils size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  অর্ডারে নতুন খাবার যুক্ত করুন
                </h3>
                <span className="bg-amber-400 text-stone-950 font-black text-xs px-2 py-0.5 rounded-md">
                  {order.order_number}
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                {order.customer_name || 'কাস্টমার'} • {order.location || 'টেবিল'} • বর্তমান বিল: ৳{order.total_amount}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Order Quick Summary Strip */}
        <div className="bg-amber-50 px-4 sm:px-5 py-2.5 border-b border-amber-200 flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-900">ইতিমধ্যে অর্ডারকৃত খাবার:</span>
            <span className="text-stone-700 truncate max-w-[280px] sm:max-w-md font-medium">
              {order.items_summary || 'কোনো আইটেম নেই'}
            </span>
          </div>
          <span className="font-extrabold text-amber-950 bg-amber-200 px-2 py-0.5 rounded">
            পূর্বের বিল: ৳{order.total_amount}
          </span>
        </div>

        {/* Content Tabs Header */}
        <div className="flex border-b border-gray-100 bg-gray-50/70 px-4 sm:px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'menu'
                ? 'border-stone-900 text-stone-950 font-black'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Utensils size={14} />
            <span>রেস্টুরেন্ট মেনু থেকে বাছাই করুন</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'custom'
                ? 'border-stone-900 text-stone-950 font-black'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Plus size={14} />
            <span>কাস্টম খাবার / আইটেম লিখুন</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* TAB 1: MENU ITEMS BROWSER */}
          {activeTab === 'menu' && (
            <div className="space-y-3">
              {/* Search & Category Filter */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="খাবারের নাম লিখে খুঁজুন (e.g. বিরিয়ানি, ইলিশ, ভাত, কোক)..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:border-stone-900 transition-all"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                {categories.length > 0 && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('All')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        selectedCategory === 'All'
                          ? 'bg-stone-900 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      সব ({menuItems.length})
                    </button>
                    {categories.map(cat => {
                      const { name } = parseCategoryData(cat.name);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                            selectedCategory === cat.id
                              ? 'bg-stone-900 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Menu Items List */}
              {loadingMenu && menuItems.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  মেনু আইটেম লোড হচ্ছে...
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="py-10 text-center text-gray-400 flex flex-col items-center">
                  <Utensils size={28} className="text-gray-300 mb-1" />
                  <p className="text-xs font-bold text-gray-600">কোনো খাবার পাওয়া যায়নি</p>
                  <p className="text-[11px] text-gray-400">অন্য কোনো নাম দিয়ে সার্চ করুন অথবা কাস্টম আইটেম ট্যাব ব্যবহার করুন</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                  {filteredMenuItems.map(item => {
                    const { variants } = parseDescriptionData(item.description);
                    const hasVariants = variants && variants.length > 0;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemSelect(item)}
                        className="p-2.5 rounded-xl border border-gray-200 hover:border-amber-400 bg-white hover:bg-amber-50/40 transition-all flex items-center justify-between gap-2.5 cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          {item.image_url ? (
                            <img 
                              src={item.image_url} 
                              alt={item.name} 
                              className="w-11 h-11 rounded-lg object-cover border border-gray-100 shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0 text-xs">
                              <Utensils size={16} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-gray-900 truncate group-hover:text-amber-950">
                              {item.name}
                            </p>
                            <p className="text-xs font-black text-amber-700">
                              ৳{item.price}
                              {hasVariants && <span className="text-[10px] text-gray-400 font-normal ml-1">(ভ্যারিয়েন্ট আছে)</span>}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-amber-500 group-hover:text-stone-950 text-gray-700 flex items-center justify-center shrink-0 transition-colors shadow-2xs font-bold"
                          title="অর্ডারে যোগ করুন"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CUSTOM FOOD OR EXTRA ITEM */}
          {activeTab === 'custom' && (
            <form onSubmit={handleAddCustomItem} className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 space-y-3">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-xs uppercase tracking-wide">
                <Tag size={14} className="text-amber-600" />
                <span>মেনুর বাইরের খাবার বা এক্সট্রা আইটেম লিখুন:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    খাবারের নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. এক্সট্রা চা, স্পেশাল সালাদ, পানি"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm outline-none focus:border-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    প্রতিটির দাম (৳) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm outline-none focus:border-stone-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    পরিমাণ (Quantity)
                  </label>
                  <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 w-fit">
                    <button
                      type="button"
                      onClick={() => setCustomQty(Math.max(1, customQty - 1))}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-extrabold">{customQty}</span>
                    <button
                      type="button"
                      onClick={() => setCustomQty(customQty + 1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    বিশেষ নির্দেশনা (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="e.g. চিনি ছাড়া, গরম"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm outline-none focus:border-stone-900"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>তালিকায় যোগ করুন</span>
                </button>
              </div>
            </form>
          )}

          {/* ITEM CONFIGURATION POPUP (when item has variants) */}
          {configuringItem && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-stone-950 text-sm">{configuringItem.name}</h4>
                  <p className="text-[11px] text-amber-900">ভ্যারিয়েন্ট ও পরিমাণ নির্বাচন করুন</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfiguringItem(null)}
                  className="text-stone-500 hover:text-stone-900"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Variants Selector */}
              {(() => {
                const { variants } = parseDescriptionData(configuringItem.description);
                if (!variants || variants.length === 0) return null;

                return (
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 uppercase mb-1">
                      সাইজ / ভ্যারিয়েন্ট:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {variants.map((v: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setConfigVariant(v)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            configVariant?.name === v.name
                              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                              : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-300'
                          }`}
                        >
                          {v.name} - ৳{v.price}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-amber-950 uppercase mb-1">
                    পরিমাণ:
                  </label>
                  <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-amber-300 w-fit">
                    <button
                      type="button"
                      onClick={() => setConfigQty(Math.max(1, configQty - 1))}
                      className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold flex items-center justify-center"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-extrabold">{configQty}</span>
                    <button
                      type="button"
                      onClick={() => setConfigQty(configQty + 1)}
                      className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold flex items-center justify-center"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[11px] font-bold text-amber-950 uppercase mb-1">
                    নির্দেশনা (ঐচ্ছিক):
                  </label>
                  <input
                    type="text"
                    value={configNote}
                    onChange={(e) => setConfigNote(e.target.value)}
                    placeholder="e.g. ঝাল বেশি"
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs outline-none focus:border-stone-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/80">
                <button
                  type="button"
                  onClick={() => setConfiguringItem(null)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleConfirmConfiguredItem}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check size={14} />
                  <span>তালিকায় যুক্ত করুন</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGED ITEMS SUMMARY (নতুন যে খাবারগুলো এই অর্ডারে যুক্ত হচ্ছে) */}
          <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/60">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} className="text-stone-700" />
                <h4 className="text-xs sm:text-sm font-extrabold text-stone-900 uppercase tracking-wide">
                  যুক্ত হতে যাওয়া নতুন খাবারসমূহ:
                </h4>
              </div>
              <span className="text-xs font-bold text-stone-500">
                {stagedItems.length} টি আইটেম
              </span>
            </div>

            {stagedItems.length === 0 ? (
              <div className="p-5 text-center bg-white rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs">
                এখনো কোনো নতুন খাবার নির্বাচন করা হয়নি। উপরের তালিকা থেকে খাবার ক্লিক করে যোগ করুন।
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {stagedItems.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-stone-900">{item.name}</span>
                          {item.isCustom && (
                            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                              কাস্টম
                            </span>
                          )}
                        </div>
                        {item.note && (
                          <span className="text-[11px] text-amber-800 italic block">
                            * {item.note}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-500">
                          ৳{item.price} × {item.quantity} = <strong className="text-stone-900 font-bold">৳{item.price * item.quantity}</strong>
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateStagedQty(idx, -1)}
                          className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-6 text-center font-extrabold text-xs">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateStagedQty(idx, 1)}
                          className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStagedItem(idx)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-1 cursor-pointer"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DISCOUNT / ছাড় প্রদান সেকশন */}
                <div className="border border-emerald-300 rounded-xl p-3 bg-emerald-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-emerald-950 font-black text-xs">
                      <Tag size={14} className="text-emerald-700" />
                      <span>কাস্টমারকে ডিসকাউন্ট বা ছাড় দিন (ঐচ্ছিক):</span>
                    </div>
                    {discountVal > 0 && (
                      <span className="bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                        -৳{discountVal} ছাড়
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 items-center">
                    <div className="relative flex-1 w-full">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">৳</span>
                      <input
                        type="number"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        placeholder="ডিসকাউন্ট টাকার পরিমাণ (যেমন: ২০, ৫০, ১০০)..."
                        className="w-full pl-7 pr-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs sm:text-sm outline-none font-bold text-emerald-950 focus:ring-1 focus:ring-emerald-600"
                      />
                    </div>

                    {/* Quick discount buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                      {[10, 20, 50, 100].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDiscountAmount(String(amt))}
                          className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            discountAmount === String(amt)
                              ? 'bg-emerald-700 text-white shadow-2xs'
                              : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          ৳{amt}
                        </button>
                      ))}
                      {discountAmount && (
                        <button
                          type="button"
                          onClick={() => {
                            setDiscountAmount('');
                            setDiscountNote('');
                          }}
                          className="px-1.5 py-1 text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                        >
                          মুছুন
                        </button>
                      )}
                    </div>
                  </div>

                  {discountVal > 0 && (
                    <input
                      type="text"
                      value={discountNote}
                      onChange={(e) => setDiscountNote(e.target.value)}
                      placeholder="ছাড়ের কারণ বা নোট (যেমন: বিশেষ ছাড়, নিয়মিত কাস্টমার)..."
                      className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs outline-none text-gray-700 focus:border-emerald-600"
                    />
                  )}
                </div>

                {/* Calculation breakdown */}
                <div className="bg-amber-100/70 p-3 rounded-xl border border-amber-200/90 text-xs space-y-1.5">
                  <div className="flex justify-between text-stone-700">
                    <span>পূর্বের খাবারের মূল্য:</span>
                    <span className="font-bold">৳{existingFoodSubtotal}</span>
                  </div>
                  {addedTotal > 0 && (
                    <div className="flex justify-between text-amber-900 font-bold">
                      <span>নতুন খাবারের মূল্য:</span>
                      <span>+৳{addedTotal}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-900 font-bold border-t border-amber-200/60 pt-1">
                    <span>মোট খাবারের মূল্য:</span>
                    <span>৳{totalFoodSubtotal}</span>
                  </div>
                  {discountVal > 0 && (
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>ডিসকাউন্ট / ছাড়:</span>
                      <span className="font-black text-emerald-700">-৳{discountVal}</span>
                    </div>
                  )}
                  <div className="border-t border-amber-300 pt-1.5 flex justify-between items-center text-sm font-black text-stone-950">
                    <div>
                      <span>আপডেটেড সর্বমোট বিল:</span>
                      {discountVal > 0 && (
                        <span className="block text-[10px] text-emerald-800 font-normal">
                          (খাবারের মোট মূল্য ৳{totalFoodSubtotal} থেকে ৳{discountVal} ছাড় বিয়োগ)
                        </span>
                      )}
                    </div>
                    <span className="text-base text-stone-950 bg-amber-200 px-2.5 py-0.5 rounded-lg border border-amber-300 font-black shadow-2xs">
                      ৳{updatedTotal}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            বাতিল করুন
          </button>

          <div className="flex items-center gap-2">
            {/* Save Only Button */}
            <button
              type="button"
              disabled={isSaving || (stagedItems.length === 0 && discountVal === 0)}
              onClick={() => handleSaveOrder(false)}
              className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving && saveAction === 'save' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>সেভ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>{discountVal > 0 && stagedItems.length === 0 ? 'ডিসকাউন্ট সেভ করুন' : 'যোগ করুন ও সেভ করুন'}</span>
                </>
              )}
            </button>

            {/* Save and Print Immediately Button */}
            <button
              type="button"
              disabled={isSaving || (stagedItems.length === 0 && discountVal === 0)}
              onClick={() => handleSaveOrder(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs sm:text-sm shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              title="নতুন খাবার/ডিসকাউন্ট যোগ করে সরাসরি থার্মাল রসিদ প্রিন্ট করুন"
            >
              {isSaving && saveAction === 'print' ? (
                <>
                  <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>আপডেট ও প্রিন্ট হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Printer size={16} />
                  <span>যোগ করুন ও বিল প্রিন্ট করুন</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
