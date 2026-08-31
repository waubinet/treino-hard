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
  // O nome do lock é deliberadamente independente do esquema: abas ainda
  // abertas de versões diferentes precisam disputar a mesma exclusão mútua.
  const FALLBACK_WRITE_LOCK = 'treino-hard-storage-write';
  const FALLBACK_TRANSACTION_FORMAT = 'treino-hard-local-transaction-v1';
  const FALLBACK_SNAPSHOT_KEY = 'treinohard_snapshot_v11';
  const FALLBACK_BACKUP_KEY = 'treinohard_auto_backups_v11';
  const FALLBACK_RECOVERY_KEY = 'treinohard_recovery_v11';
  const FALLBACK_RECOVERY_FORMAT = 'treino-hard-recovery-list-v1';
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

  function parseJsonStrict(text) {
    const parsed = JSON.parse(text);
    if (Core.hasForbiddenKey(parsed)) throw new Error('Chave proibida.');
    return parsed;
  }

  function isValidBackupItem(item) {
    if (!Core.isRecord(item) || !Core.cleanId(item.id, '') || !Core.validIso(item.savedAt) || !Core.isRecord(item.state)) return false;
    try {
      Core.assertCurrentStateStructure(item.state);
      return true;
    } catch (error) {
      return false;
    }
  }

  function isValidSnapshotItem(item) {
    if (!Core.isRecord(item) || !Core.cleanId(item.id, '') || !Core.validIso(item.savedAt) || !Core.isRecord(item.state)) return false;
    try {
      Core.assertCurrentStateStructure(item.state);
      return true;
    } catch (error) {
      return false;
    }
  }

  function backupRecoveryItem(raw, reason) {
    return {
      id: Core.uid('invalid-backup'),
      savedAt: new Date().toISOString(),
      reason,
      raw
    };
  }

  function isRecognizedRecoveryContainer(value) {
    if (Array.isArray(value)) return value.every(Core.isRecord);
    if (Core.isRecord(value) && value.format === FALLBACK_RECOVERY_FORMAT && Array.isArray(value.items)) {
      return value.items.every(Core.isRecord);
    }
    return Core.isRecord(value) && Boolean(value.id);
  }

  function recoveryItemsFromStored(value) {
    if (Array.isArray(value)) return value.filter(Core.isRecord);
    if (Core.isRecord(value) && value.format === FALLBACK_RECOVERY_FORMAT && Array.isArray(value.items)) {
      return value.items.filter(Core.isRecord);
    }
    return Core.isRecord(value) && value.id ? [value] : [];
  }

  async function rawHash(raw) {
    const subtle = global.crypto && global.crypto.subtle;
    if (!subtle || typeof subtle.digest !== 'function' || typeof global.TextEncoder !== 'function') {
      throw new Error('SHA-256 indisponível para validar a transação local.');
    }
    const marker = raw === null ? 'absent:' : `present:${raw}`;
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(marker));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
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
      this.preservedPrimaryRaw = null;
      this.localWriteLockDepth = 0;
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
      if (this.mode === 'memory') {
        this.writeBlocked = true;
        this.lastError = 'Nenhum armazenamento persistente está disponível neste navegador. O aplicativo permaneceu somente leitura para não informar como salvos dados que desapareceriam ao fechar a página.';
      }
      if (this.mode === 'localstorage' && this.hasLocalStorageWriteLock()) {
        try {
          await this.withLocalStorageWriteLock(() => this.reconcileLocalStorageStaging(), {allowBlocked: true});
        } catch (error) {
          this.writeBlocked = true;
          this.lastError = error.message || String(error);
        }
      }
      let state = await this.readDocument();
      if (this.mode === 'localstorage' && !this.hasLocalStorageWriteLock() && !this.writeBlocked) {
        this.writeBlocked = true;
        this.lastError = 'Este navegador não oferece o bloqueio entre abas necessário para gravar com segurança no armazenamento de contingência. O aplicativo permaneceu somente leitura para evitar sobrescritas.';
        if (state) return Core.normalizeState(state);
      }
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
          const recoverySaved = await this.saveRecovery(legacy.raw);
          if (!recoverySaved) {
            this.writeBlocked = true;
            const readOnlyState = Core.defaultState();
            readOnlyState.quarantine.push({
              at: new Date().toISOString(),
              reason: this.lastError || 'A fonte anterior não pôde ser preservada; modo somente leitura.',
              raw: ''
            });
            return Core.normalizeState(readOnlyState);
          }
          await this.importLegacyAutomaticBackups(legacy.payload.autoBackups);
        } else {
          state = Core.defaultState();
        }
        try {
          state = await this.writeDocument(state, null, {skipConflict: true});
        } catch (error) {
          if (!error || error.code !== 'REVISION_CONFLICT') throw error;
          const initializedByOtherTab = await this.readDocument();
          if (!initializedByOtherTab || this.writeBlocked) throw error;
          state = initializedByOtherTab;
        }
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
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => database.close();
          resolve(database);
        };
        request.onerror = () => reject(request.error || new Error('Não foi possível abrir o banco local.'));
        request.onblocked = () => reject(new Error('A atualização do banco foi bloqueada por outra aba.'));
      });
    }

    canUseLocalStorage() {
      try {
        const key = `treino-hard-storage-test-${Core.uid('probe')}`;
        localStorage.setItem(key, '1');
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        this.lastError = `Armazenamento local indisponível: ${error.message || error}`;
        return false;
      }
    }

    async readDocument() {
      let rawDocument = '';
      let rawCaptured = false;
      try {
        if (this.mode === 'indexeddb') {
          const transaction = this.db.transaction(DOCUMENT_STORE, 'readonly');
          const result = await requestPromise(transaction.objectStore(DOCUMENT_STORE).get(DOCUMENT_KEY));
          rawCaptured = result !== undefined;
          rawDocument = rawCaptured ? JSON.stringify(result) : '';
          if (result && Number(result.schemaVersion) > Core.SCHEMA_VERSION) {
            throw new Error('Documento local criado por versão futura; o aplicativo entrou em modo somente leitura e não gravou nada.');
          }
          if (result === undefined) return null;
          if (Number(result.schemaVersion) < Core.SCHEMA_VERSION) {
            await this.preserveMigrationSource(rawDocument, Number(result.schemaVersion) || 1);
            return Core.migratePayload(result);
          }
          Core.assertCurrentStateStructure(result);
          return Core.normalizeState(result);
        }
        if (this.mode === 'localstorage') {
          const text = localStorage.getItem(FALLBACK_KEY);
          if (text === null) return null;
          rawCaptured = true;
          rawDocument = text;
          const parsed = JSON.parse(text);
          if (Number(parsed.schemaVersion) > Core.SCHEMA_VERSION) {
            throw new Error('Documento local criado por versão futura; o aplicativo entrou em modo somente leitura e não gravou nada.');
          }
          if (Number(parsed.schemaVersion) < Core.SCHEMA_VERSION) {
            await this.preserveMigrationSource(rawDocument, Number(parsed.schemaVersion) || 1);
            return Core.migratePayload(parsed);
          }
          Core.assertCurrentStateStructure(parsed);
          return Core.normalizeState(parsed);
        }
        if (!this.memory) return null;
        rawCaptured = true;
        rawDocument = JSON.stringify(this.memory);
        Core.assertCurrentStateStructure(this.memory);
        return Core.normalizeState(this.memory);
      } catch (error) {
        const readError = error.message || String(error);
        this.lastError = readError;
        if (!this.writeBlocked) {
          const fallbackRaw = this.rawCurrentDocument();
          const capturedRaw = rawCaptured ? rawDocument : fallbackRaw;
          const recoverySaved = capturedRaw !== null && await this.saveRecovery({
            id: Core.uid('corrupt'),
            savedAt: new Date().toISOString(),
            reason: readError,
            raw: capturedRaw
          });
          this.writeBlocked = true;
          if (!recoverySaved) {
            this.lastError = `${readError} A cópia bruta não pôde ser gravada; novas escritas foram bloqueadas para preservar o documento original.`;
          } else {
            this.lastError = `${readError} A cópia bruta foi preservada e o aplicativo entrou em modo somente leitura; o documento original não foi sobrescrito.`;
          }
        }
        return null;
      }
    }

    rawCurrentDocument() {
      try {
        if (this.mode !== 'localstorage') return null;
        return localStorage.getItem(FALLBACK_KEY);
      } catch (error) {
        return null;
      }
    }

    ensureWritable() {
      if (this.writeBlocked) throw new Error(this.lastError || 'A gravação está bloqueada para preservar o documento local original.');
    }

    async preserveAuxiliaryRaw(raw, reason) {
      if (raw == null) return;
      const saved = await this.saveRecovery(backupRecoveryItem(raw, reason));
      if (!saved) throw new Error(this.lastError || 'Não foi possível preservar os dados auxiliares inválidos.');
    }

    hasLocalStorageWriteLock() {
      return Boolean(global.navigator && global.navigator.locks && typeof global.navigator.locks.request === 'function');
    }

    async withLocalStorageWriteLock(callback, options) {
      const settings = options || {};
      if (!this.hasLocalStorageWriteLock()) {
        this.writeBlocked = true;
        this.lastError = 'Não foi possível obter o bloqueio entre abas. A gravação de contingência foi bloqueada para evitar perda silenciosa de dados.';
        const error = new Error(this.lastError);
        error.code = 'STORAGE_LOCK_UNAVAILABLE';
        throw error;
      }
      if (this.localWriteLockDepth > 0) {
        if (!settings.allowBlocked) this.ensureWritable();
        return callback();
      }
      return global.navigator.locks.request(FALLBACK_WRITE_LOCK, {mode: 'exclusive'}, async () => {
        this.localWriteLockDepth += 1;
        try {
          if (!settings.allowBlocked) this.ensureWritable();
          return await callback();
        } finally {
          this.localWriteLockDepth -= 1;
        }
      });
    }

    async preserveAmbiguousStaging(stagingText, reason) {
      const recoverySaved = await this.saveRecovery({
        id: Core.uid('interrupted-write'),
        savedAt: new Date().toISOString(),
        reason,
        raw: stagingText
      });
      this.writeBlocked = true;
      this.lastError = recoverySaved
        ? `${reason} A transação interrompida foi preservada e o aplicativo permaneceu somente leitura.`
        : `${reason} A transação interrompida não pôde ser copiada; o staging original foi mantido e o aplicativo permaneceu somente leitura.`;
      return false;
    }

    async reconcileLocalStorageStaging() {
      const stagingText = localStorage.getItem(FALLBACK_STAGING_KEY);
      if (stagingText === null) return false;
      const currentRaw = localStorage.getItem(FALLBACK_KEY);
      let transaction;
      try {
        transaction = JSON.parse(stagingText);
      } catch (error) {
        return this.preserveAmbiguousStaging(stagingText, 'Há uma transação local interrompida e ilegível.');
      }

      // Compatibilidade com o staging simples da versão anterior: se ele é
      // idêntico ao primário, o commit já terminou; nos demais casos não há
      // base suficiente para decidir e a cópia precisa ser preservada.
      if (!Core.isRecord(transaction) || transaction.format !== FALLBACK_TRANSACTION_FORMAT) {
        if (stagingText === currentRaw) {
          localStorage.removeItem(FALLBACK_STAGING_KEY);
          return true;
        }
        return this.preserveAmbiguousStaging(stagingText, 'Foi encontrado um staging antigo sem prova suficiente para concluir ou descartar a gravação.');
      }

      try {
        if (transaction.app !== Core.APP_ID || typeof transaction.txId !== 'string' || typeof transaction.nextRaw !== 'string') {
          throw new Error('Metadados da transação local inválidos.');
        }
        const next = JSON.parse(transaction.nextRaw);
        Core.assertSafeParsed(next);
        Core.assertCurrentStateStructure(next);
        const currentHash = await rawHash(currentRaw);
        const nextHash = await rawHash(transaction.nextRaw);
        if (nextHash !== transaction.nextHash || Number(next.revision) !== Number(transaction.nextRevision)) {
          throw new Error('O candidato da transação local não corresponde à sua prova de integridade.');
        }
        if (currentHash === transaction.nextHash) {
          localStorage.removeItem(FALLBACK_STAGING_KEY);
          return true;
        }
        if (currentHash === transaction.baseHash) {
          localStorage.setItem(FALLBACK_KEY, transaction.nextRaw);
          if (localStorage.getItem(FALLBACK_KEY) !== transaction.nextRaw) throw new Error('Não foi possível confirmar a retomada da transação local.');
          localStorage.removeItem(FALLBACK_STAGING_KEY);
          return true;
        }
        return this.preserveAmbiguousStaging(stagingText, 'O documento mudou depois que uma transação local foi interrompida; nenhuma versão foi sobrescrita automaticamente.');
      } catch (error) {
        return this.preserveAmbiguousStaging(stagingText, `A transação local interrompida falhou na validação: ${error.message || error}`);
      }
    }

    async preserveMigrationSource(raw, sourceSchemaVersion) {
      if (this.preservedPrimaryRaw === raw) return true;
      const recoverySaved = await this.saveRecovery({
        id: Core.uid('pre-migration'),
        savedAt: new Date().toISOString(),
        reason: `Documento primário no esquema ${sourceSchemaVersion}, preservado antes da migração para ${Core.SCHEMA_VERSION}.`,
        sourceSchemaVersion,
        raw
      });
      if (!recoverySaved) {
        this.writeBlocked = true;
        this.lastError = 'A origem anterior não pôde ser preservada de forma durável; novas escritas foram bloqueadas e o documento primário permaneceu intacto.';
        throw new Error(this.lastError);
      }
      this.preservedPrimaryRaw = raw;
      return true;
    }

    async capturePrimary() {
      if (this.mode === 'indexeddb') {
        const transaction = this.db.transaction(DOCUMENT_STORE, 'readonly');
        const value = await requestPromise(transaction.objectStore(DOCUMENT_STORE).get(DOCUMENT_KEY));
        return {exists: value !== undefined, value, raw: value === undefined ? null : JSON.stringify(value)};
      }
      if (this.mode === 'localstorage') {
        const raw = localStorage.getItem(FALLBACK_KEY);
        if (raw === null) return {exists: false, value: null, raw: null};
        return {exists: true, value: JSON.parse(raw), raw};
      }
      if (this.memory == null) return {exists: false, value: null, raw: null};
      return {exists: true, value: this.memory, raw: JSON.stringify(this.memory)};
    }

    async blockForCorruptPrimary(raw, cause) {
      const reason = cause && cause.message ? cause.message : String(cause || 'Documento primário inválido.');
      const recoverySaved = raw !== null && await this.saveRecovery({
        id: Core.uid('corrupt-before-write'),
        savedAt: new Date().toISOString(),
        reason,
        raw
      });
      this.writeBlocked = true;
      this.lastError = recoverySaved
        ? `${reason} A cópia bruta foi preservada; novas escritas foram bloqueadas e o documento primário permaneceu intacto.`
        : `${reason} A cópia bruta não pôde ser preservada de forma durável; novas escritas foram bloqueadas e o documento primário permaneceu intacto.`;
      const error = new Error(this.lastError);
      error.code = 'PRIMARY_CORRUPT';
      throw error;
    }

    async preparePrimaryForWrite(expectedRevision, settings) {
      let primary;
      try {
        primary = await this.capturePrimary();
      } catch (error) {
        return this.blockForCorruptPrimary(this.rawCurrentDocument(), error);
      }
      if (!primary.exists) {
        if (expectedRevision != null) {
          const conflict = new Error('O documento primário desapareceu. Recarregue antes de salvar novamente.');
          conflict.code = 'REVISION_CONFLICT';
          throw conflict;
        }
        return primary;
      }
      try {
        Core.assertSafeParsed(primary.value);
        const version = Number(primary.value.schemaVersion);
        if (!Number.isFinite(version)) throw new Error('O documento primário não informa um esquema válido.');
        if (version > Core.SCHEMA_VERSION) throw new Error('O documento primário foi criado por uma versão futura.');
        if (version < Core.SCHEMA_VERSION) {
          const migrated = Core.migratePayload(primary.value);
          if (expectedRevision == null || Number(migrated.revision) !== Number(expectedRevision)) {
            const conflict = new Error('Outra aba alterou os dados antigos. Recarregue antes de concluir a migração.');
            conflict.code = 'REVISION_CONFLICT';
            throw conflict;
          }
          await this.preserveMigrationSource(primary.raw, version || 1);
        } else {
          Core.assertCurrentStateStructure(primary.value);
          if (expectedRevision == null || Number(primary.value.revision) !== Number(expectedRevision)) {
            const conflict = new Error('Outra aba alterou os dados. Recarregue antes de salvar novamente.');
            conflict.code = 'REVISION_CONFLICT';
            throw conflict;
          }
        }
      } catch (error) {
        if (error && error.code === 'REVISION_CONFLICT') throw error;
        return this.blockForCorruptPrimary(primary.raw, error);
      }
      return primary;
    }

    primaryStillMatches(primary, value, raw) {
      const exists = value !== undefined && raw !== null;
      return primary.exists === exists && (!exists || primary.raw === raw);
    }

    assertPrimaryMatchesState(primaryValue, state, operation) {
      if (primaryValue === undefined || primaryValue === null) {
        const missing = new Error(`O documento primário desapareceu antes de ${operation}. Recarregue o aplicativo.`);
        missing.code = 'REVISION_CONFLICT';
        throw missing;
      }
      Core.assertSafeParsed(primaryValue);
      Core.assertCurrentStateStructure(primaryValue);
      const expected = Core.normalizeState(state);
      if (Number(primaryValue.revision) !== Number(expected.revision) || JSON.stringify(primaryValue) !== JSON.stringify(expected)) {
        const conflict = new Error(`Outra aba alterou os dados antes de ${operation}. Recarregue o aplicativo.`);
        conflict.code = 'REVISION_CONFLICT';
        throw conflict;
      }
      return expected;
    }

    async writeDocument(state, expectedRevision, options) {
      this.ensureWritable();
      const settings = options || {};
      const normalized = Core.touchState(state);
      if (this.mode === 'localstorage') {
        try {
          return await this.withLocalStorageWriteLock(async () => {
            await this.reconcileLocalStorageStaging();
            this.ensureWritable();
            const primary = await this.preparePrimaryForWrite(expectedRevision, settings);
            const currentText = localStorage.getItem(FALLBACK_KEY);
            const exists = currentText !== null;
            if (primary.exists !== exists || (exists && primary.raw !== currentText)) {
              const conflict = new Error('Outra aba alterou os dados. Recarregue antes de salvar novamente.');
              conflict.code = 'REVISION_CONFLICT';
              throw conflict;
            }
            const text = JSON.stringify(normalized);
            const transaction = {
              app: Core.APP_ID,
              format: FALLBACK_TRANSACTION_FORMAT,
              txId: Core.uid('local-write'),
              createdAt: new Date().toISOString(),
              baseExists: exists,
              baseRevision: exists && primary.value ? Number(primary.value.revision) : null,
              baseHash: await rawHash(currentText),
              nextRevision: Number(normalized.revision),
              nextHash: await rawHash(text),
              nextRaw: text
            };
            const stagingText = JSON.stringify(transaction);
            let discardStaging = false;
            try {
              localStorage.setItem(FALLBACK_STAGING_KEY, stagingText);
              const stagedText = localStorage.getItem(FALLBACK_STAGING_KEY);
              const verified = JSON.parse(stagedText);
              if (stagedText !== stagingText || verified.txId !== transaction.txId || verified.nextHash !== transaction.nextHash) {
                throw new Error('A verificação da transação local falhou.');
              }
              const beforeCommitText = localStorage.getItem(FALLBACK_KEY);
              if (beforeCommitText !== currentText) {
                discardStaging = true;
                const conflict = new Error('Outra aba alterou os dados durante a gravação. Recarregue antes de salvar novamente.');
                conflict.code = 'REVISION_CONFLICT';
                throw conflict;
              }
              localStorage.setItem(FALLBACK_KEY, text);
              if (localStorage.getItem(FALLBACK_KEY) !== text) throw new Error('A confirmação da gravação local falhou.');
              discardStaging = true;
            } finally {
              try {
                if (discardStaging && localStorage.getItem(FALLBACK_STAGING_KEY) === stagingText) {
                  localStorage.removeItem(FALLBACK_STAGING_KEY);
                }
              } catch (cleanupError) {
                // A reconciliação da próxima inicialização decide pelo hash.
              }
            }
            this.lastError = '';
            if (this.channel) this.channel.postMessage({type: 'state-updated', revision: normalized.revision, updatedAt: normalized.updatedAt});
            return normalized;
          });
        } catch (error) {
          this.lastError = error.message || String(error);
          throw error;
        }
      }
      const primary = await this.preparePrimaryForWrite(expectedRevision, settings);
      try {
        if (this.mode === 'indexeddb') {
          const transaction = this.db.transaction(DOCUMENT_STORE, 'readwrite');
          const store = transaction.objectStore(DOCUMENT_STORE);
          const current = await requestPromise(store.get(DOCUMENT_KEY));
          const currentRaw = current === undefined ? null : JSON.stringify(current);
          if (!this.primaryStillMatches(primary, current, currentRaw)) {
            transaction.abort();
            const conflict = new Error('Outra aba alterou os dados. Recarregue antes de salvar novamente.');
            conflict.code = 'REVISION_CONFLICT';
            throw conflict;
          }
          store.put(normalized, DOCUMENT_KEY);
          await transactionPromise(transaction);
        } else {
          const currentRaw = this.memory == null ? null : JSON.stringify(this.memory);
          if (primary.exists !== (this.memory != null) || (primary.exists && primary.raw !== currentRaw)) {
            const conflict = new Error('O estado em memória foi alterado antes da gravação.');
            conflict.code = 'REVISION_CONFLICT';
            throw conflict;
          }
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
      this.ensureWritable();
      Core.assertCurrentStateStructure(state);
      const snapshot = {
        id: Core.uid('snapshot'),
        savedAt: new Date().toISOString(),
        reason: Core.cleanText(reason, 300),
        state: Core.normalizeState(state)
      };
      if (this.mode === 'indexeddb') {
        const transaction = this.db.transaction([DOCUMENT_STORE, SNAPSHOT_STORE], 'readwrite');
        const current = await requestPromise(transaction.objectStore(DOCUMENT_STORE).get(DOCUMENT_KEY));
        this.assertPrimaryMatchesState(current, state, 'criar o snapshot');
        transaction.objectStore(SNAPSHOT_STORE).put(snapshot);
        await transactionPromise(transaction);
        await this.trimSnapshots();
      } else if (this.mode === 'localstorage') {
        await this.withLocalStorageWriteLock(async () => {
          await this.reconcileLocalStorageStaging();
          this.ensureWritable();
          const current = await this.capturePrimary();
          this.assertPrimaryMatchesState(current.exists ? current.value : undefined, state, 'criar o snapshot');
          const previousRaw = localStorage.getItem(FALLBACK_SNAPSHOT_KEY);
          if (previousRaw != null) {
            try {
              const previous = parseJsonStrict(previousRaw);
              if (!Core.isRecord(previous) || !Core.isRecord(previous.state)) throw new Error('Snapshot em formato inválido.');
              Core.assertCurrentStateStructure(previous.state);
            } catch (error) {
              await this.preserveAuxiliaryRaw(previousRaw, `Snapshot local inválido preservado antes da substituição: ${error.message || error}`);
            }
          }
          const text = JSON.stringify(snapshot);
          localStorage.setItem(FALLBACK_SNAPSHOT_KEY, text);
          if (localStorage.getItem(FALLBACK_SNAPSHOT_KEY) !== text) throw new Error('A verificação do snapshot local falhou.');
        });
      } else {
        this.assertPrimaryMatchesState(this.memory, state, 'criar o snapshot');
        this.memorySnapshot = snapshot;
      }
      return snapshot;
    }

    async latestSnapshot() {
      if (this.mode === 'indexeddb') {
        const transaction = this.db.transaction(SNAPSHOT_STORE, 'readonly');
        const all = await requestPromise(transaction.objectStore(SNAPSHOT_STORE).getAll());
        return all.filter(isValidSnapshotItem).sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] || null;
      }
      if (this.mode === 'localstorage') {
        const raw = localStorage.getItem(FALLBACK_SNAPSHOT_KEY);
        if (raw == null) return null;
        try {
          const snapshot = parseJsonStrict(raw);
          return isValidSnapshotItem(snapshot) ? snapshot : null;
        } catch (error) {
          this.lastError = `Não foi possível ler o snapshot local: ${error.message || error}`;
          return null;
        }
      }
      return this.memorySnapshot || null;
    }

    async trimSnapshots() {
      this.ensureWritable();
      if (this.mode !== 'indexeddb') return;
      const transaction = this.db.transaction([SNAPSHOT_STORE, RECOVERY_STORE], 'readwrite');
      const store = transaction.objectStore(SNAPSHOT_STORE);
      const all = await requestPromise(store.getAll());
      const valid = [];
      all.forEach(item => {
        if (isValidSnapshotItem(item)) valid.push(item);
        else {
          transaction.objectStore(RECOVERY_STORE).put(backupRecoveryItem(
            JSON.stringify(item),
            'Snapshot inválido preservado durante a organização dos snapshots.'
          ));
          if (item && item.id != null) store.delete(item.id);
        }
      });
      const ordered = valid.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)) || String(b.id).localeCompare(String(a.id)));
      ordered.slice(10).forEach(item => store.delete(item.id));
      await transactionPromise(transaction);
    }

    async restoreLatestSnapshot(currentState) {
      const snapshot = await this.latestSnapshot();
      if (!snapshot || !snapshot.state) throw new Error('Nenhum snapshot válido está disponível.');
      Core.assertCurrentStateStructure(snapshot.state);
      const restored = Core.normalizeState(snapshot.state);
      restored.revision = currentState.revision;
      return this.writeDocument(restored, currentState.revision, {});
    }

    async automaticBackup(state, force) {
      this.ensureWritable();
      Core.assertCurrentStateStructure(state);
      const day = Core.localDateKey();
      const id = `auto-${day}`;
      if (this.mode === 'indexeddb') {
        const transaction = this.db.transaction([DOCUMENT_STORE, BACKUP_STORE, RECOVERY_STORE], 'readwrite');
        const current = await requestPromise(transaction.objectStore(DOCUMENT_STORE).get(DOCUMENT_KEY));
        this.assertPrimaryMatchesState(current, state, 'criar a cópia automática');
        const store = transaction.objectStore(BACKUP_STORE);
        const existing = await requestPromise(store.get(id));
        if (existing && isValidBackupItem(existing) && !force) {
          await transactionPromise(transaction);
          return false;
        }
        if (existing && !isValidBackupItem(existing)) {
          transaction.objectStore(RECOVERY_STORE).put(backupRecoveryItem(
            JSON.stringify(existing),
            'Cópia automática inválida preservada antes da substituição.'
          ));
        }
        store.put({id, savedAt: new Date().toISOString(), state: Core.normalizeState(state)});
        await transactionPromise(transaction);
        await this.trimBackups();
        return true;
      }
      if (this.mode === 'localstorage') {
        return this.withLocalStorageWriteLock(async () => {
          await this.reconcileLocalStorageStaging();
          this.ensureWritable();
          const current = await this.capturePrimary();
          const normalizedState = this.assertPrimaryMatchesState(current.exists ? current.value : undefined, state, 'criar a cópia automática');
          const rawBackups = localStorage.getItem(FALLBACK_BACKUP_KEY);
          let backups = [];
          if (rawBackups != null) {
            try {
              const parsed = parseJsonStrict(rawBackups);
              if (!Array.isArray(parsed)) throw new Error('A coleção não é uma lista.');
              const invalid = parsed.filter(item => !isValidBackupItem(item));
              if (invalid.length) {
                await this.preserveAuxiliaryRaw(rawBackups, 'Coleção local de cópias continha entrada inválida e foi preservada antes da reparação.');
              }
              backups = parsed.filter(isValidBackupItem);
            } catch (error) {
              await this.preserveAuxiliaryRaw(rawBackups, `Coleção local de cópias ilegível e preservada antes da reparação: ${error.message || error}`);
            }
          }
          if (backups.some(item => item.id === id) && !force) return false;
          const next = backups
            .filter(item => item.id !== id)
            .concat({id, savedAt: new Date().toISOString(), state: normalizedState})
            .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
            .slice(0, 3);
          const text = JSON.stringify(next);
          localStorage.setItem(FALLBACK_BACKUP_KEY, text);
          if (localStorage.getItem(FALLBACK_BACKUP_KEY) !== text) throw new Error('A verificação da cópia automática local falhou.');
          return true;
        });
      }
      return false;
    }

    async trimBackups() {
      this.ensureWritable();
      if (this.mode !== 'indexeddb') return;
      const transaction = this.db.transaction([BACKUP_STORE, RECOVERY_STORE], 'readwrite');
      const store = transaction.objectStore(BACKUP_STORE);
      const all = await requestPromise(store.getAll());
      const valid = [];
      all.forEach(item => {
        if (isValidBackupItem(item)) valid.push(item);
        else {
          transaction.objectStore(RECOVERY_STORE).put(backupRecoveryItem(
            JSON.stringify(item),
            'Cópia automática inválida preservada durante a organização das cópias.'
          ));
          if (item && item.id != null) store.delete(item.id);
        }
      });
      const ordered = valid.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      ordered.slice(3).forEach(item => store.delete(item.id));
      await transactionPromise(transaction);
    }

    async listBackups() {
      if (this.mode === 'indexeddb') {
        const transaction = this.db.transaction(BACKUP_STORE, 'readonly');
        return (await requestPromise(transaction.objectStore(BACKUP_STORE).getAll())).filter(isValidBackupItem).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      }
      if (this.mode === 'localstorage') {
        const raw = localStorage.getItem(FALLBACK_BACKUP_KEY);
        if (raw == null) return [];
        try {
          const parsed = parseJsonStrict(raw);
          return (Array.isArray(parsed) ? parsed : []).filter(isValidBackupItem).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        } catch (error) {
          this.lastError = `Não foi possível listar as cópias locais: ${error.message || error}`;
          return [];
        }
      }
      return [];
    }

    async restoreBackup(id, currentState) {
      const backup = (await this.listBackups()).find(item => item.id === id);
      if (!backup) throw new Error('Cópia automática não encontrada.');
      Core.assertCurrentStateStructure(backup.state);
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
      this.ensureWritable();
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
        const transaction = this.db.transaction([BACKUP_STORE, RECOVERY_STORE], 'readwrite');
        const store = transaction.objectStore(BACKUP_STORE);
        const current = await requestPromise(store.getAll());
        const validCurrent = [];
        current.forEach(item => {
          if (isValidBackupItem(item)) validCurrent.push(item);
          else {
            transaction.objectStore(RECOVERY_STORE).put(backupRecoveryItem(
              JSON.stringify(item),
              'Cópia v11 inválida preservada antes da importação de cópias legadas.'
            ));
            if (item && item.id != null) store.delete(item.id);
          }
        });
        const ids = new Set(validCurrent.map(item => item.id));
        const capacity = Math.max(0, 3 - validCurrent.length);
        converted.filter(item => !ids.has(item.id)).slice(0, capacity).forEach(item => store.put(item));
        await transactionPromise(transaction);
      } else if (this.mode === 'localstorage') {
        await this.withLocalStorageWriteLock(async () => {
          const rawCurrent = localStorage.getItem(FALLBACK_BACKUP_KEY);
          let current = [];
          if (rawCurrent != null) {
            try {
              const parsed = parseJsonStrict(rawCurrent);
              if (!Array.isArray(parsed)) throw new Error('A coleção não é uma lista.');
              const invalid = parsed.filter(item => !isValidBackupItem(item));
              if (invalid.length) {
                await this.preserveAuxiliaryRaw(rawCurrent, 'Coleção v11 inválida preservada antes da importação de cópias legadas.');
              }
              current = parsed.filter(isValidBackupItem);
            } catch (error) {
              await this.preserveAuxiliaryRaw(rawCurrent, `Coleção v11 ilegível preservada antes da importação de cópias legadas: ${error.message || error}`);
            }
          }
          const ids = new Set(current.map(item => item.id));
          const additions = converted.filter(item => !ids.has(item.id)).slice(0, Math.max(0, 3 - current.length));
          const text = JSON.stringify(current.concat(additions));
          localStorage.setItem(FALLBACK_BACKUP_KEY, text);
          if (localStorage.getItem(FALLBACK_BACKUP_KEY) !== text) throw new Error('A verificação das cópias legadas locais falhou.');
        });
      }
    }

    async saveRecovery(recovery) {
      if (!recovery) return false;
      const item = Object.assign({id: Core.uid('recovery'), savedAt: new Date().toISOString(), reason: 'Recuperação local'}, recovery);
      this.migrationRecovery = item;
      const failures = [];
      if (this.mode === 'indexeddb' && this.db) {
        try {
          const transaction = this.db.transaction(RECOVERY_STORE, 'readwrite');
          transaction.objectStore(RECOVERY_STORE).put(item);
          await transactionPromise(transaction);
          return true;
        } catch (error) {
          failures.push(`IndexedDB: ${error.message || error}`);
        }
      }
      try {
        if (this.canUseLocalStorage()) {
          return await this.withLocalStorageWriteLock(async () => {
            const storedRaw = localStorage.getItem(FALLBACK_RECOVERY_KEY);
            let previous = [];
            if (storedRaw != null) {
              try {
                const stored = parseJsonStrict(storedRaw);
                if (!isRecognizedRecoveryContainer(stored)) throw new Error('Contêiner de recuperação em formato inválido.');
                previous = recoveryItemsFromStored(stored);
              } catch (error) {
                previous = [backupRecoveryItem(
                  storedRaw,
                  `Contêiner de recuperação anterior ilegível, incorporado antes da reparação: ${error.message || error}`
                )];
              }
            }
            previous = previous.filter(existing => existing.id !== item.id);
            const envelope = {format: FALLBACK_RECOVERY_FORMAT, items: previous.concat(item).slice(-5)};
            const text = JSON.stringify(envelope);
            localStorage.setItem(FALLBACK_RECOVERY_KEY, text);
            const verified = JSON.parse(localStorage.getItem(FALLBACK_RECOVERY_KEY));
            if (JSON.stringify(verified) !== text || !recoveryItemsFromStored(verified).some(saved => saved.id === item.id)) {
              throw new Error('A verificação da recuperação local falhou.');
            }
            return true;
          }, {allowBlocked: true});
        }
      } catch (error) {
        failures.push(`localStorage: ${error.message || error}`);
      }
      this.lastError = `Não foi possível preservar a recuperação${failures.length ? ` (${failures.join('; ')})` : ''}.`;
      return false;
    }

    async getRecoveryItems() {
      const items = [];
      if (this.mode === 'indexeddb' && this.db) {
        try {
          const transaction = this.db.transaction(RECOVERY_STORE, 'readonly');
          items.push(...await requestPromise(transaction.objectStore(RECOVERY_STORE).getAll()));
        } catch (error) {
          this.lastError = `Não foi possível listar a recuperação do IndexedDB: ${error.message || error}`;
        }
      }
      try {
        if (this.canUseLocalStorage()) {
          const stored = parseJson(localStorage.getItem(FALLBACK_RECOVERY_KEY), null);
          items.push(...recoveryItemsFromStored(stored));
        }
      } catch (error) {
        this.lastError = `Não foi possível listar a recuperação local: ${error.message || error}`;
      }
      if (this.migrationRecovery) items.push(this.migrationRecovery);
      const unique = new Map();
      items.forEach(item => { if (item && item.id) unique.set(item.id, item); });
      return [...unique.values()].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
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
    FALLBACK_STAGING_KEY,
    FALLBACK_WRITE_LOCK,
    FALLBACK_RECOVERY_KEY,
    LEGACY_KEYS,
    parseJson
  });
})(globalThis);
