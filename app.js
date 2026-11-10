/* Interfaz del bracket. Depende de bracket.js (window.Bracket). */
(function () {
  "use strict";

  var B = window.Bracket;
  var STORAGE_KEY = "bracket-doble-eliminacion:v1";

  // Ejemplo: los 16 de la CRL 2026 en orden de seed para que el seeding
  // reproduzca exactamente los cruces de primera ronda del torneo real.
  var SAMPLE = [
    "Mohamed Light", "SandBox", "CAL Pedro", "CAL Sub", "SK Morten", "Guriko",
    "Hermit", "Vitor75", "Ryley", "Mugi", "Adriel", "Clown", "JL Viiper",
    "Woo", "Midnight", "Jorz"
  ];

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    setup: $("setup"), tournament: $("tournament"), topActions: $("topActions"),
    players: $("players"), count: $("count"), errors: $("errors"),
    bo: $("bo"), boFinal: $("boFinal"), reset: $("reset"),
    upper: $("upper"), lower: $("lower"), final: $("final"),
    standings: $("standings"), champion: $("champion"), metaInfo: $("metaInfo"),
    hideByes: $("hideByes"), importFile: $("importFile")
  };

  var state = { t: null, raw: "", hideByes: true };

  /* ---------- Guardado local (opcional, puede fallar) ---------- */
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        t: state.t, raw: els.players.value, hideByes: state.hideByes
      }));
    } catch (e) { /* sin almacenamiento: la página sigue funcionando */ }
  }

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!data) return;
      els.players.value = data.raw || "";
      state.hideByes = data.hideByes !== false;
      if (data.t && data.t.matches) state.t = data.t;
    } catch (e) { /* ignorar */ }
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
    save();
    showTournament();
  }

  function showSetup() {
    els.setup.hidden = false;
    els.tournament.hidden = true;
    els.topActions.hidden = true;
    $("btnBack").hidden = !state.t;
    if (state.t) {
      els.bo.value = String(state.t.settings.bo);
      els.boFinal.value = String(state.t.settings.boFinal);
      els.reset.checked = state.t.settings.reset;
    }
    updateCount();
  }

  function showTournament() {
    els.setup.hidden = true;
    els.tournament.hidden = false;
    els.topActions.hidden = false;
    els.hideByes.checked = state.hideByes;
    render();
    window.scrollTo(0, 0);
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
    if (slot.type === "gf") return "Por definir";
    return "Por definir";
  }

  function renderMatch(m, st, numbers) {
    var card = el("div", "match");
    var ready = !st.done && st.a !== null && st.b !== null;
    if (st.bye) card.classList.add("bye");
    if (ready) card.classList.add("ready");

    var head = el("div", "match-head");
    head.appendChild(el("span", "", "#" + numbers[m.id]));
    var hasBye = st.bye || st.a === B.BYE || st.b === B.BYE;
    head.appendChild(el("span", "", hasBye ? "Pase directo" : "Bo" + m.bo));
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

    if (!st.bye && st.a !== null && st.b !== null) {
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
        var val = sel.value;
        B.setScore(state.t, m.id, val ? val.split("-").map(Number) : null);
        save();
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

  // Resaltar a un jugador en todo el bracket al pasar el cursor
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
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var t = JSON.parse(reader.result);
        if (!t || !Array.isArray(t.players) || !Array.isArray(t.matches) || !t.scores) throw new Error();
        B.compute(t); // valida que la estructura funcione
        state.t = t;
        els.players.value = t.players.join("\n");
        save();
        showTournament();
      } catch (e) {
        els.errors.textContent = "El archivo no es un torneo válido.";
      }
    };
    reader.readAsText(file);
  }

  /* ---------- Eventos ---------- */
  els.players.addEventListener("input", function () { updateCount(); save(); });
  $("btnSeed").addEventListener("click", function () { generate("seed"); });
  $("btnRandom").addEventListener("click", function () { generate("random"); });
  $("btnSample").addEventListener("click", function () {
    els.players.value = SAMPLE.join("\n");
    els.bo.value = "3";
    els.boFinal.value = "5";
    els.reset.checked = true;
    updateCount();
  });
  $("btnEdit").addEventListener("click", showSetup);
  $("btnBack").addEventListener("click", showTournament);
  $("btnClear").addEventListener("click", function () {
    if (!confirm("¿Borrar todos los resultados? Los cruces se mantienen.")) return;
    state.t.scores = {};
    save();
    render();
  });
  $("btnExport").addEventListener("click", exportJson);
  els.importFile.addEventListener("change", function () {
    if (els.importFile.files[0]) importJson(els.importFile.files[0]);
    els.importFile.value = "";
  });
  els.hideByes.addEventListener("change", function () {
    state.hideByes = els.hideByes.checked;
    save();
    render();
  });
  els.tournament.addEventListener("mouseover", function (e) {
    var slot = e.target.closest(".slot[data-p]");
    highlight(slot ? slot.dataset.p : null);
  });
  els.tournament.addEventListener("mouseleave", function () { highlight(null); });

  /* ---------- Inicio ---------- */
  load();
  if (state.t) showTournament(); else showSetup();
})();
