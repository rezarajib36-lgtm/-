import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Trash2, Plus, Minus, Utensils, Printer, Save, AlertCircle, 
  CheckCircle2, Search, Edit3, ArrowRight, RefreshCw, ShoppingBag 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { parseDescriptionData } from '../../utils';
import { parseOrderItems } from '../../utils/thermalPrinter';

export interface EditableOrderItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  note?: string;
}

interface EditOrderItemsModalProps {
  order: any;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: any, shouldPrint: boolean) => void;
}

export default function EditOrderItemsModal({
  order,
  onClose,
  onOrderUpdated,
}: EditOrderItemsModalProps) {
  // Menu items list for price matching & quick adding
  const [allMenuItems, setAllMenuItems] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_menu_items');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }
    }
    return [];
  });

  // Fetch menu if not cached
  useEffect(() => {
    if (allMenuItems.length === 0 && supabase) {
      supabase.from('menu_items').select('*').then(res => {
        if (res.data && res.data.length > 0) {
          setAllMenuItems(res.data);
          localStorage.setItem('cached_menu_items', JSON.stringify(res.data));
        }
      });
    }
  }, [allMenuItems.length]);

  // Initial parse of order items using enhanced parseOrderItems
  const [items, setItems] = useState<EditableOrderItem[]>(() => {
    const rawSummary = order?.items_summary || '';
    if (!rawSummary.trim()) return [];

    const totalAmt = Number(order?.total_amount || 0);
    const parsedList = parseOrderItems(rawSummary, totalAmt);

    return parsedList.map((item, idx) => ({
      id: `orig_${idx}_${Date.now()}`,
      name: item.name,
      qty: item.qty > 0 ? item.qty : 1,
      unitPrice: item.price || 0,
      note: item.note,
    }));
  });

  // Quick add new item state
  const [showAddSection, setShowAddSection] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemNote, setCustomItemNote] = useState('');

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveAction, setSaveAction] = useState<'save' | 'print' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Deleted items memory for quick Undo
  const [lastDeletedItem, setLastDeletedItem] = useState<{ item: EditableOrderItem; index: number } | null>(null);

  // Calculations
  const calculatedItemsTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.qty * (item.unitPrice || 0)), 0);
  }, [items]);

  // Allow custom total override or sync with calculated
  const [totalOverride, setTotalOverride] = useState<string>(() => {
    return String(order?.total_amount || 0);
  });
  const [isManualTotal, setIsManualTotal] = useState(false);

  // Sync totalOverride if not manually customized and items change
  const previousTotal = Number(order?.total_amount || 0);
  const currentCalculatedTotal = isManualTotal 
    ? (parseFloat(totalOverride) || 0)
    : calculatedItemsTotal;

  const totalDifference = currentCalculatedTotal - previousTotal;

  // Quantity handlers
  const handleQuantityChange = (id: string, delta: number) => {
    setItems(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.qty + delta;
          if (newQty < 1) return item; // Don't allow 0 here, use delete button
          return { ...item, qty: newQty };
        }
        return item;
      });
    });
  };

  const handleSetExactQty = (id: string, newQtyStr: string) => {
    const val = parseInt(newQtyStr, 10);
    if (isNaN(val) || val < 1) return;
    setItems(prev => prev.map(item => item.id === id ? { ...item, qty: val } : item));
  };

  const handlePriceChange = (id: string, newPriceStr: string) => {
    const val = parseFloat(newPriceStr);
    const cleanPrice = isNaN(val) || val < 0 ? 0 : val;
    setItems(prev => prev.map(item => item.id === id ? { ...item, unitPrice: cleanPrice } : item));
  };

  const handleNoteChange = (id: string, newNote: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, note: newNote } : item));
  };

  // Delete item handler
  const handleDeleteItem = (id: string) => {
    const idx = items.findIndex(it => it.id === id);
    if (idx !== -1) {
      const removed = items[idx];
      setLastDeletedItem({ item: removed, index: idx });
      setItems(prev => prev.filter(it => it.id !== id));
    }
  };

  // Undo delete
  const handleUndoDelete = () => {
    if (lastDeletedItem) {
      setItems(prev => {
        const next = [...prev];
        next.splice(lastDeletedItem.index, 0, lastDeletedItem.item);
        return next;
      });
      setLastDeletedItem(null);
    }
  };

  // Add Item from Menu
  const handleSelectMenuItem = (menuItem: any, variant?: any) => {
    const itemName = menuItem.name;
    const unitPrice = variant ? Number(variant.price) : Number(menuItem.price || 0);
    const note = variant ? variant.name : undefined;

    // Check if already in list
    const existingIndex = items.findIndex(it => it.name === itemName && it.note === note);
    if (existingIndex !== -1) {
      setItems(prev => prev.map((it, idx) => 
        idx === existingIndex ? { ...it, qty: it.qty + 1 } : it
      ));
    } else {
      setItems(prev => [
        ...prev,
        {
          id: `new_${Date.now()}_${Math.random()}`,
          name: itemName,
          qty: 1,
          unitPrice,
          note,
        }
      ]);
    }
    setQuickSearch('');
    setShowAddSection(false);
  };

  // Add Custom Item
  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim()) return;
    const priceVal = parseFloat(customItemPrice);
    if (isNaN(priceVal) || priceVal < 0) return;

    setItems(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        name: customItemName.trim(),
        qty: customItemQty > 0 ? customItemQty : 1,
        unitPrice: priceVal,
        note: customItemNote.trim() || undefined,
      }
    ]);

    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemQty(1);
    setCustomItemNote('');
    setShowAddSection(false);
  };

  // Filter menu items for quick search
  const filteredMenuItems = useMemo(() => {
    if (!quickSearch.trim()) return [];
    const q = quickSearch.toLowerCase().trim();
    return allMenuItems.filter(item => 
      item.name && item.name.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [allMenuItems, quickSearch]);

  // Save changes to database and local storage
  const handleSave = async (shouldPrint: boolean) => {
    if (items.length === 0) {
      setErrorMsg('অর্ডারে কমপক্ষে একটি খাবার থাকতে হবে। সব মুছে ফেলতে চাইলে অর্ডারটি ডিলিট করুন।');
      return;
    }

    setIsSaving(true);
    setSaveAction(shouldPrint ? 'print' : 'save');
    setErrorMsg(null);

    try {
      // 1. Build the updated items_summary string with exact food unit price
      const updatedSummary = items.map(item => {
        const noteStr = item.note ? ` (${item.note})` : '';
        const priceStr = item.unitPrice > 0 ? ` [৳${item.unitPrice}]` : '';
        return `${item.qty}x ${item.name}${priceStr}${noteStr}`;
      }).join(', ');

      const finalTotal = isManualTotal 
        ? (parseFloat(totalOverride) || 0)
        : calculatedItemsTotal;

      // 2. Update Supabase
      if (supabase) {
        try {
          if (order.id) {
            await supabase.from('orders').update({
              items_summary: updatedSummary,
              total_amount: finalTotal,
            }).eq('id', order.id);
          }
          if (order.order_number) {
            await supabase.from('orders').update({
              items_summary: updatedSummary,
              total_amount: finalTotal,
            }).eq('order_number', order.order_number);
          }
        } catch (dbErr) {
          console.warn('Supabase update order error:', dbErr);
        }
      }

      // 3. Update LocalStorage backup
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) {
          const locals = JSON.parse(stored);
          const updated = locals.map((o: any) => {
            if ((order.id && o.id === order.id) || (order.order_number && o.order_number === order.order_number)) {
              return {
                ...o,
                items_summary: updatedSummary,
                total_amount: finalTotal,
              };
            }
            return o;
          });
          localStorage.setItem('restaurant_local_orders', JSON.stringify(updated));
        }
      } catch (lsErr) {
        console.warn('LocalStorage update order error:', lsErr);
      }

      // 4. Build updated order
      const updatedOrder = {
        ...order,
        items_summary: updatedSummary,
        total_amount: finalTotal,
      };

      // 5. Notify parent
      onOrderUpdated(updatedOrder, shouldPrint);
      onClose();
    } catch (err: any) {
      console.error('Failed to correct order:', err);
      setErrorMsg(err.message || 'অর্ডার আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsSaving(false);
      setSaveAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <Edit3 size={20} className="text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white">অর্ডারের খাবার কারেকশন</h3>
                <span className="bg-amber-800/80 text-amber-200 text-xs font-black px-2 py-0.5 rounded-md border border-amber-500/40">
                  {order.order_number}
                </span>
              </div>
              <p className="text-xs text-amber-100/90 font-medium mt-0.5">
                কাস্টমার: <span className="font-bold text-white">{order.customer_name}</span> • স্থান: <span className="font-bold text-white">{order.location}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="বন্ধ করুন"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-stone-50/50">
          {/* Instructions Notice */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-950">
            <AlertCircle size={17} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">খাবার কম-বেশি ও কারেকশন নির্দেশিকা:</span> যেকোনো আইটেমের পরিমাণ কমাতে বা বাড়াতে <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-amber-200">+</span> বা <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-amber-200">-</span> বাটনে চাপুন। কোনো আইটেম বাদ দিতে ডানপাশের <span className="font-bold text-red-600">লাল ডিলিট আইকনে</span> ক্লিক করুন।
            </div>
          </div>

          {/* Undo notification if an item was just deleted */}
          {lastDeletedItem && (
            <div className="p-3 bg-stone-900 text-white rounded-2xl flex items-center justify-between shadow-md animate-in slide-in-from-top-2 duration-200">
              <span className="text-xs font-medium">
                <span className="font-bold text-amber-300">{lastDeletedItem.item.name}</span> তালিকা থেকে সরানো হয়েছে।
              </span>
              <button
                type="button"
                onClick={handleUndoDelete}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                আগের অবস্থায় আনুন (Undo)
              </button>
            </div>
          )}

          {/* ORDERED FOOD ITEMS LIST (Editable Table/Cards) */}
          <div className="border border-stone-200 bg-white rounded-2xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-stone-100/90 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Utensils size={15} className="text-amber-700" />
                <span className="text-xs font-black uppercase text-stone-700 tracking-wider">
                  বর্তমান খাবার তালিকা ({items.length} টি পদ)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSection(prev => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus size={13} className="text-amber-800" />
                <span>{showAddSection ? 'যোগ মেনু লুকান' : '+ আরও খাবার যোগ'}</span>
              </button>
            </div>

            {/* Quick Add Section Form / Search */}
            {showAddSection && (
              <div className="p-4 bg-amber-50/50 border-b border-amber-200 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    মেনু থেকে সার্চ করে দ্রুত খাবার যোগ করুন:
                  </label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="খাবারের নাম লিখুন (যেমন: বিরিয়ানি, চাপ, পিজ্জা, কফি)..."
                      value={quickSearch}
                      onChange={e => setQuickSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>

                  {/* Search Results Dropdown */}
                  {filteredMenuItems.length > 0 && (
                    <div className="mt-2 bg-white border border-stone-200 rounded-xl shadow-lg divide-y divide-stone-100 max-h-56 overflow-y-auto">
                      {filteredMenuItems.map(menuItem => {
                        const parsed = parseDescriptionData(menuItem.description);
                        const hasVariants = parsed.variants && parsed.variants.length > 0;

                        return (
                          <div key={menuItem.id} className="p-2.5 hover:bg-stone-50 transition-colors flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-stone-900">{menuItem.name}</p>
                              <p className="text-[11px] text-stone-500">মূল্য: ৳{menuItem.price}</p>
                            </div>
                            
                            {hasVariants ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {parsed.variants.map((v: any) => (
                                  <button
                                    key={v.name}
                                    type="button"
                                    onClick={() => handleSelectMenuItem(menuItem, v)}
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    + {v.name} (৳{v.price})
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSelectMenuItem(menuItem)}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                + যোগ করুন
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Or Custom Food Item */}
                <form onSubmit={handleAddCustom} className="pt-3 border-t border-amber-200/80">
                  <span className="block text-xs font-bold text-stone-700 mb-2">
                    অথবা কাস্টম আইটেম লিখে যোগ করুন:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="আইটেমের নাম (যেমন: এক্সট্রা চা)"
                      value={customItemName}
                      onChange={e => setCustomItemName(e.target.value)}
                      className="sm:col-span-5 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                      required
                    />
                    <input
                      type="number"
                      placeholder="দাম (৳)"
                      value={customItemPrice}
                      onChange={e => setCustomItemPrice(e.target.value)}
                      className="sm:col-span-2 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                      min="0"
                      required
                    />
                    <input
                      type="number"
                      placeholder="পরিমাণ"
                      value={customItemQty}
                      onChange={e => setCustomItemQty(parseInt(e.target.value, 10) || 1)}
                      className="sm:col-span-2 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                      min="1"
                    />
                    <button
                      type="submit"
                      className="sm:col-span-3 px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      + আইটেম যোগ
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Items Rows */}
            {items.length === 0 ? (
              <div className="p-8 text-center text-stone-400">
                <ShoppingBag size={32} className="mx-auto mb-2 text-stone-300" />
                <p className="text-sm font-bold">অর্ডারে কোনো খাবার নেই!</p>
                <p className="text-xs text-stone-400 mt-1">উপরের বাটন দিয়ে নতুন খাবার যোগ করুন।</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-200/80">
                {items.map((item, index) => {
                  const itemTotal = item.qty * (item.unitPrice || 0);

                  return (
                    <div 
                      key={item.id} 
                      className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/70 transition-colors"
                    >
                      {/* Left: Item Name & Note */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-700 text-[11px] font-black flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-sm font-black text-stone-900">
                            {item.name}
                          </span>
                          {item.note && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[10px] font-bold border border-amber-200">
                              {item.note}
                            </span>
                          )}
                        </div>

                        {/* Optional Inline Note editing */}
                        <div className="mt-1 flex items-center gap-2 pl-7">
                          <input
                            type="text"
                            placeholder="স্পেশাল নোট (যেমন: ঝাল ছাড়া, ১:২)..."
                            value={item.note || ''}
                            onChange={e => handleNoteChange(item.id, e.target.value)}
                            className="text-[11px] text-stone-600 bg-transparent hover:bg-stone-100 focus:bg-white border-b border-dashed border-stone-300 focus:border-amber-500 outline-none px-1 py-0.5 w-48 sm:w-60 transition-colors"
                            title="খাবারের বিশেষ নির্দেশনা পরিবর্তন করুন"
                          />
                        </div>
                      </div>

                      {/* Right: Quantity Controls, Price, Delete */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                        {/* Quantity Increase / Decrease */}
                        <div className="flex items-center bg-stone-100 border border-stone-300 rounded-xl p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, -1)}
                            disabled={item.qty <= 1}
                            className="w-7 h-7 rounded-lg bg-white hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed text-stone-800 flex items-center justify-center font-black transition-colors shadow-xs cursor-pointer"
                            title="পরিমাণ ১ কমান"
                          >
                            <Minus size={13} className="stroke-[3]" />
                          </button>

                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={e => handleSetExactQty(item.id, e.target.value)}
                            className="w-9 text-center bg-transparent font-black text-xs text-stone-900 outline-none"
                            title="সরাসরি সংখ্যা লিখুন"
                          />

                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, 1)}
                            className="w-7 h-7 rounded-lg bg-white hover:bg-stone-200 text-stone-800 flex items-center justify-center font-black transition-colors shadow-xs cursor-pointer"
                            title="পরিমাণ ১ বাড়ান"
                          >
                            <Plus size={13} className="stroke-[3]" />
                          </button>
                        </div>

                        {/* Price Display & Custom Unit Price Input */}
                        <div className="text-right min-w-[85px]">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-stone-400 font-medium">৳</span>
                            <input
                              type="number"
                              min="0"
                              value={item.unitPrice || 0}
                              onChange={e => handlePriceChange(item.id, e.target.value)}
                              className="w-16 text-right font-bold text-xs bg-stone-50 hover:bg-white focus:bg-white border border-stone-200 focus:border-amber-400 rounded px-1 py-0.5 outline-none"
                              title="একক মূল্য পরিবর্তন করতে পারেন"
                            />
                          </div>
                          <span className="text-[11px] font-black text-amber-900 block mt-0.5">
                            মোট: ৳{itemTotal}
                          </span>
                        </div>

                        {/* Red Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0"
                          title="এই খাবারটি অর্ডার থেকে মুছে ফেলুন"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BILL SUMMARY & DIFFERENCE BOX */}
          <div className="p-4 bg-gradient-to-br from-stone-50 to-amber-50/60 border border-amber-200/90 rounded-2xl shadow-xs">
            <h4 className="text-xs font-black uppercase text-amber-950 tracking-wider mb-3 flex items-center gap-1.5">
              <span>বিল পুনঃগণনা সামারি (Bill Recalculation)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-stone-200">
                <span className="text-stone-500 block">পূর্বের মোট বিল:</span>
                <span className="text-base font-black text-stone-800">৳{previousTotal}</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-stone-200">
                <span className="text-stone-500 block">কারেকশনের পর নতুন হিসাব:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-lg font-black text-amber-700">
                    ৳{calculatedItemsTotal}
                  </span>
                  {isManualTotal && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                      ম্যানুয়াল
                    </span>
                  )}
                </div>
              </div>

              <div className={`p-3 rounded-xl border ${
                totalDifference > 0 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                  : totalDifference < 0 
                  ? 'bg-amber-50 border-amber-300 text-amber-950' 
                  : 'bg-stone-50 border-stone-200 text-stone-700'
              }`}>
                <span className="block opacity-80">পার্থক্য (Adjustment):</span>
                <span className="text-base font-black">
                  {totalDifference > 0 ? `+৳${totalDifference}` : totalDifference < 0 ? `-৳${Math.abs(totalDifference)}` : 'কোনো পরিবর্তন নেই'}
                </span>
              </div>
            </div>

            {/* Optional Manual Total Adjust */}
            <div className="mt-3 pt-3 border-t border-amber-200/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <label className="font-bold text-stone-700">চূড়ান্ত মোট বিল ম্যানুয়ালি লিখতে চান?</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualTotal(!isManualTotal);
                    if (!isManualTotal) {
                      setTotalOverride(String(calculatedItemsTotal));
                    }
                  }}
                  className="text-xs text-amber-800 underline font-bold cursor-pointer"
                >
                  {isManualTotal ? 'অটো-হিসাবে ফিরুন' : 'ম্যানুয়ালি লিখুন'}
                </button>
              </div>

              {isManualTotal && (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-stone-700">৳</span>
                  <input
                    type="number"
                    value={totalOverride}
                    onChange={e => setTotalOverride(e.target.value)}
                    className="w-24 px-2 py-1 bg-white border border-amber-400 rounded-lg text-sm font-black text-stone-900 outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-white border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-500">
            আইটেম সংখ্যা: <span className="font-bold text-stone-900">{items.length} টি</span> | সর্বমোট পরিমাণ: <span className="font-bold text-stone-900">{items.reduce((s, it) => s + it.qty, 0)} টি</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              বাতিল
            </button>

            {/* Save Only */}
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving || items.length === 0}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              {isSaving && saveAction === 'save' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              <span>সংরক্ষণ করুন</span>
            </button>

            {/* Save and Print */}
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSaving || items.length === 0}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              title="পরিবর্তন সেভ করে নতুন সংশোধিত রসিদ প্রিন্ট করুন"
            >
              {isSaving && saveAction === 'print' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Printer size={15} />
              )}
              <span>সেভ ও নতুন বিল প্রিন্ট</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
