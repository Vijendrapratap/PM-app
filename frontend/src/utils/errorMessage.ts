import { AxiosError } from 'axios';

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  const message = (error as AxiosError<{ message?: string }>)?.response?.data?.message;
  return message || fallback;
};
