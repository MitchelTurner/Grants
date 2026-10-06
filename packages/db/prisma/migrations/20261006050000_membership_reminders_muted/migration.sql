-- Per-organization reminder mute. NotificationPreference stays on the user.
ALTER TABLE "Membership" ADD COLUMN "remindersMuted" BOOLEAN NOT NULL DEFAULT false;
