const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatUtcDateToYmd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidIsoDate(date: string): boolean {
  if (!ISO_DATE_REGEX.test(date)) return false;

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;

  return formatUtcDateToYmd(parsed) === date;
}

export function getTodayDateStringUtc(now: Date = new Date()): string {
  return formatUtcDateToYmd(now);
}

export function isMeetingDateAfterToday(
  meetingDate: string,
  now: Date = new Date()
): boolean {
  return meetingDate > getTodayDateStringUtc(now);
}

export function validateMeetingDate(
  meetingDate: string,
  now: Date = new Date()
): string | null {
  if (!isValidIsoDate(meetingDate)) {
    return "Data da reunião inválida. Use o formato YYYY-MM-DD.";
  }

  if (isMeetingDateAfterToday(meetingDate, now)) {
    return "A data da reunião não pode ser maior que hoje.";
  }

  return null;
}
