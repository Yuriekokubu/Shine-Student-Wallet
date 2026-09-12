export function scrollToAdminSection(selector: string) {
  const tryScroll = (attempt = 0) => {
    const element = document.querySelector(selector)

    if (element) {
      const top = element.getBoundingClientRect().top + window.scrollY - 82
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      return
    }

    if (attempt < 8) {
      window.setTimeout(() => tryScroll(attempt + 1), 100)
    }
  }

  tryScroll()
}
