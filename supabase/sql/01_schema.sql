-- NOVATECH Governance upgrade · 01 schema
-- Everything lives in schema grc. The schema is NOT exposed to the API:
-- clients can only reach it through permission-checked public.grc_* functions.
create schema if not exists grc;
revoke all on schema grc from public;
revoke all on schema grc from anon, authenticated;

create table grc.organisations (
  id text primary key,
  name text not null,
  industry text not null,
  kind text not null check (kind in ('primary','template')),
  description text,
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create table grc.departments (
  id text primary key,
  org_id text not null references grc.organisations(id),
  name text not null,
  parent_id text references grc.departments(id),
  description text
);

create table grc.roles (
  id text primary key,
  org_id text not null references grc.organisations(id),
  name text not null,
  department_id text references grc.departments(id),
  authority_level int not null check (authority_level between 1 and 5),
  reports_to text references grc.roles(id),
  description text
);

create table grc.role_permissions (
  role_id text not null references grc.roles(id) on delete cascade,
  permission text not null,
  primary key (role_id, permission)
);

create table grc.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  org_id text not null references grc.organisations(id),
  full_name text not null,
  email text,
  role_id text not null references grc.roles(id),
  department_id text references grc.departments(id),
  manager_id uuid references grc.employees(id),
  active boolean not null default true,
  is_student boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);
create index on grc.employees(org_id, role_id) where active;

create table grc.assets (
  id text primary key,
  org_id text not null references grc.organisations(id),
  name text not null,
  asset_type text not null,
  criticality int not null check (criticality between 1 and 4),
  business_service text,
  department_id text references grc.departments(id),
  owner_role_id text references grc.roles(id),
  description text
);

create table grc.risks (
  id text primary key,
  org_id text not null references grc.organisations(id),
  code text not null,
  legacy_id text references public.risks(id),
  title text not null,
  category text not null,
  department_id text references grc.departments(id),
  description text,
  likelihood int check (likelihood between 1 and 4),   -- null when legacy record is the source of truth
  impact int check (impact between 1 and 4),
  owner_id uuid references grc.employees(id),
  treatment text,
  residual_likelihood int check (residual_likelihood between 1 and 4),
  residual_impact int check (residual_impact between 1 and 4),
  origin text not null default 'case' check (origin in ('case','governance_upgrade','template')),
  status text not null default 'open' check (status in ('open','treating','accepted','closed')),
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create table grc.raci (
  id bigint generated always as identity primary key,
  org_id text not null references grc.organisations(id),
  entity_type text not null check (entity_type in ('risk','action')),
  entity_id text not null,
  employee_id uuid not null references grc.employees(id),
  raci char(1) not null check (raci in ('R','A','C','I')),
  unique (entity_type, entity_id, employee_id, raci)
);

create table grc.action_types (
  org_id text not null references grc.organisations(id),
  code text not null,
  name text not null,
  domain text not null check (domain in ('cyber','it','finance','continuity','governance','banking')),
  disruptive boolean not null default false,
  assessor_role_id text references grc.roles(id),
  executor_role_ids text[] not null default '{}',   -- empty = the responsible employee executes
  emergency_allowed boolean not null default false,
  consulted_role_ids text[] not null default '{}',
  default_criteria jsonb not null default '[]',
  description text,
  primary key (org_id, code)
);

create table grc.approval_rules (
  id bigint generated always as identity primary key,
  org_id text not null references grc.organisations(id),
  action_type text not null,
  step int not null,
  approver_role_id text not null references grc.roles(id),
  min_severity int not null default 1 check (min_severity between 1 and 4),
  max_severity int not null default 4 check (max_severity between 1 and 4),
  min_asset_criticality int not null default 1 check (min_asset_criticality between 1 and 4),
  min_amount numeric not null default 0,
  in_emergency text not null default 'post_review' check (in_emergency in ('post_review','still_required')),
  rationale text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  foreign key (org_id, action_type) references grc.action_types(org_id, code)
);

create table grc.scenarios (
  code text primary key,
  org_id text not null references grc.organisations(id),
  title text not null,
  summary text not null,
  steps jsonb not null
);

create table grc.scenario_runs (
  id uuid primary key default gen_random_uuid(),
  scenario_code text not null references grc.scenarios(code),
  org_id text not null references grc.organisations(id),
  status text not null default 'active' check (status in ('active','paused','completed','reset')),
  started_by uuid references grc.employees(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table grc.incidents (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references grc.organisations(id),
  ref text not null unique,
  title text not null,
  description text,
  category text not null,
  severity int not null check (severity between 1 and 4),
  status text not null default 'new' check (status in ('new','investigating','contained','resolved','closed')),
  source text not null default 'manual',
  reported_by uuid references grc.employees(id),
  assigned_to uuid references grc.employees(id),
  risk_id text references grc.risks(id),
  asset_id text references grc.assets(id),
  financial_exposure numeric,
  security_assessment jsonb,
  financial_assessment jsonb,
  legacy_alert_id bigint references public.alerts(id),
  scenario_run_id uuid references grc.scenario_runs(id),
  archived boolean not null default false,
  detected_at timestamptz not null default now(),
  closed_at timestamptz
);

create table grc.actions (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references grc.organisations(id),
  ref text not null unique,
  action_type text not null,
  title text not null,
  proposed_action text,
  justification text,
  business_impact text,
  business_process text,
  treatment_strategy text not null default 'Reduce',
  priority text not null default 'P2' check (priority in ('P1','P2','P3','P4')),
  severity int not null default 2 check (severity between 1 and 4),
  amount numeric,
  risk_id text references grc.risks(id),
  incident_id uuid references grc.incidents(id),
  asset_id text references grc.assets(id),
  status text not null default 'draft' check (status in (
    'draft','submitted','under_review','awaiting_approval','approved','scheduled','in_progress',
    'awaiting_verification','completed','rejected','cancelled','blocked','escalated','failed','reopened')),
  emergency boolean not null default false,
  emergency_reason text,
  requested_by uuid not null references grc.employees(id),
  responsible_id uuid references grc.employees(id),
  accountable_id uuid references grc.employees(id),
  executor_id uuid references grc.employees(id),
  assessed_by uuid references grc.employees(id),
  assessment text,
  info_request text,
  blocked_reason text,
  budget numeric,
  resources text,
  start_date date,
  deadline timestamptz,
  depends_on uuid[] not null default '{}',
  progress int not null default 0 check (progress between 0 and 100),
  execution_mode text not null default 'simulated' check (execution_mode in ('simulated','device')),
  scheduled_for timestamptz,
  criteria jsonb not null default '[]',
  residual_likelihood int check (residual_likelihood between 1 and 4),
  residual_impact int check (residual_impact between 1 and 4),
  scenario_run_id uuid references grc.scenario_runs(id),
  archived boolean not null default false,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (org_id, action_type) references grc.action_types(org_id, code)
);
create index on grc.actions(org_id, status) where not archived;

create table grc.approvals (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references grc.actions(id),
  step int not null,
  kind text not null default 'pre' check (kind in ('pre','post_review')),
  approver_role_id text not null references grc.roles(id),
  rule_id bigint references grc.approval_rules(id),
  rationale text,
  status text not null default 'waiting' check (status in ('waiting','pending','approved','rejected','info_requested','escalated','superseded')),
  decided_by uuid references grc.employees(id),
  on_behalf_of uuid references grc.employees(id),
  comment text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (action_id, step, kind)
);

create table grc.evidence (
  id uuid primary key default gen_random_uuid(),
  action_id uuid references grc.actions(id),
  incident_id uuid references grc.incidents(id),
  kind text not null check (kind in ('note','assessment','execution_record','verification','device_report','kri_snapshot')),
  summary text not null,
  data jsonb not null default '{}',
  execution_label text check (execution_label in ('SIMULATED ACTION','EXECUTED ON ENROLLED TEST DEVICE')),
  submitted_by uuid references grc.employees(id),
  created_at timestamptz not null default now()
);

create table grc.delegations (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references grc.organisations(id),
  from_employee uuid not null references grc.employees(id),
  to_employee uuid not null references grc.employees(id),
  role_id text not null references grc.roles(id),
  reason text not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  granted_by uuid not null references grc.employees(id),
  revoked_at timestamptz,
  check (from_employee <> to_employee)
);

create table grc.notifications (
  id bigint generated always as identity primary key,
  org_id text not null references grc.organisations(id),
  recipient uuid not null references grc.employees(id),
  kind text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  browser_shown_at timestamptz
);
create index on grc.notifications(recipient, created_at desc);

-- Append-only, hash-chained audit trail
create table grc.audit_events (
  id bigint generated always as identity primary key,
  org_id text references grc.organisations(id),
  occurred_at timestamptz not null default clock_timestamp(),
  actor_employee uuid references grc.employees(id),
  actor_name text not null default 'System',
  actor_role text,
  stage text not null check (stage in ('detect','assess','authorise','execute','verify','governance','admin','scenario')),
  event_type text not null,
  entity_type text,
  entity_id text,
  entity_ref text,
  risk_id text,
  incident_id uuid,
  asset_id text,
  prev_status text,
  new_status text,
  outcome text,
  summary text not null,
  details jsonb not null default '{}',
  scenario_run_id uuid,
  prev_hash text,
  hash text
);
create index on grc.audit_events(org_id, id desc);
create index on grc.audit_events(entity_type, entity_id);

create or replace function grc.audit_hash_row(e grc.audit_events) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(
    coalesce(e.prev_hash,'GENESIS') || '|' || e.id::text || '|' || coalesce(e.org_id,'') || '|' ||
    to_char(e.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US') || '|' ||
    coalesce(e.actor_employee::text,'') || '|' || e.actor_name || '|' || coalesce(e.actor_role,'') || '|' ||
    e.stage || '|' || e.event_type || '|' || coalesce(e.entity_type,'') || '|' || coalesce(e.entity_id,'') || '|' ||
    coalesce(e.prev_status,'') || '|' || coalesce(e.new_status,'') || '|' || coalesce(e.outcome,'') || '|' ||
    e.summary || '|' || e.details::text, 'sha256'), 'hex')
$$;

create or replace function grc.audit_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('grc.audit_events'));
  select a.hash into new.prev_hash from grc.audit_events a order by a.id desc limit 1;
  new.occurred_at := clock_timestamp();
  new.hash := grc.audit_hash_row(new);
  return new;
end $$;
create trigger trg_audit_chain before insert on grc.audit_events
  for each row execute function grc.audit_before_insert();

create or replace function grc.audit_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Audit trail is append-only: % is not permitted', tg_op;
end $$;
create trigger trg_audit_no_update before update or delete on grc.audit_events
  for each row execute function grc.audit_immutable();
create trigger trg_audit_no_truncate before truncate on grc.audit_events
  for each statement execute function grc.audit_immutable();

-- Device control (disabled by default, phase 4)
create table grc.devices (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references grc.organisations(id),
  asset_id text references grc.assets(id),
  name text not null,
  platform text,
  token_hash text,
  enabled boolean not null default false,
  allowed_commands text[] not null default '{notify,lock_screen}',
  enrolled_by uuid references grc.employees(id),
  enrolled_at timestamptz,
  last_seen_at timestamptz,
  last_seen_info jsonb
);

create table grc.device_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references grc.devices(id),
  action_id uuid not null references grc.actions(id),
  command text not null,
  status text not null default 'queued' check (status in ('queued','delivered','executed','failed','cancelled','expired')),
  not_before timestamptz not null,
  expires_at timestamptz not null,
  issued_by uuid not null references grc.employees(id),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  unique (action_id)
);

-- RLS on: no policies => no direct access for anon/authenticated even if the schema were exposed.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'grc' loop
    execute format('alter table grc.%I enable row level security', t);
    execute format('revoke all on grc.%I from anon, authenticated', t);
  end loop;
end $$;

create sequence grc.ref_seq start 1001;
