-- Set default search_path for tiketi_user to include all MSA schemas

ALTER ROLE tiketi_user SET search_path TO ticket_schema, auth_schema, payment_schema, stats_schema, public;

-- Verify the search_path
SELECT rolname, rolconfig FROM pg_roles WHERE rolname = 'tiketi_user';
