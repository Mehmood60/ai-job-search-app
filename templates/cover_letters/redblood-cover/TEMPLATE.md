# Template: redblood-cover

- **Type:** Cover letter
- **Engine:** pdflatex
- **Page limit:** 1 page
- **Fonts:** body renders in Helvetica via `\fontfamily{phv}\selectfont`. IMPORTANT: this only works under **pdflatex** — under lualatex/xelatex the `phv` switch is ignored and the text falls back to TeX Gyre Pagella (serif), which is the wrong look. Icons via `fontawesome5`.
- **Class/packages:** `article` (12pt) + inputenc(utf8), geometry, tgpagella, fontawesome5, xcolor (all standard)

## Compile command

    cd <output dir> && pdflatex -interaction=nonstopmode <file>.tex

## Style rules

- Accent colour `redBlood` (RGB 188,20,20): used for the surname, the header rule, the `RE:` label, and the bold match sub-labels. Keep this consistent.
- Header (`\userInfo`): surname uppercase in red + optional first name in black, a full-width red rule, then address / phone / email in gray with fontawesome icons (`\faMap`, `\faPhone`, `\faEnvelopeOpen`). Contact details are printed as literal text (icons are decorative) — good for readability.
- Company block (`\companyInfo{company}{location}`) is flush-right with the date. **It now uses its two arguments** (original hard-coded the company name — fixed on registration).
- `\object{role}` prints the `RE:` subject line.
- Body goes inside `\content{ ... }` followed by `\signature`. Use `\noindent` on each paragraph and `\textcolor{redBlood}{\textbf{...}}` for the section/match sub-labels.
- Closing is handled by `\signature` ("Best regards," + name).

## Known pitfalls

- **`\content` takes two arguments.** The body is `#1`; the `\signature` token that follows the `\content{...}` group is captured as `#2`. Keep the pattern `\content{ <body> }` immediately followed by `\signature` — do not delete the trailing `\signature`, or the letter loses its sign-off (and `#2` grabs the next token).
- **Engine matters for the font.** Must compile with **pdflatex** so `\fontfamily{phv}` renders Helvetica. lualatex/xelatex silently fall back to serif Pagella. (fontawesome5 compiles fine under pdflatex on this MiKTeX install — verified.)
- The `.tex` uses `\usepackage[utf8]{inputenc}`, which is correct for pdflatex; keep it.
- Header rule width is fixed (19.0cm) to sit inside the 10mm margins; a wider value causes an overfull-hbox warning.
- **Literal `<` and `>` render as `¡` and `¿`** under pdflatex's default OT1 encoding. Always write inequalities in math mode (`$p < 0.05$`) or use `\textless` / `\textgreater`. (The CV template, compiled with lualatex, renders a raw `<` correctly — this pitfall is pdflatex-specific.)
- One-page limit: body budget ~250-300 words. Trim matches/paragraphs rather than shrinking geometry.
