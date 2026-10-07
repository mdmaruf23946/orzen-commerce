# Merchant Panel account footer and Profile page

## Goal
Replace only the Merchant Panel sidebar’s bottom Logout action with a compact account area, while keeping the rest of the sidebar and existing features unchanged.

## Sidebar footer
- Keep the existing Owner Panel shortcut unchanged when it applies.
- Add a compact first row with **Billing** and **Help Center** links.
  - Billing opens the existing `/admin/billing` area.
  - Help Center opens the existing `/admin/support` page.
- Add a second clickable row showing the signed-in user’s circular avatar or initials, name, and email.
- Clicking the account row opens the new `/admin/profile` page.
- Remove the direct Logout button from the sidebar footer.
- Preserve compact/collapsed desktop behavior and the current mobile drawer layout.
- Leave the existing main sidebar groups and links untouched.

## Profile page
- Add an authenticated Profile page with its own page title and social metadata.
- Show the current signed-in account’s name, email, avatar, account type, account ID/basic account details, and email verification state.
- Provide Profile Settings for updating the display name and profile picture; keep the login email read-only in this first version.
- Add a clearly marked KYC/account verification placeholder without introducing a fake verification status or workflow.
- Structure the page into focused sections so future KYC, API/access-token management, security, personalization, and other account-level settings can be added cleanly.
- Place Logout inside the Profile page’s account actions, with the same owner/employee sign-out destination currently used by the sidebar.
- Link existing account security settings from the profile page rather than duplicating security controls.

## Data and access behavior
- Use the current authenticated account metadata for name, email, and avatar; do not create a duplicate merchant-profile database table for this initial page.
- Treat Profile as the signed-in person’s own account page, available to both store owners and employees without exposing another user’s data.
- Use the existing protected store asset upload flow for avatars and update only the current account’s metadata.
- If name metadata is absent, fall back to the employee name or the email prefix so the footer always remains usable.

## Verification
- Check owner and employee footer rendering, mobile and collapsed sidebar states, Billing and Help Center navigation, profile edits, avatar fallback, and Logout redirection.
- Confirm the new Profile route is protected and does not expose account data while signed out.
- Run the project type check, inspect the latest build/runtime logs, and verify the central flow in the browser preview.
- This work will remain in preview unless a separate request is made to deploy it to `orzen.top`.
