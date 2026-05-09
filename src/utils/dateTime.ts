const pad2 = (value: number): string => `${value}`.padStart(2, '0');

const normalizeYear = (value: string): number => {
  if (value.length === 2) {
    return 2000 + Number(value);
  }

  return Number(value);
};

const buildValidatedDate = (
  day: number,
  month: number,
  year: number,
  hours: number,
  minutes: number,
  seconds: number,
): Date | null => {
  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes ||
    date.getSeconds() !== seconds
  ) {
    return null;
  }

  return date;
};

export const formatLocalDateTimeForSql = (date: Date): string => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const parseDisplayDateTime = (value: string): Date | null => {
  const text = value.trim();
  if (!text) {
    return null;
  }

  const match12h = text.match(
    /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i,
  );

  if (match12h) {
    const [, dayText, monthText, yearText, hourText, minuteText, secondText, amPmText] = match12h;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = normalizeYear(yearText);
    const minute = Number(minuteText);
    const second = Number(secondText ?? '0');
    const hour12 = Number(hourText);

    if (hour12 < 1 || hour12 > 12) {
      return null;
    }

    let hour24 = hour12 % 12;
    if (amPmText.toUpperCase() === 'PM') {
      hour24 += 12;
    }

    return buildValidatedDate(day, month, year, hour24, minute, second);
  }

  const match24h = text.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match24h) {
    return null;
  }

  const [, dayText, monthText, yearText, hourText, minuteText, secondText] = match24h;
  return buildValidatedDate(
    Number(dayText),
    Number(monthText),
    normalizeYear(yearText),
    Number(hourText),
    Number(minuteText),
    Number(secondText ?? '0'),
  );
};

export const toSqlDateTimeFromDisplay = (value: string): string | null => {
  const date = parseDisplayDateTime(value);
  return date ? formatLocalDateTimeForSql(date) : null;
};