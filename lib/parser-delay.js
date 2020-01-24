"use babel";

const { Transform } = require("stream");

/**
 * A transform stream that emits data after a delay, combining any chunks that come in during the delay.
 * Useful when the serial out is being broken up, even though it is sent from the device with virtually
 * no delay. This combines the data from multiple receptions and presents it as one buffer.
 * @extends Transform
 * @summary To use the `Delay` parser, you can provide a delay in ms. If no delay is given the default is 10ms.
 * @example
const SerialPort = require('serialport')
const { DelayParser } = require("./parser-delay")
const port = new SerialPort('/dev/tty-usbserial1')
const parser = port.pipe(new DelayParser({ delimiter: '\n' }))
parser.on('data', console.log)
 */
export class DelayParser extends Transform {
    constructor(options = {}) {
        super(options);

        this.delay = options.delay !== undefined ? options.delay : 10;
        this.timeoutCall = null;
        this.buffer = Buffer.alloc(0);
    }

    _transform(chunk, encoding, callback) {
        if (this.timeoutCall != null) {
            clearTimeout(this.timeoutCall);
            this.timeoutCall = null;
        }
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.delayedPush();
        callback();
    }

    _flush(callback) {
        if (this.timeoutCall != null) {
            clearTimeout(this.timeoutCall);
            this.timeoutCall = null;
        }
        this.push(this.buffer);
        this.buffer = Buffer.alloc(0);
        callback();
    }

    delayedPush() {
        this.timeoutCall = setTimeout(() => {
            this.push(this.buffer);
            this.buffer = Buffer.alloc(0);
            this.timeoutCall = null;
        }, this.delay);
    }
}
