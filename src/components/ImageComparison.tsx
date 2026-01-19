import { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCcw, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageComparisonProps {
  originalImage: string;
  processedImage: string;
  confidence?: number;
  warning?: string;
}

export function ImageComparison({ originalImage, processedImage, confidence, warning }: ImageComparisonProps) {
  const [viewMode, setViewMode] = useState<'split' | 'original' | 'processed'>('split');

  const ImageViewer = ({ src, label }: { src: string; label: string }) => (
    <div className="flex-1 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={5}
        centerOnInit
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="image-frame flex flex-col h-full">
            <div className="flex gap-1 p-2 border-b border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => zoomIn()}
                className="h-8 w-8 p-0"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => zoomOut()}
                className="h-8 w-8 p-0"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resetTransform()}
                className="h-8 w-8 p-0"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <img
                  src={src}
                  alt={label}
                  className="max-w-full max-h-full object-contain"
                />
              </TransformComponent>
            </div>
          </div>
        )}
      </TransformWrapper>
    </div>
  );

  return (
    <div className="space-y-4 fade-in">
      {/* View mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'split' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('split')}
          >
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Split View
          </Button>
          <Button
            variant={viewMode === 'original' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('original')}
          >
            Original
          </Button>
          <Button
            variant={viewMode === 'processed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('processed')}
          >
            Processed
          </Button>
        </div>
        
        {confidence !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Confidence:</span>
            <span className={cn(
              "text-sm font-medium px-2 py-0.5 rounded-full",
              confidence >= 70 ? "bg-success/10 text-success" :
              confidence >= 50 ? "bg-warning/10 text-warning" :
              "bg-destructive/10 text-destructive"
            )}>
              {confidence}%
            </span>
          </div>
        )}
      </div>

      {/* Warning message */}
      {warning && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm">
          ⚠️ {warning}
        </div>
      )}

      {/* Image display */}
      <div className={cn(
        "flex gap-4 h-[500px]",
        viewMode !== 'split' && "justify-center"
      )}>
        {(viewMode === 'split' || viewMode === 'original') && (
          <ImageViewer src={originalImage} label="Original" />
        )}
        {(viewMode === 'split' || viewMode === 'processed') && (
          <ImageViewer src={processedImage} label="Processed" />
        )}
      </div>
    </div>
  );
}
