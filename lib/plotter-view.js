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
    }

    createChart(data) {
        let ctx = document.getElementById("atom-circuitpython-plotter").getContext("2d");

        let datasets = data.map((v) => {
            return {
                data: [v]
            };
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
                elements: {
                    line: {
                        tension: 0 // disables bezier curves
                    }
                },
                animation: {
                    duration: 0 // general animation time
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

        if(this.pointCount < 20) {
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
