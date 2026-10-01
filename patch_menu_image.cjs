const fs = require('fs');
let code = fs.readFileSync('src/pages/customer/MenuPage.tsx', 'utf8');

const oldFoodInfo = `                        {/* Food Info */}
                        <div 
                           className="flex-1 pr-4 cursor-pointer"
                           onClick={() => setSelectedFoodObj({ item })}
                        >
                          <h3 className="font-bold text-orange-400 text-base">{item.name}</h3>
                          <p className="text-gray-300 text-[11px] sm:text-xs mt-1.5 leading-relaxed line-clamp-2">{parsedData.description}</p>
                          {parsedData.portion && (
                             <span className="inline-block mt-2 px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-[10px] font-medium border border-gray-700">
                               {parsedData.portion}
                             </span>
                          )}
                        </div>`;

const newFoodInfo = `                        {/* Food Info */}
                        <div 
                           className="flex-1 pr-4 cursor-pointer flex items-center gap-4"
                           onClick={() => setSelectedFoodObj({ item })}
                        >
                          {/* Image */}
                          <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
                            <img src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=500&auto=format&fit=crop'} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          {/* Text */}
                          <div>
                            <h3 className="font-bold text-orange-400 text-base">{item.name}</h3>
                            <p className="text-gray-300 text-[11px] sm:text-xs mt-1.5 leading-relaxed line-clamp-2">{parsedData.description}</p>
                            {parsedData.portion && (
                               <span className="inline-block mt-2 px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-[10px] font-medium border border-gray-700">
                                 {parsedData.portion}
                               </span>
                            )}
                          </div>
                        </div>`;

code = code.replace(oldFoodInfo, newFoodInfo);
fs.writeFileSync('src/pages/customer/MenuPage.tsx', code);
