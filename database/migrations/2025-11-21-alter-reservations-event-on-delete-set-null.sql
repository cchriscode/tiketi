-- Update reservations.event_id FK to allow event deletion while keeping cancelled reservations
ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_event_id_fkey;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
