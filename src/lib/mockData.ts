import type { Profile, Installation, PvData, Ticket, Alert, Prediction } from './database.types';

// Generate hourly PV data for the last 7 days
export function generatePvData(installationId: string, days = 7): PvData[] {
  const data: PvData[] = [];
  const now = new Date();

  for (let d = days; d >= 0; d--) {
    for (let h = 0; h < 24; h++) {
      const ts = new Date(now);
      ts.setDate(ts.getDate() - d);
      ts.setHours(h, 0, 0, 0);

      // Solar irradiance follows a bell curve during daylight hours
      const hour = h;
      const irradiance = hour >= 6 && hour <= 20
        ? Math.max(0, 1000 * Math.sin(((hour - 6) / 14) * Math.PI) * (0.7 + Math.random() * 0.3))
        : 0;

      const power = irradiance > 0 ? irradiance * 4.8 * (0.85 + Math.random() * 0.1) : 0;
      const voltage = irradiance > 0 ? 360 + Math.random() * 40 : 0;
      const current = voltage > 0 ? power / voltage : 0;
      const temp = 20 + (irradiance / 1000) * 25 + Math.random() * 5;
      const energy = power / 1000;

      data.push({
        id: `mock-${d}-${h}`,
        installation_id: installationId,
        sensor_id: null,
        timestamp: ts.toISOString(),
        voltage: parseFloat(voltage.toFixed(2)),
        current_a: parseFloat(current.toFixed(3)),
        power_w: parseFloat(power.toFixed(2)),
        temperature_c: parseFloat(temp.toFixed(2)),
        irradiance_wm2: parseFloat(irradiance.toFixed(2)),
        energy_kwh: parseFloat(energy.toFixed(4)),
        created_at: ts.toISOString(),
      });
    }
  }

  return data;
}

// Generate daily aggregated data
export function generateDailyData(days = 30): { date: string; kwh: number; peak_w: number }[] {
  const data = [];
  const now = new Date();

  for (let d = days; d >= 0; d--) {
    const ts = new Date(now);
    ts.setDate(ts.getDate() - d);
    const month = ts.getMonth();
    // Simulate seasonal variation
    const seasonFactor = 0.6 + 0.4 * Math.sin(((month - 2) / 12) * 2 * Math.PI);
    const kwh = parseFloat((25 + seasonFactor * 20 + (Math.random() - 0.5) * 8).toFixed(2));
    const peak_w = parseFloat((kwh * 200 + Math.random() * 500).toFixed(0));

    data.push({
      date: ts.toISOString().split('T')[0],
      kwh,
      peak_w,
    });
  }

  return data;
}

export const mockInstallations: Installation[] = [
  {
    id: 'inst-001',
    name: 'Rooftop Array Alpha',
    owner_id: 'user-001',
    address: '123 Solar Ave, Sunnyvale, CA 94086',
    latitude: 37.3688,
    longitude: -122.0363,
    capacity_kw: 12.5,
    panel_count: 40,
    installation_date: '2023-03-15',
    status: 'active',
    inverter_model: 'SolarEdge SE10000H',
    notes: 'Main residential installation',
    created_at: '2023-03-15T08:00:00Z',
    updated_at: '2024-01-10T12:00:00Z',
  },
  {
    id: 'inst-002',
    name: 'Commercial Park B',
    owner_id: 'user-002',
    address: '456 Energy Blvd, Phoenix, AZ 85001',
    latitude: 33.4484,
    longitude: -112.074,
    capacity_kw: 48.0,
    panel_count: 160,
    installation_date: '2022-11-20',
    status: 'active',
    inverter_model: 'Fronius Symo 48.0',
    notes: 'Commercial rooftop installation',
    created_at: '2022-11-20T08:00:00Z',
    updated_at: '2024-01-08T09:00:00Z',
  },
  {
    id: 'inst-003',
    name: 'Ground Mount Gamma',
    owner_id: 'user-001',
    address: '789 Photon Rd, Denver, CO 80201',
    latitude: 39.7392,
    longitude: -104.9903,
    capacity_kw: 22.0,
    panel_count: 72,
    installation_date: '2023-07-01',
    status: 'maintenance',
    inverter_model: 'Huawei SUN2000',
    notes: 'Ground mounted tracker system',
    created_at: '2023-07-01T08:00:00Z',
    updated_at: '2024-01-12T15:00:00Z',
  },
];

export const mockProfiles: Profile[] = [
  {
    id: 'user-001',
    full_name: 'Emma Johnson',
    email: 'emma.johnson@example.com',
    role: 'user',
    phone: '+1 (555) 234-5678',
    address: '123 Solar Ave, Sunnyvale, CA',
    avatar_url: '',
    is_active: true,
    created_at: '2023-01-15T08:00:00Z',
    updated_at: '2024-01-10T12:00:00Z',
  },
  {
    id: 'user-002',
    full_name: 'Carlos Mendez',
    email: 'carlos.m@example.com',
    role: 'user',
    phone: '+1 (555) 876-5432',
    address: '456 Energy Blvd, Phoenix, AZ',
    avatar_url: '',
    is_active: true,
    created_at: '2022-10-05T08:00:00Z',
    updated_at: '2024-01-08T09:00:00Z',
  },
  {
    id: 'tech-001',
    full_name: 'Raj Patel',
    email: 'raj.patel@solarwatch.io',
    role: 'technician',
    phone: '+1 (555) 111-2222',
    address: 'SolarWatch HQ',
    avatar_url: '',
    is_active: true,
    created_at: '2022-06-01T08:00:00Z',
    updated_at: '2024-01-12T15:00:00Z',
  },
  {
    id: 'tech-002',
    full_name: 'Sofia Torres',
    email: 'sofia.torres@solarwatch.io',
    role: 'technician',
    phone: '+1 (555) 333-4444',
    address: 'SolarWatch HQ',
    avatar_url: '',
    is_active: true,
    created_at: '2023-03-10T08:00:00Z',
    updated_at: '2024-01-11T10:00:00Z',
  },
  {
    id: 'admin-001',
    full_name: 'Alex Wright',
    email: 'admin@solarwatch.io',
    role: 'admin',
    phone: '+1 (555) 999-0000',
    address: 'SolarWatch HQ',
    avatar_url: '',
    is_active: true,
    created_at: '2022-01-01T08:00:00Z',
    updated_at: '2024-01-15T08:00:00Z',
  },
];

export const mockTickets: Ticket[] = [
  {
    id: 'ticket-001',
    title: 'Inverter showing error code E07',
    description: 'The inverter on my rooftop system has been displaying error code E07 since yesterday afternoon. Production dropped significantly.',
    status: 'assigned',
    priority: 'high',
    created_by: 'user-001',
    assigned_to: 'tech-001',
    installation_id: 'inst-001',
    image_url: '',
    resolved_at: null,
    created_at: '2024-01-14T09:30:00Z',
    updated_at: '2024-01-14T11:00:00Z',
  },
  {
    id: 'ticket-002',
    title: 'Panel output inconsistency detected',
    description: 'Some panels in the eastern array are producing 30% less than expected. Possible shading or soiling issue.',
    status: 'in_progress',
    priority: 'medium',
    created_by: 'user-002',
    assigned_to: 'tech-002',
    installation_id: 'inst-002',
    image_url: '',
    resolved_at: null,
    created_at: '2024-01-13T14:00:00Z',
    updated_at: '2024-01-14T08:00:00Z',
  },
  {
    id: 'ticket-003',
    title: 'Temperature sensor sending anomalous readings',
    description: 'Temperature sensor is reporting 95°C which is clearly incorrect. Possible sensor failure.',
    status: 'pending',
    priority: 'critical',
    created_by: 'user-001',
    assigned_to: null,
    installation_id: 'inst-003',
    image_url: '',
    resolved_at: null,
    created_at: '2024-01-15T07:45:00Z',
    updated_at: '2024-01-15T07:45:00Z',
  },
  {
    id: 'ticket-004',
    title: 'Annual maintenance request',
    description: 'Requesting scheduled annual cleaning and inspection for all panels.',
    status: 'resolved',
    priority: 'low',
    created_by: 'user-002',
    assigned_to: 'tech-001',
    installation_id: 'inst-002',
    image_url: '',
    resolved_at: '2024-01-10T16:00:00Z',
    created_at: '2024-01-05T10:00:00Z',
    updated_at: '2024-01-10T16:00:00Z',
  },
];

export const mockAlerts: Alert[] = [
  {
    id: 'alert-001',
    installation_id: 'inst-003',
    alert_type: 'high_temperature',
    severity: 'critical',
    title: 'Critical Temperature Alert',
    message: 'Panel temperature exceeded 75°C threshold. Immediate inspection recommended.',
    is_read: false,
    is_resolved: false,
    triggered_at: '2024-01-15T13:20:00Z',
    resolved_at: null,
    created_at: '2024-01-15T13:20:00Z',
  },
  {
    id: 'alert-002',
    installation_id: 'inst-001',
    alert_type: 'low_production',
    severity: 'warning',
    title: 'Below Expected Production',
    message: 'Daily production is 35% below forecast. Possible cloud cover or soiling.',
    is_read: false,
    is_resolved: false,
    triggered_at: '2024-01-14T18:00:00Z',
    resolved_at: null,
    created_at: '2024-01-14T18:00:00Z',
  },
  {
    id: 'alert-003',
    installation_id: 'inst-002',
    alert_type: 'sensor_anomaly',
    severity: 'warning',
    title: 'Sensor Data Anomaly',
    message: 'Current sensor reading is 15% outside normal range.',
    is_read: true,
    is_resolved: false,
    triggered_at: '2024-01-13T10:30:00Z',
    resolved_at: null,
    created_at: '2024-01-13T10:30:00Z',
  },
  {
    id: 'alert-004',
    installation_id: 'inst-001',
    alert_type: 'system_offline',
    severity: 'critical',
    title: 'Inverter Communication Lost',
    message: 'No data received from inverter for over 2 hours.',
    is_read: true,
    is_resolved: true,
    triggered_at: '2024-01-12T08:00:00Z',
    resolved_at: '2024-01-12T10:30:00Z',
    created_at: '2024-01-12T08:00:00Z',
  },
];

export function generatePredictions(installationId: string, days = 30): Prediction[] {
  const predictions: Prediction[] = [];
  const now = new Date();

  for (let d = 1; d <= days; d++) {
    const ts = new Date(now);
    ts.setDate(ts.getDate() + d);
    const month = ts.getMonth();
    const seasonFactor = 0.6 + 0.4 * Math.sin(((month - 2) / 12) * 2 * Math.PI);
    const base = 22 + seasonFactor * 18;
    const randomFactor = 1 + (Math.random() - 0.5) * 0.15;
    const predicted = parseFloat((base * randomFactor).toFixed(2));
    const confidence = parseFloat((95 - d * 0.5 + Math.random() * 3).toFixed(1));

    predictions.push({
      id: `pred-${d}`,
      installation_id: installationId,
      prediction_date: ts.toISOString().split('T')[0],
      predicted_kwh: predicted,
      confidence_pct: Math.min(98, Math.max(60, confidence)),
      model_version: 'v2.1',
      created_at: now.toISOString(),
    });
  }

  return predictions;
}

export function getCurrentPvReading() {
  const hour = new Date().getHours();
  const isDaytime = hour >= 6 && hour <= 20;
  const irradiance = isDaytime
    ? Math.max(0, 850 * Math.sin(((hour - 6) / 14) * Math.PI) + (Math.random() - 0.5) * 100)
    : 0;

  return {
    voltage: isDaytime ? 380 + Math.random() * 20 : 0,
    current: isDaytime ? 18 + Math.random() * 4 : 0,
    power: irradiance > 0 ? irradiance * 4.5 * (0.85 + Math.random() * 0.1) : 0,
    temperature: 22 + (irradiance / 1000) * 28 + Math.random() * 3,
    irradiance,
    energyToday: isDaytime ? 12.4 + Math.random() * 3 : 0.2,
  };
}
