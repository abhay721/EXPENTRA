import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode`
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24, // 1 day
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        manifest: {
          name: 'Expense Manager',
          short_name: 'Expense',
          description: 'Track and manage your expenses with ease.',
          theme_color: '#000000',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      }),
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
                      ).replace(
                        new RegExp(`process\\.env\\.${key}`, 'g'),
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
        },
        // This handles the build (npm run build)
        closeBundle() {
            const swPath = path.resolve(__dirname, 'dist/firebase-messaging-sw.js')
            if (fs.existsSync(swPath)) {
              let swContent = fs.readFileSync(swPath, 'utf-8')
              
              Object.keys(env).forEach((key) => {
                if (key.startsWith('VITE_')) {
                  swContent = swContent.replace(
                    new RegExp(`import\\.meta\\.env\\.${key}`, 'g'),
                    `"${env[key]}"`
                  ).replace(
                    new RegExp(`process\\.env\\.${key}`, 'g'),
                    `"${env[key]}"`
                  )
                }
              })
              
              fs.writeFileSync(swPath, swContent)
            }
        }
      }
    ],
  }
})
