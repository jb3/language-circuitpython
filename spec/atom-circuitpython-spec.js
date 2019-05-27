"use babel";

import { BoardView } from "../lib/board-view";

// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
// or `fdescribe`). Remove the `f` to unfocus the block.

describe("Atom CircuitPython", () => {
    let workspaceElement, activationPromise;

    beforeEach(() => {
        workspaceElement = atom.views.getView(atom.workspace);
        activationPromise = atom.packages.activatePackage("atom-circuitpython");
    });

    describe("when the atom-circuitpython:toggle event is triggered", () => {
        it("hides and shows the modal panel", () => {
            // Before the activation event the view is not on the DOM, and no panel
            // has been created
            expect(workspaceElement.querySelector(".atom-circuitpython")).not.toExist();

            // This is an activation event, triggering it will cause the package to be
            // activated.
            atom.commands.dispatch(workspaceElement, "atom-circuitpython:toggle");

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
