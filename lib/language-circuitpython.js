"use babel";

/* global atom */

import { BoardView } from "./board-view";
import { PlotterView } from "./plotter-view";
import { CompositeDisposable, Disposable } from "atom";

import { AtomSerialPort } from "./atom-serialport";

import * as fs from "fs";

export default {
    subscriptions: null,
    config: {
        darkMode: {
            type: "string",
            default: "dark",
            enum: [
                {value: "dark", description: "Dark Mode - Lines drawn on the plotter will be light"},
                {value: "light", description: "Light Mode - Lines drawn on the plotter will be dark"}
            ]
        },
        maxLines: {
            type: "integer",
            default: 100,
            minimum: 50,
            description: "Maximum lines to display in the serial output console"
        }
    },
    activate() {
        // Code taken from https://github.com/adafruit/Atom-fsync-on-save
        atom.workspace.observeTextEditors(
            function(editor) {
                editor.onDidSave(function(event) {
                    // Sync the file.
                    var fd = fs.openSync(event.path, "a");
                    fs.fsyncSync(fd);
                    fs.closeSync(fd);
                });
            }
        );
        this.subscriptions = new CompositeDisposable(
            atom.workspace.addOpener(uri => {
                if (uri === "atom://language-circuitpython-serial") {
                    let found = false;
                    atom.workspace.getPanes().forEach(item => {
                        item.getItems().forEach(p => {
                            if (p instanceof BoardView) {
                                item.activateItemAtIndex(p);
                                found = p;
                            }
                        });
                    });

                    if (!found) {
                        found = new BoardView(this.getAtomSerialPort());
                        this.boardView = found;
                    }
                    return found;
                }
            }),

            atom.workspace.addOpener(uri => {
                if (uri === "atom://language-circuitpython-plotter") {
                    // We need a serial connection before we can plot, so toggle
                    // the serial as well

                    // atom.workspace.toggle("atom://language-circuitpython-serial");
                    let found = false;
                    atom.workspace.getPanes().forEach(item => {
                        item.getItems().forEach(p => {
                            if (p instanceof PlotterView) {
                                item.activateItemAtIndex(p);
                                found = p;
                            }
                        });
                    });

                    if (!found) {
                        found = new PlotterView(this.getAtomSerialPort());
                    }
                    return found;
                }
            }),

            // Register command that toggles this view
            atom.commands.add("atom-workspace", {
                "language-circuitpython:toggle-serial": () => this.toggleSerial(),
                "language-circuitpython:toggle-plotter": () => this.togglePlotter()
            }),

            // Destroy any ActiveEditorInfoViews when the package is deactivated.
            new Disposable(() => {
                atom.workspace.getPaneItems().forEach(item => {
                    if (item instanceof BoardView || item instanceof PlotterView) {
                        item.destroy();
                    }
                });
            })
        );

    },

    deactivate() {
        this.subscriptions.dispose();
    },

    togglePlotter() {
        atom.workspace.toggle("atom://language-circuitpython-plotter");
    },

    toggleSerial() {
        atom.workspace.toggle("atom://language-circuitpython-serial");
    },

    deserializeBoardView() {
        return new BoardView(this.getAtomSerialPort());
    },

    deserializePlotterView() {
        return new PlotterView(this.getAtomSerialPort());
    },

    getAtomSerialPort() {
        if(this.atomSerialPort == null) {
            this.atomSerialPort = new AtomSerialPort();
        }
        return this.atomSerialPort;
    }
};
