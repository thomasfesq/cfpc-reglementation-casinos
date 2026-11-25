"use strict";

window.CFPC_MISSIONS = (() => {
  const events = Object.freeze([
    Object.freeze({id: 0, label: "Le croupier annonce « Rien ne va plus »."}),
    Object.freeze({id: 1, label: "Le joueur dépose son jeton."}),
    Object.freeze({id: 2, label: "La bille s’immobilise."}),
  ]);
  const displayOrder = Object.freeze([2, 0, 1]);
  const quickLength = 3;
  const phases = ["question", "reaction", "correction", "complete"];

  function restoreTimeline(raw) {
    const order = Array.isArray(raw?.order) ? [...new Set(raw.order)].filter(
      (id) => events.some((event) => event.id === id)
    ) : [];
    return {order, checked: raw?.checked === true && order.length === events.length};
  }

  function solved(timeline) {
    return timeline?.checked === true && Array.isArray(timeline.order) &&
      timeline.order.length === events.length && events.every(({id}, position) => timeline.order[position] === id);
  }

  function validChoice(choice, options) {
    return Array.isArray(options) && Number.isInteger(choice) && choice >= 0 && choice < options.length;
  }

  function indexCases(cases) {
    const indexed = new Map();
    for (const item of cases) {
      if (Number.isInteger(item?.index) && item.index >= 0 && typeof item.question?.theme === "string" &&
          validChoice(item.variant?.answer, item.variant?.options)) indexed.set(item.index, item);
    }
    return indexed;
  }

  function uniqueIndices(raw, indexed) {
    return Array.isArray(raw) ? [...new Set(raw)].filter((index) => indexed.has(index)) : [];
  }

  function restoreMisses(raw, cases) {
    return uniqueIndices(raw, indexCases(cases));
  }

  function createQuick(cases, lastMisses, previous) {
    const indexed = indexCases(cases);
    if (indexed.size < quickLength) return null;

    const indices = [...indexed.keys()];
    const previousQueue = uniqueIndices(previous?.queue, indexed);
    const pivot = indices.indexOf(previousQueue[previousQueue.length - 1]) + 1;
    const rotated = indices.slice(pivot).concat(indices.slice(0, pivot));
    const misses = uniqueIndices(lastMisses, indexed);
    const missed = new Set(misses);
    const seen = new Set(previousQueue);
    const target = rotated.find((index) => missed.has(index) && !seen.has(index)) ??
      rotated.find((index) => missed.has(index) && index !== previous?.target) ?? misses[0] ?? null;
    const queue = target === null ? [] : [target];
    const themes = new Set(queue.map((index) => indexed.get(index).question.theme));

    for (const index of rotated.filter((index) => !seen.has(index)).concat(rotated.filter((index) => seen.has(index)))) {
      if (queue.length === quickLength) break;
      const theme = indexed.get(index).question.theme;
      if (themes.has(theme)) continue;
      queue.push(index);
      themes.add(theme);
    }
    for (const index of rotated) {
      if (queue.length === quickLength) break;
      if (!queue.includes(index)) queue.push(index);
    }

    return {queue, picks: Array(quickLength).fill(null), cursor: 0, draft: null, phase: "question", target};
  }

  function restoreQuick(raw, cases) {
    if (!phases.includes(raw?.phase) || !Array.isArray(raw.queue) || raw.queue.length !== quickLength ||
        !Array.isArray(raw.picks) || raw.picks.length !== quickLength ||
        !Number.isInteger(raw.cursor) || raw.cursor < 0 || raw.cursor >= quickLength) return null;

    const indexed = indexCases(cases);
    const queue = uniqueIndices(raw.queue, indexed);
    if (queue.length !== quickLength || (raw.phase === "complete" && raw.cursor !== quickLength - 1)) return null;

    const {cursor, phase} = raw;
    const picks = [...raw.picks];
    const committed = phase === "question" ? cursor : cursor + 1;
    const options = queue.map((index) => indexed.get(index).variant.options);
    if (!picks.every((pick, position) => position < committed ? validChoice(pick, options[position]) : pick === null)) {
      return null;
    }

    const draft = phase === "question" && validChoice(raw.draft, options[cursor]) ? raw.draft : null;
    const target = raw.target === queue[0] ? raw.target : null;
    return {queue, picks, cursor, draft, phase, target};
  }

  return {events, displayOrder, restoreTimeline, solved, createQuick, restoreQuick, restoreMisses};
})();
