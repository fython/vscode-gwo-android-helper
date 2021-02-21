import { Readable, Duplex } from 'stream';

export function toReadable(data: Uint8Array): Readable {
    const stream = new Duplex();
    stream.push(data);
    stream.push(null);
    return stream;
}
