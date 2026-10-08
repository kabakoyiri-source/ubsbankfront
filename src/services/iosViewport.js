// iOS has separate layout and visible viewports. Safari's controls and the
// keyboard can occupy part of the former without changing a fixed footer.
export function initializeIosViewport() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!ios) return

  const root = document.documentElement
  root.dataset.platform = 'ios'
  const viewport = window.visualViewport
  const mode = window.matchMedia('(display-mode: standalone)')
  const anchor = document.createElement('div')
  anchor.setAttribute('aria-hidden', 'true')
  anchor.dataset.viewportAnchor = ''
  anchor.style.cssText = 'position:fixed;bottom:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;'
  document.body.appendChild(anchor)
  let frame
  let settlingFrames = 0

  const update = () => {
    frame = undefined
    root.dataset.displayMode = navigator.standalone || mode.matches ? 'standalone' : 'browser'
    // Keep the user's pinch zoom; it must not be treated as a keyboard resize.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return
    const height = viewport?.height || window.innerHeight
    const bottom = height + (viewport?.offsetTop || 0)
    const nav = document.querySelector('.app-bottom-nav')
    const navStyle = nav && getComputedStyle(nav)
    // Some WebKit builds already move a fixed footer into the visible area.
    // Measure that footer's own unshifted edge, rather than shifting it twice.
    const fixedBottom = navStyle?.display !== 'none' && nav ? nav.getBoundingClientRect().bottom + (parseFloat(navStyle.bottom) || 0) : anchor.getBoundingClientRect().bottom
    const offset = fixedBottom - bottom
    const active = document.activeElement
    const editable = active && (active.isContentEditable || active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && !['button', 'submit', 'checkbox', 'radio', 'range', 'file'].includes(active.type))) && !active.readOnly
    const obscured = Math.max(window.innerHeight, root.clientHeight) - bottom
    root.dataset.keyboard = editable && obscured > 120 ? 'open' : 'closed'
    root.style.setProperty('--app-viewport-height', `${height}px`)
    root.style.setProperty('--app-viewport-offset', `${Math.round(offset)}px`)
    // Rotation and closing the iOS keyboard can rebase fixed elements after
    // the resize event. Recheck for two frames after that layout has committed.
    if (settlingFrames > 0) { settlingFrames -= 1; frame = window.requestAnimationFrame(update) }
  }
  const schedule = () => { settlingFrames = 2; if (frame === undefined) frame = window.requestAnimationFrame(update) }
  update()
  viewport?.addEventListener('resize', schedule)
  viewport?.addEventListener('scroll', schedule)
  window.addEventListener('resize', schedule)
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('orientationchange', schedule)
  window.addEventListener('pageshow', schedule)
  document.addEventListener('focusin', schedule)
  document.addEventListener('focusout', schedule)
  document.addEventListener('visibilitychange', schedule)
  mode.addEventListener?.('change', schedule)
  // The footer is mounted after authentication, and replaced on route changes.
  new MutationObserver(schedule).observe(document.getElementById('root'), { childList: true, subtree: true })
}
