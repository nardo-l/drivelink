import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { storageService } from '../services/storage';
import { supabaseService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  OnboardingState,
  SellerType,
  StorefrontTemplate,
  TransmissionType,
  FuelType,
  VehicleStatus,
  CurrencyCode,
  Dealership,
} from '../types';
import {
  CAR_RAV4_SILVER,
  CAR_AQUA_WHITE,
  CAR_FIT_NAVY,
  CAR_RANGER_WHITE,
  DEFAULT_DEALER_LOGO,
  DEFAULT_STOREFRONT_COVER,
} from '../utils/carVisuals';
import { toE164, validatePhoneNumber } from '../utils/phoneUtils';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Car,
  Ship,
  User,
  Briefcase,
  Link as LinkIcon,
  Pencil,
  Check,
  Plus,
  X,
  Bookmark,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  MapPin,
  MessageCircle,
  Phone,
  Loader2,
  Mail,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Camera,
} from 'lucide-react';

export const OnboardingFlow: React.FC = () => {
  const { navigate, showToast } = useNavigation();

  // Load persisted onboarding state
  const [onboarding, setOnboarding] = useState<OnboardingState>(() =>
    storageService.getOnboardingState()
  );

  // In-memory files for upload during final submission
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync state to storage whenever it changes (File instances excluded in storageService)
  useEffect(() => {
    storageService.saveOnboardingState(onboarding);
  }, [onboarding]);

  // Five-stage flow: showroom, first vehicle, live preview, account, success.
  const step = onboarding.currentStep;
  const progressStep = step === 3 ? 1 : step === 7 ? 2 : step === 8 ? 3 : step === 1 ? 4 : 5;
  const [setupComplete, setSetupComplete] = useState(Boolean(onboarding.isCompleted));

  const setStep = (newStep: number) => {
    setOnboarding((prev) => ({ ...prev, currentStep: newStep }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load any existing persisted branding from Supabase if user already has a dealership record
  useEffect(() => {
    const loadSavedBranding = async () => {
      if (isSupabaseConfigured() && !storageService.isDemoModeActive()) {
        try {
          const liveDealer = await supabaseService.getCurrentDealership();
          if (liveDealer) {
            setOnboarding((prev) => ({
              ...prev,
              branding: {
                ...prev.branding,
                logoPreview: prev.branding.logoPreview || liveDealer.logoUrl || null,
                coverPreview: prev.branding.coverPreview || liveDealer.coverUrl || null,
              },
            }));
          }
        } catch (e) {
          console.warn('Could not check existing dealership branding:', e);
        }
      }
    };
    loadSavedBranding();
  }, [step]);

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Real-time phone validations
  const phoneValidation = validatePhoneNumber(
    onboarding.contact.phoneCountryCode,
    onboarding.contact.phoneNumber
  );

  const whatsappValidation = onboarding.contact.whatsappSameAsPhone
    ? phoneValidation
    : validatePhoneNumber(
        onboarding.contact.whatsappCountryCode,
        onboarding.contact.whatsappNumber
      );

  // ----------------------------------------------------
  // STEP 1: CREATE ACCOUNT (Screen 02)
  // ----------------------------------------------------
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!onboarding.showroom.businessName.trim()) {
      newErrors.businessName = 'Please enter your dealership or business name.';
    }
    if (!onboarding.account.email.trim() || !onboarding.account.email.includes('@')) {
      newErrors.email = 'Please provide a valid email address.';
    }
    if (!onboarding.account.password || onboarding.account.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }
    if (!onboarding.showroom.handle.trim()) {
      newErrors.handle = 'Please enter your desired showroom handle.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    const isLive = isSupabaseConfigured() && !storageService.isDemoModeActive();

    if (isLive) {
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        let authResult = null;
        try {
          authResult = await supabaseService.signUp(
            onboarding.account.email.trim(),
            onboarding.account.password
          );
        } catch (authErr: any) {
          const msg = authErr?.message?.toLowerCase() || '';
          if (msg.includes('already registered') || msg.includes('user already exists')) {
            try {
              authResult = await supabaseService.signIn(
                onboarding.account.email.trim(),
                onboarding.account.password
              );
            } catch (signInErr: any) {
              setErrors({
                auth: 'An account with this email already exists. Please log in or use a different email address.',
              });
              setIsSubmitting(false);
              return;
            }
          } else {
            setErrors({ auth: authErr?.message || 'Supabase signup failed. Please try again.' });
            setIsSubmitting(false);
            return;
          }
        }

        if (authResult?.user && !authResult?.session) {
          setIsSubmitting(false);
          setEmailConfirmationRequired(true);
          return;
        }

        if (authResult?.session) {
          storageService.setUserSession({
            isLoggedIn: true,
            email: authResult.user?.email || onboarding.account.email.trim(),
            dealershipId: '',
          });
        }
      } catch (err: any) {
        setErrors({ auth: err?.message || 'Authentication error. Please check your credentials.' });
        setIsSubmitting(false);
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    setOnboarding((prev) => ({
      ...prev,
      showroom: {
        ...prev.showroom,
        businessName: prev.showroom.businessName || prev.account.businessName,
        handle: prev.showroom.handle || prev.account.handle,
      },
      currentStep: 9,
    }));
  };

  const handleBusinessNameChange = (val: string) => {
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    setOnboarding((prev) => ({
      ...prev,
      account: {
        ...prev.account,
        businessName: val,
        handle: slug || prev.account.handle,
      },
      showroom: {
        ...prev.showroom,
        businessName: val,
        handle: slug || prev.showroom.handle,
      },
    }));
  };

  // ----------------------------------------------------
  // STEP 2: SELLER TYPE (Screen 03)
  // ----------------------------------------------------
  const handleSellerTypeSelect = (type: SellerType) => {
    setOnboarding((prev) => ({ ...prev, sellerType: type }));
  };

  // ----------------------------------------------------
  // STEP 3: NAME YOUR SHOWROOM & URL (Screen 04)
  // ----------------------------------------------------
  const handleShowroomHandleChange = (val: string) => {
    const sanitized = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');
    setOnboarding((prev) => ({
      ...prev,
      account: { ...prev.account, handle: sanitized },
      showroom: {
        ...prev.showroom,
        handle: sanitized,
      },
    }));
  };

  // ----------------------------------------------------
  // STEP 4: CONTACT & LOCATION (Screen 05)
  // ----------------------------------------------------
  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!onboarding.contact.city.trim()) {
      newErrors.city = 'City or location is required.';
    }

    if (!phoneValidation.isValid) {
      newErrors.phoneNumber = phoneValidation.error || 'Valid phone number is required.';
    }

    if (!onboarding.contact.whatsappSameAsPhone && !whatsappValidation.isValid) {
      newErrors.whatsappNumber = whatsappValidation.error || 'Valid WhatsApp number is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (onboarding.contact.whatsappSameAsPhone) {
      setOnboarding((prev) => ({
        ...prev,
        contact: {
          ...prev.contact,
          whatsappCountryCode: prev.contact.phoneCountryCode,
          whatsappNumber: prev.contact.phoneNumber,
        },
      }));
    }

    setStep(5); // Move to Branding step
  };

  // ----------------------------------------------------
  // STEP 5: DEALERSHIP BRANDING (Logo & Banner)
  // ----------------------------------------------------
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setLogoUploadError('Please upload a PNG, JPG, or WebP image.');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setLogoUploadError('Logo file size must be less than 5MB.');
      return;
    }

    setLogoUploadError(null);
    setLogoFile(file);

    // 1. Immediate local preview using Object URL
    const localUrl = URL.createObjectURL(file);
    setOnboarding((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        logoPreview: localUrl,
      },
    }));
    setIsUploadingLogo(true);

    // 2. Perform live upload to Supabase if configured
    if (isSupabaseConfigured() && !storageService.isDemoModeActive()) {
      try {
        const user = await supabaseService.getCurrentUser();
        if (user) {
          let dealer = await supabaseService.getCurrentDealership();
          if (!dealer) {
            const dealershipName =
              onboarding.showroom.businessName.trim() ||
              onboarding.account.businessName.trim() ||
              'My Dealership';
            const slug =
              onboarding.showroom.handle.trim() ||
              onboarding.account.handle.trim() ||
              dealershipName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            dealer = await supabaseService.createDealership({
              name: dealershipName,
              slug,
              country: onboarding.contact.country,
              city: onboarding.contact.city,
              address: onboarding.contact.address,
              phone: toE164(onboarding.contact.phoneCountryCode, onboarding.contact.phoneNumber) || undefined,
              whatsapp: toE164(onboarding.contact.whatsappCountryCode, onboarding.contact.whatsappNumber) || undefined,
              email: user.email || onboarding.account.email,
              currency: onboarding.contact.country === 'South Africa' ? 'ZAR' : 'USD',
              template: onboarding.template,
              bio: onboarding.contact.description || '',
            });
          }

          const publicUrl = await supabaseService.uploadDealershipAsset(dealer.id, file, 'logo');
          URL.revokeObjectURL(localUrl);
          setOnboarding((prev) => ({
            ...prev,
            branding: {
              ...prev.branding,
              logoPreview: publicUrl,
            },
          }));
          showToast('Logo uploaded to Supabase Storage!');
        }
      } catch (uploadErr: any) {
        console.error('Logo upload error in onboarding:', uploadErr);
        setLogoUploadError(uploadErr?.message || 'Logo upload failed');
        showToast(uploadErr?.message || 'Logo upload failed');
      } finally {
        setIsUploadingLogo(false);
        e.target.value = '';
      }
    } else {
      setIsUploadingLogo(false);
      showToast('Logo selected');
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoUploadError(null);
    setOnboarding((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        logoPreview: null,
      },
    }));
    if (isSupabaseConfigured() && !storageService.isDemoModeActive()) {
      supabaseService.getCurrentDealership().then((d) => {
        if (d) {
          supabaseService.updateDealership(d.id, { logoUrl: undefined });
        }
      }).catch(() => {});
    }
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setCoverUploadError('Please upload a PNG, JPG, or WebP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setCoverUploadError('Cover banner file size must be less than 5MB.');
      return;
    }

    setCoverUploadError(null);
    setCoverFile(file);

    // 1. Immediate local preview using Object URL
    const localUrl = URL.createObjectURL(file);
    setOnboarding((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        coverPreview: localUrl,
      },
    }));
    setIsUploadingCover(true);

    // 2. Perform live upload to Supabase if configured
    if (isSupabaseConfigured() && !storageService.isDemoModeActive()) {
      try {
        const user = await supabaseService.getCurrentUser();
        if (user) {
          let dealer = await supabaseService.getCurrentDealership();
          if (!dealer) {
            const dealershipName =
              onboarding.showroom.businessName.trim() ||
              onboarding.account.businessName.trim() ||
              'My Dealership';
            const slug =
              onboarding.showroom.handle.trim() ||
              onboarding.account.handle.trim() ||
              dealershipName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            dealer = await supabaseService.createDealership({
              name: dealershipName,
              slug,
              country: onboarding.contact.country,
              city: onboarding.contact.city,
              address: onboarding.contact.address,
              phone: toE164(onboarding.contact.phoneCountryCode, onboarding.contact.phoneNumber) || undefined,
              whatsapp: toE164(onboarding.contact.whatsappCountryCode, onboarding.contact.whatsappNumber) || undefined,
              email: user.email || onboarding.account.email,
              currency: onboarding.contact.country === 'South Africa' ? 'ZAR' : 'USD',
              template: onboarding.template,
              bio: onboarding.contact.description || '',
            });
          }

          const publicUrl = await supabaseService.uploadDealershipAsset(dealer.id, file, 'cover');
          URL.revokeObjectURL(localUrl);
          setOnboarding((prev) => ({
            ...prev,
            branding: {
              ...prev.branding,
              coverPreview: publicUrl,
            },
          }));
          showToast('Cover banner uploaded to Supabase Storage!');
        }
      } catch (uploadErr: any) {
        console.error('Cover upload error in onboarding:', uploadErr);
        setCoverUploadError(uploadErr?.message || 'Cover upload failed');
        showToast(uploadErr?.message || 'Cover upload failed');
      } finally {
        setIsUploadingCover(false);
        e.target.value = '';
      }
    } else {
      setIsUploadingCover(false);
      showToast('Cover banner selected');
    }
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverUploadError(null);
    setOnboarding((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        coverPreview: null,
      },
    }));
    if (isSupabaseConfigured() && !storageService.isDemoModeActive()) {
      supabaseService.getCurrentDealership().then((d) => {
        if (d) {
          supabaseService.updateDealership(d.id, { coverUrl: undefined });
        }
      }).catch(() => {});
    }
  };

  // ----------------------------------------------------
  // STEP 6: STOREFRONT TEMPLATE
  // ----------------------------------------------------
  const handleTemplateSelect = (template: StorefrontTemplate) => {
    setOnboarding((prev) => ({ ...prev, template }));
  };

  // ----------------------------------------------------
  // STEP 7: ADD FIRST VEHICLE (Optional)
  // ----------------------------------------------------
  const handleVehiclePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setOnboarding((prev) => ({
            ...prev,
            firstVehicle: {
              ...prev.firstVehicle,
              photos: [...prev.firstVehicle.photos, event.target!.result as string].slice(0, 10),
            },
          }));
        }
      };
      reader.readAsDataURL(file);
    });
    showToast('Vehicle photo added');
  };

  const handleRemoveVehiclePhoto = (index: number) => {
    setOnboarding((prev) => ({
      ...prev,
      firstVehicle: {
        ...prev.firstVehicle,
        photos: prev.firstVehicle.photos.filter((_, i) => i !== index),
      },
    }));
  };

  const handleVehicleSubmit = (isDraft: boolean = false) => {
    if (!onboarding.firstVehicle.make || !onboarding.firstVehicle.model) {
      setErrors({ vehicle: 'Vehicle make and model are required if adding a vehicle.' });
      return;
    }

    setOnboarding((prev) => ({
      ...prev,
      firstVehicle: {
        ...prev.firstVehicle,
        isDraft,
        isSkipped: false,
      },
      currentStep: 8, // Move to final preview
    }));
    setErrors({});
    showToast(isDraft ? 'Vehicle saved as draft' : 'Vehicle details saved');
  };

  const handleSkipVehicle = () => {
    setOnboarding((prev) => ({
      ...prev,
      firstVehicle: {
        ...prev.firstVehicle,
        isSkipped: true,
      },
      currentStep: 8,
    }));
    showToast('Vehicle step skipped — you can add vehicles anytime from your dashboard');
  };

  // ----------------------------------------------------
  // STEP 8: FINAL SHOWROOM PREVIEW & COMPLETE
  // ----------------------------------------------------
  const handleFinishSetup = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const dealershipName =
      onboarding.showroom.businessName.trim() ||
      onboarding.account.businessName.trim() ||
      'My Dealership';
    const slug =
      onboarding.showroom.handle.trim() ||
      onboarding.account.handle.trim() ||
      dealershipName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const country = onboarding.contact.country;
    const city = onboarding.contact.city.trim() || 'Harare';
    const address = onboarding.contact.address.trim() || `${city}, ${country}`;

    // Compute standard international E.164 phone and whatsapp numbers
    const phoneE164 = toE164(
      onboarding.contact.phoneCountryCode,
      onboarding.contact.phoneNumber
    );
    const whatsappE164 = onboarding.contact.whatsappSameAsPhone
      ? phoneE164
      : toE164(
          onboarding.contact.whatsappCountryCode,
          onboarding.contact.whatsappNumber
        );

    const currency = country === 'Zimbabwe' ? 'USD' : 'ZAR';
    const isLive = isSupabaseConfigured() && !storageService.isDemoModeActive();

    // ---------------------------------------------------------------------------
    // LIVE SUPABASE PERSISTENCE
    // ---------------------------------------------------------------------------
    if (isLive) {
      try {
        const user = await supabaseService.getCurrentUser();
        if (!user) {
          throw new Error(
            'Authentication required: Please verify your email or log in to complete dealership setup.'
          );
        }

        // 1. Create or update Dealership in public.dealerships
        let createdDealer = await supabaseService.createDealership({
          name: dealershipName,
          slug,
          country,
          city,
          address,
          phone: phoneE164 || whatsappE164,
          whatsapp: whatsappE164,
          email: user.email || onboarding.account.email.trim(),
          currency,
          template: onboarding.template,
          bio: onboarding.contact.description || '',
          tagline: dealershipName,
          stickerText: 'Good cars brighter days',
          isVerified: true,
          isPublished: onboarding.showroom.isPublished !== false,
          logoUrl: onboarding.branding.logoPreview?.startsWith('http')
            ? onboarding.branding.logoPreview
            : undefined,
          coverUrl: onboarding.branding.coverPreview?.startsWith('http')
            ? onboarding.branding.coverPreview
            : undefined,
        });

        if (!createdDealer || !createdDealer.id) {
          throw new Error('Dealership record creation failed. Database did not return a valid record.');
        }

        const assetUpdates: Partial<Dealership> = {};

        // 2. Upload Logo to dealership-assets bucket if user selected a fresh file
        if (logoFile) {
          try {
            const logoUrl = await supabaseService.uploadDealershipAsset(
              createdDealer.id,
              logoFile,
              'logo'
            );
            assetUpdates.logoUrl = logoUrl;
          } catch (logoErr: any) {
            console.warn('Logo upload notice:', logoErr);
            showToast(logoErr?.message || 'Logo upload skipped: check storage bucket.');
          }
        } else if (
          onboarding.branding.logoPreview?.startsWith('http') &&
          createdDealer.logoUrl !== onboarding.branding.logoPreview
        ) {
          assetUpdates.logoUrl = onboarding.branding.logoPreview;
        }

        // 3. Upload Cover Banner to dealership-assets bucket if user selected a fresh file
        if (coverFile) {
          try {
            const coverUrl = await supabaseService.uploadDealershipAsset(
              createdDealer.id,
              coverFile,
              'cover'
            );
            assetUpdates.coverUrl = coverUrl;
          } catch (coverErr: any) {
            console.warn('Cover upload notice:', coverErr);
            showToast(coverErr?.message || 'Banner upload skipped: check storage bucket.');
          }
        } else if (
          onboarding.branding.coverPreview?.startsWith('http') &&
          createdDealer.coverUrl !== onboarding.branding.coverPreview
        ) {
          assetUpdates.coverUrl = onboarding.branding.coverPreview;
        }

        // If assets were uploaded or updated, persist to the dealership row
        if (Object.keys(assetUpdates).length > 0) {
          try {
            createdDealer = await supabaseService.updateDealership(createdDealer.id, assetUpdates);
          } catch (updateErr) {
            console.warn('Dealership asset update notice:', updateErr);
          }
        }

        // 4. Create first vehicle only if user explicitly filled it in
        if (
          !onboarding.firstVehicle.isSkipped &&
          onboarding.firstVehicle.make &&
          onboarding.firstVehicle.model
        ) {
          try {
            await supabaseService.createVehicle(
              {
                dealershipId: createdDealer.id,
                make: onboarding.firstVehicle.make,
                model: onboarding.firstVehicle.model,
                year: Number(onboarding.firstVehicle.year) || new Date().getFullYear(),
                price: Number(onboarding.firstVehicle.price) || 0,
                currency,
                mileageKm: Number(onboarding.firstVehicle.mileageKm) || 0,
                transmission: onboarding.firstVehicle.transmission,
                fuel: onboarding.firstVehicle.fuel,
                condition: onboarding.firstVehicle.condition,
                dutyStatus: 'Duty Paid & Registered',
                status: onboarding.firstVehicle.status,
                description: onboarding.firstVehicle.description,
                photos: await Promise.all(onboarding.firstVehicle.photos.map(async (photo, index) => {
                  if (!photo.startsWith('data:')) return photo;
                  const response = await fetch(photo);
                  const blob = await response.blob();
                  const file = new File([blob], `vehicle-${index + 1}.${blob.type.includes('png') ? 'png' : 'jpg'}`, { type: blob.type || 'image/jpeg' });
                  return supabaseService.uploadVehiclePhoto(createdDealer.id, file);
                })),
                features: ['Keyless Entry', 'Air Conditioning', 'Power Steering'],
              },
              createdDealer.id
            );
          } catch (vehErr: any) {
            throw new Error(`Your showroom was created, but the first car could not be saved: ${vehErr?.message || 'Please try again.'}`);
          }
        }

        // Store live dealership in cache & set real session ID
        storageService.saveDealership(createdDealer);
        storageService.setUserSession({
          isLoggedIn: true,
          email: user.email || onboarding.account.email.trim(),
          dealershipId: createdDealer.id,
        });

        const completedState = { ...onboarding, currentStep: 9, isCompleted: true };
        storageService.saveOnboardingState(completedState);
        setOnboarding(completedState);
        setSetupComplete(true);
        setIsSubmitting(false);
        showToast('Your showroom is ready!');
        return;
      } catch (backendErr: any) {
        console.error('Supabase persistence error during onboarding:', backendErr);
        setSubmitError(
          backendErr?.message || 'Database error during setup. Please check configuration and retry.'
        );
        setIsSubmitting(false);
        return;
      }
    }

    setSubmitError('Dealership setup requires a live backend. Please try again later or contact support.');
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!setupComplete && isSupabaseConfigured() && !storageService.isDemoModeActive()) {
      supabaseService.getSession().then(session => { if (session?.user && (step === 9 || step === 1)) handleFinishSetup(); }).catch(error => setSubmitError(error?.message || 'Could not restore your account session.'));
    }
  }, [step, setupComplete]);

  // Header Back Button Logic
  const handleBack = () => {
    if (step === 7) setStep(3);
    else if (step === 8) setStep(7);
    else if (step === 1) setStep(8);
    else navigate('/');
  };

  // Dealer display initials for fallback badge
  const dealerInitials =
    (onboarding.showroom.businessName || onboarding.account.businessName || 'DL')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'DL';

  return (
    <div className="dl-onboarding min-h-screen w-full flex flex-col justify-between bg-white text-slate-900 px-6 py-5 select-none">
      {/* Top Header: Back Arrow & Segmented Progress Bar */}
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="min-h-[44px] min-w-[44px] -ml-2 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-800 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
            {setupComplete ? 'Ready' : `${progressStep}/5`}
          </span>
        </div>

        {/* Segmented Progress Indicator (Steps 1 to 7) */}
        {!setupComplete && step !== 9 && (
          <div className="grid grid-cols-5 gap-1.5 w-full">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-colors ${
                  s <= progressStep ? 'bg-slate-950' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Email Confirmation Pending Screen */}
      {emailConfirmationRequired ? (
        <div className="my-auto py-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Mail className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">
              Confirm your email
            </h2>
            <p className="text-xs text-slate-600 mt-2 max-w-xs leading-relaxed">
              We sent a verification link to{' '}
              <span className="font-bold text-slate-900">{onboarding.account.email}</span>.
              Please click the link in your email to verify your account, then continue below.
            </p>
          </div>
          <div className="w-full max-w-xs flex flex-col gap-2.5 mt-4">
            <button
              onClick={async () => {
                const session = await supabaseService.getSession();
                if (session?.user) {
                  setEmailConfirmationRequired(false);
                  setOnboarding((prev) => ({ ...prev, currentStep: 2 }));
                  showToast('Email verified! Continuing showroom setup.');
                } else {
                  showToast('Verification pending. Please click the link in your email first.');
                }
              }}
              className="w-full h-12 rounded-full bg-slate-950 text-white font-bold text-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>I&apos;ve Verified My Email</span>
            </button>
            <button
              onClick={async () => {
                try {
                  await supabaseService.resendConfirmationEmail(onboarding.account.email);
                  showToast(`Verification link resent to ${onboarding.account.email}`);
                } catch (resendErr: any) {
                  showToast(resendErr?.message || 'Could not resend verification email.');
                }
              }}
              className="text-xs text-blue-600 font-semibold hover:underline py-1"
            >
              Resend verification email
            </button>
            <button
              onClick={() => setEmailConfirmationRequired(false)}
              className="text-xs text-slate-400 font-medium hover:text-slate-700 py-1"
            >
              Change Email / Back
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* SCREEN 02: CREATE ACCOUNT (Step 1) */}
          {/* ========================================================================= */}
          {step === 1 && (
            <form onSubmit={handleAccountSubmit} className="my-auto py-2 flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                  Create your account
                </h1>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  One last step. Create an account to publish and manage your showroom.
                </p>
              </div>

              {errors.auth && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="flex-1">
                    <p className="font-semibold text-rose-900 leading-snug">{errors.auth}</p>
                    <p className="text-[11px] text-rose-700/80 mt-1">
                      Check your credentials and connection.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3.5 pt-1">
                <button type="button" onClick={async () => { try { setIsSubmitting(true); await supabaseService.signInWithGoogle(); } catch (error: any) { setErrors({ auth: error?.message || 'Google sign-in could not start.' }); setIsSubmitting(false); } }} className="w-full h-11 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 flex items-center justify-center gap-2"><span className="text-base font-black">G</span> Continue with Google</button>
                <div className="flex items-center gap-3 text-[10px] text-slate-400"><span className="h-px flex-1 bg-slate-200" />or use email<span className="h-px flex-1 bg-slate-200" /></div>
                {/* Business name is already set in the showroom stage. */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Business name *
                  </label>
                  <input
                    type="text"
                    required
                    value={onboarding.account.businessName}
                    onChange={(e) => handleBusinessNameChange(e.target.value)}
                    placeholder="Enter your dealership name"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:border-slate-950 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                  {errors.businessName && (
                    <p className="text-[11px] text-rose-600 mt-1">{errors.businessName}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Email address *
                  </label>
                  <input
                    type="email"
                    required
                    value={onboarding.account.email}
                    onChange={(e) =>
                      setOnboarding((prev) => ({
                        ...prev,
                        account: { ...prev.account, email: e.target.value },
                      }))
                    }
                    placeholder="Enter your email"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:border-slate-950 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                  {errors.email && (
                    <p className="text-[11px] text-rose-600 mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={onboarding.account.password}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          account: { ...prev.account, password: e.target.value },
                        }))
                      }
                      placeholder="At least 6 characters"
                      className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:border-slate-950 focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-[11px] text-rose-600 mt-1">{errors.password}</p>
                  )}
                </div>

                {/* Showroom URL is already set in the showroom stage. */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Showroom handle
                  </label>
                  <div className="flex items-center h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 focus-within:border-slate-950 focus-within:bg-white transition-all">
                    <span className="text-xs font-medium text-slate-400 select-none shrink-0 mr-1">
                      drivelink.com/
                    </span>
                    <input
                      type="text"
                      required
                      value={onboarding.account.handle}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          account: {
                            ...prev.account,
                            handle: e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, '-'),
                          },
                        }))
                      }
                      placeholder="your-dealership"
                      className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
                    />
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-1.5" />
                  </div>
                  <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                    <span>✓ Available</span>
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 mt-3 rounded-full bg-slate-950 hover:bg-slate-850 disabled:bg-slate-700 text-white font-bold text-xs tracking-wide shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Creating account in Supabase...</span>
                  </>
                ) : (
                  <>
                    <span>Create my showroom</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-500 pt-1">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Log in
                </button>
              </p>
            </form>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 03: SELLER TYPE (Step 2) */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div className="my-auto py-2 flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                  What kind of seller are you?
                </h1>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Choose the option that best describes your business.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                {[
                  {
                    id: 'dealership',
                    icon: Car,
                    title: 'Car dealership',
                    desc: 'Franchised or independent dealership with multiple vehicles.',
                  },
                  {
                    id: 'importer',
                    icon: Ship,
                    title: 'Vehicle importer',
                    desc: 'Import and sell vehicles from overseas markets (Japan, UK, SA).',
                  },
                  {
                    id: 'independent',
                    icon: User,
                    title: 'Independent seller',
                    desc: 'Private seller or small business selling a few vehicles.',
                  },
                  {
                    id: 'broker',
                    icon: Briefcase,
                    title: 'Car broker',
                    desc: 'Connecting buyers and sellers on commission.',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = onboarding.sellerType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSellerTypeSelect(item.id as SellerType)}
                      className={`p-4 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                        isSelected
                          ? 'border-slate-950 bg-white ring-1 ring-slate-950 shadow-xs'
                          : 'border-slate-200/90 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5 text-slate-900">
                          <Icon className="w-5 h-5 stroke-[2]" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900">{item.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {item.desc}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'border-slate-950 bg-white ring-2 ring-slate-950'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-slate-950" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-full h-12 mt-4 rounded-full bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs tracking-wide shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 04: NAME YOUR SHOWROOM & URL (Step 3) */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="my-auto py-2 flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                  Let’s name your showroom
                </h1>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  What should buyers see when they open your link?
                </p>
              </div>

              <div className="flex flex-col gap-3.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Business name
                  </label>
                  <input
                    type="text"
                    value={onboarding.showroom.businessName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOnboarding((prev) => ({
                        ...prev,
                        account: { ...prev.account, businessName: val },
                        showroom: { ...prev.showroom, businessName: val },
                      }));
                    }}
                    placeholder="Enter your dealership name"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:border-slate-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Showroom URL
                  </label>
                  <div className="flex items-center h-11 px-3 rounded-xl border border-slate-200 bg-white focus-within:border-slate-950 transition-all">
                    <span className="text-xs font-medium text-slate-400 select-none shrink-0 mr-1">
                      drivelink.com/
                    </span>
                    <input
                      type="text"
                      value={onboarding.showroom.handle}
                      onChange={(e) => handleShowroomHandleChange(e.target.value)}
                      placeholder="your-dealership"
                      className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
                    />
                    <Pencil className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
                  </div>

                  <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>This URL is available!</span>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3 mt-1">
                  <div className="w-7 h-7 rounded-lg bg-slate-200/70 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <LinkIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">
                      Your showroom will be available at:
                    </p>
                    <p className="font-bold text-xs text-slate-900 mt-0.5">
                      drivelink.com/{onboarding.showroom.handle || 'your-dealership'}
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                  <p className="text-xs font-semibold text-slate-900">Who can see your showroom?</p>
                  <p className="text-[11px] text-slate-500 mt-1">You can change this later in settings.</p>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button type="button" onClick={() => setOnboarding(prev => ({ ...prev, showroom: { ...prev.showroom, isPublished: true } }))} className={`rounded-xl border p-3 text-left ${onboarding.showroom.isPublished !== false ? 'border-slate-950 bg-slate-50' : 'border-slate-200'}`}><span className="block text-xs font-bold">Public</span><span className="block text-[10px] text-slate-500 mt-1">Anyone with the link can view</span></button>
                    <button type="button" onClick={() => setOnboarding(prev => ({ ...prev, showroom: { ...prev.showroom, isPublished: false } }))} className={`rounded-xl border p-3 text-left ${onboarding.showroom.isPublished === false ? 'border-slate-950 bg-slate-50' : 'border-slate-200'}`}><span className="block text-xs font-bold">Private</span><span className="block text-[10px] text-slate-500 mt-1">Keep it hidden until you publish</span></button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(7)}
                className="w-full h-12 mt-4 rounded-full bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs tracking-wide shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 05: TELL US HOW TO REACH YOU (Step 4) */}
          {/* ========================================================================= */}
          {step === 4 && (
            <form onSubmit={handleContactSubmit} className="my-auto py-2 flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                  Tell us how to reach you
                </h1>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  This contact information will be displayed on your public showroom for buyer calls and WhatsApp enquiries.
                </p>
              </div>

              <div className="flex flex-col gap-3.5 pt-1">
                {/* Country and City Row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Country
                    </label>
                    <select
                      value={onboarding.contact.country}
                      onChange={(e) => {
                        const c = e.target.value as 'Zimbabwe' | 'South Africa';
                        setOnboarding((prev) => ({
                          ...prev,
                          contact: {
                            ...prev.contact,
                            country: c,
                            whatsappCountryCode: c === 'Zimbabwe' ? '+263' : '+27',
                            phoneCountryCode: c === 'Zimbabwe' ? '+263' : '+27',
                          },
                        }));
                      }}
                      className="w-full h-11 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none"
                    >
                      <option value="Zimbabwe">Zimbabwe</option>
                      <option value="South Africa">South Africa</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={onboarding.contact.city}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          contact: { ...prev.contact, city: e.target.value },
                        }))
                      }
                      placeholder="e.g. Harare or Johannesburg"
                      className="w-full h-11 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none placeholder:text-slate-400"
                    />
                    {errors.city && (
                      <p className="text-[11px] text-rose-600 mt-1">{errors.city}</p>
                    )}
                  </div>
                </div>

                {/* Physical Yard / Showroom Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Physical yard or showroom address (optional)
                  </label>
                  <input
                    type="text"
                    value={onboarding.contact.address}
                    onChange={(e) =>
                      setOnboarding((prev) => ({
                        ...prev,
                        contact: { ...prev.contact, address: e.target.value },
                      }))
                    }
                    placeholder="Enter street address (e.g. 14 Enterprise Road, Newlands)"
                    className="w-full h-11 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none placeholder:text-slate-400"
                  />
                </div>

                {/* Dealership Phone Number (REQUIRED) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-800">
                      Dealership phone number *
                    </label>
                    {phoneValidation.isValid && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>E.164: {phoneValidation.e164}</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={onboarding.contact.phoneCountryCode}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          contact: { ...prev.contact, phoneCountryCode: e.target.value },
                        }))
                      }
                      className="h-11 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none"
                    >
                      <option value="+263">+263 (ZW)</option>
                      <option value="+27">+27 (SA)</option>
                    </select>

                    <input
                      type="tel"
                      required
                      value={onboarding.contact.phoneNumber}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          contact: { ...prev.contact, phoneNumber: e.target.value },
                        }))
                      }
                      placeholder={
                        onboarding.contact.phoneCountryCode === '+263'
                          ? 'e.g. 77 123 4567'
                          : 'e.g. 82 123 4567'
                      }
                      className="col-span-2 h-11 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                  {errors.phoneNumber && (
                    <p className="text-[11px] text-rose-600 mt-1">{errors.phoneNumber}</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    Used for direct click-to-call buyer links.
                  </p>
                </div>

                {/* WhatsApp Number (With 'Same as Phone' toggle) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-800">
                      WhatsApp number *
                    </label>
                    {onboarding.contact.whatsappSameAsPhone && phoneValidation.isValid && (
                      <span className="text-[10px] font-semibold text-emerald-600">
                        Mirrored from phone
                      </span>
                    )}
                  </div>

                  {/* Sync checkbox */}
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors mb-2">
                    <input
                      type="checkbox"
                      checked={onboarding.contact.whatsappSameAsPhone}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setOnboarding((prev) => ({
                          ...prev,
                          contact: {
                            ...prev.contact,
                            whatsappSameAsPhone: checked,
                            whatsappCountryCode: checked
                              ? prev.contact.phoneCountryCode
                              : prev.contact.whatsappCountryCode,
                            whatsappNumber: checked
                              ? prev.contact.phoneNumber
                              : prev.contact.whatsappNumber,
                          },
                        }));
                      }}
                      className="w-4 h-4 rounded text-slate-950 focus:ring-slate-950 accent-slate-950 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      Same as dealership phone number
                    </span>
                  </label>

                  {/* Separate WhatsApp entry if not synced */}
                  {!onboarding.contact.whatsappSameAsPhone && (
                    <div>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={onboarding.contact.whatsappCountryCode}
                          onChange={(e) =>
                            setOnboarding((prev) => ({
                              ...prev,
                              contact: {
                                ...prev.contact,
                                whatsappCountryCode: e.target.value,
                              },
                            }))
                          }
                          className="h-11 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none"
                        >
                          <option value="+263">+263 (ZW)</option>
                          <option value="+27">+27 (SA)</option>
                        </select>

                        <input
                          type="tel"
                          required
                          value={onboarding.contact.whatsappNumber}
                          onChange={(e) =>
                            setOnboarding((prev) => ({
                              ...prev,
                              contact: { ...prev.contact, whatsappNumber: e.target.value },
                            }))
                          }
                          placeholder={
                            onboarding.contact.whatsappCountryCode === '+263'
                              ? 'e.g. 77 987 6543'
                              : 'e.g. 83 234 5678'
                          }
                          className="col-span-2 h-11 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none placeholder:text-slate-400"
                        />
                      </div>
                      {errors.whatsappNumber && (
                        <p className="text-[11px] text-rose-600 mt-1">{errors.whatsappNumber}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Business Description */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-800">
                      Business description (optional)
                    </label>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {onboarding.contact.description.length}/160
                    </span>
                  </div>
                  <textarea
                    maxLength={160}
                    rows={2}
                    value={onboarding.contact.description}
                    onChange={(e) =>
                      setOnboarding((prev) => ({
                        ...prev,
                        contact: { ...prev.contact, description: e.target.value },
                      }))
                    }
                    placeholder="Enter a brief bio or description of your showroom..."
                    className="w-full p-3 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-slate-950 focus:outline-none resize-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-12 mt-2 rounded-full bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs tracking-wide shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 05B: DEALERSHIP BRANDING (Step 5) */}
          {/* ========================================================================= */}
          {step === 5 && (
            <div className="my-auto py-2 flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                  Brand your showroom
                </h1>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Upload your dealership logo and cover banner. You can also skip and update these anytime from settings.
                </p>
              </div>

              <div className="flex flex-col gap-4 pt-1">
                {/* 1. Logo Upload Component */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900">Dealership Logo</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Square or circular avatar · PNG, JPG, WebP up to 5MB
                      </p>
                    </div>
                    {onboarding.branding.logoPreview && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Selected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Live Preview Avatar */}
                    <div className="w-18 h-18 rounded-full border-2 border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 shadow-xs relative group">
                      {onboarding.branding.logoPreview ? (
                        <img
                          src={onboarding.branding.logoPreview}
                          alt="Logo Preview"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-blue-600 text-white font-black text-lg flex items-center justify-center">
                          {dealerInitials}
                        </div>
                      )}

                      {/* Loading Spinner Overlay */}
                      {isUploadingLogo && (
                        <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center backdrop-blur-2xs">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <label
                          className={`h-9 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors ${
                            isUploadingLogo ? 'opacity-60 pointer-events-none' : ''
                          }`}
                        >
                          {isUploadingLogo ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              <span>
                                {onboarding.branding.logoPreview ? 'Replace logo' : 'Upload logo'}
                              </span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleLogoFileChange}
                            disabled={isUploadingLogo}
                            className="hidden"
                          />
                        </label>

                        {onboarding.branding.logoPreview && !isUploadingLogo && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="h-9 px-3 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-rose-600 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Recommended: 500 × 500 px. Uploaded to your storage bucket on selection.
                      </p>
                    </div>
                  </div>

                  {(logoUploadError || errors.logo) && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{logoUploadError || errors.logo}</span>
                    </div>
                  )}
                </div>

                {/* 2. Banner / Cover Upload Component */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900">Showroom Cover Banner</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Wide hero header · Recommended 1200 × 400 px (3:1 ratio)
                      </p>
                    </div>
                    {onboarding.branding.coverPreview && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Selected
                      </span>
                    )}
                  </div>

                  {/* Wide Aspect Ratio Preview Box */}
                  <div className="relative w-full aspect-3/1 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-xs flex items-center justify-center group">
                    {onboarding.branding.coverPreview ? (
                      <>
                        <img
                          src={onboarding.branding.coverPreview}
                          alt="Cover Banner Preview"
                          className="w-full h-full object-cover"
                        />
                        {!isUploadingCover && (
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <label className="h-8 px-3 rounded-lg bg-white/90 text-slate-900 font-bold text-xs flex items-center gap-1 cursor-pointer">
                              <Upload className="w-3 h-3" />
                              <span>Replace</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={handleCoverFileChange}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={handleRemoveCover}
                              className="h-8 px-3 rounded-lg bg-rose-600 text-white font-bold text-xs flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-3 text-slate-400">
                        <ImageIcon className="w-6 h-6 mb-1 text-slate-500 stroke-[1.5]" />
                        <p className="text-[11px] font-semibold text-slate-300">
                          No cover banner selected
                        </p>
                        <p className="text-[9px] text-slate-400">
                          A clean gradient showroom banner will be generated by default
                        </p>
                      </div>
                    )}

                    {/* Cover Uploading Spinner Overlay */}
                    {isUploadingCover && (
                      <div className="absolute inset-0 bg-slate-950/70 z-20 flex flex-col items-center justify-center gap-2 backdrop-blur-2xs">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                        <span className="text-xs font-semibold text-white">
                          Uploading banner to Supabase...
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <label
                      className={`h-9 px-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors ${
                        isUploadingCover ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      {isUploadingCover ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {onboarding.branding.coverPreview
                              ? 'Change banner'
                              : 'Upload cover banner'}
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleCoverFileChange}
                        disabled={isUploadingCover}
                        className="hidden"
                      />
                    </label>

                    {onboarding.branding.coverPreview && !isUploadingCover && (
                      <button
                        type="button"
                        onClick={handleRemoveCover}
                        className="text-xs text-rose-600 font-semibold hover:underline"
                      >
                        Remove banner
                      </button>
                    )}
                  </div>

                  {(coverUploadError || errors.cover) && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{coverUploadError || errors.cover}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setStep(6)}
                  className="w-full h-12 rounded-full bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs tracking-wide shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setStep(6)}
                  className="text-xs text-slate-400 hover:text-slate-700 font-medium py-1 text-center"
                >
                  Skip branding for now
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 06: CHOOSE YOUR STOREFRONT STYLE (Step 6) */}
          {/* ========================================================================= */}
          {step === 6 && (
            <div className="my-auto py-2 flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                  Choose your storefront style
                </h1>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Pick a design that fits your brand. You can change this later.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-1">
                {[
                  {
                    id: 'signature',
                    title: 'Signature',
                    desc: 'Premium, image-led design with a focus on your brand.',
                    preview: (
                      <div className="w-16 h-12 rounded-lg bg-slate-900 overflow-hidden relative flex items-center justify-center shrink-0 border border-slate-800">
                        <img
                          src={CAR_RAV4_SILVER}
                          alt="Signature"
                          className="w-full h-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      </div>
                    ),
                  },
                  {
                    id: 'inventory_first',
                    title: 'Inventory First',
                    desc: 'Your vehicles take centre stage with a clean, modern layout.',
                    preview: (
                      <div className="w-16 h-12 rounded-lg bg-slate-100 p-1 grid grid-cols-2 gap-0.5 shrink-0 border border-slate-200">
                        <img src={CAR_AQUA_WHITE} alt="1" className="w-full h-full object-cover rounded-xs" />
                        <img src={CAR_FIT_NAVY} alt="2" className="w-full h-full object-cover rounded-xs" />
                        <img src={CAR_RAV4_SILVER} alt="3" className="w-full h-full object-cover rounded-xs" />
                        <img src={CAR_RANGER_WHITE} alt="4" className="w-full h-full object-cover rounded-xs" />
                      </div>
                    ),
                  },
                  {
                    id: 'independent',
                    title: 'Independent',
                    desc: 'A simple, personal profile with curated listings.',
                    preview: (
                      <div className="w-16 h-12 rounded-lg bg-slate-50 p-1 flex flex-col justify-between shrink-0 border border-slate-200">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-blue-600" />
                          <div className="w-7 h-1 bg-slate-300 rounded-full" />
                        </div>
                        <div className="grid grid-cols-2 gap-0.5 h-6">
                          <img src={CAR_AQUA_WHITE} alt="1" className="w-full h-full object-cover rounded-xs" />
                          <img src={CAR_RANGER_WHITE} alt="2" className="w-full h-full object-cover rounded-xs" />
                        </div>
                      </div>
                    ),
                  },
                ].map((t) => {
                  const isSelected = onboarding.template === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTemplateSelect(t.id as StorefrontTemplate)}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                        isSelected
                          ? 'border-slate-950 bg-white ring-1 ring-slate-950 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {t.preview}
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900">{t.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {t.desc}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'border-slate-950 bg-white ring-2 ring-slate-950'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-slate-950" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setStep(7)}
                className="w-full h-12 mt-4 rounded-full bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs tracking-wide shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 07: ADD FIRST VEHICLE (Step 7) */}
          {/* ========================================================================= */}
          {step === 7 && (
            <div className="py-2 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 mb-2">Step 2 of 5 · Your first car</p>
                  <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                    Tell us about the car
                  </h1>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Start with the essentials, or skip to launch a clean showroom.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSkipVehicle}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-800 shrink-0 pt-1 underline underline-offset-2"
                >
                  Skip for now
                </button>
              </div>

              {errors.vehicle && (
                <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {errors.vehicle}
                </p>
              )}

              {/* Photo Selector */}
              <div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {onboarding.firstVehicle.photos.map((url, i) => (
                    <div
                      key={i}
                      className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 group"
                    >
                      <img src={url} alt={`Car ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveVehiclePhoto(i)}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}

                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 bg-slate-50 flex flex-col items-center justify-center gap-0.5 cursor-pointer shrink-0 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleVehiclePhotoUpload}
                      className="hidden"
                    />
                    <Plus className="w-4 h-4 text-slate-600 stroke-[2.5]" />
                    <span className="text-[9px] font-semibold text-slate-600">Add photos</span>
                  </label>
                </div>
                <p className="text-[10px] text-right text-slate-400 mt-1 tabular-nums">
                  {onboarding.firstVehicle.photos.length}/10
                </p>
              </div>

              {/* Form Fields */}
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">Make</label>
                    <select
                      value={onboarding.firstVehicle.make}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          firstVehicle: { ...prev.firstVehicle, make: e.target.value },
                        }))
                      }
                      className="w-full h-10 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="">Select make</option>
                      <option value="Toyota">Toyota</option>
                      <option value="Honda">Honda</option>
                      <option value="Mazda">Mazda</option>
                      <option value="Ford">Ford</option>
                      <option value="Nissan">Nissan</option>
                      <option value="Mercedes-Benz">Mercedes-Benz</option>
                      <option value="BMW">BMW</option>
                      <option value="Isuzu">Isuzu</option>
                      <option value="Volkswagen">Volkswagen</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">Model</label>
                    <input
                      type="text"
                      value={onboarding.firstVehicle.model}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          firstVehicle: { ...prev.firstVehicle, model: e.target.value },
                        }))
                      }
                      placeholder="e.g. Aqua, Fit, Hilux"
                      className="w-full h-10 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-white placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">Year</label>
                    <input
                      type="number"
                      value={onboarding.firstVehicle.year}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          firstVehicle: {
                            ...prev.firstVehicle,
                            year: e.target.value ? Number(e.target.value) : '',
                          },
                        }))
                      }
                      placeholder="e.g. 2021"
                      className="w-full h-10 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white tabular-nums placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">Price</label>
                    <input
                      type="number"
                      value={onboarding.firstVehicle.price}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          firstVehicle: {
                            ...prev.firstVehicle,
                            price: e.target.value ? Number(e.target.value) : '',
                          },
                        }))
                      }
                      placeholder="e.g. 15000"
                      className="w-full h-10 px-2 text-xs font-medium rounded-xl border border-slate-200 bg-white tabular-nums placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Currency
                    </label>
                    <select
                      value={onboarding.firstVehicle.currency}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          firstVehicle: {
                            ...prev.firstVehicle,
                            currency: e.target.value as CurrencyCode,
                          },
                        }))
                      }
                      className="w-full h-10 px-2 text-xs font-medium rounded-xl border border-slate-200 bg-white font-semibold"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="ZAR">ZAR (R)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Mileage (km)
                  </label>
                  <input
                    type="number"
                    value={onboarding.firstVehicle.mileageKm}
                    onChange={(e) =>
                      setOnboarding((prev) => ({
                        ...prev,
                        firstVehicle: {
                          ...prev.firstVehicle,
                          mileageKm: e.target.value ? Number(e.target.value) : '',
                        },
                      }))
                    }
                    placeholder="e.g. 52000"
                    className="w-full h-10 px-3 text-xs font-medium rounded-xl border border-slate-200 bg-white tabular-nums placeholder:text-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Transmission
                    </label>
                    <select
                      value={onboarding.firstVehicle.transmission}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          firstVehicle: {
                            ...prev.firstVehicle,
                            transmission: e.target.value as TransmissionType,
                          },
                        }))
                      }
                      className="w-full h-10 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="Automatic">Automatic</option>
                      <option value="Manual">Manual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Fuel type
                    </label>
                    <select
                      value={onboarding.firstVehicle.fuel}
                      onChange={(e) =>
                        setOnboarding((prev) => ({
                          ...prev,
                          firstVehicle: {
                            ...prev.firstVehicle,
                            fuel: e.target.value as FuelType,
                          },
                        }))
                      }
                      className="w-full h-10 px-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="Petrol">Petrol</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Diesel">Diesel</option>
                      <option value="Electric">Electric</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleVehicleSubmit(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 px-2 py-2"
                >
                  <Bookmark className="w-4 h-4" />
                  <span>Save draft</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVehicleSubmit(false)}
                  className="flex-1 h-12 rounded-full bg-slate-950 hover:bg-slate-850 text-white font-bold text-xs tracking-wide shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 08: FINAL SHOWROOM PREVIEW & COMPLETE (Step 8) */}
          {/* ========================================================================= */}
          {step === 9 && setupComplete && (
            <div className="my-auto py-8 flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-9 h-9" /></div>
              <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700">All set</p><h1 className="text-2xl font-extrabold text-slate-950 mt-2">Your showroom is ready.</h1><p className="text-xs text-slate-500 mt-2">{onboarding.showroom.businessName || 'Your dealership'} is ready to share.</p></div>
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Your showroom link</p><p className="text-sm font-bold mt-1 break-all">{window.location.origin}/showroom/{onboarding.showroom.handle}</p></div>
              <button type="button" onClick={() => navigate('/showroom/' + onboarding.showroom.handle)} className="w-full h-12 rounded-full bg-slate-950 text-white text-xs font-bold">View my showroom <ExternalLink className="inline w-4 h-4 ml-1" /></button>
              <button type="button" onClick={() => navigate('/app/vehicles/new')} className="w-full h-11 rounded-full border border-slate-200 text-xs font-bold">Add another car</button>
              <button type="button" onClick={() => { const url = window.location.origin + '/showroom/' + onboarding.showroom.handle; if (navigator.share) navigator.share({ title: onboarding.showroom.businessName, url }).catch(() => {}); else navigator.clipboard?.writeText(url).then(() => showToast('Showroom link copied')); }} className="w-full h-11 rounded-full text-xs font-bold text-slate-600">Share showroom link</button>
            </div>
          )}

          {step === 8 && (
            <div className="py-2 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    <span>Showroom Ready</span>
                  </span>
                  <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight mt-1.5">
                    Your showroom is taking shape
                  </h1>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    Take a look at the public page before creating your account.
                  </p>
                </div>
              </div>

              {submitError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-rose-900">Setup error</p>
                    <p className="text-[11px] mt-0.5">{submitError}</p>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="mt-2 text-xs font-bold text-rose-700 underline"
                    >
                      Retry setup
                    </button>
                  </div>
                </div>
              )}

              {/* Live Preview Card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden flex flex-col">
                {/* Cover and Overlapping Avatar */}
                <div className="relative h-28 bg-slate-900 overflow-hidden">
                  {onboarding.branding.coverPreview ? (
                    <img
                      src={onboarding.branding.coverPreview}
                      alt="Showroom cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
                      <span className="text-white/20 text-xl font-black tracking-widest uppercase">
                        {onboarding.showroom.businessName || 'Showroom'}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

                  {/* Overlapping Logo Avatar */}
                  <div className="absolute -bottom-5 left-4 w-14 h-14 rounded-full bg-white p-0.5 shadow-md border border-slate-200 overflow-hidden flex items-center justify-center">
                    {onboarding.branding.logoPreview ? (
                      <img
                        src={onboarding.branding.logoPreview}
                        alt="Logo"
                        className="w-full h-full object-contain rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center">
                        {dealerInitials}
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Info */}
                <div className="pt-6 px-4 pb-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-950 leading-tight">
                        {onboarding.showroom.businessName ||
                          onboarding.account.businessName ||
                          'My Dealership'}
                      </h3>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>
                          {onboarding.contact.city || 'Harare'}, {onboarding.contact.country}
                        </span>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {onboarding.template}
                    </span>
                  </div>

                  {onboarding.contact.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {onboarding.contact.description}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="py-2 px-3 rounded-xl bg-[#25D366] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-2xs">
                      <MessageCircle className="w-3.5 h-3.5 fill-white" />
                      <span>WhatsApp</span>
                    </div>
                    <div className="py-2 px-3 rounded-xl bg-slate-100 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </div>
                  </div>

                  {/* Vehicle Preview Card or Clean Notice */}
                  {!onboarding.firstVehicle.isSkipped &&
                  onboarding.firstVehicle.make &&
                  onboarding.firstVehicle.model ? (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Featured Vehicle
                      </p>
                      <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                        {onboarding.firstVehicle.photos[0] ? (
                          <img
                            src={onboarding.firstVehicle.photos[0]}
                            alt="Car"
                            className="w-14 h-11 object-cover rounded-xl bg-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-11 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <Car className="w-6 h-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-slate-900 truncate">
                            {onboarding.firstVehicle.year} {onboarding.firstVehicle.make}{' '}
                            {onboarding.firstVehicle.model}
                          </p>
                          <p className="text-xs font-black text-slate-950 mt-0.5">
                            {onboarding.firstVehicle.currency === 'ZAR' ? 'R ' : '$ '}
                            {Number(onboarding.firstVehicle.price || 0).toLocaleString()}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                          Available
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-[11px] text-slate-400 italic">
                        Clean showroom · 0 initial vehicles (ready to add inventory from dashboard)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setStep(1)}
                  className="w-full h-13 rounded-full bg-slate-950 hover:bg-slate-850 disabled:bg-slate-400 text-white font-bold text-xs tracking-wide shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Continue to account creation...</span>
                    </>
                  ) : (
                    <>
                      <span>Looks good — create my account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
                  >
                    Edit showroom
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(7)}
                    className="py-2.5 rounded-xl bg-slate-100 text-slate-800 font-semibold text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Edit vehicle</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
