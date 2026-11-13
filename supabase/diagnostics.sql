-- A separate, private 30-day archive. This migration never deletes relation_research data.
begin;
create schema if not exists game_diagnostics;
revoke all on schema game_diagnostics from public, anon, authenticated;
create table if not exists game_diagnostics.events (
 source text not null check(source in ('local','online')),
 session_id text not null check(length(session_id) between 1 and 250),
 event_id text not null check(length(event_id) between 1 and 250),
 event_type text not null,
 occurred_at timestamptz not null,
 received_at timestamptz not null default now(),
 expires_at timestamptz not null,
 room_id uuid,
 room_code text,
 client_version text,
 server_version text,
 snapshot jsonb not null,
 primary key(source,session_id,event_id)
);
create index if not exists diagnostics_expiry_idx on game_diagnostics.events(expires_at);
create index if not exists diagnostics_room_code_idx on game_diagnostics.events(room_code,received_at);
alter table game_diagnostics.events enable row level security;
revoke all on game_diagnostics.events from public,anon,authenticated;
grant usage on schema game_diagnostics to service_role;
grant select on game_diagnostics.events to service_role;

-- A bounded schema allowlist, used for trusted online snapshots and untrusted local submissions.
create or replace function game_diagnostics.clean(value jsonb, spec jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; item record; limit_count integer; primitive text;
begin
 if value is null or value='null'::jsonb then return 'null'::jsonb; end if;
 if jsonb_typeof(spec)='string' then
  primitive:=spec#>>'{}';
  if primitive in ('text','longtext') and jsonb_typeof(value)='string' then
   return to_jsonb(left(value#>>'{}',case when primitive='longtext' then 500 else 250 end));
  elsif primitive='number' and jsonb_typeof(value)='number' then
   return to_jsonb(greatest(-1000000::numeric,least(1000000::numeric,(value#>>'{}')::numeric)));
  elsif primitive='boolean' and jsonb_typeof(value)='boolean' then return value;
  end if;
  return 'null'::jsonb;
 elsif jsonb_typeof(spec)='array' and jsonb_typeof(value)='array' then
  limit_count:=coalesce((spec->>1)::integer,512);
  select coalesce(jsonb_agg(game_diagnostics.clean(v,spec->0) order by n),'[]'::jsonb) into result
   from (select v,n from jsonb_array_elements(value) with ordinality a(v,n) limit limit_count) bounded;
  return result;
 elsif jsonb_typeof(spec)='object' and jsonb_typeof(value)='object' then
  result:='{}'::jsonb;
  for item in select key,val from jsonb_each(spec) a(key,val) loop
   if value ? item.key then result:=result||jsonb_build_object(item.key,game_diagnostics.clean(value->item.key,item.val)); end if;
  end loop;
  return result;
 end if;
 return 'null'::jsonb;
end;
$$;

create or replace function game_diagnostics.clean_snapshot(value jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare rel jsonb; card jsonb; evidence jsonb; explanation jsonb; score jsonb; move_score jsonb; spec jsonb;
begin
 rel:='{"family":"text","fromRole":"text","toRole":"text","symmetric":"boolean"}';
 card:='{"id":"text","name":"text","ownerSeatIndex":"number"}';
 evidence:=jsonb_build_object('id','text','from',card,'to',card,'relation',rel,'label','longtext');
 explanation:=jsonb_build_object('version','number','relation','longtext','edge',evidence,
  'path',jsonb_build_object('cards',jsonb_build_array(card,512),'edges',jsonb_build_array(evidence,512),'sharedCardId','text'),
  'node',jsonb_build_object('center',card,'outerCards',jsonb_build_array(card,512),'direction','text','edges',jsonb_build_array(evidence,512)));
 score:=jsonb_build_object('pendingEdgeId','text','baseScore','number','pathBonus','number','nodeBonus','number','total','number','explanation',explanation);
 move_score:=jsonb_build_object('total','number','edges',jsonb_build_array(score,2048));
 spec:=jsonb_build_object(
  'formatVersion','number','scoringVersion','number','playerCount','number','currentPlayerIndex','number','startCardId','text','drawPileCount','number',
  'deck',jsonb_build_object('sourceDeckId','text','cardDefinitionIds','["text",512]'::jsonb,
   'cards','[{"id":"text","name":"text","difficulty":"text"},512]'::jsonb,
   'neutralCards','[{"id":"text","name":"text"},512]'::jsonb,'relationFamilies','["text",10]'::jsonb),
  'board','[{"id":"text","definitionId":"text","cardName":"text","x":"number","y":"number","playerId":"number","status":"text"},512]'::jsonb,
  'semanticEdges',jsonb_build_array(jsonb_build_object('id','text','fromCardInstanceId','text','toCardInstanceId','text','relation',rel,'createdBySeatIndex','number','createdAtMoveId','text','createdOrder','number'),2048),
  'scores','["number",4]'::jsonb,'redrawUsed','["boolean",4]'::jsonb,
  'logDetails',jsonb_build_array(jsonb_build_object('index','number','playerId','number','cardName','text','totalGained','number','newTotalScore','number','semanticScore',move_score),512),
  'pendingMove',jsonb_build_object('cardId','text','moveId','text','cardName','text','placedBySeatIndex','number','semanticStatus','text',
   'semanticEdges',jsonb_build_array(jsonb_build_object('id','text','neighborCardInstanceId','text','relation',rel,'direction','text','createdOrder','number'),4),
   'scorePreview',move_score,'voteCounts','{"accept":"number","reject":"number","required":"number"}'::jsonb),
  'pendingFinish','{"id":"text","requestedBy":"number","votes":["boolean",4]}'::jsonb,
  'gameOver','boolean','endReason','text','consecutivePasses','number');
 return game_diagnostics.clean(value,spec);
end;
$$;

create or replace function game_diagnostics.snapshot_from_game(game jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; pending jsonb; player_count integer;
begin
 player_count:=least(4,jsonb_array_length(coalesce(game->'players','[]')));
 pending:=game->'pendingMove';
 result:=jsonb_build_object('formatVersion',1,'scoringVersion',game->'scoringVersion','playerCount',player_count,
  'currentPlayerIndex',game->'currentPlayerIndex','startCardId',game->'startCard'->'id',
  'drawPileCount',case when game ? 'sharedDeck' and jsonb_typeof(game->'sharedDeck')='array' then jsonb_array_length(game->'sharedDeck')
   else (select coalesce(sum(jsonb_array_length(v)),0) from jsonb_array_elements(coalesce(game->'deck','[]')) a(v)) end,
  'deck',game->'deckSnapshot',
  'board',(select coalesce(jsonb_agg(jsonb_build_object('id',v->'id','definitionId',v->'definitionId','cardName',v->'cardName','x',v->'coordinates'->'x','y',v->'coordinates'->'y','playerId',v->'playerId','status',v->'status')),'[]') from jsonb_each(coalesce(game->'board','{}')) a(k,v)),
  'semanticEdges',coalesce(game->'semanticEdges','[]'),'scores',game->'scores',
  'redrawUsed',(select coalesce(jsonb_agg(coalesce(game->'handRedrawUsedByPlayerId'->s::text,'false')),'[]') from generate_series(0,player_count-1) a(s)),
  'logDetails',(select coalesce(jsonb_agg(jsonb_build_object('index',k::integer,'playerId',v->'score'->'playerId','cardName',v->'score'->'cardName','totalGained',v->'score'->'totalGained','newTotalScore',v->'score'->'newTotalScore','semanticScore',v->'score'->'semanticScore') order by k::integer),'[]') from jsonb_each(coalesce(game->'logDetails','{}')) a(k,v)),
  'pendingMove',case when pending is null or pending='null' then 'null'::jsonb else pending||jsonb_build_object(
   'moveId',coalesce(pending->'moveId',pending->'cardId'),'placedBySeatIndex',coalesce(pending->'placedBySeatIndex',pending->'playerIndex'),
   'voteCounts',jsonb_build_object('accept',(select count(*) from jsonb_each_text(coalesce(pending->'votes','{}')) a(k,v) where v='accept'),
    'reject',(select count(*) from jsonb_each_text(coalesce(pending->'votes','{}')) a(k,v) where v='reject'),
    'required',case when jsonb_typeof(pending->'requiredVoters')='array' then jsonb_array_length(pending->'requiredVoters') else greatest(0,player_count-1) end)) end,
  'pendingFinish',case when game->'pendingFinish' is null or game->'pendingFinish'='null' then 'null'::jsonb else jsonb_build_object(
   'id',game->'pendingFinish'->'id','requestedBy',game->'pendingFinish'->'requestedBy',
   'votes',(select coalesce(jsonb_agg(coalesce(game->'pendingFinish'->'votes'->s::text,'null')),'[]') from generate_series(0,player_count-1) a(s))) end,
  'gameOver',game->'gameOver','endReason',game->'endReason','consecutivePasses',coalesce(game->'consecutivePasses','0'));
 return game_diagnostics.clean_snapshot(result);
end;
$$;

create table if not exists game_diagnostics.ingest_quota(actor uuid primary key, window_start timestamptz not null, used integer not null);
revoke all on game_diagnostics.ingest_quota from public,anon,authenticated;
create or replace function public.record_local_diagnostics(events jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare sample jsonb; at_time timestamptz; used_count integer; cleaned jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(events) is distinct from 'array' or jsonb_array_length(events)>4 or octet_length(events::text)>2200000 then raise exception 'Diagnostic batch too large'; end if;
 insert into game_diagnostics.ingest_quota as q values(auth.uid(),now(),jsonb_array_length(events))
 on conflict(actor) do update set used=case when q.window_start+interval '1 minute'<=now() then excluded.used else q.used+excluded.used end,
  window_start=case when q.window_start+interval '1 minute'<=now() then now() else q.window_start end returning used into used_count;
 if used_count>120 then raise exception 'Diagnostic rate limit exceeded'; end if;
 for sample in select value from jsonb_array_elements(events) loop
  if sample->>'source' is distinct from 'local' or length(coalesce(sample->>'session_id','')) not between 1 and 250 or length(coalesce(sample->>'event_id','')) not between 1 and 250
   or sample->>'event_type' is null or sample->>'event_type' not in ('start','resume','submitted','accepted','rejected','cancelled','vote','pass','redraw','finish_proposed','finish_vote','finish_declined','finished')
   or jsonb_typeof(sample->'snapshot') is distinct from 'object' then raise exception 'Invalid diagnostic event'; end if;
  at_time:=(sample->>'occurred_at')::timestamptz;
  if at_time is null or at_time>now()+interval '5 minutes' then raise exception 'Invalid diagnostic time'; end if;
  if at_time<=now()-interval '30 days' then continue; end if;
  cleaned:=game_diagnostics.clean_snapshot(sample->'snapshot');
  insert into game_diagnostics.events(source,session_id,event_id,event_type,occurred_at,expires_at,client_version,snapshot)
  values('local',sample->>'session_id',sample->>'event_id',sample->>'event_type',at_time,least(now(),at_time)+interval '30 days',left(sample->>'client_version',80),cleaned)
  on conflict(source,session_id,event_id) do nothing;
 end loop;
end;
$$;
revoke all on function public.record_local_diagnostics(jsonb) from public,anon;
grant execute on function public.record_local_diagnostics(jsonb) to authenticated;

create or replace function game_diagnostics.capture_room()
returns trigger language plpgsql security definer set search_path='' as $$
declare prior jsonb; game jsonb; kind text; rid uuid; rcode text; ver bigint; sid text;
begin
 if tg_op='DELETE' then
  if old.status='waiting' then return old; end if;
  game:=old.game_state; kind:='room_deleted'; rid:=old.id; rcode:=old.code; ver:=old.version+1;
 else
  if new.status='waiting' then return new; end if;
  game:=new.game_state; rid:=new.id; rcode:=new.code; ver:=new.version;
  if tg_op='INSERT' then prior:='{}'; else prior:=old.game_state; end if;
  if tg_op='INSERT' or old.status='waiting' or prior->'startCard'->>'id' is distinct from game->'startCard'->>'id' then kind:='start';
  elsif coalesce((prior->>'gameOver')::boolean,false)=false and (game->>'gameOver')::boolean then kind:='finished';
  elsif coalesce(prior->'pendingFinish','null')='null' and coalesce(game->'pendingFinish','null')<>'null' then kind:='finish_proposed';
  elsif coalesce(prior->'pendingFinish','null')<>'null' and coalesce(game->'pendingFinish','null')='null' then kind:='finish_declined';
  elsif prior->'pendingFinish'->'votes' is distinct from game->'pendingFinish'->'votes' then kind:='finish_vote';
  elsif jsonb_array_length(coalesce(game->'semanticEdges','[]'))>jsonb_array_length(coalesce(prior->'semanticEdges','[]')) then kind:='accepted';
  elsif coalesce(prior->'pendingMove','null')<>'null' and coalesce(game->'pendingMove','null')='null' then
   kind:=case when prior->'pendingMove'->>'semanticStatus'='voting' then 'rejected' else 'cancelled' end;
  elsif game->'pendingMove'->>'semanticStatus'='voting' and coalesce(prior->'pendingMove'->>'semanticStatus','')<>'voting' then kind:='submitted';
  elsif prior->'pendingMove'->>'semanticStatus'='voting' and prior->'pendingMove'->'votes' is distinct from game->'pendingMove'->'votes' then kind:='vote';
  elsif prior->'consecutivePasses' is distinct from game->'consecutivePasses' then kind:='pass';
  elsif prior->'handRedrawUsedByPlayerId' is distinct from game->'handRedrawUsedByPlayerId' then kind:='redraw';
  else return new; end if;
 end if;
 sid:=game->'startCard'->>'id';
 if sid is not null then
  insert into game_diagnostics.events(source,session_id,event_id,event_type,occurred_at,expires_at,room_id,room_code,server_version,snapshot)
  values('online',sid,ver::text||':'||kind,kind,now(),now()+interval '30 days',rid,rcode,'room-command-v3',game_diagnostics.snapshot_from_game(game))
  on conflict(source,session_id,event_id) do nothing;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
exception when others then
 raise warning 'Diagnostic archive skipped: %',SQLSTATE;
 if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists archive_room_diagnostics on public.rooms;
create trigger archive_room_diagnostics after insert or update or delete on public.rooms for each row execute function game_diagnostics.capture_room();

create or replace function game_diagnostics.export_session(requested_source text, requested_session text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('formatVersion',1,'source',requested_source,'sessionId',requested_session,
  'events',coalesce(jsonb_agg(to_jsonb(e) order by occurred_at,received_at,event_id),'[]'::jsonb))
 from game_diagnostics.events e where e.source=requested_source and e.session_id=requested_session and expires_at>now();
$$;
create or replace function game_diagnostics.export_room(requested_code text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('formatVersion',1,'source','online','roomCode',upper(requested_code),
  'events',coalesce(jsonb_agg(to_jsonb(e) order by occurred_at,received_at,event_id),'[]'::jsonb))
 from game_diagnostics.events e where source='online' and room_code=upper(requested_code) and expires_at>now();
$$;
create or replace function game_diagnostics.purge_expired()
returns bigint language plpgsql security definer set search_path='' as $$
declare deleted_count bigint;
begin
 delete from game_diagnostics.events where expires_at<=now(); get diagnostics deleted_count=row_count;
 delete from game_diagnostics.ingest_quota where window_start<now()-interval '1 day';
 return deleted_count;
end;
$$;
revoke all on all functions in schema game_diagnostics from public,anon,authenticated;
grant execute on function game_diagnostics.export_session(text,text),game_diagnostics.export_room(text),game_diagnostics.purge_expired() to service_role;

-- Expired rows are hidden immediately by export functions and physically removed hourly.
create extension if not exists pg_cron with schema pg_catalog;
do $$ declare job bigint; begin
 for job in select jobid from cron.job where jobname='game-diagnostics-retention' loop perform cron.unschedule(job); end loop;
 perform cron.schedule('game-diagnostics-retention','17 * * * *','select game_diagnostics.purge_expired()');
end $$;
notify pgrst,'reload schema';
commit;
