# ColCalc: personalized relocation platform

Planning baseline: 8 November 2026. Proposal, not an implementation commitment.

Implementation started: a local browser preview now includes the public landing page, relocation workspace, household profile, destination reports, explicit user budget overrides, general task tracking and browser print-to-PDF. Existing public tools remain reachable. This establishes the frontend workflow; authenticated backend persistence, reviewed immigration rules/fees, country-specific tasks, detailed sourced consumption baskets and durable generation remain outstanding. See README for routes and verification commands. No phase requiring reviewed legal coverage or cross-device persistence is complete.

## 1. Product direction

Make the primary product a maintained relocation plan for a household: where they can plausibly move, what it will cost, what remains uncertain, and what to do before and after arrival. Calculators become components inside that journey and remain useful public acquisition tools.

Core journey: create profile → shortlist destinations → compare viable routes and budgets → generate a sourced report → select a plan → execute and track tasks → refresh when circumstances or rules change.

The value proposition is personalized, explainable planning with maintained evidence. Avoid a promise of guaranteed visa eligibility or universally accurate legal advice. An immigration authority decides applications; the product can reliably show what its reviewed rules establish, which facts are missing, and when professional review is needed.

## 2. Initial scope and boundaries

Start with one destination country, two cities, and two or three reviewed immigration pathways for a specific customer segment. A candidate is remote workers and their households moving to Portugal; validate demand and engage a qualified local reviewer before committing. Portugal is a proposal, not an assumed launch decision. Citizenship and existing free-movement rights must be assessed before routing everyone into visas.

Define supported coverage as a matrix: destination × citizenship/residence × application location × pathway × household circumstances × move date. Supporting a country does not mean supporting every applicant or consulate. Clearly identify unsupported cases and provide useful cost planning without inventing immigration conclusions.

MVP includes profile, two destination scenarios, pathway assessment, recurring budget, move-in cash requirements, first-year estimate, arrival checklist, saved/versioned report, PDF export, and source/change visibility. Add comparison within the same profile.

Defer global immigration coverage, filing applications, passport/document storage, employer compliance services, complex cross-border tax advice, marketplace referrals, and automatic eligibility claims for exceptional cases. Validate willingness to pay before building complex subscriptions.

## 3. Profile and personalization

Use progressive onboarding. Collect information only when it affects an assessment, support unknown answers, and explain why a field matters.

| Profile area | Inputs and effect |
| --- | --- |
| Identity and current position | All citizenships, current country of residence and residence status, existing destination rights; determines whether a visa is required and where applications may be made. |
| Household | Applicant, partner, relationship/legal dependency, dependent ages, intended accompanying dates; determines independent/dependent routes, fees, schooling and housing. |
| Work and money | Employment/self-employment/retirement/study, employer location, income sources and currencies, gross/net status and frequency, savings, sponsorship and qualifications where relevant. |
| Destination and timing | Country/city shortlist, move window, expected duration, application location where known. |
| Living preferences | Bedrooms, location preference, furnished/temporary housing, transport, childcare/school type, healthcare needs expressed as budget preferences, dining, travel and lifestyle. |
| Priorities | Savings target, minimum cash buffer, budget ceiling and weighted preferences; makes ranking explainable. |

Separate shared household facts from person-specific legal facts and scenario-specific preferences. Represent unknown separately from false. Save profile versions so changing income cannot silently change an old report. Avoid collecting passport numbers or sensitive case history during ordinary onboarding; route complex cases to specialist review.

## 4. Report and execution experience

Each report should answer these questions in this order:

1. **Decision summary:** viable destinations/routes, estimated monthly surplus, cash needed to move, main blockers, missing answers and next actions. Show how priorities influenced comparisons; avoid opaque scores or visa approval probabilities.
2. **Your profile and assumptions:** household, employment, dates, currencies and user overrides used in this version.
3. **Immigration pathways:** criterion-by-criterion evidence, missing information, documents, application location, dependent rights, work restrictions, validity/renewal and authoritative links. Distinguish legal time limits from observed processing estimates.
4. **Fees and move-in cash:** per-person application/residence charges, service-provider charges, translations/legalization, travel, temporary accommodation, deposits, setup costs and contingency. Separate mandatory charges, optional services and estimates.
5. **Monthly living budget:** line items, quantities, unit prices, source dates and low/base/high scenarios. Explain household size, housing and childcare effects.
6. **Income and tax assumptions:** gross-to-net where supported, social contributions, coverage limits and tax year. Remote employment, destination work permission and tax residence are distinct questions. Unknown tax treatment must prevent a falsely precise net savings claim.
7. **Timeline:** before application, before departure, arrival, first 30/60/90 days and renewals. Tasks include responsible person, dependencies, documents, cost, deadline rule and official link.
8. **Evidence and updates:** sources, effective dates, last review, unsupported issues, version and what changed since the last report.

Generate a useful partial report when a section lacks coverage. Unknown costs are not zero. If a required component is unknown, label the total partial and explain the gap. Printable/exported reports retain assumptions, citations and version timestamps.

## 5. Legal knowledge and trust architecture

Build reviewed, effective-dated country packs, rather than asking an LLM to research immigration law afresh for each user.

Source order: legislation and regulations; responsible immigration/consular authorities and official fee schedules; official procedural guidance; authorized service providers for their own service charges. Secondary explainers can identify questions but cannot establish legal rules. Resolving conflicts requires documenting authority, jurisdiction, date and reviewer reasoning, not blindly preferring the newest web page.

Each rule/fee/task needs jurisdiction, route, applicant scope, application-location scope, source URL, pinpoint article/section or excerpt, original language, effective-from/to, publication/retrieval/review dates, reviewer, review deadline, status and superseded version. Preserve source snapshots where licensing permits and content hashes for change detection. Retrieval date is not the date a law took effect.

Rules evaluate deterministically into `appears_to_meet`, `does_not_meet`, `needs_information`, `requires_review`, or `unsupported`, with per-criterion reasons and evidence IDs. Encode numeric thresholds, income-source restrictions, dependent formulas, currency/date conventions, exemptions, rounding and transitional provisions explicitly. Every material conclusion and fee must resolve to evidence; an LLM cannot introduce new thresholds or determine eligibility.

Operational workflow: discover → capture → draft structured change → reviewer compares source and fixtures → approve → schedule effective release → identify impacted reports → flag refresh. Monitoring may draft changes but must never publish legal changes automatically. Separate monitoring frequency from review deadlines and define both by risk. A failed fetch or overdue review lowers coverage status; it does not silently extend validity. Provide a country/route kill switch.

For future move dates, distinguish rules currently effective, enacted future changes, and unknown future policy. Do not treat proposals as law. Keep existing reports immutable; mark affected reports outdated and offer a new version with a change summary.

An authorized content-review workflow is part of the MVP, even if initially a small internal screen plus reviewed version-controlled packs. Identify and fund the immigration reviewer before claiming reviewed coverage.

## 6. Cost and tax engine

The existing dataset is a useful exploratory baseline, not yet a sufficient premium budget source. Its import script pulls a third-party CSV and keeps only selected categories. Audit provenance, reuse rights, observation dates, coverage and update feasibility before reuse. Build time is not observation time.

Replace broad multipliers with an explicit household basket: housing by size/type/location; utilities; grocery quantities; transport by person/mode; healthcare/insurance; age-specific childcare/school; connectivity; dining; other recurring obligations; and user overrides. Do not infer neighborhood-level precision from city averages. Acquire licensed/reviewed data for the launch cities where existing coverage is inadequate.

For every line retain quantity/unit, native currency, price date, source, method and whether observed, derived or user-provided. Distinguish measured ranges from scenario assumptions; low/high scenarios are not statistical confidence intervals. A detailed result is only as strong as its underlying data.

Keep separate totals for recurring spending, nonrefundable relocation costs, refundable deposits, funds required as immigration evidence, and contingency. Do not count proof-of-funds as expenditure. Compute peak cash needs on a dated cash-flow timeline so the same savings can satisfy overlapping requirements when legally permitted without double counting. Define first-year cost separately from cash required and show refund assumptions.

Calculate each earner's income/tax separately before combining household net income. Treat the existing rel.tax integration as an estimate with explicit supported inputs, not a complete personalized tax system. Build adapters with tax-year and employment/residence limitations. Escalate unsupported treaty, split-year, pension or special-regime issues instead of filling gaps with a flat rate.

Use decimal/minor-unit arithmetic, explicit rounding, native-currency amounts and a versioned FX snapshot. Consolidate the duplicated cost functions in `src/api/costOfLiving.ts` and `src/components/Calculator/logic.ts` into one pure, tested engine. The authoritative report runs server-side; a shared, versioned package can support responsive browser previews.

## 7. SaaS UX and information architecture

Separate the public marketing experience from the signed-in workspace.

| Route | Purpose |
| --- | --- |
| `/` | Product promise, example report, supported coverage and primary “Build my relocation plan” action. |
| `/onboarding` | Progressive household profile and destination setup. |
| `/app` | Current plan, blockers, budget, next tasks and rule changes. |
| `/app/profile` | Household and circumstances, completeness and missing answers. |
| `/app/destinations` | Personalized shortlists and comparable scenarios. |
| `/app/plans/:id` | Scenario assumptions, budget and selected pathway. |
| `/app/reports/:id` | Report with readable sections, evidence drawer and export. |
| `/app/tasks` | Household relocation timeline and completion tracking. |
| `/app/settings` | Account, privacy, notifications and later billing. |

Use a cohesive design system: typography, spacing, accessible status badges, navigation, cards, tables and mobile behavior. Prioritize an editorial report layout and a clear next action over dense numeric inputs. Make sources discoverable beside claims; provide readable empty, unavailable, generating and stale states.

Keep existing calculator and SEO city/comparison routes reachable as acquisition tools. Offer “Personalize this destination” into onboarding. Private reports must be authenticated and excluded from sitemap/prerendering, analytics payloads and indexing; `noindex` is supplementary, not access control. Rework the current `Layout`/`Sidebar` and root route, and update build metadata for the new public pages.

The assistant becomes report-aware help. It explains existing evidence and proposes scenario edits. Persisted profile/task changes need validated, authenticated backend actions and explicit user intent. Migrate away from direct localStorage mutation for new domain objects.

## 8. Backend and data model

Retain React/Vite, Fastify, Prisma/Postgres and existing same-origin API proxy initially. There is no demonstrated need for a framework rewrite.

Add these domains in `../colcalc-be`:

| Domain | Main entities |
| --- | --- |
| Planning | Household, HouseholdMember, ProfileVersion, RelocationPlan, DestinationScenario. |
| Knowledge | CountryPackVersion, ImmigrationPathway, RuleVersion, FeeRule, TaskTemplate, SourceDocument, SourceRevision, ReviewEvent. |
| Estimates | PriceObservation, BudgetAssumption, FXSnapshot, TaxEstimateSnapshot, AssessmentResult. |
| Reports | Report, ReportVersion, GenerationJob, ReportArtifact, ReportSourceLink. |
| Execution | TaskInstance, TaskCompletion, ChangeImpact, NotificationPreference. |
| Commercial, later | Entitlement, Purchase/Subscription, PaymentWebhookEvent. |

Initially one user owns a household. Do not build collaboration before demand, but enforce ownership on every query and artifact request. Use stable UUIDs, schema validation and optimistic concurrency for plan/profile edits instead of extending calculator last-write-wins semantics to everything. Existing `Record` stays a legacy calculator object; explicit import creates a draft scenario with missing facts, not fabricated legal profiles.

Proposed `/api` contracts: household/profile CRUD; plan/scenario CRUD and comparison; pathway assessments; report generation/status/version retrieval/export; task updates; supported coverage; internal source/review/publish endpoints. Share a versioned contracts package or generated OpenAPI types between repositories; current record types are duplicated.

Generation pipeline: authorize and snapshot profile → select applicable reviewed rules → evaluate pathways → calculate budgets/fees/tasks → validate evidence completeness → produce structured report → optionally generate constrained narrative → render PDF → publish immutable version. Narrative failure should fall back to templates.

`POST /api/plans/:id/reports` returns `202` with a job ID. Use durable jobs outside the HTTP request lifecycle: the checked-in backend Vercel function limit is 10 seconds. Evaluate a managed durable job runner versus a dedicated worker in the architecture spike; do not rely on unawaited promises after returning a response. Keep worker deployment separate from API hosting if needed.

Use idempotency keys, input/rule/data version hashes, bounded retries, leases/heartbeat and resumable stages. Expose queued/running/partial/ready/failed states and actionable recovery. Store PDF artifacts in private object storage with short-lived authorized downloads. Separate source-change monitoring from user report generation.

## 9. Privacy, security and operations

Profile data is more sensitive than calculator history. Establish lawful processing purposes, retention/deletion policy, data minimization, access controls and provider agreements before launch. Prefer dependent age bands where exact birth dates are unnecessary. Keep document upload out of MVP.

Send only necessary structured facts to the narrative provider; omit direct identifiers, redact logs and prohibit prompts containing secrets. Store private artifacts outside public static assets. Account deletion must cover profiles, reports, artifacts, jobs and provider retention obligations; document backup expiry. Check ownership, CSRF protection, session handling, rate limits and staff authorization for every new endpoint.

Record report provenance, engine versions, job latency/failures, provider spend, source freshness and review backlog. Audit source publication and staff actions. Cap generation per user and site-wide, with predictable behavior when AI is unavailable. Treat fetched source content as untrusted data, including prompt-injection risk.

## 10. Delivery sequence and acceptance gates

Indicative sequence, not a calendar promise; estimate after the first phase and legal/data sourcing. Each phase should produce a usable vertical slice.

| Phase | Work | Exit gate |
| --- | --- | --- |
| 0: validate coverage | Interview target users, choose launch segment/country/cities/routes, confirm reviewer and data licensing; define example reports and expected results. Spike durable generation and PDF rendering. | A representative, reviewed sample report; named source/review owners; documented scope and operating costs. |
| 1: profile and workspace | New app shell/onboarding, household/profile versions, scenarios and auth integration. | Returning user edits a household, creates two scenarios and resumes safely on another device; existing tools remain reachable. |
| 2: trustworthy finances | Consolidated engine, sourced launch-city baskets, FX/tax limitations, fees/cash flow and visible overrides. | Reviewed household fixtures reproduce budgets and cash needs; unknowns never become zeros. |
| 3: immigration and reports | First reviewed country pack, deterministic evaluator, timeline templates, jobs, report reader and PDF. | End-to-end profile → cited report; future-date/unknown/unsupported cases work; every legal conclusion/fee has applicable evidence. |
| 4: maintained plans | Task persistence, source monitoring, review/publishing, impact detection and report refresh. | A staged rule change flags affected reports, preserves old versions and yields a correct replacement after approval. |
| 5: commercial beta | Pilot feedback, accessibility/security review, quotas and operational dashboards; paid report or subscription experiment. | Users complete planning tasks; legal review and data updates have funded owners; generation and support costs are measured. |

If near-term revenue is important, test a paid report with a defined refresh window first. Recurring subscriptions become more credible once maintained alerts and task execution provide continuing value. Pricing remains a hypothesis until tested.

## 11. Validation and release criteria

Maintain reviewer-approved fixtures covering citizenship/free movement, different application locations, income thresholds and boundary dates, families/dependent ages, unavailable facts, route exclusions, fees/exemptions and stale/conflicting sources. Add property/invariant tests for currencies, rounding, household scaling, unknown propagation, cash-flow accounting and determinism.

Backend integration tests cover ownership, profile concurrency, idempotent/retried jobs, immutable versions, publication permissions, affected-report detection and deletion. Frontend/browser checks cover onboarding/resume, comparison, sources, partial reports, report refresh, export authorization and accessible mobile navigation. Stub assistant/external APIs during browser tests.

Run frontend lint/build and focused Vitest/Playwright checks, plus backend typecheck/build and database integration tests as relevant. Existing calculator tests remain regression coverage; investigate known load-related failures in isolation before attributing them to new work.

Release gates: no uncited material legal claims; no unsupported affirmative eligibility; reproducible report snapshot; source review current for supported coverage; safe failure without AI; durable generation under retries; complete account isolation; usable export and mobile flow. Track activation (completed profile → report), missing-data abandonment, report usefulness, task completion, refresh usage, freshness breaches, cost per report and paid conversion.

## 12. First implementation slice

After scope validation, build one authenticated household → one city scenario → deterministic budget → template-based saved report. Use reviewed content only for an explicitly supported pathway and clearly mark other sections unavailable. This establishes the SaaS workflow before expanding legal breadth or adding AI prose.

First repository changes would be frontend route/layout/profile/report modules and backend profile/scenario/report schemas and endpoints, with a versioned contract. Follow with the shared cost engine and generation runner. The plan does not require moving the backend into this repository.

## Research anchors

These sources inform the architecture; they do not establish that any particular applicant qualifies or that a specific fee is current.

- European Commission EU Immigration Portal, applicant categories: https://home-affairs.ec.europa.eu/policies/migration-and-asylum/eu-immigration-portal/what-category-do-i-fit_en
- AIMA, general residence requirements and fee-schedule link: https://aima.gov.pt/pt/viver/autorizacao-de-residencia-regime-e-requisitos-gerais-art-o-77-o-n-o-1
- Portugal official legislation publication, example of statutory subsistence rules: https://diariodarepublica.pt/dr/detalhe/portaria/1563-2007-628798
- European Commission, data minimization and privacy by design: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en

Before implementation, settle launch segment/country, supported routes/application locations, reviewer arrangements, price-data rights, durable job provider and the initial paid offering. These decisions affect scope; the architecture above supports making them without a full rewrite.
