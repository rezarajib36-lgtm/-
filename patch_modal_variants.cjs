const fs = require('fs');
let code = fs.readFileSync('src/components/customer/FoodDetailsModal.tsx', 'utf8');

// Ensure parseDescriptionData is imported
if (!code.includes('parseDescriptionData')) {
  code = code.replace(
    /import \{ useCart \} from '\.\.\/\.\.\/context\/CartContext';/,
    "import { useCart } from '../../context/CartContext';\\nimport { parseDescriptionData } from '../../utils';"
  );
}

// Add state for selectedVariant
code = code.replace(
  /const \[instruction, setInstruction\] = useState\(''\);/,
  "const [instruction, setInstruction] = useState('');\n  const [selectedVariant, setSelectedVariant] = useState<any>(null);"
);

// Reset selectedVariant on open
const oldEffect = `  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setInstruction('');
    }
  }, [isOpen, item]);`;
const newEffect = `  useEffect(() => {
    if (isOpen && item) {
      setQuantity(1);
      setInstruction('');
      const variants = parseDescriptionData(item.description).variants;
      if (variants && variants.length > 0) {
        setSelectedVariant(variants[0]);
      } else {
        setSelectedVariant(null);
      }
    }
  }, [isOpen, item]);`;
code = code.replace(oldEffect, newEffect);

// Update totalPrice calculation
code = code.replace(
  /const totalPrice = item\.price \* quantity;/,
  "const currentPrice = selectedVariant ? selectedVariant.price : item.price;\n  const totalPrice = currentPrice * quantity;"
);

// Update handleAddToCart
const oldAddToCart = `    addToCart({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      image: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=500&auto=format&fit=crop',
      quantity,
      instruction: instruction.trim() || undefined
    });`;
const newAddToCart = `    addToCart({
      menuItemId: item.id,
      name: selectedVariant ? \`\${item.name} (\${selectedVariant.name})\` : item.name,
      price: currentPrice,
      image: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=500&auto=format&fit=crop',
      quantity,
      instruction: instruction.trim() || undefined,
      variantName: selectedVariant?.name
    });`;
code = code.replace(oldAddToCart, newAddToCart);

// Update Header to show variants
const oldHeader = `          <div>
            <div className="flex justify-between items-start gap-4">
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">{item.name}</h2>
              <span className="text-xl font-bold text-gray-900 shrink-0">৳{item.price}</span>
            </div>
            <p className="text-gray-500 mt-2 leading-relaxed">{parseDescriptionData(item.description).description}</p>
          </div>

          <hr className="border-gray-100" />`;
const newHeader = `          <div>
            <div className="flex justify-between items-start gap-4">
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">{item.name}</h2>
              <span className="text-xl font-bold text-gray-900 shrink-0">৳{currentPrice}</span>
            </div>
            <p className="text-gray-500 mt-2 leading-relaxed">{parseDescriptionData(item.description).description}</p>
          </div>

          {parseDescriptionData(item.description).variants?.length > 0 && (
            <>
              <hr className="border-gray-100" />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900 text-lg">Select Portion / Size</h3>
                  <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">Required</span>
                </div>
                <div className="space-y-2">
                  {parseDescriptionData(item.description).variants.map((v:any, idx:number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedVariant(v)}
                      className={\`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all \${selectedVariant?.name === v.name ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-200'}\`}
                    >
                      <span className={\`font-medium \${selectedVariant?.name === v.name ? 'text-gray-900' : 'text-gray-700'}\`}>{v.name}</span>
                      <span className={\`font-bold \${selectedVariant?.name === v.name ? 'text-gray-900' : 'text-gray-500'}\`}>৳{v.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <hr className="border-gray-100" />`;
code = code.replace(oldHeader, newHeader);

fs.writeFileSync('src/components/customer/FoodDetailsModal.tsx', code);
