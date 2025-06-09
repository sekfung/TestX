// Tauri 全局类型声明
declare global {
  interface Window {
    __TAURI__?: {
      core: any
      event: any
      fs: any
      dialog: any
      [key: string]: any
    }
  }
}

export {} 