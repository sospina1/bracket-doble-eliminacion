/*
 * Motor de bracket de doble eliminación.
 * - Acepta de 4 a 64 jugadores; si no es potencia de 2, rellena con BYEs
 *   (los mejores seeds pasan directo).
 * - Reparto por seeding (orden escrito) o al azar.
 * - Gran Final con reinicio de bracket opcional (como en la CRL).
 * Funciona en el navegador (window.Bracket) y en Node (module.exports).
 */
(function (root) {
  "use strict";

  var BYE = -1;
  var MIN_PLAYERS = 4;
  var MAX_PLAYERS = 64;

  function nextPow2(n) {
    var s = 1;
    while (s < n) s *= 2;
    return s;
  }

  // Orden estándar de seeds: 1 vs S, y los dos mejores solo se cruzan en la final.
  function seedOrder(size) {
    var order = [1, 2];
    while (order.length < size) {
      var len = order.length * 2;
      var next = [];
      for (var i = 0; i < order.length; i++) {
        next.push(order[i], len + 1 - order[i]);
      }
      order = next;
    }
    return order;
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function cleanNames(raw) {
    return raw
      .map(function (n) { return String(n).trim(); })
      .filter(function (n) { return n.length > 0; });
  }

  function validate(names) {
    var errors = [];
    if (names.length < MIN_PLAYERS) errors.push("Necesitas al menos " + MIN_PLAYERS + " jugadores.");
    if (names.length > MAX_PLAYERS) errors.push("El máximo es " + MAX_PLAYERS + " jugadores.");
    var seen = {};
    names.forEach(function (n) {
      var key = n.toLowerCase();
      if (seen[key]) errors.push("Nombre repetido: " + n);
      seen[key] = true;
    });
    return errors;
  }

  /*
   * Crea la estructura del torneo.
   * options: { mode: "seed" | "random", bo: 3, boFinal: 5, reset: true }
   */
  function createTournament(rawNames, options) {
    options = options || {};
    var names = cleanNames(rawNames);
    var errors = validate(names);
    if (errors.length) throw new Error(errors.join("\n"));

    var players = options.mode === "random" ? shuffle(names) : names.slice();
    var size = Math.max(MIN_PLAYERS, nextPow2(players.length));
    var k = Math.log2(size); // rondas del upper bracket
    var lbRounds = 2 * (k - 1);
    var bo = options.bo || 3;
    var boFinal = options.boFinal || 5;

    var matches = [];
    var order = seedOrder(size);

    function seedSlot(seed) {
      return { type: "seed", value: seed <= players.length ? seed - 1 : BYE };
    }

    // Upper bracket
    for (var r = 1; r <= k; r++) {
      var count = size / Math.pow(2, r);
      for (var i = 0; i < count; i++) {
        var m = { id: "W" + r + "-" + i, bracket: "W", round: r, index: i };
        if (r === 1) {
          m.a = seedSlot(order[2 * i]);
          m.b = seedSlot(order[2 * i + 1]);
        } else {
          m.a = { type: "winner", match: "W" + (r - 1) + "-" + 2 * i };
          m.b = { type: "winner", match: "W" + (r - 1) + "-" + (2 * i + 1) };
        }
        m.bo = r === k ? boFinal : bo;
        matches.push(m);
      }
    }

    // Lower bracket
    for (var lr = 1; lr <= lbRounds; lr++) {
      var lcount, j;
      if (lr === 1) {
        lcount = size / 4;
      } else if (lr % 2 === 0) {
        j = lr / 2;
        lcount = size / Math.pow(2, j + 1);
      } else {
        j = (lr - 1) / 2;
        lcount = size / Math.pow(2, j + 2);
      }
      for (var li = 0; li < lcount; li++) {
        var lm = { id: "L" + lr + "-" + li, bracket: "L", round: lr, index: li };
        if (lr === 1) {
          lm.a = { type: "loser", match: "W1-" + 2 * li };
          lm.b = { type: "loser", match: "W1-" + (2 * li + 1) };
        } else if (lr % 2 === 0) {
          // Entran los perdedores de la ronda j+1 del upper.
          // Se invierte el orden en rondas alternas para evitar revanchas inmediatas.
          var dropIdx = j % 2 === 1 ? lcount - 1 - li : li;
          lm.a = { type: "winner", match: "L" + (lr - 1) + "-" + li };
          lm.b = { type: "loser", match: "W" + (j + 1) + "-" + dropIdx };
        } else {
          lm.a = { type: "winner", match: "L" + (lr - 1) + "-" + 2 * li };
          lm.b = { type: "winner", match: "L" + (lr - 1) + "-" + (2 * li + 1) };
        }
        lm.bo = lr === lbRounds ? boFinal : bo;
        matches.push(lm);
      }
    }

    // Gran Final (y posible reinicio)
    matches.push({
      id: "GF1", bracket: "F", round: 1, index: 0, bo: boFinal,
      a: { type: "winner", match: "W" + k + "-0" },
      b: { type: "winner", match: "L" + lbRounds + "-0" }
    });
    if (options.reset !== false) {
      matches.push({
        id: "GF2", bracket: "F", round: 2, index: 0, bo: boFinal,
        a: { type: "gf", side: "a" },
        b: { type: "gf", side: "b" }
      });
    }

    return {
      version: 1,
      players: players,
      size: size,
      wbRounds: k,
      lbRounds: lbRounds,
      settings: { mode: options.mode || "seed", bo: bo, boFinal: boFinal, reset: options.reset !== false },
      matches: matches,
      scores: {}
    };
  }

  function winsNeeded(bo) {
    return Math.floor(bo / 2) + 1;
  }

  // Marcadores válidos para un "mejor de" (ej. Bo3: 2-0, 2-1, 1-2, 0-2)
  function scoreOptions(bo) {
    var need = winsNeeded(bo);
    var opts = [];
    for (var l = 0; l < need; l++) opts.push([need, l]);
    for (var l2 = need - 1; l2 >= 0; l2--) opts.push([l2, need]);
    return opts;
  }

  /*
   * Calcula el estado de cada partida a partir de los marcadores guardados.
   * Devuelve { byId, champion, standings, finished }.
   */
  function compute(t) {
    var defs = {};
    t.matches.forEach(function (m) { defs[m.id] = m; });
    var memo = {};

    function slotValue(slot) {
      if (slot.type === "seed") return slot.value;
      if (slot.type === "gf") {
        var gf = resolve("GF1");
        if (!gf.done || gf.winner !== gf.b) return null; // no hay reinicio
        return slot.side === "a" ? gf.a : gf.b;
      }
      var src = resolve(slot.match);
      if (!src.done) return null;
      return slot.type === "winner" ? src.winner : src.loser;
    }

    function resolve(id) {
      if (memo[id]) return memo[id];
      var m = defs[id];
      var st = { id: id, def: m, a: null, b: null, done: false, bye: false, winner: null, loser: null, score: null };
      memo[id] = st;
      st.a = slotValue(m.a);
      st.b = slotValue(m.b);
      if (st.a === null || st.b === null) return st;
      if (st.a === BYE || st.b === BYE) {
        st.bye = true;
        st.done = true;
        st.winner = st.a === BYE ? st.b : st.a;
        st.loser = BYE;
        return st;
      }
      var s = t.scores[id];
      if (s && s.pa === st.a && s.pb === st.b) {
        var need = winsNeeded(m.bo);
        if ((s.sa === need && s.sb < need) || (s.sb === need && s.sa < need)) {
          st.score = [s.sa, s.sb];
          st.done = true;
          st.winner = s.sa > s.sb ? st.a : st.b;
          st.loser = s.sa > s.sb ? st.b : st.a;
        }
      }
      return st;
    }

    var byId = {};
    t.matches.forEach(function (m) { byId[m.id] = resolve(m.id); });

    // ¿Se juega el reinicio?
    var gf1 = byId.GF1;
    var gf2 = byId.GF2;
    var resetNeeded = !!(gf2 && gf1.done && gf1.winner === gf1.b);
    if (gf2) gf2.hidden = !resetNeeded;

    var champion = null;
    var runnerUp = null;
    if (gf1.done) {
      if (gf1.winner === gf1.a || !gf2) {
        champion = gf1.winner;
        runnerUp = gf1.loser;
      } else if (gf2.done) {
        champion = gf2.winner;
        runnerUp = gf2.loser;
      }
    }

    // Clasificación: campeón, subcampeón y luego eliminados del lower por ronda.
    var standings = [];
    var placed = 0;
    if (champion !== null) {
      standings.push({ place: 1, players: [champion] });
      standings.push({ place: 2, players: [runnerUp] });
      placed = 2;
    }
    for (var r = t.lbRounds; r >= 1; r--) {
      var out = [];
      t.matches.forEach(function (m) {
        if (m.bracket === "L" && m.round === r) {
          var st = byId[m.id];
          if (st.done && st.loser !== BYE && st.loser !== null) out.push(st.loser);
        }
      });
      if (out.length) {
        var startPlace = placed + 1;
        // Si el torneo no ha terminado, el puesto se calcula contando desde abajo.
        if (champion === null) startPlace = null;
        standings.push({ place: startPlace, round: r, players: out });
        placed += out.length;
      }
    }

    return { byId: byId, champion: champion, standings: standings, finished: champion !== null };
  }

  // Guarda un marcador ([sa, sb]) o lo borra (null). Limpia resultados que quedaron inválidos.
  function setScore(t, id, score) {
    var state = compute(t);
    var st = state.byId[id];
    if (!score) {
      delete t.scores[id];
    } else {
      t.scores[id] = { sa: score[0], sb: score[1], pa: st.a, pb: st.b };
    }
    pruneScores(t);
  }

  function pruneScores(t) {
    var changed = true;
    while (changed) {
      changed = false;
      var state = compute(t);
      Object.keys(t.scores).forEach(function (id) {
        var st = state.byId[id];
        var s = t.scores[id];
        if (!st || st.a !== s.pa || st.b !== s.pb || st.bye || (st.hidden === true)) {
          delete t.scores[id];
          changed = true;
        }
      });
    }
  }

  function roundName(t, bracket, round) {
    if (bracket === "W") {
      var left = t.wbRounds - round; // 0 = final
      if (left === 0) return "Final Upper";
      if (left === 1) return "Semifinal Upper";
      if (left === 2) return "Cuartos Upper";
      return "Upper Ronda " + round;
    }
    if (bracket === "L") {
      if (round === t.lbRounds) return "Final Lower";
      return "Lower Ronda " + round;
    }
    return round === 1 ? "Gran Final" : "Reinicio de bracket";
  }

  var api = {
    BYE: BYE,
    MIN_PLAYERS: MIN_PLAYERS,
    MAX_PLAYERS: MAX_PLAYERS,
    seedOrder: seedOrder,
    cleanNames: cleanNames,
    validate: validate,
    createTournament: createTournament,
    compute: compute,
    setScore: setScore,
    scoreOptions: scoreOptions,
    winsNeeded: winsNeeded,
    roundName: roundName
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Bracket = api;
})(typeof window !== "undefined" ? window : this);
