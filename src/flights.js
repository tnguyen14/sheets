// @ts-check
import { config as appConfig } from "./config.js";
import * as sheets from "./sheets.js";

const config = appConfig.flights;

/**
 * Get all valid trips (filtered by required columns).
 * @return {Promise<Record<string, any>[]>}
 */
export async function getTrips() {
  const rows = await sheets.getRangeValues(
    config.spreadsheetId,
    `${config.trips.sheetName}!${config.trips.columnRange}`,
  );
  if (rows.length === 0) {
    return [];
  }

  const [headers, ...dataRows] = rows;
  const requiredIndexes = config.trips.requiredColumns.map((header) =>
    headers.indexOf(header),
  );
  const hasRequiredTripFields = (row) =>
    requiredIndexes.every((index) => index >= 0 && isNonEmpty(row[index]));

  return dataRows.filter(hasRequiredTripFields).map((row) => {
    const record = {};
    headers.forEach((header, i) => {
      record[header] = row[i] ?? null;
    });
    return record;
  });
}

/**
 * Get completed trips grouped by year.
 * @return {Promise<Record<string, Record<string, any>[]>>}
 */
export async function getCompletedTrips() {
  const trips = await getTrips();
  const completed = trips.filter((trip) => trip.Flown === "Y");
  return completed.reduce((acc, trip) => {
    const year = getTripYear(trip);
    if (!year) {
      return acc;
    }
    acc[year] ??= [];
    acc[year].push(trip);
    return acc;
  }, {});
}

/**
 * Get pending trips (not yet flown).
 * @return {Promise<Record<string, any>[]>}
 */
export async function getPendingTrips() {
  const trips = await getTrips();
  return trips.filter((trip) => trip.Flown !== "Y");
}

/**
 * Extract a 4-digit year from a trip's "Flight date".
 * @param {Record<string, any>} trip
 * @return {string|null}
 */
function getTripYear(trip) {
  const flightDate = trip["Flight date"];
  const match = flightDate.match(/\b(?:19|20)\d{2}\b/);
  return match ? match[0] : null;
}

/**
 * Check if a value is non-empty.
 * @param {any} value
 * @return {boolean}
 */
function isNonEmpty(value) {
  return value != null && String(value).trim() !== "";
}
