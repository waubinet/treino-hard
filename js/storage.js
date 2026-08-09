(function initStorage(global) {
  'use strict';

  const Core = global.THFCore;
  const DB_NAME = 'treino-hard-v3';
  const DB_VERSION = 1;
  const DOCUMENT_STORE = 'documents';
  const SNAPSHOT_STORE = 'snapshots';
  const BACKUP_STORE = 'automaticBackups';
  const RECOVERY_STORE = 'migrationRecovery';
  const DOCUMENT_KEY = 'current';
  const FALLBACK_KEY = 'treinohard_document_v11';
  const FALLBACK_STAGING_KEY = 'treinohard_document_v11_staging';
  const FALLBACK_SNAPSHOT_KEY = 'treinohard_snapshot_v11';
  const LEGACY_KEYS = Object.freeze({
    data: 'jovilite_data',
    meta: 'jovilite_session_meta',
    archives: 'jovilite_cycle_archives',
    cycleStartedAt: 'jovilite_cycle_started',
    measurements: 'jovilite_body_measurements',
    settings: 'jovilite_settings',
    week: 'jovilite_week',
    session: 'jovilite_session',
    tab: 'jovilite_tab',
    autoBackups: 'jovilite_auto_backups',
    recovery: 'jovilite_recovery'
  });

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Falha no IndexedDB.'));
    });
  }

  function transactionPromise(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Falha na transação do IndexedDB.'));
      transaction.onabort = () => reject(transaction.error || new Error('Transação do IndexedDB cancelada.'));
    });
  }

  function parseJson(text, fallback) {
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text);
      if (Core.hasForbiddenKey(parsed)) throw new Error('Chave proibida.');
      return parsed;
    } catch (error) {
      return fallback;
    }
  }

  class AppStorage {
    constructor() {
      this.db = null;
      this.mode = 'memory';
      this.memory = null;
      this.lastError = '';
      this.migrationRecovery = null;
      this.channel = null;
      this.onExternalChange = null;
      this.writeBlocked = false;
    }

    async init() {
      if ('BroadcastChannel' in global) {
        this.channel = new BroadcastChannel('treino-hard-state');
        this.channel.addEventListener('message', event => {
          if (event.data && event.data.type === 'state-updated' && typeof this.onExternalChange === 'function') {
            this.onExternalChange(event.data);
          }
        });
      }
      if ('indexedDB' in global) {
        try {
          this.db = await this.openDatabase();
          this.mode = 'indexeddb';
        } catch (error) {
          this.lastError = `IndexedDB indisponível: ${error.message || error}`;
        }
      }
      if (this.mode !== 'indexeddb' && this.canUseLocalStorage()) this.mode = 'localstorage';
      let state = await this.readDocument();
      if (!state) {
        if (this.writeBlocked) {
          const readOnlyState = Core.defaultState();
          readOnlyState.quarantine.push({
            at: new Date().toISOString(),
            reason: this.lastError || 'Documento local incompatível; modo somente leitura.',
            raw: ''
          });
          return Core.normalizeState(readOnlyState);
        }
        const legacy = this.readLegacyPayload();
        if (!legacy && this.writeBlocked) {
          const readOnlyState = Core.defaultState();
          readOnlyState.quarantine.push({
            at: new Date().toISOString(),
            reason: this.lastError || 'Fonte local de versão futura; modo somente leitura.',
            raw: ''
          });
          return Core.normalizeState(readOnlyState);
        }
        if (legacy) {
          state = Core.migratePayload(legacy.payload);
          state.migrationLog.push({
            at: new Date().toISOString(),
            from: legacy.payload.schemaVersion || 1,
            to: Core.SCHEMA_VERSION,
            summary: 'Migração automática das chaves jovilite_*; a fonte bruta foi preservada para recuperação.'
          });
          this.migrationRecovery = legacy.raw;
          await this.saveRecovery(legacy.raw);
          await this.importLegacyAutomaticBackups(legacy.payload.autoBackups);
        } else {
          state = Core.defaultState();
        }
        state = await this.writeDocument(state, null, {skipConflict: true});
      }
      return Core.normalizeState(state);
    }

    openDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(DOCUMENT_STORE)) database.createObjectStore(DOCUMENT_STORE);
          if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) database.createObjectStore(SNAPSHOT_STORE, {keyPath: 'id'});
          if (!database.objectStoreNames.contains(BACKUP_STORE)) database.createObjectStore(BACKUP_STORE, {keyPath: 'id'});
          if (!database.objectStoreNames.contains(RECOVERY_STORE)) database.createObjectStore(RECOVERY_STORE, {keyPath: 'id'});
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Não foi possível abrir o banco local.'));
        request.onblocked = () => reject(new Error('A atualização do banco foi bloqueada por outra aba.'));
      });
    }

    canUseLocalStorage() {
      try {
        const key = 'treino-hard-storage-test';
        localStorage.setItem(key, '1');
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        this.lastError = `Armazenamento local indisponível: ${error.message || error}`;
        return false;
      }
    }

    async readDocument() {
      try {
        if (this.mode === 'indexeddb') {
          const transaction = this.db.transaction(DOCUMENT_STORE, 'readonly');
          const result = await requestPromise(transaction.objectStore(DOCUMENT_STORE).get(DOCUMENT_KEY));
          if (result && Number(result.schemaVersion) > Core.SCHEMA_VERSION) {
            this.writeBlocked = true;
            throw new Error('Documento local criado por versão futura; o aplicativo entrou em modo somente leitura e não gravou nada.');
          }
          return result ? Core.normalizeState(result) : null;
        }
        if (this.mode === 'localstorage') {
          const text = localStorage.getItem(FALLBACK_KEY);
          if (!text) return null;
          const parsed = JSON.parse(text);
          if (Number(parsed.schemaVersion) > Core.SCHEMA_VERSION) {
            this.writeBlocked = true;
            throw new Error('Documento local criado por versão futura; o aplicativo entrou em modo somente leitura e não gravou nada.');
          }
          return Core.normalizeState(parsed);
        }
        return this.memory ? Core.normalizeState(this.memory) : null;
      } catch (error) {
        this.lastError = error.message || String(error);
        if (!this.writeBlocked) await this.saveRecovery({id: Core.uid('corrupt'), savedAt: new Date().toISOString(), reason: this.lastError, raw: this.rawCurrentDocument()});
        return null;
      }
    }

    rawCurrentDocument() {
      try {
        return this.mode === 'localstorage' ? String(localStorage.getItem(FALLBACK_KEY) || '') : '';
      } catch (error) {
        return '';
      }
    }

    async writeDocument(state, expectedRevision, options) {
      if (this.writeBlocked) throw new Error('A gravação está bloqueada para preservar um documento criado por versão futura.');
      const settings = options || {};
      const normalized = Core.touchState(state);
      try {
        if (this.mode === 'indexeddb') {
          const transaction = this.db.transaction(DOCUMENT_STORE, 'readwrite');
          const store = transaction.objectStore(DOCUMENT_STORE);
          const current = await requestPromise(store.get(DOCUMENT_KEY));
          if (!settings.skipConflict && current && Number(current.revision) !== Number(expectedRevision)) {
            transaction.abort();
            const conflict = new Error('Outra aba alterou os dados. Recarregue antes de salvar novamente.');
            conflict.code = 'REVISION_CONFLICT';
            throw conflict;
          }
          store.put(normalized, DOCUMENT_KEY);
          await transactionPromise(transaction);
        } else if (this.mode === 'localstorage') {
          const currentText = localStorage.getItem(FALLBACK_KEY);
          const current = currentText ? parseJson(currentText, null) : null;
          if (!settings.skipConflict && current && Number(current.revision) !== Number(expectedRevision)) {
            const conflict = new Error('Outra aba alterou os dados. Recarregue antes de salvar novamente.');
            conflict.code = 'REVISION_CONFLICT';
            throw conflict;
          }
          const text = JSON.stringify(normalized);
          localStorage.setItem(FALLBACK_STAGING_KEY, text);
          const verified = JSON.parse(localStorage.getItem(FALLBACK_STAGING_KEY));
          if (verified.schemaVersion !== Core.SCHEMA_VERSION || verified.revision !== normalized.revision) throw new Error('A verificação da gravação local falhou.');
          localStorage.setItem(FALLBACK_KEY, text);
          localStorage.removeItem(FALLBACK_STAGING_KEY);
        } else {
          this.memory = Core.deepClone(normalized);
        }
        this.lastError = '';
        if (this.channel) this.channel.postMessage({type: 'state-updated', revision: normalized.revision, updatedAt: normalized.updatedAt});
        return normalized;
      } catch (error) {
        this.lastError = error.message || String(error);
        throw error;
      }
    }

    async save(state) {
      return this.writeDocument(state, state.revision, {});
    }

    async createSnapshot(state, reason) {
      const snapshot = {
        id: Core.uid('snapshot'),
        savedAt: new Date().toISOString(),
        reason: Core.cleanText(reason, 300),
        state: Core.normalizeState(state)
      };
      if (this.mode === 'indexeddb') {
        const transaction = this.db.transaction(SNAPSHOT_STORE, 'readwrite');
        transaction.objectStore(SNAPSHOT_STORE).put(snapshot);
        await transactionPromise(transaction);
      } else if (this.mode === 'localstorage') {
        localStorage.setItem(FALLBACK_SNAPSHOT_KEY, JSON.stringify(snapshot));
      } else {
        this.memorySnapshot = snapshot;
      }
      return snapshot;
    }

    async latestSnapshot() {
      if (this.mode === 'indexeddb') {
        const transaction = this.db.transaction(SNAPSHOT_STORE, 'readonly');
        const all = await requestPromise(transaction.objectStore(SNAPSHOT_STORE).getAll());
        return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] || null;
      }
      if (this.mode === 'localstorage') return parseJson(localStorage.getItem(FALLBACK_SNAPSHOT_KEY), null);
      return this.memorySnapshot || null;
    }

    async restoreLatestSnapshot(currentState) {
      const snapshot = await this.latestSnapshot();
      if (!snapshot || !snapshot.state) throw new Error('Nenhum snapshot válido está disponível.');
      const restored = Core.normalizeState(snapshot.state);
      restored.revision = currentState.revision;
      return this.writeDocument(restored, currentState.revision, {});
    }

    async automaticBackup(state, force) {
      const day = Core.localDateKey();
      const id = `auto-${day}`;
      if (this.mode === 'indexeddb') {
        const transaction = this.db.transaction(BACKUP_STORE, 'readwrite');
        const store = transaction.objectStore(BACKUP_STORE);
        const existing = await requestPromise(store.get(id));
        if (existing && !force) {
          transaction.abort();
          return false;
        }
        store.put({id, savedAt: new Date().toISOString(), state: Core.normalizeState(state)});
        await transactionPromise(transaction);
        await this.trimBackups();
        return true;
      }
      if (this.mode === 'localstorage') {
        const key = 'treinohard_auto_backups_v11';
        const backups = parseJson(localStorage.getItem(key), []);
        if (backups.some(item => item.id === id) && !force) return false;
        const next = backups.filter(item => item.id !== id).concat({id, savedAt: new Date().toISOString(), state: Core.normalizeState(state)}).slice(-3);
        localStorage.setItem(key, JSON.stringify(next));
        return true;
      }
      return false;
    }

    async trimBackups() {
      if (this.mode !== 'indexeddb') return;
      const transaction = this.db.transaction(BACKUP_STORE, 'readwrite');
      const store = transaction.objectStore(BACKUP_STORE);
      const all = await requestPromise(store.getAll());
      const ordered = all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      ordered.slice(3).forEach(item => store.delete(item.id));
      await transactionPromise(transaction);
    }

    async listBackups() {
      if (this.mode === 'indexeddb') {
        const transaction = this.db.transaction(BACKUP_STORE, 'readonly');
        return (await requestPromise(transaction.objectStore(BACKUP_STORE).getAll())).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      }
      if (this.mode === 'localstorage') return parseJson(localStorage.getItem('treinohard_auto_backups_v11'), []).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      return [];
    }

    async restoreBackup(id, currentState) {
      const backup = (await this.listBackups()).find(item => item.id === id);
      if (!backup) throw new Error('Cópia automática não encontrada.');
      await this.createSnapshot(currentState, 'Antes de restaurar cópia automática');
      const restored = Core.normalizeState(backup.state);
      restored.revision = currentState.revision;
      return this.writeDocument(restored, currentState.revision, {});
    }

    readLegacyPayload() {
      if (!this.canUseLocalStorage()) return null;
      const raw = {};
      Object.entries(LEGACY_KEYS).forEach(([name, key]) => {
        const value = localStorage.getItem(key);
        if (value != null) raw[name] = value;
      });
      if (!raw.data && !raw.measurements && !raw.archives) return null;
      let parsedData = parseJson(raw.data, {});
      const wrapped = Core.isRecord(parsedData) && Object.prototype.hasOwnProperty.call(parsedData, 'schemaVersion');
      const sourceVersion = wrapped ? Number(parsedData.schemaVersion) || 1 : 1;
      if (sourceVersion > Core.SCHEMA_VERSION) {
        this.lastError = 'Dados locais de uma versão futura foram preservados e não serão regravados.';
        this.writeBlocked = true;
        return null;
      }
      const payload = {
        app: Core.APP_ID,
        schemaVersion: sourceVersion,
        data: wrapped ? parsedData.data : parsedData,
        meta: parseJson(raw.meta, {}),
        archives: parseJson(raw.archives, []),
        cycleStartedAt: raw.cycleStartedAt || '',
        measurements: parseJson(raw.measurements, []),
        settings: parseJson(raw.settings, {}),
        autoBackups: parseJson(raw.autoBackups, [])
      };
      return {
        payload,
        raw: {
          id: Core.uid('legacy-source'),
          savedAt: new Date().toISOString(),
          reason: 'Fonte local anterior ao schema 11, preservada antes da migração.',
          sourceSchemaVersion: sourceVersion,
          rawLocalStorage: raw
        }
      };
    }

    async importLegacyAutomaticBackups(items) {
      const backups = Array.isArray(items) ? items.slice(-3) : [];
      if (!backups.length) return;
      const converted = [];
      backups.forEach((backup, index) => {
        if (!Core.isRecord(backup)) return;
        try {
          const state = Core.migratePayload(Object.assign({app: Core.APP_ID, schemaVersion: 9}, backup));
          converted.push({
            id: `legacy-auto-${Core.cleanId(backup.day || backup.id, String(index + 1))}`,
            savedAt: Core.validIso(backup.savedAt) || new Date().toISOString(),
            state,
            legacy: true
          });
        } catch (error) {
          this.lastError = `Uma cópia automática antiga ficou apenas na recuperação bruta: ${error.message || error}`;
        }
      });
      if (!converted.length) return;
      if (this.mode === 'indexeddb') {
        const transaction = this.db.transaction(BACKUP_STORE, 'readwrite');
        const store = transaction.objectStore(BACKUP_STORE);
        converted.forEach(item => store.put(item));
        await transactionPromise(transaction);
      } else if (this.mode === 'localstorage') {
        const key = 'treinohard_auto_backups_v11';
        const current = parseJson(localStorage.getItem(key), []);
        const ids = new Set(converted.map(item => item.id));
        localStorage.setItem(key, JSON.stringify(current.filter(item => !ids.has(item.id)).concat(converted).slice(-3)));
      }
    }

    async saveRecovery(recovery) {
      if (!recovery) return;
      const item = Object.assign({id: Core.uid('recovery'), savedAt: new Date().toISOString(), reason: 'Recuperação local'}, recovery);
      try {
        if (this.mode === 'indexeddb' && this.db) {
          const transaction = this.db.transaction(RECOVERY_STORE, 'readwrite');
          transaction.objectStore(RECOVERY_STORE).put(item);
          await transactionPromise(transaction);
        } else if (this.canUseLocalStorage()) {
          localStorage.setItem('treinohard_recovery_v11', JSON.stringify(item));
        } else {
          this.migrationRecovery = item;
        }
      } catch (error) {
        this.lastError = `Não foi possível preservar a recuperação: ${error.message || error}`;
      }
    }

    async getRecoveryItems() {
      if (this.mode === 'indexeddb') {
        const transaction = this.db.transaction(RECOVERY_STORE, 'readonly');
        return (await requestPromise(transaction.objectStore(RECOVERY_STORE).getAll())).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
      }
      if (this.mode === 'localstorage') {
        const item = parseJson(localStorage.getItem('treinohard_recovery_v11'), null);
        return item ? [item] : [];
      }
      return this.migrationRecovery ? [this.migrationRecovery] : [];
    }

    close() {
      if (this.channel) this.channel.close();
      if (this.db) this.db.close();
    }
  }

  global.THFStorage = Object.freeze({
    AppStorage,
    DB_NAME,
    DB_VERSION,
    FALLBACK_KEY,
    LEGACY_KEYS,
    parseJson
  });
})(globalThis);
