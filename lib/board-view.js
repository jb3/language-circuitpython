"use babel";

import * as fs from "fs";
import * as glob from "glob";

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
    // Search for all serial ports connected.
        let files = glob.sync("/dev/cu.usbmodem*");

        atom.notifications.addInfo("Attempting to locate board");

        if (files.length < 1) {
            // No serial found
            atom.notifications.addError("Could not find a board connected, please check the connection.");
            this.destroy();
            return;
        }

        let chosenBoard = files[0];

        // Create a stream to the serial
        this.fifo = fs.createReadStream(chosenBoard);

        this.fifo.on("data", (data) => {
            let shouldScroll = false;

            // If 10 or less pixels from bottom then scroll with  new output
            if (this.logs.scrollHeight - this.logs.clientHeight <= this.logs.scrollTop + 10) {
                shouldScroll = true;
            }

            this.logs.textContent += data;

            if(shouldScroll) {
                this.logs.scrollTop = this.logs.scrollHeight;
            }
        });

        this.isConnected = true;
        atom.notifications.addSuccess("Acquired board!");
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
        this.fifo.destroy();
        this.isConnected = false;
    }
}
