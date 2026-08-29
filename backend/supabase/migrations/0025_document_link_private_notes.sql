alter table document_link_projects
  add column if not exists private_notes text not null default '';
