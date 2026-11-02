export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      asset_events: {
        Row: {
          asset_id: string
          cost: number | null
          created_at: string
          date: string
          description: string
          id: string
          kind: Database["public"]["Enums"]["asset_event_kind"]
          provider_id: string | null
        }
        Insert: {
          asset_id: string
          cost?: number | null
          created_at?: string
          date?: string
          description: string
          id?: string
          kind?: Database["public"]["Enums"]["asset_event_kind"]
          provider_id?: string | null
        }
        Update: {
          asset_id?: string
          cost?: number | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["asset_event_kind"]
          provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          brand: string | null
          category: string
          created_at: string
          extended_warranty_expires: string | null
          household_id: string
          id: string
          model: string | null
          name: string
          notes: string | null
          photo_url: string | null
          purchase_date: string | null
          purchase_price: number | null
          room_id: string | null
          serial: string | null
          store: string | null
          useful_life_months: number | null
          warranty_expires: string | null
        }
        Insert: {
          brand?: string | null
          category?: string
          created_at?: string
          extended_warranty_expires?: string | null
          household_id: string
          id?: string
          model?: string | null
          name: string
          notes?: string | null
          photo_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          room_id?: string | null
          serial?: string | null
          store?: string | null
          useful_life_months?: number | null
          warranty_expires?: string | null
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string
          extended_warranty_expires?: string | null
          household_id?: string
          id?: string
          model?: string | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          room_id?: string | null
          serial?: string | null
          store?: string | null
          useful_life_months?: number | null
          warranty_expires?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      captures: {
        Row: {
          ai_extract: Json | null
          ai_status: Database["public"]["Enums"]["capture_ai_status"]
          created_at: string
          household_id: string
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["capture_kind"]
          raw_text: string | null
          review_status: Database["public"]["Enums"]["capture_review_status"]
        }
        Insert: {
          ai_extract?: Json | null
          ai_status?: Database["public"]["Enums"]["capture_ai_status"]
          created_at?: string
          household_id: string
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["capture_kind"]
          raw_text?: string | null
          review_status?: Database["public"]["Enums"]["capture_review_status"]
        }
        Update: {
          ai_extract?: Json | null
          ai_status?: Database["public"]["Enums"]["capture_ai_status"]
          created_at?: string
          household_id?: string
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["capture_kind"]
          raw_text?: string | null
          review_status?: Database["public"]["Enums"]["capture_review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "captures_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          citations: Json | null
          content: string
          created_at: string
          household_id: string
          id: string
          member_id: string | null
          role: Database["public"]["Enums"]["chat_role"]
        }
        Insert: {
          citations?: Json | null
          content: string
          created_at?: string
          household_id: string
          id?: string
          member_id?: string | null
          role: Database["public"]["Enums"]["chat_role"]
        }
        Update: {
          citations?: Json | null
          content?: string
          created_at?: string
          household_id?: string
          id?: string
          member_id?: string | null
          role?: Database["public"]["Enums"]["chat_role"]
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          asset_id: string | null
          category: string
          created_at: string
          expires_at: string | null
          file_url: string | null
          household_id: string
          id: string
          notes: string | null
          pet_id: string | null
          room_id: string | null
          title: string
          vehicle_id: string | null
        }
        Insert: {
          asset_id?: string | null
          category?: string
          created_at?: string
          expires_at?: string | null
          file_url?: string | null
          household_id: string
          id?: string
          notes?: string | null
          pet_id?: string | null
          room_id?: string | null
          title: string
          vehicle_id?: string | null
        }
        Update: {
          asset_id?: string | null
          category?: string
          created_at?: string
          expires_at?: string | null
          file_url?: string | null
          household_id?: string
          id?: string
          notes?: string | null
          pet_id?: string | null
          room_id?: string | null
          title?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          asset_id: string | null
          category: string
          created_at: string
          date: string
          description: string | null
          household_id: string
          id: string
          kind: Database["public"]["Enums"]["expense_kind"]
          room_id: string | null
        }
        Insert: {
          amount: number
          asset_id?: string | null
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          household_id: string
          id?: string
          kind?: Database["public"]["Enums"]["expense_kind"]
          room_id?: string | null
        }
        Update: {
          amount?: number
          asset_id?: string | null
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          household_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["expense_kind"]
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      household_layers: {
        Row: {
          active: boolean
          created_at: string
          household_id: string
          layer: Database["public"]["Enums"]["layer_key"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          household_id: string
          layer: Database["public"]["Enums"]["layer_key"]
        }
        Update: {
          active?: boolean
          created_at?: string
          household_id?: string
          layer?: Database["public"]["Enums"]["layer_key"]
        }
        Relationships: [
          {
            foreignKeyName: "household_layers_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          expires_at: string | null
          household_id: string
          id: string
          invited_email: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          household_id: string
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          household_id?: string
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["household_kind"]
          name: string
          timezone: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["household_kind"]
          name: string
          timezone?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["household_kind"]
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      obligation_occurrences: {
        Row: {
          amount_paid: number | null
          created_at: string
          due_date: string
          id: string
          obligation_id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["occurrence_status"]
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string
          due_date: string
          id?: string
          obligation_id: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["occurrence_status"]
        }
        Update: {
          amount_paid?: number | null
          created_at?: string
          due_date?: string
          id?: string
          obligation_id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["occurrence_status"]
        }
        Relationships: [
          {
            foreignKeyName: "obligation_occurrences_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          amount: number | null
          asset_id: string | null
          auto_renew: boolean
          created_at: string
          custom_interval_days: number | null
          frequency: Database["public"]["Enums"]["obligation_frequency"]
          household_id: string
          id: string
          kind: Database["public"]["Enums"]["obligation_kind"]
          next_due: string | null
          notes: string | null
          pet_id: string | null
          responsible_member_id: string | null
          room_id: string | null
          title: string
          vehicle_id: string | null
        }
        Insert: {
          amount?: number | null
          asset_id?: string | null
          auto_renew?: boolean
          created_at?: string
          custom_interval_days?: number | null
          frequency?: Database["public"]["Enums"]["obligation_frequency"]
          household_id: string
          id?: string
          kind?: Database["public"]["Enums"]["obligation_kind"]
          next_due?: string | null
          notes?: string | null
          pet_id?: string | null
          responsible_member_id?: string | null
          room_id?: string | null
          title: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number | null
          asset_id?: string | null
          auto_renew?: boolean
          created_at?: string
          custom_interval_days?: number | null
          frequency?: Database["public"]["Enums"]["obligation_frequency"]
          household_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["obligation_kind"]
          next_due?: string | null
          notes?: string | null
          pet_id?: string | null
          responsible_member_id?: string | null
          room_id?: string | null
          title?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obligations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_responsible_member_id_fkey"
            columns: ["responsible_member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          birthdate: string | null
          breed: string | null
          created_at: string
          household_id: string
          id: string
          name: string
          photo_url: string | null
          species: string | null
          weight_kg: number | null
        }
        Insert: {
          birthdate?: string | null
          breed?: string | null
          created_at?: string
          household_id: string
          id?: string
          name: string
          photo_url?: string | null
          species?: string | null
          weight_kg?: number | null
        }
        Update: {
          birthdate?: string | null
          breed?: string | null
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          photo_url?: string | null
          species?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          created_at: string
          household_id: string
          id: string
          last_watered: string | null
          location: string | null
          name: string
          watering_interval_days: number | null
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          last_watered?: string | null
          location?: string | null
          name: string
          watering_interval_days?: number | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          last_watered?: string | null
          location?: string | null
          name?: string
          watering_interval_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plants_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget_planned: number | null
          budget_spent: number
          created_at: string
          end_date: string | null
          household_id: string
          id: string
          name: string
          notes: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
        }
        Insert: {
          budget_planned?: number | null
          budget_spent?: number
          created_at?: string
          end_date?: string | null
          household_id: string
          id?: string
          name: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
        }
        Update: {
          budget_planned?: number | null
          budget_spent?: number
          created_at?: string
          end_date?: string | null
          household_id?: string
          id?: string
          name?: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
        }
        Relationships: [
          {
            foreignKeyName: "projects_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_services: {
        Row: {
          asset_id: string | null
          cost: number | null
          created_at: string
          date: string
          description: string
          id: string
          notes: string | null
          provider_id: string
          rating: number | null
          would_hire_again: boolean | null
        }
        Insert: {
          asset_id?: string | null
          cost?: number | null
          created_at?: string
          date?: string
          description: string
          id?: string
          notes?: string | null
          provider_id: string
          rating?: number | null
          would_hire_again?: boolean | null
        }
        Update: {
          asset_id?: string | null
          cost?: number | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          notes?: string | null
          provider_id?: string
          rating?: number | null
          would_hire_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_services_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          specialty: string | null
          trusted: boolean
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          trusted?: boolean
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          trusted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "providers_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          household_id: string
          id: string
          kind: string
          kind_area: Database["public"]["Enums"]["room_area"]
          layout: Json
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          kind?: string
          kind_area?: Database["public"]["Enums"]["room_area"]
          layout?: Json
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          kind?: string
          kind_area?: Database["public"]["Enums"]["room_area"]
          layout?: Json
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "rooms_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          created_at: string
          household_id: string
          id: string
          model: string | null
          name: string
          odometer: number | null
          plate: string | null
          purchase_date: string | null
          year: number | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          household_id: string
          id?: string
          model?: string | null
          name: string
          odometer?: number | null
          plate?: string | null
          purchase_date?: string | null
          year?: number | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          household_id?: string
          id?: string
          model?: string | null
          name?: string
          odometer?: number | null
          plate?: string | null
          purchase_date?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage: { Args: { _household_id: string }; Returns: boolean }
      can_write: { Args: { _household_id: string }; Returns: boolean }
      claim_invites: { Args: never; Returns: number }
      create_household: {
        Args: { _address?: string; _kind?: string; _name: string }
        Returns: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["household_kind"]
          name: string
          timezone: string
        }
        SetofOptions: {
          from: "*"
          to: "households"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_member: { Args: { _household_id: string }; Returns: boolean }
      profiles_visible: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      asset_event_kind: "manutencao" | "reparo" | "substituicao" | "observacao"
      capture_ai_status: "pendente" | "processando" | "pronto" | "erro"
      capture_kind: "foto" | "texto" | "email"
      capture_review_status: "pendente" | "aplicado" | "descartado"
      chat_role: "user" | "assistant"
      expense_kind: "fixo" | "variavel" | "eventual" | "sazonal"
      household_kind:
        | "casa"
        | "apartamento"
        | "sitio"
        | "praia"
        | "alugado"
        | "outro"
      layer_key: "veiculos" | "pets" | "jardim"
      member_role: "owner" | "manager" | "member" | "viewer" | "guest"
      obligation_frequency:
        | "one_time"
        | "monthly"
        | "quarterly"
        | "semiannual"
        | "yearly"
        | "custom"
      obligation_kind:
        | "conta"
        | "tributo"
        | "seguro"
        | "revisao"
        | "vacina"
        | "contrato"
        | "outro"
      occurrence_status: "pendente" | "pago" | "feito"
      project_status: "planejado" | "andamento" | "concluido"
      room_area: "interna" | "externa" | "garagem"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asset_event_kind: ["manutencao", "reparo", "substituicao", "observacao"],
      capture_ai_status: ["pendente", "processando", "pronto", "erro"],
      capture_kind: ["foto", "texto", "email"],
      capture_review_status: ["pendente", "aplicado", "descartado"],
      chat_role: ["user", "assistant"],
      expense_kind: ["fixo", "variavel", "eventual", "sazonal"],
      household_kind: [
        "casa",
        "apartamento",
        "sitio",
        "praia",
        "alugado",
        "outro",
      ],
      layer_key: ["veiculos", "pets", "jardim"],
      member_role: ["owner", "manager", "member", "viewer", "guest"],
      obligation_frequency: [
        "one_time",
        "monthly",
        "quarterly",
        "semiannual",
        "yearly",
        "custom",
      ],
      obligation_kind: [
        "conta",
        "tributo",
        "seguro",
        "revisao",
        "vacina",
        "contrato",
        "outro",
      ],
      occurrence_status: ["pendente", "pago", "feito"],
      project_status: ["planejado", "andamento", "concluido"],
      room_area: ["interna", "externa", "garagem"],
    },
  },
} as const
