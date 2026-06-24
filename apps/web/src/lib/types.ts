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
      };
      studio_shots: {
        Row: StudioShot;
        Insert: Omit<StudioShot, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<StudioShot>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
