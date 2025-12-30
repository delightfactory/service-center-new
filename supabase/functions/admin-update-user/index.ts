// @ts-nocheck
// ============================================================
// Admin Update User - Edge Function
// Updates user data, password, and active status
// ============================================================
// Deploy: supabase functions deploy admin-update-user
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

interface UpdateUserRequest {
    user_id: string
    full_name?: string
    phone?: string
    role?: 'admin' | 'manager' | 'supervisor' | 'engineer' | 'technician' | 'warehouse' | 'accountant'
    branch_id?: string | null
    is_active?: boolean
    new_password?: string
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get request body
        const body: UpdateUserRequest = await req.json()

        // Validate required fields
        if (!body.user_id) {
            return new Response(
                JSON.stringify({ error: 'Missing required field: user_id' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create Supabase admin client with service role key
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // Create Supabase client with user's JWT to verify admin role
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Verify caller is admin or manager
        const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser()
        if (callerError || !caller) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get caller's profile to check role
        const { data: callerProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role, branch_id')
            .eq('id', caller.id)
            .single()

        if (profileError || !callerProfile) {
            return new Response(
                JSON.stringify({ error: 'Could not verify caller role' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Only admin and manager can update users
        if (!['admin', 'manager'].includes(callerProfile.role)) {
            return new Response(
                JSON.stringify({ error: 'Only admin or manager can update users' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get target user's profile
        const { data: targetProfile, error: targetError } = await supabaseAdmin
            .from('profiles')
            .select('role, branch_id')
            .eq('id', body.user_id)
            .single()

        if (targetError || !targetProfile) {
            return new Response(
                JSON.stringify({ error: 'User not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Managers can only update users in their branch and non-admin/manager roles
        if (callerProfile.role === 'manager') {
            if (['admin', 'manager'].includes(targetProfile.role)) {
                return new Response(
                    JSON.stringify({ error: 'Managers cannot update admin or manager users' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Check if trying to set role to admin/manager
            if (body.role && ['admin', 'manager'].includes(body.role)) {
                return new Response(
                    JSON.stringify({ error: 'Managers cannot promote users to admin or manager' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // Prepare profile updates
        const profileUpdates: Record<string, any> = {}
        if (body.full_name !== undefined) profileUpdates.full_name = body.full_name
        if (body.phone !== undefined) profileUpdates.phone = body.phone
        if (body.role !== undefined) profileUpdates.role = body.role
        if (body.branch_id !== undefined) profileUpdates.branch_id = body.branch_id
        if (body.is_active !== undefined) profileUpdates.is_active = body.is_active

        // Update profile if there are changes
        if (Object.keys(profileUpdates).length > 0) {
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update(profileUpdates)
                .eq('id', body.user_id)

            if (updateError) {
                return new Response(
                    JSON.stringify({ error: updateError.message }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // Update password if provided
        if (body.new_password) {
            const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
                body.user_id,
                { password: body.new_password }
            )

            if (passwordError) {
                return new Response(
                    JSON.stringify({ error: `Password update failed: ${passwordError.message}` }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // Ban/unban user based on is_active
        if (body.is_active !== undefined) {
            const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
                body.user_id,
                { ban_duration: body.is_active ? 'none' : '876000h' } // ~100 years ban if disabled
            )

            if (banError) {
                console.error('Ban update error:', banError)
                // Don't fail the request, profile was updated
            }
        }

        // Fetch updated profile
        const { data: updatedProfile } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, email, phone, role, branch_id, is_active')
            .eq('id', body.user_id)
            .single()

        return new Response(
            JSON.stringify({
                success: true,
                user: updatedProfile
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
