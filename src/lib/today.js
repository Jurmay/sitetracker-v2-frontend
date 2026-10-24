/**
 * Today's date in Bhutan as YYYY-MM-DD, whatever timezone the device is
 * set to. The database counts the working day in Asia/Thimphu too, so a
 * master roll filed at 1 am lands on the same day the server expects.
 * (toISOString() would give the UTC date, a day behind until 6 am.)
 */
export function bhutanToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Thimphu' }).format(new Date());
}
