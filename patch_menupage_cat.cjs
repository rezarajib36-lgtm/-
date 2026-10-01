const fs = require('fs');
let code = fs.readFileSync('src/pages/customer/MenuPage.tsx', 'utf8');

// Ensure parseCategoryData is imported
if (!code.includes('parseCategoryData')) {
  code = code.replace(
    /import \{ parseDescriptionData \} from '\.\.\/\.\.\/utils';/,
    "import { parseDescriptionData, parseCategoryData } from '../../utils';"
  );
}

// Fix CATEGORY_NAMES
code = code.replace(
  /const CATEGORY_NAMES = \["All", \.\.\.categories\.map\(c => c\.name\)\];/,
  "const CATEGORY_NAMES = [\"All\", ...categories.map(c => parseCategoryData(c.name).name)];"
);

// Fix filtering logic
code = code.replace(
  /const cat = categories\.find\(c => c\.name === activeCategory\);/,
  "const cat = categories.find(c => parseCategoryData(c.name).name === activeCategory);"
);

// Fix price display on menu items to show "From X" if it has variants
const oldPriceDisplay = `<div className="mt-3 font-bold text-gray-900">
                  ৳{item.price}
                </div>`;
const newPriceDisplay = `<div className="mt-3 font-bold text-gray-900">
                  {parseDescriptionData(item.description).variants?.length > 0 ? (
                    <span className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 font-medium">From</span>
                      <span>৳{Math.min(...parseDescriptionData(item.description).variants.map((v:any) => v.price))}</span>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded ml-1 border border-blue-100">{parseDescriptionData(item.description).variants.length} Sizes</span>
                    </span>
                  ) : (
                    <span>৳{item.price}</span>
                  )}
                </div>`;
code = code.replace(oldPriceDisplay, newPriceDisplay);

fs.writeFileSync('src/pages/customer/MenuPage.tsx', code);
