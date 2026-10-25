(function () {
  'use strict';
  const preferenceKey = 'smartstay-theme';
  const root = document.documentElement;
  let transitionTimer;
  function savedTheme() {
    try { return localStorage.getItem(preferenceKey) === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  }
  // This blocking head script runs before styles or page content can render.
  root.dataset.theme = savedTheme();
  root.style.colorScheme = root.dataset.theme;

  function applyTheme(theme, persist = true) {
    if (!['light', 'dark'].includes(theme)) return;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-changing');
      clearTimeout(transitionTimer);
      transitionTimer = setTimeout(() => root.classList.remove('theme-changing'), 180);
    }
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (persist) {
      try { localStorage.setItem(preferenceKey, theme); } catch { /* Session theme still works. */ }
    }
    window.dispatchEvent(new Event('smartstay:theme-change'));
  }

  const paths = {
    moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
  };
  class ThemeToggle extends HTMLElement {
    connectedCallback() {
      if (!this.button) {
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'theme-toggle';
        this.button.dataset.themeToggle = '';
        this.button.onclick = () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
        this.replaceChildren(this.button);
        this.update = () => {
          const dark = root.dataset.theme === 'dark';
          const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
          this.button.setAttribute('aria-label', label);
          this.button.setAttribute('aria-pressed', String(dark));
          this.button.title = label;
          this.button.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[dark ? 'sun' : 'moon']}</svg>`;
        };
      }
      window.addEventListener('smartstay:theme-change', this.update);
      this.update();
    }
    disconnectedCallback() { window.removeEventListener('smartstay:theme-change', this.update); }
  }
  customElements.define('smartstay-theme-toggle', ThemeToggle);
  // Other tabs follow a changed preference; deleting it restores the light default.
  window.addEventListener('storage', event => {
    if (event.key === preferenceKey || event.key === null) applyTheme(savedTheme(), false);
  });
})();
