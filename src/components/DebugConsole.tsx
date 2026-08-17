/**
 * Debug console - Ctrl+Shift+D on the compress and OCR pages.
 *
 * These two are the tools that can fail deep inside a WASM engine with
 * nothing useful surfacing, so the running log is the difference between a
 * reproducible bug report and "it didn't work". Hidden by default; the
 * toggle lives in useDebugConsole.
 */

import React from 'react'

interface DebugConsoleProps {
  visible: boolean
  logs: string[]
}

const DebugConsole: React.FC<DebugConsoleProps> = ({ visible, logs }) => {
  if (!visible) return null

  return (
    <section className="section-tight section-ruled">
      <div className="cluster" style={{ marginBottom: 'var(--space-2)' }}>
        <h2 className="label" style={{ margin: 0 }}>
          Debug console
        </h2>
        <span className="tag tag-neutral">Ctrl+Shift+D to toggle</span>
      </div>

      <div
        className="scroll-x"
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.6,
          padding: 'var(--space-3)',
          background: 'var(--color-surface)',
          border: 'var(--hairline) solid var(--color-divider)',
        }}
      >
        {logs.length === 0 ? (
          <span className="text-muted">No logs yet - start a task to see logs.</span>
        ) : (
          logs.map((log, index) => <div key={index}>{log}</div>)
        )}
      </div>
    </section>
  )
}

export default DebugConsole
