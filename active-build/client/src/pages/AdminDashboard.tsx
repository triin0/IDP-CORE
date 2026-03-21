import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminTable } from '../hooks/useAdminTable';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { PageWrapper } from '../components/PageWrapper';
import { titleCase } from '../lib/utils';
import { Plus, Edit, Trash2, Search } from 'lucide-react';

const tableNames = ['users', 'events', 'rsvps'];

export function AdminDashboard() {
  const [selectedTable, setSelectedTable] = useState(tableNames[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const { data, isLoading, error, createItem, updateItem, deleteItem } = useAdminTable<any>(selectedTable);

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    return data.filter(item =>
      Object.values(item).some(value =>
        String(value).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [data, searchQuery]);

  const columns = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  const handleAddNew = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      await deleteItem(id);
    }
  };

  const handleSave = async (formData: any) => {
    if (editingItem) {
      await updateItem(editingItem.id, formData);
    } else {
      await createItem(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <PageWrapper>
      <div className="flex gap-8">
        <aside className="w-48 flex-shrink-0">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Tables</h3>
          <ul className="space-y-2">
            {tableNames.map(name => (
              <li key={name}>
                <button
                  onClick={() => setSelectedTable(name)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedTable === name ? 'bg-indigo-500/15 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}>
                  {titleCase(name)}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input 
                    placeholder={`Search ${selectedTable}...`}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>
            <Button onClick={handleAddNew}><Plus className="-ml-1 mr-2 h-4 w-4"/> Add New</Button>
          </div>

          <div className="rounded-lg border border-[var(--glass-border)] bg-slate-800/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr>
                    {columns.map(col => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{titleCase(col)}</th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <AnimatePresence>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {columns.map(col => <td key={col} className="px-4 py-3"><Skeleton className="h-4 w-full"/></td>)}
                          <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto"/></td>
                        </tr>
                      ))
                    ) : filteredData.map(item => (
                      <motion.tr 
                        key={item.id} 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        {columns.map(col => (
                          <td key={col} className="px-4 py-3 whitespace-nowrap text-slate-300 font-mono text-xs">
                            {String(item[col]).length > 50 ? String(item[col]).substring(0, 50) + '...' : String(item[col])}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button variant="secondary" size="sm" onClick={() => handleEdit(item)} className="p-2 h-auto"><Edit size={14}/></Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(item.id)} className="p-2 h-auto"><Trash2 size={14}/></Button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            {error && <p className="p-4 text-red-400">{error}</p>}
            {!isLoading && filteredData.length === 0 && <p className="p-4 text-slate-500">No records found.</p>}
          </div>
        </div>
      </div>
      <AdminFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        item={editingItem}
        columns={columns.filter(c => c !== 'id' && c !== 'createdAt')}
        onSave={handleSave}
        tableName={selectedTable}
      />
    </PageWrapper>
  );
}

function AdminFormModal({ isOpen, onClose, item, columns, onSave, tableName }: any) {
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (item) {
      setFormData(item);
    } else {
      // Reset form for new item
      const emptyForm: any = {};
      columns.forEach((col: string) => emptyForm[col] = '');
      setFormData(emptyForm);
    }
  }, [item, columns, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isNumber = type === 'number';
    setFormData((prev: any) => ({ ...prev, [name]: isNumber ? Number(value) : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${item ? 'Edit' : 'Add'} ${titleCase(tableName)}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {columns.map((col: string) => (
          <div key={col}>
            <label className="block text-sm font-medium text-slate-300 mb-1">{titleCase(col)}</label>
            <Input 
              name={col}
              type={typeof formData[col] === 'number' ? 'number' : 'text'}
              value={formData[col] || ''}
              onChange={handleChange}
            />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
