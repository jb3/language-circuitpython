"use babel";

/* global atom */

import SerialPort from "serialport";

const vendorIDs = [
    "239a" // Adafruit vendor ID
];

export class AtomSerialPort {
    constructor() {
        this.sp = null;
        this.callbacks = [];

        this.connecting = false;
        this.listeners = 0;
    }

    connect() {
        this.connecting = true;
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
            this.sp = new SerialPort(chosenBoard.comName, {
                baudRate: 115200
            });

            this.sp.on("close", (err) => {
                if (err && err.disconnected) {
                    atom.notifications.addWarning("Board Disconnected");
                    this.sp = null;
                }
            });



            atom.notifications.addSuccess("Acquired board!");

            for (var callback of this.callbacks) {
                callback(this.sp);
            }
            this.callbacks = [];
            this.connecting = false;
        });
    }

    disconnect() {
        // Close the stream if one is opened
        if (this.sp) {
            atom.notifications.addInfo("Disconnecting from board");
            if(this.sp.isOpen) {
                this.sp.close();
            }
            this.sp = null;
        }
    }

    data(callback) {
        this.listeners+=1;
        if (this.sp != null) {
            callback(this.sp);
        }else {
            if (!this.connecting) {
                this.connect();
            }
            this.callbacks.push(callback);
        }
    }

    close() {
        this.listeners-=1;
        if (this.listeners == 0) {
            this.disconnect();
        }
    }
}
