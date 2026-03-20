import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEntities } from '../hooks/useEntities';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { NewEntity, entityTypeEnum } from '../types';
import { formatDate } from '../lib/utils';

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

const EntityForm = ({ onSave, onCancel }: { onSave: (entity: NewEntity) => void; onCancel: () => void; }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<NewEntity['type']>('person');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSave({ name, type });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-1">Name</label>
        <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Hyperion Dynamics" required />
      </div>
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-slate-400 mb-1">Type</label>
        <Select id="type" value={type} onChange={e => setType(e.target.value as NewEntity['type'])} required>
          {entityTypeEnum.enumValues.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </Select>
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Entity</Button>
      </div>
    </form>
  );
};

const EntitiesPage = () => {
  const { entities, isLoading, addEntity } = useEntities();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSaveEntity = (entity: NewEntity) => {
    addEntity(entity);
    setIsModalOpen(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Entities</h1>
        <Button onClick={() => setIsModalOpen(true)}>Add Entity</Button>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Created At</th>
            </tr>
          </thead>
          <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
            <AnimatePresence>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="p-4"><Skeleton className="h-5 w-40" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-20" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-32" /></td>
                  </tr>
                ))
              ) : entities.length > 0 ? (
                entities.map(entity => (
                  <motion.tr key={entity.id} variants={itemVariants} exit="exit" className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-medium text-slate-200">{entity.name}</td>
                    <td className="p-4 text-slate-300">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${entity.type === 'company' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                        {entity.type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 font-mono text-sm">{formatDate(entity.createdAt)}</td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center p-8 text-slate-500">No entities found.</td>
                </tr>
              )}
            </AnimatePresence>
          </motion.tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Entity">
        <EntityForm onSave={handleSaveEntity} onCancel={() => setIsModalOpen(false)} />
      </Modal>
    </motion.div>
  );
};

export default EntitiesPage;
