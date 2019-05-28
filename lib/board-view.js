"use babel";

/* global atom document */

import { PlotterView } from "./plotter-view";

import SerialPort from "serialport";
import Readline from "@serialport/parser-readline";

const vendorIDs = [
    "239a" // Adafruit vendor ID
];

export class BoardView {
    constructor() {
        this.element = document.createElement("div");
        this.element.classList.add("atom-circuitpython-serial");
        this.element.style = "width: 100% height: 100%;";

        // This pre is where new logs are inserted
        const message = document.createElement("pre");
        message.style = "width: 100%; height: 100%; overflow-y: scroll;";
        message.classList.add("atom-circuitp-code");
        this.element.appendChild(message);

        this.logs = message;

        this.connect();
    }

    connect() {
        SerialPort.list().then((ports) => {
            atom.notifications.addInfo("Attempting to locate board");

            ports = ports.map((v) => {
                if (!v.vendorId) {
                    v.vendorId = "";
                }

                return v;
            });

            let chosenBoard = ports.find(e => vendorIDs.indexOf(e.vendorId.toLowerCase()) != -1);

            if (!chosenBoard) {
                atom.notifications.addError("Could not find a valid device");
                return;
            }
            // Create a stream to the serial
            this.sp = new SerialPort(chosenBoard.comName);

            this.parser = new Readline();
            this.sp.pipe(this.parser);

            this.parser.on("data", (data) => {
                this.sendToPlotter(data);
                let shouldScroll = false;

                // If 10 or less pixels from bottom then scroll with  new output
                if (this.logs.scrollHeight - this.logs.clientHeight <= this.logs.scrollTop + 10) {
                    shouldScroll = true;
                }

                this.logs.textContent += data + "\n";

                if(shouldScroll) {
                    this.logs.scrollTop = this.logs.scrollHeight;
                }
            });

            atom.notifications.addSuccess("Acquired board!");
        });
    }

    sendToPlotter(data) {
        atom.workspace.getPanes().forEach(item => {
            item.getItems().forEach(p => {
                if (p instanceof PlotterView) {
                    p.useData(data);
                }
            });
        });
    }

    getTitle() {
        return "CircuitPython Serial";
    }

    getDefaultLocation() {
        return "bottom";
    }

    getAllowedLocations() {
        return ["left", "right", "bottom"];
    }

    serialize() {
        return {
            deserializer: "atom-circuitpython/BoardView"
        };
    }

    destroy() {
        this.element.remove();
        this.disconnect();
    }

    getElement() {
        return this.element;
    }

    disconnect() {
        // Close the stream if one is opened
        if (this.sp) {
            atom.notifications.addInfo("Disconnecting from board");
            this.sp.close();
        }
    }
}
