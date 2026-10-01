const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminMenuPage.tsx', 'utf8');

// Add import
code = code.replace(/import \{ supabase \} from '\.\.\/\.\.\/lib\/supabase';/, "import { supabase } from '../../lib/supabase';\\nimport { parseDescriptionAndPortion, combineDescriptionAndPortion } from '../../utils';");

// Add portion to newItem
code = code.replace(/const \[newItem, setNewItem\] = useState<Partial<MenuItem>>\(\{/, "const [newItem, setNewItem] = useState<Partial<MenuItem> & { portion?: string }>({");
code = code.replace(/name: '', description: '', price: 0, image_url: '', category_id: '', is_available: true/, "name: '', description: '', price: 0, image_url: '', category_id: '', is_available: true, portion: ''");

// Update addItem
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

// Add input field for portion
const oldInput = `                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>`;
const newInput = `                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Portion / Serves / Pieces (Optional)</label>
                    <input 
                      type="text" 
                      value={newItem.portion || ''}
                      onChange={(e) => setNewItem({ ...newItem, portion: e.target.value })}
                      placeholder="e.g. 2 pieces, Serves 2, 500g"
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select 
                      value={newItem.category_id}
                      onChange={(e) => setNewItem({ ...newItem, category_id: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all text-sm appearance-none"
                    >
                      <option value="" disabled>Select category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>`;
code = code.replace(oldInput, newInput);

// Remove the old Category dropdown because we moved it next to portion to save space
const oldCategoryDiv = `                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select 
                    value={newItem.category_id}
                    onChange={(e) => setNewItem({ ...newItem, category_id: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all text-sm appearance-none"
                  >
                    <option value="" disabled>Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>`;
// Replace the NEXT occurrence of oldCategoryDiv with empty string, after our new input.
// Wait, replacing precisely might fail if I don't use a regex or specific replace.
// Let's do it carefully.
