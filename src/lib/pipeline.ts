import type { Project } from '../data/content'

export interface PipelineStatus { ok: boolean; head: string; lines: string[] }

/** What a pipeline reports with stage `removed` pulled out (or intact when null). Shared by the drawing and the teletype. */
export function pipelineStatus(proj: Project, removed: number | null): PipelineStatus {
  const Pl = proj.pipeline
  if (removed === null) return { ok: true, head: 'PIPELINE VALID', lines: [`OUTPUT  ${Pl[Pl.length - 1]}`] }
  const i = removed
  const lines = proj.breaks[i]
    ?? (i === Pl.length - 1
      ? ['FINAL STAGE REMOVED', `Stages run, but nothing becomes ${Pl[i].toLowerCase()}`, 'OUTPUT EMPTY']
      : [`${Pl[i + 1].toUpperCase()} EXPECTS  output of ${Pl[i]}`, `RECEIVED  ${i === 0 ? 'nothing' : 'output of ' + Pl[i - 1]}`, 'Mismatch detected', 'EXECUTION ABORTED'])
  return { ok: false, head: 'PIPELINE INVALID', lines }
}
