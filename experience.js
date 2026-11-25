"use strict";

window.CFPC_EXPERIENCE = (() => {
  const clues = [
    {title: "La demande à l’accueil", source: "Message de la collègue à l’accueil",
      text: "Un parent est arrivé avec son fils de 16 ans. Il propose de l’accompagner pendant toute la visite.", photo: 0},
    {title: "L’annonce du croupier", source: "Note du chef de table",
      text: "À la roulette française, le croupier a clairement annoncé « Rien ne va plus ».", photo: 2},
    {title: "L’ordre des événements", source: "Témoignage de la collègue en salle",
      text: "Elle confirme que le jeton a été posé après l’annonce, alors que la bille tournait encore.", photo: 3},
  ];
  const decisions = [
    {id: "reg-acces-mineur", prompt: "Le parent et son fils attendent à l’entrée. Quelle décision notez-vous dans le dossier ?"},
    {id: "reg-roulette-mise-tardive", prompt: "Reportez-vous aux témoignages pour reconstituer la chronologie. Comment traiter cette mise ?"},
  ];

  function create(questions, stories, missions) {
    const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
    const validChoice = (value, options) => Number.isInteger(value) && value >= 0 && value < options.length;
    const caseList = questions.map((question, index) => {
      const entry = stories?.[question.id];
      if (!entry || !["place", "speaker", "line"].every((key) => nonEmpty(entry.scene?.[key])) ||
          !nonEmpty(entry.variant?.question) || !Array.isArray(entry.variant.options) ||
          entry.variant.options.length < 2 || !entry.variant.options.every(nonEmpty) ||
          !validChoice(entry.variant.answer, entry.variant.options)) return null;
      return {index, question, scene: entry.scene, variant: {...question, ...entry.variant}};
    });
    if (caseList.some((item) => item === null)) return null;

    const areas = new Map();
    for (const item of caseList) {
      const area = areas.get(item.question.theme) || [];
      area.push(item);
      areas.set(item.question.theme, area);
    }
    const dossier = decisions.map(({id, prompt}) => {
      const item = caseList.find(({question}) => question.id === id);
      return item && {...item, question: {...item.question, question: prompt}};
    });
    if (dossier.some((item) => !item)) return null;

    function part(value, options) {
      return validChoice(value, options) ? value : null;
    }

    function restore(attempt) {
      const raw = attempt.journey;
      const journey = {
        drafts: caseList.map(({index, question}) => attempt.answers[index] === null
          ? part(raw?.drafts?.[index], question.options) : null),
        variants: caseList.map(({index, variant}) => attempt.answers[index] !== null &&
          attempt.answers[index] !== questions[index].answer ? part(raw?.variants?.[index], variant.options) : null),
        clues: Number.isInteger(raw?.clues) && raw.clues >= 0 && raw.clues <= 7 ? raw.clues : 0,
        dossier: dossier.map(({question}, index) => part(raw?.dossier?.[index], question.options)),
        practice: null,
        investigation: null,
        active: null,
        timeline: missions.restoreTimeline(raw?.timeline),
        unseenReactions: missions.restoreMisses(raw?.unseenReactions, caseList)
          .filter((index) => attempt.answers[index] !== null),
      };
      const practice = raw?.practice ?? (raw?.activity?.kind === "practice" ? raw.activity : null);
      if (Array.isArray(practice?.queue) && practice.queue.length >= 1 &&
          practice.queue.length <= 2 && new Set(practice.queue).size === practice.queue.length &&
          practice.queue.every((index) => Number.isInteger(index) && caseList[index] &&
            attempt.answers[index] !== null && attempt.answers[index] !== questions[index].answer) &&
          Number.isInteger(practice.cursor) && practice.queue[practice.cursor] !== undefined) {
        const index = practice.queue[practice.cursor];
        journey.practice = {queue: [...practice.queue], cursor: practice.cursor,
          draft: part(practice.draft, caseList[index].variant.options),
          revealed: practice.revealed === true && journey.variants[index] !== null,
          reacted: practice.reacted !== false};
      }
      const investigation = raw?.investigation ?? (raw?.activity?.kind === "dossier" ? raw.activity : null);
      if (investigation && attempt.phase === "complete") {
        const cursor = journey.clues === 7 && Number.isInteger(investigation.cursor) && dossier[investigation.cursor]
          ? investigation.cursor : -1;
        journey.investigation = {cursor,
          draft: cursor === -1 ? null : part(investigation.draft, dossier[cursor].question.options),
          revealed: cursor !== -1 && investigation.revealed === true && journey.dossier[cursor] !== null,
          reacted: investigation.reacted !== false,
          timelineOpen: cursor === -1 && journey.clues === 7 && investigation.timelineOpen === true};
      }
      const active = raw?.active ?? (raw?.activity?.kind === "dossier" ? "investigation" : raw?.activity?.kind);
      if ((active === "practice" || active === "investigation") && journey[active]) journey.active = active;
      return journey;
    }

    function mastered(attempt, index) {
      return attempt.answers[index] === questions[index].answer ||
        (attempt.answers[index] !== null && attempt.journey.variants[index] === caseList[index].variant.answer);
    }

    function pending(attempt) {
      return caseList.filter(({index}) => attempt.answers[index] !== null && !mastered(attempt, index))
        .map(({index}) => index);
    }

    return {cases: caseList, areas, dossier, clues, restore, mastered, pending};
  }

  return {create};
})();
