/**
 * Electus – Schnellbewerbung Sandbox Script
 * Phase 1: Verbindung testen (KEINE Logik)
 */
(function () {
  // === SANDBOX GATE ===
  // ⚠️ Passe den Slug an, falls er anders heißt
  if (!location.pathname.includes('/sb-sandbox')) {
    return; // Nicht Sandbox → Script tut absolut nichts
  }

  // === VISUELLER BEWEIS ===
  console.log(
    '%c[SB SANDBOX] electus-sb.js geladen',
    'background:#0aa; color:#fff; padding:4px 8px; border-radius:4px;'
  );

  // kleine sichtbare Markierung im DOM (nur Sandbox)
  try {
    const badge = document.createElement('div');
    badge.textContent = 'SB SANDBOX SCRIPT AKTIV';
    badge.style.position = 'fixed';
    badge.style.bottom = '12px';
    badge.style.right = '12px';
    badge.style.zIndex = '99999';
    badge.style.background = '#0aa';
    badge.style.color = '#fff';
    badge.style.padding = '6px 10px';
    badge.style.fontSize = '12px';
    badge.style.borderRadius = '6px';
    badge.style.fontFamily = 'system-ui, sans-serif';
    document.body.appendChild(badge);
  } catch (e) {}
})();
