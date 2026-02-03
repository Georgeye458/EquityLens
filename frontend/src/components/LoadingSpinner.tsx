import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export default function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <Loader2 className={cn("animate-spin text-primary", sizes[size])} />
      {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
