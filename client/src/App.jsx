import { useEffect, useState } from "react";

const DEBOUNCE_MS = 400;
const LIMIT = 12;
const API_URL = import.meta.env.VITE_API_URL || "";

const fmtDuration = (m) =>
  m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function pageWindow(page, pages) {
  const out = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++)
    out.push(p);
  return out;
}

export default function App() {
  const [meta, setMeta] = useState({ categories: [], levels: [], total: 0 });
  const [search, setSearch] = useState(""); // what the user is typing
  const [applied, setApplied] = useState({ search: "", page: 1 }); // debounced value + page
  const [categories, setCategories] = useState([]);
  const [levels, setLevels] = useState([]);
  const [sort, setSort] = useState("default");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [apiCalls, setApiCalls] = useState(0);

  useEffect(() => {
    getJson(`${API_URL}/api/meta`)
      .then(setMeta)
      .catch(() => {});
  }, []);

  // Step 2: debounce. Only update the applied search 400ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => {
      setApplied((a) =>
        a.search === search.trim() ? a : { search: search.trim(), page: 1 },
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Multi-parameter API query. AbortController cancels outdated requests.
  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      page: applied.page,
      limit: LIMIT,
      sort,
    });
    if (applied.search) params.set("search", applied.search);
    if (categories.length) params.set("category", categories.join(","));
    if (levels.length) params.set("level", levels.join(","));

    setLoading(true);
    setError("");
    setApiCalls((n) => n + 1);
    getJson(`${API_URL}/api/items?${params}`, ctrl.signal)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => ctrl.abort();
  }, [applied, categories, levels, sort, retry]);

  const toggle = (list, setList) => (value) => {
    setList(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    );
    setApplied((a) => ({ ...a, page: 1 }));
  };
  const goPage = (page) => {
    setApplied((a) => ({ ...a, page }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const clearAll = () => {
    setSearch("");
    setCategories([]);
    setLevels([]);
    setSort("default");
    setApplied({ search: "", page: 1 });
  };
  const hasFilters =
    search || categories.length || levels.length || sort !== "default";

  const items = data?.items || [];
  const from = data && data.total ? (data.page - 1) * data.limit + 1 : 0;
  const to = data ? from + items.length - (data.total ? 1 : 0) : 0;

  return (
    <div className="page">
      <header>
        <h1>Learning Catalog</h1>
        <p>Search {meta.total || 250} resources. Results update as you type.</p>
        <input
          className="search"
          type="search"
          placeholder="Search by title, e.g. Resource 42"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search resources"
        />
        <p className="debug">
          API requests made this session: <strong>{apiCalls}</strong> (typing is
          debounced by {DEBOUNCE_MS} ms)
        </p>
      </header>

      <div className="layout">
        <aside className="filters">
          <fieldset>
            <legend>Category</legend>
            {meta.categories.map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={categories.includes(c)}
                  onChange={() => toggle(categories, setCategories)(c)}
                />
                <span>{c}</span>
                <em>{data?.facets?.[c] ?? 0}</em>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Level</legend>
            {meta.levels.map((l) => (
              <label key={l}>
                <input
                  type="checkbox"
                  checked={levels.includes(l)}
                  onChange={() => toggle(levels, setLevels)(l)}
                />
                <span>{l}</span>
              </label>
            ))}
          </fieldset>
          <label className="sort">
            Sort by
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setApplied((a) => ({ ...a, page: 1 }));
              }}
            >
              <option value="default">Default</option>
              <option value="rating">Highest rated</option>
              <option value="duration">Shortest first</option>
              <option value="title">Title A-Z</option>
            </select>
          </label>
          {hasFilters && (
            <button className="ghost" onClick={clearAll}>
              Clear all filters
            </button>
          )}
        </aside>

        <section aria-busy={loading}>
          <p className="count" aria-live="polite">
            {data
              ? data.total
                ? `Showing ${from}-${to} of ${data.total} results`
                : "0 results"
              : "Loading..."}
          </p>

          {error && (
            <div className="state error">
              <p>{error}</p>
              <button onClick={() => setRetry((n) => n + 1)}>Try again</button>
            </div>
          )}

          {!error && !data && (
            <div className="grid">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="card skeleton" />
              ))}
            </div>
          )}

          {!error && data && items.length === 0 && !loading && (
            <div className="state">
              <p>
                <strong>No resources match your filters.</strong>
              </p>
              <p>Try a different keyword or remove a filter.</p>
              <button onClick={clearAll}>Clear all filters</button>
            </div>
          )}

          {!error && data && items.length > 0 && (
            <div className={"grid" + (loading ? " dim" : "")}>
              {items.map((it) => (
                <article className="card" key={it.id}>
                  <div className="tags">
                    <span className={"cat " + it.category.toLowerCase()}>
                      {it.category}
                    </span>
                    <span>{it.level}</span>
                  </div>
                  <h3>{it.title}</h3>
                  <p className="meta">
                    <span>{fmtDuration(it.durationMinutes)}</span>
                    <span className="rate">★ {it.rating.toFixed(1)}</span>
                  </p>
                </article>
              ))}
            </div>
          )}

          {data && data.pages > 1 && (
            <nav className="pager" aria-label="Pagination">
              <button
                disabled={data.page <= 1}
                onClick={() => goPage(data.page - 1)}
              >
                Previous
              </button>
              {pageWindow(data.page, data.pages).map((p) => (
                <button
                  key={p}
                  className={p === data.page ? "cur" : ""}
                  aria-current={p === data.page ? "page" : undefined}
                  onClick={() => goPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={data.page >= data.pages}
                onClick={() => goPage(data.page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
