import React, { useState, useMemo } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { Vehicle, VehicleStatus } from '../types';
import { StatusBadge } from '../components/common/Badge';
import { BottomNav } from '../components/layout/BottomNav';
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Car,
} from 'lucide-react';

export const VehiclesListPage: React.FC = () => {
  const { navigate, showToast } = useNavigation();
  const dealership = storageService.getDealership();
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => storageService.getVehicles());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);

  const refreshVehicles = async () => {
    const list = await storageService.getVehiclesAsync();
    setVehicles(list);
  };

  React.useEffect(() => {
    if (storageService.isSupabaseMode()) {
      storageService.getVehiclesAsync().then(setVehicles).catch(() => {});
    }
  }, []);

  const handleStatusChange = async (id: string, newStatus: VehicleStatus) => {
    await storageService.updateVehicleAsync(id, { status: newStatus });
    refreshVehicles();
    showToast(`Status updated to ${newStatus}`);
  };

  const confirmDelete = async () => {
    if (vehicleToDelete) {
      await storageService.deleteVehicleAsync(vehicleToDelete.id);
      refreshVehicles();
      showToast(`${vehicleToDelete.make} ${vehicleToDelete.model} deleted`);
      setVehicleToDelete(null);
    }
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const text = `${v.year} ${v.make} ${v.model} ${v.colour || ''}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [vehicles, statusFilter, search]);

  return (
    <div className="dl-workspace relative min-h-full flex flex-col justify-between bg-[#F8F9FA] text-slate-900">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-base font-extrabold text-slate-950 tracking-tight">
            Vehicle Inventory
          </h1>
          <p className="text-[11px] text-slate-500 font-medium">
            {filteredVehicles.length} vehicles in stock
          </p>
        </div>

        <button
          onClick={() => navigate('/app/vehicles/new')}
          className="h-9 px-3.5 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add vehicle</span>
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 px-5 py-3 overflow-y-auto pb-24">
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search make, model, year..."
            className="w-full h-10 pl-9 pr-3 text-xs rounded-xl bg-white border border-slate-200 focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-400 shadow-2xs"
          />
        </div>

        {/* Status Filter Tabs (Segmented control) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2.5 no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'available', label: 'Available' },
            { id: 'reserved', label: 'Reserved' },
            { id: 'sold', label: 'Sold' },
            { id: 'draft', label: 'Draft' },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Vehicle List */}
        {filteredVehicles.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
              <Car className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">No vehicles found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search or status filter.'
                : 'Get started by adding your first vehicle to DriveLink.'}
            </p>
            <button
              onClick={() => navigate('/app/vehicles/new')}
              className="mt-4 px-4 py-2 rounded-full bg-slate-950 text-white text-xs font-bold"
            >
              Add New Vehicle
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs flex flex-col gap-2.5 hover:border-slate-200 transition-all"
              >
                {/* Main Row */}
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="w-16 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={vehicle.photos[0]}
                      alt={`${vehicle.make} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-bold text-xs text-slate-900 truncate">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                      <StatusBadge status={vehicle.status} size="sm" />
                    </div>
                    <p className="text-xs font-extrabold text-slate-950 mt-0.5">
                      ${vehicle.price.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {vehicle.mileageKm.toLocaleString()} km · {vehicle.transmission} · {vehicle.fuel}
                    </p>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  {/* Status Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-400">Status:</span>
                    <select
                      value={vehicle.status}
                      onChange={(e) => handleStatusChange(vehicle.id, e.target.value as VehicleStatus)}
                      className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:outline-none"
                    >
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                      <option value="sold">Sold</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>

                  {/* Edit, Preview, Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/app/vehicles/${vehicle.id}`)}
                      className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                      title="Edit vehicle"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        navigate(`/showroom/${dealership.slug}/vehicle/${vehicle.id}`)
                      }
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Preview public listing"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setVehicleToDelete(vehicle)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete vehicle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {vehicleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-2xl text-center flex flex-col gap-3">
            <h3 className="font-bold text-sm text-slate-900">Delete Vehicle?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to remove {vehicleToDelete.year} {vehicleToDelete.make}{' '}
              {vehicleToDelete.model} from your inventory?
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => setVehicleToDelete(null)}
                className="py-2 rounded-xl bg-slate-100 font-semibold text-xs text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="py-2 rounded-xl bg-rose-600 font-semibold text-xs text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation */}
      <BottomNav />
    </div>
  );
};
