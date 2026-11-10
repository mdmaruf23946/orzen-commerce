# ORZEN

## Current Architecture (technical summary)

- **Framework:** TanStack Start v1 (React 19, SSR, server functions) on Vite 8.
- **Hosting:** Cloudflare Workers (`orzen.top`), deployed with `npm run deploy:production` (wrangler). Do not use Lovable Publish for the live domain.
- **Backend:** Supabase — PostgreSQL (RLS on every table), Auth, Storage. No Supabase Edge Functions; server logic lives in `createServerFn` and `src/routes/api/public/*`.
- **Database schema:** `supabase/migrations/` is the single source of truth.
- **Scheduled jobs:** pg_cron calls `dispatch_minute_jobs()` and public API routes.
- **Styling:** Tailwind CSS v4 via `src/styles.css`.
- **Tests:** Vitest with standalone `vitest.config.ts`. Run `npm test` (or `bunx vitest run`).

## Code Layout

- `src/routes/` — pages and server routes (`src/routes/api/public/*` for webhooks/cron; verify callers inside handlers).
- `src/lib/<domain>/*.server.ts` — server-only logic; `*.functions.ts` — `createServerFn` entry points. Explicit module imports preserve browser/server boundaries; no umbrella barrels.
- `agents/`, `integrations/`, `inbox/` — AI response logic, messaging/website connections, and unified inbox access. AI's `agents/ai-agent.server.ts` and Messenger's `integrations/messenger-webhook.server.ts` retain their public exports.
- `orders/`, `payments/`, `couriers/`, `invoices/` — order processing, billing/gateways, parcel providers, and invoice configuration.
- `accounts/`, `admin/`, `calls/`, `catalog/`, `notifications/`, `security/`, `analytics/` — account access, administration, calls, products, alerts, security, and reporting.
- `hosting/`, `marketing/`, `site-builder/`, `storefront/` — domain hosting, tracking/SEO, page builders, and customer shopping.
- Existing specialized folders (`ai-admin/`, `merchant-ai/`, `voice/`, `notify/`, `subscription-pay/`, `custom-gateway/`, `crypto/`, `mcp/`, invoice templates) remain intact. Global UI helpers, caches and telemetry stay at the library root. Tests stay beside their modules.

## Database Migrations

- Add every schema change as a new SQL file in `supabase/migrations/`. Never edit applied migrations.
- `drizzle/` is a read-only mirror for typing/reference — never generate migrations from it.

## CI

`.github/workflows/ci.yml` runs install, tests, typecheck and build on every push and pull request.

## Original Product Specification


# PROJECT TITLE

Premium Multi-Store SaaS E-commerce Platform (Mobile First & High Performance)

# PROJECT OVERVIEW

Create a professional, modern, lightweight, and extremely fast Multi-Store SaaS E-commerce Platform.

This platform will have only three main panels:

1. Owner Admin Panel

2. User Admin Panel (One for each subscriber)

3. Customer Store (Frontend)

The entire system must be designed with a Mobile-First approach because most customers will use smartphones.

The design philosophy is:

• Minimal

• Clean

• Premium

• Professional

• Fast

• Responsive

• Conversion Focused

• Lightweight

• SEO Friendly

Avoid unnecessary animations, heavy libraries, complex effects, and anything that slows down the website.

====================================================

GENERAL REQUIREMENTS

====================================================

✔ Mobile First Design

✔ Fully Responsive

✔ Premium UI

✔ Very Fast Loading

✔ Clean Code Structure

✔ Component Based Architecture

✔ Reusable Components

✔ Optimized Database Queries

✔ Lazy Loading Images

✔ WebP Image Support

✔ Minified Assets

✔ SEO Friendly

✔ Accessible UI

✔ Secure Authentication

====================================================

SYSTEM STRUCTURE

====================================================

There will be only three sections.

--------------------------------

1. OWNER ADMIN PANEL

--------------------------------

Only one Owner Admin exists.

Owner controls everything.

Features:

• Dashboard

• Total Users

• Total Stores

• Active Stores

• Suspended Stores

• Subscription Management

• Payment Management

• Sales Reports

• Website Settings

• Banner Management

• Notice Management

• Store Management

• User Management

• Backup & Restore

• Logout

Owner can:

Create Store

Suspend Store

Activate Store

Delete Store

View All Stores

Manage Subscription Packages

Manage Payments

====================================================

2. USER ADMIN PANEL

Every subscriber automatically gets a separate admin panel after purchasing a subscription.

Each user can only access their own data.

Features:

Dashboard

Today's Sales

Total Sales

Products

Orders

Revenue

--------------------------------

Product Management

Add Product

Edit Product

Delete Product

Category

Stock

Gallery Images

Product Status

--------------------------------

Order Management

Pending

Confirmed

Processing

Delivered

Cancelled

--------------------------------

Customer Management

Customer List

Order History

--------------------------------

Banner Management

Upload Banner

Change Banner

Delete Banner

--------------------------------

Store Settings

Store Logo

Store Name

Store Description

Phone Number

WhatsApp Number

Facebook Link

Address

Primary Color

--------------------------------

Reports

Sales Report

Product Report

Order Report

--------------------------------

Subscription

Current Package

Renew Package

Expire Date

Payment History

--------------------------------

Logout

====================================================

3. CUSTOMER STORE (FRONTEND)

Every subscriber automatically gets a separate store.

Example:

yourdomain.com/store/store-name

OR

store-name.yourdomain.com

====================================================

CUSTOMER STORE DESIGN

====================================================

Homepage should remain extremely simple.

Only four sections:

Header

↓

Banner

↓

Products

↓

Footer

Nothing else.

====================================================

HEADER

Keep Header minimal.

Include only:

Store Logo

Store Name

Cart Icon

No large navigation.

No mega menu.

No unnecessary links.

====================================================

BANNER

Responsive Banner

Mobile Friendly

Maximum 3 banners.

Banner should be lightweight.

Use WebP images.

No heavy slider.

Smooth but lightweight transition.

====================================================

PRODUCT SECTION

Show products in responsive grid.

Each Product Card includes:

Product Image

Product Name

Selling Price

Old Price (Optional)

Stock Status

Buy Now Button

Add To Cart Button

Quick View (Optional)

Cards should be clean with premium spacing.

====================================================

PRODUCT DETAILS PAGE

Large Product Image

Gallery

Product Name

Price

Discount

Available Stock

Color Selection (Optional)

Size Selection (Optional)

Quantity Selector

Short Description

Buy Now

Add To Cart

Related Products (Optional)

====================================================

CART

Selected Products

Quantity Update

Remove Product

Subtotal

Checkout Button

====================================================

CHECKOUT

Checkout should be extremely simple.

Required Fields:

Customer Name

Phone Number

Full Address

Delivery Area (Optional)

Payment Method

Order Summary

Confirm Order Button

No unnecessary information.

Customer should complete an order within one minute.

====================================================

FOOTER

Simple Footer

Contact Information

WhatsApp

Facebook

Privacy Policy

Terms & Conditions

Copyright

====================================================

DESIGN SYSTEM

====================================================

Primary Color:

Editable by Store Owner

Neutral Background

White Cards

Soft Shadow

Rounded Corners

Premium Typography

Large Buttons

Large Touch Area

Excellent Mobile Experience

====================================================

UI STYLE

====================================================

Premium

Modern

Minimal

Clean

Elegant

Professional

No clutter.

No unnecessary decorations.

====================================================

PERFORMANCE

====================================================

Target Performance:

Google PageSpeed:

Desktop: 95+

Mobile: 90+

LCP under 2 seconds

CLS almost zero

Optimized JavaScript

Optimized CSS

Lazy Loading

Image Compression

WebP Images

Minimal HTTP Requests

Database Optimization

Fast API Response

====================================================

SECURITY

====================================================

Secure Login

Password Encryption

Authentication

Authorization

Role Based Access

Owner

User

Customer

Input Validation

CSRF Protection

XSS Protection

SQL Injection Protection

====================================================

SEO

====================================================

SEO Friendly URL

Meta Title

Meta Description

Open Graph

Twitter Card

Structured Data

robots.txt

sitemap.xml

====================================================

FUTURE READY

====================================================

The architecture must be modular so future features can be added easily without rebuilding the system.

Examples:

Custom Domain

Courier API

SMS Gateway

Facebook Pixel

Google Analytics

Invoice

Coupon

Wishlist

Reviews

Blog

Multi Language

Payment Gateway

====================================================

FINAL GOAL

====================================================

The final platform must feel like a premium SaaS product.

It should be extremely lightweight, mobile-first, fast, professional, secure, and easy to use.

Business owners should be able to manage their online store without technical knowledge.

Customers should be able to:

Open the store

↓

View products

↓

Open product details

↓

Click Buy Now or Add To Cart

↓

Complete Checkout

↓

Place Order

All within the fewest possible steps, ensuring the highest conversion rate and the best user experience.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://orzen-commerce.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cc864739-d278-4d7a-add6-132c065ab560).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
