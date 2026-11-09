import { t } from "../../i18n/t.ts";
import { Alert } from "../../ui/index.ts";
import type { ProductConnection } from "./useProductConnection.ts";

interface ProductFrameProps {
  url: string;
  connection: ProductConnection;
}

export const ProductFrame = ({ url, connection }: ProductFrameProps) => (
  <div className="product-frame" data-testid="connection-state" data-state={connection.state}>
    {connection.state === "unresponsive" ? <Alert tone="error">{t("product.unresponsive")}</Alert> : null}
    <iframe
      ref={connection.frameRef}
      className="product-frame__iframe"
      src={url}
      title={t("product.frameTitle")}
      onLoad={connection.onFrameLoad}
    />
  </div>
);
