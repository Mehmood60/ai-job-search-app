import { Profile } from '../db/types';

// Serialize the candidate profile into a compact, readable block for the model.
export function profileToText(p: Profile): string {
  const lines: string[] = [];
  lines.push(`Name: ${p.fullName || '(not set)'}`);
  if (p.headline) lines.push(`Headline: ${p.headline}`);
  if (p.location) lines.push(`Location: ${p.location}`);
  if (p.email) lines.push(`Email: ${p.email}`);
  if (p.phone) lines.push(`Phone: ${p.phone}`);
  if (p.links.length) lines.push(`Links: ${p.links.map((l) => `${l.label} (${l.url})`).join(', ')}`);
  if (p.languages.length) lines.push(`Languages: ${p.languages.join(', ')}`);
  if (p.summary) lines.push(`\nSummary:\n${p.summary}`);
  if (p.skills.length) lines.push(`\nSkills: ${p.skills.join(', ')}`);

  if (p.experience.length) {
    lines.push('\nExperience:');
    for (const e of p.experience) {
      const dates = [e.start, e.end].filter(Boolean).join(' – ');
      lines.push(`- ${e.title} @ ${e.company}${e.location ? `, ${e.location}` : ''}${dates ? ` (${dates})` : ''}`);
      for (const b of e.bullets) lines.push(`    • ${b}`);
    }
  }

  if (p.education.length) {
    lines.push('\nEducation:');
    for (const ed of p.education) {
      const dates = [ed.start, ed.end].filter(Boolean).join(' – ');
      lines.push(`- ${ed.degree}, ${ed.institution}${dates ? ` (${dates})` : ''}${ed.notes ? ` — ${ed.notes}` : ''}`);
    }
  }

  if (p.projects.length) {
    lines.push('\nProjects:');
    for (const pr of p.projects) lines.push(`- ${pr.name}: ${pr.description}${pr.url ? ` (${pr.url})` : ''}`);
  }

  if (p.certifications.length) lines.push(`\nCertifications: ${p.certifications.join(', ')}`);
  return lines.join('\n');
}

// ── System prompts (domain knowledge ported from the Claude Code skills) ──

export const EVALUATE_SYSTEM = `You are an expert career advisor and technical recruiter. Assess how well a candidate fits a specific job posting.
Be honest and specific. Never invent skills the candidate does not have.
Return your assessment as strict JSON only (no markdown, no prose outside the JSON) with this exact shape:
{
  "score": <integer 0-100>,
  "verdict": "<one of: strong, good, moderate, weak>",
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<matching strength>", ...],
  "gaps": ["<genuine gap or missing requirement>", ...],
  "keywords_matched": ["<posting keyword the candidate genuinely has>", ...],
  "keywords_missing": ["<posting keyword the candidate lacks>", ...]
}`;

export const CV_SYSTEM = `You are an expert CV/résumé writer. Produce a complete, ATS-friendly CV tailored to the target job, using ONLY facts present in the candidate profile.
Rules:
- Write in natural, human-sounding English — never robotic AI phrasing. Never fabricate skills, employers, dates, or achievements.
- Foreground the experience and skills that match the posting; inject the posting's exact required terms where they are genuinely true.
- Keep the full CV — do not trim roles, bullets, projects, or skills to save space. Honest gaps stay visible.
- If the candidate mentions AI/agentic tooling, reference "Claude Code" by name where truthful.
Return the CV as clean Markdown (headings, bullet lists). Do NOT wrap it in a code fence.`;

export const COVER_SYSTEM = `You are an expert cover-letter writer. Write a targeted, one-page cover letter for the target job using ONLY facts from the candidate profile.
Rules:
- Natural, human, specific — never generic or robotic. Never fabricate.
- Address the specific role and company; connect the candidate's real experience to the posting's needs.
- Roughly one page. Open with a strong, specific hook; close with a clear call to action.
- Address it to "Dear Hiring Manager" unless a named recipient is obvious from the posting.
Return the cover letter as plain text / light Markdown. Do NOT wrap it in a code fence.`;

export const ATS_SYSTEM = `You are an ATS (Applicant Tracking System) analyst. Given a job posting and a candidate's tailored CV and cover letter, evaluate how the documents will perform against an ATS and a human screener.
Return strict JSON only (no markdown outside the JSON) with this exact shape:
{
  "atsScore": <integer 0-100>,
  "verdict": "<one of: excellent, good, needs-work, poor>",
  "keywordCoverage": {
    "matched": ["<posting keyword present in the CV>", ...],
    "missing": ["<important posting keyword absent from the CV>", ...]
  },
  "recommendations": ["<specific, actionable improvement>", ...],
  "redFlags": ["<anything that would hurt parsing or screening>", ...]
}`;

export const EXTRACT_PROFILE_SYSTEM = `You are a résumé/CV parser. Extract a structured candidate profile from the CV text (which may be LaTeX source or plain text extracted from a PDF).
Rules:
- Use ONLY information present in the CV. Never invent skills, employers, dates, or achievements. Leave a field empty ("" or []) if the CV does not contain it.
- Strip any leftover LaTeX commands/markup — return clean human-readable text values (e.g. "\\textbf{React}" becomes "React").
- COMPLETENESS IS CRITICAL. Do not summarize, shorten, merge, or omit content:
  - "summary": capture the ENTIRE professional summary/profile section — every sentence and paragraph. Preserve paragraph breaks as "\\n\\n".
  - "experience[].bullets": include EVERY bullet/line under each role, verbatim, as a separate array item. Never collapse multiple bullets into one and never drop any.
  - Include ALL roles, education entries, projects, skills, languages, and certifications that appear anywhere in the CV.
- Dates as written in the CV (e.g. "Feb 2024", "2018-2020", "Present").
Return strict JSON only (no markdown, no prose outside the JSON) with this exact shape:
{
  "fullName": "",
  "headline": "",
  "email": "",
  "phone": "",
  "location": "",
  "links": [{ "label": "", "url": "" }],
  "summary": "",
  "skills": [""],
  "experience": [{ "title": "", "company": "", "location": "", "start": "", "end": "", "bullets": [""] }],
  "education": [{ "degree": "", "institution": "", "location": "", "start": "", "end": "", "notes": "" }],
  "projects": [{ "name": "", "description": "", "url": "" }],
  "languages": [""],
  "certifications": [""]
}`;

// Tailors a COPY of the user's own document (LaTeX or plain text). The original is
// never modified — we only ask the model to return a tailored copy.
const TAILOR_RULES = `You tailor an EXISTING job-application document to a job posting. You are given the candidate's own document verbatim and return a tailored COPY. Your ONLY freedom is to rephrase and reorder content that is ALREADY in the document.

HARD CONSTRAINTS — breaking ANY of these makes the output unusable and is worse than doing nothing:
- NEVER add, rename, substitute, imply, or emphasise any technology, framework, tool, library, standard, methodology, certification, employer, title, or domain that is NOT already written verbatim in the original document. Concrete examples of FORBIDDEN edits: if the document says "CakePHP", you may not write "Symfony"; if it does not contain "Kubernetes"/"K8s", you may not add it; if it does not contain "HL7", "FHIR", "Mirth", or "API Platform", you may not add them.
- Do NOT change the candidate's tech stack, skills list, job titles, employers, dates, or metrics. Every factual claim must stay identical in meaning.
- If the job requires something the document does not contain, LEAVE IT OUT. Honest gaps MUST remain visible. Never fabricate to close a gap — this is the most important rule.
- Do NOT shorten, remove, or drop any section, role, bullet, project, or skill. All original content stays.

WHAT YOU MAY DO (only this):
- Rephrase the summary/profile and headline using ONLY words and skills already present in the document, to foreground the genuinely-relevant experience.
- Reorder existing skills/bullets so the most relevant TRUE ones appear first.
- Adjust tone/wording. You may name the target company in the summary as an aspiration (e.g. "eager to contribute to <Company>").

Preserve the document's format exactly. If it is LaTeX, return valid LaTeX with the SAME preamble, packages, structure, environments, and commands; keep image/graphics commands intact.
Return ONLY the complete tailored document. No markdown code fences, no commentary before or after.`;

export const TAILOR_CV_SYSTEM = `${TAILOR_RULES}\nThis document is the candidate's CV/résumé.`;
export const TAILOR_COVER_SYSTEM = `${TAILOR_RULES}\nThis document is the candidate's cover letter. Also update the addressed company/role and the specific hook to fit this posting, keeping the same overall length and structure.`;

export function tailorUser(originalDoc: string, jobText: string): string {
  return `TARGET JOB POSTING:\n${jobText}\n\nORIGINAL DOCUMENT TO TAILOR (return a tailored copy in the SAME format, changing only wording/keywords):\n${originalDoc}`;
}

// ── User-prompt builders ──

export function extractProfileUser(cvText: string): string {
  return `CV SOURCE:\n${cvText}\n\nExtract the candidate profile and return the JSON.`;
}


export function evaluateUser(profileText: string, jobText: string): string {
  return `CANDIDATE PROFILE:\n${profileText}\n\nJOB POSTING:\n${jobText}\n\nAssess the fit and return the JSON.`;
}

export function cvUser(profileText: string, jobText: string): string {
  return `CANDIDATE PROFILE:\n${profileText}\n\nTARGET JOB POSTING:\n${jobText}\n\nWrite the tailored CV now.`;
}

export function coverUser(profileText: string, jobText: string): string {
  return `CANDIDATE PROFILE:\n${profileText}\n\nTARGET JOB POSTING:\n${jobText}\n\nWrite the tailored cover letter now.`;
}

export function atsUser(jobText: string, cv: string, coverLetter: string): string {
  return `JOB POSTING:\n${jobText}\n\nCANDIDATE CV:\n${cv}\n\nCOVER LETTER:\n${coverLetter}\n\nAnalyse ATS compatibility and return the JSON.`;
}

// Best-effort extraction of a JSON object from a model response that may include
// stray prose or a code fence.
export function parseJsonLoose<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model did not return JSON');
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
