
CREATE TABLE public.processed_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  environment text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.processed_webhook_events TO service_role;

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon: only service_role (webhook handler) touches this table.

CREATE INDEX idx_processed_webhook_events_received_at ON public.processed_webhook_events(received_at);
