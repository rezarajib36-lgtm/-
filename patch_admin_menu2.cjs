const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminMenuPage.tsx', 'utf8');

if(!code.includes('../../utils')) {
  code = code.replace(/import \{ supabase \} from '\.\.\/\.\.\/lib\/supabase';/, "import { supabase } from '../../lib/supabase';\\nimport { parseDescriptionAndPortion, combineDescriptionAndPortion } from '../../utils';");
}

code = code.replace(/const \[newItem, setNewItem\] = useState<Partial<MenuItem>>\(\{/, "const [newItem, setNewItem] = useState<Partial<MenuItem> & { portion?: string }>({");
code = code.replace(/name: '', description: '', price: 0, image_url: '', category_id: '', is_available: true/, "name: '', description: '', price: 0, image_url: '', category_id: '', is_available: true, portion: ''");

const oldAddItem = `    const itemToInsert = {
        ...newItem,
        category_id: newItem.category_id || null
    };`;
const newAddItem = `    const itemToInsert = {
        ...newItem,
        description: combineDescriptionAndPortion(newItem.description || '', newItem.portion || ''),
        category_id: newItem.category_id || null
    };
    delete itemToInsert.portion;`;
code = code.replace(oldAddItem, newAddItem);

const oldPriceCat = `                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (৳) *</label>
                  <input 
                    type="number" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-gray-900"
                    value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:border-gray-900"
                    value={newItem.category_id} onChange={e => setNewItem({...newItem, category_id: e.target.value})}
                  >
                    <option value="">Select...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>`;

const newPriceCat = `                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (৳) *</label>
                  <input 
                    type="number" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-gray-900"
                    value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:border-gray-900"
                    value={newItem.category_id} onChange={e => setNewItem({...newItem, category_id: e.target.value})}
                  >
                    <option value="">Select...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Portion / Serves (e.g. 1 pc, 2 person)</label>
                  <input 
                    type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-gray-900"
                    value={newItem.portion || ''} onChange={e => setNewItem({...newItem, portion: e.target.value})}
                    placeholder="Optional"
                  />
                </div>`;

code = code.replace(oldPriceCat, newPriceCat);

const oldDescTh = `<th className="py-4 px-6 font-medium">Description</th>`;
const newDescTh = `<th className="py-4 px-6 font-medium">Details</th>`;
code = code.replace(oldDescTh, newDescTh);

const oldDescTd = `<td className="py-3 px-6">
                      <p className="text-sm text-gray-600 line-clamp-2 max-w-xs">{food.description}</p>
                    </td>`;
const newDescTd = `<td className="py-3 px-6 text-sm text-gray-600">
                      <p className="line-clamp-1 max-w-xs">{parseDescriptionAndPortion(food.description).description}</p>
                      {parseDescriptionAndPortion(food.description).portion && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {parseDescriptionAndPortion(food.description).portion}
                        </span>
                      )}
                    </td>`;
code = code.replace(oldDescTd, newDescTd);

fs.writeFileSync('src/pages/admin/AdminMenuPage.tsx', code);
