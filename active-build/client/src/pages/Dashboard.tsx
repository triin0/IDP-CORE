import { motion } from 'framer-motion';
import { useTransactions } from '../hooks/useTransactions';
import { useEntities } from '../hooks/useEntities';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatDate } from '../lib/utils';

const StatCard = ({ title, value, isLoading }: { title: string; value: string | number; isLoading: boolean }) => (
  <Card>
    <h3 className="text-sm font-medium text-slate-400">{title}</h3>
    {isLoading ? (
      <Skeleton className="h-8 w-32 mt-2" />
    ) : (
      <p className="text-2xl font-semibold text-slate-100 mt-1 font-mono tracking-tight">{value}</p>
    )}
  </Card>
);

const Dashboard = () => {
  const { transactions, isLoading: transactionsLoading } = useTransactions();
  const { entities, isLoading: entitiesLoading } = useEntities();

  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);
  const recentTransactions = transactions.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Volume" value={formatCurrency(totalVolume)} isLoading={transactionsLoading} />
        <StatCard title="Total Transactions" value={transactions.length} isLoading={transactionsLoading} />
        <StatCard title="Total Entities" value={entities.length} isLoading={entitiesLoading} />
      </div>

      <Card className="mt-8">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Recent Transactions</h2>
        {transactionsLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : recentTransactions.length > 0 ? (
          <ul className="divide-y divide-slate-700/50">
            {recentTransactions.map(t => (
              <li key={t.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-slate-200">{t.description}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {t.sourceEntity?.name || 'N/A'} → {t.destinationEntity?.name || 'N/A'} on {formatDate(t.date)}
                  </p>
                </div>
                <p className="font-mono text-cyan-400">{formatCurrency(t.amount)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400 text-center py-8">No transactions yet.</p>
        )}
      </Card>
    </motion.div>
  );
};

export default Dashboard;
