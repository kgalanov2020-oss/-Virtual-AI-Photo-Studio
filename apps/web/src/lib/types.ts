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
  created_at: string;
  paid_at: string | null;
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
        Insert: Omit<Job, "id" | "generation_mode" | "status" | "payment_status" | "paid_at" | "amount_cents" | "currency" | "product_code" | "progress" | "error_message" | "created_at" | "queued_at" | "started_at" | "completed_at"> & {
          id?: string;
          generation_mode?: GenerationMode;
          status?: Job["status"];
          payment_status?: Job["payment_status"];
          paid_at?: string | null;
          amount_cents?: number;
          currency?: string;
          product_code?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
