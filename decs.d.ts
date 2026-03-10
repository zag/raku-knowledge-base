declare module '*.scss' {
  const css: { [key: string]: string }
  export default css
}
declare module '*.sass' {
  const css: { [key: string]: string }
  export default css
}
declare module 'react-markup'
declare module '*.webp'
declare module '*.png'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.mp4'
declare module '*.css'
declare module '*.gif'
declare module '*.pdf'
declare module '*.svg'
declare module '@pagefind/default-ui'

interface Window {
  pagefind?: unknown
  PagefindUI?: new (options: Record<string, unknown>) => { destroy(): void }
}
