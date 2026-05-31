ALTER TABLE properties ADD COLUMN ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_ref ON properties(ref) WHERE ref IS NOT NULL;
