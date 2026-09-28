const zone = "Europe/Rome";

function parts(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
}

function pick(date: Date, type: Intl.DateTimeFormatPartTypes) {
  const value = parts(date).find((part) => part.type === type)?.value ?? "";
  return type === "hour" && value === "24" ? "00" : value;
}

export function romeDateTimeLocal(date: Date): string {
  return `${pick(date, "year")}-${pick(date, "month")}-${pick(date, "day")}T${pick(date, "hour")}:${pick(date, "minute")}`;
}

export function romeDateTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: zone,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function parseRomeDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const offset = Date.UTC(
    Number(pick(new Date(wall), "year")),
    Number(pick(new Date(wall), "month")) - 1,
    Number(pick(new Date(wall), "day")),
    Number(pick(new Date(wall), "hour")),
    Number(pick(new Date(wall), "minute")),
    Number(pick(new Date(wall), "second")),
  ) - wall;
  const instant = new Date(wall - offset);
  if (romeDateTimeLocal(instant) !== `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`) return null;
  return instant;
}
