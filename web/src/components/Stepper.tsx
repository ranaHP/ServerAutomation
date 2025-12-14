import { motion } from 'framer-motion';

export interface StepItem {
  key: string;
  name: string;
  status: string;
}

export default function Stepper({ steps }: { steps: StepItem[] }) {
  const statusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'running':
        return 'bg-amber-500';
      case 'approved':
        return 'bg-blue-500';
      default:
        return 'bg-slate-300';
    }
  };
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <motion.div
          key={step.key}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-md bg-white p-3 shadow-sm"
        >
          <div className={`h-3 w-3 rounded-full ${statusColor(step.status)}`} />
          <div className="flex-1">
            <div className="text-sm font-medium">{step.name}</div>
            <div className="text-xs text-slate-500">{step.status}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
