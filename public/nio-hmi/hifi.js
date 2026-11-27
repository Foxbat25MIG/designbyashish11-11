  // Scale each 1440 x 900 frame to the width of its container.
  const fit = () => document.querySelectorAll('.scaler').forEach(s => s.style.setProperty('--s', s.clientWidth / 1440));
  addEventListener('resize', fit); fit();
  if (document.fonts) document.fonts.ready.then(fit);
  // Live values are remembered so app views opened later (cloned templates) can be filled too.
  const LIVE = {};
  const L = (k, v) => { LIVE[k] = v; document.querySelectorAll(`[data-live="${k}"]`).forEach(e => e.textContent = v); };
  window.nioLive = () => Object.entries(LIVE).forEach(([k, v]) => document.querySelectorAll(`[data-live="${k}"]`).forEach(e => e.textContent = v));
  // Live date (viewer's today) and live Luxembourg weather (Open-Meteo, no key).
  (() => {
    const d = new Date();
    const dateText = d.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'});
    L('date', dateText);
    const tm = new Date(d.getTime() + 864e5);
    L('tomorrow', tm.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'}));
    const codes = window.nioCodes = [[0,'clear','clear_day'],[1,'mostly clear','partly_cloudy_day'],[2,'partly cloudy','partly_cloudy_day'],[3,'overcast','cloud'],[45,'foggy','foggy'],[48,'foggy','foggy'],[51,'drizzle','rainy'],[61,'rain','rainy'],[63,'rain','rainy'],[65,'heavy rain','rainy'],[71,'snow','weather_snowy'],[73,'snow','weather_snowy'],[75,'heavy snow','weather_snowy'],[80,'showers','rainy'],[81,'showers','rainy'],[82,'heavy showers','rainy'],[85,'snow showers','weather_snowy'],[95,'thunderstorms','thunderstorm']];
    fetch('https://api.open-meteo.com/v1/forecast?latitude=49.61&longitude=6.13&current=temperature_2m,weather_code&daily=sunset&forecast_days=1&timezone=Europe%2FLuxembourg')
      .then(r => r.json()).then(j => {
        const t = Math.round(j.current.temperature_2m), c = j.current.weather_code;
        const m = codes.filter(x => x[0] <= c).pop() || codes[0];
        L('temp', t + ' °C');
        L('wtext', m[1]);
        L('wicon', m[2]);
        if (j.daily && j.daily.sunset) L('sunset', j.daily.sunset[0].slice(11, 16));
      }).catch(() => {
        L('temp', '8 °C');
        L('wtext', 'weather unavailable');
      });
    fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=49.61&longitude=6.13&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&timezone=Europe%2FLuxembourg')
      .then(r => r.json()).then(j => {
        const c = j.current, aqi = Math.round(c.european_aqi);
        const band = aqi <= 20 ? 'Good' : aqi <= 40 ? 'Fair' : aqi <= 60 ? 'Moderate' : aqi <= 80 ? 'Poor' : aqi <= 100 ? 'Very poor' : 'Extremely poor';
        const pol = ['alder_pollen','birch_pollen','grass_pollen','mugwort_pollen','olive_pollen','ragweed_pollen'].map(k => c[k]).filter(v => v != null);
        const pmax = pol.length ? Math.max(...pol) : 0;
        const plevel = pmax < 1 ? 'None' : pmax < 20 ? 'Low' : pmax < 100 ? 'Medium' : 'High';
        L('aqi', 'AQI ' + aqi);
        L('aqitext', band + ' · live');
        L('pollen', plevel);
        L('pollentext', 'live · Luxembourg');
      }).catch(() => {
        L('aqi', 'AQI 18');
        L('aqitext', 'offline example');
        L('pollen', 'Low');
        L('pollentext', 'offline example');
      });
  })();

