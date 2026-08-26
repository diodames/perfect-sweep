/** FIBA World Cup squads, tactics, and archive helpers. */

export const TEAMS = [
  { name: "USA", season: "1994", c: "#B31942", alt: "#0A3161", players: [
    { n: 13, name: "Shaquille O'Neal", pos: "C", rt: 95, traits: ["twoWayTerror", "hackAShaq"] }, { n: 5, name: "Reggie Miller", pos: "SG", rt: 89 },
    { n: 6, name: "Shawn Kemp", pos: "PF", rt: 89 }, { n: 7, name: "Kevin Johnson", pos: "PG", rt: 87 },
    { n: 9, name: "D. Wilkins", pos: "SF", rt: 88 }, { n: 11, name: "A. Mourning", pos: "PF", rt: 88 },
  ]},
  { name: "USA", season: "2010", c: "#0A3161", players: [
    { n: 5, name: "Kevin Durant", pos: "SF", rt: 94 }, { n: 6, name: "Derrick Rose", pos: "PG", rt: 88, trait: "glassKnee" },
    { n: 7, name: "R. Westbrook", pos: "SG", rt: 86, trait: "brickFactory" }, { n: 4, name: "C. Billups", pos: "SG", rt: 83 },
    { n: 10, name: "A. Iguodala", pos: "SF", rt: 82 }, { n: 15, name: "L. Odom", pos: "PF", rt: 81 }, { n: 11, name: "K. Love", pos: "C", rt: 82 },
  ]},
  { name: "USA", season: "2014", c: "#B31942", alt: "#0A3161", players: [
    { n: 4, name: "Stephen Curry", pos: "PG", rt: 92, trait: "flameThrower", traitChance: 0.12 }, { n: 13, name: "James Harden", pos: "SG", rt: 90, trait: "playoffFade" },
    { n: 10, name: "Kyrie Irving", pos: "SG", rt: 89, trait: "goesMissing" }, { n: 14, name: "Anthony Davis", pos: "PF", rt: 88 },
    { n: 11, name: "K. Thompson", pos: "SF", rt: 86 }, { n: 12, name: "D. Cousins", pos: "C", rt: 84, trait: "hotHead" },
  ]},
  { name: "USA", season: "2023", c: "#0A3161", players: [
    { n: 5, name: "A. Edwards", pos: "SG", rt: 88 }, { n: 11, name: "J. Brunson", pos: "PG", rt: 85 },
    { n: 4, name: "T. Haliburton", pos: "SG", rt: 84 }, { n: 15, name: "M. Bridges", pos: "SF", rt: 84 },
    { n: 13, name: "J. Jackson Jr.", pos: "C", rt: 84 }, { n: 8, name: "P. Banchero", pos: "PF", rt: 82 },
  ]},
  { name: "Yugoslavia", season: "1990", c: "#1B4A9C", players: [
    { n: 10, name: "Dražen Petrović", pos: "SG", rt: 94, trait: "fibaLegend" }, { n: 7, name: "Toni Kukoč", pos: "SF", rt: 90 },
    { n: 12, name: "Vlade Divac", pos: "C", rt: 89, trait: "flopCity" }, { n: 11, name: "Dino Rađa", pos: "PF", rt: 87 },
    { n: 15, name: "Ž. Paspalj", pos: "PF", rt: 84 }, { n: 4, name: "J. Zdovc", pos: "PG", rt: 80 },
  ]},
  { name: "Yugoslavia", season: "2002", c: "#C6363C", alt: "#2F5FBF", players: [
    { n: 5, name: "D. Bodiroga", pos: "SF", rt: 91, trait: "mrImportant" }, { n: 8, name: "P. Stojaković", pos: "SG", rt: 89 },
    { n: 12, name: "Vlade Divac", pos: "C", rt: 86 }, { n: 9, name: "Marko Jarić", pos: "PG", rt: 81 },
    { n: 6, name: "M. Gurović", pos: "SG", rt: 79 }, { n: 14, name: "P. Drobnjak", pos: "PF", rt: 78 },
  ]},
  { name: "Soviet Union", season: "1986", c: "#CC0000", alt: "#D4AF37", players: [
    { n: 11, name: "Arvydas Sabonis", pos: "C", rt: 95, trait: "goldMedalDna" }, { n: 13, name: "Š. Marčiulionis", pos: "SG", rt: 88 },
    { n: 5, name: "V. Valters", pos: "PG", rt: 84 }, { n: 9, name: "A. Volkov", pos: "PF", rt: 83 },
    { n: 7, name: "V. Khomicius", pos: "PF", rt: 81 }, { n: 8, name: "S. Tarakanov", pos: "SF", rt: 79 },
  ]},
  { name: "Brazil", season: "1986", c: "#FFDF00", players: [
    { n: 14, name: "Oscar Schmidt", pos: "SF", rt: 93, trait: "pointGame42" }, { n: 6, name: "Marcel", pos: "SG", rt: 85 },
    { n: 5, name: "Maury", pos: "PG", rt: 80 }, { n: 4, name: "Israel", pos: "SG", rt: 79 },
    { n: 11, name: "Gerson", pos: "PF", rt: 78 }, { n: 15, name: "Rolando", pos: "C", rt: 77 },
  ]},
  { name: "Argentina", season: "2002", c: "#6CACE4", players: [
    { n: 5, name: "Manu Ginóbili", pos: "SG", rt: 91, trait: "chaosEnergy" }, { n: 4, name: "Luis Scola", pos: "PF", rt: 88 },
    { n: 7, name: "A. Nocioni", pos: "SF", rt: 84 }, { n: 14, name: "F. Oberto", pos: "C", rt: 82 },
    { n: 8, name: "Pepe Sánchez", pos: "PG", rt: 81 }, { n: 10, name: "C. Delfino", pos: "SF", rt: 80 },
  ]},
  { name: "Argentina", season: "2019", c: "#75AADB", players: [
    { n: 4, name: "Luis Scola", pos: "PF", rt: 85 }, { n: 7, name: "F. Campazzo", pos: "PG", rt: 86 },
    { n: 8, name: "N. Laprovittola", pos: "SG", rt: 81 }, { n: 14, name: "G. Deck", pos: "SF", rt: 81 },
    { n: 29, name: "P. Garino", pos: "SG", rt: 77 }, { n: 12, name: "M. Delía", pos: "C", rt: 76 },
  ]},
  { name: "Spain", season: "2006", c: "#AA151B", alt: "#F1BF00", players: [
    { n: 4, name: "Pau Gasol", pos: "PF", rt: 94, trait: "elCapitan" }, { n: 7, name: "J.C. Navarro", pos: "SG", rt: 88 },
    { n: 8, name: "José Calderón", pos: "PG", rt: 85 }, { n: 15, name: "J. Garbajosa", pos: "SF", rt: 83 },
    { n: 13, name: "Marc Gasol", pos: "C", rt: 79, stretch: true }, { n: 10, name: "Rudy Fernández", pos: "SF", rt: 80 },
  ]},
  { name: "Spain", season: "2019", c: "#F1BF00", players: [
    { n: 9, name: "Ricky Rubio", pos: "PG", rt: 88 }, { n: 13, name: "Marc Gasol", pos: "C", rt: 86 },
    { n: 5, name: "Rudy Fernández", pos: "SF", rt: 80 }, { n: 23, name: "Sergio Llull", pos: "SG", rt: 81 },
    { n: 41, name: "J. Hernangómez", pos: "PF", rt: 79 }, { n: 14, name: "W. Hernangómez", pos: "PF", rt: 78 },
  ]},
  { name: "Spain", season: "2023", c: "#AA151B", alt: "#F1BF00", players: [
    { n: 2, name: "Lorenzo Brown", pos: "PG", rt: 87 }, { n: 14, name: "W. Hernangómez", pos: "C", rt: 88 },
    { n: 41, name: "J. Hernangómez", pos: "PF", rt: 83 }, { n: 23, name: "Sergio Llull", pos: "SG", rt: 82 },
    { n: 5, name: "Rudy Fernández", pos: "SF", rt: 80 }, { n: 7, name: "Santi Aldama", pos: "PF", rt: 81 },
  ]},
  { name: "Germany", season: "2023", c: "#DD0000", alt: "#FFCE00", players: [
    { n: 17, name: "D. Schröder", pos: "PG", rt: 89, trait: "elCapitan" }, { n: 22, name: "Franz Wagner", pos: "SF", rt: 87 },
    { n: 10, name: "Daniel Theis", pos: "C", rt: 81 }, { n: 13, name: "Moritz Wagner", pos: "PF", rt: 80 },
    { n: 7, name: "J. Voigtmann", pos: "PF", rt: 78 }, { n: 32, name: "Andreas Obst", pos: "SG", rt: 79 },
  ]},
  { name: "Germany", season: "2002", c: "#1a1a1a", alt: "#C9CED6", players: [
    { n: 14, name: "Dirk Nowitzki", pos: "PF", rt: 94, trait: "unicorn" }, { n: 6, name: "A. Femerling", pos: "C", rt: 78 },
    { n: 5, name: "M. Okulaja", pos: "SF", rt: 79 }, { n: 10, name: "S. Hamann", pos: "PG", rt: 76 },
    { n: 7, name: "R. Garrett", pos: "SG", rt: 77 }, { n: 12, name: "P. Femerling", pos: "PF", rt: 75 },
  ]},
  { name: "Serbia", season: "2014", c: "#C6363C", alt: "#1F4E9C", players: [
    { n: 4, name: "Miloš Teodosić", pos: "PG", rt: 88, trait: "connector" }, { n: 7, name: "B. Bogdanović", pos: "SG", rt: 85 },
    { n: 10, name: "N. Bjelica", pos: "PF", rt: 82 }, { n: 9, name: "S. Marković", pos: "SG", rt: 79 },
    { n: 13, name: "M. Raduljica", pos: "C", rt: 79 }, { n: 8, name: "N. Kalinić", pos: "SF", rt: 79 },
  ]},
  { name: "Serbia", season: "2019", c: "#C6363C", alt: "#1F4E9C", players: [
    { n: 15, name: "Nikola Jokić", pos: "C", rt: 96, trait: "connector" }, { n: 7, name: "B. Bogdanović", pos: "SG", rt: 90 },
    { n: 8, name: "N. Bjelica", pos: "PF", rt: 84 }, { n: 24, name: "Stefan Jović", pos: "PG", rt: 82 },
    { n: 11, name: "V. Lučić", pos: "SF", rt: 80 }, { n: 51, name: "Boban Marjanović", pos: "C", rt: 80 },
  ]},
  { name: "Greece", season: "2006", c: "#0D5EAF", players: [
    { n: 4, name: "T. Papaloukas", pos: "PG", rt: 88 }, { n: 13, name: "D. Diamantidis", pos: "SG", rt: 88 },
    { n: 7, name: "V. Spanoulis", pos: "SG", rt: 87 }, { n: 12, name: "S. Schortsanitis", pos: "C", rt: 83 },
    { n: 11, name: "A. Fotsis", pos: "PF", rt: 80 }, { n: 14, name: "M. Kakiouzis", pos: "SF", rt: 79 },
  ]},
  { name: "Lithuania", season: "2006", c: "#046A38", alt: "#FDB913", players: [
    { n: 6, name: "A. Macijauskas", pos: "SG", rt: 88 }, { n: 9, name: "D. Songaila", pos: "PF", rt: 84 },
    { n: 11, name: "Linas Kleiza", pos: "SF", rt: 83 }, { n: 7, name: "D. Lavrinovič", pos: "PF", rt: 82 },
    { n: 15, name: "R. Javtokas", pos: "C", rt: 81 }, { n: 10, name: "M. Kalnietis", pos: "PG", rt: 78 },
  ]},
  { name: "Lithuania", season: "2010", c: "#046A38", players: [
    { n: 11, name: "Linas Kleiza", pos: "SF", rt: 85 }, { n: 13, name: "D. Songaila", pos: "PF", rt: 80 },
    { n: 5, name: "M. Kalnietis", pos: "PG", rt: 79 }, { n: 17, name: "J. Valančiūnas", pos: "C", rt: 78 },
    { n: 15, name: "R. Javtokas", pos: "PF", rt: 78 }, { n: 8, name: "R. Seibutis", pos: "SG", rt: 76 },
  ]},
  { name: "France", season: "2019", c: "#002395", players: [
    { n: 27, name: "Rudy Gobert", pos: "C", rt: 88, traits: ["greatWall", "foulTrouble"], traitChance: 0.15 }, { n: 10, name: "E. Fournier", pos: "SG", rt: 85 },
    { n: 12, name: "Nando De Colo", pos: "PG", rt: 84 }, { n: 5, name: "Nicolas Batum", pos: "SF", rt: 83 },
    { n: 21, name: "A. Albicy", pos: "SG", rt: 77 }, { n: 15, name: "A. M'Baye", pos: "PF", rt: 76 },
  ]},
  { name: "Croatia", season: "1994", c: "#FF0000", alt: "#0F3C8C", players: [
    { n: 7, name: "Toni Kukoč", pos: "SF", rt: 91 }, { n: 11, name: "Dino Rađa", pos: "PF", rt: 88 },
    { n: 10, name: "A. Komazec", pos: "SG", rt: 82 }, { n: 9, name: "V. Perasović", pos: "SF", rt: 81 },
    { n: 15, name: "S. Vranković", pos: "C", rt: 80 }, { n: 5, name: "V. Šretl", pos: "PG", rt: 75 },
  ]},
  { name: "Croatia", season: "2010", c: "#FF0000", alt: "#0F3C8C", players: [
    { n: 25, name: "Ante Tomić", pos: "C", rt: 84 }, { n: 44, name: "B. Bogdanović", pos: "SG", rt: 83 },
    { n: 10, name: "Z. Planinić", pos: "PG", rt: 82 }, { n: 5, name: "R. Ukić", pos: "SG", rt: 80 },
    { n: 7, name: "M. Banić", pos: "PF", rt: 79 }, { n: 9, name: "M. Popović", pos: "SF", rt: 78 },
  ]},
  { name: "Slovenia", season: "2023", c: "#00A94F", players: [
    { n: 77, name: "Luka Dončić", pos: "PG", rt: 96, traits: ["heroBall", "refMeltdown"] }, { n: 6, name: "A. Tobey", pos: "C", rt: 79 },
    { n: 3, name: "K. Prepelič", pos: "SG", rt: 79 }, { n: 31, name: "V. Čančar", pos: "PF", rt: 78 },
    { n: 11, name: "J. Blažič", pos: "SF", rt: 76 }, { n: 30, name: "Z. Dragić", pos: "SG", rt: 75 },
  ]},
  { name: "Australia", season: "2014", c: "#00843D", players: [
    { n: 5, name: "Patty Mills", pos: "PG", rt: 86 }, { n: 6, name: "M. Dellavedova", pos: "SG", rt: 81 },
    { n: 12, name: "Aron Baynes", pos: "C", rt: 82 }, { n: 7, name: "Joe Ingles", pos: "SF", rt: 80 },
    { n: 4, name: "D. Andersen", pos: "PF", rt: 78 }, { n: 9, name: "Ryan Broekhoff", pos: "SF", rt: 76 },
  ]},
  { name: "Australia", season: "2019", c: "#00843D", players: [
    { n: 5, name: "Patty Mills", pos: "PG", rt: 87 }, { n: 7, name: "Joe Ingles", pos: "SF", rt: 82 },
    { n: 12, name: "Aron Baynes", pos: "C", rt: 79 }, { n: 43, name: "C. Goulding", pos: "SG", rt: 77 },
    { n: 34, name: "Jock Landale", pos: "PF", rt: 77 }, { n: 11, name: "N. Kay", pos: "PF", rt: 75 },
  ]},
  { name: "Canada", season: "2023", c: "#D80621", alt: "#2C3E50", players: [
    { n: 2, name: "S. Gilgeous-Alexander", pos: "PG", rt: 93 }, { n: 24, name: "Dillon Brooks", pos: "SF", rt: 82 },
    { n: 9, name: "RJ Barrett", pos: "SG", rt: 81 }, { n: 13, name: "Kelly Olynyk", pos: "C", rt: 80, stretch: true },
    { n: 5, name: "Lu Dort", pos: "SF", rt: 79 }, { n: 4, name: "D. Powell", pos: "PF", rt: 77 },
  ]},
  { name: "China", season: "2002", c: "#DE2910", alt: "#FFD700", players: [
    { n: 13, name: "Yao Ming", pos: "C", rt: 90, trait: "greatWall" }, { n: 14, name: "Wang Zhizhi", pos: "PF", rt: 81 },
    { n: 9, name: "Hu Weidong", pos: "SG", rt: 78 }, { n: 8, name: "Liu Wei", pos: "PG", rt: 75 },
    { n: 15, name: "M. Batere", pos: "SF", rt: 76 }, { n: 6, name: "Li Nan", pos: "PF", rt: 74 },
  ]},
  { name: "Puerto Rico", season: "1990", c: "#EF3E42", alt: "#1A4FA0", players: [
    { n: 12, name: "J. \"Piculín\" Ortiz", pos: "C", rt: 85 }, { n: 6, name: "R. Rivas", pos: "PF", rt: 79 },
    { n: 4, name: "F. Rivera", pos: "PG", rt: 78 }, { n: 10, name: "J. Carter", pos: "SG", rt: 77 },
    { n: 8, name: "E. Casiano", pos: "SF", rt: 76 }, { n: 14, name: "M. Vicéns", pos: "SG", rt: 74 },
  ]},
  { name: "Serbia", season: "2023", c: "#C6363C", alt: "#1F4E9C", players: [
    { n: 7, name: "B. Bogdanović", pos: "SG", rt: 88 }, { n: 22, name: "V. Micić", pos: "PG", rt: 84 },
    { n: 9, name: "N. Milutinov", pos: "C", rt: 81 }, { n: 8, name: "N. Jović", pos: "SF", rt: 77 },
    { n: 13, name: "F. Petrušev", pos: "PF", rt: 79 }, { n: 6, name: "A. Avramović", pos: "PG", rt: 77 },
  ]},
  { name: "Greece", season: "2019", c: "#0D5EAF", players: [
    { n: 34, name: "G. Antetokounmpo", pos: "PF", rt: 95, trait: "secondHalfBeast" }, { n: 15, name: "G. Printezis", pos: "SF", rt: 80 },
    { n: 4, name: "N. Calathes", pos: "PG", rt: 83 }, { n: 16, name: "K. Papanikolaou", pos: "PF", rt: 79 },
    { n: 5, name: "I. Bourousis", pos: "C", rt: 79 }, { n: 43, name: "T. Antetokounmpo", pos: "SG", rt: 74 },
  ]},
  { name: "Lithuania", season: "2019", c: "#FDB913", players: [
    { n: 17, name: "J. Valančiūnas", pos: "C", rt: 86 }, { n: 11, name: "D. Sabonis", pos: "PF", rt: 87 },
    { n: 5, name: "M. Kalnietis", pos: "PG", rt: 79 }, { n: 21, name: "M. Kuzminskas", pos: "SF", rt: 78 },
    { n: 13, name: "R. Jokubaitis", pos: "SG", rt: 76 }, { n: 8, name: "J. Mačiulis", pos: "SG", rt: 76 },
  ]},
  { name: "France", season: "2014", c: "#002395", players: [
    { n: 9, name: "Tony Parker", pos: "PG", rt: 90, trait: "elCapitan" }, { n: 8, name: "Boris Diaw", pos: "PF", rt: 83 },
    { n: 5, name: "Nicolas Batum", pos: "SF", rt: 84 }, { n: 27, name: "Rudy Gobert", pos: "C", rt: 82 },
    { n: 12, name: "Nando De Colo", pos: "SG", rt: 83 }, { n: 6, name: "T. Heurtel", pos: "SG", rt: 78 },
  ]},
  { name: "Croatia", season: "2019", c: "#FF0000", alt: "#0F3C8C", players: [
    { n: 44, name: "B. Bogdanović", pos: "SF", rt: 85 }, { n: 24, name: "D. Šarić", pos: "PF", rt: 83 },
    { n: 40, name: "I. Zubac", pos: "C", rt: 81 }, { n: 8, name: "M. Hezonja", pos: "SG", rt: 79 },
    { n: 10, name: "K. Ramljak", pos: "PG", rt: 75 }, { n: 5, name: "R. Ukić", pos: "SG", rt: 76 },
  ]},
  { name: "Australia", season: "2023", c: "#FFCD00", players: [
    { n: 3, name: "Josh Giddey", pos: "PG", rt: 84 }, { n: 5, name: "Patty Mills", pos: "SG", rt: 81 },
    { n: 34, name: "Jock Landale", pos: "C", rt: 80, stretch: true }, { n: 6, name: "Josh Green", pos: "SF", rt: 78 },
    { n: 7, name: "Dante Exum", pos: "SG", rt: 78 }, { n: 9, name: "X. Cooks", pos: "PF", rt: 76 },
  ]},
  { name: "Brazil", season: "2010", c: "#FFDF00", players: [
    { n: 12, name: "Nenê", pos: "C", rt: 85 }, { n: 6, name: "Leandro Barbosa", pos: "SG", rt: 84 },
    { n: 11, name: "Anderson Varejão", pos: "PF", rt: 83 }, { n: 9, name: "Marcelo Huertas", pos: "PG", rt: 79 },
    { n: 8, name: "Alex Garcia", pos: "SF", rt: 78 }, { n: 4, name: "Marcelinho Machado", pos: "SG", rt: 77 },
  ]},
  { name: "Brazil", season: "2019", c: "#009C3B", alt: "#FFDF00", players: [
    { n: 19, name: "Leandro Barbosa", pos: "SG", rt: 82 }, { n: 5, name: "Raul Neto", pos: "PG", rt: 81 },
    { n: 11, name: "Anderson Varejão", pos: "C", rt: 80 }, { n: 14, name: "Marquinhos", pos: "SF", rt: 79 },
    { n: 9, name: "Vítor Benite", pos: "SG", rt: 78 }, { n: 6, name: "Cristiano Felício", pos: "PF", rt: 77 },
  ]},
  { name: "China", season: "2019", c: "#DE2910", alt: "#FFD700", players: [
    { n: 11, name: "Yi Jianlian", pos: "PF", rt: 82 }, { n: 6, name: "Guo Ailun", pos: "PG", rt: 78 },
    { n: 15, name: "Zhou Qi", pos: "C", rt: 77, stretch: true }, { n: 9, name: "Zhao Rui", pos: "SG", rt: 76 },
    { n: 12, name: "Ding Yanyuhang", pos: "SF", rt: 77 }, { n: 5, name: "Fang Shuo", pos: "SG", rt: 74 },
  ]},
  /* --- expansion: Europe depth + Africa / Asia / Oceania coverage --- */
  { name: "Italy", season: "2006", c: "#009246", alt: "#CE2B37", players: [
    { n: 7, name: "Gianluca Basile", pos: "SG", rt: 85, trait: "flameThrower" }, { n: 5, name: "G. Pozzecco", pos: "PG", rt: 80 },
    { n: 12, name: "M. Mordente", pos: "SF", rt: 78 }, { n: 14, name: "Denis Marconato", pos: "C", rt: 81 },
    { n: 15, name: "L. Garri", pos: "PF", rt: 77 }, { n: 8, name: "M. Soragna", pos: "SG", rt: 76 },
  ]},
  { name: "Turkey", season: "2010", c: "#E30A17", players: [
    { n: 6, name: "Hidayet Türkoğlu", pos: "SF", rt: 87, trait: "mrImportant", traitChance: 0.05 }, { n: 7, name: "Ömer Aşık", pos: "C", rt: 82 },
    { n: 23, name: "E. İlyasova", pos: "PF", rt: 82 }, { n: 4, name: "Kerem Tunçeri", pos: "PG", rt: 79 },
    { n: 10, name: "Ömer Onan", pos: "SG", rt: 78 }, { n: 12, name: "Semih Erden", pos: "PF", rt: 77 },
  ]},
  { name: "Russia", season: "2010", c: "#0039A6", alt: "#D52B1E", players: [
    { n: 47, name: "A. Kirilenko", pos: "SF", rt: 89, trait: "theRussian" }, { n: 15, name: "V. Khryapa", pos: "PF", rt: 82 },
    { n: 11, name: "Timofey Mozgov", pos: "C", rt: 80 }, { n: 4, name: "A. Bykov", pos: "PG", rt: 78 },
    { n: 8, name: "V. Fridzon", pos: "SG", rt: 79 }, { n: 10, name: "S. Monia", pos: "SF", rt: 76 },
  ]},
  { name: "Latvia", season: "2023", c: "#9E3039", alt: "#FFFFFF", players: [
    { n: 6, name: "K. Porziņģis", pos: "C", rt: 90, trait: "theTower" }, { n: 42, name: "Dāvis Bertāns", pos: "SF", rt: 81 },
    { n: 8, name: "Dairis Bertāns", pos: "SG", rt: 78 }, { n: 13, name: "A. Žagars", pos: "PG", rt: 79 },
    { n: 24, name: "A. Gražulis", pos: "PF", rt: 78 }, { n: 0, name: "R. Kurucs", pos: "SF", rt: 76 },
  ]},
  { name: "Czechia", season: "2019", c: "#11457E", alt: "#D7141A", players: [
    { n: 8, name: "T. Satoranský", pos: "PG", rt: 84, trait: "connector" }, { n: 17, name: "J. Bohačík", pos: "SG", rt: 82 },
    { n: 11, name: "Blake Schilb", pos: "SF", rt: 79 }, { n: 7, name: "V. Hruban", pos: "SF", rt: 78 },
    { n: 12, name: "O. Balvín", pos: "C", rt: 77 }, { n: 1, name: "Patrik Auda", pos: "PF", rt: 76 },
  ]},
  { name: "Nigeria", season: "2023", c: "#008751", alt: "#FFFFFF", players: [
    { n: 7, name: "Gabe Vincent", pos: "PG", rt: 82 }, { n: 20, name: "Josh Okogie", pos: "SF", rt: 81 },
    { n: 13, name: "Jordan Nwora", pos: "PF", rt: 80 }, { n: 5, name: "C. Moneke", pos: "PF", rt: 78 },
    { n: 9, name: "C. Metu", pos: "C", rt: 78 }, { n: 11, name: "K. Okpala", pos: "SG", rt: 76 },
  ]},
  { name: "Angola", season: "2006", c: "#C8102E", alt: "#000000", players: [
    { n: 10, name: "O. Cipriano", pos: "SF", rt: 80 }, { n: 5, name: "Carlos Almeida", pos: "PG", rt: 78 },
    { n: 8, name: "E. Mingas", pos: "PF", rt: 79 }, { n: 14, name: "J. Costa", pos: "C", rt: 76 },
    { n: 9, name: "A. Morais", pos: "SG", rt: 75 }, { n: 12, name: "V. Muzemba", pos: "PF", rt: 74 },
  ]},
  { name: "Japan", season: "2023", c: "#BC002D", players: [
    { n: 8, name: "Rui Hachimura", pos: "PF", rt: 86, trait: "risingSun" }, { n: 5, name: "Yuta Watanabe", pos: "SF", rt: 80 },
    { n: 2, name: "Yuki Kawamura", pos: "PG", rt: 80 }, { n: 24, name: "J. Hawkinson", pos: "C", rt: 79 },
    { n: 12, name: "Y. Togashi", pos: "SG", rt: 76 }, { n: 18, name: "K. Tominaga", pos: "SG", rt: 75 },
  ]},
  { name: "New Zealand", season: "2002", c: "#111111", alt: "#5B9BD5", players: [
    { n: 13, name: "Pero Cameron", pos: "PF", rt: 82 }, { n: 5, name: "Phill Jones", pos: "SG", rt: 79 },
    { n: 7, name: "Sean Marks", pos: "C", rt: 78 }, { n: 10, name: "Kirk Penney", pos: "SF", rt: 78 },
    { n: 4, name: "P. Henare", pos: "PG", rt: 75 }, { n: 8, name: "D. Boucher", pos: "PF", rt: 74 },
  ]},
  /* --- curated gaps: notable WC nations still missing from the draft pool --- */
  { name: "Dominican Republic", season: "2023", c: "#002D62", alt: "#CE1126", players: [
    { n: 32, name: "K.A. Towns", pos: "C", rt: 92, trait: "theTower" }, { n: 3, name: "Andrés Feliz", pos: "PG", rt: 80 },
    { n: 11, name: "Angel Delgado", pos: "PF", rt: 81 }, { n: 9, name: "Jean Montero", pos: "SG", rt: 79 },
    { n: 5, name: "Victor Liz", pos: "SF", rt: 77 }, { n: 25, name: "Lester Quiñones", pos: "SG", rt: 76 },
  ]},
  { name: "Philippines", season: "2023", c: "#0038A8", alt: "#CE1126", players: [
    { n: 6, name: "Jordan Clarkson", pos: "SG", rt: 88, trait: "flameThrower" }, { n: 15, name: "Kai Sotto", pos: "C", rt: 80, stretch: true },
    { n: 1, name: "June Mar Fajardo", pos: "PF", rt: 79 }, { n: 7, name: "Dwight Ramos", pos: "SF", rt: 78 },
    { n: 4, name: "Kiefer Ravena", pos: "PG", rt: 77 }, { n: 23, name: "Japeth Aguilar", pos: "PF", rt: 76 },
  ]},
  { name: "Finland", season: "2023", c: "#002F6C", alt: "#FFFFFF", players: [
    { n: 23, name: "Lauri Markkanen", pos: "PF", rt: 91, trait: "unicorn" }, { n: 7, name: "Sasu Salin", pos: "SG", rt: 79 },
    { n: 18, name: "Mikael Jantunen", pos: "SF", rt: 78 }, { n: 9, name: "Edon Maxhuni", pos: "PG", rt: 77 },
    { n: 11, name: "Alexander Madsen", pos: "C", rt: 77, stretch: true }, { n: 21, name: "Shawn Huff", pos: "SF", rt: 75 },
  ]},
  { name: "South Sudan", season: "2023", c: "#0F47AF", alt: "#FC0119", players: [
    { n: 0, name: "Carlik Jones", pos: "PG", rt: 84, trait: "chaosEnergy" }, { n: 32, name: "Wenyen Gabriel", pos: "PF", rt: 80 },
    { n: 9, name: "Marial Shayok", pos: "SG", rt: 79 }, { n: 14, name: "Mangok Mathiang", pos: "C", rt: 78 },
    { n: 5, name: "Nuni Omot", pos: "SF", rt: 77 }, { n: 11, name: "JT Thor", pos: "PF", rt: 76 },
  ]},
  { name: "Montenegro", season: "2023", c: "#C40308", alt: "#FFC72C", players: [
    { n: 9, name: "Nikola Vučević", pos: "C", rt: 88 }, { n: 11, name: "B. Dubljević", pos: "PF", rt: 81 },
    { n: 4, name: "N. Ivanović", pos: "PG", rt: 79 }, { n: 7, name: "D. Simonović", pos: "SG", rt: 77 },
    { n: 14, name: "M. Popović", pos: "SF", rt: 76 }, { n: 19, name: "M. Radončić", pos: "PF", rt: 75 },
  ]},
  { name: "Iran", season: "2014", c: "#239F40", alt: "#DA0000", players: [
    { n: 15, name: "Hamed Haddadi", pos: "C", rt: 87, trait: "greatWall", traitChance: 0.05 }, { n: 7, name: "S. Nikkhah Bahrami", pos: "SF", rt: 81 },
    { n: 5, name: "Mehdi Kamrani", pos: "PG", rt: 79 }, { n: 8, name: "O. Hassanzadeh", pos: "SG", rt: 77 },
    { n: 12, name: "A. Davari", pos: "PF", rt: 76 }, { n: 14, name: "A. Kazemi", pos: "PF", rt: 75 },
  ]},
  { name: "Georgia", season: "2023", c: "#FFFFFF", alt: "#FF0000", players: [
    { n: 23, name: "T. Shengelia", pos: "PF", rt: 87, trait: "mrImportant" }, { n: 4, name: "T. McFadden", pos: "SG", rt: 81 },
    { n: 8, name: "B. Bitadze", pos: "C", rt: 82 }, { n: 11, name: "S. Mamukelashvili", pos: "SF", rt: 78 },
    { n: 5, name: "T. Pkhakadze", pos: "PG", rt: 76 }, { n: 9, name: "G. Shermadini", pos: "C", rt: 80 },
  ]},
  { name: "Cape Verde", season: "2023", c: "#003893", alt: "#CF2027", players: [
    { n: 22, name: "Edy Tavares", pos: "C", rt: 88, trait: "greatWall" }, { n: 5, name: "I. Almeida", pos: "PG", rt: 78 },
    { n: 8, name: "W. Mendes", pos: "SF", rt: 77 }, { n: 11, name: "B. da Rosa", pos: "SG", rt: 76 },
    { n: 14, name: "K. Correia", pos: "PF", rt: 75 }, { n: 7, name: "P. Abreu", pos: "SG", rt: 74 },
  ]},
  { name: "Jordan", season: "2023", c: "#000000", alt: "#CE1126", players: [
    { n: 24, name: "R. Hollis-Jefferson", pos: "SF", rt: 84, trait: "chaosEnergy" }, { n: 9, name: "A. Tucker", pos: "SG", rt: 79 },
    { n: 5, name: "F. Alnajjar", pos: "PG", rt: 76 }, { n: 15, name: "A. Abu Hawwas", pos: "PF", rt: 76 },
    { n: 21, name: "A. Ibrahim", pos: "C", rt: 75 }, { n: 8, name: "Z. Al Dwairi", pos: "PF", rt: 74 },
  ]},
  { name: "Venezuela", season: "2019", c: "#FFCC00", alt: "#CF144C", players: [
    { n: 14, name: "G. Vásquez", pos: "PG", rt: 82 }, { n: 6, name: "J. Vargas", pos: "SG", rt: 79 },
    { n: 15, name: "N. Colmenares", pos: "PF", rt: 78 }, { n: 4, name: "G. Cox", pos: "SF", rt: 77 },
    { n: 12, name: "W. Guillen", pos: "C", rt: 76 }, { n: 8, name: "H. Carrera", pos: "SG", rt: 75 },
  ]},
  { name: "Mexico", season: "2014", c: "#006847", alt: "#CE1126", players: [
    { n: 14, name: "Gustavo Ayón", pos: "C", rt: 84, trait: "connector" }, { n: 9, name: "J. Gutiérrez", pos: "PG", rt: 79 },
    { n: 6, name: "O. Méndez", pos: "SG", rt: 77 }, { n: 15, name: "H. Hernández", pos: "PF", rt: 76 },
    { n: 5, name: "P. Stoll", pos: "SG", rt: 76 }, { n: 11, name: "I. Ramos", pos: "SF", rt: 75 },
  ]},
  { name: "Poland", season: "2019", c: "#FFFFFF", alt: "#DC143C", players: [
    { n: 5, name: "A. Waczyński", pos: "SG", rt: 81 }, { n: 3, name: "M. Ponitka", pos: "SF", rt: 82 },
    { n: 34, name: "A. Hrycaniuk", pos: "C", rt: 77 }, { n: 6, name: "Ł. Koszarek", pos: "PG", rt: 78 },
    { n: 9, name: "D. Slaughter", pos: "PF", rt: 79 }, { n: 15, name: "K. Kulig", pos: "PF", rt: 75 },
  ]},
  { name: "Senegal", season: "2019", c: "#00853F", alt: "#FDEF42", players: [
    { n: 14, name: "Gorgui Dieng", pos: "C", rt: 84 }, { n: 5, name: "M. Faye", pos: "SG", rt: 78 },
    { n: 8, name: "X. Rathan-Mayes", pos: "PG", rt: 79 }, { n: 12, name: "M. Ndoye", pos: "SF", rt: 76 },
    { n: 15, name: "Y. Ndoye", pos: "PF", rt: 77 }, { n: 7, name: "B. Dalmeida", pos: "SG", rt: 74 },
  ]},
  { name: "Lebanon", season: "2006", c: "#EE161F", alt: "#FFFFFF", players: [
    { n: 10, name: "Fadi El Khatib", pos: "SF", rt: 85, trait: "fibaLegend" }, { n: 4, name: "R. El Hindi", pos: "PG", rt: 77 },
    { n: 14, name: "J. Abdelnour", pos: "SG", rt: 76 }, { n: 12, name: "W. Fahed", pos: "C", rt: 78 },
    { n: 8, name: "A. Bawji", pos: "PF", rt: 75 }, { n: 6, name: "N. El Hage", pos: "SG", rt: 74 },
  ]},
  { name: "South Korea", season: "2014", c: "#0047A0", alt: "#CD2E3A", players: [
    { n: 10, name: "Moon Tae-jong", pos: "SF", rt: 80 }, { n: 6, name: "Kim Tae-sul", pos: "PG", rt: 78 },
    { n: 11, name: "Cho Sung-min", pos: "SG", rt: 77 }, { n: 15, name: "Kim Jong-kyu", pos: "C", rt: 78 },
    { n: 9, name: "Yang Dong-geun", pos: "SG", rt: 76 }, { n: 14, name: "Lee Seung-jun", pos: "PF", rt: 75 },
  ]},
  /* USA '06 — Japan WC bronze; LeBron / Wade / Melo / CP3 era before the Redeem Team */
  { name: "USA", season: "2006", c: "#B31942", alt: "#0A3161", players: [
    { n: 6, name: "LeBron James", pos: "SF", rt: 92, trait: "mrImportant" }, { n: 3, name: "Dwyane Wade", pos: "SG", rt: 91 },
    { n: 15, name: "Carmelo Anthony", pos: "PF", rt: 88, trait: "isoBlackHole" }, { n: 13, name: "Chris Paul", pos: "PG", rt: 86 },
    { n: 1, name: "Dwight Howard", pos: "C", rt: 87 }, { n: 4, name: "Chris Bosh", pos: "PF", rt: 85 },
  ]},
  /* --- complete 1986–2023 World Cup podiums (gold / silver / bronze) --- */
  { name: "USA", season: "1986", c: "#0A3161", alt: "#B31942", players: [
    { n: 11, name: "David Robinson", pos: "C", rt: 93, trait: "greatWall" }, { n: 7, name: "Kenny Smith", pos: "PG", rt: 86 },
    { n: 15, name: "Charles Smith", pos: "PF", rt: 83 }, { n: 14, name: "Armon Gilliam", pos: "PF", rt: 82 },
    { n: 8, name: "Sean Elliott", pos: "SF", rt: 82 }, { n: 6, name: "Steve Kerr", pos: "SG", rt: 78 },
  ]},
  { name: "Yugoslavia", season: "1986", c: "#1B4A9C", players: [
    { n: 4, name: "Dražen Petrović", pos: "SG", rt: 93, trait: "fibaLegend" }, { n: 12, name: "Vlade Divac", pos: "C", rt: 86 },
    { n: 14, name: "Dino Rađa", pos: "PF", rt: 85 }, { n: 10, name: "Zoran Čutura", pos: "SF", rt: 80 },
    { n: 5, name: "Zoran Radović", pos: "PG", rt: 78 }, { n: 15, name: "S. Vranković", pos: "C", rt: 79 },
  ]},
  { name: "Soviet Union", season: "1990", c: "#CC0000", alt: "#D4AF37", players: [
    { n: 9, name: "A. Volkov", pos: "PF", rt: 87, trait: "mrImportant", traitChance: 0.10 }, { n: 7, name: "V. Tikhonenko", pos: "SF", rt: 85 },
    { n: 5, name: "S. Bazarevich", pos: "PG", rt: 84 }, { n: 10, name: "G. Vetra", pos: "SG", rt: 81 },
    { n: 14, name: "V. Goborov", pos: "C", rt: 80 }, { n: 8, name: "V. Berezhnoy", pos: "PF", rt: 77 },
  ]},
  { name: "USA", season: "1990", c: "#B31942", alt: "#0A3161", players: [
    { n: 15, name: "Alonzo Mourning", pos: "C", rt: 88, trait: "hotHead", traitChance: 0.05 }, { n: 9, name: "Kenny Anderson", pos: "PG", rt: 84 },
    { n: 14, name: "Billy Owens", pos: "SF", rt: 83 }, { n: 11, name: "Todd Day", pos: "SG", rt: 80 },
    { n: 12, name: "Chris Gatling", pos: "PF", rt: 79 }, { n: 6, name: "Lee Mayberry", pos: "PG", rt: 77 },
  ]},
  { name: "Russia", season: "1994", c: "#0039A6", alt: "#D52B1E", players: [
    { n: 9, name: "S. Bazarevich", pos: "PG", rt: 86, trait: "connector" }, { n: 10, name: "S. Babkov", pos: "SG", rt: 84 },
    { n: 14, name: "Sergey Panov", pos: "SF", rt: 81 }, { n: 11, name: "M. Mikhaylov", pos: "C", rt: 80 },
    { n: 7, name: "A. Fetisov", pos: "PF", rt: 79 }, { n: 15, name: "Vitaly Nosov", pos: "C", rt: 77 },
  ]},
  { name: "Yugoslavia", season: "1998", c: "#C6363C", alt: "#2F5FBF", players: [
    { n: 5, name: "D. Bodiroga", pos: "SF", rt: 92, trait: "mrImportant" }, { n: 10, name: "A. Đorđević", pos: "PG", rt: 86, trait: "flameThrower" },
    { n: 14, name: "P. Danilović", pos: "SG", rt: 84 }, { n: 11, name: "Ž. Rebrača", pos: "C", rt: 87 },
    { n: 12, name: "Vlade Divac", pos: "PF", rt: 85 }, { n: 6, name: "S. Obradović", pos: "SG", rt: 81 },
  ]},
  { name: "Russia", season: "1998", c: "#D52B1E", alt: "#0039A6", players: [
    { n: 10, name: "S. Babkov", pos: "SG", rt: 86, trait: "flameThrower" }, { n: 14, name: "Sergey Panov", pos: "SF", rt: 82 },
    { n: 5, name: "Igor Kudelin", pos: "PG", rt: 81 }, { n: 11, name: "M. Mikhaylov", pos: "C", rt: 80 },
    { n: 9, name: "V. Tikhonenko", pos: "PF", rt: 79 }, { n: 6, name: "Z. Pashutin", pos: "SG", rt: 76 },
  ]},
  { name: "USA", season: "1998", c: "#0A3161", alt: "#B31942", players: [
    { n: 4, name: "Wendell Alexis", pos: "SF", rt: 82 }, { n: 11, name: "Trajan Langdon", pos: "SG", rt: 80 },
    { n: 15, name: "Brad Miller", pos: "C", rt: 81, stretch: true }, { n: 7, name: "Jimmy King", pos: "PG", rt: 77 },
    { n: 9, name: "Gerard King", pos: "PF", rt: 78 }, { n: 12, name: "Jason Sasser", pos: "SF", rt: 76 },
  ]},
];

/* 1992 Olympic "Dream Team" — scraped from Wikipedia roster; bonus opponent only */
export const DREAM_TEAM_ROUND = "FACE THE DREAM TEAM";
export const DREAM_TEAM = {
  name: "DREAM TEAM",
  season: "1992",
  c: "#B31942",
  alt: "#FFD700",
  players: [
    { n: 14, name: "Magic Johnson", pos: "PG", rt: 97 },
    { n: 9, name: "Michael Jordan", pos: "SG", rt: 99, trait: "fibaLegend" },
    { n: 8, name: "Scottie Pippen", pos: "SF", rt: 96 },
    { n: 4, name: "Charles Barkley", pos: "PF", rt: 96 },
    { n: 5, name: "David Robinson", pos: "C", rt: 96 },
    { n: 7, name: "Larry Bird", pos: "SF", rt: 97 },
  ],
};

export const OPPONENTS = [...TEAMS, DREAM_TEAM];
export const isDreamGame = (g) => g.round === DREAM_TEAM_ROUND;

export const SLOTS = ["PG", "SG", "SF", "PF", "C"];
export const STYLES = [
  { id: "run", label: "RUN & GUN", desc: "Fast pace, big scores — both ways",
    tip: "Great for guards — push the tempo, hunt transition buckets, live with the open rim",
    off: 6, def: -4, pace: 14 },
  { id: "bal", label: "BALANCED", desc: "Steady on both ends",
    tip: "No extremes — steady offense and defense, fits any five you roll",
    off: 0, def: 0, pace: 0 },
  { id: "lock", label: "LOCKDOWN", desc: "Slow it down, strangle them",
    tip: "Built for bigs — grind the pace, wall off the paint, win ugly",
    off: -3, def: 6, pace: -12 },
];
export const ROUNDS = ["GROUP GAME 1", "GROUP GAME 2", "GROUP GAME 3", "2ND ROUND — GAME 1", "2ND ROUND — GAME 2", "QUARTERFINAL", "SEMIFINAL", "THE FINAL"];

export const TEAM_INDEX = Object.fromEntries(OPPONENTS.map((t, i) => [`${t.name}|${t.season}`, i]));

export function teamRating(team) {
  return team.players.slice(0, 5).reduce((s, p) => s + p.rt, 0) / 5;
}

export function resolveTeamRef(ref) {
  if (!ref?.name || !ref?.season) return null;
  if (ref.name === DREAM_TEAM.name && ref.season === DREAM_TEAM.season) return DREAM_TEAM;
  return TEAMS.find((t) => t.name === ref.name && t.season === ref.season) || null;
}

export function nationSlug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function nationsFromTeams(teams = TEAMS) {
  const map = new Map();
  for (const t of teams) {
    if (!map.has(t.name)) map.set(t.name, []);
    map.get(t.name).push(t);
  }
  return [...map.entries()]
    .map(([name, squads]) => ({
      name,
      slug: nationSlug(name),
      c: squads[0].c,
      alt: squads[0].alt,
      squads: [...squads].sort((a, b) => Number(b.season) - Number(a.season)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const NATIONS_ARCHIVE = nationsFromTeams();
export const ARCHIVE_STATS = {
  nations: NATIONS_ARCHIVE.length,
  squads: TEAMS.length,
  players: TEAMS.reduce((s, t) => s + t.players.length, 0),
  traits: TEAMS.reduce((s, t) => s + t.players.filter((p) => p.trait || p.traits?.length).length, 0),
  years: (() => {
    const ys = [...new Set(TEAMS.map((t) => t.season))].sort();
    return { first: ys[0], last: ys[ys.length - 1], count: ys.length };
  })(),
};
