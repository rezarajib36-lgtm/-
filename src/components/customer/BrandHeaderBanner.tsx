import React from 'react';
import { Phone, Clock, MapPin, UtensilsCrossed, Bike, Sparkles, CheckCircle2, ChevronDown, AlertCircle } from 'lucide-react';
import { RestaurantSettings, isRestaurantCurrentlyOpen } from '../../lib/restaurantSettings';
import { formatTelNumber } from '../../utils';

interface BrandHeaderBannerProps {
  settings: RestaurantSettings;
  isDeliveryMode: boolean;
  currentTable: string | null;
  onScrollToMenu: () => void;
  onSwitchToDelivery?: () => void;
  onSwitchToDineIn?: () => void;
}

export default function BrandHeaderBanner({
  settings,
  isDeliveryMode,
  currentTable,
  onScrollToMenu,
  onSwitchToDelivery,
  onSwitchToDineIn
}: BrandHeaderBannerProps) {
  const primaryColor = settings.primaryColor || '#c2410c';
  const logoSrc = settings.logo || '/images/ilisher-bari/logo.png';
  const liveStatus = isRestaurantCurrentlyOpen(settings);

  return (
    <div className="relative z-10 mx-auto w-[calc(100%-2rem)] max-w-5xl my-3">
      {/* Main Brand Banner Shell */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-950 to-stone-900 text-white shadow-2xl border border-amber-500/20">
        {/* Subtle Decorative Pattern Background */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none mix-blend-overlay bg-cover bg-center"
          style={{ backgroundImage: `url(${settings.backgroundArt || '/images/ilisher-bari/background.png'})` }}
        />
        
        {/* Ambient Color Glow */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 p-5 sm:p-7 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Left: Prominent Logo & Brand Identity */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6 flex-1">
            {/* Logo Badge Container */}
            <div className="relative shrink-0 group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl bg-white p-2.5 shadow-xl border-2 border-amber-400/90 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                <img 
                  src={logoSrc} 
                  alt={settings.name || "ইলিশের বাড়ি"} 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/ilisher-bari/logo.png';
                  }}
                />
              </div>
              {/* Online/Open Status dot */}
              <div 
                className="absolute -bottom-1.5 -right-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-md flex items-center gap-1 border border-white/30 backdrop-blur-xs"
                style={{ backgroundColor: liveStatus.badgeColor }}
                title={liveStatus.subText}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>{liveStatus.statusText}</span>
              </div>
            </div>

            {/* Brand Titles & Tagline */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold">
                  <Sparkles size={13} className="text-amber-400" />
                  <span>ঐতিহ্যবাহী স্বাদের রূপালী ইলিশ</span>
                </div>
                {!liveStatus.isOpen && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-400/40 text-red-300 text-[11px] font-bold">
                    <Clock size={12} className="text-red-400" />
                    <span>{liveStatus.subText}</span>
                  </div>
                )}
              </div>

              {/* Main Restaurant Brand Name */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-sm font-sans">
                {settings.name || "ইলিশের বাড়ি"}
              </h1>

              {/* Slogan & Description */}
              <p className="mt-1.5 text-xs sm:text-sm md:text-base text-stone-300 font-medium max-w-xl leading-relaxed">
                {settings.shortDesc || "নদীর তাজা রূপালী ইলিশ ও মুখরোচক খাঁটি খাবারের সেরা ঠিকানা। ঘরে বসেই সরাসরি পছন্দের খাবার অর্ডার করুন।"}
              </p>

              {/* Feature Highlights Pills */}
              <div className="mt-3.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800/80 border border-stone-700/80 text-[11px] font-semibold text-stone-300">
                  <Clock size={12} className="text-amber-400" />
                  <span>{settings.openingHours || "সকাল ১১:০০ AM - রাত ১০:৩০ PM"}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800/80 border border-stone-700/80 text-[11px] font-semibold text-stone-300">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>তাজা ইলিশ স্পেশাল</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800/80 border border-stone-700/80 text-[11px] font-semibold text-stone-300">
                  <Bike size={12} className="text-amber-400" />
                  <span>দ্রুত হোম ডেলিভারি</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Interactive Navigation & Order Action Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col items-center gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-800">
            {/* Primary Action Button: Jump to Menu */}
            <button
              type="button"
              onClick={onScrollToMenu}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-black text-white text-sm sm:text-base shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ring-2 ring-white/20"
              style={{ backgroundColor: primaryColor }}
              title="খাবারের ডিজিটাল তালিকা দেখুন"
            >
              <UtensilsCrossed size={18} />
              <span>খাবারের মেনু দেখুন</span>
              <ChevronDown size={18} className="animate-bounce" />
            </button>

            {/* Current Order Mode Pill or Switcher */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              {isDeliveryMode ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>হোম ডেলিভারি মোড সক্রিয়</span>
                </div>
              ) : currentTable ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>টেবিল {currentTable} সংযুক্ত</span>
                </div>
              ) : (
                settings.phone && (
                  <a
                    href={`tel:${formatTelNumber(settings.phone)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-bold text-stone-200 transition-colors"
                  >
                    <Phone size={13} className="text-amber-400" />
                    <span>কল: {settings.phone}</span>
                  </a>
                )
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
