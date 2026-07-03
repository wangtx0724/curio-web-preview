(function (root) {
  const STORAGE_KEY = "curio.ideas.v1";
  const THEME_COUNT = 6;
  const SAMPLE_ID_PREFIX = "sample-product-";
  const SAMPLE_IDEAS = [
    "语音记录要像按门铃一样简单：点一下，说一句，别让用户先想标题。",
    "Gallery 里的卡片不应该像笔记列表，更像一排刚被捡到的小想法。",
    "翻翻功能可以每天只推荐一条旧灵感，像 app 主动递来一张小纸条。",
    "用户说完后先保存，再让他慢慢修，不要把编辑变成第一步。",
    "收藏按钮可以叫“喜欢”，语气更轻，也更适合灵感这种不正式的东西。",
    "以后做 AI curator 时，不要总结太多，只补一句“这条想法可能适合发展成什么”。",
    "导出到 Markdown 时保留原话、时间和一行备注，别把灵感加工得太整齐。"
  ];

  function nowIso() {
    return new Date().toISOString();
  }

  function createId() {
    if (root.crypto && typeof root.crypto.randomUUID === "function") {
      return root.crypto.randomUUID();
    }
    return `curio-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createIdea(content, options = {}) {
    const text = String(content || "").trim();
    if (!text) return null;

    const createdAt = options.createdAt || nowIso();
    const random = typeof options.random === "number" ? options.random : Math.random();

    return {
      id: options.id || createId(),
      content: text,
      createdAt,
      updatedAt: createdAt,
      favorite: false,
      visualSeed: Math.floor(random * THEME_COUNT) % THEME_COUNT,
      export: {
        markdownReady: true,
        obsidianPath: null
      },
      ai: {
        curatorNote: null
      }
    };
  }

  function normalizeIdea(idea) {
    return {
      id: idea.id || createId(),
      content: String(idea.content || "").trim(),
      createdAt: idea.createdAt || nowIso(),
      updatedAt: idea.updatedAt || idea.createdAt || nowIso(),
      favorite: Boolean(idea.favorite),
      visualSeed: Number.isInteger(idea.visualSeed) ? idea.visualSeed % THEME_COUNT : 0,
      export: {
        markdownReady: true,
        obsidianPath: idea.export ? idea.export.obsidianPath || null : null
      },
      ai: {
        curatorNote: idea.ai ? idea.ai.curatorNote || null : null
      }
    };
  }

  function loadIdeas(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((item) => item && item.content).map(normalizeIdea)
        : [];
    } catch (error) {
      return [];
    }
  }

  function createSampleIdeas() {
    return SAMPLE_IDEAS.map((content, index) =>
      createIdea(content, {
        id: `${SAMPLE_ID_PREFIX}${index + 1}`,
        createdAt: new Date(Date.UTC(2026, 6, 3, 2, index * 6)).toISOString(),
        random: index / THEME_COUNT
      })
    );
  }

  function getInitialIdeas(storage) {
    if (storage.getItem(STORAGE_KEY) === null) return createSampleIdeas();
    const ideas = loadIdeas(storage);
    return ideas;
  }

  function saveIdeas(storage, ideas) {
    storage.setItem(STORAGE_KEY, JSON.stringify(ideas.map(normalizeIdea)));
  }

  function addIdea(ideas, content, options = {}) {
    const idea = createIdea(content, options);
    if (!idea) return { ideas, idea: null };
    return { ideas: [idea, ...ideas], idea };
  }

  function updateIdea(ideas, id, content, updatedAt = nowIso()) {
    const text = String(content || "").trim();
    if (!text) return ideas;
    return ideas.map((idea) =>
      idea.id === id ? { ...idea, content: text, updatedAt } : idea
    );
  }

  function toggleFavorite(ideas, id) {
    return ideas.map((idea) =>
      idea.id === id ? { ...idea, favorite: !idea.favorite, updatedAt: nowIso() } : idea
    );
  }

  function deleteIdea(ideas, id) {
    return ideas.filter((idea) => idea.id !== id);
  }

  function searchIdeas(ideas, query, favoritesOnly = false) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    return ideas.filter((idea) => {
      const matchesFavorite = !favoritesOnly || idea.favorite;
      const matchesQuery = !normalizedQuery || idea.content.toLowerCase().includes(normalizedQuery);
      return matchesFavorite && matchesQuery;
    });
  }

  function getRandomIdea(ideas, random = Math.random()) {
    if (!ideas.length) return null;
    return ideas[Math.floor(random * ideas.length) % ideas.length];
  }

  function mergeTranscript(currentText, transcript) {
    const current = String(currentText || "").trim();
    const spoken = String(transcript || "").trim();
    if (!spoken) return current;
    return current ? `${current}\n${spoken}` : spoken;
  }

  const CurioModel = {
    STORAGE_KEY,
    createIdea,
    normalizeIdea,
    loadIdeas,
    createSampleIdeas,
    getInitialIdeas,
    saveIdeas,
    addIdea,
    updateIdea,
    toggleFavorite,
    deleteIdea,
    searchIdeas,
    getRandomIdea,
    mergeTranscript
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = CurioModel;
  }

  root.CurioModel = CurioModel;

  if (typeof document === "undefined") return;

  const state = {
    ideas: getInitialIdeas(root.localStorage),
    activeView: "captureView",
    editingId: null,
    favoritesOnly: false,
    rediscoveredId: null,
    newestId: null,
    favoriteFeedbackId: null,
    rediscoverAnimating: false
  };

  const elements = {
    views: Array.from(document.querySelectorAll(".view")),
    navButtons: Array.from(document.querySelectorAll(".nav-button")),
    ideaInput: document.querySelector("#ideaInput"),
    saveIdea: document.querySelector("#saveIdea"),
    charCount: document.querySelector("#charCount"),
    latestCard: document.querySelector("#latestCard"),
    latestContent: document.querySelector("#latestContent"),
    galleryCount: document.querySelector("#galleryCount"),
    galleryList: document.querySelector("#galleryList"),
    searchInput: document.querySelector("#searchInput"),
    favoriteFilter: document.querySelector("#favoriteFilter"),
    drawIdea: document.querySelector("#drawIdea"),
    rediscoverStage: document.querySelector("#rediscoverStage"),
    editDialog: document.querySelector("#editDialog"),
    editInput: document.querySelector("#editInput"),
    confirmEdit: document.querySelector("#confirmEdit"),
    focusCapture: document.querySelector("#focusCapture"),
    openData: document.querySelector("#openData"),
    dataDialog: document.querySelector("#dataDialog"),
    dataCount: document.querySelector("#dataCount"),
    restoreSamples: document.querySelector("#restoreSamples"),
    clearIdeas: document.querySelector("#clearIdeas"),
    voiceInput: document.querySelector("#voiceInput"),
    voiceStatus: document.querySelector("#voiceStatus")
  };

  const SpeechRecognition = root.SpeechRecognition || root.webkitSpeechRecognition;
  let recognition = null;
  let voiceBaseText = "";
  let isListening = false;
  let voiceStartedByUser = false;
  let saveFeedbackTimer = null;
  let favoriteFeedbackTimer = null;
  let rediscoverTimer = null;
  let drawButtonTimer = null;

  function persist() {
    saveIdeas(root.localStorage, state.ideas);
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function collectionNumber(index) {
    return `curio ${String(index + 1).padStart(3, "0")}`;
  }

  function setView(viewId) {
    state.activeView = viewId;
    elements.views.forEach((view) => view.classList.toggle("is-active", view.id === viewId));
    elements.navButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === viewId);
    });
  }

  function makeIdeaCard(idea, options = {}) {
    const index = state.ideas.findIndex((item) => item.id === idea.id);
    const card = document.createElement("article");
    card.className = `idea-card theme-${idea.visualSeed}`;
    if (options.isNew) card.classList.add("is-new");

    const meta = document.createElement("div");
    meta.className = "card-meta";

    const number = document.createElement("span");
    number.textContent = collectionNumber(index);
    const date = document.createElement("span");
    date.textContent = formatDate(idea.createdAt);
    meta.append(number, date);

    const content = document.createElement("p");
    content.className = "card-content";
    content.textContent = idea.content;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const favorite = document.createElement("button");
    favorite.className = "mini-button";
    favorite.type = "button";
    const hasFavoriteFeedback = state.favoriteFeedbackId === idea.id;
    favorite.textContent = hasFavoriteFeedback
      ? (idea.favorite ? "喜欢啦" : "收回啦")
      : (idea.favorite ? "喜欢中" : "喜欢");
    favorite.classList.toggle("is-active", idea.favorite);
    favorite.classList.toggle("is-pop", hasFavoriteFeedback);
    favorite.addEventListener("click", () => {
      state.ideas = toggleFavorite(state.ideas, idea.id);
      state.favoriteFeedbackId = idea.id;
      persist();
      render();
      clearTimeout(favoriteFeedbackTimer);
      favoriteFeedbackTimer = root.setTimeout(() => {
        if (state.favoriteFeedbackId !== idea.id) return;
        state.favoriteFeedbackId = null;
        render();
      }, 1100);
    });

    const edit = document.createElement("button");
    edit.className = "mini-button";
    edit.type = "button";
    edit.textContent = "编辑";
    edit.addEventListener("click", () => openEdit(idea.id));

    const remove = document.createElement("button");
    remove.className = "mini-button";
    remove.type = "button";
    remove.textContent = "删除";
    remove.addEventListener("click", () => {
      if (!root.confirm("删掉这条灵感吗？")) return;
      state.ideas = deleteIdea(state.ideas, idea.id);
      if (state.rediscoveredId === idea.id) state.rediscoveredId = null;
      persist();
      render();
    });

    if (!options.hideActions) {
      actions.append(favorite, edit, remove);
      card.append(meta, content, actions);
      return card;
    }

    card.append(meta, content);
    return card;
  }

  function renderLatest() {
    elements.latestContent.replaceChildren();

    if (!state.ideas.length) {
      elements.latestContent.className = "empty-copy";
      elements.latestContent.textContent = "还空着呢，先丢一条进来。";
      return;
    }

    const latest = state.ideas[0];
    elements.latestContent.className = "";
    const latestDisplay = document.createElement("div");
    latestDisplay.className = "latest-display";
    if (state.newestId === latest.id) latestDisplay.classList.add("is-new");

    const meta = document.createElement("div");
    meta.className = "card-meta";

    const number = document.createElement("span");
    number.textContent = collectionNumber(0);
    const date = document.createElement("span");
    date.textContent = formatDate(latest.createdAt);
    meta.append(number, date);

    const content = document.createElement("p");
    content.className = "card-content";
    content.textContent = latest.content;

    latestDisplay.append(meta, content);
    elements.latestContent.appendChild(latestDisplay);
  }

  function renderGallery() {
    const visibleIdeas = searchIdeas(state.ideas, elements.searchInput.value, state.favoritesOnly);
    elements.galleryCount.textContent = `${visibleIdeas.length} 条`;
    elements.favoriteFilter.setAttribute("aria-pressed", String(state.favoritesOnly));
    elements.galleryList.replaceChildren();

    if (!visibleIdeas.length) {
      const empty = document.createElement("p");
      empty.className = "empty-copy";
      empty.textContent = state.ideas.length ? "没翻到这一条，换个词试试？" : "还空着呢，先丢一条进来。";
      elements.galleryList.appendChild(empty);
      return;
    }

    visibleIdeas.forEach((idea) => {
      elements.galleryList.appendChild(makeIdeaCard(idea, { isNew: state.newestId === idea.id }));
    });
  }

  function renderRediscover() {
    elements.rediscoverStage.replaceChildren();

    if (!state.ideas.length) {
      const avatar = document.createElement("img");
      avatar.className = "empty-avatar";
      avatar.src = "assets/rediscover-empty.png";
      avatar.alt = "";
      avatar.setAttribute("aria-hidden", "true");

      const copy = document.createElement("p");
      copy.className = "empty-copy";
      copy.textContent = "多存几条以后，我随机抓一条给你看。";
      elements.rediscoverStage.append(avatar, copy);
      return;
    }

    const selected = state.ideas.find((idea) => idea.id === state.rediscoveredId) || state.ideas[0];
    state.rediscoveredId = selected.id;
    const card = makeIdeaCard(selected);
    if (state.rediscoverAnimating) card.classList.add("is-rediscovered");
    elements.rediscoverStage.appendChild(card);
  }

  function render() {
    renderLatest();
    renderGallery();
    renderRediscover();
    renderDataStatus();
  }

  function saveCapture() {
    const result = addIdea(state.ideas, elements.ideaInput.value);
    if (!result.idea) {
      elements.ideaInput.focus();
      return;
    }

    state.ideas = result.ideas;
    state.newestId = result.idea.id;
    state.rediscoveredId = result.idea.id;
    elements.ideaInput.value = "";
    updateCharCount();
    persist();
    render();
    clearTimeout(saveFeedbackTimer);
    elements.saveIdea.disabled = true;
    elements.saveIdea.textContent = "收好啦";
    saveFeedbackTimer = root.setTimeout(() => {
      setView("galleryView");
      elements.saveIdea.disabled = false;
      elements.saveIdea.textContent = "收起来";
    }, 460);
  }

  function drawRandomIdea() {
    if (rediscoverTimer) return;
    const idea = getRandomIdea(state.ideas);
    if (!idea) {
      state.rediscoveredId = null;
      renderRediscover();
      return;
    }

    elements.rediscoverStage.classList.add("is-swapping");
    elements.drawIdea.textContent = "翻翻中";
    rediscoverTimer = root.setTimeout(() => {
      state.rediscoveredId = idea.id;
      state.rediscoverAnimating = true;
      elements.rediscoverStage.classList.remove("is-swapping");
      renderRediscover();
      clearTimeout(drawButtonTimer);
      elements.drawIdea.textContent = "翻到了";
      drawButtonTimer = root.setTimeout(() => {
        elements.drawIdea.textContent = "换一条";
      }, 900);
      rediscoverTimer = root.setTimeout(() => {
        state.rediscoverAnimating = false;
        rediscoverTimer = null;
      }, 520);
    }, 180);
  }

  function openEdit(id) {
    const idea = state.ideas.find((item) => item.id === id);
    if (!idea) return;
    state.editingId = id;
    elements.editInput.value = idea.content;
    elements.editDialog.showModal();
    setTimeout(() => elements.editInput.focus(), 40);
  }

  function confirmEdit() {
    if (!state.editingId) return;
    state.ideas = updateIdea(state.ideas, state.editingId, elements.editInput.value);
    persist();
    elements.editDialog.close();
    state.editingId = null;
    render();
  }

  function updateCharCount() {
    elements.charCount.textContent = `${elements.ideaInput.value.length} / 420`;
  }

  function renderDataStatus() {
    elements.dataCount.textContent = `${state.ideas.length} 条灵感`;
  }

  function openDataDialog() {
    renderDataStatus();
    elements.dataDialog.showModal();
  }

  function restoreSamples() {
    if (state.ideas.length && !root.confirm("用样例替换当前灵感吗？")) return;
    state.ideas = createSampleIdeas();
    state.rediscoveredId = null;
    state.newestId = null;
    elements.searchInput.value = "";
    state.favoritesOnly = false;
    persist();
    render();
  }

  function clearIdeas() {
    if (!root.confirm("清空所有本地灵感吗？")) return;
    state.ideas = [];
    state.rediscoveredId = null;
    state.newestId = null;
    elements.searchInput.value = "";
    state.favoritesOnly = false;
    persist();
    render();
  }

  function setVoiceState(listening, message) {
    isListening = listening;
    elements.voiceInput.setAttribute("aria-pressed", String(listening));
    const label = elements.voiceInput.querySelector("span");
    if (label) label.textContent = listening ? "我在听" : "";
    elements.voiceStatus.textContent = message;
  }

  function initVoiceInput() {
    if (!SpeechRecognition) {
      elements.voiceInput.disabled = true;
      elements.voiceStatus.textContent = "这里不能直接听写，可以用系统键盘麦克风。";
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.addEventListener("start", () => {
      voiceBaseText = elements.ideaInput.value;
      voiceStartedByUser = true;
      setVoiceState(true, "说吧，我在听。");
    });

    recognition.addEventListener("result", (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      elements.ideaInput.value = mergeTranscript(voiceBaseText, transcript).slice(0, 420);
      updateCharCount();
    });

    recognition.addEventListener("end", () => {
      if (!voiceStartedByUser) return;
      voiceStartedByUser = false;
      setVoiceState(false, elements.ideaInput.value.trim() ? "我先放到下面了，你可以改改。" : "刚刚溜走了？再说一次。");
    });

    recognition.addEventListener("error", (event) => {
      voiceStartedByUser = false;
      const message = event.error === "not-allowed"
        ? "允许麦克风后，我就能听你说。"
        : "这次没听清，再说一遍。";
      setVoiceState(false, message);
    });
  }

  function toggleVoiceInput() {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
      return;
    }
    elements.voiceStatus.textContent = "先问一下麦克风权限。";
    recognition.start();
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  elements.saveIdea.addEventListener("click", saveCapture);
  elements.ideaInput.addEventListener("input", updateCharCount);
  elements.ideaInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      saveCapture();
    }
  });
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  elements.searchInput.addEventListener("input", renderGallery);
  elements.favoriteFilter.addEventListener("click", () => {
    state.favoritesOnly = !state.favoritesOnly;
    renderGallery();
  });
  elements.drawIdea.addEventListener("click", drawRandomIdea);
  elements.confirmEdit.addEventListener("click", confirmEdit);
  elements.focusCapture.addEventListener("click", () => setView("captureView"));
  elements.openData.addEventListener("click", openDataDialog);
  elements.restoreSamples.addEventListener("click", restoreSamples);
  elements.clearIdeas.addEventListener("click", clearIdeas);
  elements.voiceInput.addEventListener("click", toggleVoiceInput);

  initVoiceInput();
  registerServiceWorker();
  render();
  updateCharCount();
})(typeof window !== "undefined" ? window : globalThis);
