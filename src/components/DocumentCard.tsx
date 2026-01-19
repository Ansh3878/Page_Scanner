import { formatDistanceToNow } from 'date-fns';
import { FileImage, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentCardProps {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
  processedUrl?: string | null;
  onClick: () => void;
}

export function DocumentCard({ id, filename, status, createdAt, processedUrl, onClick }: DocumentCardProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-warning" />;
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'processing':
        return 'status-processing';
      case 'failed':
        return 'status-failed';
      default:
        return 'status-pending';
    }
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl bg-card border border-border card-interactive focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {processedUrl ? (
            <img
              src={processedUrl}
              alt={filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <FileImage className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{filename}</h3>
          
          <div className="flex items-center gap-2 mt-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border",
              getStatusClass()
            )}>
              {getStatusIcon()}
              <span className="capitalize">{status}</span>
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </button>
  );
}
