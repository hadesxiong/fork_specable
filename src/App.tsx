import { MainLayout } from './components/Layout'
import { FullscreenPreview } from './components/Preview/FullscreenPreview'

function App() {
  const params = new URLSearchParams(window.location.search)
  const isPreviewMode = params.get('view') === 'preview'

  if (isPreviewMode) {
    return <FullscreenPreview />
  }

  return <MainLayout />
}

export default App
