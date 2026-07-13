import { AppError } from '../http/errors';

const URL_RE = /^https?:\/\/\S+$/i;

// Strip HTML to readable text (best-effort — good enough to feed a JD to the model).
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// If `input` is a URL, fetch the page and extract its text; otherwise return the
// input unchanged. Used so the Apply flow accepts either a pasted link or full JD.
export async function resolveJobText(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!URL_RE.test(trimmed)) return trimmed;

  let res: Response;
  try {
    res = await fetch(trimmed, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AppError(
      400,
      'Could not reach that URL. Paste the job description text instead.',
      'FETCH_FAILED',
    );
  }
  if (!res.ok) {
    throw new AppError(
      400,
      `Could not fetch the URL (HTTP ${res.status}). Some sites block automated access — paste the job text instead.`,
      'FETCH_FAILED',
    );
  }
  const text = htmlToText(await res.text()).slice(0, 20000);
  if (text.length < 50) {
    throw new AppError(
      400,
      'That page had little readable text (it may require login or JavaScript). Paste the job description text instead.',
      'EMPTY_FETCH',
    );
  }
  return text;
}
