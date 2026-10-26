// ---------- 1. Settings ----------
// Free key: https://openweathermap.org/api  (new keys may take up to a couple of hours to activate)
const API_KEY = "PASTE_YOUR_API_KEY_HERE";
const BASE_URL = "https://api.openweathermap.org/data/2.5";

// ---------- 2. Page elements ----------
const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const loader = document.getElementById("loader");
const errorBox = document.getElementById("error");
const result = document.getElementById("result");
const welcome = document.getElementById("welcome");
const scene = document.getElementById("scene");

// ---------- 3. Screen states ----------
function showOnly(state, message) {
  loader.hidden = state !== "loading";
  result.hidden = state !== "result";
  welcome.hidden = state !== "welcome";
  errorBox.hidden = state !== "error";
  if (state === "error") errorBox.textContent = message;
}

// ---------- 4. Talking to the API ----------
// fetch() only fails when there is no internet. A wrong city still "succeeds" with a
// 404 status, so we check the status code ourselves.
async function getJSON(url) {
  const response = await fetch(url);
  if (response.status === 404) throw new Error("CITY_NOT_FOUND");
  if (response.status === 401) throw new Error("BAD_KEY");
  if (!response.ok) throw new Error("SERVER_ERROR");
  return response.json();
}

// Sample data, used ONLY while the API key has not been added yet,
// so you can check that the page itself works.
function demoData(city) {
  const midnight = Math.floor(Date.now() / 86400000) * 86400;
  const current = {
    name: city, sys: { country: "DEMO", sunrise: midnight + 5400, sunset: midnight + 45000 }, timezone: 18000,
    weather: [{ main: "Clear", description: "clear sky", icon: "01d" }],
    main: { temp: 22.4, feels_like: 21.2, temp_min: 14.8, temp_max: 26.1, humidity: 34, pressure: 1016 },
    wind: { speed: 3.2 }, visibility: 10000
  };
  const icons = ["01d", "02d", "10d", "03d", "13d"];
  const list = [];
  for (let day = 1; day <= 5; day++) {
    const date = new Date(Date.now() + day * 86400000).toISOString().split("T")[0];
    for (let h = 0; h < 24; h += 3) {
      list.push({
        dt_txt: `${date} ${String(h).padStart(2, "0")}:00:00`,
        main: { temp: 16 + day + Math.sin(h / 4) * 6 },
        weather: [{ description: ["clear sky", "few clouds", "light rain", "scattered clouds", "light snow"][day - 1], icon: icons[day - 1] }]
      });
    }
  }
  return [current, { list }];
}

async function searchCity(city) {
  const demoMode = API_KEY === "PASTE_YOUR_API_KEY_HERE";
  document.getElementById("demo-note").hidden = !demoMode;

  showOnly("loading");

  try {
    const q = encodeURIComponent(city);
    // Both requests start at the same time; we wait until both are done
    const [current, forecast] = demoMode
      ? demoData(city)
      : await Promise.all([
          getJSON(`${BASE_URL}/weather?q=${q}&units=metric&appid=${API_KEY}`),
          getJSON(`${BASE_URL}/forecast?q=${q}&units=metric&appid=${API_KEY}`)
        ]);

    renderCurrent(current);
    renderForecast(forecast);
    setTheme(current);
    showOnly("result");
    if (!demoMode) localStorage.setItem("skycast.lastCity", current.name);
  } catch (err) {
    console.error(err); // open DevTools (F12) > Console to see the real reason
    const messages = {
      CITY_NOT_FOUND: `We couldn't find "${city}". Check the spelling and try again.`,
      BAD_KEY: "The API key isn't valid yet. New keys can take a couple of hours to activate.",
      SERVER_ERROR: "The weather service had a problem. Please try again in a moment."
    };
    showOnly("error", messages[err.message] || `Something went wrong: ${err.message}`);
  }
}

// ---------- 5. Drawing the data ----------
const iconUrl = (code, size = "2x") => `https://openweathermap.org/img/wn/${code}@${size}.png`;

// The API gives times as UTC seconds. Adding the city's timezone offset gives the city's local time.
function cityTime(unixSeconds, offsetSeconds) {
  return new Date((unixSeconds + offsetSeconds) * 1000).toISOString().slice(11, 16);
}

function renderCurrent(d) {
  const w = d.weather[0];
  const localNow = new Date(Date.now() + d.timezone * 1000);

  document.getElementById("city-name").textContent = `${d.name}, ${d.sys.country}`;
  document.getElementById("date").textContent =
    localNow.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) +
    " · " + localNow.toISOString().slice(11, 16);
  document.getElementById("temp").textContent = Math.round(d.main.temp);
  document.getElementById("desc").textContent = w.description;
  document.getElementById("range").textContent =
    `Feels like ${Math.round(d.main.feels_like)}°  ·  H ${Math.round(d.main.temp_max)}°  L ${Math.round(d.main.temp_min)}°`;

  document.getElementById("humidity").textContent = `${d.main.humidity}%`;
  document.getElementById("wind").textContent = `${Math.round(d.wind.speed * 3.6)} km/h`; // m/s -> km/h
  document.getElementById("pressure").textContent = `${d.main.pressure} hPa`;
  document.getElementById("visibility").textContent = d.visibility ? `${(d.visibility / 1000).toFixed(1)} km` : "N/A";
  document.getElementById("sunrise").textContent = cityTime(d.sys.sunrise, d.timezone);
  document.getElementById("sunset").textContent = cityTime(d.sys.sunset, d.timezone);

  const icon = document.getElementById("icon");
  icon.src = iconUrl(w.icon, "4x");
  icon.alt = w.description;
}

function renderForecast(data) {
  // 40 readings (every 3 hours) -> group by date
  const days = {};
  data.list.forEach(item => {
    const date = item.dt_txt.split(" ")[0];
    (days[date] = days[date] || []).push(item);
  });

  const today = new Date().toISOString().split("T")[0];

  const cards = Object.keys(days)
    .filter(date => date !== today)
    .slice(0, 5)
    .map(date => {
      const items = days[date];
      const temps = items.map(i => i.main.temp);
      const midday = items.find(i => i.dt_txt.includes("12:00:00")) || items[0];
      const day = new Date(date);
      return `
        <div class="day">
          <div class="name">${day.toLocaleDateString("en-GB", { weekday: "short" })}</div>
          <div class="dt">${day.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
          <img src="${iconUrl(midday.weather[0].icon.replace("n", "d"))}" alt="">
          <div class="cond">${midday.weather[0].description}</div>
          <span class="hi">${Math.round(Math.max(...temps))}°</span><span class="lo">${Math.round(Math.min(...temps))}°</span>
        </div>`;
    });

  document.getElementById("forecast").innerHTML = cards.join("");
}

// ---------- 6. Theme + animated scene ----------
function setTheme(d) {
  const main = d.weather[0].main.toLowerCase();
  const isNight = d.weather[0].icon.endsWith("n");

  let theme = "clouds";
  if (main === "clear") theme = isNight ? "clear-night" : "clear-day";
  else if (main === "rain" || main === "drizzle") theme = "rain";
  else if (main === "thunderstorm") theme = "thunderstorm";
  else if (main === "snow") theme = "snow";
  else if (["mist", "fog", "haze", "smoke", "dust", "sand"].includes(main)) theme = "mist";

  applyTheme(theme);
}

const rand = (min, max) => Math.random() * (max - min) + min;

// Small helper: create <div class="..."> with inline styles
function add(className, styles) {
  const el = document.createElement("div");
  el.className = className;
  for (const [key, value] of Object.entries(styles)) {
    if (key.startsWith("--")) el.style.setProperty(key, value); // CSS variables
    else el.style[key] = value;
  }
  scene.appendChild(el);
}

function applyTheme(theme) {
  document.body.className = `theme-${theme}`;
  scene.innerHTML = "";

  // Clouds: how many depends on the weather
  const cloudCount = { "clear-day": 2, "clear-night": 2, clouds: 6, rain: 5, thunderstorm: 5, snow: 4, mist: 5 }[theme];
  for (let i = 0; i < cloudCount; i++) {
    add("cloud", {
      "--w": `${rand(160, 320)}px`, top: `${rand(4, 45)}%`,
      animationDuration: `${rand(60, 130)}s`, animationDelay: `-${rand(0, 120)}s`
    });
  }

  if (theme === "clear-day") add("sun", {});

  if (theme === "clear-night") {
    add("moon", {});
    for (let i = 0; i < 70; i++) {
      add("star", { left: `${rand(0, 100)}%`, top: `${rand(0, 70)}%`, animationDelay: `${rand(0, 3)}s` });
    }
  }

  if (theme === "rain" || theme === "thunderstorm") {
    for (let i = 0; i < 90; i++) {
      add("drop", { left: `${rand(0, 100)}%`, animationDuration: `${rand(.6, 1.1)}s`, animationDelay: `-${rand(0, 1.2)}s` });
    }
  }
  if (theme === "thunderstorm") add("flash", {});

  if (theme === "snow") {
    for (let i = 0; i < 70; i++) {
      const size = rand(3, 7);
      add("flake", { left: `${rand(0, 100)}%`, width: `${size}px`, height: `${size}px`, animationDuration: `${rand(6, 12)}s`, animationDelay: `-${rand(0, 12)}s` });
    }
  }
}

// ---------- 7. Events ----------
form.addEventListener("submit", e => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (!city) { showOnly("error", "Please enter a city name."); return; }
  searchCity(city);
});

// Quick-pick city buttons on the welcome screen
document.querySelector(".quick").addEventListener("click", e => {
  if (e.target.dataset.city) {
    cityInput.value = e.target.dataset.city;
    searchCity(e.target.dataset.city);
  }
});

// ---------- 8. Start ----------
applyTheme("clear-day");   // show a sunny scene on the welcome screen
const lastCity = localStorage.getItem("skycast.lastCity");
if (lastCity) {
  cityInput.value = lastCity;
  searchCity(lastCity);
}
