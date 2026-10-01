import React, { useState, useEffect } from 'react';
import { 
  Plus, Download, Trash2, Link as LinkIcon, Eye, X, Copy, Check, QrCode, 
  Globe, ExternalLink, AlertCircle, RefreshCw, Smartphone, UtensilsCrossed, Info 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Default tables
const DEFAULT_TABLES = [
  { id: 1, name: "Table 01", capacity: 4, status: "Active" },
  { id: 2, name: "Table 02", capacity: 2, status: "Active" },
  { id: 3, name: "Table 03", capacity: 6, status: "Active" },
  { id: 4, name: "Table 04", capacity: 4, status: "Active" },
  { id: 5, name: "Table 05", capacity: 2, status: "Active" },
];

// Default public shared URL for this app
const DEFAULT_PUBLIC_URL = "https://ais-pre-ai7jnxz6vgz53y6eikvvvo-708310852636.asia-east1.run.app";

export default function AdminQRPage() {
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(DEFAULT_PUBLIC_URL);
  const [tables, setTables] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<any | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [domainSaved, setDomainSaved] = useState(false);
  const [previewTable, setPreviewTable] = useState<any | null>(null);

  // Initialize domain & tables
  useEffect(() => {
    // 1. Tables
    const savedTables = localStorage.getItem('restaurant_tables');
    if (savedTables) {
      try {
        setTables(JSON.parse(savedTables));
      } catch (e) {
        setTables(DEFAULT_TABLES);
      }
    } else {
      setTables(DEFAULT_TABLES);
      localStorage.setItem('restaurant_tables', JSON.stringify(DEFAULT_TABLES));
    }

    // 2. Base URL for QR codes - Automatically set to public URL by default
    const savedDomain = localStorage.getItem('qr_base_domain');
    if (savedDomain && savedDomain.trim() !== '' && !savedDomain.includes('localhost') && !savedDomain.includes('ais-dev-')) {
      setCustomBaseUrl(savedDomain.trim().replace(/\/+$/, ''));
    } else {
      setCustomBaseUrl(DEFAULT_PUBLIC_URL);
      localStorage.setItem('qr_base_domain', DEFAULT_PUBLIC_URL);
    }
  }, []);

  const activeBaseUrl = (customBaseUrl.trim() || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
  const isLocalhostActive = activeBaseUrl.includes('localhost') || activeBaseUrl.includes('127.0.0.1');
  const isAisDevActive = activeBaseUrl.includes('ais-dev-');

  const saveTables = (newTables: any[]) => {
    setTables(newTables);
    localStorage.setItem('restaurant_tables', JSON.stringify(newTables));
  };

  const handleSaveDomain = (urlToSave: string) => {
    const cleaned = urlToSave.trim().replace(/\/+$/, '');
    setCustomBaseUrl(cleaned);
    localStorage.setItem('qr_base_domain', cleaned);
    setDomainSaved(true);
    setTimeout(() => setDomainSaved(false), 2500);
  };

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName) return;
    
    const newId = tables.length > 0 ? Math.max(...tables.map(t => t.id)) + 1 : 1;
    const newTable = {
      id: newId,
      name: newTableName,
      capacity: parseInt(newTableCapacity) || 4,
      status: "Active"
    };
    
    saveTables([...tables, newTable]);
    setNewTableName('');
    setNewTableCapacity('4');
    setIsModalOpen(false);
  };

  const handleDeleteTable = (id: number) => {
    const tbl = tables.find(t => t.id === id);
    setTableToDelete(tbl || { id, name: `Table ${id}` });
  };

  const confirmDeleteTable = () => {
    if (tableToDelete) {
      saveTables(tables.filter(t => t.id !== tableToDelete.id));
      setTableToDelete(null);
    }
  };

  // High quality PNG download with table label
  const downloadQRPNG = (svgId: string, label: string) => {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const qrSize = 500;
      const padding = 50;
      canvas.width = qrSize + padding * 2;
      canvas.height = qrSize + padding * 2 + 130;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // White Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Border card
        ctx.strokeStyle = '#e2d7c5';
        ctx.lineWidth = 4;
        ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

        // Draw QR
        ctx.drawImage(img, padding, padding, qrSize, qrSize);

        // Draw Table Title
        ctx.fillStyle = '#1c1917';
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, canvas.width / 2, qrSize + padding + 55);

        // Subtitle instructions
        ctx.fillStyle = '#c2410c';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('ইলিশের বাড়ি রেস্টুরেন্ট - স্ক্যান করে মেনু দেখুন', canvas.width / 2, qrSize + padding + 98);

        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `QR_${label.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const viewOnlyUrl = `${activeBaseUrl}/?viewOnly=true#menu`;
  const deliveryUrl = `${activeBaseUrl}/delivery#menu`;
  const menuUrl = `${activeBaseUrl}/menu`;

  return (
    <div className="max-w-6xl mx-auto flex flex-col pb-16 font-sans">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">কিউআর কোড ও অনলাইন লিংক</h1>
            <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              সরাসরি মেনু ও ডেলিভারি সংযুক্ত
            </span>
          </div>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            গ্রাহকদের জন্য সাধারণ মেনু লিংক, হোম ডেলিভারি অর্ডার লিংক এবং রেস্টুরেন্টের টেবিল কিউআর কোড পরিচালনা করুন।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/menu"
            target="_blank"
            rel="noreferrer"
            className="bg-stone-100 hover:bg-stone-200 text-stone-800 px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-1.5 text-xs transition-colors border border-stone-300 cursor-pointer"
          >
            <Eye size={15} className="text-amber-700" />
            <span>ব্রাউজারে লাইভ মেনু টেস্ট</span>
          </a>

          <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-xs text-xs sm:text-sm cursor-pointer"
          >
            <Plus size={16} />
            <span>নতুন টেবিল যোগ করুন</span>
          </button>
        </div>
      </div>

      {/* 2. QR DOMAIN CONFIGURATION & INSTRUCTION CARD */}
      <div className="bg-white rounded-2xl shadow-xs border border-amber-200 p-4 sm:p-5 mb-6 bg-gradient-to-br from-white to-amber-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <Globe size={18} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-gray-900">
                কিউআর কোড ডোমেন / ওয়েবসাইট লিংক (QR Base URL)
              </h3>
              <p className="text-[11px] text-gray-500">
                কিউআর কোডে কোন ওয়েবসাইটের লিংক যুক্ত থাকবে তা এখানে দেওয়া আছে।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAisDevActive && (
              <button
                type="button"
                onClick={() => handleSaveDomain(activeBaseUrl.replace('ais-dev-', 'ais-pre-'))}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                title="পাবলিক শেয়ার্ড লিংক সেট করুন"
              >
                <Globe size={11} />
                <span>পাবলিক শেয়ার্ড লিংক সেট করুন</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSaveDomain(window.location.origin)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 border border-stone-300 hover:bg-stone-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="বর্তমান ব্রাউজারের লিংক সেট করুন"
            >
              <RefreshCw size={11} />
              <span>বর্তমান ব্রাউজার লিংক</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full">
            <input 
              type="url"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="https://your-website-domain.com"
              className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 text-stone-900"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSaveDomain(customBaseUrl)}
            className="w-full sm:w-auto px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            {domainSaved ? '✓ সংরক্ষিত হয়েছে!' : 'ডোমেন সেভ করুন'}
          </button>
        </div>

        {/* Status of Public URL */}
        <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-start gap-2">
            <Check size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">পাবলিক মোবাইল লিংক সেট করা আছে:</p>
              <p className="text-[11px] font-mono text-emerald-800 break-all">{DEFAULT_PUBLIC_URL}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(DEFAULT_PUBLIC_URL, 'public-app-url')}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
          >
            {copiedLink === 'public-app-url' ? <Check size={12} /> : <Copy size={12} />}
            <span>{copiedLink === 'public-app-url' ? 'কপি হয়েছে!' : 'পাবলিক লিংক কপি'}</span>
          </button>
        </div>

        {/* Helpful explanation */}
        <div className="mt-3 p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 text-xs text-stone-800 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <Info size={14} className="shrink-0 text-amber-700" />
            <span>অন্যান্য সাধারণ মোবাইল দিয়ে দেখতে করণীয়:</span>
          </div>
          <div className="text-[11px] leading-relaxed text-stone-700 space-y-1">
            <p>
              • সমস্ত কিউআর কোড এবং লিংক ইতিমধ্যে আপনার পাবলিক অ্যাপ ইউআরএল এ কনফিগার করে দেওয়া হয়েছে।
            </p>
            <p>
              • বাইরের যেকোনো মোবাইল থেকে এই লিংক বা কিউআর কোড এক্সেস চালু করতে Google AI Studio স্ক্রিনের <strong>উপরের ডান কোণায় "Share" বোতামে একবার ক্লিক করুন</strong> (যাতে গুগল ক্লাউড পাবলিক এক্সেস অন করে দেয়)। এরপর যেকোনো মোবাইল থেকে তৎক্ষণাৎ মেনু ওপেন হবে!
            </p>
          </div>
        </div>

        {isLocalhostActive && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-800 text-xs">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
            <div>
              <p className="font-bold">সতর্কতা: বর্তমান লিংকটিতে localhost রয়েছে!</p>
              <p className="text-[11px] mt-0.5">
                কম্পিউটারের লোকালহোস্ট মোবাইল ক্যামেরা দিয়ে স্ক্যান করলে মোবাইল থেকে পাওয়া যাবে না। মোবাইল থেকে টেস্ট করতে লাইভ লিংক বা শেয়ার্ড ডোমেন ব্যবহার করুন।
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. General Online Links (Direct Menu, Home Delivery, View-Only) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-6">
        {/* 1. Direct Menu Link Card */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-amber-200/90 flex flex-col justify-between gap-3 bg-gradient-to-b from-white to-amber-50/30">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 shadow-2xs">
                <UtensilsCrossed size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 text-sm truncate">অনলাইন মেনু লিংক</h3>
                <p className="text-[11px] text-gray-500">ফেসবুক পেজ, বায়ো বা কাস্টমারকে শেয়ারের জন্য</p>
              </div>
            </div>
            <div className="p-1 bg-white rounded-lg border border-gray-200 shrink-0 shadow-2xs">
              <QRCodeSVG id="qr-direct-menu" value={menuUrl} size={42} />
            </div>
          </div>

          <div className="bg-stone-50 p-2 rounded-xl border border-stone-200 text-[11px] font-mono text-stone-600 truncate">
            {menuUrl}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-stone-100">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => copyToClipboard(menuUrl, 'menu')}
                className="text-xs text-amber-700 hover:text-amber-800 flex items-center gap-1 font-bold cursor-pointer"
              >
                {copiedLink === 'menu' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copiedLink === 'menu' ? 'কপি হয়েছে!' : 'মেনু লিংক কপি'}</span>
              </button>
              <a 
                href="/menu" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-0.5 font-bold"
              >
                <ExternalLink size={11} />
                <span>টেস্ট ওপেন</span>
              </a>
            </div>

            <button 
              onClick={() => downloadQRPNG("qr-direct-menu", "Online_Menu")}
              className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 bg-amber-100/80 hover:bg-amber-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
            >
              <Download size={11} /> কিউআর
            </button>
          </div>
        </div>

        {/* 2. Delivery Link Card */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-200/90 flex flex-col justify-between gap-3 bg-gradient-to-b from-white to-emerald-50/30">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shrink-0 shadow-2xs">
                <LinkIcon size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 text-sm truncate">হোম ডেলিভারি লিংক</h3>
                <p className="text-[11px] text-gray-500">হোয়াটসঅ্যাপে ডেলিভারি অর্ডার নেওয়ার লিংক</p>
              </div>
            </div>
            <div className="p-1 bg-white rounded-lg border border-gray-200 shrink-0 shadow-2xs">
              <QRCodeSVG id="qr-delivery" value={deliveryUrl} size={42} />
            </div>
          </div>

          <div className="bg-stone-50 p-2 rounded-xl border border-stone-200 text-[11px] font-mono text-stone-600 truncate">
            {deliveryUrl}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-stone-100">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => copyToClipboard(deliveryUrl, 'delivery')}
                className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-bold cursor-pointer"
              >
                {copiedLink === 'delivery' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copiedLink === 'delivery' ? 'কপি হয়েছে!' : 'ডেলিভারি লিংক কপি'}</span>
              </button>
              <a 
                href="/delivery#menu" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-0.5 font-bold"
              >
                <ExternalLink size={11} />
                <span>টেস্ট ওপেন</span>
              </a>
            </div>

            <button 
              onClick={() => downloadQRPNG("qr-delivery", "Delivery_Menu")}
              className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 bg-emerald-100/80 hover:bg-emerald-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
            >
              <Download size={11} /> কিউআর
            </button>
          </div>
        </div>

        {/* 3. View Only QR Card */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-blue-200/90 flex flex-col justify-between gap-3 bg-gradient-to-b from-white to-blue-50/30">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl shrink-0 shadow-2xs">
                <Eye size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 text-sm truncate">ভিউ-অনলি মেনু কিউআর</h3>
                <p className="text-[11px] text-gray-500">গ্রাহক শুধু খাবার ও দাম দেখতে পাবেন, অর্ডার নয়</p>
              </div>
            </div>
            <div className="p-1 bg-white rounded-lg border border-gray-200 shrink-0 shadow-2xs">
              <QRCodeSVG id="qr-view-only" value={viewOnlyUrl} size={42} />
            </div>
          </div>

          <div className="bg-stone-50 p-2 rounded-xl border border-stone-200 text-[11px] font-mono text-stone-600 truncate">
            {viewOnlyUrl}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-stone-100">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => copyToClipboard(viewOnlyUrl, 'viewOnly')}
                className="text-xs text-blue-700 hover:text-blue-800 flex items-center gap-1 font-bold cursor-pointer"
              >
                {copiedLink === 'viewOnly' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copiedLink === 'viewOnly' ? 'কপি হয়েছে!' : 'লিংক কপি'}</span>
              </button>
              <a 
                href="/?viewOnly=true#menu" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-0.5 font-bold"
              >
                <ExternalLink size={11} />
                <span>টেস্ট ওপেন</span>
              </a>
            </div>

            <button 
              onClick={() => downloadQRPNG("qr-view-only", "View_Only_Menu")}
              className="text-[11px] font-bold text-blue-800 hover:text-blue-950 flex items-center gap-1 bg-blue-100/80 hover:bg-blue-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
            >
              <Download size={11} /> কিউআর
            </button>
          </div>
        </div>
      </div>

      {/* 4. TABLE QR CODES SECTION */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-4 sm:p-6 flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
              <QrCode size={18} className="text-amber-600" />
              <span>টেবিল কিউআর কোড সমূহ (Table QR Codes)</span>
            </h2>
            <p className="text-xs text-gray-500">
              কিউআর কোডটি ডাউনলোড করে প্রিন্ট দিন। স্ক্যান করার সাথে সাথে গ্রাহক সরাসরি খাবারের মেনুতে প্রবেশ করবেন।
            </p>
          </div>
          <span className="text-xs bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1 rounded-full font-bold">
            মোট টেবিল: {tables.length} টি
          </span>
        </div>

        {/* MOBILE CARDS VIEW */}
        <div className="block md:hidden space-y-4">
          {tables.map((table) => {
            const tableNumber = String(table.name).replace(/[^0-9]/g, '') || String(table.id);
            const tableUrl = `${activeBaseUrl}/?table=${tableNumber}#menu`;
            const qrId = `qr-table-mob-${table.id}`;

            return (
              <div key={table.id} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-stone-900 text-base">{table.name}</span>
                    <span className="bg-white border border-stone-200 text-stone-600 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {table.capacity} আসন
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/?table=${tableNumber}#menu`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>টেস্ট ওপেন</span>
                    </a>
                    <button 
                      onClick={() => handleDeleteTable(table.id)}
                      className="p-1 text-stone-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="টেবিল মুছুন"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-stone-200">
                  <div className="p-1 bg-white rounded-lg border border-stone-200 shrink-0 shadow-2xs">
                    <QRCodeSVG id={qrId} value={tableUrl} size={70} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-stone-800">স্ক্যান লিংক:</p>
                    <p className="text-[11px] text-stone-500 font-mono truncate">{tableUrl}</p>
                    <button
                      onClick={() => copyToClipboard(tableUrl, `table-${table.id}`)}
                      className="text-xs text-amber-700 font-bold hover:underline flex items-center gap-1 mt-1.5 cursor-pointer"
                    >
                      {copiedLink === `table-${table.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedLink === `table-${table.id}` ? 'লিংক কপি হয়েছে' : 'লিংক কপি করুন'}</span>
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => downloadQRPNG(qrId, table.name)}
                  className="w-full py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  <span>{table.name} QR ডাউনলোড করুন (PNG)</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 text-stone-600 text-xs border-b border-stone-200">
                <th className="py-3 px-4 font-bold">টেবিলের নাম</th>
                <th className="py-3 px-4 font-bold">আসন সংখ্যা</th>
                <th className="py-3 px-4 font-bold">কিউআর কোড প্রিভিউ ও লিংক</th>
                <th className="py-3 px-4 font-bold text-right">ডাউনলোড ও একশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {tables.map((table) => {
                const tableNumber = String(table.name).replace(/[^0-9]/g, '') || String(table.id);
                const tableUrl = `${activeBaseUrl}/?table=${tableNumber}#menu`;
                const qrId = `qr-table-desk-${table.id}`;

                return (
                  <tr key={table.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-extrabold text-stone-900">
                      {table.name}
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 text-xs font-semibold">
                      {table.capacity} জন
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-1 bg-white rounded-lg border border-stone-200 shrink-0 shadow-2xs">
                          <QRCodeSVG id={qrId} value={tableUrl} size={48} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-mono text-stone-500 truncate max-w-[220px]">
                            {tableUrl}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <button
                              onClick={() => copyToClipboard(tableUrl, `desk-${table.id}`)}
                              className="text-[11px] text-amber-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              {copiedLink === `desk-${table.id}` ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                              <span>{copiedLink === `desk-${table.id}` ? 'কপি হয়েছে' : 'লিংক কপি'}</span>
                            </button>
                            <span className="text-stone-300">|</span>
                            <a
                              href={`/?table=${tableNumber}#menu`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-stone-700 hover:text-amber-700 font-bold flex items-center gap-0.5 cursor-pointer"
                            >
                              <ExternalLink size={10} />
                              <span>টেস্ট ওপেন</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => downloadQRPNG(qrId, table.name)}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                          title="প্রিন্ট করার জন্য PNG ডাউনলোড করুন"
                        >
                          <Download size={13} />
                          <span>ডাউনলোড (PNG)</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteTable(table.id)} 
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" 
                          title="টেবিল মুছুন"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Table Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-black text-gray-900 text-base">নতুন টেবিল যোগ করুন</h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 border border-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddTable} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    টেবিলের নাম (যেমন: Table 06, VIP-1, ছাদ-০১)
                  </label>
                  <input 
                    type="text" 
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="Table 06"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 transition-all text-sm font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    আসন সংখ্যা / ক্যাপাসিটি (জন)
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 transition-all text-sm"
                    required
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  বাতিল
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                >
                  টেবিল তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Table Modal */}
      {tableToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-black text-gray-900">টেবিল মুছে ফেলবেন?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              আপনি কি নিশ্চিতভাবে <span className="font-bold text-gray-800">{tableToDelete.name}</span> মুছে ফেলতে চান?
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setTableToDelete(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold text-xs hover:bg-gray-50 cursor-pointer"
              >
                না, রাখুন
              </button>
              <button
                onClick={confirmDeleteTable}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
