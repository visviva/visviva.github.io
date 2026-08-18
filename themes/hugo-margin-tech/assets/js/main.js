(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const themeIcon = themeToggle?.querySelector('[data-theme-icon]');
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

  const effectiveTheme = () => root.dataset.theme || (colorScheme.matches ? 'dark' : 'light');
  const updateThemeToggle = () => {
    if (!themeToggle) return;
    const dark = effectiveTheme() === 'dark';
    themeToggle.setAttribute('aria-label', dark ? 'Use light mode' : 'Use dark mode');
    themeToggle.setAttribute('title', dark ? 'Use light mode' : 'Use dark mode');
    themeToggle.setAttribute('aria-pressed', String(dark));
    if (themeIcon) themeIcon.textContent = dark ? '☀' : '☾';
  };

  themeToggle?.addEventListener('click', () => {
    const theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch (_) {}
    updateThemeToggle();
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  });

  colorScheme.addEventListener?.('change', () => {
    if (!root.dataset.theme) {
      updateThemeToggle();
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: effectiveTheme() } }));
    }
  });
  updateThemeToggle();

  const headings = [...document.querySelectorAll('.prose h2[id], .prose h3[id]')];
  const tocLinks = [...document.querySelectorAll('.toc-rail a[href^="#"]')];
  const linkById = new Map(tocLinks.map(a => [decodeURIComponent(a.hash.slice(1)), a]));

  if ('IntersectionObserver' in window && headings.length) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      tocLinks.forEach(a => a.removeAttribute('aria-current'));
      linkById.get(visible.target.id)?.setAttribute('aria-current', 'true');
    }, { rootMargin: '-15% 0px -70% 0px' });
    headings.forEach(h => observer.observe(h));
  }

  const marginNotes = [...document.querySelectorAll('[data-margin-note]')];
  const desktopNotes = window.matchMedia('(min-width: 1101px)');
  let noteLayoutFrame;

  const positionMarginNotes = () => {
    cancelAnimationFrame(noteLayoutFrame);
    noteLayoutFrame = requestAnimationFrame(() => {
      const article = document.querySelector('.article-main');
      if (!article || !marginNotes.length || !desktopNotes.matches) {
        marginNotes.forEach(note => note.style.removeProperty('top'));
        return;
      }

      const articleTop = article.getBoundingClientRect().top;
      let previousBottom = -Infinity;
      marginNotes.forEach(note => {
        const anchor = document.getElementById(note.dataset.noteAnchor);
        if (!anchor) return;
        const anchorTop = anchor.getBoundingClientRect().top - articleTop;
        const top = Math.max(anchorTop, previousBottom + 16);
        note.style.top = `${top}px`;
        previousBottom = top + note.offsetHeight;
      });
    });
  };

  positionMarginNotes();
  window.addEventListener('resize', positionMarginNotes);
  window.addEventListener('load', positionMarginNotes);
  document.fonts?.ready.then(positionMarginNotes);
})();
