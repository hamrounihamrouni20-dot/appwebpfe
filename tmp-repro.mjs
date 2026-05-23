import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(Boolean).map(line => line.split('=').map((s, i) => i ? decodeURIComponent(s) : s)));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const res = await supabase
  .from('profiles')
  .select('id, email, full_name, role, phone, address, avatar_url, is_active, created_at, updated_at, installations(id), tickets(id)')
  .order('created_at', { ascending: false });
console.log('error', JSON.stringify(res.error, null, 2));
console.log('data sample', res.data ? res.data.slice(0, 1) : null);
