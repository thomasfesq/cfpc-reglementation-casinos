"use strict";

(() => {
  const main = document.querySelector("#contenu");
  const storageStatus = document.querySelector("#statut-stockage");
  const confirmation = document.querySelector("#confirmation");
  const storagePath = location.pathname.replace(/(?:index\.html)?$/, "");
  const storageKey = "cfpc-reglementation:v1:" + storagePath;
  const stampPrefix = "cfpc-carnet:v1:" + storagePath + ":";
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

  const missions = window.CFPC_MISSIONS;
  const terrain = window.CFPC_TERRAIN;
  const atelier = window.CFPC_ATELIER;
  const experience = questions && missions && window.CFPC_EXPERIENCE?.create(questions, window.CFPC_STORIES, missions);
  if (!experience || !terrain) {
    const header = element("div", "quiz-screen-head");
    header.append(element("h1", "screen-title", "Quiz indisponible"),
      element("p", "", "Les ressources du parcours n’ont pas pu être chargées."));
    storageStatus.textContent = "";
    main.replaceChildren(header);
    return;
  }

  const stampCases = new Map();
  const notebookEntries = window.CFPC_CARNET;
  if (Array.isArray(notebookEntries)) {
    for (const entry of notebookEntries) {
      const question = questions.find(({id}) => id === entry?.refId);
      if (!question) continue;
      const reference = entry.source || question;
      if (sourceUrl(reference.url)) {
        stampCases.set(question.theme, {...entry, theme: question.theme, reference});
      }
    }
  }
  const notebookAvailable = stampCases.size === experience.areas.size;
  const sessionStamps = new Set();

  const revision = questions.map(({id, theme, question, options, answer, explanation, article, url}) =>
    [id, theme, question, options, answer, explanation, article, url]);
  const revisionKey = JSON.stringify(revision);
  const topicTotals = tally();
  let saved = true;
  let updatedCatalogue = false;
  let resetTrigger = null;
  let storedRecord;
  let restoredFromAnotherWindow = false;
  let lastMisses = null;
  let express = null;
  let expressFromGames = false;
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
    lastMisses = null;
    express = null;
    if (!raw) return null;
    try {
      const record = JSON.parse(raw);
      if (!record || typeof record !== "object") return null;
      if (record.revision !== revisionKey) {
        updatedCatalogue = true;
        return null;
      }
      express = missions.restoreQuick(record.express, experience.cases);
      lastMisses = Array.isArray(record.lastMisses) ? missions.restoreMisses(record.lastMisses, experience.cases) : null;
      if (validAttempt(record.attempt)) {
        record.attempt.journey = experience.restore(record.attempt);
        if (lastMisses === null && record.attempt.answers.every((choice) => choice !== null)) {
          lastMisses = missedRules(record.attempt);
        }
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
        restoredFromAnotherWindow = !!(attempt || express);
        updateStorageStatus();
        if (currentScreen?.config.name.startsWith("quick-")) openExpress();
        else if (attempt) resumeService();
        else showHome();
        return;
      }
      if (change() === false) return;

      restoredFromAnotherWindow = false;
      try {
        const record = JSON.stringify({revision: revisionKey, attempt, express, lastMisses});
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

  function missedRules(service) {
    return experience.cases.filter(({index, question}) =>
      service.answers[index] !== null && service.answers[index] !== question.answer).map(({index}) => index);
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
    if (config.pageTag === "ol") page.setAttribute("role", "list");
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
    const mini = iconButton("Mini-jeux", "secondary atelier-entry", "trophy", showMiniGames);
    const carnet = iconButton("Carnet de service", "secondary carnet-entry", "book", () => showNotebook());
    const quick = iconButton("Relève express", "secondary", "chip", () => openExpress(false));
    const reflex = iconButton("Fiches réflexes", "secondary", "book", showReflexes);
    const install = element("button", "button install-cta");
    install.id = "installer-accueil";
    install.type = "button";
    install.setAttribute("aria-labelledby", "libelle-installer");
    install.setAttribute("aria-describedby", "avantage-installer");
    const installCopy = element("span", "install-copy");
    const installLabel = element("strong", "", "Installer CFPC");
    installLabel.id = "libelle-installer";
    const installBenefit = element("span", "", "Jouez aussi hors connexion");
    installBenefit.id = "avantage-installer";
    installCopy.append(installLabel, installBenefit);
    install.append(icon("app-install", "install-phone"), installCopy, icon("arrow-right", "install-arrow"));

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
      name: "home", blocks, pageClass: "hero-copy",
      actions: [install, play, ...(notebookAvailable ? [carnet] : []), ...(atelier ? [mini] : []), browse, quick, reflex],
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
    if (notebookAvailable) actions.push(iconButton("Carnet de service", "secondary", "book", () => showNotebook()));
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
      item.append(element("p", "", "Deux situations ont marqué la prise de service. Consultez les trois indices, reconstituez l’ordre des événements, puis consignez vos décisions."), progress);
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
    const solved = missions.solved(journey.timeline);
    const next = iconButton(started ? "Reprendre les décisions"
      : solved ? "Prendre les deux décisions" : "Reconstituer la chronologie", "primary", "arrow-right", () => {
        if (started) return showActivity();
        if (solved) return startDossierDecisions();
        saveAttempt(() => {
          if (journey.clues !== 7 || journey.active !== "investigation" || journey.investigation.cursor !== -1) return false;
          journey.investigation.timelineOpen = true;
        }, () => showTimeline());
      });
    next.disabled = journey.clues !== 7;
    showScreen({name: "dossier", title: "Enquête finale", icon: "book",
      back: {label: "Retour au bilan", action: showSummary},
      blocks: [intro, ...clues], actions: [next], pageTag: "ul", pageClass: "clue-list", reveal});
  }

  function startDossierDecisions() {
    const journey = attempt.journey;
    saveAttempt(() => {
      if (journey.clues !== 7 || journey.active !== "investigation" || !missions.solved(journey.timeline) ||
          journey.investigation.cursor !== -1) return false;
      const first = journey.dossier.indexOf(null);
      if (first === -1) return false;
      journey.investigation.cursor = first;
      journey.investigation.timelineOpen = false;
    }, showActivity);
  }

  function showTimeline(reveal) {
    const journey = attempt.journey;
    const activity = journey.investigation;
    const timeline = journey.timeline;
    const isCurrent = () => journey.active === "investigation" &&
      journey.investigation === activity && activity.cursor === -1 && activity.timelineOpen;
    const leave = () => saveAttempt(() => {
      if (!isCurrent()) return false;
      activity.timelineOpen = false;
    }, () => showDossier());
    const commit = (change, done) => saveAttempt(() => isCurrent() && change(), done);
    renderTimeline({timeline, name: "timeline", title: "Reconstituer la chronologie",
      back: {label: "Retour aux indices", action: leave}, commit,
      finishLabel: "Prendre les deux décisions", finish: startDossierDecisions}, reveal);
  }

  function renderTimeline(config, reveal) {
    const {timeline, name, title, back, commit, finishLabel, finish, witnesses = []} = config;
    const solved = missions.solved(timeline);
    const evidence = witnesses.map(({speaker, line}) => readable(line, (text, continued) => {
      const witness = element("li", "timeline-info");
      const quote = element("p", "quiz-readable");
      if (!continued) quote.append(element("strong", "", speaker), " · ");
      quote.append(text);
      witness.append(quote);
      return witness;
    }));
    const blocks = [...evidence, fixed(() => {
      const intro = element("li", "timeline-info");
      intro.append(element("p", "", "Touchez les trois cartes, du premier au dernier événement. Retouchez une carte choisie pour la replacer."));
      return intro;
    })];
    const available = missions.displayOrder.filter((id) => !timeline.order.includes(id));
    for (const id of [...timeline.order, ...available]) {
      const step = missions.events[id];
      const position = timeline.order.indexOf(id);
      const key = "timeline-" + id;
      const card = fixed(() => {
        const item = element("li");
        const control = element("button", "timeline-card");
        control.type = "button";
        control.dataset.quizFocus = key;
        control.setAttribute("aria-pressed", String(position >= 0));
        const marker = element("span", "timeline-position", position >= 0 ? String(position + 1) : "");
        marker.setAttribute("aria-hidden", "true");
        control.append(marker, element("span", "", step.label));
        if (position >= 0) control.append(element("span", "sr-only", " · position " + (position + 1)));
        control.addEventListener("click", () => commit(() => {
          if (missions.solved(timeline)) return false;
          timeline.order = timeline.order.includes(id)
            ? timeline.order.filter((eventId) => eventId !== id) : [...timeline.order, id];
          timeline.checked = false;
        }, () => renderTimeline(config, key)));
        control.disabled = solved;
        item.append(control);
        return item;
      });
      card.key = key;
      blocks.push(card);
    }
    if (timeline.checked) {
      const statusBlock = fixed(() => {
        const status = element("li", "timeline-status", solved ? "Chronologie reconstituée."
          : "L’ordre est à revoir. D’après le témoignage, le jeton arrive après l’annonce, alors que la bille tourne encore.");
        status.dataset.correct = String(solved);
        status.dataset.quizFocus = "timeline-result";
        status.tabIndex = -1;
        return status;
      });
      statusBlock.key = "timeline-result";
      blocks.push(statusBlock);
    }
    const action = solved ? iconButton(finishLabel, "primary", "arrow-right", finish)
      : button("Vérifier l’ordre", "primary", () => commit(() => {
        if (timeline.order.length !== missions.events.length) return false;
        timeline.checked = true;
      }, () => renderTimeline(config, "timeline-result")));
    if (!solved) action.disabled = timeline.order.length !== missions.events.length;
    showScreen({name, title, context: "Roulette française", back, blocks, pageTag: "ol",
      pageClass: "timeline-order", actions: [action], reveal});
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

  function reactionBlock(imageIndex, speaker, line) {
    return fixed(() => {
      const card = element("div", "reaction-card");
      const copy = element("div", "reaction-copy");
      copy.append(element("p", "scene-speaker", speaker), element("blockquote", "", line));
      card.append(sceneArt(imageIndex, "map-thumb"), copy);
      return card;
    });
  }

  function showChoiceReaction({question, imageIndex, choice, variant = false, back, next, quick = false}) {
    const reaction = terrain.reactions[question.id];
    const line = reaction[variant ? "variant" : "standard"][choice];
    showScreen({name: quick ? "quick-reaction" : "reaction", title: "La scène continue", context: question.theme,
      back, blocks: [reactionBlock(imageIndex, reaction.speaker, line)],
      actions: [iconButton("Voir la correction", "primary", "arrow-right", next)]});
  }

  function miniBack() {
    return {label: "Retour aux mini-jeux", action: showMiniGames};
  }

  function showMiniGames() {
    const games = [
      ["Le bureau de contrôle", "Inspectez un bon de paiement et décidez quoi faire.", "book", startBureau],
      ["Une seconde de trop", "Reconstituez une mise litigieuse à la roulette.", "Roulette française", startMiniTimeline],
      ["Le tri de l’accueil", "Traitez trois demandes à l’entrée de la salle.", "Admission en salle", startTriage],
      ["La relève express", "Jouez trois situations et révisez vos réflexes.", "chip", () => openExpress(true)],
    ];
    const blocks = games.map(([name, description, symbol, start]) => fixed(() => {
      const card = button("", "secondary atelier-card", start);
      const medal = element("span", "atelier-card-icon");
      medal.append(icon(symbol));
      const copy = element("span", "atelier-card-copy");
      copy.append(element("strong", "", name), element("small", "", description));
      card.append(medal, copy, icon("arrow-right", "atelier-card-arrow"));
      return card;
    }));
    showScreen({name: "mini-hub", title: "Mini-jeux", icon: "trophy", back: homeAction(), blocks});
  }

  function miniDecision(title, context, question, options, choose, lead = [], back = miniBack()) {
    const choices = options.map((option, index) => {
      const block = fixed(() => {
        const control = button(option, "secondary atelier-decision", () => choose(index));
        control.dataset.quizFocus = "mini-choice-" + index;
        return control;
      });
      block.key = "mini-choice-" + index;
      return block;
    });
    showScreen({name: "mini-decision", title, context, back, focusPrompt: true,
      blocks: [...lead, readable(question, (text) => element("p", "question quiz-readable", text)), ...choices]});
  }

  function miniReaction({title, context, refId, speaker, line, next, back = miniBack()}) {
    const imageIndex = questions.findIndex(({id}) => id === refId);
    showScreen({name: "mini-reaction", title, context, back,
      blocks: [reactionBlock(imageIndex, speaker, line)],
      actions: [iconButton("Voir la correction", "primary", "arrow-right", next)]});
  }

  function miniCorrection({title, context, options, answer, choice, explanation, reflex, refId, actions, back = miniBack(),
    reference = questions.find(({id}) => id === refId)}) {
    const correct = choice === answer;
    const verdict = fixed(() => {
      const card = element("section", "atelier-verdict");
      card.dataset.correct = String(correct);
      const decision = element("p");
      if (!correct) decision.append(element("strong", "", "Décision attendue"), " · ");
      decision.append(options[answer]);
      card.append(element("h2", "section-title", correct ? "Bonne décision" : "Décision à revoir"), decision);
      return card;
    });
    const blocks = [verdict];
    if (!correct) blocks.push(readable(options[choice], (text, continued) => {
      const picked = element("p", "quiz-readable");
      if (!continued) picked.append(element("strong", "", "Votre choix"), " · ");
      picked.append(text);
      return picked;
    }));
    blocks.push(readable(explanation, (text) => element("p", "quiz-readable", text)),
      readable(reflex, (text) => element("p", "atelier-reflex quiz-readable", text)));
    if (reference) blocks.push(fixed(() => officialLink(reference, "Texte officiel · " + reference.article)));
    showScreen({name: "mini-correction", title, context, back, blocks, actions});
  }

  function startBureau() {
    const title = "Le bureau de contrôle";
    const {intro, reference, fields, issue, feedback, decision} = atelier.bureau;
    let selected = null;
    let checked = false;

    function decide() {
      miniDecision(title, "Décision en caisse", decision.question, decision.options, (choice) => {
        miniReaction({title, context: "Réaction en caisse", refId: decision.refId, speaker: decision.speaker,
          line: decision.reactions[choice], next: () => miniCorrection({...decision, choice, title,
            context: "Correction", actions: [button("Rejouer", "primary", startBureau)]})});
      });
    }

    function inspect(reveal) {
      const verified = checked && selected === issue;
      const head = fixed(() => {
        const card = element("header", "atelier-ticket-head");
        card.append(element("small", "", reference), element("h2", "section-title", "Bon de paiement"),
          element("p", "", intro));
        return card;
      });
      const inspection = fields.map(({label, value}, index) => {
        const key = "atelier-field-" + index;
        const field = fixed(() => {
          const control = element("button", "atelier-ticket-field");
          control.type = "button";
          control.dataset.quizFocus = key;
          control.setAttribute("aria-pressed", String(selected === index));
          control.disabled = verified;
          control.append(element("strong", "", label), element("span", "", value));
          if (selected === index) control.append(element("small", "", "Champ repéré"));
          control.addEventListener("click", () => {
            selected = index;
            checked = false;
            inspect(key);
          });
          return control;
        });
        field.key = key;
        return field;
      });
      const blocks = [head, ...inspection];
      if (checked) {
        const result = fixed(() => {
          const notice = element("p", "atelier-notice", verified ? feedback.correct : feedback.incorrect);
          notice.dataset.quizFocus = "atelier-field-result";
          notice.tabIndex = -1;
          return notice;
        });
        result.key = "atelier-field-result";
        blocks.push(result);
      }
      const next = verified ? iconButton("Choisir quoi faire", "primary", "arrow-right", decide)
        : button("Vérifier le champ", "primary", () => {
          checked = true;
          inspect("atelier-field-result");
        });
      next.disabled = selected === null;
      showScreen({name: "mini-document", title, context: "Inspection du bon", back: miniBack(), blocks,
        actions: [next], reveal});
    }

    inspect();
  }

  function startTriage() {
    const title = "Le tri de l’accueil";
    const {cases, choices: options} = atelier.accueil;
    const picks = [];

    function showResult() {
      const correct = cases.map(({answer}, index) => answer === picks[index]);
      const blocks = [fixed(() => element("p", "atelier-result",
        correct.filter(Boolean).length + " / " + cases.length + " décisions correctes"))];
      cases.forEach(({title: caseTitle, reflex}, index) => blocks.push(readable(reflex, (text, continued) => {
        const card = element("section", "atelier-verdict");
        card.dataset.correct = String(correct[index]);
        if (!continued) card.append(element("h2", "section-title", caseTitle),
          element("strong", "", correct[index] ? "Réflexe acquis" : "À retravailler"));
        card.append(element("p", "quiz-readable", text));
        return card;
      })));
      showScreen({name: "mini-summary", title, context: "Bilan des trois demandes", back: miniBack(), blocks,
        actions: [button("Rejouer", "primary", startTriage)]});
    }

    function showRequest(index) {
      const item = cases[index];
      const context = "Demande " + (index + 1) + " sur " + cases.length;
      const lead = [dialogue(item.speaker, item.line), fixed(() => element("p", "atelier-signal", item.signal))];
      miniDecision(title, context + " · " + item.title, item.question, options, (choice) => {
        picks[index] = choice;
        miniReaction({title, context, refId: item.refId, speaker: item.speaker, line: item.reactions[choice], next() {
          const last = index === cases.length - 1;
          const nextRequest = iconButton(last ? "Voir le bilan de l’accueil" : "Demande suivante", "primary", "arrow-right",
            last ? showResult : () => showRequest(index + 1));
          miniCorrection({...item, title, context, options, choice, actions: [nextRequest]});
        }});
      }, lead);
    }

    showRequest(0);
  }

  function startMiniTimeline() {
    const title = "Une seconde de trop";
    const refId = "reg-roulette-mise-tardive";
    const question = questions.find(({id}) => id === refId);
    const reaction = terrain.reactions[refId];
    const timeline = missions.restoreTimeline();
    const commit = (change, done) => {
      if (change() !== false) done();
    };
    const witnesses = [
      {speaker: "La cheffe de table", line: "À l’annonce, le jeton était encore dans la main du joueur."},
      {speaker: "Le collègue en salle", line: "Quand le joueur a posé le jeton, la bille tournait toujours."},
    ];
    renderTimeline({timeline, name: "mini-chronology", title, back: miniBack(), commit, witnesses,
      finishLabel: "Trancher sur la mise", finish() {
        miniDecision(title, "Décision à la roulette", "Le jeton posé après l’annonce participe-t-il au coup ?",
          question.options, (choice) => miniReaction({title, context: "Réaction à la table", refId,
            speaker: reaction.speaker, line: reaction.standard[choice], next: () => miniCorrection({...question,
              title, context: "Correction", refId, choice, reflex: "Repérez ce qui était déjà sur le tableau à l’annonce.",
              actions: [button("Rejouer", "primary", startMiniTimeline)]})}));
      }});
  }

  function showActivityQuestion(question, {draft, pick, submit, ...screen}) {
    const validate = element("button", "button primary", "Valider la réponse");
    validate.type = "submit";
    validate.setAttribute("form", "formulaire-reponse");
    validate.disabled = draft() === null;
    validate.prepend(icon("check"));
    const options = optionBlocks(question, null, {
      selected: draft,
      pick(choice, input) {
        saveAttempt(() => pick(choice), () => syncSelection(validate, input, choice));
      },
    });
    showScreen({...screen, parcours: true, steps: 1, focusPrompt: true,
      questionLabel: question.question, choiceCount: question.options.length,
      blocks: [promptBlock(question), ...options], actions: [validate],
      reveal: draft() !== null ? "option-" + draft() : null,
      submit});
  }

  function showActivity() {
    const journey = attempt.journey;
    const kind = journey.active;
    const activity = journey[kind];
    const practice = kind === "practice";
    if (!practice && activity.cursor === -1) return activity.timelineOpen ? showTimeline() : showDossier();
    const cursor = activity.cursor;
    const isCurrent = () => journey.active === kind && journey[kind] === activity && activity.cursor === cursor;
    const index = practice ? activity.queue[cursor] : cursor;
    const item = practice ? experience.cases[index] : experience.dossier[index];
    const question = practice ? item.variant : item.question;
    const answers = practice ? journey.variants : journey.dossier;
    const title = practice ? "Situation à rejouer" : "Décision " + (activity.cursor + 1) + " sur 2";
    const context = practice ? question.theme : "Enquête finale";
    const back = practice ? mapAction() : {label: "Retour aux indices", action: () => showDossier()};
    if (activity.revealed) {
      if (activity.reacted === false) {
        return showChoiceReaction({question, imageIndex: item.index, choice: answers[index], variant: practice, back, next() {
          saveAttempt(() => {
            if (!isCurrent() || !activity.revealed || activity.reacted !== false) return false;
            activity.reacted = true;
          }, showActivity);
        }});
      }
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
    showActivityQuestion(question, {
      name: practice ? "practice" : "investigation", title, context, back,
      draft: () => activity.draft,
      pick(choice) {
        if (!isCurrent() || activity.revealed) return false;
        activity.draft = choice;
      },
      submit() {
        saveAttempt(() => {
          if (!isCurrent() || activity.draft === null || activity.revealed) return false;
          answers[index] = activity.draft;
          activity.draft = null;
          activity.revealed = true;
          activity.reacted = false;
        }, showActivity);
      },
    });
  }

  function startExpress() {
    const previous = express;
    saveAttempt(() => {
      if (express !== previous || (express && express.phase !== "complete")) return false;
      const priorities = lastMisses ?? (attempt ? missedRules(attempt) : []);
      const next = missions.createQuick(experience.cases, priorities, previous);
      if (!next) return false;
      express = next;
    }, showExpress);
  }

  function openExpress(fromGames = expressFromGames) {
    expressFromGames = fromGames;
    if (express) showExpress();
    else startExpress();
  }

  function showExpress() {
    const run = express;
    if (run.phase === "complete") return showExpressResult(run);
    const cursor = run.cursor;
    const imageIndex = run.queue[cursor];
    const question = experience.cases[imageIndex].variant;
    const choice = run.picks[cursor];
    const back = expressFromGames ? miniBack() : homeAction();
    const context = "Situation " + (cursor + 1) + " sur " + run.queue.length +
      (run.target === imageIndex ? " · Point à retravailler" : "");
    const current = (phase) => express === run && run.cursor === cursor && run.phase === phase;

    if (run.phase === "reaction") {
      return showChoiceReaction({question, imageIndex, choice, variant: true, back, quick: true, next() {
        saveAttempt(() => {
          if (!current("reaction")) return false;
          run.phase = "correction";
        }, showExpress);
      }});
    }

    if (run.phase === "correction") {
      const correct = choice === question.answer;
      const last = cursor === run.queue.length - 1;
      const next = iconButton(last ? "Voir le bilan de la relève" : "Situation suivante", "primary", "arrow-right", () => {
        saveAttempt(() => {
          if (!current("correction")) return false;
          if (last) run.phase = "complete";
          else {
            run.cursor += 1;
            run.phase = "question";
          }
        }, showExpress);
      });
      return showScreen({name: "quick-correction", parcours: true, title: correct ? "Bonne réponse" : "Réponse incorrecte",
        context, state: correct ? "correct" : "incorrect", icon: correct ? "check" : "review", back,
        steps: 2, blocks: explanationBlocks(question, choice), actions: [next]});
    }

    showActivityQuestion(question, {
      name: "quick-question", title: "Relève express", context, back,
      draft: () => run.draft,
      pick(value) {
        if (!current("question")) return false;
        run.draft = value;
      },
      submit() {
        saveAttempt(() => {
          if (!current("question") || run.draft === null) return false;
          run.picks[cursor] = run.draft;
          if (cursor === run.queue.length - 1) {
            lastMisses = run.queue.filter((index, position) =>
              run.picks[position] !== experience.cases[index].variant.answer);
          }
          run.draft = null;
          run.phase = "reaction";
        }, showExpress);
      },
    });
  }

  function showExpressResult(run) {
    const scores = run.queue.map((index, position) => {
      const {variant} = experience.cases[index];
      return {theme: questions[index].theme, correct: run.picks[position] === variant.answer,
        reflex: variant.options[variant.answer]};
    });
    const total = scores.filter(({correct}) => correct).length;
    const blocks = [fixed(() => {
      const card = element("section", "card mastery-card quick-summary");
      card.append(element("h2", "section-title", total + " / " + run.queue.length + " réponses correctes"));
      return card;
    }), ...scores.map(({theme, correct, reflex}) => readable(reflex, (text, continued) => {
      const card = element("section", "card mastery-card quick-summary");
      if (!continued) card.append(element("h2", "section-title", theme),
        element("p", "journey-stamp", correct ? "Réflexe acquis" : "À retravailler"));
      card.append(element("p", "quiz-readable", text));
      return card;
    }))];
    showScreen({name: "quick-summary", parcours: true, title: "Bilan de la relève", icon: "trophy",
      back: expressFromGames ? miniBack() : homeAction(),
      blocks, actions: [button("Faire une autre relève", "primary", startExpress),
        button("Fiches réflexes", "secondary", showReflexes)]});
  }

  function showReflexes() {
    const blocks = Array.from(experience.areas, ([theme, items]) => fixed(() => {
      const item = element("li");
      const tile = element("button", "map-card reflex-link");
      tile.type = "button";
      const copy = element("span", "map-copy");
      copy.append(element("strong", "", theme));
      tile.append(sceneArt(items[0].index, "map-thumb"), copy, icon("arrow-right"));
      tile.addEventListener("click", () => showReflex(theme));
      item.append(tile);
      return item;
    }));
    showScreen({name: "reflexes", title: "Fiches réflexes", icon: "book",
      back: homeAction(), blocks, pageTag: "ul", pageClass: "reflex-list"});
  }

  function showReflex(theme) {
    const fiche = terrain.reflexes[theme];
    const topics = [["Le geste à retenir", fiche.gesture], ["Le piège fréquent", fiche.pitfall], ["La règle officielle", fiche.rule]];
    const blocks = topics.map(([heading, copy]) => readable(copy, (text, continued) => {
      const card = element("section", "reflex-card");
      if (!continued) card.append(element("h2", "section-title", heading));
      card.append(element("p", "quiz-readable", text));
      return card;
    }));
    const refs = fiche.sources.map((id) => questions.find((question) => question.id === id));
    for (const question of new Map(refs.map((item) => [item.url, item])).values()) {
      blocks.push(fixed(() => officialLink(question, "Texte officiel · " + question.article)));
    }
    showScreen({name: "reflex", title: theme, context: "Fiche réflexe", icon: "book",
      back: {label: "Toutes les fiches", action: showReflexes}, blocks});
  }

  function stampState(id) {
    if (sessionStamps.has(id)) return "session";
    try {
      return localStorage.getItem(stampPrefix + id) === "1" ? "saved" : "";
    } catch {
      return "";
    }
  }

  function earnStamp(id) {
    try {
      // One key per space keeps concurrent awards independent of one another and of the quiz.
      localStorage.setItem(stampPrefix + id, "1");
      sessionStamps.delete(id);
    } catch {
      sessionStamps.add(id);
    }
  }

  function stampSeal(theme) {
    const seal = element("span", "carnet-seal");
    seal.setAttribute("aria-hidden", "true");
    seal.append(icon(theme));
    return seal;
  }

  function showNotebook(reveal) {
    const tiles = Array.from(stampCases.values(), (entry) => ({entry, earned: !!stampState(entry.id)}));
    const earned = tiles.filter((tile) => tile.earned).length;
    const blocks = [
      fixed(() => element("p", "carnet-progress", earned + " / " + tiles.length + " tampons")),
      fixed(() => element("p", "carnet-instructions",
        "Réussissez une situation inédite dans chaque espace pour gagner son tampon.")),
    ];
    for (const {entry, earned} of tiles) {
      const tile = fixed(() => {
        const control = button("", "secondary carnet-tile", () => {
          if (stampState(entry.id)) showStamp(entry);
          else playForStamp(entry);
        });
        control.dataset.earned = String(earned);
        control.dataset.quizFocus = entry.id;
        const copy = element("span", "carnet-copy");
        copy.append(element("strong", "", entry.theme),
          element("small", "", earned ? "Tampon obtenu · Ouvrir" : "À valider · Jouer"));
        control.append(stampSeal(entry.theme), copy, icon("arrow-right", "carnet-arrow"));
        return control;
      });
      tile.key = entry.id;
      blocks.push(tile);
    }
    showScreen({name: "carnet", title: "Carnet de service", icon: "book", back: homeAction(), blocks, reveal});
  }

  function notebookBack(id) {
    return {label: "Retour au carnet", action: () => showNotebook(id)};
  }

  function playForStamp(entry) {
    const {id, theme, title, question, options, answer, speaker, line, reactions, refId} = entry;
    const back = notebookBack(id);
    miniDecision(theme, title, question, options, (choice) => {
      const correct = choice === answer;
      const newlyEarned = correct && !stampState(id);
      if (correct) earnStamp(id);
      miniReaction({title: theme, context: title, refId, speaker, line: reactions[choice], back, next() {
        if (correct) showStamp(entry, newlyEarned);
        else miniCorrection({...entry, title: theme, context: "Carnet de service", choice, back,
          actions: [button("Réessayer", "primary", () => playForStamp(entry))]});
      }});
    }, [dialogue(speaker, line)], back);
  }

  function showStamp(entry, newlyEarned = false) {
    const {id, theme, title, reflex, excerpt, reference} = entry;
    const blocks = [
      fixed(() => {
        const award = element("section", "carnet-award");
        award.dataset.earned = "true";
        if (newlyEarned) award.dataset.new = "true";
        const copy = element("div");
        copy.append(element("h2", "section-title", "Tampon obtenu"), element("p", "", title));
        if (stampState(id) === "session") {
          copy.append(element("p", "", "Tampon conservé pendant cette session."));
        }
        award.append(stampSeal(theme), copy);
        return award;
      }),
      readable(reflex, (text, continued) => {
        const card = element("section", "carnet-detail");
        if (!continued) card.append(element("h2", "section-title", "Le réflexe à retenir"));
        card.append(element("p", "quiz-readable", text));
        return card;
      }),
      readable(excerpt, (text, continued) => {
        const card = element("section", "carnet-detail");
        if (!continued) card.append(element("h2", "section-title", "Extrait du texte officiel"));
        const quote = element("blockquote", "quiz-readable", text);
        quote.cite = sourceUrl(reference.url);
        card.append(quote);
        return card;
      }),
      fixed(() => officialLink(reference, "Lire le texte officiel · " + reference.article)),
    ];
    showScreen({name: "stamp-detail", title: theme, context: "Carnet de service", icon: "book",
      back: notebookBack(id), blocks,
      actions: [button("Rejouer la situation", "secondary", () => playForStamp(entry))]});
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
        attempt.journey.timeline = missions.restoreTimeline();
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
          attempt.journey.unseenReactions.push(index);
          if (countAnswered() === questions.length) lastMisses = missedRules(attempt);
        }, () => showFeedback(question, attempt.answers[index], context));
      },
    });
  }

  function showFeedback(question, choice, context) {
    const index = attempt.position;
    const service = attempt;
    const unseen = service.journey.unseenReactions;
    if (unseen.includes(index)) {
      return showChoiceReaction({question, imageIndex: index, choice, back: mapAction(), next() {
        saveAttempt(() => {
          const pending = service.journey.unseenReactions;
          if (attempt !== service || attempt.position !== index || !pending.includes(index)) return false;
          service.journey.unseenReactions = pending.filter((position) => position !== index);
        }, () => showFeedback(question, choice, context));
      }});
    }
    const last = countAnswered() === questions.length;
    const correct = choice === question.answer;
    const next = iconButton(last ? "Voir le bilan" : "Situation suivante", "primary",
      last ? "trophy" : "arrow-right", () => {
        if (attempt.phase === "complete") return showSummary();
        saveAttempt(() => {
          if (attempt.position !== index || attempt.answers[index] === null || attempt.phase !== "active") return false;
          if (last) {
            attempt.phase = "complete";
          } else {
            selectCase(nextCase(index));
          }
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
  window.addEventListener("cfpc:appinstalled", scheduleReflow);
  window.visualViewport?.addEventListener("resize", scheduleReflow);
  if ("ResizeObserver" in window) {
    new ResizeObserver(scheduleReflow).observe(document.querySelector(".footer"));
  }
  document.fonts?.ready.then(scheduleReflow);
  document.fonts?.addEventListener("loadingdone", scheduleReflow);

  updateStorageStatus();
  followShortcut(true);
})();
