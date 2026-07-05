import { Request } from 'express';

// Named (non-wildcard) route params are always a single string at runtime;
// Express's types widen them to `string | string[]` only to account for
// repeated wildcard segments, which none of these routes use.
export const param = (req: Request, name: string): string => req.params[name] as string;
