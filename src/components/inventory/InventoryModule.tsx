import React, { useState } from 'react';
import { useITSM } from '../../context/ITSMContext';
import { InventoryItem } from '../../types/itsm';
import { Package, Plus, Minus, AlertTriangle, Search, CheckCircle2 } from 'lucide-react';

export const InventoryModule: React.FC = () => {
  const { inventory, updateInventoryQuantity, createInventoryItem } = useITSM();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    sku: '',
    category: 'components' as InventoryItem['category'],
    quantity: 10,
    minThreshold: 5,
    unitCost: 20,
    location: 'Depot Shelf 1'
  });

  const filteredItems = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    createInventoryItem(newItem);
    setShowAddModal(false);
    setNewItem({
      name: '',
      sku: '',
      category: 'components',
      quantity: 10,
      minThreshold: 5,
      unitCost: 20,
      location: 'Depot Shelf 1'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="text-xs font-mono text-neutral-400">IT SERVICE LOGISTICS // CONSUMABLES & STOCK</div>
          <h1 className="text-xl font-bold font-mono text-neutral-100 flex items-center gap-3">
            <span>PERIPHERALS & SPARE PARTS</span>
            <span className="text-xs font-normal text-neutral-500 tabular-nums">({inventory.length} SKUs)</span>
          </h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-xs font-mono tracking-wider bg-rose-600 text-white hover:bg-rose-500 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add SKU Item</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search SKU, name, bin location..."
            className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 pl-8 pr-3 py-1.5 focus:border-neutral-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 border border-neutral-800 bg-neutral-900/60 p-0.5">
          {['all', 'cabling', 'components', 'peripherals', 'accessories'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 uppercase tracking-wider transition-colors ${
                categoryFilter === cat ? 'bg-neutral-800 text-neutral-100 font-bold' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* High Density Inventory Data Grid */}
      <div className="border border-neutral-800 bg-neutral-950 overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-neutral-900/60 text-neutral-400 uppercase border-b border-neutral-800">
            <tr>
              <th className="p-3.5">SKU / Code</th>
              <th className="p-3.5">Item Description</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Location</th>
              <th className="p-3.5 text-right">Unit Cost</th>
              <th className="p-3.5 text-center">In Stock</th>
              <th className="p-3.5 text-center">Status</th>
              <th className="p-3.5 text-right">Quick Stock Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/80 text-neutral-200">
            {filteredItems.map(item => {
              const isLow = item.quantity <= item.minThreshold;
              return (
                <tr key={item.id} className="hover:bg-neutral-900/40 transition-colors">
                  <td className="p-3.5 font-bold text-neutral-100 whitespace-nowrap">{item.sku}</td>
                  <td className="p-3.5 max-w-xs truncate">{item.name}</td>
                  <td className="p-3.5 text-neutral-400 uppercase text-[11px]">{item.category}</td>
                  <td className="p-3.5 text-neutral-400">{item.location}</td>
                  <td className="p-3.5 text-right tabular-nums">${item.unitCost.toFixed(2)}</td>
                  <td className="p-3.5 text-center font-bold text-sm tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="p-3.5 text-center">
                    {isLow ? (
                      <span className="text-rose-500 font-bold inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>LOW</span>
                      </span>
                    ) : (
                      <span className="text-emerald-400">NOMINAL</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="inline-flex items-center gap-1 border border-neutral-800 bg-neutral-900">
                      <button
                        onClick={() => updateInventoryQuantity(item.id, -1)}
                        className="px-2 py-1 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                        title="Check out 1 unit"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => updateInventoryQuantity(item.id, 1)}
                        className="px-2 py-1 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                        title="Restock +1 unit"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => updateInventoryQuantity(item.id, 10)}
                        className="px-2 py-1 text-[11px] font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 border-l border-neutral-800"
                        title="Batch Restock +10"
                      >
                        +10
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 p-6 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <span className="text-sm font-bold text-neutral-100 uppercase">Add Consumable / Stock Item</span>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-500 hover:text-neutral-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-neutral-400 block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={newItem.name}
                  onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g. SFP-10G-LR Single-Mode Transceiver"
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">SKU Code</label>
                  <input
                    type="text"
                    value={newItem.sku}
                    onChange={e => setNewItem({ ...newItem, sku: e.target.value })}
                    placeholder="Auto-generated if blank"
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Category</label>
                  <select
                    value={newItem.category}
                    onChange={e => setNewItem({ ...newItem, category: e.target.value as any })}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  >
                    <option value="cabling">Cabling</option>
                    <option value="components">Components</option>
                    <option value="peripherals">Peripherals</option>
                    <option value="accessories">Accessories</option>
                    <option value="storage">Storage</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Initial Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={newItem.quantity}
                    onChange={e => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Min Threshold</label>
                  <input
                    type="number"
                    min="1"
                    value={newItem.minThreshold}
                    onChange={e => setNewItem({ ...newItem, minThreshold: parseInt(e.target.value) || 0 })}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Unit Cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.unitCost}
                    onChange={e => setNewItem({ ...newItem, unitCost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Storage Location / Shelf</label>
                <input
                  type="text"
                  value={newItem.location}
                  onChange={e => setNewItem({ ...newItem, location: e.target.value })}
                  placeholder="e.g. Cabinet 4, Shelf B"
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Save Stock Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
