-- Team invitation and first-login onboarding preferences.

alter table users
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists typical_work_start time,
  add column if not exists typical_work_end time,
  add column if not exists notification_preferences_json jsonb not null default '{"digest": true, "immediateCritical": true}'::jsonb;

create index if not exists idx_users_onboarding on users(organization_id, account_status, onboarding_completed_at);
