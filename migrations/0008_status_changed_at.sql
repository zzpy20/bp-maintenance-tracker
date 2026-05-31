ALTER TABLE issues ADD COLUMN status_changed_at TEXT;
UPDATE issues SET status_changed_at = created_at;
