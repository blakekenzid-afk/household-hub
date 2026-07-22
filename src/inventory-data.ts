export const ROOMS = [
  'Kitchen',
  'Living Room',
  'Bedroom',
  'Bathroom',
  'Garage',
  'Office',
  'Storage',
  'Outdoor',
  'Other',
]

const ROOM_COLORS: Record<string, string> = {
  Kitchen: '#EA580C',
  'Living Room': '#7C3AED',
  Bedroom: '#2563EB',
  Bathroom: '#0891B2',
  Garage: '#6E6E73',
  Office: '#D97706',
  Storage: '#16A34A',
  Outdoor: '#059669',
}

export function roomColor(room: string): string {
  return ROOM_COLORS[room] ?? '#DB2777'
}
