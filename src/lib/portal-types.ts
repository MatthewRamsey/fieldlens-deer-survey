export type SurveyYear = string;

export type DocumentCategory = string;

export type DocumentVisibility = "admin" | "client";
export type DocumentStatus = "Draft" | "Published";

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
  deletedAt?: string | null;
};

export type Client = {
  id: string;
  name: string;
  propertyName: string;
  county: string;
  acreage: number;
  surveyYears: SurveyYear[];
  documents: ClientDocument[];
  digitalBooks?: { year: string; token: string }[];
};
