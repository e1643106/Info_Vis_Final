

const width = 1200
const height = 800

const shotsDataBase = document.body.dataset.shotsBase || "data";

const resolveShotCsv = (value) => {
  if (!value) {
    return `${shotsDataBase}/liverpool20150809stokecity.csv`;
  }
  if (value.includes("/")) {
    return value;
  }
  return `${shotsDataBase}/${value}`;
};

const svg = d3.select("#pitch")
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", "0 0 120 80")

const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)   //https://observablehq.com/@d3/color-schemes
  .domain([0, 1]);  

const xglegend = svg.append("xglegend");                      //https://www.visualcinnamon.com/2016/05/smooth-color-legend-d3-svg-gradient/

var linearGradient = xglegend.append("linearGradient")
  .attr("id", "legend-gradient");

linearGradient.append("stop")
  .attr("offset", "0%")
  .attr("stop-color", "#a50026");

linearGradient.append("stop")
  .attr("offset", "50%")
  .attr("stop-color", "#feeda2");

linearGradient.append("stop")
  .attr("offset", "100%")
  .attr("stop-color", "#006837");

svg.append("rect")                          
  .attr("x", 10)
  .attr("y", 8)
  .attr("width", 40)
  .attr("height", 5)
  .attr("fill", "url(#legend-gradient)")
  .attr("stroke", "white")
  .attr("stroke-width", 0.3);

svg.append("text")
  .attr("x", 30)
  .attr("y", 6)
  .attr("font-size", 3)
  .attr("text-anchor", "middle")
  .attr("fill", "white") 
  .text("xG Probability")
svg.append("text")
  .attr("x", 10)
  .attr("y", 15)
  .attr("font-size", 2)
  .attr("text-anchor", "middle")
  .attr("fill", "white") 
  .text("0%")
svg.append("text")
  .attr("x", 30)
  .attr("y", 15)
  .attr("font-size", 2)
  .attr("text-anchor", "middle")
  .attr("fill", "white") 
  .text("50%")
svg.append("text")
  .attr("x", 50)
  .attr("y", 15)
  .attr("font-size", 2)
  .attr("text-anchor", "middle")
  .attr("fill", "white") 
  .text("100%")

const dropdown = d3.select("#gameDropdown");
selectGame(resolveShotCsv(dropdown.property("value")));
dropdown.on("change", function () {
  const selectedFile = d3.select(this).property("value");    //https://d3-graph-gallery.com/graph/interactivity_button.html
  selectGame(resolveShotCsv(selectedFile));
})


const infoBox = svg.append("g")
  .attr("class", "infobox")
  infoBox.append("rect")
  .attr("width", 50)
  .attr("height", 30)
  .attr("x", 5)
  .attr("y", 28)
  .attr("rx", 1)
  .attr("ry", 1)
  .attr("fill", "black")
  .attr("opacity", 0.95)
  .attr("stroke", "white")
  .attr("stroke-width", 0.5)
  const boxTitle = infoBox.append("text")
  .attr("x", 19)
  .attr("y", 32)
  .attr("font-size", 3)
  .attr("fill", "white") 
  .text("Shot information")
  const boxPlayer = infoBox.append("text")
  .attr("x", 9)
  .attr("y", 37)
  .attr("font-size", 2)
  .attr("fill", "white") 
  .text("Player: ")
  const boxMinute = infoBox.append("text")
  .attr("x", 9)
  .attr("y", 41)
  .attr("font-size", 2)
  .attr("fill", "white") 
  .text("Minute: ")
  const boxOutcome = infoBox.append("text")
  .attr("x", 9)
  .attr("y", 45)
  .attr("font-size", 2)
  .attr("fill", "white") 
  .text("Outcome: ")
  const boxPattern = infoBox.append("text")
  .attr("x", 9)
  .attr("y", 49)
  .attr("font-size", 2)
  .attr("fill", "white") 
  .text("Play type: ")
  const boxPercentage = infoBox.append("text")
  .attr("x", 9)
  .attr("y", 53)
  .attr("font-size", 2)
  .attr("fill", "white") 
  .text("xG probability: ")
  

const infoTexts = [boxTitle, boxPlayer, boxMinute, boxOutcome, boxPattern ,boxPercentage];

const defs = svg.append("defs");
const shotlineGradient = defs.append("linearGradient")
  .attr("id", "shotline-gradient")
  .attr("gradientUnits", "userSpaceOnUse");

shotlineGradient.append("stop")
  .attr("offset", "0%")
  .attr("stop-color", "light blue")
  .attr("stop-opacity", 1);

shotlineGradient.append("stop")
  .attr("offset", "50%")
  .attr("stop-color", "blue")
  .attr("stop-opacity", 1);

  shotlineGradient.append("stop")
  .attr("offset", "100%")
  .attr("stop-color", "cyan")
  .attr("stop-opacity", 1);

function selectGame(csvfile){
  d3.csv(csvfile).then(data => {
    // Print out the data on the console
    console.log(data);
    console.log(location)
    data.forEach(d => {
      const pos = JSON.parse(d.location);
      const endpos = JSON.parse(d.shot_end_location);
      d.x = pos[0];
      d.y = pos[1];
      d.endx = endpos[0];
      d.endy = endpos[1];
      d.xg = +d.shot_statsbomb_xg;
      d.playername = d.player
      d.shottime = d.minute
      d.outcome = d.shot_outcome
      d.pattern = d.play_pattern
      console.log("x: ", pos[0]);
      console.log("y: ", pos[1]);
      console.log("endx: ", endpos[0]);
      console.log("endy: ", endpos[1]);

    });

    svg.selectAll("circle.shot").remove();


    const shots = svg.selectAll("circle.shot")
      .data(data);

    const shotsAnim = shots.enter()                   
      .append("circle")
      .attr("class", "shot")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", 0)
      .attr("fill", d => colorScale(d.xg))
      .attr("stroke", d => d.outcome === "Goal" ? "cyan" : "black")
      .attr("stroke-width", 0.2)

    shotsAnim                                       //animation with the help of AI
      .transition()                                             //#
      .delay((d, i) => i* 80)                                   //#
      .duration(400)                                            //#
      .attr("r", 1.1)                                           //#
      .style("opacity", 1)                                      //#
      
      //shots.append("title")
      //.text(d => `x: ${d.x}, y: ${d.y}\n` + `Player: ${d.playername}`)

    const lineLayer = svg.append("g").attr("class", "lines");
    shotsAnim.on("mouseover", function (event, d) {          //information display with help of AI
      //console.log("MOUSEDETECTED!!!!!!");                                           
      lineLayer.selectAll("line.hover-line").remove();                                //#
                                                                                      //#
      boxTitle.text(`Shot information`);                                              //#
      boxPlayer.text(`Player: ${d.playername}`)                                       //#
      boxMinute.text(`Minute: ${d.shottime}`) 
      boxPattern.text(`Play type: ${d.pattern}`)                                         //#
      boxPercentage.text(`xG Probability: ${(d.xg*100).toFixed(5)}%`)               //#
      boxOutcome.text(`Outcome: ${d.outcome}`)                                        
                .attr("fill", d.outcome === "Goal" ? "cyan" : "white");

      animateInfoTexts();

      lineLayer.append("line")
        .attr("class", "hover-line")
        .attr("x1", d.x)
        .attr("y1", d.y)
        .attr("x2", d.endx)
        .attr("y2", d.endy)
        .transition()
        .duration(350)
        .attr("stroke", "url(#shotline-gradient)")
        .attr("stroke-width", 0.5)
        .style("pointer-events", "none");
    })
    .on("mouseout", function () {                                           //https://observablehq.com/@matthewbernabeu/mouseover-mouseout-events
      lineLayer.selectAll("line.hover-line").remove();
    });

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
