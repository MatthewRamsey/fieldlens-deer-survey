-- The trigger only calls pg_catalog built-ins; avoid resolving names from caller paths.
alter function public.set_current_timestamp_updated_at() set search_path = '';
