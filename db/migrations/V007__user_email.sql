-- V007: Add email column to users for email OTP delivery
-- Email is optional (NULL) until onboarding completes

ALTER TABLE users ADD COLUMN email TEXT;

CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;