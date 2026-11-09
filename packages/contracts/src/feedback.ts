import * as z from "zod/mini";
import { safeText, trimmedText } from "./text.ts";

export const BODY_MAX_LENGTH = 5000;
export const AUTHOR_NAME_MAX_LENGTH = 100;
export const TEXT_EXCERPT_MAX_LENGTH = 120;

// `new URL` accepte `*` et `;` dans un nom d'hôte : ils changeraient le sens de la CSP `frame-src`.
const ORIGIN_SHAPE = /^https?:\/\/(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(:\d+)?$/;

const isCanonicalWebOrigin = (value: string): boolean =>
  ORIGIN_SHAPE.test(value) && URL.canParse(value) && new URL(value).origin === value;

export const ProductOrigin = z.string().check(z.refine<string>(isCanonicalWebOrigin));
export type ProductOrigin = z.infer<typeof ProductOrigin>;

export const PagePath = safeText(2048, 1).check(z.refine<string>((value) => value.startsWith("/")));
export type PagePath = z.infer<typeof PagePath>;

const finiteNumber = z.number();
const nonNegativeNumber = z.number().check(z.gte(0));

export const Anchor = z.object({
  selector: safeText(4000, 1),
  tagName: safeText(64, 1).check(z.refine<string>((value) => value === value.toLowerCase())),
  textExcerpt: safeText(TEXT_EXCERPT_MAX_LENGTH),
  rect: z.object({
    x: finiteNumber,
    y: finiteNumber,
    width: nonNegativeNumber,
    height: nonNegativeNumber,
  }),
});
export type Anchor = z.infer<typeof Anchor>;

const positiveInteger = z.int().check(z.gt(0));

export const DisplayContext = z.object({
  viewportWidth: positiveInteger,
  viewportHeight: positiveInteger,
  scrollX: finiteNumber,
  scrollY: finiteNumber,
});
export type DisplayContext = z.infer<typeof DisplayContext>;

export const FeedbackBody = trimmedText(BODY_MAX_LENGTH);
export const AuthorName = trimmedText(AUTHOR_NAME_MAX_LENGTH);

export const CreateFeedbackRequest = z.object({
  id: z.uuid(),
  productOrigin: ProductOrigin,
  pagePath: PagePath,
  body: FeedbackBody,
  authorName: AuthorName,
  anchor: Anchor,
  displayContext: DisplayContext,
});
export type CreateFeedbackRequest = z.infer<typeof CreateFeedbackRequest>;

export const Feedback = z.object({
  id: z.uuid(),
  productOrigin: ProductOrigin,
  pagePath: PagePath,
  body: FeedbackBody,
  authorName: AuthorName,
  anchor: Anchor,
  displayContext: DisplayContext,
  createdAt: z.iso.datetime(),
});
export type Feedback = z.infer<typeof Feedback>;

export const ListFeedbackQuery = z.object({ origin: ProductOrigin });
export const ListFeedbackResponse = z.object({ items: z.array(Feedback) });
export type ListFeedbackResponse = z.infer<typeof ListFeedbackResponse>;

export const ApiErrorCode = z.enum(["VALIDATION_ERROR", "ORIGIN_NOT_ALLOWED", "INTERNAL_ERROR"]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiError = z.object({
  code: ApiErrorCode,
  issues: z.optional(z.array(z.object({ path: z.string(), code: z.string() }))),
});
export type ApiError = z.infer<typeof ApiError>;
