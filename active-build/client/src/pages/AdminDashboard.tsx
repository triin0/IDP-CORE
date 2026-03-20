import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '../hooks/useAdmin';
import { AdminRecord, entityTypeEnum } from '../types';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDateTime, titleCase } from '../lib/utils';

const tableNames = ['entities', 'transactions'];

const AdminForm = ({ schema, record, onSave, onCancel }: { schema: string[], record?: AdminRecord | null, onSave: (data: any) => void, onCancel: () => void }) => {
  const [formData, setFormData] = useState<any>(record || {});

  useEffect(() => {
    setFormData(record || {});
  }, [record]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Convert numeric strings to numbers
    const processedData = { ...formData };
    for (const key in processedData) {
      if (!isNaN(processedData[key]) && typeof processedData[key] === 'string' && processedData[key].trim() !== '') {
        processedData[key] = Number(processedData[key]);
      }
    }
    onSave(processedData);
  };

  const renderInput = (key: string) => {
    if (key === 'id' || key === 'createdAt' || key === 'updatedAt') return null;
    if (key === 'type' && tableNames.includes('entities')) {
      return (
        <Select name={key} value={formData[key] || ''} onChange={e => setFormData({ ...formData, [key]: e.target.value })}>
          {entityTypeEnum.enumValues.map(t => <option key={t} value={t}>{titleCase(t)}</option>)}
        </Select>
      );
    }
    const value = formData[key] || '';
    const inputType = typeof value === 'number' ? 'number' : key.includes('date') ? 'date' : 'text';
    return <Input name={key} type={inputType} value={key.includes('date') && value ? (value as string).split('T')[0] : value} onChange={e => setFormData({ ...formData, [key]: e.target.value })} />;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
      {schema.map(key => (
        renderInput(key) && (
          <div key={key}>
            <label className="block text-sm font-medium text-slate-400 mb-1">{titleCase(key)}</label>
            {renderInput(key)}
          </div>
        )
      ))}
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
};

const AdminDashboard = () => {
  const [selectedTable, setSelectedTable] = useState(tableNames[0]);
  const { data, isLoading, addRecord, updateRecord, removeRecord } = useAdmin(selectedTable);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AdminRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const schema = useMemo(() => (data && data.length > 0 ? Object.keys(data[0]) : []), [data]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  const handleAddClick = () => {
    setEditingRecord(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (record: AdminRecord) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: number | string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await removeRecord(id);
      } catch (e) {
        console.error('Failed to delete record', e);
        alert('Failed to delete record.');
      }
    }
  };

  const handleSave = async (formData: any) => {
    try {
      if (editingRecord) {
        await updateRecord(editingRecord.id, formData);
      } else {
        await addRecord(formData);
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error('Failed to save record', e);
      alert('Failed to save record.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex gap-6">
      <aside className="w-48 flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Tables</h2>
        <ul className="space-y-1">
          {tableNames.map(name => (
            <li key={name}>
              <button 
                onClick={() => setSelectedTable(name)} 
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedTable === name ? 'bg-indigo-500/15 text-white font-medium' : 'text-slate-400 hover:bg-slate-800'}`}>
                {titleCase(name)}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex-grow">
        <div className="flex justify-between items-center mb-4">
            <div className='flex-grow'>
                <Input 
                    type="text" 
                    placeholder={`Search ${titleCase(selectedTable)}...`} 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="max-w-xs bg-slate-800"/>
            </div>
            <Button onClick={handleAddClick}>Add New Record</Button>
        </div>
        
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-800/50">
              <tr>
                {schema.map(key => <th key={key} className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{titleCase(key)}</th>)}
                <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-t border-slate-800">
                      {schema.map(key => <td key={key} className="p-3"><Skeleton className="h-5 w-full" /></td>)}
                      <td className="p-3"><Skeleton className="h-5 w-20" /></td>
                    </tr>
                  ))
                ) : filteredData.length > 0 ? (
                  filteredData.map(row => (
                    <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} layout className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors text-sm">
                      {schema.map(key => (
                        <td key={key} className="p-3 text-slate-300 font-mono whitespace-nowrap max-w-xs truncate">
                          {key.includes('At') ? formatDateTime(row[key]) : String(row[key])}
                        </td>
                      ))}
                      <td className="p-3 space-x-2 whitespace-nowrap">
                        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => handleEditClick(row)}>Edit</Button>
                        <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => handleDeleteClick(row.id)}>Delete</Button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={schema.length + 1} className="text-center p-8 text-slate-500">No records found.</td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRecord ? `Edit Record` : `Add New Record`}>
        {schema.length > 0 && <AdminForm schema={schema} record={editingRecord} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />}
      </Modal>
    </motion.div>
  );
};

export default AdminDashboard;
