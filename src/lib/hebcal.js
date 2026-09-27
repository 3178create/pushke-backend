// Real integration with Hebcal's free public API for candle-lighting /
// Havdalah times, used to open/close the weekly pledge window.
// Docs: https://www.hebcal.com/home/195/shabbat-havdalah-times-rest-api

const fetch = require("node-fetch");

async function getShabbatTimes({ lat, lng, tzid }) {
  const url = new URL("https://www.hebcal.com/shabbat");
  url.searchParams.set("cfg", "json");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lng);
  if (tzid) url.searchParams.set("tzid", tzid);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Hebcal request failed: ${res.status}`);
  const data = await res.json();

  const candles = data.items?.find((i) => i.category === "candles");
  const havdalah = data.items?.find((i) => i.category === "havdalah");

  return {
    candleLighting: candles?.date || null, // ISO string, ~18 min before sunset Friday
    havdalah: havdalah?.date || null,
  };
}

module.exports = { getShabbatTimes };
