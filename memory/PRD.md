# Pick-Am - Receiver-Confirmed Delivery Platform

## Problem Statement
Pick-Am is a receiver-confirmed delivery platform for Nigeria. Unlike traditional delivery systems, it introduces a confirmation-first workflow where deliveries only begin after the receiver accepts the package. Nigeria-first design with landmark-based addressing, Naira currency, and phone communication focus.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Leaflet Maps
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Auth**: JWT-based (httpOnly cookies) with bcrypt password hashing
- **Payment**: Simulated wallet (Paystack integration pending)
- **Maps**: Leaflet with OpenStreetMap tiles

## User Personas
1. **Sender**: Creates packages, pays via wallet, tracks deliveries
2. **Receiver**: Reviews incoming packages, accepts/rejects, tracks deliveries
3. **Admin**: Pre-seeded account with wallet balance

## Core Requirements
- Receiver-confirmed delivery workflow
- Wallet-based payment verification before rider dispatch
- State-driven UI (pending → accepted → searching → assigned → picked_up → in_transit → delivered)
- Chat-style package creation interface
- Real-time tracking with map
- Nigeria-first: Naira, landmarks, phone numbers

## What's Been Implemented (April 12, 2026)
- [x] JWT authentication (register, login, logout, me, refresh)
- [x] Admin seeding with wallet balance (₦50,000)
- [x] Brute force protection
- [x] Package CRUD (create, list sent/received, get by ID)
- [x] Receiver accept/reject flow with wallet verification
- [x] Delivery status advancement simulation
- [x] Wallet management (balance, simulated top-up, transaction history)
- [x] Dashboard with stats grid + package list + quick actions
- [x] Chat-style package creation UI
- [x] State-driven tracking page with Leaflet map
- [x] Receiver inbox with accept/reject buttons
- [x] Swiss & High-Contrast design (Cabinet Grotesk + IBM Plex Sans)
- [x] **Rider App** — Full rider dashboard with available jobs feed
- [x] **Rider Registration** — Role selector (User/Rider) on signup
- [x] **Rider Delivery Flow** — Accept job → Confirm pickup → Start transit → Confirm delivery
- [x] **Rider Active Delivery** — Map-driven view with step-by-step action bottom sheet
- [x] **Rider Earnings** — 70% of package price, wallet + transaction history
- [x] **Rider History** — Completed deliveries list
- [x] **Online/Offline Toggle** — Rider availability control
- [x] **Atomic Job Acceptance** — Race-condition-safe rider job claiming
- [x] **Demo Rider Account** — rider@pickam.com / rider123
- [x] **Rider Rating System** — 1-5 star rating after delivery, running average, prevents duplicate ratings
- [x] **Rating Modal** — Auto-prompts sender/receiver to rate rider on delivery completion
- [x] **Browser Geolocation API** — Real GPS tracking via navigator.geolocation.watchPosition, falls back to Lagos coords
- [x] **WebSocket Real-time Updates** — /api/ws/package/{id}, /api/ws/user/{id}, /api/ws/rider endpoints with ConnectionManager
- [x] **Live/Polling Indicators** — UI shows "Live" when WebSocket connected, falls back to polling
- [x] **Map Auto-update** — MapUpdater component centers map on new GPS coordinates
- [x] **Distance-based Pricing** — Haversine formula with 30+ Lagos landmark coords, base + per-km * size multiplier
- [x] **Price Calculator API** — POST /api/calculate-price returns distance_km, price, breakdown
- [x] **Price Breakdown UI** — CreatePackagePage shows distance, base, per-km charge before confirming
- [x] **Delivery History Page** — /history with status filter dropdown, date range inputs, pagination
- [x] **History Filters API** — GET /api/history with status, date_from, date_to, page, limit params
- [x] **Simulated SMS Notifications** — Logged to DB on package creation + delivery completion
- [x] **SMS Log API** — GET /api/sms-log for viewing notification history
- [x] **Supabase Client Initialized** — Connected, setup endpoint provides SQL migration for tables
- [x] **Dashboard History Quick Action** — History link added to user dashboard

## Prioritized Backlog

### P0 (Critical)
- Paystack integration for real wallet top-up (user to provide API keys)

### P1 (High)
- Push notifications / real-time WebSocket updates for package status changes
- SMS notifications to receiver (Twilio/Africa's Talking integration)
- Real-time rider tracking with actual GPS coordinates (Geolocation API)

### P2 (Medium)
- Delivery history page with filters and date ranges
- Package pricing calculator based on distance
- User profile management
- Password reset functionality
- Rider rating system after delivery completion

### P3 (Low)
- Delivery scheduling (pick a time)
- Multi-language support (Yoruba, Igbo, Hausa)
- Analytics dashboard for admins
- Rider fleet management for businesses

## Next Tasks
1. Integrate Paystack payment gateway (awaiting API keys from user)
2. Add WebSocket real-time updates for delivery status
3. Build Rider App view
4. Add SMS notifications
