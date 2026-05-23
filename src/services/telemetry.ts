/**
 * Telemetry Service
 * Fetches live PV and sensor data from Node-RED telemetry API
 */

export interface TelemetryData {
  device_id: string;
  connected: boolean;
  voltage: number | null;
  current: number | null;
  power: number | null;
  temperature: number | null;
  irradiance: number | null;
  timestamp: string;
}

const telemetryApiUrl = import.meta.env.VITE_TELEMETRY_API_URL || 'http://localhost:1880';

if (!import.meta.env.VITE_TELEMETRY_API_URL && typeof window !== 'undefined') {
  console.warn(
    'VITE_TELEMETRY_API_URL not configured. Defaulting to http://localhost:1880. Set VITE_TELEMETRY_API_URL in .env to use a different telemetry server.'
  );
}

/**
 * Fetch live telemetry data for a specific device
 * @param deviceId Device ID to fetch telemetry for
 * @returns Promise resolving to TelemetryData or null if device not found/offline
 */
export async function getLiveTelemetry(deviceId: string): Promise<TelemetryData | null> {
  if (!deviceId) {
    throw new Error('Device ID is required');
  }

  try {
    const response = await fetch(`${telemetryApiUrl}/api/telemetry/${deviceId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Device not found
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: TelemetryData = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to fetch telemetry for device ${deviceId}:`, error);
    throw error;
  }
}

/**
 * Fetch historical telemetry data for a specific device from InfluxDB via Node-RED proxy
 * @param deviceId Device ID to fetch telemetry for
 * @param startIso Start date in ISO format or relative (e.g. -30d)
 * @param endIso End date in ISO format
 * @returns Promise resolving to an array of TelemetryData
 */
export async function getHistoricalTelemetry(
  deviceId: string,
  startIso?: string,
  endIso?: string
): Promise<TelemetryData[]> {
  if (!deviceId) {
    throw new Error('Device ID is required');
  }

  try {
    const url = new URL(`${telemetryApiUrl}/api/analytics/${deviceId}`);
    if (startIso) {
      url.searchParams.append('start', startIso);
    }
    if (endIso) {
      url.searchParams.append('end', endIso);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any[] = await response.json();
    return data.map((item) => ({
      device_id: deviceId,
      connected: true,
      voltage: item.voltage,
      current: item.current,
      power: item.power,
      temperature: item.temperature,
      irradiance: item.irradiance,
      timestamp: item.timestamp,
    }));
  } catch (error) {
    console.error(`Failed to fetch historical telemetry for device ${deviceId}:`, error);
    throw error;
  }
}

/**
 * Format telemetry value for display
 */
export function formatTelemetryValue(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value === null || value === undefined) {
    return 'No data';
  }
  return value.toFixed(decimals);
}

/**
 * Determine connection status label and variant
 */
export function getTelemetryStatus(
  connected: boolean | null | undefined
): { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' } {
  if (connected === true) {
    return { label: 'Live', variant: 'success' };
  }
  if (connected === false) {
    return { label: 'Offline', variant: 'error' };
  }
  return { label: 'Unknown', variant: 'neutral' };
}

/**
 * Get formatted last update time
 */
export function getLastUpdateTime(timestamp: string | null | undefined): string {
  if (!timestamp) {
    return 'Never';
  }

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) {
      return `${diffSecs}s ago`;
    }
    if (diffSecs < 3600) {
      const mins = Math.floor(diffSecs / 60);
      return `${mins}m ago`;
    }
    if (diffSecs < 86400) {
      const hours = Math.floor(diffSecs / 3600);
      return `${hours}h ago`;
    }
    return date.toLocaleTimeString();
  } catch {
    return 'Invalid timestamp';
  }
}
