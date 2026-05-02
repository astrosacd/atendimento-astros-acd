// Pequenos helpers de cor — convertem HSL CSS var em hex pra Three.js
// (precisamos de hex porque material.color não aceita hsl(var(--x)))
export const AGENT_HEX: Record<string, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  cyan: '#06b6d4',
};

export const STATUS_HEX: Record<string, string> = {
  idle: '#6b7280',
  working: '#22c55e',
  thinking: '#f59e0b',
  talking: '#3b82f6',
  error: '#ef4444',
};

export const ROOM_PALETTE = {
  floor: '#e8d9c0',
  wall: '#cdd3dc',
  wallTrim: '#8a96a8',
  desk: '#7c5a3a',
  deskTop: '#a87b50',
  monitor: '#1a2030',
  monitorScreen: '#1f6feb',
  chair: '#3b4252',
  plantPot: '#a0522d',
  plantLeaf: '#3aa55a',
  hologram: '#3b82f6',
};
