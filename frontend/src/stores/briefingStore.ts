import { create } from "zustand";
import type {
  BriefingRenderModel,
  Version,
  Comment,
  ChatMessage,
  Series,
} from "@/types/briefing";

interface BriefingState {
  // Current briefing
  briefingId: string | null;
  currentVersionId: string | null;
  renderModel: BriefingRenderModel | null;
  
  // Versions
  versions: Version[];
  
  // Comments
  comments: Comment[];
  
  // Chat
  chatMessages: ChatMessage[];
  
  // Selected series for creation
  selectedSeries: Series[];
  
  // Loading states
  isGenerating: boolean;
  isChatting: boolean;
  isExporting: boolean;
  
  // Actions
  setBriefing: (briefingId: string, versionId: string, model: BriefingRenderModel, versions?: Version[]) => void;
  setVersions: (versions: Version[]) => void;
  switchVersion: (versionId: string, model?: BriefingRenderModel) => void;
  addComment: (comment: Comment) => void;
  setComments: (comments: Comment[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  toggleSeriesSelection: (series: Series) => void;
  clearSelectedSeries: () => void;
  setIsGenerating: (value: boolean) => void;
  setIsChatting: (value: boolean) => void;
  setIsExporting: (value: boolean) => void;
  reset: () => void;
}

const initialState = {
  briefingId: null,
  currentVersionId: null,
  renderModel: null,
  versions: [],
  comments: [],
  chatMessages: [],
  selectedSeries: [],
  isGenerating: false,
  isChatting: false,
  isExporting: false,
};

export const useBriefingStore = create<BriefingState>((set) => ({
  ...initialState,

  setBriefing: (briefingId, versionId, model, versions = []) => {
    set({
      briefingId,
      currentVersionId: versionId,
      renderModel: model,
      versions:
        versions.length > 0
          ? versions
          : [
              {
                id: versionId,
                created_at: new Date().toISOString(),
                change_summary: "Initial version",
              },
            ],
      comments: [],
      chatMessages: [],
      selectedSeries: [],
    });
  },

  setVersions: (versions) => set({ versions }),

  switchVersion: (versionId, model) => {
    set((state) => ({
      currentVersionId: versionId,
      renderModel: model ?? state.renderModel,
    }));
  },

  addComment: (comment) => {
    set((state) => ({
      comments: [...state.comments, comment],
    }));
  },

  setComments: (comments) => set({ comments }),

  addChatMessage: (message) => {
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    }));
  },

  setChatMessages: (messages) => set({ chatMessages: messages }),

  toggleSeriesSelection: (series) => {
    set((state) => {
      const exists = state.selectedSeries.some(
        (s) => s.source === series.source && s.source_series_id === series.source_series_id
      );
      
      if (exists) {
        return {
          selectedSeries: state.selectedSeries.filter(
            (s) => !(s.source === series.source && s.source_series_id === series.source_series_id)
          ),
        };
      }
      
      return {
        selectedSeries: [...state.selectedSeries, series],
      };
    });
  },

  clearSelectedSeries: () => {
    set({ selectedSeries: [] });
  },

  setIsGenerating: (value) => set({ isGenerating: value }),
  setIsChatting: (value) => set({ isChatting: value }),
  setIsExporting: (value) => set({ isExporting: value }),

  reset: () => set(initialState),
}));
