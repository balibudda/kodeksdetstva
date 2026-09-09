import { useEffect, useState } from 'react'
import { SECTIONS, CARDS } from './data/sections.ts'
import { Home } from './screens/Home.tsx'
import { SectionScreen } from './screens/Section.tsx'
import { CardScreen } from './screens/Card.tsx'
import { About } from './screens/About.tsx'
import { Help } from './screens/Help.tsx'

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash || '#/')
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  useEffect(() => {
    document.querySelector('.app-scroll')?.scrollTo(0, 0)
    window.scrollTo(0, 0)
  }, [hash])
  return hash
}

export function App() {
  const route = useHashRoute()
  const path = route.replace(/^#/, '') || '/'

  let screen: React.ReactNode
  if (path === '/') {
    screen = <Home />
  } else if (path === '/about') {
    screen = <About />
  } else if (path === '/help') {
    screen = <Help />
  } else if (path.startsWith('/s/')) {
    const section = SECTIONS.find((s) => s.id === path.slice(3))
    screen = section ? <SectionScreen section={section} /> : <NotFound />
  } else if (path.startsWith('/c/')) {
    const card = CARDS.find((c) => c.id === path.slice(3))
    screen = card ? <CardScreen card={card} /> : <NotFound />
  } else {
    screen = <NotFound />
  }

  const atHome = path === '/'

  return (
    <div className="app">
      <header className="topbar">
        {atHome ? (
          <span className="brand">Дитя&nbsp;Бога</span>
        ) : (
          <button className="back" onClick={() => window.history.back()} aria-label="Назад">
            ← Назад
          </button>
        )}
        <a className="help-link" href="#/help">
          Помощь
        </a>
      </header>
      <main className="app-scroll">{screen}</main>
    </div>
  )
}

function NotFound() {
  return (
    <section className="screen">
      <h1>Страница не найдена</h1>
      <p>
        <a href="#/">На главную</a>
      </p>
    </section>
  )
}
