/**
 * SANDA PRO — shared.js
 * Module commun chargé par toutes les interfaces.
 * Fournit :
 *  - SP.store  : lecture/écriture localStorage avec guard
 *  - SP.bc     : BroadcastChannel pour sync instantanée inter-onglets
 *  - SP.toast  : système de notifications sans injection CSS répétée
 *  - SP.modal  : remplacement de confirm() natif
 *  - SP.onSync : abonnement aux changements (BC + storage event)
 */

(function(global) {
  'use strict';

  // ── STORAGE GUARD ─────────────────────────────────
  let _storageOk = true;
  try {
    const k = '__sp_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
  } catch(e) {
    _storageOk = false;
    const w = document.getElementById('sp-storage-warning');
    if (w) w.style.display = 'block';
    console.warn('[SANDA PRO] localStorage indisponible — mode privé ?');
  }

  const store = {
    get(key) {
      if (!_storageOk) return null;
      try { return JSON.parse(localStorage.getItem(key) || 'null'); }
      catch(e) { return null; }
    },
    set(key, value) {
      if (!_storageOk) return false;
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch(e) { return false; }
    },
    remove(key) {
      if (!_storageOk) return;
      try { localStorage.removeItem(key); } catch(e) {}
    }
  };

  // ── BROADCAST CHANNEL ──────────────────────────────
  // Sync instantanée entre onglets du même navigateur.
  // Fallback : storage event (cross-origin/appareils différents).
  let _bc = null;
  try {
    if ('BroadcastChannel' in window) {
      _bc = new BroadcastChannel('sanda_pro_sync');
    }
  } catch(e) {}

  const _listeners = [];

  function _dispatch(key, value) {
    _listeners.forEach(fn => {
      try { fn(key, value); } catch(e) {}
    });
  }

  // BroadcastChannel inbound
  if (_bc) {
    _bc.onmessage = (evt) => {
      const { key, value } = evt.data || {};
      if (key) _dispatch(key, value);
    };
  }

  // Storage event (multi-appareils réseau, ou onglets sans BC)
  window.addEventListener('storage', (e) => {
    if (e.key && e.newValue !== null) {
      try {
        _dispatch(e.key, JSON.parse(e.newValue));
      } catch(_) {}
    }
  });

  const bc = {
    /** Publie une mise à jour : écrit dans localStorage ET broadcast BC */
    publish(key, value) {
      store.set(key, value);
      if (_bc) {
        try { _bc.postMessage({ key, value }); } catch(e) {}
      }
    }
  };

  /**
   * S'abonner aux synchronisations.
   * @param {function(key: string, value: any): void} fn
   */
  function onSync(fn) {
    _listeners.push(fn);
  }

  // ── TOAST ──────────────────────────────────────────
  // Injecte le container une seule fois dans le DOM.
  let _toastContainer = null;

  function _ensureToastContainer() {
    if (_toastContainer) return;
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'sp-toast-container';
    document.body.appendChild(_toastContainer);
  }

  /**
   * Affiche une notification toast.
   * @param {string} message
   * @param {string} [color='var(--acc)']  — couleur de fond CSS
   * @param {string} [textColor='#000']
   * @param {number} [duration=3000]
   */
  function toast(message, color = 'var(--acc)', textColor = '#000', duration = 3000) {
    _ensureToastContainer();
    const el = document.createElement('div');
    el.className = 'sp-toast';
    el.textContent = message;
    el.style.background = color;
    el.style.color = textColor;
    _toastContainer.appendChild(el);

    setTimeout(() => {
      el.classList.add('exiting');
      setTimeout(() => el.remove(), 280);
    }, duration);
  }

  // ── MODAL (remplace confirm()) ─────────────────────
  let _backdrop = null;
  let _resolveModal = null;

  function _ensureModal() {
    if (_backdrop) return;
    _backdrop = document.createElement('div');
    _backdrop.id = 'sp-modal-backdrop';
    _backdrop.innerHTML = `
      <div class="sp-modal">
        <div class="sp-modal-icon" id="sp-modal-icon">⚠️</div>
        <div class="sp-modal-title" id="sp-modal-title">Confirmer</div>
        <div class="sp-modal-body" id="sp-modal-body"></div>
        <div class="sp-modal-actions">
          <button class="sp-modal-btn sp-modal-btn-cancel" id="sp-modal-cancel">ANNULER</button>
          <button class="sp-modal-btn sp-modal-btn-confirm" id="sp-modal-confirm">CONFIRMER</button>
        </div>
      </div>`;
    document.body.appendChild(_backdrop);

    document.getElementById('sp-modal-cancel').addEventListener('click', () => {
      _closeModal(false);
    });
    document.getElementById('sp-modal-confirm').addEventListener('click', () => {
      _closeModal(true);
    });
    _backdrop.addEventListener('click', (e) => {
      if (e.target === _backdrop) _closeModal(false);
    });
  }

  function _closeModal(result) {
    if (_backdrop) _backdrop.classList.remove('open');
    if (_resolveModal) { _resolveModal(result); _resolveModal = null; }
  }

  /**
   * Modal de confirmation async.
   * @param {object} opts
   * @param {string} opts.title
   * @param {string} opts.body
   * @param {string} [opts.icon='⚠️']
   * @param {string} [opts.confirmLabel='CONFIRMER']
   * @param {string} [opts.confirmClass='']  ex: 'acc' pour vert
   * @returns {Promise<boolean>}
   */
  function confirm({ title, body, icon = '⚠️', confirmLabel = 'CONFIRMER', confirmClass = '' } = {}) {
    _ensureModal();
    document.getElementById('sp-modal-icon').textContent = icon;
    document.getElementById('sp-modal-title').textContent = title || 'Confirmer';
    document.getElementById('sp-modal-body').textContent = body || '';
    const btn = document.getElementById('sp-modal-confirm');
    btn.textContent = confirmLabel;
    btn.className = 'sp-modal-btn sp-modal-btn-confirm' + (confirmClass ? ' ' + confirmClass : '');
    _backdrop.classList.add('open');
    return new Promise(resolve => { _resolveModal = resolve; });
  }

  // ── STORAGE WARNING BANNER ─────────────────────────
  function _injectStorageWarning() {
    if (document.getElementById('sp-storage-warning')) return;
    const el = document.createElement('div');
    el.id = 'sp-storage-warning';
    el.textContent = '⚠ STOCKAGE INDISPONIBLE — Mode privé détecté. Les données ne seront pas sauvegardées.';
    document.body.prepend(el);
    if (!_storageOk) el.style.display = 'block';
  }

  // Initialisation au chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectStorageWarning);
  } else {
    _injectStorageWarning();
  }

  // ── EXPORT ────────────────────────────────────────
  global.SP = { store, bc, onSync, toast, confirm };

})(window);
