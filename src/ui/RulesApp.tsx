import React, { useMemo, useState } from "react";
import rulesData from "../data/generated/rules.json";
import { resolveWeaponKeyword, splitKeywordList } from "./weaponKeywords";

type RuleSpan = {
  text?: string;
};

type RuleBlock =
  | { type: "paragraph"; text: string; spans?: RuleSpan[] }
  | { type: "table"; rows: { text: string; spans?: RuleSpan[] }[][] };

type RuleSection = {
  title: string;
  slug?: string;
  level?: number;
  content?: RuleBlock[];
  sections?: RuleSection[];
};

type RuleDoc = RuleSection & {
  file?: string;
};

function flattenTableText(table: { rows: { text: string }[][] }) {
  return table.rows.flat().map((cell) => String(cell.text ?? ""));
}

function normalizeContent(content: RuleBlock[] = []) {
  const out: RuleBlock[] = [];
  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    out.push(block);
    if (block.type !== "table") continue;

    const tableTexts = flattenTableText(block).filter((t) => t.length > 0);
    if (!tableTexts.length) continue;

    let j = i + 1;
    for (let k = 0; k < tableTexts.length && j < content.length; k++, j++) {
      const next = content[j];
      if (next.type !== "paragraph") break;
      if (String(next.text ?? "") !== tableTexts[k]) break;
    }
    const duplicateCount = j - (i + 1);
    if (duplicateCount > 0) {
      i += duplicateCount;
    }
  }
  return out;
}

function highlightText(text: string, q: string) {
  if (!q) return text;
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const hit = lower.indexOf(qLower, i);
    if (hit === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (hit > i) parts.push(text.slice(i, hit));
    parts.push(
      <mark key={`${hit}-${qLower}`} style={{ background: "rgba(255,255,255,0.25)", color: "inherit" }}>
        {text.slice(hit, hit + q.length)}
      </mark>
    );
    i = hit + q.length;
  }
  return parts;
}

function renderKeywordText(text: string, q: string) {
  const parts = splitKeywordList(text);
  if (!parts.length) return highlightText(text, q);

  const resolved = parts.map((p) => resolveWeaponKeyword(p));
  if (resolved.some((r) => !r)) return highlightText(text, q);

  return parts.map((part, idx) => {
    const info = resolved[idx]!;
    return (
      <span key={`${part}-${idx}`} title={info.description}>
        <a
          href={`#${info.anchor}`}
          style={{ color: "inherit", textDecoration: "underline dotted" }}
        >
          {highlightText(part, q)}
        </a>
        {idx < parts.length - 1 ? ", " : null}
      </span>
    );
  });
}

function renderBlock(block: RuleBlock, idx: number, q: string) {
  if (block.type === "table") {
    const rows = block.rows ?? [];
    if (!rows.length) return null;
    const [head, ...body] = rows;
    const headerText = head.map((cell) => String(cell.text ?? "").toLowerCase());
    const isKeywordTable = headerText.some((h) => h.includes("keyword")) && headerText.length >= 2;
    return (
      <table key={`table-${idx}`} style={{ width: "100%", borderCollapse: "collapse", margin: "8px 0" }}>
        <thead>
          <tr>
            {head.map((cell, i) => (
              <th key={i} style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.2)", padding: "4px 6px" }}>
                {highlightText(cell.text, q)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr
              key={r}
              id={
                isKeywordTable
                  ? `weapon-keyword-${String(row[0]?.text ?? "")
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-+|-+$/g, "")}`
                  : undefined
              }
            >
              {row.map((cell, c) => (
                <td key={c} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)", padding: "4px 6px" }}>
                  {renderKeywordText(cell.text, q)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (block.type === "paragraph") {
    return (
      <p key={`p-${idx}`} style={{ margin: "6px 0", lineHeight: 1.4 }}>
        {highlightText(block.text, q)}
      </p>
    );
  }
  return null;
}

function sectionMatchesQuery(section: RuleSection, q: string): boolean {
  if (!q) return true;
  const hay = JSON.stringify(section).toLowerCase();
  return hay.includes(q);
}

function countQueryMatches(section: RuleSection, q: string): number {
  if (!q) return 0;
  const hay = JSON.stringify(section).toLowerCase();
  let count = 0;
  let idx = 0;
  while (true) {
    const hit = hay.indexOf(q, idx);
    if (hit === -1) break;
    count += 1;
    idx = hit + q.length;
  }
  return count;
}

function filterSection(section: RuleSection, q: string): RuleSection | null {
  if (!q) return section;
  const selfMatches = sectionMatchesQuery(section, q);
  const children = (section.sections ?? [])
    .map((s) => filterSection(s, q))
    .filter(Boolean) as RuleSection[];
  if (selfMatches || children.length > 0) {
    return { ...section, sections: children };
  }
  return null;
}

function RuleSectionView(props: { section: RuleSection; depth?: number; expandAll?: boolean; query?: string }) {
  const depth = props.depth ?? 0;
  const content = normalizeContent(props.section.content ?? []);
  const hasChildren = (props.section.sections ?? []).length > 0;
  const headerSize = Math.max(14, 20 - depth * 2);
  const pad = depth * 12;
  const id = props.section.slug || props.section.title.toLowerCase().replace(/\s+/g, "-");
  const q = props.query ?? "";

  return (
    <div id={id} style={{ marginLeft: pad, marginTop: depth ? 8 : 0 }}>
      <details open={props.expandAll || depth < 2}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: headerSize }}>
          {highlightText(props.section.title, q)}
        </summary>
        <div>
          {content.map((b, i) => renderBlock(b, i, q))}
          {hasChildren && (props.section.sections ?? []).map((s, i) => (
            <RuleSectionView key={`${s.slug ?? s.title}-${i}`} section={s} depth={depth + 1} expandAll={props.expandAll} query={q} />
          ))}
        </div>
      </details>
    </div>
  );
}

export function RulesApp() {
  const [query, setQuery] = useState("");
  const rules = rulesData as RuleDoc[];

  const q = query.trim().toLowerCase();
  const [activeSlug, setActiveSlug] = useState<string>(() => {
    const first = rules[0];
    return first?.slug || first?.title?.toLowerCase().replace(/\s+/g, "-") || "";
  });
  const filtered = useMemo(() => {
    if (!q) return rules;
    return rules.map((doc) => filterSection(doc, q)).filter(Boolean) as RuleDoc[];
  }, [q, rules]);

  const toc = rules.map((doc) => ({
    title: doc.title,
    slug: doc.slug || doc.title.toLowerCase().replace(/\s+/g, "-"),
  }));

  const activeDoc = useMemo(() => {
    return rules.find((d) => (d.slug || d.title.toLowerCase().replace(/\s+/g, "-")) === activeSlug) ?? rules[0];
  }, [rules, activeSlug]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, padding: 12 }}>
      <aside style={{ position: "sticky", top: 12, alignSelf: "start" }}>
        <h3 style={{ margin: "0 0 8px 0" }}>Contents</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {toc.map((t) => (
            <button
              key={t.slug}
              onClick={() => {
                setActiveSlug(t.slug);
                setQuery("");
              }}
              style={{
                textAlign: "left",
                background: "transparent",
                border: `1px solid ${t.slug === activeSlug ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)"}`,
                borderRadius: 8,
                padding: "6px 8px",
                cursor: "pointer",
                color: "inherit",
              }}
            >
              {t.title}
            </button>
          ))}
        </div>
      </aside>

      <main>
        <h2 style={{ margin: "0 0 8px 0" }}>Whisperspace Rules Reference</h2>
        <input
          type="text"
          placeholder="Search rules…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "inherit",
            marginBottom: 12,
          }}
        />

        {q ? (
          filtered.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No matches.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {filtered.map((doc) => {
                const slug = doc.slug || doc.title.toLowerCase().replace(/\s+/g, "-");
                const count = countQueryMatches(doc, q);
                return (
                  <button
                    key={slug}
                    onClick={() => {
                      setActiveSlug(slug);
                      setQuery("");
                    }}
                    style={{
                      textAlign: "left",
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: 8,
                      padding: "6px 8px",
                      cursor: "pointer",
                      color: "inherit",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span>{highlightText(doc.title, q)}</span>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>{count} entries</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          activeDoc && (
            <RuleSectionView
              key={activeDoc.slug ?? activeDoc.title}
              section={activeDoc}
              depth={0}
              expandAll={false}
              query=""
            />
          )
        )}
      </main>
    </div>
  );
}
