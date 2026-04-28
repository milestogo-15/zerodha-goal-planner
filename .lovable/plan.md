## Add unaffiliated disclaimer to footer

Add a short disclaimer line at the top of the existing footer in `src/routes/__root.tsx` (inside `SiteFooter`) clarifying this is an independent project and not affiliated with Zerodha AMC / Zerodha Fund House.

### Change

In `src/routes/__root.tsx`, prepend a styled note above the existing "Educational tool" text:

```tsx
<p className="mb-3 rounded-md border border-border/60 bg-background px-3 py-2 text-[11px] font-medium text-foreground/80">
  Note: This is an independent personal project for educational purposes. It is not affiliated with, endorsed by, or associated with Zerodha Fund House / Zerodha AMC.
</p>
```

No other files affected.