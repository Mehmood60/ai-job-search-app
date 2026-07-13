# Search Queries for Job Scraper

<!-- Customized for Mehmood Ul Hassan — Full Stack Engineer, Germany. -->

## Market note

The shipped CLI tools in `.agents/skills/` (Jobindex, Jobnet, Jobbank, Jobdanmark) are **Denmark-specific and do not apply** to Mehmood's German search. Use:

- **`linkedin-search`** (country-agnostic, bundled) — pass `-l "Germany"`, `-l "Remote"`, or a specific city.
- **Google `site:` searches** against German boards (below).
- Optionally run **`/add-portal`** to build a dedicated CLI for a German board (e.g. StepStone, Xing).

## Search Sites

Primary (German job market):
- **linkedin.com/jobs** — primary; use `linkedin-search -l "Germany"` / `-l "Remote"`
- **stepstone.de** — largest German job board
- **indeed.de** — broad coverage
- **xing.com/jobs** — strong in DACH region
- **arbeitnow.com** — many English-speaking / remote tech roles in Germany
- **germantechjobs.de**, **getinit.de**, **berlinstartupjobs.com** — tech/startup focus, English-friendly

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for HealthTech / B2B SaaS target companies

## Query Categories

Queries are grouped by priority. Combine with location terms (`Remote`, `Deutschland`, or a city) where the site supports it. Search in **both English and German** — many German postings use English titles, but not all.

### Priority 1: Full Stack Engineer (core direction)

These match the strongest and most desired career direction.

```
site:stepstone.de "Full Stack" (React OR Next.js OR TypeScript) Remote
site:linkedin.com/jobs "Full Stack Engineer" TypeScript Germany
site:indeed.de "Fullstack Entwickler" React Node.js
site:xing.com/jobs "Full Stack Developer" React remote Deutschland
```
LinkedIn CLI: `linkedin-search "Full Stack Engineer React TypeScript" -l "Germany"` and `-l "Remote"`

### Priority 2: HealthTech / B2B SaaS (domain expertise)

These match the domain Mehmood most wants (HealthTech, B2B SaaS).

```
site:linkedin.com/jobs "Full Stack" (HealthTech OR "digital health" OR SaaS) Germany
site:stepstone.de Softwareentwickler (Health OR Gesundheit OR SaaS) React
site:arbeitnow.com fullstack react healthtech
```
LinkedIn CLI: `linkedin-search "Full Stack HealthTech SaaS React Node" -l "Germany"`

### Priority 3: Frontend / Backend / PHP specialisations (adjacent roles)

Adjacent roles that match individual halves of the stack.

```
site:stepstone.de "Frontend Entwickler" (React OR Next.js OR TypeScript)
site:linkedin.com/jobs "Backend Engineer" (Node.js OR PHP) Germany
site:indeed.de "PHP Entwickler" (Laravel OR CakePHP OR Symfony)
site:linkedin.com/jobs "React Developer" remote Germany
```
LinkedIn CLI: `linkedin-search "Frontend Engineer React TypeScript" -l "Germany"`, `linkedin-search "PHP Backend Developer" -l "Germany"`

### Priority 4: Broader software / TypeScript / JavaScript (wider net)

```
site:linkedin.com/jobs "TypeScript" (Engineer OR Developer) remote Germany
site:germantechjobs.de react node typescript
site:berlinstartupjobs.com fullstack engineer
site:stepstone.de Softwareentwickler JavaScript Docker
```

## Location Filter

Mehmood is based in **Saarbrücken** and will **not relocate outside Germany**. Acceptable areas (all within Germany):

- **Remote (Germany-wide)** — ideal (salary target €65–68k)
- **Hybrid / on-site anywhere in Germany outside Saarbrücken** — acceptable, open to relocating within Germany (salary target €68–70k)
- **Saarbrücken and surrounding area** — ideal for on-site/hybrid (salary target €65–68k)
- Nearby hubs worth flagging for hybrid: Frankfurt, Mannheim, Karlsruhe, Kaiserslautern, Luxembourg (cross-border — flag, don't assume)
- **Outside Germany** — too far (deal-breaker)

Note: prioritise **Remote (Germany)** and **English-friendly** postings; German-required-at-C1 roles are a friction point (currently B1) — flag but don't auto-exclude.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape healthtech" -> Priority 2 queries + custom HealthTech company `site:` searches
- "/scrape remote" -> all categories filtered to `-l "Remote"` on the LinkedIn CLI
