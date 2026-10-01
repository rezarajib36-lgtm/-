const fs = require('fs');
let code = fs.readFileSync('src/pages/customer/MenuPage.tsx', 'utf8');

code = code.replace(/import \{ parseDescriptionAndPortion \} from '\.\.\/\.\.\/utils';/, "import { parseDescriptionData } from '../../utils';");

const oldDesc = `<p className="text-gray-500 text-sm mt-1 line-clamp-2 leading-relaxed">{parseDescriptionAndPortion(item.description).description}</p>
                {parseDescriptionAndPortion(item.description).portion && (
                  <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                    {parseDescriptionAndPortion(item.description).portion}
                  </div>
                )}`;
const newDesc = `<p className="text-gray-500 text-sm mt-1 line-clamp-2 leading-relaxed">{parseDescriptionData(item.description).description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {parseDescriptionData(item.description).portion && (
                    <div className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                      {parseDescriptionData(item.description).portion}
                    </div>
                  )}
                  {parseDescriptionData(item.description).variants?.length > 0 && (
                    <div className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                      {parseDescriptionData(item.description).variants.length} Sizes Available
                    </div>
                  )}
                </div>`;
code = code.replace(oldDesc, newDesc);

const oldPrice = `<div className="mt-3 font-bold text-gray-900">
                  ৳{item.price}
                </div>`;
const newPrice = `<div className="mt-3 font-bold text-gray-900 flex items-baseline gap-1">
                  {parseDescriptionData(item.description).variants?.length > 0 ? (
                    <>
                      <span className="text-xs font-medium text-gray-500">From</span>
                      <span>৳{Math.min(...parseDescriptionData(item.description).variants.map((v:any) => v.price))}</span>
                    </>
                  ) : (
                    <span>৳{item.price}</span>
                  )}
                </div>`;
code = code.replace(oldPrice, newPrice);

fs.writeFileSync('src/pages/customer/MenuPage.tsx', code);
