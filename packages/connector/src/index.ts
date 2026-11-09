import { startBridge } from "./bridge.ts";

// `currentScript` n'existe que pour un script classique : c'est de lui que vient l'origine de l'outil.
const script = document.currentScript;
if (script instanceof HTMLScriptElement && script.src) {
  startBridge({ self: window, parent: window.parent, toolOrigin: new URL(script.src).origin });
}
