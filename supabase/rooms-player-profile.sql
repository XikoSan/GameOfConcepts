alter table public.rooms
add column if not exists max_players integer not null default 2;

alter table public.rooms
add column if not exists player_1_nickname text;

alter table public.rooms
add column if not exists player_2_nickname text;

alter table public.rooms
add column if not exists host_player_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rooms_max_players_check'
  ) then
    alter table public.rooms
    add constraint rooms_max_players_check
    check (max_players in (2, 3, 4));
  end if;
end $$;
