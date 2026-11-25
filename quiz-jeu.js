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

  const experience = questions && window.CFPC_EXPERIENCE?.create(questions, window.CFPC_STORIES);
  if (!experience) {
    const header = element("div", "quiz-screen-head");
    header.append(element("h1", "screen-title", "Quiz indisponible"),
      element("p", "", "Les ressources du parcours n’ont pas pu être chargées."));
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
  let storedRecord;
  let restoredFromAnotherWindow = false;
  let attempt = recover(readRecord());

  function updateStorageStatus() {
    const status = restoredFromAnotherWindow
      ? "Progression récupérée depuis l’autre fenêtre"
      : saved ? "Progression enregistrée sur cet appareil" : "Progression conservée pendant cette session";
    if (storageStatus.textContent !== status) storageStatus.textContent = status;
  }

  function readRecord() {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return undefined;
    }
  }

  function recover(raw) {
    storedRecord = raw;
    saved = raw !== undefined;
    updatedCatalogue = false;
    if (!raw) return null;
    try {
      const record = JSON.parse(raw);
      if (!record || typeof record !== "object") return null;
      if (record.revision !== revisionKey) {
        updatedCatalogue = true;
        return null;
      }
      if (validAttempt(record.attempt)) {
        record.attempt.journey = experience.restore(record.attempt);
        return record.attempt;
      }
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
    const answersValid = value.answers.every((choice, index) =>
      choice === null ? value.phase === "active" : validOption(choice, index));
    return answersValid &&
      (value.draft === null || (value.answers[value.position] === null && validOption(value.draft, value.position)));
  }

  function saveAttempt(change, afterSave) {
    const previous = attempt;
    function commit() {
      if (attempt !== previous) return;
      const latest = readRecord();
      if (latest !== undefined && latest !== storedRecord) {
        attempt = recover(latest);
        restoredFromAnotherWindow = !!attempt;
        updateStorageStatus();
        if (attempt) resumeService();
        else showHome();
        return;
      }
      if (change() === false) return;

      restoredFromAnotherWindow = false;
      try {
        const record = JSON.stringify({revision: revisionKey, attempt});
        localStorage.setItem(storageKey, record);
        storedRecord = record;
        saved = true;
      } catch {
        saved = false;
      }
      updateStorageStatus();
      afterSave();
    }

    // The comparison and write share one lock across tabs and installed windows.
    // Without Web Locks, the comparison still catches an already committed change.
    const locks = navigator.locks;
    if (!locks) {
      commit();
      return;
    }
    let started = false;
    locks.request(storageKey, () => {
      started = true;
      commit();
    }).catch((error) => {
      if (!started) commit();
      else console.error(error);
    });
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
    if (config.choiceCount) page.style.setProperty("--choice-count", config.choiceCount);
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
    screen.swipeMotion?.cancel();
    screen.index = pageIndex;
    const fragments = screen.pages[pageIndex];
    screen.page.replaceChildren(...fragments.map(({index, start, end}) =>
      fragmentNode(screen.config.blocks[index], start, end)));
    const shown = (pageIndex + 1) + " / " + screen.pages.length;
    const paginated = screen.pages.length > 1;
    screen.controls.hidden = !paginated;
    // When zoomed, give horizontal panning back to the browser as well.
    const canSwipe = paginated && !viewportIsZoomed();
    if (canSwipe !== screen.stage.hasAttribute("data-swipe-pages")) {
      screen.stage.toggleAttribute("data-swipe-pages", canSwipe);
      if (canSwipe) screen.stage.addEventListener("touchmove", trackSwipe, {passive: false});
      else screen.stage.removeEventListener("touchmove", trackSwipe);
    }
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
    const count = element("p", "counter", "Questions traitées : " + value + " / " + total);
    const bar = element("progress", "progress");
    bar.max = total;
    bar.value = value;
    bar.setAttribute("aria-label", "Progression dans le quiz");
    const chips = element("div", "chip-list");
    chips.setAttribute("aria-hidden", "true");
    for (let index = 0; index < Math.min(total, 12); index += 1) {
      const finished = attempt.answers[index] !== null;
      const chip = element("span", "score-chip" + (finished ? " earned" : ""));
      if (index === attempt.position) chip.classList.add("current");
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
    if (config.steps !== undefined) header.append(journeySteps(config.steps));

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
    const pageStatus = element("span", "page-status");
    const swipeHint = element("span", "swipe-hint", "Balayer");
    swipeHint.setAttribute("aria-hidden", "true");
    pageStatus.append(counter, swipeHint);
    controls.append(screen.previous, pageStatus, screen.next);
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

  function viewportIsZoomed() {
    return (window.visualViewport?.scale ?? 1) > 1.01;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let swipe;
  let suppressTouchClickUntil = -1;

  document.addEventListener("pointerdown", () => { suppressTouchClickUntil = -1; }, true);
  document.addEventListener("click", (event) => {
    if (event.detail === 0 || event.timeStamp > suppressTouchClickUntil) return;
    suppressTouchClickUntil = -1;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.addEventListener("touchstart", (event) => {
    swipe = null;
    suppressTouchClickUntil = -1;
    const screen = currentScreen;
    if (event.touches.length !== 1 || !screen?.stage.hasAttribute("data-swipe-pages") ||
        !screen.stage.contains(event.target) || viewportIsZoomed()) return;

    const {identifier, clientX: x, clientY: y} = event.touches[0];
    // Keep the screen edges available for the browser and the operating system.
    if (x < 24 || x > document.documentElement.clientWidth - 24) return;
    swipe = {identifier, x, y, screen, pageIndex: screen.index};
  }, {passive: true});

  function trackSwipe(event) {
    if (!swipe) return;
    const touch = event.touches[0];
    if (event.touches.length !== 1 || touch.identifier !== swipe.identifier) {
      swipe = null;
      return;
    }
    const x = Math.abs(touch.clientX - swipe.x);
    const y = Math.abs(touch.clientY - swipe.y);
    if (y > 18 && y > x) {
      swipe = null;
    } else if (x >= 12 && x >= y * 1.45 && event.cancelable) {
      // Keep the browser from treating the drag as scrolling and delaying the next tap.
      event.preventDefault();
    }
  }

  main.addEventListener("touchend", (event) => {
    const gesture = swipe;
    swipe = null;
    const screen = currentScreen;
    if (!gesture || event.touches.length || gesture.screen !== screen || gesture.pageIndex !== screen.index ||
        screen.pages.length < 2 || viewportIsZoomed() ||
        window.getSelection()?.isCollapsed === false) return;

    const touch = Array.from(event.changedTouches).find(({identifier}) => identifier === gesture.identifier);
    if (!touch) return;
    const x = touch.clientX - gesture.x;
    const y = touch.clientY - gesture.y;
    if (Math.abs(x) < 42 || Math.abs(x) < Math.abs(y) * 1.45 || event.defaultPrevented) return;

    // Some browsers deliver a non-cancelable touchend after passive moves.
    // Suppress only the click from this gesture, including at the ends.
    if (event.cancelable) event.preventDefault();
    suppressTouchClickUntil = event.timeStamp + 350;
    const direction = x < 0 ? 1 : -1;
    const target = screen.index + direction;
    if (target < 0 || target >= screen.pages.length) return;
    setPage(screen, target, true);
    if (!reducedMotion.matches) {
      screen.swipeMotion = screen.page.animate([
        {transform: "translateX(" + direction * 8 + "px)", opacity: .84},
        {transform: "translateX(0)", opacity: 1},
      ], {duration: 155, easing: "ease-out"});
    }
  }, {passive: false});

  main.addEventListener("touchcancel", () => { swipe = null; }, {passive: true});
  main.addEventListener("contextmenu", () => { swipe = null; });

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
    if (["#themes", "#carte", "#reprendre"].includes(location.hash)) {
      history.replaceState(null, "", location.pathname + location.search);
    }

    const play = attempt
      ? iconButton("Reprendre le service", "primary", "arrow-right", resumeService)
      : iconButton("Commencer le service", "primary", "arrow-right", start);
    const browse = iconButton("Explorer la salle", "secondary", "book", showMap);

    const blocks = [
      fixed(() => {
        const heading = element("h1", "hero-title");
        heading.tabIndex = -1;
        heading.append("Réglementation ", element("span", "hero-subject", "des jeux en casino"));
        const lead = element("div", "hero-lead");
        lead.append(element("p", "eyebrow", "Prise de service"), heading);
        return lead;
      }),
      readable("Prenez votre service. Explorez six espaces, prenez des décisions en situation et rassemblez les indices de l’enquête finale.",
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
    saveAttempt(() => {
      updatedCatalogue = false;
      attempt = freshAttempt();
    }, showMap);
  }

  const caseTitles = [
    "Une visite accompagnée", "Le badge du prestataire", "Le jeton après l’annonce",
    "Le zéro à la roulette", "Les cartes avant l’ouverture", "Le tirage du croupier",
    "La machine de réserve", "Les signatures du bon", "Le registre de l’audit",
    "La demande de l’inspecteur", "Trois ans après", "La portée de l’interdiction",
  ];

  function mapAction() {
    return {label: "Carte de la salle", action: showMap};
  }

  function journeySteps(current) {
    const steps = element("ol", "journey-steps");
    steps.setAttribute("aria-label", "Étapes de la situation");
    for (const [index, label] of ["Observer", "Décider", "Correction"].entries()) {
      const step = element("li", "", label);
      if (index === current) step.setAttribute("aria-current", "step");
      steps.append(step);
    }
    return steps;
  }

  function sceneArt(index, css = "") {
    const art = element("div", ("scene-art " + css).trim());
    const tile = index % 6;
    art.dataset.sheet = index < 6 ? "a" : "b";
    art.style.setProperty("--scene-x", (tile % 3) * 50 + "%");
    art.style.setProperty("--scene-y", tile >= 3 ? "100%" : "0%");
    art.setAttribute("aria-hidden", "true");
    return art;
  }

  function sceneBlock(index) {
    const block = fixed(() => {
      const card = element("div", "scene-card");
      card.append(sceneArt(index));
      return card;
    });
    block.key = "scene";
    return block;
  }

  function dialogue(speaker, line) {
    return readable(line, (text, continued) => {
      const block = element("div", "scene-dialogue");
      if (!continued) block.append(element("p", "scene-speaker", speaker));
      block.append(element("blockquote", "quiz-readable", text));
      return block;
    });
  }

  function mapTile({label, subtitle, status, progress, art, action, key}) {
    const block = fixed(() => {
      const item = element("li", "map-node");
      const tile = element("button", "map-card");
      tile.type = "button";
      tile.dataset.status = status;
      tile.dataset.quizFocus = key;
      const copy = element("span", "map-copy");
      copy.append(element("strong", "", label), element("span", "", subtitle));
      const mark = element("span", "map-status", {
        new: "À découvrir", playing: "En cours", review: "À revoir", mastered: "Maîtrisé",
      }[status]);
      tile.append(sceneArt(art, "map-thumb"), copy, mark);
      if (progress) {
        const meter = element("progress", "map-meter");
        meter.max = progress.total;
        meter.value = progress.done;
        meter.setAttribute("aria-hidden", "true");
        tile.append(meter);
      }
      tile.addEventListener("click", action);
      item.append(tile);
      return item;
    });
    block.key = key;
    return block;
  }

  function caseStatus(index) {
    if (!attempt) return "new";
    if (attempt.answers[index] === null) {
      return attempt.journey.drafts[index] !== null || (attempt.position === index && attempt.draft !== null)
        ? "playing" : "new";
    }
    return experience.mastered(attempt, index) ? "mastered" : "review";
  }

  function showMap() {
    const pins = [[50, 77], [20, 59], [80, 59], [20, 25], [50, 21], [80, 25]];
    const areas = Array.from(experience.areas, ([theme, cases]) => {
      const done = cases.filter(({index}) => attempt && attempt.answers[index] !== null).length;
      const mastered = cases.filter(({index}) => attempt && experience.mastered(attempt, index)).length;
      const status = mastered === cases.length ? "mastered" : done === cases.length ? "review" : done ? "playing" : "new";
      return {theme, cases, done, status};
    });
    const intro = fixed(() => {
      const item = element("li", "map-intro");
      const hero = element("div", "journey-hero");
      const art = element("img", "journey-hero-image");
      art.src = "./assets/carte-salle.webp";
      art.alt = "";
      const plan = element("div", "floor-plan");
      plan.setAttribute("role", "group");
      plan.setAttribute("aria-label", "Accès aux espaces de la salle");
      plan.append(art);
      for (const [index, {theme, status}] of areas.entries()) {
        if (!pins[index]) continue;
        const pin = element("button", "floor-pin");
        pin.type = "button";
        pin.title = theme;
        pin.dataset.status = status;
        pin.dataset.quizFocus = "floor-" + theme;
        pin.style.setProperty("--pin-order", index);
        pin.style.setProperty("--pin-x", pins[index][0] + "%");
        pin.style.setProperty("--pin-y", pins[index][1] + "%");
        pin.setAttribute("aria-label", "Ouvrir sur la carte · " + theme);
        pin.append(icon(theme));
        pin.addEventListener("click", () => showArea(theme));
        plan.append(pin);
      }
      hero.append(plan, element("p", "journey-hero-copy", "Choisissez un espace pour ouvrir ses situations."));
      item.append(hero);
      return item;
    });
    const tiles = areas.map(({theme, cases, done, status}) => mapTile({label: theme,
      subtitle: done + " / " + cases.length + " situations traitées", status,
      progress: {done, total: cases.length}, art: cases[0].index, key: theme, action: () => showArea(theme)}));
    const actions = [];
    if (attempt) {
      actions.push(iconButton(attempt.phase === "complete" && !attempt.journey.active
        ? "Voir le bilan" : "Reprendre le service", "primary", "arrow-right", resumeService));
      if (attempt.phase === "active" && attempt.journey.practice && attempt.journey.active !== "practice") {
        actions.push(iconButton("Reprendre l’entraînement", "secondary", "review", () => startPractice()));
      }
    }
    showScreen({name: "map", title: "Carte de la salle", back: homeAction(), blocks: [intro, ...tiles],
      pageTag: "ul", pageClass: "map-list", actions});
  }

  function showArea(theme) {
    const cases = experience.areas.get(theme);
    const blocks = cases.map(({index, scene}) => mapTile({label: caseTitles[index] || scene.place,
      subtitle: scene.place, status: caseStatus(index), art: index, key: "case-" + index,
      action: () => openCase(index)}));
    showScreen({name: "area", title: theme, back: mapAction(), blocks,
      pageTag: "ul", pageClass: "map-list"});
  }

  function freshAttempt() {
    const progress = {phase: "active", position: 0, draft: null, answers: Array(questions.length).fill(null)};
    progress.journey = experience.restore(progress);
    return progress;
  }

  function selectCase(index) {
    const {journey, position, draft} = attempt;
    journey.drafts[position] = attempt.answers[position] === null ? draft : null;
    attempt.position = index;
    attempt.draft = journey.drafts[index];
    journey.active = null;
  }

  function openCase(index) {
    saveAttempt(() => {
      if (!attempt) attempt = freshAttempt();
      selectCase(index);
    }, resumeCase);
  }

  function nextCase(index) {
    const area = experience.areas.get(questions[index].theme);
    const nearby = area.find((item) => attempt.answers[item.index] === null);
    if (nearby) return nearby.index;
    const unanswered = attempt.answers.findIndex((choice, position) => position > index && choice === null);
    return unanswered >= 0 ? unanswered : attempt.answers.indexOf(null);
  }

  function resumeCase() {
    if (attempt.draft !== null || attempt.answers[attempt.position] !== null) showQuestion(true);
    else showBriefing();
  }

  function resumeService() {
    if (attempt.journey.active) showActivity();
    else if (attempt.phase === "complete") showSummary();
    else resumeCase();
  }

  function showBriefing() {
    const index = attempt.position;
    const {question, scene} = experience.cases[index];
    const decide = iconButton("Prendre une décision", "primary", "arrow-right", () => showQuestion());
    showScreen({name: "briefing", title: caseTitles[index] || scene.place,
      context: question.theme + " · " + scene.place,
      back: mapAction(), steps: 0, progress: true,
      blocks: [sceneBlock(index), dialogue(scene.speaker, scene.line)], actions: [decide]});
  }

  function syncSelection(validate, input, index) {
    if (!validate.isConnected) return;
    validate.disabled = false;
    if (!input.isConnected) {
      const replacement = currentScreen.page.querySelector('input[data-quiz-focus="option-' + index + '"]');
      if (replacement) replacement.checked = true;
    }
  }

  function startPractice(queue) {
    const journey = attempt.journey;
    saveAttempt(() => {
      if (!journey.practice && !queue?.length) return false;
      journey.practice ??= {queue, cursor: 0, draft: null, revealed: false};
      journey.active = "practice";
    }, showActivity);
  }

  function openDossier() {
    const journey = attempt.journey;
    if (!journey.investigation && journey.dossier.every((choice) => choice !== null)) return showDossierResult();
    saveAttempt(() => {
      journey.investigation ??= {cursor: -1, draft: null, revealed: false};
      journey.active = "investigation";
    }, showActivity);
  }

  function showDossier(reveal) {
    const journey = attempt.journey;
    const intro = fixed(() => {
      const item = element("li", "dossier-intro");
      const marks = element("span", "clue-marks");
      marks.setAttribute("aria-hidden", "true");
      let seenCount = 0;
      for (const [index] of experience.clues.entries()) {
        const seen = !!(journey.clues & (1 << index));
        if (seen) seenCount += 1;
        const mark = element("span", "clue-mark");
        mark.toggleAttribute("data-read", seen);
        mark.toggleAttribute("data-just-read", seen && reveal === "clue-" + index);
        mark.append(icon(seen ? "check" : "book"));
        marks.append(mark);
      }
      const progress = element("div", "clue-progress");
      progress.append(marks, element("span", "", seenCount + " / " + experience.clues.length + " indices lus"));
      item.append(element("p", "", "Deux situations ont marqué la prise de service. Consultez les trois indices de vos collègues, puis consignez vos deux décisions."), progress);
      return item;
    });
    const clues = experience.clues.map(({title, source}, index) => {
      const block = fixed(() => {
        const item = element("li");
        const clue = element("button", "clue-card");
        const seen = !!(journey.clues & (1 << index));
        clue.type = "button";
        clue.dataset.seen = String(seen);
        clue.dataset.quizFocus = "clue-" + index;
        clue.toggleAttribute("data-just-read", seen && reveal === clue.dataset.quizFocus);
        const label = element("span", "clue-title");
        label.append(element("strong", "", title), element("small", "", source));
        clue.append(icon(seen ? "check" : "book"), label, element("span", "clue-state", seen ? "Lu" : "À lire"));
        clue.addEventListener("click", () => readClue(index));
        item.append(clue);
        return item;
      });
      block.key = "clue-" + index;
      return block;
    });
    const started = journey.investigation.cursor >= 0;
    const next = iconButton(started ? "Reprendre les décisions" : "Prendre les deux décisions", "primary", "arrow-right", () => {
      if (started) return showActivity();
      saveAttempt(() => {
        if (journey.clues !== 7 || journey.active !== "investigation") return false;
        const first = journey.dossier.indexOf(null);
        if (first === -1) return false;
        journey.investigation.cursor = first;
      }, showActivity);
    });
    next.disabled = journey.clues !== 7;
    showScreen({name: "dossier", title: "Enquête finale", icon: "book",
      back: {label: "Retour au bilan", action: showSummary},
      blocks: [intro, ...clues], actions: [next], pageTag: "ul", pageClass: "clue-list", reveal});
  }

  function readClue(index) {
    const journey = attempt.journey;
    saveAttempt(() => {
      if (journey.active !== "investigation") return false;
      journey.clues |= 1 << index;
    }, () => {
      const clue = experience.clues[index];
      showScreen({name: "clue", title: clue.title,
        back: {label: "Retour aux indices", action: () => showDossier("clue-" + index)},
        blocks: [sceneBlock(clue.photo), dialogue(clue.source, clue.text)],
        actions: [button("Retour aux indices", "primary", () => showDossier("clue-" + index))]});
    });
  }

  function showActivity() {
    const journey = attempt.journey;
    const kind = journey.active;
    const activity = journey[kind];
    const practice = kind === "practice";
    if (!practice && activity.cursor === -1) return showDossier();
    const cursor = activity.cursor;
    const isCurrent = () => journey.active === kind && journey[kind] === activity && activity.cursor === cursor;
    const index = practice ? activity.queue[cursor] : cursor;
    const question = practice ? experience.cases[index].variant : experience.dossier[index].question;
    const answers = practice ? journey.variants : journey.dossier;
    const title = practice ? "Situation à rejouer" : "Décision " + (activity.cursor + 1) + " sur 2";
    const context = practice ? question.theme : "Enquête finale";
    const back = practice ? mapAction() : {label: "Retour aux indices", action: () => showDossier()};
    if (activity.revealed) {
      const correct = answers[index] === question.answer;
      const last = practice ? activity.cursor + 1 === activity.queue.length : activity.cursor + 1 === experience.dossier.length;
      const action = iconButton(last ? (practice ? "Reprendre le service" : "Voir le bilan de l’enquête") : "Décision suivante",
        "primary", "arrow-right", () => {
          saveAttempt(() => {
            if (!isCurrent() || !activity.revealed) return false;
            if (last) {
              journey[kind] = null;
              journey.active = null;
            } else {
              activity.cursor += 1;
              activity.draft = null;
              activity.revealed = false;
            }
          }, last ? (practice ? resumeService : showDossierResult) : showActivity);
        });
      showScreen({name: "activity-feedback", parcours: true,
        title: correct ? "Bonne réponse" : "Réponse incorrecte", context,
        state: correct ? "correct" : "incorrect", icon: correct ? "check" : "review",
        back, steps: 2, blocks: explanationBlocks(question, answers[index]), actions: [action]});
      return;
    }
    const validate = element("button", "button primary", "Valider la réponse");
    validate.type = "submit";
    validate.setAttribute("form", "formulaire-reponse");
    validate.disabled = activity.draft === null;
    validate.prepend(icon("check"));
    const options = optionBlocks(question, null, {
      selected: () => activity.draft,
      pick(choice, input) {
        saveAttempt(() => {
          if (!isCurrent() || activity.revealed) return false;
          activity.draft = choice;
        }, () => syncSelection(validate, input, choice));
      },
    });
    showScreen({name: practice ? "practice" : "investigation", parcours: true, title, context,
      back, steps: 1, focusPrompt: true, questionLabel: question.question, choiceCount: question.options.length,
      blocks: [promptBlock(question), ...options], actions: [validate],
      reveal: activity.draft !== null ? "option-" + activity.draft : null,
      submit() {
        saveAttempt(() => {
          if (!isCurrent() || activity.draft === null || activity.revealed) return false;
          answers[index] = activity.draft;
          activity.draft = null;
          activity.revealed = true;
        }, showActivity);
      },
    });
  }

  function showDossierResult() {
    const score = experience.dossier.filter(({question}, index) =>
      attempt.journey.dossier[index] === question.answer).length;
    const blocks = [fixed(() => {
      const card = element("section", "card mastery-card");
      card.append(element("p", "journey-stamp", score === 2 ? "Enquête résolue" : "Enquête terminée"),
        element("h2", "section-title", score + " / 2 décisions correctes"),
        element("p", "", score === 2 ? "Vos décisions concordent avec les indices et les règles du service."
          : "Consultez les deux règles pour reprendre le dossier en confiance."));
      return card;
    }), ...experience.dossier.map(({question}) => fixed(() => officialLink(question)))];
    const actions = [button("Retour au bilan", "primary", showSummary),
      button("Refaire l’enquête", "secondary", () => saveAttempt(() => {
        attempt.journey.clues = 0;
        attempt.journey.dossier = [null, null];
        attempt.journey.investigation = {cursor: -1, draft: null, revealed: false};
        attempt.journey.active = "investigation";
      }, showDossier))];
    showScreen({name: "dossier-result", parcours: true, title: "Bilan de l’enquête", icon: "trophy",
      back: {label: "Retour au bilan", action: showSummary}, blocks, actions});
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

  function optionBlocks(question, choice, controls) {
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
          input.checked = controls.selected() === index;
          input.dataset.quizFocus = key;
          input.addEventListener("keydown", (event) => adjacentOption(event, index, question.options.length));
          if (continued || text !== label) input.setAttribute("aria-label", label);
          input.addEventListener("change", () => {
            if (!input.checked) return;
            controls.pick(index, input);
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
      name: "question", parcours: true, title: context, back: mapAction(), progress: true, focusPrompt: true, steps: 1,
      questionLabel: question.question, choiceCount: question.options.length,
      blocks: [promptBlock(question), ...optionBlocks(question, choice, {
        selected: () => attempt.draft,
        pick(selected, input) {
          saveAttempt(() => {
            if (attempt.position !== index || attempt.answers[index] !== null) return false;
            attempt.draft = selected;
          }, () => syncSelection(validate, input, selected));
        },
      })], actions: [validate],
      reveal: restoreDraft && attempt.draft !== null ? "option-" + attempt.draft : null,
      submit() {
        saveAttempt(() => {
          if (attempt.position !== index || attempt.draft === null || attempt.answers[index] !== null) return false;
          attempt.answers[index] = attempt.draft;
          attempt.draft = null;
        }, () => showFeedback(question, attempt.answers[index], context));
      },
    });
  }

  function showFeedback(question, choice, context) {
    const index = attempt.position;
    const last = countAnswered() === questions.length;
    const correct = choice === question.answer;
    const next = iconButton(last ? "Voir le bilan" : "Situation suivante", "primary",
      last ? "trophy" : "arrow-right", () => {
        if (attempt.phase === "complete") return showSummary();
        saveAttempt(() => {
          if (attempt.position !== index || attempt.answers[index] === null || attempt.phase !== "active") return false;
          if (last) attempt.phase = "complete";
          else selectCase(nextCase(index));
        }, last ? showSummary : showBriefing);
      });
    const actions = [next];
    if (!correct && !experience.mastered(attempt, index)) {
      actions.push(iconButton(attempt.journey.practice ? "Reprendre l’entraînement" : "Rejouer cette règle",
        "secondary", "review", () => startPractice([index])));
    }
    const blocks = explanationBlocks(question, choice);
    if (!correct && experience.mastered(attempt, index)) {
      blocks.unshift(fixed(() => element("p", "journey-stamp", "Variante réussie")));
    }
    showScreen({
      name: "feedback", parcours: true, title: correct ? "Bonne réponse" : "Réponse incorrecte",
      state: correct ? "correct" : "incorrect", icon: correct ? "check" : "review",
      context, back: mapAction(), progress: true, steps: 2, blocks, actions,
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
      copy.append(element("p", "", "Score du premier passage."));
      card.append(ring, copy);
      return card;
    })];
    const practice = experience.pending(attempt);
    const mastered = experience.cases.filter(({index}) => experience.mastered(attempt, index)).length;
    blocks.push(fixed(() => {
      const card = element("section", "card mastery-card");
      card.append(element("h2", "section-title", "Décisions maîtrisées"),
        element("p", "", mastered + " sur " + questions.length +
          (practice.length ? " · " + numberLabel(practice.length, "situation à retravailler", "situations à retravailler") : " · Toutes les règles ont été appliquées.")));
      const controls = element("div", "actions");
      controls.append(button("Résultats par thème", "secondary", showTopicResults));
      if (errors.length) controls.append(button("Revoir les erreurs", "secondary", () => showReview(0)));
      card.append(controls);
      return card;
    }));
    const {dossier, investigation} = attempt.journey;
    const dossierLabel = investigation ? "Reprendre l’enquête finale"
      : dossier.every((choice) => choice !== null) ? "Voir l’enquête finale" : "Ouvrir l’enquête finale";
    const actions = [iconButton(dossierLabel, "primary", "book", openDossier)];
    if (attempt.journey.practice) {
      actions.push(iconButton("Reprendre l’entraînement", "secondary", "review", () => startPractice()));
    } else if (practice.length) {
      actions.push(iconButton(practice.length > 1 ? "Rejouer deux situations" : "Rejouer une situation",
        "secondary", "review", () => startPractice(practice.slice(0, 2))));
    }
    actions.push(button("Recommencer", "secondary", (event) => {
      confirmation.returnValue = "";
      resetTrigger = event.currentTarget;
      confirmation.showModal();
    }));
    showScreen({name: "summary", parcours: true, title: "Bilan du service", icon: "trophy", back: mapAction(), blocks, actions});
  }

  function showTopicResults() {
    const blocks = Array.from(experience.areas, ([theme, cases]) => fixed(() => {
      const count = cases.filter(({index}) => experience.mastered(attempt, index)).length;
      const item = element("li");
      const bar = element("progress", "progress");
      bar.max = cases.length;
      bar.value = count;
      bar.setAttribute("aria-hidden", "true");
      item.append(element("span", "", theme), element("strong", "", count + " / " + cases.length + " maîtrisées"), bar);
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
  document.querySelector("#lien-carte").addEventListener("click", showMap);
  referenceLink.addEventListener("click", (event) => fromFragment(event, () => showThemes()));
  creditLink.hidden = false;
  creditLink.addEventListener("click", () => {
    if (currentScreen?.config.name !== "credits") showCredits();
  });
  document.querySelector(".skip-link").addEventListener("click", (event) => fromFragment(event, () => focusOn(main)));
  document.querySelector(".brand").addEventListener("click", (event) => fromFragment(event, () => showHome()));
  function followShortcut(initial = false) {
    if (location.hash === "#themes") showThemes(undefined, false);
    else if (location.hash === "#carte") showMap();
    else if (location.hash === "#reprendre") {
      if (attempt) resumeService();
      else showHome(false);
    } else if (!location.hash || initial) showHome(false);
  }

  window.addEventListener("hashchange", () => followShortcut());
  window.addEventListener("resize", scheduleReflow);
  window.visualViewport?.addEventListener("resize", scheduleReflow);
  if ("ResizeObserver" in window) {
    new ResizeObserver(scheduleReflow).observe(document.querySelector(".footer"));
  }
  document.fonts?.ready.then(scheduleReflow);
  document.fonts?.addEventListener("loadingdone", scheduleReflow);

  updateStorageStatus();
  followShortcut(true);
})();
