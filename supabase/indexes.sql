create index if not exists rooms_status_idx on rooms (status);
create index if not exists rooms_player_1_idx on rooms (player_1_id);
create index if not exists rooms_player_2_idx on rooms (player_2_id);
create index if not exists rooms_updated_at_idx on rooms (updated_at);
