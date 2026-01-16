"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createBriefing, EconomicSource, searchSeries } from "@/lib/api";

type SelectedSeries = {
  id: string;
  source: string;
  source_series_id: string;
  dataset_id?: string;
  alias?: string;
  label: string;
  provider: string;
};

export default function CreateBriefingForm() {
  const router = useRouter();
  const [topic, setTopic] = useState("inflation");
  const [userRequest, setUserRequest] = useState("Create a one-page ministerial briefing.");
  const [query, setQuery] = useState("");
  const [seriesResults, setSeriesResults] = useState<EconomicSource[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<SelectedSeries[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState("ministerial");
  const [length, setLength] = useState("one_page");
  const [lookback, setLookback] = useState(24);
  const [includeOECD, setIncludeOECD] = useState(true);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    setSearching(true);
    setMessage(null);
    try {
      const results = await searchSeries(topic, query);
      setSeriesResults(results);
      if (!results.length) {
        setMessage("No series found for that query.");
      }
    } catch (error) {
      setMessage("Unable to search series. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleAddSeries = (source: EconomicSource) => {
    const sourceSeriesId =
      source.series_id || source.subject || source.slug || `${source.provider}-${source.dataset_id || "unknown"}`;
    if (selectedSeries.some((item) => item.source === source.provider && item.source_series_id === sourceSeriesId)) {
      setMessage("Series already added.");
      return;
    }
    const next: SelectedSeries = {
      id: source.slug,
      source: source.provider,
      source_series_id: sourceSeriesId,
      dataset_id: source.dataset_id ?? source.dataset_code ?? undefined,
      alias: source.slug,
      label: source.description || source.slug,
      provider: source.provider,
    };
    setSelectedSeries((prev) => [...prev, next]);
    setMessage(null);
  };

  const handleRemoveSeries = (seriesId: string) => {
    setSelectedSeries((prev) => prev.filter((item) => item.id !== seriesId));
  };

  const handleCreate = async () => {
    setMessage(null);
    if (!selectedSeries.length) {
      setMessage("Select at least one data series.");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        topic,
        user_request: userRequest,
        selected_series: selectedSeries.map(({ source, source_series_id, dataset_id, alias }) => ({
          source,
          source_series_id,
          dataset_id,
          alias,
        })),
        options: {
          lookback_periods: lookback,
          include_oecd: includeOECD,
          tone,
          length,
        },
      };
      const response = await createBriefing(payload);
      setMessage("Briefing created. Redirecting…");
      router.push(`/briefings/${response.briefing_id}`);
    } catch (error) {
      setMessage("Failed to create briefing. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section style={{ padding: "32px", display: "grid", gap: "32px" }}>
      <header>
        <h1>Create a new briefing</h1>
        <p>Select data series and describe what briefing you need. The system will generate it using grounded data.</p>
      </header>

      <form onSubmit={handleSearch} style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <label style={{ display: "flex", flexDirection: "column" }}>
          Topic
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="inflation">Inflation</option>
            <option value="gdp">GDP</option>
            <option value="unemployment">Unemployment</option>
            <option value="trade">Trade</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column" }}>
          Search series
          <div style={{ display: "flex", gap: "8px" }}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. CPI 12-month rate" />
            <button type="submit" disabled={searching}>
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
        </label>
      </form>

      <div style={{ display: "flex", gap: "24px" }}>
        <div style={{ flex: 1 }}>
          <h3>Search results</h3>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            {seriesResults.map((series) => (
              <li key={series.slug} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{series.description || series.slug}</strong>
                    <p style={{ margin: "4px 0", color: "var(--muted)" }}>{series.provider}</p>
                  </div>
                  <button type="button" onClick={() => handleAddSeries(series)}>
                    Add
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex: 1 }}>
          <h3>Selected series</h3>
          {selectedSeries.length === 0 ? <p>No series selected yet.</p> : null}
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            {selectedSeries.map((series) => (
              <li
                key={series.id}
                style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", display: "flex", justifyContent: "space-between" }}
              >
                <div>
                  <strong>{series.label}</strong>
                  <p style={{ margin: 0, color: "var(--muted)" }}>
                    {series.provider} · {series.source_series_id}
                  </p>
                </div>
                <button type="button" onClick={() => handleRemoveSeries(series.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section style={{ display: "grid", gap: "16px" }}>
        <label style={{ display: "flex", flexDirection: "column" }}>
          Briefing request
          <textarea
            rows={4}
            value={userRequest}
            onChange={(event) => setUserRequest(event.target.value)}
            placeholder="Describe what the briefing should focus on..."
          />
        </label>
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <label style={{ display: "flex", flexDirection: "column" }}>
            Tone
            <select value={tone} onChange={(event) => setTone(event.target.value)}>
              <option value="ministerial">Ministerial</option>
              <option value="technical">Technical</option>
              <option value="public">Public</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column" }}>
            Length
            <select value={length} onChange={(event) => setLength(event.target.value)}>
              <option value="one_page">One page</option>
              <option value="two_page">Two pages</option>
              <option value="long">Long form</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column" }}>
            Lookback periods
            <input
              type="number"
              min={12}
              max={240}
              value={lookback}
              onChange={(event) => setLookback(Number(event.target.value))}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="checkbox" checked={includeOECD} onChange={(event) => setIncludeOECD(event.target.checked)} />
            Include OECD context
          </label>
        </div>
        <button type="button" onClick={handleCreate} disabled={creating}>
          {creating ? "Creating..." : "Create briefing"}
        </button>
        {message ? <p style={{ color: "var(--muted)" }}>{message}</p> : null}
      </section>
    </section>
  );
}
