import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(Boolean).map(line => line.split('=')));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const queries = [
  "id, email, full_name, role, tickets!created_by(id)",
  "id, email, full_name, role, tickets!assigned_to(id)",
  "id, email, full_name, role, tickets!created_by(*), installations(id)",
  "id, email, full_name, role, tickets!assigned_to(*), installations(id)"
];
for (const q of queries) {
  const res = await supabase.from('profiles').select(q).limit(1);
  console.log('QUERY:', q);
  console.log('ERROR:', JSON.stringify(res.error, null, 2));
  console.log('DATA LENGTH:', res.data ? res.data.length : null);
}
