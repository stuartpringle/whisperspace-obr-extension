import React, { useMemo, useRef, useState, useEffect } from "react";
import rulesData from "../data/generated/rules.json";
import { resolveWeaponKeyword, splitKeywordList } from "./weaponKeywords";

type RuleSpan = {
  text?: string;
};

type RuleBlock =
  | { type: "paragraph"; text: string; spans?: RuleSpan[] }
  | { type: "list"; ordered?: boolean; items?: { text: string; spans?: RuleSpan[] }[] }
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

type LabeledTable = { label: string; block: RuleBlock };

function getSectionId(section: RuleSection) {
  return section.slug || section.title.toLowerCase().replace(/\s+/g, "-");
}

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

function collectLabeledTables(section: RuleSection, out: LabeledTable[] = []) {
  const content = section.content ?? [];
  for (const block of content) {
    if (block.type !== "table") continue;
    const firstRow = block.rows?.[0] ?? [];
    if (firstRow.length !== 1) continue;
    const label = String(firstRow[0]?.text ?? "").trim();
    if (!label) continue;
    out.push({ label, block });
  }
  (section.sections ?? []).forEach((s) => collectLabeledTables(s, out));
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
  if (block.type === "list") {
    const items = block.items ?? [];
    if (!items.length) return null;
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag key={`list-${idx}`} style={{ margin: "6px 0 6px 18px", padding: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{ margin: "4px 0", lineHeight: 1.4 }}>
            {highlightText(item.text ?? "", q)}
          </li>
        ))}
      </ListTag>
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

function RuleSectionView(props: { section: RuleSection; depth?: number; expandAll?: boolean; query?: string; tablesByLabel?: Map<string, RuleBlock> }) {
  const depth = props.depth ?? 0;
  const content = normalizeContent(props.section.content ?? []);
  const hasChildren = (props.section.sections ?? []).length > 0;
  const headerSize = Math.max(14, 20 - depth * 2);
  const pad = depth * 12;
  const id = getSectionId(props.section);
  const q = props.query ?? "";
  const fallbackTable = props.tablesByLabel?.get(props.section.title.toLowerCase());
  const hasLabeledTableInContent = content.some((block) => {
    if (block.type !== "table") return false;
    const firstRow = block.rows?.[0] ?? [];
    if (firstRow.length !== 1) return false;
    const label = String(firstRow[0]?.text ?? "").trim().toLowerCase();
    return label === props.section.title.toLowerCase();
  });
  const shouldInjectTable = !!fallbackTable && !hasLabeledTableInContent;

  if (depth === 0) {
    return (
      <div id={id} style={{ marginLeft: pad, marginTop: 0 }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 22 }}>{props.section.title}</h2>
        <div>
          {content.map((b, i) => renderBlock(b, i, q))}
          {hasChildren && (props.section.sections ?? []).map((s, i) => (
            <RuleSectionView
              key={`${s.slug ?? s.title}-${i}`}
              section={s}
              depth={depth + 1}
              expandAll={props.expandAll}
              query={q}
              tablesByLabel={props.tablesByLabel}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div id={id} style={{ marginLeft: pad, marginTop: depth ? 8 : 0 }}>
      <details open={props.expandAll || depth < 2}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: headerSize }}>
          {highlightText(props.section.title, q)}
        </summary>
        <div>
          {shouldInjectTable ? renderBlock(fallbackTable!, 0, q) : null}
          {content.map((b, i) => renderBlock(b, i, q))}
          {hasChildren && (props.section.sections ?? []).map((s, i) => (
            <RuleSectionView
              key={`${s.slug ?? s.title}-${i}`}
              section={s}
              depth={depth + 1}
              expandAll={props.expandAll}
              query={q}
              tablesByLabel={props.tablesByLabel}
            />
          ))}
        </div>
      </details>
    </div>
  );
}

export function RulesApp() {
  const [query, setQuery] = useState("");
  const [searchSelection, setSearchSelection] = useState<string>("");
  const [rules, setRules] = useState<RuleDoc[]>(() => {
    try {
      const cached = localStorage.getItem("ws_rules_cache_v1");
      if (cached) return JSON.parse(cached) as RuleDoc[];
    } catch {}
    return rulesData as RuleDoc[];
  });
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const API_BASE = "https://whisperspace.com/rules-api/latest";

    async function loadLatest() {
      try {
        const metaRes = await fetch(`${API_BASE}/meta.json`, { cache: "no-store" });
        if (!metaRes.ok) return;
        const meta = await metaRes.json();
        const cachedMetaRaw = localStorage.getItem("ws_rules_meta_v1");
        const cachedMeta = cachedMetaRaw ? JSON.parse(cachedMetaRaw) : null;
        const cachedRulesRaw = localStorage.getItem("ws_rules_cache_v1");

        if (!cachedMeta || cachedMeta.version !== meta.version) {
          const rulesRes = await fetch(`${API_BASE}/rules.json`, { cache: "no-store" });
          if (!rulesRes.ok) return;
          const data = (await rulesRes.json()) as RuleDoc[];
          if (cancelled) return;
          localStorage.setItem("ws_rules_meta_v1", JSON.stringify(meta));
          localStorage.setItem("ws_rules_cache_v1", JSON.stringify(data));
          setRules(data);
        } else if (cachedRulesRaw) {
          if (cancelled) return;
          setRules(JSON.parse(cachedRulesRaw) as RuleDoc[]);
        }
      } catch {
        // ignore network errors; fallback to bundled data
      }
    }

    loadLatest();
    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const [activeSlug, setActiveSlug] = useState<string>(() => {
    const first = rules[0];
    return getSectionId(first) || "";
  });
  const filtered = useMemo(() => {
    if (!q) return rules;
    return rules.map((doc) => filterSection(doc, q)).filter(Boolean) as RuleDoc[];
  }, [q, rules]);

  const toc = rules.map((doc) => ({
    title: doc.title,
    slug: getSectionId(doc),
  }));

  const activeDoc = useMemo(() => {
    const slug = q && searchSelection ? searchSelection : activeSlug;
    return rules.find((d) => getSectionId(d) === slug) ?? rules[0];
  }, [rules, activeSlug, q, searchSelection]);

  const tablesByLabel = useMemo(() => {
    if (!activeDoc) return new Map<string, RuleBlock>();
    const labeled = collectLabeledTables(activeDoc, []);
    const map = new Map<string, RuleBlock>();
    for (const entry of labeled) {
      const key = entry.label.toLowerCase();
      if (!map.has(key)) map.set(key, entry.block);
    }
    return map;
  }, [activeDoc]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[id]"));
    if (!targets.length) return;

    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const nextId = (visible[0].target as HTMLElement).id;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setActiveSectionId(nextId));
      },
      { root: null, rootMargin: "0px 0px -70% 0px", threshold: [0, 0.1, 0.25, 0.5] }
    );

    targets.forEach((t) => observer.observe(t));
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [activeDoc, q]);

  const renderSectionTree = (section: RuleSection, depth: number) => {
    const id = getSectionId(section);
    const children = section.sections ?? [];
    const isActive = id === activeSectionId;
    return (
      <div key={`${id}-${depth}`} style={{ marginLeft: depth * 12 }}>
        <button
          onClick={() => {
            setQuery("");
            setTimeout(() => {
              const el = document.getElementById(id);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 0);
          }}
          style={{
            textAlign: "left",
            background: "transparent",
            border: `1px solid ${isActive ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 6,
            padding: "4px 6px",
            cursor: "pointer",
            color: "inherit",
            width: "100%",
            boxShadow: isActive ? "0 0 0 1px rgba(255,255,255,0.35) inset" : "none",
          }}
        >
          {section.title}
        </button>
        {children.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
            {children.map((child) => renderSectionTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, padding: 12 }}>
      <aside style={{ position: "sticky", top: 12, alignSelf: "start" }}>
        <h3 style={{ margin: "0 0 8px 0" }}>Contents</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {toc.map((t) => {
            const isActive = t.slug === activeSlug;
            const doc = rules.find((d) => getSectionId(d) === t.slug);
            return (
              <div key={t.slug} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button
                  onClick={() => {
                    setActiveSlug(t.slug);
                    setQuery("");
                  }}
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    border: `1px solid ${isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)"}`,
                    borderRadius: 8,
                    padding: "6px 8px",
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  {t.title}
                </button>
                {!q && isActive && doc?.sections?.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {doc.sections.map((section) => renderSectionTree(section, 1))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>

      <main ref={contentRef}>
        <h2 style={{ margin: "0 0 8px 0" }}>Whisperspace Rules Reference</h2>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search rules…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchSelection("");
            }}
            style={{
              width: "100%",
              padding: "8px 34px 8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "inherit",
            }}
          />
          {query ? (
            <button
              onClick={() => {
                setQuery("");
                setSearchSelection("");
              }}
              aria-label="Clear search"
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: 4,
              }}
            >
              ×
            </button>
          ) : null}
        </div>

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
                      setSearchSelection(slug);
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
              tablesByLabel={tablesByLabel}
            />
          )
        )}
        {q && searchSelection && activeDoc ? (
          <RuleSectionView
            key={`search-${activeDoc.slug ?? activeDoc.title}`}
            section={activeDoc}
            depth={0}
            expandAll={false}
            query={q}
            tablesByLabel={tablesByLabel}
          />
        ) : null}
      </main>
    </div>
  );
}
