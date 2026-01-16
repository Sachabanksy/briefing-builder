import { useState, useEffect } from "react";
import { Search, Check, X, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getTopics, getSeries } from "@/lib/api";
import { useBriefingStore } from "@/stores/briefingStore";
import type { Series, Tone, Length } from "@/types/briefing";
import { cn } from "@/lib/utils";

interface BriefingFormData {
  topic: string;
  userRequest: string;
  asOf: "latest" | string;
  lookbackPeriods: number;
  includeOecd: boolean;
  tone: Tone;
  length: Length;
}

interface BriefingCreationFormProps {
  onSubmit: (data: BriefingFormData) => void;
  isLoading: boolean;
}

export function BriefingCreationForm({ onSubmit, isLoading }: BriefingCreationFormProps) {
  const [topics, setTopics] = useState<string[]>([]);
  const [availableSeries, setAvailableSeries] = useState<Series[]>([]);
  const [seriesSearch, setSeriesSearch] = useState("");
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);

  const { selectedSeries, toggleSeriesSelection, clearSelectedSeries } = useBriefingStore();

  const [formData, setFormData] = useState<BriefingFormData>({
    topic: "all",
    userRequest: "",
    asOf: "latest",
    lookbackPeriods: 24,
    includeOecd: true,
    tone: "ministerial",
    length: "one_page",
  });

  // Load topics on mount
  useEffect(() => {
    getTopics()
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);

  // Load series when topic changes
  useEffect(() => {
    setIsLoadingSeries(true);
    getSeries(formData.topic === "all" ? undefined : formData.topic, seriesSearch || undefined)
      .then(setAvailableSeries)
      .catch(() => setAvailableSeries([]))
      .finally(() => setIsLoadingSeries(false));
  }, [formData.topic, seriesSearch]);

  useEffect(() => {
    clearSelectedSeries();
  }, [formData.topic, clearSelectedSeries]);

  const topicOptions = ["all", ...topics.filter((topic, index, arr) => arr.indexOf(topic) === index)];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const isSeriesSelected = (series: Series) =>
    selectedSeries.some(
      (s) => s.source === series.source && s.source_series_id === series.source_series_id
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Topic Selection */}
      <div className="space-y-2">
        <Label htmlFor="topic">Topic</Label>
        <Select
          value={formData.topic}
          onValueChange={(value) => setFormData({ ...formData, topic: value })}
        >
          <SelectTrigger id="topic">
            <SelectValue placeholder="Select a topic" />
          </SelectTrigger>
          <SelectContent>
            {topicOptions.map((topic) => (
              <SelectItem key={topic} value={topic}>
                {topic === "all" ? "All categories" : <span className="capitalize">{topic}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Series Explorer */}
      <div className="space-y-3 animate-fade-in">
        <Label>Data Series (Optional)</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search series..."
            value={seriesSearch}
            onChange={(e) => setSeriesSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Selected Series */}
        {selectedSeries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedSeries.map((series) => (
              <Badge
                key={`${series.source}:${series.source_series_id}`}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {series.name}
                <button
                  type="button"
                  onClick={() => toggleSeriesSelection(series)}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Available Series */}
        <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
          {isLoadingSeries ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading series...
            </div>
          ) : availableSeries.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No series found for this filter. Confirm the metadata category in
              <code className="mx-1 font-mono text-xs">economic_data_sources.metadata-&gt;&gt;'category'</code>{" "}
              matches “{formData.topic}” or clear the filter.
            </div>
          ) : (
            availableSeries.map((series) => {
              const selected = isSeriesSelected(series);
              return (
                <button
                  key={`${series.source}:${series.source_series_id}`}
                  type="button"
                  onClick={() => toggleSeriesSelection(series)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-3",
                    selected && "bg-accent/10"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mt-0.5",
                      selected
                        ? "bg-accent border-accent text-accent-foreground"
                        : "border-input"
                    )}
                  >
                    {selected && <Check className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{series.name}</div>
                    <div className="text-xs text-muted-foreground flex flex-col gap-0.5 mt-0.5">
                      <span className="font-mono">
                        {series.source}:{series.source_series_id}
                      </span>
                      <span>
                        Dataset: {series.dataset_code ?? series.dataset_id ?? "—"} · Frequency:{" "}
                        {series.freq ?? "—"} · Unit: {series.unit ?? "—"}
                      </span>
                      <span>
                        Location: {series.location ?? "—"} · Subject: {series.subject ?? "—"} · Measure:{" "}
                        {series.measure ?? "—"}
                      </span>
                      <span>
                        Slug: <code className="font-mono">{series.slug}</code> · Window:{" "}
                        {series.time_filter ?? "default"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
      
      {/* User Request */}
      <div className="space-y-2">
        <Label htmlFor="userRequest">Request</Label>
        <Textarea
          id="userRequest"
          placeholder="Describe the briefing you need, e.g., 'Create a ministerial inflation briefing for the latest month. Include drivers and risks.'"
          value={formData.userRequest}
          onChange={(e) => setFormData({ ...formData, userRequest: e.target.value })}
          className="min-h-[100px] resize-none"
        />
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* As Of */}
        <div className="space-y-2">
          <Label htmlFor="asOf">As of Date</Label>
          <Select
            value={formData.asOf}
            onValueChange={(value) => setFormData({ ...formData, asOf: value })}
          >
            <SelectTrigger id="asOf">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest available</SelectItem>
              <SelectItem value="2025-12-01">December 2025</SelectItem>
              <SelectItem value="2025-11-01">November 2025</SelectItem>
              <SelectItem value="2025-10-01">October 2025</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lookback */}
        <div className="space-y-2">
          <Label htmlFor="lookback">Lookback Periods</Label>
          <Select
            value={formData.lookbackPeriods.toString()}
            onValueChange={(value) =>
              setFormData({ ...formData, lookbackPeriods: parseInt(value) })
            }
          >
            <SelectTrigger id="lookback">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12 months</SelectItem>
              <SelectItem value="24">24 months</SelectItem>
              <SelectItem value="36">36 months</SelectItem>
              <SelectItem value="60">60 months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tone */}
        <div className="space-y-2">
          <Label htmlFor="tone">Tone</Label>
          <Select
            value={formData.tone}
            onValueChange={(value: Tone) => setFormData({ ...formData, tone: value })}
          >
            <SelectTrigger id="tone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ministerial">Ministerial</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Length */}
        <div className="space-y-2">
          <Label htmlFor="length">Length</Label>
          <Select
            value={formData.length}
            onValueChange={(value: Length) => setFormData({ ...formData, length: value })}
          >
            <SelectTrigger id="length">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one_page">One page</SelectItem>
              <SelectItem value="two_page">Two pages</SelectItem>
              <SelectItem value="long">Long form</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Include OECD */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="includeOecd"
          checked={formData.includeOecd}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, includeOecd: checked as boolean })
          }
        />
        <Label htmlFor="includeOecd" className="text-sm cursor-pointer">
          Include OECD comparison data
        </Label>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={!formData.topic || !formData.userRequest.trim() || isLoading}
      >
        {isLoading ? (
          <>
            <Database className="w-4 h-4 mr-2 animate-pulse" />
            Generating Briefing...
          </>
        ) : (
          <>
            <Database className="w-4 h-4 mr-2" />
            Generate Briefing
          </>
        )}
      </Button>
    </form>
  );
}
