-- Publish existing closed workdays into each project represented in the day.
-- Future closeouts are written by workdayService; this only repairs history.

insert into public.daily_reports (
  project_id, member_id, team_member_name, role, report_date, work_date,
  description, created_by, created_at, updated_at
)
select
  item.project_id,
  workday.user_id,
  member.name,
  member.role,
  workday.work_date,
  workday.work_date,
  concat_ws(E'\n\n',
    nullif(trim(workday.completed_summary), ''),
    'Project work:' || E'\n' || string_agg(
      '- ' || item.title || ': ' || item.status
      || case when nullif(trim(item.progress_note), '') is null then '' else ' - ' || trim(item.progress_note) end
      || case when nullif(trim(item.blocker_reason), '') is null then '' else ' (Blocker: ' || trim(item.blocker_reason) || ')' end,
      E'\n' order by item.order_index, item.created_at
    ),
    case when nullif(trim(workday.blockers), '') is null then null else 'Blockers: ' || trim(workday.blockers) end,
    case when nullif(trim(workday.remarks), '') is null then null else 'Remarks: ' || trim(workday.remarks) end
  ),
  workday.user_id,
  coalesce(workday.closed_at, workday.check_out_at, workday.updated_at, workday.created_at),
  coalesce(workday.closed_at, workday.check_out_at, workday.updated_at, workday.created_at)
from public.workdays workday
join public.workday_items item on item.workday_id = workday.id
join public.users member on member.id = workday.user_id
where workday.status = 'Completed'
  and item.project_id is not null
group by
  item.project_id, workday.user_id, member.name, member.role, workday.work_date,
  workday.completed_summary, workday.blockers, workday.remarks, workday.closed_at,
  workday.check_out_at, workday.updated_at, workday.created_at
on conflict (project_id, work_date, member_id) do nothing;

notify pgrst, 'reload schema';
