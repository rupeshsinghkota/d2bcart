-- Add column to track the last time the weekly catalog loop ran for a user
alter table users 
add column if not exists last_weekly_catalog_sent_at timestamptz;

-- Add a comment for clarity
comment on column users.last_weekly_catalog_sent_at is 'Tracks the last time the 7-day no-order catalog message was sent';
