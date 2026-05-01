// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const AFRICA_TALKING_USERNAME = Deno.env.get('AFRICA_TALKING_USERNAME')
const AFRICA_TALKING_API_KEY = Deno.env.get('AFRICA_TALKING_API_KEY')
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER')

serve(async (req: Request) => {
  const { record } = await req.json()
  let { phone, message } = record

  // Sanitize phone number: Remove all spaces, dashes, etc.
  // Twilio/AT expect E.164 or similar without formatting characters.
  phone = phone.replace(/[^+\d]/g, '')

  console.log(`Sending SMS to ${phone}: ${message}`)

  try {
    if (AFRICA_TALKING_API_KEY) {
      // Africa's Talking Implementation
      const response = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'ApiKey': AFRICA_TALKING_API_KEY
        },
        body: new URLSearchParams({
          username: AFRICA_TALKING_USERNAME || 'sandbox',
          to: phone,
          message: message
        })
      })
      const result = await response.json()
      return new Response(JSON.stringify(result), { status: 200 })
    } 
    
    if (TWILIO_AUTH_TOKEN) {
      // Twilio Implementation
      const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: phone,
          From: TWILIO_FROM_NUMBER || '',
          Body: message
        })
      })
      const result = await response.json()
      return new Response(JSON.stringify(result), { status: 200 })
    }

    return new Response(JSON.stringify({ error: 'No SMS provider configured' }), { status: 400 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
