-- Migration: 00000000000006_trial_ends_at.sql
-- Purpose: Add trial_ends_at column to profiles and subscribers tables for 14-day trial gating

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '14 days');

ALTER TABLE subscribers 
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '14 days');
