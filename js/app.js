(function initApp(global) {
  'use strict';

  const Data = global.THFData;
  const Core = global.THFCore;
  const Storage = global.THFStorage;
  const Measurements = global.THFMeasurements;

  const TAB_DEFINITIONS = Object.freeze([
    {id: 'today', label: 'Hoje'},
    ...Data.WORKOUTS.map(workout => ({id: workout.id, label: workout.label})),
    {id: 'cardio', label: 'Caminhada'},
    {id: 'home', label: 'Rotina em casa'},
    {id: 'evolution', label: 'Evolução'},
    {id: 'measurements', label: 'Medidas'},
    {id: 'cycles', label: 'Ciclos'},
    {id: 'settings', label: 'Ajustes'}
  ]);

  const SESSION_LABELS = Object.freeze({
    planned: 'Planejado', started: 'Iniciado', paused: 'Pausado', completed: 'Concluído', partial: 'Parcial',
    skipped: 'Pulado', rescheduled: 'Remarcado', cancelled: 'Cancelado'
  });
  const SET_STATUS_OPTIONS = Object.freeze([
    ['', 'Não informado'], ['completed', 'Concluída'], ['interrupted', 'Interrompida'], ['not_done', 'Não realizada'],
    ['pain', 'Dor'], ['bad_technique', 'Técnica inadequada'], ['excessive_load', 'Carga excessiva'],
    ['equipment_unavailable', 'Aparelho indisponível']
  ]);
  const FEELING_OPTIONS = Object.freeze([
    ['', 'Não informado'], ['good', 'Senti-me bem'], ['awkward', 'Execução estranha'], ['pain', 'Dor'], ['replace', 'Quero conversar sobre substituição']
  ]);
  const RIR_OPTIONS = Object.freeze([['', 'Não informado'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5+', '5 ou mais']]);
  const TERMINAL_STATUSES = new Set(['completed', 'partial', 'skipped', 'rescheduled', 'cancelled']);
  const TERMINAL_MUTATION_ACTIONS = new Set([
    'set-field', 'set-rest-select', 'set-complete', 'exercise-field', 'exercise-complete',
    'mobility-complete', 'mobility-skip', 'mobility-flag', 'mobility-note', 'feeling-pick',
    'variation-pick', 'variation-confirm', 'high-rep-toggle', 'repeat-first-set',
    'copy-previous-loads', 'timer-undo', 'timer-start-set', 'timer-start-rest',
    'session-start', 'session-pause', 'session-resume', 'session-complete', 'session-partial',
    'session-partial-confirm', 'session-reschedule', 'session-reschedule-confirm',
    'session-skip', 'session-skip-confirm', 'session-cancel', 'session-cancel-confirm'
  ]);
  const READ_ONLY_ALLOWED_ACTIONS = new Set([
    'activate-tab', 'open-workout', 'close-modal', 'close-video', 'open-video',
    'video-open-external', 'video-open-inline', 'exercise-history', 'timer-stop',
    'install-app', 'pwa-update', 'reload-external', 'recovery-export',
    'evolution-key', 'evolution-metric'
  ]);
  const FOCUS_DATA_KEYS = Object.freeze(['action', 'sessionId', 'exerciseId', 'setId', 'field', 'side', 'variationId', 'flag', 'setting']);

  const storage = new Storage.AppStorage();
  let state = null;
  let lastConsistentState = null;
  let currentTab = 'today';
  let tabFocusIndex = 0;
  let selectedSessionId = '';
  let lastForegroundDate = Core.localDateKey();
  let persistedRevision = 0;
  let saveQueue = Promise.resolve();
  let editVersion = 0;
  let modalReturnFocus = null;
  let deferredInstallPrompt = null;
  let pendingImport = null;
  let pendingEncryptedImport = null;
  const sideSelection = {};
  let storageInventory = {backups: [], recoveries: [], cacheName: '', loaded: false, error: ''};
  let evolutionSelection = {key: '', metric: 'maxLoad'};
  let timerDeadline = 0;
  let timerInterval = 0;
  let timerContext = null;
  let lastSetUndo = null;
  let wakeLock = null;
  let lastBackupState = 'Verificando…';
  let pwaUpdateConfirmed = false;

  const dom = {};

  function element(tag, options, children) {
    const config = options || {};
    const node = document.createElement(tag);
    if (config.className) node.className = config.className;
    if (config.text != null) node.textContent = String(config.text);
    Object.entries(config.attrs || {}).forEach(([name, value]) => {
      if (value == null || value === false) return;
      node.setAttribute(name, value === true ? '' : String(value));
    });
    Object.entries(config.dataset || {}).forEach(([name, value]) => {
      if (value != null) node.dataset[name] = String(value);
    });
    Object.entries(config.props || {}).forEach(([name, value]) => {
      node[name] = value;
    });
    const list = Array.isArray(children) ? children.flat(Infinity) : (children == null ? [] : [children]);
    list.forEach(child => {
      if (child == null || child === false) return;
      node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function button(label, action, className, dataset, attributes) {
    return element('button', {
      className: className || 'secondary-button',
      text: label,
      attrs: Object.assign({type: 'button'}, attributes || {}),
      dataset: Object.assign({action}, dataset || {})
    });
  }

  function isSessionEditable(session) {
    return Boolean(session) && !storage.writeBlocked && !TERMINAL_STATUSES.has(session.status);
  }

  function blockReadOnlyMutation(action, rerender) {
    if (!storage.writeBlocked || READ_ONLY_ALLOWED_ACTIONS.has(action)) return false;
    showNotice(storage.lastError || 'O armazenamento está em modo somente leitura para preservar o documento original.', 'error');
    if (rerender) renderActivePanel();
    return true;
  }

  function isProgressionEligibleSet(set) {
    return Boolean(set) && set.type === 'work' && set.status === 'completed' && Core.isSetConfirmed(set);
  }

  function captureFocusDescriptor(preferredElement) {
    const active = preferredElement instanceof HTMLElement ? preferredElement : document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) return null;
    const data = {};
    FOCUS_DATA_KEYS.forEach(key => {
      if (active.dataset && active.dataset[key] != null) data[key] = active.dataset[key];
    });
    return {
      id: active.id || '',
      tagName: active.tagName,
      name: active.getAttribute('name') || '',
      data,
      selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
    };
  }

  function focusDescriptorKey(descriptor) {
    if (!descriptor) return '';
    if (descriptor.id) return `id:${descriptor.id}`;
    if (descriptor.data && descriptor.data.action) {
      return `data:${FOCUS_DATA_KEYS.map(key => descriptor.data[key] || '').join('|')}`;
    }
    if (descriptor.name) return `name:${descriptor.tagName || ''}:${descriptor.name}`;
    return `tag:${descriptor.tagName || ''}`;
  }

  function restoreFocusDescriptor(descriptor) {
    if (!descriptor) return;
    let target = descriptor.id ? document.getElementById(descriptor.id) : null;
    if (!target && descriptor.data.action) {
      target = [...dom.panels.querySelectorAll('[data-action]')].find(candidate =>
        candidate.dataset.action === descriptor.data.action
        && FOCUS_DATA_KEYS.every(key => descriptor.data[key] == null || candidate.dataset[key] === descriptor.data[key])) || null;
    }
    if (!target && descriptor.name) {
      target = [...dom.panels.querySelectorAll('[name]')].find(candidate =>
        candidate.tagName === descriptor.tagName && candidate.getAttribute('name') === descriptor.name) || null;
    }
    if (!(target instanceof HTMLElement) || target.hasAttribute('disabled')) return;
    let details = target.closest('details');
    while (details) {
      details.open = true;
      details = details.parentElement ? details.parentElement.closest('details') : null;
    }
    target.focus({preventScroll: true});
    if (descriptor.selectionStart != null && typeof target.setSelectionRange === 'function') {
      const length = String(target.value || '').length;
      const selectionEnd = descriptor.selectionEnd == null ? descriptor.selectionStart : descriptor.selectionEnd;
      target.setSelectionRange(Math.min(descriptor.selectionStart, length), Math.min(selectionEnd, length));
    }
  }

  function option(value, label, selected) {
    return element('option', {text: label, attrs: {value, selected: selected === true}});
  }

  function field(label, control, className, hint) {
    const contents = [element('span', {text: label}) , control];
    if (hint) contents.push(element('small', {className: 'fine-print', text: hint}));
    return element('label', {className: className || 'field'}, contents);
  }

  function formatDate(dateKey, long) {
    if (!Core.validDate(dateKey)) return 'Data não registrada';
    const date = new Date(`${dateKey}T12:00:00`);
    return new Intl.DateTimeFormat('pt-BR', long ? {weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'} : {day: '2-digit', month: '2-digit', year: 'numeric'}).format(date);
  }

  function formatDateTime(value) {
    const parsed = Core.validIso(value);
    return parsed ? new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(parsed)) : 'Não registrado';
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = Math.floor(total % 60);
    return hours ? `${hours}h ${String(minutes).padStart(2, '0')}min` : `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function localDateFromOffset(baseDate, offset) {
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offset, 12);
    return Core.localDateKey(date);
  }

  function startOfWeek(reference) {
    const date = reference instanceof Date ? reference : new Date();
    const day = date.getDay();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - (day === 0 ? 6 : day - 1), 12);
  }

  function announce(message) {
    dom.liveRegion.textContent = '';
    global.setTimeout(() => { dom.liveRegion.textContent = message; }, 20);
  }

  function setSaveState(message, isError) {
    dom.saveState.textContent = message;
    dom.saveState.classList.toggle('is-error', Boolean(isError));
  }

  function showNotice(message, type, actions) {
    // Cada aviso novo substitui também a origem lógica do anterior. Sem isso,
    // voltar à rede poderia esconder por engano um conflito de integridade que
    // tivesse substituído visualmente o antigo aviso de offline.
    delete dom.notice.dataset.source;
    delete dom.notice.dataset.registration;
    dom.notice.replaceChildren(element('span', {text: message}));
    dom.notice.className = `app-notice${type ? ` is-${type}` : ''}`;
    if (actions && actions.length) {
      dom.notice.appendChild(element('div', {className: 'app-notice-actions'}, actions));
    }
    dom.notice.hidden = false;
  }

  function hideNotice() {
    dom.notice.hidden = true;
    dom.notice.replaceChildren();
    delete dom.notice.dataset.source;
    delete dom.notice.dataset.registration;
  }

  function showPwaAvailabilityNotice(message, type) {
    // A impossibilidade de instalar o pacote offline é secundária diante de
    // conflito, corrupção ou ausência de armazenamento persistente. Nunca
    // esconda o aviso que explica por que o documento está protegido.
    if (!dom.notice.hidden && dom.notice.classList.contains('is-error')) return;
    showNotice(message, type);
    dom.notice.dataset.source = 'pwa-availability';
  }

  function rememberConsistentState(value) {
    lastConsistentState = value ? Core.deepClone(value) : null;
  }

  function applyPreferences() {
    document.body.classList.toggle('large-text', state.settings.largeText);
  }

  function ensureCurrentWeekSessions(referenceDate) {
    const now = referenceDate instanceof Date ? referenceDate : new Date();
    const today = Core.localDateKey(now);
    const monday = startOfWeek(now);
    let changed = false;
    Data.WORKOUTS.forEach((workout, index) => {
      const date = localDateFromOffset(monday, index);
      // Uma instalação, importação ou reinício de ciclo no meio da semana não
      // cria pendências fictícias para dias anteriores ao primeiro uso.
      if (date < today) return;
      const exists = state.sessions.some(session => session.workoutId === workout.id && session.plannedDate === date);
      if (!exists) {
        state.sessions.push(novaSessao(workout.id, date, state.cycle.currentWeek));
        changed = true;
      }
    });
    return changed;
  }

  // A identificação da máquina é o que liga uma execução à anterior. Se ela
  // precisasse ser redigitada a cada semana, o histórico comparável não
  // existiria na prática e o app diria "sem histórico" para sempre. O valor é
  // herdado da última execução registrada do mesmo exercício e do mesmo lado, e
  // continua sendo um campo de texto que o usuário edita quando trocar de
  // aparelho. Nada além do nome do equipamento é herdado.
  function herdarMaquinas(session) {
    const anteriores = allSessions()
      .filter(item => item.id !== session.id && ['completed', 'partial'].includes(item.status))
      .sort((a, b) => (b.actualDate || b.plannedDate).localeCompare(a.actualDate || a.plannedDate));
    session.exercises.forEach(log => {
      if (log.machineId) return;
      for (const anterior of anteriores) {
        const igual = anterior.exercises.find(item =>
          item.exerciseId === log.exerciseId && item.side === log.side && item.machineId);
        if (igual) { log.machineId = igual.machineId; return; }
      }
    });
    return session;
  }

  function novaSessao(workoutId, date, week) {
    return herdarMaquinas(Core.createSession(workoutId, date, week));
  }

  async function persist(reason, rerender, options) {
    const settings = options || {};
    // Capture o controle no momento da edição. A gravação em IndexedDB é
    // assíncrona e, até terminar, o navegador ou uma automação pode mover o
    // foco; capturá-lo somente durante a remontagem perderia a série/campo.
    const rerenderFocus = rerender
      ? (settings.focusDescriptor || captureFocusDescriptor())
      : null;
    const focusAtRequest = rerender ? captureFocusDescriptor() : undefined;
    const rerenderScroll = rerender ? global.scrollY : null;
    const requestVersion = ++editVersion;
    const candidate = Core.deepClone(state);
    setSaveState('Salvando…', false);
    saveQueue = saveQueue.catch(() => undefined).then(async () => {
      candidate.revision = persistedRevision;
      const saved = await storage.writeDocument(candidate, persistedRevision, {});
      persistedRevision = saved.revision;
      state.revision = saved.revision;
      state.updatedAt = saved.updatedAt;
      rememberConsistentState(saved);
      if (requestVersion === editVersion) setSaveState('Salvo neste aparelho', false);
      return saved;
    }).catch(error => {
      setSaveState('Falha ao salvar', true);
      showNotice(error.message || String(error), 'error', error.code === 'REVISION_CONFLICT' ? [button('Recarregar dados', 'reload-external', 'secondary-button')] : []);
      if (requestVersion === editVersion && lastConsistentState) {
        state = Core.deepClone(lastConsistentState);
        persistedRevision = state.revision;
        applyPreferences();
        if (!settings.keepDomOnFailure) renderActivePanel(rerenderFocus, rerenderScroll, focusAtRequest);
      }
      throw error;
    });
    try {
      await saveQueue;
      if (reason) announce(reason);
      if (rerender) renderActivePanel(rerenderFocus, rerenderScroll, focusAtRequest);
    } catch (error) {
      return false;
    }
    return true;
  }

  function renderTabs() {
    dom.tabs.replaceChildren(...TAB_DEFINITIONS.map((tab, index) => {
      const selected = currentTab === tab.id;
      return element('button', {
        className: 'tab',
        text: tab.label,
        attrs: {
          type: 'button', role: 'tab', id: `tab-${tab.id}`,
          // Apenas o painel selecionado existe no DOM; apontar aria-controls para
          // painéis ausentes deixaria doze referências ARIA quebradas.
          'aria-controls': selected ? `panel-${tab.id}` : null,
          'aria-selected': selected ? 'true' : 'false',
          tabindex: index === tabFocusIndex ? '0' : '-1'
        },
        dataset: {action: 'activate-tab', tab: tab.id, tabIndex: index}
      });
    }));
  }

  function activateTab(tabId, focusPanel) {
    const index = TAB_DEFINITIONS.findIndex(tab => tab.id === tabId);
    if (index < 0) return;
    currentTab = tabId;
    tabFocusIndex = index;
    renderTabs();
    renderActivePanel();
    if (tabId === 'settings') refreshStorageInventory();
    if (focusPanel) {
      const panel = document.getElementById(`panel-${tabId}`);
      if (panel) panel.focus();
    }
  }

  function panelShell(tabId, title, subtitle, children) {
    return element('section', {
      className: 'panel',
      attrs: {role: 'tabpanel', id: `panel-${tabId}`, 'aria-labelledby': `tab-${tabId}`, tabindex: '-1'}
    }, [
      element('header', {className: 'panel-header'}, [element('h2', {text: title}), subtitle ? element('p', {text: subtitle}) : null]),
      children
    ]);
  }

  // As oito semanas ficam visíveis como botões, não escondidas num seletor.
  function renderWeekSelector() {
    if (!dom.weekSelector || !state) return;
    dom.weekSelector.replaceChildren(
      element('div', {className: 'wlbl', text: 'Semana da periodização'}),
      element('div', {className: 'weekbar', attrs: {role: 'group', 'aria-label': 'Semana da periodização'}},
        Array.from({length: 8}, (_, index) => {
          const week = index + 1;
          const selected = state.cycle.currentWeek === week;
          return element('button', {
            className: `week${week === 8 ? ' dl' : ''}${selected ? ' on' : ''}`,
            text: week === 8 ? 'DL' : String(week),
            attrs: {
              type: 'button',
              disabled: storage.writeBlocked,
              'aria-pressed': selected ? 'true' : 'false',
              'aria-label': week === 8 ? 'Semana 8, deload' : `Semana ${week}`
            },
            dataset: {action: 'cycle-week-set', week: String(week)}
          });
        }))
    );
  }

  // Bloco único de resumo, no lugar de quatro cartões soltos.
  function renderWeekSummary() {
    if (!dom.weekSummary || !state) return;
    const week = state.cycle.currentWeek;
    const focused = Data.WORKOUT_BY_ID[currentTab] || (sessionForToday() ? Data.WORKOUT_BY_ID[sessionForToday().workoutId] : null);
    const prescription = Data.prescriptionFor(Data.CATALOG.chest_press_machine, week, false);
    const rir = prescription.rirMin == null ? '—' : prescription.rirMin === prescription.rirMax ? String(prescription.rirMin) : `${prescription.rirMin}–${prescription.rirMax}`;
    const cell = (label, value, big) => element('div', {className: 'wcell'}, [
      element('div', {className: 'lbl', text: label}),
      element('div', {className: big ? 'big' : 'val', text: value})
    ]);
    dom.weekSummary.replaceChildren(element('div', {className: `wsum${week === 8 ? ' dl' : ''}`}, [
      cell('Semana', week === 8 ? 'DL' : String(week), true),
      cell('Repetições', prescription.label),
      cell('RIR', rir),
      cell('Séries', focused ? String(focused.workSetTotal) : '—')
    ]));
  }

  function renderActivePanel(focusDescriptor, scrollPosition, focusAtRequest) {
    if (!state) return;
    // Confirmar uma série redesenha o painel. Sem isto, a página pula para o
    // topo e o campo em uso perde o foco no meio do treino.
    // A gravação é assíncrona. Se a pessoa já moveu o foco para o próximo
    // campo enquanto ela terminava, o foco vivo tem precedência sobre o campo
    // que iniciou a gravação; devolver o foco antigo corrompia digitação rápida.
    const focoVivo = captureFocusDescriptor();
    const focoMudouDuranteGravacao = focusAtRequest !== undefined
      && focusDescriptorKey(focoVivo) !== focusDescriptorKey(focusAtRequest);
    const focoAnterior = focusDescriptor === undefined
      ? focoVivo
      : (focoMudouDuranteGravacao ? (focoVivo || focusDescriptor) : (focusDescriptor || focoVivo));
    const rolagemAnterior = Number.isFinite(scrollPosition) ? scrollPosition : global.scrollY;
    const detalhesAbertos = new Set([...dom.panels.querySelectorAll('details[open][id]')].map(item => item.id));
    renderWeekSelector();
    renderWeekSummary();
    let panel;
    try {
      if (currentTab === 'today') panel = renderTodayPanel();
      else if (Data.WORKOUT_BY_ID[currentTab]) panel = renderWorkoutPanel(currentTab);
      else if (currentTab === 'cardio') panel = renderCardioPanel();
      else if (currentTab === 'home') panel = renderHomePanel();
      else if (currentTab === 'evolution') panel = renderEvolutionPanel();
      else if (currentTab === 'measurements') panel = renderMeasurementsPanel();
      else if (currentTab === 'cycles') panel = renderCyclesPanel();
      else panel = renderSettingsPanel();
    } catch (error) {
      // Uma falha de montagem nunca pode deixar o painel anterior no lugar,
      // simulando que a aba pedida foi aberta com sucesso.
      console.error('Falha ao montar o painel solicitado.', error);
      panel = panelShell(currentTab, 'Falha ao montar esta aba', null, element('div', {className: 'warning-box'}, [
        element('strong', {text: 'Esta aba não pôde ser montada.'}),
        element('p', {text: error && error.message ? error.message : String(error)}),
        element('p', {text: 'Nenhum registro foi alterado. Exporte um backup em Ajustes antes de continuar.'})
      ]));
    }
    if (storage.writeBlocked) {
      panel.prepend(element('div', {className: 'session-readonly-banner', attrs: {role: 'alert'}}, [
        element('strong', {text: 'Armazenamento protegido — somente leitura.'}),
        element('span', {text: ' O documento original não será alterado. Em Ajustes, exporte o item de recuperação antes de tentar outra ação.'})
      ]));
      panel.querySelectorAll('[data-action]').forEach(control => {
        if (!READ_ONLY_ALLOWED_ACTIONS.has(control.dataset.action)) control.disabled = true;
      });
      panel.querySelectorAll('form input, form select, form textarea, form button').forEach(control => { control.disabled = true; });
    }
    dom.panels.replaceChildren(panel);
    detalhesAbertos.forEach(id => {
      const details = document.getElementById(id);
      if (details instanceof HTMLDetailsElement && dom.panels.contains(details)) details.open = true;
    });
    restoreFocusDescriptor(focoAnterior);
    if (global.scrollY !== rolagemAnterior) global.scrollTo({top: rolagemAnterior, behavior: 'auto'});
  }

  function bindDom() {
    dom.tabs = document.getElementById('primary-tabs');
    dom.panels = document.getElementById('panels');
    dom.loading = document.getElementById('loading-card');
    dom.notice = document.getElementById('app-notice');
    dom.saveState = document.getElementById('save-state');
    dom.installButton = document.getElementById('install-button');
    dom.installButton.dataset.action = 'install-app';
    dom.modal = document.getElementById('app-modal');
    dom.modalTitle = document.getElementById('modal-title');
    dom.modalContent = document.getElementById('modal-content');
    dom.videoModal = document.getElementById('video-modal');
    dom.videoTitle = document.getElementById('video-title');
    dom.videoStage = document.getElementById('video-stage');
    dom.videoExternal = document.getElementById('video-external');
    dom.importFile = document.getElementById('import-file');
    dom.liveRegion = document.getElementById('live-region');
    dom.timerBar = document.getElementById('timer-bar');
    dom.timerNumber = document.getElementById('timer-number');
    dom.timerLabel = document.getElementById('timer-label');
    dom.timerAnnouncement = document.getElementById('timer-announcement');
    dom.weekSelector = document.getElementById('week-selector');
    dom.weekSummary = document.getElementById('week-summary');
    dom.footerVersion = document.getElementById('footer-version');
    if (dom.footerVersion) dom.footerVersion.textContent = `Treino Hard (Fofo) · versão ${Core.APP_VERSION} · esquema ${Core.SCHEMA_VERSION}`;
  }

  async function init() {
    bindDom();
    attachEventListeners();
    try {
      state = await storage.init();
      persistedRevision = state.revision;
      rememberConsistentState(state);
      applyPreferences();
      const planned = storage.writeBlocked ? false : ensureCurrentWeekSessions();
      dom.loading.remove();
      renderTabs();
      renderActivePanel();
      if (storage.writeBlocked) {
        setSaveState('Somente leitura', true);
        showNotice(storage.lastError, 'error');
      } else {
        const plannedSaved = !planned || await persist('Sessões desta semana planejadas.', true);
        if (plannedSaved) {
          const backedUp = await storage.automaticBackup(state, false);
          lastBackupState = backedUp ? 'Cópia automática criada hoje' : 'Cópia automática diária em dia';
          setSaveState('Salvo neste aparelho', false);
          if (currentTab === 'today') renderActivePanel();
        }
      }
      storage.onExternalChange = handleExternalChange;
      registerPwa();
      updateOnlineStatus();
    } catch (error) {
      dom.loading.textContent = 'Não foi possível iniciar o aplicativo.';
      setSaveState('Falha na inicialização', true);
      showNotice(error.message || String(error), 'error');
    }
  }

  global.addEventListener('DOMContentLoaded', init);

  function pendingSessions() {
    return state.sessions
      .filter(session => ['planned', 'started', 'paused'].includes(session.status))
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.createdAt.localeCompare(b.createdAt));
  }

  function allSessions() {
    const sessions = state.archives.flatMap(archive => archive.sessions).concat(state.sessions);
    return [...new Map(sessions.map(session => [session.id, session])).values()];
  }

  function sessionForToday() {
    const today = Core.localDateKey();
    if (new Date().getDay() === 0) return null;
    if (state.settings.mode === 'sequence') return pendingSessions()[0] || null;
    return state.sessions.find(session => session.plannedDate === today && !['rescheduled', 'cancelled'].includes(session.status)) || null;
  }

  function sessionForWorkout(workoutId) {
    const selected = selectedSessionId
      ? state.sessions.find(session => session.id === selectedSessionId && session.workoutId === workoutId)
      : null;
    if (selected) return selected;
    const today = Core.localDateKey();
    const monday = Core.localDateKey(startOfWeek(new Date()));
    const sundayAfter = localDateFromOffset(startOfWeek(new Date()), 6);
    const candidates = state.sessions.filter(session => session.workoutId === workoutId);
    return candidates.find(session => session.plannedDate === today && !['rescheduled', 'cancelled'].includes(session.status))
      || candidates.find(session => session.plannedDate >= monday && session.plannedDate <= sundayAfter && !TERMINAL_STATUSES.has(session.status))
      || candidates.sort((a, b) => b.plannedDate.localeCompare(a.plannedDate))[0]
      || null;
  }

  function sessionProgress(session) {
    if (!session) return {done: 0, total: 0, percent: 0};
    const sets = session.exercises.flatMap(exercise => exercise.sets.filter(set => set.type === 'work'));
    const completedSets = sets.filter(Core.isSetConfirmed).length;
    const mobility = session.exercises.filter(exercise => !exercise.sets.length);
    const completedMobility = mobility.filter(exercise => exercise.completed || exercise.skipped).length;
    const total = sets.length + mobility.length;
    const done = completedSets + completedMobility;
    return {done, total, percent: total ? Math.round(done * 100 / total) : 0};
  }

  // Progresso contado por exercício da ficha: é assim que a pessoa pensa o
  // treino ("3 de 7"), e não em itens soltos.
  function exerciseProgress(session) {
    if (!session) return {done: 0, total: 0, percent: 0};
    const workout = Data.WORKOUT_BY_ID[session.workoutId];
    if (!workout) return {done: 0, total: 0, percent: 0};
    const total = workout.exercises.length;
    const done = workout.exercises.filter(exercise => {
      const logs = session.exercises.filter(log => log.exerciseId === exercise.id);
      if (!logs.length) return false;
      if (exercise.type === 'mobility') return logs[0].completed || logs[0].skipped;
      return logs.every(log => log.completed);
    }).length;
    return {done, total, percent: total ? Math.round(done * 100 / total) : 0};
  }

  function lastFinishedSession(workoutId, exceptId) {
    return allSessions()
      .filter(session => session.workoutId === workoutId && session.id !== exceptId && ['completed', 'partial'].includes(session.status))
      .sort((a, b) => (b.actualDate || b.plannedDate).localeCompare(a.actualDate || a.plannedDate))[0] || null;
  }

  function nextSessionAfter(session) {
    return pendingSessions().find(candidate => !session || candidate.id !== session.id) || null;
  }

  function summaryCard(label, value, detail) {
    return element('article', {className: 'summary-card'}, [
      element('span', {text: label}), element('strong', {text: value}), detail ? element('small', {text: detail}) : null
    ]);
  }

  function sessionPrimaryPrescription(session) {
    if (!session) return null;
    return session.exercises.find(exercise => exercise.prescriptionSnapshot && exercise.prescriptionSnapshot.min) || null;
  }

  function renderTodayPanel() {
    const now = new Date();
    const today = Core.localDateKey(now);
    const sunday = now.getDay() === 0;
    const session = sessionForToday();
    const next = nextSessionAfter(session);
    const children = [];

    if (sunday) {
      children.push(element('article', {className: 'card rest-day-card'}, [
        element('div', {className: 'card-title'}, [
          element('div', {className: 'today-kicker', text: 'Domingo'}),
          element('h3', {className: 'cname', text: 'Descanso completo'}),
          element('p', {className: 'cdetail', text: 'Hoje não há musculação nem meta obrigatória de caminhada.'})
        ]),
        next ? element('p', {className: 'fine-print', text: `Próxima sessão pendente: ${Data.WORKOUT_BY_ID[next.workoutId].label}, planejada para ${formatDate(next.plannedDate)}.`}) : null
      ]));
    } else if (!session) {
      children.push(element('div', {className: 'empty-state'}, [
        element('h3', {text: 'Nenhuma sessão planejada para hoje'}),
        element('p', {text: 'Abra uma ficha para planejar ou remarcar uma sessão explicitamente.'})
      ]));
    } else {
      const workout = Data.WORKOUT_BY_ID[session.workoutId];
      const prescription = sessionPrimaryPrescription(session);
      const snapshot = prescription ? prescription.prescriptionSnapshot : null;
      const progress = exerciseProgress(session);
      const iniciado = session.status !== 'planned';
      const anterior = lastFinishedSession(session.workoutId, session.id);
      const diaSemana = new Intl.DateTimeFormat('pt-BR', {weekday: 'long'}).format(new Date(`${session.plannedDate}T12:00:00`));
      children.push(element('article', {className: `card today-card k-per${session.status === 'completed' ? ' done' : ''}`}, [
        element('div', {className: 'chead'}, [
          element('div', {className: 'card-title'}, [
            element('div', {className: 'today-kicker', text: 'Treino de hoje'}),
            element('h3', {className: 'cname', text: workout.label}),
            element('p', {className: 'cdetail', text: `${diaSemana} · Semana ${session.week}${snapshot && snapshot.deload ? ' · deload' : ''}${session.plannedDate < today ? ` · Pendente desde ${formatDate(session.plannedDate)}` : ''}`})
          ]),
          element('span', {className: `status-pill${session.status === 'completed' ? ' is-complete' : ''}`, text: SESSION_LABELS[session.status]})
        ]),
        snapshot && snapshot.min ? element('div', {className: `target${snapshot.deload ? ' dl' : ''}`}, [
          element('span', {className: 'ico', text: '🎯'}),
          element('div', {}, [
            element('div', {className: 't1', text: 'Faixa inicial'}),
            element('div', {className: 't2', text: `${snapshot.label} reps${snapshot.rirMin == null ? '' : ` · RIR ${snapshot.rirMin === snapshot.rirMax ? snapshot.rirMin : `${snapshot.rirMin}–${snapshot.rirMax}`}`}`})
          ])
        ]) : null,
        element('p', {className: 'todayprog', text: `${progress.done} de ${progress.total} exercícios concluídos`}),
        progressBar(progress, 'exercícios'),
        element('div', {className: 'button-row'}, [
          button(iniciado ? 'Continuar treino' : 'Iniciar treino', 'open-workout', 'primary-button', {workoutId: session.workoutId, sessionId: session.id})
        ]),
        anterior ? element('p', {className: 'fine-print', text: `Último ${workout.label}: ${formatDate(anterior.actualDate || anterior.plannedDate)} · ${SESSION_LABELS[anterior.status].toLowerCase()}.`}) : null,
        discomfortWarning(session)
      ]));
    }

    // Sessão pendente de outro dia: aparece explícita, com as duas saídas.
    const pendente = pendingSessions().find(item => item.id !== (session && session.id) && item.plannedDate < today);
    if (pendente) {
      const treino = Data.WORKOUT_BY_ID[pendente.workoutId];
      const diaPendente = new Intl.DateTimeFormat('pt-BR', {weekday: 'long'}).format(new Date(`${pendente.plannedDate}T12:00:00`));
      children.push(element('article', {className: 'card k-fix pendingcard'}, [
        element('div', {className: 'card-title'}, [
          element('div', {className: 'today-kicker', text: 'Sessão pendente'}),
          element('h3', {className: 'cname', text: treino.label}),
          element('p', {className: 'cdetail', text: `${diaPendente} · ${formatDate(pendente.plannedDate)} · ${SESSION_LABELS[pendente.status].toLowerCase()}`})
        ]),
        element('div', {className: 'button-row'}, [
          button('Continuar pendente', 'open-workout', 'secondary-button', {workoutId: pendente.workoutId, sessionId: pendente.id}),
          session ? button('Ir para o treino de hoje', 'open-workout', 'ghost-button', {workoutId: session.workoutId, sessionId: session.id}) : null
        ]),
        element('p', {className: 'fine-print', text: 'Nada é remarcado ou concluído automaticamente; a escolha é sua.'})
      ]));
    }

    // Caminhada: registro rápido, sem sair da tela.
    const ultimaCaminhada = state.cardio.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || null;
    children.push(element('article', {className: 'card k-warm'}, [
      element('div', {className: 'card-title'}, [
        element('div', {className: 'today-kicker', text: 'Caminhada'}),
        element('p', {className: 'cdetail', text: sunday ? 'Domingo não tem meta obrigatória.' : 'Leve, no fim do dia. Registro opcional.'})
      ]),
      ultimaCaminhada ? element('p', {className: 'fine-print', text: `Último registro: ${formatDate(ultimaCaminhada.date)} · ${ultimaCaminhada.durationMinutes || 0} min${ultimaCaminhada.distanceKm ? ` · ${ultimaCaminhada.distanceKm} km` : ''}.`}) : element('p', {className: 'fine-print', text: 'Nenhuma caminhada registrada ainda.'}),
      element('div', {className: 'button-row'}, [button('+ Registrar caminhada', 'activate-tab', 'secondary-button', {tab: 'cardio'})])
    ]));

    children.push(element('div', {className: 'info-box'}, [
      element('strong', {text: 'Como interpretar a faixa'}),
      element('p', {text: 'Uma faixa de 12–15 repetições significa escolher uma carga que permita terminar cada série entre 12 e 15 repetições com o esforço planejado. Resultados como 15, 14 e 12 podem ser válidos.'})
    ]));
    return panelShell('today', 'Hoje', 'Planejamento real, sem registrar automaticamente o que não foi feito.', children);
  }

  // Aviso factual de desconforto anterior. Não é diagnóstico nem sugestão de
  // troca: só relembra o que você mesmo registrou.
  function discomfortWarning(session) {
    const anterior = lastFinishedSession(session.workoutId, session.id);
    if (!anterior) return null;
    const marcados = anterior.exercises.filter(log => ['pain', 'awkward'].includes(log.feeling));
    if (!marcados.length) return null;
    const nomes = marcados.map(log => {
      const exercise = Data.findExercise(anterior.workoutId, log.exerciseId);
      return exercise ? exercise.name : log.exerciseId;
    });
    return element('p', {className: 'discomfort', text: `Na última sessão você registrou desconforto em: ${nomes.join(', ')}.`});
  }

  function statusBadge(text, modifier) {
    return element('span', {className: `badge${modifier ? ` ${modifier}` : ''}`, text});
  }

  // Barra simples de progresso, no lugar do <progress> nativo.
  // A largura é aplicada por CSSOM: a CSP proíbe atributo `style` inline.
  function progressBar(progress, noun) {
    const fill = element('i');
    fill.style.width = `${progress.percent}%`;
    return element('div', {className: 'progwrap'}, [
      element('div', {
        className: 'prog',
        attrs: {role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(progress.percent), 'aria-label': `Progresso: ${progress.percent}%`}
      }, [fill]),
      element('p', {className: 'progtxt', text: `${progress.done} de ${progress.total} ${noun || 'itens'} · ${progress.percent}%`})
    ]);
  }

  function renderSessionActions(session) {
    const actions = [];
    if (session.status === 'planned') actions.push(button('Iniciar treino', 'session-start', 'primary-button', {sessionId: session.id}));
    if (session.status === 'started') actions.push(button('Pausar', 'session-pause', 'secondary-button', {sessionId: session.id}));
    if (session.status === 'paused') actions.push(button('Retomar', 'session-resume', 'primary-button', {sessionId: session.id}));
    if (['started', 'paused'].includes(session.status)) {
      actions.push(button('Finalizar treino', 'session-complete', 'success-button', {sessionId: session.id}));
      actions.push(button('Encerrar como parcial', 'session-partial', 'secondary-button', {sessionId: session.id}));
    }
    if (['planned', 'started', 'paused'].includes(session.status)) {
      actions.push(button('Remarcar', 'session-reschedule', 'secondary-button', {sessionId: session.id}));
      actions.push(button('Pular', 'session-skip', 'ghost-button', {sessionId: session.id}));
      actions.push(button('Cancelar', 'session-cancel', 'danger-button', {sessionId: session.id}));
    }
    if (TERMINAL_STATUSES.has(session.status)) actions.push(button('Reabrir sessão', 'session-reopen', 'secondary-button', {sessionId: session.id}));
    return element('div', {className: 'button-row'}, actions);
  }

  function prescriptionText(snapshot) {
    if (!snapshot || !snapshot.min) return snapshot && snapshot.label ? snapshot.label : 'Orientação registrada';
    const rir = snapshot.rirMin == null ? 'RIR não definido' : snapshot.rirMin === snapshot.rirMax ? `${snapshot.rirMin} RIR` : `${snapshot.rirMin}–${snapshot.rirMax} RIR`;
    return `${snapshot.sets} × ${snapshot.label} · ${rir}`;
  }

  function videoClassificationLabel(video) {
    return {
      technical_guide: 'Guia técnico',
      objective_demo: 'Demonstração objetiva',
      visual_reference: 'Referência visual'
    }[video && video.classification] || 'Vídeo de apoio';
  }

  // Bloco do vídeo no formato da referência: chamada, canal com a data da
  // revisão e, abaixo, a classificação com a cobertura e a duração.
  // Um vídeo pode ser tecnicamente aprovado e ainda assim não tocar dentro do
  // app: `availability` e `embedCompatible` descrevem ONDE ele toca,
  // `classification` descreve O QUE ele entrega. Os dois nunca se substituem.
  function videoUsavel(video) {
    return Boolean(
      video
      && video.status === 'accepted'
      && video.language === 'pt-BR'
      && Boolean(Data.verifiedBrazilianProvenance(video))
      && video.youtubeId
      && video.availability !== 'removed_or_private'
    );
  }

  function videoIncorporavel(video) {
    return videoUsavel(video) && video.embedCompatible !== false && video.availability !== 'external_only';
  }

  function renderVideoByKey(videoKey, label) {
    const video = Data.VIDEOS[videoKey];
    if (!video || video.status === 'rejected') {
      return element('p', {className: 'video-pending', text: 'Vídeo em curadoria.'});
    }
    if (video.status !== 'accepted') {
      return element('p', {className: 'video-pending', text: video.youtubeId ? 'Vídeo em revisão.' : 'Vídeo em curadoria.'});
    }
    if (video.availability === 'removed_or_private') {
      return element('p', {className: 'video-pending', text: 'Este vídeo não está mais disponível; substituição pendente.'});
    }
    if (!videoUsavel(video)) {
      return element('p', {className: 'video-pending', text: 'Vídeo brasileiro em curadoria.'});
    }
    const externo = !videoIncorporavel(video);
    const revisao = video.reviewedAt ? formatReviewDate(video.reviewedAt) : '';
    const cobertura = externo
      ? ['Reprodução externa', video.duration].filter(Boolean).join(' · ')
      : ['Cobre: ' + resumirCobertura(video.positives || ''), video.duration].filter(Boolean).join(' · ');
    return element('button', {
      className: `vbtn${externo ? ' is-external' : ''}`,
      attrs: {type: 'button'},
      dataset: {action: 'open-video', videoKey}
    }, [
      element('span', {className: 'vplay', text: externo ? '↗' : '▶'}),
      element('span', {className: 'vcopy'}, [
        element('strong', {text: label || (externo ? 'Abrir no YouTube' : 'Ver demonstração')}),
        element('span', {className: 'vs', text: `Canal brasileiro: ${video.channel || 'YouTube'}${revisao ? ` · revisado ${revisao}` : ''}`}),
        element('span', {className: 'vquality', text: videoClassificationLabel(video).toUpperCase()}),
        cobertura ? element('span', {className: 'vreason', text: cobertura}) : null
      ]),
      element('span', {className: 'ext', text: '▸'})
    ]);
  }

  function formatReviewDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
  }

  // A cobertura vem da revisão registrada; aqui ela é reduzida ao essencial.
  function resumirCobertura(texto) {
    const limpo = String(texto).replace(/\s+/g, ' ').trim().replace(/\.$/, '');
    return limpo.length > 68 ? `${limpo.slice(0, 65).trimEnd()}…` : limpo;
  }

  function renderVideoStatus(exercise, log) {
    // Exercícios de mobilidade não declaram variantes; sem esta guarda o painel
    // inteiro de Pernas A/B deixa de renderizar.
    const variants = Array.isArray(exercise.variants) ? exercise.variants : [];
    const variant = variants.find(item => item.id === log.variationId);
    const videoKey = variant && variant.videoKey ? variant.videoKey : exercise.videoKey;
    return renderVideoByKey(Data.VIDEOS[videoKey] ? videoKey : exercise.id);
  }

  function feelingBlock(session, log, exerciseName) {
    const options = [['good', '🙂', 'Bem'], ['awkward', '😕', 'Desconfortável'], ['pain', '⚠️', 'Senti dor'], ['replace', '🔄', 'Quero substituir']];
    const flagged = ['awkward', 'pain', 'replace'].includes(log.feeling);
    const current = options.find(item => item[0] === log.feeling);
    return element('details', {
      className: `feedback${flagged ? ' flagged' : ''}${log.feeling === 'pain' ? ' pain' : ''}`,
      props: {open: flagged}
    }, [
      element('summary', {text: `Como me senti${current ? ` · ${current[2]}` : ''}`}),
      element('div', {className: 'feedbackbody'}, [
        element('p', {className: 'feedbackhint', text: 'Registre sua experiência. A ficha não troca exercícios automaticamente; o feedback fica pronto para revisarmos juntos.'}),
        element('div', {className: 'feelbar', attrs: {role: 'group', 'aria-label': `Como me senti em ${exerciseName}`}}, options.map(([value, icon, label]) => element('button', {
          className: `feelbtn ${value}${log.feeling === value ? ' on' : ''}`,
          text: `${icon} ${label}`,
          attrs: {type: 'button', 'aria-pressed': log.feeling === value ? 'true' : 'false'},
          dataset: {action: 'feeling-pick', sessionId: session.id, exerciseId: log.id, feeling: value}
        }))),
        field('Observação opcional', element('textarea', {
          className: 'feedbacktext',
          attrs: {rows: '2', maxlength: '300', placeholder: 'Onde incomoda, por que não encaixa ou qual aparelho você prefere?'},
          props: {value: log.feedback},
          dataset: {action: 'exercise-field', field: 'feedback', sessionId: session.id, exerciseId: log.id}
        }), 'field full'),
        element('div', {className: 'button-row'}, [button('Copiar feedback para revisão', 'copy-feedback', 'quickbtn', {sessionId: session.id, exerciseId: log.id})]),
        log.feeling === 'pain' ? element('p', {className: 'feedbackmsg danger', text: 'Dor é um sinal para interromper o movimento e buscar avaliação profissional se persistir ou for intensa.'}) : null,
        log.feeling === 'replace' ? element('p', {className: 'feedbackmsg', text: 'Marcado para conversarmos sobre uma substituição antes de alterar a ficha.'}) : null
      ])
    ]);
  }

  function renderMobilityExercise(session, workoutExercise, exerciseLog, order) {
    const feedback = exerciseLog.mobilityFeedback;
    const sideFlags = [['stiffness', 'Rigidez'], ['pain', 'Dor'], ['range_limit', 'Limitação de amplitude'], ['support_difficulty', 'Dificuldade de apoio']];
    const feedbackFields = ['left', 'right'].map(side => element('fieldset', {className: 'measurement-group'}, [
      element('legend', {text: side === 'left' ? 'Lado esquerdo' : 'Lado direito'}),
      ...sideFlags.map(([key, label]) => element('label', {className: 'check-field'}, [
        element('input', {attrs: {type: 'checkbox'}, props: {checked: feedback[side][key]}, dataset: {action: 'mobility-flag', sessionId: session.id, exerciseId: exerciseLog.id, side, flag: key}}),
        element('span', {text: label})
      ]))
    ]));
    return element('article', {className: `section-card card k-mob${exerciseLog.completed ? ' done' : ''}`}, [
      element('div', {className: 'card-header chead'}, [
        element('div', {className: 'card-title'}, [
          element('h3', {className: 'cname', text: `${order}. ${workoutExercise.name}`}),
          element('p', {className: 'cdetail', text: workoutExercise.target}),
          element('div', {className: 'badges'}, [
            statusBadge('Aquecimento', 'b-mob'),
            exerciseLog.skipped ? statusBadge('Não realizada', 'is-deload') : null
          ])
        ])
      ]),
      element('div', {className: 'target'}, [
        element('span', {className: 'ico', text: '🎯'}),
        element('div', {}, [
          element('div', {className: 't1', text: 'Alvo'}),
          element('div', {className: 't2', text: `${workoutExercise.sets} × ${workoutExercise.target}${workoutExercise.effort ? ` · esforço ${workoutExercise.effort}` : ''}`})
        ])
      ]),
      renderVideoStatus(workoutExercise, exerciseLog),
      button(exerciseLog.completed ? '✓ Feito' : 'Marcar feito', 'mobility-complete', `mc${exerciseLog.completed ? ' on' : ''}`,
        {sessionId: session.id, exerciseId: exerciseLog.id},
        {'aria-pressed': exerciseLog.completed ? 'true' : 'false', 'aria-label': exerciseLog.completed ? 'Desmarcar mobilidade concluída' : 'Marcar mobilidade concluída'}),
      element('details', {className: 'feedback'}, [
        element('summary', {text: 'Como me senti'}),
        element('div', {className: 'feedbackbody'}, [
          element('div', {className: 'measurement-groups'}, feedbackFields),
          field('Observação — inclua panturrilha ou tornozelo direito quando pertinente', element('textarea', {className: 'feedbacktext', props: {value: feedback.note}, attrs: {rows: '2'}, dataset: {action: 'mobility-note', sessionId: session.id, exerciseId: exerciseLog.id}}), 'field full'),
          element('div', {className: 'button-row'}, [button(exerciseLog.skipped ? 'Repor na sessão' : 'Marcar não realizada', 'mobility-skip', 'quickbtn', {sessionId: session.id, exerciseId: exerciseLog.id})])
        ])
      ])
    ]);
  }

  // Campo de série no formato da referência: valor grande e unidade dentro.
  function setField(label, control, unit, className) {
    return element('label', {className: `field ${className || ''}`.trim()}, [
      element('span', {className: 'sr-only', text: label}),
      element('span', {className: 'fieldwrap'}, [control, unit ? element('span', {className: 'funit', text: unit}) : null])
    ]);
  }

  function renderSetRow(session, exerciseLog, set, displayIndex, options) {
    const settings = options || {};
    const confirmed = Core.isSetConfirmed(set);
    const warmup = set.type === 'warmup';
    const idBase = `${session.id}-${exerciseLog.id}-${set.id}`;
    const restValues = [60, 90, 120, 150, 180];
    const dataset = {sessionId: session.id, exerciseId: exerciseLog.id, setId: set.id};
    const tag = warmup ? `A${displayIndex}` : String(displayIndex);
    const name = settings.exerciseName || 'exercício';
    const row = [
      element('div', {className: `stag${warmup ? ' warm' : ''}`, attrs: {'aria-hidden': 'true'}, text: tag}),
      setField(`Carga em quilos — ${name} — série ${tag}`, element('input', {
        className: 'sin', attrs: {type: 'text', inputmode: 'decimal', maxlength: '7', autocomplete: 'off', id: `${idBase}-load`, placeholder: settings.loadPlaceholder || 'kg'},
        props: {value: set.load}, dataset: Object.assign({action: 'set-field', field: 'load'}, dataset)
      }), 'kg', 'set-field-load'),
      element('span', {className: 'sx', attrs: {'aria-hidden': 'true'}, text: '×'}),
      setField(`Repetições — ${name} — série ${tag}`, element('input', {
        className: 'sin', attrs: {type: 'text', inputmode: 'numeric', maxlength: '3', autocomplete: 'off', id: `${idBase}-reps`, placeholder: settings.repsPlaceholder || 'reps'},
        props: {value: set.reps}, dataset: Object.assign({action: 'set-field', field: 'reps'}, dataset)
      }), 'reps', 'set-field-reps')
    ];
    if (!warmup) {
      row.push(setField(`RIR — ${name} — série ${tag}`, element('select', {
        className: 'sin', attrs: {id: `${idBase}-rir`}, dataset: Object.assign({action: 'set-field', field: 'rir'}, dataset)
      }, RIR_OPTIONS.map(([value]) => option(value, value === '' ? '—' : value, set.rir === value))), 'RIR', 'set-field-rir'));
      row.push(button(confirmed ? '✓' : '○', 'set-complete', `setok${confirmed ? ' on' : ''}`, dataset,
        {'aria-label': confirmed ? `Atualizar série ${tag}` : `Concluir série ${tag}`, 'aria-pressed': confirmed ? 'true' : 'false'}));
    }
    return element('div', {className: `set-row${warmup ? ' is-warmup' : ''}${confirmed ? ' is-complete' : ''}`}, [
      element('div', {className: 'srow'}, row),
      element('details', {className: 'setmore', attrs: {id: `${idBase}-more`}}, [
        element('summary', {text: 'Mais', attrs: {id: `${idBase}-more-summary`}}),
        element('div', {className: 'details-body'}, [
          element('div', {className: 'field-grid'}, [
            field('Status', element('select', {className: 'select', attrs: {id: `${idBase}-status`}, dataset: Object.assign({action: 'set-field', field: 'status'}, dataset)}, SET_STATUS_OPTIONS.map(([value, label]) => option(value, label, set.status === value)))),
            field('Descanso seguinte', element('select', {className: 'select', attrs: {id: `${idBase}-rest`}, dataset: Object.assign({action: 'set-rest-select'}, dataset)}, [
              ...restValues.map(value => option(String(value), formatDuration(value), set.nextRestSeconds === value)),
              option('custom', 'Personalizado', !restValues.includes(set.nextRestSeconds))
            ])),
            field('Segundos personalizados', element('input', {className: 'input', attrs: {type: 'number', min: '0', max: '1800'}, props: {value: String(set.nextRestSeconds || 0)}, dataset: Object.assign({action: 'set-field', field: 'nextRestSeconds'}, dataset)}))
          ]),
          field('Observação opcional', element('input', {className: 'input', attrs: {type: 'text', maxlength: '200'}, props: {value: set.note}, dataset: Object.assign({action: 'set-field', field: 'note'}, dataset)}), 'field full'),
          set.nextRestSeconds ? element('div', {className: 'button-row'}, [button('Iniciar descanso desta série', 'timer-start-set', 'quickbtn', dataset)]) : null
        ])
      ])
    ]);
  }

  function proximoExercicioPendente(session, depoisDe) {
    const workout = Data.WORKOUT_BY_ID[session.workoutId];
    if (!workout) return null;
    const posicao = workout.exercises.findIndex(exercise => exercise.id === depoisDe);
    const ordem = workout.exercises.slice(posicao + 1).concat(workout.exercises.slice(0, Math.max(0, posicao)));
    return ordem.find(exercise => {
      const logs = session.exercises.filter(log => log.exerciseId === exercise.id);
      if (!logs.length) return false;
      if (exercise.type === 'mobility') return !logs[0].completed && !logs[0].skipped;
      return !logs.every(log => log.completed);
    }) || null;
  }

  // Linha de referência da execução anterior. Quando não há histórico
  // comparável, dizer POR QUE vale mais do que ficar em branco.
  function referenciaAnterior(session, exercise, log, previous) {
    if (previous) {
      const rir = resumoDeRir(previous.workSets);
      const faixaAtual = (log.prescriptionSnapshot || {}).label || '';
      const faixaDiferente = previous.faixa && faixaAtual && previous.faixa !== faixaAtual;
      return element('div', {className: 'prevref'}, [
        element('b', {text: `↩ Último treino · ${formatDate(previous.data)}`}),
        element('span', {text: `: ${resumoDeSeries(previous.workSets)}`}),
        rir ? element('span', {className: 'prevrir', text: rir}) : null,
        previous.deload ? element('span', {className: 'prevtag', text: 'Era semana de deload'}) : null,
        faixaDiferente ? element('span', {className: 'prevtag', text: `Faixa naquele dia: ${previous.faixa} reps`}) : null
      ]);
    }
    const alternativos = historicoNaoComparavel(session, log);
    if (!alternativos.length) {
      return element('div', {className: 'prevref is-empty'}, [
        element('b', {text: '↩ Sem histórico ainda'}),
        element('span', {text: ': esta é a primeira execução registrada nesta configuração.'})
      ]);
    }
    return element('div', {className: 'prevref is-empty'}, [
      element('b', {text: '↩ Sem histórico comparável nesta configuração'}),
      element('span', {text: `: há registro em ${alternativos.map(item => descreveConfiguracao(exercise, item.log)).join('; ')}. Cargas de máquinas, variações e lados diferentes não são comparáveis entre si.`})
    ]);
  }

  function showExerciseHistory(session, exercise, log) {
    const registros = comparableHistory(session, log, 8);
    const alternativos = historicoNaoComparavel(session, log);
    // Deload é recuperação planejada: aparece no histórico, mas não define
    // melhor série nem serve de base para sugerir aumento.
    const melhor = registros.filter(item => !item.deload)
      .flatMap(item => item.workSets.map(set => ({set, data: item.data})))
      .filter(item => Number(item.set.load) > 0 && Number(item.set.reps) > 0)
      .sort((a, b) => (Number(b.set.load) - Number(a.set.load)) || (Number(b.set.reps) - Number(a.set.reps)))[0] || null;

    const corpo = [element('p', {className: 'cdetail', text: descreveConfiguracao(exercise, log)})];

    if (registros.length) {
      corpo.push(element('ul', {className: 'histlist'}, registros.map(item => {
        const rir = resumoDeRir(item.workSets);
        return element('li', {}, [
          element('b', {text: `${formatDate(item.data)} · S${item.session.week}${item.deload ? ' · Deload' : ''}`}),
          element('span', {text: resumoDeSeries(item.workSets)}),
          rir ? element('span', {className: 'prevrir', text: rir}) : null,
          item.faixa ? element('span', {className: 'prevtag', text: `faixa ${item.faixa} reps`}) : null
        ]);
      })));
      corpo.push(element('p', {className: 'fine-print', text: melhor
        ? `Melhor série registrada: ${melhor.set.load} × ${melhor.set.reps} em ${formatDate(melhor.data)}. Semanas de deload não entram nesta comparação.`
        : 'Ainda não há série com carga e repetições suficientes para uma melhor marca fora do deload.'}));
    } else {
      corpo.push(element('div', {className: 'empty-state', text: 'Nenhuma sessão anterior confirmada nesta configuração.'}));
    }

    if (alternativos.length) {
      corpo.push(element('div', {className: 'info-box'}, [
        element('strong', {text: 'Registros do mesmo exercício que não são comparáveis'}),
        element('ul', {className: 'notes'}, alternativos.map(item =>
          element('li', {text: `${descreveConfiguracao(exercise, item.log)} — ${item.sessoes} sessão(ões)`}))),
        element('p', {text: 'Trocar de máquina, de variação ou de lado inicia um histórico próprio. O app não converte cargas entre eles.'})
      ]));
    }

    corpo.push(element('div', {className: 'button-row'}, [button('Fechar', 'close-modal', 'primary-button')]));
    openModal(`Histórico · ${exercise.name}`, element('div', {}, corpo));
  }

  function activeSideLog(session, logs) {
    if (logs.length === 1) return logs[0];
    const chosen = sideSelection[`${session.id}:${logs[0].exerciseId}`] || 'right';
    return logs.find(log => log.side === chosen) || logs[0];
  }

  function renderStrengthExercise(session, workoutExercise, logs, order) {
    const exerciseLog = activeSideLog(session, logs);
    const snapshot = exerciseLog.prescriptionSnapshot;
    const recommendation = Core.doubleProgressionRecommendation(workoutExercise, exerciseLog, session.week);
    const previous = previousComparablePerformance(session, exerciseLog);
    const variants = Array.isArray(workoutExercise.variants) ? workoutExercise.variants : [];
    const warmupSets = exerciseLog.sets.filter(set => set.type === 'warmup');
    const workSets = exerciseLog.sets.filter(set => set.type === 'work');
    const kind = workoutExercise.category === 'accessory' ? 'k-fix' : workoutExercise.category === 'deadlift' ? 'k-warm' : 'k-per';
    // Um exercício unilateral só está concluído quando os dois lados estão.
    const exercicioConcluido = logs.every(item => item.completed);
    const proximo = proximoExercicioPendente(session, workoutExercise.id);
    const rir = snapshot.rirMin == null ? '' : snapshot.rirMin === snapshot.rirMax ? ` · RIR ${snapshot.rirMin}` : ` · RIR ${snapshot.rirMin}–${snapshot.rirMax}`;

    const chips = (label, note, items) => element('div', {className: 'variantbox'}, [
      element('span', {className: 'variantlabel', text: label}),
      element('div', {className: 'variantbar', attrs: {role: 'group', 'aria-label': label}}, items),
      note ? element('p', {className: 'variantnote', text: note}) : null
    ]);

    const variantBox = variants.length ? chips('Equipamento desta ocorrência',
      'O vídeo e as orientações mudam junto com o equipamento. As cargas ficam registradas com a variação escolhida.',
      variants.map(item => element('button', {
        className: `variantbtn${exerciseLog.variationId === item.id ? ' on' : ''}`,
        text: item.label,
        attrs: {type: 'button', 'aria-pressed': exerciseLog.variationId === item.id ? 'true' : 'false'},
        dataset: {action: 'variation-pick', sessionId: session.id, exerciseId: exerciseLog.id, variationId: item.id}
      }))) : null;

    const sideBox = logs.length > 1 ? chips('Lado registrado',
      'As cargas de cada lado ficam em históricos separados. O volume planejado conta o exercício uma vez.',
      ['right', 'left'].map(side => {
        const item = logs.find(entry => entry.side === side);
        if (!item) return null;
        const seriesLado = item.sets.filter(set => set.type === 'work');
        const feitasLado = seriesLado.filter(Core.isSetConfirmed).length;
        return element('button', {
          className: `variantbtn${item.id === exerciseLog.id ? ' on' : ''}${item.completed ? ' is-done' : ''}`,
          text: `${side === 'right' ? 'Direito' : 'Esquerdo'} ${feitasLado}/${seriesLado.length}`,
          attrs: {type: 'button', 'aria-pressed': item.id === exerciseLog.id ? 'true' : 'false'},
          dataset: {action: 'side-pick', sessionId: session.id, exerciseId: workoutExercise.id, side}
        });
      })) : null;

    const quick = [];
    quick.push(button('☰ Histórico', 'exercise-history', 'quickbtn', {sessionId: session.id, exerciseId: exerciseLog.id}));
    if (previous) quick.push(button('↩ Copiar anterior', 'copy-previous-loads', 'quickbtn', {sessionId: session.id, exerciseId: exerciseLog.id}));
    if (workSets.length > 1) quick.push(button('⧉ Repetir 1ª série', 'repeat-first-set', 'quickbtn', {sessionId: session.id, exerciseId: exerciseLog.id}));
    if (lastSetUndo && lastSetUndo.sessionId === session.id && lastSetUndo.exerciseId === exerciseLog.id) {
      quick.push(button('↶ Desfazer', 'timer-undo', 'quickbtn undo'));
    }

    const previousLoad = previous && previous.workSets[0] ? previous.workSets[0].load : '';

    return element('article', {className: `section-card card ${kind}${exercicioConcluido ? ' done' : ''}`, attrs: {id: `exercicio-${workoutExercise.id}`}}, [
      element('div', {className: 'card-header chead'}, [
        element('div', {className: 'card-title'}, [
          element('h3', {className: 'cname', text: `${order}. ${workoutExercise.name}`}),
          workoutExercise.detail ? element('p', {className: 'cdetail', text: workoutExercise.detail}) : null,
          element('div', {className: 'badges'}, [
            statusBadge(workoutExercise.category === 'accessory' ? 'Acessório' : 'Periodizado', 'b-per'),
            snapshot.deload ? statusBadge('Deload', 'is-deload') : null,
            workoutExercise.unilateral ? statusBadge('Unilateral', 'is-side') : null
          ])
        ]),
        button(exerciseLog.completed ? '✓' : 'Marcar', 'exercise-complete', `donebtn${exerciseLog.completed ? ' on' : ''}`,
          {sessionId: session.id, exerciseId: exerciseLog.id},
          {'aria-pressed': exerciseLog.completed ? 'true' : 'false', 'aria-label': exerciseLog.completed ? `Desmarcar ${workoutExercise.name}` : `Marcar ${workoutExercise.name} como concluído`})
      ]),
      variantBox,
      element('div', {className: `target${snapshot.deload ? ' dl' : ''}`}, [
        element('span', {className: 'ico', text: '🎯'}),
        element('div', {}, [
          element('div', {className: 't1', text: snapshot.deload ? 'Alvo · Deload' : `Alvo · S${session.week}`}),
          element('div', {className: 't2', text: `${snapshot.sets} × ${snapshot.label} reps${rir} · ${formatDuration(snapshot.restSeconds)}`})
        ])
      ]),
      renderVideoStatus(workoutExercise, exerciseLog),
      workoutExercise.notes.length ? element('ul', {className: 'notes'}, workoutExercise.notes.map(note => element('li', {text: note}))) : null,
      sideBox,
      warmupSets.length ? element('div', {className: 'setshd'}, [element('span', {className: 'lab', text: 'Aquecimento (carga leve)'})]) : null,
      warmupSets.length ? element('div', {className: 'set-table warmups'}, warmupSets.map((set, index) => renderSetRow(session, exerciseLog, set, index + 1, {exerciseName: workoutExercise.name}))) : null,
      element('div', {className: 'setshd'}, [
        element('span', {className: 'lab', text: warmupSets.length ? 'Séries de trabalho' : 'Suas séries'}),
        element('span', {className: `goal${snapshot.deload ? ' dl' : ''}`, text: `alvo: ${snapshot.label} reps`})
      ]),
      referenciaAnterior(session, workoutExercise, exerciseLog, previous),
      quick.length ? element('div', {className: 'quickrow'}, quick) : null,
      element('div', {className: 'set-table'}, workSets.map((set, index) => renderSetRow(session, exerciseLog, set, index + 1, {
        exerciseName: workoutExercise.name,
        loadPlaceholder: previousLoad || 'kg',
        repsPlaceholder: snapshot.label
      }))),
      element('div', {className: `recommendation${recommendation.code === 'increase' ? ' is-increase' : recommendation.code === 'review' ? ' is-review' : ''}`}, [
        element('strong', {text: 'Progressão dupla'}),
        element('p', {text: recommendation.message}),
        recommendation.nextLoad ? element('p', {className: 'recnext', text: `Próximo degrau: ${Core.formatLoad(recommendation.nextLoad)} kg`}) : null
      ]),
      element('details', {className: 'exdetails'}, [
        element('summary', {text: 'Detalhes do exercício'}),
        element('div', {className: 'details-body'}, [
          field('Identificação da máquina', element('input', {className: 'input', attrs: {type: 'text', maxlength: '80', placeholder: 'Ex.: articulada 2'}, props: {value: exerciseLog.machineId}, dataset: {action: 'exercise-field', field: 'machineId', sessionId: session.id, exerciseId: exerciseLog.id}}), 'field full', 'Use um nome estável para não misturar máquinas.'),
          workoutExercise.allowHighReps ? element('label', {className: 'check-field'}, [element('input', {attrs: {type: 'checkbox'}, props: {checked: exerciseLog.highRepPreference}, dataset: {action: 'high-rep-toggle', sessionId: session.id, exerciseId: exerciseLog.id}}), element('span', {text: 'Preferir faixa leve de 12–20 repetições quando aplicável'})]) : null,
          workoutExercise.bracing ? element('p', {className: 'notes-p', text: Data.BRACING_TEXT}) : null,
          previous && previous.decision ? element('p', {className: 'notes-p', text: `Recomendação registrada: ${previous.decision.message}`}) : null
        ])
      ]),
      feelingBlock(session, exerciseLog, workoutExercise.name),
      exercicioConcluido ? element('div', {className: 'donebox'}, [
        element('strong', {text: '✓ Exercício concluído'}),
        proximo ? element('p', {text: `Próximo: ${proximo.name}`}) : element('p', {text: 'Este era o último exercício pendente do treino.'}),
        proximo ? button('Ir para o próximo', 'goto-exercise', 'secondary-button', {exerciseId: proximo.id}) : null
      ]) : null,
      button(`⏱ Descanso ${formatDuration(snapshot.restSeconds)}`, 'timer-start-rest', 'restbtn',
        {sessionId: session.id, exerciseId: exerciseLog.id, seconds: String(snapshot.restSeconds)})
    ]);
  }

  function renderWorkoutPanel(workoutId) {
    const workout = Data.WORKOUT_BY_ID[workoutId];
    const session = sessionForWorkout(workoutId);
    if (!session) {
      return panelShell(workoutId, workout.label, workout.intro, element('div', {className: 'empty-state'}, [
        element('p', {text: 'Nenhuma sessão foi planejada para esta ficha.'}),
        button('Planejar para hoje', 'plan-workout-today', 'primary-button', {workoutId})
      ]));
    }
    const progress = sessionProgress(session);
    const readOnly = !isSessionEditable(session);
    const children = [
      element('article', {className: 'card'}, [
        element('div', {className: 'card-header'}, [
          element('div', {className: 'card-title'}, [element('h3', {text: `${formatDate(session.plannedDate, true)} · Semana ${session.week}`}), element('p', {text: `${workout.workSetTotal} séries de trabalho planejadas; aquecimentos não entram no volume${workout.exercises.some(exercise => exercise.unilateral) ? ' e o exercício unilateral conta uma vez, embora seja executado nos dois lados' : ''}.`})]),
          element('span', {className: `status-pill${session.status === 'completed' ? ' is-complete' : ''}`, text: SESSION_LABELS[session.status]})
        ]),
        progressBar(progress, 'itens'),
        element('p', {className: 'fine-print', text: `Início: ${formatDateTime(session.startedAt)}. Duração registrada: ${session.durationSeconds ? formatDuration(session.durationSeconds) : 'em aberto'}.`}),
        ['started', 'paused'].includes(session.status)
          ? button('Finalizar treino do dia', 'session-complete', `workoutfinish${progress.total && progress.done === progress.total ? ' on' : ''}`, {sessionId: session.id})
          : null,
        renderSessionActions(session)
      ]),
      readOnly ? element('div', {className: 'session-readonly-banner', attrs: {role: 'status'}}, [
        element('strong', {text: 'Sessão encerrada — somente leitura.'}),
        element('span', {text: ' Use “Reabrir sessão” para voltar a editar os registros.'})
      ]) : null,
      element('div', {className: 'info-box'}, [element('strong', {text: 'Faixa, RIR e falha'}), element('p', {text: 'O limite inferior é o mínimo planejado; o superior é o topo da faixa. RIR estima quantas repetições ainda seriam possíveis com técnica aceitável. RIR 0 não é obrigatório e uma série encerrada por dor ou técnica inadequada não deve ser tratada como falha muscular planejada.'})]),
      // Um cartão por exercício da ficha. O exercício unilateral tem dois
      // registros (um por lado) e ambos vivem no mesmo cartão, atrás dos chips.
      ...workout.exercises.map((exercise, index) => {
        const logs = session.exercises.filter(log => log.exerciseId === exercise.id);
        if (!logs.length) return element('div', {className: 'warning-box', text: `Registro ausente para ${exercise.name}.`});
        return exercise.type === 'mobility'
          ? renderMobilityExercise(session, exercise, logs[0], index + 1)
          : renderStrengthExercise(session, exercise, logs, index + 1);
      })
    ];
    const panel = panelShell(workoutId, workout.label, workout.intro, children);
    if (readOnly) {
      panel.setAttribute('aria-readonly', 'true');
      panel.querySelectorAll('[data-action]').forEach(control => {
        if (TERMINAL_MUTATION_ACTIONS.has(control.dataset.action)) control.disabled = true;
      });
    }
    return panel;
  }

  function recentTimeline(items, renderer, emptyText) {
    if (!items.length) return element('div', {className: 'empty-state', text: emptyText});
    return element('div', {className: 'timeline'}, items.slice().reverse().slice(0, 20).map(renderer));
  }

  function renderCardioPanel() {
    const today = Core.localDateKey();
    const sessionOptions = state.sessions.slice().sort((a, b) => b.plannedDate.localeCompare(a.plannedDate)).slice(0, 30);
    const form = element('form', {className: 'section-card', dataset: {form: 'cardio'}}, [
      element('h3', {text: 'Registrar caminhada'}),
      element('p', {text: 'Caminhada leve no fim do dia, sem corrida e sem meta obrigatória de alta intensidade.'}),
      element('div', {className: 'field-grid is-three'}, [
        field('Data', element('input', {className: 'input', attrs: {type: 'date', name: 'date', required: true}, props: {value: today}})),
        field('Horário de início', element('input', {className: 'input', attrs: {type: 'time', name: 'startTime'}})),
        field('Duração (min)', element('input', {className: 'input', attrs: {type: 'number', name: 'durationMinutes', min: '0', max: '1440'}})),
        field('Distância (km)', element('input', {className: 'input', attrs: {type: 'text', name: 'distanceKm', inputmode: 'decimal'}})),
        field('Ritmo médio opcional', element('input', {className: 'input', attrs: {type: 'text', name: 'pace', maxlength: '30', placeholder: 'Ex.: 12:30 min/km'}})),
        field('Percepção de esforço (0–10)', element('input', {className: 'input', attrs: {type: 'number', name: 'effort', min: '0', max: '10'}})),
        field('Resultado', element('select', {className: 'select', attrs: {name: 'status'}}, [
          option('normal', 'Realizada normalmente', true), option('shorter', 'Realizada mais curta'), option('interrupted', 'Interrompida'),
          option('not_recovery', 'Não realizada por recuperação'), option('not_pain', 'Não realizada por dor'), option('not_unplanned', 'Não realizada por imprevisto')
        ])),
        field('Treino da manhã relacionado', element('select', {className: 'select', attrs: {name: 'relatedSessionId'}}, [option('', 'Nenhum'), ...sessionOptions.map(session => option(session.id, `${formatDate(session.plannedDate)} · ${Data.WORKOUT_BY_ID[session.workoutId].label}`))])),
        field('Dor ou desconforto', element('input', {className: 'input', attrs: {type: 'text', name: 'discomfort', maxlength: '300'}}), 'field full'),
        field('Observação', element('textarea', {className: 'textarea', attrs: {name: 'note', rows: '2', maxlength: '500'}}), 'field full')
      ]),
      element('fieldset', {className: 'measurement-group'}, [
        element('legend', {text: 'Sinais opcionais nos dias de pernas'}),
        ...[['fatigue', 'Fadiga'], ['rightCalfPain', 'Dor na panturrilha direita'], ['gaitChange', 'Alteração da marcha'], ['kneePain', 'Dor no joelho'], ['anklePain', 'Dor no tornozelo'], ['performanceDrop', 'Queda de rendimento']].map(([name, label]) => element('label', {className: 'check-field'}, [element('input', {attrs: {type: 'checkbox', name}}), element('span', {text: label})]))
      ]),
      element('div', {className: 'button-row'}, [element('button', {className: 'primary-button', text: 'Salvar caminhada', attrs: {type: 'submit'}})])
    ]);
    const history = recentTimeline(state.cardio, item => element('article', {className: 'timeline-item'}, [
      element('strong', {text: `${formatDate(item.date)} · ${item.durationMinutes || 0} min${item.distanceKm ? ` · ${item.distanceKm} km` : ''}`}),
      element('span', {text: `${item.startTime || 'horário não registrado'} · esforço ${item.effort || 'não informado'}/10 · ${item.discomfort || 'sem desconforto informado'}`})
    ]), 'Nenhuma caminhada registrada.');
    return panelShell('cardio', 'Caminhada', 'Módulo separado da musculação; o domingo não cria meta obrigatória.', [
      element('div', {className: 'info-box'}, [element('p', {text: 'A caminhada leve realizada várias horas depois da musculação tende a ser compatível com a rotina de força e hipertrofia. Ajuste a duração caso prejudique a recuperação ou agrave dor. O app não altera o treino automaticamente.'})]),
      form,
      element('section', {className: 'card'}, [element('h3', {text: 'Histórico de caminhada'}), history])
    ]);
  }

  function renderHomePanel() {
    const form = element('form', {className: 'section-card', dataset: {form: 'home'}}, [
      element('h3', {text: 'Registrar vacuum em casa'}),
      element('div', {className: 'field-grid is-three'}, [
        field('Data', element('input', {className: 'input', attrs: {type: 'date', name: 'date', required: true}, props: {value: Core.localDateKey()}})),
        field('Horário', element('input', {className: 'input', attrs: {type: 'time', name: 'time'}})),
        field('Posição', element('select', {className: 'select', attrs: {name: 'position'}}, [option('lying', 'Deitado', state.settings.vacuumPosition === 'lying'), option('all_fours', 'Quatro apoios', state.settings.vacuumPosition === 'all_fours'), option('seated', 'Sentado', state.settings.vacuumPosition === 'seated'), option('standing', 'Em pé', state.settings.vacuumPosition === 'standing')])),
        field('Duração de cada repetição (s)', element('input', {className: 'input', attrs: {type: 'number', name: 'durationSeconds', min: '1', max: '300'}, props: {value: String(state.settings.vacuumDuration)}})),
        field('Repetições', element('input', {className: 'input', attrs: {type: 'number', name: 'repetitions', min: '1', max: '20'}, props: {value: String(state.settings.vacuumRepetitions)}})),
        field('Facilidade (0–10)', element('input', {className: 'input', attrs: {type: 'number', name: 'ease', min: '0', max: '10'}})),
        field('Observações', element('textarea', {className: 'textarea', attrs: {name: 'note', rows: '2', maxlength: '500'}}), 'field full')
      ]),
      element('div', {className: 'button-row'}, [element('button', {className: 'primary-button', text: 'Salvar rotina', attrs: {type: 'submit'}})])
    ]);
    const history = recentTimeline(state.homeRoutines, item => element('article', {className: 'timeline-item'}, [
      element('strong', {text: `${formatDate(item.date)} · ${item.repetitions} repetições de ${item.durationSeconds}s`}),
      element('span', {text: `${item.time || 'horário não registrado'} · ${positionLabel(item.position)} · facilidade ${item.ease || 'não informada'}/10`})
    ]), 'Nenhuma rotina em casa registrada.');
    return panelShell('home', 'Rotina em casa', 'Vacuum separado dos seis treinos e dos gráficos de musculação.', [
      element('div', {className: 'info-box'}, [
        element('p', {text: `Configuração atual: ${state.settings.vacuumFrequency} dias por semana, ${state.settings.vacuumRepetitions} repetições de ${state.settings.vacuumDuration}s.`}),
        element('p', {text: 'O vacuum pode ser realizado em casa, preferencialmente quando o estômago não estiver cheio, por conforto. O jejum não é apresentado como requisito nem como método comprovadamente superior. Vacuum não é método de queima localizada de gordura.'})
      ]),
      element('section', {className: 'card'}, [
        element('h3', {text: 'Vídeo correto para cada posição'}),
        element('p', {className: 'fine-print', text: 'Escolha a mesma posição que será registrada; um único vídeo genérico não representa as quatro variações.'}),
        element('div', {className: 'field-grid is-two'}, [
          renderVideoByKey('vacuum_lying', 'Vacuum deitado'),
          renderVideoByKey('vacuum_all_fours', 'Vacuum em quatro apoios'),
          renderVideoByKey('vacuum_seated', 'Vacuum sentado'),
          renderVideoByKey('vacuum_standing', 'Vacuum em pé')
        ])
      ]),
      form,
      element('section', {className: 'card'}, [element('h3', {text: 'Histórico da rotina'}), history])
    ]);
  }

  function positionLabel(value) {
    return {lying: 'Deitado', all_fours: 'Quatro apoios', seated: 'Sentado', standing: 'Em pé'}[value] || 'Posição não registrada';
  }

  function comparisonRecords() {
    const groups = new Map();
    allSessions().filter(session => ['completed', 'partial'].includes(session.status)).forEach(session => {
      const workout = Data.WORKOUT_BY_ID[session.workoutId];
      session.exercises.forEach(log => {
        const exercise = Data.findExercise(session.workoutId, log.exerciseId);
        if (!exercise || exercise.type !== 'strength') return;
        const snapshot = log.prescriptionSnapshot;
        const range = snapshot && snapshot.min ? `${snapshot.min}-${snapshot.max}` : 'range-unspecified';
        const key = Core.comparableSeriesKey(log.exerciseId, log.variationId, log.machineId, log.side, range);
        if (!groups.has(key)) groups.set(key, {key, exercise, variationId: log.variationId, machineId: log.machineId, side: log.side, range, points: []});
        const workSets = log.sets.filter(set => set.type === 'work');
        const completed = workSets.filter(set => set.status === 'completed' && set.reps && Core.isSetConfirmed(set));
        if (!workSets.length) return;
        const loads = completed.map(set => Number(set.load) || 0);
        const reps = completed.map(set => Number(set.reps) || 0);
        const rirs = completed.map(set => Core.rirNumber(set.rir)).filter(value => value != null);
        groups.get(key).points.push({
          date: session.actualDate || session.plannedDate,
          sessionId: session.id,
          workout: workout.label,
          week: session.week,
          maxLoad: loads.length ? Math.max(...loads) : null,
          volume: completed.length ? completed.reduce((sum, set) => sum + (Number(set.load) || 0) * (Number(set.reps) || 0), 0) : null,
          reps: reps.length ? Math.max(...reps) : null,
          rir: rirs.length ? rirs.reduce((sum, value) => sum + value, 0) / rirs.length : null,
          pain: workSets.filter(set => set.status === 'pain' && Core.isSetConfirmed(set)).length + (log.feeling === 'pain' ? 1 : 0),
          bestSet: completed.sort((a, b) => (Number(b.load) || 0) - (Number(a.load) || 0) || (Number(b.reps) || 0) - (Number(a.reps) || 0))[0] || null
        });
      });
    });
    return [...groups.values()].map(group => {
      const variant = group.exercise.variants.find(item => item.id === group.variationId);
      group.label = `${group.exercise.name} · ${variant ? variant.label : group.variationId || 'variação padrão'} · ${group.machineId || 'máquina não identificada'} · ${group.side === 'bilateral' ? 'bilateral' : group.side} · ${group.range} rep.`;
      group.points.sort((a, b) => a.date.localeCompare(b.date));
      return group;
    }).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }

  function exerciseSeriesKey(log) {
    const snapshot = log.prescriptionSnapshot || {};
    const range = snapshot.min ? `${snapshot.min}-${snapshot.max}` : 'range-unspecified';
    return Core.comparableSeriesKey(log.exerciseId, log.variationId, log.machineId, log.side, range);
  }

  // A carga pertence ao aparelho, não à faixa da semana. A troca de faixa da
  // periodização (12–15 → 10–12) não pode apagar o histórico de carga daquela
  // máquina, que é justamente o que se precisa saber ao começar a série.
  function exerciseLoadKey(log) {
    return Core.loadHistoryKey(log.exerciseId, log.variationId, log.machineId, log.side);
  }

  function sessoesAnteriores(currentSession) {
    const limite = currentSession.actualDate || currentSession.plannedDate;
    return allSessions()
      .filter(session => session.id !== currentSession.id
        && ['completed', 'partial'].includes(session.status)
        && (session.actualDate || session.plannedDate) <= limite)
      .sort((a, b) => (b.actualDate || b.plannedDate).localeCompare(a.actualDate || a.plannedDate));
  }

  function registroDeExecucao(session, log) {
    const workSets = log.sets.filter(set => isProgressionEligibleSet(set) && (set.load || set.reps));
    if (!workSets.length) return null;
    const snapshot = log.prescriptionSnapshot || {};
    return {
      session,
      log,
      workSets,
      faixa: snapshot.label || (snapshot.min ? `${snapshot.min}–${snapshot.max}` : ''),
      deload: snapshot.deload === true,
      data: session.actualDate || session.plannedDate
    };
  }

  function comparableHistory(currentSession, currentLog, limite) {
    const chave = exerciseLoadKey(currentLog);
    const saida = [];
    for (const session of sessoesAnteriores(currentSession)) {
      session.exercises.forEach(log => {
        if (exerciseLoadKey(log) !== chave) return;
        const registro = registroDeExecucao(session, log);
        if (registro) saida.push(registro);
      });
      if (saida.length >= limite) break;
    }
    return saida.slice(0, limite);
  }

  // Registros do mesmo exercício que NÃO são comparáveis: outra máquina, outra
  // variação ou outro lado. Existem, mas as cargas não se somam nem se comparam.
  function historicoNaoComparavel(currentSession, currentLog) {
    const chave = exerciseLoadKey(currentLog);
    const outros = new Map();
    sessoesAnteriores(currentSession).forEach(session => {
      session.exercises.forEach(log => {
        if (log.exerciseId !== currentLog.exerciseId) return;
        const outra = exerciseLoadKey(log);
        if (outra === chave) return;
        if (!log.sets.some(set => set.type === 'work' && Core.isSetConfirmed(set))) return;
        if (!outros.has(outra)) outros.set(outra, {log, sessoes: 0});
        outros.get(outra).sessoes += 1;
      });
    });
    return [...outros.values()];
  }

  function descreveConfiguracao(exercise, log) {
    const variante = (Array.isArray(exercise.variants) ? exercise.variants : []).find(item => item.id === log.variationId);
    return [
      variante ? variante.label : null,
      log.machineId ? `máquina "${log.machineId}"` : 'máquina não identificada',
      log.side === 'bilateral' ? null : log.side === 'left' ? 'lado esquerdo' : 'lado direito'
    ].filter(Boolean).join(' · ');
  }

  function resumoDeSeries(workSets) {
    return workSets.map(set => `${set.load || '–'}×${set.reps || '–'}`).join(' · ');
  }

  function resumoDeRir(workSets) {
    const valores = workSets.map(set => (set.rir === '' || set.rir == null ? '–' : String(set.rir)));
    return valores.every(item => item === '–') ? '' : `RIR ${valores.join(' · ')}`;
  }

  function previousComparablePerformance(currentSession, currentLog) {
    const primeiro = comparableHistory(currentSession, currentLog, 1)[0];
    if (!primeiro) return null;
    const seriesKey = exerciseSeriesKey(currentLog);
    const decision = state.progressionDecisions.slice().reverse()
      .find(item => item.sessionId === primeiro.session.id && item.seriesKey === seriesKey) || null;
    return Object.assign({decision}, primeiro);
  }

  function svgNode(name, attributes) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function lineChart(points, metric, label) {
    const valid = points.filter(point => Number.isFinite(point[metric]) && point[metric] != null);
    if (!valid.length) return element('div', {className: 'empty-state', text: 'Ainda não há pontos numéricos para esta métrica.'});
    const width = 760;
    const height = 300;
    const padding = 44;
    const values = valid.map(point => Number(point[metric]));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.max(1, max || 1);
    const svg = svgNode('svg', {viewBox: `0 0 ${width} ${height}`, class: 'chart-svg', role: 'img', 'aria-label': `${label}: ${valid.length} pontos cronológicos`});
    for (let line = 0; line <= 4; line += 1) {
      const y = padding + ((height - 2 * padding) * line / 4);
      svg.appendChild(svgNode('line', {x1: padding, y1: y, x2: width - padding, y2: y, class: 'chart-grid-line'}));
    }
    const coords = valid.map((point, index) => ({
      x: valid.length === 1 ? width / 2 : padding + index * (width - padding * 2) / (valid.length - 1),
      y: height - padding - ((Number(point[metric]) - min) / span) * (height - padding * 2),
      point
    }));
    if (coords.length > 1) svg.appendChild(svgNode('polyline', {points: coords.map(item => `${item.x},${item.y}`).join(' '), class: 'chart-line', fill: 'none'}));
    coords.forEach(item => {
      const circle = svgNode('circle', {cx: item.x, cy: item.y, r: 5, class: 'chart-point', tabindex: '0'});
      circle.appendChild(svgNode('title'));
      circle.firstChild.textContent = `${formatDate(item.point.date)}: ${Number(item.point[metric]).toLocaleString('pt-BR', {maximumFractionDigits: 2})}`;
      svg.appendChild(circle);
    });
    const minLabel = svgNode('text', {x: 4, y: height - padding + 4, class: 'chart-label'});
    minLabel.textContent = min.toLocaleString('pt-BR', {maximumFractionDigits: 1});
    const maxLabel = svgNode('text', {x: 4, y: padding + 4, class: 'chart-label'});
    maxLabel.textContent = max.toLocaleString('pt-BR', {maximumFractionDigits: 1});
    svg.append(minLabel, maxLabel);
    return svg;
  }

  function renderEvolutionPanel() {
    const groups = comparisonRecords();
    if (!groups.length) return panelShell('evolution', 'Evolução', 'Comparações exigem exercício, variação, máquina, lado e faixa iguais.', element('div', {className: 'empty-state'}, [element('h3', {text: 'Sem sessões concluídas comparáveis'}), element('p', {text: 'Finalize ao menos uma sessão com séries de trabalho registradas.'})]));
    if (!groups.some(group => group.key === evolutionSelection.key)) evolutionSelection.key = groups[0].key;
    const group = groups.find(item => item.key === evolutionSelection.key);
    const metricLabels = {maxLoad: 'Carga máxima (kg)', volume: 'Volume (kg × rep.)', reps: 'Maior número de repetições', rir: 'RIR médio'};
    const selector = element('div', {className: 'metric-controls'}, [
      field('Série comparável', element('select', {className: 'select', dataset: {action: 'evolution-key'}}, groups.map(item => option(item.key, item.label, item.key === group.key)))),
      field('Métrica', element('select', {className: 'select', dataset: {action: 'evolution-metric'}}, Object.entries(metricLabels).map(([value, label]) => option(value, label, evolutionSelection.metric === value))))
    ]);
    const painCount = group.points.reduce((sum, point) => sum + point.pain, 0);
    const rows = group.points.slice().reverse().map(point => element('div', {className: 'split-row'}, [
      element('strong', {text: `${formatDate(point.date)} · ${point.workout} · S${point.week}`}),
      element('span', {text: `${metricLabels[evolutionSelection.metric]}: ${point[evolutionSelection.metric] == null ? 'não informado' : Number(point[evolutionSelection.metric]).toLocaleString('pt-BR', {maximumFractionDigits: 2})}${point.bestSet ? ` · melhor série ${point.bestSet.load || '—'} kg × ${point.bestSet.reps}` : ''}`})
    ]));
    return panelShell('evolution', 'Evolução', 'Nenhuma linha conecta máquinas ou variações diferentes.', [
      selector,
      element('section', {className: 'chart-card'}, [element('h3', {text: metricLabels[evolutionSelection.metric]}), lineChart(group.points, evolutionSelection.metric, metricLabels[evolutionSelection.metric])]),
      element('div', {className: painCount ? 'warning-box' : 'info-box'}, [element('p', {text: `Frequência registrada de dor/desconforto nesta série comparável: ${painCount} ocorrência(s). Esse número descreve registros; não é diagnóstico.`})]),
      element('section', {className: 'card'}, [element('h3', {text: 'Sessões desta comparação'}), element('div', {className: 'split-list'}, rows)]),
      renderProgressionHistory()
    ]);
  }

  function renderProgressionHistory() {
    const decisions = state.progressionDecisions.slice().reverse().slice(0, 30);
    if (!decisions.length) return element('section', {className: 'card'}, [element('h3', {text: 'Decisões de progressão'}), element('p', {text: 'As recomendações aparecerão aqui ao finalizar sessões completas ou parciais.'})]);
    return element('section', {className: 'card'}, [
      element('h3', {text: 'Decisões de progressão'}),
      element('p', {text: 'A recomendação nunca altera a carga automaticamente. Registre o que decidiu e, depois, a carga realmente usada.'}),
      element('div', {className: 'timeline'}, decisions.map(item => element('article', {className: 'timeline-item'}, [
        element('strong', {text: `${formatDate(item.date)} · ${(Data.CATALOG[item.exerciseId] && Data.CATALOG[item.exerciseId].name) || item.exerciseId}`}),
        element('span', {text: `${item.message} Resultado: ${item.result || 'não registrado'} · RIR: ${item.rir || 'não informado'}.`}),
        element('div', {className: 'field-grid'}, [
          field('Sua decisão', element('select', {className: 'select', dataset: {action: 'progression-decision', decisionId: item.id}}, [option('pending', 'Ainda não decidi', item.decision === 'pending'), option('accepted', 'Aceitei aumentar', item.decision === 'accepted'), option('maintained', 'Mantive a carga', item.decision === 'maintained'), option('rejected', 'Não segui a recomendação', item.decision === 'rejected')])),
          field('Carga usada depois (kg)', element('input', {className: 'input', attrs: {type: 'text', inputmode: 'decimal'}, props: {value: item.nextLoad}, dataset: {action: 'progression-next-load', decisionId: item.id}}))
        ])
      ])))
    ]);
  }

  function measurementForm() {
    const groups = {base: 'Dados de base', torso: 'Tronco', limbs: 'Membros — registre cada lado'};
    return element('form', {className: 'section-card', dataset: {form: 'measurement'}}, [
      element('h3', {text: 'Nova medição'}),
      element('div', {className: 'field-grid'}, [
        field('Data', element('input', {className: 'input', attrs: {type: 'date', name: 'date', required: true}, props: {value: Core.localDateKey()}})),
        field('Horário opcional', element('input', {className: 'input', attrs: {type: 'datetime-local', name: 'measuredAt'}}))
      ]),
      ...Object.entries(groups).map(([group, legend]) => element('fieldset', {className: 'measurement-group'}, [
        element('legend', {text: legend}),
        element('div', {className: 'field-grid is-three'}, Object.entries(Measurements.METRICS).filter(([, metric]) => metric.group === group).map(([key, metric]) => field(`${metric.label} (${metric.unit})`, element('input', {className: 'input', attrs: {type: 'text', name: key, inputmode: 'decimal', placeholder: metric.example}}))))
      ])),
      field('Observação', element('textarea', {className: 'textarea', attrs: {name: 'note', rows: '2', maxlength: '300'}}), 'field full'),
      element('div', {className: 'button-row'}, [element('button', {className: 'primary-button', text: 'Salvar medidas', attrs: {type: 'submit'}})])
    ]);
  }

  function measurementComparison(latest, previous) {
    if (!latest) return element('div', {className: 'empty-state', text: 'Nenhuma medição registrada.'});
    const geometry = Measurements.bodyGeometry(latest);
    const chips = Object.entries(Measurements.METRICS).filter(([key]) => latest[key]).map(([key, metric]) => {
      const difference = previous && previous[key] ? Number(latest[key]) - Number(previous[key]) : null;
      return element('div', {className: 'body-chip'}, [element('strong', {text: `${metric.short}: ${latest[key]} ${metric.unit}`}), difference == null ? element('span', {text: 'Sem comparação'}) : element('span', {text: `${difference > 0 ? '+' : ''}${difference.toLocaleString('pt-BR', {maximumFractionDigits: 2})} desde a medição anterior`})]);
    });
    return element('section', {className: 'card'}, [
      element('h3', {text: 'Silhueta comparativa aproximada'}),
      element('p', {text: `Medição de ${formatDate(latest.date)}. ${geometry.directCount} medidas dimensionais disponíveis; partes sem medida direta são estimadas visualmente.`}),
      element('div', {className: 'body-map-stage'}, [Measurements.createSilhouetteSvg(latest, previous)]),
      element('div', {className: 'body-chip-grid'}, chips),
      element('p', {className: 'fine-print', text: 'Esta é uma representação geométrica frontal aproximada, não uma reconstrução anatômica, avaliação clínica, inferência de força ou composição corporal. Pequenas diferenças não geram alertas automáticos.'})
    ]);
  }

  function renderMeasurementsPanel() {
    const ordered = state.measurements.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.measuredAt || a.savedAt || a.id).localeCompare(String(b.measuredAt || b.savedAt || b.id)));
    const latest = ordered[ordered.length - 1] || null;
    const previous = ordered[ordered.length - 2] || null;
    const history = recentTimeline(ordered, item => element('article', {className: 'timeline-item'}, [
      element('strong', {text: `${formatDate(item.date)}${item.weight ? ` · ${item.weight} kg` : ''}`}),
      element('span', {text: `${Object.keys(Measurements.METRICS).filter(key => item[key]).length} medidas diretas ou derivadas${item.note ? ` · ${item.note}` : ''}`})
    ]), 'Nenhuma medição registrada.');
    return panelShell('measurements', 'Medidas', 'Campos bilaterais separados e representação explicitamente aproximada.', [measurementForm(), measurementComparison(latest, previous), element('section', {className: 'card'}, [element('h3', {text: 'Histórico'}), history])]);
  }

  function periodizationRows() {
    const examples = [
      ['Compostos superiores', Data.CATALOG.chest_press_machine], ['Agachamento e leg press', Data.CATALOG.squat],
      ['Isoladores e acessórios', Data.CATALOG.lateral_raise_dumbbell], ['Levantamento terra', Data.CATALOG.deadlift_barbell]
    ];
    return examples.map(([label, exercise]) => {
      const prescription = Data.prescriptionFor(exercise, state.cycle.currentWeek, false);
      return element('div', {className: 'split-row'}, [element('strong', {text: label}), element('span', {text: `${prescription.sets} × ${prescription.label} · ${prescription.rirMin === prescription.rirMax ? prescription.rirMin : `${prescription.rirMin}–${prescription.rirMax}`} RIR${prescription.deload ? ' · deload' : ''}`})]);
    });
  }

  function renderCyclesPanel() {
    const legacyRecords = state.legacyCycles.reduce((sum, cycle) => sum + cycle.records.length, 0);
    const archivedSessions = state.archives.reduce((sum, archive) => sum + archive.sessions.length, 0);
    return panelShell('cycles', 'Ciclos', 'Controle explícito da semana e reinício reversível.', [
      element('section', {className: 'section-card'}, [
        element('h3', {text: 'Periodização ativa'}),
        element('p', {className: 'fine-print', text: 'A semana ativa é escolhida nos botões de 1 a 8 no topo do aplicativo.'}),
        element('div', {className: 'split-list'}, periodizationRows()),
        element('p', {className: 'fine-print', text: 'Alterar a semana atualiza apenas sessões ainda não iniciadas. Sessões antigas preservam a prescrição registrada no dia.'})
      ]),
      element('section', {className: 'card'}, [
        element('h3', {text: 'Zerar periodização'}),
        element('p', {text: 'Arquiva o ciclo e suas sessões, cria um snapshot para desfazer e começa novamente na semana 1. Medidas, caminhada, rotina em casa e ciclos legados permanecem.'}),
        element('div', {className: 'button-row'}, [button('Zerar e iniciar novo ciclo', 'cycle-reset-request', 'danger-button'), button('Desfazer última ação por snapshot', 'snapshot-restore-request', 'secondary-button')])
      ]),
      element('section', {className: 'card'}, [
        element('h3', {text: 'Histórico preservado'}),
        element('div', {className: 'summary-grid'}, [summaryCard('Ciclos novos arquivados', String(state.archives.length), `${archivedSessions} sessões`), summaryCard('Ciclos ABC legados', String(state.legacyCycles.length), `${legacyRecords} registros preservados`)]),
        state.archives.length ? element('div', {className: 'timeline'}, state.archives.slice().reverse().map(archive => element('details', {className: 'timeline-item'}, [
          element('summary', {text: `${formatDateTime(archive.archivedAt)} · ${archive.sessions.length} sessão(ões) · ciclo encerrado na semana ${archive.cycle.currentWeek}`}),
          element('div', {className: 'split-list'}, archive.sessions.slice().sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)).map(session => element('div', {className: 'split-row'}, [
            element('strong', {text: `${formatDate(session.actualDate || session.plannedDate)} · ${(Data.WORKOUT_BY_ID[session.workoutId] && Data.WORKOUT_BY_ID[session.workoutId].label) || session.workoutId}`}),
            element('span', {text: `${SESSION_LABELS[session.status] || session.status} · semana ${session.week}${session.durationSeconds ? ` · ${formatDuration(session.durationSeconds)}` : ''}`})
          ])))
        ]))) : element('p', {className: 'fine-print', text: 'Nenhum ciclo novo foi arquivado ainda.'}),
        state.legacyCycles.length ? element('div', {className: 'split-list'}, state.legacyCycles.map(cycle => element('div', {className: 'split-row'}, [element('strong', {text: cycle.label}), element('span', {text: `schema ${cycle.sourceSchema} · ${cycle.records.length} registros · ${cycle.records.filter(record => record.mappingStatus === 'ambiguous').length} ambíguos`})]))) : null
      ])
    ]);
  }

  function settingToggle(key, label, description) {
    return element('label', {className: 'check-field'}, [
      element('input', {attrs: {type: 'checkbox'}, props: {checked: state.settings[key]}, dataset: {action: 'setting-toggle', setting: key}}),
      element('span', {}, [element('strong', {text: label}), element('small', {text: description})])
    ]);
  }

  // Identificação da build em uso. Serve para conferir, no aparelho, se a
  // publicação nova realmente chegou. O nome do cache nunca é apresentado como
  // se fosse a versão do aplicativo.
  function renderAboutCard() {
    return element('section', {className: 'card', attrs: {id: 'about-card'}}, [
      element('h3', {text: 'Sobre esta versão'}),
      element('div', {className: 'split-list'}, [
        ['Aplicativo', 'Treino Hard (Fofo)'],
        ['Versão do app', Core.APP_VERSION],
        ['Esquema de dados', String(Core.SCHEMA_VERSION)],
        ['Cache do pacote offline', storageInventory.cacheName || 'não identificado']
      ].map(([label, value]) => element('div', {className: 'split-row'}, [
        element('strong', {text: label}),
        element('span', {attrs: {'data-about': label === 'Versão do app' ? 'app-version' : label === 'Esquema de dados' ? 'schema' : ''}, text: value})
      ]))),
      element('p', {className: 'fine-print', text: 'A versão do app e o esquema de dados são independentes: o esquema só muda quando o formato gravado muda.'})
    ]);
  }

  function renderSettingsPanel() {
    return panelShell('settings', 'Ajustes', 'Preferências, modo de agenda, backups e privacidade.', [
      renderAboutCard(),
      element('section', {className: 'section-card'}, [
        element('h3', {text: 'Agenda e experiência'}),
        element('div', {className: 'field-grid'}, [
          field('Modo da agenda', element('select', {className: 'select', dataset: {action: 'setting-mode'}}, [option('calendar', 'Calendário semanal', state.settings.mode === 'calendar'), option('sequence', 'Sequência de pendências', state.settings.mode === 'sequence')])),
          field('Vídeos de apoio', element('select', {className: 'select', dataset: {action: 'setting-video-mode'}}, [
            option('external', 'Abrir no YouTube (usa sua conta/Premium)', state.settings.videoMode === 'external'),
            option('inline', 'Assistir dentro do app', state.settings.videoMode === 'inline'),
            option('ask', 'Perguntar a cada vídeo', state.settings.videoMode === 'ask')
          ]), 'field', 'O app não recebe senha nem token. A opção externa usa a sessão já aberta no YouTube.'),
          settingToggle('autoStartRest', 'Iniciar intervalo ao confirmar série', 'Nunca inicia ao sair de um campo; apenas após o botão “Concluir série”.'),
          settingToggle('sound', 'Som do cronômetro', 'Toca somente após uma interação que permita áudio.'),
          settingToggle('vibration', 'Vibração', 'Quando o aparelho e o navegador permitirem.'),
          settingToggle('largeText', 'Texto ampliado', 'Aumenta o conteúdo principal.'),
          settingToggle('keepAwake', 'Manter tela ativa durante treino', 'Usa o bloqueio de tela do navegador quando disponível.')
        ])
      ]),
      element('section', {className: 'section-card'}, [
        element('h3', {text: 'Rotina em casa'}),
        element('div', {className: 'field-grid is-three'}, [
          field('Frequência sugerida (dias/semana)', element('input', {className: 'input', attrs: {type: 'number', min: '1', max: '7'}, props: {value: String(state.settings.vacuumFrequency)}, dataset: {action: 'setting-number', setting: 'vacuumFrequency'}})),
          field('Repetições', element('input', {className: 'input', attrs: {type: 'number', min: '1', max: '10'}, props: {value: String(state.settings.vacuumRepetitions)}, dataset: {action: 'setting-number', setting: 'vacuumRepetitions'}})),
          field('Duração (s)', element('input', {className: 'input', attrs: {type: 'number', min: '5', max: '120'}, props: {value: String(state.settings.vacuumDuration)}, dataset: {action: 'setting-number', setting: 'vacuumDuration'}}))
        ])
      ]),
      element('section', {className: 'card'}, [
        element('h3', {text: 'Backup e recuperação'}),
        element('p', {text: 'O JSON restaura o aplicativo; o CSV serve para análise e não pode ser importado. A importação mostra uma prévia e cria snapshot antes de substituir o estado.'}),
        element('div', {className: 'button-row'}, [button('Exportar JSON completo', 'export-json', 'primary-button'), button('Exportar JSON criptografado', 'export-encrypted', 'secondary-button'), button('Exportar CSV', 'export-csv', 'secondary-button'), button('Importar JSON com prévia', 'import-open', 'secondary-button'), button('Criar cópia automática agora', 'backup-now', 'secondary-button')]),
        element('p', {className: 'fine-print', text: 'O backup criptografado usa AES-GCM de 256 bits com chave derivada por PBKDF2-SHA-256, salt e vetor de inicialização aleatórios. A senha não é gravada em lugar nenhum: sem ela o arquivo não pode ser aberto. A importação reconhece os dois formatos.'})
      ]),
      renderStorageInventory(),
      element('section', {className: 'privacy-box'}, [
        element('strong', {text: 'Privacidade local'}),
        element('p', {text: 'Os registros ficam no armazenamento deste navegador para esta origem web. Eles não são criptografados e podem ser acessados por pessoas com acesso ao mesmo perfil do aparelho ou por páginas servidas sob a mesma origem. Mantenha backups em local seguro.'}),
        element('p', {text: `Armazenamento em uso: ${storage.mode === 'indexeddb' ? 'IndexedDB' : storage.mode === 'localstorage' ? 'localStorage de fallback' : 'memória temporária'}. Revisão do documento: ${state.revision}.`})
      ])
    ]);
  }

  // Lista as cópias automáticas e os itens de recuperação bruta preservados
  // pelo armazenamento. Sem esta seção não havia como restaurar uma cópia
  // automática nem exportar o material guardado antes de uma migração.
  function renderStorageInventory() {
    const backupRows = storageInventory.backups.map(item => element('div', {className: 'split-row'}, [
      element('strong', {text: `${formatDateTime(item.savedAt)}${item.legacy ? ' · convertida de versão anterior' : ''}`}),
      element('span', {text: `${Array.isArray(item.state && item.state.sessions) ? item.state.sessions.length : 0} sessão(ões) guardadas`}),
      button('Restaurar esta cópia', 'backup-restore-request', 'secondary-button', {backupId: item.id})
    ]));
    const recoveryRows = storageInventory.recoveries.map(item => element('div', {className: 'split-row'}, [
      element('strong', {text: formatDateTime(item.savedAt)}),
      element('span', {text: item.reason || 'Recuperação local'}),
      button('Exportar arquivo bruto', 'recovery-export', 'secondary-button', {recoveryId: item.id})
    ]));
    return element('section', {className: 'card'}, [
      element('h3', {text: 'Cópias automáticas e recuperação bruta'}),
      element('p', {text: 'O aplicativo mantém até três cópias automáticas diárias e preserva o material bruto encontrado antes de uma migração ou importação. Restaurar uma cópia cria antes um snapshot para desfazer.'}),
      storageInventory.error ? element('div', {className: 'warning-box'}, [element('p', {text: storageInventory.error})]) : null,
      element('h4', {text: 'Cópias automáticas'}),
      backupRows.length ? element('div', {className: 'split-list'}, backupRows) : element('div', {className: 'empty-state', text: storageInventory.loaded ? 'Nenhuma cópia automática disponível neste aparelho.' : 'Carregando cópias automáticas…'}),
      element('h4', {text: 'Recuperação bruta'}),
      recoveryRows.length ? element('div', {className: 'split-list'}, recoveryRows) : element('div', {className: 'empty-state', text: storageInventory.loaded ? 'Nenhum material bruto preservado.' : 'Carregando recuperações…'})
    ]);
  }

  async function activeCacheName() {
    if (!('caches' in global)) return '';
    try {
      return (await caches.keys()).find(name => name.startsWith('treino-hard-')) || '';
    } catch (error) {
      return '';
    }
  }

  async function refreshStorageInventory() {
    const cacheName = await activeCacheName();
    try {
      const [backups, recoveries] = await Promise.all([storage.listBackups(), storage.getRecoveryItems()]);
      storageInventory = {backups, recoveries, cacheName, loaded: true, error: ''};
    } catch (error) {
      storageInventory = {backups: [], recoveries: [], cacheName, loaded: true, error: `Não foi possível listar as cópias locais: ${error.message || error}`};
    }
    if (currentTab === 'settings') renderActivePanel();
  }

  async function restoreAutomaticBackup(backupId) {
    try {
      const restored = await storage.restoreBackup(backupId, state);
      state = restored;
      persistedRevision = restored.revision;
      rememberConsistentState(restored);
      closeModal();
      applyPreferences();
      renderTabs();
      renderActivePanel();
      setSaveState('Cópia automática restaurada', false);
      announce('Cópia automática restaurada; um snapshot anterior foi criado para desfazer.');
      await refreshStorageInventory();
    } catch (error) {
      closeModal();
      showNotice(`Não foi possível restaurar a cópia automática: ${error.message || error}. Nada foi alterado.`, 'error');
    }
  }

  function exportRecoveryItem(recoveryId) {
    const item = storageInventory.recoveries.find(entry => entry.id === recoveryId);
    if (!item) { showNotice('Item de recuperação não encontrado.', 'warning'); return; }
    downloadText(JSON.stringify(item, null, 2), `treino-hard-recuperacao-${fileDateStamp()}.json`, 'application/json');
    announce('Arquivo bruto de recuperação exportado.');
  }

  function findSession(id) {
    return state.sessions.find(session => session.id === id) || null;
  }

  function findExerciseLog(session, id) {
    return session ? session.exercises.find(exercise => exercise.id === id) || null : null;
  }

  function findSet(session, exerciseId, setId) {
    const exercise = findExerciseLog(session, exerciseId);
    return {exercise, set: exercise ? exercise.sets.find(item => item.id === setId) || null : null};
  }

  function markSessionStarted(session) {
    if (session.status !== 'planned') return;
    session.status = 'started';
    session.startedAt = new Date().toISOString();
    session.actualDate = Core.localDateKey();
    session.updatedAt = session.startedAt;
  }

  function calculateSessionDuration(session, endTime) {
    if (!session.startedAt) return 0;
    const start = Date.parse(session.startedAt);
    const end = Date.parse(endTime || new Date().toISOString());
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
    let paused = Number(session.pausedSeconds) || 0;
    if (session.status === 'paused' && session.pausedAt) paused += Math.max(0, (end - Date.parse(session.pausedAt)) / 1000);
    return Math.max(0, Math.round((end - start) / 1000 - paused));
  }

  function closeSessionTiming(session, endTime) {
    const duration = calculateSessionDuration(session, endTime);
    if (session.status === 'paused' && session.pausedAt) {
      const pauseStart = Date.parse(session.pausedAt);
      const end = Date.parse(endTime);
      if (Number.isFinite(pauseStart) && Number.isFinite(end) && end >= pauseStart) {
        session.pausedSeconds = Math.max(0, Number(session.pausedSeconds) || 0) + Math.round((end - pauseStart) / 1000);
      }
    }
    session.pausedAt = '';
    session.durationSeconds = duration;
  }

  function sessionFullyRecorded(session) {
    return session.exercises.every(log => {
      if (!log.sets.length) return log.completed || log.skipped;
      return log.sets.filter(set => set.type === 'work').every(Core.isSetConfirmed);
    });
  }

  function recordProgressionDecisions(session) {
    // Percorre os registros da sessão para que exercícios unilaterais gerem uma
    // decisão por lado, sem misturar as cargas dos dois lados.
    const currentSeriesKeys = new Set();
    session.exercises.forEach(log => {
      const exercise = Data.findExercise(session.workoutId, log.exerciseId);
      if (!exercise || exercise.type !== 'strength') return;
      const range = `${log.prescriptionSnapshot.min}-${log.prescriptionSnapshot.max}`;
      const seriesKey = Core.comparableSeriesKey(log.exerciseId, log.variationId, log.machineId, log.side, range);
      currentSeriesKeys.add(seriesKey);
      const recommendation = Core.doubleProgressionRecommendation(exercise, log, session.week);
      const workSets = log.sets.filter(isProgressionEligibleSet);
      const existing = state.progressionDecisions.find(item => item.sessionId === session.id && item.seriesKey === seriesKey);
      const payload = {
        sessionId: session.id,
        exerciseId: log.exerciseId,
        seriesKey,
        date: session.actualDate || session.plannedDate,
        recommendation: recommendation.code,
        message: recommendation.message,
        load: workSets.map(set => Number(set.load) || 0).sort((a, b) => b - a)[0] || '',
        result: workSets.map(set => set.reps || '—').join(' / '),
        rir: workSets.map(set => set.rir || 'não informado').join(' / '),
        savedAt: new Date().toISOString()
      };
      if (existing) {
        const changed = ['recommendation', 'message', 'load', 'result', 'rir'].some(field => String(existing[field]) !== String(payload[field]));
        Object.assign(existing, payload);
        if (changed) {
          existing.decision = 'pending';
          existing.nextLoad = '';
        }
      } else {
        state.progressionDecisions.push(Object.assign({id: Core.uid('progression'), decision: 'pending', nextLoad: ''}, payload));
      }
    });
    // Uma sessão reaberta pode mudar máquina, variação ou faixa. Nesse caso a
    // decisão antiga deixa de representar o registro atual e não pode aparecer
    // em duplicidade no histórico.
    const retainedSeriesKeys = new Set();
    state.progressionDecisions = state.progressionDecisions.filter(item => {
      if (item.sessionId !== session.id) return true;
      if (!currentSeriesKeys.has(item.seriesKey) || retainedSeriesKeys.has(item.seriesKey)) return false;
      retainedSeriesKeys.add(item.seriesKey);
      return true;
    });
  }

  async function startSession(session) {
    markSessionStarted(session);
    if (await persist('Treino iniciado.', true)) await requestWakeLock();
  }

  async function pauseSession(session) {
    if (session.status !== 'started') return;
    session.status = 'paused';
    session.pausedAt = new Date().toISOString();
    session.updatedAt = session.pausedAt;
    if (await persist('Treino pausado.', true)) await releaseWakeLock();
  }

  async function resumeSession(session) {
    if (session.status !== 'paused') return;
    const now = new Date().toISOString();
    if (session.pausedAt) session.pausedSeconds += Math.max(0, Math.round((Date.parse(now) - Date.parse(session.pausedAt)) / 1000));
    session.pausedAt = '';
    session.status = 'started';
    session.updatedAt = now;
    if (await persist('Treino retomado.', true)) await requestWakeLock();
  }

  function pendingItems(session) {
    const workout = Data.WORKOUT_BY_ID[session.workoutId];
    if (!workout) return {exercicios: 0, series: 0};
    let exercicios = 0;
    let series = 0;
    workout.exercises.forEach(exercise => {
      const logs = session.exercises.filter(log => log.exerciseId === exercise.id);
      if (!logs.length) return;
      if (exercise.type === 'mobility') {
        if (!logs[0].completed && !logs[0].skipped) exercicios += 1;
        return;
      }
      const faltando = logs.reduce((total, log) => total + log.sets.filter(set => set.type === 'work' && !Core.isSetConfirmed(set)).length, 0);
      if (faltando) {
        exercicios += 1;
        series += faltando;
      }
    });
    return {exercicios, series};
  }

  async function finalizeSession(session, status) {
    // Cliques repetidos durante a cópia automática não podem finalizar a mesma
    // sessão duas vezes nem duplicar decisões de progressão.
    if (!session || TERMINAL_STATUSES.has(session.status)) return false;
    if (status === 'completed' && !sessionFullyRecorded(session)) {
      const faltam = pendingItems(session);
      openModal('Ainda falta registrar', element('div', {}, [
        element('p', {text: `Existem ${faltam.exercicios} exercício(s) incompleto(s) e ${faltam.series} série(s) sem confirmação.`}),
        element('p', {className: 'fine-print', text: 'Encerrar como parcial preserva o que foi registrado e mantém explícito o que não foi feito. Nada é marcado como concluído no seu lugar.'}),
        element('div', {className: 'button-row'}, [
          button('Voltar ao treino', 'close-modal', 'primary-button'),
          button('Finalizar parcialmente', 'session-partial-confirm', 'secondary-button', {sessionId: session.id})
        ])
      ]));
      return;
    }
    const completedAt = new Date().toISOString();
    closeSessionTiming(session, completedAt);
    session.status = status;
    session.completedAt = completedAt;
    session.actualDate = session.actualDate || Core.localDateKey();
    session.updatedAt = completedAt;
    recordProgressionDecisions(session);
    const saved = await persist(status === 'completed' ? 'Treino do dia concluído.' : 'Treino encerrado como parcial.', true);
    if (!saved) return false;
    stopTimer();
    await releaseWakeLock();
    try {
      await storage.automaticBackup(state, true);
      lastBackupState = 'Cópia automática atualizada agora';
    } catch (error) {
      lastBackupState = 'Falha na cópia automática após a conclusão';
      showNotice(`O treino foi salvo, mas a cópia automática falhou: ${error.message || error}`, 'warning');
    }
    showSessionSummary(session, status);
    return true;
  }

  // Resumo factual do que foi registrado. Sem pontuação nem gamificação.
  function showSessionSummary(session, status) {
    const workout = Data.WORKOUT_BY_ID[session.workoutId];
    const progresso = exerciseProgress(session);
    const series = session.exercises.flatMap(log => log.sets.filter(set => set.type === 'work'));
    const confirmadas = series.filter(Core.isSetConfirmed);
    const volume = series.filter(isProgressionEligibleSet).reduce((total, set) => total + (Number(set.load) || 0) * (Number(set.reps) || 0), 0);
    const melhores = session.exercises.map(log => {
      const exercise = Data.findExercise(session.workoutId, log.exerciseId);
      const melhor = log.sets.filter(set => isProgressionEligibleSet(set) && set.load && set.reps)
        .sort((a, b) => (Number(b.load) || 0) - (Number(a.load) || 0) || (Number(b.reps) || 0) - (Number(a.reps) || 0))[0];
      return melhor && exercise ? `${exercise.name}${log.side !== 'bilateral' ? ` (${log.side === 'left' ? 'esq.' : 'dir.'})` : ''} · ${melhor.load} × ${melhor.reps}` : null;
    }).filter(Boolean).slice(0, 5);
    const desconfortos = session.exercises.filter(log => ['pain', 'awkward'].includes(log.feeling)).length;
    const linha = (rotulo, valor) => element('div', {className: 'split-row'}, [element('strong', {text: rotulo}), element('span', {text: valor})]);

    openModal(status === 'completed' ? 'Treino concluído' : 'Treino encerrado como parcial', element('div', {}, [
      element('p', {className: 'cdetail', text: `${workout.label} · Semana ${session.week}`}),
      element('div', {className: 'split-list'}, [
        linha('Duração', session.durationSeconds ? formatDuration(session.durationSeconds) : 'não registrada'),
        linha('Exercícios', `${progresso.done}/${progresso.total}`),
        linha('Séries confirmadas', `${confirmadas.length}/${series.length}`),
        linha('Volume registrado', `${Math.round(volume).toLocaleString('pt-BR')} kg`),
        linha('Desconforto registrado', desconfortos ? `${desconfortos} exercício(s)` : 'nenhum')
      ]),
      melhores.length ? element('div', {className: 'summarybest'}, [
        element('strong', {text: 'Melhores séries'}),
        element('ul', {className: 'notes'}, melhores.map(texto => element('li', {text: texto})))
      ]) : null,
      element('div', {className: 'button-row'}, [
        button('Ver evolução', 'summary-evolution', 'secondary-button'),
        button('Voltar para Hoje', 'summary-today', 'primary-button')
      ])
    ]));
  }

  function refreshExerciseCompletion(log) {
    const workSets = log.sets.filter(set => set.type === 'work');
    log.completed = workSets.length > 0 && workSets.every(Core.isSetConfirmed);
  }

  async function completeSet(session, log, set) {
    const previousUndo = lastSetUndo;
    const previousSet = Core.deepClone(set);
    const confirmedStatus = set.status || 'completed';
    if (confirmedStatus === 'completed' && !set.reps) {
      showNotice('Informe as repetições ou escolha outro status antes de concluir a série.', 'warning');
      return;
    }
    markSessionStarted(session);
    lastSetUndo = {
      sessionId: session.id,
      exerciseId: log.id,
      setId: set.id,
      previous: previousSet,
      exerciseCompleted: log.completed
    };
    set.status = confirmedStatus;
    set.completedAt = new Date().toISOString();
    refreshExerciseCompletion(log);
    session.updatedAt = set.completedAt;
    const saved = await persist('Série confirmada.', true);
    if (!saved) {
      lastSetUndo = previousUndo;
      return false;
    }
    await requestWakeLock();
    if (state.settings.autoStartRest && set.nextRestSeconds) startTimer(set.nextRestSeconds, Data.CATALOG[log.exerciseId] ? Data.CATALOG[log.exerciseId].name : 'Exercício', {sessionId: session.id, exerciseId: log.id, setId: set.id});
    return true;
  }

  async function undoLastSet() {
    if (!lastSetUndo) {
      announce('Não há série recente para desfazer.');
      return;
    }
    const undo = lastSetUndo;
    const session = findSession(undo.sessionId);
    if (!isSessionEditable(session)) {
      showNotice('Reabra a sessão antes de desfazer uma série.', 'warning');
      return;
    }
    const found = findSet(session, undo.exerciseId, undo.setId);
    if (!found.set) return;
    Object.assign(found.set, Core.deepClone(undo.previous));
    found.exercise.completed = undo.exerciseCompleted;
    const saved = await persist('Última alteração desfeita.', true);
    if (!saved) {
      lastSetUndo = undo;
      return;
    }
    lastSetUndo = null;
    stopTimer();
  }

  function startTimer(seconds, label, context) {
    const duration = Math.max(0, Math.min(1800, Number(seconds) || 0));
    if (!duration) return;
    timerDeadline = Date.now() + duration * 1000;
    timerContext = context || null;
    dom.timerLabel.textContent = `Intervalo · ${label}`;
    dom.timerBar.hidden = false;
    updateTimer();
    global.clearInterval(timerInterval);
    timerInterval = global.setInterval(updateTimer, 250);
    if (state.settings.vibration && navigator.vibrate) navigator.vibrate(40);
  }

  function addTimerSeconds(seconds) {
    const extra = Math.max(0, Math.min(1800, Number(seconds) || 0));
    if (!extra || !timerDeadline) return;
    const now = Date.now();
    timerDeadline = Math.max(timerDeadline, now) + extra * 1000;
    dom.timerAnnouncement.textContent = '';
    dom.timerBar.hidden = false;
    updateTimer();
    if (!timerInterval) timerInterval = global.setInterval(updateTimer, 250);
  }

  function updateTimer() {
    const seconds = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
    dom.timerNumber.textContent = formatDuration(seconds);
    dom.timerNumber.setAttribute('aria-label', `${seconds} segundos restantes`);
    if (seconds > 0) return;
    global.clearInterval(timerInterval);
    timerInterval = 0;
    dom.timerAnnouncement.textContent = 'Intervalo concluído.';
    if (state.settings.vibration && navigator.vibrate) navigator.vibrate([120, 80, 120]);
    if (state.settings.sound) playTimerSound();
  }

  function playTimerSound() {
    try {
      const AudioContext = global.AudioContext || global.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 740;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
      oscillator.addEventListener('ended', () => context.close());
    } catch (error) {
      showNotice(`O aviso sonoro não pôde ser tocado: ${error.message || error}`, 'warning');
    }
  }

  function stopTimer() {
    global.clearInterval(timerInterval);
    timerInterval = 0;
    timerDeadline = 0;
    timerContext = null;
    dom.timerBar.hidden = true;
    dom.timerAnnouncement.textContent = '';
  }

  async function requestWakeLock() {
    if (!state || !state.settings.keepAwake || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (error) {
      showNotice(`Não foi possível manter a tela ativa: ${error.message || error}`, 'warning');
    }
  }

  async function releaseWakeLock() {
    if (!wakeLock) return;
    try { await wakeLock.release(); } catch (error) { console.warn('Falha ao liberar bloqueio de tela.', error); }
    wakeLock = null;
  }

  function openModal(title, content) {
    modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dom.modalTitle.textContent = title;
    dom.modalContent.replaceChildren(content);
    dom.modal.hidden = false;
    dom.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const focusable = modalFocusable(dom.modal);
    if (focusable[0]) focusable[0].focus();
  }

  function closeModal() {
    dom.modal.hidden = true;
    dom.modal.setAttribute('aria-hidden', 'true');
    dom.modalContent.replaceChildren();
    document.body.classList.remove('modal-open');
    if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus();
    modalReturnFocus = null;
  }

  function confirmationModal(title, message, action, dataset, confirmLabel) {
    openModal(title, element('div', {}, [
      element('p', {text: message}),
      element('div', {className: 'button-row'}, [button(confirmLabel || 'Confirmar', action, 'danger-button', dataset), button('Voltar', 'close-modal', 'secondary-button')])
    ]));
  }

  function modalFocusable(container) {
    return [...container.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')].filter(node => !node.hidden);
  }

  function trapModalFocus(event, container) {
    if (event.key !== 'Tab') return;
    const items = modalFocusable(container);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function playableVideo(video) {
    return videoUsavel(video) && Boolean(video.url);
  }

  function externalVideoUrl(video) {
    if (!playableVideo(video) || !video.startSeconds) return video && video.url ? video.url : '';
    const url = new URL(video.url);
    url.searchParams.set('t', `${video.startSeconds}s`);
    return url.href;
  }

  function openVideo(videoKey) {
    const video = Data.VIDEOS[videoKey];
    if (!playableVideo(video)) {
      showNotice(video && video.availability === 'removed_or_private'
        ? 'Este vídeo não está mais disponível. Nenhum substituto será aberto automaticamente.'
        : 'Vídeo pendente de curadoria; nenhum player incorreto será aberto.', 'warning');
      return;
    }
    if (!navigator.onLine) {
      showNotice('Os vídeos de apoio exigem internet. O restante do treino continua disponível offline.', 'warning');
      return;
    }
    // O proprietário deste vídeo bloqueia incorporação: não há o que perguntar.
    if (!videoIncorporavel(video)) { openVideoExternally(videoKey); return; }
    if (state.settings.videoMode === 'external') { openVideoExternally(videoKey); return; }
    if (state.settings.videoMode === 'inline') { openVideoInline(videoKey); return; }
    confirmationModal('Como deseja assistir?', 'Abrir no YouTube aproveita a conta já autenticada no navegador ou aplicativo. O Treino Hard não acessa suas credenciais.', 'video-open-external', {videoKey}, 'Abrir no YouTube');
    const row = dom.modalContent.querySelector('.button-row');
    if (row) row.insertBefore(button('Assistir dentro do app', 'video-open-inline', 'secondary-button', {videoKey}), row.lastChild);
  }

  function openVideoExternally(videoKey) {
    const video = Data.VIDEOS[videoKey];
    if (!playableVideo(video)) return;
    const anchor = element('a', {attrs: {href: externalVideoUrl(video), target: '_blank', rel: 'noopener noreferrer'}});
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (!dom.modal.hidden) closeModal();
  }

  function openVideoInline(videoKey) {
    const video = Data.VIDEOS[videoKey];
    if (!playableVideo(video)) return;
    if (!videoIncorporavel(video)) {
      showNotice('Este vídeo não permite reprodução dentro do app. Abrindo no YouTube.', 'warning');
      openVideoExternally(videoKey);
      return;
    }
    if (!dom.modal.hidden) closeModal();
    modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dom.videoTitle.textContent = video.title || 'Vídeo de apoio';
    const parameters = new URLSearchParams({rel: '0'});
    if (video.startSeconds) parameters.set('start', String(video.startSeconds));
    if (/^https?:$/.test(location.protocol)) parameters.set('origin', location.origin);
    const iframe = element('iframe', {attrs: {src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.youtubeId)}?${parameters}`, title: video.title || 'Vídeo de apoio', allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture', referrerpolicy: 'strict-origin-when-cross-origin', allowfullscreen: true}});
    dom.videoStage.replaceChildren(iframe);
    dom.videoExternal.href = externalVideoUrl(video);
    dom.videoExternal.hidden = false;
    dom.videoModal.hidden = false;
    dom.videoModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const closeButton = dom.videoModal.querySelector('[data-action="close-video"]');
    if (closeButton) closeButton.focus();
  }

  function closeVideo() {
    dom.videoModal.hidden = true;
    dom.videoModal.setAttribute('aria-hidden', 'true');
    dom.videoStage.replaceChildren();
    dom.videoExternal.hidden = true;
    document.body.classList.remove('modal-open');
    if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus();
    modalReturnFocus = null;
  }

  function safeAsyncEvent(handler) {
    return event => {
      Promise.resolve(handler(event)).catch(error => {
        setSaveState('Ação não concluída', true);
        showNotice(`A ação foi interrompida sem alterar o documento: ${error.message || error}`, 'error');
      });
    };
  }

  function attachEventListeners() {
    document.addEventListener('click', safeAsyncEvent(handleClick));
    document.addEventListener('input', handleInput);
    document.addEventListener('change', safeAsyncEvent(handleChange));
    document.addEventListener('submit', safeAsyncEvent(handleSubmit));
    document.addEventListener('keydown', handleKeyDown);
    global.addEventListener('online', updateOnlineStatus);
    global.addEventListener('offline', updateOnlineStatus);
    global.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      dom.installButton.hidden = false;
    });
    global.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      dom.installButton.hidden = true;
      announce('Aplicativo instalado.');
    });
    document.addEventListener('visibilitychange', () => { void handleForegroundReturn(); });
  }

  async function handleForegroundReturn() {
    if (document.visibilityState !== 'visible' || !state) return;
    try {
      const today = Core.localDateKey();
      if (today !== lastForegroundDate) {
        lastForegroundDate = today;
        if (!storage.writeBlocked && ensureCurrentWeekSessions() && !(await persist('A agenda foi atualizada para a nova data.', true))) return;
        renderActivePanel();
      }
      if (state.sessions.some(session => session.status === 'started')) await requestWakeLock();
    } catch (error) {
      showNotice(`Não foi possível atualizar a agenda ao voltar ao aplicativo: ${error.message || error}`, 'error');
    }
  }

  async function handleClick(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!target) return;
    const action = target.dataset.action;
    if (target.tagName === 'A' && action !== 'open-video') return;
    if (blockReadOnlyMutation(action, false)) return;
    if (action === 'activate-tab') { selectedSessionId = ''; activateTab(target.dataset.tab, false); return; }
    if (action === 'cycle-week-set') { await changeCycleWeek(Number(target.dataset.week)); return; }
    if (action === 'open-workout') { selectedSessionId = target.dataset.sessionId || ''; activateTab(target.dataset.workoutId, true); return; }
    if (action === 'close-modal') { closeModal(); return; }
    if (action === 'close-video') { closeVideo(); return; }
    if (action === 'open-video') { openVideo(target.dataset.videoKey); return; }
    if (action === 'video-open-external') { openVideoExternally(target.dataset.videoKey); return; }
    if (action === 'video-open-inline') { openVideoInline(target.dataset.videoKey); return; }
    if (action === 'timer-stop') { stopTimer(); return; }
    if (action === 'timer-add') { addTimerSeconds(30); return; }
    if (action === 'timer-undo') { await undoLastSet(); return; }
    if (action === 'install-app') { await installApp(); return; }
    if (action === 'pwa-update') { applyPwaUpdate(); return; }
    if (action === 'reload-external') { await reloadExternalState(); return; }
    if (action === 'export-json') { exportJson(); return; }
    if (action === 'export-encrypted') { openEncryptedExportModal(); return; }
    if (action === 'export-encrypted-confirm') { await exportEncryptedJson(); return; }
    if (action === 'export-csv') { exportCsv(); return; }
    if (action === 'import-open') { dom.importFile.value = ''; dom.importFile.click(); return; }
    if (action === 'import-decrypt') { await decryptPendingImport(); return; }
    if (action === 'import-confirm') { await confirmImport(); return; }
    if (action === 'backup-now') { await createBackupNow(); return; }
    if (action === 'backup-restore-request') {
      confirmationModal('Restaurar cópia automática', 'O documento atual será substituído pela cópia automática escolhida. Um snapshot do estado atual será criado antes da troca.', 'backup-restore-confirm', {backupId: target.dataset.backupId}, 'Restaurar cópia');
      return;
    }
    if (action === 'backup-restore-confirm') { await restoreAutomaticBackup(target.dataset.backupId); return; }
    if (action === 'recovery-export') { exportRecoveryItem(target.dataset.recoveryId); return; }
    if (action === 'cycle-reset-request') {
      confirmationModal('Zerar periodização', 'O ciclo atual e todas as sessões serão arquivados. Um snapshot será criado antes da mudança. Medidas, caminhada, rotina em casa e histórico legado permanecerão.', 'cycle-reset-confirm', {}, 'Arquivar e começar na semana 1');
      return;
    }
    if (action === 'cycle-reset-confirm') { await resetCycle(); return; }
    if (action === 'snapshot-restore-request') {
      confirmationModal('Desfazer pelo snapshot', 'O estado atual será substituído pelo snapshot mais recente. Um novo snapshot de segurança será criado antes da restauração.', 'snapshot-restore-confirm', {}, 'Restaurar snapshot');
      return;
    }
    if (action === 'snapshot-restore-confirm') { await restoreSnapshot(); return; }
    if (action === 'plan-workout-today') { await planWorkoutToday(target.dataset.workoutId); return; }
    const mutationSession = findSession(target.dataset.sessionId);
    if (TERMINAL_MUTATION_ACTIONS.has(action) && mutationSession && !isSessionEditable(mutationSession)) {
      showNotice('Esta sessão está encerrada. Reabra a sessão antes de alterar seus registros.', 'warning');
      return;
    }
    if (action === 'copy-previous-loads') { await copyPreviousLoads(target.dataset.sessionId, target.dataset.exerciseId); return; }
    if (action === 'exercise-history') {
      const alvo = findSession(target.dataset.sessionId);
      const registro = findExerciseLog(alvo, target.dataset.exerciseId);
      if (!alvo || !registro) return;
      const exercicio = Data.findExercise(alvo.workoutId, registro.exerciseId);
      if (exercicio) showExerciseHistory(alvo, exercicio, registro);
      return;
    }

    const session = findSession(target.dataset.sessionId);
    if (action.startsWith('session-') && !session) return;
    if (action === 'session-start') { await startSession(session); return; }
    if (action === 'session-pause') { await pauseSession(session); return; }
    if (action === 'session-resume') { await resumeSession(session); return; }
    if (action === 'session-complete') { await finalizeSession(session, 'completed'); return; }
    if (action === 'session-partial') {
      confirmationModal('Encerrar treino parcial', 'Os itens registrados serão preservados e os não realizados continuarão explícitos no histórico.', 'session-partial-confirm', {sessionId: session.id}, 'Encerrar como parcial');
      return;
    }
    if (action === 'session-partial-confirm') { await finalizeSession(session, 'partial'); return; }
    if (action === 'session-skip') {
      confirmationModal('Pular sessão', 'A sessão ficará registrada como pulada. Ela não será contada como realizada.', 'session-skip-confirm', {sessionId: session.id}, 'Registrar como pulada');
      return;
    }
    if (action === 'session-skip-confirm') { if (await setTerminalSessionStatus(session, 'skipped')) closeModal(); return; }
    if (action === 'session-cancel') {
      confirmationModal('Cancelar sessão', 'A sessão continuará no histórico como cancelada.', 'session-cancel-confirm', {sessionId: session.id}, 'Cancelar sessão');
      return;
    }
    if (action === 'session-cancel-confirm') { if (await setTerminalSessionStatus(session, 'cancelled')) closeModal(); return; }
    if (action === 'session-reschedule') { openRescheduleModal(session); return; }
    if (action === 'session-reschedule-confirm') { await confirmReschedule(session); return; }
    if (action === 'session-reopen') { await reopenSession(session); return; }

    const found = findSet(session, target.dataset.exerciseId, target.dataset.setId);
    if (action === 'set-complete' && found.set) { await completeSet(session, found.exercise, found.set); return; }
    if (action === 'timer-start-set' && found.set) {
      startTimer(found.set.nextRestSeconds, Data.CATALOG[found.exercise.exerciseId] ? Data.CATALOG[found.exercise.exerciseId].name : 'Exercício', {sessionId: session.id, exerciseId: found.exercise.id, setId: found.set.id});
      return;
    }
    if (action === 'mobility-complete') { await toggleMobility(session, target.dataset.exerciseId, 'completed'); return; }
    if (action === 'mobility-skip') { await toggleMobility(session, target.dataset.exerciseId, 'skipped'); return; }
    if (action === 'goto-exercise') {
      const alvo = document.getElementById(`exercicio-${target.dataset.exerciseId}`);
      if (alvo) {
        alvo.scrollIntoView({behavior: 'smooth', block: 'start'});
        const primeiro = alvo.querySelector('input, select, button');
        if (primeiro) primeiro.focus({preventScroll: true});
      }
      return;
    }
    if (action === 'summary-evolution') { closeModal(); activateTab('evolution', true); return; }
    if (action === 'summary-today') { closeModal(); activateTab('today', true); return; }
    if (action === 'side-pick') {
      sideSelection[`${target.dataset.sessionId}:${target.dataset.exerciseId}`] = target.dataset.side === 'left' ? 'left' : 'right';
      renderActivePanel();
      return;
    }
    if (action === 'repeat-first-set') { await repeatFirstWorkSet(session, target.dataset.exerciseId); return; }
    if (action === 'exercise-complete') { await toggleExerciseCompleted(session, target.dataset.exerciseId); return; }
    if (action === 'feeling-pick') { await pickFeeling(session, target.dataset.exerciseId, target.dataset.feeling); return; }
    if (action === 'copy-feedback') { await copyFeedbackReport(session, target.dataset.exerciseId); return; }
    if (action === 'timer-start-rest') {
      const log = findExerciseLog(session, target.dataset.exerciseId);
      const name = log && Data.CATALOG[log.exerciseId] ? Data.CATALOG[log.exerciseId].name : 'Exercício';
      startTimer(Number(target.dataset.seconds) || 90, name, log ? {sessionId: session.id, exerciseId: log.id, setId: ''} : null);
      return;
    }
    if (action === 'variation-pick') {
      const log = findExerciseLog(session, target.dataset.exerciseId);
      if (log) await requestVariationChange(session, log, target.dataset.variationId);
      return;
    }
    if (action === 'variation-confirm') { await confirmVariation(target.dataset.sessionId, target.dataset.exerciseId, target.dataset.variationId); }
  }

  async function handleChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (target === dom.importFile) { await previewImportFile(target.files && target.files[0]); return; }
    const action = target.dataset.action;
    if (!action) return;
    if (action === 'evolution-key') { evolutionSelection.key = target.value; renderActivePanel(); return; }
    if (action === 'evolution-metric') { evolutionSelection.metric = target.value; renderActivePanel(); return; }
    if (blockReadOnlyMutation(action, true)) return;
    if (action === 'setting-mode') { state.settings.mode = target.value === 'sequence' ? 'sequence' : 'calendar'; await persist('Modo de agenda atualizado.', true); return; }
    if (action === 'setting-video-mode') { state.settings.videoMode = ['external', 'inline', 'ask'].includes(target.value) ? target.value : 'external'; await persist('Preferência de vídeo atualizada.', true); return; }
    if (action === 'setting-toggle') { state.settings[target.dataset.setting] = target.checked; applyPreferences(); await persist('Preferência atualizada.', true); return; }
    if (action === 'setting-number') {
      const key = target.dataset.setting;
      const limits = {vacuumFrequency: [1, 7], vacuumRepetitions: [1, 10], vacuumDuration: [5, 120]};
      const [min, max] = limits[key];
      state.settings[key] = Math.max(min, Math.min(max, Number(target.value) || min));
      await persist('Configuração da rotina atualizada.', true);
      return;
    }
    if (action === 'progression-decision') {
      const decision = state.progressionDecisions.find(item => item.id === target.dataset.decisionId);
      if (decision) { decision.decision = ['pending', 'accepted', 'maintained', 'rejected'].includes(target.value) ? target.value : 'pending'; await persist('Decisão de progressão registrada.', false); }
      return;
    }
    if (action === 'progression-next-load') {
      const decision = state.progressionDecisions.find(item => item.id === target.dataset.decisionId);
      if (decision) { decision.nextLoad = Core.numericString(target.value, {max: 5000, decimals: 2}); await persist('Carga posterior registrada.', false); }
      return;
    }
    const session = findSession(target.dataset.sessionId);
    const log = findExerciseLog(session, target.dataset.exerciseId);
    if (!session || !log) return;
    if (TERMINAL_MUTATION_ACTIONS.has(action) && !isSessionEditable(session)) {
      showNotice('Esta sessão está encerrada. Reabra a sessão antes de alterar seus registros.', 'warning');
      renderActivePanel();
      return;
    }
    if (action === 'set-field') {
      const set = log.sets.find(item => item.id === target.dataset.setId);
      if (!set) return;
      const fieldName = target.dataset.field;
      assignSetField(set, fieldName, target.value);
      refreshExerciseCompletion(log);
      // Inputs de carga e repetições já atualizam o estado durante `input`.
      // Remontá-los no `change` pode roubar o foco do campo seguinte enquanto
      // o IndexedDB termina de gravar. Selects ainda redesenham a semântica da
      // série, preservando o foco vivo e os <details> abertos acima.
      const rerender = ['rir', 'status'].includes(fieldName);
      await persist('Série atualizada.', rerender, rerender ? {focusDescriptor: captureFocusDescriptor(target)} : {});
      return;
    }
    if (action === 'set-rest-select') {
      if (target.value !== 'custom') {
        const set = log.sets.find(item => item.id === target.dataset.setId);
        if (set) { set.nextRestSeconds = Number(target.value) || 0; await persist('Intervalo da série atualizado.', true); }
      }
      return;
    }
    if (action === 'exercise-field') {
      assignExerciseField(log, target.dataset.field, target.value);
      // Trocar a identificação da máquina troca o histórico comparável: a
      // referência do treino anterior na tela precisa acompanhar. O evento é
      // `change` (sai do campo), não `input`, então isso não atrapalha a digitação.
      await persist('Registro do exercício atualizado.', target.dataset.field === 'machineId');
      return;
    }
    if (action === 'mobility-flag') { log.mobilityFeedback[target.dataset.side][target.dataset.flag] = target.checked; await persist('Feedback de mobilidade atualizado.', false); return; }
    if (action === 'mobility-note') { log.mobilityFeedback.note = Core.cleanText(target.value, 300); await persist('Observação de mobilidade atualizada.', false); return; }
    if (action === 'variation-change') { await requestVariationChange(session, log, target.value); return; }
    if (action === 'high-rep-toggle') { updateHighRepPreference(session, log, target.checked); await persist('Faixa preferencial atualizada.', true); }
  }

  function assignSetField(set, fieldName, value) {
    const previous = String(set[fieldName] == null ? '' : set[fieldName]);
    const wasConfirmed = Core.isSetConfirmed(set);
    if (fieldName === 'load') set.load = Core.numericString(value, {max: 5000, decimals: 2});
    else if (fieldName === 'reps') set.reps = Core.integerString(value, 1000);
    else if (fieldName === 'rir') set.rir = Core.VALID_RIR.has(value) ? value : '';
    else if (fieldName === 'status') {
      const nextStatus = Core.SET_STATUSES.has(value) ? value : '';
      if (nextStatus !== set.status) set.completedAt = '';
      set.status = nextStatus;
    }
    else if (fieldName === 'nextRestSeconds') set.nextRestSeconds = Math.max(0, Math.min(1800, Number(value) || 0));
    else if (fieldName === 'note') set.note = Core.cleanText(value, 200);
    if (['load', 'reps', 'rir'].includes(fieldName) && String(set[fieldName]) !== previous) set.completedAt = '';
    return wasConfirmed && !Core.isSetConfirmed(set);
  }

  function assignExerciseField(log, fieldName, value) {
    if (fieldName === 'machineId') log.machineId = Core.cleanText(value, 80);
    else if (fieldName === 'feeling') log.feeling = FEELING_OPTIONS.some(optionItem => optionItem[0] === value) ? value : '';
    else if (fieldName === 'feedback') log.feedback = Core.cleanText(value, 300);
  }

  function handleInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    const action = target.dataset.action;
    if (!['set-field', 'exercise-field', 'mobility-note'].includes(action)) return;
    if (blockReadOnlyMutation(action, true)) return;
    const session = findSession(target.dataset.sessionId);
    const log = findExerciseLog(session, target.dataset.exerciseId);
    if (!session || !log) return;
    if (!isSessionEditable(session)) {
      renderActivePanel();
      return;
    }
    if (action === 'set-field') {
      const set = log.sets.find(item => item.id === target.dataset.setId);
      if (set) {
        const invalidated = assignSetField(set, target.dataset.field, target.value);
        refreshExerciseCompletion(log);
        if (invalidated) {
          const row = target.closest('.set-row');
          if (row) {
            row.classList.remove('is-complete');
            const confirmation = row.querySelector('[data-action="set-complete"]');
            if (confirmation) {
              confirmation.classList.remove('on');
              confirmation.textContent = '○';
              confirmation.setAttribute('aria-pressed', 'false');
              confirmation.setAttribute('aria-label', String(confirmation.getAttribute('aria-label') || '').replace(/^Atualizar/, 'Concluir'));
            }
          }
        }
      }
    } else if (action === 'exercise-field') assignExerciseField(log, target.dataset.field, target.value);
    else log.mobilityFeedback.note = Core.cleanText(target.value, 300);
  }

  function handleKeyDown(event) {
    if (!dom.modal.hidden) {
      if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
      trapModalFocus(event, dom.modal);
      return;
    }
    if (!dom.videoModal.hidden) {
      if (event.key === 'Escape') { event.preventDefault(); closeVideo(); return; }
      trapModalFocus(event, dom.videoModal);
      return;
    }
    const tab = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
    if (!tab) return;
    const count = TAB_DEFINITIONS.length;
    let nextIndex = tabFocusIndex;
    if (event.key === 'ArrowRight') nextIndex = (tabFocusIndex + 1) % count;
    else if (event.key === 'ArrowLeft') nextIndex = (tabFocusIndex - 1 + count) % count;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = count - 1;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateTab(tab.dataset.tab, true);
      return;
    } else return;
    event.preventDefault();
    tabFocusIndex = nextIndex;
    renderTabs();
    const nextTab = document.getElementById(`tab-${TAB_DEFINITIONS[nextIndex].id}`);
    if (nextTab) nextTab.focus();
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.form) return;
    event.preventDefault();
    if (blockReadOnlyMutation(`form-${form.dataset.form}`, true)) return;
    const data = new FormData(form);
    if (form.dataset.form === 'cardio') await saveCardio(data, form);
    else if (form.dataset.form === 'home') await saveHomeRoutine(data, form);
    else if (form.dataset.form === 'measurement') await saveMeasurement(data, form);
  }

  async function setTerminalSessionStatus(session, status) {
    const completedAt = new Date().toISOString();
    closeSessionTiming(session, completedAt);
    session.status = status;
    session.completedAt = completedAt;
    session.updatedAt = session.completedAt;
    const saved = await persist(`Sessão registrada como ${SESSION_LABELS[status].toLowerCase()}.`, true);
    if (!saved) return false;
    await releaseWakeLock();
    return true;
  }

  function openRescheduleModal(session) {
    const input = element('input', {className: 'input', attrs: {type: 'date', id: 'reschedule-date', min: Core.localDateKey(), required: true}, props: {value: session.plannedDate}});
    openModal('Remarcar sessão', element('div', {}, [
      field('Nova data planejada', input),
      element('p', {className: 'fine-print', text: 'A sessão original ficará como remarcada e uma nova sessão será criada. O app não reorganiza outras sessões automaticamente.'}),
      element('div', {className: 'button-row'}, [button('Confirmar remarcação', 'session-reschedule-confirm', 'primary-button', {sessionId: session.id}), button('Voltar', 'close-modal', 'secondary-button')])
    ]));
  }

  async function confirmReschedule(session) {
    const input = document.getElementById('reschedule-date');
    const newDate = input ? Core.validDate(input.value) : '';
    if (!newDate) { showNotice('Escolha uma data válida para remarcar.', 'warning'); return; }
    await storage.createSnapshot(state, 'Antes de remarcar sessão');
    const replacement = novaSessao(session.workoutId, newDate, session.week);
    replacement.rescheduledFrom = session.plannedDate;
    // Remarcar preserva apenas a configuração comparável, nunca a execução.
    replacement.exercises.forEach(log => {
      const origem = session.exercises.find(item => item.exerciseId === log.exerciseId && item.side === log.side);
      const definition = Data.findExercise(session.workoutId, log.exerciseId);
      mergeExerciseConfiguration(log, origem, definition, session.week, false);
    });
    const completedAt = new Date().toISOString();
    closeSessionTiming(session, completedAt);
    session.status = 'rescheduled';
    session.completedAt = completedAt;
    session.updatedAt = session.completedAt;
    state.sessions.push(replacement);
    if (await persist(`Sessão remarcada para ${formatDate(newDate)}.`, true)) closeModal();
  }

  async function reopenSession(session) {
    await storage.createSnapshot(state, 'Antes de reabrir sessão');
    const now = new Date();
    const previousDuration = Math.max(0, Number(session.durationSeconds) || 0);
    session.status = session.startedAt ? 'paused' : 'planned';
    if (session.status === 'paused') {
      session.startedAt = new Date(now.getTime() - previousDuration * 1000).toISOString();
      session.pausedAt = now.toISOString();
      session.pausedSeconds = 0;
    }
    session.completedAt = '';
    session.durationSeconds = previousDuration;
    session.updatedAt = now.toISOString();
    await persist('Sessão reaberta.', true);
  }

  // Repete a primeira série de trabalho nas demais, como na versão 2.2.
  async function repeatFirstWorkSet(session, exerciseId) {
    const log = findExerciseLog(session, exerciseId);
    if (!log) return;
    const workSets = log.sets.filter(set => set.type === 'work');
    const first = workSets[0];
    if (!first || (!first.load && !first.reps)) {
      showNotice('Preencha a primeira série antes de repeti-la nas demais.', 'warning');
      return;
    }
    if (first.status && first.status !== 'completed') {
      showNotice('A primeira série está marcada com ocorrência adversa e não pode servir de referência para copiar valores.', 'warning');
      return;
    }
    const alvo = workSets.slice(1).filter(set => !Core.isSetConfirmed(set));
    if (!alvo.length) {
      showNotice('As demais séries já foram confirmadas; nada foi sobrescrito.', 'warning');
      return;
    }
    alvo.forEach(set => {
      set.load = first.load;
      set.reps = first.reps;
      if (first.rir) set.rir = first.rir;
    });
    await persist(`Valores copiados para ${alvo.length} série(s) ainda não confirmada(s).`, true);
  }

  // Marcar o exercício confirma apenas séries que já têm repetições registradas;
  // nunca inventa séries concluídas.
  async function toggleExerciseCompleted(session, exerciseId) {
    const log = findExerciseLog(session, exerciseId);
    if (!log) return;
    const workSets = log.sets.filter(set => set.type === 'work');
    if (log.completed) {
      log.completed = false;
      session.updatedAt = new Date().toISOString();
      await persist('Marcação do exercício desfeita.', true);
      return;
    }
    const pendentes = workSets.filter(set => !Core.isSetConfirmed(set));
    if (pendentes.length) {
      showNotice(`Confirme as ${pendentes.length} série(s) restante(s) antes de marcar o exercício como concluído.`, 'warning');
      return;
    }
    markSessionStarted(session);
    log.completed = workSets.length > 0;
    session.updatedAt = new Date().toISOString();
    if (await persist('Exercício marcado como concluído.', true)) await requestWakeLock();
  }

  async function pickFeeling(session, exerciseId, feeling) {
    const log = findExerciseLog(session, exerciseId);
    if (!log) return;
    const valid = FEELING_OPTIONS.some(item => item[0] === feeling);
    log.feeling = valid && log.feeling !== feeling ? feeling : '';
    await persist('Sensação registrada.', true);
  }

  async function copyFeedbackReport(session, exerciseId) {
    const log = findExerciseLog(session, exerciseId);
    if (!log) return;
    const exercise = Data.findExercise(session.workoutId, log.exerciseId);
    const labels = Object.fromEntries(FEELING_OPTIONS);
    const linhas = [
      `Treino: ${Data.WORKOUT_BY_ID[session.workoutId].label} · ${formatDate(session.actualDate || session.plannedDate)} · Semana ${session.week}`,
      `Exercício: ${exercise ? exercise.name : log.exerciseId}${log.side !== 'bilateral' ? ` (lado ${log.side === 'left' ? 'esquerdo' : 'direito'})` : ''}`,
      `Sensação: ${labels[log.feeling] || 'não informada'}`,
      `Observação: ${log.feedback || 'sem observação'}`,
      `Séries: ${log.sets.filter(set => set.type === 'work').map(set => `${set.load || '–'}×${set.reps || '–'}${set.rir ? ` RIR ${set.rir}` : ''}`).join(' · ')}`
    ].join('\n');
    try {
      await navigator.clipboard.writeText(linhas);
      announce('Feedback copiado para revisão.');
    } catch (error) {
      showNotice('Não foi possível copiar automaticamente. O texto continua visível no campo de observação.', 'warning');
    }
  }

  async function toggleMobility(session, exerciseId, fieldName) {
    const log = findExerciseLog(session, exerciseId);
    if (!log) return;
    markSessionStarted(session);
    log[fieldName] = !log[fieldName];
    if (fieldName === 'completed' && log.completed) log.skipped = false;
    if (fieldName === 'skipped' && log.skipped) log.completed = false;
    session.updatedAt = new Date().toISOString();
    if (await persist('Mobilidade atualizada.', true)) await requestWakeLock();
  }

  function hasExerciseExecutionData(log) {
    const mobility = log.mobilityFeedback || {};
    const mobilityUsed = Boolean(mobility.note || ['left', 'right'].some(side =>
      mobility[side] && Object.values(mobility[side]).some(Boolean)));
    return Boolean(
      log.completed || log.skipped || log.feedback || log.feeling || mobilityUsed
      || log.sets.some(set => set.load || set.reps || set.rir || set.status || set.note || set.completedAt)
    );
  }

  async function requestVariationChange(session, log, nextVariation) {
    const exercise = Data.findExercise(session.workoutId, log.exerciseId);
    if (!exercise || !exercise.variants.some(item => item.id === nextVariation) || nextVariation === log.variationId) return;
    if (!hasExerciseExecutionData(log)) {
      log.variationId = nextVariation;
      await persist('Variação atualizada; o histórico comparável permanecerá separado.', true);
      return;
    }
    renderActivePanel();
    confirmationModal('Trocar variação', 'Os registros já digitados serão preservados nesta sessão, mas a comparação futura usará uma chave diferente. Confirme somente se esta foi realmente a variação executada.', 'variation-confirm', {sessionId: session.id, exerciseId: log.id, variationId: nextVariation}, 'Confirmar variação executada');
  }

  async function confirmVariation(sessionId, exerciseId, variationId) {
    const session = findSession(sessionId);
    const log = findExerciseLog(session, exerciseId);
    const exercise = log ? Data.findExercise(session.workoutId, log.exerciseId) : null;
    if (!exercise || !exercise.variants.some(item => item.id === variationId)) return;
    log.variationId = variationId;
    if (await persist('Variação confirmada; cargas de variações diferentes não serão misturadas.', true)) closeModal();
  }

  function updateHighRepPreference(session, log, enabled) {
    const exercise = Data.findExercise(session.workoutId, log.exerciseId);
    if (!exercise || !exercise.allowHighReps) return;
    log.highRepPreference = Boolean(enabled);
    const prescription = Data.prescriptionFor(exercise, session.week, log.highRepPreference);
    Object.assign(log.prescriptionSnapshot, {min: prescription.min, max: prescription.max, label: prescription.label, rirMin: prescription.rirMin, rirMax: prescription.rirMax, deload: prescription.deload});
  }

  async function planWorkoutToday(workoutId) {
    if (!Data.WORKOUT_BY_ID[workoutId]) return;
    const date = Core.localDateKey();
    const existing = state.sessions.find(session => session.workoutId === workoutId && session.plannedDate === date && !['cancelled', 'rescheduled'].includes(session.status));
    if (existing) { renderActivePanel(); return; }
    state.sessions.push(novaSessao(workoutId, date, state.cycle.currentWeek));
    await persist('Sessão planejada para hoje.', true);
  }

  async function copyPreviousLoads(sessionId, exerciseId) {
    const session = findSession(sessionId);
    const log = findExerciseLog(session, exerciseId);
    if (!session || !log) return;
    const previous = previousComparablePerformance(session, log);
    if (!previous) { showNotice('Nenhuma execução anterior exatamente comparável foi encontrada.', 'warning'); return; }
    const source = previous.workSets;
    // Só a carga viaja. Conclusão, horário, status, RIR, observação e feedback
    // pertencem à execução de hoje e continuam em branco.
    const target = log.sets.filter(set => set.type === 'work' && !Core.isSetConfirmed(set));
    if (!target.length) {
      showNotice('Todas as séries já foram confirmadas; nada foi sobrescrito.', 'warning');
      return;
    }
    target.forEach((set, index) => { if (source[index] && source[index].load) set.load = source[index].load; });
    await persist('Cargas anteriores copiadas; repetições, RIR e status permaneceram vazios.', true);
  }

  async function saveCardio(formData, form) {
    const raw = {
      id: Core.uid('cardio'),
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      durationMinutes: formData.get('durationMinutes'),
      distanceKm: formData.get('distanceKm'),
      pace: formData.get('pace'),
      effort: formData.get('effort'),
      status: formData.get('status'),
      discomfort: formData.get('discomfort'),
      note: formData.get('note'),
      relatedSessionId: formData.get('relatedSessionId'),
      legDayFlags: Object.fromEntries(['fatigue', 'rightCalfPain', 'gaitChange', 'kneePain', 'anklePain', 'performanceDrop'].map(key => [key, formData.has(key)])),
      savedAt: new Date().toISOString()
    };
    const normalized = Core.normalizeCardio(raw, state.cardio.length);
    if (!normalized) { showNotice('A data da caminhada não é válida.', 'warning'); return; }
    state.cardio.push(normalized);
    const related = findSession(normalized.relatedSessionId);
    if (related) related.cardioId = normalized.id;
    if (await persist('Caminhada registrada.', true, {keepDomOnFailure: true})) form.reset();
  }

  async function saveHomeRoutine(formData, form) {
    const raw = {
      id: Core.uid('home'),
      date: formData.get('date'), time: formData.get('time'), position: formData.get('position'),
      durationSeconds: formData.get('durationSeconds'), repetitions: formData.get('repetitions'), ease: formData.get('ease'),
      note: formData.get('note'), savedAt: new Date().toISOString()
    };
    const normalized = Core.normalizeHomeRoutine(raw, state.homeRoutines.length);
    if (!normalized) { showNotice('A data da rotina em casa não é válida.', 'warning'); return; }
    state.homeRoutines.push(normalized);
    if (await persist('Rotina em casa registrada.', true, {keepDomOnFailure: true})) form.reset();
  }

  async function saveMeasurement(formData, form) {
    const measuredInput = String(formData.get('measuredAt') || '');
    let measuredAt = '';
    if (measuredInput) {
      const parsed = new Date(measuredInput);
      if (!Number.isNaN(parsed.getTime())) measuredAt = parsed.toISOString();
    }
    const raw = {id: Core.uid('measurement'), date: formData.get('date'), measuredAt, note: formData.get('note'), savedAt: new Date().toISOString()};
    Object.keys(Measurements.METRICS).forEach(key => { raw[key] = formData.get(key); });
    if (!Core.validDate(raw.date)) {
      showNotice('Informe uma data válida para a medição.', 'warning');
      const input = form.elements.namedItem('date');
      if (input && typeof input.focus === 'function') input.focus();
      return;
    }
    if (measuredInput && !measuredAt) {
      showNotice('O horário da medição não é válido.', 'warning');
      const input = form.elements.namedItem('measuredAt');
      if (input && typeof input.focus === 'function') input.focus();
      return;
    }
    const normalized = Core.normalizeMeasurement(raw, state.measurements.length);
    const invalidMetric = Object.entries(Measurements.METRICS).find(([key]) =>
      String(raw[key] == null ? '' : raw[key]).trim() && (!normalized || !normalized[key]));
    if (invalidMetric) {
      const [key, metric] = invalidMetric;
      const input = form.elements.namedItem(key);
      const message = `${metric.label}: informe um número maior que zero e de até 500 ${metric.unit}.`;
      showNotice(message, 'warning');
      if (input && typeof input.setCustomValidity === 'function') {
        input.setCustomValidity(message);
        input.addEventListener('input', () => input.setCustomValidity(''), {once: true});
        input.reportValidity();
        input.focus();
      }
      return;
    }
    if (!normalized) {
      showNotice('Informe ao menos uma medida numérica maior que zero.', 'warning');
      const firstMetric = form.elements.namedItem(Object.keys(Measurements.METRICS)[0]);
      if (firstMetric && typeof firstMetric.focus === 'function') firstMetric.focus();
      return;
    }
    state.measurements.push(normalized);
    if (await persist('Medidas corporais registradas.', true, {keepDomOnFailure: true})) form.reset();
  }

  function mergeExerciseConfiguration(fresh, previous, definition, week, preserveId) {
    if (!previous) return fresh;
    if (preserveId) fresh.id = previous.id;
    fresh.machineId = previous.machineId || '';
    const variants = definition && Array.isArray(definition.variants) ? definition.variants : [];
    if (variants.some(item => item.id === previous.variationId)) fresh.variationId = previous.variationId;
    fresh.highRepPreference = Boolean(definition && definition.allowHighReps && previous.highRepPreference);
    if (definition && fresh.prescriptionSnapshot) {
      const prescription = Data.prescriptionFor(definition, week, fresh.highRepPreference);
      Object.assign(fresh.prescriptionSnapshot, {
        min: prescription.min,
        max: prescription.max,
        label: prescription.label,
        rirMin: prescription.rirMin,
        rirMax: prescription.rirMax,
        deload: prescription.deload
      });
    }
    return fresh;
  }

  function replacePlannedSessionPrescription(session, week) {
    if (session.status !== 'planned' || hasSessionInput(session)) return false;
    const workout = Data.WORKOUT_BY_ID[session.workoutId];
    session.week = week;
    const previousLogs = session.exercises;
    session.exercises = workout.exercises.flatMap(exercise => Core.createExerciseLogs(exercise, week)).map(fresh => {
      const previous = previousLogs.find(log => log.exerciseId === fresh.exerciseId && log.side === fresh.side);
      if (!previous) return fresh;
      const definition = Data.findExercise(session.workoutId, fresh.exerciseId);
      return mergeExerciseConfiguration(fresh, previous, definition, week, true);
    });
    session.updatedAt = new Date().toISOString();
    return true;
  }

  function hasSessionInput(session) {
    return session.exercises.some(hasExerciseExecutionData);
  }

  async function changeCycleWeek(week) {
    const nextWeek = Math.max(1, Math.min(8, Number(week) || 1));
    if (nextWeek === state.cycle.currentWeek) return;
    await storage.createSnapshot(state, `Antes de alterar para semana ${nextWeek}`);
    state.cycle.currentWeek = nextWeek;
    let updated = 0;
    const today = Core.localDateKey();
    state.sessions.forEach(session => {
      if (session.plannedDate >= today && replacePlannedSessionPrescription(session, nextWeek)) updated += 1;
    });
    await persist(`Semana alterada para ${nextWeek}; ${updated} sessão(ões) ainda vazia(s) foram atualizadas.`, true);
  }

  async function resetCycle() {
    await storage.createSnapshot(state, 'Antes de zerar a periodização');
    const archivedAt = new Date().toISOString();
    state.archives.push({
      id: Core.uid('archive'),
      archivedAt,
      cycle: Object.assign({}, state.cycle, {status: 'archived'}),
      sessions: Core.deepClone(state.sessions)
    });
    state.sessions = [];
    state.cycle = {id: Core.uid('cycle'), startedAt: archivedAt, currentWeek: 1, status: 'active'};
    ensureCurrentWeekSessions();
    const saved = await persist('Periodização zerada; o ciclo anterior foi arquivado e a semana 1 foi iniciada.', true);
    if (!saved) return;
    closeModal();
    stopTimer();
    await releaseWakeLock();
  }

  async function restoreSnapshot() {
    try {
      const snapshot = await storage.latestSnapshot();
      if (!snapshot || !snapshot.state) { closeModal(); showNotice('Nenhum snapshot válido está disponível.', 'warning'); return; }
      // O snapshot escolhido precisa ser validado antes da normalização e antes
      // de criar a cópia de segurança. Assim, um registro interno corrompido não
      // pode ser transformado em lista vazia e depois substituir o documento.
      Core.assertCurrentStateStructure(snapshot.state);
      await storage.createSnapshot(state, 'Antes de restaurar snapshot anterior');
      const restored = Core.deepClone(snapshot.state);
      restored.revision = persistedRevision;
      state = await storage.writeDocument(restored, persistedRevision, {});
      persistedRevision = state.revision;
      rememberConsistentState(state);
      closeModal();
      applyPreferences();
      renderActivePanel();
      setSaveState('Snapshot restaurado', false);
      announce('Snapshot restaurado com sucesso.');
    } catch (error) {
      setSaveState('Snapshot não restaurado', true);
      showNotice(`O snapshot foi rejeitado e o documento atual permaneceu intacto: ${error.message || error}`, 'error');
    }
  }

  function downloadText(text, filename, mimeType) {
    const blob = new Blob([text], {type: `${mimeType};charset=utf-8`});
    const url = URL.createObjectURL(blob);
    const anchor = element('a', {attrs: {href: url, download: filename}});
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function fileDateStamp() {
    return Core.localDateKey().replace(/-/g, '');
  }

  function serializedBackupFits(text) {
    const bytes = new Blob([text]).size;
    if (bytes <= Core.MAX_IMPORT_BYTES) return true;
    showNotice(`O backup teria ${(bytes / 1024 / 1024).toLocaleString('pt-BR', {maximumFractionDigits: 1})} MB e excederia o limite de reimportação de ${Math.round(Core.MAX_IMPORT_BYTES / 1024 / 1024)} MB. Nada foi baixado; exporte o CSV e reduza o histórico somente após guardar uma cópia externa.`, 'error');
    return false;
  }

  function exportJson() {
    const backup = Core.buildBackup(state);
    const text = JSON.stringify(backup, null, 2);
    if (!serializedBackupFits(text)) return;
    downloadText(text, `treino-hard-backup-${fileDateStamp()}.json`, 'application/json');
    lastBackupState = 'JSON exportado agora';
    announce('Backup JSON exportado.');
    if (currentTab === 'today') renderActivePanel();
  }

  function buildCsv() {
    const headers = ['tipo_registro', 'sessao_id', 'data', 'horario', 'treino', 'semana', 'status_sessao', 'exercicio', 'variacao', 'maquina', 'lado', 'serie', 'tipo_serie', 'carga_kg', 'repeticoes', 'rir', 'status_serie', 'descanso_segundos', 'dor', 'feedback', 'cardio_minutos', 'cardio_distancia_km', 'cardio_esforco', 'medida', 'valor_medida', 'unidade', 'observacao'];
    const rows = [headers];
    allSessions().forEach(session => {
      const workout = Data.WORKOUT_BY_ID[session.workoutId];
      session.exercises.forEach(log => {
        const exercise = Data.findExercise(session.workoutId, log.exerciseId);
        if (!log.sets.length) {
          rows.push(['mobilidade', session.id, session.actualDate || session.plannedDate, session.startedAt ? new Date(session.startedAt).toLocaleTimeString('pt-BR') : '', workout ? workout.label : session.workoutId, session.week, session.status, exercise ? exercise.name : log.exerciseId, log.variationId, log.machineId, log.side, '', 'mobilidade', '', '', '', log.completed ? 'completed' : log.skipped ? 'not_done' : '', '', log.mobilityFeedback.left.pain || log.mobilityFeedback.right.pain ? 'sim' : 'não', log.feedback, '', '', '', '', '', '', log.mobilityFeedback.note]);
          return;
        }
        log.sets.forEach((set, index) => rows.push(['musculacao', session.id, session.actualDate || session.plannedDate, set.completedAt ? new Date(set.completedAt).toLocaleTimeString('pt-BR') : '', workout ? workout.label : session.workoutId, session.week, session.status, exercise ? exercise.name : log.exerciseId, log.variationId, log.machineId, log.side, index + 1, set.type, set.load, set.reps, set.rir, set.status, set.nextRestSeconds, set.status === 'pain' || log.feeling === 'pain' ? 'sim' : 'não', log.feedback, '', '', '', '', '', '', set.note]));
      });
    });
    state.cardio.forEach(item => rows.push(['cardio', item.relatedSessionId, item.date, item.startTime, '', '', item.status, '', '', '', '', '', '', '', '', '', '', '', item.status === 'not_pain' || item.legDayFlags.rightCalfPain || item.legDayFlags.kneePain || item.legDayFlags.anklePain ? 'sim' : 'não', item.discomfort, item.durationMinutes, item.distanceKm, item.effort, '', '', '', item.note]));
    state.measurements.forEach(item => Object.entries(Measurements.METRICS).forEach(([key, metric]) => {
      if (!item[key]) return;
      rows.push(['medida', '', item.date, item.measuredAt ? new Date(item.measuredAt).toLocaleTimeString('pt-BR') : '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', metric.label, item[key], metric.unit, item.note]);
    }));
    return rows.map(row => row.map(Core.csvCell).join(',')).join('\r\n');
  }

  function exportCsv() {
    downloadText(`\uFEFF${buildCsv()}`, `treino-hard-registros-${fileDateStamp()}.csv`, 'text/csv');
    announce('CSV exportado.');
  }

  function showImportPreview(parsed, raw, filename, encrypted) {
    const preview = Core.importPreview(parsed);
    pendingImport = {raw, preview, filename};
    openModal('Prévia da importação', element('div', {}, [
      element('p', {text: `Arquivo: ${filename}${encrypted ? ' (criptografado, já autenticado)' : ''}. Nada foi alterado ainda.`}),
      element('div', {className: 'split-list'}, [
        ['Versão de origem', preview.version], ['Sessões novas', preview.sessions], ['Exercícios em sessões', preview.exercises],
        ['Registros legados', preview.legacyRecords], ['Legados reconhecidos', preview.recognizedLegacy], ['Legados ambíguos/incompatíveis', preview.incompatible],
        ['Medições', preview.measurements], ['Ciclos', preview.cycles], ['Configurações reconhecidas', preview.settings]
      ].map(([label, value]) => element('div', {className: 'split-row'}, [element('strong', {text: label}), element('span', {text: String(value)})]))),
      element('div', {className: 'warning-box'}, [element('p', {text: 'Confirmar substituirá o documento atual pelo importado. Antes disso, o app preservará o arquivo bruto e criará um snapshot para desfazer.'})]),
      element('div', {className: 'button-row'}, [button('Confirmar importação', 'import-confirm', 'danger-button'), button('Cancelar', 'close-modal', 'secondary-button')])
    ]));
  }

  function openEncryptedImportModal(filename, message) {
    openModal('Backup criptografado', element('div', {}, [
      element('p', {text: `Arquivo: ${filename}. Informe a senha usada na exportação. Nada foi alterado ainda.`}),
      field('Senha do backup', element('input', {className: 'input', attrs: {type: 'password', id: 'import-password', autocomplete: 'current-password'}})),
      message ? element('div', {className: 'warning-box'}, [element('p', {text: message})]) : null,
      element('p', {className: 'fine-print', text: 'A senha não é salva e não sai deste aparelho. Se estiver incorreta ou o arquivo tiver sido adulterado, a leitura falha e nada é importado.'}),
      element('div', {className: 'button-row'}, [button('Descriptografar e ver prévia', 'import-decrypt', 'primary-button'), button('Cancelar', 'close-modal', 'secondary-button')])
    ]));
  }

  async function decryptPendingImport() {
    if (!pendingEncryptedImport) return;
    const input = document.getElementById('import-password');
    if (!input) return;
    const password = input.value;
    input.value = '';
    try {
      const parsed = await Core.decryptBackup(pendingEncryptedImport.document, password);
      showImportPreview(parsed, pendingEncryptedImport.raw, pendingEncryptedImport.filename, true);
      pendingEncryptedImport = null;
    } catch (error) {
      openEncryptedImportModal(pendingEncryptedImport.filename, error.message || String(error));
    }
  }

  function openEncryptedExportModal() {
    openModal('Exportar backup criptografado', element('div', {}, [
      element('p', {text: 'O arquivo será cifrado com AES-GCM de 256 bits e chave derivada da sua senha por PBKDF2-SHA-256, com salt e vetor de inicialização aleatórios.'}),
      field('Senha', element('input', {className: 'input', attrs: {type: 'password', id: 'backup-password', autocomplete: 'new-password'}})),
      field('Confirmar senha', element('input', {className: 'input', attrs: {type: 'password', id: 'backup-password-confirm', autocomplete: 'new-password'}})),
      element('div', {className: 'warning-box'}, [element('p', {text: `Use ao menos ${Core.MIN_PASSWORD_LENGTH} caracteres. A senha não é gravada em lugar nenhum: sem ela o backup não pode ser aberto por ninguém, inclusive por você.`})]),
      element('div', {className: 'button-row'}, [button('Criptografar e baixar', 'export-encrypted-confirm', 'primary-button'), button('Cancelar', 'close-modal', 'secondary-button')])
    ]));
  }

  async function exportEncryptedJson() {
    const passwordInput = document.getElementById('backup-password');
    const confirmInput = document.getElementById('backup-password-confirm');
    if (!passwordInput || !confirmInput) return;
    const password = passwordInput.value;
    const matches = password === confirmInput.value;
    passwordInput.value = '';
    confirmInput.value = '';
    if (!matches) { showNotice('As senhas não coincidem. Nada foi exportado.', 'warning'); return; }
    try {
      const plainText = JSON.stringify(Core.buildBackup(state));
      if (!serializedBackupFits(plainText)) return;
      const encrypted = await Core.encryptBackup(state, password);
      const text = JSON.stringify(encrypted, null, 2);
      if (!serializedBackupFits(text)) return;
      downloadText(text, `treino-hard-backup-cifrado-${fileDateStamp()}.json`, 'application/json');
      closeModal();
      lastBackupState = 'Backup criptografado exportado agora';
      announce('Backup criptografado exportado. Guarde a senha: ela não é salva.');
    } catch (error) {
      showNotice(`Não foi possível criptografar o backup: ${error.message || error}. Nada foi exportado.`, 'error');
    }
  }

  async function previewImportFile(file) {
    if (!file) return;
    if (file.size > Core.MAX_IMPORT_BYTES) { showNotice(`O arquivo excede o limite de ${Math.round(Core.MAX_IMPORT_BYTES / 1024 / 1024)} MB. Nada foi alterado.`, 'error'); return; }
    pendingImport = null;
    pendingEncryptedImport = null;
    try {
      const raw = await file.text();
      if (new Blob([raw]).size > Core.MAX_IMPORT_BYTES) throw new Error('O conteúdo excede o limite de importação.');
      const parsed = JSON.parse(raw);
      const filename = Core.cleanText(file.name, 120);
      if (Core.isEncryptedBackup(parsed)) {
        // O arquivo bruto preservado continua sendo o cifrado, não o conteúdo aberto.
        pendingEncryptedImport = {document: parsed, raw, filename};
        openEncryptedImportModal(filename, '');
        return;
      }
      Core.assertSafeParsed(parsed);
      showImportPreview(parsed, raw, filename, false);
    } catch (error) {
      pendingImport = null;
      pendingEncryptedImport = null;
      showNotice(`Importação rejeitada: ${error.message || error}. Nada foi alterado.`, 'error');
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    try {
      await storage.saveRecovery({id: Core.uid('import-source'), savedAt: new Date().toISOString(), reason: `Arquivo bruto antes da importação: ${pendingImport.filename}`, raw: pendingImport.raw});
      await storage.createSnapshot(state, `Antes de importar ${pendingImport.filename}`);
      const imported = Core.normalizeState(pendingImport.preview.state);
      imported.revision = persistedRevision;
      state = await storage.writeDocument(imported, persistedRevision, {});
      persistedRevision = state.revision;
      rememberConsistentState(state);
      pendingImport = null;
      closeModal();
      applyPreferences();
      const planned = ensureCurrentWeekSessions();
      if (planned && !(await persist('Sessões da semana incluídas após a importação.', false))) return;
      renderTabs();
      renderActivePanel();
      setSaveState('Importação concluída', false);
      announce('Backup importado e validado.');
    } catch (error) {
      showNotice(`Não foi possível concluir a importação: ${error.message || error}.`, 'error');
    }
  }

  async function createBackupNow() {
    try {
      await storage.automaticBackup(state, true);
      lastBackupState = 'Cópia automática atualizada agora';
      announce('Cópia automática local criada.');
      await refreshStorageInventory();
      renderActivePanel();
    } catch (error) {
      showNotice(`Falha ao criar cópia automática: ${error.message || error}`, 'error');
    }
  }

  async function handleExternalChange(message) {
    if (!state || Number(message.revision) <= Number(persistedRevision)) return;
    showNotice('Outra aba alterou os registros. Recarregue antes de continuar para evitar conflito.', 'warning', [button('Recarregar dados', 'reload-external', 'secondary-button')]);
  }

  async function reloadExternalState() {
    const latest = await storage.readDocument();
    if (!latest) { showNotice('Não foi possível reler o documento local.', 'error'); return; }
    state = latest;
    persistedRevision = latest.revision;
    rememberConsistentState(latest);
    applyPreferences();
    hideNotice();
    renderActivePanel();
    setSaveState('Dados recarregados', false);
    announce('Dados atualizados a partir da outra aba.');
  }

  async function updateOnlineStatus() {
    const online = navigator.onLine;
    if (!online) {
      showOfflineNotice();
    } else if (dom.notice.dataset.source === 'offline') {
      hideNotice();
      announce('Conexão restabelecida.');
    }
  }

  function showOfflineNotice() {
    // Conectividade é aviso informativo; nunca deve esconder uma falha de
    // gravação, conflito ou atualização que já esteja pedindo ação do usuário.
    if (!dom.notice.hidden && dom.notice.dataset.source !== 'offline') return;
    showNotice('Você está offline. Registros, histórico e orientações locais continuam disponíveis; vídeos exigem internet.', 'warning');
    dom.notice.dataset.source = 'offline';
  }

  async function installApp() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    dom.installButton.hidden = true;
  }

  function showPwaUpdate(registration) {
    showNotice('Uma nova versão do aplicativo está pronta. Atualize somente quando não estiver preenchendo uma série.', 'warning', [button('Atualizar agora', 'pwa-update', 'secondary-button')]);
    dom.notice.dataset.source = 'pwa-update';
    dom.notice.dataset.registration = 'waiting';
    global.__treinoHardWaitingRegistration = registration;
  }

  function applyPwaUpdate() {
    const registration = global.__treinoHardWaitingRegistration;
    if (registration && registration.waiting) {
      pwaUpdateConfirmed = true;
      announce('Atualização confirmada; o aplicativo será recarregado em instantes.');
      registration.waiting.postMessage({type: 'SKIP_WAITING'});
    } else showNotice('A atualização ainda não está pronta. Tente novamente em instantes.', 'warning');
  }

  async function registerPwa() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
      showPwaAvailabilityNotice('Este navegador ou modo de abertura não permite instalar o pacote offline. Use HTTPS ou localhost.', 'warning');
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      // Perfis que bloqueiam service worker podem resolver sem registro.
      if (!registration) {
        showPwaAvailabilityNotice('Este navegador está bloqueando o pacote offline. O aplicativo continua funcionando com os dados locais.', 'warning');
        return;
      }
      if (registration.waiting) showPwaUpdate(registration);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showPwaUpdate(registration);
        });
      });
      navigator.serviceWorker.addEventListener('message', event => {
        const message = event.data || {};
        if (message.source !== 'treino-hard-service-worker') return;
        if (message.type === 'SW_UPDATE_READY') showPwaUpdate(registration);
        else if (message.type === 'SW_OFFLINE_READY') announce('Aplicativo pronto para uso offline.');
        else if (message.type === 'SW_CONNECTION_STATE' && message.offline) {
          showOfflineNotice();
        }
        else if (['SW_CACHE_ERROR', 'SW_UPDATE_ERROR', 'SW_ACTIVATION_ERROR'].includes(message.type)) showNotice(`Falha da PWA: ${message.message || 'erro não detalhado'}`, 'error');
      });
      const ready = await navigator.serviceWorker.ready;
      const controller = navigator.serviceWorker.controller || ready.active;
      if (controller) controller.postMessage({type: 'GET_CONNECTION_STATE'});
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // A primeira ativação apenas assume o controle da página já carregada.
        // Recarregar sem confirmação interromperia um treino em andamento e
        // descartaria campos preenchidos e ainda não confirmados.
        if (!pwaUpdateConfirmed) {
          announce('Pacote offline ativado. Nada foi interrompido.');
          return;
        }
        if (reloading) return;
        reloading = true;
        global.location.reload();
      });
    } catch (error) {
      showPwaAvailabilityNotice(`Não foi possível registrar o modo offline: ${error.message || error}`, 'error');
    }
  }

})(globalThis);
