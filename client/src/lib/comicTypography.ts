const BASIC_COMIC_TEXT_RE =
  /^[\u0000-\u00ff\s.,!?'"():;\-+/&%#@*[\]{}<>_=|`~]*$/;

export function getComicTextFontStack(
  ...values: Array<string | null | undefined>
): string {
  const joined = values
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
    .join(" ");

  if (!joined || BASIC_COMIC_TEXT_RE.test(joined)) {
    return "'Bangers', 'Impact', 'Arial Black', sans-serif";
  }

  return "'Segoe UI', 'Arial Unicode MS', 'Noto Sans', 'Helvetica Neue', Arial, sans-serif";
}
