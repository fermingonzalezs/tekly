---
target: landing page (app/marketing)
total_score: 19
max_score: 24
na_heuristics: 5,7,9,10
p0_count: 0
p1_count: 2
target_identity: "file:/Users/test/proyectos/tekly/app/marketing/page.tsx"
target_fingerprint: "sha256:312530b00a466cec663dd64891f55d9f7d679b9ce2bf18f9217f22731a96470f"
target_path: /Users/test/proyectos/tekly/app/marketing/page.tsx
timestamp: 2026-09-30T18-24-21Z
slug: app-marketing-page-tsx
---
Method: dual-agent (A: design-review agent · B: technical-audit agent)

## Audit Health Score (technical)

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | Single h1, clean landmarks, thorough `prefers-reduced-motion` coverage — but CTA-final gradient text fails AA contrast |
| 2 | Performance | 3 | No raster images at all (pure CSS/SVG mockup), transform-only animations — but ~15 concurrent infinite-loop tweens (`AmbientBlobs` × 6 sections) is an unbounded, compounding pattern |
| 3 | Responsive Design | 3 | Solid `sm/md/lg/xl` breakpoint discipline, but CTA/nav buttons run 28–40px tall, under the 44px comfortable tap-target guidance |
| 4 | Theming | 4 | `data-tema="violeta"` override on the marketing wrapper resolves correctly against `app/globals.css`'s bare `[data-tema]` selectors — verified via rendered HTML, no contrast regression |
| 5 | Implementation Integrity | 4 | Detector clean (`impeccable detect` → 0 findings); source is product-specific throughout, no boilerplate |
| **Total** | | **17/20** | **Good** (address weak dimensions) |

**Implementation Integrity verdict: PASS.** Feature copy maps 1:1 to the app's real 6 migrated sections (IMEI tracking, pago dividido, conciliación, checklist ingreso/egreso); the trust strip explicitly rejects fabricated client logos in favor of real product facts; pricing is transparent about being provisional instead of presenting fake numbers as final.

## Design Health Score (heuristics)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Nav bg/blur reacts to scroll; no active-section indicator |
| 2 | Match Between System and Real World | 4 | Concrete domain vocabulary throughout, zero CRM jargon |
| 3 | User Control and Freedom | 3 | Anchor nav + back button is sufficient, nothing traps the user |
| 4 | Consistency and Standards | 3 | `MarketingButton` mirrors the app `Button`; CTA label wording drifts once |
| 5 | Error Prevention | n/a | No forms/inputs on this static page |
| 6 | Recognition Rather Than Recall | 4 | Icons always labeled, CTA repeated at every scroll depth |
| 7 | Flexibility and Efficiency | n/a | Persuade-mode surface |
| 8 | Aesthetic and Minimalist Design | 2 | `AmbientBlobs` in 5–6 of 7 sections; hero's proof cards repeated near-verbatim in showcase |
| 9 | Error Recovery | n/a | No error-prone interaction exists on this page |
| 10 | Help and Documentation | n/a | Persuade-mode surface |
| **Total** | | **19/24** | **Good (79%)** |

## Design Specificity Verdict

**Authored for this product, not template-interchangeable.** Copy is concrete to iPhone repair/resale: "Dejá de anotar tu stock en tres lugares distintos," IMEI-tracked equipos, canje de equipos, checklist de ingreso/egreso. The dashboard mockup shows real domain rows ("iPhone 14 Pro · U$ 985," "Cambio de batería · U$ 39"), not Lorem/Acme filler. The trust strip's choice to show product facts instead of fake client logos, and pricing's honest "se confirman antes del lanzamiento" disclaimer, are both unusually candid for a pre-launch product — verified as deliberate via in-code comments, not accidental omissions.

Where it slips toward generic-SaaS shape: the page skeleton (hero → trust strip → features → 4-step onboarding → showcase → pricing → gradient CTA → footer) is the default landing template verbatim, and the three pricing tiers differentiate only by user-count/support with "Todas las funciones del sistema" repeated on all three — an interchangeable pricing-ladder pattern that isn't derived from this product's actual usage tiers.

**Deterministic scan:** `impeccable detect --json app/marketing components/marketing` → 0 findings, exit 0. No browser/screenshot tooling was available in this environment, so no visual overlay was generated — this assessment is based on detector output plus close reading of source (className-level layout/color/type), not a rendered screenshot.

## Overall Impression

This is a well-crafted, domain-authentic landing with real engineering care (the reduced-motion handling is genuinely rigorous, not a checkbox). It undersells itself in the middle third: showcase re-runs hero's exact proof beats instead of escalating, and the ambient-blob treatment is applied so uniformly across sections that it stops reading as a deliberate brand signature. The biggest opportunity is tightening that middle stretch and making the closing CTA's gradient text actually legible — right now the strongest visual moment (the close) is also the page's one real accessibility failure.

## What's Working

- **Domain-authentic copy and mockup data** instead of generic SaaS filler — IMEI, canje, checklist ingreso/egreso all map to real product features.
- **Honest pre-launch signaling**: real product facts instead of fake client logos, and a visible "pricing not final" disclaimer instead of presenting placeholder numbers as real.
- **Reduced-motion handling is systemic, not spotty**: every animated component (`Reveal`, `RevealStagger`, `AnimatedWords`, `AmbientBlobs`, both scroll-linked parallax hooks) routes through `useReducedMotionSafe` and renders a fully-visible static equivalent — confirmed by direct inspection, this holds up everywhere, not just in the one place CLAUDE.md calls out.

## Priority Issues

**[P1] CTA-final gradient text fails contrast** — `components/marketing/cta-final.tsx:46,60`. `text-white/80` body copy and `text-white/70` fine print sit over `linear-gradient(135deg,var(--chart-1),var(--chart-2),var(--chart-3))`; against the lightest stop, computed contrast is ≈3.0:1 and ≈2.6:1 — both fail WCAG 1.4.3 (needs 4.5:1). This is the page's intended emotional peak and its one real accessibility failure. Fix: full-opacity white, or darken the gradient's lightest stop. → `/impeccable harden`

**[P1] The middle of the page repeats itself** — Hero's three floating proof cards (Venta confirmada / Turno agendado / Ticket #128) reappear almost unchanged in `showcase.tsx`, and `AmbientBlobs` (infinite-loop, transform-driven) is instantiated in hero, features, how-it-works, showcase, pricing, and cta-final — 6 of 7 sections. Two independent reviews flagged this from different angles: aesthetic dilution (nothing escalates) and performance (an unbounded, compounding animation pattern with no off-screen pause). Fix: give showcase a different proof moment (e.g. analytics/cohorts), and reserve `AmbientBlobs` for hero + cta-final so the closing glow reads as a deliberate beat. → `/impeccable distill`, then `/impeccable quieter`

**[P2] Primary conversion CTAs sit under comfortable tap-target size** — `components/marketing/ui/marketing-button.tsx:35` (`size="md"` → `h-9`, 36px) is the "Probar gratis"/"Empezá gratis" button everywhere it appears (hero, pricing, footer, mobile drawer) — the single highest-value action on the page. Nav pills run ~28px and the mobile hamburger is 40px. All under 44px. One shared component, one fix resolves every instance. → `/impeccable polish`

**[P2] Pricing tiers don't differentiate on value, at the worst point in the journey** — `pricing.tsx:23-49`: all three cards lead with the identical line "Todas las funciones del sistema"; the real differentiator (users/support) is buried third. This sits immediately before the closing CTA and right after the "precios de referencia, no confirmados" disclaimer — stacking two doubt-inducing moments right before the intended peak. Fix: lead each card with what's actually different. → `/impeccable clarify`

**[P3] Nav/footer plain `<a>` links lack a branded focus state** — `nav.tsx` (`LINKS.map`), `footer.tsx`. Note: this is a **consistency gap, not a WCAG failure** — the browser's default focus outline is still present (an initial read flagged this as an accessibility miss; closer inspection shows keyboard users aren't stranded, it's just visually inconsistent with `MarketingButton`'s explicit `focus-visible:ring-2 ring-accent/40`). → `/impeccable polish`

**[P3] Small inconsistencies**: CTA copy drifts once ("Probar gratis" vs. "Empezá gratis" in `cta-final.tsx:56`); logo links in `nav.tsx:35` and `footer.tsx:13` use dead `href="#"` instead of `/`. → `/impeccable polish`

## Persona Red Flags

**Jordan (first-timer)**: No reassurance near "Probar gratis" about trial length or whether a card is required. Domain terms ("canje," "conciliación contra lo contado") get no inline gloss — fine for a shop-owner audience that already knows the vocabulary, but worth confirming that's really who lands here cold from search/ads.

**Riley (stress tester)**: Tabbing through the top nav gives no visible custom focus state (default browser outline only — see P3 above). Logo anchors resolve to `href="#"` instead of the actual home route, which is harmless here but would misbehave if the logo is ever reused off the anchor-heavy single page.

**Casey (mobile)**: Nav and CTA buttons (28–40px) sit under the comfortable one-thumb tap zone. Hero is `min-h-screen`, so Casey scrolls a full viewport before any proof appears. Three concurrent `useScroll`/`useTransform` parallax transforms in the hero, plus more in showcase, add continuous JS work — currently transform-only and GPU-safe, but on a mid-range phone with 6 sections of infinite blob animation running simultaneously, this is the pattern most likely to show up as jank first.

## Patterns & Systemic Issues

- **Button height recurs everywhere by design, not accident**: every CTA on the page shares `MarketingButton`'s single `size="md"` default, so the touch-target issue is a one-line fix (bump the default, or add a `size="lg"` for primary-conversion contexts) rather than a per-instance patch.
- **`AmbientBlobs` scale is heading toward "reused everywhere by default"**: 6 of 7 sections already use it; a 7th section copying the pattern adds 2-3 more forever-running tweens with no visibility culling. Worth capping intentionally now, before it becomes the landing's default background treatment by inertia.
- **No raster images anywhere on the page** (the dashboard mockup is pure div/SVG) — this eliminates an entire class of alt-text/lazy-loading findings by construction; genuinely good.

## Minor Observations

- Pricing shows bare `$14.990` / `$24.990` / `$39.990` with no currency code — the rest of the product strictly formats USD via `fmtUsd` (`U$ 48.250`), so a visitor unfamiliar with Argentine pricing conventions can't tell if this is pesos or dollars.
- `text-neutral-400` inside `MockupDashboard` sits under `aria-hidden="true"`, so it's not a real WCAG violation, but it's the same low-contrast tone CLAUDE.md flags for real UI text — worth a pass if the mockup is ever made non-decorative.
- "list@" in the how-it-works copy is the page's one inclusive-language touch.

## Questions to Consider

- Does showing three priced tiers with a "Más elegido" badge for a product with no real billing yet risk more distrust than simply stating "pricing coming soon"?
- If showcase told a genuinely different story than hero (not the same three proof cards), would the middle of the page stop feeling like a rerun?
- With ambient blobs on 6 of 7 sections, is the motion signaling brand identity, or just filling silence by default?
