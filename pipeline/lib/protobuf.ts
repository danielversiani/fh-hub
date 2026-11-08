/**
 * Minimal schema-less protobuf wire-format reader. QQ Docs ships sheet data as
 * base64 → zlib → protobuf with no published schema, so fields are addressed by number.
 * The field numbers we rely on are documented in pipeline/lib/qq-sheet.ts.
 */

export type WireValue =
  | { wire: 0; value: number } // varint
  | { wire: 1; value: Buffer } // fixed64
  | { wire: 2; value: Buffer } // length-delimited (message, string or bytes)
  | { wire: 5; value: Buffer }; // fixed32

export interface Field {
  field: number;
  data: WireValue;
}

function readVarint(buf: Buffer, start: number): [number, number] {
  let result = 0;
  let multiplier = 1;
  let i = start;
  for (;;) {
    if (i >= buf.length) throw new Error('truncated varint');
    const byte = buf[i++]!;
    result += (byte & 0x7f) * multiplier;
    if (byte < 0x80) return [result, i];
    multiplier *= 128;
  }
}

export function decodeMessage(buf: Buffer): Field[] {
  const fields: Field[] = [];
  let i = 0;
  while (i < buf.length) {
    const [key, afterKey] = readVarint(buf, i);
    i = afterKey;
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (field === 0) throw new Error('invalid field number 0');
    switch (wire) {
      case 0: {
        const [value, next] = readVarint(buf, i);
        fields.push({ field, data: { wire: 0, value } });
        i = next;
        break;
      }
      case 1:
        fields.push({ field, data: { wire: 1, value: buf.subarray(i, i + 8) } });
        i += 8;
        break;
      case 2: {
        const [length, next] = readVarint(buf, i);
        if (next + length > buf.length) throw new Error('truncated length-delimited field');
        fields.push({ field, data: { wire: 2, value: buf.subarray(next, next + length) } });
        i = next + length;
        break;
      }
      case 5:
        fields.push({ field, data: { wire: 5, value: buf.subarray(i, i + 4) } });
        i += 4;
        break;
      default:
        throw new Error(`unsupported wire type ${wire}`);
    }
  }
  return fields;
}

/** Convenience accessors over a decoded message. */
export class Message {
  readonly fields: Field[];

  constructor(buf: Buffer) {
    this.fields = decodeMessage(buf);
  }

  static tryParse(buf: Buffer): Message | undefined {
    try {
      return new Message(buf);
    } catch {
      return undefined;
    }
  }

  all(field: number): WireValue[] {
    return this.fields.filter((f) => f.field === field).map((f) => f.data);
  }

  int(field: number, fallback = 0): number {
    const v = this.all(field)[0];
    return v?.wire === 0 ? v.value : fallback;
  }

  bytes(field: number): Buffer | undefined {
    const v = this.all(field)[0];
    return v?.wire === 2 ? v.value : undefined;
  }

  message(field: number): Message | undefined {
    const b = this.bytes(field);
    return b ? new Message(b) : undefined;
  }

  messages(field: number): Message[] {
    return this.all(field).flatMap((v) => (v.wire === 2 ? [new Message(v.value)] : []));
  }

  string(field: number): string | undefined {
    return this.bytes(field)?.toString('utf8');
  }

  /** First fixed64 field anywhere in this message, read as a double. */
  firstDouble(): number | undefined {
    for (const f of this.fields) {
      if (f.data.wire === 1) return f.data.value.readDoubleLE(0);
      if (f.data.wire === 2) {
        const nested = Message.tryParse(f.data.value)?.firstDouble();
        if (nested !== undefined) return nested;
      }
    }
    return undefined;
  }
}
