const fs = require('fs');
let code = fs.readFileSync('src/context/CartContext.tsx', 'utf8');

if (!code.includes('variantName?: string;')) {
  code = code.replace(/  instruction\?: string;/, "  instruction?: string;\n  variantName?: string;");
}

const oldGroupCheck = `    const existingIndex = items.findIndex(
      (item) => item.menuItemId === newItem.menuItemId && item.instruction === newItem.instruction
    );`;

const newGroupCheck = `    const existingIndex = items.findIndex(
      (item) => item.menuItemId === newItem.menuItemId && 
                item.instruction === newItem.instruction &&
                item.variantName === newItem.variantName
    );`;

if (code.includes(oldGroupCheck)) {
  code = code.replace(oldGroupCheck, newGroupCheck);
}

fs.writeFileSync('src/context/CartContext.tsx', code);
