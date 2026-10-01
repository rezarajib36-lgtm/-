const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminMenuPage.tsx', 'utf8');

// Imports
code = code.replace(
  /import \{ parseDescriptionAndPortion, combineDescriptionAndPortion \} from '\.\.\/\.\.\/utils';/,
  "import { parseDescriptionAndPortion, combineDescriptionAndPortion, parseCategoryData, combineCategoryData } from '../../utils';"
);

// State
code = code.replace(
  /const \[newCategoryName, setNewCategoryName\] = useState\(''\);/,
  "const [newCategoryName, setNewCategoryName] = useState('');\n  const [categoryPortions, setCategoryPortions] = useState<string[]>([]);\n  const [newPortionInput, setNewPortionInput] = useState('');"
);

// addCategory
const oldAddCat = `  async function addCategory() {
    if (!newCategoryName.trim()) return;
    try {
      const { data, error } = await supabase.from('categories').insert([{ name: newCategoryName }]).select();
      if (error) {
        handleError(error, 'add category');
        return;
      }
      if (data) {
        setCategories([...categories, data[0]]);
        setNewCategoryName('');
        setIsAddingCategory(false);
      }
    } catch (error: any) {
      handleError(error, 'add category');
    }
  }`;

const newAddCat = `  async function addCategory() {
    if (!newCategoryName.trim()) return;
    const finalName = combineCategoryData(newCategoryName, categoryPortions);
    try {
      const { data, error } = await supabase.from('categories').insert([{ name: finalName }]).select();
      if (error) {
        handleError(error, 'add category');
        return;
      }
      if (data) {
        setCategories([...categories, data[0]]);
        setNewCategoryName('');
        setCategoryPortions([]);
        setIsAddingCategory(false);
      }
    } catch (error: any) {
      handleError(error, 'add category');
    }
  }`;
code = code.replace(oldAddCat, newAddCat);

// Display Categories loop
const oldCatDisplay = `                    <div className="font-medium text-gray-900">{cat.name}</div>
                    <div className="text-sm text-gray-500">{menuItems.filter(i => i.category_id === cat.id).length} items</div>`;
const newCatDisplay = `                    <div>
                      <div className="font-medium text-gray-900">{parseCategoryData(cat.name).name}</div>
                      {parseCategoryData(cat.name).portions.length > 0 && (
                        <div className="text-xs text-gray-400 mt-0.5">Portions: {parseCategoryData(cat.name).portions.join(', ')}</div>
                      )}
                      <div className="text-sm text-gray-500 mt-0.5">{menuItems.filter(i => i.category_id === cat.id).length} items</div>
                    </div>`;
code = code.replace(oldCatDisplay, newCatDisplay);

// Add Category Form
const oldCatForm = `            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
              <input 
                type="text" 
                placeholder="e.g. Burgers, Drinks" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
              />
            </div>`;
const newCatForm = `            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Chowmein, Pizza" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                />
              </div>
              
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <label className="block text-sm font-bold text-gray-900 mb-1">Portion Pricing (Optional)</label>
                <p className="text-xs text-gray-500 mb-3">If you add portions here (e.g. 1 person, 3 person), all items added to this category will automatically ask for prices for these portions.</p>
                
                <div className="flex gap-2 mb-3">
                  <input 
                    type="text" 
                    placeholder="e.g. 1 person" 
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                    value={newPortionInput}
                    onChange={e => setNewPortionInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newPortionInput.trim()) {
                        e.preventDefault();
                        if (!categoryPortions.includes(newPortionInput.trim())) {
                          setCategoryPortions([...categoryPortions, newPortionInput.trim()]);
                        }
                        setNewPortionInput('');
                      }
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (newPortionInput.trim() && !categoryPortions.includes(newPortionInput.trim())) {
                        setCategoryPortions([...categoryPortions, newPortionInput.trim()]);
                        setNewPortionInput('');
                      }
                    }}
                    className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                  >
                    Add
                  </button>
                </div>
                
                {categoryPortions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {categoryPortions.map(p => (
                      <span key={p} className="inline-flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded-md text-xs font-medium text-gray-700 shadow-sm">
                        {p}
                        <button 
                          onClick={() => setCategoryPortions(categoryPortions.filter(x => x !== p))}
                          className="text-gray-400 hover:text-red-500 ml-1"
                        ><X size={12}/></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>`;
code = code.replace(oldCatForm, newCatForm);

fs.writeFileSync('src/pages/admin/AdminMenuPage.tsx', code);
