-- S16-LEG: store document hash snapshot on acceptance (evidence)

ALTER TABLE legal_acceptances
  ADD COLUMN body_hash text;
