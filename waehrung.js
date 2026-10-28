/*
 * Leasingtacho – Euro oder Schweizer Franken für die Rechner.
 *
 * Wie in der App wird nichts umgerechnet; es ändern sich nur das Zeichen und
 * die Schreibweise. Mit Franken schreiben die Rechner schweizerisch
 * („CHF 1'234.50“, „45'000 km“, Punkt vor den Rappen).
 *
 * Voreingestellt: „?waehrung=chf“ oder „?waehrung=eur“ in der Adresse, sonst
 * Franken, wenn der Browser auf die Schweiz oder Liechtenstein eingestellt ist,
 * sonst Euro. Gespeichert wird nichts; gewechselt wird mit der Auswahl
 * „Währung“, und die Links zum anderen Rechner nehmen die Wahl mit.
 *
 * Auf der Seite:
 * - <select id="waehrung"> mit den Werten EUR und CHF
 * - <span class="waehrung">€</span> für jedes Währungszeichen
 * - data-chf="…" an Texten und data-chf-href="…" an Links mit eigener
 *   Schweizer Fassung
 * - Platzhalter der Eingabefelder werden selbst umgeschrieben („0,12“ → „0.12“),
 *   eingetragene Beträge (inputmode="decimal") beim Wechsel ebenso
 */
var Waehrung = (function () {
  "use strict";

  var ARTEN = {
    EUR: { zeichen: "€", sprache: "de-DE" },
    CHF: { zeichen: "CHF", sprache: "de-CH" }
  };
  var RECHNER = /^(rechner|angebotsvergleich)\.html/;

  var code = voreinstellung();
  var beobachter = [];

  function voreinstellung() {
    var adresse = /[?&]waehrung=(eur|chf)(&|$)/i.exec(window.location.search);
    if (adresse) return adresse[1].toUpperCase();
    var sprachen = navigator.languages || [navigator.language || ""];
    return sprachen.some(function (s) { return /-(CH|LI)$/i.test(s); }) ? "CHF" : "EUR";
  }

  function format(optionen) {
    return new Intl.NumberFormat(ARTEN[code].sprache, optionen);
  }

  /** Cent oder Rappen als Betrag: „1.234,50 €“ oder „CHF 1'234.50“. */
  function betrag(cent) {
    return format({ style: "currency", currency: code }).format(cent / 100);
  }

  /** Satz je Kilometer aus Zehntausendsteln, mit zwei bis vier Nachkommastellen. */
  function satz(zehntausendstel) {
    return format({ style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 4 })
      .format(zehntausendstel / 10000);
  }

  /** Eine Zahl wie „45.000“ bzw. „45'000“. */
  function zahl(wert, nachkommastellen) {
    return format({ maximumFractionDigits: nachkommastellen || 0 }).format(wert);
  }

  /**
   * Betrag in Zehntausendsteln aus einer Eingabe; null, wenn leer, NaN, wenn
   * keine Zahl. Ein Komma ist immer das Dezimalzeichen („0,12“, „1.234,5“).
   * Ohne Komma gilt mit Franken der Punkt als Dezimalzeichen („0.12“, „1'500“);
   * mit Euro gilt ein Punkt vor genau drei Ziffern als Tausenderpunkt („1.500“
   * sind 1.500 €), außer nach einer Null („0.125“).
   */
  function lesen(text) {
    var roh = text.replace(/[\s€'’]|CHF|Fr\./gi, "");
    if (roh === "") return null;
    if (roh.indexOf(",") >= 0) {
      roh = roh.replace(/\./g, "").replace(",", ".");
    } else if (code === "EUR" && /^[1-9]\d{0,2}(\.\d{3})+$/.test(roh)) {
      roh = roh.replace(/\./g, "");
    }
    if (!/^\d*(\.\d*)?$/.test(roh) || roh === ".") return NaN;
    var teile = roh.split(".");
    var ganz = parseInt(teile[0] || "0", 10);
    var bruch = ((teile[1] || "") + "0000").slice(0, 4);
    return ganz * 10000 + parseInt(bruch, 10);
  }

  /** Eine Eingabe in deutscher Schreibweise („45.000“, „0,12“) für die gewählte Währung. */
  function eingabe(deutsch) {
    if (code === "EUR") return deutsch;
    return deutsch.replace(/(\d)\.(?=\d{3})/g, "$1'").replace(/(\d),(\d)/g, "$1.$2");
  }

  function seiteAnpassen() {
    var chf = code === "CHF";
    document.querySelectorAll(".waehrung").forEach(function (e) {
      e.textContent = ARTEN[code].zeichen;
    });
    document.querySelectorAll("[data-chf]").forEach(function (e) {
      if (e.dataset.eur === undefined) e.dataset.eur = e.textContent;
      e.textContent = chf ? e.dataset.chf : e.dataset.eur;
    });
    document.querySelectorAll("[data-chf-href]").forEach(function (e) {
      if (e.dataset.eurHref === undefined) e.dataset.eurHref = e.getAttribute("href");
      e.setAttribute("href", chf ? e.dataset.chfHref : e.dataset.eurHref);
    });
    document.querySelectorAll("input[placeholder]").forEach(function (e) {
      if (e.dataset.platzhalter === undefined) e.dataset.platzhalter = e.placeholder;
      e.placeholder = eingabe(e.dataset.platzhalter);
    });
    document.querySelectorAll("a[href]").forEach(function (e) {
      var ziel = e.getAttribute("href").replace(/\?waehrung=\w+/, "");
      if (RECHNER.test(ziel)) e.setAttribute("href", chf ? ziel + "?waehrung=chf" : ziel);
    });
  }

  /** Ein Betrag aus Zehntausendsteln als schlichte Eingabe: „1500“, „0,12“ bzw. „0.12“. */
  function alsEingabe(zehntausendstel) {
    var ganz = Math.floor(zehntausendstel / 10000);
    var bruch = String(zehntausendstel % 10000 + 10000).slice(1).replace(/0+$/, "");
    return bruch ? ganz + (code === "CHF" ? "." : ",") + bruch : String(ganz);
  }

  function wechseln(neu) {
    if (!ARTEN[neu] || neu === code) return;
    // Eingetragene Beträge mit der alten Schreibweise lesen, damit aus „1.500 €“
    // nicht „1.50 Franken“ wird, und in der neuen wieder hinschreiben.
    var felder = document.querySelectorAll('input[inputmode="decimal"]');
    var werte = Array.prototype.map.call(felder, function (e) { return lesen(e.value); });
    code = neu;
    felder.forEach(function (e, i) {
      if (typeof werte[i] === "number" && !isNaN(werte[i])) e.value = alsEingabe(werte[i]);
    });
    seiteAnpassen();
    beobachter.forEach(function (aufruf) { aufruf(); });
  }

  var auswahl = document.getElementById("waehrung");
  if (auswahl) {
    auswahl.value = code;
    auswahl.addEventListener("change", function () { wechseln(auswahl.value); });
  }
  seiteAnpassen();

  return {
    get code() { return code; },
    betrag: betrag,
    satz: satz,
    zahl: zahl,
    lesen: lesen,
    eingabe: eingabe,
    /** Ruft `aufruf` nach jedem Wechsel der Währung auf. */
    beiWechsel: function (aufruf) { beobachter.push(aufruf); }
  };
})();
