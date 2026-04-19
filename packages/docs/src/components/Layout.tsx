import { useState } from 'react'

interface LayoutProps {
  currentPage: string
  onNavigate: (page: string) => void
  pages: Record<string, { title: string }>
  children: React.ReactNode
}

export default function Layout({ currentPage, onNavigate, pages, children }: LayoutProps) {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  const toggleDark = () => {
    setDark(!dark)
    document.documentElement.classList.toggle('dark')
  }

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
          onClick={toggleDark}
          className="text-tf-muted hover:text-tf-text text-sm mt-4 px-3 py-2 rounded-lg hover:bg-tf-border/40 transition-colors"
        >
          {dark ? '☀ 亮色' : '☾ 暗色'}
        </button>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 max-w-4xl overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
