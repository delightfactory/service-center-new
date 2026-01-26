import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { debugLog, debugWarn, debugError } from '@/lib/utils';
import type { Profile } from '@/types';

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null; profile: Profile | null }>;
    signOut: () => Promise<void>;
    isAuthenticated: boolean;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const queryClient = useQueryClient();
    const lastProfileIdRef = useRef<string | null>(null);

    // Fetch user profile
    const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
        try {
            debugLog('[Auth] Fetching profile for:', userId);

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                debugWarn('[Auth] Error fetching profile:', error.message);
                return null;
            }

            debugLog('[Auth] Profile fetched successfully:', data?.full_name);
            return data as Profile;
        } catch (error) {
            debugError('[Auth] Exception fetching profile:', error);
            return null;
        }
    }, []);

    // Refresh profile
    const refreshProfile = useCallback(async () => {
        if (user) {
            const newProfile = await fetchProfile(user.id);
            setProfile(newProfile);
        }
    }, [user, fetchProfile]);

    // Initialize auth state - runs once
    useEffect(() => {
        debugLog('[Auth] Initializing...');

        let isInitializing = true;

        const initAuth = async () => {
            try {
                // Get initial session
                const { data: { session: initialSession }, error } = await supabase.auth.getSession();

                if (error) {
                    debugWarn('[Auth] Error getting session:', error.message);
                    setLoading(false);
                    return;
                }

                debugLog('[Auth] Session exists:', !!initialSession);

                setSession(initialSession);
                setUser(initialSession?.user ?? null);

                if (initialSession?.user) {
                    const profileData = await fetchProfile(initialSession.user.id);
                    setProfile(profileData);
                }

                debugLog('[Auth] Initialization complete');
            } catch (error) {
                debugError('[Auth] Init error:', error);
            } finally {
                isInitializing = false;
                setLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                debugLog('[Auth] State change:', event);

                // Skip INITIAL_SESSION event as we handle it in initAuth
                if (event === 'INITIAL_SESSION') {
                    return;
                }

                // Skip if still initializing to avoid race conditions
                if (isInitializing && event === 'SIGNED_IN') {
                    debugLog('[Auth] Skipping SIGNED_IN during init');
                    return;
                }

                setSession(newSession);
                setUser(newSession?.user ?? null);

                if (newSession?.user) {
                    const profileData = await fetchProfile(newSession.user.id);
                    setProfile(profileData);
                } else {
                    setProfile(null);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchProfile]);

    // Ensure queries refetch once auth/profile becomes available
    useEffect(() => {
        if (loading) return;

        const currentProfileId = profile?.id ?? null;
        if (currentProfileId && currentProfileId !== lastProfileIdRef.current) {
            debugLog('[Auth] Profile ready → invalidate queries', currentProfileId);
            queryClient.invalidateQueries();
        }

        if (!currentProfileId && lastProfileIdRef.current) {
            debugLog('[Auth] Profile cleared → clear query cache');
            queryClient.clear();
        }

        lastProfileIdRef.current = currentProfileId;
    }, [loading, profile?.id, queryClient]);

    // Sign in with email/password
    const signIn = async (email: string, password: string) => {
        try {
            // Note: We don't set global loading here because:
            // 1. LoginPage has its own loading state for the button
            // 2. Setting loading=true here causes DashboardLayout to show spinner forever
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return { error, profile: null };
            }

            // Set user and session immediately to update isAuthenticated
            if (data.user && data.session) {
                setUser(data.user);
                setSession(data.session);
            }

            // Fetch profile for routing
            let userProfile = null;
            if (data.user) {
                userProfile = await fetchProfile(data.user.id);
                setProfile(userProfile);
            }

            return { error: null, profile: userProfile };
        } catch (error) {
            return { error: error as Error, profile: null };
        }
    };

    // Sign out
    const signOut = async () => {
        setLoading(true);
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setSession(null);
        setLoading(false);
    };

    const value = {
        user,
        profile,
        session,
        loading,
        signIn,
        signOut,
        isAuthenticated: !!user,
        refreshProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Hook to check if user has specific role
export function useHasRole(allowedRoles: string[]) {
    const { profile } = useAuth();
    if (!profile) return false;
    return allowedRoles.includes(profile.role);
}

// Hook to check if user can access specific branch
export function useCanAccessBranch(branchId: string) {
    const { profile } = useAuth();
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    return profile.branch_id === branchId;
}
