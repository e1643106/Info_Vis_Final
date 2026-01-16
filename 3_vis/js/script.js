let fullData = [];
let sortDescending = true;
let currentMinGoals = 0;


const margin = { top: 40, right: 40, bottom: 70, left: 230 };
const width = 900 - margin.left - margin.right;
const height = 700 - margin.top - margin.bottom;


const svg = d3.select("#chart")
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

const files = [
    "../Datasets-15-16season/liverpool2015-08-09.csv",
    "../Datasets-15-16season/liverpool2015-08-17.csv",
    "../Datasets-15-16season/liverpool2015-08-24.csv",
    "../Datasets-15-16season/liverpool2015-08-29.csv",
    "../Datasets-15-16season/liverpool2015-09-12.csv",
    "../Datasets-15-16season/liverpool2015-09-20.csv",
    "../Datasets-15-16season/liverpool2015-09-26.csv",
    "../Datasets-15-16season/liverpool2015-10-04.csv",
    "../Datasets-15-16season/liverpool2015-10-17.csv",
    "../Datasets-15-16season/liverpool2015-10-25.csv",
    "../Datasets-15-16season/liverpool2015-10-31.csv",
    "../Datasets-15-16season/liverpool2015-11-08.csv",
    "../Datasets-15-16season/liverpool2015-11-21.csv",
    "../Datasets-15-16season/liverpool2015-11-29.csv",
    "../Datasets-15-16season/liverpool2015-12-06.csv",
    "../Datasets-15-16season/liverpool2015-12-13.csv",
    "../Datasets-15-16season/liverpool2015-12-20.csv",
    "../Datasets-15-16season/liverpool2015-12-26.csv",
    "../Datasets-15-16season/liverpool2015-12-30.csv",
    "../Datasets-15-16season/liverpool2016-01-02.csv",
    "../Datasets-15-16season/liverpool2016-01-13.csv",
    "../Datasets-15-16season/liverpool2016-01-17.csv",
    "../Datasets-15-16season/liverpool2016-01-23.csv",
    "../Datasets-15-16season/liverpool2016-02-02.csv",
    "../Datasets-15-16season/liverpool2016-02-06.csv",
    "../Datasets-15-16season/liverpool2016-02-14.csv",
    "../Datasets-15-16season/liverpool2016-03-02.csv",
    "../Datasets-15-16season/liverpool2016-03-06.csv",
    "../Datasets-15-16season/liverpool2016-03-20.csv",
    "../Datasets-15-16season/liverpool2016-04-02.csv",
    "../Datasets-15-16season/liverpool2016-04-10.csv",
    "../Datasets-15-16season/liverpool2016-04-17.csv",
    "../Datasets-15-16season/liverpool2016-04-20.csv",
    "../Datasets-15-16season/liverpool2016-04-23.csv",
    "../Datasets-15-16season/liverpool2016-05-01.csv",
    "../Datasets-15-16season/liverpool2016-05-08.csv",
    "../Datasets-15-16season/liverpool2016-05-11.csv",
    "../Datasets-15-16season/liverpool2016-05-15.csv"
];

Promise.all(files.map(f => d3.csv(f, d3.autoType))).then(allFiles => {

    const rawData = allFiles.flat();

    const goals = rawData.filter(d =>
        d.type === "Shot" &&
        d.shot_outcome === "Goal"
    );

    const goalsByPlayer = d3.rollup(
        goals,
        v => v.length,
        d => d.player || "Unknown"
    );

    fullData = Array.from(goalsByPlayer, ([player, goals]) => ({ player, goals }));

    const maxGoals = d3.max(fullData, d => d.goals);

    // Slider
    d3.select("#goalSlider")
        .attr("max", maxGoals)
        .on("input", function () {
            currentMinGoals = +this.value;
            d3.select("#goalValue").text(currentMinGoals);
            updateChart();
        });

    // Sort button
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

    // Bars
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

    // Labels
    svg.selectAll(".label")
        .data(data)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("y", d => y(d.player) + y.bandwidth() / 2 + 4)
        .attr("x", d => x(d.goals) + 5)
        .text(d => d.goals);

    // Axes
    svg.append("g").call(d3.axisLeft(y));
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x));

    // Axis labels
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
