import type { CSSProperties, Ref } from "react";
import {
  FileArchive,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { FileKind, FlowFile } from "./fileFlowData";
import styles from "./FileFlow.module.css";

type CSSVars = CSSProperties & { [key: `--${string}`]: string | number };

const ICONS: Record<FileKind, LucideIcon> = {
  pdf: FileText,
  docx: FileText,
  jpg: FileImage,
  png: FileImage,
  json: FileJson,
  zip: FileArchive,
  csv: FileSpreadsheet,
};

const TIER_CLASS = { 1: "", 2: styles.t2, 3: styles.t3 } as const;

type Props = {
  file: FlowFile;
  index: number;
  /** The wrapper that the motion hook moves. */
  ref?: Ref<HTMLDivElement>;
};

export default function FileObject({ file, index, ref }: Props) {
  const Icon = ICONS[file.kind];
  const fixed = file.state === "fixed";

  const itemStyle: CSSVars = {
    "--depth": file.depth,
    // Keeps the whole object inside the hero on narrow screens.
    left: `clamp(calc(var(--cw) * var(--depth) / 2 + 8px), ${file.x}%, calc(100% - var(--cw) * var(--depth) / 2 - 8px))`,
    top: `${file.y}%`,
  };

  const floaterStyle: CSSVars = {
    "--fx": `${file.drift.x}px`,
    "--fy": `${file.drift.y}px`,
    "--fr": `${file.drift.r}deg`,
    "--dur": `${file.drift.duration}s`,
    "--delay": `${file.drift.delay}s`,
  };

  const cardStyle: CSSVars = {
    "--tilt": `${file.tilt}deg`,
    "--o": file.opacity,
    "--i": index,
  };

  const cardClass = [
    styles.card,
    fixed ? styles.fixed : "",
    file.depth < 0.88 ? styles.far : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={`${styles.item} ${TIER_CLASS[file.tier]}`} style={itemStyle}>
      <div className={styles.floater} style={floaterStyle}>
        <div className={cardClass} style={cardStyle}>
          <span className={styles.icon}>
            <Icon size={15} strokeWidth={1.75} />
          </span>
          <span className={styles.text}>
            <span className={styles.name}>{file.name}</span>
            <span className={styles.meta}>{file.meta}</span>
          </span>
          {fixed ? (
            <span className={`${styles.tag} ${styles.tagFixed}`}>{file.saved}</span>
          ) : (
            <span className={styles.tag}>{file.kind.toUpperCase()}</span>
          )}
        </div>
      </div>
    </div>
  );
}