// ============================================================
// Auth Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService, SignInCredentials, SignUpCredentials } from '@/lib/services';
import { queryKeys } from '../query-keys';
import type { Profile } from '@/types/database';
import type { User, Session } from '@supabase/supabase-js';

// ============================================================
// Queries
// ============================================================

/**
 * Get current session
 */
export function useSession() {
    return useQuery({
        queryKey: queryKeys.auth.session,
        queryFn: () => authService.getSession(),
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: false,
    });
}

/**
 * Get current user
 */
export function useCurrentUser() {
    return useQuery({
        queryKey: queryKeys.auth.user,
        queryFn: () => authService.getCurrentUser(),
        staleTime: 1000 * 60 * 5,
        retry: false,
    });
}

/**
 * Get current user's profile
 */
export function useCurrentProfile() {
    return useQuery({
        queryKey: queryKeys.auth.profile,
        queryFn: () => authService.getCurrentProfile(),
        staleTime: 1000 * 60 * 5,
        retry: false,
    });
}

// ============================================================
// Mutations
// ============================================================

/**
 * Sign in mutation
 */
export function useSignIn() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (credentials: SignInCredentials) => authService.signIn(credentials),
        onSuccess: (data) => {
            queryClient.setQueryData(queryKeys.auth.session, data.session);
            queryClient.setQueryData(queryKeys.auth.user, data.user);
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile });
        },
    });
}

/**
 * Sign up mutation
 */
export function useSignUp() {
    return useMutation({
        mutationFn: (credentials: SignUpCredentials) => authService.signUp(credentials),
    });
}

/**
 * Sign out mutation
 */
export function useSignOut() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => authService.signOut(),
        onSuccess: () => {
            queryClient.setQueryData(queryKeys.auth.session, null);
            queryClient.setQueryData(queryKeys.auth.user, null);
            queryClient.setQueryData(queryKeys.auth.profile, null);
            queryClient.clear();
        },
    });
}

/**
 * Reset password mutation
 */
export function useResetPassword() {
    return useMutation({
        mutationFn: (email: string) => authService.resetPassword(email),
    });
}

/**
 * Update password mutation
 */
export function useUpdatePassword() {
    return useMutation({
        mutationFn: (newPassword: string) => authService.updatePassword(newPassword),
    });
}
