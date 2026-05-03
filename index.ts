type ValidationErrorCode =
  | "invalid_type"
  | "missing_field"
  | "min_length"
  | "max_length"
  | "length"
  | "unrecognized_key"
  | "invalid_string_format";

interface ValidationErrorOpts {
  key?: string;
}

class ValidationError {
  code: ValidationErrorCode;
  message: string;
  key?: string;
  constructor(
    message: string,
    code: ValidationErrorCode,
    opts?: ValidationErrorOpts,
  ) {
    this.code = code;
    this.message = message;
    this.key = opts?.key;
  }
}

class Schema {
  private schema: Primitive | Record<string, Primitive>;
  constructor(schema: Primitive | Record<string, Primitive>) {
    this.schema = schema;
  }
  parse(data: any): ValidationError | true {
    if (this.schema instanceof Primitive) {
      return this.schema.parse(data);
    } else {
      for (const [key, field] of Object.entries(this.schema)) {
        let exists = false;
        for (const [dataKey, value] of Object.entries(data)) {
          if (key === dataKey) {
            exists = true;
            const parseResult = field.parse(value);
            if (parseResult !== true) {
              parseResult.key = key;
              return parseResult;
            }
          }
        }
        if (!exists && !(field instanceof Optional)) {
          return new ValidationError(
            `Invalid input: Missing field ${key}`,
            "missing_field",
            { key },
          );
        }
      }
      return true;
    }
  }
}

function schema(schema: Primitive | Record<string, Primitive>): Schema {
  return new Schema(schema);
}

abstract class Primitive {
  abstract parse(value: any): ValidationError | true;
  abstract parse(value: any, key: string): ValidationError | true;
}

class UInt8ArrayPrimitive extends Primitive {
  override parse(value: any): ValidationError | true {
    if (!(value instanceof Uint8Array)) {
      return new ValidationError(
        `Invalid input: expected Uint8Array got ${typeof value}`,
        "invalid_type",
      );
    }
    return true;
  }
}

function Uint8Array() {
  return new UInt8ArrayPrimitive();
}

class NumberPrimitive extends Primitive {
  private minValue?: number;
  private maxValue?: number;

  min(value: number): NumberPrimitive {
    this.minValue = value;
    return this;
  }
  max(value: number): NumberPrimitive {
    this.maxValue = value;
    return this;
  }

  override parse(value: number): ValidationError | true {
    if (typeof value !== "number") {
      return new ValidationError(
        `Invalid input: expected number got ${typeof value}`,
        "invalid_type",
      );
    }
    if (this.minValue && value < this.minValue) {
      return new ValidationError(
        "Invalid input: number is smaller",
        "min_length",
      );
    }

    if (this.maxValue && value > this.maxValue) {
      return new ValidationError(
        "Invalid input: number is bigger",
        "max_length",
      );
    }

    return true;
  }
}

function number(): NumberPrimitive {
  return new NumberPrimitive();
}

class StringPrimitive extends Primitive {
  private minLength?: number;
  private maxLength?: number;
  private stringLength?: number;
  private includesString?: string;

  override parse(value: any): ValidationError | true {
    if (typeof value !== "string") {
      return new ValidationError(
        "Invalid input: expected string",
        "invalid_type",
      );
    }

    if (this.minLength && value.length < this.minLength) {
      return new ValidationError(
        "Invalid input: string length is smaller than minimum length",
        "min_length",
      );
    }

    if (this.maxLength && value.length > this.maxLength) {
      return new ValidationError(
        "Invalid input: string length is bigger than maximum length",
        "max_length",
      );
    }

    if (this.stringLength && value.length !== this.stringLength) {
      return new ValidationError(
        "Invalid input: string length doesnt match",
        "length",
      );
    }

    if (this.includesString && value.includes(this.includesString)) {
      return new ValidationError(
        `Invalid input: string doesnt include ${this.includesString}`,
        "invalid_string_format",
      );
    }

    return true;
  }

  min(length: number): StringPrimitive {
    this.minLength = length;
    return this;
  }
  max(length: number): StringPrimitive {
    this.maxLength = length;
    return this;
  }

  includes(pattern: string) {
    this.includesString = pattern;
    return this;
  }
}

function string(): StringPrimitive {
  return new StringPrimitive();
}

class ArrayPrimitive extends Primitive {
  private minValue?: number;
  private maxValue?: number;

  min(value: number) {
    this.minValue = value;
    return this;
  }
  max(value: number) {
    this.maxValue = value;
    return this;
  }

  override parse(value: any): ValidationError | true {
    if (!Array.isArray(value)) {
      return new ValidationError("Invalid input: Not an array", "invalid_type");
    }

    if (this.minValue && value.length < this.minValue) {
      return new ValidationError(
        "Invalid input: Too few elements in array",
        "min_length",
      );
    }

    if (this.maxValue && value.length < this.maxValue) {
      return new ValidationError(
        "Invalid input: Too many elements in array",
        "max_length",
      );
    }

    return true;
  }
}

function array() {
  return new ArrayPrimitive();
}

class Email extends StringPrimitive {
  override parse(value: any): ValidationError | true {
    if (typeof value !== "string") {
      return new ValidationError(
        `Invalid input: expected string got ${typeof value}`,
        "invalid_type",
      );
    }

    if (
      new RegExp(/"[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}"/).test(
        value,
      )
    ) {
      return new ValidationError(
        `Invalid input: Not a valid email`,
        "invalid_type",
      );
    }

    return true;
  }
}

function email() {
  return new Email();
}

class BoolPrimitive extends Primitive {
  parse(value: any): ValidationError | true {
    if (typeof value !== "boolean") {
      return new ValidationError(
        `Invalid input: expected boolean got ${typeof value}`,
        "invalid_type",
      );
    }
    return true;
  }
}

function boolean() {
  return new BoolPrimitive();
}

class NullPrimitive extends Primitive {
  parse(value: any): ValidationError | true {
    if (value !== null) {
      return new ValidationError(
        `Invalid input: expected null got ${typeof value}`,
        "invalid_type",
      );
    }
    return true;
  }
}

function nullPrimitive() {
  return new NullPrimitive();
}

class Nullable extends Primitive {
  wrappedPrimitive: Primitive;

  constructor(primitive: Primitive) {
    super();
    this.wrappedPrimitive = primitive;
  }

  parse(value: any): ValidationError | true {
    if (value === null) {
      return true;
    }
    return this.wrappedPrimitive.parse(value);
  }
}

function nullable(primitive: Primitive) {
  return new Nullable(primitive);
}

class Optional extends Primitive {
  wrappedPrimitive: Primitive;

  constructor(primitive: Primitive) {
    super();
    this.wrappedPrimitive = primitive;
  }

  parse(value: any): ValidationError | true {
    if (value === undefined) {
      return true;
    }
    return this.wrappedPrimitive.parse(value);
  }
}

function optional(primitive: Primitive) {
  return new Optional(primitive);
}

class Literal extends StringPrimitive {
  literal: string;

  constructor(literal: string) {
    super();
    this.literal = literal;
  }

  override parse(value: any): ValidationError | true {
    if (typeof value !== "string") {
      return new ValidationError(
        `Invalid input: expected string got ${typeof value}`,
        "invalid_type",
      );
    }

    if (value != this.literal) {
      return new ValidationError(
        `Invalid input: expected "${this.literal}" got ${typeof value}`,
        "invalid_type",
      );
    }

    return true;
  }
}

function literal(literal: string) {
  return new Literal(literal);
}

export {
  string,
  schema,
  number,
  email,
  array,
  literal,
  boolean,
  nullPrimitive as null,
  nullable,
  optional,
  type ValidationErrorCode,
  Uint8Array,
};
