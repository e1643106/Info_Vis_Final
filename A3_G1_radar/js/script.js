// js/script.js
// ZORDNUNGEN 
//========================================================================================================================================
// alle radar kategorien für das overview-radar
const overviewMetrics = [
  {
    label: "Finishing & xG",
    pctKey: "finishing_score_pct",
    rawKey: "finishing_score"
  },
  {
    label: "Chance Creation",
    pctKey: "chance_creation_score_pct",
    rawKey: "chance_creation_score"
  },
  {
    label: "Ball Progression",
    pctKey: "progression_score_pct",
    rawKey: "progression_score"
  },
  {
    label: "Dribbling & On-Ball",
    pctKey: "dribbling_onball_score_pct",
    rawKey: "dribbling_onball_score"
  }
];

// welche metriken gehören zu den detail-radaren
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

// titel für die radare
const radarCategoryTitles = {
  overview: "Overview",
  finishing: "Finishing & xG",
  creation: "Chance Creation",
  progression: "Ball Progression",
  dribbling: "Dribbling & On-Ball"
};

// ========================================================================================================================================




// SVG & Tooltip
const mainSvg = d3.select("#radar-svg"); // sucht im HTML das element mit id="radar-svg", .... <svg id="radar-svg" ...></svg>....
// ist ein D3-Selection-Objek

const tooltip = d3.select("#tooltip"); // holt  <div id="tooltip" class="tooltip"></div>, ...alle was im Radar gezeichnet wird

// globals
let players = [];
let currentPlayerId = null;
let currentRadarType = "overview";   // "overview" | "finishing" | usw....

// =======================================================================================================================================



// Daten laden, vorbereiten, etc...
// ====================================================================
const radarDataBase = document.body.dataset.radarBase || "data";

Promise.all([
  d3.csv(`${radarDataBase}/liverpool_offense_radar.csv`),
  d3.csv(`${radarDataBase}/liverpool_shot_metrics.csv`)
]).then(([overviewData, shotData]) => {
  console.log("Overview-Radar-Dataset:", overviewData);
  console.log("Shot-Metrics-Dataset:", shotData);

  // Zahlenfelder im Overview CSV
  overviewData.forEach(d => {
    overviewMetrics.forEach(m => {
      if (d[m.rawKey] !== undefined) {
        d[m.rawKey] = d[m.rawKey] === "" ? null : +d[m.rawKey];
      }
      if (d[m.pctKey] !== undefined) {
        d[m.pctKey] = d[m.pctKey] === "" ? null : +d[m.pctKey];
      }
    });
  });

  // Zahlenfelder im Shot-Metrics- CSV 
  shotData.forEach(d => {
    Object.keys(d).forEach(key => {
      if (key === "player_name" || key === "player_id") return;
      const v = +d[key];
      if (!isNaN(v)) d[key] = v;
    });
  });

  // Merge beide CSV
  const merged = overviewData.map((d, i) => ({
    ...shotData[i],
    ...d
  }));
  players = merged;

  // -------------------------------------------------------------------------------
  // RECHNUNGEN 

  // offense_index: 0..1 = mean of overviewMetrics pct values
  players.forEach(d => {
    const vals = overviewMetrics
      .map(m => d[m.pctKey])
      .filter(v => v != null && !isNaN(v));
    d.offense_index = vals.length ? d3.mean(vals) : 0;
  });


  //  percentile ranks für alle detail-metriken 
  const allDetailKeys = new Set();
  Object.values(detailConfigs).forEach(cfg => {
    cfg.metrics.forEach(m => allDetailKeys.add(m.key));
  });

  allDetailKeys.forEach(key => {
    const vals = players
      .map(p => p[key])
      .filter(v => v != null && !isNaN(v))
      .sort(d3.ascending);

    if (!vals.length) return;

    players.forEach(p => {
      const raw = p[key];
      let pct = 0;
      if (raw != null && !isNaN(raw)) {
        let idx = d3.bisectRight(vals, raw) - 1;
        pct = vals.length === 1 ? 1 : idx / (vals.length - 1);
      }
      p[`${key}_pctRank`] = pct;   // 0..1
    });
  });
  // -------------------------------------------------------------------------------




  // Dropdown 
  const select = d3.select("#player-select");
  select.selectAll("option")
    .data(players)
    .enter()
    .append("option")
    .attr("value", d => d.player_id)
    .text(d => d.player_name);

  select.on("change", (event) => {
    const selectedId = event.target.value;
    setSelectedPlayer(selectedId);
  });

  // Top-10-Liste
  buildTopLists();

  // Radar Toggle
  setupRadarTypeToggle();

  // Standard -> erster spieler
  if (players.length > 0) {
    setSelectedPlayer(players[0].player_id);
  }
}).catch(err => {
  console.error("Fehler beim Laden der CSVs:", err);
});

// ====================================================================
// Top-10-List

function buildTopLists() {
  const configs = [
    { pctKey: "finishing_score_pct",       listId: "top-finishing" },
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
      .on("click", (_, d) => {
        setSelectedPlayer(d.player_id);
      });

    enter.append("span")
      .attr("class", "name")
      .text(d => d.player_name);

    enter.append("span")
      .attr("class", "score")
      .text(d => `${Math.round(d[cfg.pctKey] * 100)}%`);

    items.exit().remove();
  });
}

// ====================================================================
// aushwal logik 
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

function broadcastPlayerSelection(player) {
  if (!player) return;

  window.dispatchEvent(new CustomEvent("radar:player-selected", {
    detail: {
      playerId: player.player_id,
      playerName: player.player_name
    }
  }));
}

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

// ====================================================================
// Haupt-Radar 
function drawMainRadar(player) {
  if (currentRadarType === "overview") {
    drawOverviewRadar(player);
  } else {
    const cfg = detailConfigs[currentRadarType];
    if (!cfg) return;
    drawDetailRadar(mainSvg, cfg.metrics, player);
  }
}


function drawOverviewRadar(player) {
  mainSvg.selectAll("*").remove();

  const width = +mainSvg.attr("width");
  const height = +mainSvg.attr("height");
  const margin = 80;
  const radius = Math.min(width, height) / 2 - margin;
  const centerX = width / 2;
  const centerY = height / 2;
  const angleSlice = (2 * Math.PI) / overviewMetrics.length;

  const g = mainSvg.append("g")
    .attr("transform", `translate(${centerX}, ${centerY})`);

  const rScale = d3.scaleLinear()
    .domain([0, 1])
    .range([0, radius]);

  // Grid + Level-Labels (0.25, 0.50, 0.75, 1.00)
  const levels = 4;
  for (let lvl = 1; lvl <= levels; lvl++) {
    const frac = lvl / levels;
    const r = radius * frac;

    g.append("circle")
      .attr("class", "grid-line")
      .attr("r", r);

    g.append("text")
      .attr("class", "grid-level-label")
      .attr("x", 4)
      .attr("y", -r + 10)
      .text(frac.toFixed(2));
  }

  // Achsen (Linien + Labels)
  const axis = g.selectAll(".axis")
    .data(overviewMetrics)
    .enter()
    .append("g")
    .attr("class", "axis");

  axis.append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", (_, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      return rScale(1) * Math.cos(angle);
    })
    .attr("y2", (_, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      return rScale(1) * Math.sin(angle);
    })
    .attr("stroke", "#343c5c")
    .attr("stroke-width", 1);

axis.append("text")
  .attr("class", "axis-label")
  .attr("x", (_, i) => {
    // oberste Achse: genau mittig über dem Radar
    if (i === 0) return 0;

    const angle = angleSlice * i - Math.PI / 2;
    const rLabel = radius + 30;      // Abstand für die anderen Achsen
    return rLabel * Math.cos(angle);
  })
  .attr("y", (_, i) => {
    if (i === 0) {
      // Y-Position für den Top-Achs-Titel:
      // Player-Name:   y = -radius - 56
      // Untertitel:    y = -radius - 32
      return -radius - 12;           // manuel justierten
    }

    const angle = angleSlice * i - Math.PI / 2;
    const rLabel = radius + 20;
    return rLabel * Math.sin(angle);
  })
  .attr("text-anchor", (_, i) => i === 0 ? "middle" : "middle")
  .text(d => d.label);


  // Punkte (percentiles)
  const points = overviewMetrics.map((m, i) => {
    const pctVal = player[m.pctKey];
    let v = pctVal;
    if (v == null || isNaN(v)) v = 0;

    const angle = angleSlice * i - Math.PI / 2;
    const r = rScale(v);

    return {
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
      pctVal
    };
  });

  const closedPoints = points.concat([points[0]]);
  const radarLine = d3.line()
    .x(d => d.x)
    .y(d => d.y)
    .curve(d3.curveLinearClosed);

  const radarGroup = g.append("g")
    .attr("class", "radar-group")
    .attr("transform", "scale(0)");

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
    .attr("fill", "#ff6384")
    .on("mouseover", () => {
      tooltip.style("opacity", 1);
    })
    .on("mousemove", (event, d) => {
      const val = d.pctVal;
      const text = (val == null || isNaN(val))
        ? "–"
        : String(Math.round(val * 100)); // nur 0–100

      tooltip
        .html(text)
        .style("left", (event.clientX + 12) + "px")
        .style("top", (event.clientY + 12) + "px");
    })
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
    });

  radarGroup
    .transition()
    .duration(600)
    .ease(d3.easeCubicOut)
    .attr("transform", "scale(1)");

  // titel + unteritel
  g.append("text")
    .attr("class", "radar-title")
    .attr("y", -radius - 56)
    .attr("text-anchor", "middle")
    .text(player.player_name);

  g.append("text")
    .attr("class", "radar-subtitle")
    .attr("y", -radius - 32)
    .attr("text-anchor", "middle")
    .text("Overview – Percentiles");
}

// ====================================================================
// Detail-Radar
function drawDetailRadar(svg, metricDefs, player) {
  svg.selectAll("*").remove();

  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = 80;
  const radius = Math.min(width, height) / 2 - margin;
  const centerX = width / 2;
  const centerY = height / 2;
  const angleSlice = (2 * Math.PI) / metricDefs.length;
  const pointRadius = 4;

  const g = svg.append("g")
    .attr("transform", `translate(${centerX}, ${centerY})`);

  const rScale = d3.scaleLinear()
    .domain([0, 1])
    .range([0, radius]);

  // Grid + Level-Labels wie Overview
  const levels = 4;
  for (let lvl = 1; lvl <= levels; lvl++) {
    const frac = lvl / levels;
    const r = radius * frac;

    g.append("circle")
      .attr("class", "grid-line")
      .attr("r", r);

    g.append("text")
      .attr("class", "grid-level-label")
      .attr("x", 4)
      .attr("y", -r + 10)
      .text(frac.toFixed(2));
  }

  // Achsen
  const axis = g.selectAll(".axis")
    .data(metricDefs)
    .enter()
    .append("g")
    .attr("class", "axis");

  axis.append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", (_, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      return rScale(1) * Math.cos(angle);
    })
    .attr("y2", (_, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      return rScale(1) * Math.sin(angle);
    })
    .attr("stroke", "#343c5c")
    .attr("stroke-width", 1);

  axis.append("text")
    .attr("class", "axis-label")
    .attr("x", (_, i) => {
      // oberste Achse (i === 0) genau mittig über dem Radar
      if (i === 0) return 0;

      const angle = angleSlice * i - Math.PI / 2;
      const rLabel = radius + 25;          // Abstand der anderen Labels vom Kreis
      return rLabel * Math.cos(angle);
    })
    .attr("y", (_, i) => {
      if (i === 0) {
        // Position direkt unter dem Radar-Untertitel
        return -radius - 12;
      }

      const angle = angleSlice * i - Math.PI / 2;
      const rLabel = radius + 20;
      return rLabel * Math.sin(angle);
    })
    .attr("text-anchor", (_, i) => (i === 0 ? "middle" : "middle"))
    .text(d => d.label);


  // Punkte (Percentile-Ranks 0..1)
  const points = metricDefs.map((m, i) => {
    const pctVal = player[`${m.key}_pctRank`];
    let tNorm = pctVal;
    if (tNorm == null || isNaN(tNorm)) tNorm = 0;

    const angle = angleSlice * i - Math.PI / 2;
    const r = rScale(tNorm);

    return {
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
      pctVal
    };
  });

  const closedPoints = points.concat([points[0]]);
  const radarLine = d3.line()
    .x(d => d.x)
    .y(d => d.y)
    .curve(d3.curveLinearClosed);

  const radarGroup = g.append("g")
    .attr("class", "radar-group")
    .attr("transform", "scale(0)");

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
    .attr("r", pointRadius)
    .attr("fill", "#ff6384")
    .on("mouseover", () => {
      tooltip.style("opacity", 1);
    })
    .on("mousemove", (event, d) => {
      const val = d.pctVal;
      const text = (val == null || isNaN(val))
        ? "–"
        : String(Math.round(val * 100));

      tooltip
        .html(text)
        .style("left", (event.clientX + 12) + "px")
        .style("top", (event.clientY + 12) + "px");
    })
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
    });

  radarGroup
    .transition()
    .duration(600)
    .ease(d3.easeCubicOut)
    .attr("transform", "scale(1)");

  const categoryLabel = radarCategoryTitles[currentRadarType] || capitalize(currentRadarType);

  g.append("text")
    .attr("class", "radar-title")
    .attr("y", -radius - 56)
    .attr("text-anchor", "middle")
    .text(player.player_name);

  g.append("text")
    .attr("class", "radar-subtitle")
    .attr("y", -radius - 32)
    .attr("text-anchor", "middle")
    .text(`${categoryLabel} – Percentiles`);
}

// kleine Hilfsfunktion
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
