-- Run this SQL in your Supabase SQL Editor to add the earnings fields to the users table:

ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawable_earnings NUMERIC(10,2) DEFAULT 0.00;
