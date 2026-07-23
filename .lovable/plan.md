## Plan: AI Product Builder stuck at final step

### What I found
- The AI Gateway calls are succeeding, not failing. Recent calls returned `200` with `openai/gpt-5.5` and took about 23–30 seconds.
- The UI is stuck on the final simulated progress stage (`Optimizing SEO…`) because it only advances when the server function fully returns.
- Since the model call succeeds, the likely hang/failure is happening after AI generation, in post-processing such as category lookup, duplicate detection, or converting the generated draft into the product edit form.
- There is also a known save-path issue in `upsertProduct`: new products send `total_sold: null` even though the database column is not-null, so generated products can still fail when saved.

### Fixes I will make
1. **Make AI generation complete reliably**
   - Add clear timing/error handling around the server-side AI Builder flow.
   - Ensure post-AI steps cannot silently leave the UI stuck.
   - Return a clean user-facing error if category matching or duplicate detection fails.

2. **Harden duplicate detection**
   - Keep the same-store duplicate check.
   - Make the name/slug query safer so generated product names with special characters cannot break the query.
   - Do not block generation because of a non-critical lookup error unless a real duplicate is found.

3. **Fix product save defaults**
   - Update the product save path so new products always insert `total_sold: 0`, not `null`.
   - This prevents AI-generated products from failing after preview when the user saves them.

4. **Improve mobile progress UX**
   - Replace the fake “final stage forever” behavior with a clearer state like “Finalizing product…” while waiting.
   - Show the actual error message inside the AI Builder dialog, not only as a toast, so mobile users can see why it failed.

5. **Verify**
   - Check that the AI Gateway request is still successful.
   - Verify the dialog moves from progress to the real Product Add/Edit form.
   - Verify saving the generated product no longer hits the `total_sold` not-null error.