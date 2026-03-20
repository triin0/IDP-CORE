import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTransactions } from '../hooks/useTransactions';
import { useEntities } from '../hooks/useEntities';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { NewTransaction } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2 } },
};

const TransactionForm = ({ onSave, onCancel }: { onSave: (t: NewTransaction) => void; onCancel: () => void; }) => {
  const { entities, isLoading } = useEntities();
  const [formData, setFormData] = useState<Partial<NewTransaction>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.date || !formData.description || !formData.sourceEntityId || !formData.destinationEntityId) return;
    onSave(formData as NewTransaction);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'amount' || name.includes('Id') ? parseFloat(value) : value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Source Entity</label>
          <Select name="sourceEntityId" onChange={handleChange} required disabled={isLoading}>
            <option value="">Select Source</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Destination Entity</label>
          <Select name="destinationEntityId" onChange={handleChange} required disabled={isLoading}>
            <option value="">Select Destination</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Amount</label>
          <Input name="amount" type="number" step="0.01" placeholder="1000.00" onChange={handleChange} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
          <Input name="date" type="date" onChange={handleChange} required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
        <Input name="description" placeholder="e.g., Q1 Consulting Services" onChange={handleChange} required />
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Transaction</Button>
      </div>
    </form>
  );
};

const TransactionsPage = () => {
  const { transactions, isLoading, addTransaction } = useTransactions();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSave = (transaction: NewTransaction) => {
    addTransaction(transaction);
    setIsModalOpen(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button onClick={() => setIsModalOpen(true)}>Add Transaction</Button>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">From</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">To</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
            <AnimatePresence>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="p-4"><Skeleton className="h-5 w-48" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-24" /></td>
                    <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-32" /></td>
                    <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-32" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-28" /></td>
                  </tr>
                ))
              ) : transactions.length > 0 ? (
                transactions.map(t => (
                  <motion.tr key={t.id} variants={itemVariants} exit="exit" className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-medium text-slate-200">{t.description}</td>
                    <td className="p-4 text-cyan-400 font-mono">{formatCurrency(t.amount)}</td>
                    <td className="p-4 text-slate-300 hidden md:table-cell">{t.sourceEntity?.name || 'N/A'}</td>
                    <td className="p-4 text-slate-300 hidden md:table-cell">{t.destinationEntity?.name || 'N/A'}</td>
                    <td className="p-4 text-slate-400 font-mono text-sm">{formatDate(t.date)}</td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-slate-500">No transactions found.</td>
                </tr>
              )}
            </AnimatePresence>
          </motion.tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Transaction">
        <TransactionForm onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
      </Modal>
    </motion.div>
  );
};

export default TransactionsPage;
