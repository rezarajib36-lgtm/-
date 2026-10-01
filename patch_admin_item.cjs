const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminMenuPage.tsx', 'utf8');

// Also import parseDescriptionData and combineDescriptionData if not already
if (!code.includes('parseDescriptionData')) {
  code = code.replace(
    /import \{ parseDescriptionAndPortion, combineDescriptionAndPortion, parseCategoryData, combineCategoryData \} from '\.\.\/\.\.\/utils';/,
    "import { parseDescriptionData, combineDescriptionData, parseDescriptionAndPortion, combineDescriptionAndPortion, parseCategoryData, combineCategoryData } from '../../utils';"
  );
}

// Add state for portionPrices inside newItem
code = code.replace(
  /const \[newItem, setNewItem\] = useState<Partial<MenuItem>>\(\{/,
  "const [newItem, setNewItem] = useState<Partial<MenuItem> & { portionPrices?: Record<string, string> }>({\n    portionPrices: {},"
);

// addItem function
const oldAddItem = `  async function addItem() {
    if (!newItem.name || !newItem.price) {
      alert('Name and price are required');
      return;
    }
    
    const itemToInsert = {
        ...newItem,
        category_id: newItem.category_id || null
    };

    try {`;

const newAddItem = `  async function addItem() {
    const selectedCat = categories.find(c => c.id === newItem.category_id);
    const catPortions = selectedCat ? parseCategoryData(selectedCat.name).portions : [];
    
    const isMatrix = catPortions.length > 0;
    
    if (!newItem.name) {
      alert('Name is required');
      return;
    }

    if (isMatrix) {
       // Validate portion prices
       const variants = catPortions.map(p => ({
         name: p,
         price: parseFloat(newItem.portionPrices?.[p] || '0')
       }));
       if (variants.some(v => !v.price)) {
         alert('Please enter a valid price for all portions.');
         return;
       }
       
       const minPrice = Math.min(...variants.map(v => v.price));
       
       const itemToInsert = {
           name: newItem.name,
           price: minPrice,
           description: combineDescriptionData(newItem.description || '', '', variants),
           image_url: newItem.image_url,
           category_id: newItem.category_id || null,
           is_available: newItem.is_available ?? true
       };
       
       try {
         const { data, error } = await supabase.from('menu_items').insert([itemToInsert]).select();
         if (error) { handleError(error, 'add item'); return; }
         if (data) { setMenuItems([...menuItems, data[0]]); setIsAddingItem(false); setNewItem({name: '', description: '', price: 0, image_url: '', category_id: '', is_available: true, portionPrices: {}}); }
       } catch (e: any) { handleError(e, 'add item'); }
       
       return;
    }

    if (!newItem.price) {
      alert('Price is required');
      return;
    }
    
    const itemToInsert = {
        name: newItem.name,
        price: newItem.price,
        description: combineDescriptionData(newItem.description || '', '', []),
        image_url: newItem.image_url,
        category_id: newItem.category_id || null,
        is_available: newItem.is_available ?? true
    };

    try {`;

code = code.replace(oldAddItem, newAddItem);

// Remove Category options plain display and replace with parseCategoryData.name
const oldCatSelect = `<option key={cat.id} value={cat.id}>{cat.name}</option>`;
const newCatSelect = `<option key={cat.id} value={cat.id}>{parseCategoryData(cat.name).name}</option>`;
code = code.replace(oldCatSelect, newCatSelect);

fs.writeFileSync('src/pages/admin/AdminMenuPage.tsx', code);
