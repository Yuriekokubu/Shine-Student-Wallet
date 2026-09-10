(() => {
  function scrollToTarget(target) {
    const tryScroll = (attempt = 0) => {
      const element = document.querySelector(target)
      if (element) {
        const top = element.getBoundingClientRect().top + window.scrollY - 82
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
        return
      }
      if (attempt < 8) window.setTimeout(() => tryScroll(attempt + 1), 100)
    }

    tryScroll()
  }

  function getTarget(button) {
    const label = button.textContent?.trim() || ''
    if (label.includes('นักเรียน')) return '.student-list'
    if (label.includes('สินค้า')) return '.admin-products'
    if (label.includes('เติมเงิน')) return '.history-panel'
    return null
  }

  document.addEventListener('click', (event) => {
    if (!window.location.pathname.startsWith('/admin')) return

    const button = event.target instanceof Element
      ? event.target.closest('.admin-mobile-menu button')
      : null

    if (!button) return

    const target = getTarget(button)
    if (target) {
      window.setTimeout(() => scrollToTarget(target), 80)
    }
  })
})()
