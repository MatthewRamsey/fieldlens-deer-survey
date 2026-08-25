export type SurveyYear = string;

export type DocumentCategory =
  | "Camera survey report"
  | "Buck book"
  | "Map export"
  | "Harvest plan";

export type DocumentVisibility = "admin" | "client";
export type DocumentStatus = "Draft" | "Published";
export type DeerAgeLabel =
  | "Unknown"
  | "Fawn"
  | "1.5 years"
  | "2.5 years"
  | "3.5 years"
  | "4.5 years"
  | "5.5+ years";
export type DeerLifeStatus = "Unknown" | "Alive" | "Dead";
export type DeerClassification = "Unsorted" | "Management" | "Trophy";

export type ClientDocument = {
  id: string;
  title: string;
  category: DocumentCategory;
  surveyYear: SurveyYear;
  uploadedAt: string;
  fileType: string;
  pageCount?: number;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  notes: string;
};

export type BuckFolder = {
  id: string;
  name: string;
  buckName: string;
  classification: "Trophy buck" | "Management buck";
  surveyYear: SurveyYear;
  imageCount: number;
  updatedAt: string;
  source: "SD card" | "Google Drive" | "Manual upload";
  visibility: DocumentVisibility;
  qrEnabled: boolean;
  shareUrl: string;
  notes: string;
};

export type CameraBatchImage = {
  id: string;
  fileName: string;
  url: string;
  batchId: string;
  displayOrder: number;
  capturedAt: string | null;
  ageLabel: DeerAgeLabel;
  antlerPoints: number | null;
  lifeStatus: DeerLifeStatus;
  deerClassification: DeerClassification;
  clientVisible: boolean;
  reviewNotes: string;
};

export type CameraBatch = {
  id: string;
  cameraName: string;
  surveyYear: SurveyYear;
  source: "SD card" | "Google Drive" | "Manual upload";
  notes: string;
  imageCount: number;
  clientVisibleCount: number;
  updatedAt: string;
  images: CameraBatchImage[];
};

export type Client = {
  id: string;
  name: string;
  propertyName: string;
  county: string;
  acreage: number;
  surveyYears: SurveyYear[];
  documents: ClientDocument[];
  buckFolders: BuckFolder[];
  cameraBatches: CameraBatch[];
};

export type GalleryImage = {
  id: string;
  caption: string | null;
  url: string;
  fileName: string;
};
