// @ts-nocheck
// ============================================================
// Admin Create User - Edge Function
// Creates a new user in Supabase Auth and profile
// ============================================================
// Deploy: supabase functions deploy admin-create-user
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

interface CreateUserRequest {
    email: string
    password: string
    full_name: string
    phone?: string
    role: 'admin' | 'manager' | 'supervisor' | 'engineer' | 'technician' | 'warehouse' | 'accountant'
    branch_id?: string
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get request body
        const body: CreateUserRequest = await req.json()

        // Validate required fields
        if (!body.email || !body.password || !body.full_name || !body.role) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: email, password, full_name, role' }),
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
            .select('role')
            .eq('id', caller.id)
            .single()

        if (profileError || !callerProfile) {
            return new Response(
                JSON.stringify({ error: 'Could not verify caller role' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Only admin and manager can create users
        if (!['admin', 'manager'].includes(callerProfile.role)) {
            return new Response(
                JSON.stringify({ error: 'Only admin or manager can create users' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Managers can only create certain roles
        if (callerProfile.role === 'manager') {
            const allowedRoles = ['supervisor', 'engineer', 'technician', 'warehouse', 'accountant']
            if (!allowedRoles.includes(body.role)) {
                return new Response(
                    JSON.stringify({ error: 'Managers cannot create admin or manager users' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: body.email,
            password: body.password,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                full_name: body.full_name,
                role: body.role,
            }
        })

        if (authError) {
            return new Response(
                JSON.stringify({ error: authError.message }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Insert the profile - IMPORTANT: No trigger exists, we must create it manually
        const { error: insertError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: authData.user.id, // Must match auth.users.id
                email: body.email,
                full_name: body.full_name,
                phone: body.phone || null,
                role: body.role,
                branch_id: body.branch_id || null,
                is_active: true,
            })

        if (insertError) {
            // Profile creation failed - we should delete the auth user to maintain consistency
            console.error('Profile insert error:', insertError)

            // Try to cleanup the orphan auth user
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

            return new Response(
                JSON.stringify({ error: `فشل إنشاء الملف الشخصي: ${insertError.message}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: authData.user.id,
                    email: authData.user.email,
                    full_name: body.full_name,
                    role: body.role,
                }
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
