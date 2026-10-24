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
import './styles/global.css'
import './styles/skins/nier.css'
import './styles/skins/cyberpunk.css'
import './styles/skins/skyrim.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
