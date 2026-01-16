import { GitBranch, Check } from "lucide-react";
import { useBriefingStore } from "@/stores/briefingStore";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export function VersionsPanel() {
  const { versions, currentVersionId, switchVersion, briefingId } = useBriefingStore();

  if (!briefingId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <GitBranch className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold mb-2">Version History</h3>
        <p className="text-sm text-muted-foreground">
          Generate a briefing to see version history here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 border-b sticky top-0 bg-background z-10">
        <h3 className="font-semibold flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          Version History
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {versions.length} version{versions.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="p-2">
        {versions
          .slice()
          .reverse()
          .map((version, index) => {
            const isActive = version.id === currentVersionId;
            const versionNumber = version.version_number ?? versions.length - index;

            return (
              <button
                key={version.id}
                onClick={() => switchVersion(version.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg mb-2 transition-colors",
                  isActive
                    ? "bg-accent/10 border border-accent"
                    : "hover:bg-muted border border-transparent"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm flex items-center gap-2">
                    Version {versionNumber}
                    {isActive && (
                      <Check className="w-3 h-3 text-accent" />
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {format(new Date(version.created_at), "HH:mm")}
                  </span>
                </div>
                {version.change_summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {version.change_summary}
                  </p>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}
