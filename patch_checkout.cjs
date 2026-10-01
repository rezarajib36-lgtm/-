const fs = require('fs');
let code = fs.readFileSync('src/pages/customer/CheckoutPage.tsx', 'utf8');

const newInit = `
  const { cartItems, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'delivery'>('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read mode from session
  const orderMode = typeof window !== 'undefined' ? sessionStorage.getItem('orderMode') : null;
  const isForcedDelivery = orderMode === 'delivery';
  const forcedTable = orderMode?.startsWith('table_') ? orderMode.split('_')[1] : null;

  useEffect(() => {
    if (isForcedDelivery) {
      setOrderType('delivery');
    } else if (forcedTable) {
      setOrderType('dine_in');
      setTableNumber(forcedTable);
    }
  }, [isForcedDelivery, forcedTable]);
`;

code = code.replace(/const { cartItems, totalPrice, clearCart } = useCart\(\);[\s\S]*?const \[isSubmitting, setIsSubmitting\] = useState\(false\);/, newInit);

const newToggle = `{/* Order Type Toggle */}
          {!isForcedDelivery && !forcedTable && (
          <div className="bg-gray-100 p-1 rounded-xl flex mb-6">
            <button 
              type="button"
              onClick={() => setOrderType('dine_in')}
              className={\`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all \${
                orderType === 'dine_in' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }\`}
            >
              Dine-in
            </button>
            <button 
              type="button"
              onClick={() => setOrderType('delivery')}
              className={\`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all \${
                orderType === 'delivery' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }\`}
            >
              Delivery
            </button>
          </div>
          )}
          
          {/* Readonly info for forced modes */}
          {(isForcedDelivery || forcedTable) && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500 font-medium">Order Type</span>
              <span className="text-sm font-bold text-gray-900">
                {isForcedDelivery ? 'Home Delivery' : \`Dine-in (Table \${forcedTable})\`}
              </span>
            </div>
          )}`;

code = code.replace(/{\/\* Order Type Toggle \*\/}[\s\S]*?<\/div>/, newToggle);

const newTableInput = `            {/* Table Number (hidden if forced) */}
            {orderType === 'dine_in' && !forcedTable && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Table Number</label>
                <input 
                  type="text" 
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                  required
                />
              </div>
            )}`;
code = code.replace(/{\/\* Table Number \*\/}[\s\S]*?<\/div>\s*<\/div>/, newTableInput);


fs.writeFileSync('src/pages/customer/CheckoutPage.tsx', code);
