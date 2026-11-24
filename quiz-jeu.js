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
    const header = element("div", "quiz-screen-head");
    header.append(element("h1", "screen-title", "Quiz indisponible"),
      element("p", "", "Le catalogue de questions n’a pas pu être chargé."));
    storageStatus.textContent = "";
    main.replaceChildren(header);
    return;
  }

  const revision = questions.map(({id, theme, question, options, answer, explanation, article, url}) =>
    [id, theme, question, options, answer, explanation, article, url]);
  const revisionKey = JSON.stringify(revision);
  const topicTotals = tally();
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

  const pageWords = /[ \t\r\n]+/g;
  const graphemeSegmenter = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("fr", {granularity: "grapheme"})
    : null;
  const referenceLink = document.querySelector("#lien-references");
  const creditLink = document.querySelector("#lien-conception");
  let currentScreen;

  function icon(name, className) {
    return window.CFPC_PICTOS?.create(name, className) || document.createTextNode("");
  }

  function iconButton(label, style, name, action) {
    const control = button(label, style, action);
    control.prepend(icon(name));
    return control;
  }

  function focusOn(target) {
    target?.focus({preventScroll: !document.documentElement.classList.contains("quiz-compact-fallback")});
  }

  function fixed(render) {
    return {render};
  }

  function readable(text, render) {
    return {text, render};
  }

  function makePage(config) {
    const page = element(config.pageTag || "div", ["quiz-page", config.pageClass].filter(Boolean).join(" "));
    if (!config.pageTag) page.setAttribute("role", config.questionLabel ? "radiogroup" : "region");
    return page;
  }

  function fragmentNode(block, start, end) {
    const node = block.render(block.text?.slice(start, end).trim(), start > 0);
    if (block.key) node.dataset.quizBlock = block.key;
    return node;
  }

  function pagesFor(screen, maxHeight) {
    const probe = makePage(screen.config);
    probe.inert = true;
    probe.setAttribute("aria-hidden", "true");
    Object.assign(probe.style, {
      position: "absolute",
      insetBlockStart: "0",
      insetInlineStart: "0",
      inlineSize: screen.page.getBoundingClientRect().width + "px",
      visibility: "hidden",
      pointerEvents: "none",
    });
    screen.stage.append(probe);
    const pages = [[]];
    let fragments = pages[0];

    function fits() {
      return probe.getBoundingClientRect().height <= maxHeight + 0.3;
    }

    function newPage() {
      fragments = [];
      pages.push(fragments);
      probe.replaceChildren();
    }

    function largestFit(block, start, stops) {
      let lo = 0;
      let hi = stops.length - 1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const candidate = fragmentNode(block, start, stops[mid]);
        probe.append(candidate);
        const fitting = fits();
        candidate.remove();
        if (fitting) lo = mid + 1;
        else hi = mid - 1;
      }
      return hi < 0 ? start : stops[hi];
    }

    try {
      for (const [index, block] of screen.config.blocks.entries()) {
        const length = block.text?.length ?? 1;
        let start = 0;
        while (start < length) {
          const remaining = fragmentNode(block, start, length);
          probe.append(remaining);
          if (fits()) {
            fragments.push({index, start, end: length});
            break;
          }
          remaining.remove();
          if (fragments.length) {
            newPage();
            continue;
          }
          if (!block.text) return null;
          const tail = block.text.slice(start);
          const words = Array.from(tail.matchAll(pageWords), (match) => start + match.index + match[0].length)
            .filter((stop) => stop < length && stop > length - tail.trimStart().length);
          let end = largestFit(block, start, words);
          if (end === start) {
            const graphemes = graphemeSegmenter
              ? Array.from(graphemeSegmenter.segment(tail), ({index, segment}) => start + index + segment.length)
              : Array.from(tail).map((_, index, points) => start + points.slice(0, index + 1).join("").length);
            end = largestFit(block, start, graphemes.filter((stop) => stop < length));
          }
          if (end === start || !block.text.slice(start, end).trim()) return null;
          fragments.push({index, start, end});
          start = end;
          newPage();
        }
      }
      return pages;
    } finally {
      probe.remove();
    }
  }

  function setPage(screen, pageIndex, moveFocus) {
    if (pageIndex < 0 || pageIndex >= screen.pages.length) return;
    screen.index = pageIndex;
    const fragments = screen.pages[pageIndex];
    screen.page.replaceChildren(...fragments.map(({index, start, end}) =>
      fragmentNode(screen.config.blocks[index], start, end)));
    const shown = (pageIndex + 1) + " / " + screen.pages.length;
    screen.controls.hidden = screen.pages.length < 2;
    screen.controls.dataset.pages = String(screen.pages.length);
    screen.counter.textContent = shown;
    screen.previous.disabled = pageIndex === 0;
    screen.next.disabled = pageIndex === screen.pages.length - 1;
    const pageLabel = screen.pages.length > 1 ? "Page " + shown : "Contenu de l’écran";
    screen.page.setAttribute("aria-label", screen.config.questionLabel
      ? screen.config.questionLabel + " — " + pageLabel : pageLabel);
    if (moveFocus) focusOn(screen.page);
  }

  function resizeScreen(screen) {
    const active = document.activeElement;
    const pageHadFocus = screen.page.contains(active) || screen.page === active;
    const key = active?.dataset.quizFocus;
    const focusedBlock = active?.closest("[data-quiz-block]")?.dataset.quizBlock;
    const anchor = focusedBlock ? screen.pages[screen.index]?.find(({index}) =>
      screen.config.blocks[index].key === focusedBlock) : screen.pages[screen.index]?.[0];

    document.documentElement.classList.remove("quiz-compact-fallback");
    screen.controls.hidden = true;
    let pages = pagesFor(screen, screen.stage.clientHeight);
    if (pages?.length > 1) {
      screen.controls.hidden = false;
      let reservedDigits = 0;
      while (pages && String(pages.length).length > reservedDigits) {
        reservedDigits = String(pages.length).length;
        // Reserve both page numbers before measuring. The pager may wrap onto a second row.
        const digits = "8".repeat(reservedDigits);
        screen.counter.textContent = digits + " / " + digits;
        screen.counter.style.minInlineSize = (2 * reservedDigits + 3) + "ch";
        pages = pagesFor(screen, screen.stage.clientHeight);
      }
    }
    if (!pages) {
      // A window shorter than the smallest readable fragment must still expose every control.
      document.documentElement.classList.add("quiz-compact-fallback");
      pages = [screen.config.blocks.map((block, index) => ({index, start: 0, end: block.text?.length ?? 1}))];
    }

    screen.pages = pages;
    const index = anchor && pages.findIndex((page) => page.some((fragment) =>
      fragment.index === anchor.index && fragment.start <= anchor.start && fragment.end > anchor.start));
    setPage(screen, Math.max(0, index ?? 0), false);
    if (pageHadFocus) {
      const match = key && Array.from(screen.page.querySelectorAll("[data-quiz-focus]"))
        .find((node) => node.dataset.quizFocus === key);
      focusOn(match || screen.page);
    } else if (screen.controls.contains(active) && (screen.controls.hidden || active.disabled)) {
      focusOn(screen.page);
    }
  }

  function progressTrack(value, total) {
    const track = element("div", "score-track");
    const count = element("p", "counter", "Réponses validées : " + value + " / " + total);
    const bar = element("progress", "progress");
    bar.max = total;
    bar.value = value;
    bar.setAttribute("aria-label", "Progression des réponses validées");
    const chips = element("div", "chip-list");
    chips.setAttribute("aria-hidden", "true");
    for (let index = 0; index < Math.min(total, 12); index += 1) {
      const finished = (index + 1) / Math.min(total, 12) <= value / total;
      const chip = element("span", "score-chip" + (finished ? " earned" : ""));
      chip.append(icon("chip"));
      chips.append(chip);
    }
    track.append(count, bar, chips);
    return track;
  }

  function showScreen(config, withFocus = true) {
    document.documentElement.classList.remove("quiz-compact-fallback");
    const layout = element("section", "quiz-screen quiz-screen--" + config.name +
      (config.parcours ? " quiz-parcours" : ""));
    layout.dataset.screen = config.name;
    const header = element("header", "quiz-screen-head" + (config.state ? " is-" + config.state : ""));
    let heading;
    if (config.back) {
      header.append(iconButton(config.back.label, "text back", "arrow-left", config.back.action));
    }
    if (config.title) {
      const location = element("div", "screen-heading");
      heading = element("h1", "screen-title", config.title);
      heading.tabIndex = -1;
      if (config.icon) heading.prepend(icon(config.icon, "screen-icon"));
      if (config.context) location.append(element("p", "screen-context", config.context));
      location.append(heading);
      header.append(location);
    }
    if (config.progress) header.append(progressTrack(countAnswered(), questions.length));

    const stage = element(config.submit ? "form" : "div", "quiz-stage");
    if (config.submit) {
      stage.id = "formulaire-reponse";
      stage.setAttribute("aria-label", "Choisir une réponse");
      stage.addEventListener("submit", (event) => {
        event.preventDefault();
        config.submit();
      });
    }
    const page = makePage(config);
    page.tabIndex = -1;
    stage.append(page);
    config.decorate?.(stage);

    const navigation = element("div", "page-nav");
    const controls = element("nav", "page-buttons");
    controls.setAttribute("aria-label", "Pages de cet écran");
    const counter = element("span", "page-counter");
    const screen = {config, stage, page, controls, counter, pages: [], index: 0};
    const turn = (direction) => setPage(screen, screen.index + direction, true);
    screen.previous = button("", "secondary page-turn", () => turn(-1));
    screen.previous.setAttribute("aria-label", "Page précédente");
    screen.previous.append(icon("arrow-left"), element("span", "page-turn-label", "Précédente"));
    screen.next = button("", "secondary page-turn", () => turn(1));
    screen.next.setAttribute("aria-label", "Page suivante");
    screen.next.append(element("span", "page-turn-label", "Suivante"), icon("arrow-right"));
    controls.append(screen.previous, counter, screen.next);
    navigation.append(controls);
    if (config.actions?.length) {
      const actions = element("div", "screen-actions");
      actions.append(...config.actions);
      navigation.append(actions);
    }

    layout.append(header, stage, navigation);
    main.replaceChildren(layout);
    currentScreen = screen;
    resizeScreen(screen);
    if (withFocus) {
      const target = (config.focusPrompt && screen.page.querySelector(".question")) ||
        heading || screen.page.querySelector("h1") || screen.page;
      target.tabIndex = -1;
      focusOn(target);
    }
    if (config.reveal) {
      const pageIndex = screen.pages.findIndex((parts) => parts.some(({index}) => config.blocks[index].key === config.reveal));
      if (pageIndex >= 0) {
        if (pageIndex !== screen.index) setPage(screen, pageIndex, false);
        const target = Array.from(screen.page.querySelectorAll("[data-quiz-focus]"))
          .find((node) => node.dataset.quizFocus === config.reveal);
        focusOn(target || screen.page);
      }
    }
  }

  let reflowFrame;
  function scheduleReflow() {
    if (reflowFrame) return;
    reflowFrame = requestAnimationFrame(() => {
      reflowFrame = null;
      if (currentScreen) resizeScreen(currentScreen);
    });
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

  function homeAction() {
    return {label: "Accueil du quiz", action: () => showHome()};
  }

  function fromFragment(event, action) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    action();
  }

  function showHome(withFocus = true) {
    if (location.hash === "#themes") history.replaceState(null, "", location.pathname + location.search);

    const play = attempt?.phase === "complete"
      ? iconButton("Voir le bilan", "primary", "trophy", showSummary)
      : attempt
        ? iconButton("Reprendre le quiz", "primary", "arrow-right", () => showQuestion(true))
        : iconButton("Commencer le quiz", "primary", "arrow-right", start);
    const browse = iconButton("Explorer les thèmes", "secondary", "book", () => showThemes());

    const blocks = [
      fixed(() => {
        const heading = element("h1", "hero-title");
        heading.tabIndex = -1;
        heading.append("Réglementation ", element("span", "hero-subject", "des jeux en casino"));
        const lead = element("div", "hero-lead");
        lead.append(element("p", "eyebrow", "Quiz de formation"), heading);
        return lead;
      }),
      readable("À l’entrée, à la table ou en salle, quelle décision prendre ? Exercez-vous sur des situations de travail et retrouvez le texte qui justifie chaque réponse.",
        (text) => element("p", "hero-intro quiz-readable", text)),
      fixed(() => stats([
        ["Questions", questions.length],
        ["Thèmes", topicTotals.size],
        ...(attempt ? [["Répondues", countAnswered() + " sur " + questions.length]] : []),
      ])),
    ];
    if (updatedCatalogue) {
      blocks.push(readable("Le questionnaire a changé. Commencez une nouvelle session pour répondre à sa version actuelle.",
        (text) => element("p", "notice quiz-readable", text)));
    }
    showScreen({
      name: "home", blocks, pageClass: "hero-copy", actions: [play, browse],
      decorate(stage) {
        const picture = element("div", "hero-visual");
        const photo = element("img", "hero-photo");
        photo.src = "./assets/roulette-formation.webp";
        photo.alt = "";
        photo.fetchPriority = "high";
        picture.append(photo);
        stage.append(picture);
      },
    }, withFocus);
  }

  function showThemes(reveal, withFocus = true) {
    const blocks = Array.from(topicTotals, ([theme, {total}]) => ({
      key: theme,
      render() {
        const item = element("li");
        const control = element("button", "topic");
        control.type = "button";
        control.addEventListener("click", () => showSources(theme));
        control.dataset.quizFocus = theme;
        const badge = element("span", "topic-icon");
        badge.append(icon(theme));
        const label = element("span", "topic-label");
        label.append(element("strong", "", theme), element("small", "", numberLabel(total, "question", "questions")));
        control.append(badge, label, icon("arrow-right", "topic-chevron"));
        item.append(control);
        return item;
      },
    }));
    showScreen({
      name: "themes", title: "Thèmes et textes officiels", back: homeAction(),
      blocks, pageTag: "ul", pageClass: "theme-list", reveal,
    }, withFocus);
  }

  function showSources(theme) {
    const unique = new Map();
    for (const question of questions) {
      if (question.theme === theme && !unique.has(question.url)) unique.set(question.url, question);
    }
    const blocks = Array.from(unique.values(), (question) => {
      const article = question.url === "https://interdictiondejeux.anj.fr/demande-interdiction/presentation"
        ? "ANJ · Interdiction volontaire de jeux" : question.article;
      const block = readable(article, (text) => {
        const item = element("li");
        const link = officialLink(question, text);
        link.dataset.quizFocus = question.url;
        link.classList.add("quiz-readable");
        item.append(link);
        return item;
      });
      block.key = question.url;
      return block;
    });
    showScreen({
      name: "sources", title: theme, context: "Textes officiels", icon: theme,
      back: {label: "Tous les thèmes", action: () => showThemes(theme)},
      blocks, pageTag: "ul", pageClass: "source-list",
    });
  }

  function start() {
    updatedCatalogue = false;
    attempt = {phase: "active", position: 0, draft: null, answers: Array(questions.length).fill(null)};
    store();
    showQuestion();
  }

  function promptBlock(question) {
    return readable(question.question, (text, continued) => {
      const panel = element("div", "question-panel");
      if (!continued) {
        const theme = element("p", "eyebrow", question.theme);
        theme.prepend(icon(question.theme));
        panel.append(theme);
      }
      panel.append(element("h2", "question quiz-readable", text));
      return panel;
    });
  }

  function optionKey(index) {
    const letter = index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
    const key = element("span", "option-key", letter);
    key.setAttribute("aria-hidden", "true");
    return key;
  }

  function adjacentOption(event, index, count) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const direction = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[event.key];
    if (!direction) return;
    const key = "option-" + ((index + direction + count) % count);
    const screen = currentScreen;
    if (screen.page.querySelector(`input[data-quiz-focus="${key}"]`)) return;
    const destination = screen.pages.findIndex((page) => page.some((fragment) =>
      screen.config.blocks[fragment.index].key === key));
    if (destination < 0) return;

    event.preventDefault();
    setPage(screen, destination, false);
    const input = screen.page.querySelector(`input[data-quiz-focus="${key}"]`);
    focusOn(input);
    input?.click();
  }

  function optionBlocks(question, choice, validate) {
    return question.options.map((label, index) => {
      const key = "option-" + index;
      const correct = choice !== null && index === question.answer;
      const selected = choice !== null && index === choice;
      const block = readable(label, (text, continued) => {
        const option = element(choice === null ? "label" : "div",
          "option" + (correct ? " correct" : selected ? " incorrect" : ""));
        const content = element("span", "option-text quiz-readable", text);
        if (correct || selected) {
          const status = correct && selected ? "Votre réponse · Bonne réponse" :
            correct ? "Bonne réponse" : "Votre réponse";
          content.append(element("span", "option-status", status));
        }
        option.append(optionKey(index), content);
        if (choice === null) {
          const input = element("input");
          input.type = "radio";
          input.name = "reponse";
          input.value = String(index);
          input.checked = attempt.draft === index;
          input.dataset.quizFocus = key;
          input.addEventListener("keydown", (event) => adjacentOption(event, index, question.options.length));
          if (continued || text !== label) input.setAttribute("aria-label", label);
          input.addEventListener("change", () => {
            if (!input.checked) return;
            attempt.draft = index;
            validate.disabled = false;
            store();
          });
          option.append(input);
        }
        return option;
      });
      block.key = key;
      return block;
    });
  }

  function explanationBlocks(question, choice) {
    return [
      readable(question.options[question.answer], (text, continued) => {
        const card = element("div", "answer-recap");
        if (!continued) card.append(icon("check"), element("strong", "", "Bonne réponse"));
        card.append(element("span", "", text));
        return card;
      }),
      readable(question.explanation, (text, continued) => {
        const card = element("section", "correction" + (choice === question.answer ? "" : " incorrect"));
        if (!continued) card.append(element("h2", "section-title", "Explication"));
        card.append(element("p", "quiz-readable", text));
        return card;
      }),
      readable("Texte officiel · " + question.article, (text) => {
        const link = officialLink(question, text);
        link.classList.add("quiz-readable");
        link.dataset.quizFocus = question.url;
        link.prepend(icon("book"));
        return link;
      }),
      promptBlock(question),
      ...optionBlocks(question, choice),
    ];
  }

  function showQuestion(restoreDraft = false) {
    const index = attempt.position;
    const question = questions[index];
    const choice = attempt.answers[index];
    const context = "Question " + (index + 1) + " sur " + questions.length;
    if (choice !== null) {
      showFeedback(question, choice, context);
      return;
    }

    const validate = element("button", "button primary", "Valider la réponse");
    validate.type = "submit";
    validate.setAttribute("form", "formulaire-reponse");
    validate.disabled = attempt.draft === null;
    validate.prepend(icon("check"));
    showScreen({
      name: "question", parcours: true, title: context, back: homeAction(), progress: true, focusPrompt: true,
      questionLabel: question.question,
      blocks: [promptBlock(question), ...optionBlocks(question, choice, validate)], actions: [validate],
      reveal: restoreDraft && attempt.draft !== null ? "option-" + attempt.draft : null,
      submit() {
        if (attempt.position !== index || attempt.draft === null || attempt.answers[index] !== null) return;
        attempt.answers[index] = attempt.draft;
        attempt.draft = null;
        store();
        showFeedback(question, attempt.answers[index], context);
      },
    });
  }

  function showFeedback(question, choice, context) {
    const index = attempt.position;
    const last = index === questions.length - 1;
    const correct = choice === question.answer;
    const next = iconButton(last ? "Voir le bilan" : "Question suivante", "primary",
      last ? "trophy" : "arrow-right", () => {
        if (attempt.position !== index) return;
        if (last) attempt.phase = "complete";
        else attempt.position += 1;
        store();
        if (last) showSummary();
        else showQuestion();
      });
    showScreen({
      name: "feedback", parcours: true, title: correct ? "Bonne réponse" : "Réponse incorrecte",
      state: correct ? "correct" : "incorrect", icon: correct ? "check" : "review",
      context, back: homeAction(), progress: true, blocks: explanationBlocks(question, choice), actions: [next],
    });
  }

  function wrongAnswers() {
    return questions.map((question, index) => ({question, index}))
      .filter(({question, index}) => attempt.answers[index] !== question.answer);
  }

  function showSummary() {
    const errors = wrongAnswers();
    const correct = questions.length - errors.length;
    const blocks = [fixed(() => {
      const card = element("section", "card result-card");
      const ring = element("div", "score-ring");
      ring.style.setProperty("--score", (100 * correct / questions.length) + "%");
      ring.setAttribute("aria-hidden", "true");
      ring.append(element("span", "", correct + " / " + questions.length));
      const copy = element("div", "result-copy");
      copy.append(element("h2", "section-title", numberLabel(correct, "bonne réponse", "bonnes réponses") +
        " sur " + questions.length));
      copy.append(element("p", "", errors.length
        ? numberLabel(errors.length, "réponse à revoir", "réponses à revoir") + "."
        : "Toutes les réponses sont correctes."));
      card.append(ring, copy);
      return card;
    })];
    const actions = [];
    if (errors.length) actions.push(iconButton("Revoir les erreurs", "primary", "review", () => showReview(0)));
    actions.push(button("Résultats par thème", errors.length ? "secondary" : "primary", showTopicResults));
    actions.push(button("Recommencer", "secondary", (event) => {
      confirmation.returnValue = "";
      resetTrigger = event.currentTarget;
      confirmation.showModal();
    }));
    showScreen({name: "summary", parcours: true, title: "Bilan du quiz", icon: "trophy", back: homeAction(), blocks, actions});
  }

  function showTopicResults() {
    const blocks = Array.from(tally(attempt.answers), ([theme, totals]) => fixed(() => {
      const item = element("li");
      const bar = element("progress", "progress");
      bar.max = totals.total;
      bar.value = totals.correct;
      bar.setAttribute("aria-hidden", "true");
      item.append(element("span", "", theme), element("strong", "", totals.correct + " / " + totals.total), bar);
      return item;
    }));
    showScreen({
      name: "summary-topics", parcours: true, title: "Résultats par thème",
      back: {label: "Retour au bilan", action: showSummary}, blocks, pageTag: "ul", pageClass: "theme-detail",
    });
  }

  function showReview(position) {
    const errors = wrongAnswers();
    const {question, index} = errors[position];
    const last = position + 1 === errors.length;
    const actions = [];
    if (position > 0) {
      actions.push(iconButton("Erreur précédente", "secondary", "arrow-left", () => showReview(position - 1)));
    }
    actions.push(iconButton(last ? "Retour au bilan" : "Erreur suivante", "primary",
      last ? "trophy" : "arrow-right", last ? showSummary : () => showReview(position + 1)));
    showScreen({
      name: "review", parcours: true, title: "Erreur " + (position + 1) + " sur " + errors.length,
      context: "Question " + (index + 1) + " du quiz", icon: "review", state: "incorrect",
      back: {label: "Retour au bilan", action: showSummary},
      blocks: explanationBlocks(question, attempt.answers[index]), actions,
    });
  }

  function showCredits() {
    const opener = currentScreen;
    const entries = document.querySelector("#modele-credits").content.querySelectorAll("li");
    const blocks = Array.from(entries, (node) => fixed(() => node.cloneNode(true)));
    const back = {
      label: "Revenir au quiz",
      action() {
        if (!opener) {
          showHome();
          return;
        }
        showScreen(opener.config, false);
        if (currentScreen.pages[opener.index]) setPage(currentScreen, opener.index, false);
        focusOn(creditLink);
      },
    };
    showScreen({
      name: "credits", title: "Références de conception", back, blocks,
      pageTag: "ul", pageClass: "credit-list",
    });
  }

  function closeConfirmation(reset) {
    const trigger = resetTrigger;
    resetTrigger = null;
    confirmation.close();
    if (trigger && reset) start();
    else focusOn(trigger);
  }

  confirmation.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    closeConfirmation(event.submitter?.value === "reset");
  });

  confirmation.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeConfirmation(false);
  });

  referenceLink.closest("nav").hidden = false;
  referenceLink.addEventListener("click", (event) => fromFragment(event, () => showThemes()));
  creditLink.hidden = false;
  creditLink.addEventListener("click", () => {
    if (currentScreen?.config.name !== "credits") showCredits();
  });
  document.querySelector(".brand").addEventListener("click", (event) => fromFragment(event, () => showHome()));
  window.addEventListener("hashchange", () => {
    if (location.hash === "#themes") showThemes();
  });
  window.addEventListener("resize", scheduleReflow);
  window.visualViewport?.addEventListener("resize", scheduleReflow);
  document.fonts?.ready.then(scheduleReflow);
  document.fonts?.addEventListener("loadingdone", scheduleReflow);

  updateStorageStatus();
  if (location.hash === "#themes") showThemes(undefined, false);
  else showHome(false);
})();
