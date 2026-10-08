-- Apply in the game's Supabase SQL Editor as the database owner.
begin;
create schema if not exists relation_research;
revoke all on schema relation_research from public, anon, authenticated;

create table if not exists relation_research.accepted_relations (
  source text not null check (source in ('local', 'online')),
  session_id text not null check (length(session_id) between 1 and 250),
  edge_id text not null check (length(edge_id) between 1 and 500),
  move_id text not null check (length(move_id) between 1 and 250),
  deck_id text not null check (length(deck_id) between 1 and 100),
  from_name text not null check (length(from_name) between 1 and 200),
  to_name text not null check (length(to_name) between 1 and 200),
  from_definition_id text check (length(from_definition_id) <= 200),
  to_definition_id text check (length(to_definition_id) <= 200),
  family text not null check (family in ('kind', 'part', 'cause', 'property', 'opposite')),
  from_role text check (length(from_role) <= 80),
  to_role text check (length(to_role) <= 80),
  received_at timestamptz not null default now(),
  primary key (source, session_id, edge_id)
);
alter table relation_research.accepted_relations enable row level security;
revoke all on relation_research.accepted_relations from public, anon, authenticated;
grant usage on schema relation_research to service_role;
grant select on relation_research.accepted_relations to service_role;

-- Private helper. No client may invoke it directly or read the collection.
create or replace function relation_research.store_sample(origin text, sample jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into relation_research.accepted_relations
    (source, session_id, edge_id, move_id, deck_id, from_name, to_name,
     from_definition_id, to_definition_id, family, from_role, to_role)
  values (origin, sample->>'session_id', sample->>'edge_id', sample->>'move_id',
    sample->>'deck_id', sample->>'from_name', sample->>'to_name',
    sample->>'from_definition_id', sample->>'to_definition_id', sample->>'family',
    sample->>'from_role', sample->>'to_role')
  on conflict (source, session_id, edge_id) do nothing;
$$;
revoke all on function relation_research.store_sample(text,jsonb) from public, anon, authenticated;

-- Write-only endpoint for locally accepted examples. These are client-reported,
-- not server-verified votes. Keep source separate when preparing training data.
create or replace function public.record_local_relations(samples jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare sample jsonb;
begin
  if jsonb_typeof(samples) is distinct from 'array' then
    raise exception 'Expected an array';
  end if;
  if jsonb_array_length(samples) > 50 or octet_length(samples::text) > 100000 then
    raise exception 'Batch too large';
  end if;
  for sample in select value from jsonb_array_elements(samples) loop
    if jsonb_typeof(sample) is distinct from 'object' then
      raise exception 'Expected an object';
    end if;
    perform relation_research.store_sample('local', sample);
  end loop;
end;
$$;
revoke all on function public.record_local_relations(jsonb) from public;
grant execute on function public.record_local_relations(jsonb) to anon, authenticated;

-- Observe persisted online state, rather than collecting separately on every client.
-- Current rooms are client-authored JSON: this does not provide anti-cheat validation.
create or replace function relation_research.capture_room_relations()
returns trigger language plpgsql security definer set search_path = '' as $$
declare edge jsonb; from_card jsonb; to_card jsonb;
begin
  if new.game_state->'semanticEdges' is not distinct from old.game_state->'semanticEdges' then
    return new;
  end if;
  for edge in select value from jsonb_array_elements(coalesce(new.game_state->'semanticEdges', '[]'::jsonb)) loop
    if exists (select 1 from jsonb_array_elements(coalesce(old.game_state->'semanticEdges', '[]'::jsonb)) previous
               where previous->>'id' = edge->>'id') then continue; end if;
    select value into from_card from jsonb_each(new.game_state->'board')
      where value->>'id' = edge->>'fromCardInstanceId';
    select value into to_card from jsonb_each(new.game_state->'board')
      where value->>'id' = edge->>'toCardInstanceId';
    if from_card->>'status' = 'confirmed' and to_card->>'status' = 'confirmed' then
      perform relation_research.store_sample('online', jsonb_build_object(
        'session_id', new.game_state->'startCard'->>'id',
        'edge_id', edge->>'id', 'move_id', edge->>'createdAtMoveId',
        'deck_id', coalesce(new.game_state->'deckSnapshot'->>'sourceDeckId', 'unknown'),
        'from_name', from_card->>'cardName', 'to_name', to_card->>'cardName',
        'from_definition_id', from_card->>'definitionId', 'to_definition_id', to_card->>'definitionId',
        'family', edge->'relation'->>'family',
        'from_role', edge->'relation'->>'fromRole', 'to_role', edge->'relation'->>'toRole'));
    end if;
  end loop;
  return new;
exception when others then
  -- Research must never prevent a room from accepting a game update.
  raise warning 'Relation collection skipped: %', SQLSTATE;
  return new;
end;
$$;
revoke all on function relation_research.capture_room_relations() from public, anon, authenticated;
create or replace trigger capture_accepted_relations after update of game_state on public.rooms
for each row execute function relation_research.capture_room_relations();

create or replace view relation_research.relation_counts as
select source, family,
  case when family = 'opposite' then least(from_name, to_name) else from_name end as from_name,
  case when family = 'opposite' then greatest(from_name, to_name) else to_name end as to_name,
  count(*) as accepted_count, count(distinct session_id) as session_count
from relation_research.accepted_relations
group by 1, 2, 3, 4;
revoke all on relation_research.relation_counts from public, anon, authenticated;
grant select on relation_research.relation_counts to service_role;
commit;
