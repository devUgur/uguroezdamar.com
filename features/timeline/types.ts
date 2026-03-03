export type TimelineItemType = "work" | "education";
export type TimelineItemStatus = "draft" | "published";

export type TimelineVisibility = {
  about: boolean;
  education: boolean;
};

export type TimelineItem = {
  id: string;
  type: TimelineItemType;
  title: string;
  organization: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  isCurrent: boolean;
  description?: string | null;
  highlights?: string[];
  sortIndex: number;
  visibility: TimelineVisibility;
  status: TimelineItemStatus;
  createdAt: string;
  updatedAt: string;
};
