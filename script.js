// Define global variables
const parseDate = d3.timeParse("%Y-%m-%d");
const formatDate = d3.timeFormat("%Y-%m-%d");
const startDate = parseDate('2020-01-13');
const endDate = parseDate('2021-03-07');
const dates = d3.timeDays(startDate, endDate);

let positiveData, deathData, populationData, positiveCasesData, deathCasesData;

Promise.all([
    d3.json('gz_2010_us_040_00_500k.json'),
    d3.csv('Positive_Percentage.csv'),
    d3.csv('Death_Percentage.csv'),
    d3.csv('Population.csv'),
    d3.csv('Positive.csv'),
    d3.csv('Death.csv')
]).then(function([geoData, positiveCSV, deathCSV, populationCSV, positiveCasesCSV, deathCasesCSV]) {
    positiveData = positiveCSV;
    deathData = deathCSV;
    populationData = populationCSV;
    positiveCasesData = positiveCasesCSV;
    deathCasesData = deathCasesCSV;

    // Convert positive data to a more usable format
    positiveData.forEach(d => {
        for (let key in d) {
            if (key !== "state") {
                d[key] = +d[key] * 100; // Convert to percentage
            }
        }
    });

    // Initialize the map and slider
    initMap(geoData);
    initSlider();
    updateMap(dates[0]); // Initialize the map with the first date's data
});

function initMap(geoData) {
    const width = document.getElementById('map').offsetWidth;
    const height = document.getElementById('map').offsetHeight;
    const projection = d3.geoAlbersUsa().scale(1000).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    const svg = d3.select("#map").append("svg")
        .attr("width", width)
        .attr("height", height);

    svg.selectAll("path")
        .data(geoData.features)
        .enter().append("path")
        .attr("d", path)
        .attr("class", "state")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "orange");
            showPieChart(event, d.properties.NAME);
        })
        .on("mouseout", function(event, d) {
            updateMap(dates[d3.select("#time-slider").node().value]); // Revert to the current date's color on mouse out
            d3.select("#piechart-tooltip").classed("hidden", true);
        });
}

function initLegend() {
    const legendWidth = 500;
    const legendHeight = 100;

    const svg = d3.select("#legend")
        .attr("width", legendWidth)
        .attr("height", legendHeight);

    const gradient = svg.append("defs")
        .append("linearGradient")
        .attr("id", "gradient")
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d3.interpolateBlues(0));
    
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d3.interpolateBlues(1));

    svg.append("rect")
        .attr("width", legendWidth)
        .attr("height", 10)
        .style("fill", "url(#gradient)");

    const xScale = d3.scaleLinear()
        .domain([0, 15]) // 与 colorScale 的 domain 相同
        .range([0, legendWidth]);

    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d => d + "%");

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0, 10)")
        .call(xAxis);

    svg.append("text")
        .attr("class", "legend-title")
        .attr("x", legendWidth / 2)
        .attr("y", 40)
        .attr("text-anchor", "middle")
        .text("Positive Percentage of the State");
}

initLegend();


function initSlider() {
    const slider = d3.select("#time-slider")
        .attr("min", 0)
        .attr("max", dates.length - 1)
        .attr("value", 0)
        .on("input", function() {
            const date = dates[this.value];
            d3.select("#current-date").text(formatDate(date));
            updateMap(date); // Update the map based on the current slider date
        });

    slider.node().value = 0;
    d3.select("#current-date").text(formatDate(dates[0]));
}

function updateMap(date) {
    const currentDate = formatDate(date);
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, 10]); // Adjust the color scale based on the data range

    d3.selectAll(".state")
        .attr("fill", function(d) {
            const state = d.properties.NAME;
            const positivePercentage = positiveData.find(p => p.state === state)[currentDate];
            return positivePercentage !== undefined ? colorScale(positivePercentage) : "#ccc";
        });
}

function showPieChart(event, state) {
    const dateIndex = d3.select("#time-slider").node().value;
    const currentDate = formatDate(dates[dateIndex]);

    const positiveCases = positiveCasesData.find(d => d.state === state)[currentDate];
    const deathCases = deathCasesData.find(d => d.state === state)[currentDate];
    const population = populationData.find(d => d.State === state).Population;

    const positivePercentage = (positiveCases / population) * 100;
    const deathPercentage = (deathCases / population) * 100;
    const nonPositivePercentage = 100 - positivePercentage;

    const data = [
        { label: "Non-Positive", value: nonPositivePercentage },
        { label: "Positive", value: positivePercentage },
        { label: "Death", value: deathPercentage }
    ];

    const radius = Math.min(250, 250) / 2;
    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.label))
        .range(["lightgray", "#1f77b4", "#ff7f0e"]);

    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);

    const svg = d3.select("#piechart")
        .attr("width", 300)
        .attr("height", 300);

    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${radius},${radius})`);

    g.selectAll("path")
        .data(pie(data))
        .enter().append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.label));

    g.selectAll("text")
        .data(pie(data))
        .enter().append("text")
        .attr("transform", function(d, i) {
            const pos = arc.centroid(d);
            if (i === 1) pos[1] -= 15; // Adjust position for "Positive"
            if (i === 2) pos[1] += 15; // Adjust position for "Death"
            return `translate(${pos})`;
        })
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(d => d.data.label);

    d3.select("#piechart-data").html(`
        <p><strong>State:</strong> ${state}</p>
        <p><strong>Population:</strong> ${population}</p>
        <p><strong>Positive Cases:</strong> ${positiveCases}</p>
        <p><strong>Death Cases:</strong> ${deathCases}</p>
    `);

    d3.select("#piechart-tooltip")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px")
        .classed("hidden", false);
}

// Add this function at the end of script.js

function openTab(evt, tabName) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelector('.tablinks').click();
});

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('ExploratoryAnalysis')) {
        const scatterData = [
            { x: "beds per 1000", y: "death per 100000", id: "scatter1" },
            { x: "physicians per 1000", y: "death per 100000", id: "scatter2" },
            { x: "health expenditure per capita", y: "death per 100000", id: "scatter3" }
        ];
        
        scatterData.forEach(plotScatter);
        
        // Adding regression results
        const regressionResults1 = `
        OLS Regression Results for All Three Variables:
        R-squared: 0.381
        Adj. R-squared: 0.340
        F-statistic: 9.423
        Prob (F-statistic): 5.75e-05
        ----------------------------------------------------------------------------
                                coef    std err          t      P>|t|      [0.025      0.975]
        ----------------------------------------------------------------------------
        const                  73.7242     12.293      5.997      0.000      48.979      98.470
        beds per 1000           1.1218      2.888      0.388      0.700      -4.692       6.935
        health expenditure      0.0017      0.001      1.341      0.186      -0.001       0.004
        per capita
        physicians per 1000    -0.6046      0.144     -4.186      0.000      -0.895      -0.314
        ==============================================================================
        `;

        const regressionResults2 = `
        OLS Regression Results for Two Variables:
        R-squared: 0.379
        Adj. R-squared: 0.352
        F-statistic: 14.32
        Prob (F-statistic): 1.39e-05
        ----------------------------------------------------------------------------
                                coef    std err          t      P>|t|      [0.025      0.975]
        ----------------------------------------------------------------------------
        const                  76.5784      9.766      7.841      0.000      56.932      96.225
        health expenditure      0.0019      0.001      1.629      0.110      -0.000       0.004
        per capita
        physicians per 1000    -0.6299      0.128     -4.933      0.000      -0.887      -0.373
        ==============================================================================
        `;

        document.getElementById('regression-results1').textContent = regressionResults1;
        document.getElementById('regression-results2').textContent = regressionResults2;
    }
});


// Function to plot scatter plots
function plotScatter(data) {
    d3.csv('Merged Health Data.csv').then(function(dataset) {
        const svg = d3.select(`#${data.id}`);
        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const width = +svg.attr('width') - margin.left - margin.right;
        const height = +svg.attr('height') - margin.top - margin.bottom;
        
        const x = d3.scaleLinear()
            .domain(d3.extent(dataset, d => +d[data.x])).nice()
            .range([margin.left, width - margin.right]);
        
        const y = d3.scaleLinear()
            .domain(d3.extent(dataset, d => +d[data.y])).nice()
            .range([height - margin.bottom, margin.top]);

        const xAxis = g => g
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x))
            .call(g => g.append('text')
                .attr('x', width - margin.right)
                .attr('y', -4)
                .attr('fill', '#000')
                .attr('text-anchor', 'end')
                .text(data.x));

        const yAxis = g => g
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y))
            .call(g => g.append('text')
                .attr('x', 4)
                .attr('y', margin.top)
                .attr('dy', '-1em')
                .attr('fill', '#000')
                .attr('text-anchor', 'start')
                .text(data.y));

        svg.append('g')
            .selectAll('circle')
            .data(dataset)
            .join('circle')
            .attr('cx', d => x(+d[data.x]))
            .attr('cy', d => y(+d[data.y]))
            .attr('r', 3)
            .attr('fill', 'steelblue');

        svg.append('g').call(xAxis);
        svg.append('g').call(yAxis);
    });
}









function calculateNewDeathRates() {
    const physicianChange = parseFloat(document.getElementById('physiciansChange').value);
    const healthExpenditureChange = parseFloat(document.getElementById('healthExpenditureChange').value);

    // Load state data with actual initial values
    const stateData = {
        'New York': { physiciansPer1000: 3.5, healthExpenditurePerCapita: 9500 },
        'California': { physiciansPer1000: 2.9, healthExpenditurePerCapita: 7500 },
        'Washington': { physiciansPer1000: 4.1, healthExpenditurePerCapita: 8500 },
        'Florida': { physiciansPer1000: 2.8, healthExpenditurePerCapita: 7000 }
    };

    let resultsHTML = `<h3>Updated Death Rates</h3>`;
    const plotData = [];

    for (const state in stateData) {
        const data = stateData[state];
        // Calculate old death rate using the regression formula
        const oldDeathRate = 76.5784 + 0.0019 * data.healthExpenditurePerCapita - 0.6299 * data.physiciansPer1000;

        // Calculate new values for physicians and health expenditure
        const newPhysicians = data.physiciansPer1000 * (1 + physicianChange / 100);
        const newHealthExpenditure = data.healthExpenditurePerCapita * (1 + healthExpenditureChange / 100);

        // Calculate new death rate using the updated values
        const newDeathRate = 76.5784 + 0.0019 * newHealthExpenditure - 0.6299 * newPhysicians;
        resultsHTML += `<p>${state}: Old Death Rate - ${oldDeathRate.toFixed(2)}, New Death Rate - ${newDeathRate.toFixed(2)}</p>`;
        plotData.push({state, oldRate: oldDeathRate, newRate: newDeathRate});
    }

    document.getElementById('deathRateResults').innerHTML = resultsHTML;
    drawHistogram(plotData);
}





function drawHistogram(data) {
    const svg = d3.select("#deathRatePlot"),
          width = 500,
          height = 300,
          margin = {top: 20, right: 30, bottom: 40, left: 50};

    // Clear existing SVG content before redrawing
    svg.selectAll("*").remove();

    svg.attr("width", width)
       .attr("height", height);

    const x = d3.scaleBand()
        .range([margin.left, width - margin.right])
        .padding(0.1)
        .domain(data.map(d => d.state));  // Use only state names for the domain

    const y = d3.scaleLinear()
        .range([height - margin.bottom, margin.top])
        .domain([0, d3.max(data, d => Math.max(d.oldRate, d.newRate))]).nice();

    const xAxis = g => g
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));

    const yAxis = g => g
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

    svg.append("g").call(xAxis);
    svg.append("g").call(yAxis);

    const group = svg.selectAll(".group")
        .data(data)
        .enter().append("g")
        .attr("transform", d => `translate(${x(d.state)}, 0)`);

    // Creating two bars for each state group
    group.selectAll("rect")
        .data(d => [{key: "Old", value: d.oldRate}, {key: "New", value: d.newRate}])
        .enter().append("rect")
        .attr("x", (d, i) => i * (x.bandwidth() / 2))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth() / 2)
        .attr("height", d => height - margin.bottom - y(d.value))
        .attr("fill", d => d.key === "Old" ? "steelblue" : "orange");

    // Optional: adding labels to distinguish Old/New within each grouped bar
    group.selectAll("text")
        .data(d => [{key: "Old", value: d.oldRate}, {key: "New", value: d.newRate}])
        .enter().append("text")
        .attr("x", (d, i) => i * (x.bandwidth() / 2) + (x.bandwidth() / 4))
        .attr("y", d => y(d.value) - 5)
        .attr("text-anchor", "middle")
        .text(d => d.key);
}
