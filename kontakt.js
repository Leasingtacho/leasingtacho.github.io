/*
 * Kontaktangaben – erzeugt von Werkzeuge/kontaktschutz.swift, nicht von Hand ändern.
 *
 * E-Mail, Telefon und Anschrift stehen nicht lesbar im HTML, damit Programme, die
 * Seiten nach Adressen durchsuchen, sie nicht finden. Dieses Skript setzt sie beim
 * Laden in alle Elemente mit data-kontakt ein (email, telefon, anschrift).
 */
(function () {
  "use strict";
  var daten = {
    e: [70,68,72,5,79,94,68,71,72,66,107,68,67,72,74,95,76,69,66,88,74,78,71],
    t: [29,29,31,27,25,26,18,28,29,30,26,11,18,31,0],
    w: [29,29,31,27,25,26,18,28,29,30,26,18,31,0],
    a: [[27,31,11,76,69,66,121,6,95,89,78,73,110,6,67,72,66,89,79,78,66,89,109], [78,93,78,71,96,11,24,24,30,28,31]]
  };
  function lesen(zahlen) {
    return String.fromCodePoint.apply(null, zahlen.map(function (z) { return z ^ 43; }).reverse());
  }
  function verweis(ziel, text) {
    var a = document.createElement("a");
    a.href = ziel;
    a.textContent = text;
    return a;
  }
  document.querySelectorAll("[data-kontakt]").forEach(function (stelle) {
    var art = stelle.getAttribute("data-kontakt");
    stelle.textContent = "";
    if (art === "email") {
      stelle.appendChild(verweis(["mai", "lto:"].join("") + lesen(daten.e), lesen(daten.e)));
    } else if (art === "telefon") {
      stelle.appendChild(verweis("tel:" + lesen(daten.w), lesen(daten.t)));
    } else if (art === "anschrift") {
      daten.a.forEach(function (zeile, i) {
        if (i > 0) stelle.appendChild(document.createElement("br"));
        stelle.appendChild(document.createTextNode(lesen(zeile)));
      });
    }
  });
})();
