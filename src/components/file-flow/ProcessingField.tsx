import type { CSSProperties, Ref } from "react";
import {
  FIELD_CENTER,
  type FlowFile,
  type FlowParticle,
} from "./fileFlowData";
import styles from "./FileFlow.module.css";

type CSSVars = CSSProperties & { [key: `--${string}`]: string | number };

const TIER_CLASS = { 1: "", 2: styles.t2, 3: styles.t3 } as const;

function linePath(x: number, y: number): string {
  const { x: cx, y: cy } = FIELD_CENTER;
  const mx = (x + cx) / 2;
  const my = (y + cy) / 2;
  // Slight perpendicular bend so lines feel drawn in, not ruled.
  const px = -(cy - y) * 0.12;
  const py = (cx - x) * 0.12;
  const f = (n: number) => n.toFixed(2);
  return `M ${f(x)} ${f(y)} Q ${f(mx + px)} ${f(my + py)} ${cx} ${cy}`;
}

type Props = {
  files: readonly FlowFile[];
  particles: readonly FlowParticle[];
  /** The element the motion hook compresses on scroll. */
  ref?: Ref<HTMLDivElement>;
};

export default function ProcessingField({ files, particles, ref }: Props) {
  const inputs = files.filter((f) => f.state === "raw");

  return (
    <div ref={ref} className={styles.field}>
      <div className={styles.glow} />

      <div className={`${styles.ring} ${styles.ring1}`} />
      <div className={`${styles.ring} ${styles.ring2}`} />
      <div className={`${styles.ring} ${styles.ring3}`} />

      <svg
        className={styles.lines}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          {inputs.map((f) => (
            <linearGradient
              key={f.id}
              id={`ff-line-${f.id}`}
              gradientUnits="userSpaceOnUse"
              x1={f.x}
              y1={f.y}
              x2={FIELD_CENTER.x}
              y2={FIELD_CENTER.y}
            >
              <stop offset="0" stopColor="rgb(184 245 61)" stopOpacity="0" />
              <stop offset="0.4" stopColor="rgb(184 245 61)" stopOpacity="0.2" />
              <stop offset="0.85" stopColor="rgb(184 245 61)" stopOpacity="0.05" />
              <stop offset="1" stopColor="rgb(184 245 61)" stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {inputs.map((f) => (
          <path
            key={f.id}
            className={TIER_CLASS[f.tier]}
            d={linePath(f.x, f.y)}
            fill="none"
            stroke={`url(#ff-line-${f.id})`}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {particles.map((p) => {
        const style: CSSVars = {
          "--px": `${p.dx}px`,
          "--py": `${p.dy}px`,
          "--pdur": `${p.duration}s`,
          "--pdelay": `${p.delay}s`,
        };
        return (
          <span
            key={p.id}
            className={`${styles.particle} ${p.tier === 2 ? styles.t2 : ""}`}
            style={style}
          />
        );
      })}
    </div>
  );
}