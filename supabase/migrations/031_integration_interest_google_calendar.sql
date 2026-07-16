BEGIN;

ALTER TABLE integration_interest
  DROP CONSTRAINT integration_interest_channel_check;

ALTER TABLE integration_interest
  ADD CONSTRAINT integration_interest_channel_check
  CHECK (channel IN ('zoom', 'chrome_extension', 'google_calendar'));

COMMIT;
