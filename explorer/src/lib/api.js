const origin = import.meta.env.VITE_API_ORIGIN || '';
export const EXPLORER_API = origin ? `${origin}/api/explorer` : '/api/explorer';
