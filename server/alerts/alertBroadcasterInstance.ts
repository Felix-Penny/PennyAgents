/**
 * Singleton AlertBroadcaster Instance
 * Provides a shared instance for real-time notifications across all services
 */

import { AlertBroadcaster } from "./alertBroadcaster";

// Create singleton instance
let alertBroadcaster: AlertBroadcaster | null = null;

/**
 * Get the singleton AlertBroadcaster instance
 */
export function getAlertBroadcaster(): AlertBroadcaster {
  if (!alertBroadcaster) {
    alertBroadcaster = new AlertBroadcaster();
    console.log('AlertBroadcaster singleton instance created');
  }
  return alertBroadcaster;
}

/**
 * Export the singleton instance directly for convenience
 */
export const alertBroadcasterInstance = getAlertBroadcaster();

export default alertBroadcasterInstance;