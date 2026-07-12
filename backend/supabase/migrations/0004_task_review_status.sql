-- Add a real review gate to both personal and project task workflows.
-- Constraint names are the PostgreSQL defaults created by 0002.
alter table daily_todos drop constraint if exists daily_todos_status_check;
alter table daily_todos add constraint daily_todos_status_check check (status in ('Pending', 'In Progress', 'In Review', 'Completed', 'Blocked'));

alter table daily_todo_subtasks drop constraint if exists daily_todo_subtasks_status_check;
alter table daily_todo_subtasks add constraint daily_todo_subtasks_status_check check (status in ('Pending', 'In Progress', 'In Review', 'Completed', 'Blocked'));

alter table project_tasks drop constraint if exists project_tasks_status_check;
alter table project_tasks add constraint project_tasks_status_check check (status in ('Pending', 'In Progress', 'In Review', 'Completed', 'Blocked'));

alter table project_task_subtasks drop constraint if exists project_task_subtasks_status_check;
alter table project_task_subtasks add constraint project_task_subtasks_status_check check (status in ('Pending', 'In Progress', 'In Review', 'Completed', 'Blocked'));
