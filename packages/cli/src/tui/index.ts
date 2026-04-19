import React from 'react'
import { render } from 'ink'
import { TuiApp } from './app.js'

export function startTui() {
  render(React.createElement(TuiApp))
}
