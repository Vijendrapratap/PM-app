import { AxiosError } from 'axios';

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  const axiosError = error as AxiosError<{ message?: string }>;
  const message = axiosError?.response?.data?.message;
  if (message) return message;
  // A real HTTP error always has a `response` (the server ran and replied).
  // No `response` on an axios error means the request never completed at
  // all - timeout, dropped connection, blocked CORS preflight, DNS failure,
  // etc. That's never the same failure as the caller's fallback (e.g.
  // "Invalid email or password"), so surface it distinctly instead of
  // letting it masquerade as a real server-side rejection.
  if (axiosError?.isAxiosError && !axiosError.response) {
    return 'Could not reach the server. Check your internet connection and try again.';
  }
  return fallback;
};
