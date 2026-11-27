// Hier kannst du Zitate ergänzen, ändern oder entfernen.
// Banner beginnen jeweils ab der angegebenen Stunde. Bei mehreren mit
// derselben Startstunde wechselt die Nachricht im Tagesrhythmus.
window.mood = {
  zitate: [
    "Don’t let the hard days win.",
    "Heute reicht ein kleiner Schritt.",
    "You can do hard things and still take a nap.",
    "Du darfst genauso freundlich mit dir sein wie mit anderen.",
    "Some days, showing up is the whole win.",
    "Ein tiefer Atemzug zählt auch als Fortschritt.",
    "Take your time. Good things grow slowly.",
    "Du darfst stolz auf dich sein, auch mitten im Chaos.",
    "A little progress is still progress.",
    "Heute muss kein Meisterwerk werden.",
    "The world is softer with you in it.",
    "Du hast schon so viele schwierige Tage geschafft."
  ],
  banner: [
    { ab: 0, icon: "☾", text: "Du solltest schlafen. Morgen ist auch noch ein Tag." },
    { ab: 6, icon: "☀", text: "Guten Morgen!" },
    { ab: 11, icon: "✦", text: "Hast du schon eine kleine Pause gemacht?" },
    { ab: 14, icon: "✦", text: "Wie läuft dein Tag?" },
    { ab: 14, icon: "✦", text: "Hallo! Kleiner Zwischenstopp zum Durchatmen." },
    { ab: 19, icon: "☾", text: "Guten Abend!" },
    { ab: 23, icon: "☾", text: "Du solltest schlafen. Gute Nacht." }
  ]
};

window.moodBannerAt = function (banners, date, select = (_, day) => day) {
  const hour = date.getHours();
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  const activeHour = Math.max(...banners.filter(item => item.ab <= hour).map(item => item.ab));
  const messages = banners.filter(item => item.ab === activeHour);
  return messages[select(activeHour, day, messages.length) % messages.length];
};
