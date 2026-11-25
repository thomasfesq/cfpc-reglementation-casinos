"use strict";

(() => {
  const root = document.documentElement;
  if (!window.isSecureContext || !("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;

  navigator.serviceWorker.register("./service-worker.js").catch((error) => {
    console.warn("Le mode hors connexion du quiz est indisponible.", error);
  });

  const {userAgent, userAgentData, maxTouchPoints} = navigator;
  const mobilePlatform = userAgentData?.mobile || userAgentData?.platform === "Android" ||
    /Android|iPhone|iPad|iPod/i.test(userAgent);
  // iPadOS and some Android tablets announce a desktop user agent.
  const desktopModeTablet = maxTouchPoints > 1 && (/Macintosh/i.test(userAgent) ||
    (/Linux x86_64/i.test(userAgent) && window.matchMedia("(pointer: coarse) and (hover: none)").matches));
  if (!mobilePlatform && !desktopModeTablet) return;

  const help = document.querySelector("#aide-installation");
  const standalone = window.matchMedia("(display-mode: standalone)");
  if (standalone.matches || navigator.standalone === true) return;

  root.classList.add("pwa-install-offered");
  let installPrompt;
  let prompting = false;

  function markInstalled() {
    installPrompt = undefined;
    const nextFocus = help.open || document.activeElement?.id === "installer-accueil"
      ? document.querySelector(".quiz-screen--home .screen-actions .primary")
      : null;
    if (help.open) help.close();
    root.classList.remove("pwa-install-offered");
    nextFocus?.focus();
    window.dispatchEvent(new Event("cfpc:appinstalled"));
  }

  standalone.addEventListener?.("change", (event) => {
    if (event.matches) markInstalled();
  });
  window.addEventListener("appinstalled", markInstalled);
  window.addEventListener("beforeinstallprompt", (event) => {
    if (!root.classList.contains("pwa-install-offered")) return;
    event.preventDefault();
    installPrompt = event;
  });

  document.querySelector("#contenu").addEventListener("click", async (event) => {
    const button = event.target.closest("#installer-accueil");
    if (!button || prompting || help.open || !root.classList.contains("pwa-install-offered")) return;

    const prompt = installPrompt;
    if (prompt) {
      installPrompt = undefined;
      prompting = true;
      try {
        await prompt.prompt();
        return;
      } catch {
        // The manual steps remain available if the browser rejects the prompt.
      } finally {
        prompting = false;
      }
    }

    if (button.isConnected && root.classList.contains("pwa-install-offered")) {
      help.showModal();
      help.scrollTop = 0;
    }
  });
})();
