(() => {
  const width = 1200;
  const height = 800;

  // --- DOM sanity checks (wichtig!) ---
  const pitchRoot = d3.select("#pitch");
  if (pitchRoot.empty()) {
    console.error("[shots] ERROR: Element #pitch not found. Check your HTML id.");
    return;
  }

  const dropdownSel = d3.select("#gameDropdown");
  if (dropdownSel.empty()) {
    console.error("[shots] ERROR: Element #gameDropdown not found. Check your HTML id.");
    return;
  }

  // --- data base path ---
  const shotsDataBase = document.body.dataset.shotsBase || "data";

  const resolveShotCsv = (value) => {
    if (!value) return `${shotsDataBase}/liverpool20150809stokecity.csv`;
    if (value.includes("/")) return value;
    return `${shotsDataBase}/${value}`;
  };

  // --- comms: same page + iframe/tab ---
  const PLAYER_CHANNEL = "liverpool-player-selection-v1";
  let currentPlayerFilter = { id: null, name: null };

  const setPlayerFilter = (detail) => {
    currentPlayerFilter = {
      id: detail?.playerId != null ? String(detail.playerId) : null,
      name: detail?.playerName || null
    };
    console.log("[shots] player filter set:", currentPlayerFilter);
    refreshShots();
  };

  window.addEventListener("radar:player-selected", (event) => {
    setPlayerFilter(event.detail);
  });

  if ("BroadcastChannel" in window) {
    const bc = new BroadcastChannel(PLAYER_CHANNEL);
    bc.onmessage = (e) => setPlayerFilter(e.data);
  }

  window.addEventListener("storage", (e) => {
    if (e.key !== "radar:player-selected" || !e.newValue) return;
    try { setPlayerFilter(JSON.parse(e.newValue)); } catch {}
  });

  // falls selection schon gesetzt wurde bevor dieses script geladen hat
  try {
    const cached = localStorage.getItem("radar:player-selected");
    if (cached) setPlayerFilter(JSON.parse(cached));
  } catch {}

  const hasPlayerFilter = () => !!(currentPlayerFilter.id || currentPlayerFilter.name);

  // --- helpers for filtering ---
  const normalizePlayerName = (name) => String(name || "").trim().toLowerCase();

  const getRowPlayerId = (d) => {
    const v = d.player_id ?? d.playerId ?? d.playerID ?? d.playerid;
    return v == null ? null : String(v);
  };

  const getRowPlayerName = (d) => (d.player || d.player_name || d.playername || "").trim();

  const applyPlayerFilter = (data) => {
    if (!hasPlayerFilter()) return data;

    const idTarget = currentPlayerFilter.id;
    const nameTarget = normalizePlayerName(currentPlayerFilter.name);

    return data.filter(d => {
      const rowId = getRowPlayerId(d);
      if (idTarget && rowId) return rowId === idTarget;

      const rowName = normalizePlayerName(getRowPlayerName(d));
      if (!nameTarget) return true;

      return rowName === nameTarget || rowName.includes(nameTarget) || nameTarget.includes(rowName);
    });
  };

  // --- create overlay svg (shots layer) ---
  const svg = pitchRoot
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", "0 0 120 80");

  // --- legend + scales ---
  const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([0, 1]);

  const xglegend = svg.append("defs");
  const linearGradient = xglegend.append("linearGradient")
    .attr("id", "legend-gradient");

  linearGradient.append("stop").attr("offset", "0%").attr("stop-color", "#a50026");
  linearGradient.append("stop").attr("offset", "50%").attr("stop-color", "#feeda2");
  linearGradient.append("stop").attr("offset", "100%").attr("stop-color", "#006837");

  svg.append("rect")
    .attr("x", 10).attr("y", 8)
    .attr("width", 40).attr("height", 5)
    .attr("fill", "url(#legend-gradient)")
    .attr("stroke", "white").attr("stroke-width", 0.3);

  svg.append("text").attr("x", 30).attr("y", 6)
    .attr("font-size", 3).attr("text-anchor", "middle")
    .attr("fill", "white")
    .text("xG Probability");

  svg.append("text").attr("x", 10).attr("y", 15)
    .attr("font-size", 2).attr("text-anchor", "middle")
    .attr("fill", "white").text("0%");

  svg.append("text").attr("x", 30).attr("y", 15)
    .attr("font-size", 2).attr("text-anchor", "middle")
    .attr("fill", "white").text("50%");

  svg.append("text").attr("x", 50).attr("y", 15)
    .attr("font-size", 2).attr("text-anchor", "middle")
    .attr("fill", "white").text("100%");

  // --- dropdown + match files ---
  const dropdown = d3.select("#gameDropdown");
  const allMatchFiles = dropdown.selectAll("option")
    .nodes()
    .map(option => resolveShotCsv(option.value));

  // --- robust CSV loading (wichtig!) ---
  const loadShotData = (csvFiles) =>
    Promise.allSettled(csvFiles.map(file => d3.csv(file)))
      .then(results => {
        const ok = [];
        const failed = [];
        results.forEach((r, i) => {
          if (r.status === "fulfilled") ok.push(r.value);
          else failed.push({ file: csvFiles[i], err: r.reason });
        });

        if (failed.length) {
          console.warn("[shots] Some CSVs failed to load (skipping):", failed);
        }
        return ok.flat();
      });

  const refreshShots = () => {
    const selectedFile = dropdown.property("value");
    selectGame(resolveShotCsv(selectedFile));
  };

  dropdown.on("change", refreshShots);

  // --- info box ---
  const infoBox = svg.append("g").attr("class", "infobox");

  infoBox.append("rect")
    .attr("width", 50).attr("height", 30)
    .attr("x", 5).attr("y", 28)
    .attr("rx", 1).attr("ry", 1)
    .attr("fill", "black").attr("opacity", 0.95)
    .attr("stroke", "white").attr("stroke-width", 0.5);

  const boxTitle = infoBox.append("text").attr("x", 19).attr("y", 32)
    .attr("font-size", 3).attr("fill", "white").text("Shot information");

  const boxPlayer = infoBox.append("text").attr("x", 9).attr("y", 37)
    .attr("font-size", 2).attr("fill", "white").text("Player: ");

  const boxMinute = infoBox.append("text").attr("x", 9).attr("y", 41)
    .attr("font-size", 2).attr("fill", "white").text("Minute: ");

  const boxOutcome = infoBox.append("text").attr("x", 9).attr("y", 45)
    .attr("font-size", 2).attr("fill", "white").text("Outcome: ");

  const boxPattern = infoBox.append("text").attr("x", 9).attr("y", 49)
    .attr("font-size", 2).attr("fill", "white").text("Play type: ");

  const boxPercentage = infoBox.append("text").attr("x", 9).attr("y", 53)
    .attr("font-size", 2).attr("fill", "white").text("xG probability: ");

  const infoTexts = [boxTitle, boxPlayer, boxMinute, boxOutcome, boxPattern, boxPercentage];

  const defs = svg.append("defs");
  const shotlineGradient = defs.append("linearGradient")
    .attr("id", "shotline-gradient")
    .attr("gradientUnits", "userSpaceOnUse");

  shotlineGradient.append("stop").attr("offset", "0%").attr("stop-color", "lightblue").attr("stop-opacity", 1);
  shotlineGradient.append("stop").attr("offset", "50%").attr("stop-color", "blue").attr("stop-opacity", 1);
  shotlineGradient.append("stop").attr("offset", "100%").attr("stop-color", "cyan").attr("stop-opacity", 1);

  const parseJsonArr = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v !== "string") return null;
    try { return JSON.parse(v); } catch { return null; }
  };

  function selectGame(csvfile) {
    const filesToLoad = hasPlayerFilter() ? allMatchFiles : [csvfile];
    console.log("[shots] loading files:", filesToLoad.length, "playerFilter:", currentPlayerFilter);

    loadShotData(filesToLoad).then(data => {
      // preparse
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
        d.shottime = d.minute ?? d.second ?? "";
        d.outcome = d.shot_outcome ?? "";
        d.pattern = d.play_pattern ?? "";

        cleaned.push(d);
      });

      const filteredData = applyPlayerFilter(cleaned);
      console.log("[shots] rows:", cleaned.length, "after filter:", filteredData.length);

      svg.selectAll("circle.shot").remove();
      svg.selectAll("g.lines").remove();

      const lineLayer = svg.append("g").attr("class", "lines");

      const shots = svg.selectAll("circle.shot")
        .data(filteredData);

      const shotsAnim = shots.enter()
        .append("circle")
        .attr("class", "shot")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", 0)
        .attr("fill", d => colorScale(d.xg))
        .attr("stroke", d => d.outcome === "Goal" ? "cyan" : "black")
        .attr("stroke-width", 0.2);

      shotsAnim.transition()
        .delay((d, i) => i * 10)
        .duration(300)
        .attr("r", 1.1)
        .style("opacity", 1);

      shotsAnim.on("mouseover", function (event, d) {
        lineLayer.selectAll("line.hover-line").remove();

        boxTitle.text("Shot information");
        boxPlayer.text(`Player: ${d.playername}`);
        boxMinute.text(`Minute: ${d.shottime}`);
        boxPattern.text(`Play type: ${d.pattern}`);
        boxPercentage.text(`xG Probability: ${(d.xg * 100).toFixed(2)}%`);
        boxOutcome.text(`Outcome: ${d.outcome}`)
          .attr("fill", d.outcome === "Goal" ? "cyan" : "white");

        animateInfoTexts();

        lineLayer.append("line")
          .attr("class", "hover-line")
          .attr("x1", d.x).attr("y1", d.y)
          .attr("x2", d.endx).attr("y2", d.endy)
          .transition().duration(350)
          .attr("stroke", "url(#shotline-gradient)")
          .attr("stroke-width", 0.5)
          .style("pointer-events", "none");
      }).on("mouseout", function () {
        lineLayer.selectAll("line.hover-line").remove();
      });
    }).catch(err => {
      console.error("[shots] load/render failed:", err);
    });
  }

  function animateInfoTexts() {
    infoTexts.forEach((t, i) => {
      t.interrupt()
        .attr("opacity", 0)
        .attr("transform", "translate(0,2)")
        .transition()
        .delay(i * 60)
        .duration(250)
        .attr("opacity", 1)
        .attr("transform", "translate(0,0)");
    });
  }

  // initial draw
  selectGame(resolveShotCsv(dropdown.property("value")));
})();
