# Job Application Assistant for Mehmood Ul Hassan

## Role
This repo is a job application workspace. Claude acts as a career advisor and application assistant for Mehmood Ul Hassan, helping with:
1. **Job fit evaluation** - Assess job postings against your profile (skills, experience, behavioral traits)
2. **CV tailoring** - Adapt existing CV templates (LaTeX/moderncv) to target specific roles
3. **Cover letter writing** - Draft targeted cover letters using existing templates (LaTeX)
4. **Interview preparation** - Prepare answers, questions, and talking points for interviews
5. **Career strategy** - Advise on positioning and personal branding

## Candidate Profile

### Identity
- **Name:** Mehmood Ul Hassan
- **Location:** Saarbrücken, Germany (open to hybrid or fully remote roles anywhere in Germany)
- **Languages:** English (C1, fluent), German (B1), Urdu (native)
- **Status:** Employed (Software Engineer at VetControl GmbH); available immediately
- **Work authorization:** Permanent German residence — no visa sponsorship needed
- **LinkedIn headline:** "Full Stack Engineer | React + Next.js + TypeScript | Node.js + Python + PHP | PostgreSQL/MySQL | Docker + CI/CD | HealthTech"
- **Contact:** mahmoodulhassan60@gmail.com | +49 176 58410562
- **LinkedIn:** https://www.linkedin.com/in/mehmood-ul-hassan-73a7b878
- **GitHub:** https://github.com/Mehmood60

### Education
- **M.Sc. in Media Informatics** (2018-2020) - Saarland University, Germany
  - Thesis: "Collaborative Virtual Reality-Based System for Industrial Manufacturing Training" (Grade: Distinction)
  - Topics: VR/multi-user networking (Unity3D, C#, Photon), HCI, user studies (t-tests, ANOVA)
- **B.Sc. in Information Technology** (2010-2014) - Bahauddin Zakariya University, Pakistan

### Professional Experience
- **Software Engineer (Full-Stack)** (Feb 2024 - Present) - **VetControl GmbH** (Germany, B2B SaaS — veterinary billing & insurance)
  - Built and maintained the PettiPay production billing platform (Node.js, PHP, MySQL, MQTT, REST) handling financial transactions with external insurance providers
  - Delivered a complete user management system solo (JWT auth, RBAC, Angular frontend, Node.js APIs)
  - Built OCR validation/fallback pipelines (multi-engine, confidence scoring) improving reliability by 30%
  - Achievement: 8+ major features delivered on time; zero production-critical bugs in last 6 months
- **Backend Software Engineer** (Feb 2022 - Feb 2024) - **DFKI (German Research Center for AI)**, EdTech Lab
  - PHP (CakePHP) + Python backends integrating third-party Python ML services via PHP APIs
  - REST APIs and SQL databases serving educational platforms with 1M+ requests/month
  - Projects: Studyfinder (40% query speedup, 50K+ monthly users), CTC Finder (WCAG 2.1), KIPerWeb, KI-WW
- **CTO / Founding Full-Stack Engineer** (Dec 2019 - Jan 2022) - **Guel GmbH** (Germany, B2B SaaS startup)
  - Built products from scratch (React, Node.js, Express, MySQL); shipped MVP in 6 weeks
  - Led a team of 4; established coding standards, GitFlow, 85%+ test coverage
  - React Native mobile apps for hello-doctor.de (telemedicine) and hello-sister.de (healthcare)
  - Achievement: scaled platform from 0 to 500+ B2B users in 18 months at 99.9% uptime
- **M.Sc. Thesis Project** (Dec 2019 - Dec 2020) - **ZeMA gGmbH** (Germany, manufacturing research)
  - Multi-user VR training system (Unity3D, C#, Photon); user study with 20+ trainees (p < 0.05)
- **Internship — Mixed Reality Learning Platform** (May 2019 - Sep 2019) - **Didactic Innovations** (Germany, EdTech)
  - Web + HoloLens (Unity/MRTK) prototype; Angular admin panel, Node.js REST APIs, Neo4j graph DB

### Independent Projects
- **SellSmart — eBay Seller Operations Platform** (live in production, open source): self-hosted app for eBay sellers to manage orders, listings, analytics, competitor pricing, and AI-assisted listing generation. Next.js 14 + TypeScript + TailwindCSS frontend; PHP 8.2 REST API; eBay OAuth 2.0 + Groq (LLaMA 3.1); 100+ automated tests (PHPUnit + Vitest); multi-stage Docker + Caddy auto-HTTPS, deployed to a Linux cloud VM. https://github.com/Mehmood60/seller-operations-platform

### Technical Skills
- **Primary:** React, Next.js, TypeScript, JavaScript (ES6+), Node.js (Express), PHP (CakePHP)
- **Secondary:** Python (1 year — backend APIs, ML service integration), Angular, React Native, TailwindCSS
- **Databases:** PostgreSQL, MySQL, MariaDB, Prisma ORM, query optimization, schema design
- **DevOps:** Docker (multi-stage builds), CI/CD (GitLab CI, GitHub Actions), Git, Linux, AWS (EC2, S3, RDS, CloudWatch), Caddy
- **AI/LLM:** Groq API (LLaMA 3.1), prompt engineering, AI-assisted development (Cursor, Copilot, Claude Code)
- **Testing:** Jest, React Testing Library, Vitest, PHPUnit (85%+ coverage), unit + integration testing
- **Domain:** B2B SaaS, HealthTech, billing/fintech workflows, EdTech, startup/founding engineering

### Certifications
- (none recorded yet — add via /expand or a future /setup run)

### Publications
- (none)

### Awards
- M.Sc. thesis defended with Distinction (Saarland University, 2020)

### Behavioral Profile
*(Inferred from CV self-description — review and refine)*
- **Ownership** - Repeatedly took systems end-to-end (solo user management system, founding CTO, live SellSmart deploy)
- **Fast execution** - Shipped MVP in 6 weeks, 8+ features on time; comfortable shipping fast without dropping quality
- **Strengths:** Full-stack breadth, production deployment/DevOps, quality discipline (85%+ coverage), cross-functional collaboration
- **Growth areas:** German fluency (B1 → improving); deeper/longer Python track record
- **Thrives in:** Product-focused teams with real ownership, fast iteration, and clear user impact

### What Excites You
- HealthTech and improving patient outcomes through technology
- B2B SaaS — building products from zero to production with measurable impact

### Target Roles
- Full Stack Engineer, Frontend Engineer, Backend Engineer, PHP Developer, JavaScript/TypeScript Developer (mid-senior level) — whichever matches the stack

### Target Sectors
- Open to any sector; strongest interest in HealthTech and B2B SaaS

### Location & Compensation
- **Remote (Germany):** €65,000-68,000
- **Hybrid / on-site outside Saarbrücken:** €68,000-70,000
- **Saarbrücken (hybrid/on-site):** €65,000-68,000

### References
- Deniz Güel — CEO, Guel GmbH
- Michael Dietrich — DFKI (michael.dietrich@dfki.de)
- Marc Bachmann — CEO, VetControl GmbH

### Deal-breakers
- Roles requiring relocation outside Germany (permanent German residence, wants to stay)
- (No other hard deal-breakers specified — open to most role and company types)

## Repo Structure
- `cv/` - LaTeX CV variants (moderncv template, banking style)
- `cover_letters/` - LaTeX cover letters (custom cover.cls template)
- `.claude/skills/` - AI skill definitions for the application workflow
- `.agents/skills/` - Job search CLI tools

## Workflow for New Job Applications
1. User provides a job posting (URL or text)
2. **Always evaluate fit first**: skills match, experience match, behavioral/culture match. Present this assessment to the user before proceeding.
3. If good fit: create targeted CV (`cv/main_<company>.tex`) and cover letter (`cover_letters/cover_<company>_<role>.tex`)
4. **Verify both documents** (see Verification Checklist below)
5. Prepare interview talking points based on the role requirements and your strengths

**Important:** When mentioning agentic coding or AI tooling in CVs/cover letters, explicitly reference **Claude Code** by name.

## Application Output Rules (MANDATORY)

These rules apply to **every** application (via `/apply` or any manual drafting):

### Language rule — always English
- **Both the CV and the cover letter are always written in English**, regardless of the job posting's language (even for German, Danish, or other non-English postings). This overrides any "match the posting language" guidance. Only switch languages if the user explicitly asks for a specific application.

### CV content rule — never shorten
- **Do NOT shorten or trim the CV.** Keep the full-length CV with all sections and bullets intact (the active `single-column-red` template has **no page limit** and is intentionally multi-page).
- When tailoring to a job, **only change the mandatory keywords** to match the JD: adjust the headline, foreground the matching stack, and inject the posting's exact required terms where they are genuinely true. Reorder for emphasis if useful.
- **Never remove** experience, roles, bullets, projects, or skills to save space. Never cut to hit a page count. Never fabricate skills — honest gaps stay visible (e.g. Vue/Laravel framed as "ramping").

### Templates & engines
- **CV:** `single-column-red` template, compiled with **lualatex**, requires `cv/picture.jpeg` (the real headshot).
- **Cover letter:** `redblood-cover` template, compiled with **pdflatex** (Helvetica via `\fontfamily{phv}`; lualatex/xelatex render the wrong serif font).

### Export every application to the jobs folder (MANDATORY)
For each application, archive to: `C:\Users\MehmoodulHassan\OneDrive - VetControl GmbH\Desktop\CVs\jobs\<Company>\`
1. Create the company subfolder (reuse/overwrite if it exists).
2. Save the **original job description** as `job_description.txt` (full posting text; if fetched from a URL, include the URL and capture date).
3. Copy the final PDFs there: `Mehmood Ul Hassan - CV - <Company>.pdf` and `Mehmood Ul Hassan - Cover Letter - <Company>.pdf`.
4. Also copy the `.tex` sources for future editing.
The repo copies under `cv/` and `cover_letters/` stay as working copies; the jobs folder is the delivered archive.

## Verification Checklist
After creating or updating a CV or cover letter, re-read the generated file and verify **all** of the following before presenting to the user. Report the results as a pass/fail checklist.

### Factual accuracy
- [ ] All claims match actual profile (CLAUDE.md / candidate profile) - no fabricated skills, experience, or achievements
- [ ] Job titles, dates, company names, and locations are correct
- [ ] Contact details are correct
- [ ] All company-specific claims (partnerships, products, technology, expansions) have been independently verified via WebFetch/WebSearch - do not trust reviewer agent research without verification

### Targeting
- [ ] Profile statement / opening paragraph is tailored to the specific role (not generic)
- [ ] Skills and experience bullets are reframed to match the job requirements
- [ ] Key job requirements are addressed (with gaps acknowledged where relevant)
- [ ] Nice-to-have requirements are highlighted where there is a match

### Consistency
- [ ] CV follows the standard 2-page moderncv/banking format
- [ ] Cover letter uses cover.cls template and established structure
- [ ] Tone is consistent across CV and cover letter
- [ ] No contradictions between CV and cover letter content

### Quality
- [ ] No LaTeX syntax errors (balanced braces, correct commands)
- [ ] No spelling or grammar errors
- [ ] Agentic coding / AI tooling references mention **Claude Code** by name
- [ ] Cover letter is addressed to the correct person (or "Dear Hiring Manager" if unknown)
- [ ] Cover letter fits approximately one page

### Compiled PDF verification (MANDATORY - never skip)
Both documents MUST be compiled and visually inspected via the Read tool on the PDF output. "Looks fine in the .tex" is not acceptable - LaTeX page-break decisions are unpredictable. Iterate until these all pass:
- [ ] CV compiled with **lualatex** (pdflatex often fails on modern MiKTeX with fontawesome5 font-expansion errors). Cover letter compiled with **xelatex** (cover.cls requires fontspec).
- [ ] **CV is exactly 2 pages** - not 1, not 3
- [ ] **No orphaned `\cventry` titles** - a job/education title must never sit at the bottom of a page with its bullets spilling to the next page. Use `\needspace{5\baselineskip}` before each `\cventry` to prevent this, and `\enlargethispage{2-3\baselineskip}` to rescue a trailing section that just barely spills
- [ ] **Cover letter is exactly 1 page** - signature block must fit with the body, never overflow
- [ ] **Cover letter bullet font matches body font** - `\lettercontent{}` must not wrap `\begin{itemize}...\end{itemize}` (the command's trailing `\\` errors on `\end{itemize}`, and moving itemize outside loses the Raleway font). Standard pattern: close `\lettercontent{}`, then wrap the list in `{\raggedright\fontspec[Path = OpenFonts/fonts/raleway/]{Raleway-Medium}\fontsize{11pt}{13pt}\selectfont \begin{itemize}...\end{itemize}\par}`

### ATS & keyword verification (CV)
ATS parsers read the PDF's embedded text layer, not the rendered page. Extract it with `pdftotext -layout` and verify what a parser sees. `pdftotext` (poppler) is optional - if missing, skip the parseability items with a warning and check keyword coverage from the visual PDF read instead.
- [ ] CV text layer extracts cleanly - no `(cid:*)` markers, `�` replacement characters, or text visible in the PDF but absent from the extraction
- [ ] Email and phone appear as **literal text** in the extraction (icon-glyph noise like `MOBILE-ALT`/`Envelope` is harmless, but a contact detail carried only by an icon or hyperlink is invisible to ATS)
- [ ] Reading order of the extracted text matches the visual order (single-column stock template is safe; multi-column custom templates are where this breaks)
- [ ] Posting keywords covered or honestly absent - synonym-only matches tightened to the posting's exact term where truthfully applicable, keywords the profile genuinely supports added to experience bullets, genuine gaps left visible and **never stuffed**
