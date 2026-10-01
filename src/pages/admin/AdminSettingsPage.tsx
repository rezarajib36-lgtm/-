import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, Store, MapPin, Phone, Image as ImageIcon, MessageCircle, 
  ExternalLink, Sparkles, BookOpen, Clock, Palette, CheckCircle, RefreshCw, Eye,
  Copy, Share2
} from 'lucide-react';
import { 
  getRestaurantSettings, 
  saveRestaurantSettings, 
  RestaurantSettings, 
  DEFAULT_RESTAURANT_SETTINGS,
  isRestaurantCurrentlyOpen,
  syncRestaurantSettingsToCloud,
  fetchRestaurantSettingsFromCloud
} from '../../lib/restaurantSettings';
import { formatWhatsAppNumber } from '../../utils';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<RestaurantSettings>(getRestaurantSettings());
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'hero' | 'about' | 'contact' | 'branding' | 'delivery'>('hero');
  const [copiedLink, setCopiedLink] = useState(false);
  const isUserEditingRef = useRef(false);
  const liveStatus = isRestaurantCurrentlyOpen(settings);

  useEffect(() => {
    // Load local storage first for zero delay
    setSettings(getRestaurantSettings());
    // Also fetch latest settings from Supabase cloud database
    fetchRestaurantSettingsFromCloud().then((cloudSettings) => {
      if (cloudSettings && !isUserEditingRef.current) {
        setSettings(cloudSettings);
      }
    });
  }, []);

  const getCustomerUrl = () => {
    if (typeof window !== 'undefined' && window.location.origin.includes('ais-pre-')) {
      return window.location.origin;
    }
    return "https://ais-pre-ai7jnxz6vgz53y6eikvvvo-708310852636.asia-east1.run.app";
  };

  const handleCopyCustomerLink = () => {
    const url = getCustomerUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedLink(true);
    showToast('গ্রাহকদের জন্য আসল ওয়েবসাইটের লিংক কপি হয়েছে! এটি পাঠালে ইলিশের বাড়ির লোগো সহ ওপেন হবে।');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleWhatsAppShare = () => {
    const url = getCustomerUrl();
    const text = encodeURIComponent(`ইলিশের বাড়ি রেস্টুরেন্টের ডিজিটাল খাবার মেনু ও সরাসরি অনলাইন অর্ডার লিংক:\n${url}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    isUserEditingRef.current = true;
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setSettings(prev => ({ ...prev, [name]: checked }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  // Client-side auto compressor: resizes big photos (3-12MB) to web-optimized 40-80KB
  const compressImageFile = (file: File, maxWidth: number, maxHeight: number, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof RestaurantSettings) => {
    const file = e.target.files?.[0];
    if (file) {
      setCompressing(fieldName);
      showToast('ছবি অপ্টিমাইজ হচ্ছে, একটু অপেক্ষা করুন...');
      try {
        let maxW = 1200;
        let maxH = 750;
        let quality = 0.78;
        if (fieldName === 'logo') {
          maxW = 400;
          maxH = 400;
          quality = 0.85;
        }
        const compressedBase64 = await compressImageFile(file, maxW, maxH, quality);
        if (compressedBase64) {
          isUserEditingRef.current = true;
          setSettings(prev => ({ ...prev, [fieldName]: compressedBase64 }));
          showToast('✓ ছবি প্রস্তুত হয়েছে! পরিবর্তন নিশ্চিত করতে নিচে "সেভ করুন" বাটনে চাপ দিন।');
        }
      } catch (err) {
        console.error('Failed to compress image', err);
        showToast('ছবি প্রসেসিংয়ে সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।');
      } finally {
        setCompressing(null);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    isUserEditingRef.current = false;
    saveRestaurantSettings(settings);
    const cloudOk = await syncRestaurantSettingsToCloud(settings);
    setSaving(false);
    if (cloudOk) {
      showToast('✓ হিরো ব্যানার, লোগো ও সমস্ত লেখা ক্লাউড ডেটাবেজে সফলভাবে সংরক্ষিত হয়েছে!');
    } else {
      showToast('✓ সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    }
  };

  const handleResetToIlisherBari = async () => {
    if (window.confirm('আপনি কি ইলিশের বাড়ি রেস্টুরেন্টের মূল (ডিফল্ট) ডিজাইনে রিসেট করতে চান?')) {
      isUserEditingRef.current = false;
      setSettings(DEFAULT_RESTAURANT_SETTINGS);
      saveRestaurantSettings(DEFAULT_RESTAURANT_SETTINGS);
      await syncRestaurantSettingsToCloud(DEFAULT_RESTAURANT_SETTINGS);
      showToast('ইলিশের বাড়ির মূল ডিজাইনে সফলভাবে রিসেট করা হয়েছে!');
    }
  };

  const COLOR_PRESETS = [
    { name: 'ইলিশের বাড়ি টেরাকোটা (ডিফল্ট)', hex: '#c2410c' },
    { name: 'ওয়ার্ম অ্যাম্বার / গোল্ড', hex: '#d97706' },
    { name: 'এমারেল্ড গ্রিন', hex: '#059669' },
    { name: 'চারকোল ব্ল্যাক', hex: '#1c1917' },
    { name: 'রয়াল ব্লু', hex: '#2563eb' },
  ];

  return (
    <div className="max-w-5xl mx-auto flex flex-col pb-16 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900">রেস্টুরেন্ট ও ডিজাইন সেটিংস</h1>
            <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
              ইলিশের বাড়ি থিম
            </span>
          </div>
          <p className="text-gray-500 mt-1 text-xs sm:text-sm">
            কাস্টমার পেইজের হিরো ব্যানার, আমাদের কথা, খাবারের মেনু এবং যোগাযোগের ঠিকানা এখান থেকে সহজেই পরিবর্তন করুন।
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-xs hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Eye size={15} className="text-amber-600" />
            <span>গ্রাহক পেইজ দেখুন</span>
            <ExternalLink size={12} />
          </a>

          <button 
            onClick={handleSave}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md text-xs sm:text-sm disabled:opacity-70 cursor-pointer ml-auto sm:ml-0"
          >
            <Save size={16} />
            <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সেভ করুন (Save)'}</span>
          </button>
        </div>
      </div>

      {/* Customer Share Link Card */}
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-200/90 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <Share2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-gray-900">
                  গ্রাহকদের জন্য আপনার ওয়েবসাইটের পাবলিক লিংক
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                  অফিসিয়াল লিংক
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                <span className="font-bold text-amber-800">💡 মনে রাখুন:</span> গ্রাহকদের কাছে সবসময় এই লিঙ্কটি পাঠাবেন। গুগল স্টুডিওর এডিটর পেজের লিঙ্ক পাঠালে গুগলের লোগো দেখায়। এই লিঙ্কটি হোয়াটসঅ্যাপে পাঠালে সাথে সাথে ইলিশের বাড়ির গোল্ডেন লোগো ও ডিজিটাল মেনু ভেসে উঠবে।
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <code className="text-[11px] font-mono font-semibold bg-white/90 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-200 select-all">
                  {getCustomerUrl()}
                </code>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto self-stretch md:self-auto justify-end shrink-0">
            <button
              type="button"
              onClick={handleCopyCustomerLink}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer flex-1 md:flex-initial ${
                copiedLink
                  ? 'bg-emerald-600 text-white shadow-emerald-200'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200'
              }`}
            >
              <Copy size={14} />
              <span>{copiedLink ? '✓ কপি হয়েছে!' : 'লিংক কপি করুন'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer flex-1 md:flex-initial"
            >
              <MessageCircle size={14} />
              <span>হোয়াটসঅ্যাপে পাঠান</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Restaurant Status Widget */}
      <div className="mb-6 p-4 rounded-2xl bg-white border border-gray-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
            style={{ backgroundColor: liveStatus.badgeColor }}
          >
            <Clock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-semibold">লাইভ স্ট্যাটাস:</span>
              <span 
                className="px-2.5 py-0.5 rounded-full text-white text-xs font-black shadow-xs flex items-center gap-1"
                style={{ backgroundColor: liveStatus.badgeColor }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>{liveStatus.statusText}</span>
              </span>
              <span className="text-[11px] font-bold text-gray-600 hidden sm:inline">
                ({liveStatus.subText})
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              সময়সূচী: <strong>সকাল ১১:০০ AM - রাত ১০:৩০ PM</strong> (বাংলাদেশ সময় অনুযায়ী স্বয়ংক্রিয়ভাবে নিয়ন্ত্রণ হচ্ছে)
            </p>
          </div>
        </div>

        {/* Quick Mode Buttons */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl self-stretch md:self-auto justify-center">
          <button
            type="button"
            onClick={() => {
              setSettings(prev => ({ ...prev, statusMode: 'Auto' }));
              showToast('অটোমেটিক টাইম মোড সক্রিয় করা হয়েছে (সকাল ১১:০০ - রাত ১০:৩০)!');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              (settings.statusMode || 'Auto') === 'Auto'
                ? 'bg-white text-gray-900 shadow-xs ring-1 ring-black/5'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🕒 অটো শিডিউল
          </button>
          <button
            type="button"
            onClick={() => {
              setSettings(prev => ({ ...prev, statusMode: 'Open', status: 'Open' }));
              showToast('রেস্টুরেন্ট সবসময় খোলা রাখার মোড সক্রিয় করা হয়েছে!');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              settings.statusMode === 'Open'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🟢 সবসময় খোলা
          </button>
          <button
            type="button"
            onClick={() => {
              setSettings(prev => ({ ...prev, statusMode: 'Closed', status: 'Closed' }));
              showToast('রেস্টুরেন্ট এখন বন্ধ রাখার মোড সক্রিয় করা হয়েছে!');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              settings.statusMode === 'Closed'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🔴 এখনই বন্ধ
          </button>
        </div>
      </div>

      {/* Tabs for Organization */}
      <div className="flex overflow-x-auto gap-2 border-b border-gray-200 pb-3 mb-6 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('hero')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'hero'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Sparkles size={16} />
          <span>হিরো ব্যানার ও হেডলাইন</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'about'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <BookOpen size={16} />
          <span>আমাদের কথা (স্টোরি)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('contact')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'contact'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <MapPin size={16} />
          <span>ঠিকানা, সময় ও সোশ্যাল</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'branding'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Palette size={16} />
          <span>লোগো, রঙ ও আর্টওয়ার্ক</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('delivery')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'delivery'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <MapPin size={16} />
          <span>ডেলিভারি চার্জ</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* TAB 1: HERO SECTION */}
          {activeTab === 'hero' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200/80">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-gray-900">হিরো ব্যানার ও মূল শিরোনাম</h2>
                      <p className="text-xs text-gray-500">গ্রাহক ওয়েবসাইটে ঢুকলে প্রথমে এই অংশটি দেখতে পাবেন।</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      আইব্রো হাইলাইট ট্যাগ (Eyebrow Highlight)
                    </label>
                    <input 
                      type="text" 
                      name="heroEyebrow"
                      value={settings.heroEyebrow}
                      onChange={handleChange}
                      placeholder="e.g. নদীর হাওয়া, বাংলার স্বাদে"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-amber-600 text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      মূল শিরোনাম (Main Display Headline)
                    </label>
                    <textarea 
                      name="heroTitle"
                      rows={2}
                      value={settings.heroTitle}
                      onChange={handleChange}
                      placeholder="e.g. খাবার নয়, এক টুকরো অনুভব"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-amber-600 text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      উপ-শিরোনাম বা বর্ণনা (Subtitle)
                    </label>
                    <input 
                      type="text" 
                      name="heroSubtitle"
                      value={settings.heroSubtitle}
                      onChange={handleChange}
                      placeholder="e.g. স্বাদ, গল্প আর প্রিয়জনের আড্ডা—সব একসঙ্গে।"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-amber-600 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        মেনু দেখার বোতাম (Primary Button)
                      </label>
                      <input 
                        type="text" 
                        name="heroPrimaryBtnText"
                        value={settings.heroPrimaryBtnText}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-amber-600 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        ঠিকানা দেখার বোতাম (Secondary Button)
                      </label>
                      <input 
                        type="text" 
                        name="heroSecondaryBtnText"
                        value={settings.heroSecondaryBtnText}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-amber-600 text-xs font-medium"
                      />
                    </div>
                  </div>

                  {/* Hero Artwork Image */}
                  <div className="pt-2 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-700 mb-2">
                      হিরো ব্যানারের ছবি (Hero Artwork Image)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <div className="w-full sm:w-48 h-32 rounded-2xl overflow-hidden bg-stone-900 border border-gray-200 shrink-0">
                        <img 
                          src={settings.heroImage} 
                          alt="Hero Preview" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/ilisher-bari/hero.png';
                          }}
                        />
                      </div>
                      <div className="flex-1 space-y-2 w-full">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, 'heroImage')}
                          className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100 cursor-pointer"
                        />
                        {compressing === 'heroImage' && (
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 p-2 rounded-xl">
                            <span className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></span>
                            <span>ছবি অপ্টিমাইজ ও প্রসেস করা হচ্ছে...</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            name="heroImage"
                            value={settings.heroImage}
                            onChange={handleChange}
                            placeholder="অথবা ছবির সরাসরি ওয়েব লিঙ্ক (URL) দিন"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white"
                          />
                        </div>
                        <p className="text-[11px] text-gray-400">
                          ডিফল্ট ছবি: ইলিশের বাড়ি রেস্টুরেন্টের আর্টওয়ার্ক ব্যানার।
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ABOUT US SECTION */}
          {activeTab === 'about' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200/80">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                      <BookOpen size={18} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-gray-900">আমাদের কথা (About Us / Story)</h2>
                      <p className="text-xs text-gray-500">রেস্তোরাঁর ইতিহাস, খাবারের বৈশিষ্ট্য ও পরিচয় তুলে ধরুন।</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        সেকশন ব্যাজ (Section Label)
                      </label>
                      <input 
                        type="text" 
                        name="aboutBadge"
                        value={settings.aboutBadge}
                        onChange={handleChange}
                        placeholder="আমাদের কথা"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-xs font-bold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        বড় শিরোনাম (Story Title)
                      </label>
                      <input 
                        type="text" 
                        name="aboutTitle"
                        value={settings.aboutTitle}
                        onChange={handleChange}
                        placeholder="স্বাদ আর আনন্দের এক আপন ঠিকানা"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      প্রথম প্যারাগ্রাফ (Paragraph 1)
                    </label>
                    <textarea 
                      name="aboutText1"
                      rows={3}
                      value={settings.aboutText1}
                      onChange={handleChange}
                      placeholder="রেস্তোরাঁর অবস্থান ও পরিবেশ সম্পর্কে লিখুন..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-xs leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      দ্বিতীয় প্যারাগ্রাফ (Paragraph 2 - মেনু ও খাবারের বৈচিত্র্য)
                    </label>
                    <textarea 
                      name="aboutText2"
                      rows={3}
                      value={settings.aboutText2}
                      onChange={handleChange}
                      placeholder="কী কী খাবার ও আকর্ষণ রয়েছে..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-xs leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      শেষ হাইলাইটেড লাইন (Concluding Tagline)
                    </label>
                    <input 
                      type="text" 
                      name="aboutTagline"
                      value={settings.aboutTagline}
                      onChange={handleChange}
                      placeholder="ইলিশের বাড়ি—নতুন স্বাদ, নতুন অভিজ্ঞতা, নতুন বন্ধুত্ব।"
                      className="w-full px-4 py-2.5 bg-amber-50/50 border border-amber-200 rounded-xl outline-none focus:bg-white text-xs font-bold text-amber-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONTACT, LOCATION & HOURS */}
          {activeTab === 'contact' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200/80">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-gray-900">ঠিকানা, গুগল ম্যাপ ও সময়সূচি</h2>
                      <p className="text-xs text-gray-500">কাস্টমার সরাসরি ঠিকানা দেখতে পারবে এবং ম্যাপে ক্লিক করতে পারবে।</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        এলাকা / প্রধান লোকেশন শিরোনাম
                      </label>
                      <input 
                        type="text" 
                        name="locationTitle"
                        value={settings.locationTitle}
                        onChange={handleChange}
                        placeholder="e.g. শ্রীরায়েরচর বাজার, মতলব উত্তর"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        খোলার সময়সূচী (Opening Hours Text)
                      </label>
                      <input 
                        type="text" 
                        name="openingHours"
                        value={settings.openingHours}
                        onChange={handleChange}
                        placeholder="প্রতিদিন সকাল ১১:০০ AM — রাত ১০:৩০ PM"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        বন্ধ হওয়ার সময় (Closing Time)
                      </label>
                      <input 
                        type="text" 
                        name="closingTime"
                        value={settings.closingTime || '১০:৩০ PM'}
                        onChange={handleChange}
                        placeholder="১০:৩০ PM"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      সম্পূর্ণ বিস্তারিত ঠিকানা (Detailed Address)
                    </label>
                    <textarea 
                      name="address"
                      rows={2}
                      value={settings.address}
                      onChange={handleChange}
                      placeholder="ব্রিজ সংলগ্ন, গালিমখা, বাংলাবাজার, মতলব উত্তর, চাঁদপুর"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      গুগল ম্যাপস লিঙ্ক (Google Maps Link)
                    </label>
                    <input 
                      type="url" 
                      name="mapLink"
                      value={settings.mapLink}
                      onChange={handleChange}
                      placeholder="https://maps.app.goo.gl/..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        ফোন নম্বর (Phone for calling)
                      </label>
                      <input 
                        type="text" 
                        name="phone"
                        value={settings.phone}
                        onChange={handleChange}
                        placeholder="০১৯১৮৩০৮৭০৬"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        হোয়াটসঅ্যাপ নম্বর (WhatsApp Number)
                      </label>
                      <input 
                        type="text" 
                        name="whatsapp"
                        value={settings.whatsapp}
                        onChange={handleChange}
                        placeholder="01918308706"
                        className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl outline-none focus:bg-white text-xs font-bold text-emerald-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      ফেসবুক পেজ লিঙ্ক (Facebook Page URL)
                    </label>
                    <input 
                      type="url" 
                      name="facebookUrl"
                      value={settings.facebookUrl}
                      onChange={handleChange}
                      placeholder="https://www.facebook.com/..."
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-xs"
                    />
                  </div>

                  {/* WhatsApp Auto-Open switch */}
                  <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 mt-2">
                    <div>
                      <p className="text-xs font-bold text-gray-800">অর্ডারের সাথে সাথে স্বয়ংক্রিয়ভাবে হোয়াটসঅ্যাপ ওপেন হবে</p>
                      <p className="text-[11px] text-gray-500">কাস্টমার অর্ডার প্লেস করলে হোয়াটসঅ্যাপে অর্ডার রসিদ রেডি হয়ে যাবে।</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                      <input 
                        type="checkbox" 
                        checked={settings.autoOpenWhatsApp} 
                        onChange={(e) => setSettings(prev => ({ ...prev, autoOpenWhatsApp: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BRANDING, LOGO & ARTWORK */}
          {activeTab === 'branding' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* 1. LOGO SETTINGS */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200/80">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                      <ImageIcon size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-gray-900">রেস্টুরেন্ট লোগো (Logo)</h2>
                      <p className="text-xs text-gray-500">আপনার ব্র্যান্ড লোগো হেডার, ব্যানার এবং সোশ্যাল মিডিয়া প্রিভিউতে প্রদর্শিত হবে।</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSettings(prev => ({ ...prev, logo: '/images/ilisher-bari/logo.png' }));
                      showToast('ডিফল্ট লোগো সিলেক্ট করা হয়েছে!');
                    }}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition-colors"
                  >
                    ডিফল্ট লোগো ব্যবহার করুন
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-stone-50 rounded-2xl border border-stone-200/80">
                  {/* Current Logo Preview */}
                  <div className="relative shrink-0">
                    <div className="w-28 h-28 rounded-2xl bg-white p-2.5 shadow-md border-2 border-amber-400 flex items-center justify-center overflow-hidden">
                      <img 
                        src={settings.logo || '/images/ilisher-bari/logo.png'} 
                        alt={settings.name || "লোগো"} 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/images/ilisher-bari/logo.png';
                        }}
                      />
                    </div>
                    <span className="absolute -bottom-2 -right-2 bg-stone-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                      প্রিভিউ
                    </span>
                  </div>

                  {/* Upload and Link Options */}
                  <div className="flex-1 w-full space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        কম্পিউটার বা মোবাইল থেকে লোগো আপলোড করুন
                      </label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleImageUpload(e, 'logo')}
                        className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 file:cursor-pointer cursor-pointer border border-gray-200 rounded-xl bg-white p-1"
                      />
                      {compressing === 'logo' && (
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 p-2 rounded-xl mt-2">
                          <span className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></span>
                          <span>লোগো অপ্টিমাইজ ও প্রসেস করা হচ্ছে...</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        অথবা সরাসরি লোগোর ইমেজ লিংক (URL) লিখুন
                      </label>
                      <input 
                        type="text" 
                        name="logo" 
                        value={settings.logo || ''} 
                        onChange={handleChange}
                        placeholder="/images/ilisher-bari/logo.png বা https://..."
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. COLOR PALETTE SETTINGS */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200/80">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                    <Palette size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-gray-900">থিম ও ব্র্যান্ড কালার (Primary Color)</h2>
                    <p className="text-xs text-gray-500">বাটন, হেডার হাইলাইট ও অ্যাকসেন্ট রঙ হিসেবে এই কালারটি ব্যবহার হবে।</p>
                  </div>
                </div>

                {/* Preset Swatches */}
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    তৈরি করা কালার প্যালেট থেকে বেছে নিন:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                    {COLOR_PRESETS.map((preset) => {
                      const isSelected = (settings.primaryColor || '#c2410c').toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => {
                            setSettings(prev => ({ ...prev, primaryColor: preset.hex }));
                            showToast(`কালার "${preset.name}" নির্বাচন করা হয়েছে!`);
                          }}
                          className={`p-3 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                            isSelected 
                              ? 'border-gray-900 bg-gray-50 shadow-sm ring-2 ring-gray-900/10' 
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span 
                              className="w-6 h-6 rounded-full border border-black/10 shadow-xs" 
                              style={{ backgroundColor: preset.hex }} 
                            />
                            {isSelected && <CheckCircle size={15} className="text-emerald-600" />}
                          </div>
                          <div>
                            <span className="block text-[11px] font-bold text-gray-900 leading-tight">
                              {preset.name}
                            </span>
                            <span className="block text-[10px] font-mono text-gray-400">
                              {preset.hex}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Color Picker & Hex Input */}
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <label className="text-xs font-bold text-gray-700 shrink-0">
                      কাস্টম কালার পিকার:
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        name="primaryColor" 
                        value={settings.primaryColor || '#c2410c'} 
                        onChange={handleChange}
                        className="w-10 h-10 rounded-xl cursor-pointer border border-gray-300 p-0.5 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                    <label className="text-xs font-bold text-gray-700 shrink-0">
                      কালার কোড (HEX):
                    </label>
                    <input 
                      type="text" 
                      name="primaryColor" 
                      value={settings.primaryColor || '#c2410c'} 
                      onChange={handleChange}
                      placeholder="#c2410c"
                      className="px-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-xs font-mono font-bold w-full sm:w-36 uppercase"
                    />
                  </div>

                  {/* Sample Button Preview with Selected Color */}
                  <div className="shrink-0 w-full sm:w-auto flex justify-center">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition-transform active:scale-95"
                      style={{ backgroundColor: settings.primaryColor || '#c2410c' }}
                    >
                      বাটনের প্রিভিউ
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. HERO & BACKGROUND ARTWORK */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200/80">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-gray-900">হিরো ব্যানার ও ব্যাকগ্রাউন্ড ছবি</h2>
                    <p className="text-xs text-gray-500">হোম পেইজের প্রধান হিরো সেকশন এবং ব্যাকগ্রাউন্ড আর্টওয়ার্ক পরিবর্তন করুন।</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Hero Photo / Art */}
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-800">
                        হিরো প্রধান ছবি (Hero Art)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSettings(prev => ({ ...prev, heroImage: '/images/ilisher-bari/hero.png' }));
                          showToast('ডিফল্ট হিরো ছবি সিলেক্ট করা হয়েছে!');
                        }}
                        className="text-[11px] font-bold text-amber-700 hover:underline"
                      >
                        ডিফল্ট ছবি
                      </button>
                    </div>

                    <div className="h-36 rounded-xl overflow-hidden bg-stone-900 border border-stone-200 relative">
                      <img 
                        src={settings.heroImage || '/images/ilisher-bari/hero.png'} 
                        alt="হিরো ব্যানার" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/images/ilisher-bari/hero.png';
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        নতুন ছবি আপলোড করুন
                      </label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleImageUpload(e, 'heroImage')}
                        className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-stone-800 file:text-white hover:file:bg-stone-700 file:cursor-pointer cursor-pointer border border-gray-200 rounded-xl bg-white p-1"
                      />
                    </div>
                  </div>

                  {/* Background Artwork */}
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-800">
                        ব্যাকগ্রাউন্ড আর্টওয়ার্ক (Background Pattern)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSettings(prev => ({ ...prev, backgroundArt: '/images/ilisher-bari/background.png' }));
                          showToast('ডিফল্ট ব্যাকগ্রাউন্ড সিলেক্ট করা হয়েছে!');
                        }}
                        className="text-[11px] font-bold text-amber-700 hover:underline"
                      >
                        ডিফল্ট ব্যাকগ্রাউন্ড
                      </button>
                    </div>

                    <div className="h-36 rounded-xl overflow-hidden bg-stone-900 border border-stone-200 relative">
                      <img 
                        src={settings.backgroundArt || '/images/ilisher-bari/background.png'} 
                        alt="ব্যাকগ্রাউন্ড প্যাটার্ন" 
                        className="w-full h-full object-cover opacity-80"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/images/ilisher-bari/background.png';
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        নতুন ব্যাকগ্রাউন্ড আপলোড করুন
                      </label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleImageUpload(e, 'backgroundArt')}
                        className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-stone-800 file:text-white hover:file:bg-stone-700 file:cursor-pointer cursor-pointer border border-gray-200 rounded-xl bg-white p-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. RESET TO ILISHER BARI DEFAULTS */}
              <div className="p-5 bg-amber-50/80 rounded-3xl border border-amber-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-black text-amber-950">ডিফল্ট ডিজাইনে ফিরে যেতে চান?</h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    লোগো, রঙ বা ব্যানার ছবি কোনো কারণে এলোমেলো হয়ে গেলে এক ক্লিকেই ইলিশের বাড়ির মূল রূপে ফিরিয়ে আনতে পারেন।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetToIlisherBari}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw size={14} />
                  <span>ইলিশের বাড়ি থিমে রিসেট করুন</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: DELIVERY SETTINGS */}
          {activeTab === 'delivery' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200/80">
                <h2 className="text-base font-black text-gray-900 mb-4">ডেলিভারি চার্জ নির্ধারণ</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: '১ কিমি পর্যন্ত', name: 'km1' },
                    { label: '১ - ৫ কিমি', name: 'km5' },
                    { label: '৫ - ১০ কিমি', name: 'km10' },
                    { label: '১০ - ১৫ কিমি', name: 'km15' },
                  ].map((tier) => (
                    <div key={tier.name}>
                      <label className="block text-xs font-bold text-gray-700 mb-1">{tier.label}</label>
                      <input
                        type="number"
                        name={`deliveryFeeTiers.${tier.name}`}
                        value={settings.deliveryFeeTiers[tier.name as keyof typeof settings.deliveryFeeTiers]}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          deliveryFeeTiers: { ...prev.deliveryFeeTiers, [tier.name]: parseInt(e.target.value) }
                        }))}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white text-sm font-bold"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar: Live Preview & Quick Actions */}
        <div className="lg:col-span-1 space-y-5">
          {/* Quick Actions Card */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200/80">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">
              কুইক অ্যাকশন
            </h3>

            <div className="space-y-2.5">
              <button 
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={15} />
                <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সব পরিবর্তন সেভ করুন'}</span>
              </button>

              <button 
                type="button"
                onClick={handleResetToIlisherBari}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-800 py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 text-xs border border-stone-200 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>ইলিশের বাড়ির ডিফল্টে রিসেট</span>
              </button>
            </div>
          </div>

          {/* Live Mobile Card Preview */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200/80 sticky top-16">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>লাইভ প্রিভিউ (Preview)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </h3>

            <div className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-900 shadow-md">
              {/* Mini Hero Cover */}
              <div className="relative h-28 w-full overflow-hidden bg-stone-950">
                <img 
                  src={settings.heroImage} 
                  alt="Hero Preview" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/ilisher-bari/hero.png';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 to-transparent flex items-end p-2.5">
                  <span className="text-[10px] font-black text-amber-300">
                    {settings.heroEyebrow}
                  </span>
                </div>
              </div>

              {/* Mini Content */}
              <div className="p-3 bg-stone-900 text-white">
                <h4 className="text-xs font-black line-clamp-1">{settings.heroTitle}</h4>
                <p className="text-[10px] text-stone-400 mt-0.5 line-clamp-1">{settings.heroSubtitle}</p>

                <div className="mt-2.5 pt-2 border-t border-stone-800 flex items-center justify-between text-[10px]">
                  <span className="text-stone-300 truncate max-w-[140px]">📍 {settings.locationTitle}</span>
                  <span className="font-bold text-amber-400">{settings.openingHours}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 text-center">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"
              >
                <span>পুরো পেইজটি নতুন ট্যাবে দেখুন</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200 pointer-events-none">
          <div className="px-4 py-3 rounded-2xl shadow-xl border bg-stone-900 text-white border-stone-800 flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            <CheckCircle size={18} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
