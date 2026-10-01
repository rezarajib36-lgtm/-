const fs = require('fs');

let menuPage = fs.readFileSync('src/pages/customer/MenuPage.tsx', 'utf8');
menuPage = menuPage.replace(/import \{ useCart \} from '\.\.\/\.\.\/context\/CartContext';/, "import { useCart } from '../../context/CartContext';\\nimport { parseDescriptionData } from '../../utils';");
menuPage = menuPage.replace(/\{item\.description\}/g, "{parseDescriptionData(item.description).description}");
fs.writeFileSync('src/pages/customer/MenuPage.tsx', menuPage);

let modal = fs.readFileSync('src/components/customer/FoodDetailsModal.tsx', 'utf8');
modal = modal.replace(/import \{ useCart \} from '\.\.\/\.\.\/context\/CartContext';/, "import { useCart } from '../../context/CartContext';\\nimport { parseDescriptionData } from '../../utils';");
modal = modal.replace(/\{item\.description\}/g, "{parseDescriptionData(item.description).description}");
fs.writeFileSync('src/components/customer/FoodDetailsModal.tsx', modal);

