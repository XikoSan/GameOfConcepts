import { build } from 'rolldown';
await build({ input: 'server/room-command.ts', platform: 'neutral',
  transform: { define: { 'import.meta.env.DEV': 'false' } },
  external: ['@supabase/supabase-js'],
  output: { file: 'supabase/functions/room-command/index.ts', format: 'esm',
    paths: { '@supabase/supabase-js': 'npm:@supabase/supabase-js@2.107.0' } } });
