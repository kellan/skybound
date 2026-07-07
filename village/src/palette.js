// ABOUTME: single source of truth for the warm paper-diorama color palette
// ABOUTME: tweak colors here — every module imports from this file

// Paper-UI colors for the DOM the village view injects (labels, cards,
// picker). Kept beside the 3D palette so the diorama and its chrome move
// together instead of drifting via hardcoded hex in CSS strings.
export const UI = {
  paper: "#fff8e8",
  ink: "#3a2a14",
  inkSoft: "#6b5a3a",
};

export const PALETTE = {
  sky: "#f2e8d3",

  grassLow: "#9fb46b",
  grassHigh: "#c4d38f",
  sand: "#e2cf9d",
  dirt: "#9b7b56",
  dirtDeep: "#6f5638",
  water: "#8fbfd2",
  waterDeep: "#6fa8bc",

  wood: "#8c6844",
  woodDark: "#6b4d31",
  plaster: "#f2e3c2",
  plasterWarm: "#ecd9ae",

  mushroomCap: "#c65948",
  mushroomSpot: "#f7efdc",
  mushroomStem: "#efe2c4",

  cottageRoof: "#a05f43",
  thatch: "#d3a05c",
  thatchDark: "#a97c41",

  tentA: "#e8d7ae",
  tentB: "#c98f6a",
  flag: "#c65948",

  leaf: "#7ea45c",
  leafDark: "#5d8544",
  leafLight: "#a3c076",
  pine: "#6b9153",
  berry: "#d6494f",
  grape: "#8a5f9e",
  blossom: "#e8a0b4",
  rock: "#b0a68e",
  lantern: "#ffd98a",
  smoke: "#efe8da",
};
