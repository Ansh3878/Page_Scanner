import { useCallback, useState } from 'react';
import { Upload, FileImage, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFileSelect, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [disabled, onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isValidFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const isValidFile = (file: File): boolean => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    return validTypes.includes(file.type);
  };

  const clearSelection = () => {
    setSelectedFile(null);
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload className="h-12 w-12 text-muted-foreground" />;
    if (selectedFile.type === 'application/pdf') {
      return <FileText className="h-12 w-12 text-primary" />;
    }
    return <FileImage className="h-12 w-12 text-primary" />;
  };

  return (
    <div
      className={cn(
        'upload-zone relative',
        isDragging && 'active',
        disabled && 'opacity-50 cursor-not-allowed',
        selectedFile && 'border-primary/50 bg-primary/5'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,application/pdf"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={disabled}
      />
      
      <div className="flex flex-col items-center gap-4 text-center">
        {getFileIcon()}
        
        {selectedFile ? (
          <div className="flex items-center gap-2">
            <span className="text-foreground font-medium">{selectedFile.name}</span>
            <button
              onClick={(e) => {
                e.preventDefault();
                clearSelection();
              }}
              className="p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-foreground font-medium">
                Drop your document here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 rounded-full bg-muted">PNG</span>
              <span className="px-2 py-1 rounded-full bg-muted">JPEG</span>
              <span className="px-2 py-1 rounded-full bg-muted">PDF</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
