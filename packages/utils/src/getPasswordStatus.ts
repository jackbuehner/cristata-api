/**
 * Get whether the user's password is a tempoary password and whether it is expired.
 * @param flags - flag from db.user
 * @returns
 */
function getPasswordStatus(flags: string[]): { temporary: boolean; expired: boolean } {
  const tempPasswordFlag: string | undefined = flags.find((flag) => {
    if (flag.includes('TEMPORARY_PASSWORD')) return true;
    return false;
  });
  const isPasswordExpired = (() => {
    if (tempPasswordFlag) {
      const [, , ms] = tempPasswordFlag.split('_'); // get the time the password expires
      // if the password expired before now, return true
      if (new Date(parseInt(ms)) <= new Date()) return true;
    }
    return false;
  })();
  return { temporary: !!tempPasswordFlag, expired: isPasswordExpired };
}

export { getPasswordStatus };
