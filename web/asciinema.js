import { addScript, addCSSLink } from './util.js';
import { asciinema_script, asciinema_css } from './cdn-scripts.js';

export class AsciinemaRenderer {
  constructor() {
    this.initialized = false;
    this.renderer = null;
  }

  async init(renderer) {
    this.renderer = renderer;
    await Promise.all([addScript(asciinema_script), addCSSLink(asciinema_css)]);
    this.initialized = true;
  }

  async render() {
    if (!this.initialized) {
      throw new Error('AsciinemaRenderer not initialized');
    }

    // Find all links that point to .cast files
    const castLinks = this.renderer.element.querySelectorAll('a[href$=".cast"]');

    for (const castLink of castLinks) {
      const castUrl = castLink.href;
      const linkText = castLink.textContent;

      // Create a container for the player and download link
      const container = document.createElement('div');
      container.className = 'asciinema-container';

      // Create the asciinema player element
      const player = document.createElement('div');
      AsciinemaPlayer.create(castUrl, player, {
        terminalFontFamily:
          '"SauceCodePro Nerd Font Mono", "SauceCodePro NF", Consolas, Menlo, "Bitstream Vera Sans Mono", monospace, "Powerline Symbols"',
      });

      // Create the download link
      const downloadLink = document.createElement('a');
      downloadLink.href = castUrl;
      downloadLink.textContent = `📥 Download ${linkText}`;
      downloadLink.download = castUrl.split('/').pop();
      downloadLink.className = 'asciinema-download';

      // Build the container
      container.appendChild(player);
      container.appendChild(downloadLink);

      // Replace the original link with the container
      castLink.parentNode.replaceChild(container, castLink);
    }
  }
}
