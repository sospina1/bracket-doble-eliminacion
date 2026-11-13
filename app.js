/* Interfaz del bracket. Depende de bracket.js (window.Bracket).
 * Modo local: cada navegador guarda su propio torneo.
 * Modo en línea (Firebase configurado): todos ven el mismo torneo y
 * solo el administrador puede editarlo (ver nube.js).
 */
(function () {
  "use strict";

  var B = window.Bracket;
  var STORAGE_KEY = "bracket-doble-eliminacion:v1";
  var cfg = window.FIREBASE_CONFIG;

  // Ejemplo: los 16 de la CRL 2026 en orden de seed para que el seeding
  // reproduzca exactamente los cruces de primera ronda del torneo real.
  var SAMPLE = [
    "Mohamed Light", "SandBox", "CAL Pedro", "CAL Sub", "SK Morten", "Guriko",
    "Hermit", "Vitor75", "Ryley", "Mugi", "Adriel", "Clown", "JL Viiper",
    "Woo", "Midnight", "Jorz"
  ];

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    setup: $("setup"), tournament: $("tournament"), topActions: $("topActions"), status: $("status"),
    players: $("players"), count: $("count"), errors: $("errors"),
    bo: $("bo"), boFinal: $("boFinal"), reset: $("reset"),
    upper: $("upper"), lower: $("lower"), final: $("final"),
    standings: $("standings"), champion: $("champion"), metaInfo: $("metaInfo"),
    hideByes: $("hideByes"), importFile: $("importFile"), live: $("live"),
    authArea: $("authArea"), btnLogin: $("btnLogin"), btnLogout: $("btnLogout"), adminBadge: $("adminBadge"),
    loginModal: $("loginModal"), loginForm: $("loginForm"), loginEmail: $("loginEmail"),
    loginPass: $("loginPass"), loginError: $("loginError"), loginSubmit: $("loginSubmit"),
    toast: $("toast")
  };

  var state = {
    t: null,
    hideByes: true,
    view: "auto",              // "setup" cuando el admin está editando jugadores
    remote: !!(cfg && cfg.apiKey),
    api: null,
    loaded: false,
    loadError: false,
    user: null,
    isAdmin: false
  };

  function canEdit() { return !state.remote || state.isAdmin; }

  /* ---------- Avisos ---------- */
  var toastTimer = null;
  function toast(msg, isError) {
    els.toast.textContent = msg;
    els.toast.className = "toast show" + (isError ? " error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.className = "toast"; }, isError ? 5000 : 2200);
  }

  /* ---------- Guardado ---------- */
  function saveLocal() {
    try {
      var data = { raw: els.players.value, hideByes: state.hideByes };
      if (!state.remote) data.t = state.t;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* sin almacenamiento: la página sigue funcionando */ }
  }

  function persist() {
    saveLocal();
    if (state.remote && state.isAdmin && state.api) {
      state.api.save(state.t).catch(function (err) {
        console.error(err);
        toast("No se pudo guardar en la nube. Revisa tu conexión o tus permisos de administrador.", true);
      });
    }
  }

  function loadLocal() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!data) return;
      els.players.value = data.raw || "";
      state.hideByes = data.hideByes !== false;
      if (!state.remote && data.t && data.t.matches) state.t = data.t;
    } catch (e) { /* ignorar */ }
  }

  /* ---------- Vistas ---------- */
  function showOnly(which) {
    els.setup.hidden = which !== "setup";
    els.tournament.hidden = which !== "tournament";
    els.status.hidden = which !== "status";
    els.topActions.hidden = !(which === "tournament" && canEdit());
  }

  function showStatus(title, text) {
    els.status.innerHTML = "";
    els.status.appendChild(el("h2", "card-title", title));
    if (text) els.status.appendChild(el("p", "status-text", text));
    showOnly("status");
  }

  function updateAuthUI() {
    els.authArea.hidden = !state.remote;
    els.btnLogin.hidden = !!state.isAdmin;
    els.btnLogout.hidden = !state.isAdmin;
    els.adminBadge.hidden = !state.isAdmin;
    els.live.hidden = !state.remote;
  }

  function updateView() {
    updateAuthUI();
    if (state.remote && !state.loaded) {
      if (state.loadError) showStatus("Sin conexión", "No se pudo cargar el torneo. Revisa tu internet y recarga la página.");
      else showStatus("Cargando torneo…", "");
      return;
    }
    if (canEdit() && (state.view === "setup" || !state.t)) {
      showSetup();
      return;
    }
    if (state.t) {
      showOnly("tournament");
      els.hideByes.checked = state.hideByes;
      render();
      return;
    }
    showStatus("El torneo aún no ha comenzado", "Cuando el administrador publique el bracket, aparecerá aquí automáticamente.");
  }

  /* ---------- Configuración ---------- */
  function currentNames() {
    return B.cleanNames(els.players.value.split("\n"));
  }

  function updateCount() {
    var n = currentNames().length;
    var txt = n + (n === 1 ? " jugador" : " jugadores");
    if (n >= B.MIN_PLAYERS && n <= B.MAX_PLAYERS) {
      var size = 1;
      while (size < n) size *= 2;
      var byes = size - n;
      txt += " · bracket de " + size + (byes ? " · " + byes + (byes === 1 ? " BYE" : " BYEs") : "");
    }
    els.count.textContent = txt;
  }

  function generate(mode) {
    if (!canEdit()) return;
    var names = currentNames();
    var errors = B.validate(names);
    els.errors.textContent = errors.join("\n");
    if (errors.length) return;
    if (state.t && Object.keys(state.t.scores).length &&
        !confirm("Se perderán los resultados del torneo actual. ¿Continuar?")) return;
    state.t = B.createTournament(names, {
      mode: mode,
      bo: Number(els.bo.value),
      boFinal: Number(els.boFinal.value),
      reset: els.reset.checked
    });
    state.view = "auto";
    persist();
    updateView();
    window.scrollTo(0, 0);
  }

  function showSetup() {
    showOnly("setup");
    $("btnBack").hidden = !state.t;
    if (state.t) {
      if (!els.players.value.trim()) els.players.value = state.t.players.join("\n");
      els.bo.value = String(state.t.settings.bo);
      els.boFinal.value = String(state.t.settings.boFinal);
      els.reset.checked = state.t.settings.reset;
    }
    updateCount();
  }

  /* ---------- Render del bracket ---------- */
  function playerName(v) {
    if (v === null) return null;
    if (v === B.BYE) return "BYE";
    return state.t.players[v];
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render() {
    var t = state.t;
    var comp = B.compute(t);
    var numbers = {};
    t.matches.forEach(function (m, i) { numbers[m.id] = i + 1; });

    var byes = t.size - t.players.length;
    els.metaInfo.textContent = t.players.length + " jugadores · bracket de " + t.size +
      (byes ? " · " + byes + " BYE" + (byes > 1 ? "s" : "") : "") +
      " · reparto " + (t.settings.mode === "random" ? "al azar" : "por seeding") +
      " · Bo" + t.settings.bo + " / finales Bo" + t.settings.boFinal;

    renderBracket(els.upper, "W", comp, numbers);
    renderBracket(els.lower, "L", comp, numbers);
    renderBracket(els.final, "F", comp, numbers);
    renderStandings(comp);

    if (comp.champion !== null) {
      els.champion.hidden = false;
      els.champion.innerHTML = "";
      els.champion.appendChild(document.createTextNode("Campeón: "));
      els.champion.appendChild(el("strong", "", playerName(comp.champion)));
    } else {
      els.champion.hidden = true;
    }
  }

  function renderBracket(container, bracket, comp, numbers) {
    var t = state.t;
    container.innerHTML = "";
    var rounds = {};
    t.matches.forEach(function (m) {
      if (m.bracket !== bracket) return;
      var st = comp.byId[m.id];
      if (st.hidden) return;
      if (state.hideByes && st.bye) return;
      (rounds[m.round] = rounds[m.round] || []).push(m);
    });
    Object.keys(rounds).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
      var col = el("div", "round");
      col.appendChild(el("div", "round-title", B.roundName(t, bracket, r)));
      var body = el("div", "round-body");
      rounds[r].forEach(function (m) { body.appendChild(renderMatch(m, comp.byId[m.id], numbers)); });
      col.appendChild(body);
      container.appendChild(col);
    });
    if (!container.children.length) {
      container.appendChild(el("p", "meta", "Sin partidas que mostrar."));
    }
  }

  function originText(slot, numbers) {
    if (slot.type === "winner") return "Ganador de #" + numbers[slot.match];
    if (slot.type === "loser") return "Perdedor de #" + numbers[slot.match];
    return "Por definir";
  }

  function renderMatch(m, st, numbers) {
    var editable = canEdit();
    var card = el("div", "match");
    var ready = !st.done && st.a !== null && st.b !== null;
    if (st.bye) card.classList.add("bye");
    if (ready) card.classList.add("ready");

    var head = el("div", "match-head");
    head.appendChild(el("span", "", "#" + numbers[m.id]));
    var hasBye = st.bye || st.a === B.BYE || st.b === B.BYE;
    var headRight = hasBye ? "Pase directo" : "Bo" + m.bo;
    if (!editable && ready) headRight = "Por jugar · Bo" + m.bo;
    head.appendChild(el("span", "", headRight));
    card.appendChild(head);

    ["a", "b"].forEach(function (side, idx) {
      var v = st[side];
      var row = el("div", "slot");
      var seed = el("span", "seed", v !== null && v !== B.BYE ? String(v + 1) : "");
      var nameCls = "name" + (v === null ? " tbd" : v === B.BYE ? " byename" : "");
      var name = el("span", nameCls, v === null ? originText(m[side], numbers) : playerName(v));
      row.appendChild(seed);
      row.appendChild(name);
      if (st.score) row.appendChild(el("span", "sc", String(st.score[idx])));
      if (st.done && !st.bye) row.classList.add(st.winner === v ? "win" : "lose");
      if (st.done && st.bye && v !== B.BYE) row.classList.add("win");
      if (v !== null && v !== B.BYE) {
        row.dataset.p = String(v);
        row.title = playerName(v);
      }
      card.appendChild(row);
    });

    // Solo quien puede editar ve el selector de resultado
    if (editable && !st.bye && st.a !== null && st.b !== null) {
      var sel = el("select");
      sel.setAttribute("aria-label", "Resultado de la partida " + numbers[m.id]);
      sel.appendChild(new Option(st.done ? "Quitar resultado" : "Elegir resultado…", ""));
      B.scoreOptions(m.bo).forEach(function (o) {
        var winner = o[0] > o[1] ? playerName(st.a) : playerName(st.b);
        var opt = new Option(o[0] + "–" + o[1] + "  (gana " + winner + ")", o[0] + "-" + o[1]);
        if (st.score && st.score[0] === o[0] && st.score[1] === o[1]) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", function () {
        if (!canEdit()) return;
        var val = sel.value;
        B.setScore(state.t, m.id, val ? val.split("-").map(Number) : null);
        persist();
        render();
      });
      card.appendChild(sel);
    }
    return card;
  }

  function ordinal(n) { return n + ".º"; }

  function renderStandings(comp) {
    els.standings.innerHTML = "";
    var t = state.t;
    if (!comp.standings.length) {
      els.standings.appendChild(el("div", "empty", "Aún no hay eliminados."));
      return;
    }
    comp.standings.forEach(function (g) {
      var label;
      if (g.place !== null) {
        var end = g.place + g.players.length - 1;
        label = g.players.length > 1 ? ordinal(g.place) + "–" + ordinal(end) : ordinal(g.place);
      } else {
        label = "Fuera en " + B.roundName(t, "L", g.round);
      }
      g.players.forEach(function (p) {
        var row = el("div", "row" + (g.place === 1 ? " first" : ""));
        row.appendChild(el("span", "place", label));
        row.appendChild(el("span", "", playerName(p)));
        els.standings.appendChild(row);
      });
    });
  }

  // Resaltar a un jugador en todo el bracket al pasar el cursor o tocarlo
  function highlight(p) {
    document.querySelectorAll(".slot.hl").forEach(function (n) { n.classList.remove("hl"); });
    if (p === null) return;
    document.querySelectorAll('.slot[data-p="' + p + '"]').forEach(function (n) { n.classList.add("hl"); });
  }

  /* ---------- Exportar / importar ---------- */
  function exportJson() {
    var blob = new Blob([JSON.stringify(state.t, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "torneo.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importJson(file) {
    if (!canEdit()) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var t = JSON.parse(reader.result);
        if (!t || !Array.isArray(t.players) || !Array.isArray(t.matches) || !t.scores) throw new Error();
        B.compute(t); // valida que la estructura funcione
        state.t = t;
        state.view = "auto";
        els.players.value = t.players.join("\n");
        persist();
        updateView();
      } catch (e) {
        els.errors.textContent = "El archivo no es un torneo válido.";
      }
    };
    reader.readAsText(file);
  }

  /* ---------- Renombrar jugadores (sin tocar cruces ni resultados) ---------- */
  // Los cruces y marcadores usan la posición de cada jugador, no su nombre,
  // así que basta con cambiar el texto en t.players.
  function openRename() {
    if (!canEdit() || !state.t) return;
    var list = $("renameList");
    list.innerHTML = "";
    state.t.players.forEach(function (name, i) {
      var row = el("label", "rename-row");
      row.appendChild(el("span", "seed", String(i + 1)));
      var input = el("input");
      input.type = "text";
      input.value = name;
      input.dataset.i = String(i);
      input.setAttribute("aria-label", "Nombre del jugador " + (i + 1));
      input.autocomplete = "off";
      row.appendChild(input);
      list.appendChild(row);
    });
    $("renameError").textContent = "";
    $("renameModal").hidden = false;
  }
  function closeRename() { $("renameModal").hidden = true; }

  function saveRename(e) {
    e.preventDefault();
    if (!canEdit() || !state.t) return;
    var inputs = $("renameList").querySelectorAll("input");
    var names = [];
    var seen = {};
    var error = "";
    inputs.forEach(function (input) {
      var n = input.value.trim();
      if (!n) error = error || "Ningún nombre puede quedar vacío.";
      var key = n.toLowerCase();
      if (n && seen[key]) error = error || "Nombre repetido: " + n;
      seen[key] = true;
      names.push(n);
    });
    if (error) { $("renameError").textContent = error; return; }
    var changed = names.some(function (n, i) { return n !== state.t.players[i]; });
    closeRename();
    if (!changed) return;
    state.t.players = names;
    els.players.value = names.join("\n");
    persist();
    render();
    toast("Nombres actualizados");
  }

  /* ---------- Acceso de administrador ---------- */
  function openLogin() {
    els.loginError.textContent = "";
    els.loginPass.value = "";
    els.loginModal.hidden = false;
    setTimeout(function () { els.loginEmail.focus(); }, 50);
  }
  function closeLogin() { els.loginModal.hidden = true; }

  function loginErrorText(err) {
    var code = (err && err.code) || "";
    if (code.indexOf("invalid") !== -1 || code.indexOf("wrong-password") !== -1 || code.indexOf("user-not-found") !== -1)
      return "Correo o contraseña incorrectos.";
    if (code.indexOf("too-many-requests") !== -1) return "Demasiados intentos. Espera unos minutos.";
    if (code.indexOf("network") !== -1) return "Sin conexión a internet.";
    return "No se pudo iniciar sesión.";
  }

  /* ---------- Conexión con la nube (la llama nube.js) ---------- */
  window.BracketApp = {
    connect: function (api) {
      state.api = api;
      api.onAuth(function (user) {
        state.user = user;
        state.isAdmin = !!user && (!api.adminUid || user.uid === api.adminUid);
        if (user && !state.isAdmin) {
          toast("Esta cuenta no es la del administrador.", true);
          api.logout();
        }
        if (!state.isAdmin) state.view = "auto";
        updateView();
      });
      api.onTournament(function (t, err) {
        if (err) {
          console.error(err);
          if (!state.loaded) { state.loadError = true; updateView(); }
          return;
        }
        state.t = t;
        state.loaded = true;
        state.loadError = false;
        // Si el admin está escribiendo jugadores, no le cambiamos la pantalla
        if (canEdit() && state.view === "setup") return;
        updateView();
      });
    }
  };

  /* ---------- Eventos ---------- */
  els.players.addEventListener("input", function () { updateCount(); saveLocal(); });
  $("btnSeed").addEventListener("click", function () { generate("seed"); });
  $("btnRandom").addEventListener("click", function () { generate("random"); });
  $("btnSample").addEventListener("click", function () {
    els.players.value = SAMPLE.join("\n");
    els.bo.value = "3";
    els.boFinal.value = "5";
    els.reset.checked = true;
    updateCount();
    saveLocal();
  });
  $("btnEdit").addEventListener("click", function () {
    if (!canEdit()) return;
    state.view = "setup";
    updateView();
  });
  $("btnBack").addEventListener("click", function () {
    state.view = "auto";
    updateView();
  });
  $("btnClear").addEventListener("click", function () {
    if (!canEdit()) return;
    if (!confirm("¿Borrar todos los resultados? Los cruces se mantienen.")) return;
    state.t.scores = {};
    persist();
    render();
  });
  $("btnExport").addEventListener("click", exportJson);
  els.importFile.addEventListener("change", function () {
    if (els.importFile.files[0]) importJson(els.importFile.files[0]);
    els.importFile.value = "";
  });
  els.hideByes.addEventListener("change", function () {
    state.hideByes = els.hideByes.checked;
    saveLocal();
    render();
  });
  els.tournament.addEventListener("mouseover", function (e) {
    var slot = e.target.closest(".slot[data-p]");
    highlight(slot ? slot.dataset.p : null);
  });
  els.tournament.addEventListener("mouseleave", function () { highlight(null); });

  $("btnRename").addEventListener("click", openRename);
  $("renameCancel").addEventListener("click", closeRename);
  $("renameForm").addEventListener("submit", saveRename);
  $("renameModal").addEventListener("click", function (e) { if (e.target === $("renameModal")) closeRename(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("renameModal").hidden) closeRename(); });

  els.btnLogin.addEventListener("click", openLogin);
  $("loginCancel").addEventListener("click", closeLogin);
  els.loginModal.addEventListener("click", function (e) { if (e.target === els.loginModal) closeLogin(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !els.loginModal.hidden) closeLogin(); });
  els.loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!state.api) { els.loginError.textContent = "Todavía conectando, intenta de nuevo."; return; }
    els.loginError.textContent = "";
    els.loginSubmit.disabled = true;
    state.api.login(els.loginEmail.value.trim(), els.loginPass.value)
      .then(function () {
        els.loginPass.value = "";
        closeLogin();
        toast("Modo administrador activado");
      })
      .catch(function (err) { els.loginError.textContent = loginErrorText(err); })
      .then(function () { els.loginSubmit.disabled = false; });
  });
  els.btnLogout.addEventListener("click", function () {
    if (state.api) state.api.logout().then(function () { toast("Sesión cerrada"); });
  });

  /* ---------- Inicio ---------- */
  if (state.remote) $("foot").textContent = "Proyecto de código abierto · el torneo se actualiza en vivo para todos.";
  loadLocal();
  updateView();
})();
