-- Heure du rendez-vous de coaching (HH:MM) en complément de la date.
ALTER TABLE coaching_agendas
  ADD COLUMN IF NOT EXISTS next_meeting_time text;
