// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

serve(async (req: Request) => {
  try {
    // 1. Get authenticated user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Invalid user token')

    const { amount } = await req.json()
    if (!amount || amount < 500) throw new Error('Minimum amount is 500')

    // 2. Initialize with Paystack (Server-to-Server)
    // We set the user_id HERE, so the user cannot manipulate it.
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: user.email,
        amount: amount * 100, // kobo
        metadata: {
          user_id: user.id
        }
      })
    })

    const data = await response.json()
    if (!data.status) throw new Error(data.message)

    return new Response(JSON.stringify(data.data), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }
})
