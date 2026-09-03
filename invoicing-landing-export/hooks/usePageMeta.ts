import { useEffect } from 'react'

interface PageMeta {
  title: string
  description: string
  ogTitle?: string
}

export function usePageMeta({ title, description, ogTitle }: PageMeta) {
  useEffect(() => {
    document.title = title

    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name'
      let el = document.querySelector(`meta[${attr}="${name}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    setMeta('description', description)
    setMeta('og:title', ogTitle ?? title, true)
    setMeta('og:description', description, true)
    setMeta('twitter:title', ogTitle ?? title)
    setMeta('twitter:description', description)
  }, [title, description, ogTitle])
}
