import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEvents } from '../hooks/useEvents';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDate } from '../lib/utils';
import { PageWrapper } from '../components/PageWrapper';

const EventCardSkeleton = () => (
  <Card className="h-[180px]">
    <CardHeader>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2 mt-2" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-4 w-full mt-4" />
      <Skeleton className="h-4 w-2/3 mt-2" />
    </CardContent>
  </Card>
);

export function EventsPage() {
  const { events, isLoading, error } = useEvents();

  return (
    <PageWrapper>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-100">Upcoming Events</h2>
        {error && <p className="text-red-400">Error: {error}</p>}
        
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          variants={{ 
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
          initial="hidden"
          animate="show"
        >
          <AnimatePresence>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <EventCardSkeleton key={i} />)
            ) : events.length > 0 ? (
              events.map((event) => (
                <motion.div key={event.id} layout variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} exit={{ opacity: 0, height: 0 }}>
                  <Link to={`/events/${event.id}`}>
                    <Card className="h-full flex flex-col">
                      <CardHeader>
                        <CardTitle>{event.title}</CardTitle>
                        <CardDescription>{formatDate(event.date)}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="line-clamp-2">{event.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))
            ) : (
              <p className="text-slate-400 col-span-full">No upcoming events found.</p>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </PageWrapper>
  );
}
