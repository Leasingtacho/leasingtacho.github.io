/*
 * Leasingtacho – Angebotsvergleich für den nächsten Vertrag.
 *
 * Rechnet nach denselben Regeln wie „Anschlussvertrag planen“ in der App
 * (Gemeinsam/Rechenkern/Anschlussvertrag.swift):
 * - Vereinbarte und erwartete Laufleistung: Kilometer je Jahr mal Laufzeit in
 *   Monaten durch zwölf, kaufmännisch auf ganze Kilometer gerundet.
 * - Abrechnung: Freigrenze je Richtung, als Freibetrag oder als Grenze;
 *   Vergütung gedeckelt in Kilometern oder Euro.
 * - Gesamtkosten: Monatsrate mal Laufzeit plus Nachzahlung oder minus
 *   Vergütung. Verglichen wird nur, wenn bei beiden Angeboten eine Rate steht;
 *   bei gleicher Laufzeit die Gesamtkosten, sonst die Kosten je Monat.
 * - Empfohlen wird die 5.000er-Stufe, die die Fahrleistung abdeckt.
 *
 * Geld wird in Zehntausendstel Euro als ganze Zahl gerechnet und erst am Ende
 * kaufmännisch auf Cent gerundet – keine Gleitkommafehler.
 *
 * Alles bleibt im Browser: nichts wird übertragen oder gespeichert.
 */
(function () {
  "use strict";

  var STUFE = 5000;
  var SEITEN = ["A", "B"];

  var formular = document.getElementById("rechner");
  var ausgabe = document.getElementById("ergebnis");
  if (!formular || !ausgabe) return;

  var km = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  var euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

  // ---------- Eingaben lesen ----------

  function feld(name) {
    return formular.elements[name];
  }

  function text(name) {
    var element = feld(name);
    return element ? element.value.trim() : "";
  }

  /** Ganze Zahl; Punkte und Leerzeichen werden ignoriert. */
  function ganzzahl(name) {
    var ziffern = text(name).replace(/[^0-9]/g, "");
    return ziffern === "" ? null : parseInt(ziffern, 10);
  }

  /** Betrag in Zehntausendstel Euro, aus „0,12“, „0.12“ oder „1.234,5“. */
  function betrag(name) {
    var roh = text(name).replace(/[\s€]/g, "");
    if (roh === "") return null;
    if (roh.indexOf(",") >= 0) {
      roh = roh.replace(/\./g, "").replace(",", ".");
    }
    if (!/^\d*(\.\d*)?$/.test(roh) || roh === ".") return NaN;
    var teile = roh.split(".");
    var ganz = parseInt(teile[0] || "0", 10);
    var bruch = ((teile[1] || "") + "0000").slice(0, 4);
    return ganz * 10000 + parseInt(bruch, 10);
  }

  // ---------- Rechnen ----------

  /** Kaufmännisch runden; nur für nicht negative Werte gebraucht. */
  function runden(wert) {
    return Math.floor(wert + 0.5);
  }

  /** Zehntausendstel Euro kaufmännisch auf Cent. */
  function aufCent(zehntausendstel) {
    return Math.floor((zehntausendstel + 50) / 100);
  }

  /** Kilometer je Jahr, auf eine Laufzeit in Monaten umgerechnet. */
  function ueberLaufzeit(kilometerProJahr, monate) {
    return runden(kilometerProJahr * monate / 12);
  }

  /** Die übliche Stufe, die eine Fahrleistung abdeckt; mindestens 10.000 km. */
  function passendeStufe(fahrleistung) {
    return Math.max(2, Math.ceil(fahrleistung / STUFE)) * STUFE;
  }

  function abzurechnen(abweichung, freigrenze, art) {
    if (abweichung <= freigrenze) return 0;
    return art === "grenzwert" ? abweichung : abweichung - freigrenze;
  }

  /** Schlussabrechnung; `cent` ist positiv bei Nachzahlung, negativ bei Vergütung. */
  function abrechnung(regeln, vereinbart, gefahren) {
    var differenz = gefahren - vereinbart;
    if (differenz > 0) {
      var mehr = abzurechnen(differenz, regeln.freigrenzeMehr, regeln.art);
      return { differenz: differenz, cent: aufCent(mehr * regeln.satzMehr) };
    }
    if (differenz < 0) {
      var minder = abzurechnen(-differenz, regeln.freigrenzeMinder, regeln.art);
      if (regeln.deckelArt === "kilometer" && minder > regeln.deckelKilometer) {
        minder = regeln.deckelKilometer;
      }
      var cent = aufCent(minder * regeln.satzMinder);
      if (regeln.deckelArt === "betrag" && cent > regeln.deckelCent) {
        cent = regeln.deckelCent;
      }
      return { differenz: differenz, cent: -cent };
    }
    return { differenz: 0, cent: 0 };
  }

  /** Was ein Angebot bei der eingetragenen Fahrleistung kostet. */
  function angebot(seite, fahrleistung, regeln) {
    var monate = ganzzahl("laufzeit" + seite);
    var proJahr = ganzzahl("laufleistung" + seite);
    if (monate === null || proJahr === null || monate < 1 || proJahr < 1) return null;

    var rate = betrag("rate" + seite);
    var vereinbart = ueberLaufzeit(proJahr, monate);
    var erwartet = ueberLaufzeit(fahrleistung, monate);
    var schluss = abrechnung(regeln, vereinbart, erwartet);
    var raten = rate ? aufCent(rate * monate) : null;
    var gesamt = (raten || 0) + schluss.cent;

    return {
      monate: monate,
      vereinbart: vereinbart,
      erwartet: erwartet,
      differenz: schluss.differenz,
      abrechnung: schluss.cent,
      raten: raten,
      gesamt: gesamt,
      jeMonat: Math.round(gesamt / monate)
    };
  }

  // ---------- Ausgabe ----------

  function kmText(wert) {
    return km.format(wert) + " km";
  }

  function kmMitVorzeichen(wert) {
    return (wert > 0 ? "+" : wert < 0 ? "−" : "") + km.format(Math.abs(wert)) + " km";
  }

  function euroText(cent) {
    return euro.format(cent / 100);
  }

  function euroMitVorzeichen(cent) {
    return (cent > 0 ? "+" : cent < 0 ? "−" : "") + euro.format(Math.abs(cent) / 100);
  }

  function element(tagname, klasse, inhalt) {
    var e = document.createElement(tagname);
    if (klasse) e.className = klasse;
    if (inhalt !== undefined) e.textContent = inhalt;
    return e;
  }

  function kopf() {
    ausgabe.replaceChildren();
    ausgabe.appendChild(element("h2", "", "Ergebnis"));
  }

  function hinweis(meldung, klasse) {
    kopf();
    ausgabe.appendChild(element("p", klasse, meldung));
  }

  /** Eine Tabellenzeile mit je einem Wert für beide Angebote. */
  function zeile(koerper, titel, links, rechts, klassen, summe) {
    var tr = element("tr", summe ? "summe" : "");
    var th = element("th", "", titel);
    th.scope = "row";
    tr.appendChild(th);
    tr.appendChild(element("td", "zahl " + (klassen ? klassen[0] : ""), links));
    tr.appendChild(element("td", "zahl " + (klassen ? klassen[1] : ""), rechts));
    koerper.appendChild(tr);
  }

  function farbe(wert) {
    return wert > 0 ? "nachzahlung" : wert < 0 ? "verguetung" : "";
  }

  function tabelle(a, b, guenstiger) {
    var rahmen = element("div", "tabelle-rahmen");
    var t = element("table", "tabelle vergleich");
    var thead = element("thead");
    var kopfzeile = element("tr");
    kopfzeile.appendChild(element("td", "", ""));
    SEITEN.forEach(function (seite) {
      var th = element("th", "zahl" + (guenstiger === seite ? " sieger" : ""), (guenstiger === seite ? "✓ " : "") + "Angebot " + seite);
      th.scope = "col";
      kopfzeile.appendChild(th);
    });
    thead.appendChild(kopfzeile);
    t.appendChild(thead);

    var koerper = element("tbody");
    zeile(koerper, "Vereinbart", kmText(a.vereinbart), kmText(b.vereinbart));
    zeile(koerper, "Erwartet", kmText(a.erwartet), kmText(b.erwartet));
    zeile(koerper, "Abweichung", kmMitVorzeichen(a.differenz), kmMitVorzeichen(b.differenz), [farbe(a.differenz), farbe(b.differenz)]);
    if (a.raten !== null || b.raten !== null) {
      zeile(koerper, "Raten", a.raten === null ? "–" : euroText(a.raten), b.raten === null ? "–" : euroText(b.raten));
    }
    zeile(koerper, "Abrechnung", euroMitVorzeichen(a.abrechnung), euroMitVorzeichen(b.abrechnung), [farbe(a.abrechnung), farbe(b.abrechnung)]);
    if (a.raten !== null && b.raten !== null) {
      zeile(koerper, "Gesamt", euroText(a.gesamt), euroText(b.gesamt), null, true);
      if (a.monate !== b.monate) {
        zeile(koerper, "Je Monat", euroText(a.jeMonat), euroText(b.jeMonat), null, true);
      }
    }
    t.appendChild(koerper);
    rahmen.appendChild(t);
    return rahmen;
  }

  // ---------- Ablauf ----------

  function rechnen() {
    var fahrleistung = ganzzahl("fahrleistung");
    if (fahrleistung === null) {
      return hinweis("Trag deine Fahrleistung im Jahr und zu beiden Angeboten Laufzeit und Laufleistung ein – das Ergebnis erscheint sofort.", "rechenweg");
    }

    var satzMehr = betrag("satzMehr");
    var satzMinder = betrag("satzMinder");
    var deckelBetrag = betrag("deckelBetrag");
    var raten = SEITEN.map(function (seite) { return betrag("rate" + seite); });
    if ([satzMehr, satzMinder, deckelBetrag].concat(raten).some(function (w) { return typeof w === "number" && isNaN(w); })) {
      return hinweis("Beträge bitte als Zahl eintragen, etwa „289“ oder „0,12“.", "fehlermeldung");
    }

    var freigrenzeMehr = ganzzahl("freigrenze") || 0;
    var regeln = {
      satzMehr: satzMehr || 0,
      satzMinder: satzMinder || 0,
      freigrenzeMehr: freigrenzeMehr,
      freigrenzeMinder: text("freigrenzeMinder") === "" ? freigrenzeMehr : (ganzzahl("freigrenzeMinder") || 0),
      art: text("freigrenzenart") || "freibetrag",
      deckelArt: text("deckelArt") || "ohne",
      deckelKilometer: ganzzahl("deckelKilometer") || 0,
      deckelCent: deckelBetrag ? aufCent(deckelBetrag) : 0
    };

    kopf();
    ausgabe.appendChild(element("p", "rechenweg", "Zu " + kmText(fahrleistung) + " im Jahr passen " + kmText(passendeStufe(fahrleistung)) + " im Jahr."));

    var a = angebot("A", fahrleistung, regeln);
    var b = angebot("B", fahrleistung, regeln);
    if (!a || !b) {
      ausgabe.appendChild(element("p", "rechenweg", "Für den Vergleich fehlen bei einem Angebot noch Laufzeit oder Laufleistung."));
      return;
    }
    if (a.monate > 120 || b.monate > 120) {
      return hinweis("Die Laufzeit muss zwischen 1 und 120 Monaten liegen.", "fehlermeldung");
    }

    var guenstiger = null;
    var fazit;
    if (a.raten === null || b.raten === null) {
      fazit = "Trag bei beiden Angeboten die Monatsrate ein, dann vergleicht der Rechner die Gesamtkosten. Die Kilometerabrechnung allein kürt keinen Sieger: Mehr vereinbarte Kilometer schneiden dort immer besser ab, kosten aber über die Rate mehr.";
    } else {
      var jeMonat = a.monate !== b.monate;
      var links = jeMonat ? a.jeMonat : a.gesamt;
      var rechts = jeMonat ? b.jeMonat : b.gesamt;
      if (links === rechts) {
        fazit = "Beide Angebote kosten gleich viel.";
      } else {
        guenstiger = links < rechts ? "A" : "B";
        fazit = "Angebot " + guenstiger + " ist " + (jeMonat ? "je Monat " : "insgesamt ") + euroText(Math.abs(links - rechts)) + " günstiger.";
        if (jeMonat) fazit += " Verglichen wird je Monat, weil die Laufzeiten verschieden sind.";
      }
    }

    ausgabe.appendChild(tabelle(a, b, guenstiger));
    ausgabe.appendChild(element("p", guenstiger ? "fazit verguetung" : "rechenweg", fazit));
    if ((a.differenz > regeln.freigrenzeMehr || b.differenz > regeln.freigrenzeMehr) && regeln.satzMehr === 0) {
      ausgabe.appendChild(element("p", "fehlermeldung", "Ohne Preis je Mehrkilometer fehlt die Nachzahlung."));
    }
  }

  function deckelZeigen() {
    var art = text("deckelArt");
    document.getElementById("feld-deckel-km").hidden = art !== "kilometer";
    document.getElementById("feld-deckel-betrag").hidden = art !== "betrag";
  }

  /** Ein Beispiel zum Ausprobieren: 13.400 km im Jahr, 10.000 oder 15.000 km vereinbaren? */
  function beispiel() {
    feld("fahrleistung").value = "13.400";
    feld("laufzeitA").value = "36";
    feld("laufleistungA").value = "10.000";
    feld("rateA").value = "289";
    feld("laufzeitB").value = "36";
    feld("laufleistungB").value = "15.000";
    feld("rateB").value = "309";
    feld("satzMehr").value = "0,12";
    feld("satzMinder").value = "0,07";
    feld("freigrenze").value = "2.500";
    rechnen();
    ausgabe.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  formular.addEventListener("input", rechnen);
  formular.addEventListener("change", function () {
    deckelZeigen();
    rechnen();
  });
  formular.addEventListener("submit", function (ereignis) {
    ereignis.preventDefault();
    rechnen();
  });
  document.getElementById("beispiel").addEventListener("click", beispiel);
  document.getElementById("rechner-js").hidden = false;
  deckelZeigen();
  rechnen();
})();
