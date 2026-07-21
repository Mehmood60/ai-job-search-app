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

// Shared find/replace PATCH format. We never ask the model to return a whole document
// (weak models garble/duplicate large LaTeX) or JSON (LaTeX backslashes/newlines break
// JSON escaping). Instead it returns tiny verbatim patches the server applies — layout
// is preserved byte-for-byte and only the intended snippets change.
const PATCH_FORMAT = `Return your changes as MINIMAL find/replace patches — do NOT return the whole document, and do NOT use JSON. For EACH change output a block EXACTLY like this (each @@ marker alone on its own line):
@@FIND@@
<a snippet copied VERBATIM from the document — copy its backslashes, braces and line breaks literally; do not escape or reformat>
@@REPLACE@@
<the same snippet with only your change applied>
@@END@@
Output ONLY these blocks (one per change) — nothing before, between, or after.
- FIND must be an exact, contiguous copy from the document, long and unique enough to occur exactly once.
- REPLACE keeps all surrounding content, commands and formatting identical.
- In any prose you write, escape LaTeX specials: \\& for "&", \\% for "%", \\# for "#", \\_ for "_". Never leave a bare & (it breaks compilation).`;

const TAILOR_RULES = `You tailor the candidate's existing document to a job posting by making MINIMAL keyword/wording changes. The layout, structure, and all content stay intact — you only patch small pieces.
HARD CONSTRAINTS:
- NEVER add, rename, or substitute any technology, tool, employer, title, or domain that is NOT already in the document (e.g. don't turn "CakePHP" into "Symfony", don't add "Kubernetes"/"HL7"/"FHIR"). Never fabricate to close a gap — honest gaps stay visible.
- Do NOT shorten, remove, reorder, or drop any section, role, bullet, project, or skill.
YOU MAY (via patches): rephrase the headline and summary using only skills already present, to foreground genuinely-relevant experience; name the target company in the summary; tighten wording.
EXCEPTION — CANDIDATE'S ADDITIONAL NOTES: if provided, you MAY add the facts/skills/availability they state (the candidate asserts they are true) to address the posting. Those notes are the ONLY permitted additions.
${PATCH_FORMAT}`;

export const TAILOR_CV_SYSTEM = `${TAILOR_RULES}\nThis document is the candidate's CV/résumé — usually only the headline and summary need patching.`;
export const TAILOR_COVER_SYSTEM = `${TAILOR_RULES}\nThis document is the candidate's cover letter — you may also patch the addressed company/role and the opening hook to fit this posting.`;

// Candidate-provided notes block (true facts the profile/CV may have missed).
function notesBlock(notes?: string): string {
  return notes && notes.trim()
    ? `\n\nCANDIDATE'S ADDITIONAL NOTES (provided by the candidate — treat as TRUE; use to address gaps and strengthen the match, e.g. a genuinely-held skill/experience the profile omitted, or updated availability/relocation):\n${notes.trim()}`
    : '';
}

export function tailorUser(originalDoc: string, jobText: string, notes?: string): string {
  return `TARGET JOB POSTING:\n${jobText}${notesBlock(notes)}\n\nDOCUMENT TO TAILOR (copy FIND snippets verbatim from this):\n${originalDoc}`;
}

// Edit the user's MASTER template (CV or cover) per a natural-language instruction.
export const EDIT_TEMPLATE_SYSTEM = `You edit the user's master LaTeX document per an instruction. Apply ONLY the requested change and preserve everything else.
- To ADD (e.g. a new "Selected Project" entry): FIND a nearby anchor (the end of the previous entry) and put that anchor + the new content in REPLACE, matching the surrounding entries' LaTeX style.
- To REMOVE: FIND the exact block; REPLACE with what should remain.
- Never restructure, reword, shorten, or touch anything the instruction doesn't mention. Never invent facts.
${PATCH_FORMAT}`;

export function editTemplateUser(instruction: string, doc: string): string {
  return `INSTRUCTION:\n${instruction}\n\nDOCUMENT (copy FIND snippets verbatim from this):\n${doc}`;
}

// Apply @@FIND@@/@@REPLACE@@/@@END@@ patches to a document. Matching is exact first,
// then whitespace-tolerant (models often reflow spaces/newlines when copying), so a
// minor copy difference doesn't drop the edit. Bare "&" in replacements is escaped.
export function applyLatexPatches(
  original: string,
  modelText: string,
): { updated: string; applied: number; missed: string[] } {
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const locate = (hay: string, needle: string): [number, number] | null => {
    const i = hay.indexOf(needle);
    if (i >= 0) return [i, i + needle.length];
    const trimmed = needle.trim();
    if (!trimmed) return null;
    try {
      const m = new RegExp(trimmed.split(/\s+/).map(escapeRegex).join('\\s+')).exec(hay);
      if (m) return [m.index, m.index + m[0].length];
    } catch {
      /* ignore */
    }
    return null;
  };

  // Lenient marker matching: tolerate spaces in/around markers, missing newlines, and
  // case, since models format the delimiters inconsistently.
  const blocks = [
    ...modelText.matchAll(/@@\s*FIND\s*@@\r?\n?([\s\S]*?)\r?\n?@@\s*REPLACE\s*@@\r?\n?([\s\S]*?)\r?\n?@@\s*END\s*@@/gi),
  ];
  let updated = original;
  let applied = 0;
  const missed: string[] = [];
  for (const b of blocks) {
    const find = b[1];
    const replacement = b[2].replace(/(?<!\\)&/g, '\\&'); // escape stray bare &
    const loc = locate(updated, find);
    if (!loc) {
      missed.push(find.slice(0, 60));
      continue;
    }
    updated = updated.slice(0, loc[0]) + replacement + updated.slice(loc[1]);
    applied++;
  }
  return { updated, applied, missed };
}

// ── User-prompt builders ──

export function extractProfileUser(cvText: string): string {
  return `CV SOURCE:\n${cvText}\n\nExtract the candidate profile and return the JSON.`;
}

export function evaluateUser(profileText: string, jobText: string, notes?: string): string {
  return `CANDIDATE PROFILE:\n${profileText}${notesBlock(notes)}\n\nJOB POSTING:\n${jobText}\n\nAssess the fit (factoring in the notes as true) and return the JSON.`;
}

export function cvUser(profileText: string, jobText: string, notes?: string): string {
  return `CANDIDATE PROFILE:\n${profileText}${notesBlock(notes)}\n\nTARGET JOB POSTING:\n${jobText}\n\nWrite the tailored CV now.`;
}

export function coverUser(profileText: string, jobText: string, notes?: string): string {
  return `CANDIDATE PROFILE:\n${profileText}${notesBlock(notes)}\n\nTARGET JOB POSTING:\n${jobText}\n\nWrite the tailored cover letter now.`;
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
