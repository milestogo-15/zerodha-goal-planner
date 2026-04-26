import { Link, Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import logoUrl from "@/assets/logo.avif";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Goal-Based Investing Planner — Zerodha Fund House" },
      {
        name: "description",
        content:
          "Plan your financial goals with Zerodha Fund House. Get tailored allocations across 17 funds, project growth, and check your SIP health.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Goal-Based Investing Planner — Zerodha Fund House" },
      {
        property: "og:description",
        content:
          "Plan, allocate, and project your goals using Zerodha's index funds, ETFs and FoFs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Goal-Based Investing Planner — Zerodha Fund House" },
      { name: "description", content: "Goal Tracker" },
      { property: "og:description", content: "Goal Tracker" },
      { name: "twitter:description", content: "Goal Tracker" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/642aed85-b794-4b9f-9473-ee2798150382" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/642aed85-b794-4b9f-9473-ee2798150382" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center">
          <img
            src={logoUrl}
            alt="Zerodha Fund House"
            className="h-12 w-auto object-contain md:h-14"
          />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium md:gap-4">
          <Link
            to="/funds"
            className="rounded-md px-2.5 py-1.5 text-foreground/75 transition hover:text-foreground md:px-3"
            activeProps={{ className: "text-foreground" }}
          >
            Funds
          </Link>
          <Link
            to="/about"
            className="rounded-md px-2.5 py-1.5 text-foreground/75 transition hover:text-foreground md:px-3"
            activeProps={{ className: "text-foreground" }}
          >
            How it works
          </Link>
          <a
            href="https://www.zerodhafundhouse.com/"
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex items-center rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition hover:opacity-90 md:px-4 md:text-sm"
          >
            Invest
          </a>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 text-xs leading-relaxed text-muted-foreground md:px-6">
        <p className="font-semibold text-foreground/80">Educational tool — not investment advice.</p>
        <p className="mt-1">
          Allocations and projections use historical-average return assumptions and are
          illustrative only. Mutual fund investments are subject to market risks. Read all scheme
          documents carefully before investing. Verify fund details on{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href="https://www.zerodhafundhouse.com/"
            target="_blank"
            rel="noreferrer"
          >
            zerodhafundhouse.com
          </a>
          .
        </p>
      </div>
    </footer>
  );
}

function RootComponent() {
  return (
    <>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <Toaster richColors position="top-center" />
    </>
  );
}
