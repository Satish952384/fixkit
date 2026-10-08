/**
 * Placeholder Database type.
 *
 * No tables, views, functions or enums exist yet, so everything is empty.
 * Once your schema exists, replace this file with generated types:
 *
 *   npx supabase gen types typescript --project-id <your-project-id> > src/lib/supabase/types.ts
 *
 * The shape below matches what Supabase's generator produces, so the
 * clients that import `Database` will keep working after you replace it.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      [_ in never]: never;
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
};