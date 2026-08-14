-- The `uploads` bucket the community feed writes to.
--
-- It was only ever documented in a code comment ("create it in the dashboard"),
-- so on this project it did not exist: text posts saved fine, but every photo
-- upload 404'd, uploadDataUrl() returned null, and the post was stored without
-- its image — with no error shown to the user. Creating it here means a fresh
-- environment is not silently broken the same way.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  TRUE,
  5242880,                                    -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Owners could upload and overwrite but never delete, so a user had no way to
-- remove their own photo and orphaned objects piled up. Paths look like
-- `<folder>/<uid>/<file>`, hence foldername(name)[2].
DO $$ BEGIN
  CREATE POLICY "uploads_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'uploads' AND (storage.foldername(name))[2] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
