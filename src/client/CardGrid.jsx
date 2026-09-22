/**
 * Card Grid: responsive entry-point grid. Shows all scene cards as vertical
 * cards — a category-tinted icon tile, title, description, and a footer with
 * the category badge plus a hover-revealed "启动 →" affordance. Supports
 * category filtering and search.
 */
import * as React from "react";

const ICON_ELEMENTS = {
  "shield-check": (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  "chart-bar": (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  "document-text": (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
};

const CATEGORY_COLORS = {
  "寻优": "var(--dsw-alias-brand, #2d6cdf)",
  "测试": "var(--dsw-alias-success, #2e9e5b)",
  "通用": "var(--dsw-alias-warning, #d97706)"
};

export function CardGrid({ cards, t, onOpenCard }) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("全部");

  const categories = ["全部", ...new Set(cards.map((c) => c.category))];

  const filtered = cards.filter((card) => {
    const matchCategory = category === "全部" || card.category === category;
    const q = search.trim().toLowerCase();
    const matchSearch = q === "" ||
      card.title.toLowerCase().includes(q) ||
      card.description.toLowerCase().includes(q);
    return matchCategory && matchSearch;
  });

  return (
    <div className="dsh-wb-card-grid" data-dsh-workbench-grid="true">
      <div className="dsh-wb-toolbar">
        <input
          type="text"
          className="dsh-wb-search"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="dsh-wb-filters">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`dsh-wb-filter-chip${cat === category ? " dsh-wb-filter-chip-active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="dsh-wb-card-list">
        {filtered.map((card) => (
          <button
            key={card.id}
            type="button"
            className="dsh-wb-card"
            onClick={() => onOpenCard(card.id)}
          >
            <div
              className="dsh-wb-card-icon-tile"
              style={{ background: CATEGORY_COLORS[card.category] ?? "var(--dsw-alias-brand, #2d6cdf)" }}
            >
              {ICON_ELEMENTS[card.icon] ?? ICON_ELEMENTS["document-text"]}
            </div>
            <div className="dsh-wb-card-body">
              <span className="dsh-wb-card-title">{card.title}</span>
              <p className="dsh-wb-card-desc">{card.description}</p>
            </div>
            <div className="dsh-wb-card-footer">
              <span className="dsh-wb-card-category">{card.category}</span>
              <span className="dsh-wb-card-cta" aria-hidden="true">{t("launch")} →</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="dsh-wb-empty">—</div>
        )}
      </div>
    </div>
  );
}
