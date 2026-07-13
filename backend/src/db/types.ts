// Domain models shared across the JSON and Postgres data layers.

// Provider ids are dynamic: the built-ins ('grok' | 'groq' | 'openai' | 'claude')
// plus any user-defined custom provider ids. Kept as a string alias for clarity.
export type ProviderId = string;

// A user-defined, OpenAI-compatible AI provider added via Settings → "Add new model".
export interface CustomProvider {
  id: string; // stable uuid, generated on creation
  label: string; // display name, e.g. "DeepSeek"
  baseUrl: string; // OpenAI-compatible base, e.g. https://api.groq.com/openai/v1
  defaultModel: string; // e.g. "deepseek-chat"
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface ExperienceItem {
  title: string;
  company: string;
  location?: string;
  start?: string;
  end?: string;
  bullets: string[];
}

export interface EducationItem {
  degree: string;
  institution: string;
  location?: string;
  start?: string;
  end?: string;
  notes?: string;
}

export interface ProjectItem {
  name: string;
  description: string;
  url?: string;
}

// The candidate profile — one per user. Mirrors the CLAUDE.md profile shape,
// but generic so any user can fill it in.
export interface Profile {
  userId: string;
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: { label: string; url: string }[];
  summary: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  languages: string[];
  certifications: string[];
  updatedAt: string;
}

// Per-user settings: which provider is active, encrypted API keys, model overrides,
// and optional uploaded LaTeX templates.
export interface Settings {
  userId: string;
  activeProvider: ProviderId;
  // encrypted at rest (see crypto/secrets.ts), keyed by provider id. Missing = not set.
  apiKeys: Record<string, string>;
  // optional per-provider model override, keyed by provider id; missing = provider default
  models: Record<string, string>;
  // user-defined OpenAI-compatible providers
  customProviders: CustomProvider[];
  latexTemplates: {
    cv?: string; // raw .tex source with {{PLACEHOLDER}} tokens
    cover?: string;
  };
  updatedAt: string;
}

export function emptyProfile(userId: string): Profile {
  return {
    userId,
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    summary: '',
    skills: [],
    experience: [],
    education: [],
    projects: [],
    languages: [],
    certifications: [],
    updatedAt: new Date().toISOString(),
  };
}

export function defaultSettings(userId: string): Settings {
  return {
    userId,
    activeProvider: 'grok', // Grok is the default provider slot
    apiKeys: {},
    models: {},
    customProviders: [],
    latexTemplates: {},
    updatedAt: new Date().toISOString(),
  };
}
