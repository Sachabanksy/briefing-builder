import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { QualityBanner as QualityBannerType } from "@/types/briefing";
import { cn } from "@/lib/utils";

interface QualityBannerProps {
  banner: QualityBannerType;
}

export function QualityBanner({ banner }: QualityBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    green: {
      icon: CheckCircle2,
      className: "quality-banner-green",
      iconColor: "text-status-green",
      label: "All checks passed",
    },
    amber: {
      icon: AlertTriangle,
      className: "quality-banner-amber",
      iconColor: "text-status-amber",
      label: "Attention needed",
    },
    red: {
      icon: XCircle,
      className: "quality-banner-red",
      iconColor: "text-status-red",
      label: "Issues detected",
    },
  };

  const config = statusConfig[banner.status];
  const Icon = config.icon;

  return (
    <div className={cn("rounded-r p-4 mb-6 animate-fade-in", config.className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start justify-between text-left"
      >
        <div className="flex items-start gap-3">
          <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", config.iconColor)} />
          <div>
            <div className="font-semibold text-sm font-sans">{config.label}</div>
            <p className="text-sm text-foreground/80 mt-0.5">{banner.summary}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 ml-8 space-y-2 animate-fade-in">
          {banner.checks.map((check, index) => (
            <div key={index} className="flex items-start gap-2 text-sm">
              {check.ok ? (
                <CheckCircle2 className="w-4 h-4 text-status-green flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-status-red flex-shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-medium">{check.name}:</span>{" "}
                <span className="text-muted-foreground">{check.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
