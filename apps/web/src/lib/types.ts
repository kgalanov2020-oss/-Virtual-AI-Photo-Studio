export type GenerationMode = "standard" | "child_safe";

export type Studio = {
  id: string;
  slug: string;
  name: string;
  description: string;
  preview_url: string | null;
  gallery_urls?: string[];
  wardrobe_prompt?: string;
  is_active: boolean;
  created_at: string;
};

export type StudioShot = {
  id: string;
  studio_id: string;
  slug: string;
  name: string;
  camera_angle: string;
  pose: string;
  crop: string;
  prompt: string;
  negative_prompt: string;
  variations: number;
  sort_order: number;
  created_at: string;
};

export type UploadedSelfie = {
  id: string;
  job_id: string;
  user_id: string;
  file_url: string;
  quality_score: number | null;
  face_angle: string | null;
  is_approved: boolean;
  rejection_reason: string | null;
  created_at: string;
};

export type Job = {
  id: string;
  user_id: string;
  studio_id: string;
  generation_mode: GenerationMode;
  status: "draft" | "awaiting_payment" | "queued" | "running" | "completed" | "failed" | "cancelled";
  payment_status: "unpaid" | "pending" | "paid" | "refunded" | "failed";
  paid_at: string | null;
  amount_cents: number;
  currency: string;
  product_code: string;
  target_image_count: number;
  progress: number;
  error_message: string | null;
  created_at: string;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type Order = {
  id: string;
  job_id: string;
  user_id: string;
  status: "pending" | "paid" | "cancelled" | "failed" | "refunded";
  provider: string;
  provider_session_id: string | null;
  provider_payment_id: string | null;
  checkout_url: string | null;
  amount_cents: number;
  currency: string;
  product_code: string;
  product_name: string;
  target_image_count: number;
  created_at: string;
  paid_at: string | null;
  updated_at: string;
};

export type UserProfile = {
  user_id: string;
  email: string;
  free_images_remaining: number;
  legal_terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  personal_data_accepted_at: string | null;
  photo_rights_accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PromoCode = {
  id: string;
  code: string;
  credit_amount: number;
  description: string | null;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  created_at: string;
};

export type PromoRedemption = {
  id: string;
  promo_code_id: string;
  user_id: string;
  email: string;
  credits_granted: number;
  created_at: string;
};

export type OutreachLead = {
  id: string;
  unique_key: string;
  studio_name: string;
  city: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  promo_code: string;
  status:
    | "new"
    | "needs_manual_email"
    | "needs_review"
    | "approved"
    | "sent"
    | "replied"
    | "stop"
    | "bad_email"
    | "duplicate";
  last_contacted_at: string | null;
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GeneratedImage = {
  id: string;
  job_id: string;
  user_id: string;
  studio_shot_id: string;
  image_url: string;
  seed: number | null;
  variation_index: number;
  is_favorite: boolean;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      studios: {
        Row: Studio;
        Insert: Omit<Studio, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Studio>;
        Relationships: [];
      };
      studio_shots: {
        Row: StudioShot;
        Insert: Omit<StudioShot, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<StudioShot>;
        Relationships: [];
      };
      jobs: {
        Row: Job;
        Insert: Omit<Job, "id" | "generation_mode" | "status" | "payment_status" | "paid_at" | "amount_cents" | "currency" | "product_code" | "target_image_count" | "progress" | "error_message" | "created_at" | "queued_at" | "started_at" | "completed_at"> & {
          id?: string;
          generation_mode?: GenerationMode;
          status?: Job["status"];
          payment_status?: Job["payment_status"];
          paid_at?: string | null;
          amount_cents?: number;
          currency?: string;
          product_code?: string;
          target_image_count?: number;
          progress?: number;
          error_message?: string | null;
          created_at?: string;
          queued_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: Partial<Job>;
        Relationships: [];
      };
      uploaded_selfies: {
        Row: UploadedSelfie;
        Insert: Omit<
          UploadedSelfie,
          "id" | "quality_score" | "face_angle" | "is_approved" | "rejection_reason" | "created_at"
        > & {
          id?: string;
          quality_score?: number | null;
          face_angle?: string | null;
          is_approved?: boolean;
          rejection_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<UploadedSelfie>;
        Relationships: [];
      };
      generated_images: {
        Row: GeneratedImage;
        Insert: Omit<GeneratedImage, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<GeneratedImage>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Omit<
          Order,
          "id" | "provider_session_id" | "provider_payment_id" | "checkout_url" | "paid_at" | "created_at" | "updated_at"
        > & {
          id?: string;
          provider_session_id?: string | null;
          provider_payment_id?: string | null;
          checkout_url?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Order>;
        Relationships: [];
      };
      user_profiles: {
        Row: UserProfile;
        Insert: Omit<
          UserProfile,
          | "free_images_remaining"
          | "legal_terms_accepted_at"
          | "privacy_accepted_at"
          | "personal_data_accepted_at"
          | "photo_rights_accepted_at"
          | "created_at"
          | "updated_at"
        > & {
          free_images_remaining?: number;
          legal_terms_accepted_at?: string | null;
          privacy_accepted_at?: string | null;
          personal_data_accepted_at?: string | null;
          photo_rights_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<UserProfile>;
        Relationships: [];
      };
      promo_codes: {
        Row: PromoCode;
        Insert: Omit<PromoCode, "id" | "redeemed_count" | "created_at"> & {
          id?: string;
          redeemed_count?: number;
          created_at?: string;
        };
        Update: Partial<PromoCode>;
        Relationships: [];
      };
      promo_redemptions: {
        Row: PromoRedemption;
        Insert: Omit<PromoRedemption, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<PromoRedemption>;
        Relationships: [];
      };
      outreach_leads: {
        Row: OutreachLead;
        Insert: Omit<OutreachLead, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<OutreachLead>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
