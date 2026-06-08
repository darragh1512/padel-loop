// This is our hand-made list of example games.
// There is NO database yet — these are just pretend games typed out by hand
// so the screens have something real-looking to show.
// Later, this file is the piece we'd swap out for real data from a database.

// A "type" is just a description of the shape of one game:
// what pieces of information every game must have.
export type Game = {
  id: string; // a unique label for the game, used in the web address
  venue: string; // the name of the padel club / court
  area: string; // the neighbourhood or town it's in
  distanceKm: number; // how far away it is, in kilometres
  time: string; // when the game is happening
  level: string; // the skill level the game is aimed at
  spotsOpen: number; // how many free spots are left to join
};

// Our pretend games. Add, remove, or edit these freely — the screens update.
export const games: Game[] = [
  {
    id: "1",
    venue: "Riverside Padel Club",
    area: "Clontarf",
    distanceKm: 1.2,
    time: "Today, 6:30 PM",
    level: "Improver",
    spotsOpen: 1,
  },
  {
    id: "2",
    venue: "Smashpoint Arena",
    area: "Ballsbridge",
    distanceKm: 2.8,
    time: "Today, 7:45 PM",
    level: "Intermediate",
    spotsOpen: 2,
  },
  {
    id: "3",
    venue: "City Padel Hub",
    area: "Docklands",
    distanceKm: 3.5,
    time: "Tomorrow, 10:00 AM",
    level: "Beginner",
    spotsOpen: 3,
  },
  {
    id: "4",
    venue: "Sunset Padel Courts",
    area: "Sandymount",
    distanceKm: 4.1,
    time: "Tomorrow, 12:30 PM",
    level: "Advanced",
    spotsOpen: 1,
  },
];

// A small helper that finds one game by its id.
// Returns the matching game, or "undefined" if no game has that id.
export function getGame(id: string): Game | undefined {
  return games.find((game) => game.id === id);
}
