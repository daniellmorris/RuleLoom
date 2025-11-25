export const nanoid = (size = 8): string =>
  Array.from({ length: size }, () => Math.floor(Math.random() * 36).toString(36)).join("");
