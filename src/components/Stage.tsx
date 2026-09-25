import type { CSSProperties, ReactNode } from 'react'

/**
 * A 3D figure and the readout it drives, framed together and sized so both fit on one
 * screen: side by side when the stage is wide, stacked when it isn't (see .stage in app.css).
 * hStack and hSide are CSS heights for the figure in each arrangement; controls that act
 * on the figure go in `overlay`, on top of it, so they never scroll away from it.
 */
export function Stage({ label, view, overlay, panel, hStack, hSide }: {
  label: string; view: ReactNode; overlay?: ReactNode; panel: ReactNode; hStack: string; hSide: string
}) {
  return (
    <section className="stage" aria-label={label} data-reveal>
      <div className="stage-grid">
        <div className="stage-view" style={{ '--h-stack': hStack, '--h-side': hSide } as CSSProperties}>
          {view}
          {overlay}
        </div>
        <div className="stage-panel">{panel}</div>
      </div>
    </section>
  )
}

/** A one-line caption pinned inside a stage's figure. Narrow stages show `short` instead, so it never wraps into the labels. */
export function StageHint({ children, short }: { children: ReactNode; short: ReactNode }) {
  return (
    <div className="mono" aria-hidden="true" style={{ position: 'absolute', left: 12, bottom: 10, right: 12, fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <span className="hint-long">{children}</span><span className="hint-short">{short}</span>
    </div>
  )
}
