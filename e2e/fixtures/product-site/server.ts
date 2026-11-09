// Faux produit servant aux tests e2e et à l'essai manuel (quickstart.md). Aucune dépendance.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const TOOL_ORIGIN = "http://feedback.fixture.localhost:3000";

// CSP stricte : vérifie que le connecteur fonctionne sur un produit qui n'autorise rien de plus
// que le script de l'outil (research.md R3).
const PRODUCT_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    `script-src 'self' ${TOOL_ORIGIN}`,
    "style-src 'self'",
    `frame-ancestors ${TOOL_ORIGIN}`,
  ].join("; "),
};

const CONNECTOR_TAG = `<script src="${TOOL_ORIGIN}/connector.js" defer></script>`;

const PAGE_SCRIPT = `
document.getElementById("counter")?.addEventListener("click", (event) => {
  const output = document.getElementById("count");
  output.textContent = String(Number(output.textContent) + 1);
});
document.querySelectorAll("[data-push-state]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    history.pushState({}, "", link.getAttribute("href"));
    document.getElementById("location").textContent = location.pathname;
  });
});
document.getElementById("change-text")?.addEventListener("click", () => {
  document.getElementById("target").textContent = "Texte complètement différent";
});
document.getElementById("remove-target")?.addEventListener("click", () => {
  document.getElementById("target").remove();
});
if (document.body.dataset.slowConnector) {
  setTimeout(() => {
    const script = document.createElement("script");
    script.src = document.body.dataset.slowConnector;
    document.head.append(script);
  }, 13000);
}
`;

const PAGE_STYLE = `
body { font-family: sans-serif; margin: 1rem; }
#inner-scroll { height: 120px; overflow: auto; border: 1px solid #555; }
#inner-scroll .tall { height: 500px; }
.card { padding: 1rem; border: 1px solid #555; margin: 1rem 0; }
.spacer { height: 1200px; }
`;

const page = (title: string, body: string, options: { connector?: boolean; bodyAttributes?: string } = {}): string => `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="/style.css" />
    <script src="/page.js" defer></script>
    ${options.connector === false ? "" : CONNECTOR_TAG}
  </head>
  <body ${options.bodyAttributes ?? ""}>
    <main>
      <h1>${title}</h1>
      ${body}
    </main>
  </body>
</html>`;

const HOME_BODY = `
  <p id="location">/</p>
  <div class="card" data-testid="card">
    <h2>Commande</h2>
    <p><button id="counter" type="button">Ajouter au panier</button> <output id="count">0</output></p>
  </div>
  <form class="card">
    <label>Courriel <input name="email" type="email" value="secret-value@example.com" /></label>
    <label>Mot de passe <input name="password" type="password" value="secret-password" /></label>
    <label>Recherche <input aria-label="Rechercher une commande" value="secret-search" /></label>
  </form>
  <div id="inner-scroll">
    <div class="tall"><button type="button" data-testid="inner-button">Bouton interne</button></div>
  </div>
  <p><a data-push-state href="/second-page">Aller à la seconde page (sans recharger)</a></p>
  <p><a href="/second-page">Aller à la seconde page (avec rechargement)</a></p>
  <div class="spacer"></div>
  <p data-testid="far-element">Élément en bas de page</p>
`;

const SECOND_BODY = `
  <p id="location">/second-page</p>
  <p data-testid="second-element">Contenu de la seconde page</p>
  <p><a data-push-state href="/">Revenir à l'accueil (sans recharger)</a></p>
`;

const CHANGING_BODY = `
  <p id="target" data-testid="changing">Texte d'origine</p>
  <button id="change-text" type="button">Changer le texte</button>
  <button id="remove-target" type="button">Supprimer l'élément</button>
`;

const hasSession = (request: IncomingMessage): boolean =>
  (request.headers.cookie ?? "").split(";").some((cookie) => cookie.trim() === "session=valid");

const loginBody = (request: IncomingMessage): string =>
  hasSession(request)
    ? `<p id="status">Session active</p><p data-testid="account">Compte connecté</p>
       <form method="post" action="/logout"><button type="submit">Se déconnecter</button></form>`
    : `<p id="status">Non connecté</p>
       <form method="post" action="/login"><button type="submit">Se connecter</button></form>`;

const sendHtml = (response: ServerResponse, html: string, headers: Record<string, string> = PRODUCT_HEADERS): void => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...headers });
  response.end(html);
};

const handler = (request: IncomingMessage, response: ServerResponse): void => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  const method = request.method ?? "GET";

  if (method === "POST" && (pathname === "/login" || pathname === "/logout")) {
    response.writeHead(303, {
      Location: "/login",
      "Set-Cookie":
        pathname === "/login"
          ? "session=valid; HttpOnly; SameSite=Lax; Path=/"
          : "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    });
    response.end();
    return;
  }

  switch (pathname) {
    case "/health":
      response.writeHead(200).end("ok");
      return;
    case "/page.js":
      response.writeHead(200, { "Content-Type": "text/javascript" }).end(PAGE_SCRIPT);
      return;
    case "/style.css":
      response.writeHead(200, { "Content-Type": "text/css" }).end(PAGE_STYLE);
      return;
    case "/":
      sendHtml(response, page("Produit de démonstration", HOME_BODY));
      return;
    case "/second-page":
      sendHtml(response, page("Seconde page", SECOND_BODY));
      return;
    case "/no-connector":
      sendHtml(response, page("Page sans connecteur", `<p>Pas de script ici.</p>`, { connector: false }));
      return;
    case "/refuses-framing":
      sendHtml(response, page("Refus d'affichage", `<p>Non affichable.</p>`), { "X-Frame-Options": "DENY" });
      return;
    case "/slow-connector":
      sendHtml(
        response,
        page("Connecteur lent", `<p>Le script arrive après 13 secondes.</p>`, {
          connector: false,
          bodyAttributes: `data-slow-connector="${TOOL_ORIGIN}/connector.js"`,
        }),
      );
      return;
    case "/login":
      sendHtml(response, page("Connexion", loginBody(request)));
      return;
    case "/changing-content":
      sendHtml(response, page("Contenu changeant", CHANGING_BODY));
      return;
    case "/external-link":
      sendHtml(
        response,
        page("Lien externe", `<p><a id="external" href="http://other.fixture.localhost:3002/">Site hors liste</a></p>`),
      );
      return;
    default:
      response.writeHead(404).end("not found");
  }
};

createServer(handler).listen(3001, "0.0.0.0");
createServer(handler).listen(3002, "0.0.0.0");
