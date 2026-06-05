create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'waiting',
  player_1_id text not null,
  player_2_id text,
  game_state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index rooms_code_idx on rooms (code);
create index rooms_status_idx on rooms (status);
create index rooms_player_1_idx on rooms (player_1_id);
create index rooms_player_2_idx on rooms (player_2_id);
