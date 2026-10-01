const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminQRPage.tsx', 'utf8');

const newImports = `import { useState, useRef, useEffect } from 'react';
import { Plus, Search, Download, Printer, Edit2, Trash2, QrCode, Link as LinkIcon, Eye, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Default mock data
const DEFAULT_TABLES = [
  { id: 1, name: "Table 01", capacity: 4, status: "Active" },
  { id: 2, name: "Table 02", capacity: 2, status: "Active" },
  { id: 3, name: "Table 03", capacity: 6, status: "Active" },
];`;

code = code.replace(/import { useState, useRef } from 'react';[\s\S]*?\];/, newImports);

const newComponentLogic = `export default function AdminQRPage() {
  const baseUrl = window.location.origin;
  const viewOnlyUrl = \`\${baseUrl}/?viewOnly=true\`;
  const deliveryUrl = \`\${baseUrl}/?delivery=true\`;

  const [tables, setTables] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');

  useEffect(() => {
    const savedTables = localStorage.getItem('restaurant_tables');
    if (savedTables) {
      setTables(JSON.parse(savedTables));
    } else {
      setTables(DEFAULT_TABLES);
      localStorage.setItem('restaurant_tables', JSON.stringify(DEFAULT_TABLES));
    }
  }, []);

  const saveTables = (newTables: any[]) => {
    setTables(newTables);
    localStorage.setItem('restaurant_tables', JSON.stringify(newTables));
  };

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName) return;
    
    const newId = tables.length > 0 ? Math.max(...tables.map(t => t.id)) + 1 : 1;
    const newTable = {
      id: newId,
      name: newTableName,
      capacity: parseInt(newTableCapacity) || 4,
      status: "Active"
    };
    
    saveTables([...tables, newTable]);
    setNewTableName('');
    setNewTableCapacity('4');
    setIsModalOpen(false);
  };

  const handleDeleteTable = (id: number) => {
    if(confirm("Are you sure you want to delete this table?")) {
      saveTables(tables.filter(t => t.id !== id));
    }
  };

  const downloadQR = (id: string, name: string) => {
    const svg = document.getElementById(id);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = \`QR_\${name.replace(/\\s+/g, '_')}.svg\`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };`;

code = code.replace(/export default function AdminQRPage\(\) \{[\s\S]*?img\.src = `data:image\/svg\+xml;base64,\$\{btoa\(svgData\)\}`;[\s\S]*?  };/, newComponentLogic);

// Replace MOCK_TABLES.map with tables.map
code = code.replace(/\{MOCK_TABLES\.map\(\(table\) => \{/g, '{tables.map((table) => {');

// Add onClick to Add Table button
code = code.replace(/<button className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-sm whitespace-nowrap text-sm">[\s\S]*?Add Table[\s\S]*?<\/button>/, `<button onClick={() => setIsModalOpen(true)} className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-sm whitespace-nowrap text-sm">
          <Plus size={18} />
          Add Table
        </button>`);

// Add onClick to delete button
code = code.replace(/<button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Table">/g, `<button onClick={() => handleDeleteTable(table.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Table">`);

// Add modal at the end before final div
const modalCode = `
      {/* Add Table Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">Add New Table</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 border border-gray-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddTable} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Table Name</label>
                  <input 
                    type="text" 
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="e.g. VIP Table 1"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (Persons)</label>
                  <input 
                    type="number" 
                    min="1"
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all text-sm"
                    required
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-50 rounded-xl transition-colors text-sm">
                  Cancel
                </button>
                <button type="submit" className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-gray-800 transition-colors text-sm shadow-sm">
                  Add Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;

code = code.replace(/    <\/div>\s*\);\s*\}/, modalCode);

fs.writeFileSync('src/pages/admin/AdminQRPage.tsx', code);
