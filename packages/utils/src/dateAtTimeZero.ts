function dateAtTimeZero(date: string | Date): Date {
  if (!(date instanceof Date)) date = new Date(date);

  // set time to zero
  date.setUTCHours(0);
  date.setUTCMinutes(0);
  date.setUTCSeconds(0);

  // return new date
  return date;
}

export { dateAtTimeZero };
