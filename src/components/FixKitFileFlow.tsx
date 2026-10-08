"use client";

import { useRef } from "react";
import FileObject from "./file-flow/FileObject";
import ProcessingField from "./file-flow/ProcessingField";
import { FLOW_FILES, FLOW_PARTICLES } from "./file-flow/fileFlowData";
import { useFileFlowMotion } from "./file-flow/useFileFlowMotion";
import styles from "./file-flow/FileFlow.module.css";

/**
 * Decorative "File Flow" layer for the hero. Place it inside a `relative`
 * hero section, before the hero content (which should be `relative z-10`).
 */
export default function FixKitFileFlow() {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useFileFlowMotion(rootRef, fieldRef, itemRefs, FLOW_FILES);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      <ProcessingField ref={fieldRef} files={FLOW_FILES} particles={FLOW_PARTICLES} />
      {FLOW_FILES.map((file, i) => (
        <FileObject
          key={file.id}
          file={file}
          index={i}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}