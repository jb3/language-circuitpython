"use babel";

/* global atom */

import { BoardView } from "./board-view";
import { CompositeDisposable, Disposable } from "atom";

export default {
    subscriptions: null,

    activate() {
        this.subscriptions = new CompositeDisposable(
            // Add an opener for our view.
            atom.workspace.addOpener(uri => {
                if (uri === "atom://atom-circuitpython") {
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

            // Register command that toggles this view
            atom.commands.add("atom-workspace", {
                "atom-circuitpython:toggle": () => this.toggle()
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

    toggle() {
        atom.workspace.toggle("atom://atom-circuitpython");
    },

    deserializeBoardView() {
        return new BoardView();
    }

};
