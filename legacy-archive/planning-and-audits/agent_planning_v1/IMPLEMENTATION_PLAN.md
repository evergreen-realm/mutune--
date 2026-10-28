# MutuneRent Pro — Database Schema Review & Implementation Plan

**Version:** 1.0.0
**Date:** June 2025
**Status:** Production
**Classification:** Internal — Engineering

---

## 1. Current Schema Analysis

### 1.1 Schema Overview

MutuneRent Pro uses **MongoDB 8.4.0** with **Mongoose 8.4.0** as the ODM. The database contains **11 collections** with a mix of document references (`ObjectId`) and embedded subdocuments. The schema is designed for a multi-tenant property management platform with strong RBAC, geospatial capabilities, and financial audit trails.

### 1.2 Entity Relationship Diagram (Conceptual)

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      User        │◄──────│    Property      │◄──────│  PropertyTier    │
│  (6 roles)       │ 1:N   │  (units[] embed) │ N:1   │  (Bronze→Plat)  │
│  clerk_id        │       │  (inventory[]   │       │                  │
│  last_location   │       │   embed)         │       │                  │
└────────┬─────────┘       └────────┬─────────┘       └──────────────────┘
         │                          │
         │ 1:N                      │ 1:N (via current_*)
         ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      Task        │       │     Tenant       │◄──────│     Payment      │
│  (assigned_to)   │       │  payment_history │       │  mpesa_callback  │
│  (assigned_by)   │       │  kyc_documents[] │       │  verification_*  │
└──────────────────┘       └────────┬─────────┘       └────────┬─────────┘
                                    │                          │
                                    │ 1:N                      │ N:1
                                    ▼                          ▼
                           ┌──────────────────┐       ┌──────────────────┐
                           │ MaintenanceTicket│       │     Notice       │
                           │  (photos[])      │       │  delivery_status[]│
                           │  (agent_notes)   │       │  (acknowledgment)│
                           └──────────────────┘       └──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│  Notification     │       │  SystemSetting   │
│  (recipient_ids)  │       │  (key-value)     │
│  (read/dismissed) │       │                  │
└──────────────────┘       └──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│   LateFeeRule    │       │  (no explicit    │
│  (grace_days)    │       │   AuditLog       │
│  (penalty_type)  │       │   collection)    │
└──────────────────┘       └──────────────────┘
```

### 1.3 Model-by-Model Deep Dive

#### 1.3.1 User Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `user_code` | String | `unique`, `required` | Auto-generated pre-validate: `USR-AUTO-<timestamp>-<rand>` |
| `role` | String | `enum: 6 roles`, `index: true` | `super_admin`, `admin`, `agent`, `landlord`, `accountant`, `tenant` |
| `full_name` | String | `required` | Synced from Clerk on every login |
| `email` | String | `unique`, `required` | Primary identity key; linked to Clerk |
| `phone` | String | — | Kenyan format `254XXXXXXXXX` |
| `password_hash` | String | — | Legacy field; current auth uses Clerk |
| `earb_license` | String | — | Estate Agents Registration Board license |
| `earb_verified` | Boolean | `default: false` | — |
| `earb_verification_doc_url` | String | — | R2 URL for agent verification doc |
| `agent_approval_status` | String | `enum: 4 states`, `default: 'n_a'` | `pending`, `approved`, `rejected`, `n_a` |
| `agent_rejection_reason` | String | — | Human-readable rejection reason |
| `agent_allow_all_areas` | Boolean | `default: false` | Super-agent flag |
| `landlord_id` | String | `unique`, `sparse` | 6-digit generated ID (e.g., `100001`) |
| `landlord_approval_status` | String | `enum: 4 states`, `default: 'n_a'`, `index: true` | Same enum as agent |
| `landlord_verification_doc_url` | String | — | R2 URL for property ownership proof |
| `admin_hardcoded_hash` | String | — | bcrypt hash of env `ADMIN_PASSWORD` |
| `assigned_areas` | [String] | — | Area names for agent scoping |
| `assigned_property_ids` | [ObjectId] | `ref: 'Property'` | Direct property assignments for agents |
| `ai_memory_id` | String | `unique`, `sparse` | Future AI long-term memory key |
| `current_property_id` | ObjectId | `ref: 'Property'` | Tenant's current property (for tenant role) |
| `current_unit_id` | ObjectId | — | Tenant's current unit (for tenant role) |
| `last_location` | GeoJSON Point | `2dsphere index` | Agent's last GPS check-in |
| `last_checkin_photo` | String | — | R2 URL for verification photo |
| `is_active` | Boolean | `default: true` | Soft-disable flag |
| `clerk_id` | String | `unique`, `sparse` | Clerk user ID for JWT auth |
| `created_at` | Date | `default: Date.now` | — |

**Schema Validation:**
- `pre('validate')`: Auto-generates `user_code` if missing.
- `pre('save')`: Hashes `admin_hardcoded_hash` with bcrypt (cost 10) for admin/super_admin roles.

**Strengths:**
- Single collection for all roles simplifies authentication.
- Sparse indexes prevent null-value bloat.
- GeoJSON `last_location` enables spatial agent tracking.

**Weaknesses:**
- No separate `AuditLog` collection; soft-delete anonymizes PII but doesn't preserve original values for compliance.
- `phone` lacks regex validation at schema level (handled in routes).
- `current_property_id` and `current_unit_id` on `User` are redundant with `Tenant.current_property_id` — potential source of drift.

---

#### 1.3.2 Property Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `property_code` | String | `unique`, `required` | Auto-generated: `MUT-<areaTag>-<count>` |
| `name` | String | `required` | Display name |
| `type` | String | `enum: 8 types`, `required` | `apartment`, `single_family`, `commercial`, `mixed_use`, `bedsitter`, `studio`, `house`, `single` |
| `address` | Embedded | — | `street`, `area`, `city` (default: Mombasa), `county`, `plus_code` |
| `location` | GeoJSON Point | `2dsphere index` | Property centroid coordinates |
| `boundaries` | GeoJSON Polygon | — | Property boundary for advanced geofencing |
| `units` | [UnitSchema] | Embedded | Up to hundreds of units per property |
| `landlord_id` | ObjectId | `ref: 'User'` | Owner reference |
| `agent_ids` | [ObjectId] | `ref: 'User'` | Assigned agents |
| `inventory` | [InventoryItemSchema] | Embedded | Asset tracking |
| `amenities` | [String] | — | Free-text tags (e.g., "pool", "gym") |
| `status` | String | `enum: 3 states`, `default: 'active'` | `pending_admin_approval`, `active`, `inactive` |
| `contract_pdf_url` | String | — | Landlord signature/contract PDF |
| `tier_id` | ObjectId | `ref: 'PropertyTier'` | Approved tier classification |
| `proposed_tier_id` | ObjectId | `ref: 'PropertyTier'` | Agent-proposed tier pending admin approval |
| `tier_approved_by` | ObjectId | `ref: 'User'` | Admin who approved tier |
| `tier_approved_at` | Date | — | Approval timestamp |
| `review_status` | String | `enum: 4 states`, `default: 'pending_agent'` | `pending_agent`, `pending_admin`, `approved`, `rejected` |
| `photos` | [String] | — | R2 URLs for property photos |
| `created_at` | Date | `default: Date.now` | — |
| `updated_at` | Date | `default: Date.now` | Auto-updated on save |

**UnitSchema (Embedded):**

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `unit_number` | String | `required` | E.g., "1A", "B2" |
| `unit_type` | String | — | E.g., "bedsitter", "1-bedroom" |
| `bedrooms` | Number | — | — |
| `bathrooms` | Number | — | — |
| `floor` | Number | — | — |
| `size_sqft` | Number | — | Imperial measure |
| `size_sqm` | Number | — | Metric measure |
| `rent_kes` | Number | `required`, `min: 0` | Monthly rent in KES |
| `status` | String | `enum: 4 states`, `default: 'vacant'` | `vacant`, `occupied`, `maintenance`, `notice_issued` |
| `current_tenant_id` | ObjectId | `ref: 'Tenant'` | Occupant reference |
| `lock_status` | String | `enum: 5 states`, `default: 'unlocked'` | Digital lock state machine |
| `unit_geolocation` | GeoJSON Point | `2dsphere index` | Per-unit GPS for agent check-in precision |

**InventoryItemSchema (Embedded):**

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `item_id` | String | `required` | Auto-generated from `_id` or `ObjectId` |
| `name` | String | `required` | Item description |
| `category` | String | `enum: 5 categories`, `default: 'other'` | `furniture`, `electronics`, `fixture`, `appliance`, `other` |
| `condition` | String | `enum: 5 states`, `default: 'good'` | `new`, `good`, `fair`, `damaged`, `auctionable` |
| `auctionable` | Boolean | `default: false` | Flag for auction eligibility |
| `auctionable_marked_at` | Date | — | When flagged |
| `auctionable_reason` | String | — | Why flagged |
| `auction_status` | String | `enum: 4 states`, `default: 'pending'` | `pending`, `sold`, `reclaimed`, `disposed` |
| `auction_sold_at` | Date | — | Sale timestamp |
| `auction_buyer` | String | — | Buyer name |
| `auction_sale_amount` | Number | — | Sale price in KES |
| `reclaimed_at` | Date | — | When tenant reclaimed (paid arrears) |
| `reclaim_receipt_id` | ObjectId | `ref: 'Payment'` | Link to arrears payment |
| `unit_id` | ObjectId | — | Which unit the item belongs to |
| `estimated_value_kes` | Number | — | Insurance/appraisal value |
| `photos` | [String] | — | R2 URLs |
| `added_date` | Date | `default: Date.now` | — |
| `last_audit_date` | Date | — | Last physical audit |
| `audit_agent_id` | ObjectId | `ref: 'User'` | Agent who last audited |

**Schema Validation:**
- `pre('validate')`: Cleans empty `location` coordinates; auto-generates `item_id` for inventory items.
- `pre('save')`: Updates `updated_at` timestamp.

**Strengths:**
- Embedding `units` and `inventory` avoids joins for the most common read pattern ("show me this property with all its units").
- `unit_geolocation` enables per-unit GPS verification rather than property-level approximation.
- `lock_status` state machine is self-contained in the unit document.

**Weaknesses:**
- No validation that `current_tenant_id` in a unit actually matches a tenant with `current_unit_id` — referential integrity is maintained in application code, not the database.
- `inventory` array can grow unbounded; MongoDB documents have a 16 MB limit. Properties with 1000+ inventory items would need sharding or a separate collection.
- No `deleted_at` / `is_deleted` flag on Property — only `status: 'inactive'`.

---

#### 1.3.3 Tenant Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `tenant_code` | String | `unique`, `required` | Auto-generated: `TNT-MOM-<count>` |
| `user_id` | ObjectId | `ref: 'User'`, `sparse` | Links to Clerk-authenticated user |
| `full_name` | String | `required` | — |
| `id_number` | String | `required` | Kenyan national ID |
| `phone` | String | `required` | `254XXXXXXXXX` format |
| `email` | String | — | Optional |
| `emergency_contact` | Embedded | — | `name`, `phone`, `relationship` |
| `kyc_verified` | Boolean | `default: false` | — |
| `kyc_documents` | [Embedded] | — | `type` (`id_front`, `id_back`, `passport_photo`, `employment_letter`), `url`, `uploaded_at` |
| `current_unit_id` | ObjectId | — | Direct unit reference |
| `current_property_id` | ObjectId | `ref: 'Property'` | — |
| `lease_start` | Date | — | — |
| `lease_end` | Date | — | — |
| `rent_amount_kes` | Number | `min: 0` | Monthly rent |
| `deposit_paid_kes` | Number | `min: 0` | Security deposit |
| `deposit_held` | Boolean | `default: true` | Whether deposit is still held |
| `payment_history` | [Embedded] | — | `month` (YYYY-MM), `amount_kes`, `status` (`paid`, `partial`, `overdue`, `waived`), `payment_id` |
| `arrears_kes` | Number | `default: 0`, `min: 0` | Outstanding balance |
| `tenancy_status` | String | `enum: 6 states`, `default: 'active'` | `active`, `terminated`, `notice`, `pending`, `expired`, `departed` |
| `departed_at` | Date | — | When tenant left |
| `notice_status` | String | `enum: 4 states`, `default: 'none'` | `none`, `7_day`, `30_day`, `eviction_pending` |
| `preferred_channel` | String | `enum: 3 channels`, `default: 'both'` | `email`, `sms`, `both` |
| `notes` | String | — | Internal agent/admin notes |
| `guarantor` | Embedded | — | `full_name`, `phone`, `id_number`, `relationship` |
| `created_at` | Date | `default: Date.now` | — |
| `updated_at` | Date | `default: Date.now` | Auto-updated on save |

**Schema Validation:**
- `pre('save')`: Updates `updated_at` timestamp.

**Strengths:**
- `payment_history` embedded array provides fast month-by-month lookup without joining Payments.
- `arrears_kes` denormalized field enables instant balance display without aggregation.
- `kyc_documents` embedding keeps tenant profile self-contained.

**Weaknesses:**
- `payment_history` is not a strict journal — it can be modified (e.g., voiding a payment removes the entry). A true financial ledger would require immutable append-only records.
- No constraint that `payment_history[].payment_id` actually exists in the Payments collection.
- `id_number` is stored as plain String — no encryption at rest for PII (reliant on MongoDB Atlas encryption).

---

#### 1.3.4 Payment Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `transaction_id` | String | `unique`, `required` | `MUT-<timestamp>-<random>` or M-Pesa `CheckoutRequestID` |
| `mpesa_receipt` | String | — | M-Pesa receipt number |
| `tenant_id` | ObjectId | `ref: 'Tenant'` | Payer |
| `property_id` | ObjectId | `ref: 'Property'` | — |
| `unit_id` | ObjectId | — | — |
| `amount_kes` | Number | `required`, `min: 0` | — |
| `payment_type` | String | `enum: 6 types`, `required` | `rent`, `deposit`, `penalty`, `water`, `electricity`, `service_charge` |
| `channel` | String | `enum: 5 channels`, `required` | `mpesa_stk`, `mpesa_c2b`, `bank_transfer`, `cash`, `diaspora_wire` |
| `status` | String | `enum: 6 states`, `default: 'pending'` | `pending`, `processing`, `confirmed`, `failed`, `reversed`, `manual_override` |
| `workflow_state` | String | `enum: 5 states`, `default: 'PENDING_VIEWING'` | House-locking state machine |
| `mpesa_callback` | Embedded | — | `ResultCode`, `ResultDesc`, `CallbackMetadata`, `received_at` |
| `verified_by_agent_id` | ObjectId | `ref: 'User'` | Agent who verified (if manual) |
| `verification_method` | String | `enum: 4 methods` | `auto_mpesa`, `agent_geo`, `manual_override`, `bank_recon` |
| `verification_location` | GeoJSON Point | `2dsphere index` | Where agent verified |
| `verification_photo` | String | — | R2 URL |
| `discrepancy_flag` | Boolean | `default: false` | True if amount mismatch or manual override |
| `discrepancy_reason` | String | — | Human-readable reason |
| `created_at` | Date | `default: Date.now` | — |
| `updated_at` | Date | `default: Date.now` | — |

**Schema Validation:**
- `pre('save')`: Updates `updated_at` timestamp.

**Strengths:**
- Dual status fields (`status` + `workflow_state`) separate financial state from operational state.
- `mpesa_callback` stores the raw callback payload for audit and debugging.
- `discrepancy_flag` + `discrepancy_reason` provide a clear audit trail for anomalies.

**Weaknesses:**
- No immutable ledger pattern — payments can be voided, which mutates the record. For KRA compliance, an append-only `PaymentEvent` collection would be stronger.
- `verification_location` is sparse-indexed but not validated against property location at schema level.
- `amount_kes` uses `min: 0` but no `max` — could be abused with extremely large values (mitigated by application-level `> 100,000` super_admin check).

---

#### 1.3.5 Notice Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `notice_type` | String | `enum: 6 types`, `required` | `rent_increase`, `maintenance`, `eviction`, `lease_renewal`, `entry_inspection`, `general` |
| `property_id` | ObjectId | `ref: 'Property'`, `required`, `index: true` | — |
| `unit_id` | ObjectId | `required` | — |
| `tenant_id` | ObjectId | `ref: 'Tenant'`, `required`, `index: true` | — |
| `issued_by` | ObjectId | `ref: 'User'`, `required` | Agent or admin who issued |
| `title` | String | `required`, `maxlength: 200` | — |
| `body` | String | `required`, `maxlength: 5000` | — |
| `delivery_method` | [String] | `enum: 4 methods` | `sms`, `email`, `portal`, `whatsapp` |
| `delivery_status` | [Embedded] | — | `method`, `status` (`pending`, `sent`, `delivered`, `read`, `failed`), `timestamp`, `provider_message_id` |
| `pdf_url` | String | — | Generated PDF stored on R2 |
| `requires_acknowledgment` | Boolean | `default: true` | — |
| `tenant_acknowledged` | Boolean | `default: false` | — |
| `acknowledged_at` | Date | — | — |
| `effective_date` | Date | `required` | When notice takes effect |
| `expiry_date` | Date | — | When notice expires |
| `legal_basis` | String | `maxlength: 500` | Kenyan legal reference (default: Rent Restriction Act) |
| `created_at` | Date | `default: Date.now`, `index: true` | — |
| `updated_at` | Date | `default: Date.now` | — |

**Schema Validation:**
- `pre('save')`: Updates `updated_at` timestamp.

**Strengths:**
- `delivery_status` array tracks per-channel delivery state for legal evidence.
- `pdf_url` provides a tamper-evident document for court proceedings.
- `tenant_acknowledged` + `acknowledged_at` create a legal receipt.

**Weaknesses:**
- No unique constraint preventing duplicate notices for the same tenant/unit on the same day.
- `legal_basis` has a default value that is hardcoded in the schema — should be configurable via `SystemSetting`.
- `delivery_status` does not track retry attempts or failure reasons.

---

#### 1.3.6 MaintenanceTicket Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `ticket_code` | String | `unique`, `required` | `MT-<timestamp36>-<count>` |
| `property_id` | ObjectId | `ref: 'Property'` | — |
| `unit_id` | ObjectId | — | — |
| `tenant_id` | ObjectId | `ref: 'Tenant'` | Reporter |
| `created_by` | ObjectId | `ref: 'User'` | — |
| `category` | String | `enum: 8 categories`, `required` | `plumbing`, `electrical`, `structural`, `security`, `appliance`, `pest_control`, `cleaning`, `other` |
| `priority` | String | `enum: 4 levels`, `default: 'medium'` | `low`, `medium`, `high`, `emergency` |
| `description` | String | `required`, `maxlength: 2000` | — |
| `photos` | [String] | — | Max 5 (enforced in route) |
| `status` | String | `enum: 7 states`, `default: 'open'` | `open`, `assigned`, `in_progress`, `pending_parts`, `resolved`, `closed`, `tenant_disputed` |
| `assigned_agent_id` | ObjectId | `ref: 'User'` | — |
| `agent_notes` | String | — | Internal notes |
| `tenant_satisfaction` | Number | `min: 1`, `max: 5` | Post-resolution rating |
| `created_at` | Date | `default: Date.now` | — |
| `updated_at` | Date | `default: Date.now` | — |
| `resolved_at` | Date | — | — |

**Schema Validation:**
- `pre('save')`: Updates `updated_at` timestamp.
- Uses `mongoose.models` check to prevent recompilation in hot-reload.

**Strengths:**
- Rich status workflow supports full maintenance lifecycle.
- `tenant_satisfaction` enables quality metrics for agent performance.

**Weaknesses:**
- No `cost_estimate_kes` or `actual_cost_kes` fields for maintenance budgeting.
- No `parts` or `vendor` subdocument for tracking repairs.
- `photos` array has no max length at schema level (enforced in route with `.slice(0, 5)`).

---

#### 1.3.7 LateFeeRule Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `name` | String | `required` | E.g., "Standard Residential Late Fee" |
| `grace_days` | Number | `default: 5` | Days after due date before penalty applies |
| `penalty_type` | String | `enum: 2 types`, `default: 'percentage'` | `percentage` or `fixed` |
| `penalty_value` | Number | `required` | Percentage (e.g., 0.05 = 5%) or fixed KES amount |
| `max_penalty_per_month` | Number | — | Cap on monthly penalty |
| `applies_to` | String | `enum: 3 scopes`, `default: 'all'` | `all`, `residential`, `commercial` |
| `is_active` | Boolean | `default: true` | — |
| `created_by` | ObjectId | `ref: 'User'` | — |
| `created_at` | Date | `default: Date.now` | — |
| `updated_at` | Date | `default: Date.now` | — |

**Schema Validation:**
- `pre('save')`: Updates `updated_at` timestamp.

**Strengths:**
- Flexible rule system supports multiple property types and penalty structures.
- `max_penalty_per_month` prevents excessive accumulation.

**Weaknesses:**
- No `effective_from` / `effective_to` dates — rules apply immediately to all active tenants.
- No `applies_to_property_ids` for property-specific rules.
- `penalty_value` lacks precision constraints (could be 0.0001 or 999999999).

---

#### 1.3.8 PropertyTier Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `name` | String | `required`, `unique` | `Bronze`, `Silver`, `Gold`, `Platinum` |
| `min_rent_kes` | Number | `required` | Lower bound |
| `max_rent_kes` | Number | `required` | Upper bound |
| `description` | String | — | Human-readable description |
| `criteria` | String | — | Amenities/features required (e.g., "Swimming pool, gym, parking") |
| `is_active` | Boolean | `default: true` | — |
| `created_by` | ObjectId | `ref: 'User'` | — |
| `created_at` | Date | `default: Date.now` | — |

**Strengths:**
- Simple lookup table with clear rent boundaries.
- `criteria` field enables semi-automated tier assignment by agents.

**Weaknesses:**
- No validation that `min_rent_kes < max_rent_kes`.
- No `icon` or `color` field for UI rendering (hardcoded in frontend).
- No `display_order` field — tiers sorted by `created_at` rather than logical order.

---

#### 1.3.9 SystemSetting Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `key` | String | `required`, `unique` | E.g., `customer_care`, `default_grace_days` |
| `value` | String | `required` | Stored as string (cast to number/boolean in application code) |
| `description` | String | — | Human-readable explanation |
| `updated_at` | Date | `default: Date.now` | — |

**Schema Validation:**
- `pre('save')`: Updates `updated_at` timestamp.

**Strengths:**
- Simple key-value store for runtime configuration without redeployment.

**Weaknesses:**
- No `data_type` field — all values are strings, requiring casting everywhere.
- No `created_by` or `change_log` for audit.
- No caching layer — every read hits MongoDB.

---

#### 1.3.10 Notification Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `type` | String | `enum: 6 types`, `required` | `property_approval`, `maintenance_urgent`, `payment_alert`, `agent_approval`, `landlord_approval`, `general` |
| `recipient_role` | String | `enum: 4 roles`, `required` | `admin`, `agent`, `landlord`, `tenant` |
| `recipient_ids` | [ObjectId] | `ref: 'User'` | Empty array = broadcast to all users of `recipient_role` |
| `title` | String | `required` | — |
| `message` | String | `required` | — |
| `related_entity_id` | ObjectId | — | Link to property, payment, or user |
| `property_name` | String | — | Denormalized for display |
| `property_area` | String | — | Denormalized for display |
| `property_tier_name` | String | — | Denormalized for display |
| `property_rent` | Number | — | Denormalized for display |
| `read_by` | [ObjectId] | `ref: 'User'` | Users who have read |
| `dismissed_by` | [ObjectId] | `ref: 'User'` | Users who have dismissed |
| `created_at` | Date | `default: Date.now` | — |

**Strengths:**
- Denormalized property fields enable fast notification rendering without joins.
- `read_by` + `dismissed_by` arrays support multi-user notification state.

**Weaknesses:**
- No `read_by` or `dismissed_by` indexes — query performance degrades as arrays grow.
- No TTL or archiving strategy — notifications accumulate indefinitely.
- `recipient_ids` array can grow large for broadcasts; should use a separate `NotificationDelivery` collection for scale.

---

#### 1.3.11 Task Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `assigned_to` | ObjectId | `ref: 'User'`, `required` | Agent |
| `assigned_by` | ObjectId | `ref: 'User'`, `required` | Admin or supervisor |
| `title` | String | `required` | — |
| `description` | String | `required` | — |
| `type` | String | `enum: 4 types`, `required` | `check_in`, `payment_followup`, `inspection`, `maintenance` |
| `related_property_id` | ObjectId | `ref: 'Property'` | — |
| `related_unit_id` | ObjectId | — | — |
| `related_tenant_id` | ObjectId | `ref: 'Tenant'` | — |
| `due_date` | Date | `required` | — |
| `status` | String | `enum: 4 states`, `default: 'pending'` | `pending`, `in_progress`, `completed`, `overdue` |
| `completed_at` | Date | — | — |
| `created_at` | Date | `default: Date.now` | — |

**Strengths:**
- Simple, focused schema for agent task management.
- `type` enum enables task-category filtering and reporting.

**Weaknesses:**
- No `priority` field (only `type` implies priority indirectly).
- No `recurring` flag or `repeat_interval` for weekly/monthly inspections.
- No `comments` or `activity_log` subdocument for task collaboration.

---

## 2. Index Audit

### 2.1 Existing Indexes (Verified from Code)

#### User
| Index | Type | Options | Purpose |
|-------|------|---------|---------|
| `role` | Ascending | — | Filter users by role |
| `last_location.coordinates` | 2dsphere | `sparse: true` | Geospatial agent tracking |
| `landlord_id` | Ascending | `sparse: true`, `unique: true` | Landlord ID lookup |

#### Property
| Index | Type | Options | Purpose |
|-------|------|---------|---------|
| `location` | 2dsphere | — | Nearby property search |
| `units.unit_geolocation` | 2dsphere | — | Per-unit geospatial queries |
| `property_code` | Ascending | — | Unique code lookup |
| `landlord_id` | Ascending | — | Landlord property scoping |
| `units.current_tenant_id` | Ascending | — | Tenant-to-unit reverse lookup |

#### Tenant
| Index | Type | Options | Purpose |
|-------|------|---------|---------|
| `phone` | Ascending | — | Phone lookup (onboarding) |
| `email` | Ascending | `sparse: true` | Email lookup |
| `id_number` | Ascending | — | KYC/identity verification |
| `user_id` | Ascending | `sparse: true` | User-to-tenant linkage |
| `current_unit_id` | Ascending | — | Unit occupancy check |
| `current_property_id` | Ascending | — | Property tenant list |
| `tenancy_status` | Ascending | — | Filter active/departed tenants |

#### Payment
| Index | Type | Options | Purpose |
|-------|------|---------|---------|
| `tenant_id` + `status` | Compound | — | Tenant payment history filter |
| `mpesa_receipt` | Ascending | — | Receipt lookup |
| `status` | Ascending | — | Payment status dashboard |
| `created_at` | Descending | — | Recent payments sort |
| `verification_location.coordinates` | 2dsphere | `sparse: true` | Agent verification map |

#### Notice
| Index | Type | Options | Purpose |
|-------|------|---------|---------|
| `property_id` | Ascending | — | Property notice list |
| `tenant_id` | Ascending | — | Tenant notice list |
| `tenant_id` + `created_at` | Compound | — | Tenant notice history (sorted) |
| `notice_type` | Ascending | — | Notice type filter |
| `delivery_status.status` | Ascending | — | Delivery status filter |
| `created_at` | Ascending | — | Recent notices |

#### MaintenanceTicket
| Index | Type | Options | Purpose |
|-------|------|---------|---------|
| `property_id` + `status` | Compound | — | Property maintenance queue |
| `tenant_id` | Ascending | — | Tenant ticket history |
| `status` | Ascending | — | Status filter |
| `created_by` | Ascending | — | Creator filter |

#### LateFeeRule
| Index | Type | Options | Purpose |
|-------|------|---------|---------|
| *(none)* | — | — | Small collection; no indexes needed yet |

#### PropertyTier
| Index | Type | Options | Purpose |
|-------|------|---------|---------|
| `name` | Ascending | `unique: true` | Tier name lookup |

#### SystemSetting
| Index | Type | Options | Purpose |
|-------|------|---------|---------|
| `key` | Ascending | `unique: true` | Config key lookup |

#### Notification
| Index | Type | Options | Purpose |
|-------|------|---------|---------|
| *(none)* | — | — | Missing — see recommendations |

#### Task
| Index | Type | Options | Purpose |
|-------|------|---------|---------|
| *(none)* | — | — | Missing — see recommendations |

### 2.2 Recommended Missing Indexes

| Collection | Index | Priority | Justification |
|------------|-------|----------|---------------|
| **User** | `clerk_id` | **P0** | Currently used in `findOne({ clerk_id })` on every request — no index, causing collection scans. |
| **User** | `is_active` + `role` | **P1** | Admin dashboards filter by `role` + `is_active` frequently. |
| **User** | `agent_approval_status` | **P1** | `/admin/agents/pending` queries this field. |
| **User** | `landlord_approval_status` | **P1** | `/admin/landlords/pending` queries this field. |
| **Property** | `status` | **P1** | Dashboard filters by `status: 'active'`. |
| **Property** | `review_status` | **P1** | Agent/admin filters by `review_status`. |
| **Property** | `agent_ids` | **P1** | Agent property scoping uses `$in` on `agent_ids`. |
| **Tenant** | `tenant_code` | **P0** | Used in onboarding lookups — currently no index. |
| **Tenant** | `arrears_kes` | **P2** | Overdue report could sort by highest arrears. |
| **Payment** | `property_id` + `status` + `created_at` | **P1** | Admin payment list filters by property and sorts by date. |
| **Payment** | `verified_by_agent_id` + `created_at` | **P1** | Agent performance leaderboard queries this. |
| **Payment** | `channel` | **P2** | Analytics on payment method mix. |
| **Notice** | `effective_date` | **P2** | Filter notices by effective date range. |
| **Notice** | `tenant_acknowledged` | **P2** | Find unacknowledged notices. |
| **MaintenanceTicket** | `priority` + `created_at` | **P1** | Emergency tickets should sort first. |
| **MaintenanceTicket** | `assigned_agent_id` + `status` | **P1** | Agent's open ticket queue. |
| **MaintenanceTicket** | `resolved_at` | **P2** | Resolution time analytics. |
| **Notification** | `recipient_role` + `created_at` | **P0** | Primary query pattern — currently unindexed. |
| **Notification** | `recipient_role` + `recipient_ids` | **P0** | Broadcast queries — currently unindexed. |
| **Notification** | `read_by` (multikey) | **P1** | Unread count calculation. |
| **Notification** | `dismissed_by` (multikey) | **P1** | Dismissal filtering. |
| **Notification** | `created_at` (TTL) | **P1** | Support TTL index for auto-archiving after 90 days. |
| **Task** | `assigned_to` + `due_date` | **P0** | Agent task list primary sort — currently unindexed. |
| **Task** | `status` | **P1** | Admin task filter by status. |
| **Task** | `related_property_id` | **P1** | Property task lookup. |
| **Task** | `due_date` | **P1** | Overdue task detection. |
| **LateFeeRule** | `is_active` | **P2** | Cron job filters active rules. |
| **PropertyTier** | `min_rent_kes` + `max_rent_kes` | **P2** | Range query for automatic tier suggestion. |

---

## 3. Security Audit

### 3.1 OWASP Findings Summary

| ID | Finding | Severity | Mitigation Status |
|----|---------|----------|-------------------|
| SEC-01 | `clerk_id` field on `User` is unindexed | Medium | **PENDING** — Add index |
| SEC-02 | `User.phone` lacks schema-level regex validation | Low | **ACCEPTED** — Validated in route layer |
| SEC-03 | `User.current_property_id` / `current_unit_id` can drift from `Tenant` values | Medium | **ACCEPTED** — Application code maintains sync |
| SEC-04 | `Payment` records mutable (voidable) rather than append-only | Medium | **ACCEPTED** — Discrepancy flag + reason provides audit trail |
| SEC-05 | `Notice` allows duplicate issuance without deduplication | Low | **ACCEPTED** — Admin/agent discretion |
| SEC-06 | `Notification` has no TTL — data accumulates indefinitely | Low | **PENDING** — Add TTL index + archiving job |
| SEC-07 | `MaintenanceTicket.photos` has no max length at schema level | Low | **ACCEPTED** — Enforced in route (`slice(0, 5)`) |
| SEC-08 | `SystemSetting.value` is plain string — no type safety | Low | **ACCEPTED** — Application-level casting |
| SEC-09 | `Property.inventory` embedded array unbounded — 16 MB doc limit risk | Medium | **PENDING** — Monitor + migrate to separate collection if needed |
| SEC-10 | `Tenant.kyc_documents` stores URLs but no checksum/hash for tamper detection | Low | **PENDING** — Add `document_hash` field |
| SEC-11 | `User` model has `password_hash` legacy field — should be removed | Low | **PENDING** — Deprecate and nullify in migration |
| SEC-12 | `Payment.amount_kes` has no upper-bound validation | Medium | **ACCEPTED** — `> 100,000` requires super_admin in route |
| SEC-13 | No explicit `AuditLog` collection for compliance | Medium | **PENDING** — Create `AuditLog` collection |
| SEC-14 | `AdminPasswordGuard` stores verification in `sessionStorage` — XSS if compromised | Low | **ACCEPTED** — Short-lived (session only), no sensitive data stored |
| SEC-15 | `ChatAssistant` session IDs stored in `localStorage` — accessible to XSS | Low | **ACCEPTED** — Session IDs contain user ID but no secrets; validated server-side |
| SEC-16 | `agent_allow_all_areas` is a Boolean flag with no audit trail of who enabled it | Low | **PENDING** — Add `agent_allow_all_areas_set_by` and `agent_allow_all_areas_set_at` |

### 3.2 Authentication Flow Security

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│    Clerk    │────▶│   Backend   │────▶│   MongoDB   │
│             │     │   OAuth     │     │  /sync-clerk│     │   User      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     │                     │                     │                     │
     ▼                     ▼                     ▼                     ▼
  SPA loads            Clerk JWT             Upsert User            Store
  Clerk SDK            issued               by clerk_id             clerk_id
```

**Security Controls:**
1. **Clerk JWT Validation**: Every API route (except health/webhooks) passes through `ClerkExpressRequireAuth()`.
2. **User Activation Check**: `requireAuth` middleware rejects requests from users with `is_active: false`.
3. **Session Revocation**: On disable/soft-delete, all active Clerk sessions are revoked via `clerkClient.sessions.revokeSession()`.
4. **Role Sync**: Backend enforces `publicMetadata.role` consistency with DB on every `/users/me` call.
5. **Webhook Verification**: Clerk webhooks require `X-Webhook-Secret` header match.

### 3.3 Data Validation Layer

| Layer | Implementation | Coverage |
|-------|----------------|----------|
| **Schema** | Mongoose `type`, `enum`, `min`, `max`, `required` | Basic type/structure |
| **Route** | `express-validator` (`body()`, `param()`, `query()`) | All user-facing endpoints |
| **Sanitization** | `express-mongo-sanitize` + custom `mongoSanitize` middleware | Global — prevents NoSQL injection |
| **RBAC** | `requirePermission()` + `requireRole()` + `enforcePropertyScope()` | Every data-mutating route |
| **IP Filtering** | `requireSafaricomIP` middleware | M-Pesa callbacks only |
| **Rate Limiting** | `express-rate-limit` | General (300/15m), admin password (5/15m), upload (20/24h) |

---

## 4. Performance Audit

### 4.1 Query Performance Analysis

| Query Pattern | Collection | Current Index | Performance | Recommendation |
|---------------|------------|---------------|-------------|----------------|
| `findOne({ clerk_id })` | User | **None** | Collection scan | Add `clerk_id` index (P0) |
| `find({ role, is_active })` | User | Partial (role only) | Index scan + filter | Compound `role + is_active` (P1) |
| `find({ 'units.status': 'vacant' })` | Property | `units.current_tenant_id` | Collection scan | Add `units.status` index (P2) |
| `find({ tenant_id, status })` | Payment | Compound | Index scan | **Good** — keep |
| `find({ status: 'confirmed', created_at: { $gte, $lte } })` | Payment | `status`, `created_at` separately | Index intersection (suboptimal) | Compound `status + created_at` (P1) |
| `aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: { $dateToString... } } }])` | Payment | `status` | Index scan + in-memory sort | Add compound `status + created_at` (P1) |
| `find({ recipient_role, dismissed_by: { $ne } })` | Notification | **None** | Collection scan | Add `recipient_role + created_at` (P0) |
| `find({ assigned_to, due_date: { $gte } })` | Task | **None** | Collection scan | Add `assigned_to + due_date` (P0) |
| `find({ property_id, status })` | MaintenanceTicket | Compound | Index scan | **Good** — keep |

### 4.2 Caching Strategy

| Layer | Current | Target | Implementation |
|-------|---------|--------|----------------|
| **Client (React Query)** | 30 s stale time, 1 retry | 5 min stale for reference data | Increase `staleTime` for `PropertyTier`, `SystemSetting` |
| **Server (API)** | None | Redis cache for property listings | Deploy Redis (Redis Cloud or Upstash) on Render |
| **Database** | MongoDB query cache | Compound index coverage | Implement missing indexes from Section 2.2 |
| **CDN** | Vercel edge cache | R2 public URLs cached | Already implemented via Cloudflare |

### 4.3 Bundle Optimization

| Library | Current | Size Impact | Action |
|---------|---------|-------------|--------|
| `three` | 0.184.0 | ~600 KB | **Lazy load** — only used in 3D map widget (rarely accessed) |
| `@react-three/fiber` | 8.18.0 | ~150 KB | **Lazy load** with `React.lazy()` |
| `@react-three/drei` | 9.122.0 | ~400 KB | **Lazy load** |
| `recharts` | 2.12.7 | ~300 KB | **Lazy load** on dashboard pages only |
| `leaflet` | 1.9.4 | ~200 KB | Already lazy-loaded in `MapWidget` |
| `framer-motion` | 12.40.0 | ~150 KB | Keep in main bundle — used everywhere |
| `lucide-react` | 0.383.0 | ~50 KB (tree-shaken) | Keep — icons are essential |

**Recommended Actions:**
1. Split `recharts` into a separate chunk loaded only on `/dashboard`, `/admin`, `/agent-performance`.
2. Split Three.js into a `3d-viewer` chunk loaded on demand.
3. Use `vite-plugin-visualizer` to audit bundle composition.

### 4.4 API Response Optimization

| Endpoint | Current | Optimization |
|----------|---------|--------------|
| `GET /properties` | Returns full documents (with embedded units + inventory) | Add `?fields=` query param to select only needed fields; paginate units separately |
| `GET /payments` | Returns populated `tenant_id` and `property_id` | Add `?minimal=true` to return IDs only; frontend can cache and resolve |
| `GET /admin/stats` | 6 aggregation pipelines | Cache result in Redis with 5-minute TTL |
| `GET /agents/all-locations` | Full User documents | Project only `full_name`, `last_location` |

---

## 5. Code Quality Audit

### 5.1 Dead Code

| Location | Finding | Action |
|----------|---------|--------|
| `frontend/src/components/PropertyList.jsx` | Referenced in `App.jsx` but may be unused in favor of `PropertiesPage` | **Verify** and remove if redundant |
| `backend/models/index.js` | Exports all models but is not imported anywhere | **Verify** and remove if unused |
| `backend/utils/stateMachine.js` | Referenced in `payments.js` but may be underutilized | **Audit** usage; document or remove |
| `backend/utils/logger.js` | Custom logger — verify if winston/pino would be better | **Keep** but evaluate structured logging alternatives |
| `frontend/src/pages/LoginPage.jsx` | Clerk handles login; verify if custom page is needed | **Keep** for custom branding but document Clerk dependency |
| `backend/services/pdf.js` | Referenced in `notices.js` — verify if fully implemented | **Verify** and add test coverage |
| `backend/services/email.js` | Referenced but minimal — verify Resend integration | **Verify** and add error handling |

### 5.2 Duplicate Logic

| Pattern | Locations | Recommendation |
|---------|-----------|----------------|
| **Haversine distance calculation** | `backend/routes/agents.js` and `backend/routes/properties.js` (unit lock) | Extract to `utils/geo.js` as `getDistanceMetres(lat1, lng1, lat2, lng2)` |
| **Agent scope query building** | `backend/routes/properties.js` (3 occurrences) and `backend/routes/payments.js` | Extract to `middleware/rbac.js` as `buildAgentScopeFilter(req.user)` |
| **Payment confirmation side effects** | `payments.js` (callback, override, void) | Extract to `services/paymentService.js` as `confirmPayment(payment)` and `voidPayment(payment, reason)` |
| **Tenant balance update** | `payments.js` (callback + override) | Extract to `services/tenantService.js` as `applyPaymentToTenant(tenantId, amount)` |
| **Notification creation** | Multiple routes (property approval, agent approval, etc.) | Extract to `services/notificationService.js` as `createNotification({ type, recipients, title, message })` |
| **Validation helper** | Every route file has `const validate = (req, res) => {...}` | Extract to `middleware/validate.js` |
| **Admin password hash generation** | `User.js` pre-save, `users.js` sync-clerk, `users.js` me | Extract to `utils/admin.js` as `ensureAdminHash(user)` |
| **Clerk role sync** | `users.js` (`/me`, `/sync-clerk`, webhook) | Extract to `services/clerkService.js` as `syncUserRole(clerkId, dbRole)` |

### 5.3 Test Coverage

| Layer | Current | Target | Gap |
|-------|---------|--------|-----|
| **Backend unit tests** | Jest configured, some coverage exists | 80 % line coverage | Need tests for `payments.js`, `properties.js`, `agents.js`, `notices.js` |
| **Backend integration tests** | Supertest available | 60 % route coverage | Need end-to-end tests for M-Pesa callback flow, GPS check-in, notice PDF generation |
| **Frontend unit tests** | Vitest configured, minimal tests | 50 % component coverage | Need tests for `Button`, `Card`, `Modal`, `DataTable`, `ChatAssistant` |
| **E2E tests** | None | 20 % critical path coverage | Add Playwright or Cypress for: login → onboarding → pay rent → submit maintenance |
| **Cron job tests** | None | Manual verification | Add unit tests for `late-fee-applicator.js` and `tenant-lease-cleanup.js` with mock dates |

---

## 6. Implementation Roadmap

### 6.1 Sprint 1: Security & Core Fixes (Weeks 1–2)

**Theme:** Harden the platform, fix critical schema gaps, and improve auth reliability.

| Task | Effort | Owner | Acceptance Criteria |
|------|--------|-------|-------------------|
| Add `clerk_id` index to `User` | 1 h | Backend | Index exists; `explain("executionStats")` shows `IXSCAN` |
| Add `tenant_code` index to `Tenant` | 1 h | Backend | Index exists; onboarding query uses index |
| Add `Notification` indexes (`recipient_role + created_at`, `read_by` multikey) | 2 h | Backend | Notification list query uses index; unread count < 100 ms |
| Add `Task` indexes (`assigned_to + due_date`, `status`) | 1 h | Backend | Agent task list query uses index |
| Extract `getDistanceMetres` to `utils/geo.js` | 2 h | Backend | Both `agents.js` and `properties.js` import from `utils/geo.js` |
| Extract `validate` helper to `middleware/validate.js` | 2 h | Backend | All routes import `validate` from middleware; no duplication |
| Extract `buildAgentScopeFilter` to `middleware/rbac.js` | 4 h | Backend | Agent scope logic in one place; all routes use it |
| Create `AuditLog` collection and model | 4 h | Backend | `AuditLog` schema: `action`, `actor_id`, `target_type`, `target_id`, `before`, `after`, `timestamp`. Log all payment overrides, user deletions, and notice issuances. |
| Add `agent_allow_all_areas_set_by` / `agent_allow_all_areas_set_at` to `User` | 1 h | Backend | Fields populated on change; visible in admin user edit |
| Fix `User.current_property_id` / `current_unit_id` drift | 3 h | Backend | Add `pre('save')` hook on `Tenant` to sync back to `User`; add consistency check cron |
| Add `document_hash` to `Tenant.kyc_documents` | 2 h | Backend | SHA-256 hash computed on upload; stored in schema; verified on download |
| Backend test coverage for auth & user routes | 8 h | Backend | 80 % line coverage for `users.js` and `auth.js` |

**Sprint 1 Total:** ~31 hours

### 6.2 Sprint 2: Performance & UI Polish (Weeks 3–4)

**Theme:** Optimize queries, reduce bundle size, and improve perceived performance.

| Task | Effort | Owner | Acceptance Criteria |
|------|--------|-------|-------------------|
| Add remaining missing indexes (Section 2.2) | 4 h | Backend | All P0/P1 indexes created; `explain` confirms index usage |
| Implement Redis caching for `/admin/stats` | 6 h | Backend | 5-minute TTL; cache hit < 10 ms; cache miss triggers query + store |
| Implement Redis caching for property listings | 6 h | Backend | 2-minute TTL; pagination cached per page/filter combo |
| Lazy-load `recharts` on dashboard pages | 3 h | Frontend | Recharts only in `dashboard-chunk.js`; main bundle reduced by ~250 KB |
| Lazy-load Three.js for 3D map widget | 3 h | Frontend | Three.js in `3d-viewer-chunk.js`; loaded on demand |
| Add `?fields=` query param to `/properties` | 4 h | Backend | Client can request `?fields=name,address,units.unit_number,units.status` |
| Add `?minimal=true` to `/payments` | 2 h | Backend | Returns IDs only; frontend resolves from cache |
| Optimize `DataTable` with virtual scrolling | 6 h | Frontend | Smooth scroll for 1000+ rows; only visible rows rendered |
| Add skeleton loaders to all async pages | 4 h | Frontend | Every page that fetches data shows `SkeletonLoader` during loading |
| Add `vite-plugin-visualizer` to build pipeline | 1 h | Frontend | Bundle report generated on every build; committed to CI artifacts |
| Frontend test coverage for `Button`, `Card`, `Modal` | 6 h | Frontend | 70 % component coverage for core UI library |

**Sprint 2 Total:** ~45 hours

### 6.3 Sprint 3: Feature Enhancement & PWA (Weeks 5–6)

**Theme:** Add missing features, improve offline experience, and enhance mobile usability.

| Task | Effort | Owner | Acceptance Criteria |
|------|--------|-------|-------------------|
| Create `PaymentEvent` append-only collection | 6 h | Backend | Every payment state change creates a `PaymentEvent` record; `Payment` remains mutable for operational use |
| Add `MaintenanceTicket` cost tracking (`cost_estimate_kes`, `actual_cost_kes`, `vendor`) | 4 h | Backend | Fields added to schema; editable by admin/agent; visible in reports |
| Add `Task` comments/activity log | 4 h | Backend | `TaskComment` subdocument or collection; supports agent/admin discussion |
| Add `Task` recurring flag (`is_recurring`, `repeat_interval`) | 3 h | Backend | Weekly/monthly recurring tasks auto-generated by cron |
| Add `PropertyTier.display_order` and `icon` | 2 h | Backend | Frontend renders tiers in correct order with icons |
| Add `SystemSetting.data_type` | 2 h | Backend | Enum: `string`, `number`, `boolean`, `json`; route casts automatically |
| Implement PWA manifest and service worker | 8 h | Frontend | `manifest.json`, `service-worker.js` with offline fallback; installable on Android/iOS |
| Add offline queue for maintenance ticket submission | 6 h | Frontend | If offline, form data saved to IndexedDB; auto-syncs when connection restored |
| Add push notifications (web push) for payment confirmations | 6 h | Frontend + Backend | VAPID keys generated; tenant receives push on payment confirmation |
| Implement `Notification` TTL auto-archiving | 4 h | Backend | 90-day TTL index; archived notifications moved to `NotificationArchive` monthly |
| Add `LateFeeRule.effective_from` / `effective_to` | 3 h | Backend | Rules can be scheduled; cron job respects date range |
| E2E tests for critical path (login → pay rent → maintenance) | 10 h | QA | Playwright test suite runs in CI; 3 critical paths covered |

**Sprint 3 Total:** ~58 hours

### 6.4 Sprint 4: Testing & Documentation (Weeks 7–8)

**Theme:** Achieve coverage targets, document APIs, and establish release processes.

| Task | Effort | Owner | Acceptance Criteria |
|------|--------|-------|-------------------|
| Backend unit test coverage: 80 % | 16 h | Backend | Jest coverage report shows ≥ 80 % lines for all route files |
| Backend integration tests for M-Pesa callback | 8 h | Backend | Mock Safaricom IP + callback payload; verify payment state transitions |
| Backend integration tests for GPS check-in | 6 h | Backend | Mock geolocation; verify distance calculation and lock authorization |
| Frontend unit test coverage: 50 % | 12 h | Frontend | Vitest coverage report shows ≥ 50 % for all `src/components/` and `src/pages/` |
| Frontend integration tests for onboarding flow | 6 h | Frontend | Mock Clerk auth; verify role selection, tenant code linking, and redirect |
| API documentation (OpenAPI 3.0) | 12 h | Backend | `swagger.yaml` or `@swagger` JSDoc comments; served at `/api-docs` |
| Developer onboarding guide | 4 h | Docs | `CONTRIBUTING.md` with setup instructions, env variables, and testing commands |
| Runbook: Incident response | 4 h | Ops | `RUNBOOK.md` with Sentry alert handling, database rollback, and Clerk outage procedures |
| Load testing with k6 | 6 h | Ops | 100 concurrent users, p95 < 500 ms for dashboard; report committed |
| Security review: penetration test | 8 h | Security | OWASP ZAP scan; fix all Medium+ findings |
| Performance review: query profiling | 4 h | Backend | MongoDB Atlas Profiler reviewed; all slow queries (> 100 ms) optimized |
| Final release: v1.1.0 tag + changelog | 2 h | Release | Git tag `v1.1.0`; `CHANGELOG.md` with all sprint summaries |

**Sprint 4 Total:** ~88 hours

---

## 7. Priority Matrix

### 7.1 P0 — Critical (Do Not Launch Without)

| ID | Task | Effort | Sprint | Business Impact | Technical Risk |
|----|------|--------|--------|-----------------|----------------|
| P0-01 | Add `clerk_id` index to `User` | 1 h | 1 | Prevents auth slowdown at scale | High if missed |
| P0-02 | Add `tenant_code` index to `Tenant` | 1 h | 1 | Onboarding is first user experience | High if missed |
| P0-03 | Add `Notification` indexes | 2 h | 1 | Inbox is core UX for all roles | Medium |
| P0-04 | Add `Task` indexes | 1 h | 1 | Agent workflow depends on task list | Medium |
| P0-05 | Extract duplicate logic (geo, validate, agent scope) | 8 h | 1 | Reduces bug surface area | Medium |
| P0-06 | Create `AuditLog` collection | 4 h | 1 | KRA compliance and legal evidence | High for compliance |
| P0-07 | Fix `User.current_property_id` drift | 3 h | 1 | Prevents tenant data inconsistency | High |
| P0-08 | Extract payment confirmation side effects | 6 h | 1 | Prevents duplicate balance updates | High |
| P0-09 | Add backend auth tests (80 %) | 8 h | 1 | Prevents regression in auth flow | High |
| P0-10 | Add `PaymentEvent` append-only collection | 6 h | 3 | Financial audit compliance | High for compliance |

### 7.2 P1 — High (Strongly Recommended for Q1)

| ID | Task | Effort | Sprint | Business Impact | Technical Risk |
|----|------|--------|--------|-----------------|----------------|
| P1-01 | Add remaining missing indexes | 4 h | 2 | Improves query performance across platform | Medium |
| P1-02 | Redis caching for admin stats | 6 h | 2 | Reduces dashboard load time by 80 % | Low |
| P1-03 | Redis caching for property listings | 6 h | 2 | Improves property search responsiveness | Low |
| P1-04 | Bundle splitting (Recharts, Three.js) | 6 h | 2 | Improves mobile TTI by 1–2 s | Low |
| P1-05 | Add `?fields=` and `?minimal=` to APIs | 6 h | 2 | Reduces payload size by 50–70 % | Low |
| P1-06 | DataTable virtual scrolling | 6 h | 2 | Enables 1000+ row tables without lag | Low |
| P1-07 | Skeleton loaders on all pages | 4 h | 2 | Improves perceived performance | Low |
| P1-08 | Add `MaintenanceTicket` cost tracking | 4 h | 3 | Enables maintenance budgeting | Low |
| P1-09 | Add `Task` recurring support | 3 h | 3 | Automates inspection scheduling | Low |
| P1-10 | Notification TTL + archiving | 4 h | 3 | Prevents unbounded data growth | Medium |
| P1-11 | PWA + offline queue | 14 h | 3 | Enables mobile agent usage offline | Medium |
| P1-12 | Backend test coverage 80 % | 16 h | 4 | Prevents regression | Medium |
| P1-13 | Frontend test coverage 50 % | 12 h | 4 | Prevents UI regression | Medium |
| P1-14 | OpenAPI documentation | 12 h | 4 | Enables third-party integrations | Low |

### 7.3 P2 — Medium (Nice to Have in Q2)

| ID | Task | Effort | Sprint | Business Impact | Technical Risk |
|----|------|--------|--------|-----------------|----------------|
| P2-01 | Add `Tenant.kyc_documents.document_hash` | 2 h | 1 | Tamper detection for KYC | Low |
| P2-02 | Add `agent_allow_all_areas` audit fields | 1 h | 1 | Audit trail for super-agent flag | Low |
| P2-03 | Add `Property.status` and `review_status` indexes | 2 h | 2 | Dashboard filter performance | Low |
| P2-04 | Add `Payment` compound index for analytics | 2 h | 2 | Revenue report performance | Low |
| P2-05 | Add `LateFeeRule.is_active` index | 1 h | 2 | Cron job efficiency | Low |
| P2-06 | Add `PropertyTier` range query index | 2 h | 2 | Auto-tier suggestion | Low |
| P2-07 | Add `SystemSetting.data_type` | 2 h | 3 | Type safety for config | Low |
| P2-08 | Add `PropertyTier.display_order` + `icon` | 2 h | 3 | UI consistency | Low |
| P2-09 | Add `LateFeeRule.effective_from` / `effective_to` | 3 h | 3 | Scheduled rule changes | Low |
| P2-10 | Web push notifications | 6 h | 3 | Real-time engagement | Medium |
| P2-11 | Load testing with k6 | 6 h | 4 | Capacity planning | Low |
| P2-12 | Security penetration test (OWASP ZAP) | 8 h | 4 | Hardening | Medium |

### 7.4 P3 — Low (Future Considerations)

| ID | Task | Effort | Sprint | Business Impact | Technical Risk |
|----|------|--------|--------|-----------------|----------------|
| P3-01 | Remove legacy `User.password_hash` | 2 h | — | Cleanup | Low |
| P3-02 | Migrate `Property.inventory` to separate collection | 8 h | — | Support 1000+ item properties | Medium |
| P3-03 | Add `MaintenanceTicket.parts` subdocument | 4 h | — | Full maintenance procurement | Low |
| P3-04 | Add `Task.priority` field | 1 h | — | Task prioritization | Low |
| P3-05 | Add `Notice.delivery_status` retry tracking | 3 h | — | Delivery reliability | Low |
| P3-06 | Add `Property.is_deleted` soft-delete | 2 h | — | Data retention | Low |
| P3-07 | Implement Elasticsearch for property search | 16 h | — | Full-text + fuzzy search | High |
| P3-08 | Multi-language support (i18n) | 24 h | — | Expand to Swahili | Medium |
| P3-09 | Mobile native app (React Native) | 120 h | — | App store presence | High |
| P3-10 | Blockchain rent receipts | 40 h | — | Immutable proof of payment | High |

---

*Document End*
