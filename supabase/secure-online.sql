-- Apply only alongside room-command and guest-auth clients. Existing unverified rooms stay archived.
begin;
alter table public.rooms add column if not exists protocol_version integer not null default 1;
alter table public.rooms enable row level security;
revoke all on public.rooms from anon, authenticated;
grant select on public.rooms to authenticated;
-- A restrictive policy also constrains any legacy permissive SELECT policies.
drop policy if exists secure_room_select on public.rooms;
drop policy if exists secure_room_boundary on public.rooms;
create policy secure_room_select on public.rooms for select to authenticated using (
 protocol_version = 2 and (status = 'waiting' or players @> jsonb_build_array(jsonb_build_object('id',auth.uid()::text)))
);
create policy secure_room_boundary on public.rooms as restrictive for all to authenticated using (
 protocol_version = 2 and (status = 'waiting' or players @> jsonb_build_array(jsonb_build_object('id',auth.uid()::text)))
) with check (false);

create schema if not exists game_private;
revoke all on schema game_private from public,anon,authenticated;
create table if not exists game_private.request_quotas (
 actor uuid not null, category text not null, window_start timestamptz not null, used integer not null,
 primary key(actor,category)
);
revoke all on game_private.request_quotas from public,anon,authenticated;
create or replace function public.consume_game_quota(actor uuid, category text)
returns void language plpgsql security definer set search_path='' as $$
declare cap integer; window_seconds integer; consumed integer;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 case category when 'create' then cap:=5; window_seconds:=3600;
 when 'action' then cap:=120; window_seconds:=60;
 when 'relations' then cap:=30; window_seconds:=60;
 else raise exception 'Unknown quota'; end case;
 insert into game_private.request_quotas as q values(actor,category,now(),1)
 on conflict on constraint request_quotas_pkey do update set
 used=case when q.window_start + make_interval(secs=>window_seconds)<=now() then 1 else q.used+1 end,
 window_start=case when q.window_start + make_interval(secs=>window_seconds)<=now() then now() else q.window_start end
 returning used into consumed;
 if consumed>cap then raise exception 'Rate limit exceeded'; end if;
end;
$$;
revoke all on function public.consume_game_quota(uuid,text) from public,anon,authenticated;
grant execute on function public.consume_game_quota(uuid,text) to service_role;

-- Local observations remain client-reported. Auth and quotas constrain abuse, not truthfulness.
create or replace function public.record_local_relations(samples jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare sample jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform public.consume_game_quota(auth.uid(),'relations');
 if jsonb_typeof(samples) is distinct from 'array' then raise exception 'Expected array'; end if;
 if jsonb_array_length(samples)>50 or octet_length(samples::text)>100000 then raise exception 'Batch too large'; end if;
 for sample in select value from jsonb_array_elements(samples) loop
  if jsonb_typeof(sample) is distinct from 'object' then raise exception 'Expected object'; end if;
  perform relation_research.store_sample('local',sample);
 end loop;
end;
$$;
revoke all on function public.record_local_relations(jsonb) from public,anon;
grant execute on function public.record_local_relations(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
