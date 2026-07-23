import React, { useState, useMemo, useRef, useEffect } from "react";

/* ============ DATA: legendary FIBA World Cup national squads ============ */
const TEAMS = [
  { name: "USA", season: "1994", c: "#B31942", alt: "#0A3161", players: [
    { n: 13, name: "Shaquille O'Neal", pos: "C", rt: 95, trait: "hackAShaq" }, { n: 5, name: "Reggie Miller", pos: "SG", rt: 89 },
    { n: 6, name: "Shawn Kemp", pos: "PF", rt: 89 }, { n: 7, name: "Kevin Johnson", pos: "PG", rt: 87 },
    { n: 9, name: "D. Wilkins", pos: "SF", rt: 88 }, { n: 11, name: "A. Mourning", pos: "PF", rt: 88 },
  ]},
  { name: "USA", season: "2010", c: "#0A3161", players: [
    { n: 5, name: "Kevin Durant", pos: "SF", rt: 94 }, { n: 6, name: "Derrick Rose", pos: "PG", rt: 88, trait: "glassKnee" },
    { n: 7, name: "R. Westbrook", pos: "SG", rt: 86 }, { n: 4, name: "C. Billups", pos: "SG", rt: 83 },
    { n: 10, name: "A. Iguodala", pos: "SF", rt: 82 }, { n: 15, name: "L. Odom", pos: "PF", rt: 81 }, { n: 11, name: "K. Love", pos: "C", rt: 82 },
  ]},
  { name: "USA", season: "2014", c: "#B31942", alt: "#0A3161", players: [
    { n: 4, name: "Stephen Curry", pos: "PG", rt: 92, trait: "flameThrower" }, { n: 13, name: "James Harden", pos: "SG", rt: 90, trait: "playoffFade" },
    { n: 10, name: "Kyrie Irving", pos: "SG", rt: 89 }, { n: 14, name: "Anthony Davis", pos: "PF", rt: 88 },
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
    { n: 13, name: "Marc Gasol", pos: "C", rt: 79 }, { n: 10, name: "Rudy Fernández", pos: "SF", rt: 80 },
  ]},
  { name: "Spain", season: "2019", c: "#F1BF00", players: [
    { n: 9, name: "Ricky Rubio", pos: "PG", rt: 88 }, { n: 13, name: "Marc Gasol", pos: "C", rt: 86 },
    { n: 5, name: "Rudy Fernández", pos: "SF", rt: 80 }, { n: 23, name: "Sergio Llull", pos: "SG", rt: 81 },
    { n: 41, name: "J. Hernangómez", pos: "PF", rt: 79 }, { n: 14, name: "W. Hernangómez", pos: "PF", rt: 78 },
  ]},
  { name: "Germany", season: "2023", c: "#DD0000", alt: "#FFCE00", players: [
    { n: 17, name: "D. Schröder", pos: "PG", rt: 89 }, { n: 22, name: "Franz Wagner", pos: "SF", rt: 87 },
    { n: 10, name: "Daniel Theis", pos: "C", rt: 81 }, { n: 13, name: "Moritz Wagner", pos: "PF", rt: 80 },
    { n: 7, name: "J. Voigtmann", pos: "PF", rt: 78 }, { n: 32, name: "Andreas Obst", pos: "SG", rt: 79 },
  ]},
  { name: "Germany", season: "2002", c: "#1a1a1a", alt: "#C9CED6", players: [
    { n: 14, name: "Dirk Nowitzki", pos: "PF", rt: 94, trait: "unicorn" }, { n: 6, name: "A. Femerling", pos: "C", rt: 78 },
    { n: 5, name: "M. Okulaja", pos: "SF", rt: 79 }, { n: 10, name: "S. Hamann", pos: "PG", rt: 76 },
    { n: 7, name: "R. Garrett", pos: "SG", rt: 77 }, { n: 12, name: "P. Femerling", pos: "PF", rt: 75 },
  ]},
  { name: "Serbia", season: "2014", c: "#C6363C", alt: "#1F4E9C", players: [
    { n: 4, name: "Miloš Teodosić", pos: "PG", rt: 88, trait: "goesMissing" }, { n: 7, name: "B. Bogdanović", pos: "SG", rt: 85 },
    { n: 10, name: "N. Bjelica", pos: "PF", rt: 82 }, { n: 9, name: "S. Marković", pos: "SG", rt: 79 },
    { n: 13, name: "M. Raduljica", pos: "C", rt: 79 }, { n: 8, name: "N. Kalinić", pos: "SF", rt: 79 },
  ]},
  { name: "Greece", season: "2006", c: "#0D5EAF", players: [
    { n: 4, name: "T. Papaloukas", pos: "PG", rt: 88 }, { n: 13, name: "D. Diamantidis", pos: "SG", rt: 88 },
    { n: 7, name: "V. Spanoulis", pos: "SG", rt: 87 }, { n: 12, name: "S. Schortsanitis", pos: "C", rt: 83 },
    { n: 11, name: "A. Fotsis", pos: "PF", rt: 80 }, { n: 14, name: "M. Kakiouzis", pos: "SF", rt: 79 },
  ]},
  { name: "Lithuania", season: "2010", c: "#046A38", players: [
    { n: 11, name: "Linas Kleiza", pos: "SF", rt: 85 }, { n: 13, name: "D. Songaila", pos: "PF", rt: 80 },
    { n: 5, name: "M. Kalnietis", pos: "PG", rt: 79 }, { n: 17, name: "J. Valančiūnas", pos: "C", rt: 78 },
    { n: 15, name: "R. Javtokas", pos: "PF", rt: 78 }, { n: 8, name: "R. Seibutis", pos: "SG", rt: 76 },
  ]},
  { name: "France", season: "2019", c: "#002395", players: [
    { n: 27, name: "Rudy Gobert", pos: "C", rt: 88, trait: "foulTrouble" }, { n: 10, name: "E. Fournier", pos: "SG", rt: 85 },
    { n: 12, name: "Nando De Colo", pos: "PG", rt: 84 }, { n: 5, name: "Nicolas Batum", pos: "SF", rt: 83 },
    { n: 21, name: "A. Albicy", pos: "SG", rt: 77 }, { n: 15, name: "A. M'Baye", pos: "PF", rt: 76 },
  ]},
  { name: "Croatia", season: "1994", c: "#FF0000", alt: "#0F3C8C", players: [
    { n: 7, name: "Toni Kukoč", pos: "SF", rt: 91 }, { n: 11, name: "Dino Rađa", pos: "PF", rt: 88 },
    { n: 10, name: "A. Komazec", pos: "SG", rt: 82 }, { n: 9, name: "V. Perasović", pos: "SF", rt: 81 },
    { n: 15, name: "S. Vranković", pos: "C", rt: 80 }, { n: 5, name: "V. Šretl", pos: "PG", rt: 75 },
  ]},
  { name: "Slovenia", season: "2023", c: "#00A94F", players: [
    { n: 77, name: "Luka Dončić", pos: "PG", rt: 96, trait: "heroBall" }, { n: 6, name: "A. Tobey", pos: "C", rt: 79 },
    { n: 3, name: "K. Prepelič", pos: "SG", rt: 79 }, { n: 31, name: "V. Čančar", pos: "PF", rt: 78 },
    { n: 11, name: "J. Blažič", pos: "SF", rt: 76 }, { n: 30, name: "Z. Dragić", pos: "SG", rt: 75 },
  ]},
  { name: "Australia", season: "2019", c: "#00843D", players: [
    { n: 5, name: "Patty Mills", pos: "PG", rt: 87 }, { n: 7, name: "Joe Ingles", pos: "SF", rt: 82 },
    { n: 12, name: "Aron Baynes", pos: "C", rt: 79 }, { n: 43, name: "C. Goulding", pos: "SG", rt: 77 },
    { n: 34, name: "Jock Landale", pos: "PF", rt: 77 }, { n: 11, name: "N. Kay", pos: "PF", rt: 75 },
  ]},
  { name: "Canada", season: "2023", c: "#D80621", alt: "#2C3E50", players: [
    { n: 2, name: "S. Gilgeous-Alexander", pos: "PG", rt: 93 }, { n: 24, name: "Dillon Brooks", pos: "SF", rt: 82 },
    { n: 9, name: "RJ Barrett", pos: "SG", rt: 81 }, { n: 13, name: "Kelly Olynyk", pos: "C", rt: 80 },
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
    { n: 9, name: "Tony Parker", pos: "PG", rt: 90 }, { n: 8, name: "Boris Diaw", pos: "PF", rt: 83 },
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
    { n: 34, name: "Jock Landale", pos: "C", rt: 80 }, { n: 6, name: "Josh Green", pos: "SF", rt: 78 },
    { n: 7, name: "Dante Exum", pos: "SG", rt: 78 }, { n: 9, name: "X. Cooks", pos: "PF", rt: 76 },
  ]},
  { name: "Brazil", season: "2010", c: "#FFDF00", players: [
    { n: 12, name: "Nenê", pos: "C", rt: 85 }, { n: 6, name: "Leandro Barbosa", pos: "SG", rt: 84 },
    { n: 11, name: "Anderson Varejão", pos: "PF", rt: 83 }, { n: 9, name: "Marcelo Huertas", pos: "PG", rt: 79 },
    { n: 8, name: "Alex Garcia", pos: "SF", rt: 78 }, { n: 4, name: "Marcelinho Machado", pos: "SG", rt: 77 },
  ]},
  { name: "China", season: "2019", c: "#DE2910", alt: "#FFD700", players: [
    { n: 11, name: "Yi Jianlian", pos: "PF", rt: 82 }, { n: 6, name: "Guo Ailun", pos: "PG", rt: 78 },
    { n: 15, name: "Zhou Qi", pos: "C", rt: 77 }, { n: 9, name: "Zhao Rui", pos: "SG", rt: 76 },
    { n: 12, name: "Ding Yanyuhang", pos: "SF", rt: 77 }, { n: 5, name: "Fang Shuo", pos: "SG", rt: 74 },
  ]},
  /* --- expansion: Europe depth + Africa / Asia / Oceania coverage --- */
  { name: "Italy", season: "2006", c: "#009246", alt: "#CE2B37", players: [
    { n: 7, name: "Gianluca Basile", pos: "SG", rt: 85, trait: "flameThrower" }, { n: 5, name: "G. Pozzecco", pos: "PG", rt: 80 },
    { n: 12, name: "M. Mordente", pos: "SF", rt: 78 }, { n: 14, name: "Denis Marconato", pos: "C", rt: 81 },
    { n: 15, name: "L. Garri", pos: "PF", rt: 77 }, { n: 8, name: "M. Soragna", pos: "SG", rt: 76 },
  ]},
  { name: "Turkey", season: "2010", c: "#E30A17", players: [
    { n: 6, name: "Hidayet Türkoğlu", pos: "SF", rt: 87, trait: "mrImportant" }, { n: 7, name: "Ömer Aşık", pos: "C", rt: 82 },
    { n: 23, name: "E. İlyasova", pos: "PF", rt: 82 }, { n: 4, name: "Kerem Tunçeri", pos: "PG", rt: 79 },
    { n: 10, name: "Ömer Onan", pos: "SG", rt: 78 }, { n: 12, name: "Semih Erden", pos: "PF", rt: 77 },
  ]},
  { name: "Russia", season: "2010", c: "#0039A6", alt: "#D52B1E", players: [
    { n: 47, name: "A. Kirilenko", pos: "SF", rt: 89, trait: "ak47" }, { n: 15, name: "V. Khryapa", pos: "PF", rt: 82 },
    { n: 11, name: "Timofey Mozgov", pos: "C", rt: 80 }, { n: 4, name: "A. Bykov", pos: "PG", rt: 78 },
    { n: 8, name: "V. Fridzon", pos: "SG", rt: 79 }, { n: 10, name: "S. Monia", pos: "SF", rt: 76 },
  ]},
  { name: "Latvia", season: "2023", c: "#9E3039", alt: "#FFFFFF", players: [
    { n: 6, name: "K. Porziņģis", pos: "C", rt: 90, trait: "theTower" }, { n: 42, name: "Dāvis Bertāns", pos: "SF", rt: 81 },
    { n: 8, name: "Dairis Bertāns", pos: "SG", rt: 78 }, { n: 13, name: "A. Žagars", pos: "PG", rt: 79 },
    { n: 24, name: "A. Gražulis", pos: "PF", rt: 78 }, { n: 0, name: "R. Kurucs", pos: "SF", rt: 76 },
  ]},
  { name: "Czechia", season: "2019", c: "#11457E", alt: "#D7141A", players: [
    { n: 8, name: "T. Satoranský", pos: "PG", rt: 84, trait: "connector" }, { n: 24, name: "Jan Veselý", pos: "C", rt: 83 },
    { n: 11, name: "Blake Schilb", pos: "SF", rt: 79 }, { n: 17, name: "J. Welsch", pos: "SG", rt: 76 },
    { n: 12, name: "O. Balvín", pos: "PF", rt: 77 }, { n: 7, name: "Vít Krejčí", pos: "SG", rt: 75 },
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
];

/* 1992 Olympic "Dream Team" — scraped from Wikipedia roster; bonus opponent only */
const DREAM_TEAM_ROUND = "FACE THE DREAM TEAM";
const DREAM_TEAM = {
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

const OPPONENTS = [...TEAMS, DREAM_TEAM];
const isDreamGame = (g) => g.round === DREAM_TEAM_ROUND;

const SLOTS = ["PG", "SG", "SF", "PF", "C"];
const STYLES = [
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
const ROUNDS = ["GROUP GAME 1", "GROUP GAME 2", "GROUP GAME 3", "2ND ROUND — GAME 1", "2ND ROUND — GAME 2", "QUARTERFINAL", "SEMIFINAL", "THE FINAL"];

const TEAM_INDEX = Object.fromEntries(OPPONENTS.map((t, i) => [`${t.name}|${t.season}`, i]));

function lineupPlayerRef(lineup, slot) {
  const p = lineup[slot];
  if (!p) return null;
  const ti = TEAM_INDEX[`${p.team}|${p.season}`];
  if (ti == null) return null;
  const pi = TEAMS[ti].players.findIndex((pl) => pl.name === p.name && pl.n === p.n);
  return pi >= 0 ? [ti, pi] : null;
}

function encodeRunShare({ rolls, groupOut, r2Out, lineup, games }) {
  const payload = {
    v: 1,
    r: rolls,
    g: groupOut ? 1 : 0,
    x: r2Out ? 1 : 0,
    l: SLOTS.map((s) => lineupPlayerRef(lineup, s)),
    m: games.map((g) => {
      const oi = TEAM_INDEX[`${g.opp.name}|${g.opp.season}`];
      const box = SLOTS.map((s) => g.box?.find((b) => b.name === lineup[s]?.name && b.n === lineup[s]?.n)?.pts ?? 0);
      return [g.my, g.op, oi, ...box];
    }),
  };
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${window.location.pathname}?card=${b64}`;
}

function decodeRunShare(search) {
  const raw = new URLSearchParams(search).get("card");
  if (!raw) return null;
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(padded)));
    const p = JSON.parse(json);
    if (p.v !== 1 || !Array.isArray(p.l) || !Array.isArray(p.m) || !p.m.length) return null;

    const lineup = {};
    p.l.forEach((entry, slotIdx) => {
      if (!entry) return;
      const [ti, pi] = entry;
      const team = TEAMS[ti];
      const player = team?.players[pi];
      const slot = SLOTS[slotIdx];
      if (!team || !player || player.pos !== slot) return;
      lineup[slot] = { ...player, team: team.name, season: team.season, tc: team.c };
    });
    if (SLOTS.some((s) => !lineup[s])) return null;

    const games = p.m.map((row, i) => {
      const [my, op, oi, ...boxPts] = row;
      const opp = OPPONENTS[oi];
      if (!opp) return null;
      const box = SLOTS.map((s, j) => {
        const pl = lineup[s];
        return pl ? { name: pl.name, n: pl.n, pts: boxPts[j] ?? 0 } : null;
      }).filter(Boolean);
      return {
        my, op, opp,
        round: ROUNDS[i] || (oi >= TEAMS.length ? DREAM_TEAM_ROUND : ROUNDS[ROUNDS.length - 1]),
        box,
      };
    }).filter(Boolean);
    if (!games.length) return null;

    return {
      lineup,
      games,
      rolls: p.r ?? 0,
      groupOut: !!p.g,
      r2Out: !!p.x,
      gi: games.length,
    };
  } catch {
    return null;
  }
}

function readShareFromUrl() {
  if (typeof window === "undefined") return null;
  return decodeRunShare(window.location.search);
}

const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

/* 2K-style rating gem tiers */
const tier = (rt) =>
  rt >= 95 ? { bg: "linear-gradient(160deg,#ffd1f4,#f368e0 60%,#c93bbf)", fg: "#3c0836", name: "PINK DIAMOND" } :
  rt >= 90 ? { bg: "linear-gradient(160deg,#d9fbff,#67e8f9 55%,#22b8d4)", fg: "#083a44", name: "DIAMOND" } :
  rt >= 87 ? { bg: "linear-gradient(160deg,#e5d4ff,#a78bfa 55%,#7c3aed)", fg: "#2a0a54", name: "AMETHYST" } :
  rt >= 84 ? { bg: "linear-gradient(160deg,#ffc9c9,#f87171 55%,#dc2626)", fg: "#450a0a", name: "RUBY" } :
  rt >= 81 ? { bg: "linear-gradient(160deg,#c7ddff,#60a5fa 55%,#2563eb)", fg: "#0a1e45", name: "SAPPHIRE" } :
  rt >= 78 ? { bg: "linear-gradient(160deg,#c9f7d4,#4ade80 55%,#16a34a)", fg: "#052e13", name: "EMERALD" } :
             { bg: "linear-gradient(160deg,#fbe8b3,#facc15 55%,#ca8a04)", fg: "#3b2a03", name: "GOLD" };


/* ============ SIMULATION ============ */
function teamRating(team) { return team.players.slice(0, 5).reduce((s, p) => s + p.rt, 0) / 5; }

function simGame(myRt, style, opp, roundIdx) {
  const oppRt = teamRating(opp) - 4 + Math.random() * 4 + roundIdx * 0.8;
  const base = 86 + style.pace;
  const diff = (myRt + style.off - oppRt) * 1.15;
  const noise = () => (Math.random() - 0.5) * 22;
  let my = Math.round(base + diff / 2 + style.off + noise());
  let op = Math.round(base - diff / 2 - style.def + noise());
  my = Math.max(58, my); op = Math.max(58, op);
  return { my, op, opp, myQ: splitQ(my), opQ: splitQ(op) };
}

/* FIBA overtime: 5 minutes per period until someone leads */
function simOvertimePeriod(myRt, style, oppRt) {
  const diff = (myRt + style.off - oppRt) * 0.7;
  const noise = () => (Math.random() - 0.5) * 10;
  const myOT = Math.max(0, Math.round(11 + diff / 4 + noise()));
  const opOT = Math.max(0, Math.round(11 - diff / 4 + noise()));
  return { myOT, opOT };
}

function resolveOvertime(my, op, myRt, style, oppRt) {
  const otMy = [];
  const otOp = [];
  let periods = 0;
  while (my === op && periods < 8) {
    periods++;
    const { myOT, opOT } = simOvertimePeriod(myRt, style, oppRt);
    otMy.push(myOT);
    otOp.push(opOT);
    my += myOT;
    op += opOT;
  }
  if (my === op) my += Math.random() > 0.5 ? 2 : 1; // safety after 8 OTs
  return { my, op, otMy, otOp, otPeriods: periods };
}

const splitQ = (tot) => {
  let qs = [0, 0, 0, 0].map(() => 0.2 + Math.random());
  const s = qs.reduce((a, b) => a + b, 0);
  qs = qs.map((q) => Math.round((q / s) * tot));
  qs[3] += tot - qs.reduce((a, b) => a + b, 0);
  return qs;
};

const qSum = (qs) => qs.reduce((a, b) => a + b, 0);
const QN = ["Q1", "Q2", "Q3", "Q4"];

/* shift pts into/out of specific quarters; total score changes by delta sum */
function patchQ(qs, patches) {
  const out = [...qs];
  patches.forEach(({ q, d }) => { out[q] = Math.max(0, out[q] + d); });
  return out;
}

const TRAIT_DEFS = {
  hackAShaq: {
    label: "HACK-A-SHAQ", pos: false, chance: 0.30,
    desc: "Fouled at the line late when ahead",
    recapNeg: [
      "{player} was hacked relentlessly late — the free-throw parade cost you.",
      "With the lead in hand, {player} couldn't stay on the floor — intentional fouls bled the clock and the score.",
    ],
  },
  playoffFade: {
    label: "PLAYOFF FADE", pos: false, chance: 0.45,
    desc: "Fades as knockouts wear on",
    recapNeg: [
      "{player} went cold down the stretch when it mattered most.",
      "The deeper the tournament got, the more {player} disappeared from the offense.",
    ],
  },
  heroBall: {
    label: "HERO BALL", pos: false, chance: 0.15,
    desc: "Forced midgame shots in tight losses",
    recapNeg: [
      "{player} forced the action in the third and the shots wouldn't fall.",
      "With the game on a knife's edge, {player} went iso-heavy — and paid for it.",
    ],
  },
  goesMissing: {
    label: "GOES MISSING", pos: false, chance: 0.10,
    desc: "Vanishes for a full quarter",
    recapNeg: [
      "{player} vanished in the {qn} quarter and never got going again.",
      "For one entire quarter, {player} was a ghost — no rhythm, no impact.",
    ],
  },
  foulTrouble: {
    label: "FOUL TROUBLE", pos: false, chance: 0.12,
    desc: "Sits midgame with early fouls",
    recapNeg: [
      "{player} picked up fouls early and spent most of the middle quarters on the bench.",
      "Foul trouble had {player} riding the pine through the {qn} and third — your spacing never recovered.",
    ],
  },
  chaosEnergy: {
    label: "CHAOS ENERGY", pos: true, chance: 0.12,
    desc: "Midgame Euro-step burst",
    recapPos: [
      "{player} flipped the game with a chaotic third-quarter burst — Euro-steps, and-ones, pure mayhem.",
      "Out of nowhere, {player} turned the third into a highlight reel and the lead swung.",
    ],
  },
  fibaLegend: {
    label: "FIBA LEGEND", pos: true, chance: 0.15,
    desc: "Sets the tone in Q1",
    recapPos: [
      "{player} set the tone from the opening tip — a first quarter that put {oppN} on their heels.",
    ],
  },
  unicorn: {
    label: "UNICORN", pos: true, chance: 0.18,
    desc: "Stretch spacing in the middle quarters",
    recapPos: [
      "{player} stretched the floor in the middle quarters — impossible to guard at that size.",
      "The unicorn spacing from {player} opened everything up in the second and third.",
    ],
  },
  pointGame42: {
    label: "42-POINT GAME", pos: true, chance: 0.15,
    desc: "Dominates weaker opponents",
    recapPos: [
      "{player} treated this one like a personal scoring record — buckets in every quarter.",
      "Against overmatched opposition, {player} was unstoppable from start to finish.",
    ],
  },
  goldMedalDna: {
    label: "GOLD MEDAL DNA", pos: true, chance: 0.12,
    desc: "Steady scoring every night",
    recapPos: [
      "{player} delivered the steady, winning production that championship teams need.",
    ],
  },
  flameThrower: {
    label: "FLAME THROWER", pos: true, chance: 0.10,
    desc: "Explosive random quarter",
    recapPos: [
      "{player} caught fire in the {qn} quarter — a solo burst that swung the whole game.",
      "One quarter, one player: {player} couldn't miss in the {qn} and the gym felt it.",
    ],
  },
  secondHalfBeast: {
    label: "SECOND HALF BEAST", pos: true, chance: 0.20,
    desc: "Rally when trailing at halftime",
    recapPos: [
      "{player} took over after halftime and dragged your five back into it.",
      "Down at the break, {player} flipped the script in the second half — pure force of will.",
    ],
  },
  elCapitan: {
    label: "EL CAPITÁN", pos: true, chance: 0.15,
    desc: "Clutch fourth quarter when game is close through three",
    recapPos: [
      "{player} took over in the fourth — veteran poise when the game hung in the balance.",
      "With everything on the line, {player} closed it out like a captain should.",
    ],
  },
  mrImportant: {
    label: "MR. IMPORTANT", pos: true, chance: 0.12,
    desc: "Late-game FIBA closer",
    recapPos: [
      "{player} did what he always does in FIBA — showed up when the lights got brightest.",
      "The fourth quarter belonged to {player} — cold-blooded, inevitable, Mr. Important.",
    ],
  },
  greatWall: {
    label: "GREAT WALL", pos: true, chance: 0.12,
    desc: "Early paint dominance",
    recapPos: [
      "{player} walled off the paint early — {oppN} had no answer inside in the first half.",
      "From the opening tip, {player} owned the rim — a Great Wall nobody could breach.",
    ],
  },
  ak47: {
    label: "AK-47", pos: true, chance: 0.15,
    desc: "Two-way lockdown midgame",
    recapPos: [
      "{player} did the AK-47 thing — blocks, help D, and quiet points that put {oppN} in a vice.",
      "Two-way hell: {player} erased the first half for {oppN} while still finding buckets himself.",
    ],
  },
  connector: {
    label: "THE CONNECTOR", pos: true, chance: 0.14,
    desc: "Glue-guy facilitation all game",
    recapPos: [
      "{player} never forced it — just connected every quarter and made the five look smarter.",
      "The Connector effect: {player} kept the offense humming from tip to horn.",
    ],
  },
  risingSun: {
    label: "RISING SUN", pos: true, chance: 0.14,
    desc: "Quiet midrange takeover in Q3",
    recapPos: [
      "{player} rose in the third with that quiet midrange — {oppN} had no answer.",
      "One silent storm in Q3: {player} kept rising until the lead flipped.",
    ],
  },
  theTower: {
    label: "THE TOWER", pos: true, chance: 0.16,
    desc: "Stretch-five punch early and late",
    recapPos: [
      "{player} was The Tower — paint early, stretch threes later, impossible size for {oppN}.",
      "From the rim to the arc, {player} owned the vertical game and cracked the defense open.",
    ],
  },
  glassKnee: {
    label: "GLASS KNEE", pos: false, chance: 0.12,
    desc: "Midgame breakdown from knee issues",
    recapNeg: [
      "{player} couldn't stay on the floor through the middle quarters — the knee just wasn't right.",
      "The burst was still there, but {player}'s knee gave out in the second and third — minutes evaporated.",
    ],
  },
  hotHead: {
    label: "HOT HEAD", pos: false, chance: 0.15,
    desc: "Technical foul derails the third quarter",
    recapNeg: [
      "{player} lost it in the third — a tech foul and the whole rhythm fell apart.",
      "One bad decision cost {player} in the third — ejection energy without the ejection, and the run died.",
    ],
  },
  flopCity: {
    label: "FLOP CITY", pos: false, chance: 0.18,
    desc: "Flopping kills midgame rhythm",
    recapNeg: [
      "{player} spent the middle quarters drawing whistles and killing the flow — nothing ever got in rhythm.",
      "Every drive ended at the ref's whistle — {player}'s flopping turned the second and third into stop-start chaos.",
    ],
  },
};

const SIGNIFICANT_TRAIT_DELTA = 5;
const rollTrait = (chance) => Math.random() < chance;

function applyLineupTraits(lineup, myQ, opQ, ctx) {
  const fired = [];
  const add = (player, id, q, delta, note) => {
    if (!delta) return;
    fired.push({ player: player.name, trait: id, label: TRAIT_DEFS[id].label, pos: TRAIT_DEFS[id].pos, q, delta, note });
  };

  let qs = [...myQ];
  let ops = [...opQ];
  const players = lineup.filter(Boolean);

  for (const p of players) {
    if (!p.trait || !TRAIT_DEFS[p.trait]) continue;
    const id = p.trait;
    const def = TRAIT_DEFS[id];

    if (id === "fibaLegend" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 0, d: 3 }]);
      add(p, id, 0, 3, "Opened hot in Q1");
    }
    if (id === "goldMedalDna" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 0, d: 2 }, { q: 2, d: 1 }]);
      add(p, id, 0, 3, "Steady +3 across the game");
    }
    if (id === "chaosEnergy" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 2, d: 6 }]);
      add(p, id, 2, 6, "Midgame chaos in Q3");
    }
    if (id === "flameThrower" && rollTrait(def.chance)) {
      const q = Math.floor(Math.random() * 4);
      qs = patchQ(qs, [{ q, d: 10 }]);
      add(p, id, q, 10, `Erupted in ${QN[q]}`);
    }
    if (id === "unicorn" && ctx.style.id === "bal" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 1, d: 3 }, { q: 2, d: 2 }]);
      add(p, id, 1, 5, "Unicorn spacing Q2–Q3");
    }
    if (id === "pointGame42" && ctx.myRt - ctx.oppRt >= 4 && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 0, d: 2 }, { q: 1, d: 2 }, { q: 2, d: 2 }, { q: 3, d: 1 }]);
      add(p, id, 0, 7, "Full-game dominance vs weaker foe");
    }
    if (id === "secondHalfBeast" && qs[0] + qs[1] < ops[0] + ops[1] && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 2, d: 3 }, { q: 3, d: 3 }]);
      add(p, id, 2, 6, "Second-half rally");
    }
    if (id === "playoffFade" && ctx.gi >= 5 && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 1, d: -2 }, { q: 2, d: -2 }, { q: 3, d: -3 }]);
      add(p, id, 2, -7, "Knockout fade Q2–Q4");
    }
    if (id === "foulTrouble" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 1, d: -3 }, { q: 2, d: -3 }]);
      add(p, id, 1, -6, "Foul trouble Q2–Q3");
    }
    if (id === "goesMissing" && rollTrait(def.chance)) {
      const q = Math.floor(Math.random() * 4);
      const lost = qs[q];
      if (lost > 0) {
        qs = patchQ(qs, [{ q, d: -lost }]);
        add(p, id, q, -lost, `No-show in ${QN[q]}`);
      }
    }
    if (id === "mrImportant" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 2, d: 4 }, { q: 3, d: 3 }]);
      add(p, id, 2, 7, "Mr. Important Q3–Q4");
    }
    if (id === "greatWall" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 0, d: 3 }, { q: 1, d: 3 }]);
      add(p, id, 0, 6, "Great Wall Q1–Q2");
    }
    if (id === "ak47" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 1, d: 3 }]);
      ops = patchQ(ops, [{ q: 0, d: -2 }, { q: 1, d: -2 }]);
      add(p, id, 1, 7, "AK-47 two-way Q1–Q2");
    }
    if (id === "connector" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 0, d: 1 }, { q: 1, d: 1 }, { q: 2, d: 1 }, { q: 3, d: 1 }]);
      add(p, id, 0, 4, "Connector glue all four");
    }
    if (id === "risingSun" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 2, d: 6 }]);
      add(p, id, 2, 6, "Rising Sun Q3");
    }
    if (id === "theTower" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 0, d: 3 }, { q: 2, d: 3 }]);
      add(p, id, 0, 6, "The Tower Q1 + Q3");
    }
    if (id === "glassKnee" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 1, d: -3 }, { q: 2, d: -3 }]);
      add(p, id, 1, -6, "Glass knee Q2–Q3");
    }
    if (id === "hotHead" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 2, d: -5 }]);
      add(p, id, 2, -5, "Hot head Q3");
    }
    if (id === "flopCity" && rollTrait(def.chance)) {
      qs = patchQ(qs, [{ q: 1, d: -3 }, { q: 2, d: -2 }]);
      add(p, id, 1, -5, "Flop city Q2–Q3");
    }
    if (id === "elCapitan") {
      const through3 = myQ[0] + myQ[1] + myQ[2];
      const opThrough3 = ops[0] + ops[1] + ops[2];
      if (Math.abs(through3 - opThrough3) <= 6 && rollTrait(def.chance)) {
        qs = patchQ(qs, [{ q: 3, d: 6 }]);
        add(p, id, 3, 6, "El Capitán Q4");
      }
    }
  }

  // conditional traits (need score state)
  let my = qSum(qs);
  let op = qSum(ops);

  for (const p of players) {
    if (p.trait === "hackAShaq" && my > op && rollTrait(TRAIT_DEFS.hackAShaq.chance)) {
      qs = patchQ(qs, [{ q: 2, d: -3 }, { q: 3, d: -3 }]);
      add(p, "hackAShaq", 3, -6, "Hack-a-Shaq at the line Q3–Q4");
      my = qSum(qs);
    }
  }

  my = qSum(qs);
  op = qSum(ops);
  if (my < op && op - my <= 5) {
    for (const p of players) {
      if (p.trait === "heroBall" && rollTrait(TRAIT_DEFS.heroBall.chance)) {
        qs = patchQ(qs, [{ q: 2, d: -5 }]);
        add(p, "heroBall", 2, -5, "Hero-ball Q3 in a tight loss");
        my = qSum(qs);
      }
    }
  }

  return { myQ: qs, opQ: ops, my, fired };
}

function simGameWithTraits(lineup, myRt, style, opp, gi, gamesPlayed) {
  const base = simGame(myRt, style, opp, gi);
  const ctx = { gi, style, myRt, oppRt: teamRating(opp), gamesPlayed };
  const { myQ, opQ, my, fired } = applyLineupTraits(lineup, base.myQ, base.opQ, ctx);
  let finalMy = my;
  let finalOp = qSum(opQ);
  const regMy = finalMy;
  const regOp = finalOp;
  let otMy = [];
  let otOp = [];
  let otPeriods = 0;
  if (finalMy === finalOp) {
    const ot = resolveOvertime(finalMy, finalOp, myRt, style, ctx.oppRt);
    finalMy = ot.my;
    finalOp = ot.op;
    otMy = ot.otMy;
    otOp = ot.otOp;
    otPeriods = ot.otPeriods;
  }
  return { ...base, my: finalMy, op: finalOp, myQ, opQ, regMy, regOp, otMy, otOp, otPeriods, traitFired: fired };
}

function boxScore(lineup, total) {
  const w = lineup.map((p) => Math.pow(p.rt - 65, 2) * (0.7 + Math.random() * 0.6));
  const s = w.reduce((a, b) => a + b, 0);
  const pts = w.map((x) => Math.round((x / s) * total * 0.86));
  return lineup.map((p, i) => ({ ...p, pts: pts[i] })).sort((a, b) => b.pts - a.pts);
}

/* ---- play-by-play generation for animated sims ---- */
const rndT = (a) => a[Math.floor(Math.random() * a.length)];

function buildEvents(g, box, opp) {
  const buckets = (total) => {
    const b = []; let t = total;
    while (t > 0) {
      let p = t >= 3 && Math.random() < 0.33 ? 3 : Math.min(2, t);
      if (p === 2 && Math.random() < 0.1) p = 1;
      b.push(p); t -= p;
    }
    return b;
  };
  const pickScorer = () => {
    const tot = box.reduce((s, p) => s + p.pts, 0) || 1;
    let r = Math.random() * tot;
    for (const p of box) { r -= p.pts; if (r <= 0) return p; }
    return box[0];
  };
  const oppName = `${opp.name} '${opp.season.slice(2)}`;
  const myText = (n, pts) =>
    pts === 3 ? rndT([`${n} splashes a triple!`, `${n} pulls up from deep — BANG!`, `${n} buries the corner three`]) :
    pts === 1 ? `${n} sinks the free throw` :
    rndT([`${n} finishes strong at the rim`, `${n} knocks down the mid-range`, `${n} spins baseline for two`, `${n} scores off the pick and roll`, `${n} beats his man off the dribble`]);
  const opText = (pts) =>
    pts === 3 ? rndT([`${oppName} answers from downtown`, `${oppName} hits a deep three`]) :
    pts === 1 ? `${oppName} converts at the line` :
    rndT([`${oppName} scores inside`, `${oppName} gets to the rim`, `${oppName} hits a tough jumper`]);
  const regMy = g.regMy ?? g.my;
  const regOp = g.regOp ?? g.op;
  const stamp = (e, sec) => {
    const q = Math.min(4, Math.floor(sec / 600) + 1);
    const rem = 600 - (sec % 600);
    const clock = sec < 2400
      ? `Q${q} ${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, "0")}`
      : (() => {
          const otSec = sec - 2400;
          const otNum = Math.floor(otSec / 300) + 1;
          const otRem = 300 - (otSec % 300);
          return `OT${otNum} ${Math.floor(otRem / 60)}:${String(otRem % 60).padStart(2, "0")}`;
        })();
    const text = e.team === "me" ? myText(pickScorer().name, e.pts) : opText(e.pts);
    return { ...e, sec, q: sec < 2400 ? q : 4 + Math.floor((sec - 2400) / 300), clock, text };
  };
  const regEvs = [
    ...buckets(regMy).map((p) => ({ team: "me", pts: p })),
    ...buckets(regOp).map((p) => ({ team: "op", pts: p })),
  ].map((e) => stamp(e, Math.floor(Math.random() * 2400)));
  const otEvs = (g.otMy || []).flatMap((myOT, i) => {
    const opOT = g.otOp[i];
    const base = 2400 + i * 300;
    return [
      ...buckets(myOT).map((p) => stamp({ team: "me", pts: p }, base + Math.floor(Math.random() * 300))),
      ...buckets(opOT).map((p) => stamp({ team: "op", pts: p }, base + Math.floor(Math.random() * 300))),
    ];
  });
  return [...regEvs, ...otEvs].sort((a, b) => a.sec - b.sec);
}

function chunkEvents(evs, n) {
  const per = Math.max(1, Math.ceil(evs.length / n));
  const steps = [];
  for (let i = 0; i < evs.length; i += per) {
    const grp = evs.slice(i, i + per);
    const last = grp[grp.length - 1];
    steps.push({
      dMy: grp.reduce((s, e) => s + (e.team === "me" ? e.pts : 0), 0),
      dOp: grp.reduce((s, e) => s + (e.team === "op" ? e.pts : 0), 0),
      q: last.q, clock: last.clock, text: last.text, team: last.team,
    });
  }
  return steps;
}

/* Your five is always red — keep opponents visually distinct from it.
   If a nation's color is reddish (or too dark), swap in a contrasting accent. */
const OPP_FALLBACKS = ["#23b4e2", "#f5a524", "#8b5cf6", "#22c55e"];
const oppColor = (team) => {
  if (team.alt) return team.alt;               // curated jersey-accurate contrast color
  const hex = team.c.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hue = 0;
  if (d) {
    if (max === r) hue = 60 * (((g - b) / d) % 6);
    else if (max === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
  }
  if (hue < 0) hue += 360;
  const redHue = d > 0.15 && (hue < 22 || hue > 338); // never let an opponent read as YOUR FIVE's red
  const tooDark = max < 0.28;
  if (!redHue && !tooDark) return team.c;
  const i = (team.name.length + team.season.charCodeAt(3)) % OPP_FALLBACKS.length;
  return OPP_FALLBACKS[i];
};

/* ---- scoring development (cumulative margin, stepped) ---- */
function buildFlow(evs) {
  let my = 0, op = 0;
  const pts = [{ sec: 0, m: 0 }];
  for (const e of evs) {
    if (e.team === "me") my += e.pts;
    else op += e.pts;
    const last = pts[pts.length - 1];
    if (last.sec === e.sec) last.m = my - op;
    else pts.push({ sec: e.sec, m: my - op });
  }
  const endSec = Math.max(2400, pts[pts.length - 1]?.sec || 0);
  if (pts[pts.length - 1].sec < endSec) pts.push({ sec: endSec, m: pts[pts.length - 1].m });
  return pts;
}

function marginAt(flow, sec) {
  let m = 0;
  for (const p of flow) {
    if (p.sec <= sec) m = p.m;
    else break;
  }
  return m;
}

function traitMarkerCopy(t, oppN) {
  const def = TRAIT_DEFS[t.trait];
  const pool = t.pos ? def?.recapPos : def?.recapNeg;
  const qn = ["first", "second", "third", "fourth"][t.q] || "late";
  const story = (pool?.[0] || t.note || def?.desc || "")
    .replaceAll("{player}", t.player)
    .replaceAll("{qn}", qn)
    .replaceAll("{oppN}", oppN);
  return {
    title: t.label,
    sub: `${t.player} · ${QN[t.q] || "OT"}`,
    body: story,
  };
}

function scoreDevSegments(flow, x, y, myC, oc) {
  const segs = [];
  let d = "", color = null;
  const flush = () => { if (d && color) segs.push({ d, color }); d = ""; };
  const col = (m, fallback) => (m > 0 ? myC : m < 0 ? oc : fallback);
  for (let i = 0; i < flow.length - 1; i++) {
    const a = flow[i], b = flow[i + 1];
    const x0 = x(a.sec), y0 = y(a.m), x1 = x(b.sec), y1 = y(b.m);
    const hC = col(a.m, col(b.m, myC));
    if (color !== hC) { flush(); color = hC; d = `M${x0.toFixed(1)},${y0.toFixed(1)}`; }
    else if (!d) d = `M${x0.toFixed(1)},${y0.toFixed(1)}`;
    d += `H${x1.toFixed(1)}`;
    if (a.m === b.m) continue;
    if ((a.m > 0 && b.m < 0) || (a.m < 0 && b.m > 0)) {
      const midY = y(0);
      d += `V${midY.toFixed(1)}`;
      flush();
      color = col(b.m, hC);
      d = `M${x1.toFixed(1)},${midY.toFixed(1)}V${y1.toFixed(1)}`;
    } else {
      const vC = col(b.m, hC);
      if (color !== vC) { flush(); color = vC; d = `M${x1.toFixed(1)},${y0.toFixed(1)}`; }
      d += `V${y1.toFixed(1)}`;
    }
  }
  flush();
  return segs;
}

function flowYDomain(flow) {
  const ms = flow.length ? flow.map((p) => p.m) : [0];
  const dataMin = Math.min(0, ...ms);
  const dataMax = Math.max(0, ...ms);
  const span = Math.max(8, dataMax - dataMin);
  const step = span > 50 ? 10 : 5;
  const pad = step / 2;
  let yMin = Math.floor((dataMin - (dataMin < 0 ? pad : 0)) / step) * step;
  let yMax = Math.ceil((dataMax + (dataMax > 0 ? pad : 0)) / step) * step;
  yMin = Math.min(yMin, -10); // keep a negative band so 0 isn't glued to the floor
  yMax = Math.max(yMax, 0);
  if (yMax === yMin) { yMin = -10; yMax = step; }
  if (dataMax > 0 && yMax <= dataMax) yMax += step;
  if (dataMin < 0 && yMin >= dataMin) yMin -= step;
  return { yMin, yMax, step };
}

const GameFlow = ({ flow, opp, traits = [] }) => {
  const [hover, setHover] = useState(null);
  const oc = oppColor(opp);
  const myC = "#E8465A";
  const oppN = `${opp.name} '${opp.season.slice(2)}`;
  const W = 560, H = 188;
  const left = 32, right = 10, top = 10, bot = 24;
  const plotW = W - left - right, plotH = H - top - bot;
  const maxSec = Math.max(2400, flow[flow.length - 1]?.sec || 2400);
  const { yMin, yMax, step } = flowYDomain(flow);
  const yRange = yMax - yMin || 1;
  const x = (sec) => left + (sec / maxSec) * plotW;
  const y = (m) => top + ((yMax - m) / yRange) * plotH;
  const midY = y(0);
  const periods = Math.max(4, Math.ceil(maxSec / 600));
  const yTicks = [];
  for (let t = yMax; t >= yMin - 0.001; t -= step) yTicks.push(t);
  const segs = scoreDevSegments(flow, x, y, myC, oc);
  const markers = (traits || []).map((t, i) => {
    const sec = Math.min(maxSec - 30, Math.max(30, (t.q + 0.55) * 600 + i * 36));
    const m = marginAt(flow, sec);
    const copy = traitMarkerCopy(t, oppN);
    return { ...t, cx: x(sec), cy: y(m), copy };
  });
  return (
    <div className="scoreDev">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {Array.from({ length: periods }, (_, q) => {
          const x0 = x(q * 600), x1 = x(Math.min(maxSec, (q + 1) * 600));
          return (
            <rect key={q} x={x0} y={top} width={Math.max(0, x1 - x0)} height={plotH}
              fill={q % 2 === 0 ? "rgba(255,255,255,.03)" : "transparent"} />
          );
        })}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)}
              stroke={t === 0 ? "#5f6b7d" : "#232b3d"} strokeWidth={t === 0 ? 1.25 : 1} />
            <text x={left - 6} y={y(t) + 3.5} textAnchor="end"
              fill="#5f6b7d" fontSize="10" fontFamily="Saira Condensed, sans-serif"
              fontStyle="italic" fontWeight="700">{t}</text>
          </g>
        ))}
        {Array.from({ length: periods - 1 }, (_, i) => (
          <line key={`p${i}`} x1={x((i + 1) * 600)} x2={x((i + 1) * 600)}
            y1={top} y2={top + plotH} stroke="#2a3348" strokeDasharray="3 4" />
        ))}
        {segs.map((s, i) => (
          <path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="miter" strokeLinecap="square" />
        ))}
        <line x1={left} x2={W - right} y1={midY} y2={midY} stroke="#8fa0b8" strokeWidth="1" opacity="0.55" />
        {Array.from({ length: periods }, (_, q) => {
          const label = q < 4 ? `Q${q + 1}` : `OT${q - 3}`;
          const cx = (x(q * 600) + x(Math.min(maxSec, (q + 1) * 600))) / 2;
          return (
            <text key={label} x={cx} y={H - 6} textAnchor="middle"
              fill="#5f6b7d" fontSize="10" fontFamily="Saira Condensed, sans-serif"
              fontWeight="700" letterSpacing="0.12em">{label}</text>
          );
        })}
        {markers.map((mk, i) => {
          const fill = mk.pos ? "#7ee2a8" : "#f08a8a";
          return (
            <g key={`${mk.trait}-${i}`} className="traitDot"
              onMouseEnter={() => setHover(mk)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(mk)} onBlur={() => setHover(null)}
              tabIndex={0} style={{ cursor: "pointer" }}>
              <circle cx={mk.cx} cy={mk.cy} r="9" fill="transparent" />
              <circle cx={mk.cx} cy={mk.cy} r="5.5" fill={fill} stroke="#0b0e15" strokeWidth="2" />
              <circle cx={mk.cx} cy={mk.cy} r="2" fill="#fff" />
              <title>{`${mk.copy.title} — ${mk.copy.body}`}</title>
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className={`traitTip ${hover.cy < H * 0.38 ? "traitTipBelow" : ""}`} role="tooltip"
          style={{ left: `${Math.min(78, Math.max(22, (hover.cx / W) * 100))}%`, top: `${(hover.cy / H) * 100}%` }}>
          <div className="traitTipLabel" style={{ color: hover.pos ? "#7ee2a8" : "#f08a8a" }}>{hover.copy.title}</div>
          <div className="traitTipSub">{hover.copy.sub}</div>
          <div className="traitTipBody">{hover.copy.body}</div>
        </div>
      )}
    </div>
  );
};
function significantTraitRecap(fired, oppN) {
  const hit = (fired || [])
    .filter((t) => Math.abs(t.delta) >= SIGNIFICANT_TRAIT_DELTA)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  if (!hit) return "";
  const pool = hit.pos ? TRAIT_DEFS[hit.trait].recapPos : TRAIT_DEFS[hit.trait].recapNeg;
  if (!pool?.length) return "";
  const qn = ["first", "second", "third", "fourth"][hit.q];
  return rndT(pool).replace("{player}", hit.player).replace("{qn}", qn).replace("{oppN}", oppN);
}
function buildStory(g, box, style) {
  const top = box[0];
  const m = g.my - g.op;
  const oppN = `${g.opp.name} '${g.opp.season.slice(2)}`;
  const bestQ = Math.max(...g.myQ);
  const qn = ["1st", "2nd", "3rd", "4th"][g.myQ.indexOf(bestQ)];
  let story;
  if (m >= 18) story = rndT([
    `${top.name} was unstoppable — ${top.pts} points, and ${oppN} never got within double digits.`,
    `Total demolition: ${top.name} caught fire early, and a ${bestQ}-point ${qn} quarter buried ${oppN}.`,
    `${oppN} had no answer for ${top.name} (${top.pts} pts) on either end of the floor.`,
  ]);
  else if (m >= 10) story = rndT([
    `${top.name} caught fire from the three-point line — ${top.pts} points powered a comfortable win.`,
    `A ${bestQ}-point ${qn} quarter broke it open; ${top.name} led the way with ${top.pts}.`,
    style.id === "lock"
      ? `The lockdown defense wore ${oppN} down while ${top.name} did the scoring (${top.pts} pts).`
      : `The pace was too much for ${oppN} — ${top.name} poured in ${top.pts} in transition.`,
  ]);
  else if (m > 0) story = rndT([
    `Nail-biter: ${top.name} hit the big shots late to hold off ${oppN}.`,
    `${top.name} (${top.pts} pts) closed it out from the line in a grinder — too close for sweep standards.`,
    `${oppN} pushed to the final buzzer, but ${top.name} answered every run.`,
  ]);
  else if (m <= -15) story = rndT([
    `${oppN} ran your five off the floor — cold shooting everywhere except ${top.name} (${top.pts} pts).`,
    `Nothing worked: ${oppN} controlled all four quarters and the paint.`,
  ]);
  else story = rndT([
    `Heartbreaker — ${oppN} hit the shots down the stretch that your five couldn't.`,
    `${top.name} kept it alive with ${top.pts}, but ${oppN} made one more play at the end.`,
    `It slipped away in the ${["1st", "2nd", "3rd", "4th"][g.opQ.indexOf(Math.max(...g.opQ))]} quarter — ${oppN} went on the decisive run.`,
  ]);
  const traitLine = significantTraitRecap(g.traitFired, oppN);
  let out = traitLine ? `${story} ${traitLine}` : story;
  if (g.otPeriods > 0) {
    const otNote = g.otPeriods === 1
      ? " Regulation ended tied — it took one five-minute overtime to settle it."
      : ` Regulation ended tied — it took ${g.otPeriods} overtimes before someone finally broke through.`;
    out += otNote;
  }
  return out;
}

/* ============ 2K-STYLE UI ============ */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Saira+Condensed:ital,wght@0,500;0,700;0,800;1,700;1,800;1,900&family=Saira:wght@400;500;600&display=swap');
.ps-root{font-family:'Saira',sans-serif;color:#EAF0F7;min-height:100vh;position:relative;
  background:
    radial-gradient(1000px 420px at 50% -120px, rgba(232,70,90,.18), transparent 60%),
    radial-gradient(800px 500px at 90% 110%, rgba(35,180,226,.10), transparent 60%),
    linear-gradient(180deg,#0b0e15 0%, #0a0c12 100%);}
.ps-root::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.5;
  background:repeating-linear-gradient(115deg, rgba(255,255,255,.016) 0 2px, transparent 2px 90px);}
.dsp{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:800;
  text-transform:uppercase;letter-spacing:.02em;}
.dsp9{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:900;
  text-transform:uppercase;letter-spacing:.01em;}
.eyebrow{font-family:'Saira Condensed',sans-serif;font-weight:700;text-transform:uppercase;
  letter-spacing:.28em;font-size:11px;color:#5f6b7d;}
.cardRunMeta{display:flex;align-items:center;gap:.65rem;flex-wrap:nowrap;
  font-family:'Saira Condensed',sans-serif;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;font-size:12px;color:#c6d2e3;white-space:nowrap;
  overflow-x:auto;padding:.55rem 0;margin:0;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;}
.cardRunMeta::-webkit-scrollbar{display:none;}
.cardRunMetaSep{color:#5f6b7d;flex-shrink:0;}
@media (min-width:640px){
  .cardRunMeta{font-size:11px;letter-spacing:.1em;color:#93a1b5;}
}
.panel{background:linear-gradient(180deg,#141926 0%,#10141f 100%);
  border:1px solid #232b3d;border-top:2px solid #2c3650;
  clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);}
.chip{clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);}
.skew{transform:skewX(-8deg);}
.unskew{transform:skewX(8deg);display:inline-block;}
.btnP{background:linear-gradient(180deg,#ff5468,#e8465a 55%,#c92840);color:#fff;
  border:0;box-shadow:0 0 24px rgba(232,70,90,.4), inset 0 1px 0 rgba(255,255,255,.35);
  transition:filter .1s ease, transform .08s ease;}
.btnP:hover{filter:brightness(1.1);} .btnP:active{transform:skewX(-8deg) scale(.97);}
.btnG{background:#1a2132;color:#c6d2e3;border:1px solid #303c56;transition:filter .1s;}
.btnG:hover{filter:brightness(1.25);} .btnG:active{transform:skewX(-8deg) scale(.97);}
.btnDead{background:#12161f;color:#414c60;border:1px solid #1e2635;cursor:not-allowed;}
.segCtrl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:#1a2132;border:1px solid #303c56;
  overflow:visible;}
.segCtrl button{position:relative;display:flex;align-items:center;justify-content:center;
  background:transparent;border:0;border-right:1px solid #303c56;color:#c6d2e3;
  padding:.625rem .4rem;min-height:47px;cursor:pointer;white-space:nowrap;
  transition:filter .1s ease, transform .08s ease;}
.segCtrl button:last-child{border-right:0;}
.segCtrl button:hover{filter:brightness(1.2);z-index:2;}
.segCtrl button:active{transform:scale(.96);}
.segCtrl button.active{background:linear-gradient(180deg,#ff5468,#e8465a 55%,#c92840);color:#fff;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.35);}
.segCtrl .unskew{white-space:nowrap;}
.segTip{position:absolute;left:50%;bottom:calc(100% + 8px);transform:skewX(8deg) translateX(-50%);
  width:max-content;max-width:240px;padding:.45rem .6rem;pointer-events:none;
  background:#0f1420;border:1px solid #303c56;color:#c6d2e3;
  font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:700;
  font-size:11px;letter-spacing:.04em;text-transform:uppercase;line-height:1.25;text-align:center;
  white-space:normal;opacity:0;visibility:hidden;transition:opacity .12s ease, visibility .12s ease;
  box-shadow:0 6px 18px rgba(0,0,0,.45);z-index:5;}
.segTip::after{content:"";position:absolute;left:50%;top:100%;transform:translateX(-50%);
  border:5px solid transparent;border-top-color:#303c56;}
.segCtrl button:hover .segTip,.segCtrl button:focus-visible .segTip{opacity:1;visibility:visible;}
.scoreDev{position:relative;overflow:visible;}
.traitTip{position:absolute;transform:translate(-50%,calc(-100% - 12px));width:max-content;max-width:220px;
  padding:.55rem .7rem;pointer-events:none;z-index:6;
  background:#0f1420;border:1px solid #303c56;box-shadow:0 8px 22px rgba(0,0,0,.5);}
.traitTip::after{content:"";position:absolute;left:50%;top:100%;transform:translateX(-50%);
  border:5px solid transparent;border-top-color:#303c56;}
.traitTip.traitTipBelow{transform:translate(-50%,14px);}
.traitTip.traitTipBelow::after{top:auto;bottom:100%;border-top-color:transparent;border-bottom-color:#303c56;}
.traitTipLabel{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:800;
  font-size:12px;letter-spacing:.04em;text-transform:uppercase;line-height:1.2;}
.traitTipSub{font-family:'Saira Condensed',sans-serif;font-weight:700;font-size:10px;
  letter-spacing:.1em;text-transform:uppercase;color:#5f6b7d;margin-top:.15rem;}
.traitTipBody{font-family:'Saira',sans-serif;font-size:12px;line-height:1.35;color:#c6d2e3;margin-top:.35rem;
  text-wrap:pretty;}
.scoreNum{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:900;
  color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.7);}
.rowHover{transition:background .1s;} .rowHover:hover{background:rgba(232,70,90,.10);}
.gemShield{clip-path:polygon(50% 0,100% 22%,100% 78%,50% 100%,0 78%,0 22%);}
.matchCard{display:flex;align-items:stretch;padding:0;overflow:hidden;}
.matchCardRound{display:flex;flex-direction:column;justify-content:center;padding:.65rem .7rem;min-width:4.25rem;
  background:rgba(0,0,0,.22);border-right:1px solid #1c2333;flex-shrink:0;}
.matchCardRound .eyebrow{letter-spacing:.06em;font-size:9px;line-height:1.35;}
.matchCardBody{flex:1;min-width:0;padding:.65rem .75rem;}
.matchCardScore{display:flex;flex-direction:row;align-items:center;justify-content:flex-end;
  padding:.65rem .8rem;flex-shrink:0;gap:.35rem;white-space:nowrap;}
.matchCardScoreNum{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:900;
  font-size:1.2rem;white-space:nowrap;line-height:1;}
.matchCardScoreIcon{font-family:'Saira Condensed',sans-serif;font-size:.95rem;line-height:1;flex-shrink:0;}
.runHero{text-align:center;position:relative;}
.runHeroAccent{position:absolute;top:0;left:14px;right:0;height:2px;pointer-events:none;}
.runHeroRecord{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:900;
  font-size:clamp(2.75rem,14vw,4.5rem);line-height:1;-webkit-text-fill-color:currentColor;}
.runHeroStats{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-top:1rem;padding-top:1rem;}
.runHeroStatVal{font-family:'Saira Condensed',sans-serif;font-style:italic;font-weight:900;font-size:1.5rem;}
.runHeroStatLbl{font-family:'Saira Condensed',sans-serif;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;font-size:9px;margin-top:.15rem;opacity:.75;}
@media (prefers-reduced-motion: no-preference){
  .pop{animation:pop .28s cubic-bezier(.2,.9,.3,1.2);}
  @keyframes pop{from{transform:translateY(10px) scale(.97);opacity:0}to{transform:none;opacity:1}}
  .slideL{animation:slideL .35s cubic-bezier(.2,.9,.3,1);}
  @keyframes slideL{from{transform:translateX(-24px);opacity:0}to{transform:none;opacity:1}}
}
`;

const BtnArrow = () => <span className="whitespace-nowrap">{"\u00A0"}▸</span>;
const BallIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
    style={{ display: "inline-block", verticalAlign: "-0.12em", marginRight: "0.35em" }}>
    <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
    <path d="M12 2.75v18.5M3.4 12h17.2M5.2 6.2c2.4 1.9 5.1 2.85 6.8 2.85S16.4 8.1 18.8 6.2M5.2 17.8c2.4-1.9 5.1-2.85 6.8-2.85s4.4.95 6.8 2.85"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

function roundShortLabel(i, round) {
  if (round === DREAM_TEAM_ROUND) return "DREAM";
  if (i < 3) return "GROUPS";
  if (i < 5) return "2ND RD";
  if (i === 5) return "QF";
  if (i === 6) return "SF";
  return "FINAL";
}

function roundGameIndex(i) {
  if (i < 3) return i + 1;
  if (i < 5) return i - 2;
  return null;
}

function gameMarginLabel(g, i) {
  if (isDreamGame(g)) return g.my > g.op ? "BONUS WIN" : "DREAM TEAM WINS";
  if (g.my > g.op) return g.my - g.op >= 10 ? "✓ DOUBLE-DIGIT WIN" : "WIN UNDER 10 — SWEEP GONE";
  return i < 3 ? "GROUP LOSS — TABLE DECIDES" : i < 5 ? "2ND ROUND LOSS — TABLE DECIDES" : "ELIMINATED";
}

const GAME_RESULT_STYLES = {
  close: { background: "#2a2418", color: "#e8d48a", border: "1px solid #5c4f28" },
  sweep: { background: "#1d3a2a", color: "#7ee2a8", border: "1px solid #2c5c40" },
  loss: { background: "#3a1d22", color: "#f08a8a", border: "1px solid #5c2c34" },
};

function gameResultState(g) {
  if (!g) return null;
  const m = g.my - g.op;
  if (m <= 0) return "loss";
  if (m >= 10) return "sweep";
  return "close";
}

function marginColor(m) {
  if (m <= 0) return GAME_RESULT_STYLES.loss.color;
  if (m >= 10) return GAME_RESULT_STYLES.sweep.color;
  return GAME_RESULT_STYLES.close.color;
}

const MatchSummaryCard = ({ g, i }) => {
  const state = gameResultState(g);
  const icon = state === "loss" ? "✕" : state === "sweep" ? "🔥" : "✓";
  const resultStyle = GAME_RESULT_STYLES[state];
  const subIdx = roundGameIndex(i);
  const scorers = g.box?.slice(0, 3).map((p) => `${p.name} ${p.pts}`).join(", ") || "";
  const oc = oppColor(g.opp);

  return (
    <div className="matchCard panel slideL">
      <div className="matchCardRound">
        <span className="eyebrow">{roundShortLabel(i, g.round)}</span>
        {subIdx != null && <span className="eyebrow" style={{ color: "#93a1b5", fontSize: 8 }}>· G{subIdx}</span>}
      </div>
      <div className="matchCardBody">
        <div className="dsp text-sm" style={{ color: oc }}>
          VS {g.opp.name.toUpperCase()}{"\u00A0"}'{g.opp.season.slice(2)}
        </div>
        {scorers && (
          <div className="text-[11px] mt-0.5 truncate" style={{ color: "#5f6b7d" }}>
            TOP PTS · {scorers}
          </div>
        )}
      </div>
      <div className="matchCardScore" style={{
        background: resultStyle.background,
        borderLeft: resultStyle.border,
        color: resultStyle.color,
      }}>
        <div className="matchCardScoreNum">{g.my}{"\u00A0"}—{"\u00A0"}{g.op}</div>
        <span className="matchCardScoreIcon">{icon}</span>
      </div>
    </div>
  );
};

const RUN_HERO_THEMES = {
  sweep: { color: "#7ee2a8", stroke: "#2c5c40" },
  close: { color: "#e8d48a", stroke: "#5c4f28" },
  loss: { color: "#f08a8a", stroke: "#5c2c34" },
};

function runOutcomeKey(perfect, eliminated) {
  if (perfect) return "sweep";
  if (eliminated) return "loss";
  return "close";
}

function runOutcomeTheme(perfect, eliminated) {
  return RUN_HERO_THEMES[runOutcomeKey(perfect, eliminated)];
}

const RunSummaryHero = ({ perfect, eliminated, groupOut, r2Out, runStats }) => {
  if (!runStats) return null;
  const { w, l, ppgF, ppgA, sweepWins } = runStats;
  const theme = runOutcomeTheme(perfect, eliminated);

  let headline, record, subLabel, statThirdLabel, statThirdValue;
  if (perfect) {
    headline = "THE PERFECT SWEEP";
    record = "8×10";
    subLabel = "8 SWEEPS";
    statThirdLabel = "SWEEPS";
    statThirdValue = sweepWins;
  } else if (eliminated) {
    headline = groupOut ? "OUT IN THE GROUP STAGE" : r2Out ? "OUT IN THE 2ND ROUND" : "ELIMINATED";
    record = `${w}–${l}`;
    subLabel = `${w} WIN${w !== 1 ? "S" : ""}`;
    statThirdLabel = "WINS";
    statThirdValue = w;
  } else {
    headline = "WORLD CHAMPIONS";
    record = "8–0";
    subLabel = `${sweepWins} SWEEP${sweepWins !== 1 ? "S" : ""}`;
    statThirdLabel = "SWEEPS";
    statThirdValue = sweepWins;
  }

  return (
    <div className="runHero panel p-4 sm:p-5">
      <div className="runHeroAccent" style={{ background: theme.stroke }} aria-hidden />
      <div className="eyebrow mb-1" style={{ letterSpacing: ".14em", color: theme.color, opacity: 0.8 }}>{headline}</div>
      <div className="runHeroRecord" style={{ color: theme.color }}>{record}</div>
      <div className="dsp text-sm mt-2" style={{ color: theme.color, opacity: 0.85 }}>{subLabel}</div>
      <div className="runHeroStats" style={{ borderTop: "1px solid #1c2333" }}>
        {[
          [ppgF.toFixed(1), "PTS FOR / G"],
          [ppgA.toFixed(1), "AGAINST / G"],
          [statThirdValue, statThirdLabel],
        ].map(([v, l]) => (
          <div key={l}>
            <div className="runHeroStatVal" style={{ color: theme.color }}>{v}</div>
            <div className="runHeroStatLbl" style={{ color: theme.color }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Gem = ({ rt, size = 34 }) => {
  const t = tier(rt);
  return (
    <span className="gemShield inline-flex items-center justify-center dsp9"
      style={{ width: size, height: size * 1.12, background: t.bg, color: t.fg, fontSize: size * 0.44, fontStyle: "italic" }}>
      {rt}
    </span>
  );
};

export default function PerfectSweep() {
  const shareInit = useMemo(() => readShareFromUrl(), []);
  const [screen, setScreen] = useState(shareInit ? "card" : "home");
  const [deck, setDeck] = useState([]);
  const [rolls, setRolls] = useState(shareInit?.rolls ?? 0);
  const [lineup, setLineup] = useState(shareInit?.lineup ?? {});
  const [style, setStyle] = useState(STYLES[1]);
  const [games, setGames] = useState(shareInit?.games ?? []);
  const [gauntlet, setGauntlet] = useState([]);
  const [gi, setGi] = useState(shareInit?.gi ?? 0);
  const [rivalGames, setRivalGames] = useState([]);
  const [groupOut, setGroupOut] = useState(shareInit?.groupOut ?? false);
  const [r2, setR2] = useState(null); // second round: carried result + rival fixtures
  const [r2Out, setR2Out] = useState(shareInit?.r2Out ?? false);
  const [swapsLeft, setSwapsLeft] = useState(2); // shared pool — spend on nation or year
  const [speed, setSpeed] = useState("medium"); // fast | medium | slow
  const [live, setLive] = useState(null);
  const [pickedThisRoll, setPickedThisRoll] = useState(false);
  const [seenNations, setSeenNations] = useState([]);
  const [seenYears, setSeenYears] = useState([]);
  const [openFlow, setOpenFlow] = useState({});
  const [linkCopied, setLinkCopied] = useState(false);
  const [dreamTeamMode, setDreamTeamMode] = useState(false);
  const [dreamGamePlayed, setDreamGamePlayed] = useState(
    () => !!(shareInit?.games?.some(isDreamGame)),
  );
  const runId = useRef(0);
  const ctaAnchorRef = useRef(null);

  const cur = deck[0];
  // strictly orthogonal, and never returns a nation/year already shown on this roll
  const nationPool = cur ? TEAMS.filter((t) => t.season === cur.season && !seenNations.includes(t.name)) : [];
  const yearPool = cur ? TEAMS.filter((t) => t.name === cur.name && !seenYears.includes(t.season)) : [];

  const switchNation = () => {
    if (!cur || swapsLeft <= 0 || !nationPool.length) return;
    const t = shuffle(nationPool)[0];
    setDeck([t]); setSwapsLeft((n) => n - 1); setPickedThisRoll(false);
    setSeenNations((s) => [...s, t.name]);
  };

  const switchYear = () => {
    if (!cur || swapsLeft <= 0 || !yearPool.length) return;
    const t = shuffle(yearPool)[0];
    setDeck([t]); setSwapsLeft((n) => n - 1); setPickedThisRoll(false);
    setSeenYears((s) => [...s, t.season]);
  };

  const filled = SLOTS.filter((s) => lineup[s]).length;
  const myRt = useMemo(() => filled ? SLOTS.reduce((s, k) => s + (lineup[k]?.rt || 0), 0) / Math.max(filled, 1) : 0, [lineup, filled]);

  const alreadySigned = (p) => SLOTS.some((s) => lineup[s]?.name === p.name);

  // anyone on the rolled squad we could still legally sign?
  const hasEligible = cur ? cur.players.some((p) => !lineup[p.pos] && !alreadySigned(p)) : false;
  // ROLL AGAIN locked until you sign from the current squad (unless nobody signable).
  // Once the starting five is full, rolling is disabled — tip off instead.
  const fiveSet = filled === 5;
  const canRoll = !fiveSet && (!deck.length || pickedThisRoll || !hasEligible);

  const roll = () => {
    if (!canRoll) return;
    const t = shuffle(TEAMS)[0];
    setDeck([t]); setRolls((r) => r + 1); setPickedThisRoll(false);
    setSeenNations([t.name]); setSeenYears([t.season]);
  };

  const pick = (team, p) => {
    if (lineup[p.pos] || pickedThisRoll || alreadySigned(p)) return; // one per roll, no duplicates
    setLineup({ ...lineup, [p.pos]: { ...p, team: team.name, season: team.season, tc: team.c } });
    setPickedThisRoll(true);
  };

  const neutralGame = (ta, tb) => {
    const d = (teamRating(ta) - teamRating(tb)) * 1.15;
    const noise = () => (Math.random() - 0.5) * 22;
    let sa = Math.round(86 + d / 2 + noise()), sb = Math.round(86 - d / 2 + noise());
    if (sa === sb) sa += 2;
    return { sa: Math.max(58, sa), sb: Math.max(58, sb) };
  };

  const startTournament = () => {
    // real FIBA system: group of 4 → 2nd round group (carry-over + 2 new games) → QF, SF, Final = 8 games
    // knockouts (slots 5-7) draw from above-average teams only, sorted so the Final tends to be the toughest
    const avgRt = TEAMS.reduce((s, t) => s + teamRating(t), 0) / TEAMS.length;
    const elite = TEAMS.filter((t) => teamRating(t) >= avgRt);
    const knockouts = shuffle(elite).slice(0, 3).sort((a, b) => teamRating(a) - teamRating(b));
    const rest = shuffle(TEAMS.filter((t) => !knockouts.includes(t))).slice(0, 5);
    const g8 = [...rest, ...knockouts]; // 0-2 group rivals · 3-4 second-round opponents · 5-7 knockouts
    setGauntlet(g8);
    const rivals = g8.slice(0, 3);
    const pairs = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => {
      const r = neutralGame(rivals[a], rivals[b]);
      return { a, b, sa: r.sa, sb: r.sb };
    });
    setRivalGames(pairs);
    setGroupOut(false); setR2(null); setR2Out(false);
    setGames([]); setGi(0); setScreen("sim");
  };

  const computeTable = (played) => {
    if (played.length < 3 || !gauntlet.length) return null;
    const rows = [
      { id: "me", name: "YOUR FIVE", c: "#E8465A", w: 0, l: 0, pf: 0, pa: 0 },
      ...gauntlet.slice(0, 3).map((t, i) => ({ id: i, name: `${t.name} '${t.season.slice(2)}`, c: oppColor(t), w: 0, l: 0, pf: 0, pa: 0 })),
    ];
    const get = (id) => rows.find((r) => r.id === id);
    const add = (idA, idB, sa, sb) => {
      const A = get(idA), B = get(idB);
      A.pf += sa; A.pa += sb; B.pf += sb; B.pa += sa;
      if (sa > sb) { A.w++; B.l++; } else { B.w++; A.l++; }
    };
    played.slice(0, 3).forEach((g, i) => add("me", i, g.my, g.op));
    rivalGames.forEach((rg) => add(rg.a, rg.b, rg.sa, rg.sb));
    rows.forEach((r) => { r.pts = r.w * 2 + r.l; r.diff = r.pf - r.pa; });
    rows.sort((x, y) => y.pts - x.pts || y.diff - x.diff || y.pf - x.pf);
    return rows;
  };
  const groupTable = useMemo(() => computeTable(games), [games, rivalGames, gauntlet]); // eslint-disable-line

  /* 2nd-round group: me + the rival who advanced with me + gauntlet[3] & [4].
     Result vs the co-advancing rival carries over; so does the new pair's own group game. */
  const setupSecondRound = (played, table) => {
    const coIdx = table.slice(0, 2).find((r) => r.id !== "me").id; // rival advancing with me
    const rival = gauntlet[coIdx];
    const carried = { my: played[coIdx].my, op: played[coIdx].op }; // my group game vs that rival
    const A = gauntlet[3], B = gauntlet[4];
    setR2({
      rival, coIdx, carried,
      abCarry: neutralGame(A, B),           // their carried head-to-head
      rivalVsA: neutralGame(rival, A),      // rival's two new fixtures
      rivalVsB: neutralGame(rival, B),
    });
  };

  const computeR2Table = (played) => {
    if (!r2 || played.length < 5) return null;
    const A = gauntlet[3], B = gauntlet[4];
    const rows = [
      { id: "me", name: "YOUR FIVE", c: "#E8465A", w: 0, l: 0, pf: 0, pa: 0 },
      { id: "riv", name: `${r2.rival.name} '${r2.rival.season.slice(2)}`, c: oppColor(r2.rival), w: 0, l: 0, pf: 0, pa: 0 },
      { id: "A", name: `${A.name} '${A.season.slice(2)}`, c: oppColor(A), w: 0, l: 0, pf: 0, pa: 0 },
      { id: "B", name: `${B.name} '${B.season.slice(2)}`, c: oppColor(B), w: 0, l: 0, pf: 0, pa: 0 },
    ];
    const get = (id) => rows.find((r) => r.id === id);
    const add = (idA, idB, sa, sb) => {
      const X = get(idA), Y = get(idB);
      X.pf += sa; X.pa += sb; Y.pf += sb; Y.pa += sa;
      if (sa > sb) { X.w++; Y.l++; } else { Y.w++; X.l++; }
    };
    add("me", "riv", r2.carried.my, r2.carried.op); // carried over
    add("A", "B", r2.abCarry.sa, r2.abCarry.sb);    // carried over
    add("me", "A", played[3].my, played[3].op);
    add("me", "B", played[4].my, played[4].op);
    add("riv", "A", r2.rivalVsA.sa, r2.rivalVsA.sb);
    add("riv", "B", r2.rivalVsB.sa, r2.rivalVsB.sb);
    rows.forEach((r) => { r.pts = r.w * 2 + r.l; r.diff = r.pf - r.pa; });
    rows.sort((x, y) => y.pts - x.pts || y.diff - x.diff || y.pf - x.pf);
    return rows;
  };
  const r2Table = useMemo(() => computeR2Table(games), [games, r2, gauntlet]); // eslint-disable-line

  const commitGame = (g, box) => {
    const flow = buildFlow(buildEvents(g, box, g.opp));
    const next = [...games, { ...g, box, round: ROUNDS[gi], story: buildStory(g, box, style), flow }];
    setGames(next);
    if (gi < 2) { setGi(gi + 1); return; }
    if (gi === 2) { // group stage done — table decides
      const table = computeTable(next);
      const myRank = table.findIndex((r) => r.id === "me") + 1;
      if (myRank > 2) { setGroupOut(true); setScreen("done"); }
      else { setupSecondRound(next, table); setGi(3); }
      return;
    }
    if (gi === 3) { setGi(4); return; } // 2nd-round losses don't eliminate either
    if (gi === 4) { // 2nd round done — table decides QF spots
      const table = computeR2Table(next);
      const myRank = table.findIndex((r) => r.id === "me") + 1;
      if (myRank > 2) { setR2Out(true); setScreen("done"); } else setGi(5);
      return;
    }
    if (g.my < g.op || gi === 7) setScreen("done"); // knockouts: lose and you're out
    else setGi(gi + 1);
  };

  const playNext = () => {
    if (live) return;
    const lu = SLOTS.map((s) => lineup[s]);
    const g = simGameWithTraits(lu, myRt, style, gauntlet[gi], gi, games.length);
    const box = boxScore(lu, g.my);
    runLiveGame(g, box, ROUNDS[gi], (result, resultBox) => commitGame(result, resultBox));
  };

  const runLiveGame = (g, box, roundLabel, onCommit) => {
    if (speed === "fast") { onCommit(g, box); return; }

    const evs = buildEvents(g, box, g.opp);
    const steps = chunkEvents(evs, speed === "medium" ? 40 : 28);
    const delay = speed === "medium" ? 65 : 700;
    const id = ++runId.current;
    setLive({ opp: g.opp, round: roundLabel, my: 0, op: 0, clock: "Q1 10:00", feed: [] });
    let k = 0;
    const step = () => {
      if (id !== runId.current) return;
      if (k >= steps.length) {
        setTimeout(() => { if (id !== runId.current) return; setLive(null); onCommit(g, box); }, speed === "medium" ? 300 : 800);
        return;
      }
      const st = steps[k++];
      setLive((l) => l && ({
        ...l, my: l.my + st.dMy, op: l.op + st.dOp, clock: st.clock,
        feed: speed === "slow"
          ? [...l.feed, { clock: st.clock, text: st.text, team: st.team, my: l.my + st.dMy, op: l.op + st.dOp }].slice(-8)
          : l.feed,
      }));
      setTimeout(step, delay);
    };
    setTimeout(step, delay);
  };

  const faceDreamTeam = () => {
    setDreamTeamMode(true);
    setScreen("sim");
  };

  const commitDreamGame = (g, box) => {
    const flow = buildFlow(buildEvents(g, box, g.opp));
    const next = [...games, { ...g, box, round: DREAM_TEAM_ROUND, story: buildStory(g, box, style), flow }];
    setGames(next);
    setDreamTeamMode(false);
    setDreamGamePlayed(true);
    setScreen("done");
  };

  const playDreamTeam = () => {
    if (live) return;
    const lu = SLOTS.map((s) => lineup[s]);
    const tCount = games.filter((x) => !isDreamGame(x)).length;
    const g = simGameWithTraits(lu, myRt, style, DREAM_TEAM, 8, tCount);
    const box = boxScore(lu, g.my);
    runLiveGame(g, box, DREAM_TEAM_ROUND, commitDreamGame);
  };

  const shareLink = () => {
    const path = encodeRunShare({ rolls, groupOut, r2Out, lineup, games });
    const url = `${window.location.origin}${path}`;
    window.history.replaceState(null, "", path);
    const done = () => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(done);
    else {
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); done();
    }
  };

  useEffect(() => {
    if (screen === "card" && games.length && SLOTS.every((s) => lineup[s])) {
      window.history.replaceState(null, "", encodeRunShare({ rolls, groupOut, r2Out, lineup, games }));
    } else if (screen !== "card" && window.location.search.includes("card=")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [screen, rolls, groupOut, r2Out, lineup, games]);

  // After a match ends, bring the continue CTA into view (esp. mobile + standings).
  useEffect(() => {
    if (live) return;
    if (screen !== "sim" && screen !== "done") return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      setTimeout(() => {
        if (cancelled) return;
        ctaAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [live, screen, games.length, dreamTeamMode, gi]);

  const reset = () => {
    runId.current++; setLive(null); setLinkCopied(false); setScreen("home"); setDeck([]); setLineup({}); setGames([]); setGi(0); setRolls(0);
    setSwapsLeft(2); setRivalGames([]); setGroupOut(false); setR2(null); setR2Out(false);
    setPickedThisRoll(false); setSeenNations([]); setSeenYears([]); setOpenFlow({});
    setDreamTeamMode(false); setDreamGamePlayed(false);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const tournamentGames = games.filter((g) => !isDreamGame(g));
  const dreamGame = games.find(isDreamGame);
  const wins = tournamentGames.filter((g) => g.my > g.op).length;
  const perfect = tournamentGames.length === 8 && tournamentGames.every((g) => g.my - g.op >= 10);
  const lastG = tournamentGames[tournamentGames.length - 1];
  const eliminated = groupOut || r2Out || (tournamentGames.length > 5 && lastG && lastG.my < lastG.op);

  /* ---- end-of-run stats ---- */
  const runStats = useMemo(() => {
    if ((screen !== "done" && screen !== "card") || !tournamentGames.length) return null;
    const tg = tournamentGames;
    const players = SLOTS.map((s) => lineup[s]).filter(Boolean).map((p) => {
      const per = tg.map((g) => g.box.find((b) => b.name === p.name && b.n === p.n)?.pts || 0);
      const tot = per.reduce((a, b) => a + b, 0);
      return { ...p, tot, ppg: tot / tg.length, best: Math.max(...per) };
    }).sort((a, b) => b.ppg - a.ppg);
    const pf = tg.reduce((s, g) => s + g.my, 0), pa = tg.reduce((s, g) => s + g.op, 0);
    const margins = tg.map((g) => g.my - g.op);
    const resultLabel = perfect ? "THE PERFECT SWEEP — 8×10"
      : eliminated ? (groupOut ? "OUT IN THE GROUP STAGE" : r2Out ? "OUT IN THE 2ND ROUND" : `ELIMINATED — ${tournamentGames[tournamentGames.length - 1].round}`)
      : "WORLD CHAMPIONS — 8–0";
    return {
      players, resultLabel,
      w: wins, l: tg.length - wins,
      totalPF: pf, totalPA: pa,
      ppgF: pf / tg.length, ppgA: pa / tg.length,
      avgMargin: margins.reduce((a, b) => a + b, 0) / tg.length,
      bigWin: Math.max(...margins),
      sweepWins: margins.filter((m) => m >= 10).length,
      margins,
      ovr: Math.round(myRt),
    };
  }, [screen, games, tournamentGames, lineup, wins, perfect, eliminated, groupOut, r2Out, myRt]);



  return (
    <div className="ps-root pb-10">
      <style>{css}</style>

      {/* ===== top bar ===== */}
      <div className="flex items-center justify-center px-5 py-3 relative"
        style={{ background: "linear-gradient(180deg,#131826,#0e1219)", borderBottom: "1px solid #232b3d" }}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={reset}>
          <div className="skew chip px-3 py-1 dsp9 text-lg" style={{ background: "#E8465A", color: "#fff" }}>
            <span className="unskew">8×10</span>
          </div>
          <div className="dsp text-lg" style={{ color: "#EAF0F7" }}>PERFECT SWEEP</div>
        </div>
        <div className="eyebrow hidden sm:block absolute right-5 top-1/2 -translate-y-1/2">FIBA WORLD CUP · 1986—2023</div>
      </div>
      {/* accent strips */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#E8465A 0%,#E8465A 30%,#23b4e2 30%,#23b4e2 33%,transparent 33%)" }} />

      {/* ============ HOME ============ */}
      {screen === "home" && (
        <div className="max-w-3xl mx-auto px-6 py-12 text-center pop relative">
          <div className="eyebrow mb-2">MYTEAM · WORLD CUP GAUNTLET</div>
          <div className="dsp9" style={{
            fontSize: "min(20vw,150px)", lineHeight: 0.9,
            background: "linear-gradient(180deg,#fff 30%,#ff8b98 60%,#E8465A)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 6px 30px rgba(232,70,90,.35))",
          }}>8–0</div>
          <h1 className="dsp text-3xl mt-3" style={{ color: "#EAF0F7" }}>
            ROLL THE BALL. DRAFT YOUR DREAM NATIONAL FIVE.
          </h1>
          <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: "#93a1b5" }}>
            Roll legendary World Cup squads, draft your five, and chase the perfect mark: <b style={{ color: "#ff8b98" }}>win all eight by 10+.</b>
          </p>
          <div className="flex justify-center gap-3 mt-8 flex-wrap">
            {[["01", "ROLL", "draw nations & years"], ["02", "DRAFT", "one star per position"], ["03", "SWEEP", "8 wins, all double digits"]].map(([n, t, d]) => (
              <div key={n} className="panel px-5 py-3 text-left" style={{ minWidth: 170 }}>
                <div className="dsp9 text-2xl" style={{ color: "#E8465A" }}>{n} <span style={{ color: "#EAF0F7" }}>{t}</span></div>
                <div className="text-xs" style={{ color: "#7d8ba0" }}>{d}</div>
              </div>
            ))}
          </div>
          <button className="btnP skew dsp9 text-2xl px-12 py-4 mt-10"
            onClick={() => { roll(); setScreen("draft"); }}>
            <span className="unskew">TIP OFF<BtnArrow /></span>
          </button>
          <div className="mt-8 eyebrow">
            {new Set(TEAMS.map(t => t.name)).size} NATIONS · {TEAMS.length} SQUADS · {TEAMS.length * 6} PLAYERS
          </div>
        </div>
      )}

      {/* ============ DRAFT ============ */}
      {screen === "draft" && (
        <div className="max-w-5xl mx-auto px-4 py-6 pop">
          {/* lineup rack */}
          <div className="panel p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="dsp text-xl">YOUR FIVE <span className="eyebrow ml-2">{filled}/5 SIGNED</span></div>
              {filled > 0 && <div className="flex items-center gap-2"><span className="eyebrow">TEAM OVR</span><Gem rt={Math.round(myRt)} size={40} /></div>}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {SLOTS.map((s) => {
                const p = lineup[s];
                return (
                  <div key={s}
                    className="relative p-2 text-center chip"
                    style={p
                      ? { background: `linear-gradient(180deg, ${p.tc}33, #10141f 70%)`, border: `1px solid ${p.tc}`, borderTop: `3px solid ${p.tc}` }
                      : { border: "1px dashed #33405c", color: "#5f6b7d", background: "rgba(255,255,255,.015)" }}>
                    <div className="eyebrow">{s}</div>
                    {p ? (<>
                      <div className="flex justify-center my-1"><Gem rt={p.rt} /></div>
                      <div className="dsp leading-tight text-sm" style={{ color: "#fff" }}>#{p.n} {p.name}</div>
                      <div className="text-[11px]" style={{ color: "#93a1b5" }}>{p.team} '{p.season.slice(2)}</div>
                    </>) : <div className="py-5 dsp text-sm">EMPTY</div>}
                  </div>
                );
              })}
            </div>
            {/* tactic + go */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="eyebrow mr-1">TACTIC</span>
              <div className="skew segCtrl flex-1 min-w-[260px] max-w-md">
                {STYLES.map((st) => (
                  <button key={st.id} onClick={() => setStyle(st)} title={st.tip}
                    className={`dsp text-xs sm:text-sm ${style.id === st.id ? "active" : ""}`}>
                    <span className="unskew whitespace-nowrap">{st.label}</span>
                    <span className="segTip" aria-hidden="true">{st.tip}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <button disabled={filled < 5} onClick={startTournament}
                className={`skew dsp9 px-7 py-2.5 text-lg ${filled === 5 ? "btnP" : "btnDead"}`}>
                <span className="unskew">PLAY THE WORLD CUP<BtnArrow /></span>
              </button>
            </div>
          </div>

          {/* roll controls */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow mr-1 inline-flex items-center gap-1.5" title="Spend on nation or year, in any combination">
                  Not feeling it?{" "}
                  <span className="text-lg leading-none" aria-hidden="true" style={{ letterSpacing: 0 }}>⟳</span>
                  {" "}Swap{" "}
                  <b style={{ color: swapsLeft ? "#E8465A" : "#5f6b7d" }}>{swapsLeft}×</b>
                </span>
                <button onClick={switchNation} disabled={!swapsLeft || !nationPool.length || fiveSet}
                  title={fiveSet ? "Starting five is set"
                    : !swapsLeft ? "No swaps left this run"
                    : !nationPool.length ? `No other nation at World Cup ${cur?.season}`
                    : `Different nation, same year (${cur?.season}) — uses one swap`}
                  className={`skew chip dsp px-4 py-2.5 text-sm tracking-wide min-w-[6.75rem] ${(!swapsLeft || !nationPool.length || fiveSet) ? "btnDead" : "btnG"}`}>
                  <span className="unskew inline-flex items-center justify-center gap-1 w-full">
                    <span className="text-lg leading-none" aria-hidden="true">⟳</span>
                    <span>NATION</span>
                  </span>
                </button>
                <button onClick={switchYear} disabled={!swapsLeft || !yearPool.length || fiveSet}
                  title={fiveSet ? "Starting five is set"
                    : !swapsLeft ? "No swaps left this run"
                    : !yearPool.length ? `${cur?.name} has only one squad in the deck`
                    : `Same nation (${cur?.name}), different World Cup — uses one swap`}
                  className={`skew chip dsp px-4 py-2.5 text-sm tracking-wide min-w-[6.75rem] ${(!swapsLeft || !yearPool.length || fiveSet) ? "btnDead" : "btnG"}`}>
                  <span className="unskew inline-flex items-center justify-center gap-3.5 w-full">
                    <span className="text-lg leading-none" aria-hidden="true">⟳</span>
                    <span>YEAR</span>
                  </span>
                </button>
              </div>
              <button onClick={roll} disabled={!canRoll}
                title={fiveSet ? "Starting five is set — play the World Cup"
                  : canRoll ? "Roll a new squad"
                  : "Sign a player from this squad first — or spend a swap"}
                className={`skew chip dsp9 px-6 py-2.5 tracking-wide ${canRoll ? "btnP" : "btnDead"}`}>
                <span className="unskew"><BallIcon />ROLL AGAIN</span>
              </button>
            </div>
            <div className="eyebrow">
              {fiveSet
                ? `STARTING FIVE SET — TIP OFF WHEN READY · ROLL #${rolls}`
                : canRoll
                  ? `ROLLED SQUAD — PICK WHO WAS ACTUALLY THERE · ROLL #${rolls}`
                  : `SIGN ONE PLAYER FROM THIS SQUAD TO UNLOCK THE NEXT ROLL · ROLL #${rolls}`}
            </div>
          </div>

          {/* squad card */}
          <div className="max-w-md mx-auto">
            {deck.map((t, i) => (
              <div key={`${t.name}-${t.season}-${rolls}`} className="panel overflow-hidden slideL">
                <div className="relative px-4 py-3"
                  style={{ background: `linear-gradient(100deg, ${t.c} 0%, ${t.c}cc 55%, #10141f 100%)` }}>
                  <div className="dsp9 text-2xl" style={{ color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,.5)" }}>
                    {t.name.toUpperCase()}
                  </div>
                  <div className="dsp text-sm" style={{ color: "rgba(255,255,255,.85)" }}>WORLD CUP {t.season} · OVR {teamRating(t).toFixed(0)}</div>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 dsp9"
                    style={{ fontSize: 64, color: "rgba(255,255,255,.12)", lineHeight: 1 }}>{t.season.slice(2)}</div>
                </div>
                <div className="p-2 relative">
                  {pickedThisRoll && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center"
                      style={{ background: "rgba(10,12,18,.72)", backdropFilter: "blur(1px)" }}>
                      <div className="skew chip dsp9 px-5 py-2 text-sm" style={{ background: "#E8465A", color: "#fff" }}>
                        <span className="unskew">
                          {fiveSet ? <>STARTING FIVE SET — PLAY THE WORLD CUP<BtnArrow /></> : <>PLAYER SIGNED — ROLL FOR THE NEXT SQUAD<BtnArrow /></>}
                        </span>
                      </div>
                    </div>
                  )}
                  {t.players.map((p, j) => {
                    const taken = !!lineup[p.pos];
                    const dupe = alreadySigned(p);
                    const locked = taken || pickedThisRoll || dupe;
                    return (
                      <div key={j} onClick={() => pick(t, p)}
                        className={`rowHover flex items-center justify-between px-2 py-1.5 ${locked ? "opacity-30" : "cursor-pointer"}`}
                        style={{ borderBottom: j < t.players.length - 1 ? "1px solid #1c2333" : "none" }}>
                        <div className="flex items-center gap-2">
                          <span className="chip dsp text-xs px-2 py-0.5"
                            style={{ background: "#1a2132", color: "#8fa0b8", minWidth: 34, textAlign: "center" }}>{p.pos}</span>
                          <span className="dsp text-base" style={{ color: "#EAF0F7" }}>#{p.n} {p.name}</span>
                          {dupe
                            ? <span className="eyebrow" style={{ letterSpacing: ".1em", color: "#E8465A" }}>ALREADY SIGNED</span>
                            : taken && <span className="eyebrow" style={{ letterSpacing: ".1em" }}>SLOT FILLED</span>}
                        </div>
                        <Gem rt={p.rt} size={30} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ SIM ============ */}
      {(screen === "sim" || screen === "done") && (
        <div className="max-w-3xl mx-auto px-4 py-6 pop">
          {/* sim speed */}
          {screen === "sim" && (
          <div className="flex justify-end items-center gap-2 mb-3">
            <span className="eyebrow">SIM SPEED</span>
            <select value={speed} onChange={(e) => setSpeed(e.target.value)} disabled={!!live}
              className="dsp text-sm px-3 py-1.5"
              style={{ background: "#1a2132", color: "#c6d2e3", border: "1px solid #303c56", outline: "none", fontStyle: "italic", cursor: live ? "not-allowed" : "pointer" }}>
              <option value="fast">FAST — RESULT ONLY</option>
              <option value="medium">MEDIUM — LIVE SCORE TICKER</option>
              <option value="slow">SLOW — PLAY-BY-PLAY</option>
            </select>
          </div>
          )}
          {/* round tracker */}
          <div className="flex gap-1 mb-6 justify-center flex-wrap">
            {ROUNDS.map((r, i) => {
              const g = games[i];
              const state = !g ? "up" : gameResultState(g);
              const sty = {
                up: { background: "#151b29", color: "#5f6b7d", border: "1px solid #232b3d" },
                ...GAME_RESULT_STYLES,
              }[state];
              return (
                <div key={i} className="chip dsp text-[10px] px-2.5 py-1 text-center" style={{ ...sty, minWidth: 72 }}>
                  {r}{g && <div className="dsp9 text-sm" style={{ fontStyle: "italic" }}>{g.my}–{g.op}</div>}
                </div>
              );
            })}
            {(perfect || dreamTeamMode || dreamGamePlayed) && (() => {
              const g = dreamGame;
              const state = !g ? "up" : gameResultState(g);
              const sty = {
                up: { background: "#151b29", color: "#FFD700", border: "1px solid #5c4f28" },
                ...GAME_RESULT_STYLES,
              }[state];
              return (
                <div className="chip dsp text-[10px] px-2.5 py-1 text-center" style={{ ...sty, minWidth: 72 }}>
                  DREAM TEAM{g && <div className="dsp9 text-sm" style={{ fontStyle: "italic" }}>{g.my}–{g.op}</div>}
                </div>
              );
            })()}
          </div>

          {/* played games — broadcast scoreboards */}
          {screen === "sim" && games.map((g, i) => (
            <React.Fragment key={i}>
              <div className="panel mb-3 slideL overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-2">
                  <span className="eyebrow">{g.round}</span>
                  <span className="dsp text-xs" style={{ color: marginColor(g.my - g.op) }}>
                    {gameMarginLabel(g, i)}
                  </span>
                </div>
                {/* scoreboard bar */}
                <div className="grid items-stretch mt-1" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                  <div className="flex items-center px-4 py-2"
                    style={{ background: "linear-gradient(90deg,#E8465A22,transparent)" , borderLeft: "4px solid #E8465A" }}>
                    <span className="dsp9 text-lg" style={{ color: "#fff" }}>YOUR FIVE</span>
                  </div>
                  <div className="scoreNum text-4xl px-4 flex items-center"
                    style={{ background: "#0b0e15", borderTop: "1px solid #232b3d", borderBottom: "1px solid #232b3d" }}>
                    {g.my}<span style={{ color: "#3d486c", padding: "0 6px", fontSize: 22 }}>—</span>{g.op}
                  </div>
                  <div className="flex items-center justify-end px-4 py-2"
                    style={{ background: `linear-gradient(270deg, ${oppColor(g.opp)}33, transparent)`, borderRight: `4px solid ${oppColor(g.opp)}` }}>
                    <span className="dsp9 text-lg" style={{ color: "#fff" }}>{g.opp.name.toUpperCase()} '{g.opp.season.slice(2)}</span>
                  </div>
                </div>
                <div className="flex justify-between px-4 py-1.5 text-[11px]" style={{ color: "#5f6b7d" }}>
                  <span>Q {g.myQ.join(" · ")}{g.otMy?.length ? ` · OT ${g.otMy.join(" · ")}` : ""}</span>
                  <span className="dsp" style={{ color: "#93a1b5" }}>
                    {g.box.slice(0, 3).map((p) => `${p.name} ${p.pts}`).join("  ·  ")}
                  </span>
                  <span>Q {g.opQ.join(" · ")}{g.otOp?.length ? ` · OT ${g.otOp.join(" · ")}` : ""}</span>
                </div>
                {g.story && (
                  <div className="px-4 py-2.5 text-sm" style={{
                    borderTop: "1px solid #1c2333",
                    background: "linear-gradient(90deg, rgba(232,70,90,.07), transparent)",
                    color: "#c6d2e3",
                  }}>
                    <span className="eyebrow mr-2" style={{ color: "#E8465A" }}>RECAP</span>
                    {g.story}
                  </div>
                )}
                {g.flow && (
                  <>
                    <div onClick={() => setOpenFlow((o) => ({ ...o, [i]: !o[i] }))}
                      className="rowHover flex items-center justify-between px-4 py-2 cursor-pointer"
                      style={{ borderTop: "1px solid #1c2333" }}>
                      <span className="eyebrow">SCORING DEVELOPMENT</span>
                      <span className="dsp text-sm whitespace-nowrap shrink-0" style={{ color: "#5f6b7d" }}>{openFlow[i] ? "▲\u00A0HIDE" : "▼\u00A0SHOW"}</span>
                    </div>
                    {openFlow[i] && (
                      <div className="px-3 pb-3 pop">
                        <div className="flex gap-4 px-1 mb-1 text-[11px] flex-wrap justify-end">
                          <span className="flex items-center gap-1.5" style={{ color: "#E8465A" }}>
                            <span style={{ width: 10, height: 10, background: "#E8465A", display: "inline-block" }} />
                            YOUR FIVE
                          </span>
                          <span className="flex items-center gap-1.5" style={{ color: oppColor(g.opp) }}>
                            <span style={{ width: 10, height: 10, background: oppColor(g.opp), display: "inline-block" }} />
                            {g.opp.name.toUpperCase()} '{g.opp.season.slice(2)}
                          </span>
                        </div>
                        <GameFlow flow={g.flow} opp={g.opp} traits={g.traitFired} />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* group standings */}
              {i === 2 && groupTable && (
                <div className="panel p-4 mb-3 pop">
                  <div className="flex items-baseline gap-3 mb-2">
                    <div className="dsp9 text-xl" style={{ color: "#fff" }}>GROUP STANDINGS</div>
                    <div className="eyebrow">TOP 2 ADVANCE TO THE 2ND ROUND · WIN 2 PTS / LOSS 1 PT</div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="eyebrow text-left" style={{ fontSize: 10 }}>
                        <th className="py-1 pr-2">#</th><th>TEAM</th>
                        <th className="text-center">W</th><th className="text-center">L</th>
                        <th className="text-center">PF</th><th className="text-center">PA</th>
                        <th className="text-center">+/−</th><th className="text-center">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupTable.map((r, ri) => (
                        <tr key={r.id} className="dsp" style={{
                          background: ri < 2 ? "linear-gradient(90deg, rgba(232,70,90,.12), transparent)" : "transparent",
                          color: r.id === "me" ? "#ff8b98" : "#dbe4f0",
                          borderTop: "1px solid #1c2333",
                          opacity: ri < 2 ? 1 : 0.45,
                        }}>
                          <td className="py-1.5 pr-2">{ri + 1}{ri < 2 && <span style={{ color: "#7ee2a8" }}> ▲</span>}</td>
                          <td style={{ color: r.id === "me" ? "#ff8b98" : r.c }}>
                            {r.name.toUpperCase()}</td>
                          <td className="text-center">{r.w}</td><td className="text-center">{r.l}</td>
                          <td className="text-center">{r.pf}</td><td className="text-center">{r.pa}</td>
                          <td className="text-center">{r.diff > 0 ? "+" : ""}{r.diff}</td>
                          <td className="text-center dsp9">{r.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-[11px] mt-2" style={{ color: "#5f6b7d" }}>
                    OTHER RESULTS — {rivalGames.map((rg) => {
                      const A = gauntlet[rg.a], B = gauntlet[rg.b];
                      return `${A.name} '${A.season.slice(2)} ${rg.sa}–${rg.sb} ${B.name} '${B.season.slice(2)}`;
                    }).join("   ·   ")}
                  </div>
                </div>
              )}

              {/* 2nd-round standings */}
              {i === 4 && r2Table && (
                <div className="panel p-4 mb-3 pop">
                  <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                    <div className="dsp9 text-xl" style={{ color: "#fff" }}>2ND ROUND STANDINGS</div>
                    <div className="eyebrow">TOP 2 REACH THE QUARTERFINALS · RESULTS CARRY OVER</div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="eyebrow text-left" style={{ fontSize: 10 }}>
                        <th className="py-1 pr-2">#</th><th>TEAM</th>
                        <th className="text-center">W</th><th className="text-center">L</th>
                        <th className="text-center">PF</th><th className="text-center">PA</th>
                        <th className="text-center">+/−</th><th className="text-center">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r2Table.map((r, ri) => (
                        <tr key={r.id} className="dsp" style={{
                          background: ri < 2 ? "linear-gradient(90deg, rgba(232,70,90,.12), transparent)" : "transparent",
                          color: r.id === "me" ? "#ff8b98" : "#dbe4f0",
                          borderTop: "1px solid #1c2333",
                          opacity: ri < 2 ? 1 : 0.45,
                        }}>
                          <td className="py-1.5 pr-2">{ri + 1}{ri < 2 && <span style={{ color: "#7ee2a8" }}> ▲</span>}</td>
                          <td style={{ color: r.id === "me" ? "#ff8b98" : r.c }}>{r.name.toUpperCase()}</td>
                          <td className="text-center">{r.w}</td><td className="text-center">{r.l}</td>
                          <td className="text-center">{r.pf}</td><td className="text-center">{r.pa}</td>
                          <td className="text-center">{r.diff > 0 ? "+" : ""}{r.diff}</td>
                          <td className="text-center dsp9">{r.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-[11px] mt-2" style={{ color: "#5f6b7d" }}>
                    CARRIED OVER — YOUR FIVE {r2.carried.my}–{r2.carried.op} {r2.rival.name.toUpperCase()} '{r2.rival.season.slice(2)}
                    {"   ·   "}{gauntlet[3].name} '{gauntlet[3].season.slice(2)} {r2.abCarry.sa}–{r2.abCarry.sb} {gauntlet[4].name} '{gauntlet[4].season.slice(2)}
                    <br />
                    OTHER RESULTS — {r2.rival.name} '{r2.rival.season.slice(2)} {r2.rivalVsA.sa}–{r2.rivalVsA.sb} {gauntlet[3].name} '{gauntlet[3].season.slice(2)}
                    {"   ·   "}{r2.rival.name} '{r2.rival.season.slice(2)} {r2.rivalVsB.sa}–{r2.rivalVsB.sb} {gauntlet[4].name} '{gauntlet[4].season.slice(2)}
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}

          {/* live game */}
          {live && (
            <div className="panel mt-5 overflow-hidden pop">
              <div className="flex items-center justify-between px-4 pt-2">
                <span className="eyebrow">
                  <span style={{ color: "#E8465A" }}>● LIVE</span> — {live.round}
                </span>
                <span className="dsp text-sm" style={{ color: "#93a1b5" }}>{live.clock}</span>
              </div>
              <div className="grid items-stretch mt-1" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                <div className="flex items-center px-4 py-3"
                  style={{ background: "linear-gradient(90deg,#E8465A22,transparent)", borderLeft: "4px solid #E8465A" }}>
                  <span className="dsp9 text-lg" style={{ color: "#fff" }}>YOUR FIVE</span>
                </div>
                <div className="scoreNum text-5xl px-5 flex items-center"
                  style={{ background: "#0b0e15", borderTop: "1px solid #232b3d", borderBottom: "1px solid #232b3d" }}>
                  {live.my}<span style={{ color: "#3d486c", padding: "0 8px", fontSize: 26 }}>—</span>{live.op}
                </div>
                <div className="flex items-center justify-end px-4 py-3"
                  style={{ background: `linear-gradient(270deg, ${oppColor(live.opp)}33, transparent)`, borderRight: `4px solid ${oppColor(live.opp)}` }}>
                  <span className="dsp9 text-lg" style={{ color: "#fff" }}>{live.opp.name.toUpperCase()} '{live.opp.season.slice(2)}</span>
                </div>
              </div>
              {speed === "slow" && (
                <div className="px-4 py-3" style={{ borderTop: "1px solid #1c2333" }}>
                  {live.feed.length === 0 && <div className="eyebrow">TIP-OFF…</div>}
                  {live.feed.map((f, fi) => (
                    <div key={fi} className="flex gap-3 py-0.5 text-sm slideL"
                      style={{ opacity: 0.45 + (fi / Math.max(live.feed.length - 1, 1)) * 0.55 }}>
                      <span className="dsp" style={{ color: "#5f6b7d", minWidth: 62 }}>{f.clock}</span>
                      <span style={{ color: f.team === "me" ? "#ff8b98" : "#93a1b5" }}>{f.text}</span>
                      <span className="dsp ml-auto" style={{ color: "#5f6b7d" }}>{f.my}–{f.op}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* next game */}
          {screen === "sim" && !live && dreamTeamMode && (
            <div ref={ctaAnchorRef} className="panel text-center mt-5 p-5">
              <div className="eyebrow mb-1">BONUS GAME — FACE THE DREAM TEAM</div>
              <div className="dsp9 text-2xl mb-3" style={{ color: "#fff" }}>
                YOUR FIVE <span style={{ color: "#E8465A" }}>VS</span>{" "}
                <span style={{ color: oppColor(DREAM_TEAM) }}>
                  {DREAM_TEAM.name} '{DREAM_TEAM.season.slice(2)}
                </span>
                <span className="eyebrow ml-2">OVR {teamRating(DREAM_TEAM).toFixed(0)}</span>
              </div>
              <button onClick={playDreamTeam} className="btnP skew dsp9 text-base sm:text-xl px-6 sm:px-10 py-3 w-full max-w-sm mx-auto sm:w-auto">
                <span className="unskew">🏀 PLAY THE DREAM TEAM<BtnArrow /></span>
              </button>
            </div>
          )}
          {screen === "sim" && !live && !dreamTeamMode && tournamentGames.length < 8 && (
            <div ref={ctaAnchorRef} className="panel text-center mt-5 p-5">
              <div className="eyebrow mb-1">NEXT UP — {ROUNDS[gi]}</div>
              <div className="dsp9 text-2xl mb-3" style={{ color: "#fff" }}>
                YOUR FIVE <span style={{ color: "#E8465A" }}>VS</span>{" "}
                <span style={{ color: oppColor(gauntlet[gi]) }}>
                  {gauntlet[gi].name.toUpperCase()} '{gauntlet[gi].season.slice(2)}
                </span>
                <span className="eyebrow ml-2">OVR {teamRating(gauntlet[gi]).toFixed(0)}</span>
              </div>
              <button onClick={playNext} className="btnP skew dsp9 text-base sm:text-xl px-6 sm:px-10 py-3 w-full max-w-sm mx-auto sm:w-auto">
                <span className="unskew">🏀 PLAY {ROUNDS[gi]}<BtnArrow /></span>
              </button>
            </div>
          )}

          {/* endings — compact recap */}
          {screen === "done" && runStats && (
            <div className="mt-4 pop">
              <div className="flex flex-col gap-2 mb-4">
                {games.map((g, i) => <MatchSummaryCard key={i} g={g} i={i} />)}
              </div>

              <RunSummaryHero
                perfect={perfect}
                eliminated={eliminated}
                groupOut={groupOut}
                r2Out={r2Out}
                runStats={runStats}
              />

              <p className="text-center mt-4 text-sm px-2" style={{ color: "#93a1b5" }}>
                {perfect
                  ? dreamGamePlayed && dreamGame
                    ? dreamGame.my > dreamGame.op
                      ? "You beat the Dream Team. There is nothing left to prove."
                      : "The Dream Team wins again. Some legends are untouchable."
                    : "World champions! Eight wins, every one by double digits. So the remaining question is. Are you better than the legendary Dream Team?"
                  : eliminated
                    ? (groupOut
                      ? "Finished outside the top 2 of your group — the tournament goes on without you."
                      : r2Out
                        ? "Outside the top 2 of the 2nd-round group — the quarterfinals go on without you."
                        : `${wins} win${wins !== 1 ? "s" : ""} — the World Cup claims another five.`)
                    : "Unbeaten through all eight, but not every win hit double digits. The Perfect Sweep escapes you."}
              </p>

              <div ref={ctaAnchorRef} className="mt-6 flex flex-col gap-3">
                {perfect && !dreamGamePlayed && (
                  <button onClick={faceDreamTeam} className="btnP skew dsp9 text-lg px-8 py-3.5 w-full">
                    <span className="unskew whitespace-nowrap">🏀{"\u00A0"}FACE THE DREAM TEAM<BtnArrow /></span>
                  </button>
                )}
                <button onClick={() => setScreen("card")} className={`skew dsp9 text-lg px-8 py-3.5 w-full ${perfect && !dreamGamePlayed ? "chip btnG" : "btnP"}`}>
                  <span className="unskew whitespace-nowrap">🏆{"\u00A0"}TOURNAMENT CARD{perfect && !dreamGamePlayed ? "" : <BtnArrow />}</span>
                </button>
                <button onClick={reset} className="skew chip dsp9 text-base px-6 py-2.5 btnG w-full sm:w-auto sm:self-start">
                  <span className="unskew whitespace-nowrap">⟳{"\u00A0"}RUN IT BACK</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ TOURNAMENT CARD ============ */}
      {screen === "card" && runStats && (
        <div className="max-w-3xl mx-auto px-4 py-6 pop">
          <div className="panel text-left p-5">
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setScreen("done")} className="skew chip dsp px-3 py-1.5 text-sm btnG shrink-0">
                  <span className="unskew">← BACK</span>
                </button>
                <div className="flex-1 flex justify-center min-w-0 px-1">
                  <span className="cardRunMeta truncate" style={{ fontSize: 11, letterSpacing: ".05em" }}>
                    {runStats.resultLabel}
                  </span>
                </div>
                <button onClick={shareLink} className="skew chip dsp px-4 py-1.5 text-sm btnP shrink-0" style={{ textAlign: "center" }}>
                  <span className="unskew">{linkCopied ? "✓ LINK COPIED" : "🔗 SHARE"}</span>
                </button>
              </div>
              <div className="cardRunMeta mt-3 sm:mt-2">
                <span className="flex gap-2">
                  {runStats.margins.map((m, i) => (
                    <span key={i} style={{ color: marginColor(m) }}>
                      {m > 0 ? `+${m}` : m}
                    </span>
                  ))}
                </span>
              </div>
            </div>

            {runStats.players.map((p) => (
              <div key={p.pos + p.name} className="flex items-center gap-3 px-2 py-2"
                style={{ borderTop: "1px solid #1c2333" }}>
                <Gem rt={p.rt} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="dsp text-base truncate" style={{ color: "#fff" }}>
                    {p.pos} · #{p.n} {p.name}
                  </div>
                  <div className="text-[11px]" style={{ color: "#5f6b7d" }}>{p.team} '{p.season.slice(2)}</div>
                </div>
                <div className="text-right">
                  <div className="dsp9 text-lg" style={{ color: "#ff8b98" }}>{p.ppg.toFixed(1)} <span className="text-xs" style={{ color: "#5f6b7d" }}>PPG</span></div>
                  <div className="text-[11px]" style={{ color: "#5f6b7d" }}>BEST {p.best} · TOTAL {p.tot}</div>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-5 gap-2 mt-3 pt-3" style={{ borderTop: "1px solid #232b3d" }}>
              {[
                [`OVR ${runStats.ovr}`, "TEAM RATING"],
                [runStats.ppgF.toFixed(1), "PTS FOR / G"],
                [runStats.ppgA.toFixed(1), "PTS AGAINST / G"],
                [`${runStats.avgMargin > 0 ? "+" : ""}${runStats.avgMargin.toFixed(1)}`, "AVG MARGIN"],
                [`+${runStats.bigWin}`, "BIGGEST WIN"],
              ].map(([v, l]) => (
                <div key={l} className="text-center">
                  <div className="dsp9 text-xl" style={{ color: "#EAF0F7" }}>{v}</div>
                  <div className="eyebrow" style={{ fontSize: 9 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 mt-6 px-4 max-w-md sm:max-w-none mx-auto">
            <button onClick={() => setScreen("done")} className="skew chip dsp9 text-base sm:text-lg px-6 sm:px-8 py-3 btnG">
              <span className="unskew whitespace-nowrap">← BACK TO RESULTS</span>
            </button>
            <button onClick={reset} className="skew chip dsp9 text-base sm:text-lg px-6 sm:px-8 py-3 btnP">
              <span className="unskew whitespace-nowrap">RUN IT BACK<BtnArrow /></span>
            </button>
          </div>
        </div>
      )}

      <div className="text-center eyebrow py-6">
        PERFECT SWEEP · WORLD CUP EDITION
      </div>
    </div>
  );
}
