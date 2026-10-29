import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { Vehicle, VehicleStatus, TransmissionType, FuelType } from '../types';
import {
  CAR_AQUA_WHITE,
  CAR_FIT_NAVY,
  CAR_CX5_RED,
  CAR_RAV4_SILVER,
  CAR_RANGER_WHITE,
  CAR_MERC_BLACK,
  CAR_INTERIOR_SHOT,
  CAR_REAR_SHOT,
} from '../utils/carVisuals';
import { ArrowLeft, Plus, X, Image as ImageIcon, Check } from 'lucide-react';

interface AddEditVehiclePageProps {
  vehicleId?: string;
}

export const AddEditVehiclePage: React.FC<AddEditVehiclePageProps> = ({ vehicleId }) => {
  const { navigate, showToast } = useNavigation();
  const isEditing = Boolean(vehicleId);

  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('Aqua');
  const [year, setYear] = useState<number>(2019);
  const [price, setPrice] = useState<number>(15990);
  const [mileageKm, setMileageKm] = useState<number>(68000);
  const [transmission, setTransmission] = useState<TransmissionType>('Automatic');
  const [fuel, setFuel] = useState<FuelType>('Hybrid');
  const [status, setStatus] = useState<VehicleStatus>('available');
  const [engineSize, setEngineSize] = useState('1.5 L');
  const [colour, setColour] = useState('White');
  const [condition, setCondition] = useState('Ex-Japan Import');
  const [dutyStatus, setDutyStatus] = useState('Duty Paid & Registered');
  const [description, setDescription] = useState(
    'Well looked after Toyota Aqua with excellent fuel economy. A reliable and practical hybrid, perfect for city driving.'
  );

  // Photos list
  const [photos, setPhotos] = useState<string[]>([
    CAR_AQUA_WHITE,
    CAR_REAR_SHOT,
    CAR_INTERIOR_SHOT,
  ]);

  // If editing, load vehicle
  useEffect(() => {
    if (vehicleId) {
      const existing = storageService.getVehicleById(vehicleId);
      if (existing) {
        setMake(existing.make);
        setModel(existing.model);
        setYear(existing.year);
        setPrice(existing.price);
        setMileageKm(existing.mileageKm);
        setTransmission(existing.transmission);
        setFuel(existing.fuel);
        setStatus(existing.status);
        setEngineSize(existing.engineSize || '1.5 L');
        setColour(existing.colour || 'White');
        setCondition(existing.condition || 'Ex-Japan Import');
        setDutyStatus(existing.dutyStatus || 'Duty Paid & Registered');
        setDescription(existing.description || '');
        setPhotos(existing.photos || [CAR_AQUA_WHITE]);
      }
    }
  }, [vehicleId]);

  // Handle file upload (Supabase Storage if configured, or local data URL in local demo mode)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const dealership = storageService.getDealership();

    for (const file of Array.from(files)) {
      if (isSupabaseConfigured()) {
        try {
          const publicUrl = await supabaseService.uploadVehiclePhoto(dealership.id, file);
          setPhotos((prev) => [...prev, publicUrl].slice(0, 10));
          showToast(`Uploaded ${file.name} to vehicle-photos`);
        } catch (storageErr: any) {
          console.error('Supabase storage upload failed:', storageErr);
          showToast(`Upload failed for ${file.name}: ${storageErr?.message || 'Check storage permissions'}`);
          // Do not silently substitute local data URL in production/live mode
        }
      } else {
        // Local Demo Mode only: read as local data URL
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setPhotos((prev) => [...prev, event.target!.result as string].slice(0, 10));
          }
        };
        reader.readAsDataURL(file);
        showToast('Photo added (Demo Mode)');
      }
    }
    // Reset file input so user can retry or upload same filename again
    e.target.value = '';
  };

  // Preset demo photo picker
  const handleAddPresetPhoto = (sampleUrl: string) => {
    if (photos.length >= 10) {
      showToast('Maximum 10 photos reached');
      return;
    }
    setPhotos((prev) => [...prev, sampleUrl]);
    showToast('Preset angle added');
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (publishStatus: VehicleStatus = status) => {
    if (!make.trim() || !model.trim() || !price) {
      showToast('Please enter vehicle make, model, and price.');
      return;
    }

    const dealership = storageService.getDealership();
    const finalPhotos = photos.length > 0 ? photos : [CAR_AQUA_WHITE];

    if (isEditing && vehicleId) {
      await storageService.updateVehicleAsync(vehicleId, {
        make,
        model,
        year: Number(year),
        price: Number(price),
        mileageKm: Number(mileageKm),
        transmission,
        fuel,
        status: publishStatus,
        engineSize,
        colour,
        condition,
        dutyStatus,
        description,
        photos: finalPhotos,
      });
      showToast('Vehicle updated successfully!');
      navigate(`/app/vehicles/${vehicleId}`);
    } else {
      const created = await storageService.createVehicleAsync({
        dealershipId: dealership.id,
        make,
        model,
        year: Number(year),
        price: Number(price),
        currency: dealership.currency || 'USD',
        mileageKm: Number(mileageKm),
        transmission,
        fuel,
        status: publishStatus,
        engineSize,
        colour,
        condition,
        dutyStatus,
        description,
        photos: finalPhotos,
        features: ['Aircon', 'Power Steering', 'Keyless Entry', 'Bluetooth'],
      });
      showToast('Vehicle published to your showroom!');
      navigate(`/app/vehicles/${created.id}`);
    }
  };

  return (
    <div className="relative min-h-full flex flex-col justify-between bg-white text-slate-900 overflow-x-hidden">
      {/* Decorative Pastel Blob in upper right matching Screen 04 */}
      <div className="absolute -top-10 -right-10 w-44 h-44 bg-purple-100/50 rounded-full blur-2xl pointer-events-none" />

      {/* Header matching Screen 04 */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/vehicles')}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-800 transition-colors -ml-1.5"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-extrabold text-slate-950 tracking-tight">
            {isEditing ? 'Edit vehicle' : 'Add vehicle'}
          </h1>
        </div>

        <button
          onClick={() => handleSave('draft')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 px-2 py-1 rounded-md transition-colors"
        >
          Save draft
        </button>
      </div>

      {/* Scrollable Form Body */}
      <div className="flex-1 px-5 py-4 flex flex-col gap-5 overflow-y-auto">
        {/* Photos Section matching Screen 04 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-900">Photos</span>
            <span className="text-xs font-semibold text-slate-400 tabular-nums">
              {photos.length}/10
            </span>
          </div>

          {/* Horizontal Scroller of Photo Tiles */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 no-scrollbar">
            {/* "+ Add photos" Dashed Box */}
            <label className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-400 bg-slate-50 flex flex-col items-center justify-center gap-1 cursor-pointer shrink-0 transition-colors">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <Plus className="w-5 h-5 text-slate-600 stroke-[2.2]" />
              <span className="text-[10px] font-semibold text-slate-600 text-center leading-tight">
                Add photos
              </span>
            </label>

            {/* Uploaded / Selected Photo Tiles matching Screen 04 */}
            {photos.map((photoUrl, idx) => (
              <div
                key={idx}
                className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 group"
              >
                <img
                  src={photoUrl}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(idx)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-opacity"
                  title="Remove photo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Quick Preset Photo Picker for fast demonstration */}
            {photos.length < 3 && (
              <button
                type="button"
                onClick={() => handleAddPresetPhoto(CAR_INTERIOR_SHOT)}
                className="px-3 h-20 rounded-2xl bg-blue-50 border border-blue-100 text-blue-700 flex flex-col items-center justify-center gap-1 shrink-0 text-[10px] font-semibold"
              >
                <ImageIcon className="w-4 h-4" />
                <span>+ Interior</span>
              </button>
            )}
          </div>
        </div>

        {/* Make & Model Row matching Screen 04 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Make</label>
            <select
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="w-full h-11 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none"
            >
              <option value="Toyota">Toyota</option>
              <option value="Honda">Honda</option>
              <option value="Mazda">Mazda</option>
              <option value="Ford">Ford</option>
              <option value="Mercedes-Benz">Mercedes-Benz</option>
              <option value="Nissan">Nissan</option>
              <option value="BMW">BMW</option>
              <option value="Volkswagen">Volkswagen</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Aqua / Fit / CX-5"
              className="w-full h-11 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none"
            />
          </div>
        </div>

        {/* Year, Price, Mileage (km) Row matching Screen 04 */}
        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full h-11 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Price ($)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full h-11 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mileage (km)</label>
            <input
              type="number"
              value={mileageKm}
              onChange={(e) => setMileageKm(Number(e.target.value))}
              className="w-full h-11 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none tabular-nums"
            />
          </div>
        </div>

        {/* Transmission & Fuel Row matching Screen 04 */}
        <div className="grid grid-cols-2 gap-3">
          {/* Transmission: Segmented Toggle matching Screen 04 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transmission</label>
            <div className="flex items-center h-11 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setTransmission('Manual')}
                className={`flex-1 h-full rounded-lg text-xs font-semibold transition-all ${
                  transmission === 'Manual'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setTransmission('Automatic')}
                className={`flex-1 h-full rounded-lg text-xs font-semibold transition-all ${
                  transmission === 'Automatic'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Automatic
              </button>
            </div>
          </div>

          {/* Fuel Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Fuel</label>
            <select
              value={fuel}
              onChange={(e) => setFuel(e.target.value as FuelType)}
              className="w-full h-11 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none"
            >
              <option value="Hybrid">Hybrid</option>
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="Electric">Electric</option>
            </select>
          </div>
        </div>

        {/* Vehicle Status Dropdown matching Screen 04 */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as VehicleStatus)}
            className="w-full h-11 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none"
          >
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
            <option value="draft">Draft (Hidden)</option>
          </select>
        </div>

        {/* Engine, Colour, Duty Status */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Engine</label>
            <input
              type="text"
              value={engineSize}
              onChange={(e) => setEngineSize(e.target.value)}
              placeholder="1.5 L"
              className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Colour</label>
            <input
              type="text"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              placeholder="White"
              className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Duty Status</label>
            <select
              value={dutyStatus}
              onChange={(e) => setDutyStatus(e.target.value)}
              className="w-full h-9 px-1 text-[11px] rounded-lg border border-slate-200 bg-white"
            >
              <option value="Duty Paid & Registered">Duty Paid</option>
              <option value="In Bond / Zimra Cleared">In Bond</option>
              <option value="Ex-Japan Duty Free">Duty Free</option>
            </select>
          </div>
        </div>

        {/* Description Textarea */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Key highlights, condition, warranty, features..."
            className="w-full p-3 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* Bottom Sticky Action Button: Publish vehicle matching Screen 04 */}
      <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md px-5 py-3 border-t border-slate-100 flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleSave('available')}
          className="w-full h-12 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>{isEditing ? 'Save vehicle changes' : 'Publish vehicle'}</span>
        </button>
      </div>
    </div>
  );
};
