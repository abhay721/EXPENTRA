import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode`
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [
      react(),
      {
        name: 'sw-env-transformer',
        // This handles the dev server (npm run dev)
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/firebase-messaging-sw.js') {
              const swPath = path.resolve(__dirname, 'public/firebase-messaging-sw.js')
              if (fs.existsSync(swPath)) {
                let swContent = fs.readFileSync(swPath, 'utf-8')
                
                // Replace import.meta.env.VITE_... with actual values from .env
                Object.keys(env).forEach((key) => {
                  if (key.startsWith('VITE_')) {
                    swContent = swContent.replace(
                      new RegExp(`import\\.meta\\.env\\.${key}`, 'g'),
                      `"${env[key]}"`
                    )
                  }
                })
                
                res.setHeader('Content-Type', 'application/javascript')
                res.end(swContent)
                return
              }
            }
            next()
          })
        }
      }
    ],
  }
})
