// js/shots.js
(() => {
  const width = 1200;
  const height = 800;

  const pitchRoot = d3.select("#pitch");
  const dropdownSel = d3.select("#gameDropdown");
  const scopeSel = d3.select("#shotScope");

  if (pitchRoot.empty() || dropdownSel.empty() || scopeSel.empty()) {
    console.error("[shots] Missing DOM elements (#pitch, #gameDropdown, #shotScope). Check index.html IDs.");
    return;
  }

  const shotsDataBase = document.body.dataset.shotsBase || "data";
  const matchesIndexUrl = `${shotsDataBase}/matches_index.json`;

  const PLAYER_CHANNEL = "liverpool-player-selection-v1";
  let currentPlayerFilter = { id: null, name: null };
  let allMatches = []; // [{file,label, dateKey}...]

  // ---------------------------
  // Helpers
  // ---------------------------
  const normalizePlayerName = (name) => String(name || "").trim().toLowerCase();

  const getRowPlayerId = (d) => {
    const v = d.player_id ?? d.playerId ?? d.playerID ?? d.playerid;
    return v == null ? null : String(v);
  };

  const getRowPlayerName = (d) => (d.player || d.player_name || d.playername || "").trim();

  const hasPlayerFilter = () => !!(currentPlayerFilter.id || currentPlayerFilter.name);

  const parseJsonArr = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v !== "string") return null;
    try { return JSON.parse(v); } catch { return null; }
  };

  const resolveCsv = (file) => {
    if (!file) return null;
    if (file.startsWith("http://") || file.startsWith("https://") || file.startsWith("/")) return file;
    // allow "data/.." passed in (but we expect plain filename)
    if (file.includes("/")) return file;
    return `${shotsDataBase}/${file}`;
  };

  const applyPlayerFilter = (rows) => {
    if (!hasPlayerFilter()) return rows;

    const idTarget = currentPlayerFilter.id ? String(currentPlayerFilter.id) : null;
    const nameTarget = normalizePlayerName(currentPlayerFilter.name);

    return rows.filter(d => {
      const rowId = getRowPlayerId(d);
      if (idTarget && rowId) return rowId === idTarget;

      const rowName = normalizePlayerName(getRowPlayerName(d));
      if (!nameTarget) return true;

      return rowName === nameTarget || rowName.includes(nameTarget) || nameTarget.includes(rowName);
    });
  };

  // ---------------------------
  // Pitch SVG base
  // ---------------------------
  pitchRoot.selectAll("*").remove();

  const svg = pitchRoot.append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", "0 0 120 80");

  // pitch lines
  const pitch = svg.append("g").attr("class", "pitch-lines");

  function drawPitch() {
    const stroke = "white";
    const sw = 0.5;

    // outer
    pitch.append("rect")
      .attr("x", 0).attr("y", 0)
      .attr("width", 120).attr("height", 80)
      .attr("fill", "transparent")
      .attr("stroke", stroke).attr("stroke-width", sw);

    // half line
    pitch.append("line")
      .attr("x1", 60).attr("y1", 0)
      .attr("x2", 60).attr("y2", 80)
      .attr("stroke", stroke).attr("stroke-width", sw);

    // center circle
    pitch.append("circle")
      .attr("cx", 60).attr("cy", 40).attr("r", 10)
      .attr("fill", "transparent")
      .attr("stroke", stroke).attr("stroke-width", sw);

    // penalty areas
    const paX = 18, paW = 44, paY = (80 - paW) / 2; // 18..62
    const gaX = 6, gaW = 20, gaY = (80 - gaW) / 2;  // 30..50

    // left PA
    pitch.append("rect")
      .attr("x", 0).attr("y", paY)
      .attr("width", paX).attr("height", paW)
      .attr("fill", "transparent")
      .attr("stroke", stroke).attr("stroke-width", sw);

    // left 6y
    pitch.append("rect")
      .attr("x", 0).attr("y", gaY)
      .attr("width", gaX).attr("height", gaW)
      .attr("fill", "transparent")
      .attr("stroke", stroke).attr("stroke-width", sw);

    // right PA
    pitch.append("rect")
      .attr("x", 120 - paX).attr("y", paY)
      .attr("width", paX).attr("height", paW)
      .attr("fill", "transparent")
      .attr("stroke", stroke).attr("stroke-width", sw);

    // right 6y
    pitch.append("rect")
      .attr("x", 120 - gaX).attr("y", gaY)
      .attr("width", gaX).attr("height", gaW)
      .attr("fill", "transparent")
      .attr("stroke", stroke).attr("stroke-width", sw);

    // penalty spots
    pitch.append("circle").attr("cx", 12).attr("cy", 40).attr("r", 0.35).attr("fill", stroke);
    pitch.append("circle").attr("cx", 108).attr("cy", 40).attr("r", 0.35).attr("fill", stroke);
  }

  drawPitch();

  // layers
  const lineLayer = svg.append("g").attr("class", "lines");
  const shotLayer = svg.append("g").attr("class", "shots");

  // ---------------------------
  // Legend (xG)
  // ---------------------------
  const defs = svg.append("defs");

  const linearGradient = defs.append("linearGradient")
    .attr("id", "legend-gradient");

  linearGradient.append("stop").attr("offset", "0%").attr("stop-color", "#a50026");
  linearGradient.append("stop").attr("offset", "50%").attr("stop-color", "#feeda2");
  linearGradient.append("stop").attr("offset", "100%").attr("stop-color", "#006837");

  svg.append("text")
    .attr("x", 30).attr("y", 10)
    .attr("font-size", 4)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .text("xG Probability");

  svg.append("rect")
    .attr("x", 10).attr("y", 12)
    .attr("width", 40).attr("height", 6)
    .attr("fill", "url(#legend-gradient)")
    .attr("stroke", "white").attr("stroke-width", 0.4);

  svg.append("text").attr("x", 10).attr("y", 22)
    .attr("font-size", 2.2).attr("text-anchor", "middle")
    .attr("fill", "white").text("0%");

  svg.append("text").attr("x", 30).attr("y", 22)
    .attr("font-size", 2.2).attr("text-anchor", "middle")
    .attr("fill", "white").text("50%");

  svg.append("text").attr("x", 50).attr("y", 22)
    .attr("font-size", 2.2).attr("text-anchor", "middle")
    .attr("fill", "white").text("100%");

  // shot hover line gradient
  const shotlineGradient = defs.append("linearGradient")
    .attr("id", "shotline-gradient")
    .attr("gradientUnits", "userSpaceOnUse");

  shotlineGradient.append("stop").attr("offset", "0%").attr("stop-color", "lightblue").attr("stop-opacity", 1);
  shotlineGradient.append("stop").attr("offset", "50%").attr("stop-color", "blue").attr("stop-opacity", 1);
  shotlineGradient.append("stop").attr("offset", "100%").attr("stop-color", "cyan").attr("stop-opacity", 1);

  // ---------------------------
  // Info box
  // ---------------------------
  const infoBox = svg.append("g").attr("class", "infobox");

  infoBox.append("rect")
    .attr("width", 52).attr("height", 30)
    .attr("x", 6).attr("y", 28)
    .attr("rx", 1.2).attr("ry", 1.2)
    .attr("fill", "black").attr("opacity", 0.78)
    .attr("stroke", "white").attr("stroke-width", 0.6);

  const boxTitle = infoBox.append("text").attr("x", 32).attr("y", 33)
    .attr("font-size", 3.2).attr("text-anchor", "middle")
    .attr("fill", "white").text("Shot information");

  const boxPlayer = infoBox.append("text").attr("x", 9).attr("y", 38)
    .attr("font-size", 2.3).attr("fill", "white").text("Player: ");

  const boxMinute = infoBox.append("text").attr("x", 9).attr("y", 42)
    .attr("font-size", 2.3).attr("fill", "white").text("Minute: ");

  const boxOutcome = infoBox.append("text").attr("x", 9).attr("y", 46)
    .attr("font-size", 2.3).attr("fill", "white").text("Outcome: ");

  const boxPattern = infoBox.append("text").attr("x", 9).attr("y", 50)
    .attr("font-size", 2.3).attr("fill", "white").text("Play type: ");

  const boxPercentage = infoBox.append("text").attr("x", 9).attr("y", 54)
    .attr("font-size", 2.3).attr("fill", "white").text("xG probability: ");

  const infoTexts = [boxTitle, boxPlayer, boxMinute, boxOutcome, boxPattern, boxPercentage];

  function animateInfoTexts() {
    infoTexts.forEach((t, i) => {
      t.interrupt()
        .attr("opacity", 0)
        .attr("transform", "translate(0,2)")
        .transition()
        .delay(i * 55)
        .duration(220)
        .attr("opacity", 1)
        .attr("transform", "translate(0,0)");
    });
  }

  // ---------------------------
  // Player selection comms
  // ---------------------------
  const setPlayerFilter = (detail) => {
    currentPlayerFilter = {
      id: detail?.playerId != null ? String(detail.playerId) : null,
      name: detail?.playerName || null
    };
    refreshShots();
  };

  window.addEventListener("radar:player-selected", (event) => setPlayerFilter(event.detail));

  if ("BroadcastChannel" in window) {
    const bc = new BroadcastChannel(PLAYER_CHANNEL);
    bc.onmessage = (e) => setPlayerFilter(e.data);
  }

  window.addEventListener("storage", (e) => {
    if (e.key !== "radar:player-selected" || !e.newValue) return;
    try { setPlayerFilter(JSON.parse(e.newValue)); } catch {}
  });

  // if already selected earlier
  try {
    const cached = localStorage.getItem("radar:player-selected");
    if (cached) setPlayerFilter(JSON.parse(cached));
  } catch {}

  // ---------------------------
  // Load match index + populate dropdown
  // ---------------------------
  async function loadMatchesIndex() {
    try {
      const res = await fetch(matchesIndexUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // allow ["file.csv", ...] OR [{file,label,dateKey}, ...]
      const arr = Array.isArray(json) ? json : [];
      const norm = arr.map(x => {
        if (typeof x === "string") return { file: x, label: x, dateKey: "" };
        return {
          file: x.file,
          label: x.label || x.file,
          dateKey: x.dateKey || ""
        };
      }).filter(d => d.file);

      // sort by dateKey if present
      norm.sort((a, b) => (a.dateKey || "").localeCompare(b.dateKey || ""));

      allMatches = norm;

      dropdownSel.selectAll("option")
        .data(allMatches, d => d.file)
        .join("option")
        .attr("value", d => d.file)
        .text(d => d.label);

      // default first
      if (allMatches.length) dropdownSel.property("value", allMatches[0].file);

    } catch (err) {
      console.warn("[shots] matches_index.json not found or invalid. Fallback: dropdown must be filled manually.", err);
      // fallback: keep existing options in HTML
      const opts = dropdownSel.selectAll("option").nodes();
      allMatches = opts.map(o => ({ file: o.value, label: o.textContent || o.value, dateKey: "" }));
    }
  }

  // ---------------------------
  // CSV loading
  // ---------------------------
  const loadShotData = (csvFiles) =>
    Promise.allSettled(csvFiles.map(file => d3.csv(file)))
      .then(results => {
        const ok = [];
        const failed = [];
        results.forEach((r, i) => {
          if (r.status === "fulfilled") ok.push(r.value);
          else failed.push({ file: csvFiles[i], err: r.reason });
        });
        if (failed.length) console.warn("[shots] Some CSVs failed to load (skipping):", failed);
        return ok.flat();
      });

  // ---------------------------
  // Render
  // ---------------------------
  async function selectGameOrAll() {
    const selectedFile = dropdownSel.property("value");
    const scope = scopeSel.property("value"); // "match" | "all"

    // Only load ALL matches when a player is selected (otherwise it is pointless + heavy)
    const shouldLoadAll = (scope === "all") && hasPlayerFilter();

    const filesToLoad = shouldLoadAll
      ? allMatches.map(m => resolveCsv(m.file)).filter(Boolean)
      : [resolveCsv(selectedFile)].filter(Boolean);

    const data = await loadShotData(filesToLoad);

    // preparse / clean
    const cleaned = [];
    data.forEach(d => {
      const pos = parseJsonArr(d.location);
      const endpos = parseJsonArr(d.shot_end_location);
      if (!pos || pos.length < 2 || !endpos || endpos.length < 2) return;

      d.x = +pos[0];
      d.y = +pos[1];
      d.endx = +endpos[0];
      d.endy = +endpos[1];

      d.xg = +(d.shot_statsbomb_xg ?? d.xg ?? 0);
      d.playername = getRowPlayerName(d);

      // minute can be missing in some files
      const minute = d.minute ?? "";
      d.shottime = minute;

      d.outcome = d.shot_outcome ?? "";
      d.pattern = d.play_pattern ?? "";

      cleaned.push(d);
    });

    const filteredData = applyPlayerFilter(cleaned);

    // clear old
    shotLayer.selectAll("circle.shot").remove();
    lineLayer.selectAll("line.hover-line").remove();

    // color scale
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([0, 1]);

    // draw shots
    const shots = shotLayer.selectAll("circle.shot").data(filteredData);

    const shotsEnter = shots.enter()
      .append("circle")
      .attr("class", "shot")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", 0)
      .attr("fill", d => colorScale(d.xg))
      .attr("stroke", d => d.outcome === "Goal" ? "cyan" : "black")
      .attr("stroke-width", 0.25)
      .style("opacity", 1);

    shotsEnter.transition()
      .delay((d, i) => Math.min(i * 8, 700))
      .duration(240)
      .attr("r", 1.15);

    shotsEnter
      .on("mouseover", function (event, d) {
        lineLayer.selectAll("line.hover-line").remove();

        boxTitle.text("Shot information");
        boxPlayer.text(`Player: ${d.playername}`);
        boxMinute.text(`Minute: ${d.shottime}`);
        boxPattern.text(`Play type: ${d.pattern}`);
        boxPercentage.text(`xG probability: ${(d.xg * 100).toFixed(2)}%`);

        boxOutcome.text(`Outcome: ${d.outcome}`)
          .attr("fill", d.outcome === "Goal" ? "cyan" : "white");

        animateInfoTexts();

        // hover line
        const ln = lineLayer.append("line")
          .attr("class", "hover-line")
          .attr("x1", d.x).attr("y1", d.y)
          .attr("x2", d.x).attr("y2", d.y)
          .style("pointer-events", "none");

        ln.transition().duration(260)
          .attr("x2", d.endx).attr("y2", d.endy)
          .attr("stroke", "url(#shotline-gradient)")
          .attr("stroke-width", 0.7)
          .attr("opacity", 1);
      })
      .on("mouseout", function () {
        lineLayer.selectAll("line.hover-line").remove();
      });
  }

  function refreshShots() {
    // if scope=all but no player is selected -> stay on match mode
    if (scopeSel.property("value") === "all" && !hasPlayerFilter()) {
      // silently downgrade to match
      scopeSel.property("value", "match");
    }
    selectGameOrAll().catch(err => console.error("[shots] render failed:", err));
  }

  dropdownSel.on("change", refreshShots);
  scopeSel.on("change", refreshShots);

  // init
  loadMatchesIndex().then(refreshShots);

})();
