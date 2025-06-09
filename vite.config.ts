import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

const host = process.env.TAURI_DEV_HOST;

// Resolve the src directory path
const resolveSrcPath = () => {
  // 如果在CI环境中（通常是GitHub Actions）
  if (process.env.GITHUB_WORKSPACE) {
    return path.resolve(process.env.GITHUB_WORKSPACE, 'src')
  }
  // 本地开发环境
  return path.resolve(process.cwd(), 'src')
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [TanStackRouterVite(), react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  optimizeDeps: {
    include: ['@tauri-apps/api', '@tauri-apps/plugin-updater']
  },

  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    outDir: 'src-tauri/dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  resolve: {
    alias: {
      '@': resolveSrcPath(),
  
      // fix loading all icon chunks in dev mode
      // https://github.com/tabler/tabler-icons/issues/1233
      '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs',
    },
  },
}));
