const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminMenuPage.tsx', 'utf8');

// Imports
code = code.replace(/import \{ parseDescriptionAndPortion, combineDescriptionAndPortion \} from '\.\.\/\.\.\/utils';/, "import { parseDescriptionData, combineDescriptionData } from '../../utils';");

// State
code = code.replace(/const \[newItem, setNewItem\] = useState<Partial<MenuItem> & \{ portion\?: string \}>\(\{/, "const [newItem, setNewItem] = useState<Partial<MenuItem> & { portion?: string, variants?: {name: string, price: number}[] }>({");
code = code.replace(/name: '', description: '', price: 0, image_url: '', category_id: '', is_available: true, portion: ''/, "name: '', description: '', price: 0, image_url: '', category_id: '', is_available: true, portion: '', variants: []");

// addItem
const oldAddItem = `    const itemToInsert = {
        ...newItem,
        description: combineDescriptionAndPortion(newItem.description || '', newItem.portion || ''),
        category_id: newItem.category_id || null
    };
    delete itemToInsert.portion;`;
const newAddItem = `    // If there are variants, price might be 0, so let's allow it if there are variants
    if (!newItem.name || (!newItem.price && (!newItem.variants || newItem.variants.length === 0))) {
      alert('Name and base price (or variants) are required');
      return;
    }

    const itemToInsert = {
        ...newItem,
        description: combineDescriptionData(newItem.description || '', newItem.portion || '', newItem.variants || []),
        category_id: newItem.category_id || null
    };
    delete itemToInsert.portion;
    delete itemToInsert.variants;`;
code = code.replace(oldAddItem, newAddItem);
// Also remove the old validation at the top of addItem
code = code.replace(/    if \(!newItem\.name \|\| !newItem\.price\) \{\s*alert\('Name and price are required'\);\s*return;\s*\}/, "");


// Update Add Item Form Variants Section
const oldPortionDiv = `                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Portion / Serves (e.g. 1 pc, 2 person)</label>
                  <input 
                    type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-gray-900"
                    value={newItem.portion || ''} onChange={e => setNewItem({...newItem, portion: e.target.value})}
                    placeholder="Optional"
                  />
                </div>`;

const newPortionDiv = `                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Portion / Serves (e.g. 1 pc, 2 person)</label>
                  <input 
                    type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-gray-900"
                    value={newItem.portion || ''} onChange={e => setNewItem({...newItem, portion: e.target.value})}
                    placeholder="Optional"
                  />
                </div>
                
                {/* Variants Section */}
                <div className="col-span-2 border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-900">Size / Variants (Optional)</label>
                      <p className="text-xs text-gray-500">e.g. 6 inch, 10 inch, 12 inch</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNewItem({...newItem, variants: [...(newItem.variants || []), {name: '', price: 0}]})}
                      className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 transition-colors"
                    >
                      <Plus size={14} /> Add Variant
                    </button>
                  </div>
                  
                  {newItem.variants && newItem.variants.length > 0 && (
                    <div className="space-y-3">
                      {newItem.variants.map((variant, index) => (
                        <div key={index} className="flex gap-3 items-start">
                          <div className="flex-1">
                            <input 
                              type="text" 
                              placeholder="Variant Name (e.g. 10 inch)"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-gray-900 text-sm"
                              value={variant.name}
                              onChange={(e) => {
                                const newVariants = [...(newItem.variants || [])];
                                newVariants[index].name = e.target.value;
                                setNewItem({...newItem, variants: newVariants});
                              }}
                            />
                          </div>
                          <div className="w-32">
                            <input 
                              type="number" 
                              placeholder="Price"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-gray-900 text-sm"
                              value={variant.price || ''}
                              onChange={(e) => {
                                const newVariants = [...(newItem.variants || [])];
                                newVariants[index].price = parseFloat(e.target.value) || 0;
                                setNewItem({...newItem, variants: newVariants});
                              }}
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                                const newVariants = [...(newItem.variants || [])];
                                newVariants.splice(index, 1);
                                setNewItem({...newItem, variants: newVariants});
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>`;
code = code.replace(oldPortionDiv, newPortionDiv);

// List table description display
const oldListDesc = `                      <p className="line-clamp-1 max-w-xs">{parseDescriptionAndPortion(food.description).description}</p>
                      {parseDescriptionAndPortion(food.description).portion && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {parseDescriptionAndPortion(food.description).portion}
                        </span>
                      )}`;
const newListDesc = `                      <p className="line-clamp-1 max-w-xs">{parseDescriptionData(food.description).description}</p>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {parseDescriptionData(food.description).portion && (
                          <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200">
                            {parseDescriptionData(food.description).portion}
                          </span>
                        )}
                        {parseDescriptionData(food.description).variants?.length > 0 && (
                          <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium border border-blue-100">
                            {parseDescriptionData(food.description).variants.length} Variants
                          </span>
                        )}
                      </div>`;
code = code.replace(oldListDesc, newListDesc);

const oldPriceList = `<td className="py-4 px-6 font-medium text-gray-900">৳{food.price}</td>`;
const newPriceList = `<td className="py-4 px-6 text-gray-900">
                      {parseDescriptionData(food.description).variants?.length > 0 ? (
                        <div>
                          <span className="text-xs text-gray-500">From </span>
                          <span className="font-bold">৳{Math.min(...parseDescriptionData(food.description).variants.map((v:any) => v.price))}</span>
                        </div>
                      ) : (
                        <span className="font-bold">৳{food.price}</span>
                      )}
                    </td>`;
code = code.replace(oldPriceList, newPriceList);

fs.writeFileSync('src/pages/admin/AdminMenuPage.tsx', code);
