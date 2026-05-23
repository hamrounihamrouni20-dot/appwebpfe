export type UserRole = 'admin' | 'technician' | 'user';
export type TicketStatus = 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'high_temperature' | 'low_production' | 'system_offline' | 'sensor_anomaly' | 'general';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type InstallationStatus = 'active' | 'inactive' | 'maintenance' | 'fault';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone: string;
  address: string;
  avatar_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Installation {
  id: string;
  name: string;
  owner_id: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  capacity_kw: number;
  panel_count: number;
  installation_date: string | null;
  status: InstallationStatus;
  inverter_model: string;
  notes: string;
  device_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Sensor {
  id: string;
  installation_id: string;
  name: string;
  sensor_type: string;
  device_id: string;
  is_online: boolean;
  last_seen: string;
  created_at: string;
}

export interface PvData {
  id: string;
  installation_id: string;
  sensor_id: string | null;
  timestamp: string;
  voltage: number | null;
  current_a: number | null;
  power_w: number | null;
  temperature_c: number | null;
  irradiance_wm2: number | null;
  energy_kwh: number | null;
  created_at: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_by: string;
  assigned_to: string | null;
  installation_id: string | null;
  image_url: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketNote {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  installation_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  is_read: boolean;
  is_resolved: boolean;
  triggered_at: string;
  resolved_at: string | null;
  created_at: string;
}

export interface Prediction {
  id: string;
  installation_id: string;
  prediction_date: string;
  predicted_kwh: number;
  confidence_pct: number;
  model_version: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
