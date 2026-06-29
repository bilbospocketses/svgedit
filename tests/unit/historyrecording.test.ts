import { describe, expect, it } from 'vitest'
import { NS } from '../../packages/svgcanvas/core/namespaces.js'
import HistoryRecordingService from '../../packages/svgcanvas/core/historyrecording.js'
import type { BatchCommand, Command, UndoManager } from '../../packages/svgcanvas/core/history.js'

const createSvgElement = (name: string) => document.createElementNS(NS.SVG, name)

describe('HistoryRecordingService', () => {
  it('does not record empty batch commands', () => {
    const stack: Command[] = []
    const hrService = new HistoryRecordingService({
      addCommandToHistory (cmd: Command) {
        stack.push(cmd)
      }
    } as unknown as UndoManager)

    hrService.startBatchCommand('Empty').endBatchCommand()
    expect(stack).toHaveLength(0)
  })

  it('does not record nested empty batch commands', () => {
    const stack: Command[] = []
    const hrService = new HistoryRecordingService({
      addCommandToHistory (cmd: Command) {
        stack.push(cmd)
      }
    } as unknown as UndoManager)

    hrService.startBatchCommand('Outer').startBatchCommand('Inner').endBatchCommand().endBatchCommand()
    expect(stack).toHaveLength(0)
  })

  it('records subcommands as a single batch command', () => {
    const stack: Command[] = []
    const hrService = new HistoryRecordingService({
      addCommandToHistory (cmd: Command) {
        stack.push(cmd)
      }
    } as unknown as UndoManager)

    const svg = createSvgElement('svg')
    const rect = createSvgElement('rect')
    svg.append(rect)

    hrService.startBatchCommand('Batch').insertElement(rect).endBatchCommand()
    expect(stack).toHaveLength(1)
    expect(stack[0]!.type()).toBe('BatchCommand')
    expect((stack[0]! as BatchCommand).stack).toHaveLength(1)
    expect((stack[0]! as BatchCommand).stack[0]!.type()).toBe('InsertElementCommand')
  })

  it('NO_HISTORY does not throw and does not record', () => {
    const svg = createSvgElement('svg')
    const rect = createSvgElement('rect')
    svg.append(rect)

    expect(() => {
      (HistoryRecordingService as unknown as { NO_HISTORY: HistoryRecordingService }).NO_HISTORY.startBatchCommand('Noop').insertElement(rect).endBatchCommand()
    }).not.toThrow()
  })
})
