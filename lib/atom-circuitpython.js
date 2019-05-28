"use babel";

/* global atom */

import { BoardView } from "./board-view";
import { PlotterView } from "./plotter-view";
import { CompositeDisposable, Disposable } from "atom";

export default {
    subscriptions: null,

    activate() {
        this.subscriptions = new CompositeDisposable(
            // Add an opener for our view.
            atom.workspace.addOpener(uri => {
                if (uri === "atom://atom-circuitpython-serial") {
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
                        found = new BoardView();
                    }
                    return found;
                }
            }),

            atom.workspace.addOpener(uri => {
                if (uri === "atom://atom-circuitpython-plotter") {
                    // We need a serial connection before we can plot, so toggle
                    // the serial as well

                    atom.workspace.toggle("atom://atom-circuitpython-serial");
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
                        found = new PlotterView();
                    }
                    return found;
                }
            }),

            // Register command that toggles this view
            atom.commands.add("atom-workspace", {
                "atom-circuitpython:toggle-serial": () => this.toggleSerial(),
                "atom-circuitpython:toggle-plotter": () => this.togglePlotter()
            }),

            // Destroy any ActiveEditorInfoViews when the package is deactivated.
            new Disposable(() => {
                atom.workspace.getPaneItems().forEach(item => {
                    if (item instanceof BoardView) {
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
        atom.workspace.toggle("atom://atom-circuitpython-plotter");
    },

    toggleSerial() {
        atom.workspace.toggle("atom://atom-circuitpython-serial");
    },

    deserializeBoardView() {
        return new BoardView();
    },

    deserializePlotterView() {
        return new PlotterView();
    }

};
