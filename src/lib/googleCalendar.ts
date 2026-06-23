import { google } from "googleapis";

// Setup Google auth
const getCalendarClient = () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!email || !privateKey || !calendarId) {
    console.warn("Google Calendar environment variables are not configured. Sync skipped.");
    return null;
  }

  try {
    const auth = new google.auth.JWT({
      email: email,
      key: privateKey.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/calendar"]
    });
    return google.calendar({ version: "v3", auth });
  } catch (error) {
    console.error("Failed to initialize Google Calendar client:", error);
    return null;
  }
};

// Map day_of_week (2-8, where 2 is Monday, 8 is Sunday) to JS day (0-6, where 0 is Sunday, 1 is Monday)
const mapDayOfWeekToJsDay = (dayOfWeek: number): number => {
  return dayOfWeek === 8 ? 0 : dayOfWeek - 1;
};

/**
 * Calculates the next occurrence of a weekday at a given time in Vietnam timezone (GMT+7)
 */
export function getNextWeekdayDateTime(dayOfWeek: number, timeStr: string): Date {
  const targetJsDay = mapDayOfWeekToJsDay(dayOfWeek);
  
  // Create a Date object representing the current moment
  const now = new Date();
  
  // Vietnam offset is GMT+7 (7 hours = 7 * 60 * 60 * 1000 ms)
  const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  
  const currentJsDay = vnTime.getUTCDay();
  let daysDiff = targetJsDay - currentJsDay;
  if (daysDiff < 0) {
    daysDiff += 7;
  } else if (daysDiff === 0) {
    // If it's today, check if the shift time has already passed
    const [hours, minutes] = timeStr.split(":").map(Number);
    const vnCurrentHours = vnTime.getUTCHours();
    const vnCurrentMinutes = vnTime.getUTCMinutes();
    if (hours < vnCurrentHours || (hours === vnCurrentHours && minutes <= vnCurrentMinutes)) {
      daysDiff += 7;
    }
  }

  // Find the target date
  const targetVnDate = new Date(vnTime);
  targetVnDate.setUTCDate(vnTime.getUTCDate() + daysDiff);
  
  const [h, m, s] = timeStr.split(":").map(Number);
  
  const year = targetVnDate.getUTCFullYear();
  const month = String(targetVnDate.getUTCMonth() + 1).padStart(2, "0");
  const date = String(targetVnDate.getUTCDate()).padStart(2, "0");
  
  // Format: "YYYY-MM-DDTHH:mm:ss" in Vietnam timezone
  const isoStr = `${year}-${month}-${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s || 0).padStart(2, "0")}`;
  
  // Return the Date object in UTC corresponding to that Vietnam time
  return new Date(`${isoStr}+07:00`);
}

/**
 * Creates a weekly recurring Google Calendar event
 * Returns the event ID or null if failed
 */
export async function createCalendarEvent(
  studentName: string,
  dayOfWeek: number,
  shiftName: string,
  startTimeStr: string,
  endTimeStr: string
): Promise<string | null> {
  const calendar = getCalendarClient();
  if (!calendar) return null;

  try {
    const startDateTime = getNextWeekdayDateTime(dayOfWeek, startTimeStr);
    const endDateTime = getNextWeekdayDateTime(dayOfWeek, endTimeStr);

    // Calculate the end of the month for the UNTIL rule (last day of the month where the event starts)
    const lastDayOfMonth = new Date(Date.UTC(startDateTime.getUTCFullYear(), startDateTime.getUTCMonth() + 1, 0, 23, 59, 59));
    const year = lastDayOfMonth.getUTCFullYear();
    const month = String(lastDayOfMonth.getUTCMonth() + 1).padStart(2, "0");
    const date = String(lastDayOfMonth.getUTCDate()).padStart(2, "0");
    const untilStr = `${year}${month}${date}T235959Z`;

    const event = {
      summary: `${studentName} - ${shiftName}`,
      description: `Lịch dạy học được tự động đồng bộ từ website.\nHọc sinh: ${studentName}\nCa học: ${shiftName} (${startTimeStr.substring(0, 5)} - ${endTimeStr.substring(0, 5)})`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "Asia/Ho_Chi_Minh",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "Asia/Ho_Chi_Minh",
      },
      recurrence: [`RRULE:FREQ=WEEKLY;UNTIL=${untilStr}`],
    };

    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
    const res = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    return res.data.id || null;
  } catch (error) {
    console.error("Error creating Google Calendar event:", error);
    return null;
  }
}

/**
 * Deletes a Google Calendar event
 * If the event has past occurrences, it updates the recurrence rule to stop at the current time to preserve history.
 * If the event hasn't started yet, it deletes the event entirely.
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = getCalendarClient();
  if (!calendar) return;

  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
    
    // Fetch the event to check its start date
    const event = await calendar.events.get({
      calendarId,
      eventId,
    });

    const startDateTimeStr = event.data.start?.dateTime || event.data.start?.date;
    if (startDateTimeStr) {
      const startDateTime = new Date(startDateTimeStr);
      const now = new Date();

      if (startDateTime > now) {
        // Event hasn't started yet -> delete completely
        await calendar.events.delete({
          calendarId,
          eventId,
        });
        return;
      } else {
        // Event already has past occurrences -> update recurrence to cut off future occurrences
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, "0");
        const date = String(now.getUTCDate()).padStart(2, "0");
        const hours = String(now.getUTCHours()).padStart(2, "0");
        const minutes = String(now.getUTCMinutes()).padStart(2, "0");
        const seconds = String(now.getUTCSeconds()).padStart(2, "0");
        const untilStr = `${year}${month}${date}T${hours}${minutes}${seconds}Z`;

        event.data.recurrence = [`RRULE:FREQ=WEEKLY;UNTIL=${untilStr}`];

        await calendar.events.update({
          calendarId,
          eventId,
          requestBody: event.data,
        });
        return;
      }
    }

    // Fallback if no start time found
    await calendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (error: any) {
    // If the event is already deleted (404/410), ignore the error
    if (error.status === 404 || error.status === 410) {
      console.warn(`Google Calendar event ${eventId} not found or already deleted. Proceeding...`);
      return;
    }
    console.error(`Error deleting Google Calendar event ${eventId}:`, error);
    throw error;
  }
}
