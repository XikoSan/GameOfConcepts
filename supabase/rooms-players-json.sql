alter table public.rooms
add column if not exists players jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
