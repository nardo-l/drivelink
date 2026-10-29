/**
 * Exact Supabase Database schema definitions matching public schema tables:
 * - dealerships
 * - vehicles
 * - enquiries
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      dealerships: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          country: string;
          city: string;
          address: string | null;
          phone: string | null;
          whatsapp: string;
          email: string;
          currency: string;
          template: string;
          logo_url: string | null;
          cover_url: string | null;
          bio: string | null;
          tagline: string | null;
          sticker_text: string | null;
          is_verified: boolean;
          is_published: boolean;
          storefront_views: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          slug: string;
          country?: string;
          city?: string;
          address?: string | null;
          phone?: string | null;
          whatsapp: string;
          email: string;
          currency?: string;
          template?: string;
          logo_url?: string | null;
          cover_url?: string | null;
          bio?: string | null;
          tagline?: string | null;
          sticker_text?: string | null;
          is_verified?: boolean;
          is_published?: boolean;
          storefront_views?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          slug?: string;
          country?: string;
          city?: string;
          address?: string | null;
          phone?: string | null;
          whatsapp?: string;
          email?: string;
          currency?: string;
          template?: string;
          logo_url?: string | null;
          cover_url?: string | null;
          bio?: string | null;
          tagline?: string | null;
          sticker_text?: string | null;
          is_verified?: boolean;
          is_published?: boolean;
          storefront_views?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          dealership_id: string;
          make: string;
          model: string;
          year: number;
          price: number;
          currency: string;
          mileage_km: number;
          transmission: string;
          fuel: string;
          engine_size: string | null;
          colour: string | null;
          condition: string | null;
          duty_status: string | null;
          status: string;
          description: string | null;
          photos: string[];
          features: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          make: string;
          model: string;
          year: number;
          price: number;
          currency?: string;
          mileage_km: number;
          transmission: string;
          fuel: string;
          engine_size?: string | null;
          colour?: string | null;
          condition?: string | null;
          duty_status?: string | null;
          status?: string;
          description?: string | null;
          photos?: string[];
          features?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          make?: string;
          model?: string;
          year?: number;
          price?: number;
          currency?: string;
          mileage_km?: number;
          transmission?: string;
          fuel?: string;
          engine_size?: string | null;
          colour?: string | null;
          condition?: string | null;
          duty_status?: string | null;
          status?: string;
          description?: string | null;
          photos?: string[];
          features?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      enquiries: {
        Row: {
          id: string;
          dealership_id: string;
          vehicle_id: string | null;
          buyer_name: string;
          buyer_phone: string;
          buyer_email: string | null;
          message: string;
          stage: string;
          source: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          vehicle_id?: string | null;
          buyer_name: string;
          buyer_phone: string;
          buyer_email?: string | null;
          message: string;
          stage?: string;
          source?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          vehicle_id?: string | null;
          buyer_name?: string;
          buyer_phone?: string;
          buyer_email?: string | null;
          message?: string;
          stage?: string;
          source?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
