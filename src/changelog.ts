/** What changed in each version, newest first. Written by hand at each release. */
export const CHANGELOG: { version: string; items: { en: string; fr: string }[] }[] = [
  {
    version: '1.9.0',
    items: [
      { en: 'Notifications: the notification icon in the header lists the comments that tag you, with a count of new ones.', fr: 'Notification dans la top bar' },
      { en: 'Tap one to open the entry and its comments.', fr: 'Redirection vers chaque commentaire' },
    ],
  },
  {
    version: '1.8.0',
    items: [
      { en: 'Comments on each entry: tap 💬 in the feed. Edit or delete your own.', fr: 'Ajout des commentaires sous chaque poop.' },
      { en: 'Reply to a comment, or tag someone by typing @.', fr: 'Mentions dans les commentaires avec "@".' },
    ],
  },
  {
    version: '1.7.0',
    items: [
      { en: 'Weekly and monthly reports: a winner for most points and for each record.', fr: 'Bilans de la semaine et du mois : un gagnant pour le plus de points et pour chaque record.' },
      { en: 'Poop points (💩) for each category won: 1 a week, 3 a month. Shown on profiles.', fr: 'Points caca (💩) pour chaque catégorie gagnée : 1 par semaine, 3 par mois. Visibles sur les profils.' },
      { en: 'Top is split into Week and Month.', fr: 'Le Top est séparé en Semaine et Mois.' },
      { en: 'Feed and Stats timeline load a few days at a time as you scroll.', fr: 'Le fil et la frise des stats se chargent quelques jours à la fois en défilant.' },
      { en: 'Tap the version number to see what changed.', fr: 'Clicker sur le numéro de version montre le changelog.' },
    ],
  },
  {
    version: '1.6.2',
    items: [{ en: 'Version number shown in the header.', fr: 'Numéro de version affiché en haut.' }],
  },
  {
    version: '1.6.1',
    items: [{ en: 'Fixes to access rules and the welcome page.', fr: 'Corrections des règles d’accès et de la page d’accueil.' }],
  },
  {
    version: '1.6.0',
    items: [
      { en: 'Works offline: entries are saved and synced later.', fr: 'Fonctionne hors ligne : les entrées sont gardées et synchronisées plus tard.' },
      { en: 'Deploy guide.', fr: 'Guide de déploiement.' },
    ],
  },
  {
    version: '1.5.0',
    items: [{ en: 'Time on the toilet.', fr: 'Temps passé aux toilettes.' }],
  },
];
