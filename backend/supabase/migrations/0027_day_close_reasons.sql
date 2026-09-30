-- End My Day: every task touched today gets an explicit answer.
-- DELAYED joins the outcomes; DELAYED/BLOCKED carry a reason code.
alter table daily_work_commitments drop constraint if exists daily_work_commitments_outcome_check;
alter table daily_work_commitments add constraint daily_work_commitments_outcome_check
  check (outcome in ('DONE', 'CARRIED', 'DELAYED', 'BLOCKED'));

alter table daily_work_commitments add column if not exists reason_code text;
alter table daily_work_commitments drop constraint if exists daily_work_commitments_reason_code_check;
alter table daily_work_commitments add constraint daily_work_commitments_reason_code_check
  check (reason_code is null or reason_code in ('OTHER_TASK', 'URGENT_REQUEST', 'WAITING_ON_SOMEONE', 'MEETINGS', 'UNCLEAR_REQUIREMENTS', 'LEAVE', 'OTHER'));

-- Tasks logged during the day become commitments too, so the day can hold more than 10.
alter table daily_work_commitments drop constraint if exists daily_work_commitments_position_check;
alter table daily_work_commitments add constraint daily_work_commitments_position_check check (position >= 1);

-- Open sessions: pull in tasks already logged today but not committed.
insert into daily_work_commitments (session_id, task_id, position)
select logged.session_id, logged.task_id,
       coalesce((select max(position) from daily_work_commitments c where c.session_id = logged.session_id), 0)
         + row_number() over (partition by logged.session_id order by logged.first_at)
from (
  select log.session_id, log.task_id, min(log.created_at) as first_at
  from work_logs log
  join daily_work_sessions session on session.id = log.session_id and session.status = 'ACTIVE'
  where log.task_id is not null
    and not exists (select 1 from daily_work_commitments c where c.session_id = log.session_id and c.task_id = log.task_id)
  group by log.session_id, log.task_id
) logged
on conflict do nothing;

notify pgrst, 'reload schema';
