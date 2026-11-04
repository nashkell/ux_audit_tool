/**
 * UX Audit Skill — Word (.docx) Report Builder
 *
 * Generates a client-facing Word document directly from a findings.csv
 * (as produced elsewhere in this skill) plus a small metadata JSON file for
 * the handful of things a CSV can't hold (narrative, roadmap phases, cover
 * page details). Styled to the Relevate Health brand system (dark
 * navy/purple, lime-green + teal accents, Inter typeface).
 *
 * Requires the `docx` skill's environment (npm `docx` package) — see
 * /mnt/skills/public/docx/SKILL.md for setup, gotchas, and the
 * verify-by-rendering-to-PDF workflow. Always render and visually check the
 * output before delivering it (see that skill's "Verify the output").
 *
 * USAGE
 *   cd scripts && npm install   (installs the pinned docx version from package.json)
 *   node docx-report-template.js [findings.csv] [audit-meta.json] [output.docx] [--strict]
 *
 *   --strict   Exit non-zero (and write nothing) if any finding has
 *              Verification = "Inferred — needs human check". Without the
 *              flag those findings only produce a warning listing their IDs.
 *
 * Defaults: ./findings.csv, ./audit-meta.json, /mnt/user-data/outputs/UX-Audit-Report.docx
 *
 * findings.csv is expected to have the columns produced by this skill's
 * Finding Documentation format: ID, Dimension, Severity, Scope,
 * Standard/Heuristic (or Reference/WCAG), Location, Observation, Impact,
 * Recommendation, At a Glance, Priority Score, plus (v1.5+) Evidence,
 * Verification, Instances. The v1.5 columns are optional: an older CSV
 * without them still builds, with a warning. Column names are matched
 * case- and punctuation-insensitively, so minor header variations are fine.
 * See assets/findings.example.csv for a reference file.
 *
 * audit-meta.json holds everything the CSV doesn't: site name, client,
 * prepared-by, date, pages audited, the executive summary narrative, and
 * the roadmap phases/arc. See assets/audit-meta.example.json for a
 * reference file and field-by-field comments.
 *
 * Dimension scores, severity counts, top priorities (ranked by Priority
 * Score), and the appendix scoring table are all computed automatically
 * from the CSV using the Severity x Scope deduction table — no need to
 * hand-calculate them.
 *
 * BRAND COLORS BELOW ARE PLACEHOLDERS approximated from the HTML deck
 * system — confirm against the actual brand guide before client delivery
 * and update the hex values if they're off.
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle, PageBreak,
  Header, Footer, PageNumber, VerticalAlign
} = require("docx");

const cliArgs = process.argv.slice(2);
const STRICT = cliArgs.includes("--strict");
const [csvArg, metaArg, outArg] = cliArgs.filter(a => !a.startsWith("--"));
const CSV_PATH = csvArg || "./findings.csv";
const META_PATH = metaArg || "./audit-meta.json";
const OUTPUT_PATH = outArg || "/mnt/user-data/outputs/UX-Audit-Report.docx";

// Canonical dimension order — matches the Audit Dimensions section of SKILL.md.
// Dimensions found in the CSV but not listed here are appended alphabetically.
const DIMENSION_ORDER = [
  "Usability Heuristics", "Accessibility", "Visual Design", "Information Architecture",
  "Content & Microcopy", "User Flows", "Mobile/Responsive", "Healthcare-Specific"
];

// ============================================================================
// CSV parsing (RFC4180-ish: quoted fields, embedded commas/quotes/newlines)
// ============================================================================

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const filtered = rows.filter(r => r.some(f => f.trim() !== ""));
  const header = filtered[0].map(h => h.trim());
  return filtered.slice(1).map(r => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
    return obj;
  });
}

function normKey(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }

function pick(rowObj, candidates) {
  const normMap = {};
  Object.keys(rowObj).forEach(k => { normMap[normKey(k)] = k; });
  for (const c of candidates) {
    const nk = normKey(c);
    if (normMap[nk] !== undefined) return rowObj[normMap[nk]];
  }
  return "";
}

// ============================================================================
// Verification values (see SKILL.md Finding Documentation)
// ============================================================================

const VERIFICATION = {
  AUTOMATED: "Automated-confirmed",
  OBSERVED: "Observed live",
  INFERRED: "Inferred \u2014 needs human check"
};

// Loose match so "automated", "Observed-live", "inferred - needs human check"
// etc. all resolve. Unrecognized non-empty values are kept as-is (and warned).
function normVerification(v) {
  const k = normKey(v);
  if (!k) return "";
  if (k.startsWith("automated")) return VERIFICATION.AUTOMATED;
  if (k.startsWith("observed")) return VERIFICATION.OBSERVED;
  if (k.startsWith("inferred")) return VERIFICATION.INFERRED;
  return v;
}

// ============================================================================
// Severity x Scope deduction table (see SKILL.md Scoring)
// ============================================================================

const SEVERITY_SCOPE_TABLE = {
  Critical: { "Site-wide": -8, "Page-level": -5, "Element-level": -3 },
  Major: { "Site-wide": -5, "Page-level": -3, "Element-level": -2 },
  Minor: { "Site-wide": -2, "Page-level": -1.5, "Element-level": -1 },
  Cosmetic: { "Site-wide": -1, "Page-level": -0.5, "Element-level": -0.5 }
};

function ratingFor(pct) {
  if (pct >= 90) return "Excellent";
  if (pct >= 75) return "Good";
  if (pct >= 60) return "Needs Improvement";
  if (pct >= 40) return "Poor";
  return "Critical";
}

function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

// ============================================================================
// Load and normalize findings.csv
// ============================================================================

const EVIDENCE_KEYS = ["Evidence"];
const VERIFICATION_KEYS = ["Verification", "Verified", "Verification Status"];
const INSTANCES_KEYS = ["Instances", "Instance List", "Occurrences"];

function hasColumn(rows, candidates) {
  if (!rows.length) return false;
  const keys = Object.keys(rows[0]).map(normKey);
  return candidates.some(c => keys.includes(normKey(c)));
}

const EVIDENCE_COLUMNS_PRESENT = {};

function loadFindings(csvPath) {
  const raw = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(raw);

  // v1.5 evidence columns are optional for back-compat: warn, never fail.
  [["Evidence", EVIDENCE_KEYS], ["Verification", VERIFICATION_KEYS], ["Instances", INSTANCES_KEYS]]
    .forEach(([name, keys]) => { EVIDENCE_COLUMNS_PRESENT[name] = hasColumn(rows, keys); });
  const missingCols = Object.keys(EVIDENCE_COLUMNS_PRESENT).filter(n => !EVIDENCE_COLUMNS_PRESENT[n]);
  if (missingCols.length) {
    console.warn(`Warning: ${csvPath} has no ${missingCols.join("/")} column(s) (pre-v1.5 format). The doc will build, but findings won't show what they're based on or how they were confirmed.`);
  }

  return rows.map(r => {
    const severity = pick(r, ["Severity"]);
    const scope = pick(r, ["Scope"]);
    return {
      id: pick(r, ["ID"]),
      dimension: pick(r, ["Dimension"]),
      severity,
      scope,
      reference: pick(r, ["Standard/Heuristic", "Standard", "Heuristic", "Reference", "WCAG"]),
      location: pick(r, ["Location"]),
      observation: pick(r, ["Observation"]),
      impact: pick(r, ["Impact"]),
      recommendation: pick(r, ["Recommendation"]),
      glance: pick(r, ["At a Glance", "At-a-Glance", "AtAGlance"]),
      priorityScore: parseFloat(pick(r, ["Priority Score", "Priority"])) || 0,
      evidence: pick(r, EVIDENCE_KEYS),
      verification: normVerification(pick(r, VERIFICATION_KEYS)),
      instances: pick(r, INSTANCES_KEYS)
    };
  });
}

// ============================================================================
// Load audit-meta.json (with sensible fallbacks if fields are missing)
// ============================================================================

function loadMeta(metaPath) {
  const defaults = {
    siteName: "example-site.com",
    preparedBy: "Relevate Health",
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    pagesAudited: "[Pages/flows audited]",
    sampleNote: null,
    overallNarrative: "[Add a 1-2 sentence plain-language summary of where the site stands and what matters most.]",
    roadmapArc: null,
    roadmapPhases: [],
    methodology: [
      "Nielsen Norman Group's 10 Usability Heuristics",
      "WCAG 2.1 Level AA",
      "Healthcare UX best practices (health literacy, trust signals, regulatory UX)"
    ]
  };
  if (!fs.existsSync(metaPath)) {
    console.warn(`Warning: ${metaPath} not found — using placeholder metadata. Copy assets/audit-meta.example.json and fill it in for a real deliverable.`);
    return defaults;
  }
  const userMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  return { ...defaults, ...userMeta };
}

// ============================================================================
// Derive report data (dimension scores, severity counts, priorities, scoring rows)
// ============================================================================

function buildAuditData(findings, meta) {
  const byDim = {};
  findings.forEach(f => {
    if (!byDim[f.dimension]) byDim[f.dimension] = [];
    byDim[f.dimension].push(f);
  });

  const orderedDimNames = [
    ...DIMENSION_ORDER.filter(d => byDim[d]),
    ...Object.keys(byDim).filter(d => !DIMENSION_ORDER.includes(d)).sort()
  ];

  const dimensions = orderedDimNames.map(name => {
    const dimFindings = byDim[name];
    const totalDeduction = dimFindings.reduce((sum, f) => {
      const table = SEVERITY_SCOPE_TABLE[f.severity];
      const d = table && table[f.scope] !== undefined ? table[f.scope] : 0;
      if (!table || table[f.scope] === undefined) {
        console.warn(`Warning: no deduction found for ${f.id} (Severity="${f.severity}", Scope="${f.scope}") — treated as 0.`);
      }
      return sum + d;
    }, 0);
    const score = Math.max(0, 50 + totalDeduction);
    return { name, score: `${fmtNum(score)} / 50`, rating: ratingFor((score / 50) * 100), findings: dimFindings, _scoreNum: score };
  });

  const dimensionScores = dimensions.map(d => ({ name: d.name, score: d.score, rating: d.rating }));

  const overallPct = dimensions.length
    ? (dimensions.reduce((s, d) => s + d._scoreNum, 0) / (50 * dimensions.length)) * 100
    : 0;

  const severityCounts = { Critical: 0, Major: 0, Minor: 0, Cosmetic: 0 };
  findings.forEach(f => { if (severityCounts[f.severity] !== undefined) severityCounts[f.severity]++; });

  const topPriorities = [...findings]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5)
    .map(f => ({ id: f.id, glance: f.glance || f.observation }));

  const scoringRows = findings.map(f => {
    const table = SEVERITY_SCOPE_TABLE[f.severity];
    const d = table && table[f.scope] !== undefined ? table[f.scope] : 0;
    return { id: f.id, severity: f.severity, scope: f.scope, deduction: fmtNum(d) };
  });

  return {
    siteName: meta.siteName,
    preparedBy: meta.preparedBy,
    date: meta.date,
    pagesAudited: meta.pagesAudited,
    sampleNote: meta.sampleNote,
    overallHealthPct: `${fmtNum(overallPct)}%`,
    overallRating: ratingFor(overallPct),
    overallNarrative: meta.overallNarrative,
    dimensionScores,
    severityCounts,
    topPriorities,
    roadmapArc: meta.roadmapArc,
    roadmapPhases: meta.roadmapPhases,
    dimensions: dimensions.map(d => ({ name: d.name, score: d.score, findings: d.findings })),
    methodology: meta.methodology,
    scoringRows
  };
}

// ============================================================================
// BRAND PALETTE — placeholders, confirm against real brand guide
// ============================================================================

const NAVY = "14142B";
const PURPLE = "3D2C8D";
const LIME = "BEF264";
const TEAL = "2DD4BF";
const INK = "1A1A2E";
const MUTED = "5B5B72";
const LINE = "D8D8E4";
const WHITE = "FFFFFF";

// Severity uses the standard red/orange/yellow/gray convention — kept
// distinct from brand accent colors since severity meaning should read
// independently of brand styling.
const SEV_COLOR = { Critical: "C0392B", Major: "D9822B", Minor: "B7950B", Cosmetic: "7F8C8D" };
const SEV_LABEL = {
  Critical: "\u25CF CRITICAL", Major: "\u25CF MAJOR",
  Minor: "\u25CF MINOR", Cosmetic: "\u25CF COSMETIC"
};

// Display-formatted version (string values) for the appendix table — kept
// separate from the numeric SEVERITY_SCOPE_TABLE used for computation above.
const SEVERITY_SCOPE_DISPLAY = {
  Critical: { "Site-wide": "-8", "Page-level": "-5", "Element-level": "-3" },
  Major: { "Site-wide": "-5", "Page-level": "-3", "Element-level": "-2" },
  Minor: { "Site-wide": "-2", "Page-level": "-1.5", "Element-level": "-1" },
  Cosmetic: { "Site-wide": "-1", "Page-level": "-0.5", "Element-level": "-0.5" }
};

const FONT = "Inter";

// ============================================================================
// Rendering helpers
// ============================================================================

function heading(text, level) {
  return new Paragraph({
    heading: level,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, font: FONT, color: NAVY, bold: true })]
  });
}

function body(text) {
  return new Paragraph({
    spacing: { after: 120, line: 288 },
    children: [new TextRun({ text, font: FONT, color: INK, size: 21 })]
  });
}

function italicNote(text) {
  return new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({ text, font: FONT, color: MUTED, italics: true, size: 18 })]
  });
}

function labelValue(label, value) {
  return new Paragraph({
    spacing: { after: 80, line: 276 },
    children: [
      new TextRun({ text: `${label}: `, font: FONT, color: MUTED, bold: true, size: 20 }),
      new TextRun({ text: value, font: FONT, color: INK, size: 20 })
    ]
  });
}

// Small, muted line for supporting detail (Evidence, Verification, Instances).
function mutedLabelValue(label, value) {
  return new Paragraph({
    spacing: { after: 60, line: 252 },
    children: [
      new TextRun({ text: `${label}: `, font: FONT, color: MUTED, bold: true, size: 17 }),
      new TextRun({ text: value, font: FONT, color: MUTED, size: 17 })
    ]
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 120, after: 240 },
    border: { bottom: { color: LINE, space: 1, style: BorderStyle.SINGLE, size: 6 } },
    children: [new TextRun({ text: "" })]
  });
}

function spacer(after = 240) {
  return new Paragraph({ spacing: { after }, children: [new TextRun({ text: "" })] });
}

function atAGlance(text) {
  return new Paragraph({
    spacing: { before: 60, after: 200 },
    shading: { type: ShadingType.CLEAR, fill: "F2FBF9" },
    indent: { left: 200, right: 200 },
    border: { left: { color: TEAL, space: 8, style: BorderStyle.SINGLE, size: 24 } },
    children: [
      new TextRun({ text: "AT A GLANCE  ", font: FONT, color: TEAL, bold: true, size: 17 }),
      new TextRun({ text, font: FONT, color: INK, italics: true, size: 20 })
    ]
  });
}

function findingHeading(id, severity, scope) {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    children: [
      new TextRun({ text: id + "   ", font: FONT, color: NAVY, bold: true, size: 24 }),
      new TextRun({ text: SEV_LABEL[severity] + "   ", font: FONT, color: SEV_COLOR[severity], bold: true, size: 18 }),
      new TextRun({ text: scope.toUpperCase(), font: FONT, color: MUTED, bold: true, size: 18 })
    ]
  });
}

function simpleTable(headerRow, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const mkCell = (text, isHeader, width) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: isHeader ? { type: ShadingType.CLEAR, fill: NAVY } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      children: [new TextRun({
        text: String(text), font: FONT, bold: isHeader,
        color: isHeader ? WHITE : INK, size: isHeader ? 18 : 19
      })]
    })]
  });
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({ tableHeader: true, children: headerRow.map((h, i) => mkCell(h, true, colWidths[i])) }),
      ...rows.map(r => new TableRow({ children: r.map((c, i) => mkCell(c, false, colWidths[i])) }))
    ]
  });
}

function findingBlock(f) {
  return [
    findingHeading(f.id, f.severity, f.scope),
    labelValue("Reference", f.reference),
    // v1.5 evidence fields — omitted when empty so pre-v1.5 CSVs render as before.
    ...(f.evidence ? [mutedLabelValue("Evidence", f.evidence)] : []),
    ...(f.verification ? [mutedLabelValue("Verification", f.verification)] : []),
    ...(f.instances ? [mutedLabelValue("Instances", f.instances)] : []),
    labelValue("Location", f.location),
    labelValue("Observation", f.observation),
    labelValue("Impact", f.impact),
    labelValue("Recommendation", f.recommendation),
    atAGlance(f.glance)
  ];
}

// ============================================================================
// Build document
// ============================================================================

function build(data) {
  const coverChildren = [
    new Paragraph({
      spacing: { before: 2400, after: 400 },
      children: [
        new TextRun({ text: "relevate", font: FONT, color: NAVY, bold: true, size: 32 }),
        new TextRun({ text: "health", font: FONT, color: TEAL, bold: true, size: 32 })
      ]
    }),
    new Paragraph({
      spacing: { before: 1200, after: 200 },
      children: [new TextRun({ text: "UX Audit Report", font: FONT, color: NAVY, bold: true, size: 56 })]
    }),
    new Paragraph({
      spacing: { after: 1600 },
      children: [new TextRun({ text: data.siteName, font: FONT, color: PURPLE, size: 28 })]
    }),
    labelValue("Prepared by", data.preparedBy),
    labelValue("Date", data.date),
    labelValue("Pages / Flows Audited", data.pagesAudited)
  ];
  if (data.sampleNote) coverChildren.push(spacer(0), italicNote(data.sampleNote));

  const execChildren = [
    heading("Executive Summary", HeadingLevel.HEADING_1),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: "Overall Site Health: ", font: FONT, color: INK, bold: true, size: 24 }),
        new TextRun({ text: `${data.overallHealthPct} — ${data.overallRating}`, font: FONT, color: TEAL, bold: true, size: 24 })
      ]
    }),
    body(data.overallNarrative)
  ];
  if (data.sampleNote) execChildren.push(italicNote(data.sampleNote));
  execChildren.push(
    heading("At a Glance", HeadingLevel.HEADING_2),
    simpleTable(
      ["Dimension", "Score", "Rating"],
      data.dimensionScores.map(d => [d.name, d.score, d.rating]),
      [4500, 2000, 2000]
    ),
    spacer(),
    heading("Issues by Severity", HeadingLevel.HEADING_2),
    simpleTable(
      ["Severity", "Count"],
      Object.entries(data.severityCounts).map(([k, v]) => [k, String(v)]),
      [4500, 2000]
    ),
    spacer(),
    heading("Top Priorities", HeadingLevel.HEADING_2),
    ...data.topPriorities.map((p, i) => new Paragraph({
      spacing: { after: 140 },
      children: [
        new TextRun({ text: `${i + 1}. `, font: FONT, color: NAVY, bold: true, size: 20 }),
        new TextRun({ text: `${p.id} — `, font: FONT, color: PURPLE, bold: true, size: 20 }),
        new TextRun({ text: p.glance, font: FONT, color: INK, size: 20 })
      ]
    })),
    divider(),
    heading("Roadmap at a Glance", HeadingLevel.HEADING_2)
  );
  if (data.roadmapArc) {
    execChildren.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: data.roadmapArc, font: FONT, color: PURPLE, italics: true, bold: true, size: 22 })]
    }));
  }
  execChildren.push(simpleTable(
    ["Phase", "Focus", "Timeframe"],
    data.roadmapPhases.map(p => [p.name, p.focus, p.timeframe]),
    [2600, 5000, 1900]
  ));

  const findingsChildren = [new Paragraph({ children: [new PageBreak()] }), heading("Detailed Findings", HeadingLevel.HEADING_1)];
  data.dimensions.forEach((dim, i) => {
    findingsChildren.push(heading(`${dim.name} — Score: ${dim.score}`, HeadingLevel.HEADING_2));
    dim.findings.forEach(f => findingsChildren.push(...findingBlock(f)));
    if (i < data.dimensions.length - 1) findingsChildren.push(divider());
  });

  const scoringRows = data.scoringRows;

  const appendixChildren = [
    new Paragraph({ children: [new PageBreak()] }),
    heading("Appendix", HeadingLevel.HEADING_1),
    heading("A. Methodology", HeadingLevel.HEADING_2),
    ...data.methodology.map(t => new Paragraph({
      spacing: { after: 80 }, bullet: { level: 0 },
      children: [new TextRun({ text: t, font: FONT, color: INK, size: 20 })]
    })),
    heading("B. Scoring Calculations", HeadingLevel.HEADING_2),
    body("Dimension scores use the Severity \u00D7 Scope deduction table, not a flat per-severity deduction — findings with the same Severity but different Scope are weighted differently."),
    spacer(200),
    simpleTable(
      ["Finding", "Severity", "Scope", "Deduction"],
      scoringRows.map(r => [r.id, r.severity, r.scope, r.deduction]),
      [2500, 2000, 2400, 1600]
    ),
    spacer(280),
    heading("C. Severity \u00D7 Scope Deduction Table", HeadingLevel.HEADING_2),
    simpleTable(
      ["Severity", "Site-wide", "Page-level", "Element-level"],
      Object.entries(SEVERITY_SCOPE_DISPLAY).map(([sev, s]) => [sev, s["Site-wide"], s["Page-level"], s["Element-level"]]),
      [2500, 2100, 2100, 2100]
    )
  ];

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 21, color: INK } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "relevate", font: FONT, color: NAVY, bold: true, size: 16 }),
              new TextRun({ text: "health", font: FONT, color: TEAL, bold: true, size: 16 })
            ]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "UX Audit Report   ", font: FONT, color: MUTED, size: 16 }),
              new TextRun({ text: "Page ", font: FONT, color: MUTED, size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, color: MUTED, size: 16 })
            ]
          })]
        })
      },
      children: [
        ...coverChildren,
        new Paragraph({ children: [new PageBreak()] }),
        ...execChildren,
        ...findingsChildren,
        ...appendixChildren
      ]
    }]
  });
}

const findings = loadFindings(CSV_PATH);

// Verification gate (see SKILL.md): Inferred findings may not appear in a
// client deliverable until a human changes the value.
const KNOWN_VERIFICATION = Object.values(VERIFICATION);
// Per-row blanks are only reported when the column exists; a missing column
// was already reported once by loadFindings.
[["Evidence", "evidence"], ["Verification", "verification"]].forEach(([label, field]) => {
  if (!EVIDENCE_COLUMNS_PRESENT[label]) return;
  const blank = findings.filter(f => !f[field]).map(f => f.id);
  if (blank.length) console.warn(`Warning: ${label} is empty for ${blank.join(", ")}.`);
});
const unknownVerification = findings.filter(f => f.verification && !KNOWN_VERIFICATION.includes(f.verification));
if (unknownVerification.length) {
  console.warn(`Warning: unrecognized Verification value on ${unknownVerification.map(f => `${f.id} ("${f.verification}")`).join(", ")}. Use ${KNOWN_VERIFICATION.join(" | ")}.`);
}
const inferred = findings.filter(f => f.verification === VERIFICATION.INFERRED).map(f => f.id);
if (inferred.length) {
  const msg = `${inferred.length} finding(s) marked "${VERIFICATION.INFERRED}": ${inferred.join(", ")}. These may not appear in a client deliverable until a human verifies them and changes the value.`;
  if (STRICT) {
    console.error(`Error (--strict): ${msg}`);
    process.exit(1);
  }
  console.warn(`Warning: ${msg}`);
}

const meta = loadMeta(META_PATH);
const auditData = buildAuditData(findings, meta);

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
Packer.toBuffer(build(auditData)).then(buf => {
  fs.writeFileSync(OUTPUT_PATH, buf);
  console.log(`Written to ${OUTPUT_PATH} (${findings.length} findings across ${auditData.dimensions.length} dimensions).`);
});
