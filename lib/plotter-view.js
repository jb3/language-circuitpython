"use babel";

/* global document atom */

import Chart from "chart.js";

export class PlotterView {
    constructor(atomSerialPort) {

        this.element = document.createElement("div");
        this.element.style = "position: relative; width: 100%; height: 100%; overflow-y: scroll;";
        this.element.classList.add("chart-container");

        this.chartElem = document.createElement("canvas");
        this.chartElem.classList.add("language-circuitpython-plotter");
        this.chartElem.id = "language-circuitpython-plotter";

        this.element.appendChild(this.chartElem);

        this.datasetColors = [];

        this.atomSerialPort = atomSerialPort;

        this.connect();
    }

    connect() {
        this.atomSerialPort.data( (sp) => {
            this.sp = sp;
            this.sp.on("data", (data) => {
                this.useData(data.toString());
            });
        });
    }

    randomColour() {
        let maximum, minimum;

        if (atom.config.get("language-circuitpython.darkMode") == "dark") {
            maximum = 255;
            minimum = 150;
        } else {
            maximum = 150;
            minimum = 25;
        }

        let r = Math.floor(Math.random() * (maximum - minimum + 1) + minimum);
        let g = Math.floor(Math.random() * (maximum - minimum + 1) + minimum);
        let b = Math.floor(Math.random() * (maximum - minimum + 1) + minimum);

        return [r, g, b];
    }

    createChart(data) {
        let ctx = document.getElementById("language-circuitpython-plotter").getContext("2d");

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
        if(!(data.startsWith("(") && data.endsWith(")\r\n"))) {
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
            deserializer: "language-circuitpython/PlotterView"
        };
    }

    destroy() {
        this.element.remove();
        this.atomSerialPort.close();
    }

    getElement() {
        return this.element;
    }
}
