-- Create documents table for storing scan metadata
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  original_url TEXT,
  processed_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processing_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own documents
CREATE POLICY "Users can view their own documents"
ON public.documents
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents"
ON public.documents
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
ON public.documents
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
ON public.documents
FOR DELETE
USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage buckets for files
INSERT INTO storage.buckets (id, name, public) VALUES ('originals', 'originals', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('processed', 'processed', false);

-- Storage policies for originals bucket
CREATE POLICY "Users can upload their own originals"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'originals' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own originals"
ON storage.objects
FOR SELECT
USING (bucket_id = 'originals' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own originals"
ON storage.objects
FOR DELETE
USING (bucket_id = 'originals' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for processed bucket
CREATE POLICY "Users can upload their own processed files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'processed' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own processed files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'processed' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own processed files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'processed' AND auth.uid()::text = (storage.foldername(name))[1]);