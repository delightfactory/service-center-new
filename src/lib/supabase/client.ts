// ============================================================
// Supabase Client Configuration
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables!');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
        global: {
            headers: {
                'x-application-name': 'service-center',
            },
        },
        // Realtime configuration
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    }
);

// Type-safe helper for getting auth user
export const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
};

// Type-safe helper for getting session
export const getCurrentSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
};

export default supabase;
