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

export type ClientDocument = {
  id: string;
  title: string;
  category: "Camera survey report" | "Buck book" | "Map export" | "Harvest plan";
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
    season: "2026 Camera Survey",
    cameras: [
      { id: "cam-01", name: "North Bean Field", zone: "North", source: "SD card", status: "Reviewed", coords: { x: 19, y: 18 }, lastSync: "Aug 3", imageCount: 1840 },
      { id: "cam-02", name: "Pine Saddle", zone: "North", source: "Google Drive", status: "AI processing", coords: { x: 38, y: 26 }, lastSync: "Aug 4", imageCount: 1522 },
      { id: "cam-03", name: "Creek Crossing", zone: "Central", source: "SD card", status: "Reviewed", coords: { x: 53, y: 48 }, lastSync: "Aug 2", imageCount: 2093 },
      { id: "cam-04", name: "South Plot", zone: "South", source: "Google Drive", status: "Uploading", coords: { x: 71, y: 73 }, lastSync: "Aug 4", imageCount: 1186 },
      { id: "cam-05", name: "Cutover Trail", zone: "West", source: "SD card", status: "Reviewed", coords: { x: 11, y: 64 }, lastSync: "Aug 1", imageCount: 1674 },
      { id: "cam-06", name: "Oak Flat", zone: "East", source: "Google Drive", status: "Reviewed", coords: { x: 82, y: 39 }, lastSync: "Aug 3", imageCount: 1438 },
    ],
    detections: [
      { id: "det-101", deerName: "Split G2", cameraId: "cam-01", captureTime: "2026-08-02 06:18", aiLabel: "Trophy buck", finalLabel: "Trophy buck", confidence: 0.94, antlerScore: 152, notes: "Shows up on soybean edge twice in daylight.", mediaCount: 18, detailUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/folders/split-g2" },
      { id: "det-102", deerName: "Tall Eight", cameraId: "cam-03", captureTime: "2026-08-01 19:42", aiLabel: "Management buck", finalLabel: "Trophy buck", confidence: 0.71, antlerScore: 141, notes: "AI under-called frame width. Good correction candidate.", mediaCount: 11, detailUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/folders/tall-eight" },
      { id: "det-103", deerName: "Crabclaw", cameraId: "cam-05", captureTime: "2026-07-31 21:15", aiLabel: "Management buck", finalLabel: "Management buck", confidence: 0.88, antlerScore: 118, notes: "Mature buck with weak right side.", mediaCount: 9, detailUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/folders/crabclaw" },
      { id: "det-104", cameraId: "cam-02", captureTime: "2026-08-03 05:54", aiLabel: "Doe", finalLabel: "Doe", confidence: 0.96, notes: "Adult doe with twin fawns trailing in later frame.", mediaCount: 26, detailUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/library/doe-1" },
      { id: "det-105", cameraId: "cam-02", captureTime: "2026-08-03 05:56", aiLabel: "Fawn", finalLabel: "Fawn", confidence: 0.92, notes: "Fawn pair captured behind adult doe.", mediaCount: 14, detailUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/library/fawn-pair" },
      { id: "det-106", deerName: "Broken Brow", cameraId: "cam-06", captureTime: "2026-08-02 20:03", aiLabel: "Trophy buck", finalLabel: "Management buck", confidence: 0.63, antlerScore: 124, notes: "Heavy body, but antler side damaged and below target threshold.", mediaCount: 13, detailUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/folders/broken-brow" },
      { id: "det-107", cameraId: "cam-04", captureTime: "2026-08-04 01:12", aiLabel: "Non-target", finalLabel: "Non-target", confidence: 0.97, notes: "Raccoon cluster at feeder.", mediaCount: 8, detailUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/library/non-target" },
      { id: "det-108", deerName: "Wide Ten", cameraId: "cam-03", captureTime: "2026-08-01 20:08", aiLabel: "Trophy buck", finalLabel: "Trophy buck", confidence: 0.9, antlerScore: 158, notes: "Primary cover buck on creek edge.", mediaCount: 22, detailUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/folders/wide-ten" },
      { id: "det-109", cameraId: "cam-01", captureTime: "2026-08-02 06:22", aiLabel: "Doe", finalLabel: "Doe", confidence: 0.95, notes: "Second adult doe in bachelor group follow-up.", mediaCount: 7, detailUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/library/doe-2" },
      { id: "det-110", deerName: "Fork Horn", cameraId: "cam-05", captureTime: "2026-08-01 22:40", aiLabel: "Management buck", finalLabel: "Management buck", confidence: 0.86, antlerScore: 92, notes: "Younger management buck for client report.", mediaCount: 12, detailUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/folders/fork-horn" },
    ],
    documents: [
      { id: "doc-cedar-report", title: "Cedar Ridge 2026 Camera Survey", category: "Camera survey report", uploadedAt: "Aug 5, 2026", fileType: "PDF", pageCount: 24, visibility: "client", status: "Published", notes: "Final reviewed report for landowner delivery." },
      { id: "doc-cedar-buckbook", title: "Cedar Ridge Trophy and Management Buck Book", category: "Buck book", uploadedAt: "Aug 5, 2026", fileType: "PDF", pageCount: 14, visibility: "client", status: "Published", notes: "Print-ready buck pages with QR links." },
      { id: "doc-cedar-notes", title: "Correction Notes and AI Review Log", category: "Harvest plan", uploadedAt: "Aug 4, 2026", fileType: "DOCX", visibility: "admin", status: "Draft", notes: "Internal classification notes before publishing." },
    ],
    buckFolders: [
      { id: "folder-cedar-wide-ten", name: "Wide Ten gallery", buckName: "Wide Ten", classification: "Trophy buck", imageCount: 22, updatedAt: "Aug 5, 2026", source: "SD card", visibility: "client", qrEnabled: true, shareUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/folders/wide-ten", notes: "Primary cover buck from Creek Crossing." },
      { id: "folder-cedar-split-g2", name: "Split G2 daylight set", buckName: "Split G2", classification: "Trophy buck", imageCount: 18, updatedAt: "Aug 5, 2026", source: "SD card", visibility: "client", qrEnabled: true, shareUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/folders/split-g2", notes: "Use this folder in the printed buck book." },
      { id: "folder-cedar-broken-brow", name: "Broken Brow review folder", buckName: "Broken Brow", classification: "Management buck", imageCount: 13, updatedAt: "Aug 4, 2026", source: "Google Drive", visibility: "admin", qrEnabled: false, shareUrl: "https://fieldlens-deer-survey.vercel.app/cedar-ridge/folders/broken-brow-review", notes: "Internal review images not yet shared with client." },
    ],
  },
  {
    id: "long-creek",
    name: "Long Creek Farms",
    propertyName: "Long Creek Farms",
    county: "Wilcox County, Georgia",
    acreage: 860,
    season: "2026 Camera Survey",
    cameras: [
      { id: "cam-11", name: "Levee Road", zone: "North", source: "Google Drive", status: "Reviewed", coords: { x: 26, y: 17 }, lastSync: "Aug 4", imageCount: 1404 },
      { id: "cam-12", name: "Hickory Gap", zone: "Central", source: "SD card", status: "Reviewed", coords: { x: 49, y: 44 }, lastSync: "Aug 3", imageCount: 1711 },
      { id: "cam-13", name: "Backwater Edge", zone: "South", source: "Google Drive", status: "AI processing", coords: { x: 67, y: 71 }, lastSync: "Aug 4", imageCount: 1348 },
      { id: "cam-14", name: "Mill Road", zone: "West", source: "SD card", status: "Reviewed", coords: { x: 15, y: 62 }, lastSync: "Aug 2", imageCount: 1192 },
    ],
    detections: [
      { id: "det-201", deerName: "Main Beam 9", cameraId: "cam-11", captureTime: "2026-08-02 19:05", aiLabel: "Trophy buck", finalLabel: "Trophy buck", confidence: 0.91, antlerScore: 147, notes: "Best mature deer on property.", mediaCount: 16, detailUrl: "https://fieldlens-deer-survey.vercel.app/long-creek/folders/main-beam-9" },
      { id: "det-202", deerName: "Palmated Six", cameraId: "cam-12", captureTime: "2026-08-03 06:43", aiLabel: "Management buck", finalLabel: "Management buck", confidence: 0.82, antlerScore: 108, notes: "Distinct left palmation.", mediaCount: 10, detailUrl: "https://fieldlens-deer-survey.vercel.app/long-creek/folders/palmated-six" },
      { id: "det-203", cameraId: "cam-13", captureTime: "2026-08-04 00:13", aiLabel: "Doe", finalLabel: "Doe", confidence: 0.94, notes: "Travel corridor doe group.", mediaCount: 24, detailUrl: "https://fieldlens-deer-survey.vercel.app/long-creek/library/doe-group" },
      { id: "det-204", cameraId: "cam-14", captureTime: "2026-08-01 23:58", aiLabel: "Doe", finalLabel: "Doe", confidence: 0.89, notes: "Adult doe on mineral line.", mediaCount: 8, detailUrl: "https://fieldlens-deer-survey.vercel.app/long-creek/library/doe-mineral" },
      { id: "det-205", cameraId: "cam-12", captureTime: "2026-08-03 06:46", aiLabel: "Fawn", finalLabel: "Fawn", confidence: 0.9, notes: "Single spotted fawn.", mediaCount: 6, detailUrl: "https://fieldlens-deer-survey.vercel.app/long-creek/library/fawn" },
    ],
    documents: [
      { id: "doc-long-report", title: "Long Creek 2026 Camera Survey", category: "Camera survey report", uploadedAt: "Aug 6, 2026", fileType: "PDF", pageCount: 19, visibility: "client", status: "Published", notes: "Client-ready summary and ratio analysis." },
      { id: "doc-long-map", title: "Long Creek Camera Map Export", category: "Map export", uploadedAt: "Aug 6, 2026", fileType: "PDF", pageCount: 3, visibility: "client", status: "Published", notes: "Camera coverage and habitat overlay." },
      { id: "doc-long-draft", title: "Long Creek Harvest Strategy Draft", category: "Harvest plan", uploadedAt: "Aug 5, 2026", fileType: "DOCX", visibility: "admin", status: "Draft", notes: "Internal strategy draft before client release." },
    ],
    buckFolders: [
      { id: "folder-long-main-beam", name: "Main Beam 9 gallery", buckName: "Main Beam 9", classification: "Trophy buck", imageCount: 16, updatedAt: "Aug 6, 2026", source: "Google Drive", visibility: "client", qrEnabled: true, shareUrl: "https://fieldlens-deer-survey.vercel.app/long-creek/folders/main-beam-9", notes: "Published buck folder for report and print layout." },
      { id: "folder-long-palmated", name: "Palmated Six folder", buckName: "Palmated Six", classification: "Management buck", imageCount: 10, updatedAt: "Aug 6, 2026", source: "SD card", visibility: "client", qrEnabled: true, shareUrl: "https://fieldlens-deer-survey.vercel.app/long-creek/folders/palmated-six", notes: "Management folder shared with client." },
    ],
  },
  {
    id: "pine-hollow",
    name: "Pine Hollow Holdings",
    propertyName: "Pine Hollow",
    county: "Choctaw County, Mississippi",
    acreage: 1425,
    season: "2026 Camera Survey",
    cameras: [
      { id: "cam-21", name: "Spur Ridge", zone: "East", source: "SD card", status: "Reviewed", coords: { x: 75, y: 23 }, lastSync: "Aug 2", imageCount: 1582 },
      { id: "cam-22", name: "Bottomland Trail", zone: "Central", source: "Google Drive", status: "Uploading", coords: { x: 51, y: 57 }, lastSync: "Aug 4", imageCount: 978 },
      { id: "cam-23", name: "West Food Plot", zone: "West", source: "SD card", status: "AI processing", coords: { x: 21, y: 48 }, lastSync: "Aug 4", imageCount: 1311 },
    ],
    detections: [
      { id: "det-301", deerName: "Roman Nose", cameraId: "cam-21", captureTime: "2026-08-02 20:49", aiLabel: "Trophy buck", finalLabel: "Trophy buck", confidence: 0.93, antlerScore: 154, notes: "Consistent mature buck on ridge line.", mediaCount: 14, detailUrl: "https://fieldlens-deer-survey.vercel.app/pine-hollow/folders/roman-nose" },
      { id: "det-302", deerName: "Basket Eight", cameraId: "cam-23", captureTime: "2026-08-03 20:28", aiLabel: "Management buck", finalLabel: "Management buck", confidence: 0.85, antlerScore: 112, notes: "Good cull candidate.", mediaCount: 9, detailUrl: "https://fieldlens-deer-survey.vercel.app/pine-hollow/folders/basket-eight" },
      { id: "det-303", cameraId: "cam-22", captureTime: "2026-08-04 02:41", aiLabel: "Doe", finalLabel: "Doe", confidence: 0.95, notes: "Adult doe at crossing.", mediaCount: 12, detailUrl: "https://fieldlens-deer-survey.vercel.app/pine-hollow/library/doe" },
    ],
    documents: [
      { id: "doc-pine-report", title: "Pine Hollow 2026 Camera Survey", category: "Camera survey report", uploadedAt: "Aug 7, 2026", fileType: "PDF", pageCount: 17, visibility: "client", status: "Published", notes: "Published survey report for mobile and print." },
      { id: "doc-pine-buckbook", title: "Pine Hollow Buck Book Draft", category: "Buck book", uploadedAt: "Aug 7, 2026", fileType: "PDF", pageCount: 8, visibility: "admin", status: "Draft", notes: "Awaiting final image replacements before release." },
    ],
    buckFolders: [
      { id: "folder-pine-roman", name: "Roman Nose gallery", buckName: "Roman Nose", classification: "Trophy buck", imageCount: 14, updatedAt: "Aug 7, 2026", source: "SD card", visibility: "client", qrEnabled: true, shareUrl: "https://fieldlens-deer-survey.vercel.app/pine-hollow/folders/roman-nose", notes: "Published trophy buck image set." },
      { id: "folder-pine-basket", name: "Basket Eight review folder", buckName: "Basket Eight", classification: "Management buck", imageCount: 9, updatedAt: "Aug 7, 2026", source: "SD card", visibility: "admin", qrEnabled: false, shareUrl: "https://fieldlens-deer-survey.vercel.app/pine-hollow/folders/basket-eight-review", notes: "Hold back until final classification is approved." },
    ],
  },
];

export const portalUsers: PortalUser[] = [
  {
    id: "admin-matt",
    name: "Matthew Ramsey",
    email: "admin@fieldlensdemo.com",
    password: "FieldLensAdmin!",
    role: "admin",
    clientIds: clients.map((client) => client.id),
  },
  {
    id: "client-cedar",
    name: "Cedar Ridge Owner",
    email: "cedar@fieldlensdemo.com",
    password: "CedarClient!",
    role: "client",
    clientIds: ["cedar-ridge"],
  },
  {
    id: "client-long-creek",
    name: "Long Creek Manager",
    email: "longcreek@fieldlensdemo.com",
    password: "LongCreek!",
    role: "client",
    clientIds: ["long-creek"],
  },
  {
    id: "client-pine-hollow",
    name: "Pine Hollow Manager",
    email: "pine@fieldlensdemo.com",
    password: "PineHollow!",
    role: "client",
    clientIds: ["pine-hollow"],
  },
];

export function getCamera(client: Client, cameraId: string) {
  return client.cameras.find((camera) => camera.id === cameraId);
}
