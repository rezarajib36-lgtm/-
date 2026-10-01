const fs = require('fs');
let code = fs.readFileSync('src/pages/customer/MenuPage.tsx', 'utf8');

if (!code.includes('../../utils')) {
  code = code.replace(/import \{ motion, AnimatePresence \} from 'framer-motion';/, "import { motion, AnimatePresence } from 'framer-motion';\\nimport { parseDescriptionAndPortion } from '../../utils';");
}

const oldDesc = `<p className="text-gray-500 text-sm mt-1 line-clamp-2 leading-relaxed">{item.description}</p>`;
const newDesc = `<p className="text-gray-500 text-sm mt-1 line-clamp-2 leading-relaxed">{parseDescriptionAndPortion(item.description).description}</p>
                {parseDescriptionAndPortion(item.description).portion && (
                  <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                    {parseDescriptionAndPortion(item.description).portion}
                  </div>
                )}`;
code = code.replace(oldDesc, newDesc);

fs.writeFileSync('src/pages/customer/MenuPage.tsx', code);
