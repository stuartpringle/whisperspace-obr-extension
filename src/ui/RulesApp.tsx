import React, { useMemo, useState } from "react";
import rulesData from "../data/generated/rules.json";

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

function renderBlock(block: RuleBlock, idx: number) {
  if (block.type === "table") {
    const rows = block.rows ?? [];
    if (!rows.length) return null;
    const [head, ...body] = rows;
    return (
      <table key={`table-${idx}`} style={{ width: "100%", borderCollapse: "collapse", margin: "8px 0" }}>
        <thead>
          <tr>
            {head.map((cell, i) => (
              <th key={i} style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.2)", padding: "4px 6px" }}>
                {cell.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)", padding: "4px 6px" }}>
                  {cell.text}
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
        {block.text}
      </p>
    );
  }
  return null;
}

function RuleSectionView(props: { section: RuleSection; depth?: number }) {
  const depth = props.depth ?? 0;
  const content = normalizeContent(props.section.content ?? []);
  const hasChildren = (props.section.sections ?? []).length > 0;
  const headerSize = Math.max(14, 20 - depth * 2);
  const pad = depth * 12;

  return (
    <div style={{ marginLeft: pad, marginTop: depth ? 8 : 0 }}>
      <details open={depth < 2}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: headerSize }}>
          {props.section.title}
        </summary>
        <div>
          {content.map((b, i) => renderBlock(b, i))}
          {hasChildren && (props.section.sections ?? []).map((s, i) => (
            <RuleSectionView key={`${s.slug ?? s.title}-${i}`} section={s} depth={depth + 1} />
          ))}
        </div>
      </details>
    </div>
  );
}

export function RulesApp() {
  const [query, setQuery] = useState("");
  const rules = rulesData as RuleDoc[];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((doc) => {
      const hay = JSON.stringify(doc).toLowerCase();
      return hay.includes(q);
    });
  }, [query, rules]);

  return (
    <div style={{ padding: 12 }}>
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

      {filtered.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No matches.</p>
      ) : (
        filtered.map((doc, i) => (
          <RuleSectionView key={`${doc.slug ?? doc.title}-${i}`} section={doc} depth={0} />
        ))
      )}
    </div>
  );
}
