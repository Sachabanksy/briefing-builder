import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBriefingStore } from "@/stores/briefingStore";
import { chatWithBriefing, getBriefingDetail } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export function ChatPanel() {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    briefingId,
    currentVersionId,
    chatMessages,
    isChatting,
    addChatMessage,
    setIsChatting,
    setVersions,
    switchVersion,
    setComments,
    versions,
  } = useBriefingStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || !briefingId || !currentVersionId || isChatting) return;

    const userMessage = message.trim();
    setMessage("");

    // Add user message
    addChatMessage({
      id: `msg_${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    setIsChatting(true);

    try {
      const response = await chatWithBriefing(briefingId, userMessage, currentVersionId);

      // Add assistant response
      addChatMessage({
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: response.change_summary,
        timestamp: new Date().toISOString(),
        version_id: response.new_version_id,
      });

      const detail = await getBriefingDetail(briefingId);
      setVersions(detail.versions);
      switchVersion(response.new_version_id, response.render_model);
      setComments([]);
    } catch (error) {
      addChatMessage({
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsChatting(false);
    }
  };

  if (!briefingId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Send className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="font-semibold mb-2">Chat Assistant</h3>
        <p className="text-sm text-muted-foreground">
          Generate a briefing first, then use chat to iterate and refine the content.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <p className="mb-2">Start a conversation to edit your briefing.</p>
            <p className="text-xs">
              Try: "Shorten the introduction" or "Add more international context"
            </p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex animate-fade-in",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%]",
                msg.role === "user" ? "chat-message-user" : "chat-message-assistant"
              )}
            >
              <p className="text-sm">{msg.content}</p>
              <div
                className={cn(
                  "text-xs mt-1 opacity-60",
                  msg.role === "user" ? "text-right" : "text-left"
                )}
              >
                {format(new Date(msg.timestamp), "HH:mm")}
                {msg.version_id && (
                  <span className="ml-2 font-mono">
                    →
                    v
                    {versions.find((version) => version.id === msg.version_id)?.version_number ??
                      msg.version_id.slice(0, 4)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isChatting && (
          <div className="flex justify-start animate-fade-in">
            <div className="chat-message-assistant flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Updating briefing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask to modify the briefing..."
            className="min-h-[44px] max-h-32 resize-none"
            disabled={isChatting}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || isChatting}
            className="flex-shrink-0"
          >
            {isChatting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
