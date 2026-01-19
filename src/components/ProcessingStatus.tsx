import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcessingStatusProps {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}

export function ProcessingStatus({ status, progress, message }: ProcessingStatusProps) {
  if (status === 'idle') return null;

  const getStatusContent = () => {
    switch (status) {
      case 'uploading':
        return {
          icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />,
          title: 'Uploading...',
          description: message || 'Preparing your document'
        };
      case 'processing':
        return {
          icon: (
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-primary/20 pulse-glow" />
              <Loader2 className="h-8 w-8 text-primary animate-spin absolute top-2 left-2" />
            </div>
          ),
          title: 'Processing...',
          description: message || 'Detecting document edges and applying perspective correction'
        };
      case 'completed':
        return {
          icon: <CheckCircle2 className="h-8 w-8 text-success" />,
          title: 'Complete!',
          description: message || 'Your document has been processed successfully'
        };
      case 'failed':
        return {
          icon: <AlertCircle className="h-8 w-8 text-destructive" />,
          title: 'Processing Failed',
          description: message || 'Something went wrong. Please try again.'
        };
      default:
        return null;
    }
  };

  const content = getStatusContent();
  if (!content) return null;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-6 text-center rounded-xl border",
      status === 'completed' ? "bg-success/5 border-success/20" :
      status === 'failed' ? "bg-destructive/5 border-destructive/20" :
      "bg-card border-border"
    )}>
      {content.icon}
      <h3 className="mt-4 text-lg font-semibold text-foreground">{content.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">{content.description}</p>
      
      {(status === 'uploading' || status === 'processing') && progress !== undefined && (
        <div className="mt-4 w-full max-w-xs">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{progress}%</p>
        </div>
      )}
    </div>
  );
}
