import type { Vehicle } from '../../types';

export function pickShowcaseVehicles(vehicles: Vehicle[]): Vehicle[] {
  const newestFirst = (a: Vehicle, b: Vehicle) => {
    const aTime = Date.parse(a.createdAt || '');
    const bTime = Date.parse(b.createdAt || '');
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  };
  const available = vehicles.filter(vehicle => vehicle.status === 'available').sort(newestFirst);
  const reserved = vehicles.filter(vehicle => vehicle.status === 'reserved').sort(newestFirst);
  return [...available, ...reserved].slice(0, 3);
}
