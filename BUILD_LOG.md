# Build log: how FINN was built with AI tools

I built FINN with Claude (chat) as a pair programmer. It proposed designs and wrote most of the first-draft code; I made the product and architecture decisions, created and ran everything locally, tested on my laptop and phone, and reported every error back until it worked.

## How I worked with the model
- **Understand before building.** I had it explain the brief in plain terms first, then asked it to justify each tool choice (why a cloud database rather than a local one, how the stack compares with the MERN stack I'd used before) before committing to it.
- **Small steps, each verified.** Work was split into eight steps. Each ended with a concrete check (a probe script, a SQL query, a screenshot), and nothing moved on until that check passed.
- **Real output, not descriptions.** I pasted raw terminal output, errors and screenshots back rather than summarising them, so fixes were based on what actually happened.
- **Trust, but check.** I spot-checked numbers and behaviour myself, and added an automated accuracy check against a second source.

## How the work was broken down
1. Foundation: schema, synthetic network, and a day-1 probe of every data source before building on any of them
2. Data collection: NSE filings, Yahoo prices, a price-signals view
3. AI triage: free rules first, then batched cheap-model labelling, then PDF extraction only for results and management changes
4. App: Today feed and alert rules
5. Research: promised vs delivered
6. Network woven into cards
7. Deploy and scheduled refresh
8. Accuracy check and write-up

## Where things went wrong, and how they were fixed
| Problem | How it surfaced | Fix |
|---|---|---|
| BSE blocks scripted access (403) | Day-1 probe | Built on NSE only; noted as a limitation |
| screener parser found 0 annual reports | Probe output | Dumped the page structure, fixed the selectors |
| Gemini 2.5 models retired for new users; 4-series "Argon" not on the free tier (429) | Probe | Listed available models; each tier became an ordered fallback list. I considered picking models automatically at runtime and decided against it: the list includes experimental models, and "listed" doesn't mean "available" |
| Importance too generous (a VP appointment and a rating withdrawal marked "must see") | Reviewing the first results | Importance for management changes moved into code (by job title); stricter prompt with examples |
| A run hit hundreds of 429 errors | Extraction output | Separated per-minute from per-day quotas; retries now wait as long as Google asks, skip exhausted models, and postpone instead of failing; PDFs trimmed to the first pages |
| Titan PAT +113% YoY looked wrong | My spot-check | Added exceptional-items extraction and a "large swing" flag; the accuracy check later confirmed the number was real |
| TypeScript errors in the data layer | Build | Fixed imports and a query string the type system couldn't read |
| Research suggestion chips disappeared | Noticed on laptop and phone | A failing request was being silently swallowed; rewrote the page with error logging |
| Phone showed "network error" and no data | Testing on my phone | Some Indian ISPs block `*.supabase.co`; all browser traffic now goes through the app's own domain. Research also keeps running if the phone disconnects |
| A partial symbol (POLYC) failed | Phone test | Type-ahead over all NSE-listed symbols |
| `schema.sql` in the repo was incomplete | Final review of the repo against the brief | Rebuilt the full schema with every table and privacy rule |

## Decisions I drove
- **A mainstream, robust stack** rather than the most minimal one, while keeping scope to a few workflows done well.
- **Code does arithmetic, models only read.** Every computed number comes from code; the model copies figures and judges management against them.
- **Every number checked against a second source:** 25/25 non-financial figures match screener.in within 1%.