import { useEffect, useState } from 'react'

interface LayoutProps {
  currentPage: string
  onNavigate: (page: string) => void
  pages: Record<string, { title: string }>
  children: React.ReactNode
}

export default function Layout({ currentPage, onNavigate, pages, children }: LayoutProps) {
  const [dark, setDark] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('tf-theme') : null
    if (stored) return stored === 'dark'
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('tf-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className="min-h-screen bg-tf-bg flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-tf-border bg-tf-card p-4 flex flex-col shrink-0">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-tf-text">Token Flow</h1>
          <p className="text-xs text-tf-muted mt-0.5">文档</p>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {Object.entries(pages).map(([key, { title }]) => (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                currentPage === key
                  ? 'bg-tf-accent/10 text-tf-accent font-medium'
                  : 'text-tf-muted hover:text-tf-text hover:bg-tf-border/40'
              }`}
            >
              {title}
            </button>
          ))}
        </nav>

        <button
          onClick={() => setDark(d => !d)}
          className="flex items-center gap-2 text-tf-muted hover:text-tf-text text-sm mt-4 px-3 py-2 rounded-lg hover:bg-tf-border/40 transition-colors"
          aria-label="Toggle theme"
        >
          {dark ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <span>亮色</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>暗色</span>
            </>
          )}
        </button>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 max-w-4xl overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
