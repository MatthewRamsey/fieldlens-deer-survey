export type ClassificationLabel =
  | "Trophy buck"
  | "Management buck"
  | "Doe"
  | "Fawn"
  | "Non-target";

export type Detection = {
  id: string;
  deerName?: string;
  cameraId: string;
  captureTime: string;
  aiLabel: ClassificationLabel;
  finalLabel: ClassificationLabel;
  confidence: number;
  antlerScore?: number;
  notes: string;
  mediaCount: number;
  detailUrl: string;
};

export type Camera = {
  id: string;
  name: string;
  zone: string;
  source: "SD card" | "Google Drive";
  status: "Uploading" | "AI processing" | "Reviewed";
  coords: { x: number; y: number };
  lastSync: string;
  imageCount: number;
};

export type SurveyYear = "2026" | "2025";

export type ClientDocument = {
  id: string;
  title: string;
  category: "Camera survey report" | "Buck book" | "Map export" | "Harvest plan";
  surveyYear: SurveyYear;
  uploadedAt: string;
  fileType: "PDF" | "DOCX" | "ZIP";
  pageCount?: number;
  visibility: "admin" | "client";
  status: "Draft" | "Published";
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
  visibility: "admin" | "client";
  qrEnabled: boolean;
  shareUrl: string;
  notes: string;
};

export type Client = {
  id: string;
  name: string;
  propertyName: string;
  county: string;
  acreage: number;
  season: string;
  surveyYears: SurveyYear[];
  cameras: Camera[];
  detections: Detection[];
  documents: ClientDocument[];
  buckFolders: BuckFolder[];
};

export type PortalUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "client";
  clientIds: string[];
};

export const clients: Client[] = [
  {
    id: "cedar-ridge",
    name: "Cedar Ridge Outfitters",
    propertyName: "Cedar Ridge",
    county: "Macon County, Alabama",
    acreage: 1240,
    season: "Camera Survey Archive",
    surveyYears: ["2026", "2025"],
    cameras: [
      { id: "cam-01", name: "North Bean Field", zone: "North", source: "SD card", status: "Reviewed", coords: { x: 19, y: 18 }, lastSync: "Aug 3", imageCount: 1840 },
      { id: "cam-02", name: "Pine Saddle", zone: "North", source: "Google Drive", status: "AI processing", coords: { x: 38, y: 26 }, lastSync: "Aug 4", imageCount: 1522 },
    ],
    detections: [],
    documents: [
      { id: "doc-cedar-2026-report", title: "Cedar Ridge 2026 Camera Survey", category: "Camera survey report", surveyYear: "2026", uploadedAt: "Aug 5, 2026", fileType: "PDF", pageCount: 24, visibility: "client", status: "Published", notes: "Final 2026 survey report for landowner delivery." },
      { id: "doc-cedar-2026-buckbook", title: "Cedar Ridge 2026 Buck Book", category: "Buck book", surveyYear: "2026", uploadedAt: "Aug 5, 2026", fileType: "PDF", pageCount: 14, visibility: "client", status: "Published", notes: "2026 trophy and management buck gallery book." },
      { id: "doc-cedar-2025-report", title: "Cedar Ridge 2025 Camera Survey", category: "Camera survey report", surveyYear: "2025", uploadedAt: "Aug 6, 2025", fileType: "PDF", pageCount: 21, visibility: "client", status: "Published", notes: "Archived 2025 survey report for year-over-year reference." },
      { id: "doc-cedar-2025-map", title: "Cedar Ridge 2025 Camera Map Export", category: "Map export", surveyYear: "2025", uploadedAt: "Aug 6, 2025", fileType: "PDF", pageCount: 4, visibility: "client", status: "Published", notes: "Camera coverage map for the 2025 survey year." },
      { id: "doc-cedar-admin-draft", title: "Cedar Ridge 2026 Draft Landowner Notes", category: "Harvest plan", surveyYear: "2026", uploadedAt: "Aug 4, 2026", fileType: "DOCX", visibility: "admin", status: "Draft", notes: "Internal notes held back from the client portal." },
    ],
    buckFolders: [
      { id: "folder-cedar-wide-ten-2026", name: "Wide Ten 2026 gallery", buckName: "Wide Ten", classification: "Trophy buck", surveyYear: "2026", imageCount: 22, updatedAt: "Aug 5, 2026", source: "SD card", visibility: "client", qrEnabled: true, shareUrl: "/cedar-ridge/2026/folders/wide-ten", notes: "Primary 2026 trophy buck gallery." },
      { id: "folder-cedar-split-g2-2026", name: "Split G2 2026 daylight set", buckName: "Split G2", classification: "Trophy buck", surveyYear: "2026", imageCount: 18, updatedAt: "Aug 5, 2026", source: "SD card", visibility: "client", qrEnabled: true, shareUrl: "/cedar-ridge/2026/folders/split-g2", notes: "Use this QR-linked folder in the 2026 book." },
      { id: "folder-cedar-crabclaw-2025", name: "Crabclaw 2025 gallery", buckName: "Crabclaw", classification: "Management buck", surveyYear: "2025", imageCount: 15, updatedAt: "Aug 6, 2025", source: "Google Drive", visibility: "client", qrEnabled: true, shareUrl: "/cedar-ridge/2025/folders/crabclaw", notes: "Archived 2025 management buck folder." },
      { id: "folder-cedar-broken-brow-2026", name: "Broken Brow review folder", buckName: "Broken Brow", classification: "Management buck", surveyYear: "2026", imageCount: 13, updatedAt: "Aug 4, 2026", source: "Google Drive", visibility: "admin", qrEnabled: false, shareUrl: "/cedar-ridge/2026/folders/broken-brow-review", notes: "Internal 2026 review folder not visible to clients." },
    ],
  },
  {
    id: "long-creek",
    name: "Long Creek Farms",
    propertyName: "Long Creek Farms",
    county: "Wilcox County, Georgia",
    acreage: 860,
    season: "Camera Survey Archive",
    surveyYears: ["2026", "2025"],
    cameras: [
      { id: "cam-11", name: "Levee Road", zone: "North", source: "Google Drive", status: "Reviewed", coords: { x: 26, y: 17 }, lastSync: "Aug 4", imageCount: 1404 },
    ],
    detections: [],
    documents: [
      { id: "doc-long-2026-report", title: "Long Creek 2026 Camera Survey", category: "Camera survey report", surveyYear: "2026", uploadedAt: "Aug 6, 2026", fileType: "PDF", pageCount: 19, visibility: "client", status: "Published", notes: "2026 published survey report." },
      { id: "doc-long-2026-buckbook", title: "Long Creek 2026 Buck Book", category: "Buck book", surveyYear: "2026", uploadedAt: "Aug 6, 2026", fileType: "PDF", pageCount: 11, visibility: "client", status: "Published", notes: "2026 print and digital buck book." },
      { id: "doc-long-2025-report", title: "Long Creek 2025 Camera Survey", category: "Camera survey report", surveyYear: "2025", uploadedAt: "Aug 7, 2025", fileType: "PDF", pageCount: 17, visibility: "client", status: "Published", notes: "2025 archived report for long-term comparison." },
      { id: "doc-long-2026-admin", title: "Long Creek 2026 Draft Gallery Notes", category: "Harvest plan", surveyYear: "2026", uploadedAt: "Aug 5, 2026", fileType: "DOCX", visibility: "admin", status: "Draft", notes: "Internal release notes for the 2026 landowner pack." },
    ],
    buckFolders: [
      { id: "folder-long-main-beam-2026", name: "Main Beam 9 2026 gallery", buckName: "Main Beam 9", classification: "Trophy buck", surveyYear: "2026", imageCount: 16, updatedAt: "Aug 6, 2026", source: "Google Drive", visibility: "client", qrEnabled: true, shareUrl: "/long-creek/2026/folders/main-beam-9", notes: "Published 2026 trophy buck gallery." },
      { id: "folder-long-palmated-2026", name: "Palmated Six 2026 folder", buckName: "Palmated Six", classification: "Management buck", surveyYear: "2026", imageCount: 10, updatedAt: "Aug 6, 2026", source: "SD card", visibility: "client", qrEnabled: true, shareUrl: "/long-creek/2026/folders/palmated-six", notes: "2026 management buck images shared with client." },
      { id: "folder-long-archer-2025", name: "Levee Archer 2025 gallery", buckName: "Levee Archer", classification: "Trophy buck", surveyYear: "2025", imageCount: 12, updatedAt: "Aug 7, 2025", source: "Google Drive", visibility: "client", qrEnabled: true, shareUrl: "/long-creek/2025/folders/levee-archer", notes: "Archived 2025 trophy buck gallery." },
    ],
  },
  {
    id: "pine-hollow",
    name: "Pine Hollow Holdings",
    propertyName: "Pine Hollow",
    county: "Choctaw County, Mississippi",
    acreage: 1425,
    season: "Camera Survey Archive",
    surveyYears: ["2026", "2025"],
    cameras: [
      { id: "cam-21", name: "Spur Ridge", zone: "East", source: "SD card", status: "Reviewed", coords: { x: 75, y: 23 }, lastSync: "Aug 2", imageCount: 1582 },
    ],
    detections: [],
    documents: [
      { id: "doc-pine-2026-report", title: "Pine Hollow 2026 Camera Survey", category: "Camera survey report", surveyYear: "2026", uploadedAt: "Aug 7, 2026", fileType: "PDF", pageCount: 17, visibility: "client", status: "Published", notes: "Published 2026 survey report for mobile and print." },
      { id: "doc-pine-2025-report", title: "Pine Hollow 2025 Camera Survey", category: "Camera survey report", surveyYear: "2025", uploadedAt: "Aug 8, 2025", fileType: "PDF", pageCount: 16, visibility: "client", status: "Published", notes: "2025 report retained for lifetime archive browsing." },
      { id: "doc-pine-2026-buckbook", title: "Pine Hollow 2026 Buck Book", category: "Buck book", surveyYear: "2026", uploadedAt: "Aug 7, 2026", fileType: "PDF", pageCount: 9, visibility: "admin", status: "Draft", notes: "2026 buck book draft awaiting final approval." },
    ],
    buckFolders: [
      { id: "folder-pine-roman-2026", name: "Roman Nose 2026 gallery", buckName: "Roman Nose", classification: "Trophy buck", surveyYear: "2026", imageCount: 14, updatedAt: "Aug 7, 2026", source: "SD card", visibility: "client", qrEnabled: true, shareUrl: "/pine-hollow/2026/folders/roman-nose", notes: "Published 2026 trophy buck image set." },
      { id: "folder-pine-bottomland-2025", name: "Bottomland Ten 2025 gallery", buckName: "Bottomland Ten", classification: "Trophy buck", surveyYear: "2025", imageCount: 11, updatedAt: "Aug 8, 2025", source: "Google Drive", visibility: "client", qrEnabled: true, shareUrl: "/pine-hollow/2025/folders/bottomland-ten", notes: "Archived 2025 buck gallery." },
      { id: "folder-pine-basket-2026", name: "Basket Eight review folder", buckName: "Basket Eight", classification: "Management buck", surveyYear: "2026", imageCount: 9, updatedAt: "Aug 7, 2026", source: "SD card", visibility: "admin", qrEnabled: false, shareUrl: "/pine-hollow/2026/folders/basket-eight-review", notes: "2026 admin-only review gallery." },
    ],
  },
];

export const portalUsers: PortalUser[] = [
  {
    id: "admin-matt",
    name: "Matthew Ramsey",
    email: "admin@uplandwildlifemanagement.com",
    password: "UplandAdmin!",
    role: "admin",
    clientIds: clients.map((client) => client.id),
  },
  {
    id: "client-cedar",
    name: "Cedar Ridge Owner",
    email: "cedar@uplandclients.com",
    password: "CedarClient!",
    role: "client",
    clientIds: ["cedar-ridge"],
  },
  {
    id: "client-long-creek",
    name: "Long Creek Manager",
    email: "longcreek@uplandclients.com",
    password: "LongCreek!",
    role: "client",
    clientIds: ["long-creek"],
  },
  {
    id: "client-pine-hollow",
    name: "Pine Hollow Manager",
    email: "pine@uplandclients.com",
    password: "PineHollow!",
    role: "client",
    clientIds: ["pine-hollow"],
  },
];

export function getCamera(client: Client, cameraId: string) {
  return client.cameras.find((camera) => camera.id === cameraId);
}
