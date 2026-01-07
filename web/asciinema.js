import { addScript, addCSSLink } from './util.js';
const asciinema_script_attributes = {
  src: 'https://cdn.jsdelivr.net/npm/asciinema-player@3.12.1/dist/bundle/asciinema-player.min.js',
  integrity: 'sha256-VoS8wUKbD63rWOmKvq3G0RYrbWAeVrTCbF5vl1qWXBw=',
  crossorigin: 'anonymous',
  referrerpolicy: 'no-referrer',
};
const asciinema_css_attributes = {
  href: 'https://cdn.jsdelivr.net/npm/asciinema-player@3.12.1/dist/bundle/asciinema-player.min.css',
};

export class AsciinemaRenderer {
  constructor() {
    this.initialized = false;
    this.renderer = null;
  }

  async init(renderer) {
    this.renderer = renderer;
    await Promise.all([addScript(asciinema_script_attributes), addCSSLink(asciinema_css_attributes)]);
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
