import './commands';

// Suppress uncaught exception noise from the app during tests
Cypress.on('uncaught:exception', () => false);
