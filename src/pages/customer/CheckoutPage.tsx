import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../lib/supabase';
import { getRestaurantSettings, createWhatsAppOrderLink } from '../../utils';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, totalPrice, clearCart } = useCart();
  const pointsToEarn = 0;
  const discountAmount = 0;
  const isRedeeming = false;
  
  const [orderType, setOrderType] = useState<'dine_in' | 'delivery'>('dine_in');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [address, setAddress] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);

  // Read mode from query param or session / local storage
  const urlDelivery = searchParams.get('delivery') === 'true' || searchParams.get('mode') === 'delivery';
  const urlTable = searchParams.get('table') || searchParams.get('tbl');

  const orderMode = typeof window !== 'undefined' ? (sessionStorage.getItem('orderMode') || localStorage.getItem('orderMode')) : null;
  const isForcedDelivery = urlDelivery || orderMode === 'delivery';
  const storedTable = typeof window !== 'undefined' ? (sessionStorage.getItem('currentTable') || localStorage.getItem('currentTable')) : null;
  const forcedTable = urlTable || (orderMode?.startsWith('table_') ? orderMode.split('_')[1] : storedTable);

  useEffect(() => {
    if (isForcedDelivery) {
      setOrderType('delivery');
    } else if (forcedTable) {
      setOrderType('dine_in');
      setTableNumber(forcedTable);
    }
  }, [isForcedDelivery, forcedTable]);

  const [deliveryCharge, setDeliveryCharge] = useState<number>(30); // Default to 30 TK (up to 1 km)
  const [detailedAddress, setDetailedAddress] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  // Restaurant Coordinates (Ilisher Bari Restaurant, Bangla Bazar, Matlab, Chandpur)
  const REST_LAT = 23.4549524;
  const REST_LNG = 90.7058119;

  function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  const updateDeliveryCharge = (dist: number) => {
    let charge = 30;
    if (dist <= 1) {
      charge = 30;
    } else if (dist <= 5) {
      charge = 50;
    } else if (dist <= 10) {
      charge = 100;
    } else if (dist <= 15) {
      charge = 150;
    } else {
      charge = 200;
    }
    setDeliveryCharge(charge);
  };

  const updateLocationAndDistance = (lat: number, lng: number, geocoder: any) => {
    setSelectedCoords({ lat, lng });

    // 1. Immediate Haversine fallback distance
    const haversineDist = getDistanceInKm(REST_LAT, REST_LNG, lat, lng);
    setDistance(haversineDist);
    updateDeliveryCharge(haversineDist);

    // 2. Query Google Maps Distance Matrix Service for real driving road distance
    if ((window as any).google && (window as any).google.maps) {
      try {
        const service = new (window as any).google.maps.DistanceMatrixService();
        service.getDistanceMatrix(
          {
            origins: [new (window as any).google.maps.LatLng(REST_LAT, REST_LNG)],
            destinations: [new (window as any).google.maps.LatLng(lat, lng)],
            travelMode: (window as any).google.maps.TravelMode.DRIVING,
          },
          (response: any, status: any) => {
            if (status === 'OK' && response && response.rows[0] && response.rows[0].elements[0]) {
              const element = response.rows[0].elements[0];
              if (element.status === 'OK' && element.distance) {
                const drivingDistKm = element.distance.value / 1000;
                setDistance(drivingDistKm);
                updateDeliveryCharge(drivingDistKm);
                console.log(`Real driving distance: ${drivingDistKm.toFixed(2)} km`);
              } else {
                console.warn("Distance Matrix status not OK for elements:", element.status);
              }
            } else {
              console.warn("Distance Matrix request failed with status:", status);
            }
          }
        );
      } catch (err) {
        console.error("Error invoking Distance Matrix Service:", err);
      }
    }

    if (geocoder) {
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          setAddress(results[0].formatted_address);
        }
      });
    }
  };

  const deliveryFee = orderType === 'delivery' ? deliveryCharge : 0;
  const appliedDiscount = isRedeeming ? discountAmount : 0;
  const foodTotalAfterDiscount = Math.max(0, totalPrice - appliedDiscount);
  const total = foodTotalAfterDiscount + deliveryFee;

  // Dynamically load Google Maps script when order type is delivery
  useEffect(() => {
    if (orderType !== 'delivery') return;
    if ((window as any).google) {
      setMapLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAbEaWnnElPIBoc9nqdh-gkEpb8L-vS8GA`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, [orderType]);

  // Handle map initialization and markers
  useEffect(() => {
    if (!mapLoaded || orderType !== 'delivery') return;

    const mapElement = document.getElementById('google-map');
    if (!mapElement) return;

    const defaultCenter = selectedCoords || { lat: REST_LAT, lng: REST_LNG };

    const map = new (window as any).google.maps.Map(mapElement, {
      center: defaultCenter,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    const marker = new (window as any).google.maps.Marker({
      position: defaultCenter,
      map: map,
      draggable: true,
      animation: (window as any).google.maps.Animation.DROP,
    });

    const geocoder = new (window as any).google.maps.Geocoder();

    const updateLocation = (lat: number, lng: number) => {
      updateLocationAndDistance(lat, lng, geocoder);
    };

    // Auto-locate or use default coords
    if (!selectedCoords) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            const userCoords = { lat: userLat, lng: userLng };
            map.setCenter(userCoords);
            marker.setPosition(userCoords);
            updateLocation(userLat, userLng);
          },
          () => {
            updateLocation(REST_LAT, REST_LNG);
          }
        );
      } else {
        updateLocation(REST_LAT, REST_LNG);
      }
    } else {
      updateLocation(selectedCoords.lat, selectedCoords.lng);
    }

    // Map Click
    map.addListener('click', (e: any) => {
      const clickedLat = e.latLng.lat();
      const clickedLng = e.latLng.lng();
      marker.setPosition({ lat: clickedLat, lng: clickedLng });
      updateLocation(clickedLat, clickedLng);
    });

    // Marker drag
    marker.addListener('dragend', () => {
      const position = marker.getPosition();
      if (position) {
        const dragLat = position.lat();
        const dragLng = position.lng();
        updateLocation(dragLat, dragLng);
      }
    });

  }, [mapLoaded, orderType]);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setSelectedCoords({ lat, lng });
        
        if ((window as any).google) {
          const mapElement = document.getElementById('google-map');
          if (mapElement) {
            const map = new (window as any).google.maps.Map(mapElement, {
              center: { lat, lng },
              zoom: 15,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
            });
            const marker = new (window as any).google.maps.Marker({
              position: { lat, lng },
              map: map,
              draggable: true,
            });
            const geocoder = new (window as any).google.maps.Geocoder();
            
            const updateLocation = (uLat: number, uLng: number) => {
              updateLocationAndDistance(uLat, uLng, geocoder);
            };
            
            updateLocation(lat, lng);
            
            map.addListener('click', (e: any) => {
              const clickedLat = e.latLng.lat();
              const clickedLng = e.latLng.lng();
              marker.setPosition({ lat: clickedLat, lng: clickedLng });
              updateLocation(clickedLat, clickedLng);
            });
            
            marker.addListener('dragend', () => {
              const pos = marker.getPosition();
              if (pos) updateLocation(pos.lat(), pos.lng());
            });
          }
        }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert("Your cart is empty!");
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Create a short order number
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const generatedOrderNumber = `#ORD-${randomNum}`;

      // Create a text summary of the items with exact food unit price for automatic bill calculation
      const itemsSummaryText = items.map(item => {
        const unitPrice = item.price || 0;
        const priceTag = unitPrice > 0 ? ` [৳${unitPrice}]` : '';
        const noteTag = item.instruction ? ` (${item.instruction})` : '';
        return `${item.quantity}x ${item.name}${priceTag}${noteTag}`;
      }).join(', ');

      const orderLocation = orderType === 'dine_in' 
        ? `Table ${tableNumber}` 
        : `${detailedAddress ? `${detailedAddress}, ` : ''}${address}${distance !== null ? ` (দূরত্ব: ${distance.toFixed(1)} কিমি)` : ''}`;

      const resolvedCustomerName = customerName.trim() || (orderType === 'dine_in' ? `টেবিল ${tableNumber || 'অর্ডার'}` : 'সম্মানিত কাস্টমার');
      const resolvedCustomerPhone = phone.trim() || (orderType === 'dine_in' ? 'প্রযোজ্য নয়' : '');

      const orderData = {
        order_number: generatedOrderNumber,
        customer_name: resolvedCustomerName,
        customer_phone: resolvedCustomerPhone,
        order_type: orderType === 'dine_in' ? 'Dine-in' : 'Delivery',
        location: orderLocation,
        total_amount: total,
        status: 'Pending',
        items_summary: itemsSummaryText
      };

      let insertedId = `local_${Date.now()}`;
      try {
        const { data, error } = await supabase.from('orders').insert([orderData]).select();
        if (error) {
          console.warn("Supabase insert error, saving locally:", error);
        } else if (data && data[0]?.id) {
          insertedId = data[0].id;
        }
      } catch (err) {
        console.warn("Supabase network error, fallback to local:", err);
      }

      // Always save to local orders storage as resilient backup
      try {
        const existingLocal = JSON.parse(localStorage.getItem('restaurant_local_orders') || '[]');
        existingLocal.unshift({
          ...orderData,
          id: insertedId,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('restaurant_local_orders', JSON.stringify(existingLocal.slice(0, 100)));
      } catch (storageErr) {
        console.error("Local storage error:", storageErr);
      }

      // Generate WhatsApp order message link
      const restSettings = getRestaurantSettings();
      const loyaltyNote = appliedDiscount > 0 ? ` (লয়্যালটি ছাড়: -৳${appliedDiscount})` : '';
      const whatsappOrderData = {
        orderNumber: generatedOrderNumber,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        orderType: orderType === 'dine_in' ? 'Dine-in' : 'Delivery',
        location: orderLocation,
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          instruction: item.instruction
        })),
        itemsSummary: itemsSummaryText + loyaltyNote,
        subtotal: totalPrice,
        deliveryFee: orderType === 'delivery' ? deliveryFee : 0,
        total,
        restaurantName: restSettings.name,
        lat: selectedCoords ? selectedCoords.lat : undefined,
        lng: selectedCoords ? selectedCoords.lng : undefined
      };

      const targetWhatsAppNumber = restSettings.whatsapp || restSettings.phone || '01711123456';
      const whatsappUrl = createWhatsAppOrderLink(targetWhatsAppNumber, whatsappOrderData);
      const earnedPoints = 0;

      // If sendWhatsApp is true, automatically open WhatsApp in a new tab/window
      if (sendWhatsApp) {
        try {
          window.open(whatsappUrl, '_blank');
        } catch (e) {
          console.log("Auto-open blocked by browser, confirmation page will show action button", e);
        }
      }

      // Order placed successfully
      clearCart();
      
      // Navigate to confirmation page, passing detailed receipt & WhatsApp link
      const orderId = insertedId;
      
      navigate('/order-confirmation', { 
        state: { 
          orderId, 
          localItems: items, 
          deliveryFee: orderType === 'delivery' ? deliveryFee : 0,
          whatsappUrl,
          whatsappNumber: targetWhatsAppNumber,
          autoOpened: sendWhatsApp,
          earnedPoints,
          discountAmount: appliedDiscount,
          orderTotal: total
        } 
      });

    } catch (error: any) {
      console.error('Error placing order:', error);
      alert(`Caught error: ${error.message || 'Failed to place order'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col pb-28">
      {/* Header */}
      <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-5 py-4">
          <Link to="/cart" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="font-bold text-lg text-gray-900">Checkout</h1>
          <div className="w-10"></div>
        </div>
      </div>

      <form id="checkout-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-8">
        
        {/* Order Type Selection */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>অর্ডারের ধরণ (Order Type)</span>
            </h2>
            {orderType === 'delivery' ? (
              <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                🛵 হোম ডেলিভারি
              </span>
            ) : (
              <span className="text-xs bg-emerald-100 text-emerald-900 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                🍽️ টেবিলে খাওয়া {tableNumber ? `(টেবিল ${tableNumber})` : ''}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setOrderType('dine_in');
                sessionStorage.removeItem('orderMode');
                localStorage.removeItem('orderMode');
              }}
              className={`py-3 px-4 rounded-xl border-2 transition-all font-semibold text-xs sm:text-sm flex flex-col items-center gap-2 cursor-pointer ${
                orderType === 'dine_in' 
                  ? 'border-gray-900 bg-gray-900 text-white shadow-md' 
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
              <span>টেবিলে খাওয়া (Dine-In)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOrderType('delivery');
                sessionStorage.setItem('orderMode', 'delivery');
                localStorage.setItem('orderMode', 'delivery');
              }}
              className={`py-3 px-4 rounded-xl border-2 transition-all font-semibold text-xs sm:text-sm flex flex-col items-center gap-2 cursor-pointer ${
                orderType === 'delivery' 
                  ? 'border-gray-900 bg-gray-900 text-white shadow-md' 
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              <span>হোম ডেলিভারি (Delivery)</span>
            </button>
          </div>
        </section>

        {/* Dynamic Form Fields based on Order Type */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>{orderType === 'dine_in' ? 'কাস্টমারের তথ্য (ঐচ্ছিক)' : 'যোগাযোগ ও ডেলিভারি তথ্য'}</span>
            </h2>
            {orderType === 'dine_in' && (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                টেবিলে নাম ও ফোন নম্বর ঐচ্ছিক
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-sm font-medium text-gray-700">আপনার নাম (Full Name)</label>
                {orderType === 'dine_in' ? (
                  <span className="text-xs font-semibold text-stone-400">ঐচ্ছিক</span>
                ) : (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">প্রয়োজনীয়</span>
                )}
              </div>
              <input 
                type="text" 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={orderType === 'dine_in' ? 'নাম না দিলেও সমস্যা নেই (ঐচ্ছিক)' : 'আপনার পুরো নাম'}
                required={orderType === 'delivery'}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-sm font-medium text-gray-700">মোবাইল নম্বর (Phone Number)</label>
                {orderType === 'dine_in' ? (
                  <span className="text-xs font-semibold text-stone-400">ঐচ্ছিক</span>
                ) : (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">প্রয়োজনীয়</span>
                )}
              </div>
              <input 
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={orderType === 'dine_in' ? 'মোবাইল নম্বর না দিলেও চলবে (ঐচ্ছিক)' : '017XX XXXXXX'}
                required={orderType === 'delivery'}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
              />
            </div>

            {orderType === 'dine_in' ? (
              !forcedTable && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Table Number</label>
                <div className="relative">
                  <select 
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all appearance-none"
                  >
                    <option value="" disabled>Select a table</option>
                    <option value="1">Table 1</option>
                    <option value="2">Table 2</option>
                    <option value="3">Table 3</option>
                    <option value="4">VIP Table 1</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>
              )
            ) : (
              <div className="space-y-4">
                {/* Map Section */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-800">ম্যাপে আপনার লোকেশন সিলেক্ট করুন</span>
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      লাইভ লোকেশন
                    </button>
                  </div>

                  <div 
                    id="google-map" 
                    className="w-full h-48 rounded-xl border border-gray-200 overflow-hidden relative bg-gray-100"
                    style={{ minHeight: '192px' }}
                  >
                    {!mapLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                        ম্যাপ লোড হচ্ছে...
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    * লাল পিনটি ড্র্যাগ করে অথবা ম্যাপে ক্লিক করে আপনার সঠিক ডেলিভারি লোকেশন নির্ধারণ করুন।
                  </p>
                </div>

                {/* Selected Address field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">ম্যাপ অনুযায়ী ঠিকানা</label>
                  <textarea 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="ম্যাপ থেকে ঠিকানা লোড হচ্ছে..."
                    required
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all resize-none text-gray-700 text-sm"
                  />
                </div>

                {/* Detailed Address input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">বিস্তারিত ঠিকানা (যেমন: ফ্ল্যাট, রোড বা পরিচিত স্থান)</label>
                  <input 
                    type="text"
                    value={detailedAddress}
                    onChange={(e) => setDetailedAddress(e.target.value)}
                    placeholder="বাসা নং #১২, রোড নং #৩, ৫ তলা..."
                    required
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all text-sm"
                  />
                </div>

                {/* Delivery Charge Info based on Distance */}
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">দূরত্ব (রেস্টুরেন্ট থেকে):</span>
                    <span className="font-bold text-gray-900">
                      {distance !== null ? `${distance.toFixed(2)} কিমি` : 'হিসাব করা হচ্ছে...'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">ডেলিভারি চার্জ:</span>
                    <span className="font-bold text-orange-700 text-base">
                      ৳{deliveryCharge}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-orange-100/50 text-[10px] text-gray-500 space-y-0.5">
                    <p>• ১ কিমি পর্যন্ত: ৩০ টাকা ডেলিভারি চার্জ</p>
                    <p>• ১ থেকে ৫ কিমি পর্যন্ত: ৫০ টাকা ডেলিভারি চার্জ</p>
                    <p>• ৫ থেকে ১০ কিমি পর্যন্ত: ১০০ টাকা ডেলিভারি চার্জ</p>
                    <p>• ১০ থেকে ১৫ কিমি পর্যন্ত: ১৫০ টাকা ডেলিভারি চার্জ</p>
                    <p>• ১৫ কিমি এর উপরে: ২০০ টাকা ডেলিভারি চার্জ</p>
                  </div>
                </div>
              </div>
            )}

            {/* Cost Breakdown & Loyalty Summary */}
            <div className="mt-4 p-4 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-2.5">
              <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider mb-2">অর্ডার সারাংশ (Bill Summary)</h3>
              
              <div className="flex justify-between text-xs text-stone-600">
                <span>মোট খাবার ({items.reduce((acc, i) => acc + i.quantity, 0)}টি আইটেম)</span>
                <span className="font-bold text-stone-900">৳{totalPrice}</span>
              </div>

              {orderType === 'delivery' && (
                <div className="flex justify-between text-xs text-stone-600">
                  <span>ডেলিভারি চার্জ</span>
                  <span className="font-bold text-orange-700">৳{deliveryCharge}</span>
                </div>
              )}

              <div className="pt-2 border-t border-stone-200 flex justify-between items-center text-base font-black text-stone-900">
                <span>সর্বমোট পরিশোধযোগ্য</span>
                <span className="text-amber-800 text-lg">৳{total}</span>
              </div>
            </div>

            {/* WhatsApp Notification Box */}
            <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-start gap-3">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5 shadow-2xs">
                <MessageCircle size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-xs sm:text-sm">হোয়াটসঅ্যাপে অর্ডার পাঠান</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={sendWhatsApp} 
                      onChange={(e) => setSendWhatsApp(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-gray-600 mt-1">
                  অর্ডার কনফার্ম করার পর সরাসরি রেস্তোরাঁর হোয়াটসঅ্যাপে অর্ডারের বিস্তারিত রসিদ পাঠানো হবে।
                </p>
              </div>
            </div>
          </div>
        </section>
      </form>

      {/* Fixed Submit Button */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-5 z-30 pointer-events-none">
        <div className="w-full max-w-md pointer-events-auto">
          <button 
            type="submit"
            form="checkout-form"
            disabled={isSubmitting || items.length === 0}
            className="w-full bg-emerald-600 text-white rounded-2xl py-4 px-6 flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-transform hover:bg-emerald-700 font-bold text-lg disabled:opacity-50"
          >
            {isSubmitting ? (
               <span>Processing...</span>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                Confirm Order • ৳{total}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
