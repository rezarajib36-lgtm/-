import React, { useState } from 'react';
import { 
  CheckCircle2, AlertTriangle, Printer, HelpCircle, 
  ChevronDown, ChevronUp, RefreshCw, Smartphone, Bluetooth, Info, Play
} from 'lucide-react';
import { BluetoothPrinterService, printViaRawBT } from '../../utils/thermalPrinter';

interface PrinterHelpProps {
  onClose?: () => void;
}

export const PrinterHelp: React.FC<PrinterHelpProps> = ({ onClose }) => {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  const checklist = [
    {
      title: "১. প্রিন্টারের পাওয়ার এবং পেপার রোল চেক করুন",
      description: "প্রিন্টারটি অন করা আছে কি না নিশ্চিত করুন। ফিড (Feed) বাটন চেপে দেখুন পেপার বের হচ্ছে কি না। পেপারটি উল্টো করে ঢোকানো হয়নি তো? (থার্মাল পেপারের একপাশেই শুধু প্রিন্ট হয়)।"
    },
    {
      title: "২. মোবাইলের ব্লুটুথ পেয়ারিং (Pairing) করুন",
      description: "আপনার মোবাইলের Bluetooth সেটিংস-এ যান এবং নতুন ডিভাইস স্ক্যান করুন। আপনার থার্মাল প্রিন্টারটি সিলেক্ট করে পেয়ার করুন। পেয়ার করার পিন কোড সাধারণত 0000 বা 1234 হয়ে থাকে।"
    },
    {
      title: "৩. প্রিন্ট সার্ভিস সক্রিয় (Active) করুন (সবচেয়ে গুরুত্বপূর্ণ)",
      description: "আপনার মোবাইলের Settings > Connection & Sharing / More Connections > Printing অপশনে যান। সেখানে RawBT Print Service বা Bluetooth Print Service ডাউনলোড করে অন (Turn ON) করে দিন।"
    },
    {
      title: "৪. ব্রাউজারে ব্লুটুথ পারমিশন চেক করুন",
      description: "গুগল ক্রোম ব্রাউজার ব্যবহার করলে নিশ্চিত করুন যে ব্রাউজারটির ব্লুটুথ এবং লোকেশন পারমিশন অন করা আছে। ক্রোম এড্রেস বারের বাম পাশের লক (Lock) আইকনে ক্লিক করে পারমিশনগুলো দেখতে ও অন করতে পারেন।"
    },
    {
      title: "৫. প্রিন্টার অ্যাপের ব্যাকগ্রাউন্ড রানিং নিশ্চিত করুন",
      description: "যদি RawBT বা কোনো থার্ড-পার্টি প্রিন্টার অ্যাপ ব্যবহার করেন, তবে সেটি মোবাইলের ব্যাকগ্রাউন্ডে চালু আছে কি না নিশ্চিত করুন।"
    }
  ];

  const toggleStep = (index: number) => {
    setActiveStep(activeStep === index ? null : index);
  };

  const handleTestPrintRawBT = () => {
    try {
      setTestStatus('testing');
      setTestMessage('RawBT অ্যাপের মাধ্যমে টেস্ট পাঠানো হচ্ছে...');
      
      // Construct a simple dummy order for testing
      const dummyOrder = {
        order_number: 'TEST-POS',
        customer_name: 'টেস্ট প্রিন্ট',
        customer_phone: '01700000000',
        order_type: 'delivery',
        location: 'পরীক্ষামূলক প্রিন্ট লোকেশন',
        created_at: new Date().toISOString(),
        items: [
          { name: 'টেস্ট আইটেম ১', price: 10, quantity: 1, variant: 'স্ট্যান্ডার্ড' }
        ],
        totalPrice: 10,
        payment_method: 'ক্যাশ অন ডেলিভারি'
      };

      const dummySettings = {
        paperWidth: '58mm' as const,
        restaurantName: 'প্রিন্টার টেস্ট পেজ',
        address: 'ঢাকা, বাংলাদেশ',
        phone: '01711111111',
        footerGreeting: 'ধন্যবাদ, আপনার প্রিন্টারটি প্রস্তুত!',
        showVat: false,
        vatPercent: 0,
        printKitchenCopy: false
      };

      printViaRawBT(dummyOrder as any, dummySettings, 'bill');
      
      setTestStatus('success');
      setTestMessage('টেস্ট প্রিন্ট সফলভাবে পাঠানো হয়েছে! যদি প্রিন্ট না হয়, তবে নিচের সমস্যা সমাধান গাইড দেখুন।');
    } catch (error: any) {
      setTestStatus('error');
      setTestMessage(`টেস্ট প্রিন্ট পাঠাতে ব্যর্থ হয়েছে: ${error.message || error}`);
    }
  };

  const handleTestPrintDirectBluetooth = async () => {
    try {
      setTestStatus('testing');
      setTestMessage('সরাসরি ব্রাউজার ব্লুটুথ কানেক্ট করার চেষ্টা করা হচ্ছে...');
      
      const btService = BluetoothPrinterService.getInstance();
      const connected = await btService.connect();
      
      if (!connected) {
        throw new Error('ব্লুটুথ ডিভাইস সিলেক্ট করা হয়নি বা কানেক্ট করতে ব্যর্থ হয়েছে।');
      }

      setTestMessage('ডিভাইস কানেক্টেড। টেস্ট পেজের ডাটা পাঠানো হচ্ছে...');
      
      // Simple ESC/POS Command bytes for testing
      const ESC = 0x1B;
      const GS = 0x1D;
      
      // ESC/POS Commands:
      const init = [ESC, 0x40]; // Initialize
      const alignCenter = [ESC, 0x61, 1]; // Center align
      const boldOn = [ESC, 0x45, 1]; // Bold on
      const boldOff = [ESC, 0x45, 0]; // Bold off
      const cut = [GS, 0x56, 66, 0]; // Cut paper
      
      const textEncoder = new TextEncoder();
      const titleBytes = textEncoder.encode("\n=== PRINTER TEST ===\n\n");
      const bodyBytes = textEncoder.encode("ESC/POS Connection: OK\nDevice is Ready for Printing.\nDate: " + new Date().toLocaleDateString() + "\n\n\n\n");
      
      const bytes = new Uint8Array([
        ...init,
        ...alignCenter,
        ...boldOn,
        ...titleBytes,
        ...boldOff,
        ...bodyBytes,
        ...cut
      ]);

      await btService.print(bytes);
      
      setTestStatus('success');
      setTestMessage('সরাসরি ব্লুটুথ টেস্ট প্রিন্ট সফল হয়েছে!');
    } catch (error: any) {
      setTestStatus('error');
      setTestMessage(error.message || 'কানেক্ট করতে পারেনি। ব্রাউজারের ব্লুটুথ অন আছে কি না নিশ্চিত করুন।');
    }
  };

  return (
    <div id="printer-help-panel" className="bg-stone-50 border border-stone-200 rounded-3xl p-5 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-stone-900 text-white rounded-2xl">
            <HelpCircle size={20} />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-base">প্রিন্টার হেল্প ও কানেকশন গাইড</h3>
            <p className="text-xs text-stone-500">মোবাইল থার্মাল প্রিন্টারে প্রিন্ট না হলে এই সমাধানগুলো চেষ্টা করুন</p>
          </div>
        </div>
        {onClose && (
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 hover:bg-stone-200 rounded-xl text-stone-500 hover:text-stone-800 transition-colors"
          >
            <ChevronUp size={20} />
          </button>
        )}
      </div>

      {/* Connection Test Panel */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200 space-y-4">
        <div className="flex items-center gap-2">
          <Printer size={16} className="text-stone-900" />
          <h4 className="font-bold text-xs text-stone-800 uppercase tracking-wider">কানেকশন টেস্ট করুন (Test Print)</h4>
        </div>
        
        <p className="text-[11px] leading-relaxed text-stone-500">
          নিচের টেস্ট বাটনগুলোতে ক্লিক করে আপনার প্রিন্টারের কানেকশন পরীক্ষা করতে পারেন। যদি রসিদ প্রিন্ট হয়, তবে বুঝতে হবে আপনার প্রিন্টারটি সম্পূর্ণ প্রস্তুত।
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleTestPrintRawBT}
            className="py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <Smartphone size={14} />
            <span>উপায় ১: RawBT টেস্ট প্রিন্ট</span>
          </button>
          
          <button
            type="button"
            onClick={handleTestPrintDirectBluetooth}
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <Bluetooth size={14} />
            <span>উপায় ২: সরাসরি ব্লুটুথ টেস্ট</span>
          </button>
        </div>

        {/* Test Result Message */}
        {testStatus !== 'idle' && (
          <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border animate-in fade-in duration-200 ${
            testStatus === 'testing' ? 'bg-amber-50 border-amber-200 text-amber-800' :
            testStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            'bg-red-50 border-red-200 text-red-800'
          }`}>
            {testStatus === 'testing' && <RefreshCw size={14} className="animate-spin shrink-0 mt-0.5" />}
            {testStatus === 'success' && <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />}
            {testStatus === 'error' && <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />}
            <span className="leading-relaxed font-medium">{testMessage}</span>
          </div>
        )}
      </div>

      {/* Troubleshooting Checklist */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-stone-900" />
          <h4 className="font-bold text-xs text-stone-800 uppercase tracking-wider">সমস্যা সমাধান চেকলিস্ট (Checklist)</h4>
        </div>

        <div className="space-y-1.5">
          {checklist.map((item, idx) => {
            const isOpen = activeStep === idx;
            return (
              <div 
                key={idx}
                className="bg-white border border-stone-200 hover:border-stone-300 rounded-xl overflow-hidden transition-all duration-200"
              >
                <button
                  type="button"
                  onClick={() => toggleStep(idx)}
                  className="w-full text-left p-3.5 flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="font-semibold text-xs text-stone-800 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-600">
                      {idx + 1}
                    </span>
                    {item.title}
                  </span>
                  {isOpen ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-0 text-[11px] leading-relaxed text-stone-600 border-t border-stone-100 bg-stone-50/50">
                    {item.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Important Tip Badge */}
      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-[11px] leading-relaxed text-amber-900 flex gap-2.5">
        <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">গুরুত্বপূর্ণ টিপস:</strong> ব্লুটুথ থার্মাল প্রিন্টারে প্রিন্ট করার সবচেয়ে সহজ ও দ্রুত মাধ্যম হলো গুগল ক্রোমের বিল্ট-ইন প্রিন্ট অপশন। তাই সবসময় ফোনে Chrome ব্রাউজার ব্যবহার করুন এবং রসিদ প্রিন্ট করার সময় "থার্মাল / ব্রাউজার প্রিন্ট" বাটনটি ব্যবহার করুন।
        </div>
      </div>
    </div>
  );
};
