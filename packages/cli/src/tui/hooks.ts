import { useState, useEffect } from 'react'

type KeyHandler = (key: string) => void

export function useKeyInput(handler: KeyHandler, active = true) {
  useEffect(() => {
    if (!active) return

    const rawHandler = (ch: string, key: any) => {
      if (key.name === 'up') handler('up')
      else if (key.name === 'down') handler('down')
      else if (key.name === 'return') handler('enter')
      else if (key.name === 'escape') handler('escape')
      else if (key.name === 'q') handler('q')
      else if (key.name === 'tab') handler('tab')
      else if (key.name === 'backspace') handler('backspace')
      else if (key.name === 'left') handler('left')
      else if (key.name === 'right') handler('right')
      else if (ch) handler(ch)
    }

    const { stdin } = process
    if (stdin.isTTY) {
      stdin.setRawMode(true)
      stdin.resume()
      stdin.on('data', (buf: Buffer) => {
        const s = buf.toString()
        // ink handles raw mode, we parse manually for simplicity
        // Most key sequences:
        if (s === '\x1b[A') rawHandler('', { name: 'up' })
        else if (s === '\x1b[B') rawHandler('', { name: 'down' })
        else if (s === '\r') rawHandler('', { name: 'return' })
        else if (s === '\x1b') rawHandler('', { name: 'escape' })
        else if (s === '\x7f') rawHandler('', { name: 'backspace' })
        else if (s === '\t') rawHandler('', { name: 'tab' })
        else if (s === '\x1b[D') rawHandler('', { name: 'left' })
        else if (s === '\x1b[C') rawHandler('', { name: 'right' })
        else if (s.length === 1 && s >= ' ') rawHandler(s, { name: s })
        else if (s === 'q') rawHandler('q', { name: 'q' })
      })
    }

    return () => {
      if (stdin.isTTY) {
        stdin.removeListener('data', rawHandler as any)
      }
    }
  }, [active, handler])
}
