alter table public.rooms
add column if not exists turn_order jsonb not null default '[]'::jsonb;

alter table public.rooms
add column if not exists current_turn_index integer not null default 0;

notify pgrst, 'reload schema';
