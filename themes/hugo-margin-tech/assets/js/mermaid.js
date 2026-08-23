(() => {
  const diagrams = [...document.querySelectorAll('.mermaid')];
  if (!diagrams.length || !globalThis.mermaid) return;

  diagrams.forEach(diagram => {
    diagram.dataset.mermaidSource = diagram.textContent;
  });

  const renderDiagrams = async () => {
    const dark = document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: dark ? 'dark' : 'neutral'
    });

    diagrams.forEach(diagram => {
      diagram.removeAttribute('data-processed');
      diagram.textContent = diagram.dataset.mermaidSource;
    });

    await mermaid.run({ nodes: diagrams });
  };

  const render = () => {
    renderDiagrams().catch(error => console.error('Unable to render Mermaid diagrams.', error));
  };

  render();
  window.addEventListener('themechange', render);
})();
