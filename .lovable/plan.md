Reorganize Store Admin Sidebar Navigation

### Goal
Reorder the Store Admin sidebar to match the exact priority requested by the user, keeping all existing functionality, icons, active highlighting, and mobile responsiveness intact.

### Changes
1. Update `src/routes/_authenticated/admin/route.tsx`:
   - Reorder the `links` array to this exact sequence:
     1. Dashboard (`LayoutDashboard`)
     2. Orders (`ShoppingBag`)
     3. Products (`Package`)
     4. Categories (`Tags`)
     5. Inventory (`Boxes`)
     6. Customers (`Users`)
     7. Customer Accounts (`Users`)
     8. Duplicate Protection (`ShieldCheck`)
     9. Returns (`RotateCcw`)
     10. Coupons (`Ticket`)
     11. Finance (`Wallet`)
     12. Analytics (`BarChart3`)
     13. Marketing (`Megaphone`)
     14. Banners (`ImageIcon`)
     15. Theme (`Palette`)
     16. SEO (`SearchIcon`)
     17. Delivery (`PackageOpen`)
     18. Couriers (`Truck`)
     19. Payment Gateway (`CreditCard`)
     20. Payments (`Wallet`)
     21. AI Sales Agent (`Bot`)
     22. Messenger (`MessageSquare`)
     23. Notifications (`Bell`)
     24. Product Defaults (`ClipboardList`)
     25. Domains (`Globe`)
     26. DNS Checker (`Radar`)
     27. Import / Export (`FileUp`)
     28. Subscription (`CreditCard`)
     29. Billing & Plans (`Wallet`)
     30. Store Settings (`Settings`)
   - Leave the "Owner Panel" conditional link and the "Logout" button exactly where they are (bottom of the nav), as the current layout already places them after the main links.
   - Keep the existing `activeOptions`, `activeProps`, and `hover:bg-muted` classes unchanged.

### Verification
- Run a typecheck to confirm no import or icon issues remain.
- Optionally inspect the preview to confirm the new order and active highlighting.

### No-Change Areas
- No other files need changes.
- No backend, schema, or route changes.
- Sidebar mobile behavior, sticky ad, and bottom padding already in place will remain untouched.