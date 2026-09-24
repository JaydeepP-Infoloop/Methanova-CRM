export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function paiseField() {
  return {
    type: Number,
    required: true,
    default: 0,
    validate: {
      validator: (v: number) => Number.isInteger(v),
      message: "Monetary values must be integer paise",
    },
  };
}

/**
 * The same integer-paise guarantee for an amount that may legitimately be
 * unknown. Null and 0 are not interchangeable here for the same reason they
 * are not on a feedstock yield factor: null means "nobody has put a number on
 * this yet", 0 would assert the deal is worth nothing. `paiseField()` cannot
 * serve this case because it is required with a default of 0, which would turn
 * every unpriced record into a zero-value one.
 */
export function optionalPaiseField() {
  return {
    type: Number,
    default: null,
    validate: {
      validator: (v: number | null) => v === null || v === undefined || Number.isInteger(v),
      message: "Monetary values must be integer paise",
    },
  };
}
