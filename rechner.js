/*
 * Leasingtacho – Kilometer-Rechner.
 *
 * Rechnet nach denselben Regeln wie die App (Leasingtacho/Rechenkern):
 * - Laufzeit: Vertragsbeginn plus Monate, minus ein Tag; Soll linear über die
 *   Kalendertage der Laufzeit verteilt, kaufmännisch auf ganze Kilometer gerundet.
 * - Hochrechnung: Schnitt seit Vertragsbeginn (frühestens nach 14 Tagen) oder
 *   eine eigene Jahresannahme (Jahr = 365 Tage).
 * - Abrechnung: Freigrenze je Richtung, als Freibetrag oder als Grenze;
 *   Vergütung gedeckelt in Kilometern oder Euro.
 *
 * Geld wird in Zehntausendstel Euro als ganze Zahl gerechnet und erst am Ende
 * kaufmännisch auf Cent gerundet – keine Gleitkommafehler.
 *
 * Alles bleibt im Browser: nichts wird übertragen oder gespeichert.
 */
(function () {
  "use strict";

  var MINDEST_DATENBASIS_TAGE = 14;
  var TAG_MS = 86400000;

  var formular = document.getElementById("rechner");
  var ausgabe = document.getElementById("ergebnis");
  if (!formular || !ausgabe) return;

  var km = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  var kmSchnitt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
  var euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  var satzformat = new Intl.NumberFormat("de-DE", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4
  });
  var datumformat = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC" });

  // ---------- Eingaben lesen ----------

  function feld(name) {
    return formular.elements[name];
  }

  function text(name) {
    var element = feld(name);
    return element ? element.value.trim() : "";
  }

  /** Ganze Kilometer; Punkte und Leerzeichen werden ignoriert. */
  function kilometer(name) {
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

  /** Datum als Tageszahl seit 1970 (UTC), damit die Zeitumstellung nicht stört. */
  function tag(name) {
    var wert = text(name);
    var teile = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wert);
    if (!teile) return null;
    return Date.UTC(+teile[1], +teile[2] - 1, +teile[3]) / TAG_MS;
  }

  function alsDatum(tageszahl) {
    return datumformat.format(new Date(tageszahl * TAG_MS));
  }

  // ---------- Rechnen ----------

  /** Letzter Vertragstag: Beginn plus Monate, minus ein Tag. Monatsenden werden gekappt. */
  function vertragsende(beginn, monate) {
    var d = new Date(beginn * TAG_MS);
    var jahr = d.getUTCFullYear();
    var monat = d.getUTCMonth() + monate;
    var zieljahr = jahr + Math.floor(monat / 12);
    var zielmonat = ((monat % 12) + 12) % 12;
    var letzterTag = new Date(Date.UTC(zieljahr, zielmonat + 1, 0)).getUTCDate();
    var ziel = Date.UTC(zieljahr, zielmonat, Math.min(d.getUTCDate(), letzterTag)) / TAG_MS;
    return Math.max(beginn, ziel - 1);
  }

  /** Kaufmännisch runden; nur für nicht negative Werte gebraucht. */
  function runden(wert) {
    return Math.floor(wert + 0.5);
  }

  /** Zehntausendstel Euro kaufmännisch auf Cent. */
  function aufCent(zehntausendstel) {
    return Math.floor((zehntausendstel + 50) / 100);
  }

  function abzurechnen(abweichung, freigrenze, art) {
    if (abweichung <= freigrenze) return 0;
    return art === "grenzwert" ? abweichung : abweichung - freigrenze;
  }

  /** Schlussabrechnung für eine angenommene Gesamtlaufleistung. Beträge in Cent. */
  function abrechnung(v, gesamtlaufleistung) {
    var differenz = gesamtlaufleistung - v.vereinbart;
    if (differenz > 0) {
      var mehr = abzurechnen(differenz, v.freigrenzeMehr, v.art);
      return { art: "mehr", differenz: differenz, kilometer: mehr, cent: aufCent(mehr * v.satzMehr), satz: v.satzMehr, gedeckelt: false };
    }
    if (differenz < 0) {
      var minder = abzurechnen(-differenz, v.freigrenzeMinder, v.art);
      var gedeckelt = false;
      if (v.deckelArt === "kilometer" && minder > v.deckelKilometer) {
        minder = v.deckelKilometer;
        gedeckelt = true;
      }
      var cent = aufCent(minder * v.satzMinder);
      if (v.deckelArt === "betrag" && cent > v.deckelCent) {
        cent = v.deckelCent;
        gedeckelt = true;
      }
      return { art: "minder", differenz: differenz, kilometer: minder, cent: cent, satz: v.satzMinder, gedeckelt: gedeckelt };
    }
    return { art: "punkt", differenz: 0, kilometer: 0, cent: 0, satz: 0, gedeckelt: false };
  }

  // ---------- Ausgabe ----------

  function kmMitVorzeichen(wert) {
    return (wert > 0 ? "+" : wert < 0 ? "−" : "") + km.format(Math.abs(wert)) + " km";
  }

  function kmText(wert) {
    return km.format(wert) + " km";
  }

  function euroText(cent) {
    return euro.format(cent / 100);
  }

  function element(tagname, klasse, inhalt) {
    var e = document.createElement(tagname);
    if (klasse) e.className = klasse;
    if (inhalt !== undefined) e.textContent = inhalt;
    return e;
  }

  function kennzahl(liste, titel, wert) {
    var gruppe = element("div");
    gruppe.appendChild(element("dt", "", titel));
    gruppe.appendChild(element("dd", "", wert));
    liste.appendChild(gruppe);
  }

  /** Ein Block mit Betrag und Rechenweg für eine Abrechnung. */
  function abrechnungsblock(titel, a, v) {
    var block = element("div", "ergebnisblock");
    block.appendChild(element("h3", "", titel));

    if (a.art === "punkt") {
      block.appendChild(element("p", "betrag", "± 0,00 €"));
      block.appendChild(element("p", "rechenweg", "Genau die vereinbarte Laufleistung."));
      return block;
    }

    var mehr = a.art === "mehr";
    var zeile = mehr ? "Nachzahlung für Mehrkilometer" : "Vergütung für Minderkilometer";
    var betrag = element("p", "betrag " + (a.cent === 0 ? "" : mehr ? "nachzahlung" : "verguetung"), euroText(a.cent));
    block.appendChild(betrag);

    var weg = kmText(Math.abs(a.differenz)) + (mehr ? " über" : " unter") + " der Vereinbarung";
    if (a.kilometer === 0 && a.gedeckelt) {
      weg += " – vergütet wird laut deinen Angaben nichts.";
    } else if (a.kilometer === 0) {
      weg += " – das liegt innerhalb der Freigrenze, es wird nichts abgerechnet.";
    } else {
      weg += "; abgerechnet werden " + kmText(a.kilometer) + " × " + satzformat.format(a.satz / 10000) + ".";
      if (a.gedeckelt) weg += " Die Obergrenze der Vergütung greift.";
    }
    block.appendChild(element("p", "rechenweg", zeile + ": " + weg));
    return block;
  }

  function fehler(meldung) {
    ausgabe.replaceChildren();
    ausgabe.appendChild(element("h2", "", "Ergebnis"));
    ausgabe.appendChild(element("p", "fehlermeldung", meldung));
  }

  function leer() {
    ausgabe.replaceChildren();
    ausgabe.appendChild(element("h2", "", "Ergebnis"));
    ausgabe.appendChild(element("p", "rechenweg", "Trag Vertragsbeginn, Laufzeit, vereinbarte Laufleistung und deinen heutigen Kilometerstand ein – das Ergebnis erscheint sofort."));
  }

  // ---------- Ablauf ----------

  function rechnen() {
    var beginn = tag("beginn");
    var stichtag = tag("stichtag");
    var monate = kilometer("laufzeit");
    var vereinbart = kilometer("vereinbart");
    var stand = kilometer("stand");
    var uebernahme = kilometer("uebernahme") || 0;

    if (beginn === null || monate === null || vereinbart === null || stand === null || stichtag === null) {
      leer();
      return;
    }
    if (monate < 1 || monate > 120) return fehler("Die Laufzeit muss zwischen 1 und 120 Monaten liegen.");
    if (vereinbart < 1) return fehler("Die vereinbarte Laufleistung fehlt.");
    if (stand < uebernahme) return fehler("Der Kilometerstand liegt unter dem Stand bei Übernahme (" + kmText(uebernahme) + ").");
    if (stichtag < beginn) return fehler("Der Stand ist vom " + alsDatum(stichtag) + ", der Vertrag beginnt erst am " + alsDatum(beginn) + ".");

    var satzMehr = betrag("satzMehr");
    var satzMinder = betrag("satzMinder");
    var deckelCent = betrag("deckelBetrag");
    if ([satzMehr, satzMinder, deckelCent].some(function (w) { return typeof w === "number" && isNaN(w); })) {
      return fehler("Beträge bitte als Zahl eintragen, etwa „0,12“.");
    }

    var freigrenzeMehr = kilometer("freigrenze") || 0;
    var freigrenzeMinderText = text("freigrenzeMinder");
    var v = {
      vereinbart: vereinbart,
      satzMehr: satzMehr || 0,
      satzMinder: satzMinder || 0,
      freigrenzeMehr: freigrenzeMehr,
      freigrenzeMinder: freigrenzeMinderText === "" ? freigrenzeMehr : (kilometer("freigrenzeMinder") || 0),
      art: text("freigrenzenart") || "freibetrag",
      deckelArt: text("deckelArt") || "ohne",
      deckelKilometer: kilometer("deckelKilometer") || 0,
      deckelCent: deckelCent ? aufCent(deckelCent) : 0
    };

    var ende = vertragsende(beginn, monate);
    var laufzeitTage = ende - beginn + 1;
    var abgelaufen = Math.min(Math.max(0, stichtag - beginn), laufzeitTage);
    var verbleibend = laufzeitTage - abgelaufen;
    var gefahren = stand - uebernahme;
    var soll = Math.min(vereinbart, runden(vereinbart * abgelaufen / laufzeitTage));
    var abweichung = gefahren - soll;
    var beendet = verbleibend <= 0;

    ausgabe.replaceChildren();
    ausgabe.appendChild(element("h2", "", beendet ? "Schlussabrechnung" : "Stand am " + alsDatum(stichtag)));

    var liste = element("dl", "kennzahlen");
    kennzahl(liste, "Gefahren", kmText(gefahren));
    kennzahl(liste, beendet ? "Vereinbart" : "Soll heute", kmText(soll));
    var bezug = beendet ? "der Vereinbarung" : "dem Soll";
    kennzahl(liste, abweichung > 0 ? "Über " + bezug : abweichung < 0 ? "Unter " + bezug : "Genau im Soll", kmMitVorzeichen(abweichung));
    kennzahl(liste, "Vertragsende", alsDatum(ende));
    if (!beendet) {
      var frei = Math.max(0, vereinbart - gefahren);
      kennzahl(liste, "Noch frei", kmText(frei));
      kennzahl(liste, "Davon je Tag", kmSchnitt.format(frei / verbleibend) + " km");
    }
    ausgabe.appendChild(liste);

    if (beendet) {
      ausgabe.appendChild(abrechnungsblock("Abrechnung zum letzten Stand", abrechnung(v, gefahren), v));
      return;
    }

    // Hochrechnung aufs Vertragsende
    var methode = text("methode") || "schnitt";
    var proTag = null;
    var grundlage = "";
    if (methode === "annahme") {
      var jahr = kilometer("jahresleistung");
      if (jahr === null) {
        grundlage = "Trag ein, wie viele Kilometer du im Jahr erwartest.";
      } else {
        proTag = jahr / 365;
        grundlage = "Angenommen: " + kmText(jahr) + " im Jahr, also " + kmSchnitt.format(proTag) + " km je Tag.";
      }
    } else if (abgelaufen < MINDEST_DATENBASIS_TAGE) {
      grundlage = "Für eine Hochrechnung braucht es mindestens " + MINDEST_DATENBASIS_TAGE + " Tage Fahrdaten. Bis dahin hilft eine eigene Jahresannahme.";
    } else {
      proTag = gefahren / abgelaufen;
      grundlage = "Gerechnet mit deinem Schnitt seit Vertragsbeginn: " + kmSchnitt.format(proTag) + " km je Tag.";
    }

    var hochrechnung = element("div", "ergebnisblock");
    if (proTag === null) {
      hochrechnung.appendChild(element("h3", "", "Voraussichtlich am Vertragsende"));
      hochrechnung.appendChild(element("p", "rechenweg", grundlage));
      ausgabe.appendChild(hochrechnung);
    } else {
      var gesamt = gefahren + runden(proTag * verbleibend);
      var a = abrechnung(v, gesamt);
      var block = abrechnungsblock("Voraussichtlich am Vertragsende", a, v);
      block.appendChild(element("p", "rechenweg", grundlage + " Laufleistung am Ende: " + kmText(gesamt) + "."));
      ausgabe.appendChild(block);
    }

    ausgabe.appendChild(abrechnungsblock("Wenn ab heute kein Kilometer mehr dazukommt", abrechnung(v, gefahren), v));
  }

  function methodeZeigen() {
    var annahme = text("methode") === "annahme";
    document.getElementById("feld-jahresleistung").hidden = !annahme;
  }

  function deckelZeigen() {
    var art = text("deckelArt");
    document.getElementById("feld-deckel-km").hidden = art !== "kilometer";
    document.getElementById("feld-deckel-betrag").hidden = art !== "betrag";
  }

  function heute() {
    var jetzt = new Date();
    var monat = String(jetzt.getMonth() + 1).padStart(2, "0");
    var tagImMonat = String(jetzt.getDate()).padStart(2, "0");
    return jetzt.getFullYear() + "-" + monat + "-" + tagImMonat;
  }

  /** Ein Beispiel zum Ausprobieren: drei Jahre, 45.000 km, gut ein Jahr gefahren. */
  function beispiel() {
    var jetzt = new Date();
    var beginn = new Date(jetzt.getFullYear() - 1, jetzt.getMonth() - 2, 1);
    feld("beginn").value = beginn.getFullYear() + "-" + String(beginn.getMonth() + 1).padStart(2, "0") + "-01";
    feld("laufzeit").value = "36";
    feld("vereinbart").value = "45.000";
    feld("uebernahme").value = "10";
    feld("stichtag").value = heute();
    feld("stand").value = "22.000";
    feld("satzMehr").value = "0,12";
    feld("satzMinder").value = "0,07";
    feld("freigrenze").value = "2.500";
    rechnen();
    ausgabe.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  feld("stichtag").value = heute();
  formular.addEventListener("input", rechnen);
  formular.addEventListener("change", function () {
    methodeZeigen();
    deckelZeigen();
    rechnen();
  });
  formular.addEventListener("submit", function (ereignis) {
    ereignis.preventDefault();
    rechnen();
  });
  document.getElementById("beispiel").addEventListener("click", beispiel);
  document.getElementById("rechner-js").hidden = false;
  methodeZeigen();
  deckelZeigen();
  rechnen();
})();
