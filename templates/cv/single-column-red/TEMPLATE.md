# Template: single-column-red

- **Type:** CV
- **Engine:** lualatex
- **Page limit:** none (author's multi-page design — do NOT force to 2 pages)
- **Fonts:** Latin Modern (default; ships with TeX — nothing to install)
- **Class/packages:** `article` + geometry, hyperref, enumitem, titlesec, graphicx, tikz, xcolor (all standard)

## Compile command

    cd <output dir> && lualatex -interaction=nonstopmode <file>.tex

## Required assets

- **`picture.jpeg`** — a headshot must exist in the same directory as the compiled `.tex`. The header clips it to a circle (radius 1.9cm) via tikz. Without this file the compile fails. Copy the candidate's real `picture.jpeg` into the output directory (`cv/`) before compiling; a placeholder ships in the template folder.

## Style rules

- Single-column `article` layout, 1.8cm margins, 10pt.
- Section headings: large bold, followed by a full-width horizontal rule (`\titlerule`). Do not change heading style.
- Accent colour `redBlood` (RGB 188,20,20) is used only for project version sub-labels (`V1 -- ...`, `V2 -- ...`). Keep red reserved for those.
- Header is a two-column `minipage`: left = name (\LARGE bold) + headline + location/contact; right = circular photo. Preserve this layout.
- Roles use `\subsection*{\textbf{Title} \hfill \textit{dates}}` with company on the next line; a role may contain multiple bolded sub-project blocks each with its own itemize. End major roles with `\textit{Key achievement:} ...`.
- Bullets use the global `enumitem` settings (`noitemsep`, tight) — do not add manual `\vspace` between `\item`s.
- Relies on **native UTF-8** (ü, em-dashes typed directly). Compile with lualatex/xelatex; if ever switching to pdflatex, add `\usepackage[utf8]{inputenc}`.

## Known pitfalls

- Missing `picture.jpeg` is the most common failure — always confirm it's in the output dir first.
- No `\usepackage[utf8]{inputenc}` in the preamble by design (lualatex handles UTF-8 natively); adding it under lualatex is harmless but unnecessary.
- This template intentionally runs longer than 2 pages; the `/apply` compile-and-inspect loop must NOT trim it to 2 pages for this template.
