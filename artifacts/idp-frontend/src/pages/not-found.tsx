import { AlertCircle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md px-4"
      >
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-destructive/10 mb-6 ring-1 ring-destructive/20">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-3xl font-bold font-mono text-zinc-100 mb-2">404</h1>
        <p className="text-lg font-mono text-zinc-400 mb-2">ROUTE_NOT_FOUND</p>
        <p className="text-sm text-zinc-600 font-mono mb-8">
          The requested path does not exist in the application router.
        </p>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center px-5 py-2.5 rounded-lg font-mono text-sm font-medium bg-primary text-primary-foreground hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          BACK_TO_DASHBOARD
        </button>
      </motion.div>
    </div>
  );
}
