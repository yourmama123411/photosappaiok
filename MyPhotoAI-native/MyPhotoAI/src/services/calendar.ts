import * as Calendar from 'expo-calendar';

export async function requestCalendarAccess() {
  const result = await Calendar.requestCalendarPermissionsAsync();
  return result.granted;
}

export async function createCalendarEvent(title: string, startDate: Date, endDate: Date) {
  if (!(await requestCalendarAccess())) return null;
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find(c => c.allowsModifications) ?? calendars[0];
  if (!writable) return null;
  return Calendar.createEventAsync(writable.id, { title, startDate, endDate, timeZone: 'local' });
}
