const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminSettingsPage.tsx', 'utf8');

const newUploadLogic = `  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'logo' | 'coverImage') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, [fieldName]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {`;

code = code.replace(/  const handleSave = \(\) => \{/, newUploadLogic);


const oldImagesSection = `          {/* Images */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <ImageIcon className="text-gray-400" size={20} />
              <h2 className="text-lg font-bold text-gray-900">Images</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input 
                  type="text" 
                  name="logo"
                  value={settings.logo}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL</label>
                <input 
                  type="text" 
                  name="coverImage"
                  value={settings.coverImage}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all text-sm"
                />
              </div>
            </div>
          </div>`;

const newImagesSection = `          {/* Images */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <ImageIcon className="text-gray-400" size={20} />
              <h2 className="text-lg font-bold text-gray-900">Images</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200 shrink-0 bg-gray-50">
                    <img src={settings.logo} alt="Logo Preview" className="w-full h-full object-cover" />
                  </div>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'logo')}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition-all cursor-pointer"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Cover Image</label>
                <div className="flex flex-col gap-3">
                  <div className="w-full h-32 rounded-xl overflow-hidden border border-gray-200 shrink-0 bg-gray-50">
                    <img src={settings.coverImage} alt="Cover Preview" className="w-full h-full object-cover" />
                  </div>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'coverImage')}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition-all cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>`;

code = code.replace(oldImagesSection, newImagesSection);

fs.writeFileSync('src/pages/admin/AdminSettingsPage.tsx', code);
