import { useState } from 'react'
import Layout from './components/Layout'
import QuickStart from './pages/QuickStart'
import Features from './pages/Features'
import ApiReference from './pages/ApiReference'
import ConfigReference from './pages/ConfigReference'

type Page = 'quickstart' | 'features' | 'api' | 'config'

const pages: Record<Page, { title: string; component: () => JSX.Element }> = {
  quickstart: { title: '快速开始', component: QuickStart },
  features: { title: '功能介绍', component: Features },
  api: { title: 'API 参考', component: ApiReference },
  config: { title: '配置参考', component: ConfigReference },
}

export default function App() {
  const [page, setPage] = useState<Page>('quickstart')

  const PageComponent = pages[page].component

  return (
    <Layout
      currentPage={page}
      onNavigate={(p) => setPage(p as Page)}
      pages={pages}
    >
      <PageComponent />
    </Layout>
  )
}
