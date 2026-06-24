export type Studio = {
  id: string;
  slug: string;
  name: string;
  description: string;
  preview_url: string | null;
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
  status: "draft" | "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  error_message: string | null;
  created_at: string;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
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
        Insert: Omit<Job, "id" | "status" | "progress" | "error_message" | "created_at" | "queued_at" | "started_at" | "completed_at"> & {
          id?: string;
          status?: Job["status"];
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
