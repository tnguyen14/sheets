import { readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";

/**
 * @typedef {Object} Trips
 * @property {string} sheetName
 * @property {string} columnRange
 * @property {string[]} requiredColumns
 */

/**
 * @typedef {Object} Flights
 * @property {string} spreadsheetId
 * @property {Trips} trips
 */

/**
 * @typedef {Object} Public
 * @property {string[]} spreadsheets
 */

/**
 * @typedef {Object} Auth
 * @property {Object.<string, string>} machines - Auth0 M2M client_id -> email
 */

/**
 * @typedef {Object} Config
 * @property {Public} public
 * @property {Flights} flights
 * @property {Auth} [auth]
 */

/** @type {Config} */
export const config = parseToml(readFileSync("./config.toml", "utf8"));
