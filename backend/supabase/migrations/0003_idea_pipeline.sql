-- An idea should be easy to capture, but its decision should be visible to everyone.
alter table ideas
  add column if not exists status text not null default 'Inbox'
    check (status in ('Inbox', 'Evaluating', 'Planned', 'Building', 'Parked')),
  add column if not exists impact text not null default 'Medium'
    check (impact in ('Low', 'Medium', 'High')),
  add column if not exists effort text not null default 'Medium'
    check (effort in ('Small', 'Medium', 'Large')),
  add column if not exists category text;

create index if not exists idx_ideas_status_created_at on ideas(status, created_at desc);
