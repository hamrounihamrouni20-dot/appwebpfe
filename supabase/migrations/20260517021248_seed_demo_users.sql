/*
  # Seed Demo Users

  Creates three demo accounts for testing all three roles.
  Uses DO block to avoid conflicts on re-run.
*/

DO $$
DECLARE
  admin_id uuid;
  tech_id uuid;
  user_id uuid;
BEGIN
  -- Create admin user
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@solarwatch.io') THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      admin_id, '00000000-0000-0000-0000-000000000000',
      'admin@solarwatch.io', crypt('admin123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Alex Wright","role":"admin"}',
      'authenticated', 'authenticated', now(), now(), '', '', '', ''
    );
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (admin_id, 'admin@solarwatch.io', 'Alex Wright', 'admin')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Create technician user
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'tech@solarwatch.io') THEN
    tech_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      tech_id, '00000000-0000-0000-0000-000000000000',
      'tech@solarwatch.io', crypt('tech123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Raj Patel","role":"technician"}',
      'authenticated', 'authenticated', now(), now(), '', '', '', ''
    );
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (tech_id, 'tech@solarwatch.io', 'Raj Patel', 'technician')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Create regular user
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user@solarwatch.io') THEN
    user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      user_id, '00000000-0000-0000-0000-000000000000',
      'user@solarwatch.io', crypt('user123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Emma Johnson","role":"user"}',
      'authenticated', 'authenticated', now(), now(), '', '', '', ''
    );
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (user_id, 'user@solarwatch.io', 'Emma Johnson', 'user')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
