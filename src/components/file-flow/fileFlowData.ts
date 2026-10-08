export type FileKind = "pdf" | "jpg" | "png" | "docx" | "json" | "zip" | "csv";

export type FlowFile = {
  id: string;
  name: string;
  /** Size shown under the name. */
  meta: string;
  kind: FileKind;
  /** "raw" files are waiting to be processed, "fixed" files came out of FixKit. */
  state: "raw" | "fixed";
  /** Size reduction chip, fixed files only. */
  saved?: string;
  /** Anchor position, percent of the hero. */
  x: number;
  y: number;
  /** Depth: scales the object and its mouse response. */
  depth: number;
  /** Static tilt in degrees. */
  tilt: number;
  /** Resting opacity (0-1). */
  opacity: number;
  /** 1 = all screens, 2 = tablet and up, 3 = desktop only. */
  tier: 1 | 2 | 3;
  drift: { x: number; y: number; r: number; duration: number; delay: number };
};

export type FlowParticle = {
  id: string;
  /** Start offset from the processing field center, px. */
  dx: number;
  dy: number;
  duration: number;
  delay: number;
  tier: 1 | 2;
};

/** Center of the processing field, percent of the hero. */
export const FIELD_CENTER = { x: 50, y: 42 } as const;

export const FLOW_FILES: readonly FlowFile[] = [
  // Tier 1: every screen (corners, clear of the hero text)
  { id: "resume", name: "resume.pdf", meta: "2.8 MB", kind: "pdf", state: "raw", x: 7, y: 5, depth: 1.1, tilt: -7, opacity: 0.85, tier: 1, drift: { x: 14, y: -18, r: 2.2, duration: 26, delay: -6 } },
  { id: "photo", name: "photo.jpg", meta: "340 KB", kind: "jpg", state: "fixed", saved: "-76%", x: 88, y: 6, depth: 0.95, tilt: 6, opacity: 0.8, tier: 1, drift: { x: -12, y: 14, r: -2, duration: 31, delay: -14 } },
  { id: "notes", name: "notes.docx", meta: "540 KB", kind: "docx", state: "raw", x: 8, y: 92, depth: 0.9, tilt: 5, opacity: 0.7, tier: 1, drift: { x: 10, y: 16, r: -1.8, duration: 29, delay: -20 } },
  { id: "resume-min", name: "resume-min.pdf", meta: "620 KB", kind: "pdf", state: "fixed", saved: "-78%", x: 88, y: 92, depth: 1.05, tilt: -5, opacity: 0.8, tier: 1, drift: { x: -14, y: -12, r: 2, duration: 24, delay: -3 } },

  // Tier 2: tablet and up (side columns)
  { id: "scan", name: "scan_0042.png", meta: "5.1 MB", kind: "png", state: "raw", x: 12, y: 36, depth: 1.0, tilt: -6, opacity: 0.7, tier: 2, drift: { x: 12, y: 16, r: 2.4, duration: 33, delay: -9 } },
  { id: "data", name: "data.json", meta: "82 KB", kind: "json", state: "raw", x: 9, y: 63, depth: 0.85, tilt: 7, opacity: 0.65, tier: 2, drift: { x: -10, y: -14, r: -2.2, duration: 28, delay: -17 } },
  { id: "avatar", name: "avatar.png", meta: "96 KB", kind: "png", state: "fixed", saved: "-58%", x: 90, y: 37, depth: 0.9, tilt: 5, opacity: 0.7, tier: 2, drift: { x: -14, y: 12, r: 2, duration: 30, delay: -11 } },
  { id: "data-min", name: "data.min.json", meta: "48 KB", kind: "json", state: "fixed", saved: "-41%", x: 91, y: 64, depth: 1.0, tilt: -7, opacity: 0.7, tier: 2, drift: { x: 10, y: -16, r: -2.4, duration: 27, delay: -22 } },

  // Tier 3: desktop only (top and bottom rows)
  { id: "archive", name: "archive.zip", meta: "12.4 MB", kind: "zip", state: "raw", x: 26, y: 6, depth: 0.8, tilt: 6, opacity: 0.55, tier: 3, drift: { x: 12, y: 12, r: 1.6, duration: 34, delay: -5 } },
  { id: "report", name: "report.pdf", meta: "710 KB", kind: "pdf", state: "fixed", saved: "-69%", x: 69, y: 5, depth: 0.8, tilt: -6, opacity: 0.55, tier: 3, drift: { x: -12, y: 14, r: -1.6, duration: 32, delay: -25 } },
  { id: "export", name: "export.csv", meta: "212 KB", kind: "csv", state: "raw", x: 28, y: 94, depth: 0.85, tilt: -5, opacity: 0.55, tier: 3, drift: { x: 14, y: -10, r: 1.8, duration: 35, delay: -13 } },
  { id: "sheet", name: "sheet-clean.csv", meta: "134 KB", kind: "csv", state: "fixed", saved: "-37%", x: 66, y: 94, depth: 0.8, tilt: 6, opacity: 0.55, tier: 3, drift: { x: -10, y: -12, r: -1.8, duration: 30, delay: -8 } },
];

export const FLOW_PARTICLES: readonly FlowParticle[] = [
  { id: "p1", dx: -340, dy: -120, duration: 9, delay: -1, tier: 1 },
  { id: "p2", dx: 320, dy: -160, duration: 11, delay: -4, tier: 1 },
  { id: "p3", dx: -280, dy: 180, duration: 10, delay: -7, tier: 1 },
  { id: "p4", dx: 360, dy: 140, duration: 12, delay: -2, tier: 1 },
  { id: "p5", dx: 40, dy: -260, duration: 8, delay: -5, tier: 1 },
  { id: "p6", dx: -420, dy: 20, duration: 13, delay: -9, tier: 2 },
  { id: "p7", dx: 430, dy: -30, duration: 12, delay: -6, tier: 2 },
  { id: "p8", dx: -160, dy: 260, duration: 9, delay: -3, tier: 2 },
  { id: "p9", dx: 200, dy: 250, duration: 11, delay: -8, tier: 2 },
  { id: "p10", dx: -120, dy: -240, duration: 10, delay: -10, tier: 2 },
];