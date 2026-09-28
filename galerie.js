/*
 * Leasingtacho – Galerie der Bildschirmfotos auf der Startseite.
 *
 * Der Streifen lässt sich auch ohne dieses Skript wischen und scrollen. Das
 * Skript blendet am Computer zwei Pfeile ein, die um so viele Bilder weiterblättern,
 * wie gerade ganz zu sehen sind, und schaltet sie am Anfang und Ende ab. Passen
 * alle Bilder ins Fenster, bleiben die Pfeile weg.
 */
(function () {
  "use strict";

  var galerie = document.querySelector(".galerie");
  if (!galerie) {
    return;
  }
  var streifen = galerie.querySelector(".galerie-streifen");
  var knoepfe = galerie.querySelector(".galerie-knoepfe");
  var zurueck = knoepfe.querySelector("[data-richtung='-1']");
  var weiter = knoepfe.querySelector("[data-richtung='1']");
  var bewegungMindern = window.matchMedia("(prefers-reduced-motion: reduce)");

  function schrittweite() {
    var stil = getComputedStyle(streifen);
    var abstand = parseFloat(stil.columnGap) || 0;
    var sichtbar = streifen.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight);
    var bild = streifen.querySelector("figure").getBoundingClientRect().width + abstand;
    var anzahl = Math.max(1, Math.floor((sichtbar + abstand) / bild));
    return anzahl * bild;
  }

  function blaettern(richtung) {
    streifen.scrollBy({
      left: richtung * schrittweite(),
      behavior: bewegungMindern.matches ? "auto" : "smooth"
    });
  }

  function aktualisieren() {
    var ende = streifen.scrollWidth - streifen.clientWidth;
    knoepfe.hidden = ende <= 1;
    zurueck.disabled = streifen.scrollLeft <= 1;
    weiter.disabled = streifen.scrollLeft >= ende - 1;
  }

  zurueck.addEventListener("click", function () {
    blaettern(-1);
  });
  weiter.addEventListener("click", function () {
    blaettern(1);
  });
  streifen.addEventListener("scroll", aktualisieren, { passive: true });
  window.addEventListener("resize", aktualisieren);

  galerie.classList.add("mit-knoepfen");
  aktualisieren();
})();
