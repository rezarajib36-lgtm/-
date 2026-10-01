const fs = require('fs');

// --- 1. Update FoodDetailsModal.tsx ---
let modalCode = fs.readFileSync('src/components/customer/FoodDetailsModal.tsx', 'utf8');

modalCode = modalCode.replace(
  /interface FoodDetailsModalProps \{[\s\S]*?item: any;\s*\}/,
  `interface FoodDetailsModalProps {\n  isOpen: boolean;\n  onClose: () => void;\n  item: any;\n  initialVariantName?: string;\n}`
);

modalCode = modalCode.replace(
  /export default function FoodDetailsModal\(\{ isOpen, onClose, item \}: FoodDetailsModalProps\) \{/,
  `export default function FoodDetailsModal({ isOpen, onClose, item, initialVariantName }: FoodDetailsModalProps) {`
);

const oldModalEffect = `  useEffect(() => {
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

const newModalEffect = `  useEffect(() => {
    if (isOpen && item) {
      setQuantity(1);
      setInstruction('');
      const variants = parseDescriptionData(item.description).variants;
      if (variants && variants.length > 0) {
        if (initialVariantName) {
           setSelectedVariant(variants.find((v:any) => v.name === initialVariantName) || variants[0]);
        } else {
           setSelectedVariant(variants[0]);
        }
      } else {
        setSelectedVariant(null);
      }
    }
  }, [isOpen, item, initialVariantName]);`;

modalCode = modalCode.replace(oldModalEffect, newModalEffect);
fs.writeFileSync('src/components/customer/FoodDetailsModal.tsx', modalCode);

// --- 2. Update MenuPage.tsx ---
let menuCode = fs.readFileSync('src/pages/customer/MenuPage.tsx', 'utf8');

// Change state
menuCode = menuCode.replace(
  /const \[selectedFood, setSelectedFood\] = useState<any>\(null\);/,
  `const [selectedFoodObj, setSelectedFoodObj] = useState<{item: any, variantName?: string} | null>(null);`
);

const oldModalJSX = `<FoodDetailsModal 
        isOpen={!!selectedFood} 
        item={selectedFood} 
        onClose={() => setSelectedFood(null)} 
      />`;
const newModalJSX = `<FoodDetailsModal 
        isOpen={!!selectedFoodObj} 
        item={selectedFoodObj?.item} 
        initialVariantName={selectedFoodObj?.variantName}
        onClose={() => setSelectedFoodObj(null)} 
      />`;
menuCode = menuCode.replace(oldModalJSX, newModalJSX);

// Replace the list section
const oldListRegex = /\{\/\* 4\. Food Items List \*\/\}([\s\S]*?)\{\/\* 5\. Floating Cart Bottom Bar/;

const newListJSX = `{/* 4. Food Items Tabular List (Menu Style) */}
      <div className="px-5 py-6 flex flex-col gap-0">
        {loading ? (
           <div className="text-center py-10 text-gray-400">Loading menu items...</div>
        ) : filteredItems.length > 0 ? (
          (() => {
            // Extract variant headers for the current category
            const variantHeaders = Array.from(new Set(
              filteredItems.flatMap(item => {
                const v = parseDescriptionData(item.description).variants;
                return v ? v.map((variant: any) => variant.name) : [];
              })
            ));

            return (
              <div className="bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-800">
                {/* Table Header (only if variants exist) */}
                {variantHeaders.length > 0 && (
                  <div className="flex justify-between items-end border-b border-gray-700 bg-gray-900/50 px-4 py-3">
                    <div className="text-gray-400 font-medium text-[11px] uppercase tracking-wider">Item Details</div>
                    <div className="flex gap-2 sm:gap-4 justify-end">
                      {variantHeaders.map(header => (
                        <div key={header} className="w-12 sm:w-16 text-center text-orange-400 font-bold text-xs">{header}</div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Table Body */}
                <div className="divide-y divide-gray-800/60">
                  {filteredItems.map(item => {
                    const parsedData = parseDescriptionData(item.description);
                    const variants = parsedData.variants || [];
                    
                    return (
                      <div 
                        key={item.id} 
                        className="flex justify-between items-center p-4 hover:bg-gray-800/50 transition-colors group"
                      >
                        {/* Food Info */}
                        <div 
                           className="flex-1 pr-4 cursor-pointer"
                           onClick={() => setSelectedFoodObj({ item })}
                        >
                          <h3 className="font-bold text-orange-400 text-base">{item.name}</h3>
                          <p className="text-gray-300 text-[11px] sm:text-xs mt-1.5 leading-relaxed line-clamp-2">{parsedData.description}</p>
                          {parsedData.portion && (
                             <span className="inline-block mt-2 px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-[10px] font-medium border border-gray-700">
                               {parsedData.portion}
                             </span>
                          )}
                        </div>
                        
                        {/* Prices / Variants */}
                        {variantHeaders.length > 0 ? (
                          <div className="flex gap-2 sm:gap-4 justify-end shrink-0">
                            {variantHeaders.map(header => {
                              const variant = variants.find((v:any) => v.name === header);
                              return (
                                <div key={header} className="w-12 sm:w-16 flex justify-center">
                                  {variant ? (
                                    <button 
                                      onClick={() => setSelectedFoodObj({ item, variantName: header })}
                                      className="font-bold text-white text-sm sm:text-base hover:text-orange-400 transition-colors p-2 -m-2"
                                    >
                                      {variant.price}
                                    </button>
                                  ) : (
                                    <span className="text-gray-600">-</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="shrink-0 flex items-center gap-3">
                            <span className="font-bold text-white text-base">৳{item.price}</span>
                            {!effectiveViewOnly && (
                              <button 
                                onClick={() => setSelectedFoodObj({ item })}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors"
                              >
                                <Plus size={16} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="text-center py-10 text-gray-400">
            <p>No items found in this category.</p>
          </div>
        )}
      </div>

      {/* 5. Floating Cart Bottom Bar`;

menuCode = menuCode.replace(oldListRegex, newListJSX);

fs.writeFileSync('src/pages/customer/MenuPage.tsx', menuCode);
