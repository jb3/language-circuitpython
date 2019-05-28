"use babel";

/* global document */

import Chart from "chart.js";

export class PlotterView {
    constructor() {

        this.element = document.createElement("div");
        this.element.style = "position: relative; width: 100%; height: 100%; overflow-y: scroll;";
        this.element.classList.add("chart-container");

        this.chartElem = document.createElement("canvas");
        this.chartElem.classList.add("atom-circuitpython-plotter");
        this.chartElem.id = "atom-circuitpython-plotter";

        this.element.appendChild(this.chartElem);

        this.datasetColors = [];
    }

    randomColour() {
        let maximum = 255;
        let minimum = 100;

        let r = Math.floor(Math.random() * (maximum - minimum + 1) + minimum);
        let g = Math.floor(Math.random() * (maximum - minimum + 1) + minimum);
        let b = Math.floor(Math.random() * (maximum - minimum + 1) + minimum);

        return [r, g, b];
    }

    createChart(data) {
        let ctx = document.getElementById("atom-circuitpython-plotter").getContext("2d");

        let datasets = data.map((v) => {
            const [r,g,b] = this.randomColour();
            let d = {
                data: [v],
                backgroundColor: `rgba(${r}, ${g}, ${b}, 0.2)`,
                borderColor: `rgba(${r}, ${g}, ${b}, 1)`
            };
            return d;
        });

        this.chart = new Chart(ctx, {
            // The type of chart we want to create
            type: "line",

            // The data for our dataset
            data: {
                labels: ["Point 0"],
                datasets: datasets
            },

            // Configuration options go here
            options: {
                maintainAspectRatio: false,
                legend:
                {
                    display: false
                },
                scales: {
                    xAxes: [{
                        display: false
                    }]
                },
                animation: {
                    duration: 10 // general animation time
                },
                hover: {
                    animationDuration: 0 // duration of animations when hovering an item
                },
                responsiveAnimationDuration: 0 // animation duration after a resize
            }
        });
    }

    useData(data) {
        if(!(data.startsWith("(") && data.endsWith(")\r"))) {
            return;
        }

        let values = data
            .split("")
            .slice(1)
            .reverse()
            .slice(2)
            .reverse()
            .join("")
            .split(", ")
            .map(v => parseFloat(v));


        if(!this.chart) {
            this.createChart(values);
            this.pointCount = 0;
            return;
        }

        if(this.pointCount < 80) {
            this.chart.data.labels.push(`Point ${this.pointCount + 1}`);
            this.pointCount += 1;

            this.chart.data.datasets.forEach((dataset, i) => {
                dataset.data.push(values[i]);
            });


        } else {
            this.chart.data.datasets.forEach((dataset, i) => {
                dataset.data = dataset.data.slice(1);
                dataset.data.push(values[i]);
            });
        }

        this.chart.update();
    }

    getTitle() {
        return "CircuitPython Plotter";
    }

    getDefaultLocation() {
        return "bottom";
    }

    getAllowedLocations() {
        return ["left", "right", "bottom"];
    }

    serialize() {
        return {
            deserializer: "atom-circuitpython/PlotterView"
        };
    }

    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }
}
