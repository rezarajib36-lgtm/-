const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminMenuPage.tsx', 'utf8');

// I need to find the specific fields in the modal.
const priceField = `<div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (৳) *</label>
                  <input 
                    type="number" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-gray-900"
                    value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})}
                  />
                </div>`;

// We inject a logic check before the price field to see if the selected category has portions
const newPriceField = `
                {(() => {
                   const selectedCat = categories.find(c => c.id === newItem.category_id);
                   const catPortions = selectedCat ? parseCategoryData(selectedCat.name).portions : [];
                   
                   if (catPortions.length > 0) {
                     return (
                       <div className="col-span-2 border border-gray-200 rounded-xl p-4 bg-gray-50 mb-2">
                         <label className="block text-sm font-bold text-gray-900 mb-3">Portion Prices (৳) *</label>
                         <div className="grid grid-cols-2 gap-4">
                           {catPortions.map(portion => (
                             <div key={portion}>
                               <label className="block text-xs font-medium text-gray-600 mb-1">{portion}</label>
                               <input 
                                 type="number" 
                                 placeholder="Price"
                                 className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-gray-900 text-sm"
                                 value={newItem.portionPrices?.[portion] || ''} 
                                 onChange={e => setNewItem({
                                   ...newItem, 
                                   portionPrices: { ...(newItem.portionPrices || {}), [portion]: e.target.value }
                                 })}
                               />
                             </div>
                           ))}
                         </div>
                       </div>
                     );
                   }
                   
                   return (
                     <div className="col-span-1">
                       <label className="block text-sm font-medium text-gray-700 mb-1">Price (৳) *</label>
                       <input 
                         type="number" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-gray-900"
                         value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})}
                       />
                     </div>
                   );
                })()}
`;

code = code.replace(priceField, newPriceField);

fs.writeFileSync('src/pages/admin/AdminMenuPage.tsx', code);
