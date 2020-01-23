"use babel";

/* global atom document */

import { PlotterView } from "./plotter-view";

import SerialPort from "serialport";

const vendorIDs = [
    "239a" // Adafruit vendor ID
];

export class BoardView {
    constructor() {
        this.element = document.createElement("div");
        this.element.classList.add("language-circuitpython-serial");
        this.element.style = "width: 100% height: 100%;";

        // This textarea is the CircuitPython REPL
        const message = document.createElement("textarea");
        message.style = "width: 100%; height: 100%; overflow-y: scroll;";
        message.classList.add("atom-circuitp-code");
        this.element.appendChild(message);

        this.logs = message;

        this.cursorPosition = 0;

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

            this.sp.on("data", (data) => {
                this.sendToPlotter(data);
                let shouldScroll = false;

                // If 10 or less pixels from bottom then scroll with new output
                if (this.logs.scrollHeight - this.logs.clientHeight <= this.logs.scrollTop + 10) {
                    shouldScroll = true;
                }

                // Much of this code for communicating with the REPL over Serial
                // was converted from the mu text editor.
                // https://github.com/mu-editor/mu/blob/ee600ff16753194f33e39975662aba438a8f5608/mu/interface/panes.py#L243:L304
                i = 0;
                while (i < data.length) {
                    if (data[i] == 8) {  // \b
                        this.moveCursorLeft(1);
                    }else if (data[i] == 13) {  // \r
                        // do nothing
                    }else if (data.length > i + 1 && data[i] == 27 && data[i + 1] == 91) {
                        // VT100 cursor detected: <Esc>[
                        i+=2; // move index to after the [
                        let re = /(?<count>[0-9]*)(;?[0-9]*)*(?<action>[ABCDKm])/;
                        var m = re.exec(data.slice(i).toString());
                        if (m != null) {
                            // move to (almost) after control seq
                            // (will ++ at end of loop)
                            mEnd = m.index + m[0].length;
                            i += mEnd-1;

                            var count = 1;
                            if (m.groups.count == "") {
                                count = 1;
                            }else{
                                count = parseInt(m.groups.count);
                            }

                            if (m.groups.action == "A") { // up
                                // Not Used
                            }else if (m.groups.action == "B") {  // down
                                // Not Used
                            }else if (m.groups.action == "C") {  // right
                                // Not Used
                            }else if (m.groups.action == "D") {  // left
                                this.moveCursorLeft(count);
                            }else if (m.groups.action == "K") { // delete things
                                if (m.groups.count == "") {
                                    this.deleteLine();
                                }
                            }
                        }
                    }else if (data[i] == 10) {  // \n
                        this.moveCursorToEnd();
                        this.insertChar(data[i]);
                        this.removeExcessLines();
                    }else{
                        this.deleteChar();
                        this.insertChar(data[i]);
                    }
                    i++;
                }

                if(shouldScroll) {
                    this.logs.scrollTop = this.logs.scrollHeight;
                }
            });

            // Override the normal behavior of the textarea. When a key is pressed
            // intercept it and send it to device running CircuitPython.
            // https://github.com/mu-editor/mu/blob/ee600ff16753194f33e39975662aba438a8f5608/mu/interface/panes.py#L192:L241
            // TODO - Add the keypresses for windows (delete, home, end) and appropriate copy/paste for windows vs mac
            this.logs.addEventListener('keydown', (event) => {
                if (atom.inDevMode()) {
                    console.log("Key pressed: " + event.keyCode);
                }
                if (event.keyCode == 13) { // Enter
                    this.sp.write("\r");
                }else if(event.keyCode == 8) { // backspace (delete key on Mac)
                    this.sp.write("\b");
                }else if (event.keyCode == 37) { // Left
                    this.sp.write("\x1B[D")
                }else if (event.keyCode == 38) { // Up
                    this.sp.write("\x1B[A")
                }else if (event.keyCode == 39) { // Right
                    this.sp.write("\x1B[C")
                }else if (event.keyCode == 40) { // Down
                    this.sp.write("\x1B[B")
                }else if (this.printableKeyPress(event.keyCode)) {
                    if (event.getModifierState("Control")) {
                        // The microbit treats an input of \x01 as Ctrl+A, etc.
                        this.sp.write(String.fromCharCode(1+event.keyCode-65));
                    }else if(event.getModifierState("Meta")) { // cmd on Mac
                        if (event.keyCode == 67) { // c
                            atom.clipboard.write(this.selectedText());
                        }else if (event.keyCode == 86) { // v
                            this.sp.write(atom.clipboard.read());
                        }else if (event.keyCode == 65) { // a
                            this.selectAllText();
                        }
                    }else{
                        this.sp.write(event.key);
                    }
                }
                event.stopPropagation();
                event.preventDefault();
            });

            atom.notifications.addSuccess("Acquired board!");
        });
    }

    printableKeyPress(keyCode) {
        var valid =
        (keyCode > 47 && keyCode < 58)   || // number keys
        keyCode == 32                    || // spacebar
        (keyCode > 64 && keyCode < 91)   || // letter keys
        (keyCode > 95 && keyCode < 112)  || // numpad keys
        (keyCode > 185 && keyCode < 193) || // ;=,-./` (in order)
        (keyCode > 218 && keyCode < 223);   // [\]' (in order)
        return valid;
    }

    selectedText() {
        return this.logs.textContent.substring(this.logs.selectionStart, this.logs.selectionEnd);
    }

    selectAllText() {
        this.logs.selectionStart = 0;
        this.logs.selectionEnd = this.logs.textLength;
    }

    moveCursorTo(position) {
        this.cursorPosition = position;
        this.logs.selectionStart = this.cursorPosition;
        this.logs.selectionEnd = this.cursorPosition;
    }

    moveCursorLeft(count) {
        this.moveCursorTo(this.cursorPosition-count);
    }

    moveCursorToEnd() {
        this.moveCursorTo(this.logs.textLength);
    }

    insertChar(char) {
        var sel = window.getSelection();
        var currentText = this.logs.textContent
        var text = String.fromCharCode(char)
        this.logs.textContent = currentText.substring(0, this.cursorPosition) + text + currentText.substring(this.cursorPosition);
        this.moveCursorTo(this.cursorPosition+1)
    }

    deleteChar() {
        var currentText = this.logs.textContent;
        this.logs.textContent = currentText.substring(0, this.cursorPosition) + currentText.substring(this.cursorPosition+1);
        this.moveCursorTo(this.cursorPosition);
    }

    deleteLine() {
        while (this.logs.textLength > this.cursorPosition) {
            this.deleteChar();
        }
    }

    removeExcessLines() {
        if (this.logs.textContent.split("\n").length > atom.config.get("language-circuitpython.maxLines")) {
            this.logs.textContent = this.logs.textContent.split("\n").slice(atom.config.get("language-circuitpython.maxLines") - 40).join("\n");
            this.moveCursorToEnd();
        }
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
            deserializer: "language-circuitpython/BoardView"
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
            if(!this.sp.closed)
                this.sp.close();
        }
    }
}
