# Guest sessions and authoritative online commands

Status: server function, guest authentication and SQL migration deployed on 2026-10-09. Three independent guest sessions passed the live command/authorization smoke test.

Players do not register or enter email. Supabase anonymous authentication issues a signed session; a localStorage UUID is no longer authorization. Clearing app data loses access to that guest's rooms. Future account linking is separate work.

## Deployment order

1. Enable anonymous sign-ins in Supabase Authentication. Keep signup IP rate limiting enabled; per-user quotas alone cannot stop mass guest creation.
2. Run `npm run build:server`. Deploy `supabase/functions/room-command/index.ts` as `room-command` to the existing project. It requires standard SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY server secrets. Never put the service key in VITE variables. The handler verifies bearer tokens using Auth getUser.
3. During a coordinated client update, apply `supabase/secure-online.sql` after the existing accepted-relations migration. The SQL is transactional and repeatable. It revokes direct client writes and anonymous reads. Old protocol-1 rooms remain stored but become inaccessible; old APKs cannot use online until updated.
4. Publish the guest-auth web client and rebuild APK. Test two independent guest sessions: create/join/start/place/link/submit/vote/reconnect/delete. Also test outsider reads, forged updates and duplicate votes.
5. Do not claim rollout complete before these real-service tests pass.

## Limits and boundaries

- Five room creations per guest per hour; 120 other commands per minute.
- Thirty local collection batches per guest per minute, max 50 samples / 100 KB per batch.
- Command request bodies limited to 12 KB while streaming.
- Server owns initialization, turn order, accepted scores and membership; CAS retries merge concurrent votes without moving votes to a later proposal.
- Only the host can start/delete; only members can act; author cannot vote.
- Waiting rooms are discoverable. Active rooms are readable only by their members.
- Hands still reside in shared JSON. This does not hide hands from another participant.
- Local samples remain untrusted observations; rate limiting is not proof of an actual vote.

## Verification

`npm test`, `npm run build`, `npm run lint`, `npm run build:server`.
Local PostgreSQL verified repeated migration application, role privileges and sixth-create rejection. Live service checks passed for guest sign-in, create/join/start, unauthorized start/delete, outsider read denial, direct update denial, place/link/submit/vote/scoring, repeated vote denial, reconnect and authenticated collection. Physical-device checks remain outstanding.
