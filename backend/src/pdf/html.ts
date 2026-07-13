import { marked } from 'marked';
import puppeteer, { Browser } from 'puppeteer';
import { env } from '../config/env';

let browserPromise: Promise<Browser> | null = null;

// Reuse a single Chromium instance across requests.
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}

const CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a; font-size: 10.5pt; line-height: 1.4; margin: 0;
  }
  h1 { font-size: 20pt; margin: 0 0 2px; color: #b00020; }
  h2 { font-size: 12pt; margin: 16px 0 6px; padding-bottom: 3px;
       border-bottom: 1.5px solid #b00020; color: #b00020; text-transform: uppercase; letter-spacing: .5px; }
  h3 { font-size: 11pt; margin: 10px 0 2px; }
  p { margin: 4px 0; }
  ul { margin: 4px 0 8px; padding-left: 18px; }
  li { margin: 2px 0; }
  a { color: #b00020; text-decoration: none; }
  hr { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
  .doc-header { margin-bottom: 8px; }
`;

// Render Markdown/text content to a PDF Buffer using headless Chromium.
export async function markdownToPdf(markdown: string, title: string): Promise<Buffer> {
  const bodyHtml = await marked.parse(markdown, { async: true });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    title,
  )}</title><style>${CSS}</style></head><body>${bodyHtml}</body></html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
