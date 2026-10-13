import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Los tests de reglas comparten el emulador: se corren en serie.
    fileParallelism: false,
  },
});
