import { MessageSquare, Trash2 } from "lucide-react";
import { useBriefingStore } from "@/stores/briefingStore";
import { format } from "date-fns";

export function CommentsPanel() {
  const { comments, briefingId } = useBriefingStore();

  if (!briefingId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold mb-2">Comments</h3>
        <p className="text-sm text-muted-foreground">
          Generate a briefing and add comments to sections.
        </p>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold mb-2">No Comments Yet</h3>
        <p className="text-sm text-muted-foreground">
          Hover over any block in the document and click the comment icon to add annotations.
        </p>
      </div>
    );
  }

  // Parse anchor to get readable location
  const parseAnchor = (anchor: string) => {
    const parts = anchor.split(":");
    const section = parts[1]?.replace(/_/g, " ");
    return section ? section.charAt(0).toUpperCase() + section.slice(1) : "Unknown";
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 border-b sticky top-0 bg-background z-10">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Comments
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {comments.length} comment{comments.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="p-2 space-y-2">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="p-3 rounded-lg border bg-card hover:border-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-medium text-accent">
                {parseAnchor(comment.anchor)}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(comment.created_at), "HH:mm")}
              </span>
            </div>
            <p className="text-sm">{comment.comment_text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
