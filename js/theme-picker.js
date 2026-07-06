/**
 * Renders the subtle theme picker into a container element.
 */
const ThemePicker = {
  html: `
    <div class="theme-picker" aria-label="Theme selector">
      <button type="button" class="theme-picker-toggle" title="Change theme" aria-haspopup="true" aria-expanded="false">Theme</button>
      <div class="theme-picker-menu" hidden>
        <button type="button" data-theme-btn="light">Light</button>
        <button type="button" data-theme-btn="dark">Dark</button>
        <button type="button" data-theme-btn="high-contrast">High contrast</button>
        <button type="button" data-theme-btn="corporate">Corporate</button>
      </div>
    </div>
  `,

  mount(selector) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = this.html;
  }
};

if (typeof window !== "undefined") {
  window.ThemePicker = ThemePicker;
}
