(() => {
    const chartRoot = d3.select("#chart");
    if (chartRoot.empty()) {
        return;
    }

    let fullData = [];
    let sortDescending = true;
    let currentMinGoals = 0;

    const margin = { top: 40, right: 40, bottom: 70, left: 230 };
    const width = 900 - margin.left - margin.right;
    const height = 700 - margin.top - margin.bottom;

    const svg = chartRoot
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select("body")
        .append("div")
        .style("position", "absolute")
        .style("background", "#222")
        .style("color", "white")
        .style("padding", "8px 12px")
        .style("border-radius", "6px")
        .style("font-size", "14px")
        .style("opacity", 0)
        .style("pointer-events", "none");

    const shotsDataBase = document.body.dataset.shotsBase || "../jsFootball/data";
    const resolveShotFile = (value) => {
        if (!value) {
            return `${shotsDataBase}/liverpool20150809stokecity.csv`;
        }
        if (value.includes("/")) {
            return value;
        }
        return `${shotsDataBase}/${value}`;
    };

    const matchDropdown = document.querySelector("#gameDropdown");
    const files = matchDropdown
        ? Array.from(matchDropdown.querySelectorAll("option")).map(option => resolveShotFile(option.value))
        : [
            "liverpool20150809stokecity.csv",
            "liverpool20150817afcbournemouth.csv",
            "liverpool20150824arsenal.csv",
            "liverpool20150829westhamunited.csv",
            "liverpool20150912manchesterunited.csv",
            "liverpool20150920norwichcity.csv",
            "liverpool20150926astonvilla.csv",
            "liverpool20151004everton.csv",
            "liverpool20151017tottenhamhotspur.csv",
            "liverpool20151025southhampton.csv",
            "liverpool20151031chelsea.csv",
            "liverpool20151108crystalpalace.csv",
            "liverpool20151121manchestercity.csv",
            "liverpool20151129swanseacity.csv",
            "liverpool20151206newcastleunited.csv",
            "liverpool20151213westbromwichalbion.csv",
            "liverpool20151220watford.csv",
            "liverpool20151226leicestercity.csv",
            "liverpool20151230sunderland.csv",
            "liverpool20160102westhamunited.csv",
            "liverpool20160113arsenal.csv",
            "liverpool20160117manchesterunited.csv",
            "liverpool20160123norwichcity.csv",
            "liverpool20160202leicestercity.csv",
            "liverpool20160206sunderland.csv",
            "liverpool20160214astonvilla.csv",
            "liverpool20160302manchestercity.csv",
            "liverpool20160306crystalpalace.csv",
            "liverpool20160320southampton.csv",
            "liverpool20160402tottenhamhotspur.csv",
            "liverpool20160410stokecity.csv",
            "liverpool20160417afcbournemouth.csv",
            "liverpool20160420everton.csv",
            "liverpool20160423newcastleunited.csv",
            "liverpool20160501swanseacity.csv",
            "liverpool20160508watford.csv",
            "liverpool20160511chelsea.csv",
            "liverpool20160515westbromwichalbion.csv"
        ].map(file => resolveShotFile(file));

    Promise.all(files.map(f => d3.csv(f, d3.autoType))).then(allFiles => {
        const rawData = allFiles.flat();

        const goals = rawData.filter(d =>
            d.shot_outcome === "Goal" &&
            (d.type === "Shot" || d.type === undefined)
        );

        const goalsByPlayer = d3.rollup(
            goals,
            v => v.length,
            d => d.player || d.player_name || "Unknown"
        );

        fullData = Array.from(goalsByPlayer, ([player, goals]) => ({ player, goals }));

        const maxGoals = d3.max(fullData, d => d.goals);

        d3.select("#goalSlider")
            .attr("max", maxGoals)
            .on("input", function () {
                currentMinGoals = +this.value;
                d3.select("#goalValue").text(currentMinGoals);
                updateChart();
            });

        d3.select("#sortButton")
            .on("click", () => {
                sortDescending = !sortDescending;
                d3.select("#sortButton")
                    .text(sortDescending ? "Sort: Descending" : "Sort: Ascending");
                updateChart();
            });

        updateChart();
    });

    function updateChart() {
        let data = fullData.filter(d => d.goals >= currentMinGoals);

        data.sort((a, b) =>
            sortDescending
                ? d3.descending(a.goals, b.goals)
                : d3.ascending(a.goals, b.goals)
        );

        drawChart(data);
    }

    function drawChart(data) {
        svg.selectAll("*").remove();

        const y = d3.scaleBand()
            .domain(data.map(d => d.player))
            .range([0, height])
            .padding(0.2);

        const x = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.goals)])
            .range([0, width]);

        const color = d3.scaleSequential()
            .domain([0, d3.max(data, d => d.goals)])
            .interpolator(d3.interpolateViridis);

        svg.selectAll(".bar")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("y", d => y(d.player))
            .attr("height", y.bandwidth())
            .attr("x", 0)
            .attr("width", d => x(d.goals))
            .attr("fill", d => color(d.goals))
            .on("mouseover", (event, d) => {
                tooltip.style("opacity", 1)
                    .html(`<strong>${d.player}</strong><br>Goals: ${d.goals}`);
            })
            .on("mousemove", event => {
                tooltip.style("left", event.pageX + 15 + "px")
                       .style("top", event.pageY - 20 + "px");
            })
            .on("mouseout", () => tooltip.style("opacity", 0));

        svg.selectAll(".label")
            .data(data)
            .enter()
            .append("text")
            .attr("class", "label")
            .attr("y", d => y(d.player) + y.bandwidth() / 2 + 4)
            .attr("x", d => x(d.goals) + 5)
            .text(d => d.goals);

        svg.append("g").call(d3.axisLeft(y));
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x));

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 50)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "600")
            .text("Total Goals");

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -180)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "600")
            .text("Player Name");
    }
})();
