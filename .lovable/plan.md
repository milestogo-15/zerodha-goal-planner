# Goal-Based Investment Planner — Full Zerodha Fund House Suite

A single-page web app that recommends Zerodha Fund House products tailored to each financial goal, picks the right preset based on goal type + horizon, projects growth, and tracks overall SIP health vs. monthly income. Local-only (browser) persistence — no login.

## Fund Universe (all 17 funds from Feb '26 Factsheet)

**Equity — Index Funds**
- Zerodha Nifty 50 Index Fund (large cap, ~12% assumed CAGR)
- Zerodha BSE SENSEX Index Fund (large cap alternative)
- Zerodha Nifty LargeMidcap 250 Index Fund (broad equity, ~13%)
- Zerodha ELSS Tax Saver Nifty LargeMidcap 250 Index Fund (tax-saving, 3y lock-in)

**Equity — ETFs**
- NIFTYCASE — Nifty 50 ETF
- MID150CASE — Nifty Midcap 150 ETF
- SMALLCASE — Nifty Smallcap 250 ETF (~14%)
- GROWWN50 (or equivalent broad equity ETF in factsheet)

**Debt / Liquid**
- LIQUIDCASE — Nifty 1D Rate Liquid ETF (~6%)
- Zerodha Overnight Fund (~6%)
- Zerodha Nifty G-Sec Dec 2026 Index Fund (short-duration G-Sec, ~7%)
- Zerodha Nifty G-Sec Dec 2030 Index Fund (medium-duration G-Sec, ~7.5%)
- Zerodha Long Duration G-Sec (if present in factsheet)

**Commodities**
- GOLDCASE — Gold ETF (~8%)
- SILVERCASE — Silver ETF (~9%, higher vol)

**Hybrid / Multi-Asset**
- Zerodha Multi Asset Passive FoF (~10%)
- Zerodha Gold + Silver passive option (if present)

> The exact 17-fund roster is auto-derived from the Feb '26 factsheet — names/expense ratios are pulled in as displayed there.

## Goal-Type Presets

Instead of horizon-only allocation, the user picks a **goal type** which loads a tailored allocation. They can then tweak.

| Goal Type | Suggested Horizon | Allocation |
|---|---|---|
| **Emergency Fund** | <1y | 100% LIQUIDCASE |
| **Short-Term Parking** | <3y | 90% LIQUIDCASE, 10% GOLDCASE |
| **Tax Saving (80C)** | 3y+ lock-in | 100% ELSS LargeMidcap 250 |
| **Car / Down Payment** | 3–5y | 30% Nifty 50, 50% LIQUIDCASE, 10% GOLDCASE, 10% G-Sec 2030 |
| **House Purchase** | 5–7y | 40% Nifty 50, 20% LargeMidcap 250, 20% G-Sec 2030, 10% GOLDCASE, 10% LIQUIDCASE |
| **Child Education** | 7–15y | 50% LargeMidcap 250, 20% Nifty 50, 10% Multi-Asset FoF, 10% GOLDCASE, 10% G-Sec |
| **Retirement** | >15y | 55% LargeMidcap 250, 20% Nifty 50, 10% SMALLCASE, 10% GOLDCASE, 5% SILVERCASE |
| **Wealth Creation** | >7y | 70% LargeMidcap 250, 20% Nifty 50, 10% GOLDCASE |
| **Custom** | any | User builds allocation from full fund list |

**Large-cap toggle** (global setting): switch the large-cap sleeve between Nifty 50 Index Fund and BSE SENSEX Index Fund — applies across all presets.

## Features

### 1. Multi-Goal Dashboard
- Cards for each goal: name, target ₹, years, monthly SIP, on-track indicator, goal-type icon
- Add / edit / delete goals
- Sort by priority or deadline

### 2. Goal Form
- Goal name, goal type (preset selector with descriptions), target amount, years to goal, monthly SIP
- Live preview of allocation as user types
- "Calculate required SIP" helper — solves for the SIP needed to hit target at blended CAGR

### 3. Allocation Breakdown (per goal)
- Donut chart of fund split
- Table: fund name, % allocation, monthly ₹, expense ratio, "Invest on Coin" deep link
- Editable % sliders (Custom mode) with auto-rebalance to 100%

### 4. Growth Projection
- Recharts line chart: invested vs. projected corpus over goal horizon
- Blended CAGR shown (weighted across the allocation)
- Target line overlaid; surplus/shortfall callout
- Toggle: optimistic / base / pessimistic scenarios (±2% CAGR)

### 5. SIP Health Check (global)
- Monthly Income input (saved locally)
- Total SIP across all goals as % of income
- Status: Healthy (<30%), Stretched (30–50%), Over-allocated (>50%)
- Per-goal contribution bar

### 6. Fund Library page
- Browse all 17 funds with category filters (Equity / Debt / Gold / Hybrid)
- Expense ratio, assumed CAGR, brief description, Coin link

## UX & Visual Design
- Light theme inspired by uploaded screenshot
- Zerodha-style accent (teal `#00a991`), neutral grays, generous whitespace
- Responsive: mobile-first cards stack vertically; desktop uses 2–3 column grid
- Empty state: friendly prompt to add first goal with example chips ("Retirement", "Buy a car", "Tax saving")

## Pages / Routes
- `/` — Dashboard (goals list + SIP health)
- `/goals/new` — Add goal wizard
- `/goals/$goalId` — Goal detail (allocation, growth chart, edit)
- `/funds` — Fund library
- `/about` — How allocations are calculated, CAGR assumptions, disclaimer

## Persistence
- All goals, monthly income, and large-cap preference stored in `localStorage`
- Export / import JSON for backup

## Disclaimers
- Clear footer: "Educational tool only. Not investment advice. Past performance does not guarantee future returns. Verify all fund details on zerodhafundhouse.com before investing."

---

Approve to build, or tell me what to adjust (presets, fund inclusions, design, scope).