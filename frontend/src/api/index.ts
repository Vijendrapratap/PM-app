import axios from 'axios';

// Deliberately never throws here: this module is imported transitively by
// almost every page/hook, so a throw at this top level runs during initial
// module evaluation - before React even mounts - and blanks the entire app
// on every route with no error boundary able to catch it. Missing
// VITE_API_URL should degrade to failed API calls (already handled by
// existing try/catch + loading states), not a dead white screen.
//
// This backend always serves its routes under /api (see backend/src/app.ts).
// Deployers repeatedly misconfigure VITE_API_URL for this same app - missing
// the /api suffix, or (confirmed by inspecting the actual deployed production
// bundle) missing the https:// scheme entirely. A schemeless value like
// "my-backend.up.railway.app" is not an absolute URL to axios/the browser -
// it gets treated as a *relative path* against the frontend's own origin,
// so every request silently hit the frontend's own static host instead of
// the backend. Normalizing both here removes this whole class of mistake.
const normalizeApiUrl = (url: string): string => {
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const trimmed = withScheme.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const resolveApiUrl = (): string => {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return normalizeApiUrl(configured);
  if (import.meta.env.DEV) return 'http://localhost:5000/api';
  console.error(
    'VITE_API_URL is not set for this production build. Falling back to same-origin "/api" ' +
      '- API requests will fail unless this host also serves the backend at that path.'
  );
  return '/api';
};

const api = axios.create({
  baseURL: resolveApiUrl(),
});

// Intercept requests to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;

// A misconfigured API base URL (e.g. resolving to a host that doesn't route
// /api anywhere, like the '/api' same-origin fallback above with no backend
// behind it) can make axios resolve successfully with an HTML error/SPA
// fallback page as `res.data` instead of throwing. Pages then call
// .filter()/.reduce() on that during render with no try/catch around it and
// crash. List endpoints route through this so a bad response becomes a
// normal "failed to load" error state instead of a render crash.
export const expectArray = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  throw new Error('Unexpected response from server (expected a list)');
};
