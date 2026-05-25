import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import QuickStart from './pages/QuickStart'
import Features from './pages/Features'
import GuiGuide from './pages/GuiGuide'
import TuiGuide from './pages/TuiGuide'
import ApiReference from './pages/ApiReference'
import ConfigReference from './pages/ConfigReference'
import TechnicalDoc from './pages/TechnicalDoc'

type Page = 'quickstart' | 'features' | 'gui' | 'tui' | 'api' | 'config' | 'technical'

const pages: Record<Page, { title: string; component: () => JSX.Element }> = {
  quickstart: { title: '快速开始', component: QuickStart },
  features: { title: '功能介绍', component: Features },
  gui: { title: 'GUI 使用指南', component: GuiGuide },
  tui: { title: 'TUI 使用指南', component: TuiGuide },
  api: { title: 'API 参考', component: ApiReference },
  config: { title: '配置参考', component: ConfigReference },
  technical: { title: '技术文档', component: TechnicalDoc },
}

function getInitialPage(): Page {
  const hash = window.location.hash.replace('#', '')
  if (hash && hash in pages) return hash as Page
  return 'quickstart'
}

export default function App() {
  const [page, setPage] = useState<Page>(getInitialPage)

  useEffect(() => {
    const handleHashChange = () => setPage(getInitialPage())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const handleNavigate = (p: string) => {
    setPage(p as Page)
    window.location.hash = p
  }

  const PageComponent = pages[page].component

  return (
    <Layout
      currentPage={page}
      onNavigate={handleNavigate}
      pages={pages}
    >
      <PageComponent />
    </Layout>
  )
}
