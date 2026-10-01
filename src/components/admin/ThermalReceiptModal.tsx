import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Printer, X, Smartphone, Bluetooth, Check, Copy, FileText, 
  HelpCircle, Utensils, Download, RefreshCw, ChevronDown, Sparkles, Share2, Image,
  Tag, Save, CheckCircle2, RotateCcw
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { supabase } from '../../lib/supabase';
import { 
  PrinterSettings, 
  getPrinterSettings, 
  savePrinterSettings, 
  parseOrderItems, 
  extractDiscountFromSummary,
  generatePlainTextReceipt, 
  generateEscPosBytes, 
  printViaRawBT, 
  BluetoothPrinterService,
  toBanglishOrEnglish
} from '../../utils/thermalPrinter';
import { PrinterHelp } from './PrinterHelp';

interface ThermalReceiptModalProps {
  order: any;
  onClose: () => void;
  defaultType?: 'bill' | 'kot';
  onOrderUpdated?: (updatedOrder: any) => void;
}

export default function ThermalReceiptModal({ 
  order, 
  onClose,
  defaultType = 'bill',
  onOrderUpdated
}: ThermalReceiptModalProps) {
  const [printType, setPrintType] = useState<'bill' | 'kot'>(defaultType);
  const [printLang, setPrintLang] = useState<'bn' | 'en'>('bn');
  const [settings, setSettings] = useState<PrinterSettings>(getPrinterSettings());
  const [copied, setCopied] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [bluetoothDeviceName, setBluetoothDeviceName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [printing, setPrinting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageSrc, setGeneratedImageSrc] = useState<string | null>(null);
  const [imageSuccessMsg, setImageSuccessMsg] = useState<string | null>(null);

  // 1. Parse items (guaranteed to contain only real food items, no discount tags)
  const items = useMemo(() => parseOrderItems(order.items_summary), [order.items_summary]);

  // 2. Parse any existing discount info from items_summary
  const parsedDiscountInfo = useMemo(() => {
    return extractDiscountFromSummary(order.items_summary || '');
  }, [order.items_summary]);

  // 3. Items Subtotal Calculation (Strictly food sum)
  const itemsSubtotal = useMemo(() => {
    const sum = items.reduce((acc, it) => acc + ((it.price || 0) * (it.qty || 1)), 0);
    if (sum > 0) return sum;
    // Fallback if no items could be parsed
    const savedTotal = Number(order.total_amount || 0);
    const existingDisc = Number(order.discount_amount || order.discount || parsedDiscountInfo.discount || 0);
    return savedTotal + existingDisc;
  }, [items, order.total_amount, order.discount_amount, order.discount, parsedDiscountInfo.discount]);

  // 4. Initial discount extraction from order
  const initialDiscount = useMemo(() => {
    if (order.discount_amount !== undefined && order.discount_amount !== null && Number(order.discount_amount) > 0) {
      return String(order.discount_amount);
    }
    if (order.discount !== undefined && order.discount !== null && Number(order.discount) > 0) {
      return String(order.discount);
    }
    if (parsedDiscountInfo.discount > 0) {
      return String(parsedDiscountInfo.discount);
    }
    return '';
  }, [order.discount_amount, order.discount, parsedDiscountInfo.discount]);

  const [discountAmount, setDiscountAmount] = useState<string>(initialDiscount);
  const [discountNote, setDiscountNote] = useState<string>(parsedDiscountInfo.discountNote || '');
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);
  const [discountSavedToast, setDiscountSavedToast] = useState(false);

  // Discount strictly SUBTRACTS from itemsSubtotal
  const discountVal = Math.max(0, parseFloat(discountAmount) || 0);
  const currentNetTotal = Math.max(0, itemsSubtotal - discountVal);

  // Active updated order representation
  const activeOrder = useMemo(() => {
    const cleanBase = parsedDiscountInfo.cleanSummary;

    let finalSummary = cleanBase;
    if (discountVal > 0) {
      const dNote = discountNote.trim() ? ` (${discountNote.trim()})` : '';
      const tag = `[ছাড়/Discount: -৳${discountVal}${dNote}]`;
      finalSummary = cleanBase ? `${cleanBase}, ${tag}` : tag;
    }

    return {
      ...order,
      total_amount: currentNetTotal,
      items_summary: finalSummary,
      discount_amount: discountVal,
      discount_note: discountNote.trim() || undefined,
    };
  }, [order, currentNetTotal, discountVal, discountNote, parsedDiscountInfo.cleanSummary]);

  // Save discount to Supabase and LocalStorage
  const saveOrderDiscount = async (notifyToast = true) => {
    setIsSavingDiscount(true);
    try {
      const updated = activeOrder;

      // 1. Supabase update
      if (supabase) {
        try {
          if (order.id) {
            await supabase.from('orders').update({
              total_amount: updated.total_amount,
              items_summary: updated.items_summary,
            }).eq('id', order.id);
          } else if (order.order_number) {
            await supabase.from('orders').update({
              total_amount: updated.total_amount,
              items_summary: updated.items_summary,
            }).eq('order_number', order.order_number);
          }
        } catch (dbErr) {
          console.warn('Supabase discount update warning:', dbErr);
        }
      }

      // 2. Local storage update
      try {
        const stored = localStorage.getItem('restaurant_local_orders');
        if (stored) {
          const list = JSON.parse(stored);
          const nextList = list.map((o: any) => {
            if ((order.id && o.id === order.id) || (order.order_number && o.order_number === order.order_number)) {
              return {
                ...o,
                total_amount: updated.total_amount,
                items_summary: updated.items_summary,
              };
            }
            return o;
          });
          localStorage.setItem('restaurant_local_orders', JSON.stringify(nextList));
        }
      } catch (locErr) {
        console.warn('LocalStorage discount update warning:', locErr);
      }

      // 3. Inform parent component
      onOrderUpdated?.(updated);

      if (notifyToast) {
        setDiscountSavedToast(true);
        setTimeout(() => setDiscountSavedToast(false), 2500);
      }
      return updated;
    } catch (err) {
      console.error('Error saving discount:', err);
    } finally {
      setIsSavingDiscount(false);
    }
  };

  const btService = BluetoothPrinterService.getInstance();
  const isWebBluetoothSupported = btService.isSupported();

  useEffect(() => {
    if (btService.isConnected()) {
      setBluetoothStatus('connected');
      setBluetoothDeviceName(btService.getDeviceName());
    }
  }, []);

  const orderDate = new Date(order.created_at || Date.now());
  const dateStr = orderDate.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = orderDate.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });

  const t = (text: string) => {
    return printLang === 'en' ? toBanglishOrEnglish(text) : text;
  };

  const previewDateStr = printLang === 'en'
    ? orderDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : dateStr;

  const previewTimeStr = printLang === 'en'
    ? orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : timeStr;

  // Handle Paper Width Toggle (58mm vs 80mm)
  const handlePaperToggle = (width: '58mm' | '80mm') => {
    const updated = savePrinterSettings({ paperWidth: width });
    setSettings(updated);
  };

  // Browser Native Print
  const handleBrowserPrint = async () => {
    await saveOrderDiscount(false);
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 150);
  };

  // RawBT Mobile Print (Most widely used Android Bluetooth printer software)
  const handleRawBTPrint = async () => {
    await saveOrderDiscount(false);
    try {
      printViaRawBT(activeOrder, settings, printType, printLang);
    } catch (e: any) {
      setErrorMessage('RawBT অ্যাপ ওপেন করা যায়নি: ' + (e.message || ''));
    }
  };

  // Web Bluetooth Direct Print
  const handleBluetoothConnectAndPrint = async () => {
    await saveOrderDiscount(false);
    setErrorMessage(null);
    try {
      if (!btService.isConnected()) {
        setBluetoothStatus('connecting');
        const connected = await btService.connect();
        if (connected) {
          setBluetoothStatus('connected');
          setBluetoothDeviceName(btService.getDeviceName());
        }
      }

      if (btService.isConnected()) {
        const bytes = generateEscPosBytes(activeOrder, settings, printType, printLang);
        await btService.print(bytes);
      }
    } catch (err: any) {
      setBluetoothStatus('disconnected');
      setErrorMessage(err.message || 'ব্লুটুথ কানেকশন সম্পন্ন হয়নি। দয়া করে প্রিন্টারের সুইচ অন আছে কিনা দেখে নিন।');
    }
  };

  // Copy Plain Text Receipt
  const handleCopyText = async () => {
    await saveOrderDiscount(false);
    const text = generatePlainTextReceipt(activeOrder, settings, printType, printLang);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Share Plain Text to Bluetooth Printer App
  const handleShareText = async () => {
    await saveOrderDiscount(false);
    const text = generatePlainTextReceipt(activeOrder, settings, printType, printLang);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt-${order.order_number}`,
          text: text
        });
      } catch (err) {
        console.warn("Share failed:", err);
      }
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      alert("শেয়ার অপশনটি এই ব্রাউজারে সাপোর্ট করছে না। রসিদটি কপি করা হয়েছে, আপনি প্রিন্টার অ্যাপে পেস্ট করে প্রিন্ট করতে পারবেন।");
    }
  };

  // Generate high-resolution receipt image for printing non-UTF8 Bengali printers
  const handleGenerateAndShareImage = async () => {
    if (!receiptRef.current) return;
    await saveOrderDiscount(false);
    
    setGeneratingImage(true);
    setErrorMessage(null);
    setImageSuccessMsg(null);
    
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imageSrc = canvas.toDataURL('image/png');
      setGeneratedImageSrc(imageSrc);
      
      if (navigator.share && navigator.canShare) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const file = new File([blob], `receipt-${order.order_number || 'order'}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Receipt #${order.order_number}`,
              text: `Elish-er Bari Smart Restaurant Receipt`
            });
            setImageSuccessMsg('রসিদ ইমেজ সফলভাবে শেয়ার করা হয়েছে! যেকোনো প্রিন্টার অ্যাপ সিলেক্ট করে প্রিন্ট করতে পারবেন।');
            setGeneratingImage(false);
            return;
          }
        }
      }
      
      const link = document.createElement('a');
      link.href = imageSrc;
      link.download = `receipt-${order.order_number || 'order'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setImageSuccessMsg('রসিদ ইমেজ ডাউনলোড হয়েছে! এটি আপনার থার্মাল প্রিন্টার অ্যাপে ওপেন করে প্রিন্ট করুন।');
    } catch (err: any) {
      console.error('Error rendering receipt to image:', err);
      setErrorMessage('রসিদ ইমেজ তৈরি করতে সমস্যা হয়েছে: ' + (err.message || ''));
    } finally {
      setGeneratingImage(false);
    }
  };

  const is58mm = settings.paperWidth === '58mm';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Printable Element - Only visible during window.print() */}
      <div id="thermal-receipt-printable" className="hidden">
        <div className={`p-2 font-mono text-black text-xs leading-tight ${is58mm ? 'max-w-[58mm]' : 'max-w-[80mm]'}`}>
          <div className="text-center font-bold text-sm mb-1">{settings.restaurantName}</div>
          {settings.branchName && <div className="text-center text-[10px] mb-0.5">{settings.branchName}</div>}
          <div className="text-center text-[10px] mb-1">{settings.address}</div>
          <div className="text-center text-[10px] mb-1">ফোন: {settings.phone}</div>
          <div className="border-b border-dashed border-black my-1.5"></div>
          
          <div className="text-center font-extrabold text-xs uppercase mb-1">
            {printType === 'kot' ? '** কিচেন টোকেন (KOT) **' : 'ক্যাশ মেমো / ইনভয়েস'}
          </div>
          <div className="border-b border-dashed border-black my-1.5"></div>

          <div className="flex justify-between text-[11px]">
            <span>অর্ডার: <b>{order.order_number}</b></span>
            <span>{timeStr}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>তারিখ: {dateStr}</span>
            <span>{order.order_type}</span>
          </div>
          <div className="text-[11px] font-bold mt-0.5">
            স্থান/টেবিল: {order.location || 'N/A'}
          </div>
          <div className="text-[10px] text-gray-800">
            কাস্টমার: {order.customer_name} {order.customer_phone && order.customer_phone !== 'প্রযোজ্য নয়' ? `(${order.customer_phone})` : ''}
          </div>

          <div className="border-b border-dashed border-black my-1.5"></div>

          {/* Items Table */}
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">খাবার</th>
                <th className="py-1 text-right">পরিমাণ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-1 pr-1 font-medium">
                    {idx + 1}. {item.name}
                    {item.note && <div className="text-[9px] italic text-gray-700">* {item.note}</div>}
                  </td>
                  <td className="py-1 text-right font-bold whitespace-nowrap">
                    {item.qty}x
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-b border-dashed border-black my-1.5"></div>

          {printType === 'bill' && (
            <div className="space-y-1 py-1">
              {discountVal > 0 && (
                <>
                  <div className="flex justify-between text-[11px]">
                    <span>খাবারের মোট মূল্য:</span>
                    <span>৳{itemsSubtotal}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold">
                    <span>বিশেষ ছাড় / ডিসকাউন্ট:</span>
                    <span>-৳{discountVal}</span>
                  </div>
                  <div className="border-b border-dashed border-black my-1"></div>
                </>
              )}
              <div className="flex justify-between text-xs font-black">
                <span>সর্বমোট পরিশোধযোগ্য:</span>
                <span>৳{currentNetTotal}</span>
              </div>
            </div>
          )}

          <div className="border-b border-dashed border-black my-2"></div>
          <div className="text-center text-[10px] italic leading-snug">
            {printType === 'kot' ? '-- রান্নাঘরের জন্য প্রস্তুতকৃত --' : settings.footerGreeting}
          </div>
          <div className="text-center text-[9px] text-gray-600 mt-1">
            ইলিশের বাড়ি স্মার্ট রেস্টুরেন্ট পিওএস
          </div>
        </div>
      </div>

      {/* Interactive Modal Card */}
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-900 text-white rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-stone-950">
              <Printer size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                <span>থার্মাল বিল ও কিচেন প্রিন্টার</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                  {order.order_number}
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                মোবাইল ব্লুটুথ প্রিন্টার (RPPO2N, POS-58, RawBT) বা যেকোনো ওয়াইফাই/ইউএসবি প্রিন্টারে বিল প্রিন্ট করুন
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Subheader Controls */}
        <div className="bg-stone-50 px-4 py-3 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Bill vs KOT Selector */}
          <div className="flex bg-stone-200/80 p-0.5 rounded-xl border border-stone-300 font-bold">
            <button
              type="button"
              onClick={() => setPrintType('bill')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                printType === 'bill' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <FileText size={13} />
              <span>কাস্টমার ক্যাশ মেমো</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintType('kot')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                printType === 'kot' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <Utensils size={13} />
              <span>কিচেন টোকেন (KOT)</span>
            </button>
          </div>

          {/* Paper Size Selector (58mm vs 80mm) */}
          <div className="flex items-center gap-2">
            <span className="text-stone-500 font-semibold hidden sm:inline">কাগজের সাইজ:</span>
            <div className="flex bg-white rounded-xl border border-stone-200 p-0.5 font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => handlePaperToggle('58mm')}
                className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer ${
                  is58mm ? 'bg-amber-500 text-stone-950 font-black' : 'text-stone-600 hover:text-stone-900'
                }`}
                title="সাধারণ ছোট মোবাইল ব্লুটুথ থার্মাল প্রিন্টার"
              >
                58mm (মোবাইল)
              </button>
              <button
                type="button"
                onClick={() => handlePaperToggle('80mm')}
                className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer ${
                  !is58mm ? 'bg-amber-500 text-stone-950 font-black' : 'text-stone-600 hover:text-stone-900'
                }`}
                title="বড় কাউন্টার পিওএস রসিদ প্রিন্টার"
              >
                80mm (কাউন্টার)
              </button>
            </div>

            {/* Print Language Selector (Bangla vs English/Banglish) */}
            <div className="flex bg-white rounded-xl border border-stone-200 p-0.5 font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => setPrintLang('bn')}
                className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer ${
                  printLang === 'bn' ? 'bg-amber-500 text-stone-950 font-black' : 'text-stone-600 hover:text-stone-900'
                }`}
                title="বাংলায় রসিদ প্রিন্ট করুন"
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => setPrintLang('en')}
                className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer ${
                  printLang === 'en' ? 'bg-amber-500 text-stone-950 font-black' : 'text-stone-600 hover:text-stone-900'
                }`}
                title="ইংরেজি/বাংলিশ রসিদ (থার্মাল প্রিন্টারের জন্য সেরা)"
              >
                Eng/Banglish
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="text-stone-600 hover:text-amber-800 bg-stone-100 hover:bg-stone-200 p-1.5 rounded-lg border border-stone-200 flex items-center gap-1 font-semibold cursor-pointer"
              title="মোবাইলে প্রিন্টার কানেক্ট করার উপায়"
            >
              <HelpCircle size={14} className="text-amber-700" />
              <span className="hidden md:inline">কানেকশন গাইড</span>
            </button>
          </div>
        </div>

        {/* Success/Error Notifications */}
        {discountSavedToast && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2 font-bold animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>ডিসকাউন্ট সফলভাবে সেভ ও ডাটাবেজে আপডেট করা হয়েছে! (নতুন বিল: ৳{currentNetTotal})</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-red-700 hover:text-red-900 font-bold ml-2">
              <X size={14} />
            </button>
          </div>
        )}

        {imageSuccessMsg && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <span>{imageSuccessMsg}</span>
            <button type="button" onClick={() => setImageSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Printer Help Panel */}
        {showGuide && (
          <div className="mx-4 mt-3 animate-in fade-in duration-200">
            <PrinterHelp onClose={() => setShowGuide(false)} />
          </div>
        )}

        {/* Content Body: Left is Printer Preview, Right is Action Panel */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 bg-stone-100/50">
          
          {/* Left: Realistic Physical Thermal Paper Preview */}
          <div className="md:col-span-6 flex flex-col items-center justify-start">
            <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>রসিদের লাইভ প্রিভিউ</span>
              <span className="text-[10px] text-stone-400">({settings.paperWidth})</span>
            </div>

            {/* Receipt Paper Element */}
            <div 
              ref={receiptRef}
              id="thermal-receipt-preview-content"
              className={`bg-white shadow-xl border border-stone-200/90 rounded-t-xl p-4 sm:p-5 text-stone-900 font-mono transition-all duration-300 relative select-text ${
                is58mm ? 'w-full max-w-[280px] text-[11px]' : 'w-full max-w-[340px] text-[12px]'
              }`}
              style={{
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
              }}
            >
              {/* Restaurant Header */}
              <div className="text-center font-extrabold text-sm sm:text-base leading-tight">
                {t(settings.restaurantName)}
              </div>
              {settings.branchName && (
                <div className="text-center text-[10px] text-stone-600 mt-0.5">
                  {t(settings.branchName)}
                </div>
              )}
              <div className="text-center text-[10px] text-stone-600 mt-0.5 leading-snug">
                {t(settings.address)}
              </div>
              <div className="text-center text-[10px] text-stone-800 font-bold mt-0.5">
                {printLang === 'en' ? 'Mobile' : 'মোবাইল'}: {settings.phone}
              </div>
              {settings.showVat && settings.vatNumber && (
                <div className="text-center text-[9px] text-stone-600 mt-0.5">
                  {printLang === 'en' ? 'VAT Reg' : 'ভ্যাট রেজি'}: {settings.vatNumber}
                </div>
              )}

              {/* Dashed Divider */}
              <div className="border-b border-dashed border-stone-400 my-2.5"></div>

              {/* Title */}
              <div className="text-center font-black uppercase tracking-wider text-[11px] sm:text-xs">
                {printType === 'kot' 
                  ? (printLang === 'en' ? '** KITCHEN TOKEN (KOT) **' : '** কিচেন টোকেন (KOT) **') 
                  : (printLang === 'en' ? 'CASH MEMO / INVOICE' : 'ক্যাশ মেমো / ইনভয়েস')}
              </div>

              <div className="border-b border-dashed border-stone-400 my-2"></div>

              {/* Metadata */}
              <div className="space-y-0.5 text-[10px] sm:text-[11px]">
                <div className="flex justify-between">
                  <span className="font-bold">{printLang === 'en' ? 'Order' : 'অর্ডার'}: {order.order_number}</span>
                  <span className="text-stone-600">{previewTimeStr}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>{printLang === 'en' ? 'Date' : 'তারিখ'}: {previewDateStr}</span>
                  <span className="font-bold text-stone-800">{printLang === 'en' ? 'Type' : 'ধরণ'}: {t(order.order_type)}</span>
                </div>
                <div className="font-bold text-stone-900 bg-stone-100 p-1 rounded mt-1 flex justify-between">
                  <span>{printLang === 'en' ? 'Table / Loc:' : 'স্থান / টেবিল:'}</span>
                  <span className="text-amber-900 font-black">{t(order.location || 'টেবিল ০১')}</span>
                </div>
                <div className="pt-0.5 text-stone-700">
                  {printLang === 'en' ? 'Customer' : 'কাস্টমার'}: <span className="font-bold text-stone-900">{t(order.customer_name)}</span>
                </div>
                {order.customer_phone && order.customer_phone !== 'প্রযোজ্য নয়' && (
                  <div className="text-stone-600">
                    {printLang === 'en' ? 'Phone' : 'ফোন'}: {order.customer_phone}
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-stone-400 my-2.5"></div>

              {/* Items List */}
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between font-bold text-[10px] text-stone-500 uppercase border-b border-stone-200 pb-1">
                  <span>{printLang === 'en' ? 'Item Description' : 'খাবারের নাম ও বিবরণ'}</span>
                  <span className="text-right">{printType === 'bill' ? (printLang === 'en' ? 'Rate / Total' : 'দর ও মোট মূল্য') : (printLang === 'en' ? 'Qty' : 'পরিমাণ')}</span>
                </div>
                {items.map((item, idx) => {
                  const itemPrice = item.price || 0;
                  const itemTotal = item.total || (item.qty * itemPrice);

                  return (
                    <div key={idx} className="py-1 border-b border-stone-100 last:border-0">
                      <div className="flex justify-between items-start gap-1">
                        <div className="pr-1 leading-tight flex-1">
                          <span className="font-bold text-stone-900">{idx + 1}. {t(item.name)}</span>
                          {item.note && (
                            <div className="text-[9px] text-amber-900 bg-amber-50 px-1 py-0.5 rounded mt-0.5 inline-block">
                              * {t(item.note)}
                            </div>
                          )}
                        </div>
                        {printType === 'kot' ? (
                          <span className="font-black text-stone-950 bg-stone-100 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                            {item.qty}x
                          </span>
                        ) : (
                          <div className="text-right shrink-0">
                            <span className="font-black text-stone-900 text-xs">
                              {printLang === 'en' ? 'TK ' : '৳'}{itemTotal}
                            </span>
                          </div>
                        )}
                      </div>
                      {printType === 'bill' && (
                        <div className="flex items-center justify-between text-[10px] text-stone-500 mt-0.5 pl-3">
                          <span>{item.qty} x {printLang === 'en' ? 'TK ' : '৳'}{itemPrice}</span>
                          <span className="text-[9px] text-stone-400">প্রতিটি {printLang === 'en' ? 'TK ' : '৳'}{itemPrice}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border-b border-dashed border-stone-400 my-2.5"></div>

              {/* Total Calculation with Discount */}
              {printType === 'bill' && (
                <div className="space-y-1">
                  {discountVal > 0 && (
                    <>
                      <div className="flex justify-between text-[11px] text-stone-600">
                        <span>{printLang === 'en' ? 'Subtotal:' : 'খাবারের মোট মূল্য:'}</span>
                        <span>{printLang === 'en' ? 'TK ' : '৳'}{itemsSubtotal}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-emerald-800 font-bold">
                        <span>{printLang === 'en' ? 'Discount:' : 'বিশেষ ছাড় / ডিসকাউন্ট:'}</span>
                        <span>-{printLang === 'en' ? 'TK ' : '৳'}{discountVal}</span>
                      </div>
                      <div className="border-b border-dashed border-stone-300 my-1"></div>
                    </>
                  )}
                  <div className="flex justify-between font-black text-xs sm:text-sm text-stone-950 pt-0.5">
                    <span>{printLang === 'en' ? 'TOTAL BILL:' : 'সর্বমোট বিল (TOTAL):'}</span>
                    <span className="text-amber-800 font-black">{printLang === 'en' ? 'TK ' : '৳'}{currentNetTotal}</span>
                  </div>
                </div>
              )}

              <div className="border-b border-dashed border-stone-400 my-3"></div>

              {/* Footer Note */}
              <div className="text-center text-[10px] text-stone-600 leading-snug">
                {printType === 'kot' ? (
                  <span className="font-bold text-stone-800">
                    {printLang === 'en' ? '-- Kitchen Copy --' : '-- কিচেন স্টাফদের জন্য প্রস্তুতকৃত টোকেন --'}
                  </span>
                ) : (
                  <span>{t(settings.footerGreeting)}</span>
                )}
              </div>

              <div className="text-center text-[9px] text-stone-400 mt-2">
                {printLang === 'en' ? 'Software: Elish-er Bari Smart POS' : 'সফটওয়্যার: ইলিশের বাড়ি স্মার্ট পিওএস'}
              </div>

              {/* Jagged thermal paper edge bottom styling */}
              <div 
                className="absolute -bottom-2 left-0 right-0 h-2 bg-repeat-x"
                style={{
                  backgroundImage: `radial-gradient(circle, transparent, transparent 50%, #ffffff 50%, #ffffff 100%)`,
                  backgroundSize: '8px 8px',
                }}
              ></div>
            </div>
          </div>

          {/* Right: Discount Correction & Print Actions Panel */}
          <div className="md:col-span-6 flex flex-col justify-between space-y-4">
            
            <div className="space-y-3.5">
              
              {/* 1. DISCOUNT ADJUSTMENT CARD (প্রিন্ট করার সময় ডিসকাউন্ট যোগ বা কারেকশন) */}
              <div className="p-4 rounded-2xl bg-white border-2 border-emerald-400/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950 uppercase tracking-wide">
                    <Tag size={15} className="text-emerald-600" />
                    <span>ডিসকাউন্ট বা ছাড় কারেকশন (Discount)</span>
                  </div>
                  {discountVal > 0 && (
                    <span className="bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                      -৳{discountVal} ছাড়
                    </span>
                  )}
                </div>

                {/* Subtotal vs Net Payable Preview */}
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-stone-500 font-semibold block text-[11px]">খাবারের মূল্য:</span>
                    <strong className="text-stone-900 font-extrabold text-sm">৳{itemsSubtotal}</strong>
                  </div>
                  <div className="text-center px-2">
                    <span className="text-emerald-700 font-bold block text-[11px]">ছাড়:</span>
                    <strong className="text-emerald-700 font-extrabold text-sm">-৳{discountVal}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-stone-600 font-semibold block text-[11px]">পরিশোধযোগ্য বিল:</span>
                    <strong className="text-stone-950 font-black text-base text-amber-700">৳{currentNetTotal}</strong>
                  </div>
                </div>

                {/* Discount Inputs & Quick Buttons */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2 items-center">
                    <div className="relative flex-1 w-full">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-black text-xs">৳</span>
                      <input
                        type="number"
                        min="0"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        placeholder="ছাড়ের টাকা লিখুন (যেমন: ২০, ৫০, ১০০)..."
                        className="w-full pl-7 pr-3 py-1.5 bg-gray-50 border border-emerald-300 rounded-xl text-xs sm:text-sm font-black text-emerald-950 outline-none focus:bg-white focus:ring-1 focus:ring-emerald-600"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                      {[10, 20, 50, 100].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDiscountAmount(String(amt))}
                          className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            discountAmount === String(amt)
                              ? 'bg-emerald-700 text-white shadow-2xs'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200'
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
                          ক্লিয়ার
                        </button>
                      )}
                    </div>
                  </div>

                  {discountVal > 0 && (
                    <input
                      type="text"
                      value={discountNote}
                      onChange={(e) => setDiscountNote(e.target.value)}
                      placeholder="ছাড়ের কারণ (যেমন: স্পেশাল ডিসকাউন্ট, ক্যাশ রাউন্ড)..."
                      className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs outline-none text-gray-700 focus:border-emerald-600"
                    />
                  )}

                  {/* Save Discount Button */}
                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      disabled={isSavingDiscount}
                      onClick={() => saveOrderDiscount(true)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      {isSavingDiscount ? (
                        <span>সেভ হচ্ছে...</span>
                      ) : (
                        <>
                          <Save size={13} />
                          <span>ডাটাবেজে ডিসকাউন্ট সেভ করুন</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. PRINTING OPTIONS (শুধুমাত্র রশিদ প্রিন্ট ও রসিদ কপি) */}
              <div className="space-y-3 pt-1">
                {/* Option 1: রশিদ প্রিন্ট */}
                <div className="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-center justify-between gap-3 shadow-2xs">
                  <div>
                    <h6 className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                      <Printer size={16} className="text-amber-600" />
                      <span>রশিদ প্রিন্ট (Print Receipt)</span>
                    </h6>
                    <p className="text-[11px] text-stone-500">কম্পিউটার বা মোবাইলের সাথে কানেক্টেড যেকোনো প্রিন্টারে সরাসরি প্রিন্ট করুন।</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBrowserPrint}
                    disabled={printing}
                    className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shrink-0 shadow-2xs transition-all active:scale-95"
                  >
                    <Printer size={15} />
                    <span>{printing ? 'প্রিন্ট হচ্ছে...' : 'রশিদ প্রিন্ট'}</span>
                  </button>
                </div>

                {/* Option 2: রশিদ শেয়ার */}
                <div className="p-3.5 rounded-2xl bg-white border border-stone-200 flex items-center justify-between gap-3 shadow-2xs">
                  <div>
                    <h6 className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                      <Share2 size={16} className="text-emerald-600" />
                      <span>রশিদ শেয়ার (Share Receipt)</span>
                    </h6>
                    <p className="text-[11px] text-stone-500">হোয়াটসঅ্যাপ, মেসেঞ্জার বা অন্য যেকোনো অ্যাপে সরাসরি রসিদ শেয়ার করুন।</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleShareText}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shrink-0 shadow-2xs transition-all active:scale-95"
                  >
                    <Share2 size={15} />
                    <span>রশিদ শেয়ার</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
              <span className="text-xs text-stone-500">
                অর্ডার: <b className="text-stone-800">{order.order_number}</b> | মোট: <b className="text-emerald-700 font-extrabold">৳{currentNetTotal}</b>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs transition-colors cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
