import { useState } from "react";
import {
  FileText,
  Download,
  MessageSquare,
  GitBranch,
  MessageCircle,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DocumentViewer } from "@/components/document/DocumentViewer";
import { DocumentSkeleton } from "@/components/document/DocumentSkeleton";
import { ChatPanel } from "@/components/panel/ChatPanel";
import { VersionsPanel } from "@/components/panel/VersionsPanel";
import { CommentsPanel } from "@/components/panel/CommentsPanel";
import { BriefingCreationForm } from "@/components/form/BriefingCreationForm";
import { useBriefingStore } from "@/stores/briefingStore";
import {
  createBriefing,
  exportPdf,
  getBriefingDetail,
  getBriefingVersion,
  fetchComments,
  fetchChatHistory,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Tone, Length } from "@/types/briefing";

export function BriefingBuilder() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);
  const { toast } = useToast();

  const {
    briefingId,
    currentVersionId,
    renderModel,
    versions,
    isGenerating,
    isExporting,
    selectedSeries,
    setBriefing,
    setIsGenerating,
    setIsExporting,
    switchVersion,
    setComments,
    setChatMessages,
  } = useBriefingStore();

  const handleCreateBriefing = async (data: {
    topic: string;
    userRequest: string;
    asOf: "latest" | string;
    lookbackPeriods: number;
    includeOecd: boolean;
    tone: Tone;
    length: Length;
  }) => {
    setIsGenerating(true);
    setIsCreateOpen(false);

    try {
      const response = await createBriefing({
        topic: data.topic,
        user_request: data.userRequest,
        selected_series: selectedSeries.map((s) => ({
          source: s.source,
          source_series_id: s.source_series_id,
          dataset_id: s.dataset_id,
          alias: s.slug ?? s.source_series_id,
        })),
        options: {
          as_of: data.asOf,
          lookback_periods: data.lookbackPeriods,
          include_oecd: data.includeOecd,
          tone: data.tone,
          length: data.length,
        },
      });

      const [detail, chatHistory] = await Promise.all([
        getBriefingDetail(response.briefing_id).catch(() => null),
        fetchChatHistory(response.briefing_id).catch(() => []),
      ]);

      const versionsList =
        detail?.versions ??
        [
          {
            id: response.version_id,
            created_at: new Date().toISOString(),
            change_summary: "Initial version",
          },
        ];

      setBriefing(response.briefing_id, response.version_id, response.render_model, versionsList);
      setComments([]);
      setChatMessages(chatHistory);

      toast({
        title: "Briefing generated",
        description: "Your economic briefing is ready for review.",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Failed to generate briefing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPdf = async () => {
    if (!briefingId || !currentVersionId) return;

    setIsExporting(true);

    try {
      const blob = await exportPdf(briefingId, currentVersionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `briefing-${briefingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF exported",
        description: "Your briefing has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleVersionChange = async (versionId: string) => {
    if (!briefingId || !versionId) {
      return;
    }
    if (versionId === currentVersionId) {
      return;
    }
    setIsLoadingVersion(true);
    try {
      const [version, comments] = await Promise.all([
        getBriefingVersion(briefingId, versionId),
        fetchComments(briefingId, versionId).catch(() => []),
      ]);
      switchVersion(versionId, version.content_json);
      setComments(comments);
    } catch (error) {
      toast({
        title: "Unable to load version",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVersion(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            <h1 className="font-semibold">Economic Briefing Builder</h1>
          </div>

          {briefingId && (
            <div className="flex items-center gap-2 ml-4">
              <Select value={currentVersionId || undefined} onValueChange={handleVersionChange}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue placeholder="Version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v, index) => (
                    <SelectItem key={v.id} value={v.id}>
                      Version {v.version_number ?? index + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <SheetTrigger asChild>
              <Button variant={briefingId ? "outline" : "default"} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                {briefingId ? "New Briefing" : "Create Briefing"}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Create Economic Briefing</SheetTitle>
                <SheetDescription>
                  Configure your briefing parameters and click generate.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <BriefingCreationForm
                  onSubmit={handleCreateBriefing}
                  isLoading={isGenerating}
                />
              </div>
            </SheetContent>
          </Sheet>

          {briefingId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export PDF
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Document Panel */}
        <div className="flex-1 overflow-auto bg-muted/30">
          {isGenerating || isLoadingVersion ? (
            <DocumentSkeleton />
          ) : renderModel ? (
            <DocumentViewer renderModel={renderModel} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold mb-2">No Briefing Yet</h2>
                <p className="text-muted-foreground mb-6">
                  Create your first economic briefing by selecting a topic and providing your
                  requirements.
                </p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Briefing
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-96 border-l bg-card flex flex-col">
          <Tabs defaultValue="chat" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b h-12 px-2 bg-transparent">
              <TabsTrigger value="chat" className="gap-2 data-[state=active]:bg-muted">
                <MessageCircle className="w-4 h-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="versions" className="gap-2 data-[state=active]:bg-muted">
                <GitBranch className="w-4 h-4" />
                Versions
              </TabsTrigger>
              <TabsTrigger value="comments" className="gap-2 data-[state=active]:bg-muted">
                <MessageSquare className="w-4 h-4" />
                Comments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 m-0 mt-0">
              <ChatPanel />
            </TabsContent>

            <TabsContent value="versions" className="flex-1 m-0 mt-0">
              <VersionsPanel />
            </TabsContent>

            <TabsContent value="comments" className="flex-1 m-0 mt-0">
              <CommentsPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
