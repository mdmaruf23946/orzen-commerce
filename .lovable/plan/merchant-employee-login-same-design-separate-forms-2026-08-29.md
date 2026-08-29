# Merchant ↔ Employee login: same design, separate forms

## Goal
Both login pages look and behave the same way, but keep their own form and their own rules. Users can switch between them with one click.

## What changes

### 1. Merchant login page (`/auth`)
- Add a clear button under the sign-in form: "Employee login" (with a small staff icon).
- Clicking it opens the Employee login page.
- The existing "New here? Create your store" link stays.
- Merchant rules stay the same: employee accounts are signed out and told to use the Employee page.

### 2. Employee login page (`/employee-login`)
- Rebuild the page using exactly the same card layout, brand mark, heading style, field spacing, and button style as the merchant page, so both feel like one system.
- Fields stay: work email + password (employee-only rules unchanged).
- Add a button "Merchant login" that takes the user to `/auth`.
- Keep the existing messages: inactive employee warning, and merchant-account rejection.

### 3. Shared look
- Same card width, same rounded card, same background, same input/label components, same submit button height and loading text ("Please wait…").
- The only visible differences: page title ("Sign in to your store" vs "Employee login"), the field label wording, and the switch button at the bottom.

## Technical notes
- `src/routes/employee-login.tsx`: restructure JSX to mirror `src/routes/auth.tsx` (BrandMark header, `Field` layout, full-width submit, bottom switch link). Logic (`employeeSessionInfo`, sign-out on merchant account, redirect to `/admin`) unchanged.
- `src/routes/auth.tsx`: add a bottom switch link to `/employee-login` (shown in sign-in mode).
- No database or server-function changes; no changes to the existing separation guards.
