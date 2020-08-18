"use babel";

/* global atom document */

import { DelayParser } from "./parser-delay";

export class BoardView {
    constructor(atomSerialPort) {
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
        this.lineCount = 1;

        this.truncateOutput = atom.config.get("language-circuitpython.truncateOutput");
        atom.config.observe("language-circuitpython.truncateOutput", (newValue) => {
            this.truncateOutput = newValue;
        });

        this.maxLines = atom.config.get("language-circuitpython.maxLines");
        atom.config.observe("language-circuitpython.maxLines", (newValue) => {
            this.maxLines = newValue;
        });

        this.outputBuffer = Buffer.alloc(0);
        this.printingOutput = false;
        this.floodCount = 0;
        this.bufferFlooded = false;
        this.resetFlooded = null;

        this.line = "";

        this.atomSerialPort = atomSerialPort;

        this.connect();
        this.textareaListener();
    }

    connect() {
        this.atomSerialPort.data( (sp) => {
            this.sp = sp;
            this.parser = new DelayParser(); // This makes sure text is printed smoothly
            this.sp.pipe(this.parser);

            this.parser.on("data", (data) => {
                this.outputBuffer = Buffer.concat([this.outputBuffer, data]);
                this.floodCount++;
                this.checkForFlooding();
                // If printingOutput is already scheduled to run, don't call again
                if (!this.printingOutput) {
                    this.printOutput();
                }
            });

            this.sp.on("close", (err) => {
                if (err && err.disconnected) {
                    let shouldScroll = false;
                    if (this.logs.scrollHeight - this.logs.clientHeight <= this.logs.scrollTop + 10) {
                        shouldScroll = true;
                    }
                    var currentText = this.logs.value;
                    this.logs.value = currentText + "\n--- Board Disconnected ---\nUse CTRL-R to attempt reconnect.\n\n";
                    this.lineCount+=4;
                    this.clearLine();
                    this.removeExcessLines();

                    if(shouldScroll) {
                        this.logs.scrollTop = this.logs.scrollHeight;
                    }
                }
            });
        });
    }

    textareaListener() {
        // We no longer block the keydown events. If the keydown is a non printing character,
        // that is relevant, we send that to the microcontroller. Otherwise, anything that
        // results in output to the textarea is handled in the beforeinput event handler.
        // This is done so we can properly handle a wider variety of input methods for utf-8
        // characters.
        this.logs.addEventListener("keydown", (event) => {

            // event.keyCode is deprecated but it seems to be the only way to check for a
            // keydown event that is part of an IME composition
            // https://developer.mozilla.org/en-US/docs/Web/API/Document/keydown_event
            // To Note: While it seems like you should be able to use 'key' and check for
            // the value "Process", this does not work as the actual key is returned instead
            if (this.sp == null || event.isComposing || event.keyCode == 229)
                return;

            if (event.key == "Enter") {
                this.sp.write("\r\n");
            }else if(event.key == "Backspace") {
                this.sp.write("\b");
            }else if (event.key == "Delete") {
                this.sp.write("\x1B[\x33\x7E");
            }else if (event.key == "ArrowLeft") {
                this.sp.write("\x1B[D");
            }else if (event.key == "ArrowUp") {
                this.sp.write("\x1B[A");
            }else if (event.key == "ArrowRight") {
                this.sp.write("\x1B[C");
            }else if (event.key == "ArrowDown") {
                this.sp.write("\x1B[B");
            }else if (event.key == "Home") {
                this.sp.write("\x1B[H");
            }else if (event.key == "End") {
                this.sp.write("\x1B[F");
            }else if (event.getModifierState("Meta") ||   // cmd on Mac
               (process.platform != "darwin" &&     // control + shift on anything else
                event.getModifierState("Control") && event.getModifierState("Shift"))) {
                if (event.key == "c") {
                    atom.clipboard.write(this.selectedText());
                }else if (event.key == "v") {
                    this.sp.write(atom.clipboard.read());
                }else if (event.key == "a") {
                    this.selectAllText();
                }
            }else if (event.getModifierState("Control")) {
                if (event.key == "r" && !this.sp.isOpen) { // r attempt board reconnect
                    this.atomSerialPort.close();
                    this.connect();
                }else if (event.key != "Control") { // Ignore keydown of Control key itself
                    // The microbit treats an input of \x01 as Ctrl+A, etc.
                    var char = event.key.charCodeAt(0);
                    if (char >= 97 && char <= 122) {
                        this.sp.write(String.fromCharCode(1+char-97));
                    }
                }
            }
        });

        this.logs.addEventListener("beforeinput", (event) => {
            if (this.sp == null)
                return;

            var newLineIndex = this.logs.value.lastIndexOf("\n") + 1;
            if (this.cursorPosition+newLineIndex != this.logs.selectionEnd) {
                this.logs.selectionStart = this.cursorPosition + newLineIndex;
                this.logs.selectionEnd = this.cursorPosition + newLineIndex;
            }
            this.logs.scrollTop = this.logs.scrollHeight;
            var replace = this.logs.selectionEnd - this.logs.selectionStart; // Needed for IME
            if (event.data != null) {
                var input = event.data;
                if (replace > 0) {
                    input = "\b".repeat(replace) + input;
                }
                this.sp.write(input);
            }
        });
    }


    printOutput() {
        let shouldScroll = false;
        this.printingOutput = true;
        this.checkForFlooding();

        // If 10 or less pixels from bottom then scroll with new output
        if (this.logs.scrollHeight - this.logs.clientHeight <= this.logs.scrollTop + 10) {
            shouldScroll = true;
        }

        // Much of this code for communicating with the REPL over Serial
        // was converted from the mu text editor.
        // https://github.com/mu-editor/mu/blob/ee600ff16753194f33e39975662aba438a8f5608/mu/interface/panes.py#L243:L304
        var i = 0;
        var data = this.outputBuffer;
        // If the buffer is being flooded with too much data, truncate the buffer so the repl will still
        // be responsive. This will help if there is a loop outputting text with no delay.
        // This functionality can be turned on or off through the 'Truncate Output' setting.
        if (this.truncateOutput && this.bufferFlooded && data.length > 2000) {
            this.outputBuffer = this.outputBuffer.slice(-500);
            data = this.outputBuffer;
            var currentText = this.logs.value;
            this.logs.value = currentText + "\n... (Output Truncated) ...\n";
            this.lineCount+=2;
            this.moveCursorToEnd();
        }
        var start = Date.now();
        while (i < data.length && ((Date.now() - start) < 1000)) {
            // If the buffer is flooded, only print out characters for the duration of the parser delay. This is done
            // to avoid blocking for too long in this loop. By limiting the duration, new input from the parser
            // won't be blocked and won't get too 'backed up'. This also allows for more data to be truncated, if
            // necessary, once again avoiding the printing falling too far behind the microcontroller's output.
            if (this.bufferFlooded && ((Date.now() - start) >= this.parser.delay)) {
                break;
            }

            if (data[i] == 8) {  // \b
                this.moveCursorLeft(1);
            }else if (data[i] == 13) {  // \r
                this.moveCursorTo(0);
            }else if (data.length > i + 1 && data[i] == 27 && data[i + 1] == 91) {
                // VT100 cursor detected: <Esc>[
                i+=2; // move index to after the [
                let re = /(?<count>[0-9]*)(;?[0-9]*)*(?<action>[ABCDKm])/;
                var m = re.exec(data.slice(i).toString());
                if (m != null) {
                    // move to (almost) after control seq
                    // (will ++ at end of loop)
                    let mEnd = m.index + m[0].length;
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
                            this.deleteToEndOfLine();
                        }
                    }
                }
            }else if (data[i] == 10) {  // \n
                this.insertNewLine();
                this.removeExcessLines();
            }else{
                var unicodeBytes = this.numberOfBytes(data[i]);
                this.writeChar(data, i, i+unicodeBytes);
                i+=unicodeBytes-1;
            }
            i++;
        }

        this.updateREPL();

        if(shouldScroll) {
            this.logs.scrollTop = this.logs.scrollHeight;
        }
        if (this.outputBuffer.length > i) {
            // Buffer isn't empty, schedule another printOutput
            setTimeout(this.printOutput.bind(this), 0);
            this.floodCount++;
        }else{
            this.printingOutput = false;
        }
        this.outputBuffer = this.outputBuffer.slice(i); // Update the buffer to whatever hasn't been printed

        // If enough time passes, reset the flood count
        this.resetFlooded = setTimeout(() => {
            this.floodCount = 0;
            this.resetFlooded = null;
        }, 70);
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
        return this.logs.value.substring(this.logs.selectionStart, this.logs.selectionEnd);
    }

    selectAllText() {
        this.logs.selectionStart = 0;
        this.logs.selectionEnd = this.logs.textLength;
    }

    moveCursorTo(position) {
        this.cursorPosition = position;
    }

    moveCursorLeft(count) {
        this.moveCursorTo(this.cursorPosition-this.bytesOverChars(count*-1));
    }

    moveCursorToEnd() {
        this.moveCursorTo(this.line.length);
    }

    writeChar(charBuffer, start, end) {
        var char = charBuffer.toString("utf8", start, end);
        this.line = this.line.substring(0, this.cursorPosition) + char + this.line.substring(this.cursorPosition+this.bytesOverChars(1));
        this.moveCursorTo(this.cursorPosition+char.length);
    }

    insertNewLine() {
        this.line += "\n";
        this.lineCount++;
        this.moveCursorToEnd();
        this.updateREPL();
        this.clearLine();
    }

    clearLine() {
        this.cursorPosition = 0;
        this.line = "";
    }

    deleteToEndOfLine() {
        this.line = this.line.substring(0, this.cursorPosition);
        this.moveCursorTo(this.cursorPosition);
    }

    updateREPL() {
        var newLineIndex = this.logs.value.lastIndexOf("\n") + 1;
        this.logs.value = this.logs.value.substring(0, newLineIndex) + this.line;
        this.logs.selectionStart = this.cursorPosition + newLineIndex;
        this.logs.selectionEnd = this.cursorPosition + newLineIndex;
    }

    numberOfBytes(char) {
        return (char >= 0xc0 && char < 0xf8) ? ((0xe5 >> ((char >> 3) & 0x6)) & 3) + 1 : 1;
    }

    bytesOverChars(numberOfChars) {
        var step = numberOfChars > 0 ? 1 : -1;
        numberOfChars *= step;
        var numBytes = 0;
        var cp = this.cursorPosition;
        for(;numberOfChars > 0; numberOfChars--) {
            cp += step;
            numBytes++;
            var charCode = this.line.charCodeAt(cp);
            if(charCode >= 0xDC00 && charCode <= 0xDFFF) {
                cp += step;
                numBytes++;
            }
        }
        return numBytes;
    }

    removeExcessLines() {
        if (this.lineCount > this.maxLines) {
            var lines = this.logs.value.split("\n");
            this.logs.value = lines.slice(-40).join("\n");
            this.moveCursorToEnd();
            this.lineCount = 40;
        }
    }

    checkForFlooding() {
        // Clear the resetFlooded scheduled function and check if we are flooded
        clearTimeout(this.resetFlooded);
        this.resetFlooded = null;
        this.bufferFlooded = this.floodCount >= 5;
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
        this.atomSerialPort.close();
    }

    getElement() {
        return this.element;
    }
}
