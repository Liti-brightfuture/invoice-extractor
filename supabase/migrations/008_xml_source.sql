ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pdf'
  CHECK (source IN ('pdf', 'image', 'xml'));

UPDATE invoices
SET source = CASE
  WHEN lower(file_name) LIKE '%.xml' THEN 'xml'
  WHEN lower(file_name) LIKE '%.pdf' THEN 'pdf'
  ELSE 'image'
END;

UPDATE storage.buckets
SET allowed_mime_types = array[
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/xml',
  'text/xml'
]
WHERE id = 'invoices';
