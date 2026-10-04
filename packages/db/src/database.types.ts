
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "care_events": {
                  Row: {
                    "client_id": string | null,"created_at": string,"diagnosis_id": string | null,"household_id": string,"id": string,"kind": string,"leaf_states": (string)[],"new_status": string | null,"next_check_on": string | null,"occurred_at": string,"photo_path": string | null,"plant_id": string,"soil_dry": boolean | null,"task_id": string | null,"user_id": string | null,"water_task_created": boolean | null
                  }
                  Insert: {
                    "client_id"?: string | null,"created_at"?: string,"diagnosis_id"?: string | null,"household_id": string,"id"?: string,"kind": string,"leaf_states"?: (string)[],"new_status"?: string | null,"next_check_on"?: string | null,"occurred_at": string,"photo_path"?: string | null,"plant_id": string,"soil_dry"?: boolean | null,"task_id"?: string | null,"user_id"?: string | null,"water_task_created"?: boolean | null
                  }
                  Update: {
                    "client_id"?: string | null,"created_at"?: string,"diagnosis_id"?: string | null,"household_id"?: string,"id"?: string,"kind"?: string,"leaf_states"?: (string)[],"new_status"?: string | null,"next_check_on"?: string | null,"occurred_at"?: string,"photo_path"?: string | null,"plant_id"?: string,"soil_dry"?: boolean | null,"task_id"?: string | null,"user_id"?: string | null,"water_task_created"?: boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_events_diagnosis_id_fkey"
      columns: ["diagnosis_id"]
isOneToOne: false
      referencedRelation: "diagnoses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_events_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_events_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_events_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "care_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"care_tasks": {
                  Row: {
                    "completed_at": string | null,"completed_by": string | null,"created_at": string,"due_on": string,"household_id": string,"id": string,"kind": string,"plant_id": string,"status": string
                  }
                  Insert: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"due_on": string,"household_id": string,"id"?: string,"kind": string,"plant_id": string,"status"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"due_on"?: string,"household_id"?: string,"id"?: string,"kind"?: string,"plant_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_tasks_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_tasks_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    }
                  ]
                },"diagnoses": {
                  Row: {
                    "applied_at": string | null,"condition_name": string,"created_at": string,"details": NonNullable<Json>,"effect": Json | null,"id": string,"observation_id": string | null,"plant_id": string,"probability": number,"user_id": string | null
                  }
                  Insert: {
                    "applied_at"?: string | null,"condition_name": string,"created_at"?: string,"details"?: NonNullable<Json>,"effect"?: Json | null,"id"?: string,"observation_id"?: string | null,"plant_id": string,"probability": number,"user_id"?: string | null
                  }
                  Update: {
                    "applied_at"?: string | null,"condition_name"?: string,"created_at"?: string,"details"?: NonNullable<Json>,"effect"?: Json | null,"id"?: string,"observation_id"?: string | null,"plant_id"?: string,"probability"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "diagnoses_observation_id_fkey"
      columns: ["observation_id"]
isOneToOne: false
      referencedRelation: "observations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "diagnoses_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    }
                  ]
                },"entitlements": {
                  Row: {
                    "active_until": string,"environment": string | null,"product": string,"product_id": string | null,"source": string,"store": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "active_until": string,"environment"?: string | null,"product"?: string,"product_id"?: string | null,"source": string,"store"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active_until"?: string,"environment"?: string | null,"product"?: string,"product_id"?: string | null,"source"?: string,"store"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"household_members": {
                  Row: {
                    "household_id": string,"joined_at": string,"role": string,"user_id": string
                  }
                  Insert: {
                    "household_id": string,"joined_at"?: string,"role": string,"user_id": string
                  }
                  Update: {
                    "household_id"?: string,"joined_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_pets": {
                  Row: {
                    "animal": string,"created_at": string,"household_id": string,"id": string,"name": string | null
                  }
                  Insert: {
                    "animal": string,"created_at"?: string,"household_id": string,"id"?: string,"name"?: string | null
                  }
                  Update: {
                    "animal"?: string,"created_at"?: string,"household_id"?: string,"id"?: string,"name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_pets_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"household_vets": {
                  Row: {
                    "household_id": string,"name": string,"phone": string,"updated_at": string
                  }
                  Insert: {
                    "household_id": string,"name": string,"phone": string,"updated_at"?: string
                  }
                  Update: {
                    "household_id"?: string,"name"?: string,"phone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_vets_household_id_fkey"
      columns: ["household_id"]
isOneToOne: true
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"observation_locations": {
                  Row: {
                    "accuracy_m": number | null,"cell_r5": number | null,"cell_r7": number | null,"mocked": boolean,"observation_id": string,"point": unknown,"user_id": string
                  }
                  Insert: {
                    "accuracy_m"?: number | null,"cell_r5"?: number | null,"cell_r7"?: number | null,"mocked"?: boolean,"observation_id": string,"point": unknown,"user_id": string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"cell_r5"?: number | null,"cell_r7"?: number | null,"mocked"?: boolean,"observation_id"?: string,"point"?: unknown,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "observation_locations_observation_id_fkey"
      columns: ["observation_id"]
isOneToOne: true
      referencedRelation: "observations"
      referencedColumns: ["id"]
    }
                  ]
                },"observation_photos": {
                  Row: {
                    "bytes": number | null,"created_at": string,"height": number | null,"id": string,"observation_id": string,"organ": string | null,"sha256": string,"storage_path": string,"user_id": string,"width": number | null
                  }
                  Insert: {
                    "bytes"?: number | null,"created_at"?: string,"height"?: number | null,"id"?: string,"observation_id": string,"organ"?: string | null,"sha256": string,"storage_path": string,"user_id": string,"width"?: number | null
                  }
                  Update: {
                    "bytes"?: number | null,"created_at"?: string,"height"?: number | null,"id"?: string,"observation_id"?: string,"organ"?: string | null,"sha256"?: string,"storage_path"?: string,"user_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "observation_photos_observation_id_fkey"
      columns: ["observation_id"]
isOneToOne: false
      referencedRelation: "observations"
      referencedColumns: ["id"]
    }
                  ]
                },"observations": {
                  Row: {
                    "capture_source": string,"confidence": number | null,"confirmed_at": string | null,"created_at": string,"device_time": string,"health_requested": boolean,"health_result": Json | null,"household_id": string | null,"id": string,"image_hash": string | null,"integrity": NonNullable<Json>,"intent": string | null,"no_points_reason": string | null,"organs": (string)[],"place_type": string | null,"plant_id": string | null,"points_status": string,"public_cell_r5": number | null,"species_id": string | null,"status": string,"suggestions": NonNullable<Json>,"user_id": string
                  }
                  Insert: {
                    "capture_source": string,"confidence"?: number | null,"confirmed_at"?: string | null,"created_at"?: string,"device_time": string,"health_requested"?: boolean,"health_result"?: Json | null,"household_id"?: string | null,"id"?: string,"image_hash"?: string | null,"integrity"?: NonNullable<Json>,"intent"?: string | null,"no_points_reason"?: string | null,"organs"?: (string)[],"place_type"?: string | null,"plant_id"?: string | null,"points_status"?: string,"public_cell_r5"?: number | null,"species_id"?: string | null,"status"?: string,"suggestions"?: NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "capture_source"?: string,"confidence"?: number | null,"confirmed_at"?: string | null,"created_at"?: string,"device_time"?: string,"health_requested"?: boolean,"health_result"?: Json | null,"household_id"?: string | null,"id"?: string,"image_hash"?: string | null,"integrity"?: NonNullable<Json>,"intent"?: string | null,"no_points_reason"?: string | null,"organs"?: (string)[],"place_type"?: string | null,"plant_id"?: string | null,"points_status"?: string,"public_cell_r5"?: number | null,"species_id"?: string | null,"status"?: string,"suggestions"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "observations_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "observations_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "observations_species_id_fkey"
      columns: ["species_id"]
isOneToOne: false
      referencedRelation: "species"
      referencedColumns: ["id"]
    }
                  ]
                },"partners": {
                  Row: {
                    "contact_email": string | null,"created_at": string,"id": string,"kind": string,"name": string
                  }
                  Insert: {
                    "contact_email"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"name": string
                  }
                  Update: {
                    "contact_email"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"plantdex_entries": {
                  Row: {
                    "category": string,"finds_count": number,"first_found_at": string,"first_observation_id": string | null,"species_id": string,"user_id": string
                  }
                  Insert: {
                    "category": string,"finds_count"?: number,"first_found_at": string,"first_observation_id"?: string | null,"species_id": string,"user_id": string
                  }
                  Update: {
                    "category"?: string,"finds_count"?: number,"first_found_at"?: string,"first_observation_id"?: string | null,"species_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plantdex_entries_first_observation_id_fkey"
      columns: ["first_observation_id"]
isOneToOne: false
      referencedRelation: "observations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plantdex_entries_species_id_fkey"
      columns: ["species_id"]
isOneToOne: false
      referencedRelation: "species"
      referencedColumns: ["id"]
    }
                  ]
                },"plants": {
                  Row: {
                    "care_state": NonNullable<Json>,"cell_r7": number | null,"client_id": string | null,"created_at": string,"created_by": string | null,"death_cause": string | null,"drainage": string,"household_id": string,"id": string,"indoor": boolean,"label_code": string | null,"light": string,"nickname": string,"observation_id": string | null,"parent_plant_id": string | null,"photo_path": string | null,"pot_material": string,"pot_size_cm": number | null,"room": string | null,"source": string,"species_id": string,"status": string,"status_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "care_state"?: NonNullable<Json>,"cell_r7"?: number | null,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"death_cause"?: string | null,"drainage"?: string,"household_id": string,"id"?: string,"indoor"?: boolean,"label_code"?: string | null,"light"?: string,"nickname": string,"observation_id"?: string | null,"parent_plant_id"?: string | null,"photo_path"?: string | null,"pot_material"?: string,"pot_size_cm"?: number | null,"room"?: string | null,"source": string,"species_id": string,"status"?: string,"status_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "care_state"?: NonNullable<Json>,"cell_r7"?: number | null,"client_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"death_cause"?: string | null,"drainage"?: string,"household_id"?: string,"id"?: string,"indoor"?: boolean,"label_code"?: string | null,"light"?: string,"nickname"?: string,"observation_id"?: string | null,"parent_plant_id"?: string | null,"photo_path"?: string | null,"pot_material"?: string,"pot_size_cm"?: number | null,"room"?: string | null,"source"?: string,"species_id"?: string,"status"?: string,"status_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plants_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plants_observation_fk"
      columns: ["observation_id"]
isOneToOne: false
      referencedRelation: "observations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plants_parent_plant_id_fkey"
      columns: ["parent_plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plants_species_id_fkey"
      columns: ["species_id"]
isOneToOne: false
      referencedRelation: "species"
      referencedColumns: ["id"]
    }
                  ]
                },"privacy_zones": {
                  Row: {
                    "center": unknown,"radius_m": number,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "center": unknown,"radius_m": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "center"?: unknown,"radius_m"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "age_confirmed_13_plus": boolean,"country_code": string,"created_at": string,"display_name": string | null,"handle": string,"id": string,"preview_used_at": string | null,"referral_code": string,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "age_confirmed_13_plus"?: boolean,"country_code"?: string,"created_at"?: string,"display_name"?: string | null,"handle": string,"id": string,"preview_used_at"?: string | null,"referral_code"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "age_confirmed_13_plus"?: boolean,"country_code"?: string,"created_at"?: string,"display_name"?: string | null,"handle"?: string,"id"?: string,"preview_used_at"?: string | null,"referral_code"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"last_seen_at": string,"platform": string,"token": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"last_seen_at"?: string,"platform": string,"token": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"last_seen_at"?: string,"platform"?: string,"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"qr_codes": {
                  Row: {
                    "code": string,"created_at": string,"cultivar": string | null,"partner_id": string,"species_id": string,"status": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"cultivar"?: string | null,"partner_id": string,"species_id": string,"status"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"cultivar"?: string | null,"partner_id"?: string,"species_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "qr_codes_partner_id_fkey"
      columns: ["partner_id"]
isOneToOne: false
      referencedRelation: "partners"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qr_codes_species_id_fkey"
      columns: ["species_id"]
isOneToOne: false
      referencedRelation: "species"
      referencedColumns: ["id"]
    }
                  ]
                },"qr_scans": {
                  Row: {
                    "code": string,"created_at": string,"event": string,"id": string,"platform": string | null,"user_id": string | null
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"event": string,"id"?: string,"platform"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"event"?: string,"id"?: string,"platform"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "qr_scans_code_fkey"
      columns: ["code"]
isOneToOne: false
      referencedRelation: "qr_codes"
      referencedColumns: ["code"]
    }
                  ]
                },"species": {
                  Row: {
                    "check_interval_days": number | null,"common_name": string,"created_at": string,"family": string | null,"gbif_id": number | null,"genus": string | null,"id": string,"image_credit": string | null,"image_url": string | null,"is_houseplant": boolean,"light": string | null,"provider_entity_id": string | null,"rarity_tier": string,"scientific_name": string,"sensitive": boolean,"slug": string,"updated_at": string,"warmth": string | null,"watering_max": number | null,"watering_min": number | null
                  }
                  Insert: {
                    "check_interval_days"?: number | null,"common_name": string,"created_at"?: string,"family"?: string | null,"gbif_id"?: number | null,"genus"?: string | null,"id"?: string,"image_credit"?: string | null,"image_url"?: string | null,"is_houseplant"?: boolean,"light"?: string | null,"provider_entity_id"?: string | null,"rarity_tier"?: string,"scientific_name": string,"sensitive"?: boolean,"slug": string,"updated_at"?: string,"warmth"?: string | null,"watering_max"?: number | null,"watering_min"?: number | null
                  }
                  Update: {
                    "check_interval_days"?: number | null,"common_name"?: string,"created_at"?: string,"family"?: string | null,"gbif_id"?: number | null,"genus"?: string | null,"id"?: string,"image_credit"?: string | null,"image_url"?: string | null,"is_houseplant"?: boolean,"light"?: string | null,"provider_entity_id"?: string | null,"rarity_tier"?: string,"scientific_name"?: string,"sensitive"?: boolean,"slug"?: string,"updated_at"?: string,"warmth"?: string | null,"watering_max"?: number | null,"watering_min"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"species_toxicity": {
                  Row: {
                    "animal": string,"review_status": string,"reviewed_at": string | null,"reviewed_by": string | null,"severity": string,"source_name": string | null,"source_url": string | null,"species_id": string,"summary": string | null,"symptoms": string | null
                  }
                  Insert: {
                    "animal": string,"review_status"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"severity": string,"source_name"?: string | null,"source_url"?: string | null,"species_id": string,"summary"?: string | null,"symptoms"?: string | null
                  }
                  Update: {
                    "animal"?: string,"review_status"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"severity"?: string,"source_name"?: string | null,"source_url"?: string | null,"species_id"?: string,"summary"?: string | null,"symptoms"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "species_toxicity_species_id_fkey"
      columns: ["species_id"]
isOneToOne: false
      referencedRelation: "species"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_counters": {
                  Row: {
                    "kind": string,"period_key": string,"used": number,"user_id": string
                  }
                  Insert: {
                    "kind": string,"period_key": string,"used"?: number,"user_id": string
                  }
                  Update: {
                    "kind"?: string,"period_key"?: string,"used"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "public_label":
{ Args: { "p_code": string }; Returns: Json
                           },
"srv_bootstrap":
{ Args: { "p_country_code": string,"p_display_name": string,"p_handle": string,"p_timezone": string,"p_uid": string }; Returns: Json
                           },
"srv_check_in":
{ Args: { "p_client_id": string,"p_create_water": boolean,"p_leaf_states": (string)[],"p_next_check_on": string,"p_occurred_at": string,"p_photo_path": string,"p_plant_id": string,"p_soil_dry": boolean,"p_today": string,"p_uid": string }; Returns: Json
                           },
"srv_complete_task":
{ Args: { "p_client_id": string,"p_occurred_at": string,"p_task_id": string,"p_uid": string }; Returns: Json
                           },
"srv_confirm_observation":
{ Args: { "p_action": string,"p_first_check_on": string,"p_household_id": string,"p_now": string,"p_observation_id": string,"p_place_type": string,"p_setup": Json,"p_species_id": string,"p_uid": string }; Returns: Json
                           },
"srv_create_plant":
{ Args: { "p_client_id"?: string,"p_drainage": string,"p_first_check_on": string,"p_household_id": string,"p_indoor": boolean,"p_label_code": string,"p_light": string,"p_nickname": string,"p_now": string,"p_observation_id": string,"p_pot_material": string,"p_pot_size_cm": number,"p_room": string,"p_source": string,"p_species_id": string,"p_uid": string }; Returns: string
                           },
"srv_get_provider_token":
{ Args: { "p_observation_id": string,"p_uid": string }; Returns: string
                           },
"srv_is_premium":
{ Args: { "p_uid": string }; Returns: boolean
                           },
"srv_plantdex_record":
{ Args: { "p_category": string,"p_found_at": string,"p_observation_id": string,"p_species_id": string,"p_uid": string }; Returns: Json
                           },
"srv_plants_missing_cell":
{ Args: { "p_limit": number }; Returns: {
              "owner_tz": string,"plant_id": string,"zone_lat": number,"zone_lng": number
            }[]
                           },
"srv_point_in_zone":
{ Args: { "p_lat": number,"p_lng": number,"p_uid": string }; Returns: boolean
                           },
"srv_release_usage":
{ Args: { "p_kind": string,"p_period_key": string,"p_uid": string }; Returns: undefined
                           },
"srv_replace_pets":
{ Args: { "p_household_id": string,"p_pets": Json,"p_uid": string }; Returns: undefined
                           },
"srv_reserve_usage":
{ Args: { "p_kind": string,"p_limit": number,"p_period_key": string,"p_uid": string }; Returns: Json
                           },
"srv_set_plant_cells":
{ Args: { "p_cells": Json }; Returns: number
                           },
"srv_set_plant_status":
{ Args: { "p_base_days": number,"p_death_cause": string,"p_now": string,"p_plant_id": string,"p_status": string,"p_today": string,"p_uid": string }; Returns: Json
                           },
"srv_store_provider":
{ Args: { "p_access_token": string,"p_observation_id": string,"p_provider": string,"p_raw": Json,"p_uid": string }; Returns: undefined
                           },
"srv_weather_cells_due":
{ Args: { "p_limit": number,"p_older_than": string }; Returns: {
              "cell": string,"tz": string
            }[]
                           },
"srv_weather_for_cell":
{ Args: { "p_cell": string }; Returns: {
              "fetched_at": string,"summary": Json
            }[]
                           },
"srv_weather_store":
{ Args: { "p_cell": string,"p_summary": Json,"p_tz": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
