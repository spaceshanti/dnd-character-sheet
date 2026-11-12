import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/cinzel/500.css'
import '@fontsource/cinzel/700.css'
import '@fontsource-variable/source-sans-3'
import '@fontsource-variable/josefin-sans'
import '@fontsource/rajdhani/500.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import '@fontsource/share-tech-mono'
import '@fontsource-variable/jost'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource-variable/exo-2'
import '@fontsource-variable/exo-2/wght-italic.css'
import './styles/global.css'
import './styles/skins/nier.css'
import './styles/skins/cyberpunk.css'
import './styles/skins/skyrim.css'
import './styles/skins/hollow.css'
import './styles/skins/honkai.css'
import './styles/skins/arknights.css'
import './styles/skins/pda.css'
import './styles/skins/scp.css'
import './styles/book.css'
import { installZoom } from './zoom'
import { loadRuntimeData } from './data/runtime'

installZoom()

// the downloaded book data has to be in place before the libraries built from it load
loadRuntimeData().then(async () => {
  const { default: App } = await import('./App')
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
