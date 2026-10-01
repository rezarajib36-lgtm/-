const fs = require('fs');
let code = fs.readFileSync('src/pages/customer/CartPage.tsx', 'utf8');

const oldName = `<h3 className="font-bold text-gray-900 leading-tight">{item.name}</h3>`;
const newName = `<h3 className="font-bold text-gray-900 leading-tight">{item.name}</h3>
                      {item.variantName && (
                        <p className="text-xs text-gray-500 mt-0.5">Size/Portion: {item.variantName}</p>
                      )}`;

if (!code.includes('item.variantName')) {
  code = code.replace(oldName, newName);
  fs.writeFileSync('src/pages/customer/CartPage.tsx', code);
}
