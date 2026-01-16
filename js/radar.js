// js/radar.js

// =========================
// METRIC CONFIG
// =========================
const overviewMetrics = [
  { label: "Finishing & xG",      pctKey: "finishing_score_pct",       rawKey: "finishing_score" },
  { label: "Chance Creation",    pctKey: "chance_creation_score_pct", rawKey: "chance_creation_score" },
  { label: "Ball Progression",   pctKey: "progression_score_pct",     rawKey: "progression_score" },
  { label: "Dribbling & On-Ball",pctKey: "dribbling_onball_score_pct",rawKey: "dribbling_onball_score" }
];

const detailConfigs = {
  finishing: {
    metrics: [
      { key: "shots",                    label: "Shots" },
      { key: "xg",                       label: "xG" },
      { key: "goals",                    label: "Goals" },
      { key: "xg_per_shot",              label: "xG / Shot" },
      { key: "execution_value_per_shot", label: "Execution / Shot" }
    ]
  },
  creation: {
    metrics: [
      { key: "touches_final_third",    label: "Touches Final 3rd" },
      { key: "touches_in_box",         label: "Touches in Box" },
      { key: "key_passes_final_third", label: "Key Passes (FT)" },
      { key: "assists_final_third",    label: "Assists (FT)" },
      { key: "passes_into_box",        label: "Passes into Box" }
    ]
  },
  progression: {
    metrics: [
      { key: "deep_touches",                label: "Deep Touches" },
      { key: "deep_completions",            label: "Deep Completions" },
      { key: "deep_progressions_pass",      label: "Deep Prog. Pass" },
      { key: "deep_progressions_carry",     label: "Deep Prog. Carry" },
      { key: "deep_progressions_pass_deep", label: "Prog. Pass -> DZ" }
    ]
  },
  dribbling: {
    metrics: [
      { key: "dribbles_attempted_ft", label: "Dribbles Attempted" },
      { key: "dribbles_completed_ft", label: "Dribbles Completed" },
      { key: "dribble_success_ft",    label: "Dribble Success %" },
      { key: "fouls_won_ft",          label: "Fouls Won" },
      { key: "touches_final_third",   label: "Touches Final 3rd" }
    ]
  }
};

const radarCategoryTitles = {
  overview: "Overview",
  finishing: "Finishing & xG",
  creation: "Chance Creation",
  progression: "Ball Progression",
  dribbling: "Dribbling & On-Ball"
};

// =========================
// DOM
// =========================
const mainSvg = d3.select("#radar-svg");
const tooltip = d3.select("#tooltip");

let players = [];
let currentPlayerId = null;
let currentRadarType = "overview";

const radarDataBase = document.body.dataset.radarBase || "data";

// =========================
// LOAD DATA
// =========================
Promise.all([
  d3.csv(`${radarDataBase}/liverpool_offense_radar.csv`),
  d3.csv(`${radarDataBase}/liverpool_shot_metrics.csv`)
]).then(([overviewData, shotData]) => {
  // parse numeric in overview
  overviewData.forEach(d => {
    overviewMetrics.forEach(m => {
      if (d[m.rawKey] !== undefined) d[m.rawKey] = d[m.rawKey] === "" ? null : +d[m.rawKey];
      if (d[m.pctKey] !== undefined) d[m.pctKey] = d[m.pctKey] === "" ? null : +d[m.pctKey];
    });
  });

  // parse numeric in shot metrics
  shotData.forEach(d => {
    Object.keys(d).forEach(key => {
      if (key === "player_name" || key === "player_id") return;
      const v = +d[key];
      if (!isNaN(v)) d[key] = v;
    });
  });

  // merge by row index (your assumption)
  const merged = overviewData.map((d, i) => ({ ...shotData[i], ...d }));
  players = merged;

  // offense_index (mean of overview percentiles)
  players.forEach(d => {
    const vals = overviewMetrics.map(m => d[m.pctKey]).filter(v => v != null && !isNaN(v));
    d.offense_index = vals.length ? d3.mean(vals) : 0;
  });

  // percentile ranks for detail keys
  const allDetailKeys = new Set();
  Object.values(detailConfigs).forEach(cfg => cfg.metrics.forEach(m => allDetailKeys.add(m.key)));

  allDetailKeys.forEach(key => {
    const vals = players.map(p => p[key]).filter(v => v != null && !isNaN(v)).sort(d3.ascending);
    if (!vals.length) return;

    players.forEach(p => {
      const raw = p[key];
      let pct = 0;
      if (raw != null && !isNaN(raw)) {
        let idx = d3.bisectRight(vals, raw) - 1;
        pct = vals.length === 1 ? 1 : idx / (vals.length - 1);
      }
      p[`${key}_pctRank`] = pct;
    });
  });

  // dropdown
  const select = d3.select("#player-select");
  select.selectAll("option")
    .data(players)
    .enter()
    .append("option")
    .attr("value", d => d.player_id)
    .text(d => d.player_name);

  select.on("change", (event) => setSelectedPlayer(event.target.value));

  buildTopLists();
  setupRadarTypeToggle();

  if (players.length > 0) setSelectedPlayer(players[0].player_id);

}).catch(err => console.error("Radar CSV load failed:", err));

// =========================
// TOP LISTS
// =========================
function buildTopLists() {
  const configs = [
    { pctKey: "finishing_score_pct",        listId: "top-finishing" },
    { pctKey: "chance_creation_score_pct", listId: "top-creation" },
    { pctKey: "progression_score_pct",     listId: "top-progression" },
    { pctKey: "dribbling_onball_score_pct",listId: "top-dribbling" }
  ];

  configs.forEach(cfg => {
    const top = [...players]
      .filter(p => p[cfg.pctKey] != null && !isNaN(p[cfg.pctKey]))
      .sort((a, b) => d3.descending(a[cfg.pctKey], b[cfg.pctKey]))
      .slice(0, 10);

    const list = d3.select(`#${cfg.listId}`);
    const items = list.selectAll(".top-item")
      .data(top, d => d.player_id);

    const enter = items.enter()
      .append("li")
      .attr("class", "top-item")
      .on("click", (_, d) => setSelectedPlayer(d.player_id));

    enter.append("span").attr("class", "name").text(d => d.player_name);
    enter.append("span").attr("class", "score").text(d => `${Math.round(d[cfg.pctKey] * 100)}%`);

    items.exit().remove();
  });
}

// =========================
// SELECTION + BROADCAST
// =========================
function setSelectedPlayer(playerId) {
  const player = players.find(p => String(p.player_id) === String(playerId));
  if (!player) return;

  currentPlayerId = playerId;
  d3.select("#player-select").property("value", playerId);

  d3.selectAll(".top-item")
    .classed("active", d => String(d.player_id) === String(playerId));

  drawMainRadar(player);
  broadcastPlayerSelection(player);
}

const PLAYER_CHANNEL = "liverpool-player-selection-v1";
const bc = ("BroadcastChannel" in window) ? new BroadcastChannel(PLAYER_CHANNEL) : null;

function broadcastPlayerSelection(player) {
  if (!player) return;

  const detail = { playerId: player.player_id, playerName: player.player_name, ts: Date.now() };

  window.dispatchEvent(new CustomEvent("radar:player-selected", { detail }));
  if (bc) bc.postMessage(detail);
  try { localStorage.setItem("radar:player-selected", JSON.stringify(detail)); } catch {}
}

// =========================
// RADAR TYPE TOGGLE
// =========================
function setupRadarTypeToggle() {
  const container = d3.select("#radar-type-toggle");
  if (container.empty()) return;

  const buttons = container.selectAll(".segmented-btn");
  buttons.on("click", function () {
    const btn = d3.select(this);
    const type = btn.attr("data-radar");

    currentRadarType = type;
    buttons.classed("active", false);
    btn.classed("active", true);

    if (currentPlayerId) {
      const player = players.find(p => String(p.player_id) === String(currentPlayerId));
      if (player) drawMainRadar(player);
    }
  });
}

// =========================
// DRAW RADARS
// =========================
function drawMainRadar(player) {
  if (currentRadarType === "overview") drawOverviewRadar(player);
  else {
    const cfg = detailConfigs[currentRadarType];
    if (!cfg) return;
    drawDetailRadar(mainSvg, cfg.metrics, player);
  }
}

function drawOverviewRadar(player) {
  mainSvg.selectAll("*").remove();

  const width = +mainSvg.attr("width");
  const height = +mainSvg.attr("height");
  const margin = 90;
  const radius = Math.min(width, height) / 2 - margin;
  const centerX = width / 2;
  const centerY = height / 2 + 10;
  const angleSlice = (2 * Math.PI) / overviewMetrics.length;

  const g = mainSvg.append("g").attr("transform", `translate(${centerX}, ${centerY})`);

  const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);

  // grid
  const levels = 4;
  for (let lvl = 1; lvl <= levels; lvl++) {
    const frac = lvl / levels;
    const r = radius * frac;
    g.append("circle").attr("class", "grid-line").attr("r", r);
    g.append("text").attr("class", "grid-level-label").attr("x", 6).attr("y", -r + 14).text(frac.toFixed(2));
  }

  // axes
  const axis = g.selectAll(".axis").data(overviewMetrics).enter().append("g").attr("class", "axis");

  axis.append("line")
    .attr("x1", 0).attr("y1", 0)
    .attr("x2", (_, i) => rScale(1) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr("y2", (_, i) => rScale(1) * Math.sin(angleSlice * i - Math.PI / 2))
    .attr("stroke", "rgba(255,255,255,0.18)")
    .attr("stroke-width", 1);

  axis.append("text")
    .attr("class", "axis-label")
    .attr("x", (_, i) => {
      if (i === 0) return 0;
      const angle = angleSlice * i - Math.PI / 2;
      return (radius + 32) * Math.cos(angle);
    })
    .attr("y", (_, i) => {
      if (i === 0) return -radius - 18;
      const angle = angleSlice * i - Math.PI / 2;
      return (radius + 24) * Math.sin(angle);
    })
    .attr("text-anchor", "middle")
    .text(d => d.label);

  // points
  const points = overviewMetrics.map((m, i) => {
    const pctVal = player[m.pctKey];
    let v = pctVal;
    if (v == null || isNaN(v)) v = 0;

    const angle = angleSlice * i - Math.PI / 2;
    const r = rScale(v);
    return { x: r * Math.cos(angle), y: r * Math.sin(angle), pctVal };
  });

  const closedPoints = points.concat([points[0]]);
  const radarLine = d3.line().x(d => d.x).y(d => d.y).curve(d3.curveLinearClosed);

  const radarGroup = g.append("g").attr("class", "radar-group").attr("transform", "scale(0)");

  radarGroup.append("path")
    .datum(closedPoints)
    .attr("class", "radar-area")
    .attr("d", radarLine)
    .attr("fill-opacity", 0.35);

  radarGroup.selectAll(".radar-circle")
    .data(points)
    .enter()
    .append("circle")
    .attr("class", "radar-circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", 4)
    .attr("fill", "#ff5c7a")
    .on("mouseover", () => tooltip.style("opacity", 1))
    .on("mousemove", (event, d) => {
      const val = d.pctVal;
      const text = (val == null || isNaN(val)) ? "–" : String(Math.round(val * 100));
      tooltip.html(text).style("left", (event.clientX + 12) + "px").style("top", (event.clientY + 12) + "px");
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  radarGroup.transition().duration(600).ease(d3.easeCubicOut).attr("transform", "scale(1)");

  // titles
  g.append("text").attr("class", "radar-title").attr("y", -radius - 56).attr("text-anchor", "middle").text(player.player_name);
  g.append("text").attr("class", "radar-subtitle").attr("y", -radius - 32).attr("text-anchor", "middle").text("Overview – Percentiles");
}

function drawDetailRadar(svg, metricDefs, player) {
  svg.selectAll("*").remove();

  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = 90;
  const radius = Math.min(width, height) / 2 - margin;
  const centerX = width / 2;
  const centerY = height / 2 + 10;
  const angleSlice = (2 * Math.PI) / metricDefs.length;

  const g = svg.append("g").attr("transform", `translate(${centerX}, ${centerY})`);
  const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);

  const levels = 4;
  for (let lvl = 1; lvl <= levels; lvl++) {
    const frac = lvl / levels;
    const r = radius * frac;
    g.append("circle").attr("class", "grid-line").attr("r", r);
    g.append("text").attr("class", "grid-level-label").attr("x", 6).attr("y", -r + 14).text(frac.toFixed(2));
  }

  const axis = g.selectAll(".axis").data(metricDefs).enter().append("g").attr("class", "axis");

  axis.append("line")
    .attr("x1", 0).attr("y1", 0)
    .attr("x2", (_, i) => rScale(1) * Math.cos(angleSlice * i - Math.PI / 2))
    .attr("y2", (_, i) => rScale(1) * Math.sin(angleSlice * i - Math.PI / 2))
    .attr("stroke", "rgba(255,255,255,0.18)")
    .attr("stroke-width", 1);

  axis.append("text")
    .attr("class", "axis-label")
    .attr("x", (_, i) => {
      if (i === 0) return 0;
      const angle = angleSlice * i - Math.PI / 2;
      return (radius + 28) * Math.cos(angle);
    })
    .attr("y", (_, i) => {
      if (i === 0) return -radius - 18;
      const angle = angleSlice * i - Math.PI / 2;
      return (radius + 22) * Math.sin(angle);
    })
    .attr("text-anchor", "middle")
    .text(d => d.label);

  const points = metricDefs.map((m, i) => {
    const pctVal = player[`${m.key}_pctRank`];
    let tNorm = pctVal;
    if (tNorm == null || isNaN(tNorm)) tNorm = 0;

    const angle = angleSlice * i - Math.PI / 2;
    const r = rScale(tNorm);
    return { x: r * Math.cos(angle), y: r * Math.sin(angle), pctVal };
  });

  const closedPoints = points.concat([points[0]]);
  const radarLine = d3.line().x(d => d.x).y(d => d.y).curve(d3.curveLinearClosed);

  const radarGroup = g.append("g").attr("class", "radar-group").attr("transform", "scale(0)");

  radarGroup.append("path")
    .datum(closedPoints)
    .attr("class", "radar-area")
    .attr("d", radarLine)
    .attr("fill-opacity", 0.35);

  radarGroup.selectAll(".radar-circle")
    .data(points)
    .enter()
    .append("circle")
    .attr("class", "radar-circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", 4)
    .attr("fill", "#ff5c7a")
    .on("mouseover", () => tooltip.style("opacity", 1))
    .on("mousemove", (event, d) => {
      const val = d.pctVal;
      const text = (val == null || isNaN(val)) ? "–" : String(Math.round(val * 100));
      tooltip.html(text).style("left", (event.clientX + 12) + "px").style("top", (event.clientY + 12) + "px");
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  radarGroup.transition().duration(600).ease(d3.easeCubicOut).attr("transform", "scale(1)");

  const categoryLabel = radarCategoryTitles[currentRadarType] || capitalize(currentRadarType);

  g.append("text").attr("class", "radar-title").attr("y", -radius - 56).attr("text-anchor", "middle").text(player.player_name);
  g.append("text").attr("class", "radar-subtitle").attr("y", -radius - 32).attr("text-anchor", "middle").text(`${categoryLabel} – Percentiles`);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
