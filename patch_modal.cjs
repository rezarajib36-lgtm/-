const fs = require('fs');
let code = fs.readFileSync('src/components/customer/FoodDetailsModal.tsx', 'utf8');

if(!code.includes('../../utils')) {
  code = code.replace(/import \{ motion, AnimatePresence \} from 'framer-motion';/, "import { motion, AnimatePresence } from 'framer-motion';\\nimport { parseDescriptionAndPortion } from '../../utils';");
}

const oldPrice = `<div className="mt-4 font-bold text-3xl text-gray-900">৳{item.price}</div>`;
const newPrice = `<div className="mt-4 flex items-end gap-3">
              <div className="font-bold text-3xl text-gray-900">৳{item.price}</div>
              {parseDescriptionAndPortion(item.description).portion && (
                <div className="mb-1 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">
                  {parseDescriptionAndPortion(item.description).portion}
                </div>
              )}
            </div>`;
code = code.replace(oldPrice, newPrice);

const oldDesc = `<p className="text-gray-500 mt-2 leading-relaxed">{item.description}</p>`;
const newDesc = `<p className="text-gray-500 mt-2 leading-relaxed">{parseDescriptionAndPortion(item.description).description}</p>`;
code = code.replace(oldDesc, newDesc);

fs.writeFileSync('src/components/customer/FoodDetailsModal.tsx', code);
