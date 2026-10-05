import { backend } from './backend';

export class SecureLoginError extends Error {
  constructor(message: string, readonly retryAfterSeconds = 0, readonly status = 0) {
    super(message); this.name = 'SecureLoginError';
  }
}
export async function secureSignIn(email: string, password: string): Promise<void> {
  const { data, error } = await backend.auth.signIn(email, password);
  if (error) throw new SecureLoginError(error.message, Number(data?.retry_after_seconds || 0), error.status || 0);
}
