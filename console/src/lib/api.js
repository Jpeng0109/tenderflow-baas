const origin = import.meta.env.VITE_API_ORIGIN || '';
export const API = origin ? `${origin}/api` : '/api';
