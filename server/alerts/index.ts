/**
 * Alert System Entry Point - Singleton AlertBroadcaster and Shared Services
 * Central hub for all alert broadcasting and subscription management
 */

import { AlertBroadcaster } from "./alertBroadcaster";
import { AlertEngine } from "./alertEngine";
import { AIDetectionIntegration } from "./aiDetectionIntegration";

/**
 * CRITICAL: Single shared AlertBroadcaster instance
 * This ensures all alert subscriptions and broadcasts go through one centralized instance,
 * preventing the broken state where different components have isolated broadcaster instances.
 */
export const alertBroadcaster = new AlertBroadcaster();

/**
 * Shared AlertEngine that uses the singleton broadcaster
 */
export const alertEngine = new AlertEngine(alertBroadcaster);

/**
 * Shared AI Detection Integration that uses the singleton broadcaster
 */
export const aiDetectionIntegration = new AIDetectionIntegration(undefined, alertBroadcaster);

// Re-export types for convenience
export type { AlertMessage, AlertSubscription } from "./alertBroadcaster";
export type { AlertClassification, AlertContext } from "./alertEngine";
export type { AIDetectionConfig, DetectionToAlertTransform } from "./aiDetectionIntegration";