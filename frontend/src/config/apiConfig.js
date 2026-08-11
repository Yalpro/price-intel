import { supabase } from '../supabaseClient';

// Authoritative Single Backend API Base URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.anaprice.com';

/**
 * Centralized authenticated API fetch client.
 * Automatically attaches Supabase session Bearer access token for protected API calls.
 */
export const fetchWithAuth = async (endpoint, options = {}) => {
  let token = null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || null;
  } catch (err) {
    console.warn('[API Client] Failed to retrieve Supabase session token:', err);
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  return fetch(url, { ...options, headers });
};
