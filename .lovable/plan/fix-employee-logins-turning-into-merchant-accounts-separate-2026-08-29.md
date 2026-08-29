# Fix employee logins turning into merchant accounts + separate login systems

## What is happening now (verified)

- The employee `orzen70@gmail.com` exists correctly in the team table (active, linked to the store `abdullah`).
- Two minutes after that employee was created, a **separate store** ("Orzen70's Store", slug `orzen70`) was created in the database, owned by the employee's own login. That is the extra Merchant Panel you saw.
- Reason: the merchant login page (`/auth`) accepts any account, and the "get my store" logic used to auto-create a store when the signed-in user had no store of their own. A guard was added later, but nothing stops an employee from signing in through the merchant page, and nothing at the database level prevents a staff account from owning a store.

## What will be done

### 1. Clean up the wrongly created merchant account
- Delete the stray store `orzen70` (and its seeded child rows) so the employee is only an employee again.
- Verify no other store is owned by a user who is also listed as staff.

### 2. Hard separation of the two login systems
- **Merchant login (`/auth`)**: after a successful sign-in, ask the server who this account is. If it is an employee (staff record exists), sign the user out immediately and show: "This is an employee account. Please use the Employee Login page." with a link to `/employee-login`. No store is ever created for such an account.
- **Employee login (`/employee-login`)**: keep the existing check but make it symmetric — if the account is a store owner (not staff), sign out and show: "This is a merchant account. Please use the Merchant Login page." with a link to `/auth`.
- **Signup (`/auth` → create store)**: refuse signup for an email that already exists as an employee.

### 3. Prevent it from ever happening again
- Server side: store auto-creation is refused for any account that has a staff record in any state (active, disabled, pending), not only active ones.
- Database side: a trigger on the stores table blocks inserting a store whose owner is an existing staff account, so no code path can recreate this problem.
- After login, employees land in the Merchant Panel of **their employer's store** with their assigned permissions (existing behaviour, unchanged), and the forced password change on first login stays.

## Technical notes

- New/updated server function returning account kind (`owner` | `employee` | `none`) used by both login pages before navigating.
- `src/routes/auth.tsx`: post-sign-in kind check + sign-out + toast; signup guard.
- `src/routes/employee-login.tsx`: owner rejection message + link.
- `src/lib/admin.functions.ts` (`getMyStore`): staff lookup without the `status = active` filter before any insert.
- Migration: cleanup of the stray store, plus `BEFORE INSERT` trigger on `public.stores` raising an error when `owner_user_id` exists in `public.store_staff`.
