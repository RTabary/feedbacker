import { AuthorName } from "@feedbacker/contracts";
import { useCallback, useState } from "react";

const STORAGE_KEY = "feedbacker.authorName";

const readStoredName = (): string | null => {
  try {
    const parsed = AuthorName.safeParse(window.localStorage.getItem(STORAGE_KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    // Stockage bloqué (navigation privée, données de site interdites) : le nom sera redemandé.
    return null;
  }
};

export const useAuthorName = () => {
  const [name, setStateName] = useState<string | null>(readStoredName);

  const setName = useCallback((value: string) => {
    setStateName(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Le nom reste connu pour cette page, sans être mémorisé sur l'appareil.
    }
  }, []);

  return { name, setName };
};
