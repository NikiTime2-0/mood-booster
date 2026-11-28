// Hier kannst du Zitate ergänzen, ändern oder entfernen.
// Banner beginnen jeweils ab der angegebenen Stunde. Bei mehreren mit
// derselben Startstunde wechselt die Nachricht im Tagesrhythmus.
window.mood = {
  zitate: [
    "Don’t let the hard days win.",
    "Heute reicht ein kleiner Schritt.",
    "Remember what Maroon 5 said: You can start over, you can run free, you can find other fish in the sea.",
    "Du darfst genauso freundlich mit dir sein wie mit anderen.",
    "Take your time. Good things grow slowly.",
    "Du darfst stolz auf dich sein, auch mitten im Chaos.",
    "A little progress is still progress.",
    "Du hast schon so viele schwierige Tage geschafft.",
    "Der nächste Urlaub wird cool.",
    "Lass uns wieder was kochen.",
    "Wir können Probleme nicht wegschnipsen, aber wir können miteinander reden und einander zuhören.",
    "Du machst solche Fortschritte.",
    "Du hast es verdient, gut behandelt zu werden.",
    "And in time you’ll be glad it’s gone.",
    "Wenn du gerade kein Licht am Ende des Tunnels siehst, gehe ich ein Stück mit dir durch die Dunkelheit.",
    "„When you're backed against the wall, break the goddamn thing down.“ – Suits",
    "„I win. That's what I do.“ – Suits",
    "„Lights will guide you home.“ – Coldplay",
    "Manchmal braucht es keine Lösung, sondern nur acht Minuten mit dem richtigen Menschen.",
    "Nur weil du gerade deine Stärke nicht spürst, heißt das nicht, dass sie verschwunden ist.",
    "Nur weil du den Weg gerade nicht siehst, bedeutet das nicht, dass es keinen gibt.",
    "Manchmal ist Ankommen einfach nur das Ende eines schwierigen Tages.",
    "Nicht jeder Sturm kommt, um dein Leben zu zerstören. Manche machen dir den Weg frei.",
    "Auch Umwege können zu schönen Orten führen.",
    "Ein Moment der Dunkelheit macht noch kein dunkles Leben.",
    "Du hast noch so viele schöne Tage vor dir, von denen du heute nichts weißt.",
    "Auch für die Menschen, die immer für andere da sind, muss jemand da sein.",
    "Manchmal bedeutet Freundschaft, gemeinsam auszuhalten, was man nicht ändern kann.",
    "Dein Wert verändert sich nicht durch die Unfähigkeit anderer, ihn zu erkennen.",
    "Auch kleine Schritte verlassen einen dunklen Ort."
  ],
  banner: [
    { ab: 0, icon: "☾", text: "Du solltest schlafen. Morgen ist auch noch ein Tag." },
    { ab: 6, icon: "☀", text: "Am Wochenende ist das zu früh" },
    { ab: 11, icon: "✦", text: "Schönen Tag!" },
    { ab: 14, icon: "✦", text: "Pass auf dich auf" },
    { ab: 14, icon: "✦", text: "Schönes Wochenende!" },
    { ab: 19, icon: "☾", text: "Fast geschafft für Heute" },
    { ab: 23, icon: "☾", text: "Schau mal in die Sterne" }
  ]
};

window.moodBannerAt = function (banners, date, select = (_, day) => day) {
  const hour = date.getHours();
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  const activeHour = Math.max(...banners.filter(item => item.ab <= hour).map(item => item.ab));
  const messages = banners.filter(item => item.ab === activeHour);
  return messages[select(activeHour, day, messages.length) % messages.length];
};
