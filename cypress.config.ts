import { defineConfig } from 'cypress';
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor';
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';

export default defineConfig({
  viewportWidth:  1280,
  viewportHeight: 800,
  video:          false,
  defaultCommandTimeout: 8000,
  responseTimeout:       30000,

  e2e: {
    baseUrl:     'http://localhost:3000',
    specPattern: 'cypress/e2e/features/**/*.feature',

    async setupNodeEvents(on, config) {
      await addCucumberPreprocessorPlugin(on, config);
      on('file:preprocessor', createBundler({
        plugins: [createEsbuildPlugin(config)],
      }));
      return config;
    },
  },
});
