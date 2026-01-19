import { useState, useEffect, useCallback } from 'react';
import { Plus, History, RefreshCw, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { UploadZone } from '@/components/UploadZone';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { ImageComparison } from '@/components/ImageComparison';
import { DocumentCard } from '@/components/DocumentCard';
import { processDocument, pdfToImage } from '@/lib/imageProcessing';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Document {
  id: string;
  filename: string;
  original_url: string | null;
  processed_url: string | null;
  status: string;
  processing_notes: string | null;
  created_at: string;
}

type ProcessingState = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

export default function Dashboard() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [progress, setProgress] = useState(0);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [originalImageData, setOriginalImageData] = useState<string | null>(null);
  const [processedImageData, setProcessedImageData] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | undefined>();
  const [warning, setWarning] = useState<string | undefined>();

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
      toast.error('Failed to load documents');
    } finally {
      setLoadingDocs(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileSelect = async (file: File) => {
    if (!user) return;

    setProcessingState('uploading');
    setProgress(10);
    setCurrentDocument(null);
    setOriginalImageData(null);
    setProcessedImageData(null);
    setConfidence(undefined);
    setWarning(undefined);

    try {
      // Convert file to image data
      let imageData: string;
      
      if (file.type === 'application/pdf') {
        setProgress(20);
        imageData = await pdfToImage(file);
      } else {
        imageData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      setOriginalImageData(imageData);
      setProgress(40);

      // Create document record
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          filename: file.name,
          status: 'processing'
        })
        .select()
        .single();

      if (docError) throw docError;
      
      setProgress(50);
      setProcessingState('processing');

      // Upload original image to storage
      const originalPath = `${user.id}/${docData.id}/original.jpg`;
      const originalBlob = await fetch(imageData).then(r => r.blob());
      
      const { error: uploadOriginalError } = await supabase.storage
        .from('originals')
        .upload(originalPath, originalBlob, { contentType: 'image/jpeg' });

      if (uploadOriginalError) throw uploadOriginalError;

      setProgress(60);

      // Process the document
      const result = await processDocument(imageData);
      
      setProgress(80);
      setProcessedImageData(result.processedImageData);
      setConfidence(result.confidence);
      setWarning(result.warning);

      // Upload processed image
      const processedPath = `${user.id}/${docData.id}/processed.jpg`;
      const processedBlob = await fetch(result.processedImageData).then(r => r.blob());
      
      const { error: uploadProcessedError } = await supabase.storage
        .from('processed')
        .upload(processedPath, processedBlob, { contentType: 'image/jpeg' });

      if (uploadProcessedError) throw uploadProcessedError;

      setProgress(90);

      // Get signed URLs
      const { data: originalUrlData } = await supabase.storage
        .from('originals')
        .createSignedUrl(originalPath, 60 * 60); // 1 hour

      const { data: processedUrlData } = await supabase.storage
        .from('processed')
        .createSignedUrl(processedPath, 60 * 60);

      // Update document record
      const { data: updatedDoc, error: updateError } = await supabase
        .from('documents')
        .update({
          original_url: originalUrlData?.signedUrl,
          processed_url: processedUrlData?.signedUrl,
          status: 'completed',
          processing_notes: result.warning || `Processed with ${result.confidence}% confidence`
        })
        .eq('id', docData.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setCurrentDocument(updatedDoc);
      setProgress(100);
      setProcessingState('completed');
      toast.success('Document processed successfully!');
      fetchDocuments();

    } catch (err) {
      console.error('Processing error:', err);
      setProcessingState('failed');
      toast.error('Failed to process document');
    }
  };

  const handleDocumentClick = async (doc: Document) => {
    setCurrentDocument(doc);
    setProcessingState('idle');
    
    if (doc.original_url && doc.processed_url) {
      setOriginalImageData(doc.original_url);
      setProcessedImageData(doc.processed_url);
      setConfidence(undefined);
      setWarning(doc.processing_notes || undefined);
    }
  };

  const handleDownload = () => {
    if (processedImageData) {
      const link = document.createElement('a');
      link.href = processedImageData;
      link.download = currentDocument?.filename || 'processed-document.jpg';
      link.click();
    }
  };

  const handleDelete = async () => {
    if (!currentDocument || !user) return;

    try {
      // Delete from storage
      await supabase.storage
        .from('originals')
        .remove([`${user.id}/${currentDocument.id}/original.jpg`]);
      
      await supabase.storage
        .from('processed')
        .remove([`${user.id}/${currentDocument.id}/processed.jpg`]);

      // Delete record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', currentDocument.id);

      if (error) throw error;

      setCurrentDocument(null);
      setOriginalImageData(null);
      setProcessedImageData(null);
      toast.success('Document deleted');
      fetchDocuments();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete document');
    }
  };

  const handleNewScan = () => {
    setCurrentDocument(null);
    setOriginalImageData(null);
    setProcessedImageData(null);
    setProcessingState('idle');
    setProgress(0);
    setConfidence(undefined);
    setWarning(undefined);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          {/* Main content */}
          <div className="space-y-6">
            {/* Upload or result section */}
            <div className="rounded-2xl border border-border bg-card p-6">
              {processingState === 'idle' && !currentDocument && (
                <>
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Upload Document
                  </h2>
                  <UploadZone onFileSelect={handleFileSelect} />
                </>
              )}

              {(processingState === 'uploading' || processingState === 'processing') && (
                <ProcessingStatus 
                  status={processingState} 
                  progress={progress}
                />
              )}

              {processingState === 'failed' && (
                <div className="space-y-4">
                  <ProcessingStatus status="failed" />
                  <div className="flex justify-center">
                    <Button onClick={handleNewScan} variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {(processingState === 'completed' || (processingState === 'idle' && currentDocument)) && 
                originalImageData && processedImageData && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">
                      {currentDocument?.filename || 'Scan Result'}
                    </h2>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                      <Button size="sm" onClick={handleNewScan}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Scan
                      </Button>
                    </div>
                  </div>
                  
                  <ImageComparison
                    originalImage={originalImageData}
                    processedImage={processedImageData}
                    confidence={confidence}
                    warning={warning}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Document history */}
          <aside className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Recent Scans</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchDocuments}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
              {loadingDocs ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-24 skeleton rounded-xl" />
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No documents yet</p>
                  <p className="text-xs mt-1">Upload your first document to get started</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    id={doc.id}
                    filename={doc.filename}
                    status={doc.status}
                    createdAt={doc.created_at}
                    processedUrl={doc.processed_url}
                    onClick={() => handleDocumentClick(doc)}
                  />
                ))
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
