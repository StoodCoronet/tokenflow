import { execSync } from 'child_process'

export function openBrowser(url: string): void {
  const platform = process.platform
  try {
    if (platform === 'darwin') {
      execSync(`open "${url}"`)
    } else if (platform === 'win32') {
      execSync(`start "${url}"`)
    } else {
      execSync(`xdg-open "${url}"`)
    }
  } catch {
    console.log(`Please open your browser: ${url}`)
  }
}
