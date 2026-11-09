import type { ConnectorToToolMessage } from "@feedbacker/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFeedback } from "./api/feedbackClient.ts";
import { AnnotationToolbar } from "./features/annotation/AnnotationToolbar.tsx";
import { FeedbackForm, type SubmitOutcome } from "./features/annotation/FeedbackForm.tsx";
import { useAnnotationSession } from "./features/annotation/useAnnotationSession.ts";
import { AuthorDialog } from "./features/author/AuthorDialog.tsx";
import { useAuthorName } from "./features/author/useAuthorName.ts";
import { FeedbackList } from "./features/feedback-list/FeedbackList.tsx";
import { NavigationDialog } from "./features/feedback-list/NavigationDialog.tsx";
import { useFeedbackList, type FeedbackListState } from "./features/feedback-list/useFeedbackList.ts";
import { useFeedbackSelection } from "./features/feedback-list/useFeedbackSelection.ts";
import { ProductFrame } from "./features/product-frame/ProductFrame.tsx";
import { parseProductUrl } from "./features/product-frame/productUrl.ts";
import { useProductConnection } from "./features/product-frame/useProductConnection.ts";
import { t } from "./i18n/t.ts";
import { Alert, Button, Spinner } from "./ui/index.ts";
import "./layout.css";

interface WorkspaceProps {
  url: string;
  origin: string;
}

const Workspace = ({ url, origin }: WorkspaceProps) => {
  const { list, reload } = useFeedbackList(origin);
  if (list.status === "loading") return <Spinner label={t("common.loading")} />;
  if (list.status === "notAllowed") return <Alert tone="error">{t("product.notAllowed")}</Alert>;
  return <ConnectedWorkspace url={url} origin={origin} list={list} reload={reload} />;
};

interface ConnectedWorkspaceProps extends WorkspaceProps {
  list: FeedbackListState;
  reload: () => Promise<void>;
}

const ConnectedWorkspace = ({ url, origin, list, reload }: ConnectedWorkspaceProps) => {
  const author = useAuthorName();
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const nameRequestRef = useRef<((name: string | null) => void) | null>(null);
  const messageHandlerRef = useRef<(message: ConnectorToToolMessage) => void>(() => undefined);

  const onMessage = useCallback((message: ConnectorToToolMessage) => {
    messageHandlerRef.current(message);
  }, []);
  const connection = useProductConnection({ productOrigin: origin, onMessage });
  const { frameRef, send, state, path } = connection;
  const session = useAnnotationSession({ connectionState: state, send });
  const items = useMemo(() => (list.status === "ready" ? list.items : []), [list]);

  const navigate = useCallback(
    (targetPath: string) => {
      // Affectation directe : le changement doit avoir lieu même si l'iframe a déjà navigué ailleurs.
      if (frameRef.current) frameRef.current.src = `${origin}${targetPath}`;
    },
    [frameRef, origin],
  );
  const selection = useFeedbackSelection({ items, currentPath: path, connected: state === "connected", send, navigate });

  useEffect(() => {
    messageHandlerRef.current = (message) => {
      session.handleMessage(message);
      selection.handleMessage(message);
    };
  }, [selection.handleMessage, session.handleMessage]);

  const finishNameDialog = (name: string | null): void => {
    if (name) author.setName(name);
    setNameDialogOpen(false);
    nameRequestRef.current?.(name);
    nameRequestRef.current = null;
  };

  const askName = (): Promise<string | null> =>
    new Promise((resolve) => {
      nameRequestRef.current = resolve;
      setNameDialogOpen(true);
    });

  const submitDraft = async (body: string): Promise<SubmitOutcome> => {
    const { draft } = session;
    if (!draft) return "cancelled";
    const authorName = author.name ?? (await askName());
    if (!authorName) return "cancelled";
    const result = await createFeedback({
      id: draft.id,
      productOrigin: origin,
      pagePath: draft.path,
      body,
      authorName,
      anchor: draft.anchor,
      displayContext: draft.displayContext,
    });
    if (result.kind === "ok") {
      session.closeDraft();
      setSaved(true);
      await reload();
      return "saved";
    }
    return result.kind === "invalid" ? "invalid" : "failed";
  };

  const toggleAnnotation = (): void => {
    setSaved(false);
    session.toggle();
  };

  return (
    <div className="workspace">
      <section className="workspace__product">
        <AnnotationToolbar
          available={state === "connected"}
          busy={session.mode === "drafting"}
          picking={session.mode === "picking"}
          announcement={session.announcement}
          onToggle={toggleAnnotation}
          onMove={session.move}
          onConfirm={session.confirm}
          onCancel={session.cancel}
        />
        <ProductFrame url={url} connection={connection} />
      </section>
      <aside className="panel">
        <div className="panel__author">
          {author.name ? <span>{t("author.current", { name: author.name })}</span> : null}
          <Button
            onClick={() => {
              setNameDialogOpen(true);
            }}
          >
            {author.name ? t("author.modify") : t("author.define")}
          </Button>
        </div>
        {saved ? <Alert tone="info">{t("feedback.saved")}</Alert> : null}
        {session.draft ? (
          <FeedbackForm
            key={session.draft.id}
            elementDescription={session.draft.description}
            onSubmit={submitDraft}
            onCancel={session.closeDraft}
          />
        ) : null}
        <FeedbackList
          state={list}
          currentPath={path}
          statuses={selection.statuses}
          activeFeedbackId={selection.activeFeedbackId}
          onSelect={selection.select}
          onRetry={() => void reload()}
        />
      </aside>
      {selection.pendingNavigation ? (
        <NavigationDialog
          path={selection.pendingNavigation.pagePath}
          onConfirm={selection.confirmNavigation}
          onCancel={selection.declineNavigation}
        />
      ) : null}
      <AuthorDialog
        open={nameDialogOpen}
        initialName={author.name}
        onSubmit={finishNameDialog}
        onCancel={() => {
          finishNameDialog(null);
        }}
      />
    </div>
  );
};

export const App = () => {
  const product = useMemo(() => parseProductUrl(window.location.search), []);
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">{t("app.title")}</h1>
      </header>
      <main className="app__main">
        {product.kind === "missing" ? <Alert tone="error">{t("product.missingUrl")}</Alert> : null}
        {product.kind === "invalid" ? <Alert tone="error">{t("product.invalidUrl")}</Alert> : null}
        {product.kind === "valid" ? <Workspace url={product.url} origin={product.origin} /> : null}
      </main>
    </div>
  );
};
