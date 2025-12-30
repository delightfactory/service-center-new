// ============================================================
// Auth Service
// ============================================================

import { supabase } from '@/lib/supabase/client';
import { handleSupabaseError, UnauthorizedError } from '@/lib/utils/error-handler';
import type { Profile } from '@/types/database';
import type { User, Session } from '@supabase/supabase-js';

// ============================================================
// Types
// ============================================================

export interface SignInCredentials {
    email: string;
    password: string;
}

export interface SignUpCredentials extends SignInCredentials {
    fullName: string;
    phone?: string;
}

export interface AuthResponse {
    user: User | null;
    session: Session | null;
}

// ============================================================
// Auth Service
// ============================================================

class AuthService {
    /**
     * Sign in with email and password
     */
    async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                throw new UnauthorizedError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
            }
            throw new UnauthorizedError(error.message);
        }

        return data;
    }

    /**
     * Sign up a new user
     */
    async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
        const { data, error } = await supabase.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: {
                data: {
                    full_name: credentials.fullName,
                    phone: credentials.phone,
                },
            },
        });

        if (error) {
            if (error.message.includes('already registered')) {
                throw new UnauthorizedError('هذا البريد الإلكتروني مسجل بالفعل');
            }
            throw new UnauthorizedError(error.message);
        }

        return data;
    }

    /**
     * Sign out the current user
     */
    async signOut(): Promise<void> {
        const { error } = await supabase.auth.signOut();
        if (error) throw new UnauthorizedError(error.message);
    }

    /**
     * Get the current session
     */
    async getSession(): Promise<Session | null> {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw new UnauthorizedError(error.message);
        return session;
    }

    /**
     * Get the current user
     */
    async getCurrentUser(): Promise<User | null> {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) return null;
        return user;
    }

    /**
     * Get the current user's profile
     */
    async getCurrentProfile(): Promise<Profile | null> {
        const user = await this.getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            handleSupabaseError(error);
        }

        return data as Profile;
    }

    /**
     * Update the current user's password
     */
    async updatePassword(newPassword: string): Promise<void> {
        const { error } = await supabase.auth.updateUser({
            password: newPassword,
        });

        if (error) throw new UnauthorizedError(error.message);
    }

    /**
     * Send password reset email
     */
    async resetPassword(email: string): Promise<void> {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw new UnauthorizedError(error.message);
    }

    /**
     * Listen to auth state changes
     */
    onAuthStateChange(callback: (event: string, session: Session | null) => void) {
        return supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }
}

export const authService = new AuthService();
export default authService;
