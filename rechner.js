/*
 * Leasingtacho – Kilometer-Rechner.
 *
 * Rechnet nach denselben Regeln wie die App (Leasingtacho/Rechenkern):
 * - Laufzeit: Vertragsbeginn plus Monate, minus ein Tag; Soll linear über die
 *   Kalendertage der Laufzeit verteilt, kaufmännisch auf ganze Kilometer gerundet.
 * - Hochrechnung: Schnitt seit Vertragsbeginn (frühestens nach 14 Tagen) oder
 *   eine eigene Jahresannahme (Jahr = 365 Tage).
 * - Abrechnung: Freigrenze je Richtung, als Freibetrag oder als Grenze;
 *   Vergütung gedeckelt in Kilometern oder als Betrag.
 *
 * Geld wird in Zehntausendstel Euro bzw. Franken als ganze Zahl gerechnet und
 * erst am Ende kaufmännisch auf Cent bzw. Rappen gerundet – keine
 * Gleitkommafehler. Zeichen und Schreibweise kommen aus waehrung.js.
 *
 * Die Texte, die das Skript selbst ausgibt, stehen unten in TEXTE, je Sprache
 * der Seite (<html lang>: de, fr, it, es; sonst Deutsch). Zahlen und Datum
 * schreibt es im Format aus waehrung.js (Sprache der Seite und Währung).
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

  // ---------- Texte je Sprache ----------

  // Französisch: geschütztes Leerzeichen vor „:“, schmales vor „;“ und „?“.
  var NBSP = " ";
  var SCHMAL = " ";

  var TEXTE = {
    de: {
      ergebnis: "Ergebnis",
      leer: "Trag Vertragsbeginn, Laufzeit, vereinbarte Laufleistung und deinen heutigen Kilometerstand ein – das Ergebnis erscheint sofort.",
      laufzeitFalsch: "Die Laufzeit muss zwischen 1 und 120 Monaten liegen.",
      vereinbartFehlt: "Die vereinbarte Laufleistung fehlt.",
      unterUebernahme: function (km) { return "Der Kilometerstand liegt unter dem Stand bei Übernahme (" + km + ")."; },
      vorBeginn: function (stand, beginn) { return "Der Stand ist vom " + stand + ", der Vertrag beginnt erst am " + beginn + "."; },
      keineZahl: function (beispiel) { return "Beträge bitte als Zahl eintragen, etwa „" + beispiel + "“."; },
      schlussabrechnung: "Schlussabrechnung",
      standAm: function (datum) { return "Stand am " + datum; },
      gefahren: "Gefahren",
      vereinbart: "Vereinbart",
      sollHeute: "Soll heute",
      ueber: function (beendet) { return beendet ? "Über der Vereinbarung" : "Über dem Soll"; },
      unter: function (beendet) { return beendet ? "Unter der Vereinbarung" : "Unter dem Soll"; },
      genauImSoll: "Genau im Soll",
      vertragsende: "Vertragsende",
      nochFrei: "Noch frei",
      davonJeTag: "Davon je Tag",
      abrechnungLetzterStand: "Abrechnung zum letzten Stand",
      voraussichtlich: "Voraussichtlich am Vertragsende",
      ohneWeitere: "Wenn ab heute kein Kilometer mehr dazukommt",
      genauVereinbart: "Genau die vereinbarte Laufleistung.",
      rechenweg: function (r) {
        var weg = r.abweichung + (r.mehr ? " über" : " unter") + " der Vereinbarung";
        if (r.nichts && r.gedeckelt) {
          weg += " – vergütet wird laut deinen Angaben nichts.";
        } else if (r.nichts) {
          weg += " – das liegt innerhalb der Freigrenze, es wird nichts abgerechnet.";
        } else {
          weg += "; abgerechnet werden " + r.abgerechnet + " × " + r.satz + ".";
          if (r.gedeckelt) weg += " Die Obergrenze der Vergütung greift.";
        }
        return (r.mehr ? "Nachzahlung für Mehrkilometer" : "Vergütung für Minderkilometer") + ": " + weg;
      },
      annahmeFehlt: "Trag ein, wie viele Kilometer du im Jahr erwartest.",
      angenommen: function (jahr, tag) { return "Angenommen: " + jahr + " im Jahr, also " + tag + NBSP + "km je Tag."; },
      zuWenigTage: function (tage) { return "Für eine Hochrechnung braucht es mindestens " + tage + " Tage Fahrdaten. Bis dahin hilft eine eigene Jahresannahme."; },
      schnitt: function (tag) { return "Gerechnet mit deinem Schnitt seit Vertragsbeginn: " + tag + NBSP + "km je Tag."; },
      amEnde: function (km) { return " Laufleistung am Ende: " + km + "."; }
    },

    fr: {
      ergebnis: "Résultat",
      leer: "Saisissez le début du contrat, la durée, le kilométrage prévu au contrat et votre kilométrage du jour – le résultat s’affiche aussitôt.",
      laufzeitFalsch: "La durée doit être comprise entre 1 et 120" + NBSP + "mois.",
      vereinbartFehlt: "Il manque le kilométrage prévu au contrat.",
      unterUebernahme: function (km) { return "Ce kilométrage est inférieur au kilométrage à la livraison (" + km + ")."; },
      vorBeginn: function (stand, beginn) { return "Le relevé date du " + stand + ", mais le contrat ne commence que le " + beginn + "."; },
      keineZahl: function (beispiel) { return "Saisissez les montants sous forme de nombre, par exemple «" + NBSP + beispiel + NBSP + "»."; },
      schlussabrechnung: "Décompte final",
      standAm: function (datum) { return "Situation au " + datum; },
      gefahren: "Parcourus",
      vereinbart: "Prévu au contrat",
      sollHeute: "Prévu à ce jour",
      ueber: function (beendet) { return beendet ? "Au-dessus du kilométrage prévu" : "Au-dessus du prévu"; },
      unter: function (beendet) { return beendet ? "En dessous du kilométrage prévu" : "En dessous du prévu"; },
      genauImSoll: "Exactement dans le prévu",
      vertragsende: "Fin du contrat",
      nochFrei: "Encore disponible",
      davonJeTag: "Soit par jour",
      abrechnungLetzterStand: "Décompte au dernier relevé",
      voraussichtlich: "Projection en fin de contrat",
      ohneWeitere: "Si plus aucun kilomètre ne s’ajoute à partir d’aujourd’hui",
      genauVereinbart: "Exactement le kilométrage prévu au contrat.",
      rechenweg: function (r) {
        var weg = r.abweichung + (r.mehr ? " au-dessus" : " en dessous") + " du kilométrage prévu";
        if (r.nichts && r.gedeckelt) {
          weg += " – d’après vos indications, rien n’est remboursé.";
        } else if (r.nichts) {
          weg += " – c’est dans la tolérance, rien n’est décompté.";
        } else {
          weg += SCHMAL + "; " + r.abgerechnet + " sont décomptés à " + r.satz + " par km.";
          if (r.gedeckelt) weg += " Le plafond de remboursement s’applique.";
        }
        return (r.mehr ? "Supplément à payer" : "Remboursement") + NBSP + ": " + weg;
      },
      annahmeFehlt: "Indiquez combien de kilomètres vous prévoyez de parcourir par an.",
      angenommen: function (jahr, tag) { return "Estimation" + NBSP + ": " + jahr + " par an, soit " + tag + NBSP + "km par jour."; },
      zuWenigTage: function (tage) { return "Une projection demande au moins " + tage + NBSP + "jours de données. D’ici là, vous pouvez calculer avec votre propre estimation annuelle."; },
      schnitt: function (tag) { return "Calculé avec votre moyenne depuis le début du contrat" + NBSP + ": " + tag + NBSP + "km par jour."; },
      amEnde: function (km) { return " Kilométrage en fin de contrat" + NBSP + ": " + km + "."; }
    },

    it: {
      ergebnis: "Risultato",
      leer: "Inserisci inizio del contratto, durata, km previsti dal contratto e il chilometraggio di oggi: il risultato compare subito.",
      laufzeitFalsch: "La durata deve essere compresa tra 1 e 120 mesi.",
      vereinbartFehlt: "Mancano i km previsti dal contratto.",
      unterUebernahme: function (km) { return "Il chilometraggio è inferiore a quello alla consegna (" + km + ")."; },
      vorBeginn: function (stand, beginn) { return "La lettura è del " + stand + ", ma il contratto inizia solo il " + beginn + "."; },
      keineZahl: function (beispiel) { return "Inserisci gli importi come numero, per esempio «" + beispiel + "»."; },
      schlussabrechnung: "Conguaglio finale",
      standAm: function (datum) { return "Situazione al " + datum; },
      gefahren: "Percorsi",
      vereinbart: "Previsti dal contratto",
      sollHeute: "Previsto a oggi",
      ueber: function (beendet) { return beendet ? "Sopra i km previsti" : "Sopra il previsto"; },
      unter: function (beendet) { return beendet ? "Sotto i km previsti" : "Sotto il previsto"; },
      genauImSoll: "In linea con il previsto",
      vertragsende: "Fine contratto",
      nochFrei: "Km residui",
      davonJeTag: "Al giorno",
      abrechnungLetzterStand: "Conguaglio all’ultima lettura",
      voraussichtlich: "Proiezione a fine contratto",
      ohneWeitere: "Se da oggi non percorri più alcun km",
      genauVereinbart: "Esattamente i km previsti dal contratto.",
      rechenweg: function (r) {
        var weg = r.abweichung + (r.mehr ? " in più" : " in meno") + " rispetto al contratto";
        if (r.nichts && r.gedeckelt) {
          weg += " – secondo i tuoi dati non viene rimborsato nulla.";
        } else if (r.nichts) {
          weg += " – rientrano nella tolleranza, non c’è alcun conguaglio.";
        } else {
          weg += "; si conteggiano " + r.abgerechnet + " a " + r.satz + " al km.";
          if (r.gedeckelt) weg += " Si applica il tetto al rimborso.";
        }
        return (r.mehr ? "Conguaglio per km in eccesso" : "Rimborso per km non percorsi") + ": " + weg;
      },
      annahmeFehlt: "Indica quanti km pensi di percorrere in un anno.",
      angenommen: function (jahr, tag) { return "Stima: " + jahr + " all’anno, cioè " + tag + NBSP + "km al giorno."; },
      zuWenigTage: function (tage) { return "Per una proiezione servono almeno " + tage + " giorni di dati. Fino ad allora puoi calcolare con una tua stima annuale."; },
      schnitt: function (tag) { return "Calcolato con la tua media dall’inizio del contratto: " + tag + NBSP + "km al giorno."; },
      amEnde: function (km) { return " Km a fine contratto: " + km + "."; }
    },

    es: {
      ergebnis: "Resultado",
      leer: "Introduce el inicio del contrato, la duración, el kilometraje contratado y tu kilometraje de hoy: el resultado aparece al momento.",
      laufzeitFalsch: "La duración debe estar entre 1 y 120 meses.",
      vereinbartFehlt: "Falta el kilometraje contratado.",
      unterUebernahme: function (km) { return "El kilometraje es inferior al de la entrega (" + km + ")."; },
      vorBeginn: function (stand, beginn) { return "La lectura es del " + stand + ", pero el contrato no empieza hasta el " + beginn + "."; },
      keineZahl: function (beispiel) { return "Introduce los importes como número, por ejemplo «" + beispiel + "»."; },
      schlussabrechnung: "Liquidación final",
      standAm: function (datum) { return "Situación a " + datum; },
      gefahren: "Recorridos",
      vereinbart: "Contratado",
      sollHeute: "Previsto a día de hoy",
      ueber: function (beendet) { return beendet ? "Por encima de lo contratado" : "Por encima de lo previsto"; },
      unter: function (beendet) { return beendet ? "Por debajo de lo contratado" : "Por debajo de lo previsto"; },
      genauImSoll: "Justo lo previsto",
      vertragsende: "Fin del contrato",
      nochFrei: "Disponibles",
      davonJeTag: "Al día",
      abrechnungLetzterStand: "Liquidación con la última lectura",
      voraussichtlich: "Proyección al fin del contrato",
      ohneWeitere: "Si a partir de hoy no recorres ni un kilómetro más",
      genauVereinbart: "Exactamente el kilometraje contratado.",
      rechenweg: function (r) {
        var weg = r.abweichung + (r.mehr ? " por encima" : " por debajo") + " de lo contratado";
        if (r.nichts && r.gedeckelt) {
          weg += "; según tus datos, no se reembolsa nada.";
        } else if (r.nichts) {
          weg += "; quedan dentro del margen de tolerancia, no se liquida nada.";
        } else {
          weg += "; se liquidan " + r.abgerechnet + " a " + r.satz + " por km.";
          if (r.gedeckelt) weg += " Se aplica el límite de reembolso.";
        }
        return (r.mehr ? "Pago adicional por kilómetros en exceso" : "Reembolso por kilómetros no recorridos") + ": " + weg;
      },
      annahmeFehlt: "Indica cuántos kilómetros esperas recorrer al año.",
      angenommen: function (jahr, tag) { return "Estimación: " + jahr + " al año, es decir, " + tag + NBSP + "km al día."; },
      zuWenigTage: function (tage) { return "Para una proyección hacen falta datos de al menos " + tage + " días. Hasta entonces, puedes calcular con tu propia estimación anual."; },
      schnitt: function (tag) { return "Calculado con tu media desde el inicio del contrato: " + tag + NBSP + "km al día."; },
      amEnde: function (km) { return " Kilometraje al final: " + km + "."; }
    }
  };

  var T = TEXTE[(document.documentElement.lang || "de").slice(0, 2).toLowerCase()] || TEXTE.de;

  // Tag und Monat zweistellig wie in der App: „05.10.2026“, nicht „5.10.2026“;
  // auf Französisch „05/10/2026“, mit Franken „05.10.2026“. Das Format folgt
  // der Währung (waehrung.js), deshalb je Format einmal angelegt.
  var datumformate = {};

  function datumformat() {
    var sprache = Waehrung.sprache;
    if (!datumformate[sprache]) {
      datumformate[sprache] = new Intl.DateTimeFormat(sprache, {
        day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC"
      });
    }
    return datumformate[sprache];
  }

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

  /** Betrag in Zehntausendsteln, siehe Waehrung.lesen. */
  function betrag(name) {
    return Waehrung.lesen(text(name));
  }

  /** Datum als Tageszahl seit 1970 (UTC), damit die Zeitumstellung nicht stört. */
  function tag(name) {
    var wert = text(name);
    var teile = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wert);
    if (!teile) return null;
    return Date.UTC(+teile[1], +teile[2] - 1, +teile[3]) / TAG_MS;
  }

  function alsDatum(tageszahl) {
    return datumformat().format(new Date(tageszahl * TAG_MS));
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

  /** Zehntausendstel kaufmännisch auf Cent bzw. Rappen. */
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
    return (wert > 0 ? "+" : wert < 0 ? "−" : "") + Waehrung.zahl(Math.abs(wert)) + NBSP + "km";
  }

  function kmText(wert) {
    return Waehrung.zahl(wert) + NBSP + "km";
  }

  function betragText(cent) {
    return Waehrung.betrag(cent);
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
      block.appendChild(element("p", "betrag", "±" + NBSP + Waehrung.betrag(0)));
      block.appendChild(element("p", "rechenweg", T.genauVereinbart));
      return block;
    }

    var mehr = a.art === "mehr";
    var betrag = element("p", "betrag " + (a.cent === 0 ? "" : mehr ? "nachzahlung" : "verguetung"), betragText(a.cent));
    block.appendChild(betrag);

    block.appendChild(element("p", "rechenweg", T.rechenweg({
      mehr: mehr,
      abweichung: kmText(Math.abs(a.differenz)),
      abgerechnet: kmText(a.kilometer),
      satz: Waehrung.satz(a.satz),
      nichts: a.kilometer === 0,
      gedeckelt: a.gedeckelt
    })));
    return block;
  }

  function fehler(meldung) {
    ausgabe.replaceChildren();
    ausgabe.appendChild(element("h2", "", T.ergebnis));
    ausgabe.appendChild(element("p", "fehlermeldung", meldung));
  }

  function leer() {
    ausgabe.replaceChildren();
    ausgabe.appendChild(element("h2", "", T.ergebnis));
    ausgabe.appendChild(element("p", "rechenweg", T.leer));
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
    if (monate < 1 || monate > 120) return fehler(T.laufzeitFalsch);
    if (vereinbart < 1) return fehler(T.vereinbartFehlt);
    if (stand < uebernahme) return fehler(T.unterUebernahme(kmText(uebernahme)));
    if (stichtag < beginn) return fehler(T.vorBeginn(alsDatum(stichtag), alsDatum(beginn)));

    var satzMehr = betrag("satzMehr");
    var satzMinder = betrag("satzMinder");
    var deckelCent = betrag("deckelBetrag");
    if ([satzMehr, satzMinder, deckelCent].some(function (w) { return typeof w === "number" && isNaN(w); })) {
      return fehler(T.keineZahl(Waehrung.eingabe("0,12")));
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
    ausgabe.appendChild(element("h2", "", beendet ? T.schlussabrechnung : T.standAm(alsDatum(stichtag))));

    var liste = element("dl", "kennzahlen");
    kennzahl(liste, T.gefahren, kmText(gefahren));
    kennzahl(liste, beendet ? T.vereinbart : T.sollHeute, kmText(soll));
    kennzahl(liste, abweichung > 0 ? T.ueber(beendet) : abweichung < 0 ? T.unter(beendet) : T.genauImSoll, kmMitVorzeichen(abweichung));
    kennzahl(liste, T.vertragsende, alsDatum(ende));
    if (!beendet) {
      var frei = Math.max(0, vereinbart - gefahren);
      kennzahl(liste, T.nochFrei, kmText(frei));
      kennzahl(liste, T.davonJeTag, Waehrung.zahl(frei / verbleibend, 1) + NBSP + "km");
    }
    ausgabe.appendChild(liste);

    if (beendet) {
      ausgabe.appendChild(abrechnungsblock(T.abrechnungLetzterStand, abrechnung(v, gefahren), v));
      return;
    }

    // Hochrechnung aufs Vertragsende
    var methode = text("methode") || "schnitt";
    var proTag = null;
    var grundlage = "";
    if (methode === "annahme") {
      var jahr = kilometer("jahresleistung");
      if (jahr === null) {
        grundlage = T.annahmeFehlt;
      } else {
        proTag = jahr / 365;
        grundlage = T.angenommen(kmText(jahr), Waehrung.zahl(proTag, 1));
      }
    } else if (abgelaufen < MINDEST_DATENBASIS_TAGE) {
      grundlage = T.zuWenigTage(MINDEST_DATENBASIS_TAGE);
    } else {
      proTag = gefahren / abgelaufen;
      grundlage = T.schnitt(Waehrung.zahl(proTag, 1));
    }

    var hochrechnung = element("div", "ergebnisblock");
    if (proTag === null) {
      hochrechnung.appendChild(element("h3", "", T.voraussichtlich));
      hochrechnung.appendChild(element("p", "rechenweg", grundlage));
      ausgabe.appendChild(hochrechnung);
    } else {
      var gesamt = gefahren + runden(proTag * verbleibend);
      var a = abrechnung(v, gesamt);
      var block = abrechnungsblock(T.voraussichtlich, a, v);
      block.appendChild(element("p", "rechenweg", grundlage + T.amEnde(kmText(gesamt))));
      ausgabe.appendChild(block);
    }

    ausgabe.appendChild(abrechnungsblock(T.ohneWeitere, abrechnung(v, gefahren), v));
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
    feld("vereinbart").value = Waehrung.eingabe("45.000");
    feld("uebernahme").value = "10";
    feld("stichtag").value = heute();
    feld("stand").value = Waehrung.eingabe("22.000");
    feld("satzMehr").value = Waehrung.eingabe("0,12");
    feld("satzMinder").value = Waehrung.eingabe("0,07");
    feld("freigrenze").value = Waehrung.eingabe("2.500");
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
  Waehrung.beiWechsel(rechnen);
  document.getElementById("rechner-js").hidden = false;
  methodeZeigen();
  deckelZeigen();
  rechnen();
})();
