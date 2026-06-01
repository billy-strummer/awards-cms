# British Trade Awards — Public Website Design Brief

## Brand Colours
- **Primary background**: `#0a0a0a` (near-black)
- **Gold accent**: `#C9A227` (warm prestige gold)
- **Text on dark**: `#ffffff`
- **Muted text**: `#999999`
- **Section divider / subtle**: `#1a1a1a`

## Logo Versions
| File | Usage |
|---|---|
| `logo-black.png` | Light backgrounds, header after scroll (light theme) |
| `logo-gold-black.png` | Dark backgrounds, header frosted glass state |
| `logo-white.png` | Over hero video, transparent header state |

> Drop logo files into `/public/` or root and rename to match above.

## Typography
- **H1 / H2**: Playfair Display Bold/Black (Google Fonts)
- **Body / UI**: Inter Regular 400 / SemiBold 600 (Google Fonts)
- **Minimum body**: 16px
- **H3 minimum**: 20px, Inter SemiBold 600
- **Max 2 typefaces in any single communication**

## Page: `home.html`
Public-facing marketing homepage. Separate from the CMS (`index.html`).

### Sections (in order)

#### Header — Smart Sticky (Apple-style)
- **State 1** (top of page): 100% transparent, logo floats over hero video
- **State 2** (scrolling down): header slides up out of view
- **State 3** (scrolling up): header slides back down instantly
- **Sticky state**: frosted glass (`backdrop-filter: blur(20px)`) with semi-transparent dark bg
- Nav: Categories | Regions | Find a Trade | About
- CTA button: "ENTER" (changes to "VOTE" when voting open)

#### Section 1 — Hero
- Full-width 1920×1080 video (`hero-animation.mp4` / `.webm`)
- Fallback static image
- CTA: "Enter Now"
- Strapline: "Crowning the nation's finest trade professionals"
- Logo: white version over video

#### Section 2 — Feature Boxes (3-col grid, 2 rows)
- Row 1: Enter | Key Dates | Vote
- Row 2 (Sept+): Nominee Tools | Winners | Shop
- Each: icon/visual + short text + CTA box

#### Section 3 — Category Gallery (Bento, 4×2 grid)
- Heading: "Find your Category"
- 8 categories with hover descriptions and gradient overlay
- Categories: Building & Construction | Mechanical, Electrical & Plumbing | Carpentry & Joinery | Interior Fit-Out & Finishing | Outdoor & Landscaping | Energy, Tech & Sustainability | Specialist Trades | Industry Leadership
- Mobile: 2×4 grid or horizontal carousel

#### Section 4 — Regional Section
- Heading: "Find your County or City"
- 3 country boxes with flags (England, Scotland, Wales)
- Click flag → accordion: Country → Region → County/City → Categories → Nominees
- Mobile: dropdown/accordion only

#### Section 5 — Find a Trade
- Heading: "Find a Trade Professional"
- Two inputs: County/City autocomplete + Trade Category dropdown
- Geolocation "Use my location" button
- Results: list of winners and nominees

#### Section 6 — Footer (placeholder)
- Privacy Policy | T&Cs | Contact Us
- Social: LinkedIn | Instagram | Facebook | X
- © 2026 British Trade Awards
- Company reg / address: **PLACEHOLDER — to be updated**
- Sitemap | Cookie Policy

## Animation
- File: `hero-animation.mp4` (+ `.webm` for modern browsers)
- Place in root or `/public/`
- Highly compressed; fallback static image required

## Interaction Notes
- Apple-style scroll behaviour (see Header above)
- Bento boxes: CSS Grid
- Regional accordion: vanilla JS
- Find a Trade: autocomplete against regions data from CMS API
- Geolocation: browser `navigator.geolocation` API
