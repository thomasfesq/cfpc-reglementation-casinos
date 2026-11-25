"use strict";

if (window.isSecureContext && "serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  const install = document.querySelector("#installer");
  let installPrompt;

  function syncInstallButton() {
    install.hidden = !installPrompt || !navigator.serviceWorker.controller;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    syncInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = undefined;
    if (document.activeElement === install) document.querySelector("#lien-conception").focus();
    syncInstallButton();
  });

  install.addEventListener("click", async () => {
    const prompt = installPrompt;
    if (!prompt) return;
    installPrompt = undefined;
    try {
      await prompt.prompt();
    } catch {
      // The browser's own install control can still be used.
    } finally {
      if (document.activeElement === install) document.querySelector("#lien-conception").focus();
      syncInstallButton();
    }
  });

  navigator.serviceWorker.addEventListener("controllerchange", syncInstallButton);
  navigator.serviceWorker.register("./service-worker.js").catch((error) => {
    console.warn("Le mode hors connexion du quiz est indisponible.", error);
  });
}
