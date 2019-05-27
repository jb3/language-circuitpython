"use babel";

/* global atom document */

import SerialPort from "serialport";
import Readline from "@serialport/parser-readline";

const vendorIDs = [
    "239a" // Adafruit vendor ID
];

export class BoardView {
    constructor() {
        this.element = document.createElement("div");
        this.element.classList.add("atom-circuitpython");
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

            let chosenBoard = ports.find(e => vendorIDs.indexOf(e.vendorId) != -1);

            if (!chosenBoard) {
                atom.notifications.addError("Could not find a valid device");
                return;
            }
            // Create a stream to the serial
            this.sp = new SerialPort(chosenBoard.comName);

            this.parser = new Readline();
            this.sp.pipe(this.parser);

            this.parser.on("data", (data) => {
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

            this.isConnected = true;
            atom.notifications.addSuccess("Acquired board!");
        });
    }

    getTitle() {
        return "Atom CircuitPython";
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
        atom.notifications.addInfo("Disconnecting from board");
        // Close the stream
        this.sp.close();
        this.isConnected = false;
    }
}
