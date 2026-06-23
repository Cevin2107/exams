-- Migration: Thêm trường google_calendar_event_id lưu ID sự kiện Google Calendar
ALTER TABLE public.schedule_registrations
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
