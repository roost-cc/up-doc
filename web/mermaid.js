/* global mermaid, pako, hljs */
import * as modal from "./modal.js";
import { lineIndexOf, addScript } from "./util.js";
import { MarkdownRenderer } from "./index.js";
import { mermaid as mermaid_cdn, pako, highlightjs } from "./cdn-scripts.js";

export class MermaidRenderer {
  constructor() {
    this.classDocMap = new Map();
    this.initialized = false;
    this.renderer = null;
  }

  /**
   * @param {MarkdownRenderer} renderer
   */
  async init(renderer) {
    this.renderer = renderer;
    await Promise.all([
      addScript(mermaid_cdn),
      addScript(pako),
      addScript(highlightjs),
    ]);

    mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true });

    // Override rendering for mermaid blocks
    renderer.md.renderer.rules.fence = (tokens, idx) => {
      const token = tokens[idx];
      const code = token.content.trim();
      const lang = token.info.trim();

      if (lang === "mermaid") {
        // Store the exact code content for comparison later
        return `<pre class="mermaid" data-source="${encodeURIComponent(code)}">${code}</pre>`;
      }

      // Syntax-highlighted code blocks
      const highlighted =
        lang && hljs.getLanguage(lang)
          ? hljs.highlight(code, { language: lang }).value
          : hljs.highlightAuto(code).value;
      return `<pre><code class="hljs">${highlighted}</code></pre>`;
    };

    await this.loadDocsMapping(renderer.path);
    this.initialized = true;
  }

  // Load and process the docs.json file (only when needed)
  /**
   * @param {string} path
   */
  async loadDocsMapping(path) {
    try {
      const docsPath = new URL(
        "api/docs.json",
        new URL(path, window.location.toString()),
      );
      const response = await fetch(docsPath);
      if (!response.ok) {
        return;
      }
      const docs = await response.json();

      // First, find the package information
      const packageInfo = docs.find((entry) => entry.kind === "package");
      if (!packageInfo) {
        throw new Error("Package information not found in docs.json");
      }

      const packageName = packageInfo.name;
      const packageVersion = packageInfo.version;
      console.log(`Found package: ${packageName} v${packageVersion}`);

      // Process each documentation entry
      docs.forEach((entry) => {
        if (entry.kind === "class") {
          const className = entry.name;
          // Convert the longname to the HTML file path
          // e.g., "module:accountController~AccountController" -> "module-accountController-AccountController.html"
          const convertedName = entry.longname.replace(/[:~]/g, "-");

          let path_dir = path;
          if (!path.endsWith("/")) {
            const path_elements = path.split("/");
            path_elements.pop();
            path_dir = path_elements.join("/") + "/";
          }
          const htmlFile = `${path_dir}api/${packageName}/${packageVersion}/${convertedName}.html`;
          this.classDocMap.set(className, htmlFile);
          console.log(`Mapped class ${className} to ${htmlFile}`);
        }
      });
    } catch (error) {
      console.error("Error loading docs mapping:", error);
    }
  }

  /**
   * Helper to add click handlers to participant blocks
   * @param {HTMLElement} element
   */
  addParticipantHandlers(element) {
    const participants = element.querySelectorAll("rect.actor");
    participants.forEach((participant) => {
      /** @type {HTMLElement | SVGElement} */
      const svgElement = /** @type {any} */ (participant);
      svgElement.style.cursor = "pointer";
      svgElement.onclick = (e) => {
        e.stopPropagation();
        // Get the text element that's a sibling to this rect
        const textElement = participant.parentElement.querySelector("text");
        const participantName = textElement
          ? textElement.textContent.trim()
          : "";
        console.log("Participant clicked:", participantName);

        // Check if we have documentation for this participant
        const docFile = this.classDocMap.get(participantName);
        if (docFile) {
          window.open(docFile, "_blank");
        }
      };
    });
  }

  /**
   * Render the mermaid diagrams
   */
  async render() {
    if (!this.initialized) {
      throw new Error("MermaidRenderer not initialized");
    }
    // Find all mermaid diagrams and render them
    const mermaidDivs = this.renderer.element.querySelectorAll(".mermaid");
    if (mermaidDivs.length === 0) return;

    let diagramCount = 0;
    for (const mermaidElement of mermaidDivs) {
      const graphDefinition = mermaidElement.textContent;
      try {
        const id = `mermaid-diagram-${diagramCount++}`;
        const { svg } = await mermaid.render(id, graphDefinition);

        // Create a container for the diagram and links
        const diagramContainer = document.createElement("div");
        diagramContainer.className = "mermaid-container";

        // Create the diagram element
        const diagramElement = document.createElement("div");
        diagramElement.innerHTML = svg;
        diagramElement.onclick = (e) => {
          modal.setContent(svg);
          this.addParticipantHandlers(modal.modalContent);
          modal.show();
          e.stopPropagation();
        };

        // Create links container
        const linksContainer = document.createElement("div");
        linksContainer.className = "mermaid-links";

        // Create download link
        const downloadLink = document.createElement("a");
        downloadLink.textContent = "📥 Download Mermaid Source";
        downloadLink.href = "#";

        // Generate filename based on nearest header (using original element position in DOM)
        const baseFilename = createFilenameFromHeader(mermaidElement);
        const filename = baseFilename
          ? `${baseFilename}.mmd`
          : `mermaid-diagram-${diagramCount}.mmd`;
        downloadLink.download = filename;

        downloadLink.onclick = (e) => {
          e.preventDefault();
          const blob = new Blob([graphDefinition], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        };

        // Create live editor link
        const editorLink = document.createElement("a");
        editorLink.textContent = "🔗 Open in Mermaid Live Editor";

        // Create the JSON structure that Mermaid Live Editor expects
        const editorData = {
          code: graphDefinition,
        };

        // Convert to JSON string, compress with pako, and encode as URL-safe base64
        try {
          const jsonString = JSON.stringify(editorData);
          const compressed = pako.deflate(jsonString, { to: "string" });
          const base64 = btoa(String.fromCharCode.apply(null, compressed));
          // Convert to URL-safe base64 (replace + with -, / with _)
          const urlSafeBase64 = base64.replace(/\+/g, "-").replace(/\//g, "_");
          const editorUrl = `https://mermaid.live/edit#pako:${urlSafeBase64}`;
          editorLink.href = editorUrl;
          editorLink.target = "_blank";
        } catch (pakoErr) {
          console.warn(
            "[MermaidRenderer] editor link unavailable:",
            pakoErr.message,
          );
          editorLink.style.display = "none";
        }

        // Add links to container
        linksContainer.appendChild(downloadLink);
        linksContainer.appendChild(document.createTextNode(" | "));
        linksContainer.appendChild(editorLink);

        // Add diagram and links to container
        diagramContainer.appendChild(diagramElement);
        diagramContainer.appendChild(linksContainer);

        // Replace the original element with the container
        mermaidElement.parentNode.replaceChild(
          diagramContainer,
          mermaidElement,
        );
      } catch (error) {
        console.error("Mermaid rendering failed:", error);
        const diagramSource = decodeURIComponent(
          mermaidElement.getAttribute("data-source"),
        );
        console.log("Attempting to locate diagram with source:", diagramSource);
        const startLine = lineIndexOf(this.renderer.markdown, diagramSource);
        const errorMessage = `
          <div class="error">
          <strong>Mermaid Syntax Error in <a href="${this.renderer.path}" target="_blank">${this.renderer.path}</a>${startLine ? ` at line ${startLine}` : ""}</strong>
          <pre>${error.message || "Unknown error"}</pre>
          <details>
              <summary>Markdown Source</summary>
              <div class="line-numbers">
              ${error.hash ? createLineNumberedDisplay(diagramSource, startLine, startLine + error.hash.line - 1) : ""}
              </div>
          </details>
          </div>
      `;
        mermaidElement.innerHTML = errorMessage;
      }
    }
  }
}

// Helper to create line-numbered display
/**
 *
 * @param {string} code
 * @param {number} startLine
 * @param {number} errorLine
 * @returns
 */
function createLineNumberedDisplay(code, startLine, errorLine = -1) {
  const lines = code.split("\n");
  return lines
    .map(
      (line, i) => `
      <div class="line ${errorLine === startLine + i ? "error" : ""}">
        <span class="line-number">${startLine + i}</span>
        <span class="line-icon">${errorLine === startLine + i ? "✗" : ""}</span>
        <span class="line-content">${line}</span>
      </div>
    `,
    )
    .join("");
}

// Helper function to process header text into a valid filename
function processHeaderToFilename(headerText) {
  return headerText
    .toLowerCase() // make lowercase
    .replace(/\s+/g, "_") // convert spaces to underscores
    .replace(/[^a-z0-9_]/g, "") // remove all characters except a-z, 0-9, _
    .replace(/_{2,}/g, "_") // collapse multiple underscores
    .replace(/^_+|_+$/g, ""); // trim leading/trailing underscores
}

// Helper function to find the nearest preceding header and create a filename
function createFilenameFromHeader(element) {
  // Find the nearest preceding header (h1, h2, h3, h4, h5, h6)
  let current = element;
  while (current) {
    // Go to previous sibling or parent's previous sibling
    if (current.previousElementSibling) {
      current = current.previousElementSibling;
      // Check if this element or its last descendant is a header
      const headers = current.querySelectorAll("h1, h2, h3, h4, h5, h6");
      if (headers.length > 0) {
        // Use the last header found in this element
        const headerText = headers[headers.length - 1].textContent;
        return processHeaderToFilename(headerText);
      } else if (current.matches("h1, h2, h3, h4, h5, h6")) {
        const headerText = current.textContent;
        return processHeaderToFilename(headerText);
      }
    } else {
      current = current.parentElement;
    }
  }

  // Fallback if no header found
  return "mermaid-diagram";
}
