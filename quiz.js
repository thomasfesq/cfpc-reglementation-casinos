"use strict";

(() => {
  const main = document.querySelector("#contenu");
  const storageStatus = document.querySelector("#statut-stockage");
  const confirmation = document.querySelector("#confirmation");
  const storageKey = "cfpc-reglementation:v1:" + location.pathname.replace(/(?:index\.html)?$/, "");
  const questions = catalogue(window.CFPC_QUESTIONS);

  function element(tag, cssClass, text) {
    const node = document.createElement(tag);
    if (cssClass) node.className = cssClass;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, style, action) {
    const node = element("button", "button " + style, label);
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  }

  function show(nodes, focus) {
    main.replaceChildren(...nodes);
    if (focus) {
      focus.tabIndex = -1;
      focus.focus();
    }
  }

  function titleBlock(title, description, back) {
    const header = element("div", "page-head");
    if (back) header.append(button(back.label, "text back", back.action));
    header.append(element("p", "eyebrow", "Réglementation des jeux en casino"));
    const heading = element("h1", "page-title", title);
    header.append(heading);
    if (description) header.append(element("p", "", description));
    return {header, heading};
  }

  function sourceUrl(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" && !url.username && !url.password) return url.href;
    } catch {
      return null;
    }
    return null;
  }

  function catalogue(raw) {
    const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const ids = new Set();
    for (const item of raw) {
      if (!item || !["string", "number"].includes(typeof item.id) ||
          !nonEmpty(String(item.id)) || ids.has(String(item.id)) ||
          !["theme", "question", "explanation", "article", "url"].every((key) => nonEmpty(item[key])) ||
          !Array.isArray(item.options) || item.options.length < 2 || !item.options.every(nonEmpty) ||
          !Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length ||
          !sourceUrl(item.url)) {
        return null;
      }
      ids.add(String(item.id));
    }
    return raw;
  }

  function officialLink(question, label = question.article) {
    const anchor = element("a", "source-link", label);
    anchor.href = sourceUrl(question.url);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.append(element("span", "sr-only", " (nouvel onglet)"));
    return anchor;
  }

  if (!questions) {
    const {header} = titleBlock("Quiz indisponible", "Le catalogue de questions n’a pas pu être chargé.");
    storageStatus.textContent = "";
    show([header]);
    return;
  }

  const revision = questions.map(({id, theme, question, options, answer, explanation, article, url}) =>
    [id, theme, question, options, answer, explanation, article, url]);
  const revisionKey = JSON.stringify(revision);
  const topicTotals = tally();
  const topicIcons = new Map([
    ["Admission en salle", "admission"], ["Roulette française", "roulette"],
    ["Black-jack", "cartes"], ["Machines à sous", "machine"],
    ["Surveillance et contrôle", "surveillance"], ["Protection des joueurs", "protection"],
  ]);
  let saved = true;
  let updatedCatalogue = false;
  let resetTrigger = null;
  let attempt = recover();

  function updateStorageStatus() {
    storageStatus.textContent = saved
      ? "Progression enregistrée sur cet appareil"
      : "Progression conservée pendant cette session";
  }

  function recover() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const record = JSON.parse(raw);
      if (!record || typeof record !== "object") return null;
      if (record.revision !== revisionKey) {
        updatedCatalogue = true;
        return null;
      }
      if (validAttempt(record.attempt)) return record.attempt;
    } catch (error) {
      if (!(error instanceof SyntaxError)) saved = false;
    }
    return null;
  }

  function validAttempt(value) {
    if (!value || !["active", "complete"].includes(value.phase) ||
        !Number.isInteger(value.position) || value.position < 0 || value.position >= questions.length ||
        !Array.isArray(value.answers) || value.answers.length !== questions.length) {
      return false;
    }
    const validOption = (choice, index) => Number.isInteger(choice) && choice >= 0 &&
      choice < questions[index].options.length;
    const answersValid = value.answers.every((choice, index) => {
      if (choice === null) return value.phase === "active" && index >= value.position;
      return index <= value.position && validOption(choice, index);
    });
    return answersValid &&
      (value.phase !== "complete" || value.position === questions.length - 1) &&
      (value.draft === null || (value.answers[value.position] === null && validOption(value.draft, value.position)));
  }

  function store() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({revision: revisionKey, attempt}));
      saved = true;
    } catch {
      saved = false;
    }
    updateStorageStatus();
  }

  function countAnswered() {
    return attempt ? attempt.answers.filter((choice) => choice !== null).length : 0;
  }

  function tally(answers) {
    const topics = new Map();
    questions.forEach((question, index) => {
      const result = topics.get(question.theme) || {total: 0, correct: 0};
      result.total += 1;
      if (answers && answers[index] === question.answer) result.correct += 1;
      topics.set(question.theme, result);
    });
    return topics;
  }

  function numberLabel(count, singular, plural) {
    return count + " " + (count === 1 ? singular : plural);
  }

  function stats(entries) {
    const list = element("dl", "overview");
    for (const [name, value] of entries) {
      const row = element("div", "stat-row");
      row.append(element("dt", "", name), element("dd", "", String(value)));
      list.append(row);
    }
    return list;
  }

  function showHome(withFocus = false) {
    const hero = element("section", "hero");
    const copy = element("div", "hero-copy");
    const heading = element("h1", "hero-title");
    heading.append("Réglementation ", element("span", "hero-subject", "des jeux en casino"));
    copy.append(
      element("p", "eyebrow", "Quiz de formation"),
      heading,
      element("p", "hero-intro", "À l’entrée, à la table ou en salle, quelle décision prendre ? Exercez-vous sur des situations de travail et retrouvez le texte qui justifie chaque réponse.")
    );
    const actions = element("div", "actions");
    if (!attempt) actions.append(button("Commencer le quiz", "primary", start));
    else if (attempt.phase === "active") actions.append(button("Reprendre le quiz", "primary", () => showQuestion(true)));
    else actions.append(button("Voir le bilan", "primary", showSummary));
    const browse = element("a", "hero-link", "Explorer les thèmes");
    browse.href = "#themes";
    actions.append(browse);
    copy.append(stats([
      ["Questions", questions.length],
      ["Thèmes", topicTotals.size],
      ...(attempt ? [["Répondues", countAnswered() + " sur " + questions.length]] : []),
    ]), actions);
    const picture = element("div", "hero-visual");
    const photo = element("img", "hero-photo");
    photo.src = "./assets/roulette-formation.webp";
    photo.alt = "";
    photo.fetchPriority = "high";
    picture.append(photo);
    hero.append(copy, picture);

    const topics = element("section", "themes");
    topics.id = "themes";
    topics.tabIndex = -1;
    const topicsHead = element("div", "themes-head");
    topicsHead.append(element("h2", "section-title", "Thèmes et textes officiels"),
      element("p", "themes-hint", "Ouvrez un thème pour consulter ses références."));
    topics.append(topicsHead);
    const list = element("ul", "theme-list");
    for (const [theme, {total}] of topicTotals) {
      const item = element("li");
      const disclosure = element("details", "topic");
      const summary = element("summary");
      const icon = element("span", "topic-icon");
      icon.setAttribute("aria-hidden", "true");
      const motif = topicIcons.get(theme);
      if (motif) icon.classList.add("motif-" + motif);
      const label = element("span", "topic-label");
      label.append(element("strong", "", theme), element("small", "", numberLabel(total, "question", "questions")));
      summary.append(icon, label);
      const sources = element("ul", "source-list");
      const unique = new Set();
      for (const question of questions.filter(q => q.theme === theme)) {
        if (unique.has(question.url)) continue;
        unique.add(question.url);
        const row = element("li");
        const label = question.url === "https://interdictiondejeux.anj.fr/demande-interdiction/presentation"
          ? "ANJ · Interdiction volontaire de jeux" : question.article;
        row.append(officialLink(question, label));
        sources.append(row);
      }
      disclosure.append(summary, sources);
      item.append(disclosure);
      list.append(item);
    }
    topics.append(list);

    const nodes = [hero];
    if (updatedCatalogue) {
      nodes.push(element("p", "notice", "Le questionnaire a changé. Commencez une nouvelle session pour répondre à sa version actuelle."));
    }
    nodes.push(topics);
    show(nodes, withFocus ? heading : null);
  }

  const referenceLink = document.querySelector("#lien-references");
  if (referenceLink) {
    referenceLink.closest("nav").hidden = false;
    referenceLink.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.button !== 0) return;
      if (!document.querySelector("#themes")) showHome();
      document.querySelector("#themes").focus({preventScroll: true});
    });
  }

  function start() {
    updatedCatalogue = false;
    attempt = {phase: "active", position: 0, draft: null, answers: Array(questions.length).fill(null)};
    store();
    showQuestion(true);
  }

  function parcoursHeader(title, back, description) {
    const header = element("header", "parcours-head");
    const location = element("div", "parcours-location");
    const heading = element("h1", "parcours-title", title);
    location.append(heading);
    if (description) location.append(element("p", "", description));
    header.append(button(back.label, "text back", back.action), location);
    return {header, heading};
  }

  function showParcours(screen, nodes, focus) {
    const page = element("div", "quiz-parcours quiz-parcours--" + screen);
    page.append(...nodes);
    show([page], focus);
  }

  function progressCard(value, total) {
    const card = element("aside", "card progress-card");
    const title = element("h2", "section-title", "Progression");
    const count = value + " / " + total;
    const explanation = element("p", "counter");
    explanation.append(element("span", "progress-count", count), " réponses validées");
    const bar = element("progress", "progress");
    bar.max = total;
    bar.value = value;
    bar.setAttribute("aria-label", "Progression : " + count + " réponses validées");
    card.append(title, explanation, bar);
    return card;
  }

  function optionKey(index) {
    const letter = index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
    const key = element("span", "option-key", letter);
    key.setAttribute("aria-hidden", "true");
    return key;
  }

  function interactiveQuestion(question) {
    const form = element("form", "question-form");
    const choices = element("fieldset", "choices");
    const list = element("div", "choice-list");
    choices.append(element("legend", "", "Choisir une réponse"), list);
    const actions = element("div", "actions");
    const validate = element("button", "button primary", "Valider la réponse");
    validate.type = "submit";
    validate.disabled = attempt.draft === null;
    actions.append(validate);
    question.options.forEach((label, index) => {
      const input = element("input");
      input.type = "radio";
      input.name = "reponse";
      input.value = String(index);
      input.checked = attempt.draft === index;
      input.addEventListener("change", () => {
        attempt.draft = index;
        validate.disabled = false;
        store();
      });
      const option = element("label", "option");
      option.append(optionKey(index), element("span", "option-text", label), input);
      list.append(option);
    });
    form.append(choices, actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (attempt.draft === null || attempt.answers[attempt.position] !== null) return;
      attempt.answers[attempt.position] = attempt.draft;
      attempt.draft = null;
      store();
      showQuestion(false, true);
    });
    return form;
  }

  function correction(question, choice) {
    const card = element("section", "correction" + (choice === question.answer ? "" : " incorrect"));
    card.setAttribute("aria-labelledby", "titre-correction");
    const heading = element("h3", "", choice === question.answer ? "Bonne réponse" : "Réponse incorrecte");
    heading.id = "titre-correction";
    const link = officialLink(question, "Texte officiel · " + question.article);
    card.append(heading, element("p", "", question.explanation), link);
    return card;
  }

  function markedOptions(question, choice) {
    const list = element("ul", "choice-list question-form");
    question.options.forEach((label, index) => {
      const correct = index === question.answer;
      const wrong = !correct && index === choice;
      const option = element("li", "option" + (correct ? " correct" : wrong ? " incorrect" : ""));
      const content = element("span", "option-text", label);
      if (correct || wrong) {
        const status = correct ? (choice === index ? "Votre réponse · Bonne réponse" : "Bonne réponse") : "Votre réponse";
        content.append(element("span", "option-status", status));
      }
      option.append(optionKey(index), content);
      list.append(option);
    });
    return list;
  }

  function questionCard(question) {
    const card = element("article", "card question-card");
    const panel = element("div", "question-panel");
    const prompt = element("h2", "question", question.question);
    const body = element("div", "question-body");
    panel.append(element("p", "eyebrow", question.theme), prompt);
    card.append(panel, body);
    return {card, prompt, body};
  }

  function showQuestion(focusPrompt, focusCorrection = false) {
    const index = attempt.position;
    const question = questions[index];
    const choice = attempt.answers[index];
    const {header} = parcoursHeader("Question " + (index + 1) + " sur " + questions.length,
      {label: "Accueil du quiz", action: () => showHome(true)});
    const {card, prompt, body} = questionCard(question);
    const layout = element("div", "workspace");
    const progress = progressCard(countAnswered(), questions.length);
    let explanation;

    if (choice === null) {
      body.append(interactiveQuestion(question));
    } else {
      explanation = correction(question, choice);
      const actions = element("div", "actions");
      const last = index === questions.length - 1;
      actions.append(button(last ? "Voir le bilan" : "Question suivante", "primary parcours-next", () => {
        if (last) {
          attempt.phase = "complete";
          store();
          showSummary();
        } else {
          attempt.position += 1;
          store();
          showQuestion(true);
        }
      }));
      body.append(markedOptions(question, choice), explanation, actions);
    }

    layout.append(progress, card);
    showParcours("question", [header, layout], focusCorrection ? explanation : focusPrompt ? prompt : null);
  }

  function wrongAnswers() {
    return questions.map((question, index) => ({question, index}))
      .filter(({question, index}) => attempt.answers[index] !== question.answer);
  }

  function showSummary() {
    const errors = wrongAnswers();
    const correct = questions.length - errors.length;
    const {header, heading} = parcoursHeader("Bilan du quiz",
      {label: "Accueil du quiz", action: () => showHome(true)});

    const card = element("section", "card result-card");
    const ring = element("div", "score-ring");
    ring.style.setProperty("--score", (100 * correct / questions.length) + "%");
    ring.setAttribute("aria-hidden", "true");
    ring.append(element("span", "", correct + " / " + questions.length));
    const copy = element("div", "result-copy");
    copy.append(element("h2", "section-title", numberLabel(correct, "bonne réponse", "bonnes réponses") +
      " sur " + questions.length));
    if (errors.length) copy.append(element("p", "", numberLabel(errors.length, "réponse à revoir", "réponses à revoir") + "."));
    else copy.append(element("p", "", "Toutes les réponses sont correctes."));
    const actions = element("div", "actions");
    if (errors.length) actions.append(button("Revoir les erreurs", "primary parcours-next", () => showReview(0)));
    actions.append(button("Recommencer", "secondary", (event) => {
      confirmation.returnValue = "";
      resetTrigger = event.currentTarget;
      confirmation.showModal();
    }));
    copy.append(actions);
    card.append(ring, copy);

    const detail = element("section", "card theme-detail");
    detail.append(element("h2", "section-title", "Résultats par thème"));
    const list = element("ul");
    for (const [theme, totals] of tally(attempt.answers)) {
      const item = element("li");
      const bar = element("progress", "progress");
      bar.max = totals.total;
      bar.value = totals.correct;
      bar.setAttribute("aria-hidden", "true");
      item.append(element("span", "", theme), element("strong", "", totals.correct + " / " + totals.total), bar);
      list.append(item);
    }
    detail.append(list);
    const layout = element("div", "parcours-results");
    layout.append(card, detail);
    showParcours("summary", [header, layout], heading);
  }

  function showReview(position) {
    const errors = wrongAnswers();
    const {question, index} = errors[position];
    const {header} = parcoursHeader("Erreur " + (position + 1) + " sur " + errors.length,
      {label: "Retour au bilan", action: showSummary}, "Question " + (index + 1) + " du quiz.");
    const {card, prompt, body} = questionCard(question);
    const choice = attempt.answers[index];
    const actions = element("div", "actions");
    if (position > 0) {
      actions.append(button("Erreur précédente", "secondary", () => showReview(position - 1)));
    }
    const last = position + 1 === errors.length;
    actions.append(button(last ? "Retour au bilan" : "Erreur suivante", last ? "primary" : "primary parcours-next",
      last ? showSummary : () => showReview(position + 1)));
    body.append(markedOptions(question, choice), correction(question, choice), actions);
    showParcours("review", [header, card], prompt);
  }

  confirmation.addEventListener("close", () => {
    const trigger = resetTrigger;
    resetTrigger = null;
    if (trigger && confirmation.returnValue === "reset") start();
    else trigger?.focus();
  });

  document.querySelector(".brand").addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    showHome(true);
  });

  updateStorageStatus();
  showHome();
})();
