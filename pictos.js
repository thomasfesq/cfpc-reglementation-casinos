(() => {
  "use strict";

  const namespace = "http://www.w3.org/2000/svg";
  const shapes = {
    "Admission en salle": [
      ["rect", {x: 4, y: 6, width: 16, height: 14, rx: 2}],
      ["path", {d: "M9 6V4h6v2M12 12h5m-5 3h4m-9 2c0-1.3.9-2 2-2"}],
      ["circle", {cx: 8.5, cy: 11.5, r: 1.5}]
    ],
    "Roulette française": [
      ["circle", {cx: 12, cy: 12, r: 9}],
      ["circle", {cx: 12, cy: 12, r: 4}],
      ["path", {d: "M12 3v5m0 8v5M3 12h5m8 0h5M5.6 5.6l3.6 3.6m5.6 5.6 3.6 3.6m0-12.8-3.6 3.6m-5.6 5.6-3.6 3.6"}],
      ["circle", {cx: 12, cy: 12, r: 1, fill: "currentColor", stroke: "none"}]
    ],
    "Black-jack": [
      ["path", {d: "M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"}],
      ["rect", {x: 9, y: 3, width: 12, height: 18, rx: 2}],
      ["path", {d: "m15 8 3 4-3 4-3-4Z"}]
    ],
    "Machines à sous": [
      ["rect", {x: 3, y: 5, width: 15, height: 15, rx: 2}],
      ["rect", {x: 6, y: 8, width: 9, height: 6, rx: 1}],
      ["path", {d: "M9 8v6m3-6v6m-3 3h3m6-4h3V9"}],
      ["circle", {cx: 21, cy: 7, r: 1}]
    ],
    "Surveillance et contrôle": [
      ["path", {d: "M2 12c2.8-4 6.1-6 10-6s7.2 2 10 6c-2.8 4-6.1 6-10 6s-7.2-2-10-6Z"}],
      ["circle", {cx: 12, cy: 12, r: 3}]
    ],
    "Protection des joueurs": [
      ["path", {d: "M12 3 4 6v5c0 4.5 2.5 7.5 8 10 5.5-2.5 8-5.5 8-10V6l-8-3Z"}],
      ["path", {d: "m8.5 12 2.5 2.5 4.5-4.5"}]
    ],
    check: [["path", {d: "m5 12 4.5 4.5L19 7"}]],
    review: [["path", {d: "M3 11a9 9 0 1 1 2.7 7.4M3 5v6h6m3-3v4l3 2"}]],
    book: [["path", {d: "M12 6c-2-2-5-2-9-2v14c4 0 7 0 9 2 2-2 5-2 9-2V4c-4 0-7 0-9 2Zm0 0v14"}]],
    chip: [
      ["circle", {cx: 12, cy: 12, r: 9}],
      ["circle", {cx: 12, cy: 12, r: 5.5}],
      ["path", {d: "M12 3v3.5m0 11V21M3 12h3.5m11 0H21m-9-3 2.5 3-2.5 3-2.5-3Z"}]
    ],
    trophy: [["path", {d: "M8 4h8v6a4 4 0 0 1-8 0V4Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v4m-4 2h8"}]],
    "app-install": [
      ["rect", {x: 6, y: 2, width: 12, height: 20, rx: 2.5}],
      ["path", {d: "M12 6v7m-3-3 3 3 3-3m-5 7h4"}]
    ],
    "arrow-right": [["path", {d: "M4 12h15m-6-6 6 6-6 6"}]],
    "arrow-left": [["path", {d: "M20 12H5m6 6-6-6 6-6"}]]
  };

  function create(name, cssClass) {
    const svg = document.createElementNS(namespace, "svg");
    svg.classList.add("picto");
    if (cssClass) svg.classList.add(cssClass);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const icon = Object.hasOwn(shapes, name) ? shapes[name] : shapes.chip;
    for (const [tag, attributes] of icon) {
      const shape = document.createElementNS(namespace, tag);
      for (const [attribute, value] of Object.entries(attributes)) shape.setAttribute(attribute, value);
      svg.append(shape);
    }
    return svg;
  }

  window.CFPC_PICTOS = Object.freeze({create});
})();
