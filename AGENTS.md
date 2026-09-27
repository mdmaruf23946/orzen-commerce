<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Conversational checkout uses server-issued, hashed, single-use, two-hour sessions; this isolates customers and keeps payment credentials outside chat.
- All HTML responses use `Cache-Control: no-store, must-revalidate` so deployed Merchant Panel changes replace stale browser/CDN shells immediately.
