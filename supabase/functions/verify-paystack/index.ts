// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as crypto from "https://deno.land/std@0.177.0/node/crypto.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req: Request) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const signature = req.headers.get('x-paystack-signature')
    const bodyText = await req.text()

    // 1. Verify Signature (Security Check)
    if (signature) {
      const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET_KEY!)
        .update(bodyText)
        .digest('hex')

      if (hash !== signature) {
        console.error('Signature mismatch')
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    const payload = JSON.parse(bodyText)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    let reference, amount, user_id

    // CASE 1: Webhook Event (charge.success)
    if (payload.event === 'charge.success') {
      console.log('Processing charge.success webhook...')
      reference = payload.data.reference
      amount = payload.data.amount / 100 // Convert Kobo to Naira
      user_id = payload.data.metadata?.user_id
    } 
    // CASE 2: Client-side verification call (fallback)
    else if (payload.reference) {
      console.log('Verifying transaction via manual reference...')
      const response = await fetch(`https://api.paystack.co/transaction/verify/${payload.reference}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      })
      const data = await response.json()
      
      if (!data.status || data.data.status !== 'success') {
          throw new Error('Verification failed: ' + (data.message || 'Transaction not successful'))
      }
      
      reference = data.data.reference
      amount = data.data.amount / 100
      user_id = data.data.metadata?.user_id
    }

    // 2. Update Database via RPC
    if (user_id && amount) {
      const { data: newBalance, error: rpcError } = await supabase.rpc('topup_user_wallet_internal', {
        p_user_id: user_id,
        p_amount: amount,
        p_reference: reference
      })

      if (rpcError) throw rpcError
      
      console.log(`Successfully credited ${amount} to user ${user_id}`)
      return new Response(JSON.stringify({ success: true, newBalance }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ message: 'Event ignored' }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Webhook Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
