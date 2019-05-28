"use babel";

/* global describe beforeEach atom it expect waitsForPromise runs */

import { BoardView } from "../lib/board-view";

// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
// or `fdescribe`). Remove the `f` to unfocus the block.

describe("CircuitPython", () => {
    let workspaceElement, activationPromise;

    beforeEach(() => {
        workspaceElement = atom.views.getView(atom.workspace);
        activationPromise = atom.packages.activatePackage("language-circuitpython");
    });

    describe("when the language-circuitpython:toggle-serial event is triggered", () => {
        it("hides and shows the modal panel", () => {
            // Before the activation event the view is not on the DOM, and no panel
            // has been created
            expect(workspaceElement.querySelector(".language-circuitpython")).not.toExist();

            // This is an activation event, triggering it will cause the package to be
            // activated.
            atom.commands.dispatch(workspaceElement, "language-circuitpython:toggle-serial");

            waitsForPromise(() => {
                return activationPromise;
            });

            runs(() => {
                let found;
                atom.workspace.getPanes().forEach(item => {
                    item.getItems().forEach(p => {
                        if (p instanceof BoardView) {
                            item.activateItemAtIndex(p);
                            found = true;
                        }
                    });
                });

                expect(found).toBe(true);
            });
        });
    });
});
