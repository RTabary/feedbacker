import * as z from "zod/mini";

/** Nombre de points de code : même unité que `char_length` côté PostgreSQL. */
export const codePointLength = (value: string): number => Array.from(value).length;

const isStorable = (value: string): boolean => !value.includes("\u0000") && value.isWellFormed();

const lengthCheck = (min: number, max: number) =>
  z.refine<string>((value) => {
    const length = codePointLength(value);
    return length >= min && length <= max;
  });

/**
 * Chaîne acceptée par PostgreSQL : sans NUL ni surrogat isolé (rejetés en `text` et en `jsonb`,
 * ce qui provoquerait sinon une erreur 500). Voir research.md R14.
 */
export const safeText = (max: number, min = 0) =>
  z.string().check(z.refine<string>(isStorable), lengthCheck(min, max));

/** Comme `safeText`, après suppression des espaces de début et de fin. */
export const trimmedText = (max: number, min = 1) =>
  z.string().check(z.trim(), z.refine<string>(isStorable), lengthCheck(min, max));
