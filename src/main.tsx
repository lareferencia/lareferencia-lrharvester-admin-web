import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiClient } from './api/client'
import { App } from './app/App'
import { loadRuntimeConfig } from './app/config'
import './i18n'

const config = await loadRuntimeConfig()
createRoot(document.getElementById('root')!).render(<StrictMode><App client={new ApiClient(config.apiBaseUrl)} /></StrictMode>)
