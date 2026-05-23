/*
  # SolarWatch - Full Schema Migration

  ## Tables Created
  - `roles` - User roles (admin, technician, user)
  - `profiles` - Extended user profiles linked to auth.users
  - `installations` - PV system installations
  - `sensors` - Sensors assigned to installations
  - `pv_data` - Time-series sensor readings
  - `tickets` - Support tickets
  - `ticket_notes` - Technician notes on tickets
  - `alerts` - System alerts
  - `predictions` - AI energy predictions
  - `notifications` - User notifications

  ## Security
  - RLS enabled on all tables
  - Role-based access policies
*/

-- Roles enum
CREATE TYPE user_role AS ENUM ('admin', 'technician', 'user');

-- Ticket status enum
CREATE TYPE ticket_status AS ENUM ('pending', 'assigned', 'in_progress', 'resolved', 'closed');

-- Ticket priority enum
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Alert type enum
CREATE TYPE alert_type AS ENUM ('high_temperature', 'low_production', 'system_offline', 'sensor_anomaly', 'general');

-- Alert severity enum
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');

-- Installation status enum
CREATE TYPE installation_status AS ENUM ('active', 'inactive', 'maintenance', 'fault');

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'user',
  phone text DEFAULT '',
  address text DEFAULT '',
  avatar_url text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Installations table
CREATE TABLE IF NOT EXISTS installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  address text NOT NULL DEFAULT '',
  latitude decimal(10,7),
  longitude decimal(10,7),
  capacity_kw decimal(10,3) NOT NULL DEFAULT 0,
  panel_count integer NOT NULL DEFAULT 0,
  installation_date date,
  status installation_status NOT NULL DEFAULT 'active',
  inverter_model text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sensors table
CREATE TABLE IF NOT EXISTS sensors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  name text NOT NULL,
  sensor_type text NOT NULL DEFAULT 'multi',
  device_id text UNIQUE NOT NULL,
  is_online boolean NOT NULL DEFAULT true,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PV data table (time-series readings)
CREATE TABLE IF NOT EXISTS pv_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  sensor_id uuid REFERENCES sensors(id) ON DELETE SET NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  voltage decimal(8,3),
  current_a decimal(8,3),
  power_w decimal(10,3),
  temperature_c decimal(6,2),
  irradiance_wm2 decimal(8,2),
  energy_kwh decimal(10,4),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pv_data_installation_timestamp ON pv_data(installation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pv_data_timestamp ON pv_data(timestamp DESC);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status ticket_status NOT NULL DEFAULT 'pending',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  installation_id uuid REFERENCES installations(id) ON DELETE SET NULL,
  image_url text DEFAULT '',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ticket notes table
CREATE TABLE IF NOT EXISTS ticket_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL DEFAULT 'general',
  severity alert_severity NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  is_resolved boolean NOT NULL DEFAULT false,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  prediction_date date NOT NULL,
  predicted_kwh decimal(10,4) NOT NULL DEFAULT 0,
  confidence_pct decimal(5,2) NOT NULL DEFAULT 0,
  model_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  link text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==================== RLS ====================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pv_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_user_role(uid uuid)
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = uid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR get_user_role(auth.uid()) IN ('admin', 'technician'));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR get_user_role(auth.uid()) = 'admin')
  WITH CHECK (auth.uid() = id OR get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin' OR auth.uid() = id);

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- INSTALLATIONS policies
CREATE POLICY "Users can view own installations"
  ON installations FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('admin', 'technician')
  );

CREATE POLICY "Admins can insert installations"
  ON installations FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update installations"
  ON installations FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete installations"
  ON installations FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin');

-- SENSORS policies
CREATE POLICY "Authenticated users can view sensors"
  ON sensors FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'technician')
    OR EXISTS (
      SELECT 1 FROM installations i
      WHERE i.id = sensors.installation_id AND i.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage sensors"
  ON sensors FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update sensors"
  ON sensors FOR UPDATE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- PV DATA policies
CREATE POLICY "Users can view own installation pv data"
  ON pv_data FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'technician')
    OR EXISTS (
      SELECT 1 FROM installations i
      WHERE i.id = pv_data.installation_id AND i.owner_id = auth.uid()
    )
  );

CREATE POLICY "System can insert pv data"
  ON pv_data FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'technician'));

-- TICKETS policies
CREATE POLICY "Users can view own tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR get_user_role(auth.uid()) IN ('admin', 'technician')
  );

CREATE POLICY "Users can create tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own tickets or assigned technicians"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR get_user_role(auth.uid()) IN ('admin', 'technician')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR get_user_role(auth.uid()) IN ('admin', 'technician')
  );

-- TICKET NOTES policies
CREATE POLICY "Ticket participants can view notes"
  ON ticket_notes FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'technician')
    OR EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_notes.ticket_id AND (t.created_by = auth.uid())
      AND NOT ticket_notes.is_internal
    )
  );

CREATE POLICY "Tech and admin can add notes"
  ON ticket_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND get_user_role(auth.uid()) IN ('admin', 'technician')
    OR author_id = auth.uid()
  );

-- ALERTS policies
CREATE POLICY "Users can view own installation alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'technician')
    OR EXISTS (
      SELECT 1 FROM installations i
      WHERE i.id = alerts.installation_id AND i.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'technician'));

CREATE POLICY "Users can update alert read status"
  ON alerts FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'technician')
    OR EXISTS (
      SELECT 1 FROM installations i
      WHERE i.id = alerts.installation_id AND i.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) IN ('admin', 'technician')
    OR EXISTS (
      SELECT 1 FROM installations i
      WHERE i.id = alerts.installation_id AND i.owner_id = auth.uid()
    )
  );

-- PREDICTIONS policies
CREATE POLICY "Users can view own installation predictions"
  ON predictions FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('admin', 'technician')
    OR EXISTS (
      SELECT 1 FROM installations i
      WHERE i.id = predictions.installation_id AND i.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage predictions"
  ON predictions FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- NOTIFICATIONS policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'technician') OR user_id = auth.uid());

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER installations_updated_at BEFORE UPDATE ON installations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create or replace function to add profile when an auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a row into public.profiles for new auth users if one does not exist
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
          COALESCE((NEW.raw_user_meta_data->>'role')::text, 'user'), now(), now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to create a profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
