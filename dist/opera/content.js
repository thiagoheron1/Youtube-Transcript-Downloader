(() => {
  if (window.__ytdTranscriptUiInstalled) return;
  window.__ytdTranscriptUiInstalled = true;

  const CHANNEL = "youtube-transcript-download";
  const ADVANCED_STORAGE_KEY = "ytdlAdvancedExportOptions";
  const UI_LANGUAGE_STORAGE_KEY = "ytdlInterfaceLanguage";
  const THEME_STORAGE_KEY = "ytdlInterfaceTheme";
  const Core = globalThis.YTDLCore;
  const extensionApi = Core.createExtensionApi(globalThis.browser || globalThis.chrome);
  let advancedSaveTimer;
  let transcriptLoadTimer;
  let trackDiscoveryTimer;
  let boundVideo;
  let activeSegmentIndex = -1;
  let interfaceLanguageLoaded = false;

  const browserLanguage = () => Core.detectUiLanguage(navigator.language);

  const messages = {
    en: {
      title: "Transcript Download", subtitle: "Export captions from this video", settings: "Language settings",
      interfaceLanguage: "Interface language", browserDefault: "Browser default", transcriptLanguage: "Video language", videoDefault: "original language",
      appearance: "Appearance", followSystem: "Follow system", lightTheme: "Light", darkTheme: "Dark",
      lookingCaptions: "Looking for captions…", translate: "Translate before downloading", findingSubtitles: "Finding subtitles…",
      lookingSubtitles: "Looking for available subtitles…", loadSubtitles: "Load subtitles", reloadSubtitles: "Reload subtitles", loadingSubtitles: "Loading subtitles…",
      chooseFormat: "Choose an export format", selectContinue: "Select one to continue", structured: "Structured", structuredHint: "(00:00 - 00:02) Text",
      markdown: "Markdown", markdownHint: ".md with timestamps", plainText: "Plain text", plainHint: "Transcript only", subtitles: "Subtitles", subtitlesHint: "Standard .srt file",
      jsonHint: "Machine-readable timestamps", exportTranscript: "Export transcript", advanced: "Advanced export", aiAutomation: "For AI and automation",
      advancedHelp: "Add structured context for AI workflows or inspect the exact file content before exporting.", exportTitle: "Export title", titlePlaceholder: "Use the YouTube video title",
      contentType: "Content type", contentPlaceholder: "Interview, lecture…", tags: "Tags", commaSeparated: "comma-separated", tagsPlaceholder: "product, research",
      aiContext: "AI context or instructions", aiPlaceholder: "Explain the audience, purpose, speaker names, or how another AI should use this transcript.",
      includeMetadata: "Include a metadata block in text exports", exportPreview: "Export preview", jsonPreview: "JSON preview", copy: "Copy", copied: "Copied",
      exactPreview: "Preview shows up to 5 examples. The exported file includes the complete transcript.", loadingSaved: "Loading saved options…",
      found: "Subtitles found. Click Load subtitles to continue.", noCaptions: "No caption track found yet. Open YouTube’s transcript panel and try again.",
      panelFound: "YouTube’s transcript panel was detected. Click Load subtitles to continue.", loadingPreparing: "Loading and preparing the transcript…",
      languageChanged: "Language changed. Load subtitles to continue.", translationDisabled: "Translation disabled. Load subtitles to continue.", chooseFormatStatus: "Choose an export format.",
      retry: "Retry", retrying: "Looking for subtitles again…",
      loadTimeout: "Subtitle loading took too long. Please retry.", discoveryTimeout: "Could not detect subtitle tracks. Please retry.",
      saveLoading: "Saved options loaded", saving: "Saving…", saved: "Saved automatically", saveFailed: "Could not save", loadFailed: "Could not load saved options"
    },
    "pt-BR": {
      title: "Baixar transcrição", subtitle: "Exporte as legendas deste vídeo", settings: "Configurações de idioma",
      interfaceLanguage: "Idioma da interface", browserDefault: "Padrão do navegador", transcriptLanguage: "Idioma do vídeo", videoDefault: "idioma original",
      appearance: "Aparência", followSystem: "Seguir o sistema", lightTheme: "Claro", darkTheme: "Escuro",
      lookingCaptions: "Procurando legendas…", translate: "Traduzir antes de baixar", findingSubtitles: "Procurando legendas…",
      lookingSubtitles: "Procurando legendas disponíveis…", loadSubtitles: "Carregar legendas", reloadSubtitles: "Recarregar legendas", loadingSubtitles: "Carregando legendas…",
      chooseFormat: "Escolha o formato de exportação", selectContinue: "Selecione um para continuar", structured: "Estruturado", structuredHint: "(00:00 - 00:02) Texto",
      markdown: "Markdown", markdownHint: ".md com marcações de tempo", plainText: "Texto simples", plainHint: "Somente a transcrição", subtitles: "Legendas", subtitlesHint: "Arquivo .srt padrão",
      jsonHint: "Marcações de tempo legíveis por máquina", exportTranscript: "Exportar transcrição", advanced: "Exportação avançada", aiAutomation: "Para IA e automação",
      advancedHelp: "Adicione contexto estruturado para fluxos de IA ou confira o conteúdo exato antes de exportar.", exportTitle: "Título da exportação", titlePlaceholder: "Usar o título do vídeo",
      contentType: "Tipo de conteúdo", contentPlaceholder: "Entrevista, aula…", tags: "Tags", commaSeparated: "separadas por vírgula", tagsPlaceholder: "produto, pesquisa",
      aiContext: "Contexto ou instruções para IA", aiPlaceholder: "Explique o público, objetivo, nomes dos participantes ou como outra IA deve usar esta transcrição.",
      includeMetadata: "Incluir bloco de metadados nas exportações de texto", exportPreview: "Prévia da exportação", jsonPreview: "Prévia JSON", copy: "Copiar", copied: "Copiado",
      exactPreview: "A prévia mostra até 5 exemplos. O arquivo exportado inclui a transcrição completa.", loadingSaved: "Carregando opções salvas…",
      found: "Legendas encontradas. Clique em Carregar legendas para continuar.", noCaptions: "Nenhuma legenda foi encontrada. Abra a transcrição do YouTube e tente novamente.",
      panelFound: "O painel de transcrição do YouTube foi detectado. Clique em Carregar legendas.", loadingPreparing: "Carregando e preparando a transcrição…",
      languageChanged: "Idioma alterado. Carregue as legendas para continuar.", translationDisabled: "Tradução desativada. Carregue as legendas para continuar.", chooseFormatStatus: "Escolha um formato de exportação.",
      retry: "Tentar novamente", retrying: "Procurando legendas novamente…",
      loadTimeout: "O carregamento das legendas demorou demais. Tente novamente.", discoveryTimeout: "Não foi possível detectar as faixas de legenda. Tente novamente.",
      saveLoading: "Opções salvas carregadas", saving: "Salvando…", saved: "Salvo automaticamente", saveFailed: "Não foi possível salvar", loadFailed: "Não foi possível carregar as opções"
    },
    fr: {
      title: "Télécharger la transcription", subtitle: "Exportez les sous-titres de cette vidéo", settings: "Paramètres de langue",
      interfaceLanguage: "Langue de l’interface", browserDefault: "Langue du navigateur", transcriptLanguage: "Langue de la vidéo", videoDefault: "langue d’origine",
      appearance: "Apparence", followSystem: "Suivre le système", lightTheme: "Clair", darkTheme: "Sombre",
      lookingCaptions: "Recherche des sous-titres…", translate: "Traduire avant le téléchargement", findingSubtitles: "Recherche des sous-titres…",
      lookingSubtitles: "Recherche des sous-titres disponibles…", loadSubtitles: "Charger les sous-titres", reloadSubtitles: "Recharger les sous-titres", loadingSubtitles: "Chargement des sous-titres…",
      chooseFormat: "Choisissez un format d’exportation", selectContinue: "Sélectionnez-en un pour continuer", structured: "Structuré", structuredHint: "(00:00 - 00:02) Texte",
      markdown: "Markdown", markdownHint: ".md avec horodatage", plainText: "Texte brut", plainHint: "Transcription uniquement", subtitles: "Sous-titres", subtitlesHint: "Fichier .srt standard",
      jsonHint: "Horodatages lisibles par machine", exportTranscript: "Exporter la transcription", advanced: "Exportation avancée", aiAutomation: "Pour l’IA et l’automatisation",
      advancedHelp: "Ajoutez un contexte structuré pour les outils d’IA ou vérifiez le contenu exact avant l’exportation.", exportTitle: "Titre de l’exportation", titlePlaceholder: "Utiliser le titre de la vidéo",
      contentType: "Type de contenu", contentPlaceholder: "Entretien, conférence…", tags: "Tags", commaSeparated: "séparés par des virgules", tagsPlaceholder: "produit, recherche",
      aiContext: "Contexte ou instructions pour l’IA", aiPlaceholder: "Précisez le public, l’objectif, les intervenants ou la manière dont une autre IA doit utiliser cette transcription.",
      includeMetadata: "Inclure un bloc de métadonnées dans les exports texte", exportPreview: "Aperçu de l’exportation", jsonPreview: "Aperçu JSON", copy: "Copier", copied: "Copié",
      exactPreview: "L’aperçu affiche jusqu’à 5 exemples. Le fichier exporté contient la transcription complète.", loadingSaved: "Chargement des options enregistrées…",
      found: "Sous-titres trouvés. Cliquez sur Charger les sous-titres.", noCaptions: "Aucune piste de sous-titres trouvée. Ouvrez la transcription YouTube et réessayez.",
      panelFound: "Le panneau de transcription YouTube a été détecté. Cliquez sur Charger les sous-titres.", loadingPreparing: "Chargement et préparation de la transcription…",
      languageChanged: "Langue modifiée. Chargez les sous-titres pour continuer.", translationDisabled: "Traduction désactivée. Chargez les sous-titres pour continuer.", chooseFormatStatus: "Choisissez un format d’exportation.",
      retry: "Réessayer", retrying: "Nouvelle recherche des sous-titres…",
      loadTimeout: "Le chargement des sous-titres prend trop de temps. Réessayez.", discoveryTimeout: "Impossible de détecter les pistes de sous-titres. Réessayez.",
      saveLoading: "Options enregistrées chargées", saving: "Enregistrement…", saved: "Enregistré automatiquement", saveFailed: "Échec de l’enregistrement", loadFailed: "Échec du chargement des options"
    }
  };
  const state = {
    tracks: [],
    originalTrackIndex: 0,
    selectedTrackIndex: null,
    segments: [],
    metadata: {},
    track: {},
    loading: false,
    discoveringTracks: false,
    progressPercent: null,
    progressCompleted: false,
    selectedFormat: "",
    translate: false,
    targetLanguage: "en",
    advanced: {
      title: "",
      contentType: "",
      tags: "",
      context: "",
      includeMetadata: false
    },
    hasCapturedPanel: false,
    autoLoadRequested: false,
    reloadRequested: false,
    retryVisible: false,
    statusMessage: "",
    statusKind: "",
    uiLanguage: browserLanguage(),
    uiLanguageSetting: "auto",
    themeSetting: "system"
  };

  const t = (key) => messages[state.uiLanguage]?.[key] || messages.en[key] || key;
  const localized = (english, portuguese, french) => state.uiLanguage === "pt-BR" ? portuguese : state.uiLanguage === "fr" ? french : english;
  const resolvedTheme = () => Core.resolveTheme(
    state.themeSetting,
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const applyTheme = () => {
    const panel = document.querySelector("#ytdl-panel");
    if (panel) panel.dataset.theme = resolvedTheme();
  };

  const setSettingsDropdown = (panel, action, restoreFocus = false) => {
    const settingsButton = panel?.querySelector("#ytdl-settings-button");
    const settingsMenu = panel?.querySelector("#ytdl-settings");
    if (!settingsButton || !settingsMenu) return false;
    const next = Core.settingsDropdownState(!settingsMenu.hidden, action);
    settingsMenu.hidden = next.hidden;
    settingsButton.setAttribute("aria-expanded", next.expanded);
    if (restoreFocus) settingsButton.focus();
    return next.open;
  };

  document.addEventListener("pointerdown", (event) => {
    const panel = document.querySelector("#ytdl-panel");
    const settingsControl = panel?.querySelector(".ytdl-settings-control");
    if (settingsControl && !settingsControl.contains(event.target)) setSettingsDropdown(panel, "close");
  });
  document.addEventListener("keydown", (event) => {
    const panel = document.querySelector("#ytdl-panel");
    const settingsMenu = panel?.querySelector("#ytdl-settings");
    if (event.key === "Escape" && settingsMenu && !settingsMenu.hidden) {
      event.preventDefault();
      setSettingsDropdown(panel, "close", true);
    }
  });

  const post = (type, payload = {}) => {
    window.postMessage({ source: CHANNEL, type, ...payload }, window.location.origin);
  };

  const clock = Core.clock;
  const safeName = Core.safeName;
  const normalizedSegments = () => Core.normalizeSegments(state.segments);
  const exportMetadata = () => Core.exportMetadata(state, location.href);
  const outputs = (segmentLimit = null) => Core.buildOutputs(state, segmentLimit, location.href);

  const download = (format) => {
    const output = outputs()[format];
    if (!output) return;
    const blob = new Blob([output.content], { type: `${output.mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName(exportMetadata().title)}-${format}.${output.extension}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const messages = {
      en: `${formatLabel(format)} download started.`,
      "pt-BR": `Download de ${formatLabel(format)} iniciado.`,
      fr: `Téléchargement ${formatLabel(format)} démarré.`
    };
    setStatus(messages[state.uiLanguage], "success");
  };

  const formatLabel = (format) => ({
    structured: t("structured"),
    markdown: t("markdown"),
    original: t("plainText"),
    srt: t("subtitles"),
    json: "JSON"
  }[format] || format);

  const languageLabel = (language) => {
    try {
      return new Intl.DisplayNames([state.uiLanguage], { type: "language" }).of(language) || language;
    } catch (_) {
      return language;
    }
  };

  const setAdvancedSaveState = (message) => {
    const element = document.querySelector("#ytdl-advanced-save-state");
    if (element) element.textContent = message;
  };

  const applyAdvancedOptions = () => {
    const fields = {
      "#ytdl-export-title": state.advanced.title,
      "#ytdl-content-type": state.advanced.contentType,
      "#ytdl-tags": state.advanced.tags,
      "#ytdl-ai-context": state.advanced.context
    };
    for (const [selector, value] of Object.entries(fields)) {
      const field = document.querySelector(selector);
      if (field) field.value = value;
    }
    const includeMetadata = document.querySelector("#ytdl-include-metadata");
    if (includeMetadata) includeMetadata.checked = state.advanced.includeMetadata;
    renderExportPreview();
  };

  const loadAdvancedOptions = async () => {
    try {
      const result = await extensionApi.storageGet(ADVANCED_STORAGE_KEY);
      const saved = result?.[ADVANCED_STORAGE_KEY];
      if (saved && typeof saved === "object") {
        state.advanced = {
          title: typeof saved.title === "string" ? saved.title : "",
          contentType: typeof saved.contentType === "string" ? saved.contentType : "",
          tags: typeof saved.tags === "string" ? saved.tags : "",
          context: typeof saved.context === "string" ? saved.context : "",
          includeMetadata: Boolean(saved.includeMetadata)
        };
      }
      applyAdvancedOptions();
      setAdvancedSaveState(t("saveLoading"));
    } catch (_) {
      setAdvancedSaveState(t("loadFailed"));
    }
  };

  const saveAdvancedOptions = () => {
    clearTimeout(advancedSaveTimer);
    setAdvancedSaveState(t("saving"));
    advancedSaveTimer = setTimeout(async () => {
      try {
        await extensionApi.storageSet({ [ADVANCED_STORAGE_KEY]: state.advanced });
        setAdvancedSaveState(t("saved"));
      } catch (_) {
        setAdvancedSaveState(t("saveFailed"));
      }
    }, 300);
  };

  const loadInterfaceLanguage = async () => {
    if (interfaceLanguageLoaded) return;
    interfaceLanguageLoaded = true;
    try {
      const result = await extensionApi.storageGet([UI_LANGUAGE_STORAGE_KEY, THEME_STORAGE_KEY]);
      const saved = ["auto", "en", "pt-BR", "fr"].includes(result?.[UI_LANGUAGE_STORAGE_KEY]) ? result[UI_LANGUAGE_STORAGE_KEY] : "auto";
      const savedTheme = ["system", "light", "dark"].includes(result?.[THEME_STORAGE_KEY]) ? result[THEME_STORAGE_KEY] : "system";
      const language = saved === "auto" ? browserLanguage() : saved;
      const changed = language !== state.uiLanguage || saved !== state.uiLanguageSetting || savedTheme !== state.themeSetting;
      state.uiLanguageSetting = saved;
      state.uiLanguage = language;
      state.themeSetting = savedTheme;
      if (!changed) return;
      document.querySelector("#ytdl-panel")?.remove();
      document.querySelector("#ytdl-action")?.remove();
      mount();
    } catch (_) {}
  };

  const renderExportPreview = () => {
    const preview = document.querySelector("#ytdl-export-preview");
    const label = document.querySelector("#ytdl-preview-format");
    const container = document.querySelector("#ytdl-selected-preview");
    if (!preview) return;
    const format = state.selectedFormat || "json";
    const output = outputs(5)[format];
    preview.value = output?.content || "Transcript data will appear here when it is ready.";
    if (label) label.textContent = state.selectedFormat ? formatLabel(format) : t("jsonPreview");
    if (container) container.hidden = !state.selectedFormat;
  };

  const setStatus = (message, kind = "") => {
    state.statusMessage = message;
    state.statusKind = kind;
    const element = document.querySelector("#ytdl-status");
    if (!element) return;
    element.textContent = message;
    element.dataset.kind = kind;
  };

  const setRetryVisible = (visible) => {
    state.retryVisible = visible;
    const button = document.querySelector("#ytdl-retry");
    if (button) button.hidden = !visible;
  };

  const renderProgress = () => {
    const container = document.querySelector("#ytdl-progress");
    const bar = document.querySelector("#ytdl-progress-bar");
    if (!container || !bar) return;
    const progress = Core.progressIndicatorState({
      discovering: state.discoveringTracks,
      loading: state.loading,
      completed: state.progressCompleted,
      percent: state.progressPercent
    });
    container.hidden = !progress.visible;
    container.classList.toggle("is-indeterminate", progress.visible && !progress.determinate);
    if (progress.determinate) {
      container.setAttribute("aria-valuenow", String(Math.round(progress.value)));
      bar.style.width = `${progress.value}%`;
    } else {
      container.removeAttribute("aria-valuenow");
      bar.style.width = "";
    }
  };

  const setDiscoveringTracks = (discovering) => {
    state.discoveringTracks = discovering;
    if (discovering) {
      state.progressPercent = null;
      state.progressCompleted = false;
    }
    renderProgress();
  };

  const setProgress = (value = null) => {
    if (!state.loading) return;
    state.progressPercent = Number.isFinite(value) ? value : null;
    renderProgress();
  };

  const setLoading = (loading, completed = false) => {
    state.loading = loading;
    state.progressCompleted = Boolean(completed);
    if (loading) {
      state.discoveringTracks = false;
      state.progressPercent = null;
      setRetryVisible(false);
    } else if (!completed) {
      state.progressPercent = null;
    }
    document.querySelectorAll(".ytdl-format").forEach((button) => {
      button.disabled = loading || !state.segments.length;
    });
    renderProgress();
    if (completed) setTimeout(() => {
      if (!state.loading) {
        state.progressCompleted = false;
        renderProgress();
      }
    }, 450);
  };

  const requestTracks = (force = false) => {
    if (state.loading || state.segments.length || state.retryVisible && !force) return;
    setRetryVisible(false);
    setDiscoveringTracks(true);
    setStatus(t("lookingSubtitles"));
    clearTimeout(trackDiscoveryTimer);
    trackDiscoveryTimer = setTimeout(() => {
      if (!state.discoveringTracks) return;
      setDiscoveringTracks(false);
      setStatus(t("discoveryTimeout"), "error");
      setRetryVisible(true);
    }, 8000);
    post("REQUEST_TRACKS");
  };

  const selectFormat = (format) => {
    state.selectedFormat = format;
    document.querySelectorAll(".ytdl-format").forEach((button) => {
      const selected = button.dataset.format === format;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    renderExportPreview();
    const exportButton = document.querySelector("#ytdl-export");
    if (exportButton) {
      exportButton.hidden = false;
      exportButton.disabled = !state.segments.length;
      exportButton.textContent = localized(`Export ${formatLabel(format)}`, `Exportar ${formatLabel(format)}`, `Exporter ${formatLabel(format)}`);
    }
    setStatus(localized(
      `${formatLabel(format)} selected. Review the preview or export when ready.`,
      `${formatLabel(format)} selecionado. Confira a prévia ou exporte quando estiver pronto.`,
      `${formatLabel(format)} sélectionné. Vérifiez l’aperçu ou exportez lorsque vous êtes prêt.`
    ), "success");
  };

  const clearFormat = () => {
    state.selectedFormat = "";
    document.querySelectorAll(".ytdl-format").forEach((button) => {
      button.classList.remove("is-selected");
      button.setAttribute("aria-pressed", "false");
    });
    const exportButton = document.querySelector("#ytdl-export");
    if (exportButton) exportButton.hidden = true;
    renderExportPreview();
    setLoading(state.loading);
  };

  const requestTranscript = () => {
    const select = document.querySelector("#ytdl-track");
    if (!select) return;
    if (!state.tracks.length && !state.hasCapturedPanel) {
      requestTracks();
      return;
    }
    if (state.loading) {
      state.reloadRequested = true;
      return;
    }
    setLoading(true);
    setStatus(t("loadingPreparing"));
    clearTimeout(transcriptLoadTimer);
    transcriptLoadTimer = setTimeout(() => {
      if (!state.loading) return;
      setLoading(false);
      if (state.reloadRequested) {
        state.reloadRequested = false;
        requestTranscript();
        return;
      }
      setStatus(t("loadTimeout"), "error");
      setRetryVisible(true);
    }, 15000);
    post("REQUEST_TRANSCRIPT", {
      trackIndex: Core.selectedCaptionTrackIndex(state.tracks, select.value),
      targetLanguage: state.translate ? state.targetLanguage : ""
    });
  };

  const renderTracks = () => {
    const select = document.querySelector("#ytdl-track");
    if (!select) return;
    select.replaceChildren();
    if (!state.tracks.length) {
      select.append(new Option(localized("Default / transcript panel", "Padrão / painel de transcrição", "Par défaut / panneau de transcription"), "0"));
      return;
    }
    for (const track of state.tracks) {
      const suffix = track.kind === "asr" ? localized(" (auto-generated)", " (gerada automaticamente)", " (générés automatiquement)") : "";
      const defaultSuffix = Number(track.index) === state.originalTrackIndex ? ` · ${t("videoDefault")}` : "";
      select.append(new Option(`${track.name}${suffix}${defaultSuffix}`, String(track.index)));
    }
    state.selectedTrackIndex = Core.selectedCaptionTrackIndex(
      state.tracks,
      state.selectedTrackIndex ?? state.originalTrackIndex
    );
    select.value = String(state.selectedTrackIndex);
  };

  const renderPreview = () => {
    const preview = document.querySelector("#ytdl-preview");
    if (!preview) return;
    preview.replaceChildren();
    const segments = normalizedSegments();
    for (const [index, segment] of segments.entries()) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "ytdl-segment";
      row.dataset.index = String(index);
      row.innerHTML = `<span>${clock(segment.startMs)}</span><span></span>`;
      row.lastElementChild.textContent = segment.text;
      row.addEventListener("click", () => {
        const player = document.querySelector("video");
        if (player) {
          player.currentTime = segment.startMs / 1000;
          player.play().catch(() => {});
        }
      });
      preview.append(row);
    }
    activeSegmentIndex = -1;
    const player = document.querySelector("video");
    if (player) updateActiveSegment(player.currentTime * 1000, false);
  };

  const updateActiveSegment = (milliseconds, follow = true) => {
    const segments = normalizedSegments();
    const nextIndex = Core.findActiveSegmentIndex(segments, milliseconds);
    if (nextIndex === activeSegmentIndex) return;
    const preview = document.querySelector("#ytdl-preview");
    preview?.querySelector(`.ytdl-segment[data-index="${activeSegmentIndex}"]`)?.classList.remove("is-active");
    preview?.querySelector(`.ytdl-segment[data-index="${activeSegmentIndex}"]`)?.removeAttribute("aria-current");
    activeSegmentIndex = nextIndex;
    if (nextIndex < 0 || !preview) return;
    const activeRow = preview.querySelector(`.ytdl-segment[data-index="${nextIndex}"]`);
    if (!activeRow) return;
    activeRow.classList.add("is-active");
    activeRow.setAttribute("aria-current", "true");
    if (follow) {
      const top = activeRow.offsetTop;
      const bottom = top + activeRow.offsetHeight;
      if (top < preview.scrollTop || bottom > preview.scrollTop + preview.clientHeight) {
        preview.scrollTo({ top: Math.max(0, top - preview.clientHeight / 2), behavior: "smooth" });
      }
    }
  };

  const ensureVideoListener = () => {
    const video = document.querySelector("video");
    if (!video || video === boundVideo) return;
    boundVideo?.removeEventListener("timeupdate", boundVideo.__ytdlTimeUpdate);
    const onTimeUpdate = () => updateActiveSegment(video.currentTime * 1000);
    video.__ytdlTimeUpdate = onTimeUpdate;
    video.addEventListener("timeupdate", onTimeUpdate);
    boundVideo = video;
    updateActiveSegment(video.currentTime * 1000, false);
  };

  const createPanel = () => {
    const panel = document.createElement("section");
    panel.id = "ytdl-panel";
    panel.dataset.theme = resolvedTheme();
    panel.innerHTML = `
      <div class="ytdl-heading">
        <img class="ytdl-icon" src="${extensionApi.getURL("icons/icon-48.png")}" alt="">
        <div class="ytdl-heading-copy"><h2>${t("title")}</h2><p>${t("subtitle")}</p></div>
        <div class="ytdl-settings-control">
          <button type="button" id="ytdl-settings-button" class="ytdl-settings-button" title="${t("settings")}" aria-label="${t("settings")}" aria-haspopup="dialog" aria-controls="ytdl-settings" aria-expanded="false">⚙</button>
          <div id="ytdl-settings" class="ytdl-settings" role="dialog" aria-label="${t("settings")}" hidden>
            <label class="ytdl-field"><span>${t("interfaceLanguage")}</span>
              <select id="ytdl-interface-language" class="ytdl-select">
                <option value="auto" ${state.uiLanguageSetting === "auto" ? "selected" : ""}>${t("browserDefault")}</option>
                <option value="en" ${state.uiLanguageSetting === "en" ? "selected" : ""}>English</option>
                <option value="pt-BR" ${state.uiLanguageSetting === "pt-BR" ? "selected" : ""}>Português (Brasil)</option>
                <option value="fr" ${state.uiLanguageSetting === "fr" ? "selected" : ""}>Français</option>
              </select>
            </label>
            <label class="ytdl-field"><span>${t("appearance")}</span>
              <select id="ytdl-interface-theme" class="ytdl-select">
                <option value="system" ${state.themeSetting === "system" ? "selected" : ""}>${t("followSystem")}</option>
                <option value="light" ${state.themeSetting === "light" ? "selected" : ""}>${t("lightTheme")}</option>
                <option value="dark" ${state.themeSetting === "dark" ? "selected" : ""}>${t("darkTheme")}</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      <label class="ytdl-label" for="ytdl-track">${t("transcriptLanguage")}</label>
      <select id="ytdl-track" class="ytdl-select"><option>${t("lookingCaptions")}</option></select>
      <div class="ytdl-translation">
        <label class="ytdl-toggle" for="ytdl-translate"><input id="ytdl-translate" type="checkbox" ${state.translate ? "checked" : ""}><span>${t("translate")}</span></label>
        <select id="ytdl-target-language" class="ytdl-select ytdl-target" ${state.translate ? "" : "disabled"} aria-label="Translation target language">
          ${["en", "es", "pt-BR", "fr", "de", "it", "ja", "ko", "zh-Hans"].map((code) => `<option value="${code}" ${state.targetLanguage === code ? "selected" : ""}>${languageLabel(code)}</option>`).join("")}
        </select>
      </div>
      <p id="ytdl-status" aria-live="polite">${t("lookingSubtitles")}</p>
      <div id="ytdl-progress" class="ytdl-progress" role="progressbar" aria-label="Transcript download progress" aria-valuemin="0" aria-valuemax="100" hidden><span id="ytdl-progress-bar"></span></div>
      <button type="button" id="ytdl-retry" class="ytdl-retry" hidden>${t("retry")}</button>
      <div id="ytdl-preview" aria-label="Transcript preview"></div>
      <div class="ytdl-export-heading"><b>${t("chooseFormat")}</b><span>${t("selectContinue")}</span></div>
      <div class="ytdl-grid" role="group" aria-label="Export format">
        <button type="button" class="ytdl-format" data-format="structured" aria-pressed="false" disabled><b>${t("structured")}</b><span>${t("structuredHint")}</span></button>
        <button type="button" class="ytdl-format" data-format="markdown" aria-pressed="false" disabled><b>${t("markdown")}</b><span>${t("markdownHint")}</span></button>
        <button type="button" class="ytdl-format" data-format="original" aria-pressed="false" disabled><b>${t("plainText")}</b><span>${t("plainHint")}</span></button>
        <button type="button" class="ytdl-format" data-format="srt" aria-pressed="false" disabled><b>${t("subtitles")}</b><span>${t("subtitlesHint")}</span></button>
        <button type="button" class="ytdl-format ytdl-wide" data-format="json" aria-pressed="false" disabled><b>JSON</b><span>${t("jsonHint")}</span></button>
      </div>
      <details id="ytdl-advanced" class="ytdl-advanced">
        <summary><span><b>${t("advanced")}</b><small>${t("aiAutomation")}</small></span><span class="ytdl-chevron" aria-hidden="true">⌄</span></summary>
        <div class="ytdl-advanced-body">
          <p class="ytdl-help">${t("advancedHelp")}</p>
          <label class="ytdl-field"><span>${t("exportTitle")}</span><input id="ytdl-export-title" type="text" placeholder="${t("titlePlaceholder")}"></label>
          <div class="ytdl-field-row">
            <label class="ytdl-field"><span>${t("contentType")}</span><input id="ytdl-content-type" type="text" placeholder="${t("contentPlaceholder")}"></label>
            <label class="ytdl-field"><span>${t("tags")} <small>${t("commaSeparated")}</small></span><input id="ytdl-tags" type="text" placeholder="${t("tagsPlaceholder")}"></label>
          </div>
          <label class="ytdl-field"><span>${t("aiContext")}</span><textarea id="ytdl-ai-context" rows="3" placeholder="${t("aiPlaceholder")}"></textarea></label>
          <label class="ytdl-check"><input id="ytdl-include-metadata" type="checkbox"><span>${t("includeMetadata")}</span></label>
          <p id="ytdl-advanced-save-state" class="ytdl-save-state" aria-live="polite">${t("loadingSaved")}</p>
        </div>
      </details>
      <div id="ytdl-selected-preview" class="ytdl-selected-preview" hidden>
        <div class="ytdl-preview-heading"><span><b>${t("exportPreview")}</b><small id="ytdl-preview-format">${t("jsonPreview")}</small></span><button type="button" id="ytdl-copy-preview">${t("copy")}</button></div>
        <textarea id="ytdl-export-preview" class="ytdl-export-preview" readonly spellcheck="false" aria-label="Exact export content preview"></textarea>
        <p class="ytdl-help ytdl-help-tight">${t("exactPreview")}</p>
      </div>
      <button type="button" id="ytdl-export" class="ytdl-primary" hidden>${t("exportTranscript")}</button>`;

    const settingsButton = panel.querySelector("#ytdl-settings-button");
    settingsButton.addEventListener("click", () => setSettingsDropdown(panel, "toggle"));
    panel.querySelector("#ytdl-interface-language").addEventListener("change", (event) => {
      const setting = event.target.value;
      state.uiLanguageSetting = setting;
      state.uiLanguage = setting === "auto" ? browserLanguage() : setting;
      extensionApi.storageSet({ [UI_LANGUAGE_STORAGE_KEY]: setting }).catch(() => {});
      setSettingsDropdown(panel, "close");
      panel.remove();
      document.querySelector("#ytdl-action")?.remove();
      mount();
    });
    panel.querySelector("#ytdl-interface-theme").addEventListener("change", (event) => {
      state.themeSetting = event.target.value;
      extensionApi.storageSet({ [THEME_STORAGE_KEY]: state.themeSetting }).catch(() => {});
      applyTheme();
    });

    panel.querySelector("#ytdl-track").addEventListener("change", (event) => {
      state.selectedTrackIndex = Number(event.target.value) || 0;
      state.segments = [];
      clearFormat();
      renderPreview();
      requestTranscript();
    });
    panel.querySelector("#ytdl-translate").addEventListener("change", (event) => {
      state.translate = event.target.checked;
      panel.querySelector("#ytdl-target-language").disabled = !state.translate;
      state.segments = [];
      clearFormat();
      renderPreview();
      if (state.translate) {
        const ready = state.uiLanguage === "pt-BR"
          ? `Tradução para ${languageLabel(state.targetLanguage)} pronta para carregar.`
          : state.uiLanguage === "fr"
            ? `La traduction vers ${languageLabel(state.targetLanguage)} est prête à être chargée.`
            : `Translation to ${languageLabel(state.targetLanguage)} is ready to load.`;
        setStatus(ready);
      } else {
        setStatus(t("translationDisabled"));
      }
      requestTranscript();
    });
    panel.querySelector("#ytdl-target-language").addEventListener("change", (event) => {
      state.targetLanguage = event.target.value;
      if (state.translate) {
        state.segments = [];
        clearFormat();
        renderPreview();
        const changed = state.uiLanguage === "pt-BR"
          ? `Destino alterado para ${languageLabel(state.targetLanguage)}. Carregue as legendas.`
          : state.uiLanguage === "fr"
            ? `Langue cible définie sur ${languageLabel(state.targetLanguage)}. Chargez les sous-titres.`
            : `Target changed to ${languageLabel(state.targetLanguage)}. Load subtitles to continue.`;
        setStatus(changed);
        requestTranscript();
      }
    });
    panel.querySelector("#ytdl-retry").addEventListener("click", () => {
      setRetryVisible(false);
      setStatus(t("retrying"));
      if (state.tracks.length || state.hasCapturedPanel) {
        requestTranscript();
      } else {
        state.autoLoadRequested = false;
        requestTracks(true);
      }
    });
    const advancedInputs = {
      "#ytdl-export-title": "title",
      "#ytdl-content-type": "contentType",
      "#ytdl-tags": "tags",
      "#ytdl-ai-context": "context"
    };
    for (const [selector, key] of Object.entries(advancedInputs)) {
      panel.querySelector(selector).addEventListener("input", (event) => {
        state.advanced[key] = event.target.value;
        renderExportPreview();
        saveAdvancedOptions();
      });
    }
    panel.querySelector("#ytdl-include-metadata").addEventListener("change", (event) => {
      state.advanced.includeMetadata = event.target.checked;
      renderExportPreview();
      saveAdvancedOptions();
    });
    panel.querySelector("#ytdl-copy-preview").addEventListener("click", async (event) => {
      const preview = panel.querySelector("#ytdl-export-preview");
      try {
        await navigator.clipboard.writeText(preview.value);
      } catch (_) {
        preview.select();
        document.execCommand("copy");
      }
      event.currentTarget.textContent = t("copied");
      setTimeout(() => { event.currentTarget.textContent = t("copy"); }, 1200);
    });
    panel.querySelectorAll(".ytdl-format").forEach((button) => {
      button.addEventListener("click", () => selectFormat(button.dataset.format));
    });
    panel.querySelector("#ytdl-export").addEventListener("click", () => {
      if (state.selectedFormat && state.segments.length) download(state.selectedFormat);
    });
    return panel;
  };

  const mountPanel = () => {
    if (document.querySelector("#ytdl-panel")) return true;
    const target = document.querySelector("#secondary-inner") || document.querySelector("#secondary");
    if (!target) return false;
    target.prepend(createPanel());
    renderTracks();
    renderPreview();
    loadAdvancedOptions();
    setLoading(state.loading);
    renderProgress();
    if (state.selectedFormat) selectFormat(state.selectedFormat);
    const restored = Core.restoredPanelState(state);
    if (restored.statusMessage) setStatus(restored.statusMessage, restored.statusKind);
    setRetryVisible(restored.retryVisible);
    loadInterfaceLanguage();
    return true;
  };

  const mountActionButton = () => {
    if (document.querySelector("#ytdl-action")) return;
    const target = document.querySelector("#top-level-buttons-computed") || document.querySelector("ytd-watch-metadata #actions-inner");
    if (!target) return;
    const button = document.createElement("button");
    button.id = "ytdl-action";
    button.type = "button";
    button.innerHTML = `<span aria-hidden="true">↓</span> ${localized("Transcript", "Transcrição", "Transcription")}`;
    button.title = localized("Open transcript downloads", "Abrir downloads de transcrição", "Ouvrir les téléchargements de transcription");
    button.addEventListener("click", () => {
      mountPanel();
      const panel = document.querySelector("#ytdl-panel");
      panel?.scrollIntoView({ behavior: "smooth", block: "center" });
      panel?.classList.add("ytdl-highlight");
      setTimeout(() => panel?.classList.remove("ytdl-highlight"), 900);
    });
    target.append(button);
  };

  const mount = () => {
    mountPanel();
    mountActionButton();
    ensureVideoListener();
  };

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window || message?.source !== CHANNEL) return;
    if (message.type === "TRACKS_RESULT") {
      clearTimeout(trackDiscoveryTimer);
      setDiscoveringTracks(false);
      state.tracks = message.tracks || [];
      state.originalTrackIndex = Core.selectedCaptionTrackIndex(state.tracks, message.originalTrackIndex);
      if (!state.tracks.some((track) => Number(track.index) === state.selectedTrackIndex)) {
        state.selectedTrackIndex = state.originalTrackIndex;
      }
      state.hasCapturedPanel = Boolean(message.hasCapturedPanel);
      state.metadata = message.metadata || {};
      renderTracks();
      renderExportPreview();
      if (!state.loading) {
        setLoading(false);
        if (state.tracks.length || state.hasCapturedPanel) {
          if (Core.shouldAutoLoad(state)) {
            state.autoLoadRequested = true;
            requestTranscript();
          } else if (state.segments.length) {
            setStatus(t("chooseFormatStatus"), "success");
          }
        } else {
          setStatus(t("noCaptions"), "error");
          setRetryVisible(true);
        }
      }
    }
    if (message.type === "PANEL_TRANSCRIPT_CAPTURED") {
      clearTimeout(trackDiscoveryTimer);
      setDiscoveringTracks(false);
      state.hasCapturedPanel = true;
      if (!state.loading) {
        setLoading(false);
        if (Core.shouldAutoLoad(state)) {
          state.autoLoadRequested = true;
          requestTranscript();
        }
      }
    }
    if (message.type === "TRANSCRIPT_PROGRESS") {
      setProgress(Number.isFinite(message.percent) ? message.percent : null);
    }
    if (message.type === "TRANSCRIPT_RESULT") {
      clearTimeout(transcriptLoadTimer);
      state.segments = message.segments || [];
      state.metadata = message.metadata || state.metadata;
      state.track = message.track || {};
      setLoading(false, true);
      if (state.reloadRequested) {
        state.reloadRequested = false;
        state.segments = [];
        requestTranscript();
        return;
      }
      setRetryVisible(false);
      renderPreview();
      renderExportPreview();
      const count = state.segments.length.toLocaleString(state.uiLanguage);
      const translationNote = state.track.translated ? localized(
        ` Translated to ${languageLabel(state.track.targetLanguage)} with Google Translate.`,
        ` Traduzida para ${languageLabel(state.track.targetLanguage)} com o Google Tradutor.`,
        ` Traduite en ${languageLabel(state.track.targetLanguage)} avec Google Traduction.`
      ) : "";
      setStatus(localized(
        `${count} transcript segments loaded.${translationNote} ${t("chooseFormatStatus")}`,
        `${count} segmentos da transcrição carregados.${translationNote} ${t("chooseFormatStatus")}`,
        `${count} segments de transcription chargés.${translationNote} ${t("chooseFormatStatus")}`
      ), "success");
    }
    if (message.type === "TRANSCRIPT_ERROR") {
      clearTimeout(transcriptLoadTimer);
      setLoading(false);
      if (state.reloadRequested) {
        state.reloadRequested = false;
        requestTranscript();
        return;
      }
      setStatus(message.message || "Could not load the transcript.", "error");
      setRetryVisible(true);
    }
  });

  let lastUrl = location.href;
  const refresh = () => {
    mount();
    requestTracks();
  };
  const observer = new MutationObserver(() => {
    mount();
    if (location.href !== lastUrl) {
      clearTimeout(transcriptLoadTimer);
      clearTimeout(trackDiscoveryTimer);
      lastUrl = location.href;
      state.tracks = [];
      state.originalTrackIndex = 0;
      state.selectedTrackIndex = null;
      state.segments = [];
      state.metadata = {};
      state.track = {};
      state.loading = false;
      state.discoveringTracks = false;
      state.progressPercent = null;
      state.progressCompleted = false;
      state.selectedFormat = "";
      state.translate = false;
      state.targetLanguage = "en";
      state.advanced = { title: "", contentType: "", tags: "", context: "", includeMetadata: false };
      state.hasCapturedPanel = false;
      state.autoLoadRequested = false;
      state.reloadRequested = false;
      state.retryVisible = false;
      state.statusMessage = "";
      state.statusKind = "";
      document.querySelector("#ytdl-panel")?.remove();
      document.querySelector("#ytdl-action")?.remove();
      setTimeout(refresh, 500);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.themeSetting === "system") applyTheme();
  });
  document.addEventListener("yt-navigate-finish", () => setTimeout(refresh, 350));
  refresh();
  setTimeout(refresh, 1200);
  setTimeout(requestTracks, 3000);
  setTimeout(requestTracks, 6000);
})();
