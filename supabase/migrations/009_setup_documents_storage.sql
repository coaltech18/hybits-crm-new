-- ===================================================================
-- HYBITS CRM — Documents Storage Bucket Setup
-- Creates storage bucket for PDF files
-- ===================================================================

-- Create documents bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'text/plain'])
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Allow authenticated users to read documents
CREATE POLICY "Users can read documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents' AND 
  auth.role() = 'authenticated'
);

-- RLS Policy: Allow service role to manage documents (for PDF generation)
CREATE POLICY "Service role can manage documents" ON storage.objects
FOR ALL USING (
  bucket_id = 'documents' AND 
  auth.role() = 'service_role'
);

-- End of 009_setup_documents_storage.sql
