export const MIN_PASSWORD_LENGTH = 11;

export const PASSWORD_REQUIREMENTS =
  'Use at least 11 characters with an uppercase letter, lowercase letter, number, and symbol.';

export function meetsPasswordPolicy(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{11,}$/.test(password);
}

export function isPasswordPolicyError(error: { code?: string; message?: string }): boolean {
  return error.code === 'weak_password' || /password.*at least\s+11|at least\s+11.*password/i.test(error.message || '');
}
