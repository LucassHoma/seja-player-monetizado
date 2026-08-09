/**
 * Player Monetizado — Configuração central
 */
window.PM_CONFIG = {
  /** URL canônica do site (sem barra final) */
  siteUrl: 'https://playermonetizado.com.br',

  /** Prefixo do site em subpastas (ex.: GitHub Pages). Deixe vazio na raiz do domínio. */
  siteBasePath: '',

  /** Link de checkout Kiwify */
  checkoutUrl: 'https://pay.kiwify.com.br/4Q3618c',

  /** E-mail de contato */
  contactEmail: 'playermonetizado@gmail.com',
  contactPhone: '5511995791061',

  /** Meta Pixel ID (ex.: '123456789012345') — deixe vazio para desativar */
  metaPixelId: '',

  /** Google Analytics 4 ID (ex.: 'G-XXXXXXXXXX') — deixe vazio para desativar */
  ga4Id: '',

  /**
   * URL pública do CMS no Google Apps Script (JSONP).
   * Após publicar o Web App, cole aqui (veja gas/SETUP.md):
   * 'https://script.google.com/macros/s/SEU_ID/exec?action=content'
   * Depois: npm run build:assets → commit → deploy
   */
  gasContentUrl: '?action=content'
};
